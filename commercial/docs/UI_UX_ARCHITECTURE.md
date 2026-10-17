# AURA Business — arquitetura UI/UX Premium

Referência auditada: `saas-foundation` em `c248203e7ecb41289cf455c2f720d27be8314359`.
Proposta apresentada antes da implementação. Âmbito exclusivo: commercial; sem SQL, serviços novos ou publicação.

## Diagnóstico confirmado

- Shell repetia marca/título, ligação ao painel, heading e seletor por página.
- Navegação tinha seis entradas e seis colunas no telemóvel; faltavam Evolução e Definições.
- Resumo individual incluía medições, formulário de acompanhamento e gestão de privacidade.
- Dashboard colocava todas as listas em sequência, sem aproveitar espaço desktop.
- CSS contém camadas históricas; a consolidação integral exige revisão das páginas públicas e não deve ser confundida com esta alteração estrutural.

## Mapa de navegação

| Grupo | Página | Destino |
|---|---|---|
| Operação | Visão geral | `/` |
| Operação | Alunos | `/alunos` |
| Operação | Agenda | `/agenda` |
| Acompanhamento | Avaliações | `/avaliacoes` |
| Acompanhamento | Evolução | `/evolucao` |
| Estabelecimento | Equipa e convites | `/equipa` |
| Estabelecimento | A tua marca | `/marca` |
| Estabelecimento | Definições | `/definicoes` |

Definições encaminha para Segurança (`/seguranca`) e, apenas para responsáveis, Competências (`/acessos`). Os controlos existentes e a autorização no banco continuam a impor acesso, independentemente da visibilidade dos links.

Ficha existente `/alunos/[id]`: Resumo, Acompanhamento, Objetivos, Avaliações, Evolução, Agenda, Cronologia, Integrações e Privacidade. As áreas são endereçáveis pelo parâmetro `section`, preservando os links existentes e os guards da mesma workspace. Não foi criada outra aplicação nem um novo modelo de dados. Acompanhar e Privacidade passam a áreas próprias. Integrações mantém apenas importação manual NutriTrack de peso/cintura; áreas futuras são identificadas como preparação.

## Design system

Canvas #0F1414; cartões #161D1D; superfície secundária #1D2626; primária #137F79; texto #F2F7F6; texto de destaque #8BE6DA; borda #2A3535; foco #6DD4C7. White Label continua a usar as cores validadas pela implementação existente.

Sidebar 248 px, grupos com títulos discretos; conteúdo fluido, máximo 1920 px. Espaçamentos 8/12/16/24/32; cartões com raio 12 px; títulos 32 px desktop e 28 px mobile. Controlos com altura mínima 44 px. Tabelas com cabeçalhos semânticos e scroll horizontal restrito ao contentor.

Mobile até 900 px: sidebar transforma-se em disclosure nativo no fluxo da página, sem modal ou armadilha de foco. Enter/Espaço controlam a abertura; links são alcançáveis por Tab; menu fecha após navegação. O seletor usa o estado da própria página, sem criar uma segunda sessão/organização autoritativa. Breadcrumbs e skip link permitem orientar e saltar a navegação.

## Entregas incrementais e aceitação

1. Shell, oito módulos, selector único, separação das áreas da ficha, listas do dashboard em grelha.
2. Refinamento da hierarquia operacional, formulários/listas e revisão visual com fixtures desktop/mobile.

O segundo incremento coloca indicadores antes das ações, apresenta Agenda de hoje numa coluna própria e usa duas instâncias do mesmo componente autorizado de prioridades (consulta independente com filtro `session`). A pesquisa nas prioridades não altera a agenda. O diretório passa a recolher o formulário de criação num disclosure nativo, preservando o conteúdo ao fechar/reabrir. `ProfileNavigation` apresenta botões com todas as áreas visíveis no desktop e um seletor nativo no mobile, usando o mesmo `changeView` e as mesmas confirmações de rascunhos.

Cada entrega deve preservar testes negativos de permissões, rascunhos, concorrência e proveniência. Testes de interface com fixtures não substituem Auth/PostgREST real. Uma captura revista não certifica acessibilidade ou qualidade comercial: manter explícitas limitações de leitores de ecrã, uso real e dispositivos não ensaiados.

Os bloqueios altos de passwords comprometidas, sessões/JWT, recuperação cloud e de conta/MFA, e requisitos jurídicos continuam abertos nos documentos operacionais. Este redesenho não autoriza piloto com dados reais.
