# -*- coding: utf-8 -*-
"""
Gerador do Relatório de Auditoria de Segurança — Manejo Orgânico (ManejoORG)
Requer: venv com reportlab, matplotlib, pymupdf (opcional para verificação)
Uso: python gerar_relatorio.py
"""
import os
import textwrap
import html
from datetime import date

import matplotlib
matplotlib.use("Agg")
import matplotlib.pyplot as plt
from matplotlib.patches import Circle

from reportlab.lib import colors
from reportlab.lib.pagesizes import A4
from reportlab.lib.units import mm
from reportlab.lib.colors import HexColor
from reportlab.lib.styles import ParagraphStyle
from reportlab.lib.enums import TA_CENTER, TA_LEFT, TA_JUSTIFY
from reportlab.platypus import (
    BaseDocTemplate, PageTemplate, Frame, Paragraph, Spacer, Image,
    Table, TableStyle, PageBreak, Preformatted, KeepTogether, HRFlowable,
)

# ----------------------------------------------------------------------------
# Configuração / Paleta
# ----------------------------------------------------------------------------
AUDIT_DIR = os.path.dirname(os.path.abspath(__file__))
OUT_PDF = os.path.join(AUDIT_DIR, "relatorio-auditoria-seguranca.pdf")
ASSETS = os.path.join(AUDIT_DIR, "_assets")
os.makedirs(ASSETS, exist_ok=True)

PAL = {
    "critica": "#B91C1C",
    "alta":    "#EA580C",
    "media":   "#D97706",
    "baixa":   "#2563EB",
    "ponto":   "#059669",
}
SEV_ORDER = ["critica", "alta", "media", "baixa"]
SEV_LABEL = {"critica": "Crítica", "alta": "Alta", "media": "Média", "baixa": "Baixa", "ponto": "Ponto forte"}

PAGE_W, PAGE_H = A4
MARGIN = 20 * mm
FRAME_W = PAGE_W - 2 * MARGIN

# Fontes DejaVu (suportam acentos PT-BR), vêm com matplotlib
MPL_FONTS = os.path.join(os.path.dirname(matplotlib.__file__), "mpl-data", "fonts", "ttf")
FONT = os.path.join(MPL_FONTS, "DejaVuSans.ttf")
FONT_B = os.path.join(MPL_FONTS, "DejaVuSans-Bold.ttf")
FONT_O = os.path.join(MPL_FONTS, "DejaVuSans-Oblique.ttf")
FONT_M = os.path.join(MPL_FONTS, "DejaVuSansMono.ttf")

from reportlab.pdfbase import pdfmetrics
from reportlab.pdfbase.ttfonts import TTFont
pdfmetrics.registerFont(TTFont("DejaVu", FONT))
pdfmetrics.registerFont(TTFont("DejaVu-Bold", FONT_B))
pdfmetrics.registerFont(TTFont("DejaVu-Italic", FONT_O))
pdfmetrics.registerFont(TTFont("DejaVuMono", FONT_M))

TITULO = "Relatório de Auditoria de Segurança — Manejo Orgânico (ManejoORG)"
CABECALHO = "Relatório de Auditoria de Segurança — ManejoORG"

# ----------------------------------------------------------------------------
# Achados
# ----------------------------------------------------------------------------
CATS = {
    "1": "Banco sem tranca",
    "2": "Permissão definida no navegador",
    "3": "IDOR",
    "4": "Chaves expostas",
    "5": "Inputs sem tratamento (XSS)",
}

