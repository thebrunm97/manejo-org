
# Usa uma imagem Python leve e moderna
FROM python:3.10-slim
# Define o diretório de trabalho dentro do container
WORKDIR /app
# Copia e instala as dependências
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt
# Copia todo o código do bot
COPY . .
# Expõe a porta que o FastAPI/Uvicorn vai usar
EXPOSE 5000
# Comando para iniciar o bot
CMD ["python", "webhook.py"]
