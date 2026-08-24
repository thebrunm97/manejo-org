# 🧠 Pesquisa e Melhorias Futuras: Banco Vetorial (Supabase / pgvector)

## Contexto Atual
Atualmente, o projeto utiliza a extensão `pgvector` no Supabase com uma tabela `user_memory_profiles` contendo embeddings de **1024 dimensões**, indexados via **HNSW**, e realiza a busca através da RPC `match_user_memory` com um filtro de tenant (`pmo_id`).
Com base no guia oficial do Supabase e nas melhores práticas arquiteturais para *Retrieval-Augmented Generation* (RAG), este documento lista as opções estruturais para aprimorar a eficiência, escalabilidade e qualidade das respostas do nosso banco vetorial no futuro.

---

## Opções de Implementação

### 1. Busca Híbrida (Hybrid Search com RRF)
A Busca Híbrida combina a busca por palavras-chave (Full-Text Search do PostgreSQL usando índices `GIN` em colunas `tsvector`) com a busca semântica (`pgvector` com HNSW).
Na prática, executamos as duas buscas simultaneamente (via CTEs no PostgreSQL) e combinamos os resultados usando um algoritmo de fusão chamado **Reciprocal Rank Fusion (RRF)**. O RRF calcula um *score* matemático baseado no ranqueamento do fragmento em ambas as listas (ex: `1 / (k + rank_vetorial) + 1 / (k + rank_texto)`), penalizando resultados que são bons em apenas uma métrica e recompensando os que aparecem bem em ambas.

✅ **Prós:**
- Resolve a fraqueza clássica de vetores: incapacidade de encontrar jargões, IDs, siglas e nomes comerciais exatos de produtos químicos/sementes (que são vitais no agronegócio).
- Traz o melhor dos dois mundos: se o produtor usar palavras erradas ("remédio pra planta"), o vetor acerta (Fungicida); se ele buscar a marca exata ("Priori Xtra"), o Full-Text Search acerta.
- Permite ajustar "pesos" (`full_text_weight` e `semantic_weight`) direto na RPC.

❌ **Contras:**
- Adiciona processamento no banco (gera colunas `tsvector` para cada texto e cria índices GIN adicionais), ocupando um pouco mais de armazenamento.
- A query SQL (RPC) fica significativamente mais complexa (CTEs e Full Outer Joins).

📊 **Esforço:** Médio / Alto (Exige nova migration, criação de índices GIN e reescrever a function RPC).

---

### 2. Otimização Multi-Tenant (Iterative Index Scans)
Atualmente, a query faz `WHERE ump.pmo_id = match_pmo_id` junto com a ordenação do `HNSW`. O HNSW do pgvector é global na tabela. Historicamente, se o filtro fosse muito seletivo, a busca retornava menos resultados que o `LIMIT` desejado. No entanto, a partir do **pgvector 0.8.0**, o PostgreSQL suporta **iterative index scans**, controlados pelo parâmetro `hnsw.iterative_scan`. Isso faz com que o banco continue navegando pelo índice HNSW até encontrar a quantidade solicitada de registros que passem no filtro `pmo_id`.

✅ **Prós:**
- Resolve nativamente o problema de buscas filtradas em ambientes multi-tenant sem precisar particionar tabelas pesadamente.
- Permite os modos `strict_order` (distância exata) ou `relaxed_order` (melhor vazão/recall).
- Aumento drástico de velocidade para bases com centenas de perfis separados.

❌ **Contras:**
- Exige garantir que a infraestrutura do Supabase do projeto esteja rodando a versão atualizada do pgvector (>= 0.8.0).
- Necessidade de gerenciar a variável de ambiente do banco (`SET hnsw.iterative_scan = 'relaxed_order';` no contexto da RPC).

📊 **Esforço:** Médio (Revisão da RPC e versão do pgvector)

---

### 3. Redução de Dimensionalidade (Matryoshka / Quantização Binária)
O schema usa `vector(1024)`. Como o próprio artigo do Supabase indica: *"In general, embeddings with fewer dimensions perform best."* Modelos modernos (como o `text-embedding-3-small` da OpenAI ou o `nomic-embed-text`) suportam *Matryoshka Representation Learning*, permitindo truncar os embeddings para 256 ou 384 dimensões mantendo ~98% da performance semântica original.

