# Auditoria integrada e preparação — PRs #22 e #23

Data: 2026-10-17. Âmbito exclusivo `commercial/`, dados fictícios. Sem merge, publicação, alterações de Auth, grants, policies ou migrations. Esta entrega permite revisão de integração técnica; não autoriza um piloto comercial.

## 1. Cadeia efetivamente auditada

| Etapa | Branch | SHA de entrada | Dependência |
|---|---|---|---|
| Referência | `saas-foundation` | `c248203e7ecb41289cf455c2f720d27be8314359` | Nenhuma alteração nesta auditoria |
| PR #22 | `feat/aura-premium-navigation` | `dfe39b9fbfe60ecc5c9ff8625fbda116d83bf640` | Base `saas-foundation` |
| PR #23 | `feat/aura-premium-operations` | `3b327768edd2c03eb4570950b56d2a2830fc4465` | Base do #22; contém o seu commit |
| Correções da auditoria | `fix/aura-integration-audit` | Commit identificado no PR de correções | Base do #23; contém ambos |

Os PRs #22 e #23 foram consultados na API GitHub: abertos, sem merge, fora de draft. Os campos `merge_commit_sha` da API podem identificar merges de teste: não demonstram integração. Confrontar sempre `merged`, a referência remota e a ancestralidade.

