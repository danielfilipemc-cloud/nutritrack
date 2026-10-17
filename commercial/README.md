# AURA Business

**Remediação de segurança — 17/10:** projeções de privacidade corrigidas, revisões auditáveis e política MFA/AAL2 por organização no servidor e na interface. Migrations 15–17 aplicadas apenas local/staging. [Resultados, achados abertos e critérios para piloto](docs/AUDIT_REMEDIATION_20261017.md), [configuração Auth pendente](docs/AUTH_STAGING_CONFIGURATION.md) e [procedimento de recuperação operacional](docs/RECOVERY_OPERATIONS.md). Produção não foi alterada. Os testes aprovados não fecham os gates de configuração, recuperação cloud e privacidade; **o projeto não está declarado pronto para dados reais**. Os checkpoints seguintes são históricos; confirmar publicação do candidato no PR/Render.

**Integração consolidada:** PRs #9–#14 integrados em `saas-foundation`. [Staging online separado](https://aura-business-staging.onrender.com) com [Aluno 360º sem conta](https://aura-business-staging.onrender.com/demo/aluno-360), Supabase exclusivo e contas fictícias. Três percursos Chromium com login cloud real e dez rotas/20 assets validados. Produção permanece no baseline #8, com auto-deploy desligado. Ver [operação e limites](docs/ONLINE_STAGING.md), [estado efetivo](docs/INTEGRATION_STATUS.md) e [pedido de auditoria independente](docs/INDEPENDENT_AUDIT_BRIEF.md). Os checkpoints seguintes são históricos.

Estado mais recente: [ponte NutriTrack funcional](docs/NUTRITRACK_BRIDGE.md) por backup v2, com identidade explícita, pré-visualização e importação idempotente de peso/cintura para avaliações/evolução. [Auth cloud e recuperação lógica](docs/STAGING_RECOVERY_20261016.md) validados com dados fictícios. Catorze migrations local/staging; produção continua no baseline #8. 66 testes, 56 Chromium, dois E2E locais com login real, 16 grupos fundações cloud e seis grupos ponte em cada ambiente. Sincronização automática, nutrição e recuperação operacional/PITR não estão concluídas. Os checkpoints abaixo são históricos.

Incremento atual: [painel diário](docs/DAILY_WORKSPACE.md) com prioridades, filtros, pesquisa e ações diretas, seguido de [evolução integrada](docs/INTEGRATED_EVOLUTION.md) na ficha existente, com gráficos e cronologia no mesmo período. Preserva os [objetivos](docs/STUDENT_OBJECTIVES.md), permissões por módulo e Dark Premium. Contrato futuro [NutriTrack](docs/NUTRITRACK_INTEGRATION_CONTRACT.md) explícito, sem sincronização ativa. Treze migrations no sandbox local; onze no staging cloud dedicado; produção/Render permanece no baseline #8. Evidência final em docs/validation/daily-evolution-local-20261016.log. Os parágrafos seguintes conservam checkpoints anteriores.

Esta branch acrescenta o primeiro incremento [Aluno 360º](docs/STUDENT_360.md) sobre as fundações: evolução por período/indicador, páginas abaixo do limite da API e `/demo/aluno-360` sem conta ou persistência. Validação conjunta: 48 testes e 35 Chromium, cinco grupos reais com 1205 medições e recuperação real num terceiro destino novo. Logout global partilhado trata também revogação não confirmada. Ver [revisão técnica atual](docs/SECURITY_REVIEW_20261016.md). PR #10 depende de #9; ambos permanecem fora da versão publicada.

## Entrega de fundações — 14-10-2026

Fases 0 e 1A implementadas localmente; controlos técnicos da Fase 1B implementados. Checkpoint histórico: a aplicação de produção/Render continua no baseline anterior; as fundações foram entretanto instaladas apenas no staging cloud dedicado (ver STAGING_20261016.md). Não houve publicação. Antes de ligar este frontend novo a Supabase real, seguir [FOUNDATIONS.md](docs/FOUNDATIONS.md), incluindo backup/restauro cloud, provisionamento explícito e JWT/PostgREST em staging.

Novas áreas: /acessos para competências/atribuições e convites do aluno; /aluno para acesso próprio mínimo, medições publicadas e privacidade. Fundações validadas em Supabase local real; a Fase 2 está separada na branch `feat/aura-student-360` / PR #10. [Estado efetivo de integração](docs/INTEGRATION_STATUS.md), [baseline](docs/FOUNDATION_BASELINE.md), [segurança e recuperação](docs/FOUNDATIONS.md).

O responsável mantém pendentes as decisões jurídicas e o gate cloud de recuperação. Não há eliminação automática. Para ensaio físico de recuperação **apenas sintético local**: npm run test:recovery:local.


SaaS White Label para PTs, estúdios e ginásios. A aplicação está exclusivamente em
`commercial/`; o NutriTrack pessoal e `main` não fazem parte deste desenvolvimento.
Tema Dark Premium: #0F1414, #161D1D, #1D2626, #137F79 e #F2F7F6.

## Executar e validar

Node 22, dependências fixadas no lockfile:

```sh
npm ci
npm run check
npm audit --audit-level=moderate
npx playwright install chromium
npm run test:e2e
```

