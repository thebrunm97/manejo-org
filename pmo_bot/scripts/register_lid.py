#!/usr/bin/env python3
"""
scripts/register_lid.py - Registrar LID manualmente via CLI

Uso:
    python scripts/register_lid.py <LID> <PHONE> [NAME]

Exemplo:
    python scripts/register_lid.py 10857845141643 201005505663 "Ahmed Mesalam"
"""

import sys
import os
import logging

# Adiciona diretório pai ao path para importar modules
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from modules.lid_manager import LIDManager
from dotenv import load_dotenv

# Configura log básico
logging.basicConfig(level=logging.INFO, format='%(message)s')

def main():
    if len(sys.argv) < 3:
        print("❌ Uso incorreto.")
        print("Uso: python scripts/register_lid.py <LID> <PHONE> [NAME]")
        sys.exit(1)
    
    lid_id = sys.argv[1].strip()
    phone = sys.argv[2].strip()
    name = sys.argv[3].strip() if len(sys.argv) > 3 else "Desconhecido"
    
    print(f"🔄 Registrando: {lid_id} -> {phone} ({name})...")
    
    # Inicializa (vai criar client internamente)
    try:
        manager = LIDManager()
        success = manager.set_mapping(lid_id, phone, name, registered_by='cli_script')
        
        if success:
            print(f"✅ Sucesso! Mapeamento salvo.")
            print(f"🔍 Teste de resolução: {manager.get_real_phone(lid_id)}")
        else:
            print(f"❌ Falha ao salvar no banco. Verifique logs/conexão.")
            sys.exit(1)
            
    except Exception as e:
        print(f"❌ Erro crítico: {e}")
        sys.exit(1)

if __name__ == '__main__':
    main()
