# Implementação do RAG Embed Cache

## Goal
Implementar um cache em memória com TTL e Singleflight para evitar vazamentos de memória e Thundering Herd nas chamadas de geração de embeddings do RAG.

## Tasks
- [x] Task 1: Criar o arquivo `internal/adapter/embedcache/cached_embedder.go` com `sync.RWMutex`, `singleflight`, e uma goroutine Janitor → Verify: Compila sem erros.
- [x] Task 2: Criar `internal/adapter/embedcache/cached_embedder_test.go` → Verify: Rodar `go test ./internal/adapter/embedcache -v` com 100% de sucesso.
- [x] Task 3: Injetar `cachedEmbedder` em `cmd/server/main.go` instanciando via `embedcache.NewCachedEmbedder` → Verify: O servidor compila com `go build ./cmd/server`.

## Done When
- [x] Todos os testes unitários do cache estão verdes (Hit/Miss, Expiration, Singleflight, Janitor).
- [x] O `main.go` usa o cache envolvendo o LLM provider com 15 minutos de TTL.
