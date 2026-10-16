# Painel diário do profissional

A lista de prioridades complementa os indicadores existentes: marcações agendadas do dia em Lisboa, revisões ativas até hoje, objetivos ativos com prazo até hoje e alunos sem avaliação atual ou com última avaliação há mais de 30 dias. Exclui alunos arquivados, avaliações futuras e versões substituídas. O prazo é um indicador operacional, sem conclusão ou interpretação clínica automática.

`aura_daily_priorities` usa SECURITY INVOKER, RLS e verificação de competência por módulo. Exige perfil acessível para mostrar o nome. Não concede acesso sensível implícito a gestores, nem aceita organização de claims editáveis. Os totais e páginas são calculados no servidor sobre todos os resultados autorizados: 25 por página, ordenação por data/hora/tipo/ID. Pesquisa literal no nome, máximo 100 caracteres; `%` e `_` não são wildcards. Não retorna medições, email, notas ou o foco geral do acompanhamento.

Filtros, pesquisa e atualização explícita têm estados de carregamento/erro/vazio. Trocar estabelecimento remonta a lista e invalida pedidos anteriores. Atalhos abrem a secção autorizada da ficha existente; o parâmetro URL não concede permissões e só é aplicado após a verificação de acessos.

Migration aditiva criada pela CLI: `20261016195103_daily_priorities.sql`. Acrescenta apenas RPC de leitura e índice parcial de objetivos ativos com prazo. Nenhum ficheiro SQL histórico foi modificado. Upgrade local 11→12 validado com dump privado e comparação de todas as linhas anteriores em public/app_private e do registry. O script recusa cloud, Docker remoto, bindings não loopback, Auth não sintético e registry/bundle inesperados. O instalador antigo de objetivos passou também a recusar bundles com migrations posteriores ao seu alvo.

Validação deste bloco: 59 testes de domínio/PostgreSQL/guards, TypeScript/build e 46 cenários Chromium aprovados, incluindo pesquisa/paginação, ligações de secção, isolamento de respostas atrasadas, falha/recuperação e mobile. O CSS final usa o token Dark Premium e flex-end para evitar o aviso de compatibilidade encontrado no primeiro build. A validação final/CI reconstrói essa versão.

Branch `feat/aura-daily-workspace`, dependente de `feat/aura-student-objectives` (#11). Não publicado em produção; gate cloud de Auth/recuperação continua independente.
