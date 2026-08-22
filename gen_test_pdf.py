"""
Gera um PDF de teste para validar o pipeline RAG E2E.
Contém ~2 páginas com conteúdo de agricultura orgânica e uma frase-chave de verificação.
"""
from fpdf import FPDF

pdf = FPDF()
pdf.set_auto_page_break(auto=True, margin=15)

# ===== PÁGINA 1 =====
pdf.add_page()
pdf.set_font("Helvetica", "B", 16)
pdf.cell(0, 10, "Guia de Boas Praticas - Agricultura Organica", ln=True, align="C")
pdf.ln(5)

pdf.set_font("Helvetica", "", 11)

page1_text = """A agricultura organica e um sistema de producao que visa a sustentabilidade economica, ecologica e social. 
Este guia apresenta as principais praticas recomendadas para produtores que desejam iniciar ou aprimorar 
sua producao organica, seguindo os principios estabelecidos pela legislacao brasileira (Lei 10.831/2003) 
e pelas normas internacionais de certificacao.

1. PREPARACAO DO SOLO

O solo e a base de toda producao agricola. Na agricultura organica, o manejo do solo deve priorizar 
a manutencao e melhoria de sua fertilidade natural. Recomenda-se a utilizacao de compostos organicos, 
adubacao verde com leguminosas fixadoras de nitrogenio, e rotacao de culturas para manter a diversidade 
biologica do solo. A cobertura morta (mulching) e uma pratica essencial para conservacao da umidade 
e controle de ervas espontaneas.

A analise periodica do solo (a cada 6 meses no primeiro ano, depois anualmente) permite ajustar 
as praticas de manejo conforme as necessidades especificas de cada area. Os parametros mais importantes 
a serem monitorados incluem pH, materia organica, macro e micronutrientes, e capacidade de troca cationica (CTC).

2. CONTROLE BIOLOGICO DE PRAGAS

O manejo integrado de pragas (MIP) na agricultura organica prioriza o equilibrio do ecossistema 
em detrimento do uso de substancias quimicas sinteticas. As principais estrategias incluem:

- Uso de inimigos naturais (predadores, parasitoides e patogenos)
- Armadilhas com feromonios para monitoramento e controle
- Plantas repelentes e atraentes (consorcio biodiverso)
- Caldas naturais (calda bordalesa, calda sulfocalcica, nim)
- Barreiras fisicas e manejo cultural

O monitoramento regular das lavouras e fundamental para identificacao precoce de problemas 
fitossanitarios e tomada de decisao sobre intervencoes necessarias.

3. CERTIFICACAO E RASTREABILIDADE

Para comercializar produtos como organicos no Brasil, o produtor deve estar vinculado a um 
Organismo de Avaliacao da Conformidade (OAC) credenciado pelo MAPA, ou participar de uma 
Organizacao de Controle Social (OCS) para venda direta. A rastreabilidade de toda a cadeia 
produtiva e obrigatoria, desde a aquisicao de insumos ate a entrega ao consumidor final.

Os registros devem incluir: data de plantio, variedade, area cultivada, insumos utilizados 
(com nota fiscal), praticas de manejo realizadas, volumes colhidos e destino da producao."""

pdf.multi_cell(0, 6, page1_text)

# ===== PÁGINA 2 =====
pdf.add_page()
pdf.set_font("Helvetica", "B", 14)
pdf.cell(0, 10, "4. RECURSOS HIDRICOS E IRRIGACAO", ln=True)
pdf.ln(3)

pdf.set_font("Helvetica", "", 11)

page2_text = """A gestao eficiente dos recursos hidricos e um pilar da producao organica sustentavel. 
Os sistemas de irrigacao por gotejamento e microaspersao sao os mais recomendados por sua eficiencia 
no uso da agua e menor risco de disseminacao de doencas foliares.

O reuso de agua e a captacao de agua da chuva sao praticas incentivadas que contribuem para 
a sustentabilidade hidrica da propriedade. Sistemas de tratamento de efluentes com wetlands 
construidos (zonas de raizes) sao uma alternativa eficaz e de baixo custo.

5. VERIFICACAO DE INTEGRIDADE DO SISTEMA

O codigo de verificacao para este teste e UVA-9911-AMARELO. Este documento existe exclusivamente 
para validar o pipeline de embedding BGE-M3 em producao. Qualquer sistema de busca semantica 
que processe este documento corretamente deve ser capaz de retornar este trecho quando questionado 
sobre codigos de verificacao ou validacao de pipeline.

6. COMERCIALIZACAO E MERCADO

Os canais de comercializacao mais comuns para produtos organicos incluem:

- Feiras livres e feiras organicas
- Cestas por assinatura (CSA - Comunidade que Sustenta a Agricultura)
- Programas governamentais (PNAE, PAA)
- Cooperativas de produtores
- Vendas diretas na propriedade (agroturismo)
- Plataformas digitais e e-commerce

O valor agregado dos produtos organicos permite margens superiores em relacao aos convencionais, 
porem exige investimento em certificacao, marketing e logistica diferenciada para manter 
a integridade do produto ate o consumidor.

7. CONSIDERACOES FINAIS

A transicao para a agricultura organica e um processo gradual que requer planejamento, 
capacitacao tecnica e comprometimento do produtor. Os beneficios ambientais, sociais e economicos 
a medio e longo prazo justificam os desafios iniciais. O acompanhamento tecnico especializado 
e a participacao em redes de produtores organicos sao fatores determinantes para o sucesso 
da atividade.

Para mais informacoes, consulte os materiais da Embrapa Agrobiologia e do MAPA sobre 
producao organica no Brasil. Mantenha seus registros atualizados e participe ativamente 
das atividades de extensao rural em sua regiao."""

pdf.multi_cell(0, 6, page2_text)

# Salvar
output_path = "test_rag_manga7734.pdf"
pdf.output(output_path)
print(f"PDF gerado com sucesso: {output_path}")
