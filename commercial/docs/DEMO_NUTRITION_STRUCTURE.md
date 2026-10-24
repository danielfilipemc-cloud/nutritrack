> Documento da estrutura base do PR #57. Para o comportamento atual com versões, revisão e espaço unificado, consultar [DEMO_STUDENT_SPACE.md](DEMO_STUDENT_SPACE.md).

# Nutrição integrada na demonstração Premium

Âmbito: `/demo/experiencia` → Ficha 360.º → Nutrição. Estado sintético por aluno, em memória; atualizar repõe os exemplos. Não modifica a demonstração clássica, módulos profissionais, Auth/RLS, base real ou NutriTrack pessoal. Nenhum contacto com profissionais nesta fase.

## Percurso implementado

- Resumo da ficha liga à nutrição e mostra quantidades factuais de refeições/registos do mesmo aluno.
- Plano de exemplo: adicionar e editar refeições, horário, opção principal e alternativa opcional. Até 12 refeições por aluno; nesta estrutura, uma opção por refeição e uma alternativa. Sem equivalência nutricional presumida, metas ou recomendações.
- Diário e histórico: registos simulados com data, refeição, opção escolhida, quantidade, composição e nota do aluno, separados da autoria do plano. Filtro por dia ou todas as datas; este último não é apresentado como total diário.
- Vista do aluno: pré-visualização identificada como simulação, consulta do plano atual e criação local de um registo. Não é uma conta, portal autenticado ou publicação para um aluno real. Escolher uma data não reconstrói versões históricas do plano.

## Contratos e recuperação

Ownership é validado pelo comando, não apenas pela seleção da interface. Uma refeição não pode ser editada/registada por outro aluno; alunos recém-criados começam sem plano partilhado. IDs monotónicos da sessão distinguem refeições/registos. Um registo por refeição/dia; tentativas repetidas preservam o original, sem duplicar ou sobrescrever. Limite de 200 registos por aluno.

O diário conserva um snapshot dos dados efetivamente escolhidos, incluindo composição desconhecida. Alterações posteriores no plano não alteram nome, quantidade, composição ou nota já registados. Valores desconhecidos continuam `null`/—; ausência de registos não significa consumo zero. Alternativas não se somam à opção principal. Os cálculos reutilizados são módulos puros revistos, sem adaptadores ou I/O; o teste da closure da demo permite apenas esses caminhos nominais adicionais.

Rascunhos de criação, edições por refeição e notas por aluno/dia/refeição são separados. Trocar de área, aluno ou fechar uma edição mantém-nos. Guardar edição restaura o rascunho de criação. Remover uma alternativa pendente mostra indisponibilidade explicitamente e pede nova escolha, mantendo a nota. As edições guardadas aplicam-se ao plano atual; a nota pendente não é uma cópia histórica do plano.

Depois de guardar um registo o foco passa para feedback estável; erro de data identifica e foca o campo. Fechar uma edição devolve foco ao formulário. Datas: 2000-01-01 a 2026-10-20, referência fixa da demo; quantidades: 0,001–5000 g, até três casas decimais. Sem exclusão de histórico ou refeições nesta fase.

## Validação e limites

Testes de domínio cobrem ownership, atomicidade, snapshots, duplicados, datas, valores desconhecidos, sessões independentes e capacidades. Testes de browser cobrem o percurso, rascunhos, recuperação, storage/rede privados, reload, layout estreito, conteúdos longos, foco e alternativa removida. Matriz: Chromium desktop/Android e WebKit iPhone emulados; não equivale a aparelhos físicos ou leitores de ecrã. Capturas protegidas da dashboard e superfícies profissionais mantêm-se como gate.

A comparação visual/auditoria automática não certificam acessibilidade integral; contraste manual em gradientes e testes humanos permanecem pendentes. Valores alimentares são deliberadamente inventados e não constituem catálogo de produção. Não existem importações reais, prescrição, pesquisa de alimentos externos, receitas, fotografias, notificações, publicação, base persistente ou autenticação de aluno.

## Estrutura seguinte

O módulo de treino será uma fase isolada: biblioteca visual de exercícios, sessões e registo simulado de execução ligados ao mesmo aluno. Os prints que o utilizador enviar poderão orientar os percursos, sem bloquear esta base nem presumir integração já feita. A interface definitiva do aluno será afinada depois dessa referência. Nenhum estudo com profissionais ou piloto com dados reais está autorizado por esta entrega.