FINDINGS = [
    {
        "cat": "1", "sev": "critica", "n": "F1.1",
        "arquivo": "supabase/migrations/20260818140000_create_domain_mutation_rpcs.sql:22-37",
        "titulo": "update_profile aceita pmo_ativo_id de terceiros sem validação de posse → leitura/escrita financeira cross-tenant",
        "trecho": ('UPDATE public.profiles\n'
                   'SET pmo_ativo_id = CASE WHEN p_updates ? \'pmo_ativo_id\'\n'
                   '  THEN (p_updates->>\'pmo_ativo_id\')::uuid ELSE pmo_ativo_id END,\n'
                   '...\nWHERE id = v_user_id\n(só \'Não autorizado\' se auth.uid() é NULL)'),
        "política": ("supabase/migrations/20260525_create_financial_ledger.sql:152-165\n"
                     "POLICY USING (pmo_id IN (SELECT pmo_ativo_id FROM profiles WHERE id=auth.uid())\n"
                     "             OR user_id=auth.uid() OR ... role='admin')  — FOR ALL"),
        "porque": ("update_profile é SECURITY DEFINER com GRANT EXECUTE TO authenticated e grava "
                   "pmo_ativo_id enviado no payload sem conferir se o PMO pertence ao chamador. "
                   "A política RLS de transacoes_financeiras (e transacao_alocacoes) libera TODO o "
                   "acesso (SELECT/INSERT/UPDATE/DELETE) a transações cujo pmo_id seja igual ao "
                   "pmo_ativo_id do perfil. Como os IDs de PMO/propriedade são bigint enumeráveis, "
                   "um produtor arbitrário seta pmo_ativo_id = PMO da vítima e passa a ler, alterar e "
                   "apagar o ledger financeiro dela. O mesmo resultado é alcançável por UPDATE direto "
                   "na própria linha de profiles (policy id=auth.uid()), pois o trigger "
                   "trg_prevent_self_promotion só protege a coluna role. Impacto ainda alcança "
                   "get_dre_mensal/get_lucro_por_talhao (SECURITY INVOKER)."),
        "cond": "Qualquer usuário authenticated. Sem flag/feature-gate necessários.",
    },
    {
        "cat": "1", "sev": "alta", "n": "F1.2",
        "arquivo": "supabase/migrations/20260818160000_create_pmo_mutation_rpcs.sql:198-211",
        "titulo": "upsert_pmo_relacoes não força pmo_id do registro inserido → gravação cross-tenant",
        "trecho": ("EXECUTE format('DELETE FROM public.%I WHERE pmo_id = $1', p_table) USING v_pmo_id;\n"
                   "IF jsonb_array_length(p_payload) > 0 THEN\n"
                   "  EXECUTE format(\n"
                   "    'INSERT INTO public.%I SELECT * FROM jsonb_populate_recordset(null::public.%I, $2)',\n"
                   "    p_table, p_table) USING v_pmo_id, p_payload;"),
        "política": "GRANT EXECUTE TO authenticated (linha 211). Valida apenas pmo_id do DELETE (linhas 150-152).",
        "porque": ("A RPC é SECURITY DEFINER e só valida a posse de v_pmo_id. O INSERT usa "
                   "jsonb_populate_recordset com o payload cru do chamador: cada linha preserva o "
                   "pmo_id que vier no JSON, ignorando v_pmo_id. Quem possui UM PMO legítimo pode "
                   "enviar linhas apontando para o PMO de outra pessoa em pmo_manejo, pmo_propagacao, "
                   "pmo_limpeza, etc., sobrescrevendo/adulterando dados alheios (podridão de dados, "
                   "quebra de caderno de campo e certificação orgânica)."),
        "cond": "Qualquer authenticated que possua ≥1 PMO.",
    },
    {
        "cat": "1", "sev": "alta", "n": "F1.3",
        "arquivo": "supabase/migrations/20260818160000_create_pmo_mutation_rpcs.sql:232-241",
        "titulo": "sync_culturas_anuais ignora p_pmo_id na gravação → gravação cross-tenant",
        "trecho": ("DELETE FROM public.culturas_anuais WHERE pmo_id = p_pmo_id;\n"
                   "IF p_culturas IS NOT NULL AND jsonb_array_length(p_culturas) > 0 THEN\n"
                   "  INSERT INTO public.culturas_anuais\n"
                   "  SELECT * FROM jsonb_populate_recordset(null::public.culturas_anuais, p_culturas);"),
        "política": "GRANT EXECUTE TO authenticated (linha 241).",
        "porque": ("Mesmo defeito de F1.2: a validação de posse existe só para p_pmo_id (delete), mas "
                   "as linhas inseridas carregam o pmo_id do JSON do chamador, permitindo escrever "
                   "culturas anuais no plano de manejo de outro tenant."),
        "cond": "Qualquer authenticated que possua ≥1 PMO.",
    },
    {
        "cat": "1", "sev": "media", "n": "F1.4",
        "arquivo": "supabase/migrations/20260823110000_sync_prod_orphan_functions.sql:989-1044",
        "titulo": "get_traceability_data é SECURITY DEFINER PÚBLICA e devolve endereço cadastral completo + histórico de manejo de qualquer lote",
        "trecho": ("SECURITY DEFINER  -- sem SET search_path, sem REVOKE (default PUBLIC/anon)\n"
                   "SELECT ... 'endereco_completo', p.endereco_cadastral ...\n"
                   "FROM lotes_rastreabilidade l JOIN propriedades p ON l.propriedade_id = p.id\n"
                   "WHERE l.codigo_lote = p_codigo_lote;"),
        "política": "EXECUTE default PUBLIC (inclusive anon). O próprio arquivo sinaliza o risco (linhas 977-983).",
        "porque": ("Qualquer chamador anônimo que conheça um codigo_lote (impresso no rótulo/embalagem) "
                   "obtém o endereço cadastral completo da fazenda e o histórico completo de aplicações "
                   "(insumos/manejos) dos últimos 12 meses, sem nenhuma checagem de posse — exposição de "
                   "PII e de dados de produção de terceiros via mecanismo público de rastreabilidade."),
        "cond": "Anônimo; precisa de um codigo_lote válido (é exibido em QR na embalagem).",
    },
    {
        "cat": "1", "sev": "media", "n": "F1.5",
        "arquivo": "supabase/migrations/20260503_public_traceability.sql:4-33",
        "titulo": "get_rastreabilidade_publica (PUBLIC, SECURITY DEFINER) expõe nome do produtor para qualquer registro de caderno",
        "trecho": ("SECURITY DEFINER SET search_path = public\n"
                   "SELECT json_build_object(... \'produtor_nome\', pr.nome, \'fazenda_nome\', p.nome,\n"
                   "  \'municipio\', p.cidade, \'estado\', p.uf ...)\n"
                   "FROM caderno_campo cc JOIN propriedades p ... LEFT JOIN profiles pr ...\n"
                   "WHERE cc.id = p_registro_id;"),
        "política": "PUBLIC (anon pode chamar).",
        "porque": ("Para qualquer UUID de caderno_campo (que chega a circular em QR/link público) devolve "
                   "nome do produtor, nome da fazenda, município e estado. Vincula pessoa física a "
                   "localização e prática agrícola sem consentimento — além da função de rastreabilidade "
                   "não precisar do nome do produtor para cumprir seu papel."),
        "cond": "Anônimo; requer UUID conhecido/recebido.",
    },
    {
        "cat": "1", "sev": "media", "n": "F1.6",
        "arquivo": "supabase/migrations/20260823110000_sync_prod_orphan_functions.sql:355-380",
        "titulo": "get_propriedade_metrics sem auth.uid() e sem SET search_path",
        "trecho": ("SECURITY DEFINER   -- NOTA do próprio arquivo: sem search_path + DEFINER = vetor clássico\n"
                   "SELECT COALESCE(SUM(area_ha), 0), COUNT(id) FROM public.talhoes\n"
                   "WHERE propriedade_id = p_propriedade_id AND active = true;"),
        "política": "EXECUTE default; qualquer chamador.",
        "porque": ("IDOR informativo: qualquer autenticado (ou anon) enumera propriedade_id e obtém área "
                   "e contagem de talhões de qualquer fazenda. O SECURITY DEFINER sem SET search_path "
                   "permite que o chamador influencie a resolução de nomes (vetor de escalada de "
                   "privilégio, DT-46)."),
        "cond": "Qualquer chamador; impacto informativo hoje.",
    },
    {
        "cat": "1", "sev": "media", "n": "F1.7",
        "arquivo": "supabase/migrations/20260818170000_create_misc_mutation_rpcs.sql:263-291",
        "titulo": "restart_queue_job permite a QUALQUER autenticado resetar jobs da fila (controle é admin)",
        "trecho": ("SECURITY DEFINER\n"
                   "UPDATE public.message_queue SET status='pending', attempt_count=0,\n"
                   "  next_retry_at=now(), processed_at=null, error_msg=null WHERE id = p_id;"),
        "política": "message_queue tem RLS só para admin; a RPC é GRANT EXECUTE TO authenticated.",
        "porque": ("O RLS da tabela message_queue restringe consultas a admins, mas a RPC SECURITY "
                   "DEFINER ignora isso e só exige login. Qualquer produtor pode reiniciar/reprocessar "
                   "jobs arbitrários da fila (identificados por UUID facilmente observável), causando "
                   "replay de mensagens, gasto de crédito LLM e sabotagem operacional."),
        "cond": "Qualquer authenticated.",
    },
    {
        "cat": "1", "sev": "media", "n": "F1.8",
        "arquivo": "supabase/migrations/20260823110000_sync_prod_orphan_functions.sql:310-350",
        "titulo": "get_dashboard_stats sem is_admin, SECURITY DEFINER e EXECUTE público",
        "trecho": ("SECURITY DEFINER SET search_path TO \'public\'\n"
                   "-- sem nenhum IF NOT public.is_admin()\n"
                   "SELECT COALESCE(SUM(custo_estimado),0), COALESCE(SUM(total_tokens),0) ..."),
        "política": "Compare com get_admin_user_details (linhas 285-308) que checa is_admin.",
        "porque": ("Devolve métricas agregadas de custo/tokens/usuários ativos para qualquer chamador "
                   "(inclusive anon). É dado operacional sensível (gasto mensal com LLM) que o painel "
                   "admin esconde na UI, mas o backend não protege."),
        "cond": "Qualquer chamador; anônimo incluso.",
    },
    {
        "cat": "2", "sev": "media", "n": "F2.1",
        "arquivo": "pmo-frontend/src/routes/AdminRoute.tsx:24-28",
        "titulo": "Gate de admin só no navegador para as RPCs de suporte do painel (dashboard stats, propriedade metrics, queue)",
        "trecho": ("// AdminRoute.tsx — esconde a UI:  if (!isAdmin) { <Navigate to=\"/dashboard\" replace /> }\n"
                   "// Mas as RPCs get_dashboard_stats, get_propriedade_metrics e restart_queue_job\n"
                   "// (ver F1.6, F1.7, F1.8) são executáveis por qualquer authenticated/anon direto no PostgREST."),
        "política": "As rotas HTTP do Go (main.go:346-347,362-363) usam RequireAdmin — correto. O buraco está nas RPCs do Supabase.",
        "porque": ("O cruzamento frontend↔backend mostrou: (a) as rotas /admin e /api/v1/admin do Go são "
                   "corretamente protegidas por RequireAuth+RequireAdmin (ponto forte); (b) o gateway de "
                   "produtor exige RequireAuth e as RPCs encaminhadas validam posse com auth.uid() (ponto "
                   "forte); (c) PORÉM as RPCs que o painel admin consome direto via supabase.rpc() não "
                   "checam is_admin — o navegador é o único obstáculo. Qualquer usuário com conta "
                   "autenticada pode chamar get_dashboard_stats/get_propriedade_metrics e resetar jobs "
                   "(restart_queue_job) sem passar por AdminRoute."),
        "cond": "Qualquer authenticated.",
    },
    {
        "cat": "3", "sev": "critica", "n": "F3.1",
        "arquivo": "pmo-bot-go/internal/mcp/tools_financeiro.go:25-45",
        "titulo": "IDOR financeiro no bot/MCP — propriedade_id vem de args e o acesso usa chave de serviço",
        "trecho": ("propriedadeIDFloat, err := parseArgToFloat(args[\"propriedade_id\"])  // do LLM/args\n"
                   "result, err := s.supabase.GetBalancoIA(ctx, propriedadeID, ano, mesPtr)"),
        "política": ("client.go:2104-2126 → Authorization: \"Bearer \"+config.Key (SERVICE ROLE)\n"
                     "rpc_get_balanco_ia é SECURITY INVOKER (20260526060000...sql:14) → depende de RLS,\n"
                     "mas chave de serviço desativa RLS."),
        "porque": ("O handler ler propriedade_id dos argumentos da ferramenta (que o LLM preenche a "
                   "partir da conversa) SEM comparar com profile.PropriedadeAtivaID. A chamada ao "
                   "Supabase usa a chave de serviço, que ignora RLS; e rpc_get_balanco_ia é SECURITY "
                   "INVOKER (conta com RLS para filtrar). Resultado: um produtor pode pedir ao assistente "
                   "o balanço financeiro (receitas/despesas/top3) de QUALQUER propriedade do sistema, e "
                   "a resposta é entregue na conversa. Contraste: handleRegistrarDespesa (linhas 86-93) "
                   "usa corretamente profile.PropriedadeAtivaID."),
        "cond": "Qualquer produtor com sessão WhatsApp; explorável por prompt social/injeção — não há barreira de posse na ferramenta.",
    },
    {
        "cat": "3", "sev": "alta", "n": "F3.2",
        "arquivo": "pmo-bot-go/internal/mcp/tools_infra.go:57-79",
        "titulo": "IDOR de escrita — criar canteiros em talhão alheio (service key + args)",
        "trecho": ("talhaoIDFloat, err := parseArgToFloat(args[\"talhao_id\"])\n"
                   "err = s.supabase.CriarCanteirosEmLote(int64(talhaoIDFloat), ...)"),
        "política": "client.go:1712-1734 → POST /rest/v1/canteiros com Bearer config.Key (service role) — RLS de canteiros desviado.",
        "porque": ("O talhao_id não é validado contra os talhões do perfil. A gravação em lote usa "
                   "chave de serviço e insere canteiros em qualquer talhão do sistema (identificado por "
                   "ID enumerável). Poluição/adulteração de dados operacionais de outra fazenda; o GET "
                   "FetchCanteiros (client.go:1583-1595) é idêntico para leitura."),
        "cond": "Qualquer produtor com sessão WhatsApp.",
    },
    {
        "cat": "3", "sev": "media", "n": "F3.3",
        "arquivo": "pmo-bot-go/internal/mcp/tools_rag.go:39-44",
        "titulo": "IDOR de leitura — consultar dados de fazenda (canteiros) por talhão arbitrário",
        "trecho": ("case \"canteiros\":\n"
                   "  talhaoIDFloat, err := parseArgToFloat(args[\"talhao_id\"])\n"
                   "  data, err = s.supabase.FetchCanteiros(int64(talhaoIDFloat))"),
        "política": "FetchCanteiros via doRequest com service key (client.go:1799-1800) — RLS desviado.",
        "porque": ("Ramo canteiros usa talhao_id de args sem vincular ao perfil (os ramos talhoes/"
                   "caderno usam pmoID do profile — corretos). Leitura de canteiros de outra fazenda "
                   "(dados de layout de produção)."),
        "cond": "Qualquer produtor com sessão WhatsApp.",
    },
    {
        "cat": "4", "sev": "critica", "n": "F4.1",
        "arquivo": "git history: 12c53e6, b1c10ab (.env.prod), 37a7aa8 (deploy-aci.yml)",
        "titulo": "Segredos de PRODUÇÃO vigentes e não rotacionados no histórico público do git",
        "trecho": ("git log --all -S 'sb_secret_'  →  12c53e6, b1c10ab, 37a7aa8, ...\n"
                   "Confirmação atual em .env.prod/pmo-bot-go/.env: SUPABASE_KEY(sb_secret_* service role),\n"
                   "EVOLUTION_API_KEY, GROQ_API_KEY, GEMINI_API_KEY, OPENROUTER_API_KEY,\n"
                   "FLAGSMITH_ENV_KEY, WEATHER_API_KEY, e no histórico ainda senha do pooler\n"
                   "(postgres://postgres.hejewayflbuemnffrhae:***@aws-0-sa-east-1.pooler.supabase.com),\n"
                   "Azure Storage Account key e ACR password (deploy-aci.yml)."),
        "política": "Repo é PÚBLICO (github.com/thebrunm97/manejo-org). Rotação (DT-01) segue pendente.",
        "porque": ("As mesmas chaves de hoje estão espalhadas em commits públicos. Qualquer pessoa que "
                   "clone o histórico obtém full-access ao banco (service role), às contas de LLM "
                   "(gastos em nome do projeto), ao canal Evolution/WhatsApp e às credenciais Azure. O "
                   "scan gitleaks em CI é apenas diff — vazamentos antigos jamais serão pegos; sem "
                   "rotação, a exposição é permanente e total."),
        "cond": "Nenhuma. Exposição já consumada e vigente.",
    },
    {
        "cat": "4", "sev": "alta", "n": "F4.2",
        "arquivo": "pmo-bot-go/.env.example:9",
        "titulo": "Token real WPPCONNECT_TOKEN=\"TY6oMv4d20a3\" em arquivo TRACKED (único .env versionado)",
        "trecho": ('WPPCONNECT_TOKEN="TY6oMv4d20a3"\n'
                   'WPP_SESSION="thebrum97"'),
        "política": "git ls-files: o ÚNICO arquivo .env* rastreado é este. O valor coincide com o token em uso (pmo-frontend/.env).",
        "porque": ("Não é placeholder: é o token de autenticação do webhook Evolution/WPP em uso no "
                   "frontend. Em um repo público, isso expõe a credencial que autentica o recebimento "
                   "de mensagens (e o envio via API), permitindo forjar payloads de webhook e ler "
                   "sessões operacionais."),
        "cond": "Nenhuma — credencial válida exposta em arquivo versionado.",
    },
    {
        "cat": "4", "sev": "alta", "n": "F4.3",
        "arquivo": "pmo-bot-go/cmd/loadtest/main.go:87; scripts/update_webhook.*; docs/PLAN-hitl-judge-bugfix.md:118; pmo-bot-go/CHANGELOG.md:41,44",
        "titulo": "WEBHOOK_TOKEN de produção \"ManejoOrgToken\" embutido em defaults e scripts versionados",
        "trecho": ('flag.StringVar(&token, "token", "ManejoOrgToken", "WEBHOOK_TOKEN para autenticação")\n'
                   "scripts/update_webhook.ps1 / .sh: preenchem o header com o mesmo token\n"
                   "Confirmado: o valor está em uso em .env.prod today."),
        "política": "É o WEBHOOK_TOKEN real de produção (presente em .env.prod).",
        "porque": ("O token que autentica o webhook de entrada (Evolution→bot) está hardcoded em "
                   "defaults de loadtest, scripts de atualização e documentação versionada. Qualquer "
                   "pessoa com acesso ao repo pode autenticar requisições ao endpoint de webhook, "
                   "injetando mensagens falsas de produtores (engenharia social, aumento de gasto LLM, "
                   "contaminação de dados)."),
        "cond": "Nenhuma.",
    },
    {
        "cat": "4", "sev": "baixa", "n": "F4.4",
        "arquivo": "docker-compose.yml:25",
        "titulo": "Credencial padrão de admin do Grafana fixa (senha 'admin')",
        "trecho": "GF_SECURITY_ADMIN_PASSWORD=admin",
        "política": "Compose de monitoramento (dev/self-host).",
        "porque": ("Senha de admin do Grafana embutida, sem exigir override por env secreto. Em "
                   "qualquer host que exponha a porta 3000, painéis com métricas de custo LLM e logs "
                   "ficam legíveis/editáveis."),
        "cond": "Exige exposição da porta Grafana.",
    },
    {
        "cat": "5", "sev": "baixa", "n": "F5.1",
        "arquivo": "pmo-frontend/src/pages/PmoDetailPage.tsx:147; pmo-frontend/src/components/PmoForm/Secao18.tsx:92",
        "titulo": "href de anexos (url_arquivo) sem allowlist de protocolo",
        "trecho": '<a href={anexo.url_arquivo} ...>   /   <a href={a.url_arquivo} ...>',
        "política": "Hoje o valor vem de getPublicUrl() do Supabase (origem https fixa) — não explorável no fluxo normal.",
        "porque": ("O campo vive cru no banco e é renderizado direto em href. Se qualquer bypass de "
                   "escrita no banco ocorrer (ver categoria 1/IDOR), um atacante pode gravar "
                   "javascript:alert(...) e transformar o link em XSS armazenado de clique (stored XSS). "
                   "Falta defesa em profundidade: validar protocolo ^https?:// no momento do render. "
                   "Nenhum dangerouslySetInnerHTML/eval foi encontrado no frontend (ponto forte)."),
        "cond": "Condicional: exige escrever no banco um url_arquivo malicioso (hoje o fluxo de upload neutraliza).",
    },
]

