// worker_client.go extends supabase.Client with the methods required by the
// knowledge worker pool (polling, locking, progress updates, storage download).
package supabase

import (
	"bytes"
	"context"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"strings"
	"time"
)

// ClaimNextIngestionJob atomically claims a pending job using an RPC that wraps
// SELECT ... FOR UPDATE SKIP LOCKED, ensuring only one worker processes each job.
// Returns nil, nil when there are no pending jobs.
func (c *Client) ClaimNextIngestionJob(ctx context.Context, workerID string) (*KnowledgeIngestionJob, error) {
	body, err := json.Marshal(map[string]string{"p_worker_id": workerID})
	if err != nil {
		return nil, err
	}

	req, err := http.NewRequestWithContext(ctx, http.MethodPost,
		c.config.URL+"/rest/v1/rpc/claim_next_ingestion_job", bytes.NewReader(body))
	if err != nil {
		return nil, fmt.Errorf("build request: %w", err)
	}
	c.setHeaders(req)

	resp, err := c.httpClient.Do(req)
	if err != nil {
		return nil, fmt.Errorf("http: %w", err)
	}
	defer resp.Body.Close()

	if resp.StatusCode == http.StatusNoContent {
		return nil, nil // no job available
	}
	if resp.StatusCode >= 300 {
		b, _ := io.ReadAll(resp.Body)
		return nil, fmt.Errorf("claim job rpc: status %d — %s", resp.StatusCode, string(b))
	}

	var jobs []KnowledgeIngestionJob
	if err := json.NewDecoder(resp.Body).Decode(&jobs); err != nil {
		return nil, fmt.Errorf("decode: %w", err)
	}
	if len(jobs) == 0 {
		return nil, nil
	}
	return &jobs[0], nil
}

// UpdateIngestionJobStatus updates the status, step, progress and error of a job.
func (c *Client) UpdateIngestionJobStatus(ctx context.Context, jobID, status string, errMsg *string, pct *int, workerID string) error {
	now := time.Now()
	payload := map[string]interface{}{
		"status":    status,
		"worker_id": workerID,
	}
	if pct != nil {
		payload["progress_pct"] = *pct
	}
	if errMsg != nil {
		payload["error_log"] = *errMsg
	}
	if status == "extracting" {
		payload["started_at"] = now
	}
	if status == "indexed" || status == "failed" {
		payload["finished_at"] = now
	}
	if status != "pending" {
		payload["step"] = status
	}

	body, err := json.Marshal(payload)
	if err != nil {
		return err
	}

	req, err := http.NewRequestWithContext(ctx, http.MethodPatch,
		c.config.URL+"/rest/v1/ingestion_jobs?id=eq."+jobID, bytes.NewReader(body))
	if err != nil {
		return fmt.Errorf("build request: %w", err)
	}
	c.setHeaders(req)
	req.Header.Set("Prefer", "return=minimal")

	resp, err := c.httpClient.Do(req)
	if err != nil {
		return fmt.Errorf("http: %w", err)
	}
	defer resp.Body.Close()

	if resp.StatusCode >= 300 {
		b, _ := io.ReadAll(resp.Body)
		return fmt.Errorf("update job status: status %d — %s", resp.StatusCode, string(b))
	}
	return nil
}

// UpdateIngestionJobVersionID links a version to an ingestion job after creation.
func (c *Client) UpdateIngestionJobVersionID(ctx context.Context, jobID, versionID string) error {
	body, err := json.Marshal(map[string]string{"version_id": versionID})
	if err != nil {
		return err
	}

	req, err := http.NewRequestWithContext(ctx, http.MethodPatch,
		c.config.URL+"/rest/v1/ingestion_jobs?id=eq."+jobID, bytes.NewReader(body))
	if err != nil {
		return fmt.Errorf("build request: %w", err)
	}
	c.setHeaders(req)
	req.Header.Set("Prefer", "return=minimal")

	resp, err := c.httpClient.Do(req)
	if err != nil {
		return fmt.Errorf("http: %w", err)
	}
	defer resp.Body.Close()

	if resp.StatusCode >= 300 {
		b, _ := io.ReadAll(resp.Body)
		return fmt.Errorf("update job version_id: status %d — %s", resp.StatusCode, string(b))
	}
	return nil
}

