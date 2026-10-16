# Objetivos acompanháveis — Aluno 360º

## Decisão e âmbito

Nova secção **Objetivos** na ficha `/alunos/[id]`, sem aplicação ou identidade paralela. Permite vários objetivos operacionais com título, prazo opcional, estados em curso/concluído/cancelado, edição, conclusão e reabertura explícita. A lista e o histórico são paginados. O foco geral em `client_followups.goal` fica intacto; não é copiado nem convertido automaticamente.

Objetivos são uma extensão do acompanhamento já autorizado: exigem competência `followup` e atribuição ao aluno, cumulativamente. Escrita exige `can_write`; owner/admin não recebem acesso implícito. Não há novo grant em massa. Não se introduzem metas clínicas, valores nutricionais ou prescrição. Esses módulos futuros precisam de competências e modelos próprios; esta permissão não autoriza importar dados NutriTrack ou ler a sua base pessoal.

## Contrato e integridade

Migration `20261016184133_student_objectives.sql`, criada pelo CLI oficial. SHA-256 LF: `6bf231893d6343885e0c1da7bec87c49a532d73561cc2deaf22525fef150e73d`. As dez anteriores permanecem imutáveis.

- `public.client_objectives`: identidade composta organização/aluno, FK de tenant, RLS por acompanhamento, SELECT autorizado; browser sem INSERT/UPDATE/DELETE.
- `aura_objective_save`: wrapper invoker e implementação privada definer com search_path vazio. Verifica identidade, competência, atribuição, arquivo, título/prazo/estado e revisão otimista; hora/revisão/auditoria são do servidor. Ordem de locks igual às revogações e aos comandos de acompanhamento existentes.
- Fechados exigem reabertura antes de editar. Conclusões guardam timestamp; cancelamento não apaga registos. Audit trail regista ação/estado/ator/revisão/hora, sem duplicar títulos anteriores. A projeção de histórico não entrega o ator interno ou texto antigo.
- Exportação existente conserva os seus checks: acrescenta objetivos apenas ao profissional com acesso suficiente. Alunos e gestores sem acompanhamento autorizado recebem `objectives: []`. Não é uma exportação jurídica completa nem publicação para o portal do aluno.

Na interface, conflitos conservam o rascunho e bloqueiam gravação até atualização explícita. Uma resposta de rede/servidor sem resultado confirmado também exige atualização antes de repetir; não se promete idempotência para criação. Tarefas novas/reabertas regressam ao filtro em curso para ficarem visíveis. Mudança de secção/estabelecimento protege rascunhos independentes do plano geral. Histórico e conclusão usam Europe/Lisbon, incluindo a mudança de dia em relação a UTC. Não existem notificações ou conclusões automáticas por prazo vencido.

## Validação e ambiente

Suite de domínio/PostgreSQL/guards: 57 testes. Chromium por fixtures: 43 cenários, incluindo oito novos de objetivos (ciclo completo, conflitos, consulta/arquivo, permissões, paginação/mobile, rascunhos, filtro e resultado de gravação incerto). TypeScript/build verificados; npm audit sem vulnerabilidades reportadas.

No Supabase local principal, o upgrade **10 → 11** fez primeiro dump privado do sandbox. Comparou antes/depois os alunos, avaliações, acompanhamentos, memberships, competências, atribuições e as dez entradas antigas do registry, incluindo checksums e datas: igualdade. `scripts/apply-objectives-local.sh` recusa cloud, Docker remoto, bindings diferentes de 127.0.0.1:57322, Auth não sintético ou contagem diferente de dez; não faz reset. O backup fica ignorado em `.aura-integration/objectives-upgrade-*`; não representa uma política de recuperação cloud.

`npm run test:objectives:local` passou oito grupos Auth/JWT/PostgREST reais: falta de acesso implícito, escrita autorizada, SELECT-only, concorrência HTTP409, fecho/reabertura, projeção do aluno e exportação, arquivo e revogação com JWT inalterado. Repetiram-se também os 16 grupos base das fundações após estender a exportação. Fixtures são de empresas e utilizadores fictícios novos; não existe limpeza destrutiva.

`e2e/auth-objectives-local.spec.cjs` passou com login real, criação/conclusão na ficha, histórico e logout. Só permite frontend 127.0.0.1:3187 e API 127.0.0.1:57321; bloqueia tráfego externo. Traces/screenshots/vídeos ficam desligados; as credenciais não são impressas. Os dois E2E Auth históricos que apontavam ao projeto protegido foram bloqueados antes de ler env/fixtures ou criar clientes administrativos.

## Reprodução local

Com runtime local validado e variáveis `AURA_STAGING_*` explícitas (incluindo manifesto de restauro), executar `npm run test:objectives:local`. A opção `-- --demo-credentials` prepara deliberadamente um owner fictício, com grants explícitos apenas para o aluno de demonstração, e escreve `demo.private.json` no runtime ignorado; não enviar esse ficheiro para GitHub ou logs.

Para o E2E real, selecionar **apenas** o novo ficheiro, indicar `AURA_E2E_AUTH=1` e `AURA_LOCAL_DEMO_FILE` com o caminho do JSON sintético, e executar:

```sh
npm run test:e2e -- e2e/auth-objectives-local.spec.cjs --workers=1
```

Retirar `AURA_E2E_AUTH` depois do ensaio. A suite normal continua sem contas ou secrets. Não executar os harnesses cloud históricos.

## Integração e limites

Branch `feat/aura-student-objectives`, dependente de `feat/aura-student-360` / PR #10, que depende das fundações / PR #9. Rever nessa ordem. A migration foi validada no sandbox local e instalada no staging cloud independente autorizado; ver STAGING_20261016.md. O código e a migration nova não foram publicados em produção. Os controlos restaurados de oito migrations e o NutriTrack pessoal não foram alterados.

Continuam pendentes o gate cloud/recuperação operacional, política MFA/sessões, decisões jurídicas e revisão independente. O portal do aluno ainda não mostra estes objetivos. Próximos incrementos: visão conjunta de objetivos/revisões, progresso temporal e contratos de origem/unidades/identidade para nutrição e medições NutriTrack, com autorização específica por módulo.
