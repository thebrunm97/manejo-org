package domain

import (
	"context"
	"crypto/rand"
	"encoding/hex"
	"fmt"
	"path"
	"strings"
	"time"
)

// RetencaoCofreAuditoria é por quanto tempo a gravação fica guardada.
//
// 90 dias é o compromisso entre dois interesses opostos do MESMO produtor:
// tempo suficiente para contestar um registro que a IA tenha alucinado
// (não-repúdio), e curto o bastante para o cofre não virar arquivo permanente
// de biometria vocal — que é dado sensível pela LGPD (art. 5º, II).
//
// Alterar esta constante NÃO reescreve o prazo de registros já criados: cada
// linha materializa seu próprio expires_at, de modo que a política vigente na
// época da gravação permaneça auditável.
const RetencaoCofreAuditoria = 90 * 24 * time.Hour

// bucketCofreAuditoria é o bucket PRIVADO do cofre.
//
// Deliberadamente distinto do bucket legado `audios_audit`, que está marcado
// como público (verificado em 2026-08-22) e por isso expõe toda gravação já
// armazenada a quem tiver a URL. Reaproveitá-lo anularia a RLS da tabela: de
// nada adianta proteger o índice se o objeto continua servido em aberto.
const bucketCofreAuditoria = "audit-vault"

// AuditRecord é a entrada do cofre — o índice que aponta para a gravação.
//
// O áudio em si nunca trafega nesta struct: guarda-se o CAMINHO no storage
// privado, jamais uma URL pública. O acesso do titular se dá por URL assinada
// de curta duração, emitida sob demanda após a checagem de RLS.
type AuditRecord struct {
	// ProfileID é o titular. É a chave da RLS — sem ele não há como provar
	// quem pode ouvir o quê, e o registro não deve existir.
	ProfileID string `json:"profile_id"`

	// StoragePath localiza o objeto dentro do bucket privado.
	StoragePath string `json:"storage_path"`

	// FinalIntent é o elo do não-repúdio: permite confrontar o que a IA
	// entendeu com o que o produtor efetivamente disse.
	FinalIntent string `json:"final_intent,omitempty"`

	CreatedAt time.Time `json:"created_at"`
	ExpiresAt time.Time `json:"expires_at"`
}

// Expirado informa se a retenção já venceu.
//
// Serve à rotina de expurgo e também como guarda de leitura: um registro
// vencido não deve ser servido ao titular mesmo que o expurgo ainda não tenha
// rodado, para que uma falha na rotina não vire retenção silenciosa.
func (r AuditRecord) Expirado(agora time.Time) bool {
	return !r.ExpiresAt.IsZero() && agora.After(r.ExpiresAt)
}

// AudioVaultStorage abstrai o armazenamento do objeto.
//
// Interface própria, em vez de depender do cliente do Supabase, para que o
// domínio não conheça o fornecedor — mesma estratégia de ports.TTSProvider e
// ports.LLMProvider. Aqui isso não é só higiene: manter o cofre trocável
// importa porque a escolha de onde a biometria vocal repousa é uma decisão de
// privacidade, não de conveniência técnica.
type AudioVaultStorage interface {
	// UploadAudio grava o objeto no bucket informado.
	//
	// CONTRATO: a implementação DEVE gravar em bucket privado. Um bucket
	// público anularia a RLS do índice e recriaria a exposição que este cofre
	// existe para corrigir.
	UploadAudio(ctx context.Context, bucket, storagePath string, audio []byte, contentType string) error
}

// AuditVaultRepository abstrai a persistência do índice.
type AuditVaultRepository interface {
	InsertAuditRecord(ctx context.Context, rec AuditRecord) error
}

