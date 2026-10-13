# Auditoria e evolução do workspace profissional — 13-10-2026

## Estado de partida

Referência auditada: saas-foundation em 23558be. Checkout sem alterações locais;
fetch confirmou a referência remota antes de criar feat/aura-professional-workspace.
Consultados README/handoff, roadmap, módulos, componentes, scripts, migrações,
testes e metadados/diffs dos PRs #1–#6.

- #1: proposta visual antiga ainda aberta e conflituosa, não integrada nem encerrada.
- #2: redesign integrado com equipa/convites, merged.
- #3: tema Dark Premium, merged.
- #4: acessibilidade e gráficos, merged.
- #5: tokens e navegação mobile, merged.
- #6: primeiros três testes Chromium contra a demonstração publicada, merged.

Diretório paginado, versões de aluno, arquivo/reativação, avaliação individual,
convites e hierarquia já existiam. Foram preservados e reutilizados.

## Problemas resolvidos

1. Contraste: BrandHeader usava uma fórmula que selecionava branco para fundos claros.
   Novo helper escolhe preto/branco pelo maior contraste, testado num cubo sRGB de
   4096 cores e em cores de fronteira. Contraste >=4.5:1 em todos os casos testados.
2. Dashboard limitado a contagem/pré-visualização: RPC read-only calcula totais no banco,
   sem truncar resultados pelo limite de linhas da Data API.
3. Ficha inexistente como rota própria: /alunos/[id]?org=UUID reutiliza AssessmentWorkspace.
   Lookup exige organização e UUID; indisponibilidade não revela existência noutra empresa.
4. Identidade/autenticação duplicadas em painel/marca: useProfessional partilhado,
   resultados associados à identidade e limpeza de membership ao trocar utilizador.
5. Cabeçalhos/seletores duplicados: ProfessionalShell e OrganizationSelect partilhados
   por painel, diretório, avaliações/ficha, equipa e marca. Navegação destaca subrotas.
6. Branding aceitava timestamp/autoria do cliente: nova trigger força hora e utilizador
   do contexto do banco e recusa mudança do organization_id.
7. Revogação de convite sem confirmação: confirmação explícita; cancelar não chama RPC.
8. CI verificava o site antigo e instalava Playwright fora do lockfile: versão fixa,
   build do PR, servidor local e fixtures sem credenciais reais. CI sem deploy automático.
9. Regressão introduzida durante a integração: chaves React iguais em dois irmãos
   conservavam a marca anterior ao mudar organização. Detetada pelo Chromium,
   corrigida com chaves distintas e coberta por teste de resposta tardia.
10. README misturava estados antigos (CI inativo/browser indisponível) com os atuais.
    README/roadmap atuais; registo antigo preservado em VALIDATION_HISTORY.md.

11. Checksum dependente do sistema operativo: as três migrações iniciais foram
    registadas com bytes CRLF; checkout Linux entregava LF. O instalador normaliza
    essas três para o formato histórico e as posteriores para LF, sem editar SQL
    aplicado nem atualizar o registry. Um teste compara seis checksums reais do
    cloud com simulações de checkout Windows/Linux.

## Decisões arquiteturais

### Dashboard

`public.aura_dashboard(uuid)` usa SECURITY INVOKER, search_path vazio, EXECUTE apenas
para authenticated, verificação explícita de membership e RLS das tabelas. Não há
novo SECURITY DEFINER público. Acesso de coach é permitido na própria organização;
revogação de membership passa a recusar a chamada mesmo com JWT ainda válido.

Totais exatos: ativos, arquivados, avaliações datadas entre hoje-29 e hoje inclusive,
alunos ativos sem avaliação ou com última data estritamente anterior a hoje-30.
A data vem de current_date do PostgreSQL (timezone configurado no banco), não do browser.
Avaliações futuras não contam como recentes nem removem o aluno dos pendentes.
Listas recentes/pendentes limitadas a 10, ordenação estável por data/UUID. Sem pesos,
notas ou medidas no payload do dashboard; dados detalhados apenas na ficha.

Índices existentes cobrem organização/data, aluno/data e memberships. O agregado
é por organização e a última avaliação é resolvida por aluno. A validação com 1100
alunos adicionais prova que não há limite artificial de 1000; não é um benchmark
nem substitui EXPLAIN/medições de carga antes de escalar.

### Avaliações e dados pessoais

Ficha e ecrã de avaliações partilham registo, validação, gráfico e histórico paginado.
Arquivados são apenas consultados. Dados nunca entram no HTML inicial do servidor;
a leitura no cliente exige JWT e RLS. Nomes React são escapados; sem HTML arbitrário.
Não se adicionaram contactos, notas pessoais, ficheiros, diagnósticos ou dados reais.
O SDK continua a gerir sessões no browser; não se introduziu sessão SSR por cookies.

