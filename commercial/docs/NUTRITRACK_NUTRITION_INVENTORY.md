# Inventário técnico NutriTrack — Nutrição AURA

Auditoria de código em 2026-10-18 sobre a base `6823fe0b9d35db9f5edaa4939ed45a022ab01888`. **Só leitura do projeto pessoal**, sem abrir a aplicação pessoal, consultar dados/contas, copiar bases ou executar o seu instalador. Foram consultados index.html, sw.js, supabase-setup.sql, README.md, CLOUD_SETUP.md e manifest.webmanifest; cloud-config.js foi apenas objeto de fingerprint, sem reproduzir configuração. Nenhuma implementação nutricional ou migration é entregue nesta fase.

Entregas relacionadas: [diagnóstico da ficha](PROFILE_INTERMITTENT_DIAGNOSIS.md), [arquitetura proposta](NUTRITION_ARCHITECTURE_PROPOSAL.md), [mapa de reutilização](NUTRITION_REUSE_MAP.md) e [plano de PRs](NUTRITION_IMPLEMENTATION_PLAN.md).

## Fonte e classificações

Fonte imutável: [index.html no SHA auditado](https://github.com/danielfilipemc-cloud/nutritrack/blob/6823fe0b9d35db9f5edaa4939ed45a022ab01888/index.html). As referências abaixo são ficheiro:linha inicial, com símbolos para verificação por rg. SHA256 index.html: `48a56f82434f7ee07d8285473595dc4f82cc9ea60027e1b29324488468d3dfef`.

**1 — direta:** lógica pura já adequada, sem carregar o monólito. **2 — adaptação:** ideia/parte da lógica aproveitável, com contratos, validação e UI AURA. **3 — nova:** o requisito existe como ideia pessoal, mas o SaaS exige outro modelo/transação/autorização. **4 — não recomendada:** não transportar para o MVP AURA; eventual reavaliação exige decisões específicas. Uma classificação de código não aprova a qualidade dos dados ou enquadramento profissional.

| ID | Funcionalidade e fonte | Estado observado | Classe e destino |
|---|---|---|---|
| N01 | Catálogo local, index.html:2614 e 2734, alimentosPT | 120 declarações de alimentos; name/cat/aliases, kcal/macros por 100g, serving/unit. Sem id/versionamento/licença/origem por entrada demonstrados. Não equivale a 120 alimentos curados/deduplicados | **2**: curadoria, direitos e proveniência antes de qualquer carga; usar fixtures inventadas entretanto |
| N02 | normalizeFoodSearch / matchesFoodSearch, :2774 | Normaliza acentos, caixa/espaços e exige todos os termos em nome/categoria/aliases | **1**: extração pura com testes; sem importar dataset nem armazenamento |
| N03 | searchFoods, :2835 | Pesquisa local/pessoal e OFF por nome; mínimo de três caracteres para consulta online; há verificação parcial de query antiga | **2**: adaptador cancelável, limites, resposta validada, sem ligação externa por defeito |
| N04 | saveCustomFood, :2783 | Alimento por rótulo, código de barras e porção; até 100 no dispositivo, substituição por nome case-insensitive. Só nome/calorias têm a validação explícita principal | **3**: catálogo de organização com ids, versões, autoria e validação de todos os nutrientes/unidades |
| N05 | getRecentFoods/addToRecent, :2760/2813 | Oito recentes, deduplicados pelo nome; partilham localStorage entre contas no mesmo browser | **2**: preferências por utilizador + organização, sem acesso implícito a diários |
| N06 | lookupBarcode/openBarcodeScanner, :2900/2956 | Produto OFF v2, BarcodeDetector/getUserMedia, fallback manual; termina tracks ao fechar | **2**: opcional posterior; confirmar formatos/unidades/origem, scanner não obrigatório para diário |
| N07 | selectFood / registerMeal, :3045/3090 | Cada linha representa um alimento registado com tipo/data/hora/nome/quantity e totais arredondados; sem id estável, autor ou revisões | **3**: refeição com itens e snapshot versionado; aproveitar só o conceito de seleção/porção |
| N08 | saveEditMeal/deleteMeal, :3157/3186 | Edição por índice, reescala totais já arredondados; remoção por splice, sem histórico/conflito | **3**: revisão esperada, correção auditável e anulação explícita |
| N09 | Composição × gramas, selectFood :3045; AURA lib/nutrition.ts:8 | O núcleo puro já foi adaptado na AURA como portionNutrients/mealNutrients, validando finitos, negativos e overflow | **1**: reutilizar o módulo AURA existente, sem outra implementação duplicada |
| N10 | calculateTMB/TDEE/CalorieGoal, :959–1003 | Estimativas por sexo/idade/peso/altura/atividade, défice e override manual; fallback de 2100 kcal e goal de formulário 700 | **4** para metas automáticas no MVP. Não transformar defaults pessoais em recomendação comercial |
| N11 | getMacroTargets / calculateHydrationGoal, :1684/1698 | Macros derivados de peso/atividade/défice, limites fixos; água por sexo/atividade; fallback 200/220/65 | **4** como prescrição automática. Eventuais metas futuras exigem autoria e revisão profissional próprias |
| N12 | PLAN_MEAL_SPLIT / buildMealPlan / buildSnackPlan, :1745/2019/2054 | Regras heurísticas de porções, alimentos habituais e restante do dia; sem plano publicado/autoria | **3** para planos profissionais versionados; não portar o gerador heurístico |
| N13 | getAISuggestions / addSuggestionToMeal, :3212/3262 | Ranking local de 15 sugestões estáticas, sem serviço/modelo de IA; quantidades de refeição tratadas como 100 unidades fictícias | **4** para recomendações no MVP; a designação AI não demonstra IA nem validação nutricional |
| N14 | saveAsTemplate / useTemplate, :3282/3304 | Cópia do dia, id Date.now, reaplica refeições com a data atual; sem idempotência | **2**: receita/modelo explícito de itens, revisão e confirmação; nunca marcar plano como consumido automaticamente |
| N15 | Água, :1809–1841 | Copos de 250ml em waterData[data], limitados à meta estimada; não retém eventos/autor | **2**: UI/ideia; novo registo em ml, sem teto de consumo derivado da meta |
| N16 | Hábitos/plano diário, :1844–1947 | Fruta, vegetais, escolha de alimentos e checkboxes guardados por dia | **2**: hábitos opcionais sem diagnóstico, política de edição/autoria; fora do primeiro diário se não necessários |
| N17 | Peso e medidas, :2243/2328/3350 | weightLog e bodyMeasurements por dia; substitui entrada do dia e atualiza peso; inclui cintura/anca/peito/braço/coxa | **2**, através da infraestrutura de avaliações já existente. Não criar outro histórico de medidas; ponte atual importa só peso/cintura |
| N18 | IMC/revisão semanal da meta, :1707/2252/3322 | Classificações e referência de peso; sugestões de ajuste de calorias pela tendência de duas semanas | **4** para classificação/prescrição automática. Não usar medições como autorização para interpretar clinicamente |
| N19 | Fotos corporais, :3416–3475 | FileReader/data URL, fotos em appData; cloud exclui fotos mas backup completo pode incluí-las | **4** no MVP de Nutrição: não transportar blobs, fotos ou criar Storage nesta fase |
| N20 | Diário/histórico/streak, :2397/2476/3501 | Filtro por dia, totais, edição, dias consecutivos, dashboard | **2**: experiência reaproveitável; datas por timezone, cobertura de registo e paginação novas |
| N21 | Gráficos, :2548/3643 | Chart.js, peso, barras kcal, donut de macros em gramas; ausência de registos aparece como zero | **2**: usar componentes AURA e tabela acessível; distinguir gramas de percentagem energética e dias não registados |
| N22 | Relatório semanal, :3611 | kcal médias /7, proteína /dias registados; diferença para meta chamada défice e projeção de peso | **3** para relatório descritivo com cobertura; **4** para transportar projeção de perda de peso |
| N23 | exportBackup / importBackup, :1583/1613 | Exporta app/version=2/data; importação valida basicamente nutritrackData.meals como array e substitui estado local | **2** para exportação seletiva/versionada futura; **4** para importação integral/substituição no SaaS. Nenhum importador alimentar é ativado nesta auditoria |
| N24 | getCloudPayload / reconcileCloudData, :1311/1374 | JSONB inteiro por user_id, upsert e escolha local/cloud; sem revisão por registo, tenant, idempotência ou resolução granular | **4**: não reutilizar sincronização/contas/base pessoal |
| N25 | Auth e eliminação, :1406/1537/1550; supabase-setup.sql:1/43 | Auth pessoal e tabela user_id com RLS própria; função de eliminação da conta | **4**: manter Auth/permissões/privacidade AURA; não copiar deleção automática/cascade para pedidos jurídicos |
| N26 | PWA/cache, sw.js:1–59 | App shell e cache genérico de GET, incluindo pedidos não distinguidos como sensíveis; fallback HTML | **4** para dados autenticados; eventual cache apenas estático exige desenho separado e testes logout/multiempresa |

## Modelos e validações efetivos

`appData` (:952) contém meals[], templates[], bodyPhotos[] e profile. O perfil (:979) inclui nome, sexo, idade, altura, peso, activity, goal, targetCalories e preferências alimentares. meals[] (:3094) guarda date UTC + time local, type/name/quantity e valores kcal/protein/carbs/fat já calculados. Não guarda food_id/composição original estável, unidades explícitas de cada base, autor, tenant, revisão ou chave idempotente. As linhas são alimentos, não um agregado de refeição com vários itens.

Chaves adicionais: waterData e planDailyData por dia; weightLog[]; bodyMeasurements[]; customFoods[]; recentFoods[]; flags darkMode/cloudLastSyncedAt/cloudLocalUpdatedAt. A cloud persiste o conjunto num payload JSONB por user_id. O browser tem dependência direta de DOM/localStorage, sem camada de domínio isolada para a maioria das operações.

Riscos confirmados no código, sem corrigir o projeto pessoal:

- **Quantidade negativa na criação:** registerMeal usa parseFloat(...) || 100 sem o limite da edição. Em função isolada com DOM sintético, -20g produziu -20 kcal para alimento de 100 kcal/100g.
- **Deriva de arredondamento na edição:** saveEditMeal reescala valores arredondados. Exemplo sintético 100g/101kcal/1g proteína → 50g → 100g resulta em 102kcal/2g proteína. Recalcular a partir do snapshot original resolve o requisito futuro, não o código pessoal nesta fase.
- **Unidades ambíguas:** lookupBarcode aceita fallback energy-kcal sem provar base 100g; serving_size é pedido mas não convertido. Valores ausentes são frequentemente convertidos em zero; produtos de zero kcal são excluídos por teste de truthiness. Não importar esse comportamento.
- **Datas:** getTodayKey (:1805) usa toISOString, enquanto horas e parte da navegação usam hora local. Precisam de um calendário da organização e distinção entre data registada e instante de criação.
- **Importação/sinks HTML:** importBackup tem validação superficial; selectFood (:3059) e templates (:3295) interpolam nomes em innerHTML sem escape nesse caminho, apesar de existir escapeHtml noutros. Há superfície insegura a evitar; exploração XSS completa não foi ensaiada.
- **Relatório:** (:3629) a diferença entre meta e consumo não é TDEE observado; projected multiplica novamente por 7 um valor já semanal. Ausência de registo não demonstra consumo zero. Não reutilizar a interpretação.
- **Cache/sincronização:** desenho pessoal não satisfaz multiempresa/revisões. O service worker não exclui explicitamente GET autenticado; risco de cache inadequado identificado, sem ensaio de fuga real entre contas.

A prova de quantidade/arredondamento executou apenas funções extraídas por AST numa VM sem require, fetch, storage ou aplicação pessoal, com stubs em memória. Evidência: `.aura-integration/stability-nutrition/verify-legacy.cjs` e `legacy-synthetic-findings.json`. Não é um teste end-to-end do NutriTrack.

## Limites e decisões

Não foram verificadas bases pessoais, comportamento cloud do NutriTrack, qualidade clínica dos valores, licença/autoria de cada alimento, precisão das fórmulas ou suporte real de scanner em dispositivos. As 120 declarações não são um dataset aprovado. A AURA só tem composição alimentar pura e ponte manual de medições nesta base; diário, catálogo, planos e nutrição nativa **ainda não existem** como módulos funcionais.

Permanecem os bloqueios altos de autenticação, sessões/JWT, recuperação cloud/conta/MFA e RGPD. Nenhuma classificação de reutilização autoriza migração de dados, nova ligação externa, prescrição, publicação ou piloto com dados reais.
