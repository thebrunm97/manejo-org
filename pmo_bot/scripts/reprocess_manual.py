#!/usr/bin/env python3
"""
Script para reprocessar mensagens manualmente

Uso:
    python scripts/reprocess_manual.py --phone 5534972027279 --limit 10
    python scripts/reprocess_manual.py --phone 201005505663 --limit 5 --dry-run
"""

import sys
import os
import argparse
import time
from datetime import datetime

# Adicionar diretório raiz ao path
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from modules.whatsapp_client import get_messages
from webhook import process_message_payload
import logging

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

def main():
    parser = argparse.ArgumentParser(description='Reprocessar mensagens de um usuário')
    parser.add_argument('--phone', required=True, help='Número de telefone (com código país)')
    parser.add_argument('--limit', type=int, default=10, help='Quantidade de mensagens (padrão: 10)')
    parser.add_argument('--dry-run', action='store_true', help='Simular sem processar')
    
    args = parser.parse_args()
    
    # Normalizar telefone
    phone = args.phone.replace('@c.us', '').replace('+', '').replace(' ', '')
    chat_id = f"{phone}@c.us"
    if len(phone) > 13: # LID heuristic
         chat_id = f"{phone}@lid"
    
    logger.info(f"🔄 Reprocessando mensagens de: {chat_id}")
    logger.info(f"📊 Limite: {args.limit}")
    logger.info(f"🧪 Modo: {'DRY-RUN' if args.dry_run else 'PRODUÇÃO'}")
    
    # Buscar mensagens
    res = get_messages(chat_id, args.limit)
    
    if not res.success:
         logger.error(f"❌ Falha ao buscar mensagens: {res.error_message}")
         return

    messages = res.data or []
    
    if not messages:
        logger.warning(f"⚠️ Nenhuma mensagem encontrada para {chat_id}")
        return
    
    logger.info(f"📬 {len(messages)} mensagens encontradas")
    
    # Sort chronological
    messages.sort(key=lambda x: x.get('timestamp', 0))

    processed = 0
    for msg in messages:
        try:
            timestamp = datetime.fromtimestamp(msg.get('timestamp', 0))
            body = msg.get('body', '(sem texto)')
            msg_id = msg.get('id', '?')
            
            logger.info(f"  📨 [{timestamp}] {body[:50]}... (ID: {msg_id})")
            
            if args.dry_run:
                logger.info(f"     [DRY-RUN] Simulado ✓")
            else:
                # Injeta evento se faltar
                if "event" not in msg: msg["event"] = "onmessage"

                # Processar mensagem
                process_message_payload(msg, request_id=f"MANUAL-{int(time.time())}")
                processed += 1
                logger.info(f"     ✅ Processado")
                time.sleep(1)
                
        except Exception as e:
            logger.error(f"     ❌ Erro: {e}")
    
    logger.info(f"\n{'=' * 50}")
    logger.info(f"✅ Concluído: {processed}/{len(messages)} mensagens processadas")

if __name__ == '__main__':
    main()
