package state

// Cadastro do produtor pelo próprio WhatsApp (DT-58).
//
// POR QUE ESTE ARQUIVO EXISTE
//
// Até aqui, um número desconhecido recebia "❌ WhatsApp não vinculado. Vincule
// via portal web." e o fluxo morria. Quem só usa WhatsApp — que é boa parte do
// público — precisava abrir um navegador, criar conta, achar um código de
// vínculo e voltar. Esse era o atrito que o DT-58 existe para remover.
//
// ESTRATÉGIA: EXTRAÇÃO ONE-SHOT, NÃO SLOT-FILLING
//
// O estado da FSM vive em memória (history.Manager, TTL 45min, perdido em
// restart). Um cadastro conduzido campo a campo, ao longo de muitos turnos,
// perderia o progresso em qualquer deploy — e deploy no meio do cadastro de um
// produtor é exatamente o tipo de coisa que acontece. Por isso o desenho aqui
// tenta extrair os quatro campos de QUALQUER mensagem, a cada mensagem: se a
// pessoa mandar tudo de uma vez, cadastra na hora; se mandar pela metade, o
// bot pede só o que falta e tenta de novo. Perder o estado no meio custa, no
// pior caso, uma pergunta repetida — nunca um cadastro pela metade.
//
// O único momento que realmente depende de estado é a confirmação (o "SIM"
// precisa saber o que está sendo confirmado). Esse estado é curto, e se sumir
// o bot simplesmente reextrai e pergunta de novo.

import (
	"context"
	"encoding/json"
	"fmt"
	"log"
	"strings"

	"github.com/thebrunm97/pmo-bot-go/internal/history"
	"github.com/thebrunm97/pmo-bot-go/internal/llm"
	"github.com/thebrunm97/pmo-bot-go/internal/llm/schema"
	"github.com/thebrunm97/pmo-bot-go/internal/ports"
	"github.com/thebrunm97/pmo-bot-go/internal/supabase"
)

const (
	// StateAguardandoCadastro: o bot já se apresentou e espera os dados.
	StateAguardandoCadastro = "aguardando_cadastro"
	// StateConfirmandoCadastro: os dados foram extraídos e aguardam o SIM.
	StateConfirmandoCadastro = "confirmando_cadastro"
)

// DadosCadastro são os quatro campos que setup_initial_profile pede do
// produtor (o quinto, p_user_id, o backend resolve sozinho).
type DadosCadastro struct {
	Nome            string  `json:"nome" jsonschema:"description=Nome completo do produtor rural"`
	PropriedadeNome string  `json:"propriedade_nome" jsonschema:"description=Nome da propriedade ou sítio/fazenda"`
	AreaHa          float64 `json:"area_ha" jsonschema:"description=Área total da propriedade em hectares (número). 0 se não informado"`
	TalhaoNome      string  `json:"talhao_nome" jsonschema:"description=Nome do primeiro talhão/área de plantio"`
}

// faltantes lista, em português, os campos ainda não preenchidos.
func (d DadosCadastro) faltantes() []string {
	var f []string
	if strings.TrimSpace(d.Nome) == "" {
		f = append(f, "seu nome completo")
	}
	if strings.TrimSpace(d.PropriedadeNome) == "" {
		f = append(f, "o nome da sua propriedade")
	}
	if d.AreaHa <= 0 {
		f = append(f, "o tamanho dela em hectares")
	}
	if strings.TrimSpace(d.TalhaoNome) == "" {
		f = append(f, "o nome do primeiro talhão (a área onde você planta)")
	}
	return f
}

func (d DadosCadastro) completo() bool { return len(d.faltantes()) == 0 }

const msgBoasVindas = `👋 Olá! Sou o assistente do *ManejoORG*.

Vi que este número ainda não tem cadastro. Posso criar o seu agora mesmo, por aqui — não precisa entrar em site nenhum.

Me manda numa mensagem só:
• Seu nome completo
• O nome da sua propriedade
• O tamanho dela, em hectares
• O nome do primeiro talhão (a área onde você planta)

_Exemplo: "João da Silva, Sítio Boa Vista, 12 hectares, Talhão da Frente"_

Se você já tem conta no site, é só mandar *CONECTAR* seguido do seu código.`

