# Auth cloud e recuperação lógica sintética — 16 outubro 2026

O staging AURA `vgbwmamntjmhzrpvhxzb` foi efetivamente testado com Auth/JWT/PostgREST: os dezasseis grupos das fundações passaram antes e depois do upgrade para catorze migrations. A ponte NutriTrack passou seis grupos reais no staging e seis no sandbox local, incluindo duas importações concorrentes, revisão de origem e proteção de correção local.

## Cópia autorizada e destino novo

Após recusa inicial da exportação integral pela revisão automática, o utilizador autorizou especificamente a cópia dos dados fictícios criados pelos testes. A exportação foi limitada aos IDs retidos nos relatórios de fundações, ponte NutriTrack e identidade de prova de recuperação. Abrange 27 tabelas/projeções: 25 tabelas da aplicação, catorze identidades Auth e os respetivos vínculos de identidade. Não abrange utilizadores reais, produção, base pessoal NutriTrack, sessões, refresh tokens ou tokens de confirmação/recuperação.

A cópia JSON, os hashes das palavras-passe fictícias e a password aleatória da identidade de prova ficam apenas em `.aura-integration/cloud-recovery/`, ignorado pelo Git. Nunca imprimir esses ficheiros ou anexá-los a PRs. A integridade SHA256 do arquivo é verificada antes do restauro, bem como os nomes/checksums das catorze migrations canónicas.

Foi criado um **quarto destino local novo**: `aura-foundations-cloud-recovery`, API 127.0.0.1:60321, Postgres 127.0.0.1:60322, SMTP 127.0.0.1:60324. Não foram limpos ou reutilizados os três runtimes anteriores. Os scripts de restauro fixam este container, Docker local, marker AURA-Dev, bindings loopback e ausência de quaisquer dados Auth/aplicação. Um destino apenas com schema vazio pode retomar uma preparação falhada; um destino povoado recusa repetição.

O schema é recriado a partir das migrations canónicas. A inserção preserva campos/datas do arquivo e FK; apenas triggers de aplicação são temporariamente desativados dentro da transação no destino vazio. Os triggers do fornecedor Auth não são alterados. Os campos de tokens deliberadamente excluídos são inicializados a texto vazio: a primeira verificação encontrou que NULL impedia o login no Auth local, e a normalização específica foi corrigida. Sessões antigas não são restauradas.

## Resultados efetivos

- As 27 projeções restauradas coincidiram com os campos exportados, incluindo hashes Auth, ligações e registry. Campos adicionais/defaults do fornecedor não são entradas do arquivo.
- A password original da conta fictícia criada na cloud autenticou a mesma identidade no Auth local recuperado, sem reset de password.
- O JWT recuperado leu a avaliação própria atribuída e não leu dados de outra organização; o contexto NutriTrack estrangeiro foi negado.
- O acesso anónimo ao RPC da ponte continuou negado.
- Uma segunda tentativa de restauro foi recusada antes de alterar o destino povoado.

Este é um ensaio **lógico cloud → Supabase local novo**, com identidades e permissões funcionais. Não é uma prova de PITR, backup físico do fornecedor, reposição dentro da cloud, recuperação de sessões ativas ou recuperação de um ambiente de produção. Esses procedimentos operacionais e respetivos objetivos RPO/RTO continuam por definir/testar antes de dados reais.

O manifesto de staging aponta para este arquivo e a evidência efetivamente verificada, com SHA256 de ambos. Permite repetir testes sintéticos na cloud pelo caminho normal do runner, sem fingir que existe um restauro físico cloud.

## Pendências de segurança

O advisor cloud não encontrou tabelas públicas sem RLS nem funções públicas SECURITY DEFINER. As treze tabelas privadas sem policies de leitura estão deliberadamente fechadas. Existe um WARN de proteção contra passwords comprometidas desativada no Auth; deve ser resolvido na configuração antes de produção: https://supabase.com/docs/guides/auth/password-security#password-strength-and-leaked-password-protection. MFA, privacidade operacional e revisão independente permanecem requisitos de entrada em produção.
