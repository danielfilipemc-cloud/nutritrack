# AURA e NutriTrack — objetivo integrado

O objetivo acordado desde o início é ligar estabelecimento/equipa, profissional e aluno: treino, nutrição/NutriTrack, agenda, avaliações/evolução e acompanhamento. Cada módulo deve fechar o percurso profissional → aluno → profissional, preservando identidade, autoria, origem, versão e recuperação. Não declarar a integração concluída só porque existem ecrãs ou funções partilhadas.

## O que existe e o que falta

- A demonstração Premium publicada até PR57 liga diretório/ficha, avaliações, evolução, agenda, ações/check-ins e preparação; a nutrição contém plano/diário/vista simulada por aluno, com cálculos puros. É estado fictício em memória, sem transporte NutriTrack.
- Existe código de importação assistida de peso/cintura de backups NutriTrack v2, descrito em [NUTRITRACK_BRIDGE.md](NUTRITRACK_BRIDGE.md). Isso não liga contas, não importa alimentação e não representa sincronização automática. A documentação conserva validações históricas; verificar o estado efetivo antes de anunciar disponibilidade cloud atual.
- O incremento de treino fecha o circuito simulado de rascunho/publicação, execução com snapshot, revisão e ação ligada; ver [DEMO_TRAINING_LOOP.md](DEMO_TRAINING_LOOP.md).
- O espaço unificado simulado e o circuito de disponibilização/revisão alimentar estão descritos em [DEMO_STUDENT_SPACE.md](DEMO_STUDENT_SPACE.md). Continuam por fechar o transporte alimentar AURA–NutriTrack, a experiência autenticada final do aluno, reservas com capacidade e os contratos reais de identidade/permissões/persistência. O portal proposto evolui no `/aluno` existente; não presumir uma segunda sessão pessoal NutriTrack.

## Referências e sequência

Os prints Integrative Spot enviados pelo utilizador mostram sessões A/B, blocos/temporizador, notas/feedback, agenda com vagas e comparação de avaliações. Servem para analisar percursos. Não reutilizar pessoas, resultados, planos individuais, imagens ou marca. O ecrã nutricional mostrado só permite observar um convite para consulta, sem provar plano/diário; os textos do assistente IA não comprovam as suas capacidades ou acervo.

1. Construir treino/exercícios e retorno dos registos à ficha/acompanhamento, já com separação de autoria e versões.
2. Fechar na demo o circuito nutricional com disponibilização explícita, registo, histórico e retorno. Definir/adaptar transporte AURA–NutriTrack com vínculo próprio, idempotência, unidades e snapshots; ensaiar só dados fictícios.
3. Unificar navegação mobile do aluno para treino, alimentação, agenda, evolução e acompanhamento. Capacidade/inscrições exigem incremento próprio; não transformar silenciosamente a agenda atual de recurso único.
4. Auditar os percursos completos antes de qualquer piloto. Operação real, IA, mensagens/push, pagamentos ou ligação ao NutriTrack pessoal não são autorizados pela existência de simulações.

Fontes obrigatórias: [NUTRITRACK_INTEGRATION_CONTRACT.md](NUTRITRACK_INTEGRATION_CONTRACT.md), [NUTRITION_ARCHITECTURE_PROPOSAL.md](NUTRITION_ARCHITECTURE_PROPOSAL.md), [NUTRITION_IMPLEMENTATION_PLAN.md](NUTRITION_IMPLEMENTATION_PLAN.md), [NUTRITION_REUSE_MAP.md](NUTRITION_REUSE_MAP.md) e documentação dos PRs Premium. Reusar funções puras/padrões; excluir storage, sincronização e sessão pessoais do monólito.

## Restrições vigentes

Sem consultar profissionais, contactos comerciais ou recrutamento nesta fase: o utilizador quer primeiro uma base competitiva sólida. Apenas demonstração e dados fictícios, branch/PR isolado, CI e revisão independente, publicação apenas no staging após aprovação e confirmação online. Preservar dashboard Premium, prioridades/agenda lateral, rascunhos e referências protegidas. Reconfirmar estados de #40–#44 e trabalho novo antes de integrar. Produção, main, Auth/RLS, migrations remotas, base real e NutriTrack pessoal permanecem isolados.
