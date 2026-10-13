# Equipa e convites — AURA Business

## Entregue
- /equipa: lista de profissionais, alteração de funções, remoção de acesso e convites.
- /convite: login/criação de conta, confirmação de email e aceitação explícita.
- Link para a equipa no painel principal. Interface mantém a identidade AURA.

## Permissões
| Operação | Owner | Admin | Coach |
| --- | --- | --- | --- |
| Consultar a equipa do próprio estabelecimento | Sim | Sim | Não |
| Convidar coach | Sim | Sim | Não |
| Convidar admin | Sim | Não | Não |
| Alterar admin/coach | Sim | Apenas coach → coach | Não |
| Remover coach | Sim | Sim | Não |
| Remover admin | Sim | Não | Não |
| Alterar/remover owner ou atribuir owner | Não | Não | Não |

Transferência de propriedade fica para um fluxo específico. Remover um profissional
retira a associação apenas a esse estabelecimento; não elimina a conta Supabase.

## Ciclo do convite
Owner/admin indica email e função; recebe link /convite#token para partilhar manualmente.
Não há envio automático de convite por email. O link é mostrado apenas na criação;
para reenviar, criar outro convite para o mesmo email (o anterior é revogado).
Admin não pode substituir ou revogar convite para admin criado pelo owner.
Validade fixa de 7 dias, utilização única, máximo de 50 criações/hora/estabelecimento.
Email normalizado e comparado ao email confirmado atual de auth.users, nunca metadata.
Convites de autores removidos/demovidos deixam de permitir acesso quando o autor perde
permissão para conceder aquela função. Aceitar nunca altera uma associação existente.

O destinatário pode iniciar sessão ou criar conta. Signup requer confirmação de email:
confirmar e voltar a abrir o link original. Criar conta não concede acesso à empresa.
Tokens são aleatórios e guardados apenas como SHA-256 no schema privado.
O fragmento do convite é removido da barra do browser depois de lido; não vai em pedidos
HTTP de página, logs de acesso nem cabeçalho Referer. Não é guardado em localStorage.
A confirmação Supabase continua a ser tratada pelo SDK; fragmentos Auth não são removidos
pela lógica do convite. Não copiar links com tokens para issues ou registos públicos.

## Base de dados
Migração gerada pela CLI em supabase/migrations/20261013175333_team_invitations.sql.
Aplicada ao projeto dedicado vfplbkfxipfictuwkkoe e registada no histórico SHA-256.
O instalador db:bundle passou a incluir as migrações adicionais sem editar as três originais.
Dois objetos privados: organization_invitations e team_events, ambos com RLS e sem
permissões diretas para anon/authenticated. Audit trail contém IDs, ações e timestamps.
Implementações privilegiadas no schema não exposto app_private; wrappers públicos
security invoker com EXECUTE exclusivamente authenticated. Sem chave secret no cliente.
Operações usam bloqueio por estabelecimento; aceitação também bloqueia o convite.

## Testes executados
- Oito testes locais passaram, incluindo cenários de hierarquia, email errado/não confirmado,
  validade, revogação, reenvio, uso único, perda de direitos do autor, hashes e audit trail.
- TypeScript e build passaram; rotas /equipa e /convite geradas.
- npm run test:team:api passou com quatro contas fictícias e JWT/PostgREST reais.
- Exatamente uma de duas aceitações simultâneas teve sucesso; a outra foi recusada.
- Alteração de função e remoção passaram; o mesmo JWT perdeu acesso imediatamente.
- Membership temporária removida, convites pendentes revogados, sessões encerradas.
- Histórico sintético de convites/eventos retido intencionalmente para auditoria/demo.

## Verificador Supabase
Duas INFO rls_enabled_no_policy em tabelas privadas: intencional, acesso direto negado.
WARN auth_leaked_password_protection: proteção de passwords comprometidas desativada.
Rever no Dashboard Auth. Ver documentação oficial:
https://supabase.com/docs/guides/auth/password-security#password-strength-and-leaked-password-protection

## Limites
Sem teste visual/browser nesta etapa, conforme preferência do responsável.
Fluxo de email real do signup e recuperação de password ainda não testados.
SMTP e entrega automática de convites ficam para uma fase seguinte.
Sem alteração de dados reais ou de NutriTrack original. Exclusivamente commercial/.
