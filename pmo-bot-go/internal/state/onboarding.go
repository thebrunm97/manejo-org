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
// PROGRESSIVE PROFILING (Fatia 2)
//
// A primeira versão deste fluxo exigia nome, propriedade, área e talhão antes
// de liberar qualquer uso — quatro perguntas antes do produtor ver qualquer
// valor. Agora o único dado obrigatório é o nome: ele já cria o profile
// (`create_basic_profile`) e libera o uso do bot. Propriedade/área/talhão
// ficam para uma etapa de complementação futura, que reaproveita a RPC
// `setup_initial_profile` já existente — por isso ela não foi alterada aqui.
//
// ESTRATÉGIA: EXTRAÇÃO ONE-SHOT, NÃO SLOT-FILLING
//
// O estado da FSM vive em memória (history.Manager, TTL 45min, perdido em
// restart). Por isso o desenho aqui tenta extrair o nome de QUALQUER
// mensagem, a cada mensagem: se a pessoa já mandar o nome de cara, cadastra
// na hora; perder o estado no meio, no pior caso, custa uma pergunta
// repetida — nunca um cadastro pela metade.
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
	"os"
)

const (
	// StatePerguntaContaExistente: o bot pergunta se o usuário já tem conta.
	StatePerguntaContaExistente = "pergunta_conta_existente"
	// StateAguardandoEmail: o usuário disse que tem conta e o bot pediu o e-mail.
	StateAguardandoEmail = "aguardando_email"
	// StateAguardandoOTPEmail: o OTP foi enviado e o bot aguarda os 6 dígitos.
	StateAguardandoOTPEmail = "aguardando_otp_email"
	// StateAguardandoCadastro: o bot confirmou que é novo e espera os dados.
	StateAguardandoCadastro = "aguardando_cadastro"
	// StateConfirmandoCadastro: os dados foram extraídos e aguardam o SIM.
	StateConfirmandoCadastro = "confirmando_cadastro"
)

// DadosCadastro é o dado mínimo que create_basic_profile pede do produtor (o
// segundo parâmetro, p_user_id, o backend resolve sozinho). Propriedade,
// área e talhão ficam para a etapa de complementação futura — os campos
// continuam aqui, opcionais, para essa etapa reaproveitar a mesma extração
// sem precisar de um segundo schema.
type DadosCadastro struct {
	Nome            string  `json:"nome" jsonschema:"required,description=Nome completo do produtor rural"`
	PropriedadeNome string  `json:"propriedade_nome,omitempty" jsonschema:"description=Nome da propriedade ou sítio/fazenda, se mencionado (opcional nesta etapa)"`
	AreaHa          float64 `json:"area_ha,omitempty" jsonschema:"description=Área total da propriedade em hectares, se mencionada (opcional nesta etapa)"`
	TalhaoNome      string  `json:"talhao_nome,omitempty" jsonschema:"description=Nome do primeiro talhão/área de plantio, se mencionado (opcional nesta etapa)"`
}

// faltantes lista, em português, os campos ainda não preenchidos. Nesta
// etapa só o nome é exigido — o resto é preenchido depois, na complementação.
func (d DadosCadastro) faltantes() []string {
	var f []string
	if strings.TrimSpace(d.Nome) == "" {
		f = append(f, "seu nome completo")
	}
	return f
}

func (d DadosCadastro) completo() bool { return len(d.faltantes()) == 0 }

const msgBoasVindas = `👋 Olá! Sou o assistente do *ManejoORG*.

Vi que este número ainda não está vinculado. Você já tem um cadastro feito por e-mail no nosso site? *(Responda Sim ou Não)*`

const promptExtracaoCadastro = `Você extrai dados de cadastro de produtores rurais brasileiros a partir de mensagens de WhatsApp.

Primeiro decida "eh_cadastro": a mensagem está de fato fornecendo dados pessoais para criar um cadastro (nome do produtor, propriedade, área, talhão)? Perguntas técnicas, dúvidas sobre produção/manejo, saudações, pedidos de ajuda ou qualquer assunto que não seja "aqui estão meus dados" NÃO são cadastro — marque eh_cadastro=false e deixe nome vazio, mesmo que a frase contenha palavras parecidas com nomes próprios.

Só quando eh_cadastro=true extraia os campos abaixo. Extraia APENAS o que estiver explicitamente na mensagem. Nunca invente, nunca complete com suposição:
- nome: nome completo da PESSOA. Não confunda com o nome da propriedade.
- propriedade_nome: nome do sítio/fazenda/chácara, SE a mensagem mencionar. Não confunda com o nome da pessoa nem com o do talhão.
- area_ha: área em HECTARES, como número, SE a mensagem mencionar. Converta se vier em alqueire (1 alqueire paulista = 2.42 ha) ou em m² (10000 m² = 1 ha).
- talhao_nome: nome do talhão, lote, gleba ou área de plantio, SE a mensagem mencionar.

Campo ausente na mensagem = deixe de fora. É melhor omitir do que preencher errado: o nome vai virar o cadastro oficial do produtor.`

