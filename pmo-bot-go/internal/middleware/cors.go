package middleware

import (
	"net/http"
	"os"
	"strings"

	"github.com/gin-gonic/gin"
)

// CORS controla quais origens podem chamar a API a partir de um navegador.
//
// A versão anterior mandava `Access-Control-Allow-Origin: *` junto de
// `Access-Control-Allow-Credentials: true`. Essa combinação é inválida pela
// própria especificação — o navegador recusa a resposta quando a origem é `*`
// e credenciais são pedidas — então ela não protegia nem funcionava: só dava
// a impressão de permitir tudo. Com o servidor prestes a ganhar IP público
// (DT-38) e com rotas autenticadas entrando (DT-59), a origem passa a ser
// declarada explicitamente.
//
// ALLOWED_ORIGINS recebe uma lista separada por vírgula, por exemplo:
//
//	ALLOWED_ORIGINS=https://app.manejo.org,https://admin.manejo.org
//
// Vazio mantém o comportamento permissivo de desenvolvimento (`*`), mas SEM
// `Allow-Credentials` — que é a combinação que o navegador de fato aceita.
func CORS() gin.HandlerFunc {
	var permitidas []string
	if raw := strings.TrimSpace(os.Getenv("ALLOWED_ORIGINS")); raw != "" {
		for _, o := range strings.Split(raw, ",") {
			if o = strings.TrimSpace(o); o != "" {
				permitidas = append(permitidas, o)
			}
		}
	}

	return func(c *gin.Context) {
		origem := c.GetHeader("Origin")

		if len(permitidas) == 0 {
			// Modo desenvolvimento: liberado, mas sem credenciais — a
			// combinação `*` + credentials nunca funcionou de verdade.
			c.Writer.Header().Set("Access-Control-Allow-Origin", "*")
		} else if origem != "" && originPermitida(origem, permitidas) {
			c.Writer.Header().Set("Access-Control-Allow-Origin", origem)
			c.Writer.Header().Set("Access-Control-Allow-Credentials", "true")
			// Sem Vary, um cache intermediário pode servir a uma origem a
			// resposta liberada para outra.
			c.Writer.Header().Add("Vary", "Origin")
		} else if origem != "" {
			// Origem não autorizada: responde sem cabeçalho de liberação. O
			// navegador é quem bloqueia — não se recusa a requisição aqui,
			// porque CORS protege o navegador, não o servidor (a proteção do
			// servidor é o RequireAuth).
			c.Writer.Header().Add("Vary", "Origin")
		}

		c.Writer.Header().Set("Access-Control-Allow-Headers", "Content-Type, Content-Length, Accept-Encoding, X-CSRF-Token, Authorization, accept, origin, Cache-Control, X-Requested-With")
		c.Writer.Header().Set("Access-Control-Allow-Methods", "POST, OPTIONS, GET, PUT, DELETE, PATCH")

		if c.Request.Method == "OPTIONS" {
			c.AbortWithStatus(http.StatusNoContent)
			return
		}

		c.Next()
	}
}

func originPermitida(origem string, permitidas []string) bool {
	for _, p := range permitidas {
		if strings.EqualFold(origem, p) {
			return true
		}
	}
	return false
}
