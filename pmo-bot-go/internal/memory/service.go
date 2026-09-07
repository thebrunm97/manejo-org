package memory

import (
	"context"
	"crypto/sha256"
	"encoding/json"
	"fmt"
	"log/slog"
	"strconv"
	"strings"
	"sync/atomic"
	"time"

	"github.com/google/uuid"
	"github.com/redis/go-redis/v9"
	"github.com/thebrunm97/pmo-bot-go/internal/ports"
	"github.com/thebrunm97/pmo-bot-go/internal/supabase"
	"github.com/thebrunm97/pmo-bot-go/internal/telemetry"
)

// maxConcurrentWrites controla goroutines simultâneas de escrita.
// Evita pressão descontrolada em embedding e Supabase sob carga.
const maxConcurrentWrites = 4

type Service struct {
	rdb        *redis.Client
	sb         *supabase.Client
	ttlHot     time.Duration // Redis TTL (default: 4h)
	ttlWarm    time.Duration // Supabase TTL score ≥ 0.85 (default: 7d)
	ttlCool    time.Duration // Supabase TTL score 0.70-0.84 (default: 3d)
	writeSem   chan struct{} // semáforo para limitar goroutines de escrita
	isRetrying atomic.Bool   // previne sobreposição do job de retry de embeddings
}

func NewService(rdb *redis.Client, sb *supabase.Client) *Service {
	return &Service{
		rdb:      rdb,
		sb:       sb,
		ttlHot:   4 * time.Hour,
		ttlWarm:  7 * 24 * time.Hour,
		ttlCool:  3 * 24 * time.Hour,
		writeSem: make(chan struct{}, maxConcurrentWrites),
	}
}

// WriteFragmentAsync avalia e persiste com semáforo de concorrência.
// pmoID e userID DEVEM ser derivados do perfil autenticado — nunca de parâmetros livres.
func (s *Service) WriteFragmentAsync(ctx context.Context, pmoID int64, userID, text, source string) {
	// Valida associação pmoID > 0 antes de abrir goroutine
	if pmoID <= 0 || userID == "" {
		slog.Error("memory.WriteFragmentAsync: pmoID ou userID inválido — rejeitado",
			slog.Int64("pmo_id", pmoID))
		return
	}

	// Tenta adquirir slot no semáforo. Se cheio (maxConcurrentWrites goroutines ativas),
	// descarta silenciosamente — melhor perder um fragmento que travar o handler.
	select {
	case s.writeSem <- struct{}{}:
	default:
		slog.Warn("memory.WriteFragmentAsync: semáforo cheio, fragmento descartado",
			slog.Int64("pmo_id", pmoID))
		telemetry.MemoryCacheFragmentsDiscarded.Inc()
		return
	}

	go func() {
		defer func() { <-s.writeSem }() // libera slot ao sair

		result := EvaluateImportance(text)
		for _, r := range result.Reasons {
			telemetry.MemoryImportanceReasonTotal.WithLabelValues(r).Inc()
		}
		telemetry.MemoryImportanceScore.Observe(result.Score)

		if result.Score < 0.4 {
			telemetry.MemoryCacheFragmentsDiscarded.Inc()
			return
		}

		contentHash := fmt.Sprintf("%x", sha256.Sum256([]byte(normalizeForHash(text))))
		fragID := uuid.New().String()
		frag := ports.MemoryFragment{
			ID:              fragID,
			Fragment:        text,
			Category:        result.Category,
			ImportanceScore: result.Score,
			Source:          source,
			CreatedAt:       time.Now(),
			ContentHash:     contentHash,
		}

		// Contextos separados por operação — Redis é best-effort e rápido;
		// embedding e Supabase têm orçamentos próprios maiores.
		redisCtx, cancelRedis := context.WithTimeout(context.Background(), 500*time.Millisecond)
		defer cancelRedis()
		s.writeToRedis(redisCtx, pmoID, frag)

		if result.Score >= 0.7 {
			embCtx, cancelEmb := context.WithTimeout(context.Background(), 2*time.Second)
			defer cancelEmb()
			emb, embErr := getEmbeddingWithContext(embCtx, s.sb, frag.Fragment, "MEMORIA")

			sbCtx, cancelSb := context.WithTimeout(context.Background(), 2*time.Second)
			defer cancelSb()
			ttl := s.ttlCool
			if result.Score >= 0.85 {
				ttl = s.ttlWarm
			}
			s.writeToSupabase(sbCtx, pmoID, userID, frag, emb, embErr != nil, ttl)
		}
	}()
}

