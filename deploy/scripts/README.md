# Scripts de migração pra VPS

Ordem de execução (ver conversa/checklist completo nas fases 0–7):

| Script | Onde roda | Fase | O que faz |
|---|---|---|---|
| (Fase 0 — feita no compose/`.env.prod` direto, sem script) | local | 0 | Senha forte do RabbitMQ, portas em 127.0.0.1, limits de memória |
| `01-harden-host.sh` | VPS | 2 | Chave SSH, ufw, fail2ban, unattended-upgrades, usuário `deploy`, Docker |
| `02-deploy-fase4.sh` | VPS | 4 | Clona o repo, sobe a stack sem `evolution_data` (sem tráfego real) |
| `03-cutover-local.sh` | local | 5 | Derruba a stack local, empacota `evolution_data`, envia pra VPS via rsync |
| `04-cutover-vps.sh` | VPS | 5 | Recria os containers com os dados reais, acompanha reconexão do WhatsApp |
| `05-validate-fase6.sh` | VPS | 6 | Checklist de validação ponta a ponta |

Todos exigem variáveis de ambiente específicas (`REPO_URL`, `VPS_HOST`, etc.) —
cada script lista as suas no cabeçalho e falha cedo se faltar alguma.

**Os scripts 03 e 04 (Fase 5, o corte) pedem confirmação manual antes de
qualquer ação destrutiva e não devem ser rodados sem você acompanhando ao
vivo** — é o único ponto da migração com risco real de precisar reconectar o
WhatsApp do zero (novo QR).

Pré-requisito comum a partir da Fase 2: acesso SSH funcionando à VPS.
