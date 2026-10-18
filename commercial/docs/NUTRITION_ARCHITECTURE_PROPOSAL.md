# Nutrição integrada no Aluno 360º — proposta para revisão

Estado: **desenho, não implementação**. Base `6823fe0`. Não cria tabelas, grants, competências, páginas operacionais, migrações, uploads, fornecedores ativos ou sincronização. [Inventário](NUTRITRACK_NUTRITION_INVENTORY.md) · [reutilização](NUTRITION_REUSE_MAP.md) · [PRs propostos](NUTRITION_IMPLEMENTATION_PLAN.md).

## Limite do primeiro produto

O primeiro incremento útil deve ser **diário alimentar descritivo**, composição/porções, hidratação registada e resumo da cobertura de registo. O cálculo de nutrientes de um alimento não representa diagnóstico, avaliação de adequação ou prescrição. Metas energéticas, planos personalizados, interpretação clínica, alergias/condições clínicas, recomendações automáticas e alterações por tendência de peso ficam fora desse incremento.

Medições físicas continuam em assessments/StudentEvolution, com competência assessments e proveniência atual. Não copiar altura/peso/cintura para um segundo histórico nutricional nem preencher medidas históricas com valores atuais. Uma eventual referência a uma avaliação deve apontar para id/revisão e ser consultada apenas se o ator tiver autorização independente em avaliações. Acesso a Nutrição não concede acesso a medições, e o inverso também não.

Planos/metas posteriores exigem decisão do responsável sobre profissionais habilitados, finalidade, retenção e jurisdição, com revisão jurídica/profissional. Uma competência técnica ou o papel owner/admin **não equivale a habilitação profissional**. Esta proposta não fornece um parecer jurídico ou validação clínica e não recomenda metas/porções a pessoas reais.

## Páginas e navegação

Estender a ficha atual, não criar outra aplicação ou duplicar AssessmentWorkspace. Proposta de URL compatível com o padrão existente: `/alunos/[id]?org=[org]&section=nutrition&nutritionTab=[tab]`. A nova secção e os separadores só ficam disponíveis após o futuro contrato de permissões e revisão. Os parâmetros não concedem autorização.

| Área | Conteúdo profissional | Fluxo do aluno na área existente |
|---|---|---|
| Resumo de Nutrição | Último dia registado, dias com/sem registo, totais conhecidos e indicação de incompletude; sem score clínico | `/aluno?area=nutrition&tab=summary`: só dados próprios |
| Diário por data | Refeições/itens, origem e autor, composição consultável, correção por revisão | Registar/refazer apenas consumo próprio autorizado; distinguir registo próprio de lançamento profissional |
| Alimentos | Pesquisa do catálogo publicado da organização; detalhe por 100g e porção com origem/versão | Escolher apenas alimentos disponibilizados; não ler receitas/notas privadas da equipa |
| Hidratação | Eventos em ml, dia e correções; meta opcional só em fase própria | Registar ml, corrigir os próprios eventos permitidos |
| Histórico e resumo | Período, cobertura, totais e tabela alternativa; paginação | A mesma leitura filtrada ao aluno, sem dados de outros alunos |
| Planos/metas — fase posterior | Rascunhos, revisão, autoria, publicação e retirada explícitas | Só versão publicada atribuída; consultar um plano não o transforma em consumo |

O catálogo é de organização, mas começa como subpágina partilhada da secção, sem forçar uma nona entrada global na sidebar. Reutilizar ProfessionalShell, ProfileNavigation, seletores, breadcrumbs, tokens Dark Premium e componentes de formulário/estado. O portal do aluno evolui no `/aluno` existente, sem uma segunda sessão ou conta NutriTrack.

## Fluxos

**Profissional:** selecionar estabelecimento/aluno → confirmar competências/atribuição em resposta atual → consultar diário → escolher alimento/versão e gramas → pré-visualizar nutrientes conhecidos → confirmar gravação → receber id/revisão → ver cronologia mínima. Corrigir cria nova versão/evento, não reescala totais arredondados nem apaga silenciosamente a observação anterior. Um rascunho não muda a organização sem confirmação; resultado incerto conserva rascunho e permite consultar a chave idempotente antes de repetir.

**Aluno:** entrar na conta AURA → escolher vínculo ativo caso haja vários → escolher dia/refeição → selecionar composição publicada → indicar consumo → confirmar → consultar/corrigir dentro da política aprovada. user_id/autor/vínculo são determinados no servidor. O aluno não pode escrever como profissional, mudar client_id, publicar alimentos da equipa ou consultar notas internas.

**Catálogo:** profissional autorizado propõe alimento com base/unidade/fontes → validação estrutural e revisão → publicação de versão. Uma mudança de composição não altera diários anteriores. Não converter nomes iguais em identidade e não assumir ml=g. O primeiro catálogo usa só fixtures inventadas; valores legados ou de fornecedor exigem curadoria e direitos demonstrados.

