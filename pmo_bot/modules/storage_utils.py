"""
storage_utils.py - Utilitários de Storage para Supabase

Upload de arquivos de áudio para o bucket 'audios_audit'.
"""

import os
import logging
from typing import Optional
from pathlib import Path
from supabase import create_client, Client
from dotenv import load_dotenv

# Carregar variáveis de ambiente
load_dotenv()

# Configuração de logging
logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(name)s - %(levelname)s - %(message)s')
logger = logging.getLogger(__name__)

# Inicializa Supabase (reaproveita as env vars existentes)
SUPABASE_URL: str = os.environ.get("SUPABASE_URL")
SUPABASE_KEY: str = os.environ.get("SUPABASE_KEY")

if not SUPABASE_URL or not SUPABASE_KEY:
    raise ValueError("❌ Configure SUPABASE_URL e SUPABASE_KEY no .env")

# supabase: Client = create_client(SUPABASE_URL, SUPABASE_KEY)
from modules.database import get_supabase_client

# Nome do bucket de áudios
AUDIO_BUCKET = "audios_audit"


def upload_audio_to_supabase(file_path: str, file_name: str) -> Optional[str]:
    """
    Faz upload do arquivo de áudio para o bucket 'audios_audit' e retorna a URL pública.
    
    Args:
        file_path: Caminho local do arquivo de áudio (ex: /tmp/audio_123.ogg)
        file_name: Nome do arquivo no bucket (ex: pmo_5/2026-01-13_audio_abc.ogg)
    
    Returns:
        URL pública do áudio no Supabase Storage, ou None em caso de erro.
    """
    try:
        # Verificar se arquivo existe
        path = Path(file_path)
        if not path.exists():
            logger.error(f"❌ Arquivo não encontrado: {file_path}")
            return None
        
        # Detectar content-type baseado na extensão
        extension = path.suffix.lower()
        content_types = {
            ".ogg": "audio/ogg",
            ".mp3": "audio/mpeg",
            ".wav": "audio/wav",
            ".m4a": "audio/mp4",
            ".opus": "audio/opus",
        }
        content_type = content_types.get(extension, "audio/ogg")
        
        logger.info(f"📤 Iniciando upload: {file_name} ({content_type})")
        
        with open(file_path, 'rb') as f:
            with get_supabase_client() as supabase:
                response = supabase.storage.from_(AUDIO_BUCKET).upload(
                    file_name,
                    f,
                    {"content-type": content_type}
                )
        
        # Gerar URL pública
        with get_supabase_client() as supabase:
            public_url = supabase.storage.from_(AUDIO_BUCKET).get_public_url(file_name)
        
        logger.info(f"✅ Upload concluído: {public_url}")
        return public_url
        
    except Exception as e:
        logger.error(f"❌ Erro no upload do áudio: {e}", exc_info=True)
        return None


def delete_audio_from_supabase(file_name: str) -> bool:
    """
    Remove um arquivo de áudio do bucket.
    
    Args:
        file_name: Nome do arquivo no bucket (ex: pmo_5/2026-01-13_audio_abc.ogg)
    
    Returns:
        True se removido com sucesso, False caso contrário.
    """
    try:
        with get_supabase_client() as supabase:
            supabase.storage.from_(AUDIO_BUCKET).remove([file_name])
        logger.info(f"🗑️ Áudio removido: {file_name}")
        return True
    except Exception as e:
        logger.error(f"❌ Erro ao remover áudio: {e}")
        return False
