# Plano de ativação Nutrição 18/19 — preparado, não executado

**BLOQUEADO para execução cloud.** Este documento não autoriza migrations, testes mutáveis, exportações, novas contas, alterações de Auth ou publicação. Código integrado: `f2a5e90cb8592043f839de2281c0a9c5cdf0ff0a`. PR #31 head f146472618c4c371a1c0c1292c8fe500e2fa141f → merge fddc7d416c7bc8e319f633d39605bdaa66ee67ac; PR #32 head 5a47f482aefae118babacb26e3f089cff8ef10df → merge f2a5e90cb8592043f839de2281c0a9c5cdf0ff0a. Árvore integrada idêntica à aprovada.

## Destino e autorizações distintas

Único destino proposto: Supabase **vgbwmamntjmhzrpvhxzb**, staging AURA independente. Render staging **srv-db9al5ajnfac73bivqr0**, branch integration/aura-staging, permanece na revisão 6823fe0b9d35db9f5edaa4939ed45a022ab01888; nenhuma publicação faz parte deste plano. Produção Supabase vfplbkfxipfictuwkkoe, Render srv-db76rpmi0phs738pd9ug, main e NutriTrack pessoal estão excluídos.

Antes de agir, o responsável aprova separadamente: (A) a janela de migrations 18/19, SHA, hashes e projeto; (B) o manifesto privado de fixtures e as mutações de testes; (C) backup/recuperação e eventual contenção de acesso. Não reutilizar uma autorização de deploy ou de exportação antiga. Não pedir/enviar segredos no chat. A aprovação deve identificar operador, revisor, data/janela, hashes dos artefactos e plano de resposta. Mudança de SHA/migration/manifesto exige nova revisão.

O SQL não consegue provar o project_ref: current_database() pode ser postgres em vários projetos. Confirmar identidade no conector/painel e no destino efetivo de conexão antes de qualquer SQL. Recusar projeto/URL/host divergentes. Não usar db push ou runners históricos que possam tentar reaplicar a baseline.

## Artefactos offline e checksums

Em commercial: `node --import tsx scripts/nutrition-activation-artifacts.ts --emit-plan` gera **apenas ficheiros locais**, sem rede, sem bundle de instalação e sem SQL mutável. Não usar --write (pertence a outro gerador).

- [migration-manifest.json](review/nutrition-activation/migration-manifest.json): SHA-256 de cada uma das 19 fontes; primeiras 17 são baseline esperada, não observação cloud atual. Usa migrationSource: três fontes históricas CRLF, restantes LF. Não calcular hashes sobre bytes arbitrários do checkout nem atualizar o registo para esconder divergências.
- [preflight.readonly.sql](review/nutrition-activation/preflight.readonly.sql): transação READ ONLY, compara exatamente as 17 entradas, incluindo extras inesperados; inventaria catálogo/RLS/grants. **Preparado, não executado remotamente.**
- [postflight.readonly.sql](review/nutrition-activation/postflight.readonly.sql): compara as 19 entradas e inventaria o mesmo catálogo. PASS significa correspondência do registo, não segurança comprovada.
- [synthetic-fixtures.proposed.json](review/nutrition-activation/synthetic-fixtures.proposed.json): inventário público inventado, ainda sem associação a contas/credenciais privadas; execução bloqueada.

Preflight futuro: guardar apenas metadados privados permitidos, comparar nomes/checksums das 17 entradas com o manifesto e applied_at antes/depois; registar assinaturas/proprietários/configuração das funções, policies, grants/default privileges, triggers, FKs e índices. Confirmar zero objetos nutrition_* prévios. Qualquer entrada extra, parcial 18/19, checksum divergente, objeto inesperado ou incapacidade de provar o destino implica STOP. Um estado já em 19 exige análise de commit anterior, não fingir instalação nova.

O inventário gerado é uma inspeção, não um executor. Não lê refeições, Auth.users ou segredos. Os testes locais provam PASS na baseline 17, STOP no conjunto errado e STOP após checksum adulterado, sem alterar o registo pela inspeção.

## Efeitos das migrations a rever

| Migration | Efeitos |
|---|---|
| 18 — 20261018203955_nutrition_foundation.sql | Quatro tabelas public: nutrition_capabilities, nutrition_meals, nutrition_meal_versions, nutrition_meal_items; RLS, quatro policies SELECT, FKs multiempresa/versão atual diferida, constraints de composição/massa, histórico e identidade protegidos por três triggers; índice de dia; cinco funções privadas e uma RPC invoker de competência |
| 19 — 20261018204504_nutrition_transactions.sql | Duas tabelas privadas RLS sem grants de cliente: nutrition_requests/events; dois triggers append-only, índice organização/aluno; sete funções privadas e quatro RPCs públicas invoker para comando, recibo, diário e histórico |

