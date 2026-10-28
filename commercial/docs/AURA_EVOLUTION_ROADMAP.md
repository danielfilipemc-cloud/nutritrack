# AURA — plano de evolução e critérios de conclusão

Estado de referência: PR68 publicado exclusivamente em staging, 28-10-2026. Produção, main e NutriTrack pessoal mantidos isolados. Sem contactos com profissionais ou piloto com dados reais nesta fase.

## Direção de produto

Um produto AURA para estabelecimento, equipa e aluno: avaliações, treino, nutrição, agenda e acompanhamento com a mesma identidade. NutriTrack passa a módulo nativo, não a segunda aplicação sincronizada. Demonstração fictícia e operação autenticada são estados diferentes.

EliteTrainer e HubFit anunciam treino, nutrição, hábitos, progresso e marca. HubFit também anuncia colaboração multidisciplinar, permissões, revisão de check-ins e automação. Nenhum desses itens isolados é exclusividade demonstrada do AURA. A hipótese inicial é servir pequenos estúdios portugueses com treinador/nutricionista e reduzir trabalho e erros nos percursos completos. Ainda não é uma vantagem comercial validada.

## Fases por dependência

| Fase | Resultado utilizável | Critério de conclusão |
|---|---|---|
| 1. Nutrição nativa | Plano/receitas/diário/água na identidade AURA | Contratos persistentes completos, sessão e permissões corretas, concorrência/replay, histórico, exportação e recuperação provados com contas fictícias; sem segundo login |
| 2. Treino profissional | Preparar, disponibilizar, executar e rever uma sessão | Biblioteca com origem e uso permitido dos vídeos, séries e formatos suportados, rascunhos/retoma, histórico e retorno à mesma ficha validados em mobile |
| 3. Continuidade da equipa | Converter registos em revisão e próxima ação | Cada evento pertence ao aluno/profissional/estabelecimento certo; revisão, autoria, atribuição e revogação testadas; sem duplicar tarefas nem perder versões |
| 4. Operação do estúdio | Marcações e acompanhamento ligados à equipa | Reservar, alterar e cancelar com conflitos e capacidade corretos; contrato de grupo próprio se implementado; não confundir agenda de demonstração com serviço operacional |
| 5. Auditoria de prontidão | Base consistente para decidir piloto | Jornadas integrais, recuperação/exportação, acessibilidade, mobile, segurança e revisão independente; lacunas e limites declarados; decisão explícita antes de dados reais |

As fases não autorizam migrações remotas adicionais ou passagem automática a produção. A autorização específica de18/19 no staging mantém o requisito de backup e recuperação verificada. Essa ativação e a migração real continuam pendentes.

## Incrementos pequenos dentro da fase1

- Já publicados: refeições compostas, alternativas explícitas, receitas versionadas, diário livre, água, correção/anulação de refeições livres, revisão e histórico sintéticos; ensaio offline de migração e adaptador autenticado inativo.
- Incremento atual: lista de compras a partir de snapshots do plano disponibilizado, escolhas explícitas por refeição e número declarado de dias iguais. É planeamento de compras, não consumo, nova prescrição ou persistência real.
- Pendentes: persistência nativa para planos/receitas/água/totais legados, UI autenticada, permissões do aluno e reconciliação completa. Não considerar esses itens concluídos por acrescentar uma vista calculada à demo.

## Regra para integrar cada incremento

Branch/PR isolado sobre integration/aura-staging, CI completo, testes de domínio proporcionais ao risco, Chromium/WebKit e diferentes larguras, isolamento fictício/profissional, capturas antes/depois e revisão independente. Corrigir achados antes de integrar. Após aprovação, publicar apenas no staging e confirmar o percurso online. Preservar a dashboard Premium e referências protegidas; confirmar PR40–44 antes da integração.

## Avaliação comparativa por tarefas

Comparar: primeira avaliação→plano→primeiro registo→revisão; corrigir um registo sem perder histórico; trocar o profissional e revogar acesso; alterar/cancelar marcação. Registar passos, erros, perdas de contexto e tempo apenas quando medidos em condições equivalentes. Não inventar resultados, ratings ou ganhos de produtividade do AURA.

A lista de funcionalidades concorrentes serve de referência, não de backlog automático. IA, rankings, comunidades, wearables, POS e app própria nas lojas não passam à frente dos percursos essenciais por aparecerem num concorrente.

## Referências públicas consultadas em28-10-2026

- https://elitetrainer.fit/elitetrainer/appaluno/
- https://elitetrainer.fit/elitetrainer/preco/
- https://hubfit.com/platform/coaching
- https://hubfit.com/platform/scale
- https://hubfit.com/solutions/gyms-and-studios
- https://hubfit.com/pricing

Fontes descrevem a oferta pública. Não equivalem a teste de conta, auditoria de backend ou prova de disponibilidade de todos os planos. Auditorias completas e evidências internas são mantidas fora do código do produto.
