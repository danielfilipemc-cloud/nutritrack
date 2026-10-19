# Experiência AURA Premium — proposta para revisão independente

Base: `saas-foundation`, `c7bdc3461dd3ac2dc1bea07e0a676745f08697e5`. Branch isolada: `design/aura-premium-experience`. Sem merge ou publicação. Apenas `commercial/`.

## Diagnóstico e alterações

O login anterior apresentava um cartão isolado, sem composição própria para desktop. A navegação usava marcadores genéricos e os vários níveis de superfícies, formulários e tabelas tinham pouca diferenciação. O cabeçalho do dashboard repetia uma faixa de marca a toda a largura antes dos indicadores.

- Login: composição desktop em duas colunas, mensagem e ambiente gráfico AURA estático, formulário com hierarquia própria e acessos existentes à demonstração e área do aluno. Mobile tem composição empilhada própria e omite a ilustração e a lista decorativa. Não existem novos botões sem implementação.
- Sidebar: ícones SVG decorativos distintos nos oito módulos, melhor indicação da página atual e grupos de navegação. O menu mobile continua a usar `details` nativo e não introduz um modal nem armadilha de foco.
- Dashboard: marca do estabelecimento compacta junto ao título, indicadores com ícones e valores existentes, filtros de prioridades organizados em segmentos. Nenhum indicador ou tendência foi inventado.
- Diretório e ficha: identidade por iniciais derivadas apenas do nome já autorizado, alinhamentos, estados e superfícies consistentes; secções e formulários existentes preservados.
- Avaliações/evolução: preenchimento subtil sob a série real, sem alterar coordenadas, valores ou tabela acessível. Cada gradiente tem ID próprio.
- Agenda, acompanhamento, objetivos, equipa e marca: padrões comuns de cartões, formulários, tabelas, bordas, controlos e espaçamento. A cronologia conserva o limite de scroll e os mecanismos de paginação/foco existentes.

`premium.css` é uma camada delimitada a `.aura-entry` e `.aura-workspace`. Mantém #137F79 e não substitui as variáveis `--brand-*` dos estabelecimentos. Não foram modificados logótipos, contratos, handlers de autenticação, políticas, migrations ou dependências. Não se misturam incrementos de Nutrição.

A imagem adicional da proposta de login não foi disponibilizada. Esta composição é uma interpretação para revisão das referências Final 1/Final 2 já fornecidas, não uma reprodução alegadamente exata de uma referência ausente. O brilho fica nos elementos gráficos decorativos; não há animação ambiente.

## Evidência visual

Capturas reais de Chromium local, com fixtures fictícias interceptadas; não são mockups nem sessões cloud. Os pares desktop/mobile dos módulos usam o mesmo cenário de teste antes/depois. As capturas de login anteriores provêm da revisão de branding com a mesma árvore de aplicação da base acima. Datas visíveis dependem do dia de execução.

| Ecrã | Antes desktop / mobile | Depois desktop / mobile |
| --- | --- | --- |
| Login | [1440](review/premium-experience/before/login-1440.png) / [375](review/premium-experience/before/login-375.png) | [1440](review/premium-experience/after/login-1440.png) / [375](review/premium-experience/after/login-375.png) |
| Dashboard | [1440](review/premium-experience/before/dashboard-1440.png) / [375](review/premium-experience/before/dashboard-375.png) | [1440](review/premium-experience/after/dashboard-1440.png) / [375](review/premium-experience/after/dashboard-375.png) |
| Diretório | [1440](review/premium-experience/before/directory-1440.png) / [375](review/premium-experience/before/directory-375.png) | [1440](review/premium-experience/after/directory-1440.png) / [375](review/premium-experience/after/directory-375.png) |
| Ficha | [1440](review/premium-experience/before/profile-1440.png) / [375](review/premium-experience/before/profile-375.png) | [1440](review/premium-experience/after/profile-1440.png) / [375](review/premium-experience/after/profile-375.png) |
| Avaliações | [1440](review/premium-experience/before/assessments-1440.png) / [375](review/premium-experience/before/assessments-375.png) | [1440](review/premium-experience/after/assessments-1440.png) / [375](review/premium-experience/after/assessments-375.png) |
| Evolução | [1440](review/premium-experience/before/evolution-1440.png) / [375](review/premium-experience/before/evolution-375.png) | [1440](review/premium-experience/after/evolution-1440.png) / [375](review/premium-experience/after/evolution-375.png) |
| Agenda | [1440](review/premium-experience/before/agenda-1440.png) / [375](review/premium-experience/before/agenda-375.png) | [1440](review/premium-experience/after/agenda-1440.png) / [375](review/premium-experience/after/agenda-375.png) |
| Objetivos | [1440](review/premium-experience/before/objectives-1440.png) / [375](review/premium-experience/before/objectives-375.png) | [1440](review/premium-experience/after/objectives-1440.png) / [375](review/premium-experience/after/objectives-375.png) |
| Acompanhamento | [1440](review/premium-experience/before/care-1440.png) / [375](review/premium-experience/before/care-375.png) | [1440](review/premium-experience/after/care-1440.png) / [375](review/premium-experience/after/care-375.png) |
| Marca | [1440](review/premium-experience/before/brand-1440.png) / [375](review/premium-experience/before/brand-375.png) | [1440](review/premium-experience/after/brand-1440.png) / [375](review/premium-experience/after/brand-375.png) |
| Vazio | [1440](review/premium-experience/before/empty-1440.png) / [375](review/premium-experience/before/empty-375.png) | [1440](review/premium-experience/after/empty-1440.png) / [375](review/premium-experience/after/empty-375.png) |
| Erro | [1440](review/premium-experience/before/error-1440.png) / [375](review/premium-experience/before/error-375.png) | [1440](review/premium-experience/after/error-1440.png) / [375](review/premium-experience/after/error-375.png) |

