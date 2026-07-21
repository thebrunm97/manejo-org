package supabase

import (
	"context"
	"encoding/json"
	"fmt"
	"net/http"
	"time"
)

// PendingTask representa uma tarefa pendente para o produtor.
type PendingTask struct {
	ID             string `json:"id"`
	PmoID          int64  `json:"pmo_id"`
	PhoneNumber    string `json:"telefone"` // Assumido estar presente na view/tabela
	TaskName       string `json:"nome_tarefa"`
	Location       string `json:"local"` // ex: Talhão 1
	ScheduledDate  string `json:"data_agendada"`
}

// GetPendingCulturalTasks busca tarefas que devem ser executadas hoje ou estão atrasadas.
// Utiliza PostgREST para consultar a tabela "cronograma" (ou view equivalente).
func (c *Client) GetPendingCulturalTasks(ctx context.Context) ([]PendingTask, error) {
	// Filtra tarefas agendadas para hoje ou datas anteriores (atrasadas)
	today := time.Now().Format("2006-01-02")
	url := fmt.Sprintf("%s/rest/v1/cronograma?select=id,pmo_id,telefone,nome_tarefa,local,data_agendada&data_agendada=lte.%s", c.config.URL, today)

	req, err := http.NewRequestWithContext(ctx, http.MethodGet, url, nil)
	if err != nil {
		return nil, err
	}
	req.Header.Set("apikey", c.config.Key)
	req.Header.Set("Authorization", "Bearer "+c.config.Key)
	req.Header.Set("Content-Type", "application/json")

	resp, err := c.httpClient.Do(req)
	if err != nil {
		return nil, err
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		return nil, fmt.Errorf("erro ao buscar tarefas pendentes: status %d", resp.StatusCode)
	}

	var tasks []PendingTask
	if err := json.NewDecoder(resp.Body).Decode(&tasks); err != nil {
		return nil, err
	}

	return tasks, nil
}
