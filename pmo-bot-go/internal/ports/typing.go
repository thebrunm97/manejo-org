package ports

import (
	"context"
	"sync"
	"time"
)

// keepTypingInterval é menor que o `delay` de 15s que o EvolutionAdapter pede
// para a presença "composing" (internal/adapter/evolution/adapter.go). Sem
// reenviar antes desse prazo expirar, o "digitando..." some aos 15s e deixa o
// produtor sem nenhum feedback pelo resto de uma chamada de LLM/RAG que
// costuma levar bem mais que isso — foi exatamente esse silêncio que motivou
// este helper.
const keepTypingInterval = 10 * time.Second

// KeepTyping mantém a presença "composing" ativa em `to` (reenviando a cada
// keepTypingInterval) até o contexto ser cancelado ou a função de parada
// devolvida ser chamada. O chamador deve chamar a função de parada assim que
// a resposta final estiver pronta para envio, para o "digitando..." não
// competir com a mensagem real.
//
// sender pode ser nil (alguns testes/paths não têm canal configurado); nesse
// caso KeepTyping é um no-op seguro.
func KeepTyping(ctx context.Context, sender ChannelSender, channel ChannelType, to string) (stop func()) {
	if sender == nil {
		return func() {}
	}

	stopCh := make(chan struct{})
	go func() {
		_ = sender.SendTyping(ctx, channel, to)
		ticker := time.NewTicker(keepTypingInterval)
		defer ticker.Stop()
		for {
			select {
			case <-ctx.Done():
				return
			case <-stopCh:
				return
			case <-ticker.C:
				_ = sender.SendTyping(ctx, channel, to)
			}
		}
	}()

	var once sync.Once
	return func() {
		once.Do(func() { close(stopCh) })
	}
}
