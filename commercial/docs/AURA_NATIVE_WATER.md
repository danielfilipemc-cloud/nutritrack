# Água nativa — candidato transacional local

Este incremento prepara a primeira extensão persistente da prioridade1 do roteiro. Não acrescenta outro ecrã fictício: implementa o contrato, SQL e adaptador da hidratação que faltavam às quatro RPCs alimentares18/19.

**Inativo.** SQL em supabase/prepared/20261028140720_nutrition_water_native.sql, criado com Supabase CLI e colocado fora de migrations/. Não está no instalador, não altera install.generated.sql, não faz parte do pacote congelado18/19 e não foi executado remotamente. A autorização anterior18/19 e o respetivo requisito de recuperação não incluem automaticamente este candidato.

## Contrato e semântica

- ComandoV1 com requestId, waterId, expectedRevision, operação save/void, entry e reason. Organização/aluno são argumentos separados; autoria vem de auth.uid(), nunca do payload.
- entry contém consumedOn (dia de negócio), time HH:mm ou null e quantity em ml inteiros entre1–5000 por declaração. Sem conversão de copos/litros/gramas, meta de água ou recomendação diária.
- Criar usa waterId:null, revisão0 e motivo:null. Corrigir exige a revisão esperada e motivo3–300 caracteres. Anular exige entry:null e preserva todos os valores anteriores; não apaga nem permite editar um registo já anulado.
- Hora desconhecida continua null. Não é fabricada uma hora de meia-noite. Totais diários de legado, zeros e importações mantêm contrato/origem próprios ainda pendentes; não os classificar como novas declarações manuais através deste endpoint.
- Histórico conserva versões e recordedBy, incluindo motivo de alteração. Recibo identifica a operação aceite, que pode ser anterior à revisão atual; consultar o histórico/diário para obter a projeção atual.

## Transações e leitura

Quatro tabelas novas: heads e versões públicas protegidas por RLS; recibos e eventos privados sem acesso direto. O candidato usa os helpers de autorização/sessão existentes, sem os substituir. Não concede competência, assignment ou acesso implícito ao aluno. Atualmente é um contrato de profissionais autorizados; a escrita do aluno autenticado é uma etapa separada.

As mutações reutilizam a serialização de sessão/organização existente, bloqueiam o request por organização/autor e a linha do registo ao corrigir, voltando a verificar autorização depois de esperar. O mesmo pedido canónico devolve o recibo anterior; conteúdo/aluno diferente com o mesmo request dá conflito. A revisão esperada impede perda de alterações. Head, versão, recibo e evento são escritos na mesma transação. Timeout de espera por lock evita espera indefinida; uma resposta incerta não autoriza repetição automática.

RPCs propostas:

- aura_nutrition_water_save
- aura_nutrition_water_request_status
- aura_nutrition_water_diary
- aura_nutrition_water_history

Diário e histórico são paginados em20 registos. Os cursores devolvidos devem ser reutilizados, não fabricados. O cursor de histórico é o devolvido pela página anterior, não um filtro de revisão arbitrário. As páginas de histórico são contíguas; o adaptador rejeita saltos entre revisões/páginas e páginas vazias antes de chegar à revisão1. O resumo diário é calculado sobre **todos os heads atuais do dia**, independentemente do cursor: activeCount, voidedCount e declaredMl. Sem declarações ativas, declaredMl é null, não consumo zero. Uma correção que mude o dia retira o valor do dia anterior; versões antigas não são somadas.

## Adaptador e falhas

nutrition-water-persistence.ts recebe o cliente Supabase partilhado e fixa organização/aluno. O consumidor deve fazer dispose na mudança de ator, organização ou aluno. Respostas antigas são rejeitadas, e não há novo login, storage de browser ou fallback para exemplos. Nenhuma página autenticada ou pública o importa neste incremento.

Comando recusado localmente não faz RPC. Falha de transporte/recibo inválido após uma mutação produz resultado incerto: consultar requestStatus com o mesmo request antes de tomar outra decisão. Sem retry automático. Permissões revogadas continuam a bloquear recibos; não se contorna a revogação para recuperar uma resposta.

## Provas e limites

Testes PGlite exercitam o SQL real do candidato e adaptador com fixtures, incluindo canonicalização, unidades/datas/motivos, CAS, replay, anulação, auditoria/rollback tardio, autorização, revogação, MFA, arquivo, paginação, totais e projeções malformadas.

scripts/nutrition-water-local.ts ensaia concorrência em PostgreSQL17.11 dentro de um contentor local descartável sem rede, rotulado aura.scope=native-water-local. Exige um contentor novo com o nome fixo aura-native-water-local e recusa outro destino. Inicializa uma base/roles exclusivamente fictícios. Verifica duas criações simultâneas do mesmo pedido, correções concorrentes e revogação enquanto uma correção espera pela linha. O bootstrap de auth.uid é sintético: **não prova GoTrue/PostgREST ou recuperação cloud**. Não trata um dump local como backup do staging.

A publicação deste código em staging não ativa o SQL. A demonstração continua a usar os eventos fictícios em memória. Receitas/planos persistentes, totais legados, escrita do aluno, UI autenticada, exportação e transição real continuam pendentes.

## Próximos contratos da prioridade1

1. Receitas: versões de ingredientes e composição, ownership, cópia para plano sem ligação mutável e idempotência.
2. Planos: rascunho/revisão, publicação/retirada, alternativas compostas e snapshots de publicação; nunca considerar template como consumo.
3. Origem de diário: refeições publicadas/receitas/declarações livres e totais legados tipados sem reescalar arredondamentos para100g.
4. Permissões do aluno, UI partilhada, ensaio com sessões fictícias reais e recuperação/exportação integrais.
5. Só então preparar pacote remoto concreto com baseline/checksums, revisão e recuperação verificada; manter produção/main e NutriTrack pessoal isolados.

Referências técnicas consultadas: Supabase Changelog28-10-2026, Database Functions e Row Level Security. O aviso TLS de12-10-2026 afeta APIs HTTPS a partir de10-11; não altera o contrato SQL e não justifica desativar verificação TLS.
