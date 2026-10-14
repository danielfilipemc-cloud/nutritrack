# Fases 1A / 1B — fundações

## Decisões

Organization continua a ser o tenant. Não se acrescentou uma tabela global de pessoas ou identidade partilhada entre estúdios. `client_users` liga uma conta Auth a uma ficha por organização; não concede membership profissional. Um user pode ter vínculos independentes em tenants diferentes.

`staff_capabilities` concede leitura ou leitura/escrita nas áreas profile, assessments, followup, schedule. `client_assignments` restringe o aluno. Competência sem atribuição, ou atribuição sem competência, não concede acesso ao acompanhamento. A competência configura permissões técnicas; não certifica habilitação profissional. Só owner pode conceder/remover competências; owner/admin podem atribuir profissionais e gerir acesso do aluno.

Owner/admin têm gestão operacional de ficha e agenda. **Não têm acesso implícito a medições ou objetivos.** Precisam de competência explícita e atribuição, inclusive quando o próprio owner presta acompanhamento. O owner pode configurar a sua competência e atribuição explicitamente, com registo de auditoria.

Não há backfill em massa de permissões sensíveis. As memberships existentes continuam válidas, mas o acompanhamento sensível começa sem grants novos. Antes de cutover, o responsável deve rever e provisionar as atribuições/competências pretendidas. O NutriTrack permanece intacto e não é usado para sincronizar dados.

## Fase 1A

Migration `20261014180741_student_identity_permissions.sql`:

- Tabelas public.staff_capabilities, client_assignments, client_users; RLS e grants explícitos.
- Convites de aluno privados com hash SHA-256, validade 7 dias, email confirmado, uso único, revogação e reenvio que invalida links anteriores. Sem envio automático de email.
- Unicidade de uma identidade do aluno por tenant/ficha. Um convite não substitui a ligação de uma conta diferente.
- Guards de autorização nas RPCs existentes de cliente/acompanhamento/agenda/histórico. A lógica anterior de versões/locks é preservada em funções privadas históricas, sem EXECUTE para browser.
- Políticas de leitura por competência/aluno; aluno consulta a própria ficha/agenda autorizada, mas não lê assessments diretamente.
- Private foundation_events regista IDs/ação/hora/actor, sem copiar medições, objetivos, passwords ou emails.
- RLS também em aura_migrations, mantendo ausência de grants para o browser.

UI: `/acessos` acessível pela gestão de Equipa; competências, atribuições e convites pessoais. `/convite?aluno=1#TOKEN` aceita o tipo de convite do aluno. `/aluno` é uma área mínima própria, não a Fase 2/Aluno 360 completo. A ficha profissional adapta módulos/ações às permissões reais retornadas pelo banco.

## Fase 1B — controlos técnicos implementados

Migration `20261014180744_privacy_integrity_recovery.sql`:

- Avaliações com revision, publicação explícita e correção por novo registo. Original preservado, cadeia de supersedes com FK do tenant e motivo privado. Conflitos PT409; correção exige nova partilha.
- RPC assessment_create valida bounds/precisão antes de converter tipos NUMERIC. Autor/hora vêm do banco. Escrita direta nas colunas de assessments foi revogada; não existe parâmetro note no novo comando. Notas antigas preservadas, restritas a profissionais com acesso a assessments, nunca na projeção do aluno.
- Datas de novas medições entre 2000-01-01 e dia atual Lisboa; sem datas futuras. Dados antigos não são apagados/reescritos. Dashboard/care usam a mesma data civil, mesmo numa transação longa.
- Projection student_assessments só devolve medições publicadas, atuais, próprias. Sem notas, autores, motivos ou versões internas.
- Exportação visible_export contém os registos acessíveis, sem limite de 25 e sem notas. **Não é automaticamente o cumprimento de um pedido jurídico de exportação completa.** A UI distingue os dois.
- Consent_records append-only: preferência opcional, finalidade, versão, actor, aceite/retirado e hora. Serve como mecanismo técnico; os textos/base de tratamento para serviços reais ainda requerem aprovação jurídica. Não se presume consentimento para todo o acompanhamento.
- Privacy_requests: exportação completa/eliminação, revisão otimista, referência de revisão, bloqueio. Não declara eliminação/fulfillment que não tenha executado.
- Retention_policies: sem prazo por omissão; owner regista prazo já revisto e referência. Preview conta candidatos arquivados sem apagar nada.
- `scripts/local-recovery.ts`: snapshot físico PGlite + SHA-256 + registry; restauro isolado recusa checksum/registry incompatíveis. Teste com dados sintéticos verifica preservação de dados e autorização.

## Limites que não são ultrapassados

1. Não se escolheu base jurídica, prazo legal, decisão DPIA ou acesso a saúde por admin. Precisam de revisão do responsável adequada ao produto.
2. Não há eliminação física automática, expurgo, anonimização definitiva ou alteração dos backups de titulares. O pedido pode ser marcado em análise/bloqueado, mas não como falsamente concluído.
3. Restore PGlite é um ensaio de desenvolvimento, **não um backup recuperável do projeto Supabase**. Não se aplicam migrations cloud com base apenas neste ensaio.
4. Cloud AURA e Render permanecem no baseline anterior. Sem db push, db reset, alterações Auth, criação de contas reais ou deploy.
5. MFA, proteção de passwords comprometidas, SMTP/recuperação de conta e revogação global de sessões precisam de teste/configuração Auth no staging. A revogação de acesso a recursos novos usa tabelas live e não espera refresh JWT.
6. Não foi implementado treino/nutrição/Aluno 360 da Fase 2; não se importou o legado.

## Sequência de ativação futura, antes de qualquer publicação

1. Confirmar ambiente, tenant fixtures, baseline SHA e hashes 8/8. Não apontar automaticamente para uma base de produção.
2. Obter backup cloud válido incluindo dados/schema/Auth necessário, confirmar armazenamento/cifragem e ensaiar restauro num destino separado. Não guardar backups pessoais em Git, outputs públicos ou logs.
3. Fazer revisão de segurança do SQL e ensaio de upgrade do baseline com fixtures. O bundle inclui 10 ficheiros, histórico antigo imutável.
4. Aplicar as duas migrations **apenas no ambiente de desenvolvimento/staging aprovado**, com transação/registry. Registar alterações e comparar checksums.
5. Provisionar grants explícitos sintéticos pelo manager autorizado; não executar scripts legados que assumem acesso genérico sem os adaptar à matriz nova.
6. Testar JWT/PostgREST reais: owner comercial sem medições, PT atribuído/competente, não atribuído, aluno A/B, outra empresa, revogação e concorrência de sessões.
7. Verificar advisor de segurança, exportações e plano de recuperação. Só então escolher uma publicação de desenvolvimento. Produção continua sem publicação automática.

## Recuperação / rollback

O código novo depende das migrations novas. Um rollback apenas do frontend não restaura o acesso amplo anterior nem deve fazê-lo. Antes de aplicar, conservar versão compatível da aplicação e backup verificado. Após novos dados, preferir forward fix para políticas/contratos; não remover tabelas ou reescrever os oito hashes. Restauro destrutivo apenas no destino/escopo explicitamente aprovado. Requests/consents/correções e audit trail fazem parte dos dados a recuperar.

Para o ambiente local, testar `npm test`, `npm run typecheck`, `npm run build`, `npm run test:e2e`. Os testes de algoritmo histórico são limitados ao schema auditado; os novos testes de fundações instalam a versão completa. Browser interceptado não prova JWT/RLS cloud; as suites são evidências complementares.
