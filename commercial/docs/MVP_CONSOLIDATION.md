# MVP integrado com dados fictícios — ciclos de consolidação

Base: merge revisto do PR #17, 6a925c3d342a4f167e818e5c7f3c9b112b6601ce. Apenas commercial/. Sem publicação, alteração de dados reais, dependências novas, recursos ou custos. Os bloqueios de AUDIT_REMEDIATION_20261017.md, AUTH_STAGING_CONFIGURATION.md, RECOVERY_OPERATIONS.md e MFA_ASSISTED_RECOVERY_AND_ACTIVATION.md permanecem abertos. Não há autorização para piloto comercial.

## Ciclo 1 — operação diária

Auditoria: já existiam dashboard, fila diária paginada com quatro categorias e links para secções da ficha. Foram mantidos os RPCs e as regras de seleção/permissões; não se criou outro dashboard nem se redefiniu avaliação pendente como obrigação clínica. Foram confirmadas lacunas na recuperação de rede dos indicadores, independência da fila diária e contexto explícito dos atalhos.

Alterações: indicadores capturam rejeições de rede; fila e atalhos continuam disponíveis quando o agregado falha; atalhos transportam org no URL e os de gestão são omitidos para coach. Contadores por categoria permitem filtrar a fila existente com teclado e mostram apenas os totais autorizados do RPC. Datas e horários continuam em Europe/Lisbon. A falta de autorização continua a ser decidida no banco.

Novos E2E: falha de rede dos indicadores com prioridades ainda utilizáveis e retry; contadores abrem filtro existente; atalhos mantêm o estabelecimento até à agenda; coach sem atalhos de gestão. As suites anteriores continuam a validar paginação, pesquisa literal, secções, tenant tardio e mobile.

As decisões de limiar (avaliação ausente ou há mais de 30 dias), limites de paginação e contratos SQL não foram alteradas. Não foram executadas migrations nem testes cloud que criem contas/dados neste ciclo.
`Validação Ciclo 1`: 73/73 domínio/PostgreSQL, TypeScript e build aprovados; npm audit sem vulnerabilidades; 15/15 Chromium dashboard/daily/workspace aprovados em 15.2s. Primeiro build recusado por EPERM do sandbox em .next/types; repetição com permissões adequadas passou sem alterar código. As suites usam fixtures sintéticas e não demonstram configuração cloud.

## Ciclo 2 — ficha Aluno 360º existente

Auditoria: as secções e o histórico já existiam. Lacunas confirmadas: rascunho de avaliação podia desaparecer ao mudar aluno/secção/estabelecimento ou página; falhas de rede em lookup/permissões não tinham retry próprio; secção não ficava representada no URL; proveniência NutriTrack só era visível noutros percursos.

A ficha atual passa a confirmar o descarte, proteger saída/reload com rascunho ou gravação pendente e impedir mudanças de secção durante a gravação. A seleção de secção atualiza section no URL por replaceState (não acrescenta entradas artificiais ao histórico do browser); recarregar restaura apenas uma secção autorizada. Não há router paralelo. Diretório conserva org. Lookup e permissões distinguem erro de serviço de aluno ausente ou acesso negado e têm retry próprio. Sem permissões carregadas não há controlos de edição.

O histórico lê source_system/source_revision existentes e apresenta origem e versão de avaliação, sem mostrar o identificador pessoal de origem. Preserva as revisões passadas às correções, originais substituídos, partilha explícita e o contrato manual NutriTrack. Não acrescenta sincronização automática ou nutrição.

Novos E2E: cancelamento/aceitação do descarte nas secções e estabelecimentos, cancelamento no seletor, secção/integrações preservadas no reload, erro/retry de lookup, erro/retry de permissões sem edição e proveniência/revisão no histórico. Os dados utilizados são exclusivamente fixtures. Nenhuma migration foi modificada nem aplicada.

Validação Ciclo 2: TypeScript/build aprovados; regressão Chromium completa 79/79 PASS em 46.6s. Primeira execução 76/79: duas ambiguidades de seletores (anunciador Next/status MFA) corrigidas sem enfraquecer as asserções, e leitura de rede prolongada corrigida por abort/timeout de oito segundos. Retry de lookup aprovado em 8.8s. CI do PR #19 repete a suite integral.

## Ciclo 3 — experiência, White Label e acessibilidade