# Pontos fortes verificados
STRONG_POINTS = [
    ("Gateway REST proxy", "pmo-bot-go/internal/gateway/rpc_proxy.go:52-166",
     "Allowlist fechado de 10 RPCs (nunca proxy aberto), reenvia o PRÓPRIO JWT do produtor ao PostgREST "
     "(não chave de serviço), cap de corpo 1 MiB, 404 para RPCs desconhecidas e log estruturado central "
     "de toda chamada."),
    ("Middleware JWT (ES256/JWKS)",
     "pmo-bot-go/internal/middleware/auth.go:230-352",
     "Verificação por JWKS assimétrico, algoritmo fixado em ES256 (bloqueia confusão de algoritmo "
     "none/HS256), exp/nbf validados, requisição de kid desconhecido força uma rebusca com "
     "rate-limit, RequireAuth fail-closed (config ausente ⇒ 503) e RequireAdmin lendo o papel em "
     "profiles.role (não do claim JWT)."),
    ("Rotas HTTP admin e produtor protegidas",
     "pmo-bot-go/cmd/server/main.go:346-378",
     "/admin e /api/v1/admin usam RequireAuth+RequireAdmin; /api/v1 (gateway) usa RequireAuth e as "
     "RPCs encaminhadas validam posse com auth.uid() internamente."),
    ("RLS central com auth.uid()",
     "supabase/migrations/*",
     "propriedades (user_id), talhoes (user_id), pmos, caderno_campo (user_id), canteiros (via talhão), "
     "lotes_rastreabilidade, transacoes_financeiras (user_id alinhado) — todos com RLS "
     "habilitado e políticas scoped por usuário; admin via is_admin()."),
    ("DT-65: revogação das RPCs *_arg de confiança cega",
     "supabase/migrations/20260824140000_revoke_dt65_gen1_rpc_grants.sql",
     "Revogou EXECUTE de registrar_atividade_pmo, rpc_registrar_compra_insumo, operacao_campo e "
     "criar_infraestrutura_* para anon/authenticated; rpc_registrar_transacao_com_rateio recriada com "
     "checagem de posse da propriedade."),
    ("IDOR fechado em setup_initial_profile",
     "supabase/migrations/20260817195000_fix_idor_setup_initial_profile.sql:20",
     "Adicionada cláusula auth.uid() != p_user_id → nega, com teste de integração dedicado "
     "(supabase/tests/integration/setup_initial_profile_idor_test.sql)."),
    ("Painel admin: get_admin_user_details com is_admin()",
     "supabase/migrations/20260823110000_sync_prod_orphan_functions.sql:285-308",
     "Únicas funções do bloco de painel que checam autorização (is_admin) ou filtram por auth.uid() "
     "(get_recent_bot_activities) — padrão que as demais deveriam seguir."),
    ("Governança de secrets",
     ".gitignore / .github/workflows/secret-scan.yml / .githooks/pre-commit",
     "Todos os .env* são gitignored e o ÚNICO arquivo .env rastreado é o .env.example; gitleaks roda em "
     "CI (diff) com --redact e localmente num hook fail-closed; bundle do frontend sem qualquer "
     "service_role/sb_secret_; parâmetros Azure Bicep com @secure()."),
    ("Tratamento de saída (XSS)",
     "pmo-frontend/src + pmo-bot-go/internal/notify",
     "Nenhum dangerouslySetInnerHTML/eval/innerHTML dinâmico; todo conteúdo PMO/insumo/traceability é "
     "renderizado como filho React (escapa automaticamente); e-mail é text/plain; Telegram sem "
     "parse_mode HTML; backend só responde c.JSON."),
    ("Validação de env no startup",
     "pmo-bot-go/cmd/server/main.go:122,166,213,217,231",
     "Servidor faz log.Fatal quando faltam GROQ_API_KEY, GEMINI_API_KEY, SUPABASE_URL, SUPABASE_KEY e "
     "EVOLUTION_BASE_URL — falha fechado na ausência de configuração."),
]