// InsertKnowledgeVersion persists a new version record.
func (c *Client) InsertKnowledgeVersion(ctx context.Context, v KnowledgeVersion) error {
	body, err := json.Marshal(v)
	if err != nil {
		return fmt.Errorf("marshal version: %w", err)
	}

	req, err := http.NewRequestWithContext(ctx, http.MethodPost,
		c.config.URL+"/rest/v1/knowledge_versions", bytes.NewReader(body))
	if err != nil {
		return fmt.Errorf("build request: %w", err)
	}
	c.setHeaders(req)
	req.Header.Set("Prefer", "return=minimal")

	resp, err := c.httpClient.Do(req)
	if err != nil {
		return fmt.Errorf("http: %w", err)
	}
	defer resp.Body.Close()

	if resp.StatusCode >= 300 {
		b, _ := io.ReadAll(resp.Body)
		return fmt.Errorf("insert version: status %d — %s", resp.StatusCode, string(b))
	}
	return nil
}

// GetKnowledgeDocumentByID fetches a single document by primary key.
func (c *Client) GetKnowledgeDocumentByID(ctx context.Context, docID string) (*KnowledgeDocument, error) {
	req, err := http.NewRequestWithContext(ctx, http.MethodGet,
		c.config.URL+"/rest/v1/knowledge_documents?id=eq."+docID+"&limit=1", nil)
	if err != nil {
		return nil, fmt.Errorf("build request: %w", err)
	}
	c.setHeaders(req)

	resp, err := c.httpClient.Do(req)
	if err != nil {
		return nil, fmt.Errorf("http: %w", err)
	}
	defer resp.Body.Close()

	if resp.StatusCode >= 300 {
		b, _ := io.ReadAll(resp.Body)
		return nil, fmt.Errorf("get document: status %d — %s", resp.StatusCode, string(b))
	}

	var docs []KnowledgeDocument
	if err := json.NewDecoder(resp.Body).Decode(&docs); err != nil {
		return nil, fmt.Errorf("decode: %w", err)
	}
	if len(docs) == 0 {
		return nil, fmt.Errorf("document not found: %s", docID)
	}
	return &docs[0], nil
}

// DownloadStorageFile downloads a file from a Supabase Storage bucket.
func (c *Client) DownloadStorageFile(ctx context.Context, bucket, path string) ([]byte, error) {
	url := fmt.Sprintf("%s/storage/v1/object/%s/%s", c.config.URL, bucket, path)
	req, err := http.NewRequestWithContext(ctx, http.MethodGet, url, nil)
	if err != nil {
		return nil, fmt.Errorf("build request: %w", err)
	}
	req.Header.Set("apikey", c.config.Key)
	req.Header.Set("Authorization", "Bearer "+c.config.Key)

	resp, err := c.httpClient.Do(req)
	if err != nil {
		return nil, fmt.Errorf("http: %w", err)
	}
	defer resp.Body.Close()

	if resp.StatusCode >= 300 {
		b, _ := io.ReadAll(resp.Body)
		return nil, fmt.Errorf("storage download: status %d — %s", resp.StatusCode, string(b))
	}

	data, err := io.ReadAll(resp.Body)
	if err != nil {
		return nil, fmt.Errorf("read body: %w", err)
	}
	return data, nil
}

