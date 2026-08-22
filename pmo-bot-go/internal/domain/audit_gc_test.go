package domain

import (
	"context"
	"errors"
	"testing"
	"time"
)

type fakePurger struct {
	registros   []AuditRecord
	falhaListar error
	falhaObjeto map[string]error // por storagePath
	falhaIndice map[string]error
	objetosOk   []string
	indicesOk   []string
}

func (f *fakePurger) ListExpiredAuditRecords(_ context.Context, _ time.Time) ([]AuditRecord, error) {
	if f.falhaListar != nil {
		return nil, f.falhaListar
	}
	return f.registros, nil
}

func (f *fakePurger) DeleteAuditObject(_ context.Context, storagePath string) error {
	if err, ok := f.falhaObjeto[storagePath]; ok {
		return err
	}
	f.objetosOk = append(f.objetosOk, storagePath)
	return nil
}

func (f *fakePurger) DeleteAuditRecord(_ context.Context, storagePath string) error {
	if err, ok := f.falhaIndice[storagePath]; ok {
		return err
	}
	f.indicesOk = append(f.indicesOk, storagePath)
	return nil
}

func vencido(path string, agora time.Time) AuditRecord {
	return AuditRecord{
		StoragePath: path,
		CreatedAt:   agora.Add(-100 * 24 * time.Hour),
		ExpiresAt:   agora.Add(-10 * 24 * time.Hour),
	}
}

func TestExpurgaSomenteVencidos(t *testing.T) {
	agora := time.Now().UTC()
	p := &fakePurger{registros: []AuditRecord{
		vencido("a.ogg", agora),
		vencido("b.ogg", agora),
	}}

	result := PurgeExpiredAuditRecords(context.Background(), p, agora)

	if result.Triturados != 2 {
		t.Fatalf("triturados = %d, esperado 2", result.Triturados)
	}
	if len(p.objetosOk) != 2 || len(p.indicesOk) != 2 {
		t.Fatalf("objetos=%v indices=%v", p.objetosOk, p.indicesOk)
	}
}

// O objeto tem que sair ANTES do indice: se a ordem fosse invertida e a
// exclusao do objeto falhasse depois de a linha ja ter sumido, o audio
// ficaria orfao — sem indice, invisivel a qualquer expurgo futuro, mas
// existindo fisicamente. E o oposto do que a retencao de 90 dias promete.
func TestObjetoSaiAntesDoIndice(t *testing.T) {
	agora := time.Now().UTC()
	p := &fakePurger{
		registros:   []AuditRecord{vencido("orfao-risco.ogg", agora)},
		falhaObjeto: map[string]error{"orfao-risco.ogg": errors.New("storage indisponivel")},
	}

	result := PurgeExpiredAuditRecords(context.Background(), p, agora)

	if result.Triturados != 0 {
		t.Fatal("nao deveria triturar se o objeto falhou")
	}
	if len(p.indicesOk) != 0 {
		t.Fatal("indice foi removido mesmo com o objeto falhando — cria orfao invisivel")
	}
}

// Falha no indice, com o objeto ja removido, e aceitavel (fica so a linha
// zumbi, sem dado sensivel associado) — mas precisa ser reportada.
func TestFalhaDeIndiceAposObjetoRemovidoEReportada(t *testing.T) {
	agora := time.Now().UTC()
	p := &fakePurger{
		registros:   []AuditRecord{vencido("x.ogg", agora)},
		falhaIndice: map[string]error{"x.ogg": errors.New("banco fora do ar")},
	}

	result := PurgeExpiredAuditRecords(context.Background(), p, agora)

	if result.Triturados != 0 || result.Falhas != 1 {
		t.Fatalf("triturados=%d falhas=%d, esperado 0/1", result.Triturados, result.Falhas)
	}
	if len(p.objetosOk) != 1 {
		t.Fatal("objeto deveria ter sido removido antes da falha do indice")
	}
}

// Uma falha isolada nao pode travar o lote inteiro: um bucket instavel por
// um registro nao pode impedir o expurgo dos demais.
func TestUmaFalhaNaoTravaOLote(t *testing.T) {
	agora := time.Now().UTC()
	p := &fakePurger{
		registros: []AuditRecord{
			vencido("falha.ogg", agora),
			vencido("ok1.ogg", agora),
			vencido("ok2.ogg", agora),
		},
		falhaObjeto: map[string]error{"falha.ogg": errors.New("temporario")},
	}

	result := PurgeExpiredAuditRecords(context.Background(), p, agora)

	if result.Triturados != 2 {
		t.Fatalf("triturados = %d, esperado 2 (falha.ogg nao conta)", result.Triturados)
	}
	if result.Falhas != 1 {
		t.Fatalf("falhas = %d, esperado 1", result.Falhas)
	}
}

// Defesa em profundidade: mesmo que o servidor devolva um registro nao
// vencido (corrida entre listagem e execucao), o expurgo nao pode apagar.
func TestRevalidaExpiracaoLocalmente(t *testing.T) {
	agora := time.Now().UTC()
	naoVencido := AuditRecord{
		StoragePath: "recente.ogg",
		CreatedAt:   agora,
		ExpiresAt:   agora.Add(90 * 24 * time.Hour),
	}
	p := &fakePurger{registros: []AuditRecord{naoVencido}}

	result := PurgeExpiredAuditRecords(context.Background(), p, agora)

	if result.Triturados != 0 {
		t.Fatal("nao deveria triturar registro ainda dentro do prazo")
	}
	if len(p.objetosOk) != 0 {
		t.Fatal("nao deveria sequer tentar remover o objeto")
	}
}

func TestFalhaAoListarNaoQuebraOChamador(t *testing.T) {
	p := &fakePurger{falhaListar: errors.New("timeout")}

	result := PurgeExpiredAuditRecords(context.Background(), p, time.Now())

	if result.Falhas != 1 || result.Triturados != 0 {
		t.Fatalf("resultado inesperado: %+v", result)
	}
}

func TestPurgerNilNaoQuebra(t *testing.T) {
	result := PurgeExpiredAuditRecords(context.Background(), nil, time.Now())
	if result.Falhas != 1 {
		t.Fatal("purger nil deveria reportar falha, nao panicar")
	}
}

// O Run do ticker executa uma passada IMEDIATA, sem esperar o primeiro tick —
// registros ja vencidos (ex: apos migracao de dados antigos) nao deveriam
// esperar ate 24h para a primeira triagem.
func TestTickerExecutaImediatamenteAoIniciar(t *testing.T) {
	agora := time.Now().UTC()
	p := &fakePurger{registros: []AuditRecord{vencido("imediato.ogg", agora)}}

	gc := NewAuditGCTicker(p, time.Hour) // intervalo longo, so pra nao disparar de novo no teste

	ctx, cancel := context.WithTimeout(context.Background(), 50*time.Millisecond)
	defer cancel()
	go gc.Run(ctx)

	<-ctx.Done()

	if len(p.objetosOk) != 1 {
		t.Fatalf("esperava trituracao imediata sem esperar o primeiro tick, objetos=%v", p.objetosOk)
	}
}
