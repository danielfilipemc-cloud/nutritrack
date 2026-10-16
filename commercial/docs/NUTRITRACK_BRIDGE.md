# Ponte NutriTrack — importação efetiva de medições

O primeiro transporte funcional usa o backup JSON já produzido por `exportBackup()` do NutriTrack pessoal (`app: NutriTrack Pro`, versão 2). Apenas esse código foi consultado; o projeto pessoal e a sua base de dados não foram alterados ou ligados. Não existe sincronização automática, acesso partilhado às contas, importação alimentar ou transporte de notas.

Na ficha, abrir **Treino, nutrição e comunicação → Medições NutriTrack**. Um gestor que tenha escrita explícita em avaliações e atribuição ao aluno confirma uma identidade opaca de origem. Não se associa por nome/email e uma identidade já associada não pode ser transferida silenciosamente para outro aluno. Um profissional atribuído com escrita pode importar; leitores apenas consultam. Revogar a ligação impede novas importações, preservando o histórico.

O ficheiro é lido no navegador. O adaptador extrai apenas `weightLog[].date/weight` e `bodyMeasurements[].date/weight/waist`. Junta os registos do mesmo dia sem duplicar o peso; valores diferentes para o mesmo campo/dia exigem revisão do ficheiro. Rejeita datas inválidas/futuras, números fora dos limites/precisão e JSON inesperado. Perfil, alimentação, alimentos, água e outras medidas não são enviados à API. A altura atual do perfil não é atribuída artificialmente a medições históricas.

Limites: ficheiro até 2 MB, até 2000 dias suportados e 50 dias por transação. Num histórico maior, os 50 dias mais recentes ficam selecionados e identificados; o profissional pode escolher outros períodos e confirmar cada lote. A pré-visualização distingue novo, já importado, atualização de origem e correção local bloqueada. Exige confirmação de pertença ao aluno e uso apenas de dados fictícios nesta demonstração.

## Integridade e permissões

Migration aditiva `20261016221754_nutritrack_measurement_bridge.sql`, SHA256 LF `02c2738a6680d2bd288dec3ed80ad6d53353c78e743fab7af722614dce4a298b`. Há agora catorze migrations no sandbox local e no staging dedicado `vgbwmamntjmhzrpvhxzb`. Produção continua fora deste incremento.

- `nutritrack_links` usa vínculo composto organização/aluno e RLS; não permite escritas diretas do navegador. Criar/reativar/revogar exige gestão e escrita em avaliações, sem grant sensível implícito ao gestor.
- `app_private.nutritrack_records` guarda chave estável, revisão da origem, conteúdo mínimo e referência à avaliação; acesso direto negado. No backup v2, que não contém ID persistente por medição, a chave é `day:AAAA-MM-DD`, sempre subordinada ao vínculo explícito.
- Importação valida novamente o lote no servidor e bloqueia organização/aluno antes de escrever. Lotes são atómicos. Pedidos iguais, incluindo concorrentes ou repetidos após resposta perdida, não criam outra avaliação.
- Mudanças da origem exigem a revisão mostrada na pré-visualização. Criam uma correção auditável, preservam o original e não publicam automaticamente ao aluno. Uma correção local posterior bloqueia sobreposição pela origem; não há resolução automática desses conflitos.
- As avaliações recebem origem, vínculo, ID e revisão. Correções locais mantêm a proveniência. O gráfico usa apenas versões atuais e a cronologia identifica NutriTrack/AURA. A origem fornecida pelo cliente nunca concede autorização.
- Rascunho/ficheiro, erros e resultado de gravação incerto são tratados na ficha. Trocar secção ou estabelecimento pede confirmação quando há ficheiro preparado. O ficheiro não é guardado em localStorage nem enviado integralmente.

## Validação e estado

Testes de domínio/PostgreSQL, Chromium, Auth/PostgREST local e cloud, e restauro estão resumidos em `validation/nutritrack-staging-20261016.log`. O runner `npm run test:nutritrack:staging` exige variáveis explícitas e destino local validado; `--cloud` exige confirmação do ID exato do staging e recusa Auth não sintético. Nunca faz limpeza ou reset.

Na atualização local 13→14 foi guardado dump privado e comparados os campos anteriores. Os quatro campos novos de proveniência foram excluídos dessa comparação; as avaliações existentes receberam o default AURA. Na cloud, contagens/impressões digitais das 23 tabelas anteriores e Auth mantiveram-se iguais, excluindo apenas campos adicionados e entradas novas do registry. Isto prova preservação, não substitui um backup.

A exportação inicial foi recusada pela revisão automática por risco de dados sensíveis. Após autorização específica do utilizador, foi feita cópia privada somente dos IDs das contas/organizações fictícias identificados nos relatórios dos testes. Não houve exportação da produção. Ver `STAGING_RECOVERY_20261016.md` para alcance e limites do restauro.

Próximos incrementos: transporte automático autenticado com consentimento/vínculo próprio, tarefas de sincronização e contrato nutricional separado. Não anunciar esses módulos como concluídos com base nesta importação de medições.