// releaseLockScript libera o lock APENAS se o valor ainda for o token original.
// Evita que uma goroutine libere o lock adquirido por outra (condição de corrida
// clássica do padrão SETNX + DEL sem token).
var releaseLockScript = redis.NewScript(`
    if redis.call("GET", KEYS[1]) == ARGV[1] then
        return redis.call("DEL", KEYS[1])
    end
    return 0
`)

func (s *Service) writeToRedis(ctx context.Context, pmoID int64, f ports.MemoryFragment) {
	// 1. Lista de recentes (contexto imediato) — escrita simples, sem lock necessário
	listKey := fmt.Sprintf("memory:%d:recent", pmoID)
	data, _ := json.Marshal(f)
	pipe := s.rdb.Pipeline()
	pipe.LPush(ctx, listKey, string(data))
	pipe.LTrim(ctx, listKey, 0, 19)
	pipe.Expire(ctx, listKey, s.ttlHot)
	if _, err := pipe.Exec(ctx); err != nil {
		slog.Warn("memory.writeToRedis:list failed", slog.String("error", err.Error()))
		return
	}
	telemetry.MemoryCacheFragmentsWritten.WithLabelValues("redis", f.Category).Inc()

	// 2. ZSET ranqueado — adquire lock com token único para sequência ZADD+trim+hash segura
	lockKey := fmt.Sprintf("memory:%d:lock", pmoID)
	lockToken := uuid.New().String() // token único: garante release condicional via Lua
	acquired, err := s.rdb.SetNX(ctx, lockKey, lockToken, 5*time.Second).Result()
	if err != nil || !acquired {
		slog.Debug("memory.writeToRedis:zset lock not acquired, skipping scored write")
		return
	}
	// Release via Lua: apaga SOMENTE se o valor ainda é o nosso token
	defer func() {
		_ = releaseLockScript.Run(ctx, s.rdb, []string{lockKey}, lockToken).Err()
	}()

	zkey := fmt.Sprintf("memory:%d:scored", pmoID)
	member := "frag:" + f.ID
	hashKey := fmt.Sprintf("memory:%d:frag:%s", pmoID, f.ID)

	zpipe := s.rdb.Pipeline()
	zpipe.ZAdd(ctx, zkey, redis.Z{Score: f.ImportanceScore, Member: member})
	zpipe.Expire(ctx, zkey, 2*time.Hour)
	zpipe.HSet(ctx, hashKey,
		"fragment", f.Fragment,
		"category", f.Category,
		"source", f.Source,
		"score", fmt.Sprintf("%.4f", f.ImportanceScore),
		"created_at", f.CreatedAt.UTC().Format(time.RFC3339),
	)
	zpipe.Expire(ctx, hashKey, s.ttlHot)
	if _, err := zpipe.Exec(ctx); err != nil {
		slog.Warn("memory.writeToRedis:zset failed", slog.String("error", err.Error()))
		return
	}

	// Pós-inserção: avalia cardinalidade real e poda com precisão aritmética absoluta
	// Elimina risco de dead pointers (hashes órfãos podados sem afetar membros ativos)
	card, err := s.rdb.ZCard(ctx, zkey).Result()
	if err == nil && card > 50 {
		toRemove := card - 50
		prunedMembers, err := s.rdb.ZRange(ctx, zkey, 0, toRemove-1).Result()
		if err == nil && len(prunedMembers) > 0 {
			cleanupPipe := s.rdb.Pipeline()
			cleanupPipe.ZRemRangeByRank(ctx, zkey, 0, toRemove-1)
			for _, m := range prunedMembers {
				fragUUID := strings.TrimPrefix(m, "frag:")
				cleanupPipe.Del(ctx, fmt.Sprintf("memory:%d:frag:%s", pmoID, fragUUID))
			}
			if _, err := cleanupPipe.Exec(ctx); err != nil {
				slog.Warn("memory.writeToRedis:cleanup órfãos falhou", slog.String("error", err.Error()))
			}
		}
	}
}

// writeToSupabase recebe emb e embeddingMissing pré-calculados pelo caller,
// invocando a RPC save_pmo_memory_cache que garante GREATEST(score) e renovação de expires_at.
func (s *Service) writeToSupabase(ctx context.Context, pmoID int64, userID string,
	f ports.MemoryFragment, emb []float32, embeddingMissing bool, ttl time.Duration) {
	expiresAt := time.Now().Add(ttl)
	if err := s.sb.SaveMemoryCache(ctx, pmoID, userID,
		f.Fragment, f.ContentHash, f.Source, f.Category,
		float32(f.ImportanceScore), emb, embeddingMissing, expiresAt); err != nil {
		slog.Warn("memory.writeToSupabase: insert via RPC failed", slog.String("error", err.Error()))
		return
	}
	telemetry.MemoryCacheFragmentsWritten.WithLabelValues("supabase", f.Category).Inc()
}