**Planos futuros:** rascunho versionado por profissional com competência própria e habilitação verificada → revisão do conteúdo → publicação explícita com política de sessão/AAL2 → aluno consulta versão atribuída → retirada mantém histórico. Copiar uma opção de plano para diário exige confirmação de consumo e request_id; é uma operação distinta de prescrever/publicar.

## Contratos de dados propostos

Os nomes são propostas de contrato, **não SQL instalado**. Reavaliar antes de qualquer migration. Toda a relação de negócio carrega organization_id; todas as relações a aluno usam FK composta com `(client_id, organization_id)`. UUIDs não substituem RLS.

| Entidade | Dados mínimos e invariantes |
|---|---|
| nutrition_foods / food_versions | id, organization_id, versão imutável, nome, estado draft/published/withdrawn, base 100g, energia kcal e macros g, cada valor conhecido ou null, forma/preparação quando conhecida, origem/manual/provider, source_ref, licença/atribuição, autor/data. Alimentos retirados continuam referenciáveis em histórico |
| nutrition_meals | id, organization_id, client_id, consumed_on (data local escolhida), optional consumed_at (instante), meal_kind, actor derivado, origem student_self/professional_entry, revision, estado active/voided, timestamps do servidor |
| nutrition_meal_items | organization_id, meal_id, item_id, food_id + versão, grams, snapshot mínimo de composição/nome/origem; FK composta entre meal/item/food garante mesmo tenant. Totais recompostos no servidor, não aceites do browser |
| nutrition_daily_status | organização/aluno/data, cobertura self_reported_complete ou partial, autor/revisão. Dia sem registo ≠ ingestão zero; marcação de cobertura não prova exatidão do autorrelato |
| nutrition_water_events | id, organização/aluno, ml, consumed_on/at, autor, revisão/anulação. Quantidade registada separada de qualquer meta; sem bloquear consumo por ter atingido meta |
| nutrition_mutations, privada | tenant/aluno/actor/request_id, digest normalizado, resultado mínimo e revisão. Mesmo request_id + conteúdo repetido devolve o mesmo resultado; conteúdo diferente não é aceite |
| nutrition_events, privada | ação, ator, entidade/id/revisão e instante; sem cópia de nomes, texto de diário, credenciais ou composição inteira em cada evento |
| nutrition_plans / plan_versions, posterior | tenant/aluno, autor, estado draft/published/withdrawn, conteúdo mínimo versionado e vigência. Referência à habilitação/verificação em contexto privado; publicação não modifica diário ou medições |

Refeições e itens gravam atomicamente; o snapshot identifica a base usada. O sistema não deve guardar apenas os totais do dia num JSONB pessoal. Itens de receitas futuras precisam de versão e cálculo próprio; receitas não são falsamente alimentos por 100g sem definir rendimento/peso.

### Envelope de comando v1, ainda não implementado

```ts
type NutritionMealCommand = {
  contractVersion: 1;
  organizationId: string; clientId: string;
  requestId: string; mealId: string | null; expectedRevision: number;
  consumedOn: string; // YYYY-MM-DD no calendário da organização
  mealKind: 'breakfast' | 'lunch' | 'dinner' | 'snack' | 'other';
  items: {foodId: string; foodVersion: number; grams: number}[];
};
// Autor, tenant efetivo, fonte e composição são validados/derivados no servidor.
type NutritionResult = {id: string; revision: number; requestId: string};
```

Revisão esperada divergente → conflito sem sobrescrita, conservando rascunho. Rede interrompida após commit → estado incerto e consulta autenticada por request_id; não criar outra refeição. Retenção do ledger idempotente deve cobrir o intervalo de repetição aprovado; não guardar indefinidamente sem finalidade definida.

### Validação e unidades

- Primeira base de composição: **100g**, kcal/100g e g/100g. Gramas da porção são distintas da porção recomendada. ml só é convertível em massa com densidade explícita e fonte; água usa ml diretamente.
- Rejeitar tipos inesperados, NaN/Infinity, negativos, datas inválidas, ids/tenant divergentes e conteúdo excedente. Proposta inicial a rever: 1–50 itens por refeição; `0 < grams <= 5000`, até três casas decimais; evento água 1–5000ml. Estes limites são técnicos, não recomendações de consumo.
- Composição: energia 0–1000 kcal/100g e cada macro 0–100 g/100g como limites estruturais propostos; confirmar casos/unidades antes de os fixar no servidor. Zero conhecido é válido; desconhecido é null. Não transformar desconhecido em zero nem exigir igualdade exata entre kcal e 4/4/9.
- Somar componentes conhecidos e devolver contagem de valores em falta; total parcial tem rótulo explícito. Recalcular a partir do snapshot sem arredondamento precoce; decimal no banco, arredondamento documentado só na apresentação. O helper atual é útil para composição completamente conhecida, mas não cobre null/decimal persistente; ampliar por contrato sem mudar silenciosamente a sua API.
- Registo observado não aceita data futura por defeito; planos futuros são outro domínio. consumed_on usa calendário da organização; created_at é instante do servidor. Não inferir um dia pessoal passado de uma hora UTC atual.

