package domain

import (
	"context"
	"errors"
	"strings"
	"testing"
	"time"
)

type fakeVaultStorage struct {
	chamadas int
	bucket   string
	path     string
	err      error
}

func (f *fakeVaultStorage) UploadAudio(_ context.Context, bucket, storagePath string, _ []byte, _ string) error {
	f.chamadas++
	f.bucket, f.path = bucket, storagePath
	return f.err
}

type fakeVaultRepo struct {
	chamadas int
	rec      AuditRecord
	err      error
}

func (f *fakeVaultRepo) InsertAuditRecord(_ context.Context, rec AuditRecord) error {
	f.chamadas++
	f.rec = rec
	return f.err
}

func TestSalvaComRetencaoDe90Dias(t *testing.T) {
	st, repo := &fakeVaultStorage{}, &fakeVaultRepo{}

	rec, err := SaveAudioToEphemeralVault(context.Background(), "abc-123", []byte{1, 2, 3}, "registrar_colheita", st, repo)
	if err != nil {
		t.Fatalf("erro inesperado: %v", err)
	}

	janela := rec.ExpiresAt.Sub(rec.CreatedAt)
	if janela != RetencaoCofreAuditoria {
		t.Errorf("retencao = %v, esperado %v", janela, RetencaoCofreAuditoria)
	}
	if dias := janela.Hours() / 24; dias != 90 {
		t.Errorf("esperado 90 dias, got %.0f", dias)
	}
}

// O cofre NAO pode reaproveitar o bucket legado, que e publico — isso anularia
// a RLS do indice e recriaria a exposicao que o cofre existe para corrigir.
func TestUsaBucketPrivadoSeparadoDoLegado(t *testing.T) {
	st, repo := &fakeVaultStorage{}, &fakeVaultRepo{}

	if _, err := SaveAudioToEphemeralVault(context.Background(), "abc", []byte{1}, "", st, repo); err != nil {
		t.Fatalf("erro inesperado: %v", err)
	}

	if st.bucket == "audios_audit" {
		t.Fatal("cofre gravou no bucket legado PUBLICO — a RLS do indice seria inutil")
	}
	if st.bucket != bucketCofreAuditoria {
		t.Errorf("bucket = %q, esperado %q", st.bucket, bucketCofreAuditoria)
	}
}

// Sem titular a RLS nao protege ninguem: o registro nao deve existir.
func TestRecusaSemTitular(t *testing.T) {
	st, repo := &fakeVaultStorage{}, &fakeVaultRepo{}

	_, err := SaveAudioToEphemeralVault(context.Background(), "   ", []byte{1}, "", st, repo)
	if err == nil {
		t.Fatal("deveria recusar profileID vazio")
	}
	if st.chamadas != 0 {
		t.Error("nao deveria ter enviado audio sem titular definido")
	}
}

// O objeto vai antes do indice: um indice apontando para audio inexistente
// falharia justamente quando o produtor tentasse se defender.
func TestNaoIndexaQuandoUploadFalha(t *testing.T) {
	st := &fakeVaultStorage{err: errors.New("storage fora do ar")}
	repo := &fakeVaultRepo{}

	if _, err := SaveAudioToEphemeralVault(context.Background(), "abc", []byte{1}, "", st, repo); err == nil {
		t.Fatal("deveria propagar a falha do upload")
	}
	if repo.chamadas != 0 {
		t.Error("indexou um audio que nao foi gravado")
	}
}

// Falha no indice apos o upload deixa orfao — aceitavel, mas o chamador PRECISA
// saber, e a mensagem tem de permitir localizar o objeto.
func TestFalhaDeIndiceInformaOOrfao(t *testing.T) {
	st := &fakeVaultStorage{}
	repo := &fakeVaultRepo{err: errors.New("banco indisponivel")}

	_, err := SaveAudioToEphemeralVault(context.Background(), "abc", []byte{1}, "", st, repo)
	if err == nil {
		t.Fatal("deveria propagar a falha do indice")
	}
	if !strings.Contains(err.Error(), "orfao") || !strings.Contains(err.Error(), st.path) {
		t.Errorf("erro deveria sinalizar o orfao e seu caminho, got: %v", err)
	}
}

// O caminho e prefixado pelo titular para que um pedido de eliminacao
// (art. 18, VI) possa apagar tudo de um produtor por prefixo.
func TestCaminhoPermiteExpurgoPorTitular(t *testing.T) {
	p, err := montarCaminhoCofre("produtor-42", time.Date(2026, 8, 22, 0, 0, 0, 0, time.UTC))
	if err != nil {
		t.Fatalf("erro inesperado: %v", err)
	}
	if !strings.HasPrefix(p, "produtor-42/") {
		t.Errorf("caminho deveria comecar pelo titular, got %q", p)
	}
	if !strings.Contains(p, "2026-08-22") {
		t.Errorf("caminho deveria conter a data, got %q", p)
	}
}

// Nome previsivel somado a bucket publico foi o que tornou as gravacoes antigas
// adivinhaveis. O sufixo precisa ser aleatorio.
func TestNomeDoObjetoNaoEPrevisivel(t *testing.T) {
	agora := time.Now().UTC()
	a, _ := montarCaminhoCofre("mesmo-titular", agora)
	b, _ := montarCaminhoCofre("mesmo-titular", agora)

	if a == b {
		t.Fatal("dois caminhos identicos — nome previsivel permite adivinhar gravacoes")
	}
}

func TestRecusaProfileIDQuePodeEscaparDoPrefixo(t *testing.T) {
	for _, ruim := range []string{"../outro", "a/b", `..\x`} {
		if _, err := montarCaminhoCofre(ruim, time.Now()); err == nil {
			t.Errorf("deveria recusar profileID %q", ruim)
		}
	}
}

// Guarda de leitura: registro vencido nao deve ser servido mesmo que o expurgo
// ainda nao tenha rodado, para que falha na rotina nao vire retencao silenciosa.
func TestExpiradoProtegeContraFalhaDoExpurgo(t *testing.T) {
	criado := time.Now().UTC().Add(-100 * 24 * time.Hour)
	rec := AuditRecord{CreatedAt: criado, ExpiresAt: criado.Add(RetencaoCofreAuditoria)}

	if !rec.Expirado(time.Now().UTC()) {
		t.Error("registro de 100 dias deveria estar expirado")
	}
	recente := AuditRecord{CreatedAt: time.Now(), ExpiresAt: time.Now().Add(RetencaoCofreAuditoria)}
	if recente.Expirado(time.Now().UTC()) {
		t.Error("registro recente nao deveria estar expirado")
	}
}
