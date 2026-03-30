# ADR-003: Offline-First PWA via IndexedDB

## Status: Aceito

## Contexto
O público-alvo (produtores rurais) trabalha frequentemente em áreas sem cobertura de internet móvel estável. O registro de atividades agrícolas não pode ser interrompido por falta de sinal.

## Decisão
Adotar uma arquitetura **Offline-First** utilizando o armazenamento local do navegador (**IndexedDB**) e um sistema de fila de sincronização assíncrona.

## Justificativa
- **Realidade no Campo**: Garantia de que o produtor possa realizar registros no "croqui" do mapa sem depender da nuvem.
- **Experiência do Usuário (UX)**: Interações instantâneas, sem latência de rede perceptível durante o uso diário.
- **Resiliência**: Caso o navegador feche ou o dispositivo reinicie, os dados pendentes permanecem salvos localmente.

## Implementação Técnica
- **Storage**: Biblioteca `idb` para persistência local no navegador.
- **Sincronização**: Engine customizada (`useSyncEngine.ts`) que monitora o status da internet.
- **Garantia de Entrega**: Mecanismo de *Claim-then-Delete* para garantir que cada registro seja enviado exatamente uma vez.
- **IDs Temporários**: Registros offline utilizam IDs alfanuméricos randômicos, substituídos pelos IDs oficiais do Supabase após a confirmação do sync.

## Consequências
- (+) Autonomia total do usuário em áreas remotas.
- (+) Reduções de custos de bateria (menos tentativas de upload falhas).
- (-) Maior complexidade no código do frontend (gerenciamento de estados locais/remotos).
- (-) Possível conflito de versões caso múltiplos usuários editem a mesma entidade offline.
- **Mitigação**: Uso de timestamps "Last Write Wins" para resolução de conflitos em entidades compartilhadas (propriedades/talhões).
