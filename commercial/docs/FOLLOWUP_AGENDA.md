# Ficha, acompanhamento e agenda

## Funcionalidades do bloco

Ficha do aluno com secções Resumo, Avaliações e Agenda do aluno. O Resumo mostra
últimas medições disponíveis, diferenças face às anteriores, objetivo, estado,
profissional responsável e próxima revisão. As medições continuam limitadas à
janela das últimas 30 avaliações e não recebem interpretação clínica.

Estado do acompanhamento: em acompanhamento, em pausa ou concluído. É independente
do arquivo: arquivo continua a bloquear novos registos; concluir acompanhamento
não elimina dados nem impede automaticamente uma reavaliação futura.

Acompanhamento usa versão otimista. Conflitos mantêm o rascunho, bloqueiam nova
gravação e exigem recarregamento explícito com confirmação de descarte. Confirmar
conclusão também é explícito. Rascunhos não são guardados em localStorage.

Agenda: sessões, avaliações e revisões. Consulta por dia ou sete dias a partir da
data escolhida, filtros de estado/profissional, 25 registos por página, edição de
marcações, cancelamento, reagendamento, realizado e falta. A ficha fixa o aluno;
a agenda geral permite escolhê-lo pelo seletor paginado existente.

A agenda não envia emails, notificações ou convites de calendário externo. Também
não cria automaticamente avaliações quando uma marcação passa a realizada.
Existe atalho para registar a avaliação no módulo próprio.

Dashboard mantém os indicadores anteriores e acrescenta prioridades: marcações
agendadas de hoje e revisões com data até hoje em acompanhamentos ativos de alunos
não arquivados. Pausados/concluídos não entram nas revisões pendentes. Listas até 10;
as contagens são completas no banco. Sem objetivo ou medições nos agregados.

Estabelecimento selecionado mantém-se entre páginas na mesma aba, por identidade.
O URL pode escolher um estabelecimento autorizado. sessionStorage é apenas uma
preferência de navegação: o valor é sempre validado contra memberships atuais.

/demo inclui ficha/agenda fictícias em memória, com horários e conflito simples,
sem Supabase ou persistência. Não substitui os testes de permissões da aplicação.

## Permissões e integridade

| Operação | Owner/admin | Coach |
|---|---|---|
| Consultar ficha e agenda do próprio estabelecimento | Sim | Sim |
| Alterar objetivo/estado/revisão de aluno ativo | Sim | Sim |
| Atribuir/trocar responsável | Sim | Não |
| Criar/editar/cancelar marcação própria | Sim | Sim |
| Gerir marcação de outro profissional | Sim | Não |
| Consultar outra empresa sem membership | Não | Não |
| Escrever diretamente nas tabelas pela Data API | Não | Não |

Atribuição de responsável é organização operacional, não uma nova barreira de
leitura entre profissionais da mesma empresa. Mantém-se o modelo de acesso da base.

New tables client_followups e appointments: RLS por membership, SELECT authenticated,
nenhum INSERT/UPDATE/DELETE direto. RPCs públicas SECURITY INVOKER delegam alterações
para implementações privadas que validam identidade, papel, tenant, aluno e versão.
O agregado novo aura_care_dashboard é SECURITY INVOKER e reutiliza a autorização
existente de aura_dashboard. Sem novo SECURITY DEFINER público.

Slots agendados não podem sobrepor-se para o mesmo profissional **ou aluno** dentro
do estabelecimento. Intervalos adjacentes são permitidos. Bloqueio da organização
serializa criação/edição, verificação de conflito, alterações de equipa e arquivo.
Não se consultam agendas de outras empresas nem calendários externos.

Duração: 5 minutos a 8 horas; datas de 2000 a 2100. Novas marcações são agendadas.
Canceladas podem ser reagendadas. Realizadas/faltas são finais, sem edição por este
fluxo; uma correção auditável específica fica para desenvolvimento posterior.

