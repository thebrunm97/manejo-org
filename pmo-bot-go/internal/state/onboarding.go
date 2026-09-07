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
	"unicode"

	"github.com/thebrunm97/pmo-bot-go/internal/history"
	"github.com/thebrunm97/pmo-bot-go/internal/llm"
	"github.com/thebrunm97/pmo-bot-go/internal/llm/schema"
	"github.com/thebrunm97/pmo-bot-go/internal/ports"
	"github.com/thebrunm97/pmo-bot-go/internal/supabase"
	"github.com/thebrunm97/pmo-bot-go/internal/utils"
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

const promptExtracaoCadastro = `Você extrai dados de cadastro de produtores rurais a partir de mensagens de WhatsApp.

Nomes de pessoas podem ser de qualquer origem — brasileira, árabe, japonesa, europeia, indígena. Não descarte um nome por ele não "soar brasileiro".

Primeiro decida "eh_cadastro": a mensagem está de fato fornecendo dados pessoais para criar um cadastro (nome do produtor, propriedade, área, talhão)? Perguntas técnicas, dúvidas sobre produção/manejo, saudações, pedidos de ajuda ou qualquer assunto que não seja "aqui estão meus dados" NÃO são cadastro — marque eh_cadastro=false e deixe nome vazio, mesmo que a frase contenha palavras parecidas com nomes próprios.

Só quando eh_cadastro=true extraia os campos abaixo. Extraia APENAS o que estiver explicitamente na mensagem. Nunca invente, nunca complete com suposição:
- nome: nome completo da PESSOA. Não confunda com o nome da propriedade.
- propriedade_nome: nome do sítio/fazenda/chácara, SE a mensagem mencionar. Não confunda com o nome da pessoa nem com o do talhão.
- area_ha: área em HECTARES, como número, SE a mensagem mencionar. Converta se vier em alqueire (1 alqueire paulista = 2.42 ha) ou em m² (10000 m² = 1 ha).
- talhao_nome: nome do talhão, lote, gleba ou área de plantio, SE a mensagem mencionar.

Campo ausente na mensagem = deixe de fora. É melhor omitir do que preencher errado: o nome vai virar o cadastro oficial do produtor.`