`check` executa testes de domínio/PostgreSQL, TypeScript e build.
`test:e2e` inicia o build local em 127.0.0.1:3187; executar `check` antes.
No Windows, definir `NEXT_TELEMETRY_DISABLED=1` evita escrita de telemetria fora do projeto.

Copiar `.env.example` para `.env.local` e preencher URL e chave publishable de um
Supabase **isolado com as dez migrations**. O projeto `vfplbkfxipfictuwkkoe` é produção protegida, ainda no baseline anterior: não o usar para testar este frontend. Nunca usar chaves secret/service_role
no frontend nem ligar bases NutriTrack, Sentinel ou GPS. Ficheiros `.env*`, fixtures,
traces e resultados locais estão fora do Git.

Sem credenciais cloud, CI usa URL/chave fictícias para build e intercepta a API nos
testes de interface. RLS é validado separadamente em PostgreSQL PGlite; não é simulado
por essas respostas de browser. Testes reais opcionais: ver a documentação abaixo.

## Módulos

- `/`: login e dashboard com ativos/arquivados, avaliações recentes e acompanhamento pendente.
- `/alunos`: pesquisa literal, filtros, paginação de 25, criação, edição, arquivo e histórico auditável.
- `/alunos/[id]?org=UUID`: ficha com objetivo, responsável, estado, revisão, evolução, avaliações e agenda do aluno.
- `/agenda`: sessões, avaliações e revisões, períodos de dia/7 dias, filtros, paginação e estados de presença.
- `/avaliacoes`: seleção de aluno, registo, histórico paginado e gráfico das últimas 30 avaliações.
- `/equipa` e `/convite`: hierarquia owner/admin/coach, convites pessoais de uso único e revogação.
- `/marca`: nome/cor White Label, permissões e pré-visualização com contraste automático AA.
- `/demo`: demonstração pública em memória, dados fictícios repostos ao recarregar.
- `/demo/aluno-360`: preview sintético da ficha, avaliações, evolução, objetivos e agenda em memória; não publicado nesta entrega.

O indicador pendente significa aluno ativo sem avaliação, ou última avaliação há
mais de 30 dias. Não representa consultas agendadas nem interpretação clínica. As revisões
explícitas e as marcações de hoje aparecem separadamente nas prioridades do dashboard.

## Arquitetura e segurança

Next.js App Router, componentes React, cliente Supabase público partilhado,
`useProfessional` para identidade/estabelecimentos e componentes comuns para shell,
seletor de estabelecimento, identidade e avaliações. RLS no PostgreSQL é a fronteira
de autorização; membership vem do banco e nunca de metadata editável do utilizador.
FK composta impede avaliações ligadas a alunos de outra empresa.

Migrações incrementais: `schema.sql`, `002_assessments.sql`, `003_branding.sql`, depois
`supabase/migrations/*.sql` por ordem. `npm run db:bundle` gera instalador transacional
com checksums SHA-256 e proteção contra edição/reexecução de migrações aplicadas.
Não editar ficheiros aplicados nem usar este instalador numa base pessoal.

CI canónico: `.github/workflows/aura-commercial.yml`, na raiz do repositório.
Valida a branch/PR com testes, TypeScript, build, auditoria npm e Chromium contra
o código local do PR; não depende de uma versão antiga já publicada.

## Estado da entrega

Fundações: suite de 41 testes de domínio/PostgreSQL e proteção de staging, 25 Chromium com API interceptada, TypeScript e build. Supabase local real: 16 grupos Auth/RLS e seis grupos de segurança Auth passaram novamente em 16/10/2026. O controlo restaurado conserva oito migrations; o principal tem dez. Ver [evidências e limites](docs/INTEGRATION_STATUS.md). O restauro sintético não equivale a um backup operacional cloud.

A demo cloud/Render continua no baseline auditado. As duas migrations novas estão versionadas, mas não aplicadas na cloud. Novas permissões exigem competências e atribuições explícitas; não há backfill em massa de acesso sensível. Ver docs/FOUNDATIONS.md para a sequência de staging/recuperação antes de ligar o frontend novo a uma API real.

O último advisor cloud observado tinha proteção contra passwords comprometidas desativada; não foi novamente consultado nesta retoma. Política de MFA/sessões, decisões jurídicas, direitos completos, backup/restauro cloud e JWT/PostgREST no futuro staging cloud são gates pendentes antes de dados reais. Pedidos de eliminação são registados para análise, sem expurgo automático. NutriTrack permanece intacto e não foi usado para sincronização.

A integração das fundações está no PR #9 em draft, sem merge ou deploy. O PR #10 inicia Aluno 360º sobre esta base, com dados fictícios. Ver [consolidação e gates de staging](docs/STAGING_VALIDATION.md). Os runners live antigos foram bloqueados porque apontavam para o projeto protegido; o novo runner exige staging e restauro verificado.
## Documentação

- [Auditoria e decisões desta entrega](docs/PROFESSIONAL_WORKSPACE.md)
- [Próximos passos](docs/ROADMAP.md)
- [Gestão de alunos](docs/CLIENT_MANAGEMENT.md)
- [Equipa e convites](docs/TEAM_INVITATIONS.md)
- [Auth e integração real](docs/AUTH_INTEGRATION.md)
- [Publicação existente](docs/DEPLOYMENT.md)
- [Registos de validação anteriores](docs/VALIDATION_HISTORY.md)
