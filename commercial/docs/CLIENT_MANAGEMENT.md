# Gestão de alunos — AURA Business

## Funcionalidades
/alunos: pesquisa literal por nome, filtros de ativos/arquivados/todos, contagem exata,
paginação de 25 registos, criação, edição de nome, arquivo e reativação.
A ordenação por nome e UUID mantém as páginas estáveis para um conjunto sem alterações.
Mudanças concorrentes na lista podem mover registos entre páginas; não é um snapshot.

Todos os profissionais associados podem criar alunos e editar o nome. Apenas owner/admin
podem arquivar ou reativar. Não existe eliminação de aluno pelo browser.
Arquivo preserva as avaliações existentes; novas avaliações de arquivados são recusadas
no servidor, incluindo pedidos diretos à Data API. Um bloqueio no registo serializa
arquivo e inserção de avaliações. A reativação permite voltar a registar medições.

Cada alteração recebe versão e timestamp do servidor. Gravações com versão antiga
recebem HTTP 409 / PT409 e a interface pede revisão após atualizar a lista.
Criar aluno não permite falsificar estado arquivado, versão ou timestamps.

Histórico paginado com criação/alteração de nome/arquivo/reativação, identificador do
profissional, data e versão. Schema privado, sem acesso direto; RPC exige membro do
estabelecimento e aluno desse mesmo estabelecimento. Não copia nomes anteriores nem
medições para o log. Dados anteriores à migração não têm eventos retroativos inventados.

## Integração
Painel: total exato de alunos ativos, pré-visualização de 10 e link para /alunos.
Avaliações: seletor com pesquisa/paginação, acesso por link do aluno, histórico individual
paginado (25), gráfico das últimas 30 avaliações. Permite consultar arquivados.
Identidade White Label mantida em alunos/avaliações. Sem alteração do design global.
Trocas de estabelecimento/aluno invalidam respostas antigas e limpam dados do contexto.

## Migrações aplicadas ao Supabase dedicado
20261013181649_client_management.sql: estado/versão, audit trail, RPC e bloqueio de avaliações.
20261013201340_client_conflict_response.sql: conflitos de versão explícitos como HTTP 409.
A correção é incremental: não altera o ficheiro/checksum da migração já aplicada.
Durante a validação, 40001 originou resposta expirada no pedido concorrente. Com PT409,
a API devolveu uma gravação HTTP 200 e uma recusa HTTP 409, sem sobrescrita.
Não foi atribuída uma causa definitiva ao timeout original.

## Evidência executada
- Dez testes locais passaram; lifecycle, isolamento, validações, arquivo e histórico.
- TypeScript e build passaram, incluindo a nova página /alunos.
- npm run test:clients:api passou com contas fictícias e JWT/PostgREST reais.
- 120 alunos em cinco páginas, sem duplicações ou perdas (25/25/25/25/20).
- Pesquisa literal de caracteres %/_ validada.
- Duas gravações sobre a mesma versão: uma aceite e uma HTTP 409.
- Coach, utilizador sem empresa e outra empresa não podem arquivar indevidamente.
- Admin pode arquivar/reativar na própria empresa; owner também.
- Avaliações preservadas no arquivo; nova inserção recusada até reativar.
- Alterações diretas fora da RPC e leitura do histórico de outra empresa recusadas.
- 122 alunos gerados (120 paginados + caso literal + empresa B), avaliações e eventos
  associados removidos por limpeza limitada aos UUIDs da execução. Dados demo originais intactos.

## Limites
QA visual e interações no browser continuam adiados conforme preferência do responsável.
Pesquisa não remove acentos; é substring literal sem distinção maiúsculas/minúsculas.
Gráfico é uma janela de 30 avaliações, não substitui o histórico paginado completo.
Identificação no histórico é pelo UUID do profissional (ou «Tu» para o próprio).
Auditor Supabase: RLS sem políticas nas tabelas privadas é intencional (acesso direto negado).
Proteção de palavras-passe comprometidas continua desativada; rever Auth no Dashboard:
https://supabase.com/docs/guides/auth/password-security#password-strength-and-leaked-password-protection
Demonstração exclusivamente com dados fictícios; não é aprovação para dados reais.
