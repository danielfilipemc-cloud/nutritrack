# Integração técnica PR #25 e PR #26 — 2026-10-18

## Estado efetivo de saas-foundation

| PR | Head verificado antes de integrar | Base | Merge |
|---|---|---|---|
| #25 | `05edd09b0d9329572176e7bd4a5a81adf0642cb0` | `saas-foundation` em `659103254bcc89cda18b5823a76e548a5793e327` | `634f3add9c923bbd0bfea51c6f45045d06e81e7e` |
| #26 | `3a6314506aa76ddf3e212c7f3d47f3dffb1d0cc0` | Originalmente `feat/aura-premium-density`; alterada para `saas-foundation` após #25 | `16e05143ec0b648b22240bd404e948375f27e2cf` |

Revisão final integrada: **`16e05143ec0b648b22240bd404e948375f27e2cf`**. Árvore Git: `9aedb050cf5a0c89984f1443188762520fb419a5`, idêntica à candidata `3a63145`. `git diff 3a63145 16e0514` vazio. Sem commits de implementação duplicados, alterações fora de `commercial/` ou modificações de migrations.

Os heads foram novamente confirmados nas operações de merge, com expected-head SHA. CI anterior #25 `39116614314` e #26 `39117081658` aprovado. A árvore prevista foi comparada antes do segundo merge. O CI do SHA integrado, [39117945769](https://github.com/danielfilipemc-cloud/nutritrack/actions/runs/39117945769), passou `validate` e `local-browser`.

Antes de integrar foi confirmado por leitura que `aura-business-demo` e `aura-business-staging` tinham autoDeploy desligado. Nenhum deploy foi disparado; `integration/aura-staging` permaneceu em `659103254bcc89cda18b5823a76e548a5793e327`. Produção, `main`, NutriTrack pessoal, configurações, migrations e dados reais não foram alterados.

## Validação local sobre a revisão integrada

- Lint PASS; TypeScript PASS; build PASS.
- Domínio/PostgreSQL: **73/73 PASS**, execução sequencial para evitar o incidente nativo Windows anteriormente documentado.
- Chromium: **158/158 PASS**; inclui diretório, criação/edição, rascunhos, conflitos, logout/operações pendentes, respostas atrasadas, competências, proveniência/importação manual NutriTrack, teclado e responsividade.
- npm audit: **0 vulnerabilidades**; lockfile inalterado.
- Fixtures interceptadas e PGlite; não são novos testes Auth/PostgREST cloud nem prova de segurança em produção.
- Mantém-se o aviso conhecido sobre deteção do plugin Next no ESLint; o lint explícito passou.

Logs reproduzíveis locais em `.aura-integration/integration-pr25-26/`: `lint.log`, `domain.log`, `types.log`, `build.log`, `audit.json`, `chromium.log`. Estes logs não devem ser confundidos com os logs da correção proposta.

## Verificações adicionais e achados confirmados

Disclosures do dashboard e diretório: rótulos visíveis, abertura/fecho com Enter/Space e chegada a «Editar» com Tab. Cronologia mobile: deslocação por End, 25→31 registos pelo comando alcançado com Tab e ativado com Enter; saída por Shift+Tab. A tabela alternativa do gráfico abre por teclado.

Os novos testes negativos detetaram **dois achados médios no candidato integrado**, que os 158 testes anteriores não cobriam:

1. **Gráfico estreito:** a regra histórica de demonstração `min-width:280px` chegava ao SVG profissional num contentor de 254 px. O documento não transbordava, mas o gráfico exigia deslocação horizontal interna. Antes da correção, o teste recebeu 280 px para um limite de 255 px.
2. **Fim da cronologia:** ao carregar a última página, o botão desaparecia e o foco regressava ao `BODY`, perdendo a posição no histórico. O teste confirmou o foco perdido, apesar de ser possível voltar a focar a lista manualmente.

Estes achados não foram ocultados nem corrigidos diretamente na revisão aprovada: a integração autorizada mantém a árvore candidata intacta. A correção está numa branch/PR separado, **pendente de revisão independente e não integrado**.

## Correção proposta, separada da integração

- `.aura-workspace .chartbox svg { min-width:0; }`: remove apenas o mínimo herdado nos gráficos profissionais. Com contentor de 254 px, o SVG passa a medir 254 px, sem scroll horizontal adicional; datas, valores e tabela alternativa permanecem disponíveis. Demonstrações públicas não mudam.
- Cronologia: após acrescentar uma página, foca o link do primeiro registo novo. A recuperação de foco só ocorre se o utilizador ainda estiver no comando original, ou se esse comando tiver desaparecido; uma resposta atrasada não retira o foco de um filtro para onde o utilizador já navegou. A reposição é executada num layout effect após o commit do DOM, verificando novamente o RequestScope. Uma primeira implementação com requestAnimationFrame passou isoladamente mas falhou na suite concorrente; foi substituída para não depender do momento do commit React.
- `e2e/integration-accessibility.spec.cjs`: cinco casos de regressão para largura inferior a 320 px, zoom CSS 200%, paginação/foco mobile, disclosures por teclado e resposta atrasada sem roubo de foco.

Os dois testes estritos falharam na árvore integrada antes da correção; os cinco casos focados passaram na proposta. A suite completa da proposta passou **163/163 testes Chromium**, incluindo os cinco novos casos; lint, TypeScript e build também passaram. O CI da proposta deve ser lido na descrição do respetivo PR, sem atribuir os seus resultados a `saas-foundation`.

Evidência sintética: [antes, gráfico estreito](review/integration-pr25-26/narrow-before.png), [depois](review/integration-pr25-26/narrow-after.png), [cronologia após correção](review/integration-pr25-26/timeline-after.png), [zoom CSS 200%](review/integration-pr25-26/zoom-css-200.png). Os ficheiros JSON adjacentes distinguem os dados anteriores/posteriores.

## Limites que não equivalem a aprovação

- **Zoom:** o teste adicional usa `document.documentElement.style.zoom='2'` no Chromium, verificando rótulos e tabela. É zoom CSS de 200%, não zoom nativo da barra/menus do browser; não reproduz todas as mudanças de media queries do zoom nativo. Esse ensaio manual permanece pendente.
- **Leitor de ecrã:** não executado com NVDA, JAWS ou VoiceOver. Regiões, foco e nomes acessíveis foram testados por automação, sem declarar certificação WCAG ou usabilidade com leitor de ecrã.
- **Safari e Firefox:** não executados. Não extrapolar resultados Chromium para esses motores.
- **Mobile:** viewports Chromium, não dispositivos físicos. Confirmar gesto de deslocação e leitura na revisão visual do staging.
- Nenhuma suite com fixtures substitui autorização do banco ou validação Auth real futura; preservação do código/RLS e resultados PGlite não encerram os bloqueios de segurança.

## Prontidão e próximos passos

A integração técnica está concluída e validada. **Recomenda-se rever e integrar a correção adicional antes de publicar o novo candidato em staging**, devido aos dois achados médios de usabilidade. Este relatório não autoriza esse merge nem um deploy. A revisão adicional deve confirmar largura estreita, foco após paginação e ausência de roubo de foco; depois repetir validação no novo SHA integrado e confirmar o destino staging antes de qualquer publicação.

Nenhum achado crítico/alto novo confirmado nos percursos executados. Permanecem abertos H-01 passwords comprometidas, H-02 política de sessões/JWT, H-03 recuperação operacional cloud, H-04 recuperação completa de conta/MFA e H-05 RGPD/retenção/consentimentos. Sem autorização para dados reais ou piloto comercial.
