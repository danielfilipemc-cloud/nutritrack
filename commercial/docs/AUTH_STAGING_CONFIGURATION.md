# Configuração Auth do staging — verificação e pendências

Destino exclusivo: `vgbwmamntjmhzrpvhxzb`. Nunca executar estes passos no projeto pessoal ou em produção.

## Observado em 17/10/2026

`scripts/staging-auth-readiness.ts` consulta apenas settings públicos, com chave publicável: signup ativo, confirmação de email ativa, email provider ativo, anonymous users desativado. Settings públicos **não** demonstram Site URL, allowlist, força de password, refresh rotation, JWT expiry ou sessão. Os testes Auth reais observaram JWT de 3600s na cloud e 900s localmente. O advisor reporta passwords comprometidas desativadas.

O probe `staging-recovery-link-probe.ts` gera um link **sem enviar email**, exclusivamente para uma conta de auditoria fictícia sem atribuição, e extrai apenas a origem de redirect. O valor observado foi `http://localhost:3000`, diferente de `https://aura-business-staging.onrender.com`. Não guarda/imprime o link ou token, não o consome e não muda password. Uma repetição gera um novo token para a mesma conta fictícia; não é uma consulta totalmente sem efeitos.

O conector não disponibiliza alteração da configuração Auth. A tentativa de ligação ao painel pelo Browser falhou no arranque da integração; não se pediram nem expuseram credenciais administrativas. A correção do Site URL foi pedida ao responsável enquanto o desenvolvimento prossegue.

## Alterações a verificar no painel, sem novas credenciais

1. Em [URL Configuration](https://supabase.com/dashboard/project/vgbwmamntjmhzrpvhxzb/auth/url-configuration), Site URL = `https://aura-business-staging.onrender.com`. Confirmar a allowlist necessária aos percursos realmente implementados; usar URLs exatas de staging, incluindo os convites profissional/aluno. Não misturar produção, outros projetos ou wildcard irrestrito. Um callback de recuperação futuro deve ser implementado e testado antes de o acrescentar.
2. JWT expiry = 900s; refresh token rotation ativa, janela de reuse revista; definir limites de inatividade/duração absoluta compatíveis com plano e uso. Alterar TTL não encurta os JWT já emitidos: documentar revogação/suspensão e janela de transição. Uma sessão antiga com grants válidos pode conservar acessos sem a nova política MFA até expirar.
3. Password mínima 12 caracteres, regras adequadas, email confirmado, alteração de email/password com verificações seguras. Verificar no painel, não inferir das passwords fortes das fixtures ou de `email_confirm=true` na criação administrativa de teste.
4. Resolver leaked password protection. A [documentação atual](https://supabase.com/docs/guides/auth/password-security#password-strength-and-leaked-password-protection) indica disponibilidade em Pro ou superior. Decidir plano/custo ou alternativa/restrição e registar decisão de risco. Não houve upgrade nem chamada de billing nesta entrega.
5. TOTP enroll/verify ativos. Na aplicação, `/seguranca` permite configurar e confirmar. O owner autenticado com AAL2 recente ativa a exigência em cada organização do piloto. **Configurar TOTP sem ativar a política não torna MFA obrigatório.** As novas organizações de testes de segurança têm a exigência ativa; não houve backfill/bloqueio global das restantes.
6. Decidir se signup permanece público. Foi mantida a escolha anterior do utilizador; nenhum signup dá acesso automático a outra organização. Antes do piloto, rever também provedores, SMTP/domínios, rate limits, proteção de bots e método de suporte. Não mudar opções de produção por analogia.

## Ensaios de fecho

- `test:auth:staging:readiness`: repetir observações públicas. Campos não expostos continuam a exigir evidência do painel/configuração.
- `staging-recovery-link-probe.ts`: após correção, repetir contra a mesma identidade fictícia autorizada; `matches=true` confirma apenas a origem por omissão. Não prova allowlist, entrega, consumo, PKCE ou recuperação completa.
- Confirmar email/recuperação num destino de email de teste controlado e numa interface com fluxo implementado, mantendo tokens fora de logs. O MVP atual não tem recuperação autónoma de password completa no frontend. O ensaio local anterior via Mailpit não equivale a entrega cloud.
- `test:audit:staging`: regressão real de oito grupos Auth/RLS/concorrência/MFA; `--cloud` requer confirmação do ID exato e manifesto de restauro. Usar apenas configurações privadas já autorizadas, sem `.env` de produção ou fallback histórico.
- Chromium real local inclui password, desafio TOTP na interface e alteração de política com AAL2. O equivalente cloud completo e o procedimento assistido de dispositivo perdido permanecem gates para piloto.
