import sys
import os
import logging

# Ensure we can import from the current directory
sys.path.append(os.getcwd())

from modules.ner_service import ner_service

logging.basicConfig(level=logging.INFO)

text = "Desejo plantar 50kg de batata no talhão norte amanhã cedo"
print(f"--- Input Text: '{text}' ---")

try:
    entities = ner_service.extract_entities(text)
    print("\n--- NER Test Results ---")
    if not entities:
        print("No entities detected.")
    for ent in entities:
        print(f"Text: {ent['text']} | Label: {ent['label']} | Score: {ent['score']:.4f}")
except Exception as e:
    print(f"\n❌ NER Test Failed: {e}")