const promptExtracaoCadastro = `Você extrai dados de cadastro de produtores rurais brasileiros a partir de mensagens de WhatsApp.

Extraia APENAS o que estiver explicitamente na mensagem. Nunca invente, nunca complete com suposição:
- nome: nome completo da PESSOA. Não confunda com o nome da propriedade.
- propriedade_nome: nome do sítio/fazenda/chácara. Não confunda com o nome da pessoa nem com o do talhão.
- area_ha: área em HECTARES, como número. Converta se vier em alqueire (1 alqueire paulista = 2.42 ha) ou em m² (10000 m² = 1 ha). Use 0 se não houver área na mensagem.
- talhao_nome: nome do talhão, lote, gleba ou área de plantio.

Campo ausente na mensagem = string vazia (ou 0 para area_ha). É melhor devolver vazio e o sistema perguntar do que preencher errado: este dado vai virar o cadastro oficial do produtor.`

// extrairDadosCadastro roda a extração estruturada sobre a mensagem.
func extrairDadosCadastro(ctx context.Context, llmClient llm.LLMProvider, texto string) (DadosCadastro, error) {
	var vazio DadosCadastro

	raw, err := schema.Reflect[DadosCadastro]()
	if err != nil {
		return vazio, fmt.Errorf("onboarding: schema: %w", err)
	}
	esquema, err := schema.ForOpenRouter(raw, "dados_cadastro")
	if err != nil {
		return vazio, fmt.Errorf("onboarding: schema openrouter: %w", err)
	}

	resp, err := llmClient.GenerateContent(ctx, llm.ContentRequest{
		SystemInstruction: promptExtracaoCadastro,
		History: []llm.MensagemAgnostica{
			{Role: llm.PapelUser, Content: texto},
		},
		Schema: esquema,
	})
	if err != nil {
		return vazio, fmt.Errorf("onboarding: extração: %w", err)
	}

	dados, err := schema.DecodeAndValidate[DadosCadastro](resp.Texto)
	if err != nil {
		return vazio, fmt.Errorf("onboarding: decode: %w", err)
	}
	return dados, nil
}

// resumoCadastro monta o texto de conferência mostrado antes de gravar.
func resumoCadastro(d DadosCadastro) string {
	return fmt.Sprintf(
		"Confere pra mim se está tudo certo:\n\n👤 *Nome:* %s\n🏡 *Propriedade:* %s\n📐 *Área:* %g hectares\n🌱 *Primeiro talhão:* %s\n\nPosso cadastrar assim?",
		d.Nome, d.PropriedadeNome, d.AreaHa, d.TalhaoNome)
}

// ehConfirmacao reconhece um "sim" — tanto pelo botão quanto digitado.
//
// Aceita só a mensagem inteira, nunca por substring: a mesma lição do DT-29,
// onde aceitar trecho faria uma frase qualquer disparar uma ação silenciosa.
func ehConfirmacao(texto string) bool {
	switch strings.ToLower(strings.TrimSpace(texto)) {
	case "sim", "s", "ok", "confirmo", "pode", "isso", "correto", "certo":
		return true
	}
	return false
}

func ehNegacao(texto string) bool {
	switch strings.ToLower(strings.TrimSpace(texto)) {
	case "não", "nao", "n", "errado", "corrigir":
		return true
	}
	return false
}

