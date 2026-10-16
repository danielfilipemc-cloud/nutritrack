# Revisão técnica e recuperação — 16/10/2026

## Resultados efetivos

O helper completo de recuperação passou num terceiro Supabase local novo/vazio. Comparou fingerprints de registry, dados, funções, policies, RLS e grants depois da normalização ACL dentro da transação. Login real, identidade, isolamento e avaliação recuperada passaram para os dois utilizadores fictícios. A repetição de restore no destino ocupado foi recusada, conservando o digest do relatório original. Ver [LOCAL_VALIDATION.md](LOCAL_VALIDATION.md).

O novo teste de catálogo instala todas as dez migrations e verifica RPCs AURA invoker, ausência de EXECUTE anónimo, search_path vazio nas funções definer privadas, implementações históricas inacessíveis a authenticated e RLS em todas as tabelas da aplicação. Suite das fundações: 42/42, TypeScript e build PASS. CI `cd96798`: [run 38946572610 aprovado](https://github.com/danielfilipemc-cloud/nutritrack/actions/runs/38946572610).

## Erro corrigido na evolução

A API local tem `max_rows=1000`, mas a ficha pedia até 2001 numa chamada e podia marcar 1000 como fim do histórico. O carregador agora lê páginas de até 201 e só publica a janela depois de todas as páginas necessárias passarem. Mantém filtros de organização/aluno, ordem estável, limite visual de 2000 e indicação de dados incompletos. Cancela consultas ultrapassadas e não entrega uma janela parcial como completa após falha. Não oferece snapshot transacional entre páginas; alterações concorrentes podem exigir atualização manual.

`npm run test:evolution:local` passou cinco grupos reais, com manifesto de restauro aprovado e URL exclusivamente do principal local: 1205 medições sintéticas, owner sem acesso clínico implícito, limite real de 1000, recuperação completa com o mesmo helper da UI, tenant competente estrangeiro isolado e revogação com JWT inalterado. As fixtures ficam em organizações novas e são conservadas; não existe cleanup destrutivo. Não usar este runner em produção ou no controlo restaurado. A configuração de uma futura API deve conservar capacidade de pelo menos 201 linhas por pedido.

## Sessão na interface

`SessionActions` centraliza logout global em todas as páginas profissionais, removendo a implementação exclusiva do dashboard. Usa o cliente Auth partilhado; não duplica tokens nem restaura sessões para repetir logout. Sucesso regressa ao login; erros são visíveis. O SDK instalado pode limpar a sessão local mesmo se a revogação global falhar: nesse caso o login mostra que as restantes sessões não foram confirmadas e permite autenticar novamente para repetir a operação. O indicador na URL é apenas uma mensagem transitória, nunca autorização, e é removido do histórico.

O primeiro ensaio E2E identificou este comportamento do SDK; a UI e o teste foram corrigidos. Os dois cenários finais passaram: logout global da ficha e erro global → sessão local removida → nova autenticação → repetição. Não há alegação de invalidação imediata dos JWTs emitidos: o limite observado continua 900s no sandbox. A revogação de competências/atribuições é consultada no banco e foi novamente comprovada com o token original.

## Validação conjunta

48/48 testes de domínio/PostgreSQL/guards, TypeScript e build PASS. 35/35 Chromium numa execução completa final, incluindo 1205 medições, logout, permissões, preview e mobile. Auditoria npm: zero vulnerabilidades reportadas; nenhuma dependência nova. Testes de browser usam fixtures; os cinco grupos de volume e a recuperação acima usam Supabase/Auth/PostgREST reais, exclusivamente locais.

## Gates que não foram fechados por esta revisão

Esta é uma revisão técnica do próprio desenvolvimento, não uma auditoria externa independente. Produção, Auth cloud, as dez migrations, NutriTrack pessoal e `main` não foram alterados. Não se criaram recursos pagos nem se publicou frontend.

Antes de dados reais/publicação: staging cloud independente e recuperação operacional (incluindo Storage/configuração), configuração de SMTP/redirects/antiabuso, decisão e aplicação de MFA/AAL2 nos fluxos sensíveis, política de sessões, responsáveis e RPO/RTO, bases jurídicas/DPIA/retencão/direitos e revisão independente. As provas locais não substituem estes gates. A Fase 2 continua a evoluir com dados fictícios na ficha existente; integração NutriTrack requer contratos explícitos de tenant/aluno, origem, unidades e competências, sem importar storage/sincronização pessoal.
