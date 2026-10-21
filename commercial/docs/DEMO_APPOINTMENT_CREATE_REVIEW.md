# Agenda fictícia — criação e consulta

Base publicada: `71e173590a7c0953f8f91dedb3ce23933872e886` (PR #46). Ramo isolado `feat/aura-demo-appointment-create`.

Esta entrega inicia a fase de agenda interativa. A seguinte acrescentará reagendamento e cancelamento em PR separado. Mantêm-se as fases posteriores de acompanhamento/prioridades, percurso completo e paridade com operações autenticadas. Qualquer alteração a Auth/RLS, migrations remotas, produção, main ou NutriTrack pessoal continua fora do âmbito autorizado.

## Comportamento

- Um único estado React contém as marcações da sessão. Dashboard do dia de referência, agenda geral e ficha recebem esse estado, sem caches ou carregadores profissionais.
- A agenda consulta um dia ou uma semana de segunda a domingo, com data, filtro de aluno, anterior/seguinte e regresso ao dia de referência. Intervalos e semanas são calculados em UTC sobre datas de calendário, sem depender do relógio real/fuso do browser. Uma consulta sem data não causa erro nem mostra resultados de outra data.
- A criação pede aluno existente, um dos três tipos revistos, data, hora e duração. O calendário é explicitamente de um único profissional de exemplo. Não permite sobreposição entre quaisquer alunos; permite intervalos adjacentes e terminar exatamente às 24:00, mas não atravessar a meia-noite.
- Validação e atribuição de ID ocorrem no atualizador funcional do estado, sobre a versão mais recente. Não há duplicação por comandos repetidos nem mutação da sessão anterior. Erros não alteram marcações.
- Após criação a consulta mostra a data criada e todos os alunos, para o resultado não ficar escondido por um filtro anterior; mantém a vista dia/semana. Limpa apenas a hora do formulário, conserva os restantes campos e confirma a operação sem deslocar o foco do botão. Erros têm associação ao campo e foco para correção.
- A agenda fica montada enquanto escondida, preservando formulário e filtros entre áreas. Abrir uma ficha pela marcação seleciona o aluno correto. A ficha apresenta todas as suas marcações fictícias ordenadas, incluindo data, hora e fim. A dashboard continua a contar apenas o dia de referência explícito, `2026-10-20`.
- Recarregar descarta todas as alterações. Não há storage, pedidos a dados, emails, notificações, credenciais ou IDs de estabelecimentos. Os parâmetros de URL não selecionam fontes privadas.

## Preservação e limites

Dashboard Premium profissional, respetiva agenda lateral e prioridades, componentes partilhados, autenticação, RLS, migrations e dependências não mudam. A dashboard da demo mantém a composição e o conteúdo inicial; passa apenas a refletir as marcações locais do dia de referência. Não se alega que a demo implementa permissões, operações ou auditoria profissionais.

A lista usa estrutura semântica, controlos nativos, alvos de toque existentes e atalho por teclado para criar. Seletores da agenda usam a apresentação local já revista para evitar transbordo WebKit com nomes longos, conservando o controlo nativo e o nome completo acessível. Leitores de ecrã, zoom nativo, Firefox e Safari/iOS reais continuam sem validação específica; WebKit Linux não equivale a Safari num dispositivo.

## Verificação e evidência

`tests/demo-appointments.test.ts` verifica sessões independentes, IDs, repetição, validação, sobreposições, adjacência, meia-noite e semanas/anos/bissextos. O teste estático de isolamento percorre também os novos módulos. Os seis percursos de browser a 320/375/1440 px verificam criação, ficha do aluno correto, exclusão de outro aluno, contagem do dia, filtros, semana, URL fictícia privada, ausência de rede de dados, recarregamento, erros/foco, rascunhos, consulta vazia/inválida, limites e nomes longos.

```sh
npm run check
npm audit --audit-level=moderate
npm run test:e2e
AURA_APPOINTMENT_CAPTURE=after npx playwright test e2e/demo-appointments.spec.cjs --workers=1
```

As capturas `before` usam o build da base com o novo script e apenas `-g 'review capture'`. O script recolhe três imagens antes e nove depois; as regressões profissionais e dashboards têm comparação própria. Imagens, manifesto SHA-256 e logs são entregues em pacote local, sem upload de capturas para o GitHub. Resultados finais, CI e parecer independente devem referir a HEAD exata do novo PR. A autorização do utilizador permite integrar e publicar apenas no staging após parecer positivo e CI aprovado.
