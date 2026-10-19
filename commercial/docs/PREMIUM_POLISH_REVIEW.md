# PR #40 — acabamento após revisão visual independente

Referência aprovada de partida: `338d0254026d16f7d7a9e97ff26627a7db7265cd`. Mesma branch `design/aura-premium-experience`, sem novo redesign, merge ou publicação. O login, os ficheiros de branding, os contratos de dados e os mecanismos de autenticação não são alterados por este incremento.

## Alterações e verificação visual

1. **Legibilidade:** metadados do dashboard, ficha, agenda e legendas passam a 13 px em desktop, com cor secundária #BDCEC8. Rótulos dos indicadores a 14 px e valores a 40 px. Em mobile preserva-se a escala compacta dos KPIs; não se força texto desktop em três colunas estreitas. A camada está limitada a `.aura-workspace`; não substitui os tokens White Label.
2. **Dashboard:** ações rápidas com áreas de interação claras, separador e espaçamento próprio; resumo das prioridades em duas colunas para permitir leitura sem comprimir quatro rótulos numa linha; metadados e filtros mais legíveis. Mantêm-se os mesmos indicadores e destinos autorizados. Os painéis de prioridades e agenda continuam lado a lado em desktop. A melhoria de leitura aumenta algum espaçamento; não se alega redução global do scroll.
3. **Cabeçalho mobile:** localização numa linha superior, seletor de estabelecimento e controlos de sessão em duas colunas. Segurança e logout continuam visíveis, com áreas mínimas de 44 px. O teste limita a altura do cabeçalho a menos de 150 px a 375 px, nos três ecrãs capturados. Avisos MFA e erros existentes não são removidos para obter esta compactação.
4. **Agenda mobile:** o acesso à ficha e, quando aplicável, o registo de avaliação continuam visíveis. Edição/reagendamento, conclusão, falta e cancelamento ficam em “Mais ações”, um `details` nativo operável por teclado. Em desktop as ações mantêm-se expandidas. Os controlos ficam montados quando se fecha o grupo; não se reinicia o editor. Não se apresenta disclosure vazio em marcações concluídas ou sem ações autorizadas. Os mesmos handlers, confirmações, condições de escrita e conflitos são preservados.
5. **Ficha:** navegação desktop agrupada em Acompanhamento, Avaliação e dados, e Outras áreas. Nenhuma secção é eliminada: o conjunto é derivado dos itens já filtrados por permissão. Em mobile permanece o seletor de área. O handler que valida rascunhos antes de mudar de secção é o existente.

Capturas reais com fixtures locais fictícias. Os pares usam os mesmos cenários de três objetivos, duas marcações e cronologia sintética. As capturas anteriores foram guardadas antes das alterações, a partir da evidência do head aprovado.

| Área | Antes desktop / mobile | Depois desktop / mobile |
| --- | --- | --- |
| Dashboard | [1440](review/premium-polish/before/dashboard-1440.png) / [375](review/premium-polish/before/dashboard-375.png) | [1440](review/premium-polish/after/dashboard-1440.png) / [375](review/premium-polish/after/dashboard-375.png) |
| Agenda | [1440](review/premium-polish/before/agenda-1440.png) / [375](review/premium-polish/before/agenda-375.png) | [1440](review/premium-polish/after/agenda-1440.png) / [375](review/premium-polish/after/agenda-375.png) |
| Ficha | [1440](review/premium-polish/before/profile-1440.png) / [375](review/premium-polish/before/profile-375.png) | [1440](review/premium-polish/after/profile-1440.png) / [375](review/premium-polish/after/profile-375.png) |

[Agenda com ações abertas e rascunho de edição](review/premium-polish/after/agenda-actions-375.png). As capturas mobile novas usam viewport de 1000 px de altura; as anteriores usavam 812 px. São capturas de página inteira, não uma comparação de dobra idêntica.

## Validação

Comandos executados em `commercial/`, configuração local de teste e sem flags de Auth cloud:

```text
npm run lint
npm run typecheck
npm run build
node --import tsx --test --test-concurrency=1 tests/*.test.ts
npx playwright test --workers=2
npm audit --json
```

O SHA e os resultados finais são apresentados no PR e na entrega. Oito testes novos verificam desktop/mobile, a legibilidade dos metadados, a altura do cabeçalho, a presença dos controlos de sessão, os dez destinos da ficha, grupos de navegação, ausência de overflow, acesso por teclado ao disclosure e preservação do rascunho quando se fecha o grupo ou se cancela uma mudança de secção.

Lint, TypeScript e build aprovados; domínio/PostgreSQL local 97/97; Chromium completo final 207/207 (2,6 minutos); npm audit com zero vulnerabilidades. First Load JS de `/` mantém cerca de 181 kB, partilhado 103 kB. Não foram adicionadas dependências. Foram confirmados os hashes dos sete ficheiros pessoais protegidos e a ausência de diferenças no login, branding, `lib`, Supabase e manifests de dependências relativamente ao head anterior.

Durante o desenvolvimento, o novo teste de rascunho falhou por usar uma procura de label que deixava de resolver o textarea após edição. A trace e o snapshot mostravam o rascunho preservado e a secção correta. A procura foi corrigida para o papel acessível `textbox`, como nos testes existentes; não foi alterada a lógica de rascunhos para fazer o teste passar.

A inspeção da captura da agenda aberta identificou ainda um botão de ficha esticado verticalmente pela grelha. Foi corrigido com alinhamento ao início e acrescentada uma asserção de altura para impedir a regressão. A captura suplementar foi recolhida durante navegação por teclado, pelo que inclui os indicadores de foco/link de salto. A segunda compilação e repetição completa de Chromium incluem esta correção visual final.

## Limites preservados

E2E com fixtures interceptadas e PostgreSQL local não equivalem a Auth/PostgREST cloud real. Não se alterou staging, produção, Auth/RLS, migrations, planos ou dados reais. Leitores de ecrã, zoom nativo, Safari e Firefox continuam por validar. A legibilidade e a organização foram inspecionadas nas capturas, mas a nova aprovação estética é independente.

Mantêm-se abertos os bloqueios altos de passwords comprometidas, sessões/JWT, recuperação operacional cloud, recuperação de conta/MFA e RGPD/retenção. Esta entrega não autoriza piloto comercial ou uso de dados reais.
