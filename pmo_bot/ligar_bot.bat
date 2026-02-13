@echo off
title LIGANDO AGRO VIVO 🚜
echo -----------------------------------------
echo   INICIANDO O MOTOR DO DOCKER...
echo -----------------------------------------
docker-compose up -d

echo.
echo -----------------------------------------
echo   INICIANDO O WEBHOOK PYTHON...
echo -----------------------------------------
:: Altere o caminho abaixo se você mover a pasta do projeto
cd /d "C:\Users\brunn\Documents\PROGRAMAÇÃO\backend-python"
python webhook.py

pause