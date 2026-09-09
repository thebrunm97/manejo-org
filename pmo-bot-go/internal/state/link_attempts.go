package state

import (
	"sync"
	"time"
)

// DT-109: "CONECTAR <código>" não tinha nenhum limite de tentativas — um
// número de telefone podia tentar códigos de 6 caracteres indefinidamente,
// sem custo. Este limitador é por telefone (o único identificador disponível
// nesse ponto do fluxo, já que o número ainda não tem perfil vinculado) e
// vive em memória, mesmo padrão já aceito em sessionMu (DT-112): perde
// estado num restart, o que é aceitável para um cooldown de minutos.
const (
	linkAttemptMax    = 5
	linkAttemptWindow = 10 * time.Minute
)

type linkAttemptState struct {
	mu      sync.Mutex
	count   int
	firstAt time.Time
}

var linkAttempts sync.Map // map[phone]*linkAttemptState

// AllowLinkAttempt registra uma tentativa de "CONECTAR" para o telefone e
// retorna false se o telefone já estourou o limite dentro da janela atual.
func AllowLinkAttempt(phone string) bool {
	v, _ := linkAttempts.LoadOrStore(phone, &linkAttemptState{})
	st := v.(*linkAttemptState)

	st.mu.Lock()
	defer st.mu.Unlock()

	now := time.Now()
	if now.Sub(st.firstAt) > linkAttemptWindow {
		st.count = 0
		st.firstAt = now
	}
	if st.count >= linkAttemptMax {
		return false
	}
	st.count++
	return true
}

// ResetLinkAttempts limpa o contador de um telefone (chamado após vínculo
// bem-sucedido, para não penalizar o próximo uso legítimo do número).
func ResetLinkAttempts(phone string) {
	linkAttempts.Delete(phone)
}
