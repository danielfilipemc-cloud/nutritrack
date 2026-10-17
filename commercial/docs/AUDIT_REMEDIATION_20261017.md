# Remediação da auditoria independente — 17/10/2026

## Âmbito e estado

Base confirmada: `saas-foundation` e `integration/aura-staging` em `18485825fe5683c4327e79674113c667a7c55d54`; PRs #8–#14 consultados no GitHub, todos integrados. PRs #15/#16 já faziam parte dessa referência. Trabalho em `fix/aura-security-audit`, exclusivamente `commercial/`. Nenhum merge em `main`, dado real, alteração à configuração de produção ou migration destrutiva.

As migrations 15, 16 e 17 foram criadas pelo CLI 2.120.0 e aplicadas apenas ao sandbox local principal e ao staging `vgbwmamntjmhzrpvhxzb`. As catorze anteriores não foram editadas. Upgrade local com dump privado e igualdade das linhas/registry anteriores; cloud com fingerprints das 24 tabelas existentes em 14→16 e das 26 em 16→17, todos iguais. As duas novas tabelas são privadas, com RLS e sem grants diretos. Dados fictícios posteriores pertencem aos testes identificados abaixo.

## Achados confirmados e correções

| ID / severidade | Reprodução e impacto | Tratamento / evidência |
| --- | --- | --- |
| P1 / Alta | `20261014180744_privacy_integrity_recovery.sql:149`, projeção de pedidos por aluno sem filtrar autor: uma conta ligada via `client_users` recebia pedidos criados pelo gestor. O teste reproduz duas linhas antes da correção. Não foi demonstrada fuga entre estabelecimentos. | Migration `20261016231855_privacy_scope_and_review_audit.sql:12`: aluno apenas com pedidos/preferências da própria conta; owner/admin com fila mínima. Sem referências internas, IDs de autores ou acesso do coach ao contexto. Teste `audit-security.test.ts` reproduz antes/depois. O baseline de produção #8 não contém esta funcionalidade posterior. |
| P2 / Média | `PrivacyPanel.tsx` tinha leitura inicial sem tratamento de rejeição e estado `busy` sujeito ao ciclo de vida do pedido anterior. Falhas podiam deixar carregamento indefinido ou mensagens fora do contexto. | Leituras/escritas invalidadas, chave por organização/aluno, trava síncrona de escritas, bloqueio de repetição após resultado incerto/409 e rascunho preservado. Testes de leitura interrompida, escrita incerta, troca durante leitura/escrita, mobile e navegação com rascunho. |
| P3 / Média | A revisão preservava apenas a última referência em `privacy_requests`, sem projeção específica do histórico de referências. | `privacy_reviews` regista cada nova revisão com autor, instante e revisão, na mesma transação. Leitura mínima reservada à gestão, vinculada a organização/aluno/pedido. Não se fabricam eventos anteriores. O aluno recebe apenas o estado do seu pedido. Nenhuma eliminação foi implementada. |
| A1 / Alta para piloto | Configurar TOTP no fornecedor não impunha AAL2 na aplicação. | Migrations 16/17: política explícita por organização, alterável só por owner com AAL2 recente, sessão ativa e fator TOTP verificado. Abrange acesso aos dados dos alunos, projeções de privacidade e 13 comandos sensíveis. Política desativada por omissão para evitar bloqueio das organizações existentes; **tem de ser ativada/verificada em cada organização do piloto**. |
| A2 / Alta para piloto, aberta | JWT cloud observado com TTL de 3600s; local com 900s. Logout do fornecedor não permite assumir invalidação imediata de todo JWT. | Revogação de membros/atribuições continua a depender do banco em cada pedido. Nas organizações com a nova política, leituras/ações protegidas também verificam `auth.sessions`, fator e confirmação TOTP nos últimos 600s. Reduzir TTL cloud para 900s e verificar configuração/rotação ainda exige painel Auth. Não foi alterada configuração global. |
| A3 / Alta para piloto, aberta | Advisor confirma proteção de passwords comprometidas desativada. | Documentação atual do Supabase: recurso disponível em Pro ou superior. Sem mudança de plano/custo. É necessária decisão do responsável e verificação efetiva; MFA não equivale a resolver este aviso. |
| A4 / Alta para piloto, parcialmente resolvida | O redirect de recuperação inicialmente apontava para localhost. Após correção pelo responsável, o probe de 2026-10-17 12:19 UTC confirmou a origem de staging esperada (PASS). | Probe restrito a conta fictícia sem atribuição, sem email nem consumo/persistência de token. Allowlist, entrega/consumo e recuperação do frontend continuam pendentes; o redirect correto não prova o fluxo completo. |
| T1 / Caso negativo agora coberto | Uma resposta perdida após commit podia levar o operador a repetir um lote sem confirmar a revisão. | Três lotes reais de 50/50/20 medições, repetição do primeiro, revogação entre lotes e duas revisões concorrentes. Um único vencedor, outro HTTP409; repetição idêntica sem duplicação. Chromium simula commit seguido de perda da resposta e exige nova pré-visualização/consentimento. Sem nutrição ou sincronização automática. |
| Q1 / Flakiness de teste confirmada | O teste de erro das prioridades consumia a única resposta 500 num pedido de uma página anterior ainda a terminar. | O erro permanece ativo até ser observado na página de destino; só depois o teste o remove e pede atualização explícita. Sem mudar a lógica do painel. |

