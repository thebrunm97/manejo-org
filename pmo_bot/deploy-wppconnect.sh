#!/bin/bash

set -e

# Cores para output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

echo -e "${GREEN}================================================${NC}"
echo -e "${GREEN}  WPPConnect Server - Build com Patch${NC}"
echo -e "${GREEN}================================================${NC}"
echo ""

# Verificar se arquivos existem
echo -e "${YELLOW}[1/6]${NC} Verificando arquivos necessários..."
if [ ! -f "wppconnect-patch.js" ]; then
    echo -e "${RED}❌ Erro: wppconnect-patch.js não encontrado${NC}"
    exit 1
fi

if [ ! -f "Dockerfile.wppconnect" ]; then
    echo -e "${RED}❌ Erro: Dockerfile.wppconnect não encontrado${NC}"
    exit 1
fi

if [ ! -f "docker-compose.yml" ]; then
    echo -e "${RED}❌ Erro: docker-compose.yml não encontrado${NC}"
    exit 1
fi

echo -e "${GREEN}✅ Todos os arquivos encontrados${NC}"
echo ""

# Parar containers existentes
echo -e "${YELLOW}[2/6]${NC} Parando containers existentes..."
docker-compose stop wppconnect || true
echo -e "${GREEN}✅ Containers parados${NC}"
echo ""

# Remover container antigo
echo -e "${YELLOW}[3/6]${NC} Removendo container antigo..."
docker-compose rm -f wppconnect || true
echo -e "${GREEN}✅ Container removido${NC}"
echo ""

# Remover imagem antiga (opcional)
echo -e "${YELLOW}[4/6]${NC} Limpando imagens antigas..."
docker rmi $(docker images -q -f "dangling=true") 2>/dev/null || true
echo -e "${GREEN}✅ Limpeza concluída${NC}"
echo ""

# Build da nova imagem
echo -e "${YELLOW}[5/6]${NC} Building nova imagem com patch..."
docker-compose build --no-cache wppconnect
echo -e "${GREEN}✅ Imagem buildada com sucesso${NC}"
echo ""

# Iniciar containers
echo -e "${YELLOW}[6/6]${NC} Iniciando containers..."
docker-compose up -d wppconnect
echo -e "${GREEN}✅ Container iniciado${NC}"
echo ""

# Aguardar inicialização
echo -e "${YELLOW}⏳${NC} Aguardando inicialização (30 segundos)..."
sleep 30

# Verificar logs
echo ""
echo -e "${GREEN}================================================${NC}"
echo -e "${GREEN}  Logs do Container${NC}"
echo -e "${GREEN}================================================${NC}"
docker-compose logs --tail=100 wppconnect

echo ""
echo -e "${GREEN}================================================${NC}"
echo -e "${GREEN}  Deploy Concluído!${NC}"
echo -e "${GREEN}================================================${NC}"
echo ""
echo -e "📋 Comandos úteis:"
echo -e "  - Ver logs: ${YELLOW}docker-compose logs -f wppconnect${NC}"
echo -e "  - Verificar status: ${YELLOW}docker-compose ps${NC}"
echo -e "  - Reiniciar: ${YELLOW}docker-compose restart wppconnect${NC}"
echo -e "  - Acessar swagger: ${YELLOW}http://localhost:21465/api-docs${NC}"
echo ""
echo -e "${GREEN}🔍 Procure por '[PATCH]' nos logs para confirmar que o patch foi aplicado${NC}"
echo ""
