# AURA — evidência do refinamento Premium

Base: `659103254bcc89cda18b5823a76e548a5793e327`. Continuação do PR #25 (`feat/aura-premium-density`) em `feat/aura-premium-crm-profile`. Ordem de revisão: dashboard/padrões primeiro, diretório/ficha depois. Nenhum merge ou deploy autorizado nesta fase.

## Problemas confirmados e alterações

| Área | Diagnóstico visual | Alteração |
|---|---|---|
| Dashboard | Prioridades só começavam a 1414 px no mobile; KPIs, atalhos e tabelas disputavam atenção | KPIs compactos, links rápidos, filtros alinhados, agenda lateral desktop e tabelas secundárias em disclosures |
| Shell | Margens automáticas centravam páginas curtas verticalmente; marca e cabeçalhos repetidos consumiam altura | Margem explícita, espaçamentos e controlos normalizados, identidade compacta; seletores profissionais isolados de `/demo` |
| Diretório | Quatro ações por linha e paginação fragmentada no mobile | «Abrir ficha» como ação principal; menu nativo «Mais ações» para edição, histórico e arquivo; linhas em cartões mobile, badges e paginação própria |
| Aluno 360º | Cabeçalho espalhado por vários blocos e resumo demasiado alto | Ações no cabeçalho, identidade com estado, navegação existente preservada e medições compactas no mobile |
| Avaliações | Campos sem largura adequada e distribuição 2+1 no desktop | Data com largura limitada, três medições alinhadas no desktop e uma coluna mobile |
| Evolução | SVG de 680 px reduzido até rótulos quase ilegíveis no mobile | Dimensões de desenho observadas no contentor, com escala de 320–680 px; mesmo domínio temporal, valores, unidades e tabela acessível. Ativação apenas nos gráficos profissionais |
| Cronologia | Histórico carregado aumentava a página indefinidamente | Lista compacta com viewport, região focável, instrução de deslocação e carregamento/paginação original preservados |
| Objetivos e acompanhamento | Cartões e formulários com ritmo visual inconsistente | Lista mais leve, formulário de objetivos distinguido e duas colunas desktop; padrões de controlos, estados e espaços comuns |
| Marca, agenda, vazio e erro | Cabeçalhos altos, alinhamentos diferentes e feedback pouco hierarquizado | Shell comum, alinhamentos consistentes, estado vazio com próximo passo; erros e ações de recuperação continuam visíveis |

Sem indicadores novos, novas capacidades de negócio, migrations ou contratos SQL. Sem alterações a autenticação, MFA, RLS, competências, atribuições, revisões, partilha ou importação manual NutriTrack. Os handlers de edição, estados de resultado incerto, confirmações, scopes e proteção de rascunhos foram mantidos. Os menus/disclosures não desmontam os formulários.

## Antes/depois controlado

Mesma fixture local: 3 objetivos, 2 sessões, 16 eventos sintéticos adicionais; viewports 1440×1000 e 375×812. Números são alturas da página no cenário reproduzido, não métricas de utilizadores nem garantia para qualquer conjunto de dados.

| Ecrã / medida | Antes | Depois |
|---|---:|---:|
| Dashboard desktop — início das prioridades | 666 px | 480 px |
| Dashboard mobile — início das prioridades | 1414 px | 725 px |
| Dashboard desktop — altura total | 2361 px | 1423 px |
| Dashboard mobile — altura total | 4631 px | 2373 px |
| Diretório mobile — altura total | 1598 px | 1195 px |
| Ficha/resumo mobile — altura total | 1658 px | 1210 px |
| Evolução desktop — altura total | 6225 px | 2225 px |
| Evolução mobile — altura total | 7296 px | 2731 px |

A menor altura também resulta de disclosures fechados e listas com deslocação interna. Não significa remoção de dados; testar deliberadamente a descoberta das tabelas e a deslocação das listas na revisão humana.

Capturas selecionadas e respetivas métricas ficam em `review/premium-refinement/`. Cada par `before`/`after` usa o mesmo cenário. As restantes capturas (avaliações, agenda, objetivos, acompanhamento, marca, vazio e erro) são reproduzíveis pela suite abaixo e ficam localmente em `.aura-integration/refinement/`.

