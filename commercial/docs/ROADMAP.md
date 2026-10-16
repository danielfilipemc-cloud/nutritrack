# AURA Business — estado e próximos passos

Incremento atual: painel diário pesquisável/paginado e evolução integrada na ficha, com cronologia e gráfico sincronizados por período. Ver DAILY_WORKSPACE.md e INTEGRATED_EVOLUTION.md. Treze migrations apenas no sandbox local; staging cloud permanece com onze. Os PRs encadeados continuam por integrar; produção mantém #8. A futura fronteira NutriTrack está documentada e testada, sem sincronização/importação ou nutrição ativa.

## Atualização — 16/10/2026

PR #8 (ficha, acompanhamento e agenda) já integrado/publicado. Não repetir essa implementação. Fundações no PR #9: validação real local de permissões/Auth e recuperação sintética; integração cloud pendente. PR #10: primeiro incremento Aluno 360º sobre a ficha existente, com evolução por período e preview sem conta. Regressão conjunta: 45 testes e 32 Chromium; ver [estado efetivo](INTEGRATION_STATUS.md).

Próximas prioridades: revisão e integração ordenada #9 → #10; staging cloud separado com recuperação demonstrada e Auth configurado; política MFA/sessões e privacidade antes de dados reais. Depois, ampliar Aluno 360º com contratos explícitos de nutrição/medições/evolução para NutriTrack, mantendo tenant/aluno, origem, unidades e competências próprias. Treino, nutrição, mensagens e sincronização ainda não são módulos concluídos.

As secções seguintes descrevem a evolução histórica; o bloco de ficha e agenda já está entregue, e a correção auditável pertence às fundações.

## Base existente em saas-foundation

Login, membership/RLS, avaliações e gráficos, branding, diretório paginado,
edição/arquivo/reativação com audit trail, equipa e convites pessoais de uso único.
Demonstração publicada no Render, apenas dados fictícios.

## Workspace profissional publicado (PR #7)

Dashboard com agregados completos e acompanhamento pendente, ficha individual,
componentes comuns, contraste White Label corrigido, stamp de branding no servidor,
confirmação de revogação, 14 testes PostgreSQL/domínio e Chromium ampliado.
CI testa o build local do PR; três cenários Auth reais opcionais e independentes.
Consultar PROFESSIONAL_WORKSPACE.md para decisões, evidência e ordem de publicação.

## Novo bloco: ficha, acompanhamento e agenda

Objetivo/estado/responsável/revisão, resumo de evolução, agenda por aluno e geral,
slots sem sobreposição, presença/cancelamento/reagendamento e prioridades do dia.
Ver FOLLOWUP_AGENDA.md para regras, testes e sequência de publicação da oitava
migração. NutriTrack pessoal e main permanecem fora do desenvolvimento.

## Próximas prioridades antes de piloto

1. Segurança Auth: proteção de passwords comprometidas, antiabuso/limites de email,
   sessões, MFA e testes de revogação/refresh em condições reais.
2. Privacidade: consentimento, minimização, retenção, exportação/apagamento e backups
   com restauração testada. Continuar apenas com dados fictícios.
3. Correção auditável de avaliações e nomes legíveis dos profissionais no histórico.
4. Recorrência, notificações e configuração de fuso por estabelecimento, após validar o bloco de agenda.
5. Storage seguro para logótipo; depois portal de alunos, domínios por tenant e pagamentos.
6. QA com outros browsers, leitores de ecrã e testes de carga/planos SQL.
