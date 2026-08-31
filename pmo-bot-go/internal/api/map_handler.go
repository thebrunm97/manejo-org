package api

import (
	"context"
	"fmt"
	"log"
	"net/http"
	"strconv"
	"strings"
	"sync"
	"time"

	"github.com/gin-gonic/gin"
	"github.com/thebrunm97/pmo-bot-go/internal/geo"
	"github.com/thebrunm97/pmo-bot-go/internal/middleware"
	"github.com/thebrunm97/pmo-bot-go/internal/ports"
)

type MapHandler struct {
	geeClient *geo.GEEClient

	// limiter protege a cota do Earth Engine. Cada chamada de tiles custa uma
	// consulta e cada chamada zonal custa UMA POR TALHAO, então sem teto um
	// único usuário insistindo no seletor de período consome cota de todos.
	//
	// Começa como NoopRateLimiter e é trocado no boot se houver Redis: o
	// handler é construído antes do Redis em main.go, e um limiter nil
	// obrigaria todo chamador a checar.
	limiter ports.RateLimiter
}

func NewMapHandler(geeClient *geo.GEEClient) *MapHandler {
	return &MapHandler{
		geeClient: geeClient,
		limiter:   ports.NoopRateLimiter{},
	}
}

// SetRateLimiter troca o limiter. Só pode ser chamado durante a inicialização,
// antes do servidor aceitar requisições — não há sincronização aqui.
func (h *MapHandler) SetRateLimiter(l ports.RateLimiter) {
	if l != nil {
		h.limiter = l
	}
}

// permitir consulta o limiter e responde 429 quando a cota estourou.
//
// Degrada ABERTO conforme o contrato de ports.RateLimiter: se o Redis estiver
// fora do ar, deixa passar e loga. A alternativa — negar por falha de
// infraestrutura — trocaria um problema de custo por um mapa quebrado.
func (h *MapHandler) permitir(c *gin.Context, operacao string) bool {
	userID := c.GetString(middleware.ContextUserID)
	if userID == "" {
		userID = c.ClientIP()
	}

	decisao, err := h.limiter.Allow(c.Request.Context(), operacao+":"+userID)
	if err != nil {
		log.Printf("⚠️ [RateLimit] Falha ao consultar limiter para %s (%v) — deixando passar", operacao, err)
		return true
	}

	if !decisao.Allowed {
		c.Header("Retry-After", strconv.Itoa(int(decisao.RetryAfter.Seconds())+1))
		c.JSON(http.StatusTooManyRequests, gin.H{
			"error":       "Muitas consultas de satélite em pouco tempo. Aguarde um instante.",
			"retry_after": int(decisao.RetryAfter.Seconds()) + 1,
		})
		return false
	}

	return true
}

// DiagnosticsHandler valida a conexão autenticada com a REST API do Earth Engine
func (h *MapHandler) DiagnosticsHandler(c *gin.Context) {
	ctx := c.Request.Context()

	start := time.Now()
	// Tenta fazer o Ping na API REST
	result, err := h.geeClient.Ping(ctx)
	durationMs := time.Since(start).Milliseconds()

	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{
			"status":      "error",
			"message":     err.Error(),
			"duration_ms": durationMs,
		})
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"status":      "ok",
		"provider":    "google-earth-engine",
		"projectId":   result["name"], // ID retornado pelo ping
		"duration_ms": durationMs,
	})
}

// GenerateTilesRequest representa os query params da requisição
type GenerateTilesRequest struct {
	Layer  string `form:"layer" binding:"required"` // "rgb" ou "ndvi"
	Date   string `form:"date" binding:"required"`  // "YYYY-MM" (ou YYYY-MM-DD se quiser)
	FarmId string `form:"farmId"`
}

// GenerateTiles lida com a criação dinâmica de tiles (Fase 3)
func (h *MapHandler) GenerateTiles(c *gin.Context) {
	if !h.permitir(c, "tiles") {
		return
	}

	var req GenerateTilesRequest
	if err := c.ShouldBindQuery(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Query inválida", "details": err.Error()})
		return
	}

	var astJSON string
	var err error

	// Tratamento básico de data para startDate e endDate se for "YYYY-MM"
	startDate := req.Date + "-01"
	endDate := req.Date + "-28"

	// 1. Gerar AST de acordo com o tipo solicitado
	if req.Layer == "rgb" {
		astJSON, err = geo.GenerateSentinel2RGBAST(startDate, endDate)
	} else if req.Layer == "ndvi" {
		astJSON, err = geo.GenerateSentinel2NDVIAST(startDate, endDate)
	} else {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Tipo inválido. Use 'rgb' ou 'ndvi'"})
		return
	}

	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Erro ao gerar AST", "details": err.Error()})
		return
	}

	// 2. Chamar a API REST do GEE para obter a URL do Tile
	ctx := c.Request.Context()
	urlFormat, err := h.geeClient.GenerateTilesURL(ctx, astJSON)
	if err != nil {
		// Permissão negada não é falha de comunicação: virar 502 genérico
		// esconde que o problema está na conta de serviço, e o usuário fica
		// vendo "sem imagens" achando que é falta de cena no período.
		if strings.Contains(err.Error(), "PERMISSION_DENIED") {
			c.JSON(http.StatusForbidden, gin.H{
				"error":   "A conta de serviço não tem permissão para gerar mapas no Earth Engine.",
				"details": err.Error(),
			})
			return
		}
		c.JSON(http.StatusBadGateway, gin.H{"error": "Falha na comunicação com Google Earth Engine", "details": err.Error()})
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"urlFormat": urlFormat,
		"layer":     req.Layer,
	})
}

