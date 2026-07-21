# Open Knowledge Format (OKF) - Guia de Governança

Este documento serve como guia para toda a equipa (agrónomos, especialistas e developers) sobre como criar e manter os ficheiros de conhecimento que alimentam a Inteligência Artificial.

## 🎯 1. Propósito da Pasta

A arquitetura OKF (Open Knowledge Format) garante que os ficheiros colocados na diretoria `knowledge/` funcionem como as **"Leis Absolutas"** do bot. 

* Tudo o que está nesta diretoria é **carregado em memória durante o boot** do sistema.
* O conteúdo destes ficheiros é **injetado diretamente no System Prompt** do modelo de linguagem (LLM).
* O bot priorizará e obedecerá estritamente às regras aqui definidas antes de tomar qualquer decisão ou gerar respostas.

---

## ✍️ 2. Regras de Redação para Inteligência Artificial (Prompt Engineering)

Para garantir que a IA consome as instruções de forma otimizada e sem ambiguidades, todos os ficheiros devem seguir rigorosamente as seguintes diretrizes:

### A. Comunicação Direta e Afirmativa
A IA não tem capacidade de dedução baseada em contexto implícito. A comunicação deve ser explícita.
* Evite ambiguidades, texto redundante ou duplas negações.
* Use o modo imperativo e frases diretas.
* **Certo:** "Se o limite de crédito for inferior a 500, recusa a operação."
* **Errado:** "Caso o cliente não tenha um limite muito alto, por exemplo, menos de 500, talvez seja melhor não prosseguir com a operação."

### B. Uso de Dados Estruturados (Tabelas Markdown)
A IA processa e relaciona informações tabulares com um grau de precisão muito superior a textos formatados em parágrafos.
* Utilize sempre **Tabelas Markdown** para listar dados estruturados, como compasso de plantio, limites de crédito, estágios fenológicos ou tabelas de preços.
* *Exemplo de formatação ideal:*

  | Cultura | Compasso de Plantio (m) | Profundidade (cm) | Doses de NPK (kg/ha) |
  |---------|-------------------------|-------------------|----------------------|
  | Milho   | 0.90 x 0.20             | 3 - 5             | 120-60-60            |
  | Soja    | 0.45 x 0.10             | 2 - 3             | 0-80-80              |

### C. Manter os Ficheiros Curtos e Focados
O espaço de contexto do System Prompt é limitado (Context Window) e o excesso de informação degrada a atenção do LLM (Lost in the Middle).
* **Seja conciso:** A diretoria `knowledge/` destina-se exclusivamente a regras essenciais, fluxos críticos, diretrizes inegociáveis e parâmetros operacionais de base.
* **Manuais longos vão para o RAG:** Documentos extensos (ex: manuais de pragas com centenas de páginas, PDFs completos) **NÃO** devem ser colocados no OKF. Estes documentos devem ser indexados na base de dados vetorial (Supabase) via RAG (Retrieval-Augmented Generation).

---

## 🔄 3. Como Atualizar (Hot Reload)

A arquitetura do bot permite a atualização de regras em tempo real (Zero Downtime). Para aplicar novas regras:

1. Faça as edições nos ficheiros `.md` dentro desta diretoria.
2. Faça o `commit` e o `push` das alterações.
3. Execute uma requisição à rota da API: **`POST /admin/reload-knowledge`**
   * *O sistema recarregará as regras do OKF diretamente em memória e aplicará os novos System Prompts imediatamente nos próximos processamentos, sem necessitar de reiniciar o servidor.*
