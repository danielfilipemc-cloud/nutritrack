# Continuidade da demonstração — check-ins, revisão, séries e preparação

Base: PR54, integração c556ec893806df23d96570b46d5f6e5b9220b3bd. Âmbito autorizado: concretizar as quatro implicações do estudo qualitativo de concorrência, apenas em demonstração com dados fictícios. Não equivale à aplicação profissional finalizada ou a um piloto real.

## Percurso entregue

Alunos → Fila de revisão → Acompanhamento → Check-ins → Resposta simulada → Revisão → Ação interna ligada → Agenda → Série/revisão → Resumo → Preparação da sessão. As áreas e navegação da dashboard Premium permanecem intactas.

### A. Check-ins

Modelo neutro v1 de três perguntas, guardado como snapshot por exemplo. Preparação com prazo; resposta simulada identificada e permitida até à referência fixa 2026-10-20; revisão explícita por responsável guardado; cancelamento apenas antes de resposta. Não há envio, receção real, dados clínicos, fotografias ou anexos. Campos opcionais até 500 caracteres. Respostas submetidas são preservadas, sem edição silenciosa; notas de preparação são separadas. A ordem de submissão, não a de criação, determina a resposta mais recente. Criação/edição de modelos e versões posteriores não estão neste incremento.

Rascunhos de respostas por check-in, prazo e filtro por aluno mantidos ao navegar. Ação criada por escolha explícita a partir de uma resposta revista, com origem e prevenção de duplicados mesmo após conclusão/reabertura. Ações não substituem revisões, avaliações ou marcações.

### B. Fila de revisão

Em Alunos, um registo por aluno com motivos separados: respostas por rever, check-ins sem resposta no prazo e ações por concluir. Filtros de motivo/responsável persistem e cada aluno abre as fontes no acompanhamento. Falta de resposta não representa baixa adesão, risco ou desmotivação. Contagens derivadas dos registos guardados; não são somadas como alunos diferentes nem alteram os indicadores aprovados da dashboard.

### C. Recorrência

Painel adicional na Agenda, mantendo o compositor individual. Um recurso partilhado explícito de profissional/sala, o mesmo calendário já existente; não se simula disponibilidade multi-recurso. Séries semanais/quinzenais de 2–12 ocorrências, início e fim derivados do número. Validação de todas as ocorrências antes de guardar, sem criação parcial; conflitos também com marcações individuais. IDs estáveis e número de ocorrência original preservado.

Alterar hora/duração ou cancelar: só esta, esta e seguintes na ordem original, ou todas as ativas na data de referência e posteriores. Reagendamento individual permite alterar uma data mantendo a série. Alterar em bloco preserva datas individuais e cancelamentos anteriores; “todas” aplica explicitamente a nova hora às ocorrências ativas, incluindo exceções de hora. Registos anteriores à referência ficam intactos. Cancelamento em bloco tem confirmação, retorno de foco e histórico. Não existe reativação de canceladas nem alteração em bloco de datas/intervalo.

Horas civis Europe/Lisbon, conservando a hora local através de horário de verão. Horas inexistentes/ambíguas e intervalos que atravessem a mudança são rejeitados; escolhe-se outro horário. Isto é uma regra da série demo; não foi feita uma migração dos horários da aplicação profissional. Criação/manutenção de séries preserva o rascunho do compositor individual e o contexto de revisão por aluno. Sem calendários externos, convites ou notificações reais.

### D. Preparação

Painel no Resumo da ficha com última avaliação, última resposta por ordem de submissão, ações pendentes e próxima marcação ativa na referência ou depois. Ligações abrem avaliações, respostas/ações e agenda. Sem diagnósticos ou factos gerados. Rascunho interno até 1000 caracteres por aluno; modelo só preenche campo vazio. Modelo é cópia no momento da escolha, resumo permanece atualizado a partir das fontes. Sem persistência após reload.

## Verificação obrigatória

- Domínio: transições/autoria/snapshot, isolamento e idempotência; contagens deduplicadas; séries atómicas, conflitos tardios, exceções, histórico, datas/limites e DST.
- Browser: percurso de revisão/ação, retorno aos filtros, rascunhos entre alunos, estados vazios/futuros/cancelados, séries/âmbitos/confirmação/foco, preparação e limites de largura.
- Canários de storage e pedidos de rede: novos percursos continuam sem adaptação profissional ou chamadas privadas.
- Chromium completo e matriz emulada desktop/Android Chromium 360/412, iPhone WebKit 320/390. Aparelhos físicos/Safari iOS não estão validados.
- Antes/depois das mudanças intencionais; sete pares canónicos anteriores (dashboard/profissionais) conservados. Não substituir referências históricas silenciosamente.
- CI completo e revisão independente da HEAD exata antes de integração normal e publicação manual só no staging. Reconfirmar PR40–44/54 e heads externos. AutoDeploy permanece desligado.

Sem alterações de main, produção, Auth/RLS, migrations remotas, módulos profissionais, dependências ou NutriTrack pessoal. Testes SQL do CI usam motor local descartável; não se executam scripts de base remota. Recarregar repõe exemplos, filtros e rascunhos. Não há aplicação nativa, conta de aluno, mensagens ou notificações reais nesta entrega.
