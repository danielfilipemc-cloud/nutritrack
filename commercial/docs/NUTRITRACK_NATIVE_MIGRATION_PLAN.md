# NutriTrack → AURA: plano de transição e critérios de conclusão

Objetivo autorizado: substituir o produto separado por nutrição nativa no AURA, com a mesma conta, aluno, ficha e acompanhamento. O PR65 e o incremento de biblioteca/diário livre fecham percursos **sintéticos**, não migram contas ou dados reais. A migração completa não será declarada apenas pela existência desta demonstração.

## Aproveitamento e diferenças

| Origem pessoal | Destino AURA | Situação / condição de transição |
|---|---|---|
| Pesquisa e seleção alimentar | Biblioteca e editor AURA | Pesquisa local com oito fixtures inventadas; catálogo real precisa de proveniência/versionamento |
| Templates do dia | Receitas e modelos versionados | Receitas por aluno nesta demo; não interpretar um template como consumo |
| Refeições livres | Diário nativo, separado do plano | Declarações por data/hora com snapshots, notas, revisão/ação; correção/anulação alimentar ainda não implementadas |
| Água | Eventos em ml | Adição/anulação com histórico na demo; sem meta automática |
| Peso e medidas | Avaliações/evolução existentes | Reutilizar o histórico AURA, sem criar histórico paralelo ou interpretações automáticas |
| Perfil e identidade | Conta e vínculo do aluno AURA | Não associar por nome ou email, não copiar passwords/sessões; mapear explicitamente identidades com revisão |
| Alimentos próprios e favoritos | Catálogo/versões e preferências isoladas | Mapear sem copiar storage ou catálogo pessoal inteiro para a aplicação pública |
| Fotos e outros campos | Destino seguro ou tratamento explícito | Nada pode desaparecer silenciosamente: inventariar, decidir destino/retenção/exportação antes de retirar a app antiga |
| Totais antigos arredondados | Histórico com origem e contrato de legado | Preservar o valor original; não inventar composição por100g ou precisão inexistente por reescala |
| Cache, Auth e JSONB pessoal | Nenhuma incorporação direta | Usar arquitetura AURA; não embutir o monólito, copiar sessões ou sincronizar o blob inteiro |

Os formatos conhecidos foram auditados no código, sem ler dados pessoais. A compatibilidade de um backup real não foi demonstrada nesta entrega. Um campo não suportado deve aparecer no diagnóstico de migração; rejeitar/quarentenar explicitamente é preferível a eliminar ou converter silenciosamente.

## Sequência técnica restante

1. **Contrato de migração offline:** fixtures de backup v2 com refeições, água, modelos, alimentos próprios, medidas e campos não suportados. Preview por categoria, origem, unidades, duplicados e conflitos. Validar formato/tamanho/profundidade antes de interpretar; nunca inserir HTML ou executar código do ficheiro. Produzir manifesto e contagens reconciliáveis, sem rede ou importação automática.
2. **Ensaio idempotente:** importar o mesmo manifesto duas vezes numa base local efémera e comprovar uma única criação, revisão/recibo por contexto, rollback de falha tardia e conflitos sem overwrite. Testar backups alterados/ordem diferente e registos legitimamente repetidos; não deduplicar apenas por nome/data.
3. **Persistência nativa autenticada:** aproveitar contratos/comandos nutricionais preparados na AURA, com autor derivado, tenant/aluno/competência/assignment e sessão viva. Ensaiar Auth/PostgREST e revogação em ambiente isolado. Os mocks/PGlite não provam Auth real.
4. **Manifesto de destino e recuperação:** confirmar baseline/hash do staging, diferenças de esquema, políticas/competências, backup e restauro provado. Preparar execução, reconciliação e retorno a código anterior sem apagar histórico. Não aplicar migrations remotas nesta fase.
5. **Ensaio integral com contas fictícias:** profissional e aluno na mesma sessão AURA por ator, sem segundo login NutriTrack; publicar plano, registar/corrigir/anular alimentação e água, histórico, receitas, exportação e acesso revogado. Testes desktop/mobile, isolamento, concorrência e revisão independente.
6. **Transição real explicitamente autorizada:** só após rever resultados, finalidade/retenção e acesso, executar o manifesto aprovado para identidades/dados selecionados. Validar contagens, amostras autorizadas, conflitos e recuperação. Não desligar o produto antigo antes da reconciliação e aceitação.

## O que significa «migração completa»

Uma única experiência AURA, funcionalidades e histórico acordados disponíveis na conta correta, dados reconciliados com origem e sem perdas silenciosas, privacidade/exportação/recuperação verificadas e aplicação anterior retirada por decisão explícita. Nenhum dos itens é satisfeito por somar testes fictícios ou reativar um projeto Supabase.

## Limites atuais

Mantêm-se: apenas dados fictícios, produção/main e NutriTrack pessoal isolados, sem migrations ou alterações Auth/RLS remotas. A autorização para atingir a migração completa define o objetivo; os ensaios e a preparação avançam dentro destes limites. A transferência real e a retirada da app são passos concretos posteriores, não efeitos desta publicação em staging.