// HandleOnboarding conduz o cadastro de um número ainda sem profile.
//
// Devolve tratado=false quando a mensagem não é do fluxo de cadastro (por
// exemplo o comando CONECTAR), deixando o chamador seguir com o que fazia.
func HandleOnboarding(
	ctx context.Context,
	msg ports.IncomingMessage,
	phone string,
	body string,
	respondWithAudio bool,
	sbClient *supabase.Client,
	wpClient ports.MessageSender,
	ttsClient ports.Synthesizer,
	llmClient llm.LLMProvider,
	historyManager *history.Manager,
) (ProcessResult, bool) {
	if sbClient == nil || llmClient == nil || historyManager == nil {
		return ProcessResult{}, false
	}

	estado, ctxFSM, _ := historyManager.GetFSMState(phone)

	// ── Confirmação pendente ────────────────────────────────────────────────
	if estado == StateConfirmandoCadastro {
		if ehNegacao(body) {
			historyManager.SetFSMState(phone, StateAguardandoCadastro, nil, nil)
			sendFeedback(sbClient, wpClient, ttsClient, msg.From,
				"Sem problema! Me manda os dados de novo, do jeito certo desta vez. 🙂", respondWithAudio)
			return ProcessResult{Success: true, Reason: "onboarding_corrigir"}, true
		}

		if ehConfirmacao(body) {
			dados, ok := dadosDoContexto(ctxFSM)
			if !ok {
				// Estado perdido (restart) ou corrompido: reextrai em vez de
				// gravar algo que não foi conferido.
				historyManager.SetFSMState(phone, StateAguardandoCadastro, nil, nil)
				sendFeedback(sbClient, wpClient, ttsClient, msg.From,
					"Desculpa, perdi os dados que você tinha mandado. Pode reenviar?", respondWithAudio)
				return ProcessResult{Success: false, Reason: "onboarding_estado_perdido"}, true
			}
			return finalizarCadastro(phone, msg, dados, respondWithAudio, sbClient, wpClient, ttsClient, historyManager), true
		}

		// Nem sim nem não: pode ser uma correção já com os dados novos. Cai
		// para a extração abaixo em vez de insistir no botão.
	}

	// ── Primeiro contato ────────────────────────────────────────────────────
	// Uma saudação curta não carrega dados de cadastro; gastar uma chamada de
	// LLM nela seria desperdício. Só tenta extrair se a mensagem tiver
	// substância ou se já estivermos no meio do cadastro.
	if estado != StateAguardandoCadastro && estado != StateConfirmandoCadastro && !pareceConterDados(body) {
		historyManager.SetFSMState(phone, StateAguardandoCadastro, nil, nil)
		sendFeedback(sbClient, wpClient, ttsClient, msg.From, msgBoasVindas, respondWithAudio)
		return ProcessResult{Success: true, Reason: "onboarding_iniciado"}, true
	}

	// ── Extração ────────────────────────────────────────────────────────────
	dados, err := extrairDadosCadastro(ctx, llmClient, body)
	if err != nil {
		log.Printf("⚠️ [Onboarding] Falha ao extrair dados de %s: %v", phone, err)
		historyManager.SetFSMState(phone, StateAguardandoCadastro, nil, nil)
		sendFeedback(sbClient, wpClient, ttsClient, msg.From,
			"Não consegui entender os dados. Pode mandar de novo, com nome, propriedade, hectares e talhão?", respondWithAudio)
		return ProcessResult{Success: false, Reason: "onboarding_extracao_falhou"}, true
	}

	if !dados.completo() {
		historyManager.SetFSMState(phone, StateAguardandoCadastro, contextoDosDados(dados), nil)
		faltam := dados.faltantes()
		sendFeedback(sbClient, wpClient, ttsClient, msg.From,
			fmt.Sprintf("Quase lá! Ainda preciso de: %s.", strings.Join(faltam, ", ")), respondWithAudio)
		return ProcessResult{Success: true, Reason: "onboarding_incompleto"}, true
	}

	// ── Conferência ─────────────────────────────────────────────────────────
	historyManager.SetFSMState(phone, StateConfirmandoCadastro, contextoDosDados(dados), nil)

	resumo := resumoCadastro(dados)
	if wpClient != nil {
		botoes := []map[string]string{
			{"type": "reply", "displayText": "SIM", "id": "SIM"},
			{"type": "reply", "displayText": "NÃO", "id": "NÃO"},
		}
		if err := wpClient.SendButton(msg.From, "Confirmar cadastro", resumo, "É só tocar em SIM ou NÃO", botoes); err != nil {
			// Botão é enfeite, não requisito: se o provedor recusar, o texto
			// sozinho já permite responder "sim".
			log.Printf("⚠️ [Onboarding] Botões indisponíveis, seguindo em texto: %v", err)
			sendFeedback(sbClient, wpClient, ttsClient, msg.From, resumo+"\n\nResponda *SIM* ou *NÃO*.", respondWithAudio)
		}
	}

	return ProcessResult{Success: true, Reason: "onboarding_aguardando_confirmacao"}, true
}

