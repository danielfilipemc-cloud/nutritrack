# Espaço do aluno e circuito alimentar — demonstração

Apenas `/demo/experiencia`, dados inventados em memória e staging. Entrada pela Ficha 360.º → Experiência do aluno, ou pelo botão no Resumo. Hoje, Treino, Alimentação, Agenda e Evolução partilham o aluno e os dados da ficha. Não é conta real, autorização, portal profissional publicado ao aluno, nem sincronização NutriTrack. Sem alterações ao `/aluno` autenticado, módulos profissionais, produção/main, Auth/RLS, migrations, base real ou NutriTrack pessoal.

## Uma instância e dois contextos

Treino e Nutrição mantêm uma única instância montada. O modo de pré-visualização seleciona a apresentação do aluno sem criar formulários/IDs duplicados. Rascunhos profissionais, seleções, notas e temporizador sobrevivem ao regresso à ficha e à navegação entre áreas. O contexto de cada aluno é separado. Feedback profissional e feedback do formulário do aluno têm canais independentes; mensagens de revisão/publicação não aparecem no modo aluno. Abrir um exercício e regressar ao treino recupera foco no título da área depois do commit. Reload repõe os exemplos.

O espaço do aluno só mostra o plano disponibilizado; não permite publicar, editar planos, rever registos ou alterar acompanhamento. A biblioteca continua acessível a partir do exercício e permite regressar ao treino. Agenda é consulta das marcações ativas futuras a partir da referência fixa da demo; não anuncia reservas, capacidade ou cancelamentos pelo aluno. Evolução reutiliza o gráfico e tabela de medições, sem formulários profissionais, interpretações ou pontuações clínicas. As contagens de Hoje descrevem registos, não metas nem adesão.

## Rascunho, disponibilização e composição alimentar

`NutritionState.meals` é o rascunho guardado. Alterar uma refeição incrementa a revisão e preserva todas as publicações e entradas. Disponibilizar exige a revisão esperada e pelo menos uma refeição. O editor bloqueia a ação enquanto houver alterações locais, mesmo numa edição fechada ou só na quantidade de criação; é possível recuperar, guardar ou descartar explicitamente o rascunho de uma refeição.

Cada publicação copia refeições, opções, quantidades e composição original por 100 g. Guardar não altera a vista do aluno. A publicação não é envio real. Retirar desativa novas gravações dessa versão, sem apagar histórico ou rascunhos. Até 12 refeições e 20 versões por aluno; repor uma versão retirada cria um novo número, sem reescrever o anterior.

Os exemplos iniciais têm versão disponibilizada em 18/10/2026; a entrada de 19/10 é historicamente coerente e já revista. Novas publicações usam a referência 20/10/2026. Novos registos exigem data válida até essa referência e não anterior à disponibilização da versão utilizada. Escolher uma data não reconstrói um plano histórico.

## Registo, replay e revisão

Respostas são separadas por aluno, versão, refeição e dia. Uma versão antiga ou retirada conserva a nota e seleção; a gravação fica bloqueada. Selecionar a atual usa outro contexto sem apagar os rascunhos antigos. A alternativa de uma publicação é imutável: removê-la do rascunho não invalida silenciosamente a resposta antiga. A publicação nova tem o seu próprio contexto de resposta.

Cada entrada guarda versão, origem sintética, ID de origem estável, nome/hora da refeição, composição/quantidade/nota e escolha. A chave de origem e a regra de negócio preservam uma entrada por aluno+refeição+dia mesmo mudando a versão, para evitar duplicar o total do dia. Replay da mesma versão/escolha/nota normalizada é idempotente após revisão ou retirada; conteúdo divergente é recusado, preservando o original. Não é contrato autenticado de transporte nem aceitação de payloads arbitrários de terceiros.

O profissional revê uma entrada pendente com o responsável guardado no acompanhamento. A revisão não altera nota ou composição. Só depois pode criar explicitamente uma ação interna ligada, deduplicada inclusive depois de concluída/editada. A origem na ação abre a entrada exata, repõe filtros e recupera foco. A fila tem motivo alimentar separado; Resumo, preparação e alerta de novos registos na dashboard derivam do mesmo estado. O alerta só existe quando há entradas/execuções por rever e não altera as prioridades por data de acompanhamento.

Até 200 entradas por aluno, sem apagamento de histórico. Uma opção principal e uma alternativa por refeição; não representam equivalência nutricional. Quantidades em g, energia em kcal e macros em g. Desconhecido continua null; zero conhecido permanece zero. Composição incompleta usa subtotal conhecido, diário incompleto não significa consumo zero, e não há metas, prescrição ou avaliação clínica.

## Validação e próxima fronteira

Testes de domínio cobrem versões/snapshots, ownership, revisão, origem, replay após retirada, divergência, unicidade entre versões, datas, limites e null/zero. Browser cobre profissional→aluno→fila→revisão→ação/origem, versões antigas, rascunhos, timer entre áreas, agenda/evolução sem edição, isolamento I/O/storage, reload e mobile/teclado/reflow/cores forçadas. Repetir CI completo, Chromium/WebKit emulados, capturas protegidas, axe e revisão independente antes de integrar/publicar.

O objetivo AURA–NutriTrack permanece explícito, mas transporte alimentar real e identidade/permissões/persistência exigem fase própria. Este incremento não usa nem altera o storage, sessão ou base pessoais NutriTrack e não inventa uma ligação real com um envelope fictício. Sem consultas/contactos a profissionais. Dispositivos emulados, axe e capturas não equivalem a aparelhos físicos, leitores de ecrã ou certificação WCAG; contraste em gradientes continua a exigir revisão manual.
