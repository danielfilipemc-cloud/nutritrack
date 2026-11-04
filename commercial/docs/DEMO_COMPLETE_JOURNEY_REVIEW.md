# PR #51 — Percurso completo do aluno fictício

Base publicada: a3aade493f8d8a3cb3269c49dfeb883390906b42, PR #50. Branch isolada feat/aura-demo-complete-student-journey.

O diretório coloca pesquisa/resultados antes da criação, com atalho que foca o nome do novo aluno. A ficha oferece regresso ao contexto de origem e ações Anterior/Seguinte entre Resumo, Avaliações, Evolução, Agenda e Acompanhamento. Áreas e indicadores ficam separados por aluno; voltar a um resultado continua a abrir explicitamente o Resumo. Rascunhos continuam locais e separados por aluno.

A agenda recebe pedidos explícitos para consultar um aluno ou preparar a sua revisão, com foco no destino. Uma revisão tem aluno/tipo fixados e um rascunho próprio por aluno. O estado anterior da consulta, o rascunho geral, a edição de uma marcação e o rascunho de criação subjacente são copiados/preservados ao entrar no contexto e recuperados em Retomar agenda e rascunho anteriores. Não há substituição silenciosa de outro aluno nem criação automática.

Após criar a marcação, pode continuar-se no acompanhamento do aluno. A data da próxima revisão ativa aparece a partir da agenda e só é copiada para o formulário por ação explícita. É necessário guardar acompanhamento para atualizar contexto/prioridades. Cancelar uma marcação não altera a revisão guardada. As duas datas têm finalidades distintas e ficam identificadas na interface; nada é enviado.

Os gráficos da demo ganham último valor, número de medições e período, além de explicação para um único ponto e estados vazios com ação. A apresentação usa no máximo 30 medições de cada indicador, conservando todo o histórico. StudentIdentity, ProfileNavigation, ClientProgressSummary e ProgressChart continuam partilhados sem alterar os módulos profissionais ou carregar dados privados. A dashboard Premium inicial não foi redesenhada; indicadores/agenda/prioridades continuam derivados dos mesmos estados fictícios após guardar.

Testes de domínio: cópias independentes dos rascunhos, seleção da próxima revisão, projeção/cap dos gráficos e separação entre criar marcação e guardar acompanhamento. Browser: percurso completo até prioridades, rascunhos de dois alunos com reagendamento pendente, métricas por aluno, vazio, nome longo, foco, histórico, reposição, canários privados e ausência de pedidos de dados. Configuração específica emula desktop Chromium, Android Chromium a360/412 e iPhone WebKit a320/390. Não equivale a dispositivos físicos.

Capturas reais antes/depois e seis pares protegidos: dashboard da demo e dashboard/resumo profissionais a375/1440. A captura profissional deve esperar o viewBox estável, conforme diagnóstico do PR #50. Sem Auth/RLS, migrations remotas, produção, main, dependências, dados reais ou NutriTrack pessoal. CI completo e revisão independente sobre candidato/base exatos antes de integrar/publicar exclusivamente no staging autorizado.

Sequência posterior preservada: PR #52 dashboard Premium; PR #53 equipa/personalização; auditoria final da demo. Nenhuma dessas fases autoriza piloto ou acesso a dados reais nesta entrega.
