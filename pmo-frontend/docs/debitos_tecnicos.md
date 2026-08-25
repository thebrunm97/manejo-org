# Débitos Técnicos - Frontend (ManejoOrg)

Este documento centraliza ajustes finos, melhorias de UX/UI, refatorações e correções de vocabulário/regras agronômicas no frontend real da aplicação.

## 🗺️ Módulo de Mapa / Talhões

- [ ] **Correção de Nomenclatura Agronômica (Saúde do Solo)**
  - **Onde**: Painel lateral flutuante de detalhes do talhão (Widget de pH).
  - **Problema**: O badge de alerta para pH ácido (ex: 5.2) exibe o termo "REFINAR", que não é utilizado na agronomia.
  - **Solução**: Ajustar a lógica condicional do componente para exibir **"CORRIGIR"** (que remete à calagem) ou **"BAIXO / ATENÇÃO"** quando os níveis de pH e Saturação de Bases (V%) estiverem abaixo do ideal para a cultura.

- [ ] **Usabilidade de Seleção no Mapa (Polígonos Pequenos)**
  - **Onde**: Interação de clique nos talhões no mapa (Google Maps / Leaflet / Mapbox).
  - **Problema**: Com zoom distante (zoom out) ou rolagem descentralizada, polígonos menores (ex: área no centro da fazenda) ficam com a hitbox muito pequena, dificultando o clique/seleção pelo usuário, especialmente em telas touch.
  - **Solução**: 
    1. Aumentar a área de "hitbox" invisível ou a tolerância de clique no mapa.
    2. Implementar um zoom inteligente (flyTo) ao clicar próximo, ou exibir tooltips agrupados.
    3. Garantir que o centro visual (pan/zoom) seja calculado baseando-se no bounding box de todos os talhões no primeiro load.

- [ ] **Navegação Quebrada (Botão Gerenciar no Croqui)**
  - **Onde**: Aba/Visão "Croqui" (grid de cards dos talhões).
  - **Problema**: O botão "GERENCIAR" presente nos cards de cada talhão não possui ação de navegação, falhando em redirecionar o usuário para a tela de edição ou detalhes do talhão específico.
  - **Solução**: Implementar o roteamento (ex: `navigate('/talhoes/:id/editar')`) no `onClick` do botão, passando o ID do talhão correspondente ao card.

## 🧭 Navegação e Menu Lateral

- [ ] **Acessibilidade e Contraste (Seletor de Idioma)**
  - **Onde**: Menu lateral / Header (Dropdown de seleção de idioma "Português").
  - **Problema**: O texto do idioma selecionado e o ícone de globo estão com uma cor muito escura sobre o fundo verde escuro, resultando em baixo contraste e dificultando a leitura (falha de acessibilidade/WCAG).
  - **Solução**: Alterar a cor da fonte e do ícone do seletor para um tom mais claro (ex: verde-claro pastel ou branco com opacidade de 70%-90%) para garantir um contraste adequado com o fundo escuro do menu.
