package domain

import (
	"context"
	"fmt"
	"log"
	"time"
)

// AuditVaultPurger abstrai as duas operações que o expurgo precisa do
// fornecedor: listar o que venceu e apagar cada lado (objeto + índice).
//
// Interface própria, separada de AudioVaultStorage/AuditVaultRepository — a
// escrita (SaveAudioToEphemeralVault) e o expurgo têm ciclos de vida
// independentes, e misturar as duas num contrato só acopla operações que não
// precisam viajar juntas.
type AuditVaultPurger interface {
	// ListExpiredAuditRecords retorna os registros cujo expires_at já passou.
	ListExpiredAuditRecords(ctx context.Context, agora time.Time) ([]AuditRecord, error)

	// DeleteAuditObject remove o OBJETO no storage. Não deve remover o índice.
	DeleteAuditObject(ctx context.Context, storagePath string) error

	// DeleteAuditRecord remove a LINHA do índice. Só é chamado depois que o
	// objeto correspondente já foi removido com sucesso.
	DeleteAuditRecord(ctx context.Context, storagePath string) error
}

// PurgeResult resume uma passada do expurgo, para log e observabilidade.
type PurgeResult struct {
	Triturados int      // objeto + índice removidos com sucesso
	Falhas     int      // pelo menos uma das duas remoções falhou
	Erros      []string // detalhe de cada falha, para log
}

// PurgeExpiredAuditRecords apaga o que já passou do prazo de retenção.
//
// ORDEM ESTRITA: o objeto físico sai do storage ANTES da linha sair do índice.
// Se a ordem fosse invertida e a exclusão do objeto falhasse depois de já ter
// removido a linha, o áudio ficaria orfão no bucket — sem nenhum índice
// apontando para ele, invisível para qualquer expurgo futuro, e ainda assim
// existindo fisicamente. É exatamente o cenário que a retenção de 90 dias
// existe para evitar: dado sensível vivendo além do prazo, sem rastro.
//
// A falha de UM registro não interrompe os demais: um bucket temporariamente
// instável não pode travar o expurgo do resto do lote inteiro.
func PurgeExpiredAuditRecords(ctx context.Context, purger AuditVaultPurger, agora time.Time) PurgeResult {
	var result PurgeResult

	if purger == nil {
		result.Falhas = 1
		result.Erros = append(result.Erros, "expurgo: purger nao inicializado")
		return result
	}

	expirados, err := purger.ListExpiredAuditRecords(ctx, agora)
	if err != nil {
		result.Falhas = 1
		result.Erros = append(result.Erros, fmt.Sprintf("falha ao listar vencidos: %v", err))
		return result
	}

	for _, rec := range expirados {
		// Defesa em profundidade: revalida no cliente mesmo que a consulta já
		// tenha filtrado por expires_at no servidor. Uma corrida entre a
		// listagem e o processamento não pode apagar um registro que, por
		// alguma razão de relógio, ainda esteja dentro do prazo.
		if !rec.Expirado(agora) {
			continue
		}

		if err := purger.DeleteAuditObject(ctx, rec.StoragePath); err != nil {
			result.Falhas++
			result.Erros = append(result.Erros, fmt.Sprintf("objeto %q: %v", rec.StoragePath, err))
			// NÃO segue para o índice: apagar a linha aqui deixaria o objeto
			// órfão e sem rastro, que é o cenário que a ordem estrita evita.
			continue
		}

		if err := purger.DeleteAuditRecord(ctx, rec.StoragePath); err != nil {
			result.Falhas++
			result.Erros = append(result.Erros, fmt.Sprintf("indice %q (objeto ja removido): %v", rec.StoragePath, err))
			continue
		}

		result.Triturados++
	}

	return result
}

// AuditGCTicker roda PurgeExpiredAuditRecords em intervalos regulares.
//
// Ticker em vez de pg_cron por decisão explícita do time: o destino final é
// uma VPS 24/7 rodando o próprio binário Go, e a regra de exclusão deve ficar
// tipada e centralizada no repositório — não espalhada em SQL agendado fora do
// controle de versão do código.
type AuditGCTicker struct {
	purger   AuditVaultPurger
	interval time.Duration
}

// NewAuditGCTicker cria o triturador. interval controla a frequência; em
// produção o esperado é 24h, mas o parâmetro existe justamente para permitir
// um intervalo curto em teste, sem esperar um dia para observar o efeito.
func NewAuditGCTicker(purger AuditVaultPurger, interval time.Duration) *AuditGCTicker {
	return &AuditGCTicker{purger: purger, interval: interval}
}

// Run bloqueia até ctx ser cancelado. Deve ser chamado em goroutine própria.
//
// Roda uma passada imediatamente ao iniciar, e não só após o primeiro tick: um
// GC que só age depois de 24h de silêncio deixaria os primeiros registros já
// vencidos (por exemplo, de uma migração de dados antigos) esperando um dia
// inteiro sem necessidade.
func (t *AuditGCTicker) Run(ctx context.Context) {
	log.Printf("♻️  [Cofre-GC] Triturador iniciado (intervalo=%s)", t.interval)

	t.tick(ctx)

	ticker := time.NewTicker(t.interval)
	defer ticker.Stop()

	for {
		select {
		case <-ctx.Done():
			log.Println("♻️  [Cofre-GC] Triturador encerrado")
			return
		case <-ticker.C:
			t.tick(ctx)
		}
	}
}

func (t *AuditGCTicker) tick(ctx context.Context) {
	result := PurgeExpiredAuditRecords(ctx, t.purger, time.Now().UTC())

	switch {
	case result.Triturados > 0 && result.Falhas == 0:
		log.Printf("♻️  [Cofre-GC] %d áudio(s) vencido(s) triturado(s) com sucesso", result.Triturados)
	case result.Triturados > 0 && result.Falhas > 0:
		log.Printf("♻️  [Cofre-GC] %d triturado(s), %d falha(s): %v", result.Triturados, result.Falhas, result.Erros)
	case result.Falhas > 0:
		log.Printf("🚨 [Cofre-GC] Falha no expurgo, nenhum áudio triturado: %v", result.Erros)
	default:
		log.Println("♻️  [Cofre-GC] Nenhum áudio vencido nesta passada")
	}
}
