# 🖥️ Frontend — Páginas e Rotas

O frontend do ManejoORG é um PWA (Progressive Web App) desenvolvido em React 18, Vite e Tailwind CSS v4. Ele segue o padrão **Bento UI** para uma experiência moderna e mobile-first.

---

## 1. Estrutura de Rotas
As rotas são gerenciadas pelo `react-router-dom` e protegidas por `RouteGuard` (Autenticação) e `AdminRoute` (Role-based access).

| Path | Componente | Acesso | Descrição |
|---|---|---|---|
| `/home` | `LandingPage` | Público/Híbrido | Apresentação do sistema e call-to-actions. |
| `/login` | `LoginPage` | Público | Autenticação via Supabase Auth. |
| `/cadastro` | `SignUpPage` | Público | Registro de novos produtores. |
| `/dashboard` | `DashboardPage` | Privado | Visão geral da fazenda em formato Bento Grid. |
| `/perfil` | `ProfilePage` | Privado | Gestão de dados do usuário e avatar. |
| `/mapa` | `MapaPropriedade` | Privado | Gestão geográfica (MapLibre GL) de Talhões e Canteiros. |
| `/caderno` | `DiarioDeCampo` | Privado | Visualização tabular do histórico de atividades. |
| `/planos` | `PlanosManejoList` | Privado | Listagem de Planos de Manejo Orgânico (PMO). |
| `/pmo/:id` | `PmoDetailPage` | Privado | Detalhes técnicos de um plano específico. |
| `/pmo/novo` | `PmoFormPage` | Privado | Wizard para criação de novo PMO. |
| `/culturas` | `MinhasCulturas` | Privado | Gestão de sementes e variedades plantadas. |
| `/admin` | `AdminDashboard` | Admin | Monitoramento global do sistema. |
| `/changelog` | `ChangelogPage` | Público | Notas de atualização do sistema. |

---

## 2. Componentes Principais (Layout)

O sistema utiliza um layout persistente para usuários logados:

- **`DashboardLayout`:** Envolve as rotas privadas. Fornece a barra lateral e o contexto global.
- **`Sidebar`:** Navegação principal otimizada para Desktop (lateral) e Mobile (bottom sheet/drawer).
- **`Navbar`:** Exibe o título da página atual e o status de sincronização (Online/Offline).

---

## 3. Gestão Geográfica (`MapaPropriedade`)
O módulo de mapa é um dos pilares do sistema, permitindo a digitalização da fazenda:

- **Tecnologia:** MapLibre GL JS (WebGL) + Esri World Imagery.
- **Funcionalidades:** 
    - Desenho de polígonos para **Talhões**.
    - Marcação de pontos/áreas para **Canteiros**.
    - Visualização de metadados agronômicos ao clicar nas áreas.
    - Exportação/Importação de coordenadas GeoJSON.

---

## 4. Caderno de Campo Digital (`DiarioDeCampo`)
Substitui o caderno de papel obrigatório para certificação orgânica:

- **`FieldDiaryTableV2`:** Tabela de alta performance com suporte a:
    - Filtros por data, talhão e tipo de operação.
    - Status de conformidade (Validado/Pendente).
    - Edição rápida de registros.
    - Sincronização automática com o backend.

---

## 5. UI/UX: Design System
O projeto utiliza um sistema de design proprietário focado em "Premium AgTech":

- **Typography:** Plus Jakarta Sans.
- **Colors:** Paleta baseada em Tons de Verde (Emerald/Slate) para remeter ao campo.
- **Bento Grid:** Cards com cantos arredondados, sombras suaves e hierarquia visual clara.
- **Responsividade:** Totalmente funcional em telas menores (smartphones de entrada), garantindo que o produtor possa usar o app diretamente no campo.
