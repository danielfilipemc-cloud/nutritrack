# Receitas e planos nativos — candidato persistente inativo

O SQL em `supabase/prepared/20261028160819_nutrition_documents_native.sql` foi criado com a CLI e retirado de migrations/. Não integra o instalador, o pacote18/19 ou a ativação autorizada anteriormente. Nenhuma página importa o adaptador novo. Publicar o código em staging não ativa estas RPCs.

## Contrato e ciclo de vida

Receitas e planos pertencem a um aluno e estabelecimento. São preparados por profissionais com competência nutricional e atribuição existentes; não há competência implícita para owner/admin ou escrita do aluno. Não é ainda uma biblioteca partilhada do estabelecimento.

- Uma receita contém título, nota opcional e1–8 ingredientes manuais com quantidade em gramas e composição por100g. Valores desconhecidos continuam null. Não aceita receitas aninhadas, totais legados, fotografias ou conversões implícitas de porções.
- Um plano contém título, nota opcional e1–12 refeições identificadas. Cada refeição tem hora HH:mm ou desconhecida, prato principal e0–3 alternativas identificadas. Alternativas são escolhas distintas, não alimentos a somar ao principal.
- Um prato aceita ingredientes manuais ou referência explícita à publicação atual de uma receita do mesmo aluno. O servidor verifica a referência e copia a receita para um snapshot; o cliente não pode fornecer esse snapshot. Quantidades são copiadas exatamente, sem pressupor rendimento, dose ou reescala.
- `save` cria uma versão draft; editar um documento publicado conserva a publicação anterior disponível. `publish` copia exatamente o rascunho corrente para nova versão publicada, sem aceitar conteúdo substituto no mesmo comando. Há no máximo um plano disponível por aluno.
- `withdraw` retira a publicação disponível, com motivo, e mantém o histórico. Se existir rascunho pendente, conserva-o na versão anterior do histórico e cria a versão withdrawn com o conteúdo da última publicação. Não publica o rascunho para conseguir retirar o plano.
- Depois de retirada, uma nova edição explícita pode criar outro rascunho. Nunca se apagam versões. A publicação de outro plano exige retirar primeiro o anterior.

O snapshot de receita fica fixo ao guardar o rascunho. Atualizar/retirar a receita posteriormente não modifica planos ou rascunhos existentes, nem recalcula a publicação. Publicar é uma ação profissional explícita sobre esse rascunho histórico. Uma nova captura exige a publicação de receita atualmente disponível.

## Persistência e falhas

Heads públicos e versões imutáveis têm RLS de leitura nutricional existente. Recibos e eventos ficam privados. Nenhum acesso anónimo, DML direto de authenticated, substituição de helper/policy existente ou alteração Auth/RLS global. As funções de autoridade ficam em app_private com search_path vazio e grants explícitos; wrappers públicos SECURITY INVOKER.

Comandos usam requestId, identidade do documento, kind imutável e revisão esperada. Ator vem da sessão, organização/aluno são argumentos separados. Canonicalização TS/SQL preserva os mesmos valores e trim de espaços ASCII, incluindo labels Unicode. Pedido repetido devolve o recibo original, mesmo depois de editar a receita de origem; payload/contexto diferente conflita. Requests, versão, head e evento são atómicos. Controlo de revisão evita alterações perdidas e há revalidação de acesso após esperas de locks.

O adaptador recebe o cliente partilhado e fixa o contexto. O consumidor futuro deve descartá-lo ao mudar ator/aluno/estabelecimento. Não repete mutações incertas; consulta o recibo. RPC ausente não produz fallback para demo. Listagem20+cursor distingue current/published; histórico20+cursor é contíguo, sem aceitar saltos ou vazio prematuro.

## Provas e trabalho restante

Testes sintéticos SQL/PGlite e adaptador cobrem publicação, retirada com rascunho, snapshots, alternativas, duplicação/conflitos, aluno/tenant/ator, revogação/MFA/arquivo, rollback e paginação. O ensaio PostgreSQL17.11 sem rede exercita pedidos concorrentes, correções em disputa e revogação durante espera do head. auth.uid é simulada; não prova GoTrue/PostgREST/cloud.

Faltam: UI autenticada e permissões do aluno, diário ligado a publicações/receitas, totais legados e outros destinos de migração, catálogo com proveniência, exportação/reconciliação integrais e ensaio Auth real. Não há transferência de dados reais nem retirada do NutriTrack anterior. A recuperação do staging continua independente; ver [GitHub Actions — backup privado](AURA_GITHUB_ACTIONS_BACKUP.md).
