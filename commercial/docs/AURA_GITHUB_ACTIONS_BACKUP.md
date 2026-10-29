# Staging — preparar backup privado no GitHub Actions

Este procedimento evita instalar PostgreSQL no Windows. O workflow está preparado mas não é executado pelo PR nem pela publicação do staging. Cria um backup cifrado; **não executa migrations nem comprova recuperação**. Ler o catálogo com pg_restore --list não equivale a restaurar.

## Destino fixo e âmbito

- Repositório: danielfilipemc-cloud/nutritrack (público).
- Projeto: aura-business-staging, vgbwmamntjmhzrpvhxzb.
- Workflow: `.github/workflows/aura-staging-backup.yml`.
- Única branch operacional: `ops/aura-staging-backup`. main, integração, PRs e forks não disparam o backup.
- Só exporta a base e metadados de roles, usando PostgreSQL17 e TLS verificado. Não existe parâmetro para apontar à produção.
- Publica apenas `aura-staging-private-backup.tar.gpg` e SHA256 do ficheiro cifrado; o arquivo legível permanece temporariamente no runner e é removido. Retenção do artifact:7dias. Mesmo cifrado, deve ser tratado como privado.

## O que o titular precisa de configurar uma vez

1. Abrir [Settings → Environments](https://github.com/danielfilipemc-cloud/nutritrack/settings/environments). Criar exatamente **aura-staging-backup**. É necessário acesso de administrador ao repositório.
2. Em Deployment branches and tags, selecionar **Selected branches and tags** e permitir apenas a branch **ops/aura-staging-backup**. Não selecionar “Protected branches only”, porque pode incluir main ou excluir a branch operacional pretendida.
3. Configurar Required reviewers com uma pessoa autorizada para rever a execução. Se fores o único titular e o iniciador, a opção Prevent self-review não pode impedir a tua própria aprovação. Não disponibilizar secrets a outros workflows por conveniência. Se o plano/permissões não oferecer estas proteções, parar e rever a configuração antes de executar; não contornar com secrets globais.
4. Nesse environment, criar os dois **Environment secrets**:

| Nome exato | Conteúdo |
|---|---|
| AURA_STAGING_DB_PASSWORD | Palavra-passe da base PostgreSQL do projeto vgbwmamntjmhzrpvhxzb, obtida no projeto correto. Não é password da conta Supabase, publishable key ou service_role. |
| AURA_BACKUP_PASSPHRASE | Segredo diferente, aleatório, com pelo menos32caracteres, criado/guardado no teu gestor de passwords. É necessário para decifrar o backup; GitHub não o devolve depois de guardar. |

Não enviar nenhum segredo no chat, issue, commit, screenshot ou formulário de workflow. Não resetar a password da base apenas para testar: isso pode afetar consumidores existentes e precisa de plano próprio.

5. Criar a **Environment variable** `AURA_BACKUP_APPROVED_SHA` com o SHA completo de40caracteres do commit revisto que será colocado na branch operacional. Depois da integração, usar o merge commit deste PR em integration/aura-staging, confirmado na página do PR/entrega. Não usar apenas o nome da branch ou o SHA de um commit diferente. A execução recusa divergências.
6. Confirmar que Actions está permitido em [Settings → Actions → General](https://github.com/danielfilipemc-cloud/nutritrack/settings/actions), incluindo as actions GitHub oficiais fixadas no workflow. Este procedimento não autoriza comprar minutos ou alterar planos automaticamente. O runner tem de conseguir alcançar o session pooler; se houver restrições de rede no Supabase, não abrir acesso global para contornar um erro.

Podes enviar apenas “environment configurado”, sem valores. Com a autorização de backup já existente, o agente pode criar a branch operacional no SHA aprovado e acompanhar a execução. Não precisas de correr comandos no Windows.

## Como iniciar e acompanhar

Não criar a branch operacional antes de confirmar o environment, proteções, secrets e SHA. Uma branch com um workflow que refere um environment inexistente pode criá-lo sem as proteções pretendidas.

O agente cria/põe **ops/aura-staging-backup** exatamente no commit aprovado. O push dispara a execução; se a criação da ref não produzir um run, inspecionar o evento antes de tentar outra forma. Não editar o workflow para “forçar” execução: muda o SHA e exige nova revisão/configuração. Em [Actions](https://github.com/danielfilipemc-cloud/nutritrack/actions), abrir **AURA staging private backup**, verificar branch/SHA e aprovar o environment quando solicitado.

O workflow usa push numa branch isolada porque workflow_dispatch exige que o workflow exista na branch por omissão, que neste repositório é main. Não é necessário alterar main para este procedimento. Para repetir o mesmo código, usar **Re-run jobs** no run aprovado e voltar a validar o SHA. Não repetir automaticamente falhas de autenticação/rede; inspecionar primeiro.

Fases visíveis: imagem fixada, ligação/versão, dump, roles sem passwords, catálogo e cifragem. Erros brutos não são impressos porque os logs deste repositório são públicos. Uma falha não publica um backup parcial nem executa SQL remoto de instalação.

O diagnóstico usa apenas códigos fixos: BACKUP_DB_SECRET_INVALID/BACKUP_KEY_INVALID para formato dos segredos; DB_AUTH_FAILED para autenticação; DB_POOLER_ROUTING_FAILED para encaminhamento do tenant; DB_TLS_FAILED para certificados; DB_DNS_FAILED/DB_NETWORK_FAILED para rede. Uma causa desconhecida permanece genérica. Não imprime erros brutos, valores ou comprimentos dos segredos e não repete a ligação automaticamente. Um código de autenticação não autoriza trocar endpoints, abrir rede ou desligar TLS.

O cliente inclui o certificado CA público oficial SupabaseRoot2021, com SHA256 fixado e proveniência em `commercial/scripts/certificates/README.md`, num bundle temporário junto dos certificados do sistema. O PostgreSQL recebe esse bundle read-only e mantém verify-full, incluindo hostname. O teste CI separado verifica um handshake TLS do pooler fixo, sem passwords, autenticação ou SQL. Não equivale a backup ou recuperação. Atualizações do certificado exigem revisão; não há download ou alteração de confiança automática em runtime.

## Depois de terminar

1. Descarregar o artifact cifrado do run aprovado e guardá-lo num local privado antes dos7dias de retenção. Guardar a passphrase no gestor de passwords, separada do ficheiro. Não anexar o backup a este repositório público.
2. Verificar SHA256 do ficheiro cifrado. Um job verde significa **backup criado e catálogo legível**, não recuperação concluída.
3. O agente prepara a etapa de restauro integral num destino descartável compatível com Supabase/PostgreSQL17. Os dumps incluem objetos internos: não os restaurar com `--clean` no staging nem eliminar objetos que falhem para conseguir um resultado verde. A etapa automática de restauro ainda não faz parte deste workflow.
4. Confirmar schema/roles/ownership/ACL/policies/triggers, histórico de migrations e contagens/conteúdo da aplicação. Ensaiar o pacote de ativação no destino recuperado, verificar falha/retorno e as sessões fictícias reais separadamente. Só depois pode ser satisfeita a condição de recuperação do pacote18/19.

## Limites importantes da cópia

O pg_dump usa um snapshot consistente da base; os metadados de roles vêm de uma segunda operação. Realizar a cópia numa janela sem alterações administrativas de roles/esquema. Passwords de roles não são exportadas. Configuração Auth, SMTP, chaves e Edge Functions não são reconstruídas por este dump.

Objetos binários do Storage precisam de cópia separada. Na inspeção de metadados do staging foram encontradas extensões plpgsql, pgcrypto, uuid-ossp, pg_stat_statements e supabase_vault; isso não confirma se há segredos Vault ou ficheiros. Validar a recuperação desses elementos em separado, sem os publicar. Não assumir que uma base PostgreSQL genérica repõe toda a plataforma.

Testes deste incremento usam dumps sintéticos para guardas/cifragem/limpeza e GPG real para roundtrip. Não houve exportação remota. A falta de credenciais/rede neste ambiente permanece; um runner GitHub é uma via proposta e tem de passar a sua própria verificação de conectividade.

Referências oficiais: [Backups Supabase](https://supabase.com/docs/guides/platform/backups), [Backup/restauro](https://supabase.com/docs/guides/platform/migrating-within-supabase/backup-restore), [Environments GitHub](https://docs.github.com/en/actions/how-tos/deploy/configure-and-manage-deployments/manage-environments).
