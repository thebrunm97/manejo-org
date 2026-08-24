// Package gateway expõe ao frontend web um proxy autenticado, com allowlist,
// para RPCs do Postgres que já existiam antes deste pacote (DT-59, fatia 3).
package gateway

// POR QUE PROXY, E NÃO REESCREVER AS RPCs EM GO
//
// As dez funções alvo (create_talhao, update_talhao, delete_talhao,
// create_caderno_registro, update_caderno_registro, delete_caderno_registro,
// rpc_update_propriedade, create_pmo, update_pmo, delete_pmo) são
// SECURITY DEFINER e derivam o dono do registro de auth.uid() — a claim `sub`
// do JWT que o PostgREST recebe (confirmado lendo
// supabase/migrations/20260818140000_create_domain_mutation_rpcs.sql: toda
// uma delas abre com `v_user_id := auth.uid(); IF v_user_id IS NULL THEN
// RAISE EXCEPTION 'Não autorizado'`).
//
// Se o Go chamasse essas RPCs com a chave de serviço (o que internal/supabase
// faz em todo o resto do sistema), auth.uid() viria NULL e toda chamada
// morreria em "Não autorizado" — a própria função já se protege disso.
// Reescrever as dez para aceitar um user_id explícito passado pelo Go trocaria
// autorização garantida pelo banco por autorização confiada ao chamador, e
// contradiria o ADR-002 (Fat Database), que deliberadamente mantém a regra de
// negócio — inclusive a de autorização — no Postgres.
//
// Em vez disso, o Go encaminha o MESMO `Authorization: Bearer <jwt>` do
// produtor, autenticado pelo internal/middleware do próprio Go, para o
// PostgREST — restrito a um allowlist fechado de nomes de RPC, nunca um proxy
// aberto para qualquer função do banco. auth.uid() resolve exatamente como já
// resolve hoje quando o frontend chama supabase.rpc(...) direto; o que muda é
// que a chamada passa a ter um único ponto de auditoria central, e um único
// lugar onde, no futuro, as mesmas guardrails que o bot do WhatsApp já aplica
// (blacklist de insumos, HITL) podem valer também para o caminho web — hoje
// elas só existem do lado do bot.

import (
	"bytes"
	"context"
	"fmt"
	"io"
	"log"
	"net/http"
	"strings"
	"time"

	"github.com/gin-gonic/gin"
	"github.com/thebrunm97/pmo-bot-go/internal/middleware"
)

// allowedRPCs é a lista fechada de funções que este proxy encaminha. Cada
// entrada existe porque uma tela do pmo-frontend hoje chama
// supabase.rpc(nome) direto contra o PostgREST — nunca um nome novo sem uma
// RPC correspondente já existente e já auditada no schema.
var allowedRPCs = map[string]bool{
	"create_talhao":           true,
	"update_talhao":           true,
	"delete_talhao":           true,
	"create_caderno_registro": true,
	"update_caderno_registro": true,
	"delete_caderno_registro": true,
	"rpc_update_propriedade":  true,
	"create_pmo":              true,
	"update_pmo":              true,
	"delete_pmo":              true,
}

const (
	// maxBodyBytes barra um corpo anormalmente grande antes de repassar ao
	// Postgres. Nenhum payload de cadastro de talhão/caderno/PMO/propriedade
	// deveria chegar perto disto — é uma rede de segurança, não um limite
	// dimensionado para uso normal.
	maxBodyBytes = 1 << 20 // 1 MiB

	proxyTimeout = 15 * time.Second
)

// Handler encaminha chamadas de RPC autenticadas ao PostgREST do projeto.
type Handler struct {
	supabaseURL string
	apiKey      string // apikey do gateway do Supabase — identifica o projeto, não o usuário; quem identifica o usuário é o Authorization encaminhado.
	httpClient  *http.Client
}

