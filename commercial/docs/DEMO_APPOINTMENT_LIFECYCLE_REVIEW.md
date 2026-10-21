# Agenda fictícia — reagendamento e cancelamento

Base: `2d9a005c38b06a47f0f591be4b7fc979362e3d35`, PR #47 integrado no staging. Branch isolada `feat/aura-demo-appointment-lifecycle`.

O reagendamento preserva identificador, aluno e tipo. Permite alterar data, hora e duração usando a validação existente, excluindo apenas a própria marcação da procura de sobreposições. O estado mais recente é validado num atualizador funcional. Erros não alteram registos; exemplos cancelados ou inexistentes não podem ser reagendados/cancelados novamente.

Cancelar exige confirmação explícita com aluno/data/horário identificados. O foco inicial fica em Manter marcação; Escape e Manter devolvem o foco à ação original, ou ao título da consulta se o filtro/data tiver removido esse botão. A confirmação conserva o registo com estado cancelado, liberta o horário, exclui-o da dashboard e foca o título da consulta. Agenda filtra ativas/canceladas/todas; a ficha preserva os exemplos cancelados com estado visível. Não se alega auditoria profissional ou histórico completo de reagendamentos.

O formulário conserva o rascunho de criação enquanto se reagendam exemplos, inclusive ao mudar de marcação ou área. Aluno e tipo ficam desativados durante reagendamento. Guardar mantém o foco no botão e mostra confirmação; criação e reagendamento expõem a data resultante e repõem o filtro de estado ativo. Cancelar a própria marcação em edição regressa ao rascunho de criação. Não há pedidos de dados, storage, notificações ou persistência; recarregar repõe os exemplos.

Os três novos testes de domínio verificam identidade, exclusão própria, imutabilidade, conflitos no estado atualizado, entradas inválidas, cancelamento repetido, bloqueio de alteração de cancelados e reutilização de horários sem reutilizar IDs. Seis percursos de browser a320/375/1440 px verificam coerência entre agenda/ficha/dashboard, confirmação/foco/Escape, rascunhos, nomes longos, filtros, recarregamento e ausência de rede externa. Três testes condicionais capturam consulta, edição, confirmação e histórico.

A fixture profissional recebe agora uma data de referência opcional, usada pelas capturas para alinhar Node/browser em2026-10-20. O comportamento normal dos outros testes conserva a data atual. A primeira entrega diagnosticou esta diferença entre dias e usou um spec temporário; esta entrega torna a reprodução explícita, sem alterar a aplicação profissional.

Sem alterações em Auth/RLS, migrations, dependências, dashboard profissional, produção, main ou NutriTrack pessoal. Dados apenas fictícios. CI completo, revisão por agente independente e capturas locais devem identificar o candidato exato antes de integrar/publicar apenas no staging autorizado. WebKit Linux não equivale a Safari/iOS real; Firefox, leitores de ecrã e zoom nativo não recebem cobertura específica nesta entrega.