# Recomendações priorizadas
RECOMMENDATIONS = [
    ("P1", "Rotacionar TODOS os segredos comprometidos (C4): SUPABASE service_role + senha do pooler, "
     "Evolution/WPP API key e WEBHOOK_TOKEN, GROQ, Gemini, OpenRouter, Flagsmith, WEATHER, chaves "
     "Azure. Depois remover do histórico com git filter-repo (repo público) ou, no mínimo, marcar as "
     "chaves como revogadas; adicionar gitleaks full-history em CI e bloquear commits de .env."),
    ("P1", "Fechar o chain crítico F1.1: validar posse do pmo_ativo_id em update_profile (só aceitar "
     "PMOs do usuário) e parar de usar pmo_ativo_id como chave da policy de transacoes_financeiras "
     "(usar user_id/pmo_id OWNED conforme rpc_registrar_transacao_com_rateio), adicionando "
     "testes RLS cross-tenant."),
    ("P1", "Forçar pmo_id = v_pmo_id (F1.2/F1.3): em upsert_pmo_relacoes e sync_culturas_anuais, "
     "reescrever o payload p/ que pmo_id seja o validado, nunca o do JSON; adicionar teste de \"não "
     "consegue inserir linha de outro PMO\"."),
    ("P1", "Corrigir os 3 IDORs do bot/MCP (F3.1-F3.3): validar propriedade_id/talhao_id contra "
     "profile.PropriedadeAtivaID/posse do talhão antes de chamar o Supabase; remover args[propriedade_id] "
     "de handleConsultarBalancoFinanceiro. Idealmente, migrar a leitura para SECURITY INVOKER com JWT do "
     "produtor em vez da chave de serviço."),
    ("P2", "Adicionar is_admin()/is_owner às RPCs de painel sem checagem (F1.6, F1.7, F1.8, F2.1): "
     "get_dashboard_stats, get_propriedade_metrics, restart_queue_job e demais SECURITY DEFINER "
     "órfãs — mais SET search_path hardening e REVOKE de anon (DT-46)."),
    ("P2", "Conter a rastreabilidade pública (F1.4/F1.5): remover endereco_completo e produtor_nome "
     "dos payloads públicos ou exigir token/ auth para campo sensível; manter apenas o necessário à "
     "certificação."),
    ("P3", "Tratar defaults e allowlists (F4.2, F4.3, F4.4, F5.1): substituir WEBHOOK_TOKEN e "
     "WPPCONNECT_TOKEN por secrets/argv; exigir GF_SECURITY_ADMIN_PASSWORD via env; validar protocolo "
     "https:// em url_arquivo antes de renderizar <a href>."),
    ("P3", "Padronizar o mecanismo de isolamento: unificar a semântica de \"cooperativa/coop\" em "
     "is_admin() (evolvve_messages:36-43), unificar as duas árvores de migração (supabase/migrations vs "
     "pmo-frontend/supabase/migrations) e cobrir bot e web pelo mesmo contrato de posse testado "
     "em cross_tenancy_test.go."),
]

