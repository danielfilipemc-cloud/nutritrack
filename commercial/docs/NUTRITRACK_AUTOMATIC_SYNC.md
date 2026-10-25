# NutriTrack no AURA — sincronização automática entre contas

Objetivo confirmado pelo utilizador em 25/10/2026: automática, não troca de ficheiros. Esta fase prepara o protocolo e a referência executável local. **Não há sincronização remota ativa.** O módulo não está importado pela demonstração anónima nem expõe uma rota HTTP.

## Percurso pretendido

O profissional AURA disponibiliza uma versão alimentar; o aluno recebe-a no NutriTrack integrado no portal `/aluno` existente. Os registos do aluno regressam à mesma ficha para revisão. Usar o vínculo profissional/aluno AURA e as sessões existentes evita criar uma segunda sessão pessoal ou ligar a base pessoal do NutriTrack. A aplicação pessoal, produção e `main` permanecem isolados.

A experiência pode atualizar automaticamente os dados autorizados ao abrir/retomar o portal, com pedidos por cursor, retry e recibo. Não exige que o utilizador exporte ficheiros. A tecnologia de atualização em tempo real é uma decisão posterior; uma subscrição nunca substitui autorização na leitura/escrita.

## O que foi entregue neste incremento

`lib/nutritrack-sync.ts` é um núcleo puro, independente de UI, rede, storage pessoal e credenciais. Define DTOs estritos e um reducer de referência em memória:

- plano disponibilizado/retirado: apenas AURA → NutriTrack;
- diário alimentar e medições: apenas NutriTrack → AURA, com revisão profissional pendente;
- vínculo opaco explícito, organização/aluno/conta, consentimento versionado, âmbito e validade;
- IDs de evento e registo estáveis, versões de origem em sequência, snapshots imutáveis e recibos com digest;
- repetição exata depois de uma resposta perdida sem duplicar; mesmo ID com outro conteúdo recusado;
- revisão fora de ordem, correção local, vínculo revogado/expirado ou âmbito diferente bloqueiam o evento;
- composição por 100 g e porções em g através dos contratos existentes; `null` desconhecido e zero explícito preservados;
- referência de um evento novo a um plano só é aceite se essa for a versão atualmente publicada no mesmo vínculo e período;
- perfil, fotos, notas privadas, tokens, autoria/tenant fornecidos no corpo e backups integrais não pertencem ao contrato.

Uma retirada/substituição do plano bloqueia eventos novos que ainda refiram a versão anterior, incluindo backlog sem recibo. É necessária resolução explícita: nunca remover a referência ou trocar de versão silenciosamente. Um retry exato de um evento já aceite continua a confirmar o recibo/histórico original, sem reaplicar dados, desde que o vínculo, consentimento e acesso permaneçam válidos. A revogação do vínculo bloqueia também esse retry. Retirada de plano e revogação de consentimento são estados distintos.

O tipo SyncAccess **não é uma prova de autenticação**. É input de um futuro adaptador servidor, derivado a cada operação de sessão viva, membership, atribuição, competência, vínculo e política MFA. Nunca o aceitar do browser. O reducer não é um banco transacional e não prova isolamento perante concorrência de múltiplos processos. O adaptador persistente terá de revalidar acesso/consentimento e gravar snapshot + recibo dentro da mesma transação bloqueada. Nenhuma rota pode ser exposta com o reducer em memória como substituto desses controlos.

O backup pessoal v2 não tem IDs/revisões alimentares estáveis nem composição original por 100 g preservada em cada lançamento. Não reconstruir essa composição a partir de totais arredondados e não transformar esse backup num fluxo automático. A captura nativa futura de registos deve usar o contrato novo; um eventual histórico antigo exige importação assistida/revisão própria.

## Estado observado e bloqueio remoto

Consulta apenas de metadados em 25/10/2026: projeto Supabase `vgbwmamntjmhzrpvhxzb`, nome `aura-business-staging`, estado **INACTIVE**. Nenhuma tabela, refeição, conta ou segredo foi consultado. Não reativámos o projeto nem executámos SQL. O estado atual das migrations 18/19 e do catálogo remoto não foi confirmado; documentação histórica não é prova do estado presente.

O Render de staging continua independente e a demonstração em memória pode evoluir sem esse Supabase. As migrations nutricionais 18/19 preparadas e o seu plano histórico estão em `NUTRITION_STAGING_ACTIVATION_PLAN.md`. Não foram reaplicadas, editadas ou ativadas neste incremento.

## Próxima ativação, concreta e separada

1. Autorizar a reativação apenas do projeto de staging acima e o trabalho nas permissões/tabelas novas de nutrição e conector. Esta autorização não inclui produção, `main`, dados reais ou a base pessoal NutriTrack.
2. Com o projeto disponível, verificar somente metadados: identidade do destino, registo/hash das migrations e catálogo de RLS/grants. Parar perante divergências. Não presumir baseline17 ou instalação19.
3. Rever as fontes existentes 18/19 e preparar o incremento aditivo para versões de plano, acesso próprio do aluno, consentimento/recibos e comandos de publicação/retirada/submissão. Não conceder competência nutricional por papel genérico, nem usar uma service key no cliente. Não reaproveitar os grants de avaliações como autorização alimentar.
4. Implementar o adaptador persistente e a UI NutriTrack no `/aluno`, com acesso derivado no servidor. Planos profissionais e declarações do aluno têm autoria e revisão distintas. Revogação tem efeito na próxima operação, incluindo retries e resultados pendentes.
5. Ensaiar localmente com Auth/PostgREST e contas fictícias: dois estabelecimentos, dois alunos, leitura alheia, token antigo, revogação antes do commit, conflito, resposta perdida e recuperação. Gerar o manifesto/checksums concretos da ativação para revisão antes de SQL remoto.
6. Depois da autorização aplicável e revisão positiva, ativar só nesse staging e executar os mesmos percursos entre contas fictícias. Só declarar ligação automática concluída quando publicação, receção pelo aluno e retorno à ficha forem provados nesse ambiente.

As restrições anteriores do utilizador dizem não alterar Auth/RLS nem executar migrations remotas. O pedido de sincronização automática define o objetivo, mas esta entrega não presume que tenha revogado esses limites específicos. Por isso, a ativação permanece separada da publicação da biblioteca de treino e da aprovação do núcleo local.
