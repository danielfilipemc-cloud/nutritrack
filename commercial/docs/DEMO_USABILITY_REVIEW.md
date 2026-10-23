# Auditoria de utilização da demonstração Premium

23/10/2026. Base: PR #55, commit 841178b994b8bfbaa64f3fd5efe0eec2d860bdc9. Âmbito exclusivo: `/demo/experiencia`, dados fictícios e estado em memória. Nenhuma alteração aos módulos profissionais, Auth/RLS, persistência, produção ou NutriTrack pessoal.

## Problemas demonstrados e correções

- Alguns nomes acessíveis substituíam o texto visível dos botões. A dashboard e o diretório passam a usar o próprio conteúdo como nome; fila de revisão, check-ins e equipa conservam a expressão visível e acrescentam o contexto do registo. Isto permite identificar o comando pelo texto mostrado sem perder a distinção entre alunos/respostas.
- A tabela de avaliações com overflow no mobile não era alcançável pelo teclado. A região tem agora nome, instrução breve e entrada por Tab; setas deslocam o histórico e Tab permite sair, sem alterar os dados ou a tabela.
- Em cores forçadas, Dia/Semana apresentavam o mesmo aspeto apesar de estados diferentes. Seleção recebe sublinhado/contorno e o foco por teclado recebe contorno tracejado, apenas dentro da demonstração e nesse modo.
- A suspeita inicial de contraste incorreto no hover não se reproduziu nos quatro controlos inspecionados; não foi tratada como defeito confirmado.

## Verificação reproduzível

`npx playwright test --config playwright.demo-usability.config.cjs` executa cinco casos em Chromium desktop, Chromium Android emulado a 360/412 px e WebKit iPhone emulado a 320/390 px. Cobre nomes acessíveis, entrada/deslocação/saída do histórico, detalhes nativos, foco e rascunho durante navegação, espaçamento de texto a 320 px, cores forçadas e preferência de movimento reduzido ativa. A verificação de movimento limita-se à preferência e ao scroll; não equivale a uma auditoria completa de animações. Alguns passos de preparação usam clique/selectOption e colocação explícita de foco; a alegação de teclado aplica-se aos comandos e percursos efetivamente exercitados.

A auditoria externa usa axe-core 4.14.0, instalado fora das dependências da aplicação, em 15 estados a 320 e 1440 px: dashboard, diretório/fila, resumo/preparação, avaliações, validação de avaliação, evolução, agenda do aluno, acompanhamento, formulário de resposta simulada, recorrência, confirmação de cancelamento individual, confirmação de série, equipa, marca e confirmação de reposição. Tags: WCAG 2 A/AA, 2.1 A/AA, 2.2 AA e best-practice; documento completo, sem exclusões de regras ou seletores. O pacote de revisão conserva scripts, JSON antes/depois, versões e logs.

Os 30 estados finais não apresentam violações automáticas reportadas. **As verificações de contraste ficaram incompletas devido aos fundos com gradientes.** Os seletores e resultados `incomplete` permanecem no JSON; requerem revisão manual de contraste. Um resultado automático sem violações não demonstra conformidade WCAG integral.

As sete imagens protegidas são comparadas por hash com a publicação anterior: dashboard Premium a 320/375/1440 px e dashboard/resumo profissionais a 375/1440 px. Sem alteração visual no modo padrão é o critério; foco e cores forçadas são estados adicionais, documentados separadamente.

## Próxima evidência humana

[Protocolo de sessões](DEMO_USER_RESEARCH_PROTOCOL.md) e [ficha de registo vazia](DEMO_RESEARCH_SESSION_TEMPLATE.md) preparados. Não houve recrutamento, entrevistas, sessões com profissionais, testes em aparelhos físicos ou validação com leitores de ecrã nesta entrega. Estes passos, a revisão manual de contraste e a escolha fundamentada do público inicial continuam pendentes. Não existe autorização implícita para piloto com dados reais.