✅ **Prós:**
- Índice HNSW ocupa até 1/4 do tamanho na memória (RAM) do Supabase.
- Latência no cálculo de distância é quase instantânea, aliviando uso de CPU e custos do banco.

❌ **Contras:**
- Se reduzirmos as dimensões agora, precisaremos recalcular (*re-embed*) todos os registros existentes no banco.
- Exige que o modelo LLM do gerador de embeddings suporte a saída em dimensões truncadas nativamente.

📊 **Esforço:** Baixo (se houver poucos dados hoje) / Médio

---

### 4. Alternativa de Índice: IVFFlat (Inverted File Indexes)
Atualmente usamos HNSW, que é o padrão ouro para precisão e velocidade. Contudo, a documentação aponta a existência do índice **IVFFlat**. O IVFFlat agrupa vetores em *clusters* (células) para reduzir o escopo da busca. Em vez de comparar com cada vetor, a query olha apenas para vetores nos clusters mais próximos (controlados via `ivfflat.probes`).

✅ **Prós:**
- O índice IVFFlat consome **muito menos memória RAM** do que o HNSW e tem tempos de construção iniciais mais curtos.
- Permite ajustar dinamicamente o *recall* (precisão) vs *velocidade* por requisição alterando `ivfflat.probes`.

❌ **Contras:**
- **Requer dados prévios:** Diferente do HNSW (que pode ser criado numa tabela vazia), o IVFFlat só deve ser criado *após* a tabela ter dados suficientes, pois ele usa a distribuição atual para definir os clusters centrais (`lists`).
- Se a distribuição dos dados mudar significativamente com o tempo, o índice degrada em qualidade e precisa ser reconstruído (`REINDEX`).
- A própria documentação do Supabase ressalta que o HNSW ainda tem desempenho e resiliência superiores na maioria dos casos.

📊 **Esforço:** Alto (exigiria scripts de recálculo de índice conforme a base cresce e tuning periódico das `lists`).

---

## 💡 Recomendação
Recomenda-se iniciar pela **Opção 1 (Busca Híbrida com RRF)**, pois resolve diretamente a **qualidade do RAG**, que é o maior ofensor na satisfação do usuário.

---

### 5. Geração Automática de Embeddings via Banco (Supabase Edge Functions + pgmq)
Atualmente, quando um produtor interage, o back-end em Go é quem provavelmente orquestra a chamada para o modelo (ex: OpenAI/Gemini) para gerar o embedding e salva no banco. A documentação mais recente sugere inverter essa responsabilidade: o Go apenas insere o texto bruto. Um **gatilho (trigger)** no Postgres envia um job para uma fila nativa (`pgmq`), e o próprio Supabase (`pg_cron` + `pg_net`) chama assincronamente uma Edge Function (em TypeScript/Deno) para gerar o embedding e preencher a coluna `embedding` que estava nula.

✅ **Prós:**
- **Desacoplamento total:** O back-end em Go não precisa esperar a API de embeddings responder para devolver sucesso ao usuário ou concluir uma transação.
- **Resiliência nativa:** O sistema usa visibilidade e timeout de mensagens (`pgmq`). Se a API de embeddings cair, o `pg_cron` tenta de novo automaticamente sem prender workers no Go.
- O dado e o vetor ficam garantidamente sincronizados (se o conteúdo atualizar, o trigger limpa o embedding velho e re-enfileira a geração).

❌ **Contras:**
- **Fragmentação da Stack:** O core do PMO Bot é em Go. Ter que gerenciar lógicas vitais em Deno/TypeScript (Edge Functions do Supabase) e agendadores (`pg_cron`) em SQL divide o domínio da aplicação.
- Cria latência assíncrona perceptível: Se o bot precisa do embedding *imediatamente* na mesma requisição para fazer uma busca (ex: RAG síncrono no chat), o embedding pode ainda não estar pronto, pois a Edge Function é invocada a cada ~10s pelo `pg_cron`.

📊 **Esforço:** Médio (Requer criar e fazer deploy da Edge Function, habilitar várias extensões e gerenciar filas SQL).

---

## 💡 Recomendação
Recomenda-se iniciar pela **Opção 1 (Busca Híbrida com RRF)**, pois resolve diretamente a **qualidade do RAG**, que é o maior ofensor na satisfação do usuário.

