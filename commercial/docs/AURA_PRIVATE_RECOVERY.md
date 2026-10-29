# Restauro privado do backup staging — procedimento por executar

Este incremento prepara um ensaio do backup real já criado; não conclui a migração do NutriTrack. Não altera a aplicação publicada nem executa SQL remoto. O resultado do ensaio só existe quando a execução protegida terminar com as verificações positivas.

## Origem imutável

- Projeto staging: `vgbwmamntjmhzrpvhxzb`.
- Run de backup: `40930304863`, artifact: `12932542971`.
- Código da cópia: `a72b72db0d903e35e025f5bef2ba11584ba6a919`.
- SHA256 do ciphertext: `d38fc10b5147af9e18121a513c1cad47dad6918cbe0f88d66fbf56bbb363a70a`.
- Artifact expira em **05/11/2026 às21:03:49UTC**. Não recriar silenciosamente outro backup se expirar ou diferir. A cópia privada cifrada preservada pode ser usada num procedimento futuro, com nova revisão e fixação da origem.

O workflow `aura-staging-recovery.yml` aceita apenas push em `ops/aura-staging-backup` com marcador `[recovery-only]`, SHA exato aprovado em `AURA_BACKUP_APPROVED_SHA` e a revisão do environment `aura-staging-backup`. A execução de backup habitual ignora esse marcador; o ensaio não gera outra exportação nem precisa da password da base. Não alterar as proteções para evitar a aprovação do titular.

Ao integrar o PR operacional, o **título do merge commit tem de incluir `[recovery-only]`**. Confirmar depois que o run elegível se chama `AURA staging private recovery rehearsal`, com o SHA integrado, e que o backup habitual ficou skipped. Um merge sem esse marcador seleciona a tarefa errada; não aprovar uma nova exportação por engano nem substituir o artifact congelado.

## O que é verificado

O download fixa run/artifact e o script confirma os dois nomes e o hash cifrado. A chave existente entra por stdin do GPG, não por argumento ou log. O tar só aceita quatro ficheiros regulares, sem duplicados, links ou caminhos; o manifesto fixa projeto, versão17, código, imagem original e hashes interiores.

O destino é um **novo container** no socket Docker local, sem rede, portas, volumes persistentes ou bind mounts, root read-only e dados em tmpfs. A imagem oficial Supabase17.11 amd64 está fixada no digest `sha256:5a213ad5fa0885bade074ce9c2835970a5ed59a813fb9019550041736d1bb85b`, verificado no manifest oficial de `public.ecr.aws/supabase/postgres:17.11.0.011`. Usa initdb vazio, não executa o bootstrap normal da plataforma. Um operador de ensaio com nome reservado permite restaurar as roles de origem sem remover/filtrar declarações desse ficheiro. A origem não pode conter essa role.

Restaura roles sem passwords e o arquivo **completo**, numa transação pg_restore com exit-on-error, sem `--clean`, `--no-owner`, `--no-acl`, filtros de schema/objetos ou tolerância a erros. O schema public vazio de initdb só é removido se o TOC do arquivo contiver uma entrada que o recria. Nunca se apagam objetos recuperados para passar.

Depois converte os segmentos schema/data do arquivo original para SQL e compara-os com novas exportações do destino. Só comentários gerados de topo, linhas vazias de topo e guardas aleatórias psql são normalizados; SQL, owners, ACL, RLS, policies, triggers, índices, funções, COPY e valores de sequências permanecem na comparação. O lexer preserva strings SQL simples/E escapadas, identificadores quoted, comentários de bloco, corpos dollar-quoted e dados COPY. Também compara a exportação de roles globais sem passwords; a única diferença permitida é a criação/atributos do operador adicional de ensaio. Divergências bloqueiam o teste; não se deve ampliar exclusões apenas para obter verde. Exige os17nomes/checksums exatos de `staging-recovery-baseline.json` e ausência de objetos/buckets Storage e segredos Vault: se existirem, a recuperação externa precisa de um plano separado.

Todos os comandos privados ficam em logs temporários. A saída pública contém apenas fases, resultado e códigos constantes. Remove o container criado e a pasta privada ao sair. A execução não publica novos artifacts, dumps, hashes de dados Auth ou ficheiros legíveis. O artifact original permanece cifrado; a passphrase continua separada.

## Limites e próximos gates

Um PASS prova recuperação lógica do arquivo de base de dados no destino offline compatível, com roundtrip schema/data. Não prova cloud→cloud, login original, recuperação de sessões/MFA, funcionamento de GoTrue/PostgREST, SMTP, config/Edge Functions, RPO/RTO operacional ou desativação segura do NutriTrack. Roles não incluem passwords; a operação de roles e o dump têm snapshots separados. Não ressuscitar sessões ou copiar chaves para fazer testes passarem.

O ensaio sintético CI usa a mesma imagem fixada e verifica restauro real, recusa de destino povoado e deteção de alteração de dados. O modo `--portable` usa a imagem PG17 já disponível no executor e não comprova extensões Supabase. O executor local usa Docker vfs e não conseguiu materializar a imagem completa por limite de espaço; por isso a compatibilidade tem de passar no runner CI antes de aprovar a execução privada.

Mesmo após PASS: revisão independente do resultado, preflight atual do destino e delimitação dos gates de Auth/configuração, ensaio local da ativação e postflight são necessários. O pacote18/19 autorizado anteriormente cobre apenas competências e refeições manuais. Água/receitas/planos preparados, UI autenticada, permissões/projeção do aluno, importação seletiva, reconciliação e retirada da aplicação antiga continuam fases próprias. Produção/main/NutriTrack pessoal permanecem isolados.

Referências: [backup/restauro Supabase](https://supabase.com/docs/guides/platform/migrating-within-supabase/backup-restore), [imagem oficial](https://github.com/supabase/postgres/blob/17.11.0.011/Dockerfile-17), [Actions environments](https://docs.github.com/en/actions/how-tos/deploy/configure-and-manage-deployments/manage-environments).