// finalizarCadastro cria o usuário e grava o cadastro.
func finalizarCadastro(
	phone string,
	msg ports.IncomingMessage,
	dados DadosCadastro,
	respondWithAudio bool,
	sbClient *supabase.Client,
	wpClient ports.MessageSender,
	ttsClient ports.Synthesizer,
	historyManager *history.Manager,
) ProcessResult {
	usuario, err := sbClient.CreateAuthUserByPhone(phone, map[string]interface{}{
		"nome":   dados.Nome,
		"origem": "whatsapp_onboarding",
	})
	if err != nil {
		log.Printf("❌ [Onboarding] Falha ao criar usuário para %s: %v", phone, err)
		sendFeedback(sbClient, wpClient, ttsClient, msg.From,
			"Tive um problema para criar seu cadastro. Pode tentar de novo daqui a pouco?", respondWithAudio)
		return ProcessResult{Success: false, Reason: "onboarding_auth_falhou"}
	}

	_, err = sbClient.SetupInitialProfile(usuario.ID, dados.Nome, dados.PropriedadeNome, dados.AreaHa, dados.TalhaoNome)
	if err != nil {
		// Compensação: sem isto, o usuário fica órfão em auth.users e a
		// próxima mensagem tentaria criar OUTRO, acumulando lixo a cada
		// tentativa — e `profiles.telefone` é UNIQUE, então o cadastro
		// seguinte falharia de um jeito difícil de diagnosticar.
		log.Printf("❌ [Onboarding] RPC falhou para %s, desfazendo usuário %s: %v", phone, usuario.ID, err)
		if errDel := sbClient.DeleteAuthUser(usuario.ID); errDel != nil {
			log.Printf("🔥 [Onboarding] Usuário %s ficou órfão em auth.users — limpeza manual necessária: %v", usuario.ID, errDel)
		}
		sendFeedback(sbClient, wpClient, ttsClient, msg.From,
			"Tive um problema para salvar seu cadastro. Pode tentar de novo daqui a pouco?", respondWithAudio)
		return ProcessResult{Success: false, Reason: "onboarding_rpc_falhou"}
	}

	historyManager.ClearFSMState(phone)

	sendFeedback(sbClient, wpClient, ttsClient, msg.From, fmt.Sprintf(
		"✅ *Cadastro criado, %s!*\n\n🏡 %s (%g ha)\n🌱 Talhão: %s\n\nPode começar a registrar. Experimente mandar algo como _\"plantei alface no %s hoje\"_.",
		primeiroNome(dados.Nome), dados.PropriedadeNome, dados.AreaHa, dados.TalhaoNome, dados.TalhaoNome), respondWithAudio)

	log.Printf("🎉 [Onboarding] Produtor cadastrado pelo WhatsApp: phone=%s user=%s", phone, usuario.ID)
	return ProcessResult{Success: true, Reason: "onboarding_concluido"}
}

func primeiroNome(nome string) string {
	if p := strings.Fields(strings.TrimSpace(nome)); len(p) > 0 {
		return p[0]
	}
	return nome
}

// pareceConterDados evita gastar uma chamada de LLM com "oi" ou "bom dia".
// Erra deliberadamente para o lado de tentar: um falso positivo custa uma
// extração barata, um falso negativo faz o produtor repetir a mensagem inteira.
func pareceConterDados(texto string) bool {
	t := strings.TrimSpace(texto)
	if len([]rune(t)) < 15 {
		return false
	}
	return strings.ContainsAny(t, "0123456789") || strings.Contains(t, ",") || len(strings.Fields(t)) >= 5
}

// contextoDosDados serializa os dados para o contexto da FSM.
func contextoDosDados(d DadosCadastro) map[string]interface{} {
	b, err := json.Marshal(d)
	if err != nil {
		return nil
	}
	var m map[string]interface{}
	if err := json.Unmarshal(b, &m); err != nil {
		return nil
	}
	return map[string]interface{}{"cadastro": m}
}

// dadosDoContexto faz o caminho inverso, tolerando estado ausente/corrompido.
func dadosDoContexto(ctxFSM map[string]interface{}) (DadosCadastro, bool) {
	var d DadosCadastro
	if ctxFSM == nil {
		return d, false
	}
	bruto, ok := ctxFSM["cadastro"]
	if !ok {
		return d, false
	}
	b, err := json.Marshal(bruto)
	if err != nil {
		return d, false
	}
	if err := json.Unmarshal(b, &d); err != nil {
		return d, false
	}
	return d, d.completo()
}
