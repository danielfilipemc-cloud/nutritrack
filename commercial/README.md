# AURA Business

Aplicação comercial independente em `commercial/`, branch `saas-foundation`.
Nenhum ficheiro da aplicação pessoal NutriTrack foi alterado.

## Executar

Node 22 + npm. Dentro de `commercial/`:

```sh
npm ci
npm run check
npm run dev
```

Abrir `/demo` para experimentar alunos, avaliações de peso, gráfico e identidade
com dados fictícios em memória, sem autenticação ou ligação a Supabase.
Recarregar repõe os exemplos. A demonstração não valida autorização real.

## Supabase independente

Projeto de desenvolvimento escolhido pelo responsável: `vfplbkfxipfictuwkkoe`,
ligação **Aura Business**, região `eu-west-1`, PostgreSQL 17.11. Foi confirmado vazio
(sem tabelas da aplicação nem utilizadores) antes de instalar o esquema AURA.
Não reutilizar a base do NutriTrack ou Sentinel nem executar o instalador noutras bases.

1. **Pendente:** desativar inscrições públicas no Dashboard, Authentication → Sign In / Providers
   → User Signups → Allow new users to sign up. A API reporta `disable_signup=false`.
   Autenticação anónima já está desativada. Não criar contas através de signup público.
2. Configurar URLs de autenticação apenas para os ambientes aprovados.
3. `npm run db:bundle` gera `supabase/install.generated.sql`.
4. Instalador já aplicado neste projeto pelo MCP (`aura_business_foundation`), na ordem
   original e com três checksums registados em `app_private.aura_migrations`.
5. `.env.local` local já configurado com URL e chave publishable; permanece ignorado pelo Git.
   Noutro checkout, copiar `.env.example` e preencher os valores públicos desse projeto.
6. Criar utilizadores fictícios com email confirmado através de administração confiável.
7. Provisionar organizações e `organization_members` como administrador; nunca pelo browser.
8. Testar login e isolamento pela API Supabase com utilizadores A/B antes de dados reais.

O instalador mantém a ordem `schema.sql`, `002_assessments.sql`, `003_branding.sql`,
numa transação com histórico privado e SHA-256. Repetir o instalador salta migrações
já registadas; alterar uma migração aplicada provoca erro. Não adota automaticamente
bases onde os ficheiros tenham sido executados manualmente. As alterações futuras
precisam de novas migrações; nunca editar uma migração registada.

## Validação desta continuação (12–13-10-2026)

- Node 22.23.3, `npm ci`: passou, zero vulnerabilidades reportadas.
- `npm test`: seis testes passaram, incluindo execução do harness cloud em PGlite
  e confirmação de que todas as fixtures foram revertidas.
- `npm run typecheck` e build: passaram. No Windows, foi necessário definir
  `NEXT_TELEMETRY_DISABLED=1` para evitar erro EXDEV no ficheiro de telemetria global.
- Build final carregou `.env.local`; `next start` em 127.0.0.1:3187 confirmou
  HTTP 200, identidade AURA e cabeçalhos DENY/nosniff/no-store nas quatro rotas
  `/`, `/avaliacoes`, `/marca` e `/demo`. Isto não valida interações no browser.
- `tests/cloud-rls.sql`: executado no PostgreSQL do projeto indicado; resultado PASS
  para isolamento A/B, owner/admin/coach, utilizador sem organização e anon.
  A transação terminou com ROLLBACK; zero utilizadores, organizações e alunos persistidos.
- RLS ativo nas cinco tabelas; advisor de segurança Supabase sem alertas.
- `npm run cloud:check`: as cinco tabelas recusaram acesso anónimo com HTTP 401
  e código PostgreSQL 42501. O comando **falha**, corretamente, porque signup público
  continua ativo; autenticação anónima está desativada. Voltar a executar após corrigir Auth.
- O harness SQL assume um projeto de desenvolvimento vazio e execução como postgres.
  Abrir `tests/cloud-rls.sql` no SQL Editor desse projeto e executar o ficheiro completo.
  Não o executar numa base com dados reais. Os UUIDs são aleatórios e não há passwords,
  emails, sessões ou notificações. Se ocorrer erro, executar ROLLBACK antes de repetir.
