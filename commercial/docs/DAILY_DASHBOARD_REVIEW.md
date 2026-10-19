# Dashboard diária — proposta para revisão visual independente

Branch `design/aura-daily-dashboard`, baseada no head do PR #40 `fddf2c2ef7f9850681c68e9b8a19faee92b0b3ac`. PR separado e dependente do #40, sem merge ou publicação. A base visual e o login aprovado são preservados. Apenas `commercial/`.

## Comparação com a referência

[Referência aprovada](review/daily-dashboard/reference.png). A implementação adapta hero com fotografia sintética já existente, quatro indicadores efetivamente suportados, evolução individual em destaque, agenda lateral com horas, alunos sem avaliação recente e ações rápidas com ícones. Em mobile a ordem de leitura é gráfico, agenda/ações e atenção; não se usa reordenação CSS que contradiga o teclado. As prioridades detalhadas ficam num disclosure nativo, com controlos montados e pesquisa preservada ao fechar. As avaliações recentes continuam consultáveis.

Não existe pesquisa global, notificações, mensagens, planos alimentares, fotografias de alunos, taxa de assiduidade ou percentagens de crescimento: estes elementos conceptuais foram excluídos. Não se inventam nomes do profissional. O hero encaminha para a agenda existente; não promete uma operação de criação quando a conta pode ter apenas leitura. A identidade do estabelecimento permanece num bloco discreto, incluindo fallback e erro recuperável de White Label.

A evolução é **individual**, não uma média de alunos nem uma interpretação clínica. São reutilizados `ProgressChart`, `evolutionSeries` e a leitura paginada `loadEvolutionWindow`. Só se oferecem peso, altura e cintura. Os candidatos vêm das listas já autorizadas do dashboard, sem novo diretório paralelo. Uma pré-visualização está limitada a 200 avaliações, com aviso explícito e ligação à ficha para consultar mais. Um período sem dados não recebe uma curva fictícia.

## Limites de acesso e falhas

O gráfico usa `aura_client_permissions` antes da leitura e novamente antes de publicar o resultado. Ambas as verificações têm de confirmar `assessments_read`; erro ou revogação oculta as medições. As consultas usam estabelecimento e aluno explícitos. A chave da resposta inclui organização, utilizador, aluno, período e revisão; respostas antigas não preenchem outro contexto. Os pedidos são cancelados ao desmontar/mudar de contexto e têm um prazo total de oito segundos. Atualizar ou regressar à janela limpa a visualização antes de revalidar.

Não foram alterados Auth/RLS, grants, migrations, competências ou contratos SQL. A autorização efetiva continua a ser imposta pelo banco. Os testes desta entrega usam fixtures; não constituem validação de Auth/PostgREST cloud real.

## Capturas

Antes: [desktop](review/daily-dashboard/before/dashboard-1440.png), [mobile](review/daily-dashboard/before/dashboard-375.png), provenientes da revisão aprovada do PR #40.

Depois com o mesmo cenário de base: [desktop](review/daily-dashboard/after/baseline-dashboard-1440.png), [mobile](review/daily-dashboard/after/baseline-dashboard-375.png). Mantém uma medição isolada quando é tudo o que a fixture contém.

Cenário suplementar com quatro medições inventadas: [1440](review/daily-dashboard/after/dashboard-1440.png), [375](review/daily-dashboard/after/dashboard-375.png), [320](review/daily-dashboard/after/dashboard-320.png), [1280](review/daily-dashboard/after/dashboard-1280.png), [1536](review/daily-dashboard/after/dashboard-1536.png). Usa três marcações e dois objetivos; não deve ser confundido com uma comparação dos mesmos valores do cenário anterior.

Na inspeção inicial, as prioridades detalhadas aumentavam demasiado a altura da página e a agenda mobile surgia no fim. Corrigiu-se a composição e repetiram-se as capturas. A hierarquia aproxima-se do conceito, mas preserva controlos, estados de erro, tabela acessível do gráfico e explicações que tornam a página mais alta do que um mockup estático. Não se declara equivalência pixel a pixel.

## Verificação reproduzível

```text
npm run lint
npm run typecheck
npm run build
node --import tsx --test --test-concurrency=1 tests/*.test.ts
npx playwright test --workers=2
npm audit --json
```

Doze testes novos cobrem cinco larguras, alteração do indicador, permissão recusada/erro, revogação durante leitura, resposta antiga de outra organização, falha de rede/retoma, limite explícito da pré-visualização e disclosure operável por teclado com rascunho preservado. Os testes anteriores de navegação foram adaptados à atenção agora visível e ao novo disclosure de prioridades, mantendo as asserções funcionais e os cenários negativos. Nenhum teste foi ignorado para obter aprovação.

No desenvolvimento, os novos testes expuseram seletores de labels ambíguos e uma leitura anterior ainda em curso na preparação de um cenário negativo. A procura por papel acessível e a sincronização com a conclusão do carregamento inicial corrigem a medição do cenário; a lógica não foi aberta para fazer o teste passar. A falha de rede é ensaiada com a espera necessária para o prazo de oito segundos, verificando que os valores antigos desaparecem imediatamente.

APIs de paginação confirmadas na [documentação oficial](https://supabase.com/docs/reference/javascript/range). Mantêm-se as versões e dependências existentes. Os resultados finais e SHA exato são apresentados no PR.

## Limitações

Leitores de ecrã, zoom nativo, Safari e Firefox continuam por validar. Contraste/teclado/estrutura testados não equivalem a certificação WCAG. Nutrição, produção, staging, `main` e NutriTrack pessoal não são modificados. Sem recursos/custos novos ou migrations. Mantêm-se abertos os bloqueios altos de autenticação, sessões/JWT, recuperação cloud, recuperação de conta/MFA e RGPD. Não autoriza dados reais nem piloto comercial.

Resultados locais finais: lint, TypeScript e build aprovados; domínio/PostgreSQL 97/97; Chromium 219/219; npm audit: zero vulnerabilidades. First Load JS de /: 185 kB (base 181 kB), partilhado 103 kB. A fixture normal aguarda a conclusão do gráfico antes de instalar falhas destinadas a outros módulos; slowA continua pendente nos testes de concorrência. Nenhum cenário foi removido.
