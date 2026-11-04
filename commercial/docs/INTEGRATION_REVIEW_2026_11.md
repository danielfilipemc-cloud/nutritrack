# Revisão conjunta dos PRs #40–#42 — novembro de 2026

Âmbito exclusivo `commercial/` no diff do PR. Sem merge de PRs, deploy, migrations ou alterações de serviços remotos. Base inicial da revisão: `a60186683f67c078726f47f74eaf3173b90ca120`; candidato final reconciliado, apenas na branch `design/aura-integration-review`, com a referência funcional atual `5f8f99162c5e60e137bd90f1ea81aea66813cf31` de `integration/aura-staging`.

## Cadeia confirmada no GitHub

| PR | Base | Head confirmado | Estado na revisão |
| --- | --- | --- | --- |
| #40 | saas-foundation, c7bdc346 | fddf2c2ef7f9850681c68e9b8a19faee92b0b3ac | Aberto, sem merge |
| #41 | design/aura-premium-experience | a3f23bf3aa8777de165d09860f2ae0754dbf36e7 | Aberto, sem merge |
| #42 | design/aura-daily-dashboard | a60186683f67c078726f47f74eaf3173b90ca120 | Aberto, sem merge |

Os três heads permanecem abertos para a linha histórica `saas-foundation`, mas já são ancestrais do código atual de `integration/aura-staging`. Não devem voltar a ser integrados cegamente nessa linha. Não foram alterados nesta revisão.

### Estado funcional efetivo e reconciliação

A clone local estava configurada para obter apenas `saas-foundation`; a referência local de staging estava desatualizada. Os SHAs foram confirmados na API GitHub e em FETCH_HEAD, sem checkout ou alterações de qualquer branch remota:

- `saas-foundation`: c7bdc3461dd3ac2dc1bea07e0a676745f08697e5.
- `integration/aura-staging`: 5f8f99162c5e60e137bd90f1ea81aea66813cf31, com 97 commits posteriores ao head #42, incluindo os percursos de demonstração, treino e Nutrição dos PRs #43–#71.
- `ops/aura-staging-backup`: d84e0b6cab40e1f8cc4dc1466d8aa85ff8013e56, com os incrementos operacionais #72–#75. O #76 de diagnóstico de recuperação permanece aberto; não se executou backup ou restauro cloud.

O candidato foi reconciliado com o SHA funcional atual numa branch isolada, sem atualizar `integration/aura-staging`. O diff final deve conter apenas as correções adicionais em `commercial/`. O workflow de backup herdado da base é restrito a `ops/aura-staging-backup` e não é alterado nem acionado por esta revisão. Não se verificou o SHA efetivamente publicado no Render nesta tarefa.

## Achado confirmado: contexto guardado ao regressar à ficha

Se a competência de acompanhamento fosse revogada depois de carregar a ficha, o cabeçalho não voltava a consultá-la ao regressar à janela. A dashboard já tinha essa revalidação, mas `StudentContext` mantinha o resultado guardado até uma atualização manual ou mudança de secção. É um problema de atualização da apresentação; não foi demonstrada uma nova leitura de banco não autorizada.

O novo teste `returning to the student window revalidates and hides revoked saved context` falhou antes da correção, mantendo os metadados. A correção limpa o resultado ao receber `window.focus` e incrementa a revisão da leitura. Reutiliza a mesma verificação de competência antes/depois e o cancelamento dos pedidos anteriores. Não modifica RLS, Auth ou permissões do banco.

Outro teste verifica que a atualização do contexto não desmonta o formulário nem apaga o rascunho de acompanhamento. Estes ensaios simulam o evento DOM com fixtures; não representam testes manuais do sistema operativo nem Auth real. Não foi implementada atualização contínua por polling/Realtime: a correção cobre o regresso à janela e a atualização manual. Não se alega revogação visual instantânea de todos os dados já carregados.

## Auditoria de dependências atualizada

A auditoria anterior de outubro não é prova do estado atual. O primeiro `npm audit` desta revisão, sobre a linha antiga da UI com Next 15.5.27, encontrou 1 alerta crítico e 9 moderados. A linha funcional mais recente já usava 15.5.28, corrigida para os avisos Next citados; não se deve atribuir o alerta crítico inicial ao staging atual nem a um serviço remoto não inspecionado. O candidato harmoniza a versão em 15.5.29 e corrige a dependência transitiva de lint.

