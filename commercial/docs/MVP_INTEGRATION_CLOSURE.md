# Fecho das reservas e integração do MVP — 17/10/2026

Correções inseridas no PR #19 e propagadas ao #20, preservando a cadeia #18→#19→#20. Apenas commercial/, sem migrations novas ou alterações às17 existentes. Produção permanece protegida; a autorização desta entrega é apenas para integração técnica e staging sintético, sem novos recursos/custos.

## Reservas verificadas

useDraftNavigation protege links (incluindo Next Link), beforeunload e Voltar/Avançar no mesmo documento através de Navigation API quando cancelável. Após descarte explícito, o link usa navegação de documento e não solicita confirmação dupla. Operações pendentes bloqueiam mudanças internas. Rascunhos de avaliação/correção, acompanhamento, objetivos, referência de privacidade e associação/pré-visualização NutriTrack permanecem só em memória, sem dados pessoais em storage do browser.

Os componentes distinguem dirty/pending. Correções de avaliação passam a participar da proteção de paginação/secção/rota. A associação NutriTrack ainda não gravada também é rascunho. A confirmação nativa cobre reload/fecho; um utilizador que confirma descarte ou um sistema operativo que termina o browser pode perder memória local. Não se promete recuperação offline ou persistência de rascunhos. Browsers antigos sem Navigation API e tecnologias assistivas precisam de ensaio específico antes de ampliar suporte. Referência de comportamento: https://developer.mozilla.org/en-US/docs/Web/API/NavigateEvent.

Permissões estão vinculadas a user/org/client; mudanças de contexto invalidam o pedido imediatamente e a UI exige a mesma chave para renderizar controlos. Depois de carregar avaliações, nova consulta de permissões precede a apresentação da resposta; revogação/erro oculta o conteúdo. Gravações negadas mantêm o rascunho de avaliação e revalidam permissões. A autorização real continua no banco, sem grants/RLS/MFA alterados. Não se confunde cancelamento de navegação com cancelamento de transação já recebida pelo servidor.

## Evidência antes da integração

73/73 testes de domínio/PostgreSQL (PGlite) PASS; TypeScript/build PASS.15/15 Chromium dedicados PASS34.9s: cinco famílias de rascunhos com links/Voltar/reload/fecho, cinco gravações pendentes/negadas, permissões A tardias após B pronta, revogação durante leitura, correção/paginação, Voltar no mesmo documento e descarte com uma confirmação. Primeiro ensaio corrigiu seletores de textarea e exposição CORS de content-range na fixture; não se enfraqueceram as asserções.

Auth/PostgREST real cloud staging:8/8 grupos PASS, run4407ef2c-7420-4448-aef4-d2a9406b73c3. Inclui concorrência de privacidade, papéis/isolamento, revogação com JWT inalterado, importação manual em lotes, TOTP real e logout global de AAL2. Identidades exclusivamente sintéticas @example.invalid, com manifesto e guard do projeto vgbwmamntjmhzrpvhxzb. Relatórios/credenciais fora do Git. Este ensaio não comprova recuperação operacional cloud ou configuração completa de Auth.

## Gates e publicação

Só publicar no serviço Render aura-business-staging (srv-db9al5ajnfac73bivqr0), workspace Maryatchi hub já autorizado, plano free existente, Supabase vgbwmamntjmhzrpvhxzb. Comparar os17 checksums do registry com o bundle canónico; não executar migrations. Produção srv-db76rpmi0phs738pd9ug/vfplbkfxipfictuwkkoe nunca é destino. Confirmar auto-deploy de produção OFF e SHA exato do serviço staging, smoke/cabeçalhos/assets e E2E Auth real com credenciais fictícias privadas existentes, traces/screenshots de autenticação OFF.

Resultados pós-merge/publicação serão registados no PR e na entrega com os SHAs efetivos, sem alterar o código validado apenas para gravar o próprio SHA.

## Pendências por severidade

ALTAS: proteção contra passwords comprometidas; JWT cloud3600s/política de sessões; recuperação operacional Auth/DB/MFA/configuração cloud; recuperação completa de conta/email/segundo fator; requisitos jurídicos/retenção e aceitação MFA por organização piloto. A integração/staging não fecha estes gates nem autoriza dados reais/piloto.
MÉDIAS: tecnologias assistivas, carga e suporte de browsers antigos por ensaiar; gestão transversal de privacidade/retensão ainda limitada conforme documentos anteriores. Sem eliminação definitiva automática ou sincronização/nutrição NutriTrack.
Verificação adicional antes de staging: revogação parcial de avaliações já não invalida os restantes módulos autorizados. A resposta de permissões confirmada é aplicada por competência; o rascunho de acompanhamento mantém-se montado quando essa competência continua válida. Erro de revalidação continua a ocultar dados. Um E2E segura as avaliações, altera a permissão e confirma a preservação do rascunho e ausência do editor revogado.
Validação do complemento granular: TypeScript/build aprovados e16/16 casos Chromium das reservas PASS34.0s. A revisão integrada anterior tinha73 testes e100 Chromium aprovados, com CI39050138731; o complemento acrescenta um cenário para total101 e será novamente validado antes da publicação.