Total: seis tabelas, 17 funções (cinco públicas invoker, 12 privadas), quatro policies SELECT, cinco triggers e dois índices explícitos, além dos índices de PK/unique. Não há ALTER de funções existentes, backfill, competência automática, mudança de RLS/Auth existente, extensão, catálogo externo ou cópia de dados pessoais. O registo custom app_private.aura_migrations recebe duas entradas na instalação transacional revista. As fontes das 17 anteriores permanecem intactas.

authenticated recebe SELECT nas quatro tabelas públicas e EXECUTE nas cinco RPCs; não recebe DML direto. Nas privadas só nutrition_allowed e as cinco implementações autorizadas têm EXECUTE de authenticated; validadores/projeção/triggers não têm. anon não tem acesso. As implementações definer têm search_path vazio e revalidam identidade, perfil, membership, atribuição, competência e política sensível. Também testar a execução direta privada: não depender apenas de o schema não estar exposto via PostgREST.

Aplicação futura proposta: gerar de fontes revistas um pacote transacional pelo mecanismo migrationBundle, com os 17 blocos anteriores a verificar checksum e fazer no-op e apenas 18/19 a criar objetos. Rever e fixar hash do pacote antes de autorizar. **Não foi emitido ou executado um pacote de aplicação remota; os bundles dos ensaios só foram usados em bases descartáveis.** Não colar DDL avulsa sem registo, não alterar install.generated.sql nem misturar os registos custom e da CLI sem análise. Uma única transação deve conter os dois novos blocos e entradas de registo; locks/timeouts/janela são revistos pelo operador. A resposta ao commit pode perder-se: resolver pelo registo/catálogo antes de repetir.

## Fixtures e validação GoTrue/PostgREST a autorizar

O manifesto proposto reserva duas organizações novas, três alunos inventados e aliases de dez contas exclusivamente fictícias. O manifesto privado terá IDs reais dessas contas de teste, fatores verificados existentes, IDs das entidades criadas, recibos/request_ids, hashes e atestado de origem; segredos ficam nos mecanismos privados existentes, nunca no Git, captura, trace ou relatório. Não reutilizar contas pessoais. Não criar/resetar contas ou MFA implicitamente. Colisão de UUID ou ausência de prova de propriedade do run bloqueia a execução; nomes com FICTICIO não bastam como autorização.

Escopo futuro de mutações deve incluir explicitamente: criar apenas as entidades allowlisted se ausentes; atribuir/revogar/repor competências e atribuições nessas organizações; registar/corrigir/anular refeições de teste; challenges TOTP em sessões de teste e logout/revogação apenas dessas sessões. Ativação da política AAL2 **nas novas organizações sintéticas** também precisa de autorização owner e prova de MFA recente; não alterar políticas existentes ou configuração Auth global. owner/admin não recebem acesso nutricional implícito. student vinculado continua sem acesso nutricional nesta fase.

| Ensaio real futuro | Evidência exigida |
|---|---|
| GoTrue login e step-up | JWT realmente emitido e assinatura aceite pelo endpoint; AAL1 negado quando política exige AAL2; TOTP recente/fator verificado e sessão viva permitem apenas o autorizado. Não forjar JWT nem imprimir tokens/seeds |
| Papéis e competência | owner/admin sem competência: negar; coach sem perfil/atribuição/competência: negar; read-only: ler e negar escrita/recibo; student, não atribuído, não membro e anon: negar |
| Multiempresa/aluno | Profissionais plenamente autorizados em A e B só veem o seu escopo; UUID conhecido de outro aluno/refeição/request não autoriza; FK forjada e DML direto negados |
| JWT antigo e revogação | Conservar o mesmo access token em memória, sem refresh automático; revogar atribuição, competência e membership do test actor em transações distintas; novos reads/writes/recibos devem negar sem esperar expirar o JWT |
| Sessão e política MFA | Fresh AAL2 do test actor antes de logout; após revogar essa sessão, repetir com o JWT anterior e exigir negação quando a política AAL2 está ativa; TOTP fora da janela também negado. Não generalizar este teste a políticas desativadas |
| RPC/atomicidade | Criar, corrigir com expectedRevision, anular logicamente; erro de último item reverte tudo; IDs/ator não forjáveis; dois writers reais na mesma revisão dão um sucesso e um PT409 |
| Estado incerto/idempotência | Simular perda de resposta após commit; consultar recibo do mesmo ator/contexto antes de retry; repetir request idêntico sem duplicar; conteúdo/contexto divergente dá PT409. Falta de recibo não prova ausência de pedido em curso |
| Paginação e alterações | Mais de 20 refeições/revisões, novas inserções antes/depois do cursor, correção que muda dia e nova revisão enquanto se pagina; negar retoma após revogação. Não tratar nextCursor=null como snapshot coerente |
| Integridade | Ler revisões e snapshots anteriores, recibos e contagens de eventos após retries/conflitos/negações; nenhum update/delete histórico; exportação atual não é exportação nutricional completa |

