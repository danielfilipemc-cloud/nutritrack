# Recuperação operacional — procedimento preparado, ainda não ensaiado na cloud

## O que já foi demonstrado

O ensaio de 16/10 restaurou uma cópia lógica restrita a dados fictícios do staging cloud para um **Supabase local novo**, com 14 migrations e 14 identidades. Ver STAGING_RECOVERY_20261016.md. Verificou integridade, password original, identidade, leitura própria, isolamento e recusa de restauro num destino povoado. Não restabeleceu sessões, não ensaiou fatores MFA ou Storage, não mediu um RTO operacional e não prova PITR/reposição cloud. O staging já está em 17 migrations; a cópia histórica não representa o estado atual.

## Objetivos de aceitação propostos

| Componente | RPO alvo | RTO alvo | Situação |
| --- | --- | --- | --- |
| Banco + identidades Auth consistentes | 15 minutos | 4 horas até os testes de serviço passarem | Não medido/garantido; depende de plano, backup e procedimento do fornecedor |
| Configuração, migrations e artefacto de aplicação | Última alteração aprovada, sem alteração manual não registada | 1 hora, dentro das 4 horas do serviço | Inventário/procedimento abaixo; reposição cloud por ensaiar |
| Storage, se vier a existir | 24 horas | 8 horas, ou requisito superior do produto | Atualmente zero buckets/objetos no staging; não aplicável ao MVP atual |

Estes valores definem a proposta técnica para o ensaio, **não um SLA ou uma capacidade já entregue**. O responsável tem de aprovar perda aceitável, prazos, custos e operadores. Se o plano/procedimento não cumprir os alvos, rever arquitetura/backup/plano ou aprovar outros objetivos antes do piloto.

RPO medido = instante do incidente − instante do último snapshot/restauro consistente verificado. RTO medido = instante em que Auth, dados, permissões, configuração e frontend recuperados passam − início do incidente. Snapshot antigo, checks incompletos ou inexistência de incident timestamp não permitem declarar cumprimento.

## Inventário privado obrigatório

Guardar num cofre privado com controlo de acessos: projeto/região/versões, organização e operadores autorizados; referência e SHA256 dos arquivos; timestamp de consistência; migrations e checksums; revisão e build do frontend; política MFA por tenant; lista de buckets privados/policies se aplicável. Inventariar Auth (URLs, allowlist, provedores, SMTP, confirmação, política de password, JWT/refresh/sessões, MFA), chaves **por referência ao cofre**, Data API/schema exposto, funções/grants/RLS, rede e definições Render.

Não guardar credenciais, hashes de passwords, segredos TOTP, JWT secrets, SMTP credentials ou dados de alunos no Git, PR ou relatório público. O segredo/chave de um projeto nunca entra em `NEXT_PUBLIC_*`. As ferramentas atuais não exportam todas as configurações Auth; a sua inventariação/validação é uma tarefa explícita, não uma inferência do SQL.

## Ensaio autorizado exclusivamente sintético

1. Aprovar origem staging, IDs das fixtures, janela, custo/capacidade de um **novo destino cloud vazio**, operador e revisor. Nenhum novo recurso pago ou restauro em produção está autorizado por este documento. Os destinos protegidos `vfplbkfxipfictuwkkoe` e `maipjryehnllaifxhunf` ficam excluídos. Não reutilizar ou apagar staging/local já povoados.
2. Definir instante de incidente fictício. Gerar snapshot consistente permitido, com aplicação/Auth compatíveis e registry de 17 migrations; guardar manifesto, SHA256, tamanho, timestamps e controlo de acesso. Não exportar dados reais. Preferir mecanismos suportados pelo fornecedor para o método/plano escolhido; não assumir que dumps genéricos ou cópias de tabelas Auth são portáveis.
3. Provisionar destino novo e registar ID/região/versões. Confirmar vazio, limites e isolamento. Instalar schema canónico e carregar apenas o arquivo sintético aprovado, sem reescrever migrations aplicadas. Nenhum procedimento existente que fixa um destino **local** deve receber uma URL cloud para contornar a sua proteção.
4. Auth: preservar UUIDs/identidades e hashes de password com método suportado, mas **não ressuscitar sessões, refresh tokens, tokens de convite/recuperação ou JWT antigos**. Tratar fatores MFA e material de cifragem como problema próprio de portabilidade. Não copiar chaves de assinatura de produção para fazer tokens antigos funcionarem. Se for necessário reenrolamento, desenhar e ensaiar recuperação assistida, prova de identidade e revogação; nunca desativar MFA silenciosamente para obter um teste verde.
5. Repor a configuração inventariada no destino novo, usando somente URLs e provedores de teste. Desativar entregas reais e integrações externas durante o ensaio. Criar novas chaves do destino; só a chave publicável vai ao build de staging. Não alterar DNS/URLs/serviço de produção.
6. Banco: comparar contagens e fingerprints/projeções canónicas, UUIDs/relacionamentos, revisões/versões/origem NutriTrack, histórico de pedidos e políticas MFA, registry/checksums, índices, grants, RLS e funções. Verificar ausência de bypass em aliases históricos e permissões implícitas. Divergência tem de ser explicada, não compensada com alterações manuais sem registo.
7. Auth funcional: login com a **password original** de pelo menos duas identidades fictícias, mesmo UUID; TOTP real e exigência AAL2; AAL1 negado; recuperação de password/confirmacão em caixa controlada; logout e token anterior negado nas áreas protegidas; metadata sem autoridade. Uma password redefinida após restauro não prova recuperação do hash original.
8. Permissões: owner/admin sem acesso clínico implícito, coach atribuído, leitura sem escrita, sem atribuição, aluno com projeção publicada, outro tenant, revogado e anónimo. Repetir remoção de membro, atribuição e vínculo do aluno com o mesmo JWT. Validar índices/compatibilidade com PostgREST e UI real.
9. Storage, quando existir: copiar **objetos e metadados** de forma suportada, comparar checksums/contagens, privacidade dos buckets, políticas por tenant e upload/replacement. Ensaiar expiracão/negação de URLs assinadas e impedir objetos de outro tenant. Restore de Postgres sem objetos não recupera Storage. Atualmente não há objetos/buckets, não há logótipos por upload e o runtime local exclui o serviço Storage.
10. Apontar um frontend de ensaio ao destino novo, executar smoke/cabeçalhos, pesquisa/ficha, avaliações/correções, objetivos, agenda, ponte manual e fluxos de erro/MFA em desktop/mobile. Manter traces e screenshots desligados nas sessões com credenciais. Medir o instante de verificação do serviço e calcular RPO/RTO.
11. Revisor independente confronta logs/manifestações com resultados, regista desvios e aceita/rejeita. Repetir recusa de restauro num destino povoado sem o alterar. Só então discutir um plano separado de transição; nenhuma troca de produção se executa neste ensaio. Arquivos têm prazo de retenção/revisão definido pelo responsável, sem limpeza destrutiva automática.

## Evidência para aceitar o ensaio

Relatório privado: origem/destino e autorização, plano/método, timestamps UTC e relógios, snapshot/manifesto e hashes, revisão/migrations, resultados individuais e comandos não sensíveis usados, contas **por identificadores de teste**, diferenças e explicações, RPO/RTO calculados, operador e revisor. Relatório público: apenas resultados agregados e limitações.

Não aceitar “SQL importado”, “health 200”, “login após reset” ou uma checklist marcada manualmente como prova de restauro operacional completo. O ensaio atual cloud→local continua válido apenas no seu âmbito. O próximo gate é Auth/DB/MFA/configuração **cloud→cloud** com revisão e tempos medidos.
