# Auth real local — estabilização de novembro

## Destino e âmbito

Incremento sobre o PR #78 (`5f662bdd659b85e045ad80001406959407b1f3e3`), sem merge nem publicação. O Docker Desktop do Windows está parado, mas o motor 29.8.2 da distribuição WSL dedicada **AURA-Dev** funciona. A ausência do pipe do Docker Desktop não demonstra ausência do runtime: consultar primeiro `LOCAL_VALIDATION.md`.

Em 04/11, a distribuição estava parada. Ao abrir uma sessão WSL, os contentores existentes retomaram com as políticas de restart que já tinham. Verificação: instância `aura-foundations-local`, API 127.0.0.1:57321, Mailpit 57324, PostgreSQL 57322; 17 entradas no registry. As portas publicadas das quatro instâncias sintéticas existentes são exclusivamente loopback. Não se reinstalou Docker, criou/recriou um container, fez reset, apagou dados ou aplicou migrations. Uma sessão WSL aberta mantém o runtime disponível.

## Execução assistida reproduzível

Usar Node 22 e dependências de `commercial/` já instaladas. O novo comando **não** inicia WSL/Docker/Supabase e não lê `.env`, credenciais cloud ou contas históricas do produto. Usa exclusivamente o status privado e a aprovação já existentes em `.aura-integration/local-runtime/baseline/`.

Em PowerShell, dentro de `commercial/`:

```powershell
$env:AURA_LOCAL_AUTH_CONFIRM='aura-foundations-local'
npm run test:auth:local -- --check
# Só depois do preflight: cria identidades/organizações/avaliações fictícias novas.
npm run test:auth:local -- --api
# Copiar o caminho do relatório ignorado impresso no PASS anterior; não o conteúdo.
$env:AURA_LOCAL_AUTH_REPORT='CAMINHO_ABSOLUTO_DO_RELATORIO_IGNORADO/evidence.json'
npm run test:auth:local -- --browser
```

`--check` faz leituras: destino exato, manifesto local, digest da evidência de restauro, serviços disponíveis e todas as identidades com app_metadata.synthetic=true e email @example.invalid. Uma identidade não sintética, URL remota, porta alternativa, flag live ou confirmação cloud recusa a execução. Não existe fallback para staging quando o sandbox falha. Não escrever nem enviar chaves pelo chat.

`--api` reutiliza os dois runners revistos, preservando relatórios anteriores: `auth-local-security.cjs --repeat` e `audit-security-integration.ts --browser-credentials`. Retém as fixtures novas e os registos de auditoria; não limpa nem altera as fixtures antigas. Os outputs inesperados dos subprocessos são capturados, sem impressão de payloads ou credenciais.

`--browser` exige um relatório API PASS deste orquestrador e o respetivo ficheiro privado dentro do diretório ignorado, sem symlinks para fora. Faz um build explícito contra o API local e recolhe **apenas** `auth-security-local.spec.cjs` através de `playwright.auth-local.config.cjs`. Mesmo com Auth ligado, não recolhe o harness histórico protegido `auth.spec.cjs` nem os testes cloud. Browser e API ficam sujeitos ao allowlist loopback do teste existente. Trace, screenshot e vídeo desligados; não usar capturas de sessões autenticadas para a revisão pública.

Depois de `--browser`, `.next` contém um artefacto local. Antes de regressar à suite por fixtures, recompilar com `NEXT_PUBLIC_SUPABASE_URL=https://aura-test.supabase.co` e a chave fictícia, sem `AURA_E2E_AUTH`. Não publicar nem reutilizar esse build num serviço remoto.

## Resultados e interpretação

Os runners API passaram de novo em 04/11:

- **6 grupos Auth reais:** contas de teste confirmadas; metadata editável sem autoridade; schema privado não exposto; inscrição/desafio TOTP e AAL2; rotação de refresh e logout global; recuperação de palavra-passe confinada ao Mailpit, redirect não autorizado recusado e apenas password nova aceite.
- **8 grupos Auth/PostgREST reais:** owner/admin sem acesso implícito a medições; papéis sem atribuição e tenant estrangeiro; projeção mínima de privacidade; concorrência de revisões com HTTP409; remoção de membro com JWT inalterado; três lotes de medições com repetição/retoma, revogação e conflito; step-up MFA; AAL1 sem leituras/comandos sensíveis; logout AAL2 negado pelo banco.
- TTL observado **900 segundos** neste ambiente. Um JWT previamente emitido pode continuar a receber HTTP200 num endpoint permitido enquanto não expira; não interpretar esse status como prova de revogação criptográfica. A proteção de recursos é verificada separadamente por dados vazios/negação de RPC e pelo estado vivo da sessão/política no banco.
- Quatro novos testes de guard cobrem alvo local explícito, manifesto cloud/sintético inválido, URLs/portas/credenciais na URL, flags contraditórias e ausência de chaves locais. Não ligam a serviços.

O resultado final do percurso Chromium real e do CI, o SHA e os caminhos privados de evidência ficam identificados no PR. Evidência completa, passwords, fatores, chaves e tokens permanecem ignorados. Não incluir `browser.private.json`, Mailpit, status, dumps ou relatórios com identificadores de contas num PR público.

## Gates que este ensaio não fecha

Não valida o frontend de recuperação de password: o ensaio usa a API Auth e a caixa local. Não ensaia entrega de email cloud, recuperação de conta com perda total de fatores, substituição administrativa de MFA, restauro operacional cloud, catálogos/persistência nutricional remota, disponibilidade/carga, tecnologias de apoio ou browsers adicionais. A configuração cloud de TTL/rotação/allowlist não foi alterada nem inferida da configuração local.

Proteção contra passwords comprometidas, política de sessões/JWT, recuperação cloud, recuperação conta/MFA e RGPD continuam bloqueios altos. Próximo incremento técnico: desenhar e testar a recuperação de password na interface com callback permitido, token expirado/repetido e tratamento sem enumeração. Ativação de callbacks/configurações cloud, decisões de suporte/prova de identidade, RPO/RTO e requisitos jurídicos têm aprovação própria. Nunca retirar MFA para fazer um teste passar.
