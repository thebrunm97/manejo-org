# 🛡️ Diretrizes de Proteção de Dados e Conformidade Regulatória (LGPD & MAPA)

> **Projeto:** `pmo-bot-go`
> **Revisão:** Agosto/2026
> **Referências:** Lei Geral de Proteção de Dados (Lei nº 13.709/2018) e Portaria MAPA nº 52/2021.

O `pmo-bot-go` atua na interseção entre o processamento de dados pessoais (comunicação via WhatsApp) e a geração de evidências obrigatórias para certificação orgânica no Brasil. Este documento define as políticas de governança e ciclo de vida desses dados.

---

## 1. Princípios de Governança

Para adequação plena à LGPD e à regulamentação do MAPA, o sistema implementa uma política estrita de **separação entre dado operacional e dado de conformidade (evidência)**.

Não existe armazenamento genérico indefinido. Os dados são classificados e expurgados conforme sua utilidade probatória ou operacional se esgota.

---

## 2. Registro de Operações de Tratamento (ROPA)

O sistema coleta e processa os seguintes dados:

| Categoria | Exemplo de Dado | Finalidade | Base Legal (LGPD) | Compartilhamento |
|-----------|-----------------|------------|-------------------|------------------|
| **Contato (Identificadores)** | Número de WhatsApp, Nome | Identificação e roteamento de mensagens. | Execução de Contrato | Provedor de VPS (Hostinger) |
| **Localização** | Coordenadas, Cidades | Previsão do tempo, registro de talhões. | Execução de Contrato / Obrigação Legal (MAPA) | Serviços de Clima, LLMs (Pseudonimizado) |
| **Produção e Finanças** | Insumos, colheita, vendas | Rastreabilidade e relatórios de manejo. | Obrigação Legal (MAPA) / Legítimo Interesse | LLMs (Google/OpenRouter - Sanitizado) |
| **Biometria Vocal (Sensível)** | Áudios brutos | Transcrição para operação hands-free. | Execução de Contrato | Não há (processamento local/isolado) |

---

## 3. Política de Retenção em Duas Camadas

O ciclo de vida dos dados é gerido de forma segmentada:

### Camada 1: Operacional (Comunicação e Contexto de Curto Prazo)
Dados utilizados para fazer o sistema funcionar no dia a dia. Como não possuem valor probatório formal por si mesmos (não são "O Registro" estruturado), seu expurgo é acelerado.

- **`raw_payloads` (WhatsApp / Evolution API):** Retenção de **7 dias**. Após este período, a extração da informação relevante já deve ter ocorrido.
- **`audios_audit` (Áudio Bruto):** Retenção de **7 dias após processamento/transcrição**. Por conter biometria vocal (dado sensível), o descarte do áudio bruto mitiga riscos. O áudio **NÃO** deve ser repassado a LLMs genéricos, exceto para o motor de transcrição isolado (Whisper/Nova).
- **`messages` (Histórico Conversacional):** Retenção de **90 dias** (excluindo as mensagens atreladas a uma evidência, conforme Camada 2). Permite o funcionamento de contexto do bot sem expor histórico infinito.
- **Logs Técnicos:** Retenção entre **30 e 90 dias** (sem conteúdo de PII).

### Camada 2: Conformidade (Evidências de Certificação Orgânica)
O art. 68 da Portaria MAPA nº 52/2021 exige que os registros e documentos que garantem a rastreabilidade e a avaliação da conformidade sejam mantidos por **no mínimo 3 anos** (ou 5 anos após a última comercialização, dependendo do ciclo).

- **`certification_records`:** Log imutável (fato, data, talhão, quantidade, responsável). Retenção mínima de **3 anos**. 
- **Mensagens e Transcrições com Valor Probatório:** Se a transcrição serviu de base (originou) um `certification_record`, a mensagem/transcrição em si herda o prazo de **3 anos**, servindo de trilha de auditoria e evitando repúdio ("Eu não falei isso").
- **`plot_geometry_versions`:** Mapas e polígonos são retidos por **3 anos**, versionados para que o manejo documentado se relacione com a exata área física daquela época. 
- **Planos de Manejo Orgânico (PMO):** Todo histórico de atualização de PMOs, por **3 anos**.

---

## 4. Sanitização e LLM (Inteligência Artificial)

Provedores de LLM externos (Google, OpenRouter, provedores terceiros) não devem receber dados brutos.

1. **Minimização:** O histórico conversacional (`messages`) injetado no contexto do modelo abrange estritamente o necessário (janela curta de tempo, não 3 anos de logs de certificação).
2. **Pseudonimização (PII Filter):** Ferramentas como o `internal/guardrails/filter_pii.go` devem atuar **antes** da requisição sair para a rede (LLM), realizando as seguintes ações:
   - Tokenização ou redação de Números de Telefone (ex: `+55 11 99999-9999` → `[TELEFONE OMITIDO]`).
   - Redação de Nomes Completos identificáveis quando irrelevantes para o processamento da tarefa.
   - Resolução de coordenadas exatas de GPS para localidades genéricas (Cidade/Estado) ao realizar chamadas de APIs externas, salvo quando a precisão for a essência do comando.

---

## 5. Direitos do Titular (Art. 18, LGPD)

Os produtores têm direito facilitado sobre seus dados:
- **Acesso e Confirmação:** Podem requisitar o volume de informações suas através da plataforma ou bot.
- **Revogação e Eliminação:** Caso desejem apagar seus dados, o sistema proverá um mecanismo (`forget_user`). 
  - **Atenção Legal:** O direito de eliminação não é absoluto. Dados constantes na Camada 2 (Conformidade), atrelados ao MAPA ou faturamento de assinaturas, recaem na exceção do art. 16, I da LGPD ("cumprimento de obrigação legal ou regulatória pelo controlador"). Estes dados **não serão eliminados** antes de esgotado o prazo de 3 anos, devendo o usuário ser devidamente notificado dessa exceção.
