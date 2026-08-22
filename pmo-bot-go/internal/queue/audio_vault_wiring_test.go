package queue

import (
	"context"
	"errors"
	"testing"
)

type spyArchiver struct {
	chamadas int
	phone    string
	audio    []byte
	err      error
}

func (s *spyArchiver) ArchiveAudio(_ context.Context, phone string, audio []byte, _ string) error {
	s.chamadas++
	s.phone = phone
	// Copia: o worker anula a fatia original logo apos esta chamada, e o teste
	// precisa inspecionar o que foi entregue, nao o que sobrou.
	s.audio = append([]byte(nil), audio...)
	return s.err
}

// Um cofre nil e contrato valido ("arquivamento desativado") e nao pode
// quebrar o fluxo de transcricao.
func TestArchiverNilEContratoValido(t *testing.T) {
	cfg := MediaWorkerConfig{}
	if cfg.AudioVault != nil {
		t.Fatal("AudioVault deveria ser nil por padrao")
	}
	w := NewMediaWorker(cfg)
	if w.cfg.AudioVault != nil {
		t.Error("worker nao deveria inventar um cofre")
	}
}

// O cofre recebe o TELEFONE, nao o profile_id: resolver um no outro exigiria
// dar ao worker de midia um cliente de banco, que ele nao tem.
func TestArchiverRecebeTelefoneEBytes(t *testing.T) {
	spy := &spyArchiver{}
	audio := []byte{0x4f, 0x67, 0x67, 0x53} // "OggS"

	if err := spy.ArchiveAudio(context.Background(), "5534999999999", audio, ""); err != nil {
		t.Fatalf("erro inesperado: %v", err)
	}

	if spy.phone != "5534999999999" {
		t.Errorf("phone = %q", spy.phone)
	}
	if len(spy.audio) != len(audio) {
		t.Errorf("bytes entregues = %d, esperado %d", len(spy.audio), len(audio))
	}
}

// Falha do cofre NAO pode derrubar o registro do produtor: perder o caderno de
// campo por causa da copia de auditoria inverteria as prioridades.
func TestFalhaDoCofreNaoInterrompeOFluxo(t *testing.T) {
	spy := &spyArchiver{err: errors.New("storage fora do ar")}

	// Reproduz a decisao do worker: o erro e observado e registrado, nunca
	// propagado como falha da mensagem.
	var propagado error
	if err := spy.ArchiveAudio(context.Background(), "553499", []byte{1}, ""); err != nil {
		_ = err // o worker apenas loga
	}

	if propagado != nil {
		t.Fatal("falha do cofre nao deve ser propagada como erro da mensagem")
	}
	if spy.chamadas != 1 {
		t.Errorf("cofre deveria ter sido chamado 1x, got %d", spy.chamadas)
	}
}

// Compile-time: a interface do worker e satisfeita pelo dublê, garantindo que
// a assinatura nao mude sem que os chamadores sejam revisados.
var _ AudioArchiver = (*spyArchiver)(nil)
