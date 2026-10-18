# Integração P3/P4 e validação adicional

## Revisão efetivamente integrada

Heads confirmados: #31 f146472618c4c371a1c0c1292c8fe500e2fa141f, base saas-foundation 7e5239af78c127b43d06934a9b8874df24094ffc; #32 5a47f482aefae118babacb26e3f089cff8ef10df, base inicial feat/aura-nutrition-p3 f146472. CI dos dois heads aprovado antes do merge; alterações exclusivamente em commercial/.

Integração em ordem: #31 → fddc7d416c7bc8e319f633d39605bdaa66ee67ac; retarget de #32 para saas-foundation sem alterar o head; #32 → **f2a5e90cb8592043f839de2281c0a9c5cdf0ff0a**. Árvore **019efb36dc2ac145910215611ea23d70615a96d6**, igual à candidata 5a47f48, sem alterações adicionais a migrations ou lógica.

Sobre esse SHA: lint, TypeScript, build, 91/91 domínio/PostgreSQL, 178/178 Chromium e npm audit (zero vulnerabilidades) aprovados. [CI integrado 39168537261](https://github.com/danielfilipemc-cloud/nutritrack/actions/runs/39168537261) aprovado. PostgreSQL 17.11 nativo local repetiu upgrade/replay 17→19, CAS e idempotência concorrentes, revogação enquanto writer aguardava lock e negação de recibo/anon. O contentor era efémero, sem rede/portas/bind mounts e foi removido. Auth nesses ensaios é simulado.

Auto-deploy Render de staging/produção confirmado desligado antes dos merges. Sem publicação, migrations remotas ou alteração de main/NutriTrack pessoal. integration/aura-staging permanece em 6823fe0b9d35db9f5edaa4939ed45a022ab01888. Isso não confirma o estado atual do registo SQL remoto; a comparação cloud faz parte do plano ainda bloqueado.

## Evidência adicional, em PR separado

- `tests/nutrition-pagination.test.ts`: inserção antes/depois do cursor, mudança de dia em registo já lido e ainda por ler, nova revisão durante paginação e retoma negada após revogação de atribuição/competência/política MFA. Histórico anterior preservado.
- `tests/nutrition-activation.test.ts`: grants/RLS e privilégios efetivamente instalados; cinco RPCs invoker, 12 funções privadas com whitelist explícita de EXECUTE/definer/search_path; tabelas sem DML de clientes e nenhum acesso anon. Artefactos offline reproduzíveis; preflight/postflight read-only discriminam baseline/candidato/drift sem alterar o registo.
- `scripts/nutrition-postgres-local.ts`: extensão do ensaio nativo com leitor e escritor em sessões independentes. Leitura durante transação não confirmada vê a versão anterior completa; depois de COMMIT vê o conjunto atual. Inserção antes do cursor só entra no refresh. Retoma com cursor após revogação é negada.

As cinco provas adicionais passaram isoladamente; a suite completa ampliada e CI são registados no PR da documentação/testes. Não confundir esses testes adicionais com o total de 91 executado no SHA integrado.

## Limitações e severidade

**Limitação funcional média, bloqueante para declarar exportação completa:** nextCursor=null termina uma consulta, não certifica um snapshot consistente entre pedidos. Num ensaio com o mesmo número de elementos, o conjunto montado de páginas antigas/novas foi diferente do conjunto atual. Para P5/expor totais/exportar, definir refresh/reconciliação ou contrato de snapshot, sem somar páginas como se não houvesse alterações. Não foi criado novo contrato SQL para ocultar essa limitação.

**Validação real pendente:** GoTrue/PostgREST, assinatura/refresh/revogação de JWT real, TOTP real e cabeçalhos de respostas não foram ensaiados remotamente. Revogação local aplica-se a statements após commit, não a dados já entregues ou todos os pedidos em curso. Testes aprovados não equivalem a prova completa de segurança.

**Bloqueios altos continuam abertos:** passwords comprometidas, sessões/JWT, recuperação operacional cloud, recuperação de conta/MFA e RGPD. Exportação nutricional/retencão/eliminação definitiva não implementadas; dados reais/piloto continuam proibidos. Falha intermitente da ficha permanece em observação; leitores de ecrã, zoom nativo, Safari e Firefox não ensaiados.

Para revisão independente: [plano de ativação preparado](NUTRITION_STAGING_ACTIVATION_PLAN.md), [política necessária ainda não aprovada](NUTRITION_PRIVACY_POLICY_PROPOSAL.md) e [manifestos/SQL de inspeção](review/nutrition-activation/). Nenhum ficheiro contém autorização de execução cloud ou credenciais.