| Ecrã | Antes desktop | Depois desktop | Antes mobile | Depois mobile |
|---|---|---|---|---|
| Dashboard | [antes](review/premium-refinement/before/dashboard-1440.png) | [depois](review/premium-refinement/after/dashboard-1440.png) | [antes](review/premium-refinement/before/dashboard-375.png) | [depois](review/premium-refinement/after/dashboard-375.png) |
| Diretório | [antes](review/premium-refinement/before/directory-1440.png) | [depois](review/premium-refinement/after/directory-1440.png) | [antes](review/premium-refinement/before/directory-375.png) | [depois](review/premium-refinement/after/directory-375.png) |
| Ficha | [antes](review/premium-refinement/before/profile-1440.png) | [depois](review/premium-refinement/after/profile-1440.png) | [antes](review/premium-refinement/before/profile-375.png) | [depois](review/premium-refinement/after/profile-375.png) |
| Evolução | [antes](review/premium-refinement/before/evolution-1440.png) | [depois](review/premium-refinement/after/evolution-1440.png) | [antes](review/premium-refinement/before/evolution-375.png) | [depois](review/premium-refinement/after/evolution-375.png) |

## Testes e reprodução

Executar no diretório `commercial/` com Node 22.23.3 e dependências do lockfile:

```sh
npm ci
npm run lint
npm run test
npm run typecheck
npm run build
npm audit --audit-level=moderate
npm run test:e2e -- --workers=2
```

`premium-refinement.spec.cjs` captura 11 ecrãs em duas larguras, verifica vazio/erro e ausência de overflow, e testa menu do diretório por teclado, preservação de rascunho, deslocação da cronologia e redimensionamento/legibilidade/tabela do gráfico. `dashboard-density.spec.cjs` verifica 375/1280/1440 px, primeira área útil e disclosures por teclado. Todos os pedidos Supabase destes testes são interceptados; não se trata de Auth/PostgREST cloud real. O PostgreSQL/RLS é exercitado pelas suites PGlite existentes.

Para gerar só as capturas depois de compilar:

```sh
npx playwright test e2e/premium-refinement.spec.cjs --grep "refinement visual" --workers=2
```

A baseline foi capturada com a build do SHA base antes das alterações; a variável `AURA_VISUAL_PHASE=before` apenas escolhe a pasta de saída e não transforma código novo em baseline. Não usar `AURA_E2E_LIVE=1` ou runners históricos. As fixtures recusam endpoints não implementados; usar só dados fictícios.

Resultados locais finais da cadeia: lint PASS; 73/73 testes domínio/PostgreSQL PASS na repetição sequencial; TypeScript PASS; build PASS; npm audit 0 vulnerabilidades; Chromium 158/158 PASS. As 22 capturas de cada fase estão disponíveis e as 22 finais foram inspecionadas visualmente, incluindo a repetição dos gráficos corrigidos. As suites cobrem rascunhos, conflitos, operações pendentes, respostas atrasadas, revogação, proveniência, navegação desktop/mobile e teclado. Os SHAs e o estado final de CI constam das descrições dos PRs; não confundir validação local com CI pendente. A primeira execução Chromium detetou alteração no nome acessível de «Ver agenda completa», corrigida preservando o texto e ocultando apenas a seta decorativa de leitores de ecrã. Uma execução paralela de domínio terminou com falha nativa Windows `3221226505` num processo PGlite, sem assertion falhada; a repetição sequencial terminou com 73/73 PASS. O CI Linux do PR #25 também passou a suite normal; a falha nativa local continua registada como limitação de execução, não como prova de defeito funcional corrigido. Não omitir esse incidente na evidência final.

## Limitações e critérios da revisão independente

- Avaliar subjetivamente hierarquia, tamanhos e descoberta das ações; altura menor por si só não prova boa UX. Disclosures e deslocação interna são escolhas sujeitas a teste de usabilidade.
- As capturas são de Chromium com fixtures. Não certificam WCAG, dispositivos físicos, Safari/Firefox nem segurança cloud. Fazer ensaio com leitor de ecrã e validar zoom/texto aumentado.
- Agenda ainda contém várias ações por marcação. Estão preservadas e acessíveis; priorização adicional exige revisão de UX, sem remover operações.
- O número de secções da ficha continua elevado porque as ferramentas existentes foram preservadas. A navegação mobile usa o seletor nativo; no desktop pode ocupar duas linhas.
- A seleção `responsive` do gráfico é opt-in: as demonstrações públicas continuam com a apresentação anterior. Nenhum cálculo de progresso ou proveniência foi alterado.
- Aviso Next/ESLint sobre o plugin Next continua conhecido; lint explícito permanece obrigatório. Não alterar dependências apenas para ocultar o aviso.
- Os bloqueios altos H-01 passwords comprometidas, H-02 política de sessões/JWT, H-03 recuperação cloud, H-04 recuperação de conta/MFA e H-05 RGPD/retenção/consentimentos permanecem abertos.

Não houve alterações a produção ou staging, recursos pagos, dados reais, `main` ou NutriTrack pessoal. A publicação continua no SHA previamente autorizado; estes PRs exigem revisão independente antes de qualquer integração ou deploy.
