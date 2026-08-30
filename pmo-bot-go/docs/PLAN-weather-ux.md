# PLAN-weather-ux

## 🎯 Objetivo
Definir a estratégia de UX e a integração visual/funcional da Previsão do Tempo no bot e/ou no frontend.

## 🛑 Resumo das Decisões Estratégicas (UX & Integração)
As decisões de UX e integração foram aprovadas com as seguintes diretrizes:

1. **Obtenção da Localização (Atrito Zero):** A tool `consultar_previsao_tempo` utiliza o `propriedade_id` (injetado via contexto) para buscar a cidade/estado ou latitude/longitude diretamente do banco de dados (Supabase). O usuário só é questionado caso o cadastro esteja vazio.
2. **Apresentação dos Dados:** O foco deste MVP é **100% WhatsApp**. A resposta deve ser textual, amigável, direta, recheada de emojis (☀️, 🌧️, 🌡️) e formatada para leitura rápida no campo.
3. **Reatividade:** A integração funcionará de forma reativa. O bot responde sobre o clima quando questionado ou contextualiza o clima quando uma tentativa de registro de manejo é feita. Alertas proativos (background/CRON) ficam para a Fase 2.
4. **Integração PMO (Killer Feature):** A inteligência agronômica é central. Como a previsão retorna para o contexto do LLM, o bot usará o clima para correlacionar com a intenção do produtor (ex: alertar para adiar pulverização se houver previsão de chuva).
5. **Dados Agrícolas:** Variáveis cruas (Evapotranspiração, Índice UV, Umidade) são injetadas no contexto do LLM. O orquestrador LLM é instruído a "traduzir" esses dados para dicas de manejo quando pertinentes (ex: "A evapotranspiração está alta, adiante a irrigação").

## 🛠️ Agentes Envolvidos (Orchestration Phase 1)
- **project-planner:** Responsável por guiar a decisão de UX e montar este plano.
- (Após aprovação, na Fase 2 acionaremos `frontend-specialist`, `backend-specialist` e `test-engineer`).

## 📋 Tarefas Futuras (Pós-Decisão)
- [ ] Definir os limites de alertas proativos.
- [ ] Implementar integração do bot com os componentes de UI (se aplicável).
- [ ] Testar cenários de variação climática.
