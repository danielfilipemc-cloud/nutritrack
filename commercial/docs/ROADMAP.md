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
- Dez testes automatizados, incluindo RLS PostgreSQL, replay, checksum e rollback do harness cloud.
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
- Autenticação anónima desativada. Quatro contas criadas via Auth Admin e testes
  autenticados A/B via PostgREST passaram; fixtures mantidas para a demonstração.
- CI ativo em .github/workflows/aura-commercial.yml: testes, TypeScript, build, auditoria de dependências e smoke tests de browser.
- Browser indisponível: faltam QA visual e testes end-to-end de formulários/sessões.

## Antes de um piloto com dados reais
1. Rever proteção antiabuso do signup email; manter anonymous sign-in desativado.
2. Testes Auth/PostgREST concluídos e demonstração publicada; validar fluxos no browser.
3. Equipa e convites implementados; validar visual e emails reais, preparar entrega automática.
4. Consentimento, retenção, direitos do titular, backups e política de sessões/MFA.
5. Paginação de alunos/avaliações concluída; falta fluxo auditável de correção de avaliações.
6. Ampliar validação visual e end-to-end autenticada em desktop/mobile.

## Evolução comercial
Portal de alunos, logótipos em storage privado, domínios verificados, subscrições e pagamentos.
Sem publicação de produção nem merge para main nesta entrega.

## Demonstração publicada
https://aura-business-demo.onrender.com — live, cinco rotas verificadas.
Site URL/redirects configurados segundo confirmação do responsável. QA visual e
confirmação por email continuam pendentes. Detalhes em DEPLOYMENT.md.

## Equipa e convites implementados
/equipa e /convite, gestão por hierarquia, convites pessoais de utilização única,
validade/revogação, cadastro com email confirmado e audit trail privado.
Testes locais e JWT/PostgREST passaram. Ver TEAM_INVITATIONS.md.

## Gestão de alunos concluída
Pesquisa, paginação, edição, arquivo/reativação, versões concorrentes e audit trail.
Avaliações individuais paginadas e histórico de arquivados preservado.
Dez testes locais e integração JWT/PostgREST passaram. Ver CLIENT_MANAGEMENT.md.
