# Nutrição nativa AURA — decisão de produto e primeiro incremento

Decisão explícita do responsável em 26-10-2026: o NutriTrack deixa de ser o produto de destino separado; as funcionalidades nutricionais passam a integrar o AURA. A experiência final terá a mesma identidade de aluno, sessão, ficha, agenda e acompanhamento. Não se pretende pedir ao aluno que mantenha duas aplicações ou duas contas.

## Entrega deste incremento

Apenas demonstração Premium em memória: o editor permite uma opção principal com 1–8 alimentos, quantidades individuais em gramas, composição durante edição e uma alternativa opcional que substitui **toda** a opção principal. A alternativa não é equivalente por presunção e não se soma ao plano.

Guardar, disponibilizar, registar na vista do aluno, rever e criar uma ação mantêm o mesmo circuito AURA. A publicação preserva snapshots de todos os alimentos; o diário copia os snapshots da publicação, nunca do rascunho atual. A seleção de outro aluno, navegação e edição de outro plano não transportam os rascunhos entre pessoas. Remover o último ingrediente adicional repõe o estado original do editor.

O catálogo desta demo contém oito exemplos inteiramente inventados. As cinco novas composições estão confinadas ao módulo de demonstração, não são dados provenientes do NutriTrack, nem um catálogo profissional validado. Valores desconhecidos continuam desconhecidos. Não existem metas automáticas, diagnóstico, prescrição ou interpretação de evolução.

O núcleo puro compartilhado de composição passou de um limite de 1000 para **1600 porções**, para suportar 200 registos com até oito alimentos sem crash, truncagem ou arredondamento intermédio. O máximo do numerador energético é 8×10^15, inferior a Number.MAX_SAFE_INTEGER; conserva os checks de inteiros seguros e arredonda só após a soma. Esta é a única alteração no código partilhado com os módulos autenticados; não muda schema, comandos, permissões ou acesso a dados.

## Aproveitamento do NutriTrack

O [inventário anterior](NUTRITRACK_NUTRITION_INVENTORY.md) e [mapa de reutilização](NUTRITION_REUSE_MAP.md) continuam como auditoria histórica. O cálculo de porções já adaptado ao AURA é reutilizado. Não incorporar o monólito, sessão pessoal, cache genérica, JSONB integral, estimativas clínicas automáticas ou dados alimentares sem proveniência.

O PR #64 recebeu aprovação independente **apenas offline** para o desenho de uma ponte entre duas contas. Não é dependência desta entrega e não foi integrado nem aplicado remotamente. A decisão de produto torna a sincronização de duas aplicações uma hipótese histórica; as ideias de consentimento, scopes, revisão e revogação poderão ser reaproveitadas após redesenho para o módulo nativo, sem impor um segundo login.

## Fases restantes e critérios de fecho

1. **Composição de refeições:** este incremento fecha o percurso composto na demo. Ainda não implementa receitas reutilizáveis, alternativas compostas ou registo livre do que foi efetivamente consumido.
2. **Biblioteca e diário nativos:** pesquisa de alimentos, receitas versionadas, porções explicitamente suportadas, registos independentes do plano e hidratação. Manter distinção entre planeado e declarado; não apresentar ausência como consumo zero. Validar fontes antes de qualquer catálogo real.
3. **Portal autenticado unificado:** mapear os comandos e permissões nutricionais AURA já preparados à mesma identidade do aluno; testar sessão, tenant, competência e assignment com Auth/PostgREST em ambiente isolado. Não reutilizar o login NutriTrack.
4. **Transição de dados:** inventariar formatos, mapear origens e versões, ensaiar importação seletiva idempotente de fixtures e provar backup/restauro. A migração de contas/dados existentes e a retirada do produto antigo dependem de uma etapa explícita posterior. Não apagar ou desligar a aplicação atual nesta fase.
5. **Auditoria de produto:** testes ponta a ponta, revisão independente, evidências visuais e publicação exclusivamente staging. Sem piloto real ou contactos profissionais nesta fase.

Este documento não autoriza migrations remotas, alterações Auth/RLS, utilização de dados reais, mudanças em main/produção ou no NutriTrack pessoal. O projeto Supabase de staging ter sido reativado não significa que o módulo persistente esteja instalado ou pronto.

## Incremento seguinte — biblioteca, receitas, diário livre e água

O desenvolvimento seguinte acrescenta pesquisa dos alimentos fictícios, receitas por aluno com versões imutáveis, cópia explícita para rascunho do plano/diário e declaração alimentar sem depender de uma publicação. Esses registos regressam à fila/revisão/ação existente, mas não marcam refeições planeadas como consumidas. A água usa eventos em ml, anulação com histórico e nenhuma meta automática.

Rascunhos de criação/edição de receitas, pesquisa, alimentação livre e água são mantidos por aluno entre áreas. A preparação de um plano a partir de receita recusa substituir um rascunho existente. Guardar receita, disponibilizar plano e declarar consumo são três ações distintas.

Todos continuam em memória, com oito composições inventadas; recarregar repõe os exemplos. Este incremento não é migração, persistência autenticada, catálogo real ou ativação de base remota. O [plano de transição](NUTRITRACK_NATIVE_MIGRATION_PLAN.md) fixa os restantes ensaios e a definição de migração completa.
