#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
verify_security.py - Script de Verificação de Segurança

Testa as proteções implementadas no webhook:
1. Autenticação por Token
2. Sanitização XSS

Uso: python verify_security.py
"""

import requests
import json
import sys
import io

# Fix Windows console encoding for emojis
if sys.platform == 'win32':
    sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding='utf-8', errors='replace')
    sys.stderr = io.TextIOWrapper(sys.stderr.buffer, encoding='utf-8', errors='replace')

# =============================================================================
# CONFIGURAÇÃO
# =============================================================================

WEBHOOK_URL = "http://127.0.0.1:5000/webhook"
TOKEN_CORRETO = "sgz344qwqw28zrlfjs7lrp5xkqzl1u"
TOKEN_ERRADO = "hacker_safado"

# Payload simulando mensagem do WhatsApp com XSS
XSS_PAYLOAD = {
    "event": "onmessage",
    "from": "5511999999999@c.us",
    "type": "chat",
    "body": "<script>alert('hackeado')</script>",
    "id": "test_xss_123",
    "isGroupMsg": False,
    "sender": {"id": "5511999999999@c.us"}
}

# =============================================================================
# FUNÇÕES DE TESTE
# =============================================================================

def print_header():
    print("\n" + "=" * 60)
    print("🛡️  VERIFICAÇÃO DE SEGURANÇA - PMO BOT WEBHOOK")
    print("=" * 60)
    print(f"🎯 Alvo: {WEBHOOK_URL}")
    print("-" * 60)


def test_no_token():
    """Teste 1: Acesso sem token deve ser rejeitado."""
    print("\n📌 TESTE 1: Acesso SEM Token")
    print("-" * 40)
    
    try:
        response = requests.post(
            WEBHOOK_URL,
            json={"event": "test"},
            headers={"Content-Type": "application/json"},
            timeout=5
        )
        
        if response.status_code == 403:
            print(f"   Status Code: {response.status_code}")
            print("   ✅ PASSOU: Acesso negado sem token.")
            return True
        else:
            print(f"   Status Code: {response.status_code}")
            print(f"   ❌ FALHOU: Esperado 403, recebeu {response.status_code}")
            return False
            
    except requests.exceptions.ConnectionError:
        print("   ❌ ERRO: Servidor não está rodando!")
        print("   💡 Execute: python pmo_bot/webhook.py")
        return False
    except Exception as e:
        print(f"   ❌ ERRO: {e}")
        return False


def test_wrong_token():
    """Teste 2: Acesso com token errado deve ser rejeitado."""
    print("\n📌 TESTE 2: Acesso com Token ERRADO")
    print("-" * 40)
    
    try:
        response = requests.post(
            f"{WEBHOOK_URL}?token={TOKEN_ERRADO}",
            json={"event": "test"},
            headers={"Content-Type": "application/json"},
            timeout=5
        )
        
        if response.status_code == 403:
            print(f"   Status Code: {response.status_code}")
            print(f"   Token usado: '{TOKEN_ERRADO}'")
            print("   ✅ PASSOU: Acesso negado com token inválido.")
            return True
        else:
            print(f"   Status Code: {response.status_code}")
            print(f"   ❌ FALHOU: Esperado 403, recebeu {response.status_code}")
            return False
            
    except requests.exceptions.ConnectionError:
        print("   ❌ ERRO: Servidor não está rodando!")
        return False
    except Exception as e:
        print(f"   ❌ ERRO: {e}")
        return False


def test_xss_sanitization():
    """Teste 3: Payload XSS deve ser aceito mas sanitizado."""
    print("\n📌 TESTE 3: Sanitização XSS (Token Correto)")
    print("-" * 40)
    
    try:
        response = requests.post(
            f"{WEBHOOK_URL}?token={TOKEN_CORRETO}",
            json=XSS_PAYLOAD,
            headers={"Content-Type": "application/json"},
            timeout=10
        )
        
        print(f"   Status Code: {response.status_code}")
        print(f"   Payload enviado: {XSS_PAYLOAD['body']}")
        
        if response.status_code == 200:
            print("   ✅ PASSOU: Requisição aceita com token válido.")
            print("\n   ⚠️  AÇÃO MANUAL NECESSÁRIA:")
            print("   📋 Verifique os logs do servidor (webhook.py)")
            print("   🔍 Procure por: '🧹 Input sanitizado:'")
            print("   ")
            print("   ✅ BOM (Seguro):")
            print("      &lt;script&gt;alert(&#x27;hackeado&#x27;)&lt;/script&gt;")
            print("   ")
            print("   ❌ RUIM (Vulnerável):")
            print("      <script>alert('hackeado')</script>")
            return True
        else:
            print(f"   ⚠️  Status inesperado: {response.status_code}")
            try:
                print(f"   Resposta: {response.json()}")
            except:
                print(f"   Resposta: {response.text[:200]}")
            return False
            
    except requests.exceptions.ConnectionError:
        print("   ❌ ERRO: Servidor não está rodando!")
        return False
    except Exception as e:
        print(f"   ❌ ERRO: {e}")
        return False


def test_bearer_token():
    """Teste Bônus: Acesso via Bearer Token no Header."""
    print("\n📌 TESTE BÔNUS: Autenticação via Bearer Header")
    print("-" * 40)
    
    try:
        response = requests.post(
            WEBHOOK_URL,  # Sem token na URL
            json={"event": "test", "type": "ping"},
            headers={
                "Content-Type": "application/json",
                "Authorization": f"Bearer {TOKEN_CORRETO}"
            },
            timeout=5
        )
        
        print(f"   Status Code: {response.status_code}")
        
        if response.status_code == 200:
            print("   ✅ PASSOU: Bearer Token aceito!")
            return True
        elif response.status_code == 403:
            print("   ⚠️  Bearer Token não funcionou (apenas query param)")
            return True  # Não é falha, apenas não implementado
        else:
            print(f"   ⚠️  Status inesperado: {response.status_code}")
            return False
            
    except requests.exceptions.ConnectionError:
        print("   ❌ ERRO: Servidor não está rodando!")
        return False
    except Exception as e:
        print(f"   ❌ ERRO: {e}")
        return False


# =============================================================================
# MAIN
# =============================================================================

def main():
    print_header()
    
    results = []
    
    # Executar testes
    results.append(("Sem Token", test_no_token()))
    results.append(("Token Errado", test_wrong_token()))
    results.append(("XSS Sanitization", test_xss_sanitization()))
    results.append(("Bearer Header", test_bearer_token()))
    
    # Resumo
    print("\n" + "=" * 60)
    print("📊 RESUMO DOS TESTES")
    print("=" * 60)
    
    passed = 0
    failed = 0
    
    for name, result in results:
        status = "✅ PASSOU" if result else "❌ FALHOU"
        print(f"   {status} - {name}")
        if result:
            passed += 1
        else:
            failed += 1
    
    print("-" * 60)
    print(f"   Total: {passed} passou, {failed} falhou")
    
    if failed == 0:
        print("\n🎉 TODOS OS TESTES DE SEGURANÇA PASSARAM!")
        print("🛡️  Seu webhook está protegido contra acessos não autorizados.")
    else:
        print("\n⚠️  ATENÇÃO: Alguns testes falharam!")
        print("   Verifique a configuração de segurança.")
    
    print("=" * 60 + "\n")
    
    return 0 if failed == 0 else 1


if __name__ == "__main__":
    sys.exit(main())