// SaveAudioToEphemeralVault guarda a gravação no cofre e indexa os metadados.
//
// A ordem importa: o objeto é enviado ANTES do índice. Se o índice viesse
// primeiro e o upload falhasse, restaria uma linha apontando para um áudio
// inexistente — e o produtor descobriria a lacuna justamente ao tentar se
// defender de um registro contestado, que é o pior momento possível.
//
// A ordem inversa também tem custo: se o índice falhar após o upload, sobra um
// objeto órfão no bucket. Isso é preferível — um órfão é lixo a recolher pela
// rotina de expurgo, enquanto um índice quebrado é uma promessa de prova que
// não se cumpre. O erro é propagado justamente para o chamador poder registrar
// a inconsistência.
func SaveAudioToEphemeralVault(
	ctx context.Context,
	profileID string,
	audio []byte,
	intent string,
	storage AudioVaultStorage,
	repo AuditVaultRepository,
) (AuditRecord, error) {
	if strings.TrimSpace(profileID) == "" {
		// Sem titular não há a quem aplicar a RLS: a gravação ficaria acessível
		// a ninguém ou a todos, e nenhuma das duas serve. Melhor recusar.
		return AuditRecord{}, fmt.Errorf("cofre de auditoria: profileID vazio — sem titular a RLS nao protege nada")
	}
	if len(audio) == 0 {
		return AuditRecord{}, fmt.Errorf("cofre de auditoria: audio vazio")
	}
	if storage == nil || repo == nil {
		return AuditRecord{}, fmt.Errorf("cofre de auditoria: storage e repositorio sao obrigatorios")
	}

	agora := time.Now().UTC()

	storagePath, err := montarCaminhoCofre(profileID, agora)
	if err != nil {
		return AuditRecord{}, fmt.Errorf("cofre de auditoria: %w", err)
	}

	rec := AuditRecord{
		ProfileID:   profileID,
		StoragePath: storagePath,
		FinalIntent: strings.TrimSpace(intent),
		CreatedAt:   agora,
		ExpiresAt:   agora.Add(RetencaoCofreAuditoria),
	}

	if err := storage.UploadAudio(ctx, bucketCofreAuditoria, storagePath, audio, "audio/ogg"); err != nil {
		return AuditRecord{}, fmt.Errorf("cofre de auditoria: falha ao gravar audio: %w", err)
	}

	if err := repo.InsertAuditRecord(ctx, rec); err != nil {
		// Objeto órfão no bucket. A rotina de expurgo o recolhe; o chamador
		// precisa saber que a promessa de prova não foi registrada.
		return AuditRecord{}, fmt.Errorf("cofre de auditoria: audio gravado em %q mas indice falhou (objeto orfao): %w", storagePath, err)
	}

	return rec, nil
}

// montarCaminhoCofre gera o caminho do objeto dentro do bucket.
//
// Formato: <profile_id>/<AAAA-MM-DD>/<aleatorio>.ogg
//
// Três decisões embutidas:
//
//   - O prefixo por titular permite que o expurgo de um pedido de eliminação
//     (art. 18, VI) apague tudo de um produtor por prefixo, sem varrer o bucket.
//   - A pasta por data facilita conferir visualmente o que já passou dos 90 dias.
//   - O sufixo é ALEATÓRIO, não derivado do ID da mensagem do WhatsApp como no
//     bucket legado. Nome previsível somado a bucket público foi exatamente o
//     que tornou as gravações antigas adivinháveis; aqui o nome não carrega
//     informação nem pode ser reconstruído de fora.
func montarCaminhoCofre(profileID string, agora time.Time) (string, error) {
	if strings.ContainsAny(profileID, "/\\..") {
		// Evita que um identificador malformado escape do prefixo do titular.
		return "", fmt.Errorf("profileID com caracteres invalidos para caminho: %q", profileID)
	}

	buf := make([]byte, 16)
	if _, err := rand.Read(buf); err != nil {
		return "", fmt.Errorf("falha ao gerar nome unico: %w", err)
	}

	return path.Join(
		profileID,
		agora.Format("2006-01-02"),
		hex.EncodeToString(buf)+".ogg",
	), nil
}