// extracaoOnboarding é o formato pedido ao LLM: além dos dados em si, carrega
// a decisão de intenção (eh_cadastro) que impede uma pergunta de domínio
// qualquer de ser tratada como se fosse dado de cadastro.
type extracaoOnboarding struct {
	EhCadastro bool `json:"eh_cadastro" jsonschema:"required,description=true somente se a mensagem está fornecendo dados pessoais para criar um cadastro; false se for pergunta, dúvida, saudação ou qualquer outro assunto"`
	DadosCadastro
}

// extrairDadosCadastro roda a extração estruturada sobre a mensagem. O
// segundo retorno indica se o LLM entendeu a mensagem como dado de cadastro
// (ao contrário de uma pergunta de domínio, saudação etc.) — só nesse caso
// os dados devem ser usados para avançar o cadastro.
func extrairDadosCadastro(ctx context.Context, llmClient LLMClient, texto string) (DadosCadastro, bool, error) {
	var vazio DadosCadastro

	raw, err := schema.Reflect[extracaoOnboarding]()
	if err != nil {
		return vazio, false, fmt.Errorf("onboarding: schema: %w", err)
	}
	esquema, err := schema.ForOpenRouter(raw, "dados_cadastro")
	if err != nil {
		return vazio, false, fmt.Errorf("onboarding: schema openrouter: %w", err)
	}

	resp, err := llmClient.GenerateContent(ctx, llm.ContentRequest{
		SystemInstruction: promptExtracaoCadastro,
		History: []llm.MensagemAgnostica{
			{Role: llm.PapelUser, Content: texto},
		},
		Schema: esquema,
	})
	if err != nil {
		return vazio, false, fmt.Errorf("onboarding: extração: %w", err)
	}

	dados, err := schema.DecodeAndValidate[extracaoOnboarding](resp.Texto)
	if err != nil {
		return vazio, false, fmt.Errorf("onboarding: decode: %w", err)
	}
	return dados.DadosCadastro, dados.EhCadastro, nil
}

