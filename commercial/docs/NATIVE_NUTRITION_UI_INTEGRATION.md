# Integração nativa — primeiro incremento da interface persistente

Base: PR #80. Alterações exclusivamente em commercial/, sem merge/deploy, SQL ou configuração remotos. Não constitui integração total concluída nem migração de dados pessoais. NutriTrack original, main, contratos alimentares V1 e migrations aplicadas permanecem preservados.

## Funcionalidade implementada

A secção Nutrição da ficha existente pode usar o cliente Supabase partilhado e o adaptador P3/P4: diário por dia, paginação, criação/correção/anulação de refeições manuais, snapshots por100g, histórico inicial de20 versões e consulta de recibos. Zero informado e composição desconhecida são distintos. Não soma páginas incompletas como consumo diário completo. Nenhuma prescrição/recomendação automática ou sincronização.

O modo é opt-in **de build**: NEXT_PUBLIC_AURA_NATIVE_NUTRITION=1. Por omissão conserva a demonstração anterior. Não é ativado por URL ou storage; não autoriza acesso por si. Com o modo ligado, RPC ausente/acesso negado é erro explícito, sem fallback para dados inventados. Não ativar esse build remotamente só porque passou em mocks.

Competência nutricional própria, ator e organização filtrados e assignment/sessão continuam impostos pelo SQL. Não há escrita direta em tabelas nem concessão implícita a owner/admin. A UI só oferece escrita após leitura autorizada e competência can_write. Profissionais sem escrita consultam; o aluno ainda não recebe esta interface/contrato de profissional. Comandos não incluem actorId. O adaptador é descartado ao mudar contexto; respostas antigas não são aplicadas.

Rascunhos mantêm-se em memória no mesmo contexto, com guard de navegação e pendência integrado na ficha. Conflito/negação limpa listagens e impede nova escrita até reler, preservando o rascunho. Resultado incerto mantém o requestId e bloqueia outra gravação; consulta recibo sem retry automático. Um recibo ausente não prova rollback. A UX de resolução/abandono operacional de pedidos sem recibo continua uma limitação a rever antes de ativação.

Correção confirmada no adaptador: acknowledgement malformado depois de save agora é **uncertain**, não rejeição confirmada. Teste prova que não dispara outra escrita. A projeção dos itens para o calculador retira metadados label/source, respeitando o contrato estrito de porções; os primeiros testes de UI encontraram e corrigiram esse erro.

## Testes e CI

`npm run test:e2e` sem argumentos executa o build nativo com alvo fictício, a suite opt-in, repõe o build normal fictício e executa a suite anterior. Reutiliza o workflow existente, sem alterações fora de commercial/. Recusa live/Auth flags; runners Auth/staging separados mantêm-se. Com argumentos, conserva a execução focada anterior; nesse caso a suite nativa tem de ser invocada separadamente.

Execução focada: build com flag1 e as variáveis públicas fictícias habituais; `npx playwright test --config playwright.nutrition.config.cjs`. A suite normal omite estes testes quando o modo está desligado. Nenhuma destas fixtures prova GoTrue/PostgREST real com o schema nutricional instalado.

Casos: gravação/releitura de snapshot, composição desconhecida, leitura sem escrita, RPC ausente sem demo, acknowledgement perdido/recibo sem duplicação e rascunho mobile. Testes do adaptador continuam a exercitar SQL PGlite real, revogação e histórico. Lint/TypeScript/build/audit e resultados finais são registados no PR.

## Sequência restante para integração total

1. Completar edição/paginação de todo o histórico, revalidação de atribuição em cenários E2E e resolução operacional dos resultados incertos. Acrescentar gestão verificável de competências nutricionais à equipa, sem auto-grants.
2. Ligar água, receitas e planos aos adaptadores já preparados, com editores/publicação/retirada e snapshots, sem alterar os contratos em silêncio. Os SQL de água/documentos continuam fora do instalador.
3. Criar contratos próprios de leitura do aluno/publicações e de declaração/correção pelo aluno, com vínculo vivo e privacidade. O SQL atual de profissionais não permite obtê-los passando um parâmetro role=student. Validar localmente antes de qualquer proposta remota.
4. Preparar um sandbox Auth/PostgREST com upgrade incremental e recuperação verificada, mantendo a base local de17 migrations preservada. Executar concorrência, idempotência, MFA, revogação e isolamento reais; não reclassificar mocks/PGlite como esses ensaios.
5. Catálogo com proveniência/licença e versões, totais legados sem conversões inventadas, favoritos/perfil/campos não suportados, exportação completa e reconciliação. O catálogo fictício não se torna catálogo profissional por ativar a persistência.
6. Revisão independente do pacote exato de ativação, checksums/efeitos/rollback sem apagar histórico e autorização específica para staging. Só depois ponderar transição autorizada de dados/contas selecionados; não copiar DB, passwords ou sessões pessoais.

Mantêm-se abertos os bloqueios altos de passwords comprometidas, sessões/JWT, recuperação cloud, perda total de MFA e RGPD. Não há autorização de piloto com dados reais, custos, produção ou retirada do NutriTrack pessoal.
