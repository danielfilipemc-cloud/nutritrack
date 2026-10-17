# Estado de integração — 16/10/2026

## Remediação — 17/10/2026

Código candidato em `fix/aura-security-audit`, sobre `1848582` (PRs #8–#16 integrados na referência). Migrations incrementais 15–17 instaladas no sandbox principal e no staging, sem editar as catorze anteriores ou alterar produção. Corrigem projeções de privacidade, acrescentam revisão auditável e exigência MFA/AAL2 por organização para leituras dos alunos e comandos sensíveis. Ver [remediação e critérios de piloto](AUDIT_REMEDIATION_20261017.md), [Auth ainda pendente](AUTH_STAGING_CONFIGURATION.md) e [recuperação operacional](RECOVERY_OPERATIONS.md).

71 testes, TypeScript/build, 65 Chromium por contrato, três Chromium com Auth local real e oito grupos Auth/PostgREST/MFA em cada ambiente aprovados. O catálogo instalado com 17 migrations não tem tabelas sem RLS, RPC públicas privilegiadas/anon, aliases históricos executáveis por authenticated ou grants diretos privados. Continuam abertos: leaked passwords, JWT cloud 3600s, allowlist e fluxo completo de recuperação e ensaio operacional cloud. **Sem autorização para piloto com dados reais.**

Este é o checkpoint de validação anterior à publicação do candidato de frontend. Não deduzir publicação a partir desta branch ou da contagem SQL; confirmar SHA/estado do PR e do deploy Render. Os checkpoints abaixo são históricos.

## Estado efetivo após consolidação

PRs #9–#14 integrados, pela ordem das dependências, em `saas-foundation` (`deea349103ddf7462d254efc35b26d9e87c5967f`). O diff dessa revisão contra `78dd98b` é vazio: os merges preservaram exatamente a árvore validada. `main` não foi alterada. Os checkpoints abaixo descrevem o estado anterior à integração.

Staging separado: https://aura-business-staging.onrender.com, serviço `srv-db9al5ajnfac73bivqr0`, branch `integration/aura-staging`, plano free e auto-deploy desligado. Primeira publicação validada em `78dd98b`; Supabase dedicado `vgbwmamntjmhzrpvhxzb`, 14 migrations. Três fluxos Chromium com login cloud real aprovados (profissional, aluno e gestor); smoke de dez rotas e vinte assets aprovado. Produção continua no serviço anterior, sem nova publicação ou migration. Ver ONLINE_STAGING.md para configuração e limites; INDEPENDENT_AUDIT_BRIEF.md prepara a revisão externa.

Checkpoint atual: ponte NutriTrack efetiva em `feat/aura-nutritrack-bridge`, dependente de #13. Catorze migrations no staging e sandbox local, Auth/JWT/PostgREST cloud aprovado e recuperação lógica sintética num destino local novo demonstrada. Ver NUTRITRACK_BRIDGE.md, STAGING_RECOVERY_20261016.md e validation/nutritrack-staging-20261016.log. Produção mantém #8; não houve merge/deploy. Checkpoints seguintes são históricos.

Checkpoint mais recente: painel diário no PR #12, dependente de #11, e evolução integrada na branch `feat/aura-integrated-evolution`, dependente do painel. Ver DAILY_WORKSPACE.md, INTEGRATED_EVOLUTION.md e validation/daily-evolution-local-20261016.log. Treze migrations no sandbox local, onze no staging cloud independente e oito no baseline publicado. As contagens e branches abaixo são checkpoints anteriores, não evidência de publicação dos novos blocos. Gates Auth/recuperação cloud continuam abertos.

Este documento distingue código remoto, validação local e publicação. Substitui as indicações históricas de que ainda não existe Supabase local ou de que a Fase 2 não pode começar com dados fictícios.

## Revisões confirmadas

| Branch | Revisão de entrada | Estado |
| --- | --- | --- |
| `saas-foundation` | `543e3a0` | PR #8 integrado; baseline publicado anteriormente. Não alterado nesta consolidação. |
| `feat/aura-foundations` | `ee203a1` | PR #9 em draft, sobre `saas-foundation`. Consolidação e validação isolada. |
| `feat/aura-student-360` | `8641081` | PR #10 em draft, sobre as fundações; evolução da ficha existente e preview sintético já implementados. |

As revisões foram confirmadas com `git ls-remote`; não se deduziu publicação a partir do checkout. Não foi feita nova publicação, alteração Auth cloud, migration cloud ou merge em `saas-foundation`/`main`.

## Evidências desta retoma

- Na revisão `8641081`: 45/45 testes de domínio/PostgreSQL, TypeScript e build aprovados. Regressão Chromium completa: 32/32, numa única execução, com fixtures e servidor local. Não são testes contra produção.
- Supabase local real: 16/16 grupos Auth/JWT/PostgREST aprovados novamente. Incluem dois tenants, competência **e** atribuição, ausência de acesso clínico implícito por owner/admin, projeções do aluno, concorrência HTTP409 e revogação com JWT inalterado.
- Auth local: 6/6 grupos novamente aprovados, incluindo metadata sem autoridade, schema privado, TOTP/AAL2, refresh/logout e recuperação de password no Mailpit. O runner aceita `--repeat`, preservando o relatório anterior e criando evidência e contas sintéticas com UUID novo.
- Contagens SQL locais confirmadas: principal com dez migrations, controlo restaurado com oito. Nenhuma migration foi aplicada nesta retoma. Os ficheiros históricos não foram editados.
- Docker em WSL `AURA-Dev`: APIs, bancos e Mailpit publicados exclusivamente em `127.0.0.1`; motor sem endpoint TCP. O runtime precisa de uma sessão WSL ativa. Uma primeira tentativa Auth durante o arranque falhou; a execução com o serviço disponível passou integralmente.
- Configuração/credenciais/IDs ficam no diretório ignorado `.aura-integration`; não publicar dumps, tokens ou mensagens de recuperação.
- O controlo restaurado foi novamente consultado: ambas as identidades iniciam sessão, mantêm isolamento e preservam a avaliação fictícia. Auditoria npm: zero vulnerabilidades reportadas. Não se executou um novo restauro destrutivo.

Ao mudar entre branches com rotas diferentes, executar `npm run build` antes de `npm run typecheck`: os tipos em `.next` podem referir rotas da branch anterior. Na verificação separada das fundações, os 41 testes passaram e essa referência de cache foi encontrada no TypeScript; o build regenera os artefactos. Não alterar páginas ou permissões para contornar tipos gerados obsoletos.

## Integração segura

1. Rever PR #9 e respetivo CI. O gate local permite revisão de integração; não autoriza ligar o frontend novo ao Supabase de produção com schema de oito migrations.
2. Conservar as oito migrations históricas e os hashes das duas seguintes. Não executar backfill genérico de permissões: competências e atribuições sensíveis são explícitas.
3. Manter PR #10 dependente de #9; incorporar a consolidação das fundações antes de repetir a regressão final. Não recriar ficha, acompanhamento ou agenda do PR #8.
4. Para futura publicação, preparar um destino cloud separado com restauro verificado, configurar Auth, repetir a matriz real e obter autorização específica. Código, schema e permissões devem avançar coordenadamente. Preferir correção incremental a rollback destrutivo.

## Limites e prioridades

O helper final foi agora ensaiado num terceiro Supabase local novo/vazio (`rehearsal`, API 59321): restauro transacional com normalização ACL, fingerprints e login/isolamento/preservação passaram sem ajustes manuais posteriores. Nenhum banco existente foi apagado. Ver [ensaio completo](LOCAL_VALIDATION.md). Isto não equivale a recuperação operacional cloud ou de Storage.

Logout impede refresh, mas um access JWT pode sobreviver até 900s. MFA foi ensaiado, não imposto globalmente. Decisões de sessões, base jurídica, retenção, direitos completos, recuperação cloud e revisão independente permanecem antes de dados reais.

Aluno 360º: evolução, avaliações, acompanhamento e agenda partilham a ficha e os controlos existentes. Nutrição, treino e comunicação não estão completos. A integração NutriTrack deve preservar identidade composta estabelecimento/aluno, origem/unidades das medições, funções puras alimentares e competências próprias. Não importar o script global, storage pessoal ou sincronização legada. Não existe migração automática de dados pessoais.
