# Nutrição P2 — demonstração integrada na ficha

## Cadeia de revisão

PR #28 integrado em `d5341ca4d8e366e77c4dd5a9d6a896628b8ca4e6`, com árvore idêntica ao head aprovado. CI integrado 39161721346 aprovado. P1: PR #29, `6c1e9b94a7e160d7d06368849e8f9e882f8c491c`, base saas-foundation; CI 39162375160 e 39162357627 aprovados. P2 depende da branch P1 e deve ser revista depois dela. Nenhum destes incrementos nutricionais foi integrado ou publicado.

## Implementação e limites

- `NutritionDemo` é uma secção da ficha existente. Mantém a barreira de identidade/organização/aluno e a consulta de permissões existentes; não cria competência alimentar. Mesmo uma conta com acesso limitado só vê exemplos inventados, nunca um diário real.
- Resumo por dia, diário com seleção de refeições e composição pesquisável. Três alimentos inventados, três dias incluindo vazio e composição parcial. Os exemplos são os mesmos em todas as fichas e o aviso identifica expressamente que não pertencem ao aluno selecionado.
- Simulação de quantidade recompõe sempre o snapshot P1. Zero conhecido e desconhecido são distintos; erro de quantidade oculta o resultado anterior. Não há metas, prescrição, adequação clínica, cálculo de necessidades, sincronização ou importação alimentar.
- Sem chamadas nutricionais à rede, browser storage, persistência ou RPC. A seleção e simulação vivem só em memória. A chave utilizador/organização/aluno desmonta a demonstração na mudança de contexto. O rascunho integra o mecanismo existente de navegação, reload e logout; mudanças internas pedem confirmação.
- CSS limitado ao workspace profissional. Cartões responsivos, listas selecionáveis, controlos de 44 px, disclosure nativo por teclado. Não altera demonstrações públicas nem contratos Auth/RLS.

## Reprodução

Em commercial, Node 22.23.3: `npm run lint`, `npm run typecheck`, `npm run build`, `node --import tsx --test --test-concurrency=1 tests/*.test.ts`, `npm audit`, `npx playwright test --workers=2`. Build/E2E usam URL `https://aura-test.supabase.co` e chave pública fictícia `sb_publishable_e2e_fixture`; todos os pedidos Supabase dos testes Chromium são interceptados pelo harness. Não usar flags de testes cloud/live.

Testes novos: `e2e/nutrition-demo.spec.cjs`, incluindo composição parcial/zero, diário vazio, cálculo 100→50→100, quantidade inválida, descarte cancelado/aceite, organização, reload Chromium, logout, mudança de rota, permissões negadas e resposta atrasada de A após mudança para B, desktop 1440 px e mobile 320 px. Não são ensaios Auth/PostgREST cloud reais.

Capturas reproduzidas pelos dois testes visuais em `.aura-integration/nutrition-p1-p2/visual/`; cópias de revisão em `docs/review/nutrition-p2/`. Inspeção visual verifica alinhamento, rótulos, valores desconhecidos, tabelas, adaptação em coluna e foco do disclosure. A ficha mantém o cabeçalho e navegação existentes: em mobile há scroll vertical considerável, sobretudo com a simulação aberta; não se reconstruiu o shell nesta fase.

## Reservas abertas

Falha intermitente da ficha continua em observação; não foi aplicada correção especulativa. Testes de fixtures não comprovam autorização de um futuro módulo persistente. P3 não foi iniciada. Sem migrations ou alterações de Auth/RLS, ambientes publicados, planos ou dados reais. Os hashes dos sete ficheiros pessoais inventariados no PR #28 permanecem inalterados.

Leitores de ecrã, zoom nativo, Safari e Firefox não ensaiados. Bloqueios altos de passwords comprometidas, sessões/JWT, recuperação operacional cloud, recuperação completa de conta/MFA e RGPD continuam abertos. Não existe autorização para piloto comercial ou dados reais.
