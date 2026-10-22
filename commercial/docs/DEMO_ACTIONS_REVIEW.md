# PR54 — próximos passos do acompanhamento

Base publicada: PR53, `9986aff0467b835dc9e14a5e0fbb42086865fe7b`. Branch isolada `feat/aura-demo-followup-actions`; destino exclusivo `integration/aura-staging`.

## Decisão e entrega

A comparação qualitativa em MARKET_REVIEW_20261022.md identifica tarefas internas ligadas à ficha como incremento útil e viável agora. Fontes oficiais de Hexfit, Trainerize, My PT Hub, Nutrium e Virtuagym fundamentam a escolha e o backlog; não demonstram retorno comercial ou superioridade do AURA.

O plano de ações na área Acompanhamento permite criar, editar, concluir e reabrir ações fictícias com descrição de 2–120 caracteres e prazo opcional. Filtros Todas/Por concluir/Em atraso/Concluídas e contagens usam valores guardados, com atraso relativo à data fixa da demonstração. Dois exemplos iniciais são independentes por sessão; alunos novos começam vazios.

O responsável acompanha o care guardado do aluno. A Equipa mostra ações por concluir de cada aluno atribuído; mudar a atribuição guardada move essa leitura para o profissional certo. Pausar alguém não revoga acessos nem apaga ações ou atribuições anteriores.

Rascunhos, edição e filtros mantêm-se por aluno e ao sair da ficha. Editar uma ação conserva separadamente o rascunho de criação; guardar ou cancelar a edição recupera-o. Outras edições ficam indisponíveis enquanto há uma edição em curso. Modelos neutros só preenchem uma descrição vazia e mantêm o prazo. Concluídas permanecem consultáveis e editáveis; reabrir retira a data de conclusão do exemplo. Não existe histórico de versões/auditoria persistente.

## Fronteiras

Ações internas, revisões guardadas e marcações são conceitos independentes. O novo plano não altera prioridades ou indicadores da dashboard, care, avaliações ou agenda. Não é uma tarefa concluída pelo aluno, um envio de mensagem, check-in recebido, convite, notificação ou prescrição. Não há rede, persistência, dados reais, alterações profissionais, Auth/RLS, migrations, main, produção ou NutriTrack pessoal. Recarregar repõe exemplos. Apenas apresentação e comportamentos próprios do AURA; sem copiar interface/código dos concorrentes.

## Verificação e publicação

Domínio: isolamento entre sessões/alunos, IDs e ownership, edição/conclusão/reabertura, ordenação estável, atraso fixo e validação. Browser: fluxo completo e contagens na equipa, foco quando os filtros removem ações, reordenação de linhas, rascunhos de criação/edição, cancelamento, modelos sem sobreposição, vazio, nome longo, marca e canários privados. Regressões do percurso anterior mantidas.

CI completo obrigatório. Matriz de nove casos em cinco configurações (desktop Chromium, Android Chromium 360/412 e iPhone WebKit 320/390 emulados). Capturas reais a 320/375/1440 antes/depois para acompanhamento/equipa e conteúdo da dashboard; quatro referências profissionais protegidas. As alterações no acompanhamento/equipa são intencionais; regiões da dashboard e referências profissionais devem manter identidade. Não substituir baselines silenciosamente.

Revisão independente da HEAD/base exatas antes de integrar. Reconfirmar PR40–44 e heads; não integrar PR40–42 implicitamente. Publicação manual apenas no serviço aura-business-staging após gates positivos, seguida de validação de commit/bundle e testes online. Imagens e logs no pacote local de revisão, sem upload de capturas para GitHub. A disponibilidade do utilizador para testes não bloqueia este incremento fictício; aceitação comercial e aparelhos físicos continuam por validar.
