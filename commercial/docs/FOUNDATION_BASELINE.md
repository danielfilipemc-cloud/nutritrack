# Fase 0 — baseline de 14-10-2026

Baseline local/remoto: `543e3a0b78e864cc65a8c07dec0736c8ee6c39af`, branch `saas-foundation`; fetch confirmou igualdade. Desenvolvimento em `feat/aura-foundations`, sem merge/push/deploy automático.

- Node **22.23.3** encontrado e executado; npm 10.9.9. `.nvmrc` e engines fixam a família suportada; Render já usa 22.23.3. Versões de dependências preservadas.
- `npm audit --json`: zero vulnerabilidades, 101 dependências no inventário reportado. A operação externa foi expressamente autorizada pelo responsável.
- Antes das alterações: 21 testes locais/PGlite passaram. A auditoria aprovada já tinha build, typecheck e 20 Chromium aprovados.
- Supabase AURA `vfplbkfxipfictuwkkoe`: oito registos SHA-256 iguais ao baseline; UTC; sete tabelas públicas com RLS; zero buckets. Nenhuma migration cloud aplicada nesta entrega.
- CLI oficial Supabase **2.120.0**, obtido pela distribuição npm fixada e autorizado. Criou as migrations novas com `migration new`, sem db push/reset.
- Changelog/documentação RLS/funções consultados. A depreciação de ciphers TLS antigos anunciada em 12-10 não exige trocar a stack Node/browser suportada; acompanhar clientes obsoletos antes de piloto.

Fontes oficiais: https://supabase.com/changelog ; https://supabase.com/docs/guides/database/postgres/row-level-security ; https://supabase.com/docs/guides/database/functions

## Registos existentes, imutáveis

| Ficheiro | SHA-256 |
|---|---|
| schema.sql | c45dd37d5cbddeaa65ded29d631421d06593fc76014cb38b68128660e8a8b890 |
| 002_assessments.sql | 99b9e62c5f558321700b1f1415d9fcd9898093bf3d52b908cc3ec3617816dd96 |
| 003_branding.sql | 97dc0225af4f4ca37b0463bf259efec2856646dc4b0ac06da3adf2f99bc683eb |
| 20261013175333_team_invitations.sql | 27cc9bbd4c6720a013fccb2db2163842a987e605dac910fda0abb73c26fb6e67 |
| 20261013181649_client_management.sql | d8e23c0c154bf508661db71708335c10d591743085605e53ca3698a5209359be |
| 20261013201340_client_conflict_response.sql | 12ee866e584bd7dd797ba0befe8cfa06fd5cba6bdd1369d506a494ae505408e6 |
| 20261013202654_professional_dashboard.sql | 665047dd2eba7f069a701aa941df5054ff88d17042ae598fea006baf8efc8512 |
| 20261013210823_followup_agenda.sql | 105bd1fb0ef9f5a7161bf3369a45789efcac69f528a067f0add31d9ae0ef9b08 |

O teste de checksums foi ampliado de seis para oito ficheiros, mantendo normalização histórica CRLF/LF.

## Ambiente

Os testes de fundações executam PostgreSQL isolado PGlite, com Auth mínimo sintético. O browser usa build com URL/chave fictícias e requests interceptados. Isso não substitui JWT/Auth/PostgREST cloud. O projeto cloud e o site Render permanecem no baseline anterior; a implementação local exige as duas migrations novas antes de apontar o frontend novo para um serviço Supabase real.

As regras antigas de algoritmo/RLS têm testes históricos explícitos em `tests/baseline.ts`, limitados ao snapshot auditado de oito migrations. `tests/foundations.test.ts` aplica **todo** o schema novo e prova as políticas restritivas. Não usar o bundle histórico para instalar/deploy; o bundle por omissão inclui todos os ficheiros.
