import logging
import os
from gliner import GLiNER

# Configure logging
logger = logging.getLogger(__name__)

class NERService:
    _instance = None
    _model = None

    def __new__(cls):
        if cls._instance is None:
            cls._instance = super(NERService, cls).__new__(cls)
        return cls._instance

    def _get_model(self):
        """
        Lazy load the GLiNER model.
        Using gliner-community/gliner_small-v2.5 for balanced performance/resource usage.
        """
        if self._model is None:
            model_name = "gliner-community/gliner_small-v2.5"
            logger.info(f"🚀 Loading GLiNER model: {model_name}...")
            try:
                # This will download the model on first run (~150MB)
                self._model = GLiNER.from_pretrained(model_name)
                logger.info("✅ GLiNER model loaded successfully.")
            except Exception as e:
                logger.error(f"❌ Failed to load GLiNER model: {e}", exc_info=True)
                return None
        return self._model

    def extract_entities(self, text: str):
        """
        Extracts agricultural entities from text using zero-shot NER.
        Used primarily in the Agent Graph for real-time conversation.
        """
        model = self._get_model()
        if not model:
            return []

        # Define specialized agricultural labels
        labels = [
            "cultura",     # Ex: cenoura, alface, milho
            "acao",        # Ex: plantar, colher, aplicar, irrigar
            "insumo",      # Ex: esterco, calcário, neem
            "talhao",      # Ex: talhão 1, canteiro A
            "quantidade"   # Ex: 10kg, 2 litros, 50 gramas
        ]

        try:
            # Threshold 0.4 for a good balance between precision and recall
            entities = model.predict_entities(text, labels, threshold=0.4)
            
            if entities:
                logger.info(f"🎯 NER Detected (Execution): {[(e['text'], e['label']) for e in entities]}")
            
            return entities
        except Exception as e:
            logger.error(f"⚠️ Error during NER entity extraction: {e}")
            return []

    def extract_metadata(self, text: str, chunk_size: int = 1000, overlap: int = 200):
        """
        Extracts document metadata (Bibliographic) from text using a sliding window.
        Used in the ingestion pipeline (Knowledge Factory).
        Iterates through chunks and stops early if all required metadata is found.
        """
        model = self._get_model()
        if not model:
            return {}

        # Define specialized bibliographic labels
        labels = [
            "autor",            # Ex: EMBRAPA, SENAR, João Silva
            "ano_publicacao",   # Ex: 2019, 2022
            "titulo_documento"  # Ex: Manual de Olericultura
        ]
        
        required_keys = set(labels)
        final_metadata = {}

        try:
            # Create sliding window chunks
            chunks = []
            for i in range(0, len(text), chunk_size - overlap):
                chunks.append(text[i:i + chunk_size])
                
            logger.info(f"🧠 NER Metadata Extraction: Processing up to {len(chunks)} chunks...")

            for idx, chunk in enumerate(chunks):
                if not chunk.strip():
                    continue
                    
                # Threshold 0.35 because titles can be complex
                entities = model.predict_entities(chunk, labels, threshold=0.35)
                
                if entities:
                    logger.info(f"   🎯 NER Detected in chunk {idx+1}: {[(e['text'], e['label']) for e in entities]}")
                    
                    # Group by label (take the highest score or first match)
                    for ent in entities:
                        label = ent['label']
                        if label not in final_metadata:
                            final_metadata[label] = ent['text']
                
                # Early Exit Strategy: If we found all 3, stop processing!
                if set(final_metadata.keys()) == required_keys:
                    logger.info("✅ All metadata fields found. Stopping NER early to save CPU/RAM.")
                    break
                    
            return final_metadata
            
        except Exception as e:
            logger.error(f"⚠️ Error during NER metadata extraction: {e}")
            return final_metadata
        finally:
            # Memory Management: Force cleanup after heavy inference
            import gc
            import torch
            gc.collect()
            if torch.cuda.is_available():
                torch.cuda.empty_cache()

# Singleton instance
ner_service = NERService()
