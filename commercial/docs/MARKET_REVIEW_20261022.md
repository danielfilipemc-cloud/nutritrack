# AURA Business — concorrência e decisão de produto

Consulta de fontes públicas oficiais em 22 de outubro de 2026. Decisão: escolher o próximo incremento da demonstração Premium para profissionais e estabelecimentos de acompanhamento em português. Público assumido a partir do produto atual: profissionais de treino/avaliação e equipas de pequenos estabelecimentos; não foi validado ainda por entrevistas ou utilização real.

## Base e método

A versão publicada de referência é o PR53, integração `9986aff0467b835dc9e14a5e0fbb42086865fe7b`: diretório, ficha 360.º, avaliações, evolução, agenda, acompanhamento, equipa fictícia e marca. A fonte atual e RELEASE.json prevalecem sobre ROADMAP.md, que conserva planos históricos de 16 de outubro. Sem dados de adoção, receitas, conversão ou entrevistas, esta análise é qualitativa: não estima mercado, retorno, horas poupadas ou superioridade do AURA.

Foram lidas páginas de produto e centros de ajuda dos fornecedores. Evidência de documentação estabelece funcionalidades descritas pelo fornecedor, não prova qualidade, disponibilidade em todos os planos ou eficácia. Não foram abertas contas, pedidos comerciais, subscrições ou testes de produtos autenticados. Não foram usados dados privados. Não se reproduzem alegações promocionais de produtividade/retenção como resultados comprovados.

## Comparação focada

| Produto e relação | Evidência pública observada | Implicação para o AURA |
|---|---|---|
| Hexfit — acompanhamento e equipas | Intervenções ligadas à ficha, tarefas profissionais marcáveis como feitas; objetivos e subobjetivos; formulários e avaliações [H1–H3] | Falta ao AURA converter acompanhamento em próximos passos concretos e recuperáveis. Começar por ações internas por aluno. |
| ABC Trainerize — coaching e PT | Formulários de check-in personalizáveis, agendamento e respostas ligadas ao acompanhamento [T1] | Estruturar feedback entre sessões é uma hipótese útil para uma fase posterior; exige distinguir resposta do aluno de nota do profissional. |
| My PT Hub — PT e coaching | Check-ins com formulários, recorrência, caixa de revisão, atrasos e histórico/comparação; página informa dependência do plano Premium [M1] | Priorizar estados claros e histórico; não simular que foram enviadas notificações ou recolhidas respostas reais. |
| Nutrium — adjacente, especializado em nutrição | Consulta por etapas, medições, acompanhamento, questionário pré-consulta, modelos e agenda; aplicação do cliente [N1] | Reforça a continuidade do percurso e modelos editáveis. O módulo clínico/nutricional não é alvo deste incremento. |
| Virtuagym — adjacente, gestão de clubes/estúdios | Agenda com sessões individuais, aulas, recorrência e lista de espera; ligação a app e gestão de créditos [V1] | Recorrência e capacidades podem ter valor futuro, mas exigem contratos de recursos, conflitos e cancelamentos que ainda não existem na demo. |

As cinco soluções são referências selecionadas por proximidade funcional, não uma amostra representativa ou ranking do mercado. Preços, quota, suporte local, contratos, RGPD efetivo e qualidade de utilização não foram auditados. A página genérica /software/ do Virtuagym não ficou acessível; a conclusão usa a página específica de agendamento lida com sucesso. Páginas de atualizações podem mudar entre consultas: não se baseia a decisão em números de versão.

## Decisão: primeiro incremento de acompanhamento operacional

Entregar um plano de ações internas por aluno, na área Acompanhamento: descrição, prazo opcional, edição, conclusão/reabertura, filtros e contadores. A equipa mostra ações por concluir dos seus alunos atribuídos. Modelos curtos preenchem apenas descrições vazias; podem ser adaptados sem substituir trabalho já escrito. Rascunhos e filtros pertencem a cada aluno e mantêm-se na navegação; reload repõe os exemplos.

