# Supabase AURA — validação de 13-10-2026

Projeto: vfplbkfxipfictuwkkoe. Ligação: Aura Business. Região: eu-west-1.
Migração existente: 20261012225833_aura_business_foundation; não reaplicada.

## Evidência executada
- Cinco tabelas comerciais com RLS e permissões explícitas auditadas.
- Supabase security advisor: nenhum alerta.
- Harness gerado por npm run db:verify:sql: PASS, 57 verificações no Postgres remoto.
- Duas empresas, owner/admin, coach, utilizador sem empresa, identidade vazia e anon.
- Leitura/escrita entre empresas bloqueadas; FK composta, autoria e limites de avaliações.
- Branding alterável por owner/admin; coach não altera. Membership não autoatribuível.
- Fixtures sintéticas com UUIDs aleatórios, numa transação terminada em ROLLBACK.
- Contagens posteriores: auth.users, organizations, organization_members, clients,
  assessments e organization_branding todas a zero.
- API PostgREST com publishable key, sem JWT: HTTP 401 nas cinco tabelas.
- API Auth settings: confirmação de email ativa e anonymous sign-in desativado.
- Signup por email ativo, mantido por decisão explícita do responsável.
- Sete testes locais passaram após integrar a branch remota; TypeScript passou; build com .env.local passou.
- Build inicialmente bloqueado pela escrita de telemetria fora do sandbox; executado
  com NEXT_TELEMETRY_DISABLED=1, sem necessitar de alterar permissões ou código.

## Configuração
.env.local contém exclusivamente URL e chave publishable do projeto; ignorado por Git.
Nenhuma chave administrativa foi obtida, guardada no cliente ou publicada.
O SQL de testes não cria passwords nem contas permanentes; não envia emails.

## Limites
Os 57 testes remotos simulam claims SQL para testar RLS. Não validam assinatura JWT,
login, refresh de sessão ou autorização autenticada através de PostgREST.
Não foi criado utilizador permanente nem associação empresarial de demonstração.
Continuam pendentes testes de login com contas fictícias provisionadas por API Admin,
QA visual/browser e ativação de GitHub Actions fora do âmbito commercial/.
Signup ativo não atribui memberships e não concede acesso a dados de empresas.
Nenhum deploy de produção, acesso a dados reais ou alteração a NutriTrack/GPS/Sentinel.

## Integração com a branch remota

Preservados os commits remotos até c95c26a, incluindo invalidação imediata de leituras/
gravações e runner Auth/PostgREST. Testes adicionais integrados no commit 4f4ae4e.
Validação após rebase: npm run check passou (7 testes, TypeScript e build com .env.local).
`npm run cloud:check` passou nas cinco tabelas (HTTP 401 e código 42501) e verificou
anonymous sign-in desativado. Signup email continua ativo por escolha do responsável.
O runner API duplicado foi consolidado em scripts/cloud-check.ts; db:verify:api é alias.

## Validação autenticada real — 13-10-2026

Quatro contas criadas pelo Auth Admin com passwords aleatórias e email confirmado,
sem envio de convites. Dois estabelecimentos fictícios provisionados, três memberships,
utilizador sem associação e alunos de teste. npm run test:auth:prepare e npm run test:auth
passaram usando JWTs reais e PostgREST; não se limitaram a simular claims SQL.
Owner/admin: CRUD autorizado do MVP e negações cross-tenant. Coach: branding recusado.
Unassigned: leitura/escrita comercial recusadas. FK, autor, memberships e imutabilidade
verificados. Sessões terminadas no fim. Contas e dados fictícios mantidos para demo;
manifest e credenciais ignorados pelo Git. Nenhuma chave administrativa publicada.
Assim, as referências anteriores a testes autenticados pendentes ficam superadas.
Falta alojamento da demonstração, validação browser e ativação efetiva do CI.
