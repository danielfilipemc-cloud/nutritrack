# NutriTrack — permissões locais para sincronização automática

Preparação offline autorizada pelo utilizador após o PR #63, em 25/10/2026. O projeto dedicado `vgbwmamntjmhzrpvhxzb` foi reativado por `restore_project` e confirmado `ACTIVE_HEALTHY`, apenas com metadados. Não foram consultadas contas, dados ou chaves, nem executado SQL remoto. A autorização não inclui migrations remotas. Produção, main, aplicação pessoal e configuração Auth permanecem isolados.

## Candidato sem ativação automática

Gerado com Supabase CLI 2.122.0: `supabase/local-validation/nutritrack-sync/20261025234116_nutritrack_sync_permissions.sql`. Está deliberadamente fora de `supabase/migrations/`: o instalador e a aplicação não o usam. Testes carregam-no explicitamente numa base descartável sobre as 19 fontes existentes. Nenhuma fonte histórica foi alterada; as 19 entradas locais não são prova da instalação cloud atual.

O incremento propõe duas tabelas privadas RLS, duas policies SELECT, três RPCs públicas invoker, oito funções privadas, um índice explícito e três triggers. Cinco funções privadas podem ser executadas por authenticated (dois predicados e três implementações verificadas); auxiliares de sessão/triggers não têm esse grant. Não há DML direto para anon/authenticated. SECURITY DEFINER fica no schema privado, com search_path vazio e verificações explícitas; só é usado para ler catálogos/identidades protegidas e executar os comandos restritos. As RPCs públicas não elevam privilégios por si próprias.

Um dos triggers é aditivo em `public.client_users`: invalida apenas links deste conector quando o vínculo muda ou é eliminado. É necessário para impedir que revogar/religar a MESMA identidade recupere consentimento anterior. Não substitui policies, funções ou configurações existentes. Não cria utilizadores, sessões, tabelas Auth, grants de competências, backfills ou dados alimentares.

## Decisões de acesso propostas

- Profissional: membership e atribuição atuais, competência profile e competência nutricional explícita. Administrador/owner não recebe acesso alimentar por papel genérico. Propor/publicar exige escrita; ler exige leitura. Aceitar consentimento em nome do aluno é recusado.
- Aluno: identidade confirmada, não anónima, sem suspensão/eliminação e vínculo atual ao aluno. Só essa conta pode aceitar âmbitos; identidade/aluno são derivados no SQL, não recebidos no corpo.
- Sessão: `session_id` deve corresponder a uma sessão existente do ator, com validade atual. A política MFA existente do estabelecimento continua a aplicar-se. Não se confia em user_metadata. Também se verifica o estado atual da conta-aluno quando o ator é profissional, sem exigir que o aluno esteja online.
- Âmbitos: nutrition-plan, nutrition-entry, measurement, sem duplicados/campos implícitos. Validade explicitamente escolhida, até 90 dias nesta proposta; não há renovação automática. Esta duração é uma política proposta, não um requisito comercial previamente aprovado.
- Direções: só profissional publica plano/revê declarações; só aluno submete diário/medições próprios. Medições para profissionais exigem também competência assessments independente, incluindo escrita para revisão. Isto não concede acesso às avaliações clínicas existentes nem converte declarações em avaliações.
- Revogação de consentimento: aluno, profissional com escrita nutricional ou gestor de acessos do estabelecimento podem retirar. O gestor pode conter a ligação sem ganhar acesso alimentar. Novo aceite exige ação explícita do aluno e revisão atual.
- Vínculo AURA: guarda-se a geração linked_at e uma marca terminal invalidated_at. Mudar/revogar/apagar o vínculo invalida os links antigos. Mesmo restaurar revoked_at sem mudar linked_at exige nova proposta e novo aceite. Identidades/consentimentos históricos não são reescritos; a marca terminal só transita de NULL para valor.
- Eliminar uma identidade Auth não fica bloqueado por FKs destes históricos: conservam-se IDs opacos, sem emails/nomes. A cascata do vínculo corta acesso dos dois lados. Retenção/eliminação desses identificadores continua a exigir política própria; não é uma declaração de conformidade RGPD.