// GetActiveContext implementa a estratégia de 3 camadas.
// SEGURANÇA: pmoID deve ser derivado do perfil autenticado — nunca de parâmetros externos.
//
//  1. Redis recent (max 3) — contexto geral imediato; não considera relevância temática
//  2. Redis scored (max 5) — complementa com fragmentos de maior importância
//  3. Supabase — busca semântica quando Redis vazio/indisponível ou relevância temática necessária
func (s *Service) GetActiveContext(ctx context.Context, pmoID int64, queryText string) ([]ports.MemoryFragment, error) {
	if pmoID <= 0 {
		return nil, fmt.Errorf("memory.GetActiveContext: pmoID inválido (%d)", pmoID)
	}

	// 1. Redis recent — contexto geral, limitado a 3 itens mais recentes
	recentFrags, recentErr := s.readFromRedisRecent(ctx, pmoID, 3)
	if recentErr == nil && len(recentFrags) >= 3 {
		slog.Debug("memory.GetActiveContext: redis:recent hit", slog.Int("count", len(recentFrags)))
		telemetry.MemoryCacheReadHits.WithLabelValues("redis_recent").Inc()
		return deduplicateByHash(recentFrags), nil
	}

	// 2. Redis scored — complementa com top por importância (máx 5 total após merge)
	scoredFrags, scoredErr := s.readFromRedisScoredTop(ctx, pmoID, 5)
	if recentErr == nil || scoredErr == nil {
		merged := mergeDedup(recentFrags, scoredFrags, 5)
		if len(merged) > 0 {
			slog.Debug("memory.GetActiveContext: redis hit (recent+scored)", slog.Int("count", len(merged)))
			telemetry.MemoryCacheReadHits.WithLabelValues("redis_scored").Inc()
			return merged, nil
		}
	}

	// 3. Supabase — busca semântica (temática) como fallback
	slog.Debug("memory.GetActiveContext: redis miss, fallback supabase semântico")
	embCtx, cancelEmb := context.WithTimeout(ctx, 2*time.Second)
	defer cancelEmb()
	emb, embErr := getEmbeddingWithContext(embCtx, s.sb, queryText, "CONSULTA")
	if embErr != nil {
		telemetry.MemoryCacheReadHits.WithLabelValues("miss").Inc()
		return nil, embErr
	}
	result, sbErr := s.sb.MatchMemoryCache(ctx, pmoID, emb, 0.65, 5)
	if sbErr != nil {
		telemetry.MemoryCacheReadHits.WithLabelValues("miss").Inc()
		return nil, sbErr
	}
	telemetry.MemoryCacheReadHits.WithLabelValues("supabase").Inc()
	
	// Convert MatchPMOMemoryCacheResult to ports.MemoryFragment
	frags := make([]ports.MemoryFragment, len(result))
	for i, r := range result {
		frags[i] = ports.MemoryFragment{
			ID:              r.ID,
			Fragment:        r.Fragment,
			Category:        r.Category,
			Source:          r.Source,
			ImportanceScore: r.ImportanceScore,
			CreatedAt:       r.CreatedAt,
		}
	}
	
	return deduplicateByHash(frags), nil
}

// readFromRedisRecent lê os N itens mais recentes da lista circular
func (s *Service) readFromRedisRecent(ctx context.Context, pmoID int64, limit int64) ([]ports.MemoryFragment, error) {
	key := fmt.Sprintf("memory:%d:recent", pmoID)
	items, err := s.rdb.LRange(ctx, key, 0, limit-1).Result()
	if err != nil {
		return nil, err
	}
	var frags []ports.MemoryFragment
	for _, item := range items {
		var f ports.MemoryFragment
		if err := json.Unmarshal([]byte(item), &f); err == nil {
			f.Source = "redis_recent"
			frags = append(frags, f)
		}
	}
	return frags, nil
}