# Issues para o GitHub
ISSUES = [
    {
        "titulo": "[Segurança] Vazamento de segredos de produção no histórico público do git (rotação obrigatória)",
        "labels": "security, crítica",
        "corpo": """## Problema
As chaves de **produção atuais** estão commitadas no histórico público do repositório e **não foram rotacionadas** (DT-01 pendente). O `git log -S 'sb_secret_'` confirma a presença; `.env.prod` foi adicionado nos commits `12c53e6` e `b1c10ab`, e `deploy-aci.yml` em `37a7aa8`.

## Por que é explorável
O repositório é público. Qualquer pessoa que clone o histórico obtém:

- `SUPABASE_KEY` (service role, formato `sb_secret_*`) → acesso **total** ao banco, ignorando RLS;
- senha do pooler Postgres de produção (`postgres.postgres.hejewayflbuemnffrhae`);
- `EVOLUTION_API_KEY` / `WPPCONNECT_TOKEN` (mensageria WhatsApp);
- `GROQ_API_KEY`, `GEMINI_API_KEY`, `OPENROUTER_API_KEY`, `FLAGSMITH_ENV_KEY`, `WEATHER_API_KEY`;
- `Azure Storage Account key` e `ACR password` (`deploy-aci.yml`).

O scan gitleaks no CI é **somente diff** — vazamentos já enterrados em commits antigos nunca serão detectados.

## Evidência
```bash
git log --all -S "sb_secret_" --oneline   # 12c53e6, b1c10ab, 37a7aa8, ...
git log --all --diff-filter=A -- ".env.prod"
```
Valores confirmados presentes hoje em `.env.prod` e `pmo-bot-go/.env`.

## Impacto
Comprometimento total da infraestrutura: banco, LLMs (gastos), WhatsApp e Azure — com efeito permanente enquanto as chaves não forem trocadas.

## Correção sugerida
1. Rotacionar **todas** as chaves acima no provedor correspondente.
2. Trocar os valores novos em secrets de deploy (GitHub Actions / Azure / host) sem reversionar.
3. Remover o histórico com `git filter-repo` (repo público) ou marcar todas as chaves como revogadas.
4. Ativar scan full-history (ex.: `gitleaks` com `--log-opts` full) no CI e bloquear push com segredo.

## Critérios de aceite
- [ ] Nenhuma chave da lista C1-C10 citada acima permanece válida.
- [ ] `git log --all -S "sb_secret_"` (e variantes) não retorna mais nenhum commit.
- [ ] Scripts/CI de deploy usam apenas `secrets.*` do GitHub runner.
- [ ] Adicionado bloco `block-secrets` no CI que falha no push quando há segredo (full history).
""",
    },
    {
        "titulo": "[Segurança] IDOR crítico: pmo_ativo_id de terceiros concede acesso ao ledger financeiro",
        "labels": "security, crítica",
        "corpo": """## Problema
`update_profile` (SECURITY DEFINER) grava `pmo_ativo_id` do payload **sem validar posse**, e a policy de `transacoes_financeiras` libera tudo para quem tiver `pmo_ativo_id` igual ao `pmo_id` da transação.

## Evidência
- `supabase/migrations/20260818140000_create_domain_mutation_rpcs.sql:22-31` — `pmo_ativo_id = CASE WHEN p_updates ? 'pmo_ativo_id' ...`
- `supabase/migrations/20260525_create_financial_ledger.sql:152-165` — `USING (pmo_id IN (SELECT pmo_ativo_id ...) OR user_id=auth.uid() ...) FOR ALL`
- `GRANT EXECUTE ON FUNCTION public.update_profile TO authenticated` (linha 37).

## Impacto
Qualquer usuário autenticado seta `pmo_ativo_id` para o PMO de outra pessoa (IDs bigint enumeráveis) e passa a **ler/alterar/apagar** o ledger financeiro dela (DRE, lucro por talhão via `get_dre_mensal`/`get_lucro_por_talhao`, SECURITY INVOKER). Caminho alternativo: `UPDATE profiles SET pmo_ativo_id=...` na própria linha (policy `id=auth.uid()`).

## Correção sugerida
- Validar posse: `IF NOT EXISTS (SELECT 1 FROM pmos WHERE id = <pmo_ativo_id> AND user_id = v_user_id) THEN RAISE ...`
- Reavaliar a policy: trocar `pmo_ativo_id` por `user_id`/posse direta validada em RPC (padrão do DT-65).
- Adicionar `trg_prevent` também para `pmo_ativo_id`/`propriedade_ativa_id`.

## Critérios de aceite
- [ ] Teste de integração: usuário A não consegue ler `transacoes_financeiras` do PMO de B via `update_profile`.
- [ ] RLS aplica `user_id=auth.uid()`/posse verificada em `USING` e `WITH CHECK`.
- [ ] Nenhum caminho REST direto (UPDATE em profiles) altera `pmo_ativo_id` sem validação.
""",
    },
    {
        "titulo": "[Segurança] Escrita cross-tenant em upsert_pmo_relacoes e sync_culturas_anuais (pmo_id não forçado)",
        "labels": "security, alta",
        "corpo": """## Problema
Duas RPCs de sincronização de seções do PMO validam a posse apenas na operação de DELETE (usando `v_pmo_id`/`p_pmo_id`), mas o INSERT seguinte preserva o `pmo_id` vindo do JSON do chamador.

## Evidência
- `supabase/migrations/20260818160000_create_pmo_mutation_rpcs.sql:198-204` — `INSERT INTO public.%I SELECT * FROM jsonb_populate_recordset(null::public.%I, $2)` (using `v_pmo_id, p_payload` sem forçar coluna).
- `supabase/migrations/20260818160000_create_pmo_mutation_rpcs.sql:232-237` — mesma situação em `sync_culturas_anuais`.
- Ambas `GRANT EXECUTE TO authenticated` (linhas 211 e 241).

## Impacto
Quem possui um PMO legítimo pode gravar linhas apontando para PMOs de terceiros (manejo, propagação, limpeza, culturas anuais), adulterando cadernos/certificação de outra fazenda.

## Correção sugerida
Re-escrever o payload forçando `pmo_id = v_pmo_id` linha a linha (ex.: loop/unnest com a coluna travada), e adicionar teste que garanta rejeição de linha cross-tenant.

## Critérios de aceite
- [ ] Teste negativo: inserir payload com `pmo_id` de outro usuário é rejeitado/sanitizado.
- [ ] `pmo_id` da tabela alvo é sempre o validado na função.
""",
    },
    {
        "titulo": "[Segurança] IDOR financeiro no bot (MCP) — consulta de balanço de qualquer propriedade com chave de serviço",
        "labels": "security, crítica",
        "corpo": """## Problema
`handleConsultarBalancoFinanceiro` lê `propriedade_id` dos argumentos da ferramenta, que o LLM preenche pela conversa, **sem comparar com o perfil do produtor**, e chama o Supabase com a chave de serviço — que desativa o RLS. A RPC `rpc_get_balanco_ia` é SECURITY INVOKER e depende exatamente desse RLS.

## Evidência
- `pmo-bot-go/internal/mcp/tools_financeiro.go:25-45` — `parseArgToFloat(args["propriedade_id"])` → `GetBalancoIA(ctx, propriedadeID, ...)`.
- `pmo-bot-go/internal/supabase/client.go:2104-2126` — `Authorization: \"Bearer \"+c.config.Key` (service role).
- `supabase/migrations/20260526060000_create_rpc_balanco_ia.sql:14` — `SECURITY INVOKER -- ... RLS`.
- Contraste correto: `handleRegistrarDespesa` (tools_financeiro.go:86-93) usa `profile.PropriedadeAtivaID`.

## Impacto
Exfiltração do balanço financeiro (receitas/despesas/top-3) de **qualquer** propriedade, via sessão de um único produtor, por pedido direto ou prompt injection.

## Correção sugerida
- Usar `profile.PropriedadeAtivaID` (nunca `args`) no handler, como os demais handlers.
- Ou: adicionar validação `if propriedadeID != profile.PropriedadeAtivaID { nega }` antes de chamar o Supabase.
- Avaliar migrar leituras do bot para SECURITY INVOKER com JWT do usuário (pipeline gateway) em vez de service key.

## Critérios de aceite
- [ ] Ao chamar a ferramenta com `propriedade_id` alheio, resposta é negada com erro explícito.
- [ ] Teste de multitenância adicionado em `internal/mcp/cross_tenancy_test.go`.
""",
    },
    {
        "titulo": "[Segurança] IDOR de canteiros no bot (MCP) — leitura e escrita em talhão alheio via service key",
        "labels": "security, alta",
        "corpo": """## Problema
`handleCriarNovosCanteiros` e o ramo `canteiros` de `handleConsultarDadosFazenda` usam `talhao_id` vindo de `args` sem validar a posse, e os clientes Supabase correspondentes usam chave de serviço, desviando o RLS de `canteiros` (scoped via talhão).

## Evidência
- `pmo-bot-go/internal/mcp/tools_infra.go:57-79` → `CriarCanteirosEmLote(talhaoID, ...)`.
- `pmo-bot-go/internal/mcp/tools_rag.go:39-44` → `FetchCanteiros(talhaoID)`.
- `pmo-bot-go/internal/supabase/client.go:1583-1595` (GET) e `:1712-1734` (POST com `Bearer c.config.Key`).
- RLS de `canteiros`: \"Acesso via talhão do usuário\" (core_app_tables) — desativado pela chave de serviço.

## Impacto
Leitura e inserção de canteiros em talhões de outras fazendas (poisoning de dados operacionais).

## Correção sugerida
Validar posse do talhão antes de qualquer chamada: buscar o talhão com `user_id = profile.ID` (ou exigir `talhao_id IN (talhões do perfil)`), rejeitando se não pertencer.

## Critérios de aceite
- [ ] `talhao_id` alheio → erro, em leitura e escrita.
- [ ] Testes de multitenância no MCP cobrindo canteiros.
""",
    },
    {
        "titulo": "[Segurança] RPCs de painel admin executáveis por qualquer autenticado/anon sem is_admin (rastreabilidade + docs)",
        "labels": "security, média",
        "corpo": """## Problema
Diferentes painéis admin são escondidos no frontend (AdminRoute.tsx:25), mas as RPCs que eles consomem não fazem a checagem equivalente no backend. Casos verificados: `get_dashboard_stats`, `get_propriedade_metrics`, `restart_queue_job` (SECURITY DEFINER, sem `is_admin()`/posse, EXECUTE para authenticated/anon).

## Evidência
- `pmo-frontend/src/routes/AdminRoute.tsx:24-28` — gate por `isAdmin`.
- `supabase/migrations/20260823110000_sync_prod_orphan_functions.sql:310-350` (`get_dashboard_stats`), `:355-380` (`get_propriedade_metrics` sem `SET search_path`).
- `supabase/migrations/20260818170000_create_misc_mutation_rpcs.sql:263-291` (`restart_queue_job`).
- Contraste (seguro): `get_admin_user_details` com `is_admin()`.

## Impacto
Métricas operacionais/financeiras (custo LLM, usuários ativos) expostas e manipulação da fila por qualquer conta; vetor de escalada (SECURITY DEFINER sem search_path).

## Correção sugerida
Adicionar `IF NOT public.is_admin() THEN RAISE` nessas funções; `SET search_path` em todas; `REVOKE EXECUTE FROM anon`; revisar as demais órfãs do DT-46.

## Critérios de aceite
- [ ] `get_dashboard_stats`/`get_propriedade_metrics` respondem 403 para não-admin (e para anon).
- [ ] `restart_queue_job` exigindo `is_admin()`.
- [ ] Nenhuma função SECURITY DEFINER órfã sem `SET search_path`.
""",
    },
    {
        "titulo": "[Segurança] Rastreabilidade pública devolve PII (endereço cadastral e nome de produtor) de qualquer lote",
        "labels": "security, média",
        "corpo": """## Problema
As funções públicas de rastreabilidade (`get_traceability_data` e `get_rastreabilidade_publica`) são SECURITY DEFINER com EXECUTE para anon e devolvem dados pessoais (endereço completo da fazenda, nome do produtor, município, estado) para qualquer código de lote/UUID conhecido.

## Evidência
- `supabase/migrations/20260823110000_sync_prod_orphan_functions.sql:989-1044` — `endereco_completo` + histórico de manejo.
- `supabase/migrations/20260503_public_traceability.sql:4-33` — `produtor_nome`, `fazenda_nome`, `municipio`, `estado`.

## Impacto
Vazamento de PII (LGPD) e de dados operacionais de terceiros por mecanismo público; o código de lote fica impresso na embalagem.

## Correção sugerida
Remover campos sensíveis do payload público ou exigir autenticação/ token para os dados cadastrais; manter apenas produto/data/UF necessários à certificação.

## Critérios de aceite
- [ ] Payload público sem `endereco_completo` e sem `produtor_nome`.
- [ ] Teste com o QR público não retorna PII.
""",
    },
    {
        "titulo": "[Segurança] Tokens de autenticação em arquivos versionados (.env.example, loadtest, scripts, docs)",
        "labels": "security, alta",
        "corpo": """## Problema
O único arquivo `.env*` versionado — `pmo-bot-go/.env.example` — contém um token **real** (`WPPCONNECT_TOKEN="TY6oMv4d20a3"`, sessão `thebrum97`), e o `WEBHOOK_TOKEN` de produção (`ManejoOrgToken`) está hardcoded em defaults/scripts/documentação versionada.

## Evidência
- `pmo-bot-go/.env.example:9-10` — `WPPCONNECT_TOKEN="TY6oMv4d20a3"` (valor coincide com `pmo-frontend/.env` em uso).
- `pmo-bot-go/cmd/loadtest/main.go:87` — `flag.StringVar(&token, "token", "ManejoOrgToken", ...)`.
- `pmo-bot-go/scripts/update_webhook.ps1:3-4` / `.sh:6-7` / `docs/PLAN-hitl-judge-bugfix.md:118` / `pmo-bot-go/CHANGELOG.md:41,44`.

## Impacto
Com o repo público, qualquer pessoa autentica o webhook (injeta mensagens de produtores, gera gasto de LLM) e a API de mensageria.

## Correção sugerida
- Substituir valores por placeholders; passar tokens via CLI/env/secret.
- `loadtest`: remover default de `token` (como já é feito para `url`, ver comentário `main.go:83-85`).
- Rotacionar o token atual após a troca.

## Critérios de aceite
- [ ] `git grep -rE "TY6oMv4d20a3|ManejoOrgToken"` não retorna nada.
- [ ] Loadtest exige `-token` explícito (sem default).
""",
    },
    {
        "titulo": "[Segurança] Defesa em profundidade para anexos: allowlist de protocolo em url_arquivo",
        "labels": "security, baixa",
        "corpo": """## Problema
O campo `url_arquivo` (anexos de documentos) é renderizado direto em `href` sem validação de protocolo. Hoje o fluxo normal produz URLs Supabase `https://`; um bypass futuro de escrita no banco (categorias 1/3) transformaria o link em stored XSS.

## Evidência
- `pmo-frontend/src/pages/PmoDetailPage.tsx:147` — `<a href={anexo.url_arquivo}>`.
- `pmo-frontend/src/components/PmoForm/Secao18.tsx:92` — `<a href={a.url_arquivo}>`.

## Correção sugerida
Função utilitária que só aceita `^https?://` antes de renderizar (ideia: refatorar em `utils`, com teste unitário) e aplicar em todos os `href` de URL controlável.

## Critérios de aceite
- [ ] `url_arquivo` com `javascript:` não renderiza link clicável.
- [ ] Teste unitário cobrindo protocolos inválidos.
""",
    },
    {
        "titulo": "[Segurança] Default público de senha Grafana no docker-compose",
        "labels": "security, baixa",
        "corpo": """## Problema
`GF_SECURITY_ADMIN_PASSWORD=admin` fixo no compose de monitoramento.

## Evidência
- `docker-compose.yml:25`.

## Impacto
Painéis Grafana com métricas de custo LLM acessíveis/editáveis se a porta 3000 for exposta.

## Correção sugerida
Ler de env: `GF_SECURITY_ADMIN_PASSWORD=${{GF_ADMIN_PASSWORD}}` sem default, e exigir na inicialização.

## Critérios de aceite
- [ ] Compose sem senha hardcoded; docs indicam geração via secret.
""",
    },
]

