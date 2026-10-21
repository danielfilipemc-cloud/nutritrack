# Diretório fictício — pesquisa, estados e entrada na ficha

Base: `6c76c32eee01bcb2b4e9235d3b5ba4fde253911a` (PR #49 publicado). Branch isolada `feat/aura-demo-student-directory`.

O diretório combina pesquisa literal por nome (sem distinguir maiúsculas, acentos ou espaços repetidos) e estado do acompanhamento guardado. Mantém a ordem dos exemplos, mostra contagem e permite limpar pesquisa/filtros com foco no campo de pesquisa. O estado vazio é explícito. A apresentação reutiliza StudentIdentity e recebe apenas ID, nome e estado; não recebe notas, objetivos, medições, organização, sessão ou carregadores privados.

Pesquisa, filtro, aluno escolhido e rascunho de criação ficam no estado da página. Navegar não os apaga, guardar acompanhamento atualiza os resultados e editar sem guardar não os altera. Abrir um resultado define explicitamente o aluno e Resumo, mesmo se a área anterior era Acompanhamento ou se é o mesmo aluno. O pedido de foco externo existente leva ao primeiro título do resumo (ou ao convite de primeira avaliação), sem competir com o título global. Rascunhos da ficha mantêm-se indexados por aluno. Recarregar repõe os exemplos.

A distinção é deliberada: o filtro da demo usa o estado do acompanhamento; o diretório profissional filtra arquivo/atividade do registo. Não se apresenta pausa/conclusão como arquivo nem se transportam queries, sessão, permissões ou operações de gestão profissional para a demo. Os módulos profissionais e a dashboard Premium ficam fora do diff.

Dois testes de domínio cobrem normalização Unicode, espaços, pesquisa literal de pontuação, combinação de filtros, projeção, ordem, vazio e imutabilidade. Seis percursos browser a320/375/1440 px cobrem teclado/foco, contagens, estados guardados versus rascunhos, repetição da mesma entrada, isolamento de alunos, limpeza, nomes de100 caracteres, criação/primeira avaliação/evolução, reposição, URL privada sem efeito, ausência de pedidos de dados e preservação de storage sintético privado.

Capturas reais antes/depois: diretório, pesquisa e vazio; regressão separada para dashboards da demo e dashboard/resumo profissionais. Apenas dados fictícios em memória. Sem Auth/RLS, migrations remotas, dependências, produção, main ou NutriTrack pessoal. CI completo e revisão independente sobre candidato/base exatos antes de integrar/publicar só no staging autorizado.
