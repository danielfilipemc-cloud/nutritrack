# Aluno 360º — primeiro incremento da Fase 2

Atualização posterior de 16/10: corrigido histórico acima do limite real de 1000 da API, ensaio real com 1205 medições e logout global partilhado com tratamento de falhas parciais. Resultado atual: **48 testes, 35 Chromium, TypeScript e build PASS**; cinco grupos reais de volume/isolamento/revogação PASS. Ver [revisão técnica atual](SECURITY_REVIEW_20261016.md). Os resultados de 45/32 abaixo são o checkpoint histórico anterior.

## Consolidação de 16/10/2026

A branch incorpora a consolidação das fundações `2c98474`, mantendo o PR #10 dependente do PR #9 e sem alterar o código da ficha ou das migrations. A suite Chromium completa passou **32/32 numa única execução**, substituindo o limite das execuções parciais descritas historicamente abaixo. Os 45 testes, TypeScript e build da revisão de entrada também passaram. As fundações foram verificadas separadamente: 41 testes, build e TypeScript PASS; 16 grupos reais Auth/RLS e seis Auth PASS novamente. O controlo restaurado passou login, isolamento e preservação de avaliação.

Ver [estado de integração e gates](INTEGRATION_STATUS.md). As funcionalidades desta branch continuam fora da demonstração publicada. Treino, nutrição e comunicação permanecem incompletos; a aritmética alimentar pura não representa sincronização NutriTrack ou plano nutricional.

