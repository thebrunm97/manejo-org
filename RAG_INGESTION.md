# Ingestão de Documentos (RAG) - ManejoORG

Atualmente, a ingestão de PDFs para a base de conhecimento do Consultor RAG é realizada via scripts ou através da API do bot. O botão de upload direto na plataforma está em desenvolvimento.

## Opção 1: Script Python (Legado/Estável)
Recomendado para ingestão em massa no diretório `docs`.

1. Coloque seus arquivos PDF na pasta `pmo_bot/scripts/docs/`.
2. Execute o script:
   ```bash
   cd pmo_bot/scripts
   python treinar_especialista.py
   ```

## Opção 2: Script Go (Novo Motor)
Recomendado para a nova arquitetura Gemini File Search.

1. Coloque os PDFs em `pmo-bot-go/docs/knowledge_base/`.
2. Execute o loader:
   ```bash
   cd pmo-bot-go
   go run cmd/knowledge_loader/main.go
   ```

## Opção 3: API do Bot (Para Desenvolvedores)
O motor em Go possui um endpoint de upload que pode ser chamado via `POST`:

- **Endpoint**: `http://localhost:8080/knowledge/upload?token=SEU_TOKEN`
- **Body (form-data)**:
  - `file`: Arquivo PDF
  - `pmo_id`: (Opcional) ID do PMO para documentos privados

---
> [!TIP]
> Em breve, um botão de upload será adicionado diretamente à página de **Monitoramento de Ingestão (RAG)** no menu de Administração.