## Competências e autorização

Atualmente staff_capabilities e aura_capability_save só aceitam profile/assessments/followup/schedule (`20261014180741_student_identity_permissions.sql:3/79`). Nutrição não pode ser ativada só com CSS/TypeScript: exige **incremento aditivo futuro** das allowlists e dos contratos de servidor, com revisão e autorização específica de migrations. Não editar a migration aplicada ou conceder competência a todos os coaches/owners.

| Ator | Diário do aluno | Catálogo | Planos/publicação |
|---|---|---|---|
| Anónimo/utilizador sem vínculo | Negado | Negado no módulo privado | Negado |
| Owner/admin sem competência nutricional | Gestão de acesso; sem leitura implícita do diário | Gestão apenas se competência própria | Sem leitura/publicação implícitas |
| Profissional atribuído + nutrition_diary read | Consulta desse aluno | Só leitura da seleção publicada necessária | Não ganha planos nem avaliações |
| Profissional atribuído + nutrition_diary write | Registo/correção auditável conforme política | Não publica catálogo por ser autor de diário | Não ganha prescrição/publicação |
| nutrition_catalog read/write na organização | Catálogo publicado / rascunho próprio conforme ação | Versão/publicação controladas | Não dá acesso ao aluno |
| nutrition_plans + ação explícita nutrition_publish, posterior | Sem acesso implícito a medições ou diário | Só composições autorizadas | Draft/write e publish separados; habilitação e sessão/AAL2 necessárias |
| Aluno com client_users ativo | Próprios dados, correções limitadas a registos próprios; lançamentos profissionais seguem fluxo de revisão | Seleção explicitamente disponibilizada, sem notas/receitas internas | Apenas versões publicadas atribuídas |
| Vínculo/competência/atribuição revogados | Negado pelo banco, incluindo JWT antigo | Conforme revogação do catálogo | Negado conforme ação/vínculo |

Os nomes nutrition_diary/nutrition_catalog/nutrition_plans/nutrition_publish são propostas de competências, não grants existentes. Exportação requer acesso efetivo ao módulo, finalidade/escopo e fluxo de privacidade apropriado, não apenas membership ou um botão da UI. Rever o modelo de can_write para a ação publish antes da implementação, evitando um sistema paralelo de permissões.

RLS em todas as tabelas expostas, grants mínimos e USING/WITH CHECK para escrita, sem autorização em user_metadata ou claims de competências desatualizadas. Reusar membership, assignment e client_users **ao vivo** no banco e a política sensível de sessão/AAL2 existente, sem desligar MFA. Escritas compostas via RPCs aprovados, sem grants diretos amplos; implementações privilegiadas apenas privadas, search_path fixo e identidade/autorização verificadas. Não expor funções históricas como atalhos.

Bloqueios e verificação de autorização devem ser desenhados na mesma transação, com ordem consistente. Testar revogação que termina antes da gravação e dois writers concorrentes; não prometer cancelamento retroativo de uma transação já concluída. Índices candidatos: (organization_id, client_id, consumed_on, id), FKs de itens/versões e chaves de acesso/idempotência. Medir EXPLAIN com dados sintéticos antes de afirmar desempenho.

## Privacidade, operação e limites

Sem notas clínicas livres, fotos, anexos, alergias/diagnósticos ou recolha desnecessária de idade/sexo no primeiro diário. Reusar identidade AURA e os pedidos auditáveis de privacidade; nenhuma eliminação definitiva automática. Definir responsável, finalidade, base jurídica, retenção de diário/auditoria/idempotência, acesso do profissional e regra para menores antes de dados reais; decisões continuam pendentes, não resolvidas por esta proposta.

Scopes user/org/client para respostas antigas, guards de rascunho/Voltar/reload/logout e resultado incerto; dados em memória, sem cache genérico de GET autenticado ou localStorage alimentar. Sem workers, subscrições, serviços pagos ou fornecedor externo novo. Logs mínimos e sem refeições/nomes/ficheiros/sessões; exportação seletiva, minimizada e auditada.

O MVP proposto é nativo na AURA e não requer ligar a base pessoal NutriTrack. A ponte de peso/cintura mantém o seu contrato. Uma futura importação alimentar manual só poderá nascer em contrato separado de schema/proveniência/idempotência, com pré-visualização e autorização; sincronização automática fica excluída.

Aceitação exige testes de domínio/unidades/nulls/datas, transações/RLS/grants, Auth real isolado autorizado e E2E de conflitos/atrasos/revogação/teclado/mobile. O [plano de PRs](NUTRITION_IMPLEMENTATION_PLAN.md) contém os gates. Nenhum plano está autorizado para dados reais; os bloqueios altos existentes e as limitações de acessibilidade/browser continuam abertos.