Após incorporar as fundações: `npm run check` voltou a passar integralmente (45/45, TypeScript e build, 14 rotas). O código da aplicação/fixtures/testes/SQL não mudou relativamente à execução Chromium de 32/32; as alterações desta consolidação são documentação e repetição segura do runner Auth. CI das fundações `2c98474` aprovado: [run 38943372078](https://github.com/danielfilipemc-cloud/nutritrack/actions/runs/38943372078). O CI do próximo commit desta branch deve ser consultado separadamente.

## Entrega

A ficha individual reúne o resumo, plano de acompanhamento com objetivo/responsável/revisão, avaliações e agenda já existentes, e acrescenta uma área própria de evolução. Mantém a experiência do aluno separada da interface profissional e continua a usar as permissões por aluno e competência das fundações.

`StudentEvolution.tsx` consulta apenas avaliações do estabelecimento/aluno selecionado e autorizadas pelo backend. Permite 30, 90, 365 dias ou todo o histórico, com peso, altura ou cintura, gráfico e tabela acessível. Exclui versões substituídas e datas futuras. Carrega 200 registos de cada vez, até 2000, sinaliza explicitamente resultados incompletos e permite atualizar/repetir consultas falhadas. A variação compara a primeira e a última medição disponíveis, sem inferir estado clínico. O gráfico anterior conserva o limite de 30; a nova área pode mostrar todas as medições carregadas.

A agenda individual recebe agora `schedule_write`; profissionais de consulta deixam de ver criação e mutações das marcações. A autorização definitiva continua no servidor. As ações e o formulário de avaliações mantêm os controlos existentes, incluindo correção auditável e partilha explícita com o aluno.

Treino, nutrição e comunicação têm uma apresentação explícita do estado previsto, sem ações fictícias de envio ou gravação. O cálculo puro `lib/nutrition.ts` prepara a reutilização da composição alimentar por 100g e porções do NutriTrack. Não incorpora sincronização, identidade, armazenamento, recomendações ou metas clínicas. O NutriTrack original permanece intacto.

## Superfície de alteração

- UI: `components/AssessmentWorkspace.tsx`, `StudentEvolution.tsx`, `AgendaPanel.tsx`, `ProgressChart.tsx`.
- Lógica: `lib/evolution.ts`, `lib/chart.ts`, `lib/nutrition.ts`.
- Testes: `tests/evolution.test.ts`, `tests/nutrition.test.ts`, `e2e/student-360.spec.cjs`.
- Nenhuma migration nova, dependência nova ou alteração de schema/RLS nesta fase.

## Integrações seguintes

Treino, alimentação e mensagens necessitam de modelos próprios com identidade composta estabelecimento/aluno, competências explícitas, atribuições, versionamento, minimização e projeções distintas para o aluno. As capacidades atuais não devem ser reutilizadas como autorização implícita para novos módulos. A integração alimentar deve consumir funções puras, não importar o script global ou a sincronização antiga. O código preparado não é um diário alimentar ou prescritor de planos.

O plano atual tem um objetivo textual por aluno; ainda não existe gestão de múltiplos objetivos ou metas com séries temporais. A ficha não junta dados de diferentes estabelecimentos. Não há chat, notificações, treinos prescritos, novos alimentos em base de dados ou automações.

## Limites operacionais

Fundações validadas em Supabase local real: ver `LOCAL_VALIDATION.md`. Chromium usa fixtures interceptadas e dados fictícios; não é um novo ensaio cloud. Nenhuma publicação, merge ou operação de produção. O acesso JWT após logout pode sobreviver até ao TTL local de 900s; MFA global, política de sessões, decisões jurídicas, retenção e recuperação cloud continuam pendentes antes de dados reais.

## Validação executada

- `npm test`: 45/45 PASS, incluindo quatro novos testes de evolução e nutrição; regressão PostgreSQL/RLS via PGlite incluída.
- `npm run typecheck`: PASS. `npm run build`: PASS, 13 páginas geradas.
- Regressão Chromium: os 25 cenários anteriores passaram. Três cenários novos passaram na execução dirigida e o quarto (falha/carregamento incremental) passou numa repetição isolada após corrigir a fixture para não intercetar o resumo. São 29 cenários distintos validados em execuções separadas.
- A primeira execução encontrou uma etiqueta de seletor insuficientemente precisa, corrigida com nome acessível explícito. As falhas seguintes pertenciam à fixture nova: o SDK repete 503 e a consulta paginada do resumo também usa `limit`; a falha fictícia passou a atingir exclusivamente a evolução. Nenhuma falha fica por resolver nestes cenários.
- Após a última proteção de arredondamento de valores extremos, os dois testes de nutrição voltaram a passar. Não se repetiram as 16+6 verificações reais das fundações, pois as migrations e controlos de servidor não mudaram.

## Pré-visualização de consulta

`/demo/aluno-360` permite experimentar sem conta a navegação da ficha, avaliações fictícias, evolução com os mesmos helpers/gráfico, objetivos e agenda em memória. Inclui dois alunos, modo de escrita/consulta e apresentação explícita dos módulos ainda previstos. O objetivo e as marcações conservam-se ao mudar de secção; recarregar repõe o exemplo. O modo de consulta apenas simula a interface e não substitui testes de RLS. Não existem pedidos Supabase nem gravação em storage nesta rota. Os formulários só devem receber exemplos fictícios.

O acesso está ligado a partir de `/demo`. Para consulta neste computador foi iniciado um servidor em `127.0.0.1:3188`; não é um endereço público. Não se publicou ou alterou a aplicação de produção. Um futuro alojamento de preview deve ser separado e preservar dados exclusivamente sintéticos.

Alterações adicionais: `app/demo/aluno-360/page.tsx`, link em `app/demo/page.tsx`, modo de consulta e etiqueta acessível em `DemoCare.tsx`, três cenários em `e2e/preview-360.spec.cjs`. TypeScript/build passaram. Os quatro cenários da demo existente e dois novos passaram na execução inicial; o terceiro passou após corrigir a etiqueta do objetivo, que mudava de nome acessível ao editar texto. Sete cenários distintos validados, incluindo ausência de pedidos externos, isolamento entre exemplos, reset e layout móvel. Nenhuma migration ou dependência nova.