Capturas suplementares após a alteração: login 320/768 px; equipa, definições e cronologia 375/1440 px; evolução com quatro medições em `review/premium-experience/after/`. Estas não constituem pares antes/depois.

Inspeção visual: composição desktop mais definida; formulário mobile separado do ambiente gráfico; navegação e ações existentes legíveis; ausência de overflow de página nos cenários testados. Tabelas extensas continuam a ter scroll horizontal interno em mobile, incluindo equipa. Os formulários de objetivos/agenda continuam extensos por preservarem o fluxo existente; não se alega eliminação de todo o scroll. No dashboard desktop, o início das prioridades passa aproximadamente de y=480 para y=469; a altura total não diminui (1423 → 1478 px no cenário), devido ao espaçamento. O benefício é hierarquia, não uma alegada redução global de conteúdo.

Durante a revisão foram corrigidos um overflow do título mobile (espaço entre palavras quando a quebra desktop é ocultada), superfícies inicialmente demasiado verdes e a disposição do cabeçalho quando a leitura da marca falha. O teste negativo da marca confirma a recuperação sem overflow a 1024 px.

## Validação reproduzível

Executar em `commercial/`, com configuração de testes local e sem flags de Auth cloud:

```text
npm run lint
npm run typecheck
npm run build
node --import tsx --test --test-concurrency=1 tests/*.test.ts
npx playwright test --workers=2
npm audit --json
```

Resultados finais e CI são registados na descrição do PR com o SHA exato. Chromium completo: 198/198 (2 minutos); domínio/PostgreSQL local: 97/97. Auditoria npm: zero vulnerabilidades. Lint, TypeScript e build aprovados. Quinze testes novos cobrem login 320/375/768/1440, teclado, contraste calculado de controlos, carregamento/erro de autenticação com fixtures, oito módulos mobile, equipa/definições/cronologia, movimento reduzido, erro da marca e integridade da série/tabela. A suite completa preserva os testes anteriores de rascunhos, permissões, respostas atrasadas, logout, conflitos e proveniência NutriTrack. Foram confirmados os hashes dos sete ficheiros pessoais protegidos e a ausência de alterações em `lib`, Supabase, assets da marca e dependências.

Uma primeira execução completa teve 195 aprovações e uma falha no login de preparação de um teste de rascunhos. A trace registou `net::ERR_CONNECTION_FAILED` num chunk JavaScript do servidor local, antes do cenário. O mesmo teste foi repetido três vezes: 3/3 aprovados. Não foi alterada autenticação, aumentado timeout ou ocultada a falha para obter aprovação. A repetição completa deve ser avaliada juntamente com este registo; a causa externa do carregamento local não é declarada definitivamente resolvida.

Desempenho: build de produção com First Load JS da rota `/` cerca de 181 kB (base 180 kB), partilhado 103 kB. Sem novas dependências, fontes externas ou bitmaps de ambiente. Não foi executado Lighthouse nem ensaio de latência real; estes números não são uma certificação de desempenho.

## Limitações e bloqueios preservados

Os testes E2E usam fixtures; não demonstram Auth/PostgREST real nem substituem testes RLS. A suite local PostgreSQL é distinta dessa validação remota. Contraste e foco foram amostrados/testados, sem certificação WCAG. Leitores de ecrã, zoom nativo, Safari e Firefox permanecem por validar; testes de reflow/CSS não equivalem a esses ensaios. A aprovação estética compete à revisão independente das capturas.

Mantêm-se abertos os bloqueios altos: proteção contra passwords comprometidas; sessões/JWT; recuperação operacional cloud; recuperação de conta/MFA; RGPD e retenção. Esta alteração não os resolve nem autoriza dados reais ou piloto comercial. Nenhuma publicação, migration remota ou alteração de produção faz parte desta entrega.