O CI anterior dos dois PRs passou (#103 e #105), mas não substitui a execução do candidato com estas correções. Os SHAs finais e resultados estão no PR de correções e nos logs indicados abaixo.

## 2. Problemas confirmados e correções

| ID | Severidade | Problema confirmado | Correção e teste |
|---|---|---|---|
| UI-01 | Média | Diretório perdia o nome em edição após PT409/40001 e removia o formulário | Mantém rascunho e versão original; bloqueia repetição até recarregamento explícito com confirmação. Teste `directory conflict...` |
| UI-02 | Média | Criação/edição de aluno não participava no guard de navegação da ficha | Reutiliza `useDraftNavigation`; mudança de organização, filtro, pesquisa, paginação, rota e reload respeitam rascunhos. Operação pendente impede navegação |
| UI-03 | Média | Erro de criação/alteração permitia repetição sem revisão de uma operação cujo resultado podia ser desconhecido | Mantém os dados e exige revisão/recarregamento. Isto reduz repetição cega; não transforma insert em operação idempotente |
| UI-04 | Baixa | Promise de histórico sem ramo de rejeição podia deixar estado de carregamento | Trata rejeição e resposta com erro; teste de falha de rede não deixa spinner nem erro não tratado |
| UI-05 | Baixa | Avaliações/Evolução com aluno sem competência podiam ficar sem explicação após verificação de acesso | Estado explícito sem acesso, sem medições ou comandos de escrita; teste de profissional restrito |
| QA-01 | Média | Não havia lint dedicado no gate `check` | ESLint 10.13.0 e typescript-eslint 8.71.2 fixados; lint de aplicação/componente/lib precede testes, TypeScript e build no CI existente |
| UI-06 | Média | Logout revogava Auth antes de a navegação poder confirmar saída com rascunho | Evento cancelável antes de `signOut`, respeitando o guard central de rascunhos/operações pendentes. Testes de diretório e avaliação comprovam que cancelar não chama logout |

O lint usa regras recomendadas TypeScript e regras de correção de JavaScript, sem impor reformatar o projeto. Não substitui análise de hooks React, acessibilidade, fluxos de autorização ou testes. `no-explicit-any` não é uma regra bloqueante nesta configuração. Scripts administrativos históricos não são executados por lint/testes normais.

As correções não alteram contratos de dados nem autorização no banco. Os testes de browser usam fixtures; um 403 simulado comprova a reação da interface, não a decisão real do banco.

## 3. Verificações e reprodução

Em `commercial/`, Node 22.23.3, dependências do lockfile:

```sh
npm ci
npm run check
npm audit --audit-level=low
npm run test:e2e -- --workers=2
npm run test:auth:staging:readiness
```

O último comando é uma consulta apenas de leitura aos settings públicos do staging, sem chave administrativa. Não executar runners históricos nem alterar variáveis para lhes apontar destinos cloud. Nenhum runner de integração que cria identidades/atribuições ou altera política MFA foi executado nesta auditoria.

- Domínio/PostgreSQL: replay completo das 17 migrations em PGlite isolado; isolamento, owner/admin/coach/aluno/sem atribuição/revogado, RPCs públicos, grants históricos, AAL2, sessão, privacidade, revisões e proveniência. Os claims/Auth do fixture PostgreSQL são simulados, não GoTrue real.
- Chromium: suite existente mais `e2e/integration-audit.spec.cjs`. Inclui oito módulos, breadcrumbs, seletor único, criação/edição/arquivo, avaliações, agenda, acompanhamento, objetivos, privacidade, NutriTrack, conflitos, respostas atrasadas, logout, teclado e 375/1440 px.
- Os testes de rascunhos existentes cobrem também Voltar, reload/fecho, operações pendentes e alteração de organização. Um browser não garante recuperação após encerramento forçado; os rascunhos não são persistidos em storage.
- Logs locais privados: `.aura-integration/integration-audit-check.log`, `integration-audit-chromium.log`, `integration-audit-dependencies.log`, `integration-audit-auth-readonly.log`.
- Capturas de revisão: `docs/UI_UX_VALIDATION.md` e `docs/ui/`. As páginas públicas e a experiência White Label continuam abrangidas pelos testes de regressão.

## 4. Observações remotas de leitura — staging exclusivo

Destino: `vgbwmamntjmhzrpvhxzb`. Não houve consulta ou alteração de dados reais, produção ou NutriTrack pessoal.

| Verificação | Resultado observado nesta auditoria | Limite |
|---|---|---|
| Registry vs ficheiros canónicos | 17/17 checksums iguais, sem entradas extra | Compara schema registado; não prova restauro ou inexistência de toda a deriva possível |
| Tabelas públicas sem RLS | 0 | Consulta de catálogo, não pentest |
| RPCs AURA públicos definer ou executáveis por anon | 0 | Não prova correção de todos os ramos internos |
| Implementações históricas com EXECUTE authenticated | 0 | Padrões de nomes cobertos pelos testes/catálogo |
| Grants de tabelas privadas a anon/authenticated/PUBLIC | 0 | Não foi alterado nenhum grant |
| Storage | 0 buckets, 0 objetos | Não existe prova de recuperação de uploads; atualmente não aplicável |
| MFA por organização fictícia | 3 com obrigação ativa; 14 sem obrigação | Não é ativação global; não houve backfill ou alteração |
| Auth público | Signup ativo; email/confirmacão ativos; anónimo desativado | Não expõe JWT expiry, rotação, timeout, allowlist ou força de password |
| Advisor | Leaked Password Protection Disabled | Bloqueio alto confirmado novamente |

Os 15 avisos informativos de RLS sem policies são de tabelas `app_private`: acesso direto do cliente está revogado e o acesso mediado deve passar pelos RPCs autorizados. Não se criaram policies permissivas para silenciar o advisor. A consulta de catálogo e os testes complementam-se; nenhum deles equivale a certificação.

## 5. Bloqueios altos — tarefas e critérios de fecho

### H-01 — Passwords comprometidas — ABERTO, confirmado

Risco: credential stuffing e passwords reutilizadas. O advisor observa proteção desativada. A documentação [Password security](https://supabase.com/docs/guides/auth/password-security) confirma que a opção gerida requer Pro ou superior. Não foi contratado qualquer plano.

Tarefas: responsável decide orçamento/opção suportada ou mantém o piloto bloqueado; operador autorizado inventaria política mínima e proteção; engenharia prepara teste de rejeição de password comprometida e aceitação de password de teste forte no serviço Auth. Uma validação apenas no formulário não impede acesso direto ao endpoint Auth e não encerra o achado. Validar também contas existentes e recuperação; não testar passwords reais nem as enviar a serviços externos por este procedimento.

Fecho: configuração comprovada, teste negativo pelo endpoint real de staging e revisão da decisão. A decisão de aceitar risco, se existir, deve ser explícita e não ser apresentada como correção técnica.

### H-02 — Sessões, JWT e revogação — ABERTO, parcialmente mitigado

Código: `components/SessionActions.tsx` usa logout global, limpa a sessão local e explica falha de revogação. As funções existentes voltam a consultar competências/atribuições no banco. Em organizações com MFA exigido, `require_aal2_session` verifica sessão ativa, fator verificado e TOTP recente. Os testes PostgreSQL negam pedidos com claims antigos depois de revogar atribuições/sessão.

Limite: o TTL cloud de 3600 s foi observado em ensaios anteriores, não medido novamente aqui. Settings públicos não o comprovam. O [logout Supabase](https://supabase.com/docs/guides/auth/signout) não invalida por si todos os access tokens emitidos; [limites de sessão](https://supabase.com/docs/guides/auth/sessions) têm requisitos de plano e aplicação próprios. MFA desligado não implica as mesmas garantias de sessão ativa. Dados já entregues ao browser não desaparecem retroativamente por RLS.

Tarefas: responsável aprova TTL/duração/inatividade e política de sessões; operador autorizado regista configuração/refresh rotation e janela de transição dos JWT existentes; engenharia repete com Auth real os testes de refresh, logout global, sessão antiga, utilizador removido, atribuição removida e vínculo de aluno revogado. Separar negação de nova operação no banco de limpeza imediata de UI já carregada. Se for necessário reforço do contrato no banco, apresentar migration incremental para autorização específica; nenhuma foi criada nesta fase.

Fecho: resultados por identidade e mesmo JWT antes/depois, política e latência observadas, sem reduzir MFA/RLS ou pressupor que expiração nominal demonstra revogação imediata.

### H-03 — Backup e restauro operacional cloud — ABERTO, não demonstrado

Existe prova histórica cloud→local com schema anterior; não equivale a cloud→cloud atual. Os objetivos propostos de RPO 15 minutos/RTO 4 horas em `RECOVERY_OPERATIONS.md` não são SLA nem capacidades medidas. [Backups Supabase](https://supabase.com/docs/guides/platform/backups) dependem do plano/método; um backup da base não inclui o conteúdo dos objetos Storage.

Tarefas do responsável: aprovar perda aceitável, prazos, operadores, arquivo privado, retenção e destino cloud novo/vazio com custo previamente confirmado. Tarefas técnicas: inventário Auth/DB/MFA/configuração, snapshot consistente sintético, checksums e ensaio suportado em destino isolado. Restabelecer identidades e login original, isolamento, AAL2, configuração e frontend; não ressuscitar sessões/tokens antigos. Medir timestamps RPO/RTO e repetir recusa de destino ocupado sem o modificar. Storage fica não aplicável enquanto permanecer vazio; exigir ensaio próprio quando houver uploads.

Fecho: relatório de restauro cloud independente com método suportado, manifestos, tempos, checks funcionais e revisão. Não executar os scripts de restauro local contra uma URL cloud para contornar as proteções.

### H-04 — Recuperação de conta, email e MFA — ABERTO

O produto não tem recuperação completa de password/email validada; Site URL corrigido anteriormente não demonstra entrega, allowlist ou consumo de token. O procedimento assistido de perda de fator está preparado em `MFA_ASSISTED_RECOVERY_AND_ACTIVATION.md`, sem bypass implementado. Um fator inscrito não torna MFA obrigatório na organização.

Tarefas do responsável: aprovar prova de identidade, canal de suporte, dupla aprovação e retenção do incidente. Tarefas técnicas: implementar/ensaiar callback de recuperação com estado/expiração e links permitidos, email de teste controlado, não exposição de tokens e tratamento de replay/erro; ensaiar segundo fator alternativo e recuperação suportada pelo fornecedor em conta fictícia. Não retirar fator verificado, reduzir AAL2 ou atribuir owner temporário como atalho.

Fecho: matriz de perda de password, email, dispositivo e comprometimento, com testes negativos de token/sessão antiga e novo desafio real. Cada organização candidata exige registo de ativação e testes AAL1/AAL2/competências. Ver [MFA Supabase](https://supabase.com/docs/guides/auth/auth-mfa). Nenhuma configuração/fator/atribuição foi alterado nesta auditoria.

### H-05 — RGPD, retenção, consentimentos e decisões jurídicas — ABERTO

Risco: tratar dados pessoais/de saúde sem enquadramento, retenção ou resposta a direitos adequados. A base jurídica e eventual condição para categorias especiais exigem análise do responsável; consentimento não deve ser presumido como resposta universal. Referência primária: [RGPD, artigos 5, 6, 9, 13–22, 28, 30, 32–35](https://eur-lex.europa.eu/eli/reg/2016/679/oj/eng).

Tarefas do responsável/assessoria: definir papéis, finalidades/bases, informação aos titulares, contratos com subcontratantes, retenção, avaliação de impacto quando aplicável, incidentes e transferências. Engenharia entrega inventário de campos/destinos/acessos, minimização, exportação com autorização, revisão auditável dos pedidos e retenção configurável em modo de simulação. As funcionalidades atuais não automatizam eliminação definitiva.

Fecho: decisões aprovadas e traduzidas em critérios verificáveis; testar consentimento retirado, acesso indevido a pedidos, exportação por papel, expiração/retenção aprovada e incidente fictício. Não apagar registos nem inventar prazos nesta entrega. O RGPD não é considerado cumprido por haver RLS ou uma caixa de consentimento.

## 6. Ordem futura de integração — plano, não execução

1. Revisor confirma os três heads, bases e CI, e verifica que o diff integral se limita a `commercial/`. Se algum head/base mudar, repetir os checks do candidato.
2. Integrar #22 em `saas-foundation`. Não integrar em `main`.
3. Atualizar/confirmar a base do #23 para `saas-foundation`, preservando o conteúdo do #22 e evitando duplicação de commits em caso de squash. Reexecutar CI e rever diff antes de integrar #23.
4. Atualizar/confirmar a base do PR de correções, comparar a árvore candidata e integrar só depois de revisão própria. Alternativa: aplicar os commits revistos num candidato temporário e comparar a árvore antes de qualquer merge. Nenhuma destas ações foi executada nesta auditoria.
5. Confirmar SHA e checksums no candidato integrado; repetir `npm ci`, `npm run check`, auditoria e Chromium. Auth/PostgREST real e validação operacional em staging requerem plano próprio que não altere permissões sem autorização.
6. Não fazer publicação automática: `saas-foundation` é referência técnica, não autorização de deploy ou de piloto. Confirmar separação de serviços e destino antes de futura publicação explicitamente autorizada.

## 7. Reversão preparada

Antes de integrar, registar SHA base/candidato, lockfile, checksums e resultados. Como estes três incrementos não mudam schema nem dados, a reversão de código pode usar commits `revert` em ordem inversa (correções, #23, #22), através de nova branch/PR e validação. Identificar o SHA real de cada merge e a estratégia usada antes de escolher o comando; não resetar/forçar a branch partilhada.

Se um candidato vier a ser publicado em staging numa fase posterior, reverter apenas o artefacto desse serviço para a última revisão aprovada, mantendo o projeto Supabase isolado e repetindo smoke/Auth. Reversão de frontend não restaura dados nem revoga tokens. Não há migration a desfazer, restauro destrutivo ou ação sobre produção neste plano.

## 8. Estado para decisão

- **Revisão técnica:** candidato com ambos os PRs e correções disponível para revisão; resultados finais vinculados ao SHA no PR de correções.
- **Integração:** preparada, mas não executada/autorizada por este documento.
- **Staging:** apenas inspeção de leitura; candidato não publicado e Auth real do candidato não ensaiado nesta fase.
- **Piloto real:** bloqueado por H-01 a H-05 e pela validação operacional correspondente.
- **Limitações médias:** leitores de ecrã, Safari/Firefox/dispositivos físicos, testes de carga e eliminação do CSS histórico continuam fora da prova atual. A independência visual e a qualidade comercial necessitam de revisão com utilizadores do produto.
