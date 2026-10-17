# MVP integrado com dados fictícios — ciclos de consolidação

Base: merge revisto do PR #17, 6a925c3d342a4f167e818e5c7f3c9b112b6601ce. Apenas commercial/. Sem publicação, alteração de dados reais, dependências novas, recursos ou custos. Os bloqueios de AUDIT_REMEDIATION_20261017.md, AUTH_STAGING_CONFIGURATION.md, RECOVERY_OPERATIONS.md e MFA_ASSISTED_RECOVERY_AND_ACTIVATION.md permanecem abertos. Não há autorização para piloto comercial.

## Ciclo 1 — operação diária

Auditoria: já existiam dashboard, fila diária paginada com quatro categorias e links para secções da ficha. Foram mantidos os RPCs e as regras de seleção/permissões; não se criou outro dashboard nem se redefiniu avaliação pendente como obrigação clínica. Foram confirmadas lacunas na recuperação de rede dos indicadores, independência da fila diária e contexto explícito dos atalhos.

Alterações: indicadores capturam rejeições de rede; fila e atalhos continuam disponíveis quando o agregado falha; atalhos transportam org no URL e os de gestão são omitidos para coach. Contadores por categoria permitem filtrar a fila existente com teclado e mostram apenas os totais autorizados do RPC. Datas e horários continuam em Europe/Lisbon. A falta de autorização continua a ser decidida no banco.

Novos E2E: falha de rede dos indicadores com prioridades ainda utilizáveis e retry; contadores abrem filtro existente; atalhos mantêm o estabelecimento até à agenda; coach sem atalhos de gestão. As suites anteriores continuam a validar paginação, pesquisa literal, secções, tenant tardio e mobile.

As decisões de limiar (avaliação ausente ou há mais de 30 dias), limites de paginação e contratos SQL não foram alteradas. Não foram executadas migrations nem testes cloud que criem contas/dados neste ciclo.
`Validação Ciclo 1`: 73/73 domínio/PostgreSQL, TypeScript e build aprovados; npm audit sem vulnerabilidades; 15/15 Chromium dashboard/daily/workspace aprovados em 15.2s. Primeiro build recusado por EPERM do sandbox em .next/types; repetição com permissões adequadas passou sem alterar código. As suites usam fixtures sintéticas e não demonstram configuração cloud.
