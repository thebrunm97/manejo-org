# ADR-005: Migração WeatherAPI → Open-Meteo

## Status: Aceito
## Data: 2026-03-30

## Contexto
A WeatherAPI fornecia previsões consistentemente imprecisas para regiões agrícolas rurais do Brasil. Casos documentados mostraram divergências críticas (ex: 84% de chance de chuva prevista vs. ~5% real), impactando diretamente as decisões de manejo dos produtores (pulverização, colheita).

A cobertura de estações meteorológicas da WeatherAPI em zonas rurais brasileiras é limitada, exigindo uma transição para modelos globais de alta resolução.

## Decisão
Migrar a fonte de dados meteorológicos do backend (`pmo-bot-go`) para o **Open-Meteo**, utilizando o modelo **ECMWF IFS (9km)** para previsões mais precisas no interior do Brasil.

## Justificativa
- **Precisão Superior:** Modelos ECMWF e GFS são referências globais e possuem melhor performance em dados de precipitação para o hemisfério sul rural.
- **Eficiência de Custo:** Open-Meteo é gratuito para uso não comercial até 10k chamadas/dia e não exige gerenciamento de API keys.
- **Roadmap Agrícola:** Nativo suporte a métricas como evapotranspiração (ET0), umidade do solo e índice UV, essenciais para a evolução do app (v2/v3).
- **Compatibilidade:** A estrutura do JSONB no banco de dados (`pmo_clima`) e a API do frontend foram preservadas através de uma camada de conversão no cliente Go.
- **Precisão por Coordenada:** Open-Meteo exige lat/lng, o que força o sistema a usar a localização exata da propriedade/talhão em vez de apenas o nome da cidade.

## Consequências
- **(+) Qualidade:** Previsões de chuva significativamente mais confiáveis para o produtor.
- **(+) Simplicidade:** Remoção da dependência de `WEATHER_API_KEY` (embora mantida a suporte a lat/lng legado).
- **(+) Escalabilidade:** Facilidade de migração para plano comercial se necessário (€29/mês para alto volume).
- **(-) Mapeamento Manual:** Necessidade de converter `weather_code` (WMO) para ícones e textos compatíveis com o frontend atual.
- **(-) Dependência de Coordenadas:** PMOs sem latitude/longitude configurada não receberão atualizações climáticas (mitigado pelo fallback para coordenadas de talhões).

## Implementação
- Arquivo modificado: `internal/weather/client.go` (implementação do fetch e conversão)
- Arquivo modificado: `internal/supabase/client.go` (melhoria na descoberta de coordenadas)
- Formato JSONB mantido: `previsao_dias` continua com estrutura `date` e `day`.
