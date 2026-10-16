# Consolidação das fundações — 14/10/2026

Estado atual: validação Supabase local real concluída; desenvolvimento da Fase 2 autorizado com dados fictícios. Validação cloud e autorização de produção continuam pendentes. Ver [LOCAL_VALIDATION.md](LOCAL_VALIDATION.md) e [INTEGRATION_STATUS.md](INTEGRATION_STATUS.md). As secções seguintes conservam o procedimento e o diagnóstico históricos, anteriores ao runtime local; não autorizam merge, publicação ou migrations em produção.

## Destinos e decisão operacional

`vfplbkfxipfictuwkkoe` é protegido como produção; `maipjryehnllaifxhunf` é o legado protegido. Na ligação Aura Business existe apenas o primeiro projeto e nenhuma branch. A organização `opdpdwwgvtdzsmebuqey` foi confirmada pelo utilizador para consultar custos. `get_cost` não está disponível no servidor MCP ligado. O utilizador decidiu **não criar recursos pagos e preparar a validação pendente**. Não houve criação de projeto/branch nem cópia de dados de produção.

Não existem `docker`, `psql` ou `pg_dump` no PATH desta sessão. O restauro PGlite não substitui Auth/PostgREST reais nem recuperação Supabase. Um projeto isolado já existente, gratuito e explicitamente aprovado, ou um ambiente Supabase local completo disponibilizado posteriormente, pode permitir trabalho adicional; não se presumiu disponibilidade ou gratuitidade.

## Revisão dos quatro commits

Base: `543e3a0b78e864cc65a8c07dec0736c8ee6c39af` (`saas-foundation`).

| Commit | Resultado da revisão |
| --- | --- |
| `0ddcf21` | Node 22.23.3, dependências fixadas e normalização dos checksums históricos. |
| `6188124` | Identidade Auth do aluno sem membership; competência E atribuição; guards privados; convites com confirmação de email e uso único. |
| `c33b00b` | Correções preservam original; nova partilha explícita; projeção mínima; pedidos/prefs técnicos; retenção sem eliminação; recuperação local. |
| `1bc3007` | UI adapta comandos às permissões; área própria mínima do aluno; API interceptada nos testes de navegador. |

O diff original contém apenas `commercial/`; NutriTrack permanece intacto. As oito migrations anteriores não foram alteradas; os dois hashes novos também permanecem iguais. A revisão não demonstra comportamento cloud. RLS e RPCs privilegiadas foram revistas com as skills Supabase e Supabase Postgres Best Practices: public wrappers invoker; implementations privadas com search_path vazio; auth.uid/membership live; grants explícitos; FKs de tenant. Capabilities/assignments têm chaves e índices para os lookups. O volume e os planos reais das políticas por linha ainda requerem EXPLAIN no staging; não há alegação de desempenho validado.

## Correção adicional

Os cinco runners históricos de Auth/equipa/alunos/acompanhamento/contas estavam fixados no projeto agora protegido. Continuar a utilizá-los seria um risco de escrita e, no cleanup, de eliminação. Foram bloqueados antes de carregar env ou executar pedidos. Os ficheiros foram conservados como referência dos contratos antigos, não são executáveis para validação live.

`scripts/foundations-staging.ts` é o novo runner. Usa apenas variáveis `AURA_STAGING_*`, sem ler `.env.local`, não contém delete/reset/cleanup, cria IDs aleatórios e contas `example.invalid` através de Auth Admin sem enviar convites. Guarda IDs e resultados em `.aura-integration/staging-<run>/evidence.json`, ignorado pelo Git; passwords/JWTs não são escritos nem impressos. Em falha, conserva os fixtures para análise. Não é um sistema de autenticação da aprovação: o operador deve fornecer o manifesto apenas após a aprovação e verificação reais.

O guard exige URL HTTPS exata de um projeto não protegido, `synthetic_only: true`, evidência de restauro e SHA-256 dos bytes dessa evidência. Recusa destino sem manifesto, produção mesmo se mencionada no manifesto, host semelhante, credenciais na URL e evidência alterada. Testes locais cobrem estas recusas. O runner é compilado e a recusa sem configuração foi ensaiada; **não foi executado com um backend real**.

## Backup e restauro antes das migrations cloud

Sequência preparada, ainda não executada:

