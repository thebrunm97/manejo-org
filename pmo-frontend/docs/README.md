# Documentação do Frontend PMO

Este diretório contém toda a documentação técnica do frontend da aplicação PMO (Plano de Manejo Orgânico).

## Estrutura de Diretórios

```
docs/
├── specs/                          # Especificações em planejamento/desenvolvimento
└── archive/
    └── specs-implementadas/        # Especificações concluídas e validadas
        └── 2026-01/                # Organizadas por período de conclusão
```

## Documentação de Especificações

- **`specs/`** - Especificações técnicas em planejamento ou desenvolvimento ativo. Use este diretório para novas features ou refatorações.
  
- **`archive/specs-implementadas/`** - Especificações que foram totalmente implementadas, testadas e validadas. Cada arquivo contém um badge de status indicando a data de conclusão e os componentes afetados.

## Convenções

1. **Novas Especificações**: Criar em `specs/` com prefixo descritivo (ex: `feature_nome.md` ou `refactor_componente.md`)

2. **Após Implementação**: Mover para `archive/specs-implementadas/YYYY-MM/` adicionando o badge de status:
   ```markdown
   ---
   **Status:** ✅ Implementado  
   **Data de Conclusão:** [Mês Ano]  
   **Componentes Afetados:** [lista]  
   ---
   ```

3. **Formato**: Usar Markdown com seções claras, exemplos de código e diagramas quando aplicável.
