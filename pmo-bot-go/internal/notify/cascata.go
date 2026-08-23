package notify

import (
	"context"
	"fmt"
	"strings"

	"github.com/thebrunm97/pmo-bot-go/internal/ports"
)

// Cascata tenta cada canal em ordem e considera sucesso se QUALQUER um entregou.
//
// Mesma estratégia do tts.Router (DT-54): o objetivo não é entregar por todos os
// caminhos, é garantir que a mensagem chegue por pelo menos um. Telegram vem
// primeiro por ser push imediato; e-mail fica como segunda via.
type Cascata struct {
	canais []ports.Notifier
}

// NewCascata monta a cadeia, descartando canais nulos para o chamador poder
// passar `NewCascata(telegram, email)` sem se preocupar com qual está
// configurado.
func NewCascata(canais ...ports.Notifier) *Cascata {
	var validos []ports.Notifier
	for _, c := range canais {
		if c != nil {
			validos = append(validos, c)
		}
	}
	return &Cascata{canais: validos}
}

// Canais expõe quantos canais estão ativos, para o log de inicialização poder
// dizer o que está de fato ligado.
func (c *Cascata) Canais() []string {
	nomes := make([]string, 0, len(c.canais))
	for _, canal := range c.canais {
		nomes = append(nomes, canal.Name())
	}
	return nomes
}

func (c *Cascata) Name() string { return "cascata" }

// Notify tenta todos os canais até um funcionar.
//
// Não interrompe na primeira falha: se o Telegram estiver fora, o e-mail ainda
// precisa ser tentado — é exatamente para isso que a segunda via existe.
func (c *Cascata) Notify(ctx context.Context, a ports.Alerta) error {
	if len(c.canais) == 0 {
		return fmt.Errorf("cascata: nenhum canal configurado")
	}

	var falhas []string
	for _, canal := range c.canais {
		err := c.tentar(ctx, canal, a)
		if err == nil {
			return nil
		}
		falhas = append(falhas, fmt.Sprintf("%s: %v", canal.Name(), err))
	}
	return fmt.Errorf("cascata: todos os canais falharam (%s)", strings.Join(falhas, "; "))
}

// tentar isola cada canal atrás de um recover.
//
// Um canal que entra em pânico não pode derrubar o processo: o Notify é chamado
// de dentro de goroutines soltas do healer e do heartbeat, onde não existe
// gin.Recovery() acima para segurar a queda. E um pânico no Telegram não pode
// impedir a tentativa por e-mail.
func (c *Cascata) tentar(ctx context.Context, canal ports.Notifier, a ports.Alerta) (err error) {
	defer func() {
		if r := recover(); r != nil {
			err = fmt.Errorf("panico no canal %s: %v", canal.Name(), r)
		}
	}()
	return canal.Notify(ctx, a)
}
