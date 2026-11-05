# Recuperação de palavra-passe — candidato de 05/11/2026

Incremento isolado sobre o PR #79 (`68e48286e56b15325f6b66b2391cab537a9ac187`). Sem merge, publicação, migrations ou alterações de Auth/RLS instalado, templates de email, allowlist, serviços, planos ou dados reais. O login aprovado conserva composição/branding; acrescenta apenas uma ligação funcional. A área de recuperação reutiliza o mesmo componente visual.

## Fluxo entregue

1. `/recuperar` pede email e usa `resetPasswordForEmail`, com redirect derivado exclusivamente da origem atual e `/`. Não lê `next`, `redirect` ou URLs introduzidas pelo utilizador. O callback é a página inicial já configurada como Site URL; não se acrescentou um callback remoto.
2. Pedidos aceites e erros de conta/rate limit recebem a mesma mensagem condicional, sem revelar respostas do fornecedor. Falha de transporte/serviço é explícita. Há uma pausa local de 30 segundos antes de repetir pedidos concluídos; isto é UX, não um substituto de rate limiting no servidor ou prova de ausência de enumeração por timing/HTTP no fornecedor.
3. O cliente Supabase único captura a intenção de recuperação antes de inicializar. Só o evento `PASSWORD_RECOVERY` validado pelo SDK abre o formulário. Uma sessão antiga, `INITIAL_SESSION` ou um `SIGNED_IN` isolado não validam uma ligação inválida. A página profissional não é montada durante essa verificação. O estado em memória contém apenas fase/identidade; nenhum token ou password adicional é persistido.
4. Tokens e detalhes de erro são retirados da URL. O marcador não sensível `?recuperacao=1` impede que recarregar silenciosamente transforme um formulário interrompido em dashboard. Recarregar requer uma nova ligação; não se tenta reconstruir um grant a partir de storage. Um callback colado na homepage já aberta provoca nova inicialização do SDK, em vez de aproveitar a sessão anterior.
5. Nova password e confirmação são validadas localmente (mínimo 12; sem trim, truncagem, transformação ou promessa de força). Antes de gravar, confirma-se a identidade no servidor, fatores existentes e nível da sessão. O fornecedor continua autoridade sobre password, sessão e MFA. Fator TOTP verificado em AAL1 exige desafio normal; código errado não faz a gravação. Não há inscrição, remoção ou bypass de fator neste fluxo. Outros fatores não suportados não são retirados para facilitar a recuperação.
6. Após alteração confirmada, limpa campos e tenta logout global, pedindo novo login. Falha de logout é distinta de alteração falhada: não promete revogação confirmada. JWTs previamente emitidos continuam sujeitos à política do servidor/TTL; não se promete invalidação criptográfica imediata.

## Erros, rascunhos e concorrência

Rejeição explícita de password conserva o rascunho em memória, sem imprimir a resposta privada. Perda de acknowledgement é resultado incerto: não repete a gravação automaticamente nem declara falha certa; encaminha para login ou novo pedido. Passwords/códigos não são guardados no browser storage. Logout ou outra identidade invalida o contexto e limpa os campos; resposta tardia não mostra sucesso nesse contexto. Formulário desativado durante operação, proteção de saída/reload e confirmação ao descartar campos. O banco e Auth continuam a autorizar operações pendentes; a UI não consegue cancelar uma alteração já aceite no servidor.

Dois defeitos reproduzidos durante os testes foram tratados: callback na mesma página conservava a sessão anterior; erros de transporte do SDK usam também status 0. A suite cobre ambos. Detalhes brutos de erros e tokens de links inválidos não são apresentados.

## Validação reproduzível

Domínio: `tests/password-recovery.test.ts` cobre classificação de callback, recusa de sessão antiga, identidade/refresh/logout e validação de confirmação. Chromium com fixtures: `e2e/password-recovery.spec.cjs` cobre pedidos/400/429, rede, callback inválido/incompleto, mesmo documento, confirmação, gravação, resultado incerto, rejeição, logout global falhado, fator errado, logout com resposta pendente e teclado/mobile.

Auth real **apenas local**: a config dedicada passa a recolher `auth-security-local.spec.cjs` e `auth-recovery-local.spec.cjs`, nunca o harness cloud histórico. Reutiliza o orquestrador do PR #79 e o sandbox 127.0.0.1:57321/Mailpit 57324. O novo ensaio cria duas contas fictícias distintas (com e sem TOTP), pede email pela UI, consome a ligação local sem logs de tokens, altera a password pela UI, prova password antiga recusada/nova aceite e prova replay recusado. A variante TOTP usa o desafio normal; não altera a configuração MFA. Fixtures anteriores/evidências permanecem, sem cleanup. Capturas, vídeo e traces das sessões Auth reais desligados.

Comandos e manifestos: `LOCAL_AUTH_STABILIZATION.md`. O runner compila para o destino local e conserva evidência de cada tentativa. Antes dos testes normais, repor o build para `https://aura-test.supabase.co`, sem flags Auth/live. Lint, domínio/PostgreSQL, TypeScript, build, audit e Chromium completos no head final são reportados no PR; não confundir fixtures com Auth real nem ensaios locais com cloud.

## Limites e gates de publicação

- A entrega/consumo cloud não foi ensaiada. Confirmar Site URL, origem do build, allowlist, SMTP, rate limits e proteção de bots num plano separado antes de ativar em staging. Nunca testar email com pessoas reais para provar esta entrega.
- Recuperar password **não** resolve perda total de MFA ou recuperação assistida de conta. Esse procedimento, prova de identidade e dupla aprovação continuam por validar. Não acrescentar bypass administrativo/SQL.
- Não se mudou o fluxo de sessão para PKCE, nem se criaram templates de email/token_hash próprios. Isto preserva o contrato implicit existente. Uma migração de fluxo exige revisão específica.
- Persistem bloqueios altos de passwords comprometidas, sessões/JWT cloud, recuperação operacional cloud e RGPD. Safari, Firefox, leitores de ecrã e zoom nativo continuam sem aprovação por estes testes.
- Aprovação do CI e destes ensaios não autoriza produção ou piloto com dados reais. Revisão independente antes de qualquer integração.

Referências: [Supabase resetPasswordForEmail](https://supabase.com/docs/reference/javascript/auth-resetpasswordforemail), [updateUser](https://supabase.com/docs/reference/javascript/auth-updateuser), [signOut](https://supabase.com/docs/reference/javascript/auth-signout). O comportamento de inicialização/callback foi também confrontado com o SDK instalado, sem introduzir um segundo cliente Auth.
