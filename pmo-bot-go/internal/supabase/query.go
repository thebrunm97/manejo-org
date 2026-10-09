package supabase

import "net/url"

// pgVal escapa um valor interpolado num filtro PostgREST (DT-89). Sem isto,
// "+" vira espaço, "&" corta a query e espaço quebra a URL — com texto vindo
// do LLM ou do produtor (nome de categoria, cultura), o filtro saía errado
// em silêncio.
func pgVal(s string) string { return url.QueryEscape(s) }