// NewHandler recebe a MESMA URL e chave já usadas pelo internal/supabase em
// todo o resto do sistema — nenhuma credencial nova entra no projeto por
// causa deste pacote.
func NewHandler(supabaseURL, apiKey string) *Handler {
	return &Handler{
		supabaseURL: strings.TrimSuffix(supabaseURL, "/"),
		apiKey:      apiKey,
		httpClient:  &http.Client{Timeout: proxyTimeout},
	}
}

// RegisterRoutes registra as rotas de RPC autenticadas no grupo fornecido. O
// chamador é responsável por já ter aplicado o middleware de autenticação —
// este handler pressupõe que ContextUserID/ContextRawToken já existem.
func (h *Handler) RegisterRoutes(rg *gin.RouterGroup) {
	rg.POST("/rpc/:name", h.CallRPC)
}

// CallRPC encaminha POST /api/v1/rpc/:name para POST {SUPABASE_URL}/rest/v1/rpc/:name,
// preservando corpo e status, mas SUBSTITUINDO o Authorization pelo token do
// produtor autenticado — nunca a chave de serviço.
func (h *Handler) CallRPC(c *gin.Context) {
	name := c.Param("name")
	if !allowedRPCs[name] {
		// 404, não 403: não confirma nem nega a existência de outras funções
		// no banco para quem está sondando o endpoint.
		c.JSON(http.StatusNotFound, gin.H{"error": "rpc não encontrada"})
		return
	}

	userID := c.GetString(middleware.ContextUserID)
	token := c.GetString(middleware.ContextRawToken)
	if userID == "" || token == "" {
		// Não deveria acontecer se RequireAuth rodou antes — mas o handler
		// não confia na ordem de montagem de outro arquivo para sua própria
		// segurança.
		c.JSON(http.StatusUnauthorized, gin.H{"error": "não autenticado"})
		return
	}

	limitado := http.MaxBytesReader(c.Writer, c.Request.Body, maxBodyBytes)
	body, err := io.ReadAll(limitado)
	if err != nil {
		c.JSON(http.StatusRequestEntityTooLarge, gin.H{"error": "corpo da requisição inválido ou grande demais"})
		return
	}

	ctx, cancel := context.WithTimeout(c.Request.Context(), proxyTimeout)
	defer cancel()

	url := fmt.Sprintf("%s/rest/v1/rpc/%s", h.supabaseURL, name)
	req, err := http.NewRequestWithContext(ctx, http.MethodPost, url, bytes.NewReader(body))
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "falha ao montar requisição"})
		return
	}
	req.Header.Set("apikey", h.apiKey)
	req.Header.Set("Authorization", "Bearer "+token)
	req.Header.Set("Content-Type", "application/json")
	req.Header.Set("Prefer", "return=representation")

	inicio := time.Now()
	resp, err := h.httpClient.Do(req)
	if err != nil {
		log.Printf("⚠️ [Gateway] RPC %s falhou (user=%s): %v", name, userID, err)
		c.JSON(http.StatusBadGateway, gin.H{"error": "falha ao contatar o banco"})
		return
	}
	defer resp.Body.Close()

	respBody, err := io.ReadAll(resp.Body)
	if err != nil {
		log.Printf("⚠️ [Gateway] RPC %s: falha ao ler resposta (user=%s): %v", name, userID, err)
		c.JSON(http.StatusBadGateway, gin.H{"error": "resposta inválida do banco"})
		return
	}

	// Log estruturado central — é o valor que o gateway entrega mesmo sem
	// mudar o que a RPC faz: até aqui, uma escrita feita pelo frontend não
	// deixava rastro nenhum fora do próprio Postgres.
	log.Printf("telemetry event=gateway_rpc_call rpc=%s user=%s status=%d latency_ms=%d",
		name, userID, resp.StatusCode, time.Since(inicio).Milliseconds())

	c.Data(resp.StatusCode, "application/json", respBody)
}
