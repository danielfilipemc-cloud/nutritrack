# PR53 — Equipa e marca na demonstração Premium

Base: PR52 publicado, `integration/aura-staging`, commit `1d3f09dbd328801831bf2fed22d91dd54f075a2d`. Branch isolada: `feat/aura-demo-team-brand`. Destino exclusivo: staging.

## Comportamento entregue

- Equipa de dois profissionais fictícios, com papéis de organização, filtros, pausa e reativação. Estes papéis não criam contas nem alteram permissões.
- Consulta de alunos atribuídos a partir dos valores guardados, incluindo acompanhamentos ativos, em pausa e concluídos. A ficha abre no acompanhamento e permite voltar à equipa com o filtro preservado.
- Pausar bloqueia novas atribuições, incluindo uma seleção ainda em rascunho. Mantém atribuições já guardadas e permite atualizar o respetivo acompanhamento. Reativar permite concluir o rascunho sem o reintroduzir.
- Marca com nome, três paletas e cor livre. Botões principais e avatares escolhem texto preto ou branco conforme o contraste calculado; o nome vazio usa uma alternativa consistente.
- Pré-visualização e reposição confirmada apenas do nome e da cor, mantendo equipa, alunos, avaliações, agenda e rascunhos. Cancelar com Escape ou confirmar devolve foco ao controlo inicial.
- Ao remover um profissional de um filtro pela pausa/reativação, o foco regressa ao seletor desse filtro. No filtro Todos, mantém-se no botão acionado.
- Auditoria do caso agenda vazia, cancelamento das marcações de exemplo e criação de uma marcação futura. Corrigida a concordância de uma única marcação nos indicadores da dashboard.

## Isolamento

Todo o estado novo vive em memória React. Recarregar repõe os exemplos. Nenhum convite, mensagem, conta, pedido à base de dados, armazenamento persistente ou leitura de dados profissionais foi acrescentado. A lista de nomes válidos permanece fechada aos exemplos. Sem mudanças em Auth/RLS, migrations, módulos profissionais, produção, main ou NutriTrack pessoal.

## Validação prevista e critérios de publicação

Testes de domínio para imutabilidade, atribuições, validação de nomes e contraste; CI completo com lint, tipos, build, auditoria de dependências e Chromium; percursos em Chromium desktop/Android e WebKit iPhone em cinco configurações; capturas reais antes/depois, comparação da composição da dashboard e das quatro superfícies profissionais protegidas; canários de armazenamento e rede. Os dispositivos móveis são emulados, não físicos.

Revisão independente do commit exato e resultados positivos são obrigatórios antes de integrar. Confirmar os estados dos PRs #40–#44 e não os integrar implicitamente. A publicação manual deve usar exclusivamente o serviço `aura-business-staging`, seguido de verificação do bundle servido e testes online. Relatório final, capturas e logs ficam no pacote local de revisão; não carregar capturas para o repositório público.

## Limites

Equipa e marca demonstram comportamentos de produto com dados fictícios. Não implementam gestão real de acessos, convites, upload de logótipo ou persistência. A auditoria da demonstração não autoriza um piloto com dados reais. Qualquer piloto exige um âmbito e validação próprios.
