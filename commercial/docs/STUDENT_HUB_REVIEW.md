# Ficha Aluno 360.º — centro de acompanhamento

Branch `design/aura-student-hub`, baseada na dashboard `a3f23bf3aa8777de165d09860f2ae0754dbf36e7` (PR #41), por sua vez dependente do PR #40. PR separado, sem merge ou publicação. Apenas `commercial/`.

## Organização da experiência

A ficha existente continua a ser o único destino de acompanhamento. Em desktop o cabeçalho identifica o aluno, estado, responsável e próxima revisão quando disponíveis; a navegação contextual ocupa uma coluna própria, e o corpo apresenta uma secção de cada vez. Em mobile mantém-se o seletor de área e um disclosure nativo para o contexto, evitando comprimir a navegação desktop. A coluna contextual pode deslocar-se em ecrãs desktop baixos e os botões continuam acessíveis por teclado.

O resumo reutiliza `ClientProgressSummary` e `measurementSummary`: últimas medições conhecidas, datas e diferença face à medição anterior, incluindo zero quando a diferença é efetivamente zero. A evolução recente reutiliza os dados já carregados e autorizados da ficha, e o gráfico existente. Indica o limite das últimas 30 avaliações e encaminha para as secções atuais de evolução/histórico, que mantêm paginação, proveniência, versões e partilha. Não se confunde esta pré-visualização com todo o histórico.

As áreas de acompanhamento, objetivos, cronologia, avaliações, evolução, agenda, privacidade e integração manual NutriTrack mantêm os componentes e as condições de acesso anteriores. A apresentação de formulários, cronologia e marcações fica coerente com as novas superfícies da dashboard. Nutrição permanece na demonstração atual; os seus ficheiros e contratos não são modificados.

## Contexto autorizado e rascunhos

`StudentContext` lê apenas `status`, `responsible_id` e `next_review` de `client_followups`, com filtros explícitos por organização e aluno. Não copia o objetivo livre nem notas privadas para o cabeçalho. Os nomes vêm da lista profissional já existente quando é necessário resolver um responsável.

O componente só é montado dentro de `followup_read`; confirma a competência antes e depois da leitura. Erro, revogação ou resposta de outro contexto não apresenta metadados. Os pedidos têm prazo de oito segundos e são cancelados ao mudar de contexto. Sem registo, mostra “Sem acompanhamento registado”, sem inventar estado ativo ou data. A leitura é uma fotografia do estado guardado, não um serviço de atualização em tempo real.

Guardar acompanhamento mantém a mesma RPC, revisões, confirmações e tratamento de conflitos. Um callback de sucesso atualiza apenas a leitura do cabeçalho, sem desmontar o editor. Atualizar o contexto não recarrega nem substitui os rascunhos do formulário. A mudança de secção continua a passar pelo `changeView`/`leaveDraft` existentes; não há navegação paralela que os contorne.

Nenhuma alteração a Auth/RLS, grants, atribuições, competências instaladas, migrations ou regras de escrita. A autorização efetiva continua a pertencer ao banco. Não se utilizaram bases pessoais ou dados reais.

## Referência e adaptações

A referência visual recebida foi a [dashboard aprovada](review/daily-dashboard/reference.png). Não foi anexada uma imagem adicional da ficha nesta fase; o interior deriva da mesma linguagem Dark Premium, verde-petróleo, superfícies, tipografia e hierarquia, e dos princípios fornecidos. Não se alega correspondência com uma referência de ficha que não foi recebida.

Foram excluídos fotografias reais de alunos, interpretações clínicas, novos índices corporais, planos automáticos, mensagens e sincronização. As ações visíveis encaminham para fluxos existentes. Não se acrescentou uma coleção de gráficos duplicados: o resumo apresenta uma medição escolhida de cada vez, e a exploração completa permanece na secção Evolução. A agenda mantém filtros de período/estado/profissional e as ações permitidas.

## Evidência visual

Capturas reais Chromium local com fixtures exclusivamente fictícias. Pares com a mesma fixture de base:

| Ecrã | Antes desktop / mobile | Depois desktop / mobile |
| --- | --- | --- |
| Resumo | [1440](review/student-hub/before/profile-1440.png) / [375](review/student-hub/before/profile-375.png) | [1440](review/student-hub/after/baseline-profile-1440.png) / [375](review/student-hub/after/baseline-profile-375.png) |
| Avaliações | [1440](review/student-hub/before/assessments-1440.png) / [375](review/student-hub/before/assessments-375.png) | [1440](review/student-hub/after/baseline-assessments-1440.png) / [375](review/student-hub/after/baseline-assessments-375.png) |
| Evolução | [1440](review/student-hub/before/evolution-1440.png) / [375](review/student-hub/before/evolution-375.png) | [1440](review/student-hub/after/baseline-evolution-1440.png) / [375](review/student-hub/after/baseline-evolution-375.png) |
| Acompanhamento | [1440](review/student-hub/before/care-1440.png) / [375](review/student-hub/before/care-375.png) | [1440](review/student-hub/after/baseline-care-1440.png) / [375](review/student-hub/after/baseline-care-375.png) |
| Objetivos | [1440](review/student-hub/before/objectives-1440.png) / [375](review/student-hub/before/objectives-375.png) | [1440](review/student-hub/after/baseline-objectives-1440.png) / [375](review/student-hub/after/baseline-objectives-375.png) |

A agenda de base anterior é a página geral, não a agenda dentro da ficha; não se apresenta como um par equivalente. Capturas suplementares mostram a agenda do aluno, cronologia, responsável/revisão e quatro medições inventadas: [resumo desktop](review/student-hub/after/overview-1440.png), [mobile](review/student-hub/after/overview-375.png), [agenda](review/student-hub/after/agenda-375.png), [cronologia](review/student-hub/after/timeline-375.png). Existem também larguras 320/1280, estado vazio e erro de contexto na mesma pasta.

Na inspeção inicial foi detetada altura vazia excessiva devido ao posicionamento da navegação na grelha. Corrigiu-se com uma área de corpo explícita e repetiram-se as capturas. Foram também corrigidas fontes herdadas inconsistentes nos campos. Em mobile o resumo e o gráfico são sequenciais; há scroll deliberado para preservar legibilidade e a tabela acessível, sem alegar equivalência à densidade de um conceito estático.

## Validação reproduzível

```text
npm run lint
npm run typecheck
npm run build
node --import tsx --test --test-concurrency=1 tests/*.test.ts
npx playwright test --workers=2
npm audit --json
```

Dezanove testes novos cobrem resumo/acompanhamento/evolução/agenda/cronologia em desktop e mobile, larguras 320/1280, atualização do cabeçalho após guardar, acesso restrito sem leitura do acompanhamento, erro/retoma, disclosure por teclado, resposta atrasada de outra organização, revogação durante leitura e ausência de medições distinguida de zero. Os testes existentes continuam a verificar rascunhos, conflitos, logout, paginação e proveniência NutriTrack. Resultados e SHA final são apresentados no PR.

Leitores de ecrã, zoom nativo, Safari e Firefox continuam por validar. E2E com fixtures não equivale a Auth/PostgREST cloud real; PostgreSQL/RLS local é reportado separadamente. A revisão estética continua independente.

Sem publicação, custos, recursos ou migrations. Mantêm-se abertos os bloqueios altos de autenticação/passwords comprometidas, sessões/JWT, recuperação operacional cloud, recuperação de conta/MFA e RGPD/retenção. Não autoriza piloto comercial ou dados reais.

Resultados locais finais: lint, TypeScript e build aprovados; domínio/PostgreSQL 97/97; Chromium 238/238 (2,8 minutos); npm audit: zero vulnerabilidades. /alunos/[id]: First Load JS 206 kB, partilhado 103 kB. Sem novas dependências. O contexto acrescenta 3 leituras (ou 4 quando resolve outro profissional), sem novos endpoints ou persistência; os testes de acesso e respostas antigas cobrem essa integração de leitura.
