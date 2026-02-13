"""
migrate_talhoes_legacy.py - Normalizes legacy talhao_canteiro records

This script updates caderno_campo records that have talhao_id populated
to use the official talhão name in talhao_canteiro field.

Usage:
  python scripts/migrate_talhoes_legacy.py --dry-run   # Preview only
  python scripts/migrate_talhoes_legacy.py             # Execute migration
  python scripts/migrate_talhoes_legacy.py --batch-size 100  # Custom batch size
"""

import argparse
import sys
import os

# Add parent directory to path for imports
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from modules.database_handlers import normalizar_talhao_e_atividades, supabase
from typing import Optional, Dict, Any


def get_talhao_nome_by_id(talhao_id: int) -> Optional[str]:
    """
    Fetch official talhão name from talhoes table by ID.
    
    Args:
        talhao_id: The talhão ID to look up
        
    Returns:
        The official name if found, None otherwise
    """
    try:
        res = supabase.table("talhoes") \
            .select("nome") \
            .eq("id", talhao_id) \
            .single() \
            .execute()
        
        if res.data:
            return res.data.get("nome")
        return None
    except Exception as e:
        print(f"⚠️ Erro ao buscar talhão ID {talhao_id}: {e}")
        return None


def process_batch(offset: int, limit: int, dry_run: bool) -> Dict[str, int]:
    """
    Process a batch of caderno_campo records.
    
    Args:
        offset: Starting offset for pagination
        limit: Number of records to process
        dry_run: If True, don't write changes
        
    Returns:
        Dict with counts: {processed, updated, skipped, errors}
    """
    stats = {"processed": 0, "updated": 0, "skipped": 0, "errors": 0}
    
    try:
        # Fetch records with talhao_id populated
        res = supabase.table("caderno_campo") \
            .select("id, talhao_id, talhao_canteiro, atividades") \
            .not_.is_("talhao_id", "null") \
            .range(offset, offset + limit - 1) \
            .execute()
        
        records = res.data or []
        
        if not records:
            return stats
        
        for record in records:
            stats["processed"] += 1
            record_id = record["id"]
            talhao_id = record["talhao_id"]
            original_talhao_canteiro = record.get("talhao_canteiro", "")
            atividades = record.get("atividades")
            
            # Fetch official name
            nome_oficial = get_talhao_nome_by_id(talhao_id)
            
            if not nome_oficial:
                print(f"⏭️ [{record_id[:8]}...] talhao_id={talhao_id} não encontrado na tabela talhoes")
                stats["skipped"] += 1
                continue
            
            # Apply normalization
            normalizados = normalizar_talhao_e_atividades(
                nome_talhao_oficial=nome_oficial,
                texto_local_original=original_talhao_canteiro or "",
                atividades=atividades
            )
            
            novo_talhao_canteiro = normalizados["talhao_canteiro"]
            novas_atividades = normalizados["atividades"]
            
            # Check if update is needed
            talhao_changed = novo_talhao_canteiro != original_talhao_canteiro
            atividades_changed = novas_atividades != atividades and novas_atividades is not None
            
            if not talhao_changed and not atividades_changed:
                print(f"⏭️ [{record_id[:8]}...] já normalizado: '{original_talhao_canteiro}'")
                stats["skipped"] += 1
                continue
            
            # Build update payload
            update_payload: Dict[str, Any] = {}
            if talhao_changed:
                update_payload["talhao_canteiro"] = novo_talhao_canteiro
            if atividades_changed:
                update_payload["atividades"] = novas_atividades
            
            if dry_run:
                print(f"🔍 [{record_id[:8]}...] DRY-RUN:")
                if talhao_changed:
                    print(f"   talhao_canteiro: '{original_talhao_canteiro}' → '{novo_talhao_canteiro}'")
                if atividades_changed:
                    print(f"   atividades[].local.talhao → '{nome_oficial}'")
                stats["updated"] += 1
            else:
                try:
                    supabase.table("caderno_campo") \
                        .update(update_payload) \
                        .eq("id", record_id) \
                        .execute()
                    
                    print(f"✅ [{record_id[:8]}...] Atualizado:")
                    if talhao_changed:
                        print(f"   talhao_canteiro: '{original_talhao_canteiro}' → '{novo_talhao_canteiro}'")
                    if atividades_changed:
                        print(f"   atividades[].local.talhao → '{nome_oficial}'")
                    stats["updated"] += 1
                except Exception as e:
                    print(f"❌ [{record_id[:8]}...] Erro: {e}")
                    stats["errors"] += 1
                    
    except Exception as e:
        print(f"❌ Erro ao processar batch (offset={offset}): {e}")
        stats["errors"] += 1
        
    return stats


def main():
    parser = argparse.ArgumentParser(
        description="Normalize legacy talhao_canteiro records in caderno_campo"
    )
    parser.add_argument(
        "--dry-run", 
        action="store_true",
        help="Preview changes without writing to database"
    )
    parser.add_argument(
        "--batch-size",
        type=int,
        default=50,
        help="Number of records to process per batch (default: 50)"
    )
    
    args = parser.parse_args()
    
    print("=" * 80)
    print("🔄 MIGRAÇÃO: Normalizar talhao_canteiro Legados")
    print("=" * 80)
    
    if args.dry_run:
        print("⚠️  MODO DRY-RUN: Nenhuma alteração será gravada\n")
    else:
        print("⚡ MODO PRODUÇÃO: Alterações serão gravadas no banco\n")
    
    # Count total records to process
    try:
        count_res = supabase.table("caderno_campo") \
            .select("id", count="exact") \
            .not_.is_("talhao_id", "null") \
            .execute()
        total_records = count_res.count or 0
        print(f"📊 Total de registros com talhao_id: {total_records}\n")
    except Exception as e:
        print(f"❌ Erro ao contar registros: {e}")
        return 1
    
    if total_records == 0:
        print("✅ Nenhum registro para processar.")
        return 0
    
    # Process in batches
    totals = {"processed": 0, "updated": 0, "skipped": 0, "errors": 0}
    offset = 0
    batch_num = 1
    
    while offset < total_records:
        print(f"\n--- Batch {batch_num} (offset {offset}) ---")
        
        stats = process_batch(offset, args.batch_size, args.dry_run)
        
        for key in totals:
            totals[key] += stats[key]
        
        offset += args.batch_size
        batch_num += 1
    
    # Summary
    print("\n" + "=" * 80)
    print("📊 RESUMO DA MIGRAÇÃO")
    print("=" * 80)
    print(f"📋 Processados: {totals['processed']}")
    print(f"✅ Atualizados: {totals['updated']}")
    print(f"⏭️ Ignorados:   {totals['skipped']}")
    print(f"❌ Erros:       {totals['errors']}")
    
    if args.dry_run:
        print(f"\n⚠️  Modo dry-run: execute sem --dry-run para aplicar as alterações")
    
    return 0 if totals["errors"] == 0 else 1


if __name__ == "__main__":
    sys.exit(main())
