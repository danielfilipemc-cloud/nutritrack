# Prioridades e acompanhamento fictícios

Base: `85ea4d668d676583439728da89826e6f53bf0ba6`, PR #48 publicado e verificado no staging. Branch isolada `feat/aura-demo-followup-priorities`.

As prioridades passam a ordenar revisões ativas vencidas por data e, em empate, ID local. Distinguem revisão de hoje/em atraso pela referência explícita da demo, sem relógio real ou interpretação clínica. Datas inválidas, vazias, futuras e estados em pausa/concluído não entram na lista. A projeção devolve apenas ID, nome, data e estado relativo; não transporta objetivos ou responsáveis.

Uma prioridade abre o aluno correto diretamente em Acompanhamento, focando e mostrando o título dessa secção, mesmo ao regressar à mesma secção. A vista da ficha fica controlada pela página; a navegação interna mantém os rascunhos por aluno. O pedido de foco externo é explícito e não afeta escolher campos, guardar ou selecionar áreas normalmente. O estado vazio mantém a explicação e oferece consulta do acompanhamento do aluno escolhido.

Guardar valida estado, responsável fictício permitido, data de revisão opcional entre2000-01-01/2100-12-31 e objetivo até500 caracteres, devolvendo uma cópia normalizada. Erros ficam associados ao campo e focam-no; confirmações mantêm o foco no botão. Editar limpa apenas a mensagem do acompanhamento desse aluno. Cabeçalho e prioridades refletem valores guardados, preservando rascunhos não guardados e separação de mensagens/avaliações entre alunos.

Quatro novos testes de domínio verificam seleção/ordem/data de referência, imutabilidade/projeção, normalização e validação por campo. Seis percursos de browser a320/375/1440 px verificam entrada por prioridade/teclado/foco, repetição, rascunhos, atualização só após guardar, pausa/reativação/conclusão, revisão vazia/futura, ordenação/empate, limite do calendário, estado vazio, nomes longos, recarregamento e ausência de pedidos externos.

As capturas reais antes/depois incluem dashboard, destino da prioridade, ordenação e vazio. O texto da prioridade na dashboard da demo muda intencionalmente; não se promete identidade dos dois screenshots completos da demo. A dashboard profissional, agenda lateral e prioridades profissionais permanecem fora do diff e têm quatro pares protegidos independentes. As restantes áreas/agenda da demo mantêm o comportamento já publicado.

Sem alterações em Auth/RLS, migrations remotas, dependências, operações ou dados profissionais, produção, main e NutriTrack pessoal. Apenas exemplos em memória; sem notificações, storage ou rede de dados. Revisão por agente independente e CI completo sobre a HEAD exata antes de integrar/publicar apenas no staging autorizado. WebKit Linux não equivale a Safari/iOS real; Firefox, leitores de ecrã e zoom nativo continuam sem validação específica.