A escolha combina relevância direta para a ficha existente, dependências reduzidas e verificação objetiva sem dados reais. É uma hipótese de valor e não uma promessa de poupança de tempo. Não altera os indicadores de revisão da dashboard: uma ação interna, uma revisão guardada e uma marcação continuam conceitos distintos. O responsável das ações acompanha a atribuição guardada do aluno; não cria novas permissões nem mensagens.

Para o AURA, a oportunidade de diferenciação a testar é clareza do próximo passo e continuidade da ficha em português, com poucas decisões por ecrã. Não se afirma que isto seja exclusivo ou superior aos concorrentes. O desenho, textos e componentes são próprios do AURA; as fontes inspiram comportamentos gerais, sem copiar interface, imagens ou código de fornecedores.

## Evolução proposta depois deste incremento

| Ordem | Hipótese | Condição antes de implementar |
|---|---|---|
| Agora | Próximas ações e modelos simples ligados à equipa | Domínio, rascunhos por aluno, foco, contraste, isolamento, CI, Chromium/WebKit e revisão independente |
| Seguinte | Check-in estruturado e histórico de respostas fictícias | Definir autoria, origem e distinção entre resposta simulada e registo do profissional; sem avaliações clínicas automáticas |
| Depois | Recorrência de revisões e preparação de agenda | Definir séries, exceções, recursos/conflitos e cancelamentos sem enviar notificações reais |
| Mais tarde | Preparação da sessão e biblioteca de modelos | Validar o que profissionais reutilizam; começar com conteúdo neutro e revisão explícita |
| Fora do âmbito atual | Pagamentos, wearables, mensagens reais, prescrições/IA clínica e piloto | Contratos, segurança, privacidade, autorizações e âmbito separados; não pressupostos por esta análise |

Critérios verificáveis agora: criar/editar/concluir/reabrir, contagem coerente na equipa, nenhum rascunho trocado entre alunos, recuperação de foco quando uma ação sai do filtro, nenhuma chamada de dados privados e preservação das referências visuais protegidas. Os testes não medem aceitação comercial. Quando houver disponibilidade, validar em aparelhos reais e com profissionais se conseguem completar o percurso e compreender os estados sem ajuda.

## Fontes oficiais lidas

- H1 — [Hexfit: intervenções e tarefas profissionais](https://help.myhexfit.com/en/articles/4249613-what-are-the-interventions), artigo datado de 26/11/2025; secção TASK distingue tarefas internas das tarefas de clientes.
- H2 — [Hexfit: objetivos na aplicação do cliente](https://help.hexfit.com/en/articles/4302834-client-see-your-objectives-from-the-app), 27/05/2025. A conclusão de subobjetivos descrita é permanente; no AURA escolhemos reabertura explícita para o exemplo interno.
- H3 — [Hexfit: produtividade](https://hexfit.com/en/productivity/), página de produto; tarefas, automações e integrações anunciadas. Alegações de retorno não adotadas como evidência de eficácia.
- T1 — [ABC Trainerize: partilhar formulários de check-in](https://help.trainerize.com/hc/en-us/articles/31369316335124-Sharing-Check-In-Forms-with-Clients), centro de ajuda; criação, agendamento e revisão descritos.
- M1 — [My PT Hub: check-ins](https://www.mypthub.net/features/automated-client-check-ins/), página de produto; funcionalidades e condição Premium anunciadas, sem comparar preços.
- N1 — [Nutrium: primeiros passos](https://help.nutrium.com/pt/articles/1596018-os-primeiros-passos-com-o-nutrium), 12/09/2025; percurso de consulta, acompanhamento e modelos.
- V1 — [Virtuagym: agendamento](https://business.virtuagym.com/scheduling-software/), página específica de produto; calendário, reservas individuais/aulas e recorrência anunciados.

Atualizar esta comparação quando houver novas decisões de produto ou evidência de utilização. Não automatizar recolha de dados de clientes nem interpretar silêncio/funcionalidades não encontradas como ausência no concorrente.
