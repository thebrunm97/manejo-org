"""
services/media_service.py - Audio & Media Processing Service
"""
import os
import logging
import mutagen
from pathlib import Path
from datetime import datetime
from groq import Groq

# Import existing modules
from modules.whatsapp_client import download_media
from modules.storage_utils import upload_audio_to_supabase

logger = logging.getLogger(__name__)

class MediaService:
    def __init__(self):
        self.groq_key = os.getenv("GROQ_API_KEY", "")
        if self.groq_key:
            self.groq_client = Groq(api_key=self.groq_key)
        else:
            self.groq_client = None
            logger.warning("⚠️ GROQ_API_KEY not set. Transcription disabled.")

    def process_audio_message(self, message_id: str, user_id: str, pmo_id: int) -> dict:
        """
        Orchestrates full audio processing:
        1. Download
        2. Extract Metadata (duration)
        3. Upload to Storage
        4. Transcribe (Groq)
        
        Returns:
            dict with { text, duration, url, file_size }
        """
        save_path = Path(f"temp_{message_id}.ogg")
        result_data = {
            "text": "",
            "duration": 0.0,
            "url": None,
            "file_size": 0
        }

        try:
            # 1. Download
            dl_result = download_media(message_id, save_path)
            if not dl_result.success:
                raise Exception(f"Download failed: {dl_result.error_message}")
            
            caminho = dl_result.data.get("file_path")
            if not caminho or not os.path.exists(caminho):
                 raise Exception("File not found after download")

            # 2. Metadata
            try:
                result_data["file_size"] = os.path.getsize(caminho)
                audio_meta = mutagen.File(caminho)
                if audio_meta and audio_meta.info:
                    result_data["duration"] = audio_meta.info.length
            except Exception as e_meta:
                logger.warning(f"⚠️ Metadata error: {e_meta}")

            # 3. Upload
            try:
                date_str = datetime.now().strftime('%Y-%m-%d')
                storage_path = f"pmo_{pmo_id}/{date_str}/{message_id}.ogg"
                url = upload_audio_to_supabase(str(caminho), storage_path)
                result_data["url"] = url
            except Exception as e_upload:
                logger.error(f"❌ Upload error: {e_upload}")
            
            # 4. Transcribe
            if self.groq_client:
                try:
                    with open(caminho, "rb") as f:
                        trans = self.groq_client.audio.transcriptions.create(
                            file=(caminho, f.read()),
                            model="whisper-large-v3",
                            language="pt"
                        )
                    result_data["text"] = trans.text.strip()
                    logger.info(f"📝 Transcrição [{message_id}]: {result_data['text']}")

                    # --- RESTORED BILLING: Log Cost Immediately ---
                    try:
                        from services.quota_service import QuotaService
                        
                        # Calculate prompt_tokens as seconds (for whisper-large-v3 linear pricing)
                        duration_sec = result_data["duration"] or 0
                        
                        QuotaService().log_consumption(
                            user_id=user_id,
                            request_id=f"trans_{message_id[:8]}",
                            acao="transcricao_audio",
                            modelo="whisper-large-v3",
                            usage={
                                "prompt_tokens": duration_sec,
                                "completion_tokens": 0, 
                                "total_tokens": duration_sec
                            },
                            duracao_ms=int(duration_sec * 1000),
                            status="success",
                            meta={"file_size": result_data["file_size"], "audio_url": result_data["url"]}
                        )
                        logger.info(f"💰 Custo de transcrição registrado ({duration_sec:.2f}s)")
                    except Exception as e_bill:
                        logger.error(f"⚠️ Billing error (non-critical): {e_bill}")
                    # ----------------------------------------------
                    
                except Exception as e_trans:
                    logger.error(f"❌ Transcribe error: {e_trans}")
                    raise # Re-raise to alert caller? Or return empty text?
            
            return result_data

        finally:
            # Cleanup
            if os.path.exists(save_path):
                try:
                    os.remove(save_path)
                except:
                    pass
