
import sys
import os
import argparse
import logging
from datetime import datetime

# Adiciona diretório pai
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from modules.whatsapp_client import get_chats

logging.basicConfig(level=logging.INFO, format='%(message)s')
logger = logging.getLogger(__name__)

def listar_conversas_recentes(limit: int = 10, only_unread: bool = False):
    """
    Lista as últimas conversas ativas no WPPConnect.
    """
    logger.info("🔍 Buscando conversas no WPPConnect...")
    
    res = get_chats()
    if not res.success:
        logger.error(f"❌ Falha ao buscar chats: {res.error_message}")
        return

    data_raw = res.data or []
    chats = []
    
    if isinstance(data_raw, list):
        chats = data_raw
    elif isinstance(data_raw, dict):
        logger.info(f"DEBUG: Chaves do dict raiz: {data_raw.keys()}")
        if 'response' in data_raw:
             chats = data_raw['response']
        else:
             # Fallback: maybe the dict IS the list of chats indexed by ID?
             # Or it's a single chat object?
             chats = [data_raw] 

    logger.info(f"📂 Total de chats encontrados: {len(chats)}")
    if len(chats) > 0:
         logger.info(f"DEBUG: Primeiro item type: {type(chats[0])}")
         if isinstance(chats[0], dict):
             logger.info(f"DEBUG: Keys do item 0: {chats[0].keys()}")


    
    # Filtrar e Ordenar por timestamp da última mensagem (t)
    # WPPConnect: chat['t'] usually is timestamp in seconds or milliseconds? 
    # Usually 't' is Unix Timestamp (seconds).
    
    # Filter valid chats with timestamp
    valid_chats = [c for c in chats if c.get('t')]
    
    # Sort descending (newest first)
    sorted_chats = sorted(valid_chats, key=lambda x: int(x.get('t', 0)), reverse=True)
    
    count = 0
    print(f"\n{'='*60}")
    print(f"{'DATA':<20} | {'PHONE':<20} | {'LAST MSG':<30}")
    print(f"{'='*60}")
    
    for chat in sorted_chats:
        if count >= limit:
            break
            
        phone = chat.get('id', {}).get('_serialized') or chat.get('id')
        last_msg = chat.get('lastMessage', {})
        
        # Ignora status/broadcast
        if 'status' in str(phone) or 'broadcast' in str(phone):
            continue
            
        ts = chat.get('t')
        date_str = datetime.fromtimestamp(ts).strftime('%Y-%m-%d %H:%M:%S')
        
        body = ""
        if last_msg:
            body = last_msg.get('body') or f"[{last_msg.get('type')}]"
            from_me = last_msg.get('fromMe', False)
            prefix = "📤" if from_me else "📥"
            body = f"{prefix} {body[:30]}..."
        else:
            body = "(vazio)"
            
        print(f"{date_str:<20} | {phone:<20} | {body}")
        count += 1
        
    print(f"{'='*60}\n")
    print("💡 Para processar mensagens perdidas de um usuário, use:")
    print("python scripts/reprocess_manual.py --phone <PHONE> --limit 10")

if __name__ == "__main__":
    listar_conversas_recentes()