### White Label

Cor de fundo personalizável apenas no identificador da marca; o texto adapta contraste.
O tema geral mantém Dark Premium e os tokens existentes. Logótipo não é renderizado
nem enviado para serviços externos; storage seguro com políticas aguarda projeto próprio.

## Migração e publicação

Nova migração gerada pelo CLI Supabase 2.120.0:
`20261013202654_professional_dashboard.sql` (RPC e trigger de branding).
Seis migrações anteriores continuam intactas; cloud consultado mantém seis registos.
A nova migração foi executada nos testes PostgreSQL isolados, não aplicada ao cloud.

Entrega por PR para saas-foundation. Sem merge para main ou saas-foundation e sem
alteração do serviço Render nesta continuação. Após revisão/CI:
1. Integrar o PR em saas-foundation.
2. Gerar db:bundle e aplicar exclusivamente ao projeto AURA dedicado; o registry
   deve passar de seis para sete e os checksums existentes devem manter-se.
3. Testar RPC com JWTs reais de owner/coach/empresa B e sem empresa, incluindo o aviso
   de segurança Supabase. O novo RPC ainda não foi verificado via PostgREST cloud.
4. Publicar no serviço de demonstração existente e executar test:deploy.
5. Executar smoke público e testes Auth read-only sobre a versão publicada.

Não colocar a nova versão frontend online antes da migração. A versão atual online
permanece a entrega anterior; estas funcionalidades novas são demonstráveis localmente.

## Validação

- npm ci: reproduzível, dependências fixadas; npm audit: zero vulnerabilidades.
- npm run check: 14 testes aprovados, TypeScript e build aprovados.
- PostgreSQL/PGlite: isolamento, hierarquia, arquivo, audit trail, checksums,
  dashboard vazio/1100 alunos adicionais/limites de data, autor e timestamp de branding.
- npm run test:e2e: 12 cenários Chromium locais com API interceptada, sem segredos.
- Chromium real opt-in: três cenários owner/coach/unassigned aprovados, consultas
  read-only, logout no final, sem traces/screenshots/vídeo com credenciais.
- npm run test:auth: Auth/PostgREST real aprovado nas contas sintéticas dedicadas.
  Este runner legado escreve fixtures sintéticas e mantém-nas para inspeção/demo;
  não usar a limpeza global de organizações enquanto forem necessárias à demonstração.
- CI atualizado para executar os 12 cenários locais em Ubuntu/Chromium sem contas reais.
  As interceções de browser não provam RLS; os testes PostgreSQL/API são independentes.

### Reproduzir browser real, apenas localmente

Pré-requisitos: .env.local, .aura-integration/accounts.env e fixture.json existentes,
com quatro contas fictícias autorizadas. Nunca enviar credenciais para chat/issues/CI.
Build deve usar a URL/chave pública do Supabase AURA, não os valores fictícios do CI.

PowerShell, depois de npm run check:
```powershell
$env:AURA_E2E_AUTH='1'
node node_modules/@playwright/test/cli.js test e2e/auth.spec.cjs --workers=1
Remove-Item Env:AURA_E2E_AUTH
```

Para smoke público existente, AURA_E2E_LIVE=1 e selecionar apenas e2e/live.spec.cjs.
Não executar a suite com fixtures contra um site público por engano.

## Limites e riscos ainda abertos

- Advisor cloud: um WARN de proteção de passwords comprometidas desativada. Ativar
  antes de piloto: https://supabase.com/docs/guides/auth/password-security#password-strength-and-leaked-password-protection
- Três INFO de RLS sem políticas nas tabelas privadas de convites/eventos. Intencional:
  acesso direto negado; funções privadas validam membership/papel antes de operar.
- Signup email ativo por escolha do responsável; não cria membership. Rever antiabuso,
  entrega/limites de email, MFA, revogação de sessões e política de expiração antes do piloto.
- Não há consentimento/retencão/exportação/apagamento completo, backups restaurados
  em ensaio, fluxo auditável de correção de avaliações ou revisão legal de saúde.
- Não há faturação, portal de alunos, agendamento, uploads seguros ou domínio por tenant.
- Histórico usa UUID do profissional; futura apresentação de nome precisa de política
  de minimização e tratamento de profissionais removidos.
- Chromium desktop/mobile foi exercitado; outros browsers, leitor de ecrã e carga
  precisam de validação própria. Não há certificação global de acessibilidade/segurança.
