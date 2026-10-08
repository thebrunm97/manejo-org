# Zoneamento agroecológico de Moçambique e janela de sementeira

Moçambique **não tem um equivalente ao [[zarc-janela-de-plantio]]**: não existe uma
tábua oficial de risco climático por distrito, nem vínculo dela com crédito ou seguro
agrícola (a articulação com programas como o SUSTENTA ainda está em curso). O que o
país usa é o **Zoneamento Agroecológico (ZAE)** do IIAM: 10 zonas, de R1 a R10,
definidas por chuva, temperatura, solo e altitude, com calendários publicados por
zona em relatórios técnicos e pelos serviços de extensão.

| | ZARC (Brasil) | ZAE (Moçambique) |
|---|---|---|
| Unidade | município | zona agroecológica (abrange vários distritos, às vezes parte de um) |
| Dado | risco climático 20/30/40% por decêndio, em portaria | janela de sementeira por época (1ª, 2ª), sem percentual de risco |
| Peso | evidência de auditoria; condição para crédito e seguro | referência técnica |
| Acesso | dados abertos do MAPA | relatórios do IIAM; calendário da FAO por zona |

## Épocas

- **1ª época**: sequeiro, com as chuvas (no sul, a partir de outubro; no norte, mais
  tarde). A data efetiva depende de as chuvas "pegarem": semear após uma chuvada
  isolada seguida de semanas secas perde a semente (**falso início**).
- **2ª época**: fim das chuvas ou com rega, sobretudo nas baixas e vales.

## Onde isso vive no sistema

O bot responde "quando semear X?" para machambas em Moçambique com a mesma
ferramenta `consultar_janela_plantio` do Brasil, que decide pelo país da
propriedade (`propriedades.pais`; em MZ, `cidade` = distrito e `uf` = província
ISO 3166-2:MZ):

- Tabelas em `pmo-bot-go/internal/zae/dados/` — zonas e janelas geradas do **FAO Crop
  Calendar** (`scripts/ingestion/fao_cropcalendar_mz.py`) e mapeamento distrito → zona
  curado do texto da FAO. Toda linha cita a fonte; sem revisor agronômico local, a
  citação é a garantia de que nada foi inventado.
- A resposta é sempre marcada como **referência não oficial**, sem percentual de risco.
- Indicador de **início das chuvas** (Open-Meteo, últimos 30 dias + previsão): chuvas
  estabelecidas, início recente, falso início ou ainda não — sempre indicativo.

## Limitações conhecidas

- A FAO cobre poucas culturas por zona (~72 combinações no país; R9 sem dado; tomate,
  cebola e couve ausentes). O bot responde "sem dado" em vez de inventar.
- Vários distritos cruzam 2 ou 3 zonas (ex.: Manhiça em R1, R2 e R3); o bot mostra as
  opções. Precisão por coordenada (polígonos das zonas) fica para depois.
- Licença do calendário da FAO para uso comercial a confirmar (o Banco Mundial o
  distribui como CC BY 4.0).

Relacionado: [[certificacao-organica-mocambique]], [[zarc-janela-de-plantio]],
[[ciclo-de-cultivo]].
