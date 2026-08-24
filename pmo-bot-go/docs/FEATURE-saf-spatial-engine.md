## 🧠 Brainstorm: Motor de Geração Espacial de SAFs

### Context
Precisamos de um mecanismo para gerar automaticamente a malha de plantio (pontos das árvores ou linhas de cultivo) a partir de um polígono base (talhão) desenhado pelo usuário. A geração precisa respeitar os espaçamentos (ex: 4m x 3m), distribuição de estratos e sucessão ecológica. O sistema deve calcular densidades e renderizar dezenas de milhares de pontos no MapLibre sem travar o navegador.

---

### Option A: Geração via Frontend (Turf.js) com Persistência em Lote
O cálculo da malha de plantio é feito inteiramente no navegador usando a biblioteca espacial `Turf.js` assim que o usuário desenha o polígono. O GeoJSON resultante é visualizado instantaneamente. Ao confirmar, o frontend envia os milhares de pontos (árvores) em lote para o backend armazenar no PostGIS.

✅ **Pros:**
- Preview em tempo real instantâneo e sem delay (UX excelente).
- Desonera o servidor (o processamento pesado e trigonometria ficam no cliente).
- Interatividade avançada: fácil rotacionar o azimute do plantio com o mouse e ver o resultado na hora.

❌ **Cons:**
- Limite de memória/performance do navegador: pode travar em áreas gigantescas (milhões de pontos).
- Payload de rede enorme no momento de salvar (POST de dezenas de milhares de coordenadas).
- Regras de negócio travadas no frontend; difícil acionar a mesma lógica por outras vias (ex: mobile ou integração de API).

📊 **Effort:** Low | **Medium** | High

---

### Option B: Geração 100% PostGIS (PL/pgSQL + Funções Espaciais)
O frontend envia apenas o polígono do talhão, o azimute desejado e os parâmetros (espaçamento, espécies). O banco de dados executa a lógica em Procedures internas, usando funções como `ST_GeneratePoints`, intersecções de grids, etc., para popular as tabelas de elementos automaticamente.

✅ **Pros:**
- Performance brutal para geração de dados em massa (tudo ocorre dentro do DB).
- Tráfego de rede ínfimo no momento da criação (apenas o polígono e alguns JSON de regras viajam na rede).
- Consistência absoluta (única fonte de verdade transacional).

❌ **Cons:**
- Preview em tempo real mais lento (exige request ao backend a cada micro-ajuste do polígono).
- Lógica de negócio complexa escondida em SQL/PLpgSQL, dificultando versionamento, testes automatizados e debug.
- Em cenários de altíssima concorrência, cálculos espaciais pesados podem sobrecarregar a CPU do banco de dados.

📊 **Effort:** Low | Medium | **High**

---

### Option C: Motor Híbrido (Backend Go) + Renderização MVT (Vector Tiles)
O frontend desenha o polígono e envia para o backend (Golang). O Go executa a lógica de negócio espacial (podendo orquestrar chamadas focadas ao PostGIS) para calcular as posições, aplicar regras de sucessão temporal e calcular as estimativas e densidades. 
Para resolver o gargalo de visualização, em vez de servir um GeoJSON massivo, o PostGIS serve a malha fragmentada usando **Mapbox Vector Tiles (`ST_AsMVT`)**, que o MapLibre consome sob demanda conforme o nível de zoom.

✅ **Pros:**
- Regras de negócio em Go: limpas, testáveis, reutilizáveis e escaláveis.
- Vector Tiles (`ST_AsMVT`) resolvem definitivamente o limite de renderização do navegador. O MapLibre carrega só o que a tela mostra.
- Separação clara de responsabilidades: Go cuida da lógica (sucessão/densidade), PostGIS do armazenamento/MVT, e MapLibre do estilo guiado por dados (Data-Driven Styling).

❌ **Cons:**
- Arquitetura um pouco mais intrincada (exige montar um servidor/endpoint de MVT no backend).
- Precisa balancear bem o que o Go processa em memória vs o que ele delega ao motor espacial do banco.

📊 **Effort:** Low | **Medium** | High

---

## 💡 Recommendation

**Option C (Motor Híbrido + Vector Tiles)** because sistemas agroflorestais profissionais não se limitam a pequenos canteiros. Quando os usuários começarem a planejar dezenas de hectares, opções baseadas puramente em GeoJSON frontal (Option A e B) farão o navegador ou a rede travarem.

Manter a lógica do SAF (sucessão no tempo, consórcios, cálculos de insumos/mudas) dentro do **Golang** é a decisão mais sã a longo prazo, garantindo fácil manutenção. Aliado ao **MVT (Vector Tiles) do PostGIS**, teremos a fluidez visual de ferramentas como o Google Earth, independentemente do número de árvores plantadas na tela.