1. Registar dois destinos distintos: staging baseline e destino de restauro novo/vazio. Confirmar região, custos, refs e inexistência de dados pessoais. Não usar restore de produção, merge/rebase/reset de branches ou clone com dados. Instalar o baseline de oito ficheiros preservados e apenas fixtures sintéticos. Se uma branch aplicar o histórico automaticamente, verificar objetos e os dois registos de migrations antes de acrescentar dados; não reaplicar o baseline cegamente.
2. Registar versões de PostgreSQL, CLI 2.120.0 e aplicação; oito entradas/checksums em `app_private.aura_migrations`; seis versões existentes de `supabase_migrations.schema_migrations`; inventário de schemas, roles/grants/RLS/functions/triggers/extensions e contagens de fixtures. O histórico oficial tem timestamps distintos dos nomes dos ficheiros: não o substituir pelo registry privado.
3. Fazer backup lógico a partir **do staging sintético** segundo a documentação Supabase: roles, schema, dados; dump separado do schema/histórico `supabase_migrations`. Incluir `app_private`, Auth sintético necessário ao login e todas as tabelas de auditoria. Verificar o conteúdo real dos dumps e as exclusões da versão CLI; não considerar um dump só de `public` suficiente. Não exportar dados do projeto protegido. Connection strings/passwords fora do histórico de comandos, Git e logs, usando ficheiros de credenciais protegidos; não resetar passwords de produção.
4. Capturar configuração fora do banco: Auth/URLs de redirect/provedores/SMTP/MFA/password policy/JWT/API exposed schemas; não copiar credenciais de produção. Storage binário, Edge Functions, segredos e configuração não estão garantidos por um dump SQL. Se o staging tiver Storage, inventariar e testar cópia separada dos objetos sintéticos; se não tiver, registar explicitamente zero. Vault/column encryption requer tratamento específico das chaves, sem as publicar.
5. Guardar dumps cifrados fora do Git, manifesto SHA-256 com fonte/destino/timestamp/versões e contagens, acesso mínimo. Um hash verifica integridade, não autenticidade ou confidencialidade. Responsável, local de guarda, prazo, RPO/RTO e gestão das chaves precisam de decisão; não foram escolhidos como política de produção.
6. Restaurar **apenas no destino novo/vazio aprovado**, sem DROP/TRUNCATE/reset de bases existentes. Rever conflitos de roles e schemas geridos pelo Supabase antes de executar; compatibilidade de versão tem de ser demonstrada. Usar transação e ON_ERROR_STOP; confirmar todos os triggers/grants/policies após carga. Se for necessário apagar/substituir recursos, obter aprovação específica. A ferramenta `restore_project` retoma um projeto pausado e não deve ser tomada como ensaio de recuperação de um backup lógico.
7. Comparar oito hashes e seis versões do histórico, dados sintéticos, relações/FKs, grants e RLS; fazer login Auth real com conta recuperada, SELECT por JWT e recusa de outro tenant. Medir duração real, registar resultado e digest dos dumps. Sem PASS, não aplicar nenhuma das duas migrations cloud.
8. Criar evidência de restauro verificada e manifesto local para o runner. `archive_sha256` identifica o bundle recuperado; `evidence_sha256` identifica o relatório do ensaio. Os valores nunca devem ser preenchidos com hashes fictícios para ultrapassar o guard.

