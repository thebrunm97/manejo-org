package state

import (
	"reflect"
	"testing"

	"github.com/thebrunm97/pmo-bot-go/internal/llm"
	"github.com/thebrunm97/pmo-bot-go/internal/mcp"
)

func ptrIntent(i Intent) *Intent {
	return &i
}

func TestFilterToolsByRouterResult(t *testing.T) {
	allTools := []mcp.Tool{
		{Definition: llm.FerramentaAgnostica{Name: "rag_tool"}, Category: mcp.CategoryRAG},
		{Definition: llm.FerramentaAgnostica{Name: "db_read_tool"}, Category: mcp.CategoryDBRead},
		{Definition: llm.FerramentaAgnostica{Name: "db_write_tool"}, Category: mcp.CategoryDBWrite},
		{Definition: llm.FerramentaAgnostica{Name: "chat_tool"}, Category: mcp.CategoryChat},
	}

	tests := []struct {
		name       string
		result     RouterResult
		wantFilter []string
	}{
		{
			name: "fallback por invalidação (isMixed=true mas secondary=nil)",
			result: RouterResult{
				PrimaryIntent: IntentAgronomy,
				Confidence:    0.9,
				IsMixed:       true,
			},
			wantFilter: []string{"rag_tool", "chat_tool"},
		},
		{
			name: "fallback por invalidação (NeedsWrite=true mas Scope=none)",
			result: RouterResult{
				PrimaryIntent: IntentDatabase,
				Confidence:    0.9,
				NeedsWrite:    true,
				WriteScope:    WriteScopeNone,
			},
			wantFilter: []string{"rag_tool", "chat_tool"},
		},
		{
			name: "saudação chat simples",
			result: RouterResult{
				PrimaryIntent: IntentChat,
				Confidence:    0.9,
				NeedsWrite:    false,
			},
			wantFilter: []string{"chat_tool"},
		},
		{
			name: "comando de registro (DATABASE + NeedsWrite)",
			result: RouterResult{
				PrimaryIntent: IntentDatabase,
				Confidence:    1.0,
				NeedsWrite:    true,
				WriteScope:    WriteScopeFarmRecord,
			},
			wantFilter: []string{"db_read_tool", "db_write_tool", "chat_tool"},
		},
		{
			name: "resultado híbrido válido (Agronomy + Database Write)",
			result: RouterResult{
				PrimaryIntent:   IntentAgronomy,
				SecondaryIntent: ptrIntent(IntentDatabase),
				Confidence:      0.85,
				IsMixed:         true,
				NeedsWrite:      true,
				WriteScope:      WriteScopePlot,
			},
			wantFilter: []string{"rag_tool", "db_read_tool", "db_write_tool", "chat_tool"},
		},
		{
			name: "resultado híbrido válido (Database + Agronomy Read)",
			result: RouterResult{
				PrimaryIntent:   IntentDatabase,
				SecondaryIntent: ptrIntent(IntentAgronomy),
				Confidence:      0.85,
				IsMixed:         true,
				NeedsWrite:      false,
			},
			wantFilter: []string{"rag_tool", "db_read_tool", "chat_tool"},
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			got := FilterToolsByRouterResult(tt.result, allTools)
			var gotNames []string
			for _, tool := range got {
				gotNames = append(gotNames, tool.Definition.Name)
			}

			if len(gotNames) == 0 && len(tt.wantFilter) == 0 {
				return
			}

			if !reflect.DeepEqual(gotNames, tt.wantFilter) {
				t.Errorf("FilterToolsByRouterResult() got tools %v, want %v", gotNames, tt.wantFilter)
			}
		})
	}
}
