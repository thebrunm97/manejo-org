package proactivity

import (
	"context"
	"fmt"
	"log"

	"github.com/robfig/cron/v3"
	"github.com/thebrunm97/pmo-bot-go/internal/llm"
	"github.com/thebrunm97/pmo-bot-go/internal/ports"
	"github.com/thebrunm97/pmo-bot-go/internal/supabase"
)

// ProactiveEngine gerencia as rotinas em background para automação proativa (PMO Autônomo)
type ProactiveEngine struct {
	cron     *cron.Cron
	db       *supabase.Client
	evoAPI   ports.MessageSender
	llmAgent llm.LLMProvider
}

// NewProactiveEngine inicializa o motor de proatividade
func NewProactiveEngine(db *supabase.Client, evo ports.MessageSender, llmAgent llm.LLMProvider) *ProactiveEngine {
	// Inicializa o cron usando o timezone local da aplicação
	c := cron.New()
	return &ProactiveEngine{
		cron:     c,
		db:       db,
		evoAPI:   evo,
		llmAgent: llmAgent,
	}
}

// Start agenda e inicia as rotinas
func (e *ProactiveEngine) Start() {
	// Agenda a rotina diária para 06:00
	_, err := e.cron.AddFunc("0 6 * * *", e.DailyCheckRoutine)
	if err != nil {
		log.Fatalf("Erro ao agendar Cron: %v", err)
	}
	e.cron.Start()
	log.Println("✅ ProactiveEngine: Cron scheduler iniciado (06:00 diariamente).")
}

// DailyCheckRoutine executa as verificações diárias da fazenda
func (e *ProactiveEngine) DailyCheckRoutine() {
	ctx := context.Background()
	log.Println("🔄 Executando DailyCheckRoutine...")

	// 1. Busca as tarefas pendentes na base de dados
	pendingTasks, err := e.db.GetPendingCulturalTasks(ctx)
	if err != nil {
		log.Printf("❌ Erro ao buscar tarefas pendentes: %v", err)
		return
	}
	
	if len(pendingTasks) == 0 {
		log.Println("✅ Nenhuma tarefa pendente para hoje.")
		return
	}

	log.Printf("📋 Encontradas %d tarefas pendentes. Processando...", len(pendingTasks))

	systemPrompt := `És um agrônomo amigável e direto. O teu objetivo é avisar o produtor sobre uma tarefa pendente. 
Regras:
1. Sê curto e direto.
2. Usa um tom prestativo e amigável.
3. Não uses formatação pesada (asteriscos, negrito excessivo), é para WhatsApp.
4. Fala qual é a tarefa, onde (talhão) e incentiva a realização.`

	// 2. Itera sobre as tarefas e processa o envio
	for _, task := range pendingTasks {
		// Ignora tarefas sem telefone
		if task.PhoneNumber == "" {
			continue
		}

		userPrompt := fmt.Sprintf("Tarefa: %s, Local: %s, Agendada para: %s", task.TaskName, task.Location, task.ScheduledDate)
		
		// Humaniza a notificação via LLM
		payloadMsg, _, err := e.llmAgent.AskSimple(ctx, userPrompt, systemPrompt)
		if err != nil {
			log.Printf("❌ Erro ao gerar mensagem proativa para PMO %d: %v", task.PmoID, err)
			continue
		}

		// 3. Dispara a mensagem via Evolution API
		err = e.evoAPI.SendMessage(task.PhoneNumber, payloadMsg)
		if err != nil {
			log.Printf("❌ Erro ao enviar WhatsApp proativo para %s: %v", task.PhoneNumber, err)
		} else {
			log.Printf("✅ Mensagem proativa enviada com sucesso para %s", task.PhoneNumber)
		}
	}
}