// UploadStorageFile envia um objeto para um bucket do Supabase Storage.
//
// Usa `x-upsert: false` deliberadamente: o Cofre de Auditoria gera nomes
// aleatórios e uma colisão significaria sobrescrever a gravação de outra
// pessoa. Falhar é o comportamento correto — colisão silenciosa destruiria a
// prova de não-repúdio de alguém.
func (c *Client) UploadStorageFile(ctx context.Context, bucket, path string, data []byte, contentType string) error {
	url := fmt.Sprintf("%s/storage/v1/object/%s/%s", c.config.URL, bucket, path)

	req, err := http.NewRequestWithContext(ctx, http.MethodPost, url, bytes.NewReader(data))
	if err != nil {
		return fmt.Errorf("build request: %w", err)
	}
	req.Header.Set("apikey", c.config.Key)
	req.Header.Set("Authorization", "Bearer "+c.config.Key)
	req.Header.Set("Content-Type", contentType)
	req.Header.Set("x-upsert", "false")

	resp, err := c.httpClient.Do(req)
	if err != nil {
		return fmt.Errorf("http: %w", err)
	}
	defer resp.Body.Close()

	if resp.StatusCode >= 300 {
		b, _ := io.ReadAll(resp.Body)
		return fmt.Errorf("storage upload: status %d — %s", resp.StatusCode, string(b))
	}
	return nil
}

// InsertAuditVaultRecord indexa uma gravação do Cofre de Auditoria (DT-42).
//
// Recebe apenas tipos primitivos, deliberadamente: importar domain.AuditRecord
// aqui criaria um ciclo (supabase → domain → ports → supabase). A tradução do
// tipo de domínio para estes parâmetros fica em internal/adapter/auditvault,
// que pode importar os dois lados sem fechar o ciclo.
//
// finalIntent vazio é gravado como NULL, e não como string vazia: a intenção só
// é decidida adiante pelo roteador, e é essa distinção entre "ainda não
// classificado" e "classificado como nada" que permite preencher depois.
func (c *Client) InsertAuditVaultRecord(
	ctx context.Context,
	profileID, storagePath, finalIntent string,
	createdAt, expiresAt time.Time,
) error {
	var intent interface{}
	if strings.TrimSpace(finalIntent) != "" {
		intent = finalIntent
	}

	payload, err := json.Marshal(map[string]interface{}{
		"profile_id":   profileID,
		"storage_path": storagePath,
		"final_intent": intent,
		"created_at":   createdAt,
		"expires_at":   expiresAt,
	})
	if err != nil {
		return fmt.Errorf("serializar registro do cofre: %w", err)
	}

	reqURL := fmt.Sprintf("%s/rest/v1/audios_audit", c.config.URL)
	if _, err := c.doRequestWithContext(ctx, http.MethodPost, reqURL, payload); err != nil {
		return fmt.Errorf("indexar registro do cofre: %w", err)
	}
	return nil
}

// AuditVaultRow espelha uma linha de public.audios_audit para o expurgo.
//
// Tipo próprio, e não domain.AuditRecord, pelo mesmo motivo de
// InsertAuditVaultRecord: este pacote não pode importar internal/domain sem
// fechar um ciclo. A tradução para o tipo de domínio acontece no adaptador.
type AuditVaultRow struct {
	StoragePath string    `json:"storage_path"`
	ProfileID   string    `json:"profile_id"`
	CreatedAt   time.Time `json:"created_at"`
	ExpiresAt   time.Time `json:"expires_at"`
}

// ListExpiredAuditVaultRows retorna as linhas de audios_audit vencidas.
//
// O filtro por expires_at acontece no SERVIDOR (query param), não trazendo a
// tabela inteira para filtrar em memória: a tabela cresce continuamente e o
// expurgo roda a cada 24h, então filtrar do lado do Postgres é o que mantém a
// operação barata conforme o volume aumenta.
func (c *Client) ListExpiredAuditVaultRows(ctx context.Context, before time.Time) ([]AuditVaultRow, error) {
	reqURL := fmt.Sprintf("%s/rest/v1/audios_audit?expires_at=lt.%s&select=storage_path,profile_id,created_at,expires_at",
		c.config.URL, before.UTC().Format(time.RFC3339))

	req, err := http.NewRequestWithContext(ctx, http.MethodGet, reqURL, nil)
	if err != nil {
		return nil, fmt.Errorf("build request: %w", err)
	}
	req.Header.Set("apikey", c.config.Key)
	req.Header.Set("Authorization", "Bearer "+c.config.Key)

	resp, err := c.httpClient.Do(req)
	if err != nil {
		return nil, fmt.Errorf("http: %w", err)
	}
	defer resp.Body.Close()

	if resp.StatusCode >= 300 {
		b, _ := io.ReadAll(resp.Body)
		return nil, fmt.Errorf("listar vencidos: status %d — %s", resp.StatusCode, string(b))
	}

	var rows []AuditVaultRow
	if err := json.NewDecoder(resp.Body).Decode(&rows); err != nil {
		return nil, fmt.Errorf("decode: %w", err)
	}
	return rows, nil
}

