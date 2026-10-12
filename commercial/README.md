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

Criar um **projeto novo**, numa organização escolhida pelo responsável. Pode usar
uma conta existente com capacidade; não reutilizar a base do NutriTrack ou Sentinel.
Não executar SQL em projetos existentes. Nenhum projeto cloud foi criado nesta sessão.

1. Desativar inscrições públicas e autenticação anónima no projeto novo.
2. Configurar URLs de autenticação apenas para os ambientes aprovados.
3. `npm run db:bundle` gera `supabase/install.generated.sql`.
4. Rever e executar o SQL gerado no editor SQL do **projeto novo vazio**.
5. Copiar `.env.example` para `.env.local` e preencher URL e chave publishable desse projeto.
6. Criar utilizadores fictícios com email confirmado através de administração confiável.
7. Provisionar organizações e `organization_members` como administrador; nunca pelo browser.
8. Testar login e isolamento pela API Supabase com utilizadores A/B antes de dados reais.

O instalador mantém a ordem `schema.sql`, `002_assessments.sql`, `003_branding.sql`,
numa transação com histórico privado e SHA-256. Repetir o instalador salta migrações
já registadas; alterar uma migração aplicada provoca erro. Não adota automaticamente
bases onde os ficheiros tenham sido executados manualmente. As alterações futuras
precisam de novas migrações; nunca editar uma migração registada.

## Validação executada em 12-10-2026

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

## CI

`npm run check` é o comando comum de validação. O workflow pronto está em
`ci/github-actions.yml`. **Ainda não está ativo no GitHub**: precisa ser colocado em
`.github/workflows/aura-commercial.yml` na raiz, fora do limite autorizado de alterações
em `commercial/`. Usa npm ci, testes, typecheck, build e npm audit; sem segredos nem deploy.

## Segurança e limites

RLS autoriza membros pelo banco, sem confiar em metadata editável. Apenas owner/admin
podem editar branding. FK composta impede avaliações de alunos de outro estabelecimento.
Avaliações não podem ser editadas/apagadas pelo browser. O cliente usa apenas chave pública.
Não foram consultados nem alterados dados de bases existentes.

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
