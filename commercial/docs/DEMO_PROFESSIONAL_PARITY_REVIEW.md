# AURA — demonstração e ficha profissional: revisão incremental

Base: `integration/aura-staging`, `cfc29aab9c1207ffa9e64ffe046319cff17d43d4`.
Branch de trabalho: `feat/aura-demo-professional-parity`. Sem integração ou publicação automática.

## Estado dos PRs confirmado em 2026-10-20

| PR | Estado | Head | Base |
| --- | --- | --- | --- |
| [#40](https://github.com/danielfilipemc-cloud/nutritrack/pull/40) | Aberto, não integrado | `fddf2c2` | `saas-foundation` |
| [#41](https://github.com/danielfilipemc-cloud/nutritrack/pull/41) | Aberto, não integrado | `a3f23bf` | `design/aura-premium-experience` |
| [#42](https://github.com/danielfilipemc-cloud/nutritrack/pull/42) | Aberto, não integrado | `a601866` | `design/aura-daily-dashboard` |
| [#43](https://github.com/danielfilipemc-cloud/nutritrack/pull/43) | Integrado | `44cbe72` | `integration/aura-staging` |
| [#44](https://github.com/danielfilipemc-cloud/nutritrack/pull/44) | Integrado | `cfc29aa` | `integration/aura-staging` |

A cadeia #40 → #41 → #42 continua identificada e aberta; o staging já contém os seus commits por ancestralidade. Este trabalho não altera os PRs anteriores nem os integra nas suas bases.

## Auditoria do estado inicial e decisões

| Área | Demo no #44 | Aplicação profissional | Decisão nesta fase |
| --- | --- | --- | --- |
| Identidade | Inicial isolada, duplicada | `StudentIdentity`, iniciais e conteúdo fornecido por props | Reutilizar componente sem alterações |
| Navegação 360.º | Três botões, avaliações/evolução e agenda/acompanhamento agrupados | `ProfileNavigation`, grupos desktop e seletor mobile; áreas filtradas por permissões pelo chamador | Reutilizar apresentação com cinco áreas fixas da demo |
| Resumo | Apenas peso atual/anterior e lista curta | Três indicadores, datas/deltas e gráfico | Reutilizar `ClientProgressSummary` com até 30 avaliações locais e `ProgressChart` |
| Evolução | Lista de pesos | `ProgressChart` + funções puras de `lib/chart`, SVG/tabela | Partilhar gráfico e tabela, sem importar loaders ou permissões |
| Avaliações | Peso, data UTC implícita; rascunho podia transitar entre alunos | Formulários, validação, RPC, revisões, partilha e proveniência | Formulário local com data explícita e três medições; rascunho por aluno; regras puras de validação partilhadas |
| Agenda | Marcações globais sem associação à ficha | Consultas por organização/aluno, paginação, permissões e concorrência | Exemplos com `studentId` associados ao mesmo aluno na ficha e agenda geral; sem CRUD profissional |
| Acompanhamento | Mensagem vazia | Responsável, estado, revisão, objetivo, RPC e confirmação de revisão | Editor local e contexto no cabeçalho; prioridades derivadas dos exemplos guardados |
| Dashboard | Hero, indicadores, agenda lateral e diretório | Hero aprovado, quatro KPIs suportados, evolução, agenda lateral, prioridades | Dashboard profissional sem alterações; demo conserva composição e acrescenta prioridades locais |
| Mobile | Scroll horizontal de áreas e três secções apertadas | Navegação própria, seletor e formulários | Seletor da ficha partilhado, formulários em coluna e alvos de toque de 44 px |
| Dados | Estado React local | Supabase, autorização por aluno, verificações antes/depois das leituras e cancelamento | Manter adaptadores separados e cobrir fronteira com testes estáticos e de browser |

`AssessmentWorkspace`, `StudentContext`, `StudentOverview`, `DashboardEvolution`, `AgendaPanel`, `ClientCare`, `ClientObjectives`, `ProfessionalShell` e hooks profissionais permanecem exclusivos do percurso autenticado. `ClientProgressSummary` depende apenas das funções puras de `lib/care`; esta dependência também é percorrida pelo teste de isolamento. Mesmo quando um componente parece visual, as dependências transitivas podem trazer acesso a dados. A demo recebe apenas objetos de exemplo; não aceita organização ou aluno privado a partir do URL.

## Contrato de dados fictícios

- Referência determinística de calendário: **2026-10-20**, visível na interface. “Hoje” na demo significa essa data de exemplo; não se faz passar por agenda em tempo real.
- Cada carregamento cria cópias independentes dos alunos, avaliações e acompanhamento.
- Sem pedidos a Auth, REST, APIs ou serviços externos, nem acesso a storage ou cookies de autenticação na closure de módulos da demo. O browser carrega apenas a página e assets locais do Next.js. Sem sincronização ou exportação.
- Um exemplo de avaliação por dia. Guardar novamente substitui apenas o exemplo local dessa data; a regra é explícita junto do formulário. Nenhuma alegação de revisão/auditoria profissional.
- Rascunhos de avaliações e acompanhamento separados por aluno, preservados ao alternar áreas da demo; recarregar repõe tudo.
- Alunos novos começam sem medições, marcações, responsável ou revisão. Nenhum zero ou dado de outro aluno é usado como substituto.
- Os exemplos não representam aconselhamento clínico. As operações de partilha, consentimento, permissões, proveniência, histórico de revisões, objetivos profissionais e integrações não são simuladas como se fossem reais.

## Validação e evidência

As imagens são entregues num pacote local separado, sem upload automático ao repositório público. O pacote contém `before/`, `after/`, manifesto SHA-256 e registos de validação. As vistas autenticadas usam `e2e/fixtures.cjs`, com todos os pedidos de dados interceptados e exclusivamente dados sintéticos.

| Vista | Antes (375 / 1440 px) | Depois (375 / 1440 px) |
| --- | --- | --- |
| Dashboard da demo | `demo-dashboard-{largura}.png` | Mesmo nome em `after/` |
| Resumo 360.º | `demo-summary-{largura}.png` | Mesmo nome em `after/` |
| Avaliações / evolução | `demo-assessments-{largura}.png` (área combinada) | `demo-assessments-{largura}.png` e `demo-evolution-{largura}.png` |
| Agenda / acompanhamento | `demo-care-{largura}.png` (área combinada) | `demo-agenda-{largura}.png` e `demo-care-{largura}.png` |
| Dashboard profissional | `professional-dashboard-{largura}.png` | Mesmo nome em `after/` |
| Resumo profissional | `professional-summary-{largura}.png` | Mesmo nome em `after/` |
| Novo aluno / formulário a 320 px | Não aplicável | `demo-empty-320.png`, `demo-draft-320.png` |

O build de referência foi compilado com a página e CSS originais do commit base; os ficheiros novos ainda não estavam ligados à rota. As capturas usam 1000 px de altura e página completa, com relógio de referência `2026-10-20T12:00:00Z` (as duas capturas compactas usam 900 px de altura). Duas recolhas iniciais excederam limites de tempo na máquina local; as imagens foram inspecionadas e o script final separa demo/profissional e permite tempo próprio para recolha visual, sem alterar timeouts dos testes funcionais existentes.

Reprodução com Node 22.23.3 / npm 10:

```sh
npm ci
npm run check
npm audit --audit-level=moderate
# Build do browser usa apenas estes valores fictícios:
NEXT_PUBLIC_SUPABASE_URL=https://aura-test.supabase.co NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=sb_publishable_e2e_fixture npm run build
npx playwright install chromium
npm run test:e2e
AURA_CAPTURE_PHASE=after npx playwright test e2e/demo-parity-captures.spec.cjs --workers=1
```

Para repetir `before`, compilar o commit base num checkout separado e copiar apenas o script de captura deste PR, executando-o com `AURA_CAPTURE_PHASE=before`. O script de captura é condicional e fica ignorado no CI normal.

Os checks de GitHub Actions na HEAD do PR são a referência para a execução completa do workflow existente (lint, domínio/PostgreSQL local, TypeScript, build, audit e Chromium). Os resultados locais e a comparação das capturas acompanham o pacote de revisão. `tests/demo-isolation.test.ts` percorre imports/re-exports da rota e layout, incluindo as dependências dos componentes partilhados, rejeitando módulos não revistos, I/O, persistência e CSS remoto. `e2e/demo-isolation.spec.cjs` valida a sessão fictícia preexistente, URLs com IDs privados de fixture, mudanças de aluno, rascunhos, calendário, reposição ao recarregar e ausência de pedidos a serviços.

Revisão independente pendente. Não autoriza dados reais, piloto ou integração. Safari, Firefox, leitores de ecrã e zoom nativo exigem validação separada; não se infere essa cobertura a partir de Chromium.
