package utils

import (
	"log"
	"os"
	"strings"
	"time"
)

// TimezoneSistema devolve o fuso horário usado para "data atual" injetada no
// prompt do LLM. Configurável via SYSTEM_TIMEZONE (nome IANA, ex.
// "Africa/Maputo"), com "America/Sao_Paulo" como padrão — zero mudança de
// comportamento até a env ser setada.
//
// Existe para internacionalização: hoje é uma única env global pro
// deployment inteiro, não por propriedade/usuário (isso exigiria saber o
// fuso de cada propriedade a partir de lat/lng ou país, o que fica pra
// quando o produto decidir como modelar isso). Moçambique é UTC+2, 5h à
// frente de São Paulo — sem isto, o bot podia achar que "hoje" ainda era
// ontem pra um produtor moçambicano.
func TimezoneSistema() *time.Location {
	nome := strings.TrimSpace(os.Getenv("SYSTEM_TIMEZONE"))
	if nome == "" {
		nome = "America/Sao_Paulo"
	}
	loc, err := time.LoadLocation(nome)
	if err != nil {
		log.Printf("⚠️ [Timezone] SYSTEM_TIMEZONE=%q inválido (%v), caindo para America/Sao_Paulo", nome, err)
		loc, _ = time.LoadLocation("America/Sao_Paulo")
	}
	return loc
}