Auditoria: Dark Premium, navegação responsiva e tabela alternativa dos gráficos já existiam. Mantidos os tokens, o tema e a estrutura. Não se reimplementaram gráficos, agenda ou um novo portal.

A personalização fictícia é consolidada num único DemoBrandControls, usado nas duas demonstrações existentes. Três identidades de exemplo e controlos de nome/cor reutilizam BrandHeader e a escolha automática de texto preto/branco por contraste. O Aluno360 mostra a identidade escolhida também no cabeçalho da ficha. Tudo é em memória e recarregar repõe os exemplos; nenhuma configuração real ou credencial é persistida. Upload de logótipo não foi acrescentado.

O atalho Saltar para o conteúdo é o primeiro elemento de teclado e aponta para main focável em todas as páginas. Tabelas alternativas dos gráficos recebem legenda e cabeçalhos de coluna. Estados de erro da marca têm fallback identificado pelo estabelecimento atual, cancelamento/timeout e retry, sem reter identidade de outro tenant.

Novos E2E: presets/contraste preto em fundo branco, nome comprido sem overflow mobile e reposição sem chamadas externas nas duas demonstrações; Tab/Enter até main em demo e área profissional; tabela do gráfico com Enter; erro/retry da marca e troca de estabelecimento. Os screenshots de dados fictícios ficam fora do Git para inspeção local. Estes ensaios não substituem auditoria WCAG ou teste manual com tecnologias de apoio.

## Revisão independente e limites que permanecem

Rever a cadeia de PRs #18 → #19 → #20, cada um contra a base indicada, e confirmar os SHAs atuais e CI. A integração/publicação é um passo posterior; nenhuma demonstração online deve ser presumida atualizada. Exercitar dashboard → prioridade → ficha → avaliação/objetivo/agenda → evolução/cronologia, com papéis limitados, timeout, revogação e MFA em ambiente isolado antes de publicar o candidato de staging.

Prioridades de auditoria: preservação de drafts e estado de pedidos em cada transição; links com org e section; leitura mínima de proveniência/revisão; fallback de identidade e carregamento; teclado/mobile e contraste de cores personalizadas. Confirmar também casos ainda não cobertos por interação assistiva manual ou carga. Não inferir segurança cloud a partir de mocks.

Continuam ALTOS: proteção contra passwords comprometidas/decisão de plano; JWT cloud3600s e política de sessões; ensaio operacional cloud→cloud Auth/DB/MFA/configuração; recuperação completa de conta/email/segundo fator; decisões jurídicas, retenção e aceitação MFA por cada organização do piloto. Nenhuma proteção foi desligada para estes ciclos. Não há autorização para dados reais, produção, piloto ou certificação de segurança.

A inspeção visual de desktop/mobile confirmou o Dark Premium e identificou um erro de CSS na navegação: a largura de24px dos ícones também afetava os rótulos. Foi restringida aos ícones; a regressão exige rótulos desktop numa linha. Links com aspeto de botão e ações de sessão receberam espaçamento consistente. Um ensaio revelou ainda seleção de marca antes da hidratação; os novos controlos aguardam explicitamente readiness e um teste atrasa todos os chunks JS para confirmar que não há interação perdida. Os seis testes de experiência repetidos três vezes passaram18/18 (15.9s). A inspeção é limitada aos ecrãs sintéticos, não constitui auditoria visual exaustiva.

## Reproduzir a validação

Com Node22 e dependências fixadas, em commercial/: npm run check; npm audit --audit-level=moderate; npm run test:e2e -- --workers=2. No Windows definir NEXT_TELEMETRY_DISABLED=1. Para o caso intermitente: npm run test:e2e -- e2e/experience-mvp.spec.cjs --repeat-each=3 --workers=2. Playwright utiliza o servidor local127.0.0.1:3187 e fixtures, sem executar runners históricos ou criar contas cloud. Não reutilizar ficheiros de credenciais reais.

Resultado final local: 73/73 testes domínio/PostgreSQL aprovados; TypeScript e build aprovados (build repetido após o último ajuste de UI); npm audit sem vulnerabilidades reportadas. Suite completa final Chromium85/85 PASS em46.3s, mais18/18 nas repetições focadas. Não foram criadas migrations adicionais: o conjunto canónico permanece nos17 registos da base, sem alterações. Não foram executados novos testes Auth/PostgREST cloud nem ensaios de recuperação nesta entrega.
