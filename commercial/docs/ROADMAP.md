# AURA Business — estado e próximos passos

## Implementado e validado localmente
- Dependências fixadas, lockfile e instalação npm ci.
- Cliente Supabase partilhado; limpeza de estado ao mudar identidade/estabelecimento.
- Proteção contra respostas antigas nas avaliações; seletor bloqueado durante gravações.
- Branding bloqueado até terminar o carregamento; preservar URL existente ao guardar nome/cor.
- Validação de nomes, datas, limites e precisão; gráfico com escala temporal e tabela acessível.
- Demonstração sem credenciais em /demo; dados fictícios apenas em memória.
- Cabeçalhos de segurança, melhoria de foco/responsividade.
- Cinco testes automatizados, incluindo RLS PostgreSQL, replay e checksum de migrações.
- Build, typecheck e quatro rotas HTTP validados.

## Bloqueios de integração
- Organização/projeto Supabase independente ainda por escolher/disponibilizar.
- Duas ligações acessíveis mostram só Dashboard Zas / GPS Centro Sul; Sentinel/Maryatchi não visíveis.
- Workflow preparado em commercial/ci; ativação requer ficheiro na raiz .github/workflows.
- Browser indisponível: faltam QA visual e testes end-to-end de formulários/sessões.

## Antes de um piloto com dados reais
1. Configurar projeto Supabase independente e desativar signup/anonymous auth.
2. Executar migrações e repetir testes allow/deny pela API com utilizadores sintéticos.
3. Provisionamento/convites seguros; gestão de profissionais e auditoria.
4. Consentimento, retenção, direitos do titular, backups e política de sessões/MFA.
5. Paginação, fluxo auditável de correção de avaliações e timestamps do servidor.
6. Validação visual e end-to-end desktop/mobile; ativar CI.

## Evolução comercial
Portal de alunos, logótipos em storage privado, domínios verificados, subscrições e pagamentos.
Sem publicação de produção nem merge para main nesta entrega.
