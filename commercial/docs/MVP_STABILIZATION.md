# Estabilização do MVP — 2026-11-04

## Base e limites

Incremento isolado sobre o PR #77 (`6dcb8fd966689a59aaeaaba0dc417247be803010`), que preserva a linha funcional `integration/aura-staging` em `5f8f99162c5e60e137bd90f1ea81aea66813cf31`. Os PRs históricos abertos não demonstram ausência do respetivo código nessa linha. A reconciliação com `saas-foundation` exige revisão própria; não reintroduzir versões antigas de módulos ou dependências.

Não há merge, deploy, migrations, alteração de Auth/RLS instalado, backup remoto, dados reais ou novos recursos. A única exceção ao âmbito `commercial/` é o workflow exclusivo `.github/workflows/aura-commercial.yml`: os dois jobs passam de `ubuntu-latest` para `ubuntu-24.04`. Não se altera o workflow de backup nem qualquer publicação.

## Problemas reproduzidos e correções

1. **CI Chromium não arrancava.** O run 41911751155 do PR #77 instalou Ubuntu 26.04 e o Playwright 1.58.2 recusou essa plataforma antes de executar testes. Fixar o runner suportado torna a dependência de SO explícita. Uma futura atualização de SO/Playwright exige revisão conjunta. Não substituir a falha por skip, `continue-on-error` ou instalação sem dependências.
2. **Indicador MFA desatualizado ao regressar à janela.** O teste novo em `e2e/security.spec.cjs` falhou na versão anterior: o número de leituras da política não aumentava após focus. `SecurityRequirement` passa a revalidar a política nesse evento, com estado loading e a mesma proteção de versão/unmount. Erro de rede continua erro, nunca dispensa MFA. Não há polling, garantia de atualização imediata numa janela continuamente aberta, nem novo mecanismo de autorização: o banco continua a decidir cada operação.

O PR #77 já cobre o contexto guardado da ficha e a preservação do rascunho após focus; este incremento não desmonta os formulários nem altera os seus contratos.

## Matriz de aceitação e evidência exigida

| Gate | Evidência técnica existente / próxima validação | Condição para fechar |
| --- | --- | --- |
| CI reprodutível | Lint, domínio/PostgreSQL embebido, TypeScript, build, audit e Chromium em Ubuntu 24.04 | Ambos os jobs aprovados no head candidato; resultado final no PR |
| Percursos e rascunhos | `workspace`, `profile-mvp`, `student-hub`, `premium-navigation`, `session` e suites de avaliações/acompanhamento/agenda | Regressão completa sem falhas; cancelamento de saída, conflitos e resultados incertos preservados |
| Respostas atrasadas | Suites de workspace/ficha/privacidade/segurança | Tenant antigo não repovoa o atual; sem controlos indevidos ou aplicação de gravações antigas |
| SQL e isolamento | `security-catalog`, `audit-security` e testes nutricionais em PGlite descartável | RLS/grants/wrappers e revogações aprovados; distinguir Auth emulado de GoTrue real |
| Auth real | Runners dedicados locais/staging já existentes, com manifesto e confirmação de destino | Execução futura controlada, no artefacto exato, com todos os papéis, AAL1/AAL2, logout e mesmo JWT após revogação |
| Passwords comprometidas | Configuração efetiva por confirmar; documentação do fornecedor consultada em 04/11 | Proteção verificada ou decisão explícita de risco/medidas; não fechar só por validar comprimento no cliente |
| Sessões/JWT | SQL testa sessões/políticas; configuração cloud e limites continuam por validar | TTL/rotação/limites aprovados, medidos e testados; logout não equivale a invalidação criptográfica de JWT |
| Recuperação de conta/MFA | Procedimento em `MFA_ASSISTED_RECOVERY_AND_ACTIVATION.md` | Identidade/dupla aprovação decididas e ensaio completo sem bypass; reenrolamento não significa perda de proteção |
| Recuperação operacional | `RECOVERY_OPERATIONS.md`; trabalho ops/PR #76 separado | Restauro cloud isolado de Auth/DB/configuração e Storage se aplicável; RPO/RTO medidos e revistos |
| Nutrição persistente | Contratos/cálculos e adaptadores preparados, não ativados por este incremento | Revisão do schema/exportação/snapshots/idempotência e ensaio Auth real antes de ativação separada |
| Acessibilidade | Chromium/teclado/responsividade com fixtures | Ensaios reais de leitor de ecrã, zoom nativo, Safari e Firefox ainda necessários; não os inferir do Chromium |
| Privacidade/comercial | Proposta de retenção/exportação e fluxo auditável de pedidos | Aprovação jurídica e operacional: responsáveis, bases, contratos, retenção, direitos e incidentes |

Capturas opt-in omitidas não são testes visuais aprovados. Os testes normais não incluem ficheiros `auth*.spec.cjs`; executá-los exige o runner e o ambiente próprios. Não ativar `AURA_E2E_LIVE` ou flags cloud para contornar um ambiente local indisponível. Não usar runners históricos contra produção.

## Decisões externas, sem pedido de credenciais

- **Responsável:** política de duração/inatividade de sessões, risco de passwords comprometidas e custo aceitável. Não aumentar planos. O fornecedor documenta proteção de passwords comprometidas e controlos avançados de sessão com limitações de plano; confirmar disponibilidade atual antes de qualquer proposta de alteração.
- **Responsável e jurídico:** bases de tratamento, retenção, contrato, suporte, verificação de identidade para recuperação e comunicação de incidentes. Não executar eliminação definitiva nem recolher dados reais para desbloquear estas decisões.
- **Responsável operacional:** aprovar RPO/RTO e um ensaio de recuperação com origem/destino sintéticos explicitamente identificados. Aprovação de testes de cifragem não é prova de recuperação cloud.
- **Desenvolvimento:** fechar CI e regressões, preparar evidências e corrigir defeitos reproduzidos. Alterações de configuração remota e ativações exigem plano e autorização separados.

Fontes oficiais: [password security](https://supabase.com/docs/guides/auth/password-security), [sessions](https://supabase.com/docs/guides/auth/sessions), [signOut](https://supabase.com/docs/reference/javascript/auth-signout). Não se mudou o fornecedor, fluxo de sessão ou biblioteca Auth.

## Critério de entrega

Resultados e SHA final ficam no PR, para não provocar um novo ciclo de CI apenas para atualizar números. Revisão independente sobre esse head é obrigatória antes de integração. Bloqueios altos de passwords comprometidas, sessões/JWT, recuperação cloud, recuperação de conta/MFA e RGPD permanecem abertos. CI aprovado não é certificação de segurança, autorização de publicação ou de piloto com dados reais.
