# Ficha 360.º — tarefas mobile e feedback

Base: `integration/aura-staging`, `7cab54c48a68a0c55731d3616ab1aa61bc1fe47e` (PR #45 publicado). Ramo isolado: `feat/aura-mobile-student-flow`.

## Problemas e alterações

O cabeçalho repetia o nome e apresentava todos os campos de contexto antes da tarefa, ocupando grande parte do ecrã mobile. A demo mantém o título e o seletor de aluno, resume estado/revisão e usa um disclosure nativo para consultar responsável/contexto até 900 px. Em desktop a identidade e o contexto completo mantêm-se visíveis. A expansão não desmonta formulários nem rascunhos; o estado de expansão é apenas uma preferência visual local.

O erro por avaliação sem medições aparecia depois do histórico, como mensagem genérica de estado. Passa a surgir junto ao formulário com `role=alert`, associação aos campos por `aria-describedby`, `aria-invalid` e foco no peso para iniciar a correção. Alterar um campo limpa essa mensagem. A validação nativa de data/intervalos e os limites do parser mantêm-se. Guardar com sucesso conserva o foco e anuncia a confirmação por `role=status`. As mensagens ficam separadas por aluno e por formulário, evitando confirmações de avaliações na área de acompanhamento.

Um aluno sem avaliações recebe uma ação para registar a primeira medição. Um indicador sem medições na evolução recebe também uma ação para abrir o formulário. Os atalhos reutilizam a navegação por foco já revista. Não se acrescentam interpretações clínicas ou valores simulados para campos vazios.

A revisão WebKit revelou ainda um clique perdido antes da hidratação e transbordo da apresentação nativa do seletor de aluno com nomes de 100 caracteres a 320 px. O `main` da demo fica `inert` e `aria-busy` até o primeiro efeito de montagem, sem acrescentar acessos a dados. Uma regressão atrasa os scripts para confirmar que os controlos só aceitam interação quando os handlers estão prontos. O seletor de aluno mantém o controlo nativo e o nome completo acessível, mas usa `appearance:none`, reticências e seta CSS local. Isso evita o transbordo de pintura do WebKit sem cortar a página ou o contorno de foco; `min-width:0` isoladamente não resolvia. Estas correções também ficam limitadas à demo.

## Âmbito preservado

Apenas apresentação e estado local da demo, testes e documentação. Componentes partilhados, loaders, Auth/RLS, migrations, dependências, dashboard Premium profissional, dados profissionais e NutriTrack pessoal não são alterados. Não são usadas credenciais nem dados reais.

Os testes anteriores de isolamento verificam agora as atualizações no cartão de contexto (as duas apresentações responsivas usam a mesma árvore de dados) e esperam `alert` para erros. Continuam a verificar rede, sessão fictícia preexistente, separação por aluno, rascunhos, prioridades e reposição. As novas regressões cobrem disclosure por teclado, posição do resumo, correção de erros, foco após guardar, mensagens por área/aluno e o percurso vazio → primeira medição → resumo/evolução, a 320/375/1440 px.

## Reprodução e evidência

```sh
npm ci
npm run check
npm audit --audit-level=moderate
npx playwright install chromium firefox webkit
npm run test:e2e
npx playwright test --config=playwright.demo-cross-browser.config.cjs --project=firefox --project=webkit --workers=1
AURA_MOBILE_CAPTURE=after npx playwright test e2e/demo-mobile-flow.spec.cjs --workers=1
```

`AURA_MOBILE_CAPTURE=before` ou `after` recolhe nove capturas locais de resumo, erro e aluno vazio. Para `before`, usar o build da base com o script novo e filtrar `-g 'review captures'`. O teste condicional de captura não é uma asserção de funcionalidade anterior. As imagens, hashes e logs acompanham um pacote local separado, sem upload de imagens para o GitHub. Os quatro pares profissionais protegidos devem continuar idênticos à base; recolher também as duas dashboards da demo para comparação.

CI da HEAD do novo PR é a referência para lint, domínio/PostgreSQL local, TypeScript, build, auditoria e suite Chromium completa. Resultados de Firefox e WebKit serão documentados no pacote se executados. WebKit em Linux não equivale a Safari/iOS; leitores de ecrã e zoom nativo continuam sem validação. Revisão independente é necessária antes da integração; a autorização do utilizador permite publicar staging quando revisão e CI sejam positivos, sem alterações a produção/main.
