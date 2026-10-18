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

## P4 — implementação transacional candidata

PR dependente de P3, migration incremental `20261018204504_nutrition_transactions.sql`: comandos versionados de registo/correção/anulação lógica, recibos idempotentes e auditoria mínima. Snapshots manuais somente, sem catálogo partilhado, fornecedor ou importação alimentar. As funções públicas são invoker, implementações privilegiadas em app_private com search_path vazio e grants explícitos. Helpers de validação/projeção ficam sem grants.

| RPC | Contrato e limites |
|---|---|
| aura_nutrition_meal_save(org, client, command) | Cria/corrige/anula; competência de escrita, atribuição e cliente ativo. Comando V1 estrito, até 50 itens; ator derivado |
| aura_nutrition_request_status(org, client, request) | Recibo somente do ator atual, após revalidar escrita e MFA; null quando não existe |
| aura_nutrition_diary(org, client, date, after) | 20 refeições atuais por página, ordenadas por UUID, nextCursor explícito; inclui estado voided |
| aura_nutrition_history(org, client, meal, before) | 20 revisões por página, descendentes; snapshots e nextCursor explícitos |

`lib/nutrition-command.ts` valida o mesmo comando fora da UI: contractVersion, requestId, mealId, expectedRevision, consumedOn, mealKind, operation e items. Cada item tem label, quantity, composition V1 e source=manual. Organização/aluno são argumentos RPC separados e não substituem autorização. Não se aceitam actor/source externo, totais calculados pelo cliente ou campos adicionais. Parser SQL normaliza UUIDs, ordem JSON e escala numérica antes do SHA-256; sem cópia de payload nos recibos/auditoria.

Anulação é uma nova revisão voided que copia os snapshots anteriores; não apaga dados e não permite alterar dia/tipo ou restaurar implicitamente uma refeição anulada. A decisão de autorizar este fluxo profissional ainda exige revisão antes de ativação. Recibos de retries devolvem a revisão original, mesmo depois de uma correção posterior; o consumidor deve recarregar a versão atual. Falta de recibo não prova falha de um pedido ainda em execução. Após arquivar, novas escritas/replays são recusados; consulta autorizada do histórico permanece possível.

Paginação não constitui snapshot entre pedidos: novas refeições ou correções podem mudar o conjunto entre páginas. O futuro consumidor deve tratar refresh e contexto, não declarar totais diários completos se nextCursor existir. P1 agrega até 1000 porções por chamada; um relatório maior precisa de contrato próprio, não somar totais já arredondados.

Todas as mutações devem adquirir o lock da organização usado pelas operações existentes de acesso/MFA, revalidar competência/atribuição e cliente ativo antes de consultar recibos. Uma repetição depois da revogação não deve revelar sequer o resultado antigo. request_id é único por organização/ator, com hash canónico do comando e contexto; conteúdo divergente dá conflito. expectedRevision impede correções perdidas; autor é auth.uid(), nunca entrada do cliente. Uma falha em qualquer item reverte o comando inteiro. Paginação explícita evita apresentar histórico truncado como completo.

Revogação significa ausência de autorização em novos statements após commit da revogação; não revoga retroativamente dados já entregues nem elimina limitações MVCC. O ensaio PostgreSQL nativo abaixo verifica um escritor bloqueado pelo lock enquanto a revogação está pendente. Não demonstra cancelamento de respostas de rede nem todos os escalonamentos possíveis de concorrência.

## Validação e reversibilidade

Harness PGlite usa PostgreSQL WASM descartável, auth.uid simulado e dados inventados. Testa instalação limpa, upgrade de baseline povoada com 17 entradas, preservação de checksums/timestamps/dados, replay e autorização negativa. Não é Supabase Auth/PostgREST real nem restauro operacional cloud. O teste histórico de replay passou a comparar o registo completo antes/depois, preservando a verificação das 17 fundações sem congelar o total futuro em 17.

Ensaio adicional: `scripts/nutrition-postgres-local.ts`, ativado exclusivamente com AURA_NUTRITION_LOCAL_POSTGRES=1, Node 22 e `node --import tsx scripts/nutrition-postgres-local.ts`. Usa imagem já instalada public.ecr.aws/supabase/postgres:17.11.0.002, --pull=never, Docker local npipe/unix, rede none, sem portas ou bind mounts; dados em tmpfs. Recusa DOCKER_HOST e fixa o contexto local inspecionado em cada operação, evitando seguir uma mudança global de contexto durante o ensaio. O teste negativo com override foi recusado antes de executar Docker. Cria e remove apenas o seu contentor identificado por label. Não usa URLs, chaves, ligações pessoais nem bases de outros projetos. Trust auth é exclusivo do socket interno desse contentor sem rede, não de serviços existentes.

Resultado PostgreSQL 17.11: upgrade/replay 17→19 preservando registo/dados; dois writers em sessões independentes resultam num sucesso e PT409; dois creates com mesmo request dão uma refeição, um replay e um evento; escritor iniciado enquanto owner mantém o lock de revogação aguarda e falha com 42501 após commit; recibo revogado e RPC anónimo negados. Auth aqui continua simulado, sem GoTrue/PostgREST. Imagem local verificada: sha256:0450166354dc9c1d25f0322ac8b580774d4fb0184d2b087f6e4fe9499c66cf53. Não equivale a recuperação cloud.

P3: PR #31, 83 testes domínio/PostgreSQL; CI 39164729484 e 39164723072 aprovados. P4: PR #32, 91 testes domínio/PostgreSQL e 178 Chromium locais aprovados, lint/TypeScript/build aprovados e auditoria npm com zero vulnerabilidades. O teste de duas empresas dá competências/atribuições válidas aos dois profissionais antes de verificar isolamento; inclui ainda UUIDs conhecidos de outro aluno e recibos do mesmo request noutro contexto. A mudança da política MFA e a expiração de sessão são casos negativos próprios. O CI sobre o head de revisão deve ser confirmado no PR, sem inferir aprovação de uma revisão posterior.

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