A **Opção 2 (Iterative Index Scans)** deve ser aplicada imediatamente se sentirmos problemas de performance nos filtros por `pmo_id`, dado seu baixíssimo custo de implementação (apenas alterar a configuração na chamada).

Juntamente a isso, para o lado da infraestrutura, deve-se manter no radar a **Opção 3 (Matryoshka)** para quando o custo/espaço de RAM começar a pesar. A **Opção 4 (IVFFlat)** fica apenas como último recurso de economia extrema de RAM em cenários read-heavy estabilizados.

---

### 6. Arquitetura Enterprise: Pods Vetoriais Isolados (Foreign Data Wrappers - FDW)
Para cenários de hipercrescimento (Enterprise), o Supabase recomenda **separar fisicamente** o banco de dados operacional (tabelas transacionais) do banco de dados vetorial. Os vetores crescem mais rápido e consomem muita CPU e RAM durantes buscas ou reindexações. Ao criar um projeto Supabase "Pod" apenas para vetores, conectamos o banco principal a ele através do `postgres_fdw` (Foreign Data Wrappers). O banco principal cria uma *Foreign Table* (tabela externa) e consegue consultar os vetores via rede como se estivessem locais.

✅ **Prós:**
- **Isolamento de Recursos:** Consultas pesadas de RAG não roubam CPU/RAM das rotinas transacionais do PMO Bot (garantindo estabilidade do webhook).
- **Escalabilidade Independente:** Podemos aumentar o plano (Tier) apenas do banco vetorial, sem pagar mais caro pelos recursos do banco transacional.
- Tolerância a falhas: Se o motor vetorial cair, o sistema de cadastros e o core do bot não são afetados.

❌ **Contras:**
- **Custo e Complexidade Multi-Tenant:** Exige gerenciar (e pagar) por dois ou mais projetos Supabase.
- **Latência de Rede:** Há um *overhead* milissegundos para o banco principal ir buscar os dados no banco secundário pela rede.
- Migrações (Migrations) e backups se tornam mais complexos, divididos em repositórios separados.

📊 **Esforço:** Alto (Provisionar instâncias separadas, gerenciar usuários FDW, refatorar repositório e CI/CD).

---

---

---

### 7. Dimensionamento de Instância e Tuning Fino de Índices (Compute & Memory)
Vetores consomem **muita RAM**. Os benchmarks do Supabase mostram que o número de dimensões afeta dramaticamente o consumo de memória e a performance (QPS). Atualmente nosso projeto usa vetores de **1024 dimensões**. Analisando os benchmarks para 960 e 1536 dimensões:
- Para ~100.000 vetores, o índice HNSW exigirá entre **2 GB e 4 GB de RAM** dedicados para manter a latência na casa de ~0.08s. 
- Se a base escalar para 1.000.000 de vetores, o HNSW de 1024 dimensões exigirá entre **16 GB e 32 GB de RAM** (instâncias XL a 2XL no Supabase).

A documentação de "Going to Production" do Supabase também recomenda práticas vitais de tuning:
1. **Inner-Product:** Se nossos embeddings forem normalizados (com comprimento 1, padrão da OpenAI), trocar o operador de `Cosine` (`<=>`) para `Inner Product` (`<#>`) traz uma pequena vantagem de performance, pois a matemática é mais simples e o resultado é idêntico.
2. **Pre-Warming:** Antes de fazer benchmarks ou colocar o bot em produção após uma queda/deploy pesado, deve-se carregar o índice na RAM ativamente usando `SELECT pg_prewarm('nome_do_indice_hnsw');` ou executando 10.000 queries aleatórias. Isso evita latências de vários segundos nos primeiros acessos dos usuários reais ("cold cache").

✅ **Prós:**
- Fazer *tuning* dos parâmetros do HNSW (aumentar `m` e `ef_construction` na criação do índice) permite diminuir o `ef_search` em tempo de consulta, o que aumenta a Vazão (QPS) sem sacrificar muita precisão.
- `pg_prewarm` garante latência impecável desde o milissegundo zero em produção.

❌ **Contras:**
- Alterar `m` e `ef_construction` torna a criação inicial (ou recriação) do índice HNSW *muito* mais lenta.
- Custos fixos maiores: não há mágica; vetores rápidos exigem que todo o índice caiba na memória RAM ativa do banco. Se não couber, o disco (Swap) é acionado e o tempo de resposta explode de milissegundos para segundos.

