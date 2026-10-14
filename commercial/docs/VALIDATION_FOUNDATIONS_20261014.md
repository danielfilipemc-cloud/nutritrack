# Relatório de validação das fundações — 14/10/2026

**Resultado: validação local aprovada; prontidão cloud não demonstrada. Manter a PR em draft e não iniciar Aluno 360º/Fase 2.** O utilizador confirmou a organização Aura Business e, depois de informado do preço indicativo, decidiu não criar recursos pagos e preparar a validação pendente.

## Âmbito e integridade

Revi os quatro commits `0ddcf21`, `6188124`, `c33b00b`, `1bc3007` da branch `feat/aura-foundations`, sobre `saas-foundation` / `543e3a0b78e864cc65a8c07dec0736c8ee6c39af`. O checkout estava limpo. `git diff --check` passou. Os 34 ficheiros e todas as alterações originais pertencem a `commercial/`; os ficheiros NutriTrack não foram alterados. Histórico, contratos, permissões e UI foram revistos; não foi identificada uma falha local que exigisse reescrever os quatro commits ou as migrations aprovadas.

As oito migrations anteriores foram comparadas com a base, e as duas novas com `1bc3007`: nenhum diff. O teste de checksums cobre Windows/Linux. A consulta cloud, apenas de metadados, confirmou as oito entradas/checksums existentes, seis versões oficiais e ausência de `client_users`, `staff_capabilities` e `aura_assessment_create`. Isto confirma o baseline observado, não prova uma cópia recuperável de produção.

## Alterações adicionais

- `scripts/staging-safety.ts`: proteção explícita dos projetos atual/legado, validação da URL e manifesto, exigência de evidência de restauro com digest.
- `scripts/foundations-staging.ts` e `package.json`: runner preparado com 16 grupos de testes reais de Auth/JWT/PostgREST; credenciais exclusivas de staging; dados fictícios e registo de resultados sem passwords/JWT; sem cleanup destrutivo. Não executado live.
- `scripts/admin-test-accounts.ts`, `auth-integration.ts`, `team-integration.ts`, `clients-integration.ts`, `care-integration.ts`: bloqueio inicial dos runners antigos que ainda apontavam para o projeto protegido. Corrigido risco operacional de criação/alteração/eliminação acidental no destino atual.
- `tests/staging-safety.test.ts`: quatro testes de recusa de produção, destinos incorretos, configuração insuficiente e evidência adulterada.
- `tests/upgrade.test.ts`: ensaio agora faz backup do baseline sintético de oito ficheiros, restaura-o numa nova instância local e só depois instala as duas migrations; compara registos e hashes antes/depois e valida autorização sem grants em massa.
- `README.md`, este relatório e `docs/STAGING_VALIDATION.md`: estado, matriz real pendente, sequência de backup/restauro, plano de recuperação e decisões jurídicas/operacionais. Logs em `docs/validation/foundations-20261014.log`.

**Migrations alteradas nesta consolidação: nenhuma. Migrations cloud aplicadas: zero.** As duas migrations novas permanecem versionadas para staging:

| Migration | SHA-256 LF |
| --- | --- |
| `20261014180741_student_identity_permissions.sql` | `02461ce23aac47ab4a55b83b034f277dd82b680a47f6e716e51bf506a36a50d3` |
| `20261014180744_privacy_integrity_recovery.sql` | `61464a14070b7de465614263fd1936ea5fb4a99f541b07178a95a07d282c9746` |

## Evidências executadas

| Verificação | Resultado e limite |
| --- | --- |
| `npm run check` em Node 22.23.3 | 40/40 testes, TypeScript e build Next.js passaram; 13 rotas. 21 contratos históricos, 15 do schema completo/upgrade, 4 guards de staging. PostgreSQL local PGlite, não Auth/JWT reais. |
| `npm run test:e2e -- --workers=2` | 25/25 Chromium, 16,4 s, API interceptada com fixtures. Não prova RLS cloud. UI não mudou nesta consolidação. |
| `npm run test:recovery:local` | PASS: dump/restauro sintético completo, 10 migrations, uma avaliação recuperada, admin sem acesso a medições; SHA-256 `d044adff0b439bded5741951873a6d36219287bc393dafcc0cd3c9e763697cd2`. |
| Ensaio adicional após reforço do teste de upgrade | 5/5: quatro guards e baseline8 → backup → restauro → upgrade10 → permissões. Passou em 3,0 s. Este teste substitui a versão anterior do caso de upgrade na suite de 40. |
| `npm audit --json` | Zero vulnerabilidades reportadas; sem instalação/atualização de dependências. Não é auditoria completa do produto. |
| CLI Supabase oficial | 2.120.0 e `db dump --help` confirmados. Nenhum dump cloud, link, push ou reset executado. |
| Recusas operacionais | Runner novo sem `AURA_STAGING_URL` recusado; runner antigo de contas recusado antes de ler env/usar SDK. Saída não-zero esperada, sem operação cloud. |
| Integridade Git | Diff/checksums/histórico revistos; alterações adicionais limitadas a documentação, scripts e testes em `commercial/`. |