// DeleteStorageFile remove um objeto de um bucket do Supabase Storage.
//
// Usada pelo expurgo para apagar o OBJETO antes da linha do índice — a ordem
// que evita órfãos no bucket (ver internal/domain/audit_gc.go).
func (c *Client) DeleteStorageFile(ctx context.Context, bucket, path string) error {
	url := fmt.Sprintf("%s/storage/v1/object/%s/%s", c.config.URL, bucket, path)

	req, err := http.NewRequestWithContext(ctx, http.MethodDelete, url, nil)
	if err != nil {
		return fmt.Errorf("build request: %w", err)
	}
	req.Header.Set("apikey", c.config.Key)
	req.Header.Set("Authorization", "Bearer "+c.config.Key)

	resp, err := c.httpClient.Do(req)
	if err != nil {
		return fmt.Errorf("http: %w", err)
	}
	defer resp.Body.Close()

	if resp.StatusCode < 300 {
		return nil
	}

	body, _ := io.ReadAll(resp.Body)

	// "Não existe" é tratado como sucesso: o objeto já está no estado que a
	// exclusão persegue. Sem isto, um expurgo reexecutado após falha parcial
	// (objeto já apagado, índice ainda não) travaria para sempre nesse registro.
	//
	// A API de Storage do Supabase NÃO devolve HTTP 404 para objeto ausente:
	// devolve HTTP 400 com um "statusCode": "404" embutido no corpo JSON
	// (verificado em produção — confirmado com um registro de teste apontando
	// para um objeto inexistente). Checar apenas resp.StatusCode teria feito
	// todo expurgo de um objeto já removido falhar permanentemente.
	var parsed struct {
		StatusCode string `json:"statusCode"`
		Error      string `json:"error"`
	}
	if json.Unmarshal(body, &parsed) == nil &&
		(parsed.StatusCode == "404" || strings.EqualFold(parsed.Error, "not_found")) {
		return nil
	}

	return fmt.Errorf("storage delete: status %d — %s", resp.StatusCode, string(body))
}

// DeleteAuditVaultRow remove a linha do índice pelo storage_path.
//
// Só deve ser chamada depois que DeleteStorageFile confirmou a remoção do
// objeto correspondente — nunca antes, e nunca de forma independente pelo
// expurgo.
func (c *Client) DeleteAuditVaultRow(ctx context.Context, storagePath string) error {
	reqURL := fmt.Sprintf("%s/rest/v1/audios_audit?storage_path=eq.%s", c.config.URL, storagePath)

	req, err := http.NewRequestWithContext(ctx, http.MethodDelete, reqURL, nil)
	if err != nil {
		return fmt.Errorf("build request: %w", err)
	}
	req.Header.Set("apikey", c.config.Key)
	req.Header.Set("Authorization", "Bearer "+c.config.Key)

	resp, err := c.httpClient.Do(req)
	if err != nil {
		return fmt.Errorf("http: %w", err)
	}
	defer resp.Body.Close()

	if resp.StatusCode >= 300 {
		b, _ := io.ReadAll(resp.Body)
		return fmt.Errorf("delete indice: status %d — %s", resp.StatusCode, string(b))
	}
	return nil
}
