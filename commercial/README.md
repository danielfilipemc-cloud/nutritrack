# AURA Business

## Entrega de fundações — 14-10-2026

Fases 0 e 1A implementadas localmente; controlos técnicos da Fase 1B implementados. A aplicação cloud/Render continua no baseline anterior: **as duas migrations novas não foram aplicadas na cloud e não houve publicação**. Antes de ligar este frontend novo a Supabase real, seguir [FOUNDATIONS.md](docs/FOUNDATIONS.md), incluindo backup/restauro cloud, provisionamento explícito e JWT/PostgREST em staging.

Novas áreas: /acessos para competências/atribuições e convites do aluno; /aluno para acesso próprio mínimo, medições publicadas e privacidade. Não se avançou para a Fase 2. [Baseline](docs/FOUNDATION_BASELINE.md), [segurança, limites e recuperação](docs/FOUNDATIONS.md).

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

Copiar `.env.example` para `.env.local` e preencher URL e chave publishable do
Supabase **AURA dedicado** `vfplbkfxipfictuwkkoe`. Nunca usar chaves secret/service_role
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

Fundações locais: 40 testes (21 contratos históricos, 15 do schema completo/upgrade e 4 de proteção do staging), 25 Chromium com API interceptada, TypeScript e build no Node 22.23.3. O ensaio físico local de backup/restauro passou; não equivale a um backup do projeto Supabase.

A demo cloud/Render continua no baseline auditado. As duas migrations novas estão versionadas, mas não aplicadas na cloud. Novas permissões exigem competências e atribuições explícitas; não há backfill em massa de acesso sensível. Ver docs/FOUNDATIONS.md para a sequência de staging/recuperação antes de ligar o frontend novo a uma API real.

O advisor cloud continua com proteção contra passwords comprometidas desativada. MFA/sessões, decisões jurídicas, direitos completos, backup/restauro cloud e JWT/PostgREST das políticas novas são gates pendentes antes de dados reais. Pedidos de eliminação são registados para análise, sem expurgo automático. NutriTrack permanece intacto e não foi usado para sincronização.

Não se avançou para a Fase 2. A integração GitHub é uma PR em draft para revisão, sem merge ou deploy. Ver [consolidação e gates de staging](docs/STAGING_VALIDATION.md). Os runners live antigos foram bloqueados porque apontavam para o projeto protegido; o novo runner exige staging e restauro verificado.
## Documentação

- [Auditoria e decisões desta entrega](docs/PROFESSIONAL_WORKSPACE.md)
- [Próximos passos](docs/ROADMAP.md)
- [Gestão de alunos](docs/CLIENT_MANAGEMENT.md)
- [Equipa e convites](docs/TEAM_INVITATIONS.md)
- [Auth e integração real](docs/AUTH_INTEGRATION.md)
- [Publicação existente](docs/DEPLOYMENT.md)
- [Registos de validação anteriores](docs/VALIDATION_HISTORY.md)
