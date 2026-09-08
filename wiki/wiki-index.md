# Wiki Manejo.ORG — índice

Base de conhecimento do Manejo.ORG no estilo *second brain*: notas curtas,
atômicas e interligadas por wikilinks em colchetes duplos, otimizadas para serem
carregadas em contexto por um agente de IA sem arrastar o repositório inteiro.

## Como navegar

- **`concepts/`** — o domínio e a regulação. Por que o software existe.
- **`entities/`** — o modelo de dados. O que o sistema guarda.
- **`components/`** — o software real. Onde o código está.
- **`RAW/`** — material bruto não destilado. Ver `RAW/README.md`.

Cada nota de componente aponta para caminhos reais de arquivo, verificados
contra o código na data indicada no rodapé da nota.

## Conceitos

- [[agricultura-organica]] — a base agronômica e legal.
- [[certificacao-organica]] — Lei 10.831, Decreto 6.323 e os três mecanismos de garantia.
- [[spg-sistema-participativo-de-garantia]] — a certificação por confiança coletiva.
- [[plano-de-manejo-organico]] — o PMO como documento obrigatório.
- [[caderneta-de-campo]] — o registro diário que sustenta a auditoria.
- [[producao-paralela]] — orgânico e convencional na mesma propriedade.
- [[rastreabilidade]] — do canteiro ao QR Code público.
- [[compliance-de-insumos]] — validação dinâmica do que pode entrar na lavoura.
- [[offline-first]] — por que o campo não tem sinal.
- [[rag-e-base-de-conhecimento]] — como a IA responde com base na norma.

## Entidades

- [[produtor]] · [[organizacao]]
- [[propriedade]] · [[talhao]] · [[canteiro]] · [[ciclo-de-cultivo]]
- [[pmo]] · [[registro-de-caderno]] · [[lote-de-rastreabilidade]]
- [[demanda-coletiva]] · [[transacao-financeira]]

## Componentes

- [[pmo-frontend]] — PWA React, o dashboard.
- [[pmo-bot-go]] — backend Go, o orquestrador do WhatsApp.
- [[supabase-postgres]] — banco, RLS e RPCs atômicas.
- [[roteador-de-agentes-ia]] — classificação de intenção e agentes especialistas.
- [[gateway-whatsapp]] — Evolution API e o webhook.
- [[motor-de-sincronizacao-offline]] — fila IndexedDB e reconciliação.
- [[mapa-e-geoprocessamento]] — MapLibre, desenho de talhões e Earth Engine.
- [[legado-python]] — o que sobrou do bot original.

## Convenções

1. Uma nota = um assunto. Se precisar de dois títulos, são duas notas.
2. Wikilink sempre aponta para o nome do arquivo sem extensão, em kebab-case.
3. Nota de componente cita caminho de arquivo; nota de conceito cita norma.
4. Nada de duplicar código na wiki — aponte para o arquivo.
