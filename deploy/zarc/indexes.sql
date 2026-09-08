-- deploy/zarc/indexes.sql — criados DEPOIS da carga, por zarc_build.py.
--
-- Um índice só: a consulta do bot é sempre município + cultura. safra_ini fica
-- deliberadamente fora dele, porque toda consulta cobre `safra_ini IN (0, vigente)`
-- e não uma safra só — com duas safras no arquivo, o filtro residual sobre as
-- poucas linhas que sobram é mais barato do que uma terceira coluna no índice.
CREATE INDEX idx_janelas_lookup ON janelas (geocodigo, cultura_id);

-- Alimenta CulturasDisponiveis, usada na resposta de "cultura não zoneada".
CREATE INDEX idx_janelas_municipio ON janelas (geocodigo);

CREATE INDEX idx_municipios_busca ON municipios (nome_norm, uf);
CREATE INDEX idx_culturas_busca   ON culturas (nome_norm);
