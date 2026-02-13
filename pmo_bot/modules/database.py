import os
import threading
import logging
from contextlib import contextmanager
from supabase import create_client, Client
from dotenv import load_dotenv

load_dotenv()

# Logger configuration
logger = logging.getLogger(__name__)

# Thread-local storage
thread_local = threading.local()

SUPABASE_URL = os.getenv("SUPABASE_URL")
SUPABASE_KEY = os.getenv("SUPABASE_KEY")

if not SUPABASE_URL or not SUPABASE_KEY:
    raise ValueError("❌ SUPABASE_URL e SUPABASE_KEY são obrigatórios no .env!")

@contextmanager
def get_supabase_client():
    """
    Context manager to provide a thread-safe Supabase client.
    Each thread gets its own isolated client instance.
    """
    if not hasattr(thread_local, "client"):
        # logger.debug(f"🔌 Criando nova conexão Supabase para thread: {threading.current_thread().name}")
        try:
            thread_local.client = create_client(SUPABASE_URL, SUPABASE_KEY)
        except Exception as e:
            logger.error(f"❌ Falha ao criar cliente Supabase: {e}")
            raise

    try:
        yield thread_local.client
    except Exception as e:
        logger.error(f"❌ Erro durante operação Supabase na thread {threading.current_thread().name}: {e}")
        raise