Alunos arquivados: ficha/evolução/histórico consultáveis, sem novo acompanhamento
ou agendamento. Marcações existentes preservadas; o profissional autorizado pode
fechá-las. Remover um profissional retira a atribuição, mantém a organização e
incrementa a versão. Manager pode fechar marcações que ficaram sem profissional.

Autoria, hora e versões vêm de triggers no banco. Eventos privados contêm IDs,
ação, versões, estados e timestamp; não copiam objetivos nem medições. Histórico
paginado com RPC que valida aluno e tenant. Sem políticas de leitura direta no
schema privado, intencionalmente.

Nomes para seleção de profissional vêm de display_name do perfil Auth (apenas
apresentação, nunca autorização). Sem nome configurado, usa identificador curto.
Email, password e metadata completa não são devolvidos pelo RPC de escolha.

## Tempo e mudanças de hora

MVP usa Europe/Lisbon explicitamente, independentemente do fuso do browser.
Banco guarda instantes timestamptz; duração é tempo real decorrido. A interface
recusa horas inexistentes ou repetidas na mudança de hora, em vez de escolher
silenciosamente um instante. Dias podem ter 23/25 horas. Configuração de fuso por
estabelecimento fica para um próximo bloco.

## Migração e publicação

20261013210823_followup_agenda.sql, criada com CLI Supabase. Adiciona duas tabelas
públicas, eventos privados, triggers, RPCs e índices. Não altera as sete migrações
anteriores; db:bundle mantém os checksums e passa a incluir oito ficheiros.

Sequência: validação local → PR/CI → integração em saas-foundation → migração apenas
no Supabase AURA vfplbkfxipfictuwkkoe → testes JWT/PostgREST → demonstração Render →
smoke/Chromium publicados. Nenhum merge em main nem alteração ao NutriTrack pessoal.

## Testes e reprodução

- npm run check: 21 testes de domínio/PostgreSQL, TypeScript e build.
- npm run test:e2e: 20 Chromium locais com API interceptada, incluindo novo fluxo,
  conflito com rascunho preservado, confirmação/cancelamento, reagendamento,
  paginação, seleção persistente do estabelecimento, DST e mobile.
- npm run test:care:api: runner real com quatro contas fictícias existentes. Cria
  três alunos UUID novos, testa duas gravações concorrentes de acompanhamento e
  duas marcações concorrentes; exatamente uma de cada par deve ser aceite.
  Testa papéis/empresas, arquivo/fecho e histórico. Chave admin apenas em ficheiro
  local ignorado, usada para limpar exclusivamente os três UUIDs da execução.
- Chromium real opt-in em auth-care.spec.cjs: cria dois alunos fictícios, grava
  acompanhamento, marca sessão como owner, verifica restrições de coach e permite
  slot próprio; conta sem associação não cria marcações. Limpeza de ambos no fim.
  auth.spec.cjs mantém os três cenários read-only anteriores.

Para os runners reais: .env.local, .env.admin.local e
.aura-integration/accounts.env/fixture.json locais. Nunca enviar credenciais para
GitHub/chat/CI. Credenciais/segredos não entram em traces/screenshots/vídeo.

```powershell
npm run test:care:api
$env:AURA_E2E_AUTH='1'
node node_modules/@playwright/test/cli.js test e2e/auth-care.spec.cjs e2e/auth.spec.cjs --workers=1
Remove-Item Env:AURA_E2E_AUTH
```

Definir também AURA_E2E_LIVE=1 para testar a demonstração publicada após o deploy.
Os testes com interceção de API não provam RLS; PGlite e API real são independentes.

## Limites antes de dados reais

Continuam pendentes consentimento/retenção/direitos dos titulares, recuperação de
backups, política MFA/sessões e proteção de passwords comprometidas. Dados apenas
fictícios. Não há importação/contactos/ficheiros clínicos, notificações automáticas,
recorrência, agenda de grupos/salas, calendário externo ou portal do aluno.
