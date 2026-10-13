# Até à demonstração online

## Preparado
Aplicação Next.js, Supabase dedicado, isolamento SQL e API pública testados.
Blueprint de demonstração em commercial/render.yaml, branch saas-foundation,
rootDir commercial, health check /api/health, deploys automáticos desativados.
Nenhum recurso Render criado nem publicação realizada nesta etapa.
Configuração YAML preparada segundo a documentação; ainda não validada pelo CLI Render.

## Contas sintéticas e testes autenticados
1. Guardar localmente a chave administrativa sb_secret_... em .env.admin.local como
   SUPABASE_SECRET_KEY. Ficheiro já abrangido pelo .gitignore; nunca usar NEXT_PUBLIC_.
2. npm run test:accounts:create cria quatro contas confirmadas via Auth Admin, sem emails.
   UUIDs e palavras-passe aleatórias; credenciais apenas em .aura-integration/accounts.env,
   também ignorado. O comando não altera contas existentes nem publica um endpoint admin.
3. npm run test:auth:prepare autentica as quatro contas e gera provision.sql/cleanup.sql.
4. Aplicar provision.sql apenas no Supabase AURA e executar npm run test:auth.
5. Aplicar cleanup.sql, executar test:accounts:cleanup e retirar os ficheiros locais
   de credenciais/fixtures depois de confirmar a limpeza. Revogar a chave temporária
   no Dashboard quando terminar a operação administrativa.
Criação e login autenticado ainda pendentes da disponibilidade local da chave.

## Para colocar a base online
- Fechar os testes com login real e JWT/PostgREST entre as duas empresas.
- Criar serviço de demonstração Render com o Blueprint; fornecer apenas publishable key.
- Configurar URL e redirects Auth para o domínio HTTPS aprovado.
- Validar /api/health, /, /avaliacoes, /marca e /demo após o deploy, incluindo login/logout.
- Rever visual/responsividade com ChatGPT e validar as alterações no browser.
- Ativar CI no GitHub: workflow na raiz .github/workflows; template já preparado em commercial/ci.

## Depois da demonstração
Convites/gestão de profissionais, portal do aluno, paginação e uploads White Label.
Para dados reais: consentimento/retencão/direitos, auditoria, backups e política de sessões.
Subscrições e pagamentos são uma fase posterior. Demonstração não equivale a produção aprovada.
