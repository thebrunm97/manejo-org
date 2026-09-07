#!/usr/bin/env bash
# Fase 2 — hardening do host da VPS (Ubuntu/Debian).
#
# Rodar como root (ou via sudo) na VPS, DEPOIS de já ter testado o login por
# chave SSH em uma segunda sessão — nunca derrube o login por senha antes de
# confirmar que a chave funciona, ou você tranca a própria porta.
#
# Uso:
#   1. copie sua chave pública para a VPS (do seu computador local):
#        ssh-copy-id -i ~/.ssh/id_ed25519.pub root@<IP_DA_VPS>
#      (ou gere uma nova: ssh-keygen -t ed25519 -C "bruno@manejo-org-vps")
#   2. abra uma segunda sessão SSH e confirme que loga com a chave, SEM senha.
#   3. só então rode este script: bash 01-harden-host.sh
#
# Idempotente na maior parte — pode rodar de novo sem quebrar nada, exceto o
# passo de desabilitar login por senha, que é irreversível a partir daqui
# (por isso o aviso acima).

set -euo pipefail

NOVO_USUARIO="${DEPLOY_USER:-deploy}"

echo "==> Atualizando pacotes do sistema"
apt-get update -y
apt-get upgrade -y

echo "==> Criando usuário não-root '$NOVO_USUARIO' (se não existir)"
if ! id -u "$NOVO_USUARIO" >/dev/null 2>&1; then
  adduser --disabled-password --gecos "" "$NOVO_USUARIO"
  usermod -aG sudo "$NOVO_USUARIO"
  mkdir -p "/home/$NOVO_USUARIO/.ssh"
  if [ -f /root/.ssh/authorized_keys ]; then
    cp /root/.ssh/authorized_keys "/home/$NOVO_USUARIO/.ssh/authorized_keys"
  fi
  chown -R "$NOVO_USUARIO:$NOVO_USUARIO" "/home/$NOVO_USUARIO/.ssh"
  chmod 700 "/home/$NOVO_USUARIO/.ssh"
  chmod 600 "/home/$NOVO_USUARIO/.ssh/authorized_keys" 2>/dev/null || true
else
  echo "    usuário '$NOVO_USUARIO' já existe, pulando criação"
fi

echo "==> Instalando Docker Engine + compose plugin"
if ! command -v docker >/dev/null 2>&1; then
  curl -fsSL https://get.docker.com | sh
else
  echo "    docker já instalado, pulando"
fi
usermod -aG docker "$NOVO_USUARIO"

echo "==> Instalando fail2ban, ufw, unattended-upgrades"
apt-get install -y fail2ban ufw unattended-upgrades

echo "==> Configurando unattended-upgrades (patches de segurança automáticos)"
dpkg-reconfigure -f noninteractive unattended-upgrades || true

echo "==> Configurando ufw: deny padrão, liberando só SSH/80/443"
ufw default deny incoming
ufw default allow outgoing
ufw allow 22/tcp
ufw allow 80/tcp
ufw allow 443/tcp
ufw --force enable
ufw status verbose

echo "==> Configurando fail2ban para sshd (jail padrão já cobre isso, só garantindo que está ativo)"
systemctl enable --now fail2ban
cat > /etc/fail2ban/jail.local << 'JAILEOF'
[sshd]
enabled = true
maxretry = 5
bantime = 3600
findtime = 600
JAILEOF
systemctl restart fail2ban

echo "==> Desabilitando login SSH por senha (ATENÇÃO: confirme que a chave já funciona antes de rodar isto!)"
read -p "Chave SSH já testada e funcionando em outra sessão? Digite 'sim' para desabilitar senha: " CONFIRMA
if [ "$CONFIRMA" = "sim" ]; then
  sed -i 's/^#\?PasswordAuthentication.*/PasswordAuthentication no/' /etc/ssh/sshd_config
  sed -i 's/^#\?PermitRootLogin.*/PermitRootLogin prohibit-password/' /etc/ssh/sshd_config
  systemctl restart sshd || systemctl restart ssh
  echo "    Login por senha desabilitado. Root só loga por chave a partir de agora."
else
  echo "    Pulado — login por senha continua ativo. Rode de novo quando confirmar a chave."
fi

echo "==> Fase 2 concluída. Usuário de deploy: $NOVO_USUARIO (grupo docker + sudo)."
echo "    A partir daqui, use 'ssh $NOVO_USUARIO@<IP_DA_VPS>' em vez de root."