// promptExtracaoNomeDirecionado vale para o momento em que o bot ACABOU de
// pedir o nome completo — e só para ele.
//
// O prompt genérico acima é enviesado contra o falso positivo de propósito:
// no primeiro contato, uma dúvida técnica jamais pode virar cadastro. Aqui o
// contexto é o oposto. A pergunta foi feita, a resposta esperada é um nome, e
// nada é gravado sem o SIM da tela de conferência. Manter o viés genérico
// nesta etapa foi o que prendeu um produtor em loop (ver comentário do
// fast-path em HandleOnboarding), então aqui a dúvida se resolve a favor de
// aceitar.
const promptExtracaoNomeDirecionado = `Você extrai o nome de um produtor rural a partir da resposta dele no WhatsApp.

CONTEXTO IMPORTANTE: o assistente acabou de perguntar "me diz só o seu nome completo". A mensagem que você recebe é a resposta direta a essa pergunta.

Portanto, marque eh_cadastro=true e extraia o nome sempre que a mensagem contiver algo que possa ser um nome de pessoa. Nomes podem ser de qualquer origem — brasileira, árabe, japonesa, europeia, indígena — e podem vir sem sobrenome, com sobrenome repetido, tudo minúsculo ou tudo junto. Nada disso desqualifica um nome.

Marque eh_cadastro=false APENAS se a mensagem for claramente uma dessas coisas:
- uma pergunta (sobre preço, funcionamento, manejo, qualquer assunto);
- uma recusa explícita em informar o nome;
- uma mudança de assunto sem nenhum nome junto.

Além do nome, extraia também, SE a mensagem mencionar explicitamente:
- propriedade_nome: nome do sítio/fazenda/chácara. Não confunda com o nome da pessoa.
- area_ha: área em HECTARES, como número. Converta se vier em alqueire (1 alqueire paulista = 2.42 ha) ou em m² (10000 m² = 1 ha).
- talhao_nome: nome do talhão, lote, gleba ou área de plantio.

Nunca invente esses campos extras: campo ausente na mensagem = deixe de fora.`

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
//
// nomeJaSolicitado diz se o bot já pediu o nome explicitamente. A extração é
// stateless — recebe só o texto da mensagem —, então sem esse sinal o modelo
// vê "Ahmed Mesalam" como duas palavras soltas, sem saber que são a resposta
// a uma pergunta. É essa cegueira que o parâmetro corrige, trocando o prompt
// por um que espera um nome.
func extrairDadosCadastro(ctx context.Context, llmClient LLMClient, texto string, nomeJaSolicitado bool) (DadosCadastro, bool, error) {
	var vazio DadosCadastro

	prompt := promptExtracaoCadastro
	if nomeJaSolicitado {
		prompt = promptExtracaoNomeDirecionado
	}

	raw, err := schema.Reflect[extracaoOnboarding]()
	if err != nil {
		return vazio, false, fmt.Errorf("onboarding: schema: %w", err)
	}
	esquema, err := schema.ForOpenRouter(raw, "dados_cadastro")
	if err != nil {
		return vazio, false, fmt.Errorf("onboarding: schema openrouter: %w", err)
	}

	resp, err := llmClient.GenerateContent(ctx, llm.ContentRequest{
		SystemInstruction: prompt,
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
	msg ports.IncomingEnvelope,
	phone string,
	body string,
	respondWithAudio bool,
	sbClient *supabase.Client,
	wpClient ports.ChannelSender,
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
			sendFeedback(sbClient, wpClient, ttsClient, msg.ConversationID, msg.From,
				"Sem problema! Me manda os dados de novo, do jeito certo desta vez. 🙂", respondWithAudio)
			return ProcessResult{Success: true, Reason: "onboarding_corrigir"}, true
		}

		if ehConfirmacao(body) {
			dados, ok := dadosDoContexto(ctxFSM)
			if !ok {
				// Estado perdido (restart) ou corrompido: reextrai em vez de
				// gravar algo que não foi conferido.
				historyManager.SetFSMState(phone, StateAguardandoCadastro, nil, nil)
				sendFeedback(sbClient, wpClient, ttsClient, msg.ConversationID, msg.From,
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
		sendFeedback(sbClient, wpClient, ttsClient, msg.ConversationID, msg.From, "Operação cancelada. Mande um 'Oi' quando quiser recomeçar.", respondWithAudio)
		return ProcessResult{Success: true, Reason: "cancelado"}, true
	}

	// ── OTP E-mail (Aguardando Código) ──────────────────────────────────────
	if estado == StateAguardandoOTPEmail {
		token := strings.TrimSpace(body)
		email, _ := ctxFSM["email"].(string)

		user, err := sbClient.VerifyEmailOTP(email, token)
		if err != nil {
			log.Printf("⚠️ [Onboarding] OTP inválido para %s: %v", email, err)
			sendFeedback(sbClient, wpClient, ttsClient, msg.ConversationID, msg.From, "O código parece incorreto ou expirou. Tente novamente ou digite CANCELAR.", respondWithAudio)
			return ProcessResult{Success: false, Reason: "otp_invalido"}, true
		}

		err = sbClient.LinkPhoneToUser(user.ID, phone)
		if err != nil {
			log.Printf("⚠️ [Onboarding] Erro ao vincular telefone %s: %v", phone, err)
			sendFeedback(sbClient, wpClient, ttsClient, msg.ConversationID, msg.From, "Erro interno ao vincular conta. Tente de novo mais tarde.", respondWithAudio)
			return ProcessResult{Success: false, Reason: "erro_vincular"}, true
		}

		// Garante que a tabela 'profiles' também reflita a mudança, pois o roteador a utiliza
		err = sbClient.UpdateProfilePhone(user.ID, phone)
		if err != nil {
			if strings.Contains(err.Error(), "telefone_em_uso") {
				log.Printf("⚠️ [Onboarding] Colisão de perfil no OTP para %s: %v", phone, err)
				sendFeedback(sbClient, wpClient, ttsClient, msg.ConversationID, msg.From, "Este número de WhatsApp já está vinculado a outro perfil. Desvincule a conta anterior ou contate o suporte.", respondWithAudio)
				return ProcessResult{Success: false, Reason: "telefone_em_uso"}, true
			}
			log.Printf("⚠️ [Onboarding] Erro ao atualizar perfil para %s: %v", phone, err)
			sendFeedback(sbClient, wpClient, ttsClient, msg.ConversationID, msg.From, "Erro interno ao completar o vínculo. Tente de novo mais tarde.", respondWithAudio)
			return ProcessResult{Success: false, Reason: "erro_vincular_perfil"}, true
		}

		historyManager.SetFSMState(phone, "", nil, nil)
		sendFeedback(sbClient, wpClient, ttsClient, msg.ConversationID, msg.From, "✅ Pronto! Seu WhatsApp foi vinculado à sua conta com sucesso. Pode começar a usar!", respondWithAudio)
		return ProcessResult{Success: true, Reason: "conta_vinculada"}, true
	}

	// ── E-mail (Aguardando E-mail) ──────────────────────────────────────────
	if estado == StateAguardandoEmail {
		email := strings.ToLower(strings.TrimSpace(body))
		if !strings.Contains(email, "@") {
			sendFeedback(sbClient, wpClient, ttsClient, msg.ConversationID, msg.From, "Isso não parece um e-mail válido. Por favor, digite seu e-mail do site:", respondWithAudio)
			return ProcessResult{Success: false, Reason: "email_invalido"}, true
		}

		err := sbClient.SendEmailOTP(email)
		if err != nil {
			log.Printf("⚠️ [Onboarding] Falha ao enviar OTP para %s: %v", email, err)
		}
		historyManager.SetFSMState(phone, StateAguardandoOTPEmail, map[string]interface{}{"email": email}, nil)
		sendFeedback(sbClient, wpClient, ttsClient, msg.ConversationID, msg.From, "Enviei um código de 6 dígitos para o seu e-mail (se ele existir no nosso sistema). Por favor, digite os 6 números aqui:", respondWithAudio)
		return ProcessResult{Success: true, Reason: "otp_enviado"}, true
	}

	// ── Pergunta Conta Existente ────────────────────────────────────────────
	if estado == StatePerguntaContaExistente {
		if ehConfirmacao(body) {
			historyManager.SetFSMState(phone, StateAguardandoEmail, nil, nil)
			sendFeedback(sbClient, wpClient, ttsClient, msg.ConversationID, msg.From, "Legal! Me diga qual é o e-mail que você usou no site para eu te enviar um código de segurança.", respondWithAudio)
			return ProcessResult{Success: true, Reason: "iniciou_vinculo"}, true
		} else if ehNegacao(body) {
			historyManager.SetFSMState(phone, StateAguardandoCadastro, nil, nil)
			sendFeedback(sbClient, wpClient, ttsClient, msg.ConversationID, msg.From, "Perfeito, vou criar o seu agora mesmo. Me diz só o seu *nome completo* pra gente começar:", respondWithAudio)
			return ProcessResult{Success: true, Reason: "iniciou_novo_cadastro"}, true
		} else {
			if pareceConterDados(body) {
				historyManager.SetFSMState(phone, StateAguardandoCadastro, nil, nil)
			} else {
				sendFeedback(sbClient, wpClient, ttsClient, msg.ConversationID, msg.From, "Você já tem um cadastro feito por e-mail no nosso site? (Responda SIM ou NÃO)", respondWithAudio)
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
		sendFeedback(sbClient, wpClient, ttsClient, msg.ConversationID, msg.From, msgBoasVindas, respondWithAudio)
		return ProcessResult{Success: true, Reason: "onboarding_iniciado"}, true
	}

	// ── Fast-path: resposta direta à pergunta do nome ───────────────────────
	//
	// Incidente em produção (6/9): o bot perguntou "me diz só o seu nome
	// completo", o produtor respondeu "Ahmed Mesalam" e o classificador
	// eh_cadastro devolveu false. Ele tentou mais duas vezes, variando a
	// grafia, e recebeu a mesma recusa — um loop sem saída, porque toda
	// tentativa correta produzia a mesma classificação errada.
	//
	// Uma mensagem com cara de nome puro, nesta etapa, nem chega ao LLM:
	// responde na hora, não gasta cota e não depende de o modelo achar que o
	// nome "parece" de produtor rural brasileiro. O risco de aceitar demais é
	// baixo porque a gravação ainda depende do SIM de conferência.
	if estado == StateAguardandoCadastro && pareceNomeProprio(body) {
		dados := DadosCadastro{Nome: strings.TrimSpace(body)}
		return pedirConfirmacao(phone, msg, dados, resumoCadastro(dados), "onboarding_nome_direto",
			respondWithAudio, sbClient, wpClient, ttsClient, historyManager), true
	}

	// ── Extração ────────────────────────────────────────────────────────────
	dados, ehCadastro, err := extrairDadosCadastro(ctx, llmClient, body, estado == StateAguardandoCadastro)
	if err != nil {
		log.Printf("⚠️ [Onboarding] Falha ao extrair dados de %s: %v", phone, err)
		historyManager.SetFSMState(phone, StateAguardandoCadastro, nil, nil)
		sendFeedback(sbClient, wpClient, ttsClient, msg.ConversationID, msg.From,
			"Não consegui entender os dados. Pode mandar de novo, com nome, propriedade, hectares e talhão?", respondWithAudio)
		return ProcessResult{Success: false, Reason: "onboarding_extracao_falhou"}, true
	}

	if !ehCadastro {
		if estado == StateAguardandoCadastro {
			// Já pedimos o nome explicitamente; a mensagem não é dado de
			// cadastro (pode ser uma dúvida, um desvio de assunto etc.).
			tentativas := tentativasDoContexto(ctxFSM) + 1

			// Escape hatch. Repetir a mesma frase indefinidamente foi
			// exatamente o que travou um produtor em produção: ele não tinha
			// como saber o que mudar, porque não havia nada de errado com a
			// resposta dele. Na segunda recusa seguida, paramos de insistir e
			// oferecemos o texto cru como proposta de nome — quem decide é o
			// produtor, no SIM/NÃO, e nada é gravado sem esse aceite.
			if tentativas >= 2 && strings.TrimSpace(body) != "" {
				log.Printf("⚠️ [Onboarding] Extração recusou %d vezes seguidas para %s; oferecendo o texto cru como nome", tentativas, phone)
				dados := DadosCadastro{Nome: strings.TrimSpace(body)}
				resumo := fmt.Sprintf(
					"Só pra eu não errar: quer que eu cadastre o seu nome exatamente como *%s*?",
					dados.Nome)
				return pedirConfirmacao(phone, msg, dados, resumo, "onboarding_nome_ultima_tentativa",
					respondWithAudio, sbClient, wpClient, ttsClient, historyManager), true
			}

			historyManager.SetFSMState(phone, StateAguardandoCadastro, contextoDeTentativas(tentativas), nil)
			sendFeedback(sbClient, wpClient, ttsClient, msg.ConversationID, msg.From,
				"Não consegui identificar seu nome nessa mensagem. Pode me mandar só o seu nome completo?", respondWithAudio)
			return ProcessResult{Success: true, Reason: "onboarding_nao_e_cadastro"}, true
		}
		// Primeiro contato: a heurística achou que parecia cadastro, mas não
		// era (ex.: uma pergunta técnica transcrita de áudio). Segue o fluxo
		// normal perguntando se já existe conta por e-mail, em vez de tentar
		// registrar dados que não foram de fato fornecidos.
		historyManager.SetFSMState(phone, StatePerguntaContaExistente, nil, nil)
		sendFeedback(sbClient, wpClient, ttsClient, msg.ConversationID, msg.From, msgBoasVindas, respondWithAudio)
		return ProcessResult{Success: true, Reason: "onboarding_pergunta_conta"}, true
	}

	if !dados.completo() {
		historyManager.SetFSMState(phone, StateAguardandoCadastro, contextoDosDados(dados), nil)
		faltam := dados.faltantes()
		sendFeedback(sbClient, wpClient, ttsClient, msg.ConversationID, msg.From,
			fmt.Sprintf("Quase lá! Ainda preciso de: %s.", strings.Join(faltam, ", ")), respondWithAudio)
		return ProcessResult{Success: true, Reason: "onboarding_incompleto"}, true
	}

	// ── Conferência ─────────────────────────────────────────────────────────
	return pedirConfirmacao(phone, msg, dados, resumoCadastro(dados), "onboarding_aguardando_confirmacao",
		respondWithAudio, sbClient, wpClient, ttsClient, historyManager), true
}

// pedirConfirmacao guarda os dados extraídos e manda a tela de conferência.
//
// O texto do resumo vem de fora porque nem todo caminho até aqui tem a mesma
// confiança no que extraiu: o fluxo normal afirma ("confere pra mim"), e o
// escape hatch pergunta ("quer que eu cadastre exatamente assim?"). O que os
// dois compartilham — e o que torna seguro ser permissivo antes deste ponto —
// é que nada é gravado sem o SIM.
func pedirConfirmacao(
	phone string,
	msg ports.IncomingEnvelope,
	dados DadosCadastro,
	resumo string,
	reason string,
	respondWithAudio bool,
	sbClient *supabase.Client,
	wpClient ports.ChannelSender,
	ttsClient ports.Synthesizer,
	historyManager *history.Manager,
) ProcessResult {
	historyManager.SetFSMState(phone, StateConfirmandoCadastro, contextoDosDados(dados), nil)

	if wpClient != nil {
		// Título/Descrição/Rodapé são o trio que OutboundEnvelope reserva para
		// botões; o corpo da conferência vai em Description, não em Text.
		env := ports.OutboundEnvelope{
			ConversationID: msg.ConversationID,
			To:             msg.From,
			Type:           ports.OutboundTypeButtons,
			Title:          "Confirmar cadastro",
			Description:    resumo,
			Footer:         "É só tocar em SIM ou NÃO",
			Buttons: []map[string]string{
				{"id": "SIM", "title": "SIM"},
				{"id": "NÃO", "title": "NÃO"},
			},
		}


		if err := wpClient.Send(context.Background(), env); err != nil {
			// Botão é enfeite, não requisito: se o provedor recusar, o texto
			// sozinho já permite responder "sim".
			log.Printf("⚠️ [Onboarding] Botões indisponíveis, seguindo em texto: %v", err)
			sendFeedback(sbClient, wpClient, ttsClient, msg.ConversationID, msg.From, resumo+"\n\nResponda *SIM* ou *NÃO*.", respondWithAudio)
		}
	}

	return ProcessResult{Success: true, Reason: reason}
}

// finalizarCadastro cria o usuário e grava o cadastro.
func finalizarCadastro(
	phone string,
	msg ports.IncomingEnvelope,
	dados DadosCadastro,
	respondWithAudio bool,
	sbClient *supabase.Client,
	wpClient ports.ChannelSender,
	ttsClient ports.Synthesizer,
	historyManager *history.Manager,
) ProcessResult {
	usuario, err := sbClient.CreateAuthUserByPhone(phone, map[string]interface{}{
		"nome":   dados.Nome,
		"origem": "whatsapp_onboarding",
	})
	if err != nil {
		log.Printf("❌ [Onboarding] Falha ao criar usuário para %s: %v", phone, err)
		sendFeedback(sbClient, wpClient, ttsClient, msg.ConversationID, msg.From,
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
		sendFeedback(sbClient, wpClient, ttsClient, msg.ConversationID, msg.From,
			"Tive um problema para salvar seu cadastro. Pode tentar de novo daqui a pouco?", respondWithAudio)
		return ProcessResult{Success: false, Reason: "onboarding_rpc_falhou"}
	}

	historyManager.ClearFSMState(phone)

	tokenURL := ""
	tokenString, errOpaque := sbClient.GenerateOpaqueToken(usuario.ID)
	if errOpaque != nil {
		log.Printf("⚠️ [Onboarding] Falha ao gerar Opaque Token para %s: %v", phone, errOpaque)
	} else {
		baseURL := os.Getenv("FRONTEND_URL")
		if baseURL == "" {
			baseURL = "http://localhost:5173"
		}
		tokenURL = fmt.Sprintf("\n\nPara preencher os detalhes da sua propriedade no mapa, acesse o link seguro abaixo. Ele já está vinculado à sua conta:\n🔗 %s/auth/callback?code=%s", baseURL, tokenString)
	}

	sendFeedback(sbClient, wpClient, ttsClient, msg.ConversationID, msg.From, fmt.Sprintf(
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

// saudacoesOnboarding espelha a lista do greeting guard em fsm.go. Duplicar
// oito palavras é mais barato do que acoplar os dois arquivos: o guard existe
// para não gastar LLM com "oi", e esta lista para não cadastrar ninguém
// chamado "Bom dia".
var saudacoesOnboarding = map[string]bool{
	"oi": true, "ola": true, "bom dia": true, "boa tarde": true,
	"boa noite": true, "eai": true, "hello": true, "hi": true,
	"tudo bem": true, "obrigado": true, "obrigada": true, "valeu": true,
}

// palavrasQueNaoIniciamNome corta as recusas óbvias que passariam pelo filtro
// de formato por serem só letras — "quanto custa", "nao sei", "quero ajuda".
var palavrasQueNaoIniciamNome = map[string]bool{
	"quanto": true, "quando": true, "onde": true, "como": true, "qual": true,
	"quem": true, "porque": true, "por": true, "quero": true, "preciso": true,
	"tenho": true, "sou": true, "voce": true, "vc": true, "ajuda": true,
	"nao": true, "sim": true, "ainda": true, "esqueci": true, "cadastro": true,
}

// pareceNomeProprio diz se a mensagem tem forma de nome de pessoa, para o bot
// aceitá-la sem consultar o LLM quando acabou de pedir o nome.
//
// Erra deliberadamente para o lado de aceitar, e pode: o passo seguinte é a
// tela de conferência, então um falso positivo custa um "NÃO" do produtor,
// enquanto um falso negativo o devolve ao loop que este código existe para
// eliminar. O teste é de FORMATO, nunca de plausibilidade cultural — foi
// justamente julgar plausibilidade que rejeitou "Ahmed Mesalam" três vezes.
func pareceNomeProprio(texto string) bool {
	t := strings.TrimSpace(texto)
	if t == "" {
		return false
	}

	runas := []rune(t)
	if len(runas) < 2 || len(runas) > 60 {
		return false
	}

	campos := strings.Fields(t)
	if len(campos) > 5 {
		return false
	}

	// Só letras e os separadores que aparecem em nomes reais. Qualquer dígito,
	// vírgula ou pontuação de pergunta indica outra coisa — dados de
	// propriedade, uma dúvida, um endereço.
	for _, r := range runas {
		if unicode.IsLetter(r) || unicode.IsSpace(r) || r == '-' || r == '\'' || r == '’' {
			continue
		}
		return false
	}

	if ehConfirmacao(t) || ehNegacao(t) {
		return false
	}

	normalizado := utils.Normalize(t)
	if saudacoesOnboarding[normalizado] {
		return false
	}
	if palavrasQueNaoIniciamNome[utils.Normalize(campos[0])] {
		return false
	}

	return true
}

// tentativasDoContexto lê o contador de recusas seguidas na etapa do nome.
// Estado ausente ou corrompido conta como zero: perder o contador só custa
// uma repetição a mais, nunca um cadastro errado.
func tentativasDoContexto(ctxFSM map[string]interface{}) int {
	if ctxFSM == nil {
		return 0
	}
	// O contexto da FSM passa por JSON, então o número volta como float64.
	switch v := ctxFSM["tentativas_nome"].(type) {
	case float64:
		return int(v)
	case int:
		return v
	}
	return 0
}

// contextoDeTentativas monta o contexto que preserva o contador entre
// mensagens. Qualquer avanço do fluxo grava outro contexto e, com isso, zera
// a contagem — que é o comportamento desejado: o contador mede recusas
// *consecutivas*.
func contextoDeTentativas(n int) map[string]interface{} {
	return map[string]interface{}{"tentativas_nome": n}
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

