# Nutrição P3/P4 — arquitetura de persistência em revisão local

## Integração P1/P2

PR #29: head 6c1e9b94a7e160d7d06368849e8f9e882f8c491c, base saas-foundation, merge 4e2abba3e71abe1e29d52dc9cb8580380817c621. PR #30: head a93cb0e81550139010692094268bffb8f3210c6c; base original P1, retarget para saas-foundation após #29, merge 7e5239af78c127b43d06934a9b8874df24094ffc. Árvore final 11ae4eee6e9a5b9f9fd342ddb42f4d8134dd72ca, idêntica ao candidato P2. Revisão dos contratos, guards e dados inventados sem bloqueio novo confirmado.

Sobre o SHA integrado: 78/78 domínio/PostgreSQL, 178/178 Chromium, lint, TypeScript, build e auditoria npm (zero vulnerabilidades) aprovados. CI de push 39164171963 aprovado. Auto-deploy Render de produção e staging confirmado desligado, apenas por leitura. Nenhuma publicação. Staging permanece em 6823fe0b9d35db9f5edaa4939ed45a022ab01888.

## P3 — modelo e competência separados

Migration incremental criada pela CLI: `20261018203955_nutrition_foundation.sql`. Não altera as 17 migrations anteriores nem o contrato genérico staff_capabilities. Novas relações:

| Relação | Responsabilidade |
|---|---|
| nutrition_capabilities | Competência explícita por organização/profissional; escrita independente da leitura |
| nutrition_meals | Identidade estável da refeição, origem/autoria derivada e ponteiro para revisão atual |
| nutrition_meal_versions | Dia Europe/Lisbon, tipo e estado recorded/voided por revisão; autoria e instante próprios |
| nutrition_meal_items | Itens por revisão, massa em g, rótulo e composição V1 integral por 100 g; origem manual |

FKs compostas unem organização/aluno/refeição/revisão: não basta conhecer um UUID. A versão atual tem FK diferida para a revisão existente na mesma transação. Triggers impedem reescrever/apagar versões e itens e alterar a identidade do cabeçalho. Correções criam versões; não atualizam a composição anterior. Não se calcula nem persiste adequação alimentar, metas ou recomendações.

RLS SELECT exige simultaneamente identidade autenticada, membership vigente, acesso ao perfil, atribuição vigente e competência nutricional explícita. Escrita exige can_write. Nenhum owner/admin recebe acesso nutricional implícito. Aluno vinculado não recebe acesso nutricional nesta fase; portal e regras de autoria do aluno continuam para revisão própria. Autorização vem do banco, não de claims de papel no JWT. AAL2 recente/sessão ativa seguem a política sensível existente, sem a alterar.

Somente owner pode conceder/revogar competência através de RPC auditável, respeitando a política MFA existente. Sem backfill. Gestores podem consultar metadados de competências, como no modelo atual; isso não concede acesso às refeições. Tabelas não têm INSERT/UPDATE/DELETE para authenticated/anon. A UI continua exclusivamente na demonstração P2.

## P4 — limite transacional proposto

PR dependente de P3: comandos versionados de registo/correção/anulação lógica, recibos idempotentes e auditoria mínima. Snapshots manuais somente, sem catálogo partilhado, fornecedor ou importação alimentar. As funções públicas serão invoker, implementações privilegiadas em app_private com search_path vazio e grants explícitos. Helpers sem necessidade pública ficam sem grants.

Todas as mutações devem adquirir o lock da organização usado pelas operações existentes de acesso/MFA, revalidar competência/atribuição e cliente ativo antes de consultar recibos. Uma repetição depois da revogação não deve revelar sequer o resultado antigo. request_id é único por organização/ator, com hash canónico do comando e contexto; conteúdo divergente dá conflito. expectedRevision impede correções perdidas; autor é auth.uid(), nunca entrada do cliente. Uma falha em qualquer item reverte o comando inteiro. Paginação explícita evita apresentar histórico truncado como completo.

Revogação significa ausência de autorização em novos statements após commit da revogação; não revoga retroativamente dados já entregues nem elimina limitações MVCC. Ensaios locais não demonstram cancelamento de respostas de rede ou garantias de concorrência em múltiplas sessões.

## Validação e reversibilidade

Harness PGlite usa PostgreSQL WASM descartável, auth.uid simulado e dados inventados. Testa instalação limpa, upgrade de baseline povoada com 17 entradas, preservação de checksums/timestamps/dados, replay e autorização negativa. Não é Supabase Auth/PostgREST real nem restauro operacional cloud. O teste histórico de replay passou a comparar o registo completo antes/depois, preservando a verificação das 17 fundações sem congelar o total futuro em 17.

Não regenerar/aplicar bundles remotos para ativar este candidato. Nenhuma migration executada em staging/produção. A reversão de código deixa o esquema aditivo sem UI consumidora; numa futura ativação, desativar a feature e retirar grants de escrita mediante procedimento revisto. Não apagar tabelas/histórico nem executar down migration automática.

## Gates obrigatórios antes de persistência em staging

1. Revisão independente das migrations, grants/RLS, funções e comandos; autorização específica do destino e manifesto sintético. Não integrar/publicar automaticamente P3/P4.
2. Ensaios Auth/PostgREST reais, JWT antigo após revogação, MFA e concorrência com sessões PostgreSQL independentes. PGlite não prova esse cenário.
3. Aprovar política profissional de autoria/correção/anulação e quem pode receber a competência. Papel coach/owner não comprova habilitação profissional. Sem prescrições automáticas.
4. Resolver o contrato de exportação/privacidade nutricional, finalidade/base jurídica, menores, retenção de snapshots/recibos/auditoria e recuperação de conta. A exportação existente ainda não inclui Nutrição e não pode ser apresentada como completa após ativação.
5. Incluir novas entidades nos procedimentos de backup e provar restauro operacional cloud. Não confundir cópia cloud→local com recuperação operacional.
6. Rever manifestação de estado incerto, conflito com rascunho preservado, resposta atrasada e paginação antes de ligar P5 à interface; a demonstração não muda para persistência implicitamente.

Continuam abertos H-01 passwords comprometidas, H-02 sessões/JWT, H-03 recuperação cloud, H-04 conta/MFA e H-05 RGPD. Falha intermitente da ficha permanece em observação. Leitores de ecrã, zoom nativo, Safari e Firefox não ensaiados. Sem dados reais ou piloto comercial.

Referências consultadas: [RLS e grants](https://supabase.com/docs/guides/database/postgres/row-level-security), [funções e privilégios](https://supabase.com/docs/guides/database/functions). O changelog oficial foi consultado antes de implementar; não se alterou versão de serviços/SDKs.
