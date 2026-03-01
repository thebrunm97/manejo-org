import sys
import os
from dotenv import load_dotenv

load_dotenv()

sys.path.append(os.path.dirname(__file__))
from modules.whatsapp_client import send_text

msg = """Olá! Passando para avisar que o problema com o limite de cota da inteligência artificial foi resolvido. Pode testar novamente! 🌱

Aproveitando, como combinamos, seguem as orientações para sincronizar o WhatsApp com o aplicativo:

👋 Sou o Assistente de Manejo Orgânico.
Ainda não identifiquei seu cadastro. Para utilizar minhas funções de IA, siga os passos:

1️⃣ Acesse: https://manejo-org.vercel.app/home
2️⃣ Faça login ou crie sua conta.
3️⃣ Na tela 'Visão Geral', busque o cartão 'Assistente Inteligente' e gere seu código.
4️⃣ Volte aqui e digite: *CONECTAR <SEU_CODIGO>*.

Te espero lá! 🌱"""

res = send_text('553498256825@c.us', msg)
print("SUCCESS:", res.success)
if not res.success:
    print("ERROR:", res.error_message)
