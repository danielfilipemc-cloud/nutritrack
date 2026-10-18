# Plano de implementação por PRs — Nutrição

Estado em 2026-10-18: **proposta, sem início de migrations ou implementação operacional**. A autorização atual cobre diagnóstico/documentação e testes sintéticos; não inclui publicar, migrar dados, alterar staging/produção ou contratar serviços. [Arquitetura](NUTRITION_ARCHITECTURE_PROPOSAL.md) · [Inventário](NUTRITRACK_NUTRITION_INVENTORY.md) · [Reutilização](NUTRITION_REUSE_MAP.md).

## Sequência pequena e verificável

Os identificadores abaixo são lotes propostos, não PRs já criados nem promessas de entrega. Todos partem do estado revisto, só commercial/, branch própria, CI e revisão independente; integração não implica deploy.

| Lote | Alteração limitada | Validação para revisão | Gate/dependência |
|---|---|---|---|
| P0 — esta auditoria | Diagnóstico aberto da ficha, cinco testes novos e quatro documentos de Nutrição | Código pessoal intacto, fonte/linhas verificáveis, classificações e hipóteses separadas | Revisão do responsável; sem merge/publicação automática |
| P1 — contratos puros | DTOs versionados, unidades, null vs zero, snapshots, dias/cobertura e validação; adaptar lib/nutrition existente sem duplicar | Porções decimais, negativos/overflow, energia desconhecida, múltiplos itens, datas Europe/Lisbon, arredondamento; nenhuma rede/SQL | Aprovação do contrato e dos limites estruturais |
| P2 — leitura com fixtures | Secção Nutrição no 360º, diário por data e detalhe de composição/tabela; mesma workspace e guards | Desktop/mobile, teclado, estados vazio/erro/parcial, rascunho e trocas de contexto; apenas fixtures inventadas | P1; não anunciar persistência nem ligar fornecedor |
| P3 — competências e modelo de diário local | Migration **nova futura** para competências explícitas, refeições/itens/versões e idempotência, RLS/grants; sem alterar as 17 aplicadas | Instalação limpa + upgrade das 17 em PostgreSQL isolado, FKs entre tenants, grants negativos, sem owner/admin implícitos | **Revisão e autorização específica de migrations**, mesmo antes de qualquer staging; P1 |
| P4 — comandos transacionais | RPC de criação/correção/anulação auditável e consulta por request_id; snapshots e revisões | Atomicidade, revisão concorrente, resposta perdida após commit, retry idempotente e hash divergente, leitura sem autorização | P3 validado; schema/servidor permanecem inacessíveis sem grants aprovados |
| P5 — fluxo profissional | MealEditor ligado aos contratos reais, estado incerto, revalidação de acesso e paginação | Novo registo e correção sem drift, conflito conserva rascunho, logout pendente, A→B com respostas fora de ordem | P2/P4; testes Auth/PostgREST só em ambiente isolado e autorizado |
| P6 — portal do aluno | Diário próprio e seleção de alimentos publicados no `/aluno` existente | Outro aluno/tenant negado, autor derivado, campos extra recusados, não edita lançamento profissional, revogação com JWT antigo | P4/P5 e política de autoria/correção aprovada |
| P7 — hidratação/cobertura/relatório | Eventos ml e cobertura de registo, resumo descritivo com tabela/gráfico | ml≠g, sem teto de meta, dia sem dados distinto de zero, fusos e período incompleto; sem projeção de peso | Diário estável; nenhum conselho automático |
| P8 — catálogo curado e modelos | Composições de origem comprovada, versões, favoritos e eventual modelo de refeição | Histórico não muda com catálogo, idempotência de aplicar modelo, crú/cozinhado/unidades | Decisão sobre autoria/licença/curadoria; fixtures até aprovação |
| P9 — exportação/privacidade | Projeção nutricional na exportação autorizada e pedidos existentes | Aluno só próprio, profissional só atribuído, gestor sem acesso implícito, auditoria sem copiar textos; sem eliminação automática | Política de finalidade/retenção e escopo de direitos definida |
| P10 — planos/metas, posterior | Draft/revisão/publicação/retirada explícitas, competência própria, sem gerador heurístico | Profissional sem ação publish negado; AAL1/fator antigo negado quando exigido; aluno só publicado; consumo separado | **Decisões jurídicas/profissionais e habilitações verificadas**, P9 e revisão própria |
| P11 — fornecedor/importação, opcional | Adaptador OFF ou importação alimentar manual, cada um em PR distinto | Schema, fonte/licença, quotas/429, cancelamento, valores desconhecidos; lotes/repetição/conflicto e vínculo explícito | Autorização separada de ligação/importação. Sem base pessoal, sincronização automática ou novos serviços |