As referências a linhas são âncoras na revisão desta entrega, não intervalos de diff. Ver também as entradas de testes e o histórico Git para reproduzir o comportamento anterior.

## Decisão técnica de MFA e sessões

`require_aal2_session` valida o claim assinado `aal2`, `session_id` existente para `auth.uid()`, `not_after` quando configurado, pelo menos um fator TOTP verificado e método TOTP em `amr` com idade máxima de 600s. Campos em `user_metadata` não concedem autoridade. A política é consultada no banco, não apenas no frontend. Os papéis, competências e atribuições continuam obrigatórios; MFA não os substitui.

As implementações anteriores envolvidas tornam-se funções privadas sem EXECUTE para `authenticated`; as novas RPC públicas continuam INVOKER. A leitura de requisitos revela apenas se a própria organização requer MFA e se a sessão satisfaz a regra; não concede acesso ao aluno. A página `/seguranca` permite configurar, confirmar e cancelar fatores **ainda não verificados**. Não remove fatores verificados nem oferece bypass para dispositivo perdido. O segredo de configuração fica só no estado temporário do navegador; fixtures explicitamente solicitadas podem guardá-lo em ficheiro privado ignorado para os testes.

Proposta operacional: TTL 900s, refresh rotation ativa, verificação TOTP recente 600s e MFA exigido por todas as organizações do piloto. Definir ainda inatividade/duração absoluta e procedimento assistido para dispositivo perdido. Dados já apresentados ao navegador não podem ser apagados retroativamente por uma policy; os testes de revogação demonstram negação nos **pedidos seguintes ao commit**, sem renovar JWT.

## Estado instalado e evidências

- Catálogo cloud antes: 14 migrations, zero tabelas sem RLS, zero definers públicos e zero `search_path` inseguros. Catálogo **efetivamente instalado com 17 migrations** novamente consultado: zero tabelas sem RLS, zero RPC públicas/privadas inseguras segundo os critérios de grants/search_path, zero grants SELECT privados para anon/authenticated. Storage: zero buckets/objetos.
- Auth público: signup ativo, confirmação de email ativa (`mailer_autoconfirm=false`), email provider ativo e anonymous provider desativado. Não foi alterada a opção de signup previamente autorizada pelo utilizador.
- 71 testes PostgreSQL/domínio/guards e TypeScript/build aprovados. 65 cenários Chromium aprovados, incluindo mobile, QR/TOTP por contrato, retoma, conflitos e troca de contexto. Testes por fixtures não provam RLS do fornecedor.
- Três fluxos Chromium com Auth local real aprovados (10.2s): objetivos, importação/origem NutriTrack e interface TOTP/política. O primeiro ensaio encontrou API local parada após a retoma WSL; foi reiniciada/verificada sem reset. Um teste histórico também assumia uma única medição NutriTrack em todas as datas; agora exige exatamente uma medição da origem no **dia importado**, tolerando o histórico sintético acumulado sem apagar dados.
- Auth/JWT/PostgREST reais: oito grupos locais, run `5967b034-5e28-4861-a49e-b57a5f5d8ca8`, e oito cloud, run `3ee649a9-8fee-42d8-a4f9-9c9466b6cdad`, aprovados com schema 17. Sessão AAL1 sem dados, AAL2 com dados e mesmo JWT AAL2 após logout sem dados, além de comandos negados.
- Regressão de 16 grupos das fundações cloud aprovada após schema 16, run `b63357b3-e292-4ee4-b975-c00e9b808ad7`. Inclui owner/admin, coach, aluno, sem atribuição, profissional e aluno revogados, tenant estrangeiro, anónimo e JWT forjado. O ensaio novo de schema 17 cobre os controlos acrescentados.
- Relatórios privados em `.aura-integration/`, fora do Git. Não anexar tokens, passwords, TOTP, dumps, links de recuperação ou payloads de alunos a uma auditoria externa.

## Questões ainda abertas