# ----------------------------------------------------------------------------
# Gráficos
# ----------------------------------------------------------------------------
def gerar_graficos():
    orc = os.path.join(ASSETS, "donut.png")
    orb = os.path.join(ASSETS, "barras.png")

    sev_counts = {s: 0 for s in SEV_ORDER}
    for f in FINDINGS:
        sev_counts[f["sev"]] += 1

    cat_counts = {c: 0 for c in CATS}
    for f in FINDINGS:
        cat_counts[f["cat"]] += 1

    plt.rcParams["font.family"] = "DejaVu Sans"

    # Donut
    sizes = [sev_counts[s] for s in SEV_ORDER]
    colors_ = [PAL[s] for s in SEV_ORDER]
    fig, ax = plt.subplots(figsize=(4.6, 3.4), dpi=200)
    wedges, _ = ax.pie(
        sizes, colors=colors_, startangle=90, counterclock=False,
        wedgeprops=dict(width=0.36, edgecolor="white", linewidth=1.5),
    )
    ax.add_artist(Circle((0, 0), 0.62, color="white", zorder=2))
    total = sum(sizes)
    ax.text(0, 0.08, str(total), ha="center", va="center", fontsize=26, fontweight="bold", color="#1F2937")
    ax.text(0, -0.22, "achados", ha="center", va="center", fontsize=11, color="#6B7280")
    labels = [f"{SEV_LABEL[s]} ({sev_counts[s]})" for s in SEV_ORDER]
    ax.legend(
        wedges, labels, loc="center left", bbox_to_anchor=(0.98, 0.5),
        fontsize=9, frameon=False, labelcolor="#1F2937",
    )
    ax.set(aspect="equal")
    fig.savefig(orc, bbox_inches="tight", transparent=True)
    plt.close(fig)

    # Barras por categoria
    cats_ord = ["1", "2", "3", "4", "5"]
    vals = [cat_counts[c] for c in cats_ord]
    cats_label = ["Banco\nsem tranca", "Permissão no\nnavegador", "IDOR", "Chaves\nexpostas", "XSS"]
    bar_colors = ["#7C3AED", "#DB2777", "#F43F5E", "#F59E0B", "#06B6D4"]
    fig, ax = plt.subplots(figsize=(6.2, 3.2), dpi=200)
    bars = ax.bar(cats_ord, vals, color=bar_colors, width=0.6, edgecolor="white")
    ax.set_xticks(cats_ord)
    ax.set_xticklabels(cats_label, fontsize=9.5)
    ax.set_ylabel("Achados", fontsize=10)
    ax.tick_params(axis="y", labelsize=9)
    ax.spines[["top", "right"]].set_visible(False)
    ax.set_ylim(0, max(vals) + 1.2)
    for b, v in zip(bars, vals):
        ax.text(b.get_x() + b.get_width() / 2, v + 0.12, str(v), ha="center", va="bottom",
                fontsize=11, fontweight="bold", color="#1F2937")
    fig.tight_layout()
    fig.savefig(orb, bbox_inches="tight", transparent=True)
    plt.close(fig)
    return orc, orb


# ----------------------------------------------------------------------------
# Estilos
# ----------------------------------------------------------------------------
def S(name, **kw):
    return ParagraphStyle(name, leading=kw.pop("leading", 14), **kw)

st_h1   = S("h1", fontName="DejaVu-Bold", fontSize=20, textColor="#1F2937", spaceAfter=4, leading=26)
st_h2   = S("h2", fontName="DejaVu-Bold", fontSize=14.5, textColor=HexColor("#B45309"), spaceBefore=14, spaceAfter=6, leading=19)
st_h3   = S("h3", fontName="DejaVu-Bold", fontSize=11.5, textColor="#1F2937", spaceBefore=8, spaceAfter=3, leading=15)
st_body = S("body", fontName="DejaVu", fontSize=9.6, alignment=TA_JUSTIFY, textColor="#374151", leading=14)
st_body_l = S("bodyl", fontName="DejaVu", fontSize=9.6, alignment=TA_LEFT, textColor="#374151", leading=14)
st_small = S("small", fontName="DejaVu", fontSize=8.6, textColor="#6B7280", leading=12)
st_cell = S("cell", fontName="DejaVu", fontSize=8.4, textColor="#111827", alignment=TA_LEFT, leading=11)
st_cell_file = S("cellf", fontName="DejaVuMono", fontSize=7.4, textColor="#0F4C81", alignment=TA_LEFT, leading=10)
st_code = S("code", fontName="DejaVuMono", fontSize=8.0, textColor="#0F172A", alignment=TA_LEFT, leading=11)
st_issue = S("issue", fontName="DejaVuMono", fontSize=7.0, textColor="#1F2937", alignment=TA_LEFT, leading=9.5)
st_issue_t = S("issuet", fontName="DejaVu-Bold", fontSize=11, textColor=HexColor("#0F4C81"), spaceBefore=14, spaceAfter=3, leading=15)
st_cover_title = S("ct", fontName="DejaVu-Bold", fontSize=26, textColor="#FFFFFF", alignment=TA_CENTER, leading=32)
st_cover_sub = S("cs", fontName="DejaVu", fontSize=12.5, textColor="#D1FAE5", alignment=TA_CENTER, leading=17)


def H(s):
    """Escapa caracteres especiais para XML do ReportLab (mantém quebras)."""
    return html.escape(s, quote=False).replace("\n", "<br/>")


def wrap_pre(text, width=108):
    """Re-fluxa parágrafos longos em blocos Preformatted, preservando estrutura por linha."""
    out = []
    for line in text.split("\n"):
        if len(line) <= width:
            out.append(line)
        else:
            wrapped = textwrap.fill(line, width=width, break_long_words=False, break_on_hyphens=False)
            out.append(wrapped)
    return "\n".join(out)

# ----------------------------------------------------------------------------
# Helpers de fluxo
# ----------------------------------------------------------------------------
def chip(sev):
    label = SEV_LABEL[sev]
    color = HexColor(PAL[sev])
    t = Table([[label]], colWidths=[52])
    ts = S("chip", fontName="DejaVu-Bold", fontSize=7.6, textColor=colors.white, alignment=TA_CENTER, leading=9)
    t.setStyle(TableStyle([
        ("BACKGROUND", (0, 0), (-1, -1), color),
        ("VALIGN", (0, 0), (-1, -1), "MIDDLE"),
        ("TOPPADDING", (0, 0), (-1, -1), 2.5),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 2.5),
        ("LEFTPADDING", (0, 0), (-1, -1), 4),
        ("RIGHTPADDING", (0, 0), (-1, -1), 4),
        ("ROUNDEDCORNERS", [3, 3, 3, 3]),
        ("ALIGN", (0, 0), (-1, -1), "CENTER"),
    ]))
    return [Paragraph(label, ts)]

def finding_block(f, count_total=False):
    sev_cor = HexColor(PAL[f["sev"]])
    header = [
        [chip(f["sev"]),
         Paragraph("<b><font color='#111827'>%s · %s</font></b>" % (H(f["n"]), H(f["titulo"])), st_h3)]
    ]
    ht = Table(header, colWidths=[58, FRAME_W - 62])
    ht.setStyle(TableStyle([
        ("VALIGN", (0, 0), (-1, -1), "TOP"),
        ("LEFTPADDING", (0, 0), (-1, -1), 0),
        ("RIGHTPADDING", (0, 0), (-1, -1), 0),
        ("TOPPADDING", (0, 0), (-1, -1), 1),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 1),
    ]))

    rows = [header]
    if f.get("política"):
        rows.append([Paragraph("<b>Políticas/relacionados:</b> " + H(f["política"]), st_cell), "", ""])
    rows.append([
        Paragraph("<b>Arquivo:linha:</b> <font face='DejaVuMono' color='#0F4C81'>" + H(f["arquivo"]) + "</font>", st_cell), "", ""])

    body = []
    body.append(Paragraph("<b>Trecho de código:</b>", st_cell))
    code_box = Table([[Preformatted(wrap_pre(f["trecho"], 100), st_code)]], colWidths=[FRAME_W - 20])
    code_box.setStyle(TableStyle([
        ("BACKGROUND", (0, 0), (-1, -1), HexColor("#F1F5F9")),
        ("BOX", (0, 0), (-1, -1), 0.5, HexColor("#E2E8F0")),
        ("LEFTPADDING", (0, 0), (-1, -1), 5),
        ("RIGHTPADDING", (0, 0), (-1, -1), 5),
        ("TOPPADDING", (0, 0), (-1, -1), 3),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 3),
    ]))
    body.append(code_box)
    body.append(Spacer(0, 3))
    body.append(Paragraph("<b>Por que é explorável:</b> " + H(f["porque"]), st_cell))
    body.append(Spacer(0, 2))
    body.append(Paragraph("<b>Condições de explorabilidade:</b> <font color='#B45309'>" + H(f["cond"]) + "</font>", st_cell))

    # Tabela aninhada não é trivial; montar como bloco único de parágrafos
    inner = []
    inner.append(ht)
    inner.extend(body)
    box = Table([[inner]], colWidths=[FRAME_W])
    box.setStyle(TableStyle([
        ("BACKGROUND", (0, 0), (-1, -1), HexColor("#FFFFFF")),
        ("BOX", (0, 0), (-1, -1), 1, HexColor("#E2E8F0")),
        ("LINEBEFORE", (0, 0), (0, -1), 3, sev_cor),
        ("LEFTPADDING", (0, 0), (-1, -1), 8),
        ("RIGHTPADDING", (0, 0), (-1, -1), 8),
        ("TOPPADDING", (0, 0), (-1, -1), 6),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 6),
    ]))
    return box

