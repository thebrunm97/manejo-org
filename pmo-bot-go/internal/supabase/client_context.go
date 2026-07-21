package supabase

import (
	"encoding/json"
	"fmt"
	"log"
	"net/http"
	"sort"
	"strings"
)

// interval represents a range of chunk indices
type interval struct {
	Start int
	End   int
}

// GetContextWindows fetch neighboring chunks for a given list of document IDs.
// It deduplicates overlapping intervals and truncates the total context if it exceeds maxChars.
func (c *Client) GetContextWindows(documentIDs []int64, windowSize int) ([]DocumentMatchContext, error) {
	if len(documentIDs) == 0 {
		return nil, nil
	}

	var idStrs []string
	for _, id := range documentIDs {
		idStrs = append(idStrs, fmt.Sprintf("%d", id))
	}

	reqURL := fmt.Sprintf("%s/rest/v1/farm_documents?id=in.(%s)", c.config.URL, strings.Join(idStrs, ","))
	body, err := c.doRequest(http.MethodGet, reqURL, nil)
	if err != nil {
		return nil, fmt.Errorf("failed to fetch anchor documents: %w", err)
	}

	var anchors []DocumentMatchContext
	if err := json.Unmarshal(body, &anchors); err != nil {
		return nil, fmt.Errorf("failed to decode anchor documents: %w", err)
	}

	// Group anchors by source_document_id
	docIntervals := make(map[string][]interval)
	for _, anchor := range anchors {
		startIdx := anchor.ChunkIndex - windowSize
		if startIdx < 0 {
			startIdx = 0
		}
		endIdx := anchor.ChunkIndex + windowSize
		docIntervals[anchor.SourceDocumentID] = append(docIntervals[anchor.SourceDocumentID], interval{Start: startIdx, End: endIdx})
	}

	// Deduplicate overlapping intervals
	mergedIntervals := make(map[string][]interval)
	for docID, intervals := range docIntervals {
		sort.Slice(intervals, func(i, j int) bool {
			return intervals[i].Start < intervals[j].Start
		})
		
		var merged []interval
		if len(intervals) > 0 {
			current := intervals[0]
			for i := 1; i < len(intervals); i++ {
				// overlap or contiguous
				if intervals[i].Start <= current.End+1 {
					if intervals[i].End > current.End {
						current.End = intervals[i].End
					}
				} else {
					merged = append(merged, current)
					current = intervals[i]
				}
			}
			merged = append(merged, current)
		}
		mergedIntervals[docID] = merged
	}

	var allContexts []DocumentMatchContext
	totalChars := 0
	maxChars := 6000

	for docID, intervals := range mergedIntervals {
		encodedSourceID := strings.ReplaceAll(docID, " ", "%20")
		for _, iv := range intervals {
			winURL := fmt.Sprintf("%s/rest/v1/farm_documents?source_document_id=eq.%s&chunk_index=gte.%d&chunk_index=lte.%d&order=chunk_index.asc", 
				c.config.URL, encodedSourceID, iv.Start, iv.End)

			winBody, err := c.doRequest(http.MethodGet, winURL, nil)
			if err != nil {
				return nil, fmt.Errorf("failed to fetch context window for document %s: %w", docID, err)
			}

			var windowDocs []DocumentMatchContext
			if err := json.Unmarshal(winBody, &windowDocs); err != nil {
				return nil, fmt.Errorf("failed to decode window documents for %s: %w", docID, err)
			}

			for _, doc := range windowDocs {
				if totalChars+len(doc.Content) > maxChars {
					log.Printf("⚠️ [Supabase] Guardrail de Orçamento Atingido: O contexto ultrapassou %d caracteres. Truncando no chunk_index %d.", maxChars, doc.ChunkIndex)
					return allContexts, nil
				}
				allContexts = append(allContexts, doc)
				totalChars += len(doc.Content)
			}
		}
	}

	return allContexts, nil
}