Consentimento é concedido ao estabelecimento e seus profissionais atualmente autorizados, não exclusivamente ao autor da proposta. Um bloqueio temporário da conta suspende os predicados enquanto durar; não apaga consentimentos. Revogação do vínculo é diferente e terminal para os links existentes.

## Transações e limites da prova

Proposta e consentimento chamam `require_sensitive_session`, que na baseline adquire FOR UPDATE na organização antes de consultar a revisão. É o mesmo lock dos comandos existentes de atribuição/competência/revogação. O trigger de invalidação também usa esse lock. CAS recusa a revisão desatualizada; uma repetição após resposta perdida pode devolver PT409, sem duplicar. Estes comandos ainda não têm recibos por eventId: o futuro cliente deve obter contexto atual e resolver ambiguidades, sem renovar consentimento silenciosamente.

O predicado booleano `nutritrack_sync_allowed` é um primitivo de permissão atual, não um endpoint de transporte. O futuro adaptador deve comparar a consentVersion do envelope com a revisão atual, validar o protocolo #63, obter locks e revalidar sessão/acesso dentro da MESMA transação de snapshot+recibo. Não aceitar SyncAccess do browser. RLS/leituras têm semântica MVCC; revogação não retira respostas já entregues nem garante cancelamento retroativo de statements em curso.

PGlite usa Auth simulada para testes locais: não prova GoTrue/PostgREST, JWTs reais, concorrência entre processos ou operação remota. Um ensaio adicional em PostgreSQL 17.11, com processos psql independentes, confirmou um commit/um PT409 na corrida CAS, rollback após falha tardia de auditoria, negação após revogação do vínculo ou sessão enquanto o escritor aguardava o lock, re-vínculo sem herdar consentimento e delete Auth sem bloqueio. O container tinha rede desligada, sem portas/bind mounts, root filesystem read-only e dados apenas em tmpfs. Também aqui Auth é simulada: não equivale a GoTrue/PostgREST ou ensaio remoto. Não há UI autenticada, armazenamento de planos/diário ou sincronização automática efetiva nesta entrega.

## Manifesto e inspeção futura

`npx tsx scripts/nutritrack-sync-permissions-artifacts.ts --emit-sync-plan` gera apenas ficheiros locais em `docs/review/nutritrack-sync-permissions/`: manifesto SHA-256 e pre/postflight READ ONLY. Não usa rede, credenciais, db push ou SQL executor. O manifesto não é uma autorização de ativação.

O preflight exige correspondência exata das 19 entradas, ausência dos objetos candidatos e estrutura Auth necessária. Um estado real de 17, instalação parcial, entradas extra, hash diferente ou objetos inesperados implica STOP. Não assumir que a reativação instalou 18/19 ou qualquer objeto deste candidato. O postflight pressupõe uma futura entrada 20 registada por instalador revisto e inventaria RLS/grants/policies/triggers; PASS de registo não prova segurança completa, corpo atual das funções ou exposição do Data API.

Antes de qualquer ativação: confirmar novamente destino, inventariar os metadados reais permitidos, rever as dependências/definições e manter app_private fora dos schemas expostos; resolver qualquer divergência. Só depois rever o incremento concreto, fixtures exclusivamente inventadas e autorização aplicável para execução remota. Não executar os planos antigos, reaplicar baseline, inserir checksums manualmente ou confundir este candidato com o transporte completo.

## Reprodução local

- `npm run check` e `npm audit --audit-level=moderate`.
- `npx tsx --test tests/nutritrack-sync-permissions.test.ts tests/nutritrack-sync-permission-artifacts.test.ts`.
- `npx tsx scripts/nutritrack-sync-permissions-artifacts.ts --emit-sync-plan` e verificar que a geração não deixa diferenças.
- PostgreSQL independente, apenas num daemon Docker local verificado: instalar previamente a imagem oficial `postgres:17.11-alpine` e executar `AURA_SYNC_LOCAL_POSTGRES=1 npm run test:nutritrack-sync:local-security`. O runner nunca faz pull, ligações cloud, mounts de host ou abertura de portas; fixa o socket local e o image ID observado, valida a etiqueta antes de parar o seu próprio container e remove o ambiente descartável.

O revisor independente encontrou inicialmente a recuperação de consentimento após re-vínculo da mesma identidade. A versão inicial não é aprovada: a correção terminal e os testes de regressão acima são parte obrigatória deste candidato.