P3/P4 podem ser subdivididos se o diff impedir rever autorização e transações em conjunto; não publicar uma metade com grants permissivos temporários. Funcionalidades desativadas devem falhar fechadas no banco, não apenas desaparecer da sidebar. O primeiro MVP útil termina antes de planos/prescrição/fornecedor: diário descritivo, catálogo sintético/curado autorizado, aluno próprio, água e privacidade.

## Matriz mínima de aceitação

| Área | Casos negativos/limites obrigatórios |
|---|---|
| Multiempresa | A lê/escreve A; A→B nega por RLS e RPC; FK de item/food de outro tenant rejeitada; UUID forjado não autoriza |
| Profissionais | Owner/admin sem competência não lê; read-only não grava; sem atribuição não lê; catálogo não concede diário |
| Aluno | Vínculo ativo próprio; outro aluno e vínculo revogado negados; não forja autor, source ou client_id |
| Sessão/MFA | Mudança de sessão limpa respostas; erro de requisito MFA não o elimina; revogação testada com token emitido antes; política sensível existente preservada |
| Concorrência | Dois writers na mesma revisão: um sucesso e um conflito; revogação anterior ao commit; lock ordering sem deadlock observável nos testes |
| Rede | Timeout antes de commit, resposta perdida depois de commit, consulta idempotente, retry não duplica, rascunho nunca descartado silenciosamente |
| Catálogo/composição | Zero conhecido, null desconhecido, kcal≠kJ, ml sem densidade, crú/cozinhado, versão retirada, mudanças sem reescrever histórico |
| Datas | Meia-noite Europe/Lisbon, mudança DST, data de consumo vs instante de criação, dia sem registo, datas futuras por contrato |
| Privacidade | Grants históricos sem bypass, logs sem payloads, export seletivo, consentimento não vira autorização técnica, pedidos sem delete automático |
| UI | Links/Voltar/reload/fecho/logout com rascunho ou operação pendente; organização/aluno durante leitura, disclosure e tabela por teclado; 320px e zoom CSS sem extrapolar para zoom nativo |
| Instalação/recuperação | Upgrade local preserva dados/revisões das 17 migrations e hashes; plano de restauro inclui novas entidades; não confundir cloud→local com restauro cloud |

Cada PR executa lint, TypeScript, build, domínio/PostgreSQL e Chromium relevante; suite completa antes de integrar candidato, npm audit e diff limitado a commercial/. Os comandos Auth/cloud só após confirmação do destino e manifesto sintético, sem reutilizar runners históricos contra projetos protegidos. Não usar dados reais para testar regras nutricionais ou capacidade.

## Decisões que o responsável precisa de tomar

1. Aprovar o MVP **descritivo sem prescrição** e definir quem pode registar/corrigir o quê; confirmar se metas/planos ficam fora da primeira entrega.
2. Finalidade, base jurídica, retenção por tipo de dado/auditoria/idempotência, responsáveis de tratamento, regra para menores e acesso após saída do profissional. Documentar decisões; não assumir RGPD resolvido por consentimento genérico.
3. Direitos e origem do catálogo inicial; quem revê alimentos/porções/unidades. Não assumir licença dos dados do NutriTrack ou ativar OFF por já existir código de fetch.
4. Para fase de planos: habilitações e processo de verificação/validação profissional/jurídica; ação publish separada. Nem o role coach nem a subscrição comercial resolvem isto.
5. Aprovar explicitamente cada alteração de schema/ambiente necessária. A autorização desta auditoria não autoriza futuras migrations, deploys, migração de dados ou custos.

## Trabalho técnico que pode avançar após revisão, sem dados reais

Contratos puros e fixtures, cálculo validado, protótipo no 360º, testes de estados de rede/permissão, modelos de RLS em PostgreSQL local e provas de upgrade/concorrência. Não precisam de novas contas de fornecedores ou planos pagos; qualquer insuficiência de capacidade tem de ser apresentada antes de alterar infraestrutura.

Permanecem os bloqueios altos H-01 passwords comprometidas, H-02 sessões/JWT, H-03 recuperação operacional cloud, H-04 recuperação conta/MFA e H-05 RGPD. Zoom nativo, leitores de ecrã, Safari/Firefox e dispositivos reais continuam por validar. Um CI aprovado ou esta proposta não autorizam piloto comercial.