Referências: [backup/restauro CLI](https://supabase.com/docs/guides/platform/migrating-within-supabase/backup-restore), [limites dos backups](https://supabase.com/docs/guides/platform/backups), [custos de branches](https://supabase.com/docs/guides/platform/manage-your-usage/branching). A estratégia está preparada; não se confirmou ainda que existe backup cloud recuperável.

## Aplicação das duas migrations — pendente

| Ficheiro | SHA-256 canónico LF |
| --- | --- |
| `20261014180741_student_identity_permissions.sql` | `02461ce23aac47ab4a55b83b034f277dd82b680a47f6e716e51bf506a36a50d3` |
| `20261014180744_privacy_integrity_recovery.sql` | `61464a14070b7de465614263fd1936ea5fb4a99f541b07178a95a07d282c9746` |

Depois do restauro PASS, verificar novamente ref, destino sintético e os oito hashes antes de aplicar 1A e depois 1B. Usar `apply_migration` para DDL, uma transação por migration incluindo a entrada SHA no registry privado. Preservar todas as versões existentes do histórico oficial; a ferramenta acrescenta novas versões. Não usar `db reset`, não importar o bundle completo sem validar o registry e não reparar histórico para disfarçar diferenças. Confirmar 10 entradas, ausência de grants em massa, colunas/RPCs e schema cache PostgREST antes dos testes. Em erro, parar e preferir forward fix; não voltar ao acesso genérico antigo.

## Execução do runner — preparada, não validada live

Variáveis explícitas: `AURA_STAGING_URL`, `AURA_STAGING_PUBLISHABLE_KEY`, `AURA_STAGING_SECRET_KEY`, `AURA_STAGING_APPROVAL_FILE`. A chave administrativa é exclusivamente local, nunca NEXT_PUBLIC_, browser, Git ou relatório. O manifesto tem `project_ref`, `synthetic_only: true` e `restore: {verified: true, archive_sha256, evidence_file, evidence_sha256}`. `evidence_file` deve ser um caminho absoluto para evidência efetiva de restauro; os hashes são hex de 64 caracteres.

Com Node 22.23.3, executar `npm run test:foundations:staging` **após** backup/restauro e migrations. O runner não aplica migrations nem avalia toda a configuração Auth.

Matriz preparada: login/getUser/JWT emitido por Auth; email não confirmado; dois tenants; competência sem atribuição; PT competente com escrita; read-only; owner/admin sem medições implícitas; aluno A/B; convite de uso único/identidade errada; projeção publicada sem notas; agenda/objetivos/histórico filtrado; POST directo negado; correção concorrente com PT409/HTTP409; export/prefs/pedido; revogação de competência, atribuição, membership e aluno com JWT já emitido; JWT forjado e anon negados. Resultados destes casos cloud estão **PENDENTES**, não PASS.

Depois do runner: completar MFA/AAL2, password reset/SMTP sandbox, allowlist exacta de redirects, expiração/refresh JWT, rotação/invalidade de sessões e limites antiabuso. Testar bypass por user_metadata (não usar como autorização), exposed schemas sem app_private, acesso directo aos privados/funcs históricas, conflitos com schema cache e ausência de secrets nos artefactos publicados. Confirmar advisor no staging e efectuar revisão independente da PR. O runner não substitui estes checks.

## Segurança/Auth observável agora

O advisor em produção foi consultado apenas em leitura: WARN de passwords comprometidas desativadas, quatro INFO de RLS sem policies em tabelas privadas. A ausência de policies é deliberada quando não há grants e o acesso é por funções privadas guardadas; verificar ambos, não acrescentar policies genéricas. A config completa de SMTP, redirects, MFA, sessões e backups não está exposta pelos tools disponíveis e permanece não verificada. Nada foi alterado em Auth/produção. [Remediação password protection](https://supabase.com/docs/guides/auth/password-security#password-strength-and-leaked-password-protection) e [RLS sem policies](https://supabase.com/docs/guides/database/database-linter?lint=0008_rls_enabled_no_policy).

## Decisões jurídicas e operacionais pendentes

- Responsável/subcontratante por tenant, acordos e subcontratantes/transferências/regiões; análise das categorias de dados e base de tratamento, incluindo informação que possa constituir dados de saúde.
- Necessidade de DPIA, habilitação profissional e matriz aprovada de acesso; competências técnicas não certificam profissão nem autorizam automaticamente tratamento jurídico.
- Informação ao titular e textos/versionamento das finalidades opcionais; efeito real da retirada e separação de dados necessários ao serviço. Não importar saúde/fotos reais nos ensaios.
- Processo de verificação da identidade e resposta a acesso/portabilidade/correção/eliminação; prazos e exceções revistos por responsável competente. A exportação visível não é exportação jurídica completa; o sistema não executa ainda eliminação física.
- Prazos por categoria e audit trail/backups, retenção por finalidade, restrições de acesso operacional e política de recuperação; incidentes, responsáveis e exercícios. Requests/prefs/correções têm de ser recuperáveis e os backups não podem servir de via para reativar acessos revogados.
- Fornecer um staging existente aprovado sem custos, ou deliberar separadamente sobre recursos; credenciais, ferramentas de dump/restauro e destino vazio; revisão independente de segurança e gates para merge/deploy.

Não se presume conformidade RGPD. Recomendação: manter PR em draft e fechar os gates de staging, restauro real e Auth/PostgREST antes de autorizar Aluno 360º.
