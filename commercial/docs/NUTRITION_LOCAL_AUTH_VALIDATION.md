# Nutrição — GoTrue/PostgREST real em sandbox local

Incremento separado da interface do PR #82. Acrescenta um runner de validação; não ativa persistência remota nem cria contratos próprios do aluno. Não altera os SQL existentes, o instalador ou os runners históricos de cloud.

## Destino e proteção

- Runtime novo **local**, `aura-nutrition-local`, no WSL dedicado `AURA-Dev`; portas API/DB/Mailpit **61321/61322/61324**. Não é o baseline de 17 migrations das portas 573xx.
- Arranque usa o script existente, CLI fixado em 2.120.0, rede Docker ligada a 127.0.0.1, sem Storage/Realtime/Edge Functions e sem aplicar migrations automaticamente. Preserva as configurações e redes dos outros runtimes.
- O runner exige `AURA_NUTRITION_AUTH_CONFIRM=aura-nutrition-local`, o marcador do WSL, o contentor exato com o label de projeto esperado e os endpoints locais exatos. Recusa destino cloud, baseline573xx, URLs arbitrárias, dotenv, aprovação cloud, `DATABASE_URL`, `DOCKER_HOST`, live e Auth de outros runners.
- Chaves geradas pelo runtime são lidas do ficheiro privado fixo, sem pedidos de credenciais ou impressão de valores. HTTP restrito ao origin 61321 e caminhos Auth/Data API, com redirects recusados. Passwords dos testes são inventadas em memória; não há emails externos nem exportação de sessões.
- `--prepare` exige Auth vazio e uma base pública nova, ou uma preparação interrompida com manifesto próprio e fontes idênticas. Regista 17 migrations, verifica a integridade dos 17 registos antes/depois do upgrade para19 e aplica os dois candidatos existentes de água/documentos numa transação local. Não apaga dados e não faz reset.
- `--run` verifica os 19 nomes/checksums instalados contra os ficheiros e o manifesto de preparação. Recusa qualquer identidade preexistente sem metadata sintética deste sandbox e email `@example.invalid`. Cada execução cria um namespace novo, conserva as fixtures anteriores e guarda relatório/manifesto privados em `.aura-integration/local-runtime/nutrition/runs/<uuid>/`.

## Execução

Primeiro arrancar no WSL: `bash scripts/start-local-validation-wsl.sh nutrition --keep-alive`, a partir de `commercial/`. O script verifica o espaço no volume dedicado, versão do Node e Docker local; não cria serviços cloud nem modifica planos.

Preparação, com a confirmação de destino definida: `npm run test:nutrition:auth:local -- --prepare`. Só instala no sandbox local exato. Depois: `npm run test:nutrition:auth:local -- --run`.

Neste computador, as portas Docker em loopback respondem dentro do WSL, mas a nova porta61321 não é encaminhada para o Windows. A tentativa Windows foi recusada com ECONNREFUSED antes de criar identidades. Não se abriram portas externas nem se relaxaram os guards. A execução real fez-se **dentro do WSL**.

Para reutilizar as dependências JavaScript puras do projeto, mantendo o transpiler Linux separado do esbuild Windows, executar a partir de `/var/cache/aura-npm`, com o Node fixado no PATH:

```sh
export PATH=/opt/aura/node-v22.23.3-linux-x64/bin:/usr/local/sbin:/usr/local/bin:/usr/sbin:/usr/bin:/sbin:/bin
export AURA_NUTRITION_AUTH_CONFIRM=aura-nutrition-local
npm exec --cache /var/cache/aura-npm --yes --package=tsx@4.23.15 -- \
  tsx /CAMINHO/DO/REPOSITORIO/commercial/scripts/nutrition-auth-local.ts --run
```

Não executar `npm ci` Linux sobre o `node_modules` Windows partilhado. O cache do transpiler é separado. O runner também funciona em Windows quando o loopback estiver disponível; o acesso Docker continua fixado ao WSL dedicado.

## Matriz real executada

| Grupo | Evidência |
| --- | --- |
| Identidade | Sete atores confirmados via GoTrue, duas empresas, aluno com vínculo vivo e aluno sem atribuição |
| Papéis | Owner/admin/coach não recebem Nutrição implicitamente; grants e atribuições explícitos. Admin não concede competência nutricional |
| Negativos | Anónimo, aluno, não atribuído, profissional externo, organização errada e aluno errado: leitura/escrita nutricional negada |
| Refeições | Dois pedidos simultâneos idênticos: um registo e replay; dois CAS concorrentes: um sucesso e um conflito; anulação conserva versões e recibo original |
| Água | Idempotência, correção com motivo, anulação, hora desconhecida preservada e ausência de declarações diferente de zero |
| Documentos | Receita publicada, rascunho posterior, plano com snapshot da publicação anterior, retirada sem publicar o rascunho e sem declarar consumo |
| Só leitura | Consulta de refeições, água e planos; escrita recusada. Owner/admin autorizados consultam os três recursos |
| Revogação | Remover competência/atribuição passa a negar operações com o mesmo JWT, sem refresh |
| Grants/RLS | Wrappers públicos INVOKER; DEFINER com search_path fixo; sem EXECUTE para anon; RLS pública ativa; sem DML direto; dados de outra empresa e do aluno nos contratos de profissionais não aparecem |
| Schema privado | PostgREST recusa `Accept-Profile: app_private` |
| MFA | Ativação da política pela conta owner com TOTP real; JWT AAL1 anterior recusado para leitura/escrita nutricional |
| Sessão | AAL2 ativo permite consulta; logout global faz o mesmo JWT AAL2 perder acesso sensível no banco |

Os testes continuam a negar Nutrição de profissionais ao aluno, mesmo com vínculo vivo. Isto **não implementa** a futura leitura de publicações ou declaração própria do aluno. A recusa é deliberada; não é um teste positivo do portal do aluno.

Relatórios incluem fontes, hash SHA-256 do runner, tempos e resultados por grupo. Não incluem passwords, tokens, TOTP seeds ou conteúdos nutricionais. O manifesto de fixture inclui apenas UUIDs sintéticos para localizar os dados. Não há limpeza destrutiva ou eliminação de utilizadores no fim.

Execução final em 12/11/2026: **12/12 grupos aprovados**. Evidência sanitizada em [nutrition-local-auth-evidence.json](review/nutrition-local-auth-evidence.json), incluindo o hash do relatório privado e as fontes exatas. O teste de integridade compara essa evidência com o runner e os SQL atuais; modificar estes ficheiros exige repetir a prova local. A suite não transforma os resultados locais numa aprovação cloud.

## Limites

São testes **API reais locais**, separados dos testes Chromium da interface com fixtures. Não são percursos de browser autenticados contra o sandbox nutricional. Não provam GoTrue/PostgREST do staging, recuperação cloud, configurações remotas de sessão ou proteção contra passwords comprometidas. A verificação de catálogo não equivale a um restauro operacional.

Os SQL preparados de água/documentos continuam fora do instalador e não foram executados no staging. O runtime original 573xx mantém o seu baseline de17 migrations. Dados fictícios e infraestrutura local não autorizam dados reais, piloto comercial, publicação ou alterações remotas. Mantêm-se os bloqueios altos de autenticação, recuperação completa de conta/MFA, recuperação operacional e RGPD.
