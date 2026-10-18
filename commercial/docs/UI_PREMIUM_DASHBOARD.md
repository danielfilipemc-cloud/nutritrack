# Refinamento Premium — dashboard e padrões profissionais

Base auditada: `659103254bcc89cda18b5823a76e548a5793e327`. Apenas `commercial/`. Este incremento não autoriza merge, publicação ou piloto.

## Diagnóstico confirmado

Com as mesmas fixtures locais (3 objetivos, 2 sessões e cronologia sintética), o início das prioridades estava a 666 px no desktop 1440×1000 e a 1414 px no mobile 375×812. O dashboard completo media 2361/4631 px. Não são métricas de desempenho nem dados de utilização real.

As causas eram cumulativas: cabeçalhos/marca altos, KPIs com padding excessivo, cartão separado para atalhos, filtros empilhados, explicação longa antes das filas, registos com borda/cartão individual e tabelas secundárias repetindo o trabalho já destacado na fila. `margin:auto` herdado por `.shell` também centrava verticalmente páginas curtas no grid, desalinhando cabeçalhos entre módulos.

## Decisões

- Preservar as chamadas RPC, parâmetros, totais autorizados, scopes de resposta e isolamento por utilizador/organização. Nenhum SQL, grant, policy, MFA ou contrato alterado.
- Unificar ritmo vertical, raio e altura mínima dos controlos em tokens locais de `workspace.css`; aplicar todos os seletores dessa camada exclusivamente dentro de `.aura-workspace`. Os estilos históricos de `/demo`, acesso e portal não foram reescritos.
- KPIs compactos com todas as descrições; atalhos como links discretos com alvo mínimo de 44 px. Preservar os cinco destinos e omitir gestão quando o papel existente é coach.
- Manter prioridades e agenda lado a lado no desktop; filtros alinhados, contexto longo em disclosure e todas as contagens/funções preservadas. No mobile, uma coluna e três KPIs compactos.
- Filas com viewport limitado e foco por teclado, aviso visível de deslocação quando há vários resultados; paginação continua no servidor, 25 por página. Não truncar nem descartar resultados.
- Tabelas secundárias em disclosures nativos fechados inicialmente, acessíveis por teclado. A lista detalhada continua disponível sem concorrer visualmente com o trabalho do dia.
- Padrões CSS de badge, ações de linha, paginação, resumo e formulário são partilhados pela continuação CRM/Aluno 360º; não são novas capacidades de negócio.

## Verificação reproduzível

`e2e/dashboard-density.spec.cjs` verifica início das prioridades em 375/1280/1440 px, ausência de overflow, link de trabalho dentro da primeira área desktop, disclosure por teclado e separação da demonstração pública. Os testes de dashboard existentes continuam a cobrir erros, respostas atrasadas e os destinos/competências dos atalhos. `e2e/workspace.spec.cjs` foi adaptado à abertura explícita das tabelas secundárias, mantendo as verificações de isolamento e histórico.

A continuação `UI_PREMIUM_REFINEMENT.md` regista comparações finais, capturas, resultados e limitações da cadeia. Aprovação automática de testes não substitui inspeção visual nem revisão independente. Manter abertos H-01 passwords comprometidas, H-02 sessões/JWT, H-03 restauro operacional cloud, H-04 recuperação de conta/MFA e H-05 RGPD/retenção/consentimentos. Não foram usados dados reais nem alterados recursos cloud.
