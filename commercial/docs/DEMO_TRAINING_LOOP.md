# Treino integrado na demonstração Premium

Âmbito: `/demo/experiencia` → Ficha 360.º → Treino. Apenas dados inventados e estado em memória. Nenhuma alteração profissional, Auth/RLS, migration, base real, produção, main ou NutriTrack pessoal. Não foram consultados profissionais. Os prints fornecidos orientam os percursos, sem copiar pessoas, planos, resultados ou materiais proprietários.

## Circuito funcional

1. O profissional prepara um plano com vigência, sessões e blocos individuais/circuitos. Cada exercício identifica unidade: repetições ou segundos, com valor por série/ronda e descanso em segundos. Guardar cria uma revisão de rascunho, sem alterar a vista do aluno.
2. Disponibilizar copia uma versão imutável do rascunho guardado. Alterações visíveis por guardar bloqueiam essa ação. O aluno só consulta a versão disponibilizada; retirar impede novas gravações dessa versão, preservando histórico e rascunhos.
3. A vista simulada prepara um registo ligado à versão e sessão. O aluno declara concluído/parcial, séries/rondas, valor comum por exercício e carga opcional em kg. A nota é do aluno; não é uma nota interna. Nada é enviado para uma conta real.
4. A execução guardada entra na fila de revisão do aluno correto. O profissional revê sem reescrever resultados/nota e pode criar explicitamente uma ação ligada à origem. Repetir a criação não duplica essa ação, mesmo depois de concluída.
5. A origem da ação revela o registo exato, removendo filtros que o ocultariam e recuperando foco. Resumo e preparação de sessão mostram contagens factuais atualizadas. Execuções não criam avaliações físicas, não alteram marcações e não geram pontuações clínicas.

## Contratos

`training.ts` contém o modelo e comandos puros. Identidade: aluno sintético pertencente à coleção da sessão; nenhum ID/URL constitui autorização real. Planos, publicações e execuções são separados. O registo inclui `contractVersion:1`, `scope:'aura-demo'`, `source:'simulated-student'`, ID estável de origem e requestId composto com o aluno. Estes campos permitem ensaiar rastreabilidade/repetição; não são um protocolo autenticado NutriTrack nem devem ser aceites por um backend como autorização.

Mesmo requestId/conteúdo normalizado devolve o registo existente, inclusive após revisão/retirada; conteúdo divergente é recusado, sem substituir o original. Uma nova execução exige uma versão atualmente disponibilizada e data dentro da vigência, de 2000-01-01 até à referência fixa 2026-10-20. Versão antiga preparada mantém-se em rascunhos, mas não pode criar execução nova após troca/retirada da versão. Atualizar para a versão atual prepara outro rascunho sem destruir o anterior não submetido.

Snapshots da sessão preservam títulos, exercícios, unidades e objetivos utilizados. Resultados desconhecidos ficam null; carga vazia não é zero. Um bloco com zero séries/rondas realizadas exige campos de resultados/carga vazios. Concluído exige todas as séries/rondas, mas não presume igualar o valor planeado; é estado declarado pelo aluno, não avaliação técnica. Não calcular médias entre protocolos/unidades diferentes.

## Rascunhos, foco e temporizador

Editor, sessão/bloco selecionados, pesquisa, filtros e rascunhos de execução pertencem ao aluno. Rascunhos de execução distinguem versão/sessão; um novo exemplo após submissão recebe outro requestId, ficando o anterior no histórico. Trocar aluno/área não apaga o trabalho. Reload repõe a demo.

Feedback recebe foco depois da atualização do DOM. Erro de data identifica o campo; trocar nota/aba não deixa referências de acessibilidade penduradas. Trocar rascunho limpa o erro do contexto anterior. Remover exercício recupera foco no botão de adicionar depois do commit, incluindo quando esse botão estava desativado pelo limite. A tabela tem região nomeada, entrada por Tab e deslocação por setas.

O temporizador é local, por aluno, sempre montado enquanto a demo existir. Usa prazo absoluto e recalcula o tempo restante, incluindo ao ocultar/navegar. Pausa conserva o restante; repor e mudar duração são ações explícitas. Sem som, push, envio ou promessas de execução em segundo plano após fechar a página. A expiração não regista treino como realizado.

## Biblioteca visual e limites

Seis movimentos com material, descrição e esquemas SVG originais de duas posições. Sem fotografias, conteúdos copiados, CDN ou vídeos. Os esquemas identificam visualmente os exemplos, sem análise biomecânica ou recomendação personalizada. A biblioteca não é um catálogo profissional completo.

Até 6 sessões, 6 blocos por sessão, 6 posições por bloco e 60 posições no plano; 1–10 séries/rondas, descanso 0–3600 segundos. Repetições inteiras 1–1000, duração 1–3600 segundos e carga registada opcional 0–500 kg com duas casas decimais são limites estruturais, não valores recomendados. Até 20 versões disponibilizadas e 100 registos por aluno. Remoção de exercícios existe no rascunho; não há remoção de blocos/sessões ou apagamento de execuções nesta fase.

## Validação

Domínio: separação rascunho/publicação, snapshots, ownership, revisão, replay e divergência, retirada/versão antiga, unidades, null/zero, datas, ação deduplicada e limites. Browser: percurso completo profissional–aluno–profissional, filtros/origem/foco, rascunhos entre alunos, publicação explícita, rascunho antigo, biblioteca, limites de edição, temporizador, storage/rede privados e reflow/espaçamento/cores forçadas.

Executar `npx playwright test --config playwright.demo-training.config.cjs` para Chromium desktop/Android e WebKit iPhone emulados. CI completo, capturas protegidas, revisão independente e testes online antes da entrega. Emulação, axe e screenshots não equivalem a aparelhos físicos, leitor de ecrã ou conformidade WCAG integral; contraste em gradientes continua a exigir verificação manual.