# ----------------------------------------------------------------------------
# Documento
# ----------------------------------------------------------------------------
def header_footer(canv, doc):
    canv.saveState()
    canv.setFont("DejaVu", 7.5)
    canv.setFillColor(HexColor("#9CA3AF"))
    canv.drawString(MARGIN, PAGE_H - 13 * mm, CABECALHO)
    canv.setStrokeColor(HexColor("#E5E7EB"))
    canv.setLineWidth(0.6)
    canv.line(MARGIN, PAGE_H - 15 * mm, PAGE_W - MARGIN, PAGE_H - 15 * mm)
    canv.drawString(MARGIN, 12 * mm, "Confidencial — para uso interno")
    canv.drawRightString(PAGE_W - MARGIN, 12 * mm, "Página %d" % doc.page)
    canv.setStrokeColor(HexColor("#E5E7EB"))
    canv.line(MARGIN, 14.5 * mm, PAGE_W - MARGIN, 14.5 * mm)
    canv.restoreState()

def cover_page(canv, doc):
    canv.saveState()
    # Fundo
    canv.setFillColor(HexColor("#064E3B"))
    canv.rect(0, 0, PAGE_W, PAGE_H, stroke=0, fill=1)
    canv.setFillColor(HexColor("#059669"))
    canv.rect(0, 0, PAGE_W, 34 * mm, stroke=0, fill=1)
    # Título
    canv.setFont("DejaVu-Bold", 27)
    canv.setFillColor(colors.white)
    canv.drawCentredString(PAGE_W / 2, PAGE_H - 95 * mm, "Relatório de Auditoria")
    canv.setFont("DejaVu-Bold", 17)
    canv.drawCentredString(PAGE_W / 2, PAGE_H - 104 * mm, "de Segurança")
    canv.setFont("DejaVu", 13)
    canv.setFillColor(HexColor("#A7F3D0"))
    canv.drawCentredString(PAGE_W / 2, PAGE_H - 118 * mm, "Manejo Orgânico (ManejoORG)")
    canv.restoreState()

