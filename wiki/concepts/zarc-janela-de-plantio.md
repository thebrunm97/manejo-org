# ZARC e janela de plantio

O **Zoneamento Agrícola de Risco Climático** é a política pública que define, por
município e cultura, em que épocas do ano o plantio tem risco climático aceitável.
O MAPA publica em portarias, por safra, uma *tábua de risco*: para cada combinação
de município × cultura × tipo de solo × ciclo × manejo, os 36 decêndios do ano
recebem 20%, 30%, 40% ou "não indicado".

Os percentuais são probabilidade de perda por clima — 20% é a janela mais segura.

## Por que isso importa para o PMO

O ZARC é a base que lastreia **crédito rural e seguro agrícola**. Plantar fora da
janela zoneada custa o direito ao Proagro e ao seguro subvencionado. Isso o torna
uma fonte com peso documental: numa auditoria, "plantei nesta data porque a Portaria
X indica risco de 20% para o meu município" é evidência, não opinião — diferente de
uma recomendação genérica de literatura.

É por isso que a resposta do bot **sempre cita a Portaria**.

## O que o ZARC não cobre

Limitação relevante para o público do Manejo.ORG, que é majoritariamente de
horticultura: o ZARC zoneia **cebola, alho, batata, mandioca, melancia, abacaxi,
mamão, banana, café, citros, uva, maçã, pêssego, cacau e açaí**, entre outras — mas
**não zoneia tomate, alface, couve, cenoura nem brócolis**.

Para essas culturas não existe janela oficial do MAPA. Desde a referência de
plantio para olerícolas (pacote `internal/plantioref`, separado
deliberadamente de `internal/zarc` para não misturar dado oficial com
literatura), o bot tem uma segunda fonte pra esse caso: uma tabela embarcada
(Embrapa Hortaliças/Sebrae, por região) com janela sugerida para tomate,
alface, cenoura e outras olerícolas fora do escopo do ZARC. É referência de
literatura, não documento de crédito rural/seguro — a resposta do bot marca
essa diferença. Fora dessa tabela, a recomendação ainda depende de
[[rag-e-base-de-conhecimento]], com a literatura curada.

## Decêndios

O ano é dividido em 36 decêndios: três por mês, cobrindo os dias 1–10, 11–20 e
21–fim do mês. O terceiro absorve a sobra, então varia de 8 a 11 dias.

Uma janela **atravessa a virada do ano** com frequência — o sorgo 2ª safra em João
Neiva/ES vai do decêndio 27 (fim de setembro) ao 6 (fim de fevereiro), com o miolo
do ano zerado. Tratar os 36 decêndios como uma linha do tempo com começo e fim, em
vez de um ciclo, parte a janela em duas na hora de mostrar ao produtor.

## Onde isso vive no sistema

Base local em SQLite somente-leitura (~400 MB, 3,2 milhões de janelas, todos os
5.573 municípios), montada no contêiner do [[pmo-bot-go]] e exposta ao agente pela
ferramenta `consultar_janela_plantio`. Não usa [[supabase-postgres]]: é dado público
e reconstruível, que não tem por que dividir banco com o dado do produtor.

Construção, atualização de safra e detalhes da fonte: `deploy/zarc/README.md`.

Relacionado: [[plano-de-manejo-organico]], [[ciclo-de-cultivo]],
[[roteador-de-agentes-ia]], [[rag-e-base-de-conhecimento]].