// --- Estatística zonal (NDVI médio por talhão) ---

// ZonalRequest recebe os talhões já com a geometria que o app tem em mãos.
// A geometria vem do cliente e não do banco de propósito: o gateway REST não
// tem acesso de serviço ao Postgres, e o Earth Engine só precisa do polígono
// para reduzir — nada aqui depende de confiar no que foi enviado, porque o
// cálculo é sobre imagem pública de satélite, não sobre dado de outro usuário.
type ZonalRequest struct {
	Date    string `json:"date" binding:"required"` // "YYYY-MM"
	Talhoes []struct {
		ID       string `json:"id" binding:"required"`
		Geometry struct {
			Type        string        `json:"type"`
			Coordinates [][][]float64 `json:"coordinates"`
		} `json:"geometry" binding:"required"`
	} `json:"talhoes" binding:"required"`
}

// ZonalTalhaoResult carrega sempre o status junto do valor: distinguir
// "vegetação fraca" de "sem imagem por causa de nuvem" é a diferença entre um
// mapa útil e um mapa que engana. Um NDVI nulo com zero pixels não é zero.
type ZonalTalhaoResult struct {
	ID     string   `json:"id"`
	NDVI   *float64 `json:"ndvi"`
	Pixels int      `json:"pixels"`
	Status string   `json:"status"` // "ok" | "sem_imagem" | "erro"
	Detail string   `json:"detail,omitempty"`
}

// ZonalStats calcula a média de NDVI dentro de cada talhão no período pedido.
func (h *MapHandler) ZonalStats(c *gin.Context) {
	if !h.permitir(c, "zonal") {
		return
	}

	var req ZonalRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Corpo inválido", "details": err.Error()})
		return
	}

	if len(req.Talhoes) == 0 {
		c.JSON(http.StatusOK, gin.H{"date": req.Date, "results": []ZonalTalhaoResult{}})
		return
	}

	// Teto defensivo: cada talhão é uma chamada ao Earth Engine, e uma
	// propriedade com centenas de talhões derrubaria a janela de resposta.
	const maxTalhoes = 60
	if len(req.Talhoes) > maxTalhoes {
		c.JSON(http.StatusBadRequest, gin.H{
			"error": fmt.Sprintf("máximo de %d talhões por chamada; recebidos %d", maxTalhoes, len(req.Talhoes)),
		})
		return
	}

	startDate := req.Date + "-01"
	endDate := req.Date + "-28"

	// O contexto do request manda, mas com um teto próprio: o Earth Engine
	// pode demorar bastante em áreas grandes e é melhor devolver parcial do
	// que segurar o cliente indefinidamente.
	ctx, cancel := context.WithTimeout(c.Request.Context(), 90*time.Second)
	defer cancel()

	results := make([]ZonalTalhaoResult, len(req.Talhoes))

	// Concorrência limitada: o Earth Engine reclama de rajadas, e 4 em paralelo
	// já derruba bastante o tempo total sem chegar perto do limite de quota.
	const maxParalelo = 4
	sem := make(chan struct{}, maxParalelo)
	var wg sync.WaitGroup

	for i, t := range req.Talhoes {
		wg.Add(1)
		go func(i int, id string, coords [][][]float64) {
			defer wg.Done()
			sem <- struct{}{}
			defer func() { <-sem }()

			res := ZonalTalhaoResult{ID: id, Status: "ok"}

			zonal, err := h.geeClient.ZonalNDVI(ctx, coords, startDate, endDate)
			if err != nil {
				// Coleção vazia no período: o Earth Engine responde com um erro
				// de banda inexistente, que não diz nada ao usuário final.
				if strings.Contains(err.Error(), "No band named") {
					res.Status = "sem_imagem"
					res.Detail = "Nenhuma cena disponível no período com menos de 20% de nuvens."
				} else {
					res.Status = "erro"
					res.Detail = err.Error()
				}
				results[i] = res
				return
			}

			if zonal.Count != nil {
				res.Pixels = int(*zonal.Count)
			}
			if zonal.Mean == nil || res.Pixels == 0 {
				res.Status = "sem_imagem"
				res.Detail = "Sem pixel válido dentro do talhão no período (cobertura de nuvem)."
			} else {
				res.NDVI = zonal.Mean
			}

			results[i] = res
		}(i, t.ID, t.Geometry.Coordinates)
	}

	wg.Wait()

	c.JSON(http.StatusOK, gin.H{
		"date":    req.Date,
		"period":  gin.H{"start": startDate, "end": endDate},
		"results": results,
	})
}