Uma falha inicial de TypeScript por inferência no novo runner foi corrigida com anotação explícita do cliente; typecheck e build posteriores passaram. Os testes SQL existentes cobrem permissões, convites, projeção mínima, correções/conflitos, datas/precisão, exportação e revogação. A concorrência PGlite não demonstra concorrência entre conexões PostgREST: esse caso está preparado no runner real e permanece pendente.

## Staging e recuperação

A ligação Aura Business tem apenas `vfplbkfxipfictuwkkoe`, em eu-west-1, ACTIVE_HEALTHY, PostgreSQL 17.11, e nenhuma branch. Foi tratado como produção protegida. O tool `get_cost` respondeu UNAVAILABLE (`not returned by tools/list`), não houve rejeição de aprovação automática. O preço publicado para branch Micro começa em US$0,01344/h; não foi possível verificar o preço/plano da conta, e não foi assumida gratuitidade. [Preço oficial](https://supabase.com/docs/guides/platform/manage-your-usage/branching).

Com a decisão de não criar recursos pagos, não existe um destino aprovado acessível onde aplicar as migrations ou executar os testes reais. `docker`, `psql`, `pg_dump` não foram encontrados no PATH; não foi instalado um ambiente completo. Staging preparado documentalmente e por scripts, **não provisionado**. Configuração Auth completa e validade dos backups cloud não foram confirmadas.

O procedimento de recuperação exige baseline sintético, dump de roles/schema/dados/Auth/privados, histórico oficial separado, configuração fora do banco, inventário de Storage/segredos, cifragem e manifesto; restauro numa base nova/vazia; comparação de dados/grants/RLS e login real antes da migration 1A. Passo a passo e gates em [STAGING_VALIDATION.md](STAGING_VALIDATION.md). [Procedimento oficial](https://supabase.com/docs/guides/platform/migrating-within-supabase/backup-restore). RPO/RTO, guarda e responsáveis continuam decisões pendentes. O ensaio local passou, mas **o teste de restauro Supabase cloud não foi executado**.

Não foi feita leitura/exportação de dados pessoais de produção; as consultas cloud devolveram histórico, checksums e advisor. Não houve mutation em produção, alteração Auth, publicação Render, merge ou limpeza de recursos. A app publicada e as bases atual/legada permanecem sem alterações por esta tarefa.

## Segurança e riscos pendentes

Revisão do código confirmou separação entre schemas expostos/privados, invoker wrappers, search_path vazio nas implementações privilegiadas, auth.uid e memberships live, grants explícitos, RLS local em todas as tabelas AURA e FKs de tenant. Owner/admin não obtêm medições implícitas. Competência e atribuição são cumulativas; revogação usa estado atual do banco. Convites de aluno não criam membership. A projeção publicada não entrega notas/motivos privados. Estas conclusões foram verificadas localmente e precisam de confirmação real em staging.

O advisor cloud continua com WARN de passwords comprometidas desativadas: [remediação](https://supabase.com/docs/guides/auth/password-security#password-strength-and-leaked-password-protection). Existem quatro INFO de RLS sem policies em tabelas privadas: [explicação](https://supabase.com/docs/guides/database/database-linter?lint=0008_rls_enabled_no_policy). Não conceder acesso amplo para eliminar estes INFO. `aura_migrations` continua sem RLS no baseline cloud, sem SELECT para authenticated; a migration1A corrige RLS localmente, ainda não instalada.

Gates em aberto: confirmação do exposed schema list e schema cache, exec/grants reais, MFA/AAL2, SMTP e recuperação de conta num sandbox, redirects exatos, TTL/refresh JWT/invalidade de sessões, rate limits, secret scans do deploy futuro, performance/EXPLAIN com volume sintético e revisão independente da PR. Não se alterou produção para resolver estes pontos.

## Decisões jurídicas e operacionais

Necessitam de decisão: papéis responsável/subcontratante e contratos; categorias/base de tratamento de possíveis dados de saúde; DPIA; habilitação e matriz de acesso profissional; informação ao titular e finalidades opcionais/versionamento; procedimento completo de direitos e verificação de identidade; retenção/eliminação/exceções e tratamento de audit trail/backups; subcontratantes/regiões/transferências; incidentes, responsáveis, RPO/RTO e gestão de chaves.

Prefs/requests técnicos não estabelecem base jurídica. A exportação de registos visíveis não cumpre por si só um pedido completo; não há eliminação física automática nem claim de fulfillment. Não se presume conformidade RGPD.

## GitHub e recomendação

Integração preparada como Pull Request **draft**, `feat/aura-foundations` → `saas-foundation`, contendo os quatro commits e a correção operacional adicional. CI AURA executa validação/testes e não contém deploy; não foi alterada a branch da aplicação publicada. Sem merge automático. O URL e os resultados remotos de CI são registados na entrega da sessão; não devem ser presumidos PASS sem observação.

**Não recomendo iniciar Aluno 360º agora.** Recomendo fechar a consolidação num staging acessível aprovado: restauro real PASS antes da migration1A, duas migrations preservando histórico, matriz Auth/RLS/JWT/PostgREST PASS, revisão Auth e segurança independente, e decisões jurídicas mínimas para o escopo futuro. Um staging já existente sem custos pode remover o bloqueio operacional sem contratar novos recursos; o seu isolamento e credenciais têm de ser confirmados antes de usar.
