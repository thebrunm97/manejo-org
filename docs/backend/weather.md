# ☁️ Módulo de Clima — Sincronização e Resiliência

O módulo de clima fornece previsões meteorológicas de alta precisão para auxiliar o produtor na tomada de decisão (ex: melhor momento para aplicação de caldas ou plantio).

---

## 1. Estratégia de Integração

O backend Go implementa uma arquitetura tolerante a falhas para garantir que a instabilidade de rede ou limites de quota de APIs não interrompam o serviço:

1.  **Provedor Principal (Open-Meteo)**: Utilizado por ser gratuito para uso não-comercial, oferecer dados do modelo ECMWF e não exigir API Keys (evitando falhas por expiração de tokens).
2.  **Fallback (WeatherAPI)**: Caso o Open-Meteo falhe após as tentativas de retry, o sistema alterna automaticamente para o WeatherAPI (exige `WEATHER_API_KEY`).
3.  **Mecanismo de Retry**:
    *   **Estratégia**: Exponential Backoff.
    *   **Configuração**: 3 tentativas com atraso base de 2 segundos.
    *   **Timeout**: 30 segundos por requisição (ajustado para latência rural).

---

## 2. Resolução de Localização

Diferente de apps urbanos que usam nomes de cidades, o ManejoORG prioriza coordenadas exatas para micro-clima:

1.  **Prioridade 1 (Lat/Lng)**: O bot extrai as coordenadas da propriedade vinculada ao PMO do usuário.
2.  **Prioridade 2 (Address Parsing)**: Se as coordenadas forem nulas, o sistema tenta extrair a cidade/estado do endereço cadastrado para realizar a busca nominal.
3.  **Interface Unificada**: Independentemente do provedor, o dado é normalizado no `WeatherData` struct do Go para que o frontend/bot recebam sempre o mesmo formato.

---

## 3. Mapeamento de Condições (WMO Codes)

O Open-Meteo utiliza códigos numéricos da WMO (World Meteorological Organization). O `internal/weather/client.go` realiza a tradução para textos amigáveis e ícones compatíveis com o padrão WeatherAPI (usado no frontend):

| Código WMO | Descrição Interna | Ícone Equivalente |
|------------|-------------------|-------------------|
| 0 | Céu Limpo | Day 113 |
| 1, 2, 3 | Nublado / Parcial | Day 116/119 |
| 51-65 | Chuva / Chuvisco | Day 266/296 |
| 95-99 | Tempestade | Day 389 |

---

## 4. Como Testar
Para validar mudanças no módulo de clima sem depender do agendador automático:
```bash
go run cmd/tester/weather/main.go
```
*(Certifique-se de disparar com uma localização válida no formato "lat,lng")*