// resumoCadastro monta o texto de conferência mostrado antes de gravar.
func resumoCadastro(d DadosCadastro) string {
	return fmt.Sprintf(
		"Confere pra mim se está certo:\n\n👤 *Nome:* %s\n\nPosso cadastrar assim? Os dados da propriedade a gente completa depois.",
		d.Nome)
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
	llmClient LLMClient,
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

	// ── Cancelamento Genérico ───────────────────────────────────────────────
	if strings.ToUpper(strings.TrimSpace(body)) == "CANCELAR" {
		historyManager.SetFSMState(phone, "", nil, nil)
		sendFeedback(sbClient, wpClient, ttsClient, msg.From, "Operação cancelada. Mande um 'Oi' quando quiser recomeçar.", respondWithAudio)
		return ProcessResult{Success: true, Reason: "cancelado"}, true
	}

	// ── OTP E-mail (Aguardando Código) ──────────────────────────────────────
	if estado == StateAguardandoOTPEmail {
		token := strings.TrimSpace(body)
		email, _ := ctxFSM["email"].(string)

		user, err := sbClient.VerifyEmailOTP(email, token)
		if err != nil {
			log.Printf("⚠️ [Onboarding] OTP inválido para %s: %v", email, err)
			sendFeedback(sbClient, wpClient, ttsClient, msg.From, "O código parece incorreto ou expirou. Tente novamente ou digite CANCELAR.", respondWithAudio)
			return ProcessResult{Success: false, Reason: "otp_invalido"}, true
		}

		err = sbClient.LinkPhoneToUser(user.ID, phone)
		if err != nil {
			log.Printf("⚠️ [Onboarding] Erro ao vincular telefone %s: %v", phone, err)
			sendFeedback(sbClient, wpClient, ttsClient, msg.From, "Erro interno ao vincular conta. Tente de novo mais tarde.", respondWithAudio)
			return ProcessResult{Success: false, Reason: "erro_vincular"}, true
		}

		historyManager.SetFSMState(phone, "", nil, nil)
		sendFeedback(sbClient, wpClient, ttsClient, msg.From, "✅ Pronto! Seu WhatsApp foi vinculado à sua conta com sucesso. Pode começar a usar!", respondWithAudio)
		return ProcessResult{Success: true, Reason: "conta_vinculada"}, true
	}

	// ── E-mail (Aguardando E-mail) ──────────────────────────────────────────
	if estado == StateAguardandoEmail {
		email := strings.ToLower(strings.TrimSpace(body))
		if !strings.Contains(email, "@") {
			sendFeedback(sbClient, wpClient, ttsClient, msg.From, "Isso não parece um e-mail válido. Por favor, digite seu e-mail do site:", respondWithAudio)
			return ProcessResult{Success: false, Reason: "email_invalido"}, true
		}

		err := sbClient.SendEmailOTP(email)
		if err != nil {
			log.Printf("⚠️ [Onboarding] Falha ao enviar OTP para %s: %v", email, err)
		}
		historyManager.SetFSMState(phone, StateAguardandoOTPEmail, map[string]interface{}{"email": email}, nil)
		sendFeedback(sbClient, wpClient, ttsClient, msg.From, "Enviei um código de 6 dígitos para o seu e-mail (se ele existir no nosso sistema). Por favor, digite os 6 números aqui:", respondWithAudio)
		return ProcessResult{Success: true, Reason: "otp_enviado"}, true
	}

	// ── Pergunta Conta Existente ────────────────────────────────────────────
	if estado == StatePerguntaContaExistente {
		if ehConfirmacao(body) {
			historyManager.SetFSMState(phone, StateAguardandoEmail, nil, nil)
			sendFeedback(sbClient, wpClient, ttsClient, msg.From, "Legal! Me diga qual é o e-mail que você usou no site para eu te enviar um código de segurança.", respondWithAudio)
			return ProcessResult{Success: true, Reason: "iniciou_vinculo"}, true
		} else if ehNegacao(body) {
			historyManager.SetFSMState(phone, StateAguardandoCadastro, nil, nil)
			sendFeedback(sbClient, wpClient, ttsClient, msg.From, "Perfeito, vou criar o seu agora mesmo. Me diz só o seu *nome completo* pra gente começar:", respondWithAudio)
			return ProcessResult{Success: true, Reason: "iniciou_novo_cadastro"}, true
		} else {
			if pareceConterDados(body) {
				historyManager.SetFSMState(phone, StateAguardandoCadastro, nil, nil)
			} else {
				sendFeedback(sbClient, wpClient, ttsClient, msg.From, "Você já tem um cadastro feito por e-mail no nosso site? (Responda SIM ou NÃO)", respondWithAudio)
				return ProcessResult{Success: true, Reason: "pergunta_nao_respondida"}, true
			}
		}
	}

	// ── Primeiro contato ────────────────────────────────────────────────────
	// Uma saudação curta não carrega dados de cadastro; gastar uma chamada de
	// LLM nela seria desperdício. Só tenta extrair se a mensagem tiver
	// substância ou se já estivermos no meio do cadastro.
	if estado == "" && !pareceConterDados(body) {
		historyManager.SetFSMState(phone, StatePerguntaContaExistente, nil, nil)
		sendFeedback(sbClient, wpClient, ttsClient, msg.From, msgBoasVindas, respondWithAudio)
		return ProcessResult{Success: true, Reason: "onboarding_iniciado"}, true
	}

	// ── Extração ────────────────────────────────────────────────────────────
	dados, ehCadastro, err := extrairDadosCadastro(ctx, llmClient, body)
	if err != nil {
		log.Printf("⚠️ [Onboarding] Falha ao extrair dados de %s: %v", phone, err)
		historyManager.SetFSMState(phone, StateAguardandoCadastro, nil, nil)
		sendFeedback(sbClient, wpClient, ttsClient, msg.From,
			"Não consegui entender os dados. Pode mandar de novo, com nome, propriedade, hectares e talhão?", respondWithAudio)
		return ProcessResult{Success: false, Reason: "onboarding_extracao_falhou"}, true
	}

	if !ehCadastro {
		if estado == StateAguardandoCadastro {
			// Já pedimos o nome explicitamente; a mensagem não é dado de
			// cadastro (pode ser uma dúvida, um desvio de assunto etc.).
			sendFeedback(sbClient, wpClient, ttsClient, msg.From,
				"Não consegui identificar seu nome nessa mensagem. Pode me mandar só o seu nome completo?", respondWithAudio)
			return ProcessResult{Success: true, Reason: "onboarding_nao_e_cadastro"}, true
		}
		// Primeiro contato: a heurística achou que parecia cadastro, mas não
		// era (ex.: uma pergunta técnica transcrita de áudio). Segue o fluxo
		// normal perguntando se já existe conta por e-mail, em vez de tentar
		// registrar dados que não foram de fato fornecidos.
		historyManager.SetFSMState(phone, StatePerguntaContaExistente, nil, nil)
		sendFeedback(sbClient, wpClient, ttsClient, msg.From, msgBoasVindas, respondWithAudio)
		return ProcessResult{Success: true, Reason: "onboarding_pergunta_conta"}, true
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

	_, err = sbClient.CreateBasicProfile(usuario.ID, dados.Nome)
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

	tokenURL := ""
	tokenString, errJwt := supabase.GenerateOnboardingJWT(usuario.ID, phone)
	if errJwt != nil {
		log.Printf("⚠️ [Onboarding] Falha ao gerar JWT para %s: %v", phone, errJwt)
	} else {
		baseURL := os.Getenv("FRONTEND_URL")
		if baseURL == "" {
			baseURL = "http://localhost:5173"
		}
		tokenURL = fmt.Sprintf("\n\nPara preencher os detalhes da sua propriedade no mapa, acesse o link seguro abaixo. Ele já está vinculado à sua conta:\n🔗 %s/onboarding?token=%s", baseURL, tokenString)
	}

	sendFeedback(sbClient, wpClient, ttsClient, msg.From, fmt.Sprintf(
		"✅ *Cadastro criado, %s!* Pode começar a usar por aqui.%s",
		primeiroNome(dados.Nome), tokenURL), respondWithAudio)

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
