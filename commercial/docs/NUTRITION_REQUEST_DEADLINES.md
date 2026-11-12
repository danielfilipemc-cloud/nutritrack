# Nutrição — pedidos suspensos e prazos limite

Correção isolada sobre o PR #83, base `f9af2b40f31783e9b727c3fd19d60973bad90877`. Sem alterações SQL, Auth/RLS, contratos de comandos, dependências ou destinos remotos.

## Problema confirmado

Os três adaptadores e as consultas de competências aguardavam pedidos sem prazo limite. Uma rede suspensa podia deixar uma gravação pendente e o guard da ficha bloqueado indefinidamente. Não se tratava apenas de um erro de mensagem.

O teste `tests/nutrition-request-deadline.test.ts` foi executado antes da correção: ao fim de9 segundos continuava sem resultado (`deadline-missing`). Depois da correção, as três gravações terminam como `uncertain` ao fim de8 segundos, sem repetir o RPC. A leitura com um transporte que ignora abort termina como `unavailable`.

## Comportamento

`lib/nutrition-request.ts` estabelece **8000 ms por pedido**, não por operação completa da interface. Cada chamada usa o seu próprio AbortController, timer e listener de contexto. Limpa-os ao terminar. Uma race também limita um transporte que ignore o sinal de abort.

- Leitura ou competência sem resposta: indisponível, sem conceder escrita ou interpretar erro como ausência de obrigação.
- Gravação sem resposta: `uncertain`, conservando comando/requestId. Mantém a consulta de recibo e os avisos de saída já implementados.
- O adapter continua ativo depois de um timeout, para permitir consultar o recibo com um novo pedido limitado. Não existe retry automático de escrita.
- Mudar de contexto descarta o adapter e cancela a consulta de competência; a resposta anterior não volta a habilitar controlos.
- Cancelar o HTTP **não prova cancelamento/rollback no banco**. O servidor pode ter aceite a operação. Não apresentar timeout como rejeição confirmada.
- Uma leitura de diário seguida da competência pode envolver dois pedidos; o prazo individual não é um SLO da página ou garantia de desempenho remoto. Uma infraestrutura lenta pode exigir consulta de recibo ou uma nova leitura explícita.

## Validação

- Teste red/green confirmado para os três adaptadores. A execução posterior também inclui leitura com transporte que ignora abort.
- 21 testes focados de contratos/adaptadores/PostgreSQL embebido aprovados; teste final de deadline aprovado com as três gravações `uncertain` e leitura `unavailable`.
- Lint, TypeScript e build aprovados. **17/17 Chromium nativos** aprovados localmente, sem retries.
- Novo caso browser: o servidor fictício aceita água mas suspende a resposta; a UI deixa de estar busy, conserva a incerteza, não volta a guardar e recupera pelo recibo. Exatamente uma mutação.
- Novo caso browser: competência suspensa torna-se indisponível; responder depois não habilita escrita.
- A matriz **GoTrue/PostgREST real local** foi repetida depois da alteração: **12/12 grupos aprovados**. Relatório privado: `.aura-integration/local-runtime/nutrition/runs/f099a4c2-13d9-4ca8-995b-b60ec3a9714c/report.json`. Sem tokens/passwords/conteúdos nutricionais no relatório.

A suite Chromium continua a usar fixtures; a matriz API real local é uma prova separada. CI completo do SHA final fica registado no PR. Não há prova de browser autenticado nutricional, staging, leitor de ecrã, zoom nativo, Safari ou Firefox a partir destes ensaios.

O baseline original conserva17 migrations; os ensaios reais usam o sandbox nutricional613xx. Sem merge, deploy, alterações a dados reais, produção ou NutriTrack pessoal. Os bloqueios altos de autenticação, recuperação e RGPD continuam abertos.
