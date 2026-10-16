# Evolução integrada na ficha existente

`Evolução` mantém o gráfico de peso/altura/cintura e acrescenta a cronologia no mesmo período; alterar qualquer seletor de período atualiza ambos. `Cronologia` permite consultar o histórico sem exigir acesso a medições, projetando apenas módulos autorizados. Não há aplicação ou identidade paralela.

Inclui avaliações atuais por data da medição, alterações de acompanhamento por data do evento, eventos mínimos dos objetivos e marcações pela data da sessão e estado atual. Datas/horas usam Lisboa. Versões de avaliação substituídas não contam duas vezes; datas futuras ficam fora do período. Uma marcação agendada não equivale a presença ou sessão realizada. A cronologia preserva consulta autorizada de alunos arquivados e não é um diário clínico.

`aura_client_timeline` é um wrapper público SECURITY INVOKER para uma projeção privada com SECURITY DEFINER e search_path vazio. A função privada exige perfil profissional autorizado e verifica individualmente assessments/followup/schedule em todas as fontes. Estudantes, utilizadores de outra organização e anónimos não acedem a esta projeção profissional. As tabelas privadas mantêm acesso direto negado.

Não retorna emails, notas, motivos de correção, autores ou textos históricos de objetivos/foco geral. Cada medição inclui origem AURA, ID e unidades explícitas. O contrato futuro NutriTrack é separado, descrito em NUTRITRACK_INTEGRATION_CONTRACT.md; não existe sincronização/importação neste incremento.

Paginação por cursor composto de instante e chave de evento, com ordenação determinística e páginas de 25. Não depende de offsets que deslocam páginas com inserções. A interface elimina duplicados por chave, mostra quantos registos foram carregados e se há mais; limita a 500 registos antes de pedir um período menor. Não é um snapshot transacional: alterações/correções podem modificar resultados durante uma consulta e a atualização explícita reinicia a leitura. Totais são os visíveis no momento de cada pedido.

Falha numa página adicional conserva a parte anteriormente carregada e identifica a lista como incompleta. Permissões são novamente consultadas em cada página; erro de autenticação/autorização, falha de confirmação ou mudança das competências de leitura limpa os registos carregados e exige atualização. Troca de aluno/organização invalida respostas pendentes.

Migration aditiva: `20261016195602_integrated_timeline.sql`, criada pela CLI. O sandbox local passou de 12 para 13 migrations com dump e igualdade de todas as linhas existentes e registos anteriores. Não foram executadas estas duas migrations novas no staging cloud ou em produção. O staging cloud continua no checkpoint de onze migrations documentado em STAGING_20261016.md.

Validação final está em validation/daily-evolution-local-20261016.log. A matriz real de objetivos ganhou testes das duas projeções, paginação e revogação. O E2E com login local real percorre objetivos → evolução/cronologia → painel. Dados e contas são fictícios e permanecem apenas no sandbox local.

Revisão ordenada: #9 fundações → #10 Aluno 360º → #11 objetivos → #12 painel → PR de evolução integrada. Gates Auth e recuperação cloud permanecem abertos; não integrar ou publicar como se estivessem concluídos. Próximos incrementos: ligação explícita de identidades NutriTrack, importação idempotente em staging e autorização própria para nutrição; operação/MFA/privacidade continuam pendentes antes de dados reais.
