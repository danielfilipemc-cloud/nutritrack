# Nutrição nativa — interface profissional integrada

Continuação isolada do PR #81, sobre `103c9265d43d8810f4352658373942719b2c0557`. Não altera SQL, migrations, Auth/RLS, dependências, staging ou produção. Não migra dados do NutriTrack pessoal.

## Âmbito efetivo

| Área | Comportamento implementado | Limite |
| --- | --- | --- |
| Refeições | Criar, corrigir e anular; composição manual por 100 g; diário paginado; histórico paginado até à versão original | A listagem por dia não é um snapshot de exportação perante edições concorrentes |
| Água | Declarar ml e hora opcional; corrigir/anular com motivo; consultar recibo e todas as páginas do histórico | Sem meta ou recomendação; resumo identifica a consulta inicial, não agrega páginas recolhidas em momentos diferentes |
| Receitas | Ingredientes manuais com zero/desconhecido distintos; rascunho, publicação, retirada e histórico | Receitas por aluno, sem catálogo ou biblioteca partilhada inventada |
| Planos | Refeições e alternativas manuais, referências a versões publicadas de receitas e composição congelada fornecida pelo servidor | Não prescreve automaticamente; preparar/publicar não declara consumo |
| Conteúdo | Consultar composição de documentos atuais e da publicação anterior ainda disponível | Novas versões não substituem automaticamente referências históricas no editor |
| Rascunhos | Mantidos em memória entre as três áreas e entre receitas/planos; navegação externa protegida pelo guard existente da ficha | Recarregar/fechar pode perder rascunhos após confirmação do browser; não há armazenamento de dados pessoais no browser |
| Pedidos incertos | Request ID visível, consulta de recibo, sem repetição automática; saída mediante confirmação explícita | Sair não cancela o pedido no servidor. Um recibo ausente não prova rollback; guardar a referência e reler antes de novo registo |

O painel usa exclusivamente o cliente Supabase da aplicação e os adaptadores já existentes. As áreas de água e documentos só são montadas na primeira abertura; depois mantêm o estado no mesmo contexto. Mudar de identidade, organização ou aluno desmonta o painel através da chave da ficha. Respostas de instâncias descartadas não são aplicadas.

O guard global de rascunhos pertence à ficha. Foi removido o segundo guard do diário, evitando confirmações concorrentes no mesmo evento de navegação. O painel agrega todos os rascunhos e pendências, inclusive os de áreas temporariamente ocultas.

## Segurança e ativação

Continua **desligado por omissão**, através da flag de build `NEXT_PUBLIC_AURA_NATIVE_NUTRITION=1`. A flag não concede permissões. Não há ativação por URL/localStorage, escrita direta em tabelas, service role no browser ou fallback para exemplos quando um RPC falha.

Cada área lê a competência do ator na organização exata e só expõe escrita depois da leitura autorizada. Alunos arquivados ficam sem escrita. Revogação, vínculo, atribuição, CAS e política de sessão continuam impostos pelas funções existentes do banco; UI e fixtures não provam essa autorização por si.

O SQL preparado de água e documentos permanece fora do instalador. A interface não o instala. Ligar este build num banco sem os contratos gera indisponibilidade explícita. Este incremento não autoriza instalar ou ativar nada remotamente.

## Validação reproduzível

- `npm run lint`, `npm run typecheck`, `npm audit --audit-level=moderate`.
- `npm test`: domínio e PostgreSQL/PGlite com fixtures sintéticas. Em Windows sem GPG, executar os testes TypeScript exceto o wrapper `staging-backup.test.ts` e executar `python3 tests/staging_backup_test.py` no WSL com GPG; reportar os resultados separadamente. O CI Linux executa o comando completo.
- `npm run test:e2e`: build nativo fictício, suite nativa sem retries, reposição do build normal fictício e regressão Chromium anterior. Não é um runner Auth real e recusa flags live/Auth.
- Foco: `NEXT_PUBLIC_AURA_NATIVE_NUTRITION=1` no build e execução de `playwright.nutrition.config.cjs` com os endpoints fictícios habituais.
- Capturas sintéticas locais: `.aura-integration/native-water-desktop.png`, `native-recipe-desktop.png`, `native-recipe-375.png`, `native-recipe-320.png`, `native-plan-320.png`. Não contêm sessões ou credenciais reais e ficam fora do Git.

Os testes adicionais verificam criação/correção/anulação de água, história imutável, publicação/retirada independente de rascunhos pendentes, referência congelada de receita, ausência de consumo implícito, rascunhos entre áreas, pedido sem recibo, conflito sem perda de rascunho, revogação durante gravação, resposta tardia de permissão após mudança de organização, arquivo, teclado e largura 320/375 px.

Não declarar aprovados GoTrue/PostgREST nutricionais reais, leitor de ecrã, zoom nativo, Safari ou Firefox a partir destes testes. O sandbox local de Auth anterior mantém as suas 17 migrations e não foi atualizado para simular essa prova.

## O que falta para integração total

1. Gestão nutricional de competências na equipa, sem concessões implícitas; contratos próprios do aluno, vínculo vivo e regras de partilha/publicação. Não reutilizar os RPCs de profissional com um parâmetro `role`.
2. Sandbox independente GoTrue/PostgREST com os contratos nutricionais e ensaios reais de MFA, JWT, revogação, concorrência e recuperação. Preservar o baseline local de 17 migrations.
3. Catálogo de alimentos com origem, direitos de utilização e versões; receitas existentes manuais não constituem esse catálogo. Decisão do responsável sobre a fonte/licença antes de importar dados externos.
4. Leitura/exportação integral e verificável de todos os recursos, retenção e recuperação. Não apresentar paginação de heads mutáveis como exportação completa ou backup operacional.
5. Revisão independente do pacote de ativação e autorização específica para staging. Nenhuma cópia de bases pessoais, passwords ou sessões do NutriTrack.

Os bloqueios altos de passwords comprometidas, sessões/JWT, recuperação operacional cloud, recuperação completa de conta/MFA e RGPD continuam abertos. Competência técnica na aplicação não certifica habilitação profissional para prescrição. Não há autorização para dados reais ou piloto comercial.