- Next.js 15.5.27 está abrangido pelos avisos [GHSA-2464-fhr4-w9xw](https://github.com/advisories/GHSA-2464-fhr4-w9xw) e [GHSA-p3m5-59mp-jv5r](https://github.com/advisories/GHSA-p3m5-59mp-jv5r). A correção é preparada dentro da família 15, sem migração para Next 16.
- `minimatch` 10.2.6 está abrangido por [GHSA-g3hv-75wg-m249](https://github.com/advisories/GHSA-g3hv-75wg-m249). A atualização transitiva deve ser acompanhada de lint completo e de uma prova de que uma variável não utilizada continua a ser detetada; não basta baixar a contagem de alertas.

Não foram encontradas configurações explícitas `dangerouslyAllowSVG` ou importações de `next/image` no código da aplicação revisto. Não foi realizado ensaio de exploração nem declarada explorabilidade de um serviço publicado. Serviços remotos não são atualizados por este PR: a adoção da correção depende de integração e publicação autorizadas.

A atualização fixa Next.js em `15.5.29` e usa o override restrito `minimatch@10 → 11.0.1`, preservando ESLint 10 e typescript-eslint existentes. É uma mudança de versão major transitiva apenas na ferramenta de lint; a API CommonJS/ESM e o motor Node 22 continuam disponíveis. Requer validação do lint completo e da sua capacidade de rejeitar código inválido. O override deve ser removido quando os consumidores passarem a requerer uma versão corrigida nativamente. Não se aplicou `npm audit fix --force`, nem se fez downgrade cego do tooling. A instalação usa `--ignore-scripts`.

Depois da instalação, `npm ls next minimatch --all` confirmou Next.js 15.5.29 e todas as três utilizações transitivas em minimatch 11.0.1. `npm audit --json` reportou zero vulnerabilidades, incluindo dependências de desenvolvimento. A prova de lint por stdin com uma variável não utilizada terminou com o código esperado 1 e a regra `no-unused-vars`, seguida de lint e TypeScript aprovados na aplicação. O código de saída 1 desta prova é intencional, não uma falha ignorada no lint do projeto.

## Teste dependente da mudança de hora

A execução em novembro expôs cinco falhas no mesmo cenário visual de dashboard: a expectativa era sempre `10:00`, embora as marcações sintéticas sejam instantes UTC e Lisboa tenha mudado de hora desde a validação de outubro. O teste passa a calcular a hora esperada a partir do instante da fixture em `Europe/Lisbon`. Não se alteraram horários da aplicação, dados de negócio ou regras de agenda. A comparação continua a verificar o horário apresentado; não foi removida a asserção.

A primeira suite desta revisão terminou com 235 cenários aprovados e essas cinco falhas de expectativa horária. Os dois testes novos do contexto já passaram nessa execução; a repetição na linha antiga corrigida passou 240/240. Na reconciliação verificou-se que a base atual já tinha relógio fixo nas capturas e dois testes explícitos antes/depois da mudança de hora. Preservou-se integralmente essa solução; o diff final não altera `daily-dashboard.spec.cjs`. Os 240 testes não substituem a validação do candidato reconciliado com os incrementos posteriores.

O novo teste Python de backup sintético usa agora `fileURLToPath` em vez de URL.pathname e permite indicar o interpretador por `AURA_TEST_PYTHON`, preservando python3 por omissão em CI. É uma correção de portabilidade do invólucro de teste, não do runner operacional. O ensaio unitário usa comandos remotos simulados e dados inventados; não exporta staging ou produção. O roundtrip criptográfico requer GPG disponível e deve ser reportado separadamente se faltar no ambiente local.

## Validações e evidência

Executar em `commercial/`, com o destino fictício de E2E e sem flags cloud:

```text
npm run lint
npm run typecheck
npm run build
node --import tsx --test --test-concurrency=1 tests/*.test.ts
npx playwright test --workers=2
npm audit --json
```

O teste negativo antes da correção e os resultados locais ficam em `.aura-integration/integration-review/`, fora do Git. O SHA final, os resultados posteriores e o CI são apresentados no PR. Os testes PostgreSQL locais e os E2E com fixtures são reportados separadamente; não foram executados runners históricos, migrations ou mutações de staging/produção.

## Preparação de integração e limitações

Depois de revisão independente, confirmar novamente o SHA atual de `integration/aura-staging`, o head deste PR e o CI; rever o diff das correções contra essa base e validar qualquer revisão integrada antes de uma publicação separadamente autorizada. A reconciliação histórica com `saas-foundation` é outra operação: não se devem perder os incrementos posteriores nem tratar PRs abertos como prova de ausência do código em staging. Esta revisão não autoriza merges ou deploy. Não se deve publicar uma árvore que conserve dependências vulneráveis por se apoiar apenas no CI histórico.

Login aprovado, Dark Premium, White Label, Nutrição demonstrativa e respetivos contratos devem permanecer preservados. Não há alterações de schema a aplicar ou reverter nesta fase. Qualquer problema na validação impede a publicação e deve ser corrigido na branch, sem operações destrutivas ou eliminação de histórico.

Mantêm-se abertos os bloqueios altos anteriores: passwords comprometidas; sessões/JWT; recuperação operacional cloud; recuperação de conta/MFA; RGPD/retenção e decisões jurídicas. Leitores de ecrã, zoom nativo, Safari e Firefox continuam por validar. Esta revisão técnica não é uma auditoria independente nem autorização de piloto comercial ou dados reais.

A compilação com Next.js 15.5.29 foi aprovada. Persistem avisos prévios sobre integração do plugin Next no lint e align-items:end numa regra histórica da demonstração de Nutrição; não se alterou esse módulo nesta revisão nem se declarou validação Safari/Firefox. Os resultados finais de domínio/Chromium e o CI constam do PR para o SHA final.
