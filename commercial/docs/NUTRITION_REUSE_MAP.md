# Mapa de reutilização e dependências — proposta

Base auditada: `6823fe0`. Ler o [inventário com referências de código](NUTRITRACK_NUTRITION_INVENTORY.md). Nenhum ficheiro pessoal foi copiado para um módulo operacional nesta fase.

## Código e destino

| Origem | Destino proposto | Trabalho necessário | Decisão |
|---|---|---|---|
| commercial/lib/nutrition.ts:1–27 | Núcleo de composição/porções do módulo | Reusar portionNutrients/mealNutrients; manter cálculo sem persistência/recomendação | **Usar o existente**, não duplicar |
| index.html:2774 normalizeFoodSearch/matchesFoodSearch | Futuro lib/nutrition-search.ts | Extração pequena, testes acentos/termos, limite de tamanho; sem dependência do monólito | Reutilização direta da lógica, futura |
| index.html:2614 alimentosPT e :2734 push | Fixtures inventadas agora; catálogo curado depois | Proveniência, licença, forma crua/cozinhada, unidade/base, duplicados, versão | Não carregar automaticamente o dataset |
| index.html:2835 searchFoods / :2900 lookupBarcode | Adaptador de fornecedor isolado, desativado por defeito | Contrato por 100g, campos desconhecidos, erro/timeout, cancelamento, quotas e atribuição | Adaptar após decisão; não usar fetch do monólito |
| selectFood / registerMeal / saveEditMeal | Futuro MealEditor AURA + comandos de diário | Reconstruir React/validação; snapshots e recomputação no servidor, revisão esperada | Modelo/persistência novos |
| waterData / planDailyData | Futuro diário de hidratação/hábitos | ml/eventos e data local; sem meta automática | Ideia/UI adaptáveis; storage novo |
| templates[] / useTemplate | Receita/modelo opcional | UUID, itens, versão, confirmação/idempotência; não copiar o consumo do dia | Adiar até diário estável |
| calculateTMB/TDEE, getMacroTargets, getWeeklyTargetReview, buildMealPlan, getAISuggestions | Nenhum módulo automático inicial | Exigem decisão de produto, validação profissional, jurídica e clínica própria | Não portar para MVP |
| ProgressChart, StudentEvolution, lib/chart.ts, lib/evolution.ts | Nutrição 360º com padrões AURA | Reusar acessibilidade/layout, não tratar série alimentar como avaliação física | Adaptar apresentação, separar domínio |
| ProfileNavigation / AssessmentWorkspace | Entrada Nutrição na ficha existente | Nova secção futura, props/contexto e guards existentes; subpáginas endereçáveis | Estender sem segunda aplicação |
| RequestScope / useDraftNavigation | Pedidos e rascunhos de Nutrição | Scope user/org/client/request, resultado incerto e confirmação de saída | Reusar padrões; testes negativos novos |
| staff_capabilities / client_assignments / client_users | Autorização nutricional | Módulos explícitos novos em futuro incremento aprovado; sem grants por role | Não reaproveitar followup como atalho |
| PrivacyPanel / downloadVisibleExport / contexto de privacidade | Direitos/exportação nutricional | Adicionar projeções mínimas por módulo e ator; mesma revisão/auditoria de pedidos | Estender contratos após revisão |
| NutritrackBridge / lib/nutritrack-import.ts | Ponte atual de peso/cintura | Manter contrato e proveniência; sem alterações nesta auditoria | Preservar; não alargar implicitamente |
| getCloudPayload/applyCloudPayload/reconcileCloudData, sw.js, Auth pessoal | Nenhum | Não copiar JSONB pessoal, cache de GET, sessão ou credenciais | Excluir da implementação AURA |

## Dependências observadas e política proposta

| Dependência atual | Uso encontrado | Proposta AURA / limite |
|---|---|---|
| JavaScript/HTML/CSS do monólito | DOM, eventos inline, innerHTML e localStorage | Não incorporar script/iframe; extrair só funções puras pequenas |
| Chart.js **3.9.1** por CDN, index.html:15 | Canvas de peso/calorias/macros | Não adicionar pacote só para paridade; usar gráficos/tabelas AURA. Se indispensável depois, rever versão/licença/acessibilidade e fixar no lockfile |
| @supabase/supabase-js **@2** por CDN, :16 | Auth/sync pessoal sem patch fixado no HTML | Usar exclusivamente a dependência AURA já fixada no package-lock; sem novo cliente pessoal ou segredo no frontend |
| Open Food Facts | Pesquisa v3 e produto v2, :2872/2919 | Fornecedor opcional. Validar direitos, origem, qualidade, API e limites antes de ativar; não enviar identidades, refeições ou notas do aluno |
| BarcodeDetector, getUserMedia, FileReader, Canvas | Scanner/fotos locais | Scanner posterior com fallback manual; fotos excluídas. Sem nova SDK ou upload nesta fase |
| localStorage, Cache API, service worker | Persistência e offline pessoal | Não persistir dados nutricionais sensíveis em storage/cache genérico; começar online com rascunho em memória |
| React/Next/TypeScript já existentes | Workspace AURA | Sem framework, app ou serviço adicional |
| PGlite/Playwright já existentes | Domínio, PostgreSQL e Chromium | Reutilizar harness local e guard de staging; não acrescentar serviço de testes pago |

Não há licença de software de raiz demonstrada nos ficheiros consultados. A autorização do responsável para trabalhar no repositório não demonstra direitos de terceiros sobre alimentos/imagens. Antes de redistribuir código/dados externos, registar autoria e licença aplicável; não copiar os CDNs ou catálogos como se estivessem aprovados.

## Fornecedor alimentar: verificação documental, não integração

Consulta em 2026-10-18: a [documentação oficial OFF](https://openfoodfacts.github.io/openfoodfacts-server/api/) distingue licenças da base (ODbL), conteúdos e imagens; também avisa que completude/precisão não são garantidas. O desenho do catálogo deve conservar atribuição e separar dados próprios de dados do fornecedor. Isto não resolve a interpretação jurídica da licença nem autoriza misturar/republicar bases.

A mesma documentação recomenda v3 para integrações novas, pede identificação da aplicação e documenta rate limits, incluindo advertência contra pesquisa online a cada tecla. A adaptação deverá usar pesquisa explícita, debounce apenas local, cancelamento e orçamento configurável de pedidos, tratamento de 429/5xx e cache restrito a composição pública licenciada. Não foram feitas consultas de produtos, criada conta OFF ou assumido SLA/custo. Rever documentação novamente antes de implementar.

## Verificação de preservação

Fingerprint local em `.aura-integration/stability-nutrition/legacy-source-hashes.json`; comparar no fecho. A prova de funções isoladas fica fora do CI permanente para não acoplar a evolução comercial ao monólito pessoal. O núcleo AURA tem os seus próprios testes `tests/nutrition.test.ts`; importar dados/refeições ou associar identidades exige outro contrato e outra autorização.
