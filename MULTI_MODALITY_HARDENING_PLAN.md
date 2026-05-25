# Multi-Modality Hardening & E2E Validation Plan

## 1. Estratégia de Homologação
O objetivo desta fase é validar a consistência arquitetural, a resiliência do sistema e a robustez das regras de negócio (Zero-Trust) após a expansão para **Produção Paralela** e **Convencional**. 

A abordagem será progressiva, iniciando na camada de dados (Banco/RPCs), subindo para a interface de usuário (Frontend) e culminando nos fluxos conversacionais orientados a IA (Bot Go). A premissa central de validação é a **segurança contra adulterações no lado do cliente ("Frontend lying")** e a **preservação absoluta do histórico orgânico legado**.

---

## 2. Banco de Dados / Consistência (Zero-Trust)

- [ ] **Persistência da Modalidade:** Verificar se `modalidade_producao_enum` ('ORGANICO', 'CONVENCIONAL', 'TRANSICAO') está sendo persistido corretamente no nível correto da arquitetura (ex: tabela `talhoes`).
- [ ] **Contexto Histórico (Imutabilidade):** Validar se os registros operacionais (`caderno_campo`, `compras`, `harvest_logs`) estão salvando o "snapshot" da modalidade (`modalidade_aplicada`) no momento do evento, blindando o histórico caso a propriedade mude de modalidade no futuro.
- [ ] **Segurança das RPCs (Server-Side Validation):**
  - *Teste:* Simular uma requisição HTTP REST/Supabase direta, forçando o registro de Glifosato num talhão orgânico, burlando as validações do React.
  - *Critério de Êxito:* A RPC/Trigger deve ignorar o frontend, consultar a modalidade do talhão no banco e travar a inserção com erro explícito de violação de compliance.

---

## 3. Frontend (UX, Proteção de Rotas e Non-Regression)

- [ ] **Autenticação Agnostic:** Autenticar com um produtor 100% convencional (conta sem `pmo_ativo_id`).
  - *Critério:* Login bem-sucedido e AuthContext resolvido via `propriedade_ativa`.
- [ ] **Ocultamento Visual (Feature Flags):** Verificar a ausência das abas "Plano de Manejo (PMO)", "Auditoria" e afins para contas estritamente convencionais.
- [ ] **Proteção de Rota Direta (Anti-Bypass):**
  - *Teste:* Com um usuário convencional logado, tentar acessar diretamente a URL `/pmo/list` ou `/auditoria`.
  - *Critério de Êxito:* Redirecionamento forçado para o Dashboard ou tela de `403 Forbidden`. Oculamento visual não basta.
- [ ] **Não-Regressão Orgânica:**
  - *Teste:* Logar com um usuário orgânico legado.
  - *Critério de Êxito:* O sistema deve carregar o PMO ativo perfeitamente, sem quebra de relatórios antigos.

---

## 4. Backend / Bot Go (FSM, LLM e Context Isolation)

- [ ] **FSM: Bloqueio vs. Liberação Contextual:**
  - *Contexto Orgânico:* Envio de aplicação química deve gerar bloqueio imediato e alerta de conformidade.
  - *Contexto Convencional:* Mesmo envio deve gerar nota informativa de sucesso e permitir o registro.
- [ ] **Gestão de Ambiguidade (Produção Paralela):**
  - *Teste:* Propriedade mista. Produtor envia: *"Apliquei herbicida hoje cedo"*.
  - *Critério de Êxito:* O bot **NÃO** deve deduzir o talhão, barrar ou permitir cegamente. A FSM deve suspender o fluxo e perguntar: *"Notei que você tem produção paralela. Em qual talhão isso foi aplicado?"*.
- [ ] **Isolamento de Contexto Conversacional (Context Leakage):**
  - *Teste:* Em produção paralela, registrar insumo no talhão Convencional (sucesso). Na sequência imediata, dizer *"Ah, e também apliquei no talhão orgânico"*.
  - *Critério de Êxito:* O bot não pode reutilizar a permissão do fluxo anterior; deve reavaliar a nova modalidade e bloquear.