Desligar persistência de sessão/auto-refresh só no cliente de ensaio com JWT antigo, não como alteração de proteção da aplicação. É controlo de medição, não bypass. GoTrue/PostgREST, network failure e MFA reais ainda **não foram ensaiados nesta fase**. Não executar a auditoria cloud mutável completa nem redirecionar runners antigos para este alvo. O runner futuro deve implementar fail-closed para projeto, SHA, hashes, manifesto privado e confirmação de operações; não existe autorização embutida nos ficheiros desta entrega.

## Falhas, recuperação e reversão sem apagar histórico

Antes da janela: coordenar pausa dos escritores de teste, provar que todos os dados abrangidos são fictícios, aprovar cópia privada criptografada e validar a sua integridade/possibilidade de restauro. Não exportar bases nem Auth secrets nesta fase. Registar capacidades/grants originais, configurações relevantes não secretas, checksums e inventário de Auth/Storage. Nenhum objeto Storage é criado por 18/19; um backup de DB não equivale a cópia dos ficheiros Storage. Não assumir disponibilidade de PITR/backup pago no plano atual ou contratar planos.

Objetivos propostos para revisão: RPO de ativação zero para os dados sintéticos confirmados antes de uma janela com escrita suspensa e cópia comprovada; contenção de acesso em até 15 minutos; alvo de ensaio de restauro operacional até 4 horas. **Não medidos nem garantidos**, dependem de aprovação e prova de recuperação cloud, que continua bloqueio alto. Não apresentar estes alvos como SLA.

1. Falha antes de COMMIT: ROLLBACK de DDL/registo; confirmar as mesmas 17 entradas e ausência de objetos novos. Não inserir checksums à mão para completar uma instalação falhada.
2. Resposta ao COMMIT incerta: parar testes; inspeção read-only das 19 entradas e catálogo. Estado íntegro confirmado pode ser revalidado; estado misto/drift é incidente, não motivo para force/reaplicar SQL avulsa. Gerar correção incremental revista, sem editar 18/19.
3. Commit íntegro mas ensaio de segurança falha: interromper escritores/harness e novas mutações, preservar logs mínimos/recibos. Pela conta owner autorizada, revogar competências **apenas** dos atores/organizações deste manifesto, com auditoria e locks existentes. Preparar depois contenção transacional dos grants de Nutrição: revogar SELECT/DML nas quatro tabelas públicas, EXECUTE nas cinco RPCs e nas cinco implementações privadas mais nutrition_allowed, sem tocar nos outros módulos. Revisar a lista exata de assinaturas a partir do catálogo salvo. Não basta revogar wrappers públicos; não habilitar bypass ou desativar RLS/MFA.
4. REVOKE não retira dados já entregues nem cancela automaticamente statements em curso. Confirmar o fim/resultado dos pedidos pendentes antes de chamar o estado de contido; guardar recibos e erros, sem repetir operações cegamente. Não terminar conexões de outros workloads nem modificar Auth global para facilitar a reversão.
5. Sem DROP/TRUNCATE/DELETE de refeições, versões, itens, recibos, eventos ou Auth.users; sem down migration. A UI permanece demonstração, pelo que não precisa de deploy de reversão nesta janela. Restaurar privilégios/capacidades só após correção, nova revisão e nova autorização, pela matriz mínima aprovada, nunca GRANT ALL.
6. Corrupção comprovada requer restauro ensaiado para destino isolado já autorizado, com reconciliação de writes posteriores e direitos de privacidade antes de reabrir. Não substituir a base existente nem criar projeto/custo sem autorização. Auth requer procedimento do fornecedor/recuperação verificada; não restaurar tabelas Auth avulsas ou sessões antigas. Configurações e Storage têm validações próprias. Sem prova operacional, continuar bloqueado.

## Aprovação de saída

Revisor independente confirma pre/postflight, zero achados altos novos sem tratamento, matriz de APIs real aprovada e evidência privada íntegra. O responsável decide política profissional, exportação/retencão/privacidade conforme [política proposta](NUTRITION_PRIVACY_POLICY_PROPOSAL.md), contenção e recuperação. Ativar interface persistente ou publicar exige outra autorização; não está implícito em aplicar schema. Não há autorização para dados reais ou piloto comercial.

H-01 passwords comprometidas, H-02 sessões/JWT, H-03 recuperação cloud, H-04 conta/MFA e H-05 RGPD permanecem abertos. Referências oficiais: [sessões](https://supabase.com/docs/guides/auth/sessions), [MFA](https://supabase.com/docs/guides/auth/auth-mfa), [limites de backup e Storage](https://supabase.com/docs/guides/platform/backups). O plano não pressupõe funcionalidades pagas nem resolve estes bloqueios por documentação.
