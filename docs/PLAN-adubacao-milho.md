# PLAN-adubacao-milho.md - Plano de Inclusão da Cultura do Milho e Busca Parcial no Motor Agronômico

Este plano descreve as etapas necessárias para cadastrar a cultura do **Milho** (separada em **Milho Grão** e **Milho Silagem**) na base de dados agronômica de referência e ajustar a RPC do Supabase para aceitar buscas fluidas por termos parciais de culturas e insumos.

---

## 📅 Histórico de Decisões (Socratic Gate)

Com base nas definições acordadas com o usuário:
1. **Parâmetros de Extração do Milho**:
   * **Milho Grão**: Meta de referência `8.0` t/ha, N = `20.0` kg/t, P₂O₅ = `8.0` kg/t, K₂O = `20.0` kg/t.
   * **Milho Silagem**: Meta de referência `35.0` t/ha, N = `4.0` kg/t, P₂O₅ = `1.5` kg/t, K₂O = `4.5` kg/t.
2. **Busca Parcial**: A RPC `calcular_balanco_nutricional` será atualizada para buscar culturas e adubos usando wildcards (`%` antes e depois), permitindo que digitações parciais (ex: "esterco bovino", "milho") encontrem os registros corretos ("Esterco Bovino Curtido", "Milho Grão").
3. **Divisão de Culturas**: "Milho Grão" e "Milho Silagem" serão inseridos separadamente para manter a precisão agronômica diferenciada entre extração de grão vs exportação de massa verde.

---

## 🛠️ Mudanças Propostas

### 1. Banco de Dados (Supabase Migration)

#### [NEW] [20260525_expand_agronomic_engine.sql](file:///c:/Users/brunn/Documents/PROGRAMACAO/manejo-org-app-clean/supabase/migrations/20260525_expand_agronomic_engine.sql)
Criaremos uma nova migration SQL para:
* Inserir dados de extração de referência para `Milho Grão` e `Milho Silagem` na tabela `public.ref_cultura_extracao`.
* Atualizar a definição da função RPC `public.calcular_balanco_nutricional` para usar a busca parcial (`%`) nas tabelas `ref_cultura_extracao` e `ref_adubos_organicos`.

---

## 📋 Detalhamento das Fases

### Fase 1: Criação e Aplicação da Migration SQL
* Gerar o script SQL de migração.
* Aplicar a migração na base de dados remota do Supabase usando a ferramenta `mcp_supabase_apply_migration`.

### Fase 2: Testes e Validação de Queries SQL
* Executar chamadas de teste na RPC usando SQL para verificar se os wildcards estão funcionando como esperado.
* Exemplo:
  ```sql
  SELECT public.calcular_balanco_nutricional('milho', 8, 'esterco');
  ```
  Isso deve retornar com sucesso o cálculo agronômico pareando "Milho Grão" com "Esterco Bovino Curtido".

---

## 🧪 Plano de Verificação

### Testes Manuais
1. Executar query SQL simulando a chamada que o bot Go faz.
2. Confirmar que a RPC calcula corretamente e retorna o balanço sem gerar exceção de cultura/adubo não encontrado.
