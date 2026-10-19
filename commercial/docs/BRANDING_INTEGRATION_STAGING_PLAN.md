# Branding integrado e publicação proposta — 2026-10-19

**Plano para aprovação separada. Não executado.** Só o PR #35 foi integrado.
Sem deploy, migrations remotas, alterações Auth/RLS, custos ou dados reais.

## Revisão efetiva e evidência

- Head aprovado e preservado: `4dca3d26cb0649288dd0bb7342dfe89efb6765c5`.
- Base anterior: `5d59e7651b4f7fb0ee531992275fdcc979b78569`.
- Merge em saas-foundation: **`c7bdc3461dd3ac2dc1bea07e0a676745f08697e5`**.
- Árvore integrada: `c995d7ab9703241c0a2363b184c5435f83e695b4`, idêntica à
  árvore do head aprovado (`git diff --exit-code` sem diferenças).
- [CI integrado aprovado, 39227944818](https://github.com/danielfilipemc-cloud/nutritrack/actions/runs/39227944818).
- No SHA integrado: lint, TypeScript e build aprovados; **97/97** testes de
  domínio/PostgreSQL; **183/183** Chromium; npm audit **0 vulnerabilidades**.
  PostgreSQL e APIs de browser usam fixtures locais; não são Auth/PostgREST real.
- Verificação específica antes do merge: **5/5** casos de branding aprovados.
  A suite integrada repete teclado, mobile, tenant branco com texto preto,
  navegação, permissões, rascunhos e proveniência NutriTrack.

Inspeção manual repetida da [folha vetorial](review/branding/asset-review.png),
da referência Final 1 fornecida e das quatro capturas de login/dashboard,
desktop/mobile, no [relatório de branding](BRANDING_INTEGRATION_REVIEW.md).
Monograma facetado, ponte curva, órbita posterior/frontal, R recortado e BUSINESS
espaçado mantêm a direção Final 1. Sem cortes/overflow observados; 16/24/32 px
usam o símbolo simplificado. Brilho limitado ao ponto orbital no app icon.
Não foi necessária alteração do head aprovado.

A textura metálica, proporções e lettering são interpretação vetorial, conforme
documentado; não se afirma reprodução pixel a pixel nem aprovação de marca
registada. Leitores de ecrã, zoom nativo, Safari, Firefox e caches do favicon no
sistema operativo continuam por validar. Testes aprovados não certificam segurança
nem acessibilidade completa. H-01–H-05 continuam abertos.

## Destinos observados por leitura

| Recurso | Estado confirmado |
| --- | --- |
| Workspace Render | Maryatchi hub, `tea-d8eoun68bjmc73bbipsg`, já autorizado pelo responsável |
| Staging | `srv-db9al5ajnfac73bivqr0`, aura-business-staging, plano free, autoDeploy no / trigger off |
| Branch staging | integration/aura-staging, ainda `6823fe0b9d35db9f5edaa4939ed45a022ab01888` |
| Artefacto staging LIVE | `dep-dbaed53bc2fs73b300n0`, commit `6823fe0b9d35db9f5edaa4939ed45a022ab01888` |
| Supabase staging | `vgbwmamntjmhzrpvhxzb`; 17 entradas no registo, todos os checksums iguais ao manifesto local |
| Produção excluída | Render `srv-db76rpmi0phs738pd9ug`, autoDeploy no / trigger off; LIVE `dep-db7ac0dg1s2s739ol790`, commit `543e3a0b78e864cc65a8c07dec0736c8ee6c39af` |
| Bases/referências excluídas | Supabase produção `vfplbkfxipfictuwkkoe`, NutriTrack pessoal, main `64918342a17ea9820e4cd2564918ed8ecf520111` |

Smoke público **de leitura** no staging existente: 10 rotas/cabeçalhos aprovados,
20 recursos JS examinados, referência ao projeto staging presente e referências
protegidas/valores com formato de secret key ausentes nessa amostra. Não é uma
auditoria exaustiva de segredos. Sem login, consultas de alunos ou mutações.
O único SQL remoto foi SELECT de nomes/checksums do registo numa transação read
only com rollback; não é execução de migrations nem prova de integridade de
todos os corpos de funções/policies instalados.

### Compatibilidade do schema

O código contém 19 migrations; o staging tem 17. As duas pendentes são
`20261018203955_nutrition_foundation.sql` e
`20261018204504_nutrition_transactions.sql`. Não aplicá-las nesta publicação.
As 17 existentes não foram alteradas pelo branding. Três migrations de segurança
presentes no código candidato mas ausentes da branch de deploy antiga já estão
registadas no staging, com checksums iguais ao manifesto.

`app/`, `components/` e `lib/` do candidato não chamam RPCs nem tabelas
nutricionais de P3/P4; a interface continua demonstração sem persistência. O build
Render usa npm ci + npm run check, sem passo de migrations remotas. Esta é a
compatibilidade esperada para publicar a UI sobre as 17 existentes; repetir
preflight de leitura e percursos Auth reais na janela autorizada. Divergência
bloqueia publicação; não instalar schema como reparação implícita.

## Sequência futura — exige autorização do responsável

1. Aprovar explicitamente o SHA **c7bdc3461dd3ac2dc1bea07e0a676745f08697e5**,
   serviço/URL staging, testes sintéticos permitidos e reversão apenas do staging.
   Se o candidato mudar, repetir revisão e validação; não usar saas-foundation
   latest. Este documento/PR não altera a revisão candidata.
2. Revalidar workspace, serviço, branch, auto-deploy desligado, plano, LIVE e
   checksums. Confirmar por leitura a referência Supabase nos assets e o destino
   configurado, sem imprimir chaves. Guardar o deploy LIVE de reversão antes de
   qualquer operação. Parar se houver drift ou outra publicação em curso.
3. Atualizar integration/aura-staging por **fast-forward**, de 6823fe0 para o
   candidato aprovado. Não force push, não mudar main/saas-foundation e não
   adicionar os PRs nutricionais pendentes. O teste de ancestralidade passou
   nesta revisão; repetir imediatamente antes da operação.
4. Selecionar **explicitamente o commit aprovado** no Dashboard ou numa API/CLI
   que suporte commitId/--commit. O conector trigger_deploy disponível só aceita
   serviceId/clearCache e não fixa SHA: não o usar como substituto de um deploy
   por commit, nem escolher Deploy latest. Não recolher novas credenciais por
   chat; se faltar um mecanismo privado autorizado, reportar o bloqueio.
5. Confirmar o commit do deploy criado, depois aguardar LIVE e confirmar o mesmo
   commit novamente. Build/falha crítica interrompe novas alterações; não
   modificar permissões, Auth, schema ou planos para contornar o erro.
6. Repetir smoke público, cabeçalhos, seis SVGs/favicons, recursos estáticos e
   isolamento do bundle. Capturar login/sidebar/dashboard/marca em desktop/mobile
   com as fixtures existentes, verificando imagem carregada/descodificada.
7. Testes com Auth real precisam de manifesto privado vigente, contas fictícias
   já autorizadas, destino confirmado e âmbito de mutações explícito. Não criar
   contas/competências, baixar AAL2 ou executar a auditoria cloud mutável inteira.
   **A suite auth-online-staging contém um teste coach que cria e conclui um
   objetivo. Não é read-only:** só executar se essa mutação estiver aprovada;
   caso contrário selecionar casos de leitura adequados ou ensaio manual coach.
   MFA/conta indisponível bloqueia o caso; nunca contornar proteção.
8. Registar SHA/deploy, checksums, resultados separados de fixtures/Auth real,
   capturas sem segredos e limitações. Reconfirmar produção/auto-deploy inalterados.

Documentação oficial consultada:
[commit específico](https://render.com/docs/deploys#deploying-a-specific-commit),
[API com commitId](https://api-docs.render.com/reference/create-deploy).
API/CLI por commit não desliga auto-deploy automaticamente; mantê-lo desligado.
Nenhuma destas operações foi executada nesta fase.

## Reversão proposta — só staging

Alvo observado: **dep-dbaed53bc2fs73b300n0**, SHA **6823fe0b9d35db9f5edaa4939ed45a022ab01888**.
Reconfirmar disponibilidade do artefacto antes da janela. Se autorizado e
necessário, usar rollback do serviço staging para esse deploy, confirmar LIVE,
SHA e smoke. A [API de rollback](https://api-docs.render.com/reference/rollback-deploy)
recebe deployId e também não desliga auto-deploy automaticamente.

Sem reset/force push da branch, down migration, eliminação de histórico, limpeza
de fixtures, restauro de Auth ou alterações de configuração. O rollback de código
não desfaz dados/configuração: este plano não os altera. Se o artefacto não estiver
disponível, parar e rever a alternativa de build do SHA anterior, sem improvisar
restauro. Produção nunca é alvo de reversão nesta janela.

## Preparação de revisão dos PRs de Nutrição — nenhum integrado

Todos derivam da base anterior 5d59e76 e usam contratos V1 já integrados. Os heads
foram reconfirmados, com alterações apenas em commercial/. Simulações locais
`git merge-tree --write-tree` contra c7bdc34 terminaram sem conflitos. Não mudam
refs nem constituem integração. As listas de ficheiros dos quatro PRs também são
disjuntas entre si; ainda assim, ausência de conflito textual não prova correção.
O CI anterior de cada head não substitui validação sobre a nova base.

| PR e head | Âmbito / dependências / pontos de revisão |
| --- | --- |
| #34 `7bcc92828e2e4482b66e399ad5fbe6e8d2f116b8` | Contrato offline de snapshots + prova PostgreSQL local. SHA-256 verifica o conjunto fixado, não autoriza nem prova completude da origem remota. Produtor transacional remoto ausente; manter bloqueio. Rever limites, ordem, versões anuladas, âmbito temporal e mistura/truncagem de páginas. |
| #36 `6c044b8ae31cc70145d0e0c52f0e5217e79d3f19` | Ensaio P5 em memória, independente de #34 e de migrations remotas. Rever rascunhos, guardas de saída, conflito e resultado incerto; simulação de recibo não é reconciliação backend real. Ao combinar com branding, repetir teclado/mobile e logo sem perder estado. |
| #37 `5eb0adf26a801fa06681b572add9b6473ad98371` | Matriz de 24 casos, sem executor. Execução futura depende de 18/19 instaladas numa janela autorizada, manifesto vinculado e MFA; caso X01 bloqueado pelo produtor de exportação ausente. Rever separação READ/DML, JWT antigo e contenção. |
| #38 `cd176cb97d7f4c1c07ae6e0b8e0d0d7e434351d7` | Requisitos e decisões operacionais. Sem dependência de implementação de #34/#36 para revisão documental. RPO/RTO propostos não são SLA; retenção, direitos, habilitações e recuperação precisam de decisão/evidência. |

Ordem sugerida para revisão: #38 e #37 (gates/decisões), depois #34, depois #36.
Não implica autorização de merge, testes remotos ou persistência. Antes de cada
futura integração aprovada: confirmar head/base/CI, atualizar a validação conjunta
e manter a separação entre contrato offline, UI de demonstração e ativação cloud.

H-01 passwords comprometidas, H-02 sessões/JWT, H-03 recuperação cloud,
H-04 conta/MFA e H-05 requisitos jurídicos continuam explicitamente abertos.
O candidato é técnico para staging após aprovação própria, não para piloto ou
tratamento de dados reais.
