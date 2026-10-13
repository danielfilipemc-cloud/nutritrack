# AURA Business — estado e próximos passos

## Implementado e validado localmente
- Dependências fixadas, lockfile e instalação npm ci.
- Cliente Supabase partilhado; limpeza de estado ao mudar identidade/estabelecimento.
- Proteção contra respostas antigas nas avaliações; seletor bloqueado durante gravações.
- Invalidação imediata também no painel e branding; gravações tardias ignoradas após mudança de identidade/desmontagem.
- Branding bloqueado até terminar o carregamento; preservar URL existente ao guardar nome/cor.
- Validação de nomes, datas, limites e precisão; gráfico com escala temporal e tabela acessível.
- Demonstração sem credenciais em /demo; dados fictícios apenas em memória.
- Cabeçalhos de segurança, melhoria de foco/responsividade.
- Sete testes automatizados, incluindo RLS PostgreSQL, replay, checksum e rollback do harness cloud.
- Build, typecheck e quatro rotas HTTP validados.

## Integração Supabase (12–13-10-2026)
- Ligação Aura Business verificada; projeto `vfplbkfxipfictuwkkoe` ACTIVE_HEALTHY e inicialmente vazio.
- Esquema instalado por MCP, três migrações com checksums; RLS nas cinco tabelas.
- Matriz SQL A/B, owner/admin/coach, unassigned e anon passou no PostgreSQL cloud.
- Fixtures revertidas; nenhum utilizador ou dado de negócio persistido.
- Advisor de segurança sem alertas; API recusa anónimos nas cinco tabelas (401/42501).
- `.env.local` configurado localmente com chave publishable, ignorado pelo Git.

## Bloqueios de integração
- Signup email ativo por decisão do responsável; sem atribuição automática de membership.
- Autenticação anónima desativada, mas faltam contas sintéticas provisionadas por Auth Admin
  e testes autenticados A/B via PostgREST; SQL com claims simulados não substitui esses testes.
- Runner e procedimento em `docs/AUTH_INTEGRATION.md` preparados. Responsável confirmou
  em 13-10-2026 que ainda não há contas; execução autenticada permanece pendente.
- Workflow preparado em commercial/ci; ativação requer ficheiro na raiz .github/workflows.
- Browser indisponível: faltam QA visual e testes end-to-end de formulários/sessões.

## Antes de um piloto com dados reais
1. Rever proteção antiabuso do signup email; manter anonymous sign-in desativado.
2. Provisionar contas sintéticas por administração confiável e executar testes allow/deny pela API.
3. Provisionamento/convites seguros; gestão de profissionais e auditoria.
4. Consentimento, retenção, direitos do titular, backups e política de sessões/MFA.
5. Paginação, fluxo auditável de correção de avaliações e timestamps do servidor.
6. Validação visual e end-to-end desktop/mobile; ativar CI.

## Evolução comercial
Portal de alunos, logótipos em storage privado, domínios verificados, subscrições e pagamentos.
Sem publicação de produção nem merge para main nesta entrega.