📊 **Esforço:** Baixo (para tuning do comando SQL) a Médio (revisão de infra/custos).

---

---

### 8. Segurança e Permissões de Acesso (Row Level Security - RLS)
Atualmente, o isolamento multi-tenant entre os dados dos fazendeiros é feito no nível da aplicação (via cláusula `WHERE pmo_id = X` na function RPC `match_user_memory`). A documentação recomenda empurrar essa responsabilidade para a infraestrutura do banco utilizando **Row Level Security (RLS)**. Ao atrelar os fragmentos do RAG ao usuário/tenant dono, podemos criar políticas automáticas no PostgreSQL que impedem, de forma nativa e inviolável, que um produtor recupere a memória de outro produtor, mesmo que a query SQL do backend seja escrita com falhas ou de forma genérica (`SELECT * FROM vector_table`).

✅ **Prós:**
- **Segurança absoluta:** O isolamento dos dados dos clientes (tenants) fica blindado na fundação do banco. Bugs na camada Go não vão vazar contexto de uma fazenda para outra.
- Padronização: A função RPC de similaridade fica mais limpa e agnóstica a parâmetros de tenant (desde que a sessão passe o contexto JWT ou `set local app.current_user_id`).

❌ **Contras:**
- **Performance RLS:** O Row Level Security adiciona um leve overhead (uma sub-query implícita) em absolutamente toda requisição, impactando queries per second (QPS) durante picos massivos de tráfego. O Supabase recomenda usar o Query Plan Analyzer antes e depois de habilitar o RLS em vetores.
- Ajuste na Orquestração: O backend em Go terá que assinar as queries com a injeção do contexto do usuário atual da sessão para a policy do RLS enxergar (ex: `set app.current_user_id`).

📊 **Esforço:** Médio (Requer refatorar a forma como o Go se autentica e abre sessão com o DB, habilitando RLS na tabela).

---

## 💡 Recomendação Final Consolidada
O motor de RAG de qualquer bot baseado em IA é o "coração" da operação. Após mapear todas as técnicas avançadas e recomendações oficiais, a trilha evolutiva recomendada para o PMO Bot é:

1. **Segurança (Fundação):** Validar se vale a pena substituir as cláusulas `WHERE pmo_id` manuais pela infraestrutura nativa da **Opção 8 (Row Level Security - RLS)**. Isso garante segurança inviolável para dados sensíveis dos clientes, mudando o papel do Go de "criador de queries" para "portador de tokens de sessão".
2. **Ação Imediata (Performance Local):** Implementar a **Opção 2 (Iterative Index Scans)** se houver qualquer lentidão nos filtros `WHERE pmo_id = X`. Como ação combinada, verificar se nossos vetores de 1024 dimensões são normalizados para trocar para o operador de **Inner Product** (`<#>`) em vez de Cosine, maximizando a velocidade.
3. **Próximo Ciclo (Qualidade da Resposta):** Desenvolver a **Opção 1 (Busca Híbrida com RRF)**. Somar Full-Text Search aos vetores resolve o maior problema de RAG no agronegócio: falhar ao buscar nomes comerciais específicos (como fungicidas e defensivos).
4. **Escala de Longo Prazo (Custos e RAM):** 
   - Acompanhar de perto a métrica de RAM do Supabase e aplicar o **Pre-Warming** (`pg_prewarm`) em deploy. A **Opção 7 (Tuning HNSW)** dita que teremos que fazer upgrades de instância (RAM) à medida que nos aproximarmos de centenas de milhares de pedaços de memória.
   - Quando o upgrade de infraestrutura ficar muito caro, implementar a **Opção 3 (Matryoshka)** para truncar nossos embeddings de 1024 para 256 ou 512 dimensões, cortando o custo de RAM e Disco pela metade instantaneamente.
   - Apenas se a RAM continuar sendo um gargalo irreversível sob o HNSW, cogitar a **Opção 4 (IVFFlat)**.
5. **Hiperescala (Corporate):** As **Opções 5 (Geração DB)** e **6 (FDW Pods)** são ferramentas extremas de isolamento para quando o PMO Bot se tornar uma plataforma corporativa massiva. Não são necessárias hoje.
