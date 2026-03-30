# 🚀 Guia de Onboarding para Desenvolvedores

Bem-vindo ao time de desenvolvimento do **ManejoORG**! Este guia ajudará você a configurar seu ambiente e entender a arquitetura do projeto rapidamente.

---

## 1. Pré-requisitos
Certifique-se de ter instalado em sua máquina:
- **Go 1.23+**
- **Node.js 18+** & **npm/yarn**
- **Docker** & **Docker Compose**
- **Git**
- Uma conta no **Supabase** (opcional para dev local se usar Docker, mas recomendado para cloud).

---

## 2. Configurando o Ambiente Local

### Passo 1: Clonar o Repositório
```bash
git clone https://github.com/thebrunm97/manejo-org-app-clean.git
cd manejo-org-app-clean
```

### Passo 2: Configurar Variáveis de Ambiente
Siga as instruções em [docs/deployment/env_vars.md](../deployment/env_vars.md) para criar os arquivos `.env` em:
1. `pmo-bot-go/.env`
2. `pmo-frontend/.env`

### Passo 3: Iniciar o Backend & Gateway (Docker)
```bash
cd pmo_bot
docker-compose up -d
```
*Isso subirá o WPPConnect (WhatsApp) e o motor de IA em Go.*

### Passo 4: Iniciar o Frontend
```bash
cd ../pmo-frontend
npm install
npm run dev
```
*Acesse em `http://localhost:5173`.*

---

## 3. Estrutura do Código (Mapa Mental)

- **`pmo-bot-go/`**: O motor de decisão.
  - `internal/state/fsm.go`: Onde o fluxo de conversa acontece.
  - `internal/gemini/router.go`: Onde a IA decide para qual agente enviar a mensagem.
  - `internal/supabase/`: Integração direta com o banco.
- **`pmo-frontend/`**: O Dashboard PWA.
  - `src/pages/`: Cada view principal do sistema.
  - `src/services/sync/`: Lógica de Offline Sync (IndexedDB).
  - `src/components/Map/`: Implementação MapLibre/Esri Satellite.

---

## 4. Fluxo de Trabalho Recomendado

1. **Bug na Conversa?** Olhe os logs do container `pmo-bot-go`.
2. **Nova Funcionalidade no Mapa?** Modifique o `PropertyMap.tsx` e verifique o `pmoService.ts` para persistência.
3. **Novo Estado no WhatsApp?** Adicione o estado em `fsm.go` e atualize o diagrama em `docs/backend/fsm.md`.

---

## 5. Links Úteis
- [📚 Arquitetura Completa](../architecture/overview.md)
- [🗄️ Dicionário de Dados (RPCs)](../database/rpcs.md)
- [🤖 Como Funcionam os Agentes](../backend/agents.md)
