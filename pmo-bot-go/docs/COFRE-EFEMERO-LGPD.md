# 🛡️ Cofre Efêmero: Adequação LGPD (DT-42)

## 📌 Visão Geral

A arquitetura do **Cofre Efêmero** foi projetada para resolver um conflito fundamental entre **Privacidade de Dados (LGPD)** e **Não-Repúdio (Auditoria)**. 

O pipeline original armazenava áudios (biometria vocal, um dado sensível segundo o art. 5º, II da LGPD) em um bucket público (`audios_audit`) por tempo indeterminado. Descartá-los imediatamente garantiria privacidade extrema, mas deixaria os produtores indefesos caso a IA alucinasse um registro no Caderno de Campo.

A solução implementada adota o princípio da **Efemeridade**:
1. O áudio é retido em um bucket **100% privado** (`audit-vault`).
2. A retenção tem um limite rígido de **90 dias** (prazo máximo plausível para contestação).
3. O acesso é restrito ao titular via **Signed URLs** de curta duração.
4. A deleção (expurgo) é automática e blindada contra falhas parciais.

---

## ⚙️ Camada de Retenção (Go GC)

A eliminação dos áudios vencidos não usa dependências externas como `pg_cron`, mas sim um **Triturador em Go (Garbage Collector)** nativo (`AuditGCTicker`), mantendo a lógica de negócio tipada e versionada no repositório.

### O Contrato `AuditVaultPurger`
A interface abstrai o storage e o banco, isolando a regra de deleção da regra de ingestão:
- `ListExpiredAuditRecords`: Busca registros cujo `expires_at` foi superado.
- `DeleteAuditObject`: Apaga o arquivo físico no Supabase Storage.
- `DeleteAuditRecord`: Apaga o índice no banco de dados.

### ⚠️ Ordem Estrita de Deleção
O método `PurgeExpiredAuditRecords` obedece a uma ordem **rígida e inegociável**:
1. **Primeiro:** O objeto físico é apagado no Storage.
2. **Segundo:** O índice no banco de dados é apagado.

Se o primeiro passo falhar (seja por instabilidade de rede ou retorno anômalo de `400 / 404 not_found` na API do Supabase Storage), a execução aborta a remoção do índice para aquele item específico. Isso evita que áudios fiquem "órfãos" (arquivos que ainda existem fisicamente, mas perderam o ponteiro no banco e tornaram-se invisíveis para futuras passadas do GC). 

*Nota de Resiliência: A falha ao apagar um registro não interrompe o lote. O triturador continua executando para os próximos áudios da fila.*

---

## 🌐 Camada de Acesso (Signed URLs no Frontend)

O acesso direto a URLs públicas foi abolido. O frontend agora utiliza o componente especializado `SignedAudioPlayer.tsx` para garantir o controle de acesso no último milissegundo.

### Dinâmica do `SignedAudioPlayer`
- **Assinatura Sob Demanda (Just-in-Time):** A URL não é persistida no banco; ela é gerada ativamente durante a renderização (via `useEffect`) chamando o serviço de assinatura de áudio.
- **Prevenção de Memory Leaks:** A chamada assíncrona verifica ativamente a flag de montagem (`ativo`) antes de atualizar o estado, evitando bugs se o usuário fechar o modal/diálogo antes da URL retornar da rede.
- **Degradação Elegante:** Em vez de renderizar um player de `<audio>` quebrado, o componente gerencia estados (`carregando`, `pronto`, `indisponivel`). Se o usuário não tiver permissão para assinar a URL, a interface exibe explicitamente uma mensagem de `"Áudio indisponível"`.

---

## 🗄️ Camada de Banco (RLS e Políticas)

A base de toda a segurança da feature repousa em um esquema restritivo de **Row Level Security (RLS)** no PostgreSQL e no Storage.

### Tabela de Índices: `public.audios_audit`
- Age como índice exclusivo para o bucket privado `audit-vault`.
- Armazena a coluna `expires_at` materializada (`created_at + 90 dias`) garantindo que a política de retenção original seja historicamente imutável.
- **Política de RLS FORCED:** Somente leitura (`SELECT`) para o titular (`auth.uid() = profile_id`).
- **Isolamento de Eliminação (Não-Repúdio):** O titular **NÃO** possui permissão de `DELETE`. Permitir que o titular deletasse o registro por conta própria destruiria a trilha de auditoria. A deleção física é exclusividade do GC (backend via `service_role`). Em caso de solicitação de eliminação de conta (art. 18, VI), o fluxo atua por Soft Delete/Anonimização, garantindo que a integridade relacional seja mantida, mas impossibilitando a identificação do sujeito.

### Supabase Storage: Bucket `audit-vault`
A capacidade de gerar uma Signed URL no client via SDK exige que o usuário possua direitos de leitura sobre o objeto alvo.
- A política `"titular assina audio do cofre"` atua sobre `storage.objects` com a restrição `FOR SELECT`.
- A autorização é baseada na hierarquia de pastas. O caminho do objeto no bucket obedece estritamente ao padrão: `<profile_id>/<data>/<arquivo>.ogg`.
- O RLS checa se `auth.uid()::text = split_part(storage.objects.name, '/', 1)` para garantir que o usuário logado só consegue assinar/ler áudios prefixados com o seu próprio UUID.

*(Nota: Uma política de retrocompatibilidade também foi aplicada no bucket legado público `audios_audit` usando um join com a tabela de PMOs, assegurando que o áudio antigo não quebre enquanto é migrado).*