def build():
    donut, barras = gerar_graficos()

    doc = BaseDocTemplate(
        OUT_PDF, pagesize=A4,
        leftMargin=MARGIN, rightMargin=MARGIN, topMargin=18 * mm, bottomMargin=18 * mm,
        title="Relatório de Auditoria de Segurança — ManejoORG",
        author="Auditoria de Segurança",
        subject="Auditoria de segurança (5 categorias)",
    )
    frame = Frame(MARGIN, 16 * mm, FRAME_W, PAGE_H - 34 * mm, id="f1")
    doc.addPageTemplates([
        PageTemplate(id="cover", frames=[frame], onPage=cover_page),
        PageTemplate(id="body", frames=[frame], onPage=header_footer),
    ])

    story = []
    template_seq = []

    # ---------------- CAPA ----------------
    story.append(Paragraph("", st_body))
    story.append(Spacer(0, 110 * mm))
    c_title = Paragraph("Relatório de Auditoria de Segurança — Manejo Orgânico (ManejoORG)", st_cover_title)
    # Capa: altera cor do texto de título para branco usando Paragraph em canvas? Usaremos texto branco no canvas via onPage + placeholder
    story.append(Spacer(0, 40 * mm))
    story.append(Paragraph("Auditoria em 5 categorias, reprodutível e com evidências verificadas no código real.", st_cover_sub))
    story.append(Spacer(0, 12 * mm))
    story.append(Paragraph("Data: %s" % date.today().strftime("%d/%m/%Y"), st_cover_sub))

    # ---- marcar capa
    _ = c_title
    template_seq.append("cover")
    template_seq.extend(["body"] * 300)

    # ---------------- INSERIR QUEBRAS E CONTEÚDO ----------------
    # Precisamos chamar nextPageTemplate antes do PageBreak. ReportLab: doc.nextPageTemplate() dentro de story.
    def page_break_to(name):
        from reportlab.platypus import NextPageTemplate
        return [NextPageTemplate(name), PageBreak()]

    # Volta temporária: adicionamos elementos de capa simples via canvas (já desenhado). Colocar textos na capa no onPage não é
    # dinâmico; faremos a capa com flowables por cima do fundo.
    story = []

    # CAPA com texto branco desenhado em flowables transparentes
    story.append(Spacer(0, 100 * mm))
    story.append(Paragraph('<font color="white" size="26"><b>Relatório de Auditoria de Segurança</b></font>', st_body))
    story.append(Paragraph('<font color="#A7F3D0" size="15">Manejo Orgânico (ManejoORG)</font>', st_body))
    story.append(Spacer(0, 16 * mm))
    story.append(Paragraph('<font color="#ECFDF5" size="12">Auditoria de segurança em 5 categorias, com evidência verificada no código real — sem especulação.</font>', st_body))
    story.append(Spacer(0, 10 * mm))
    story.append(Paragraph('<font color="#ECFDF5" size="11">Data: %s   ·   Escopo: todo o monorepo (backend Go, frontend React/PWA, banco Supabase, deploy)</font>' % date.today().strftime("%d/%m/%Y"), st_body))
    story.extend(page_break_to("body"))

    # ---------------- RESUMO EXECUTIVO ----------------
    sev_counts = {s: sum(1 for f in FINDINGS if f["sev"] == s) for s in SEV_ORDER}
    total = sum(sev_counts.values())
    story.append(Paragraph("1. Resumo Executivo", st_h1))
    story.append(HRFlowable(width="100%", thickness=1.4, color=HexColor("#B45309"), spaceAfter=8))
    story.append(Paragraph(
        f"O projeto Manejo Orgânico (ManejoORG) é uma plataforma de gestão de agricultura orgânica certificada "
        f"(back thin: Go/Gin + Postgres/Supabase 'fat database', frontend React 19 PWA, IA e WhatsApp). A auditoria "
        f"examinou isolamento de tenant/dono (RLS e RPCs), autorização de painel (navegador vs servidor), IDOR em "
        f"todos os handlers/RPCs, segredos embutidos (inclusive histórico git) e inputs sem tratamento (XSS). "
        f"Foram identificados <b>{total} achados</b>: <font color='#B91C1C'><b>{sev_counts['critica']} críticos</b></font>, "
        f"<font color='#EA580C'><b>{sev_counts['alta']} altos</b></font>, "
        f"<font color='#D97706'><b>{sev_counts['media']} médios</b></font> e "
        f"<font color='#2563EB'><b>{sev_counts['baixa']} baixos</b></font>, mais <b>{len(STRONG_POINTS)} pontos fortes</b> verificados (seção 3).",
        st_body))
    story.append(Spacer(0, 8))

    img_donut = Image(donut, width=105 * mm, height=77 * mm)
    img_bar = Image(barras, width=118 * mm, height=61 * mm)
    tbl = Table([[img_donut, img_bar]], colWidths=[FRAME_W * 0.44, FRAME_W * 0.56])
    tbl.setStyle(TableStyle([("VALIGN", (0, 0), (-1, -1), "MIDDLE"),
                             ("LEFTPADDING", (0, 0), (-1, -1), 2), ("RIGHTPADDING", (0, 0), (-1, -1), 2)]))
    story.append(tbl)
    story.append(Spacer(0, 4))
    story.append(Paragraph("<i>Figura: distribuição dos achados por severidade (rosca) e por categoria (barras). Paleta: crítica #B91C1C, alta #EA580C, média #D97706, baixa #2563EB, ponto forte #059669.</i>", st_small))

    # ---------------- METODOLOGIA ----------------
    story.append(Paragraph("2. Escopo, Stack e Metodologia", st_h1))
    story.append(HRFlowable(width="100%", thickness=1.4, color=HexColor("#B45309"), spaceAfter=6))
    story.append(Paragraph(
        "<b>Stack detectada:</b> monorepo com backend Go 1.25 (Gin; autenticação JWT ES256 via JWKS do "
        "Supabase — middleware RequireAuth/RequireAdmin), banco Supabase/Postgres 17 com RLS por "
        "auth.uid() e RPCs SECURITY DEFINER como camada de negócio, frontend React 19 + Vite PWA "
        "(@supabase/supabase-js, gateway REST com allowlist), bot WhatsApp (MCP/FSM) e deploy via "
        "Docker Compose, Azure Bicep, Vercel e GitHub Actions.", st_body))
    story.append(Spacer(0, 4))
    story.append(Paragraph(
        "<b>Mapeamento das categorias para a stack:</b><br/>"
        "<b>1) Banco sem tranca</b> → RLS do Supabase e RPCs SECURITY DEFINER que devem isolar tenant/dono — "
        "políticas ausentes, largas (USING(true) ou pmo_ativo_id) ou sem checagem de posse.<br/>"
        "<b>2) Permissão no navegador</b> → cruzamento do gate de papel do React (AdminRoute/isAdmin) com a "
        "autorização nas rotas HTTP do Go (main.go) e nas RPCs consumidas pelo painel.<br/>"
        "<b>3) IDOR</b> → percorridos todos os handlers Go, o gateway (allowlist 10 RPCs), as ferramentas MCP "
        "e as RPCs Supabase que recebem ID por path/query/body.<br/>"
        "<b>4) Chaves expostas</b> → .env* em disco x git ls-files x histórico git (git log -S), compose, "
        "Bicep, CI, scripts, docs e bundle do frontend.<br/>"
        "<b>5) XSS</b> → varredura de sinks no React (dangerouslySetInnerHTML/eval/href de URL controlável), "
        "e e-mails/Templates/HTML no backend e edge function.", st_body))
    story.append(Spacer(0, 4))
    story.append(Paragraph(
        "<b>Método</b>: leitura integral dos arquivos relevantes e verificação linha a linha (comando e "
        "evidência citados em cada achado). Achados marcados como <i>condicional</i> exigem condição "
        "explícita para exploração. Foram excluídos duplicados de git worktree (.claude/worktrees) e "
        "artefatos de build (dist/). Repositório: público (github.com/thebrunm97/manejo-org).", st_body))

    story.append(Paragraph("3. Pontos Fortes (verificado e correto)", st_h1))
    story.append(HRFlowable(width="100%", thickness=1.4, color=HexColor("#B45309"), spaceAfter=6))
    for i, (t, ref, desc) in enumerate(STRONG_POINTS, 1):
        ref_cell = Paragraph("<font face='DejaVuMono' color='#0F4C81' size='8'>" + H(ref) + "</font>", st_cell_file)
        content = [
            Paragraph("<b>%d. %s</b>" % (i, H(t)), st_h3),
            ref_cell,
            Paragraph(desc, st_cell),
        ]
        box = Table([[
            chip("ponto"),
            content,
        ]], colWidths=[58, FRAME_W - 62])
        box.setStyle(TableStyle([
            ("BOX", (0, 0), (-1, -1), 1, HexColor("#D1FAE5")),
            ("BACKGROUND", (0, 0), (-1, -1), HexColor("#F0FDF4")),
            ("VALIGN", (0, 0), (-1, -1), "TOP"),
            ("LEFTPADDING", (0, 0), (-1, -1), 6),
            ("RIGHTPADDING", (0, 0), (-1, -1), 6),
            ("TOPPADDING", (0, 0), (-1, -1), 5),
            ("BOTTOMPADDING", (0, 0), (-1, -1), 5),
        ]))
        story.append(KeepTogether([Spacer(0, 3), box]))

    story.append(Paragraph("4. Pontos Fracos (riscos centrais)", st_h1))
    story.append(HRFlowable(width="100%", thickness=1.4, color=HexColor("#B45309"), spaceAfter=6))
    story.append(Paragraph(
        "<b>1. Segredos de produção vivos no histórico público (crítico).</b> A service role do Supabase, "
        "senha do pooler, chaves de LLM, Evolution/WhatsApp e Azure estão em commits antigos do repo público "
        "e não foram rotacionadas — exposição permanente e de impacto máximo.<br/><br/>"
        "<b>2. Isolamento financeiro furado em dois pontos (crítico).</b> o chain "
        "update_profile(pmo_ativo_id)→policy de transacoes_financeiras e o IDOR do bot (balanço via service "
        "key) permitem ler/gravar o ledger de outro produtor.<br/><br/>"
        "<b>3. Gravações cross-tenant nas RPCs de sincronização de PMO (alto).</b> upsert_pmo_relacoes e "
        "sync_culturas_anuais não forçam o pmo_id validado ao inserir, adulterando dados alheios.<br/><br/>"
        "<b>4. Painel admin protegido só na UI para várias RPCs (médio).</b> get_dashboard_stats, "
        "get_propriedade_metrics e restart_queue_job executam para qualquer authenticated/anon — o backend "
        "não valida is_admin.<br/><br/>"
        "<b>5. Rastreabilidade pública expõe PII (médio).</b> endereço cadastral completo e nome de produtor "
        "para qualquer código de lote.", st_body))

    story.append(Paragraph("5. Achados Detalhados por Categoria", st_h1))
    story.append(HRFlowable(width="100%", thickness=1.4, color=HexColor("#B45309"), spaceAfter=6))
    for cat in ["1", "2", "3", "4", "5"]:
        fs = [f for f in FINDINGS if f["cat"] == cat]
        story.append(Spacer(0, 4))
        story.append(Paragraph(f"<b>5.{cat}. {CATS[cat]}</b>", st_h2))
        for f in fs:
            story.append(KeepTogether([Spacer(0, 3), finding_block(f)]))

    # Tabela resumo
    story.append(Paragraph("5.6 Tabela-resumo de achados", st_h3))
    data = [[Paragraph("<b>Severidade</b>", st_cell), Paragraph("<b>Arquivo:linha</b>", st_cell), Paragraph("<b>Descrição</b>", st_cell)]]
    for f in sorted(FINDINGS, key=lambda x: (SEV_ORDER.index(x["sev"]), x["n"])):
        data.append([chip(f["sev"])[0],
                     Paragraph(f"<font face='DejaVuMono' size='7'>" + H(f["arquivo"]) + "</font>", st_cell_file),
                     Paragraph(H(f['n']) + " — " + H(f["titulo"]), st_cell)])
    t = Table(data, colWidths=[60, 150, FRAME_W - 214], repeatRows=1)
    t.setStyle(TableStyle([
        ("BACKGROUND", (0, 0), (-1, 0), HexColor("#0F766E")),
        ("TEXTCOLOR", (0, 0), (-1, 0), colors.white),
        ("FONTNAME", (0, 0), (-1, 0), "DejaVu-Bold"),
        ("ROWBACKGROUNDS", (0, 1), (-1, -1), [colors.white, HexColor("#F1F5F9")]),
        ("GRID", (0, 0), (-1, -1), 0.5, HexColor("#E2E8F0")),
        ("VALIGN", (0, 0), (-1, -1), "MIDDLE"),
        ("LEFTPADDING", (0, 0), (-1, -1), 5),
        ("RIGHTPADDING", (0, 0), (-1, -1), 5),
        ("TOPPADDING", (0, 0), (-1, -1), 3),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 3),
    ]))
    story.append(t)

    story.append(Paragraph("6. Recomendações Priorizadas", st_h1))
    story.append(HRFlowable(width="100%", thickness=1.4, color=HexColor("#B45309"), spaceAfter=6))
    for prio, txt in RECOMMENDATIONS:
        cor = "#DC2626" if prio == "P1" else ("#D97706" if prio == "P2" else "#2563EB")
        row = [[Paragraph(f"<font face='DejaVu-Bold' size='11' color='{cor}'>{prio}</font>", st_cell),
                Paragraph(H(txt), st_cell)]]
        tt = Table(row, colWidths=[24, FRAME_W - 28])
        tt.setStyle(TableStyle([
            ("VALIGN", (0, 0), (-1, -1), "TOP"),
            ("BOX", (0, 0), (-1, -1), 0.6, HexColor("#E2E8F0")),
            ("LINEBEFORE", (0, 0), (0, -1), 3, HexColor(cor)),
            ("LEFTPADDING", (0, 0), (-1, -1), 6),
            ("RIGHTPADDING", (0, 0), (-1, -1), 6),
            ("TOPPADDING", (0, 0), (-1, -1), 5),
            ("BOTTOMPADDING", (0, 0), (-1, -1), 5),
            ("BACKGROUND", (0, 0), (-1, -1), colors.white),
        ]))
        story.append(Spacer(0, 3))
        story.append(tt)

    story.append(Paragraph("7. Issues para o GitHub", st_h1))
    story.append(HRFlowable(width="100%", thickness=1.4, color=HexColor("#B45309"), spaceAfter=6))
    story.append(Paragraph(
        "Issues prontas para copiar e colar. Labels sugeridas: <b>security</b> + severidade. "
        "Achados triviais do mesmo tema foram agrupados.", st_small))
    for i, iss in enumerate(ISSUES, 1):
        bloc = [
            "--- ISSUE %d ---" % i,
            "",
            "### Título",
            iss["titulo"],
            "",
            "### Labels",
            iss["labels"],
            "",
            "--- CONTEÚDO DA ISSUE (abaixo) ---",
        ]
        for line in iss["corpo"].split("\n"):
            bloc.append(line.rstrip())
        bloc.append("")
        bloc.append("--- FIM ISSUE %d ---" % i)
        text = "\n".join(bloc)
        pre = Preformatted(wrap_pre(text), st_issue)
        wrap = Table([[pre]], colWidths=[FRAME_W])
        wrap.setStyle(TableStyle([
            ("BOX", (0, 0), (-1, -1), 0.8, HexColor("#BFDBFE")),
            ("BACKGROUND", (0, 0), (-1, -1), HexColor("#F8FAFC")),
            ("LEFTPADDING", (0, 0), (-1, -1), 4),
            ("RIGHTPADDING", (0, 0), (-1, -1), 4),
            ("TOPPADDING", (0, 0), (-1, -1), 4),
            ("BOTTOMPADDING", (0, 0), (-1, -1), 4),
        ]))
        story.append(Spacer(0, 6))
        story.append(KeepTogether([wrap]))

    doc.build(story)


if __name__ == "__main__":
    build()
    print("PDF gerado em:", OUT_PDF)