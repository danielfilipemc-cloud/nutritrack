# Fechar a validação Auth/PostgREST

Projeto autorizado: `vfplbkfxipfictuwkkoe`, ligação Aura Business.
O esquema e o isolamento SQL já foram validados. Este teste usa sessões emitidas
pelo Supabase Auth e chamadas reais à Data API; ainda não foi executado com contas.
Não é um teste visual dos formulários.

## 1. Configuração no Dashboard

Signup por email mantido ativo por decisão explícita do responsável em 13-10-2026.
Manter anonymous sign-ins desativados. `npm run cloud:check` verifica negações anónimas
na Data API e essa restrição Auth; não exige fechar signup por email.

Em Authentication → Users → Add user → Create new user, criar quatro contas
**fictícias e confirmadas**, com palavras-passe diferentes e fortes. Usar criação
administrativa com confirmação automática, não Send invitation nem signup público.
Exemplos: `owner-a@aura.example`, `admin-b@aura.example`, `coach-a@aura.example`,
`unassigned@aura.example`. Estas contas não podem ter associações prévias.

Alternativa automatizada preparada: seguir docs/ONLINE_DEMO.md e usar
`npm run test:accounts:create` com chave secret apenas em .env.admin.local.
O conector MCP atual não fornece operações Auth Admin/configuração Auth.
O Browser falha ao inicializar com `node:process` bloqueado. Por isso esta etapa
requer o Dashboard autenticado do responsável. Não enviar passwords, tokens nem
chaves administrativas no chat.

## 2. Credenciais locais e preparação

No checkout usado para executar a aplicação, acrescentar ao `.env.local` já
ignorado pelo Git os valores das contas criadas:

```dotenv
AURA_TEST_OWNER_A_EMAIL=
AURA_TEST_OWNER_A_PASSWORD=
AURA_TEST_ADMIN_B_EMAIL=
AURA_TEST_ADMIN_B_PASSWORD=
AURA_TEST_COACH_A_EMAIL=
AURA_TEST_COACH_A_PASSWORD=
AURA_TEST_UNASSIGNED_EMAIL=
AURA_TEST_UNASSIGNED_PASSWORD=
```

Dentro de `commercial/`, executar `npm run test:auth:prepare`.
O comando valida quatro logins distintos e ausência de memberships, termina as
sessões de preparação e gera `.aura-integration/provision.sql`, `cleanup.sql` e
`fixture.json`. Todos estão ignorados; não contêm passwords, emails ou JWTs.
Não há criação pública de utilizadores nem chave service-role/secret na aplicação.

## 3. Provisionar e executar

Executar **apenas** `.aura-integration/provision.sql` no SQL Editor do projeto
autorizado como administrador. Cria duas organizações, três memberships e dois
alunos fictícios. Os UUIDs das contas são os obtidos nos logins; não se escreve
diretamente em `auth.users`.

Executar `npm run test:auth`. O teste confirma leitura/escrita do próprio tenant,
recusa de acesso ao outro, FK de aluno/organização, recusa de falsificação do autor,
proibição de edição/eliminação de avaliações, branding owner/admin e recusa coach,
utilizador sem organização e escalada por inserção de memberships. Cada conta usa
um cliente independente e as sessões são terminadas no final, incluindo em erro.

Um PASS só é evidência se o comando terminar com exit code 0. Se falhar, guardar
apenas a mensagem sem credenciais e executar a limpeza antes de preparar de novo.

## 4. Limpar

Executar `.aura-integration/cleanup.sql` no mesmo SQL Editor. Elimina só as duas
organizações com UUIDs aleatórios desta execução e os dados associados por cascade.
Confirmar ausência desses UUIDs, eliminar as quatro contas pelo Auth Admin e retirar
as oito variáveis de teste de `.env.local`. Eliminar então `.aura-integration/`.
Se o teste indicar falha de sign-out, revogar primeiro as sessões no Auth Admin.

## Evidência executada em 13-10-2026

- Quatro contas confirmadas criadas via Auth Admin, sem emails de convite.
- Chave administrativa exclusivamente em .env.admin.local; credenciais geradas em
  .aura-integration/accounts.env. Ambos ignorados pelo Git e fora da aplicação pública.
- npm run test:auth:prepare passou: quatro logins reais e ausência inicial de memberships.
- provision.sql aplicado somente ao projeto AURA: duas empresas e associações sintéticas.
- npm run test:auth passou com JWTs emitidos por Supabase Auth e chamadas PostgREST.
- OWNER_A/ADMIN_B: leituras e escritas próprias permitidas; outras empresas bloqueadas.
- FK de aluno, autor falsificado, alteração/remoção de avaliações e escalada de membership bloqueadas.
- Coach: leitura da marca permitida e escrita recusada. Unassigned: sem acesso comercial.
- Sessões terminadas no finally; sem falhas de sign-out reportadas.
- Contas e fixtures foram mantidas intencionalmente para a demonstração, conforme o
  pedido de contas fictícias. Não executar novamente --prepare enquanto existirem.
- Para remover: procedimento cleanup acima; nunca apagar contas ou organizações alheias.
- Signup email continua ativo por escolha do responsável; QA visual ainda pendente.