- [ ] **LLM: Extraction & Prompts Dinâmicos:**
  - Validar se a extração (Groq) identifica corretamente múltiplos talhões num único áudio.
  - Validar se o Agrônomo (Gemini) adapta o tom: sugere regenerativos para convencionais, mas proíbe sumariamente químicos para orgânicos baseado na IN 46.

---

## 5. Matriz de Cenários E2E Críticos

| ID | Perfil | Canal | Ação de Teste | Resultado Esperado | Status |
|---|---|---|---|---|---|
| **E2E-01** | 100% Convencional | Frontend | Acessar URL `/pmo/list` diretamente | Redirecionamento ou 403 (Proteção de Rota). | ✅ |
| **E2E-02** | 100% Convencional | Bot (Txt) | "Passei Roundup hoje cedo" | Sucesso. Retorna nota informativa e salva. | ⬜ |
| **E2E-03** | 100% Orgânico | Frontend | Submit Glifosato no formulário | Bloqueio client-side E server-side. | ✅ |
| **E2E-04** | Transição | Bot (Áudio) | "Apliquei NPK no canteiro 2" | Tratado com o mesmo rigor de Orgânico (Bloqueio). | ✅ |
| **E2E-05** | Produção Paralela | Frontend | Adultera payload via API p/ Orgânico | RPC bloqueia inserção no banco (Zero-Trust). | ⬜ |
| **E2E-06** | Produção Paralela | Bot (Txt) | "Passei veneno na divisa" | FSM entra em estado pendente: "Em qual talhão?" | ✅ |
| **E2E-07** | Produção Paralela | Bot (Txt) | "Ureia no Talhão 1 (Org) e 2 (Conv)" | FSM bloqueia a rotina inteira por segurança. | ⬜ |

---

## 6. Riscos Críticos e Mitigações (Architectural Hardening)

1. **Contaminação de Contexto Histórico:**
   - *Risco:* Auditorias antigas quebrarem se uma propriedade evoluir de Convencional para Orgânica.
   - *Mitigação:* O carimbo `modalidade_aplicada` (snapshot imutável) deve ser rigidamente inspecionado na tabela do Supabase durante os testes.
2. **Latência de Profiling (N+1 Queries):**
   - *Risco:* Lentidão no Bot Go devido a joins complexos (`talhoes!propriedade_id`) na inferência de modalidade.
   - *Mitigação:* Medir milissegundos adicionais no log do Step 1 da FSM. Adicionar cache em memória se necessário.
3. **Alucinação do Agrônomo (Over-Blocking):**
   - *Risco:* O LLM, treinado com viés orgânico, recusar-se a ajudar um produtor convencional de forma hostil.
   - *Mitigação:* Ajuste fino no system prompt dinâmico, forçando tom colaborativo e foco em eficiência agronômica quando a flag for `CONVENCIONAL`.

---

## 7. Critérios de Aceite para Merge (DoD)

- [ ] Cobertura aprovada (7/7 cenários da Matriz E2E executados com evidência).
- [ ] Confirmação documentada do teste de interceptação da "RPC Mentindo" (Zero-Trust validado).
- [ ] Confirmação documentada de bloqueio de rota via URL direta para contas convencionais.
- [ ] 0 quebras (Http 5xx) ou panics registrados no log Golang sob falhas simuladas de extração.
- [ ] Histórico legado de produtores orgânicos intacto e acessível.

---

## 8. Evidências Esperadas (Output da Homologação)

- `[ ]` Logs da interceptação de violação Zero-Trust pela RPC emitidos no Terminal / Supabase.
- `[ ]` Prints do terminal backend exemplificando a pergunta retroativa do Bot resolvendo Ambiguidade em Produções Paralelas.
- `[ ]` Pair de Screenshots Frontend: Menu Produtor PMO (Ativo) vs. Menu Produtor Convencional (Ocultado + Rota bloqueada).