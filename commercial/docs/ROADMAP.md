# AURA Business — estado e próximos passos

## Base existente em saas-foundation

Login, membership/RLS, avaliações e gráficos, branding, diretório paginado,
edição/arquivo/reativação com audit trail, equipa e convites pessoais de uso único.
Demonstração publicada no Render, apenas dados fictícios.

## Entrega por PR: workspace profissional

Dashboard com agregados completos e acompanhamento pendente, ficha individual,
componentes comuns, contraste White Label corrigido, stamp de branding no servidor,
confirmação de revogação, 13 testes PostgreSQL/domínio e Chromium ampliado.
CI testa o build local do PR; três cenários Auth reais opcionais e independentes.
Consultar PROFESSIONAL_WORKSPACE.md para decisões, evidência e ordem de publicação.

## Integração desta entrega

Rever PR e CI, integrar em saas-foundation, aplicar a sétima migração exclusivamente
no Supabase AURA e validar o RPC pela API real antes de publicar a demonstração.
Não alterar NutriTrack pessoal nem main.

## Próximas prioridades antes de piloto

1. Segurança Auth: proteção de passwords comprometidas, antiabuso/limites de email,
   sessões, MFA e testes de revogação/refresh em condições reais.
2. Privacidade: consentimento, minimização, retenção, exportação/apagamento e backups
   com restauração testada. Continuar apenas com dados fictícios.
3. Correção auditável de avaliações e nomes legíveis dos profissionais no histórico.
4. Acompanhamento configurável e agendamento explícito, sem inferências clínicas.
5. Storage seguro para logótipo; depois portal de alunos, domínios por tenant e pagamentos.
6. QA com outros browsers, leitores de ecrã e testes de carga/planos SQL.