**Altas / bloqueiam piloto:** avisos A2/A3/A4; ativação efetiva da política para os tenants do piloto; recuperação cloud de Auth/DB/configuração e MFA não ensaiada; base jurídica, responsáveis, retenção/direitos e resposta a incidentes não aprovados. Nenhum destes pontos se fecha com aprovação de testes de domínio. A recuperação cloud continua conforme RECOVERY_OPERATIONS.md.

**Médias:** fila de privacidade limitada aos 50 pedidos mais recentes por aluno, sem gestão transversal completa; configuração de retenção continua simulação e não tem resolução jurídica; falta ensaio de acessibilidade com tecnologias de apoio e teste de carga das verificações de sessão; falta processo assistido de recuperação de segundo fator. Não existe fluxo completo autónomo de recuperação de password na interface. Os cenários locais anteriores de Mailpit validam API/Auth, não entrega cloud nem esse produto final.

Nenhum achado crítico foi confirmado no âmbito executado; isso não demonstra ausência de vulnerabilidades. O projeto **não está autorizado nem declarado pronto para um piloto com dados reais**.

## Critérios objetivos para piloto

1. Nova auditoria independente sobre o SHA final, sem críticos/altos sem correção ou decisão explícita documentada do responsável.
2. Mesmo artefacto de frontend e migrations compatíveis; CI, testes RLS/Auth e Chromium aprovados na revisão exata, incluindo todos os papéis e revogação sem refresh.
3. MFA ativo em cada tenant do piloto e todas as identidades que acedem a dados capazes de completar o desafio. Ensaio de expiração, logout, revogação e recuperação assistida sem bypass por metadata ou funções históricas.
4. Auth com Site URL/allowlist corretos, TTL/rotação/passwords verificados; confirmação/recuperação ensaiadas em contas de teste e destino de email controlado, sem dados reais.
5. Aviso de passwords comprometidas resolvido ou decisão de risco explícita, com medidas compensatórias aprovadas. Nenhuma mudança de plano presumida.
6. Ensaio **cloud → cloud novo** concluído e revisto nos objetivos RPO/RTO; Auth/password/MFA/isolamento/configuração verificados, não apenas tabelas importadas. Storage incluído se for introduzido.
7. Responsáveis, base jurídica, contratos, retenção e direitos aprovados; eliminação definitiva continua bloqueada até haver desenho/autorizações próprias.
8. Escopo/participantes limitados, contas individuais, suporte e monitorização definidos, critérios de suspensão e plano de rollback sem perda de dados revistos. Publicação de produção exige autorização específica posterior.

## Complemento da última revisão de integração

Sobre a revisão 93173ae: SecurityRequirement passa a estados explícitos de carregamento/erro/bloqueio/verificação concluída. Erro RPC, rejeição de rede ou resposta malformada nunca significam ausência de obrigação. Nova tentativa é explícita; resultados antigos não substituem o contexto atual. A UI informa o estado, mantendo o banco como autoridade de acesso.

A suite agora tem 73 testes de domínio/PostgreSQL/guards. Dois testes novos executam todos os RPCs públicos como anon e todas as implementações históricas como authenticated (SQLSTATE 42501), e os 13 wrappers sensíveis como AAL1 (PT403). Verificam ainda sessão de outra identidade, TOTP ausente/expirado/futuro, fator retirado, mudança de política sem renovar JWT, revisão obsoleta, contexto de outro tenant e eventos/revisões da ativação. O catálogo é descoberto dinamicamente, com limites mínimos para impedir aprovação sobre conjunto vazio. Estes testes usam PGlite/Auth emulado, não demonstram sozinhos a configuração cloud.

73 testes, TypeScript/build e auditoria de dependências aprovados; após reforçar as asserções de evento/revisão, os sete testes focados voltaram a passar. Chromium: 70/70 aprovados (37.8s), incluindo falhas de rede/403/resposta malformada, retry, troca de organização com pedido pendente e erro ao revalidar após mudança de sessão MFA. O primeiro ensaio encontrou um seletor de teste excessivamente exato para o nome acessível do estabelecimento; foi corrigido para selecionar o combobox pelo prefixo, sem alterar a UI.

Consultar MFA_ASSISTED_RECOVERY_AND_ACTIVATION.md para o procedimento assistido sem bypass e aceitação verificável por organização. A perda total de fator continua sem recuperação operacional ensaiada e bloqueia piloto. Não foram alteradas/aplicadas migrations neste complemento: a correção é de UI, testes e procedimento, mantendo as 17 migrations anteriores intactas. As provas cloud e de Auth real descritas acima pertencem à revisão anterior; não foram repetidas nem apresentadas como novos ensaios. Nenhuma publicação ou utilização de dados reais.
