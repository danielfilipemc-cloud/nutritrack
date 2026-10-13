# Demonstração AURA Business — online

URL: https://aura-business-demo.onrender.com
Sem credenciais: https://aura-business-demo.onrender.com/demo
Render: workspace Maryatchi hub, plano free, Frankfurt, auto deploy desativado.
Service ID: srv-db76rpmi0phs738pd9ug
Deploy ID: dep-db76rqei0phs738pdc50
Commit publicado: 1f6ca4a819ab220b1eb456c6a6bc62281b6872ee
Estado confirmado: live em 13-10-2026, 18:45 Europe/Lisbon.

## Configuração efetiva
Serviço criado via MCP; a criação não permite definir rootDir/healthCheckPath.
Os comandos fazem cd commercial explicitamente; nenhuma aplicação legada é compilada.
Build: cd commercial && npm ci --include=dev && npm run check
Start: cd commercial && npm run start -- --hostname 0.0.0.0 --port $PORT
Node 22.23.3 e NEXT_TELEMETRY_DISABLED=1. Apenas URL e publishable key Supabase no serviço.
O endpoint /api/health existe e foi validado manualmente; não é o healthCheckPath
configurado no recurso, que usa a verificação padrão do Render. Blueprint em render.yaml
é uma configuração reproduzível alternativa, não foi aplicado nesta criação direta.

## Verificações executadas
npm run test:deploy passou: /api/health, /, /avaliacoes, /marca, /demo com HTTP 200.
DENY, nosniff, no-store e ausência de X-Powered-By confirmados.
11 bundles JS públicos responderam HTTP 200. Chave administrativa local não apareceu
nos HTML/JS inspecionados. Isto não é uma auditoria completa de leakage.
Logs com nível error desde o arranque: nenhum resultado na consulta realizada.
O pipeline Render executou npm run check antes de disponibilizar a aplicação.
Testes Auth/PostgREST e isolamento entre quatro contas foram executados anteriormente.

## Autenticação
O responsável confirmou a configuração de Site URL e redirect URLs para o domínio
online no Dashboard Supabase. O conector não permite ler/alterar essa configuração;
a confirmação de um link real de email não foi executada. Signup por email ativo,
anonymous sign-in desativado, sem atribuição automática de memberships.
Contas e dados fictícios mantidos para demonstração. Credenciais apenas no ficheiro
local ignorado .aura-integration/accounts.env; nunca no serviço Render ou no Git.

## Limites
Demonstração pública para dados fictícios; não é produção aprovada para dados reais.
QA visual e formulários no browser pendentes; browser de automação indisponível.
GitHub Actions ainda requer ativação na raiz .github/workflows; deploy executa checks.
Rever visual com ChatGPT. Portal de aluno, convites, subscrições e uploads ainda pendentes.
O plano gratuito pode ter arranque a frio. Nenhum serviço existente foi alterado.
Atualizações requerem deploy manual porque auto deploy está desativado.

## Atualização equipa/convites — 13-10-2026
Commit publicado 051a9e0; deploy dep-db777hivcj2c73cflqm0 confirmado live.
Rotas adicionais /equipa e /convite. Sete rotas HTTP 200, cabeçalhos verificados e
13 bundles JS inspecionados sem exposição da chave administrativa local.
Testes locais: oito passaram. Testes novos via JWT/PostgREST passaram, incluindo
aceitação concorrente de convite e perda imediata de acesso após remoção.
QA visual e confirmação de email real continuam pendentes. Ver TEAM_INVITATIONS.md.
