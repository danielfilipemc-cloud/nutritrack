# AURA Business

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
- `/alunos/[id]?org=UUID`: ficha individual e avaliações; dados resolvidos apenas na organização autorizada.
- `/avaliacoes`: seleção de aluno, registo, histórico paginado e gráfico das últimas 30 avaliações.
- `/equipa` e `/convite`: hierarquia owner/admin/coach, convites pessoais de uso único e revogação.
- `/marca`: nome/cor White Label, permissões e pré-visualização com contraste automático AA.
- `/demo`: demonstração pública em memória, dados fictícios repostos ao recarregar.

O indicador pendente significa aluno ativo sem avaliação, ou última avaliação há
mais de 30 dias. Não representa consultas agendadas nem interpretação clínica.

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

13 testes locais/PostgreSQL, TypeScript, build e auditoria npm aprovados; 12 cenários
Chromium com API interceptada e três cenários Chromium reais com contas fictícias
aprovados. Auth/PostgREST real também aprovado. Evidências e limites em
[PROFESSIONAL_WORKSPACE.md](docs/PROFESSIONAL_WORKSPACE.md).

Demonstração existente: https://aura-business-demo.onrender.com/ e `/demo`.
Esta continuação é entregue por PR para `saas-foundation`, sem merge nem deploy.
A migração `20261013202654_professional_dashboard.sql` aguarda integração; o novo
dashboard não deve ser publicado antes dela. O projeto cloud mantém seis migrações
registadas; o instalador da branch contém sete. Não é aprovação para produção.

Proteção contra palavras-passe comprometidas ainda desativada. Consentimento,
retenção, direitos dos titulares, backups e política de sessões/MFA exigem trabalho
antes de dados reais. Logótipos/uploads, portal de alunos, domínios personalizados,
subscrições e pagamentos continuam fora desta entrega.

## Documentação

- [Auditoria e decisões desta entrega](docs/PROFESSIONAL_WORKSPACE.md)
- [Próximos passos](docs/ROADMAP.md)
- [Gestão de alunos](docs/CLIENT_MANAGEMENT.md)
- [Equipa e convites](docs/TEAM_INVITATIONS.md)
- [Auth e integração real](docs/AUTH_INTEGRATION.md)
- [Publicação existente](docs/DEPLOYMENT.md)
- [Registos de validação anteriores](docs/VALIDATION_HISTORY.md)