- Os testes SQL simulam o papel/JWT no PostgreSQL; ainda não houve login com duas
  contas Supabase Auth nem testes autenticados via PostgREST. Não confundir com E2E.
- Browser continua indisponível: a inicialização falha com `node:process` bloqueado.
  Não foi possível alterar Auth no Dashboard nem executar QA visual nesta continuação.

## Validação anterior em 12-10-2026

- `npm ci`: instalação reproduzível, sem vulnerabilidades reportadas.
- `npm run test`: 5 testes passaram; um deles executa a matriz RLS em PostgreSQL PGlite.
- `npm run typecheck`: passou.
- `npm run build`: passou; páginas `/`, `/avaliacoes`, `/marca`, `/demo` geradas.
- `npm run db:bundle`: passou.
- Servidor `next start`: arrancou; quatro rotas responderam HTTP 200.
- Cabeçalhos HTTP: DENY, nosniff, no-referrer, no-store e restrições de permissões;
  smoke test confirmou DENY, nosniff, no-store e ausência de X-Powered-By.

PGlite executa PostgreSQL real isolado. O harness cria apenas os contratos mínimos
de `auth.users`, `auth.uid()` e dos papéis. Retira `CREATE EXTENSION pgcrypto` porque
o motor tem `gen_random_uuid()`. Não substitui testes Supabase Auth, PostgREST,
Storage, refresh/revogação de tokens ou integração no projeto cloud.

## Continuação em 13-10-2026

Foi reforçada a invalidação imediata de pedidos em `/` e `/marca` ao trocar de
organização/identidade, incluindo gravações tardias e desmontagem em `/avaliacoes`.
A validação do nome da marca verifica agora também o limite de 100 caracteres.
Seis testes, typecheck e build voltaram a passar após estas alterações.

O runner `npm run test:auth:prepare` / `npm run test:auth` está preparado para
quatro contas confirmadas independentes, sem chave administrativa na aplicação.
O responsável confirmou que ainda não existem essas contas. Preparação sem
credenciais foi executada e abortou como esperado; nenhum login ou teste autenticado
foi marcado PASS. Seguir [o procedimento Auth](docs/AUTH_INTEGRATION.md) para fechar
signup, criar as contas pelo Dashboard, provisionar, executar e limpar as fixtures.

## CI

`npm run check` é o comando comum de validação. O workflow pronto está em
`ci/github-actions.yml`. **Ainda não está ativo no GitHub**: precisa ser colocado em
`.github/workflows/aura-commercial.yml` na raiz, fora do limite autorizado de alterações
em `commercial/`. Usa npm ci, testes, typecheck, build e npm audit; sem segredos nem deploy.

## Segurança e limites

RLS autoriza membros pelo banco, sem confiar em metadata editável. Apenas owner/admin
podem editar branding. FK composta impede avaliações de alunos de outro estabelecimento.
Avaliações não podem ser editadas/apagadas pelo browser. O cliente usa apenas chave pública.
Nesta continuação foi instalado apenas o projeto de desenvolvimento vazio indicado acima;
não foram consultados nem alterados dados das bases legadas.

Não há registo público, convites, portal de alunos, faturação, subscrições, uploads ou
domínios personalizados. O painel limita alunos a 100 e o histórico às últimas 100 avaliações
do estabelecimento; o gráfico apresenta até 30 medições desse conjunto. Falta paginação.
Branding suporta nome/cor; logótipos não são carregados. `updated_at` ainda vem do cliente.
Os tokens são geridos pelo cliente Supabase: MFA, revogação e política de sessões exigem revisão.

A automação Browser falhou na inicialização (`node:process` bloqueado). Não foram executados
cliques/formulários num browser nem inspeção visual desktop/mobile; responsividade foi
melhorada em CSS, mas ainda exige validação visual. Não considerar esta entrega aprovada
para produção ou para dados reais de saúde. Consentimento, minimização, retenção, exportação/
apagamento, auditoria de alterações, backups e revisão legal continuam pendentes.