// readFromRedisScoredTop busca o top-N por score no ZSET e hidrata via pipeline nos Hashes
func (s *Service) readFromRedisScoredTop(ctx context.Context, pmoID int64, limit int64) ([]ports.MemoryFragment, error) {
	zkey := fmt.Sprintf("memory:%d:scored", pmoID)
	members, err := s.rdb.ZRevRange(ctx, zkey, 0, limit-1).Result()
	if err != nil || len(members) == 0 {
		return nil, err
	}

	pipe := s.rdb.Pipeline()
	cmds := make([]*redis.MapStringStringCmd, len(members))
	for i, m := range members {
		fragID := strings.TrimPrefix(m, "frag:")
		hashKey := fmt.Sprintf("memory:%d:frag:%s", pmoID, fragID)
		cmds[i] = pipe.HGetAll(ctx, hashKey)
	}
	if _, err := pipe.Exec(ctx); err != nil {
		return nil, err
	}

	var frags []ports.MemoryFragment
	for i, cmd := range cmds {
		data, err := cmd.Result()
		if err != nil || len(data) == 0 {
			continue
		}
		score, _ := strconv.ParseFloat(data["score"], 64)
		t, _ := time.Parse(time.RFC3339, data["created_at"])
		fragID := strings.TrimPrefix(members[i], "frag:")
		frags = append(frags, ports.MemoryFragment{
			ID:              fragID,
			Fragment:        data["fragment"],
			Category:        data["category"],
			Source:          "redis_scored",
			ImportanceScore: score,
			CreatedAt:       t,
		})
	}
	return frags, nil
}

// ProcessEmbeddingRetries processa fragmentos pendentes de embedding.
func (s *Service) ProcessEmbeddingRetries(ctx context.Context) error {
	if !s.isRetrying.CompareAndSwap(false, true) {
		slog.Debug("memory.ProcessEmbeddingRetries: execução anterior ativa, pulando tick")
		return nil
	}
	defer s.isRetrying.Store(false)

	pending, err := s.sb.ListMissingEmbeddings(ctx, 20)
	if err != nil || len(pending) == 0 {
		return err
	}

	for _, item := range pending {
		embCtx, cancel := context.WithTimeout(ctx, 2*time.Second)
		emb, err := getEmbeddingWithContext(embCtx, s.sb, item.Fragment, "MEMORIA")
		cancel()

		if err != nil {
			slog.Warn("memory.ProcessEmbeddingRetries: falha ao gerar embedding", slog.String("id", item.ID), slog.String("error", err.Error()))
			_ = s.sb.IncrementEmbeddingRetry(ctx, item.ID, item.RetryCount)
			telemetry.MemoryCacheRetriesTotal.WithLabelValues("error").Inc()
			continue
		}

		// Sucesso: atualiza embedding e seta embedding_missing = false
		if err := s.sb.UpdateMemoryEmbedding(ctx, item.ID, emb); err != nil {
			slog.Error("memory.ProcessEmbeddingRetries: falha no update", slog.String("id", item.ID), slog.String("error", err.Error()))
			telemetry.MemoryCacheRetriesTotal.WithLabelValues("error").Inc()
		} else {
			telemetry.MemoryCacheRetriesTotal.WithLabelValues("success").Inc()
		}
	}
	return nil
}

// StartRetryJob inicia o ticker em background para reprocessamento de embeddings.
// Possui shutdown gracioso via ctx.Done().
func (s *Service) StartRetryJob(ctx context.Context) {
	ticker := time.NewTicker(5 * time.Minute)
	defer ticker.Stop()

	for {
		select {
		case <-ctx.Done():
			slog.Info("memory.StartRetryJob: encerrando graciosamente (contexto cancelado)")
			return
		case <-ticker.C:
			if err := s.ProcessEmbeddingRetries(ctx); err != nil {
				slog.Error("memory.ProcessEmbeddingRetries: erro na execução", slog.String("error", err.Error()))
			}
		}
	}
}

// getEmbeddingWithContext empacota a chamada síncrona do Supabase Client para garantir
// que ela respeite o timeout exigido pelo Service (2s).
// O client interno possui um Timeout global de 15s (que previne hangs permanentes),
// mas para o nosso semáforo (max 4 goroutines) e tempo de resposta ao usuário, 15s é inaceitável.
//
// TRADE-OFF ACEITO (v1): O wrapper limita o tempo de espera do chamador (2s), mas não cancela a requisição
// HTTP subjacente (já que a assinatura do client não aceita ctx). Sob degradação sustentada da API,
// goroutines órfãs podem se acumular em background por até 15s cada, consumindo conexões e file descriptors.
func getEmbeddingWithContext(ctx context.Context, sb *supabase.Client, text, contextType string) ([]float32, error) {
	type result struct {
		emb []float32
		err error
	}
	resCh := make(chan result, 1)

	go func() {
		emb, err := sb.GetEmbedding(text, contextType)
		resCh <- result{emb, err}
	}()

	select {
	case <-ctx.Done():
		return nil, ctx.Err()
	case res := <-resCh:
		return res.emb, res.err
	}
}
