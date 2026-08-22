// Package auditvault liga o Cofre de Auditoria Efêmero (DT-42) ao Supabase.
//
// Vive numa camada de adaptação, e não dentro de internal/supabase, por uma
// razão concreta: aquele pacote não pode importar internal/domain sem fechar um
// ciclo (supabase → domain → ports → supabase). Aqui os dois lados são
// importáveis, e a tradução entre o tipo de domínio e as chamadas do fornecedor
// acontece num só lugar.
//
// A regra de negócio — retenção de 90 dias, ordem upload-antes-do-índice,
// formato do caminho — permanece em internal/domain. Este pacote não decide
// nada; apenas resolve o titular e traduz.
package auditvault

import (
	"context"
	"fmt"
	"log"
	"strings"
	"time"

	"github.com/thebrunm97/pmo-bot-go/internal/domain"
	"github.com/thebrunm97/pmo-bot-go/internal/supabase"
)

// Adapter arquiva gravações no cofre.
type Adapter struct {
	client *supabase.Client
}

// New cria o adaptador. Um cliente nil é tolerado e resulta em erro explícito
// no uso, em vez de panic — o arquivamento é best-effort e não deve derrubar o
// processamento da mensagem do produtor.
func New(c *supabase.Client) *Adapter {
	return &Adapter{client: c}
}

// ArchiveAudio implementa queue.AudioArchiver.
//
// Resolve o titular pelo telefone e delega ao domínio. A resolução acontece
// aqui porque telefone→perfil é detalhe de persistência, que o worker de mídia
// não precisa conhecer.
//
// Falhar em resolver é erro real, não um caso a ignorar: sem titular não há RLS
// a aplicar, e uma gravação sem dono ficaria acessível a ninguém ou a todos.
func (a *Adapter) ArchiveAudio(ctx context.Context, phone string, audio []byte, intent string) error {
	if a == nil || a.client == nil {
		return fmt.Errorf("cofre de auditoria: adaptador nao inicializado")
	}

	profile, err := a.client.GetProfileByPhone(phone)
	if err != nil {
		return fmt.Errorf("cofre de auditoria: nao foi possivel resolver o titular: %w", err)
	}
	if profile == nil || strings.TrimSpace(profile.ID) == "" {
		return fmt.Errorf("cofre de auditoria: telefone sem perfil associado")
	}

	rec, err := domain.SaveAudioToEphemeralVault(ctx, profile.ID, audio, intent, a, a)
	if err != nil {
		return err
	}

	log.Printf("🔐 [Cofre] Audio arquivado (titular=%s, expira em %s)",
		profile.ID, rec.ExpiresAt.Format("2006-01-02"))
	return nil
}

// UploadAudio implementa domain.AudioVaultStorage.
//
// CONTRATO do domínio: o bucket DEVE ser privado. Garantido pela migration —
// `audit-vault` foi criado com public=false, teto de 25 MB e apenas MIME de
// áudio. Não se verifica em runtime porque consultar a configuração a cada
// upload seria custoso sem ganho real: se alguém tornar o bucket público, o
// problema é de governança de infraestrutura, não de código.
func (a *Adapter) UploadAudio(ctx context.Context, bucket, storagePath string, audio []byte, contentType string) error {
	return a.client.UploadStorageFile(ctx, bucket, storagePath, audio, contentType)
}

// InsertAuditRecord implementa domain.AuditVaultRepository.
func (a *Adapter) InsertAuditRecord(ctx context.Context, rec domain.AuditRecord) error {
	return a.client.InsertAuditVaultRecord(
		ctx,
		rec.ProfileID,
		rec.StoragePath,
		rec.FinalIntent,
		rec.CreatedAt,
		rec.ExpiresAt,
	)
}

// Garantias de compilação: o adaptador satisfaz os contratos do domínio.
var (
	_ domain.AudioVaultStorage    = (*Adapter)(nil)
	_ domain.AuditVaultRepository = (*Adapter)(nil)
	_ domain.AuditVaultPurger     = (*Adapter)(nil)
)

// bucketAuditVault é o mesmo bucket privado usado no upload — mantido próximo
// ao Purger para que expurgo e escrita nunca apontem para buckets diferentes.
const bucketAuditVault = "audit-vault"

// ListExpiredAuditRecords implementa domain.AuditVaultPurger.
func (a *Adapter) ListExpiredAuditRecords(ctx context.Context, agora time.Time) ([]domain.AuditRecord, error) {
	rows, err := a.client.ListExpiredAuditVaultRows(ctx, agora)
	if err != nil {
		return nil, fmt.Errorf("cofre de auditoria: listar vencidos: %w", err)
	}

	recs := make([]domain.AuditRecord, 0, len(rows))
	for _, r := range rows {
		recs = append(recs, domain.AuditRecord{
			ProfileID:   r.ProfileID,
			StoragePath: r.StoragePath,
			CreatedAt:   r.CreatedAt,
			ExpiresAt:   r.ExpiresAt,
		})
	}
	return recs, nil
}

// DeleteAuditObject implementa domain.AuditVaultPurger.
func (a *Adapter) DeleteAuditObject(ctx context.Context, storagePath string) error {
	return a.client.DeleteStorageFile(ctx, bucketAuditVault, storagePath)
}

// DeleteAuditRecord implementa domain.AuditVaultPurger.
func (a *Adapter) DeleteAuditRecord(ctx context.Context, storagePath string) error {
	return a.client.DeleteAuditVaultRow(ctx, storagePath)
}
