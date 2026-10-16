# Supabase local — validação de 14/10/2026

Revalidação em 16/10/2026: 16 grupos de fundações e seis Auth novamente PASS; login e isolamento do controlo restaurado também PASS. Ver [estado de integração](INTEGRATION_STATUS.md). Para repetir Auth sem substituir a evidência original: `npm run test:auth:local-security -- --repeat`, com o manifesto local explícito e runtime disponível. As credenciais continuam exclusivamente no diretório ignorado.

## Resultado posterior à preparação

A preparação histórica abaixo foi ultrapassada: Docker Engine 29.8.2 funciona na distribuição WSL exclusiva `AURA-Dev`, com armazenamento em E: e socket Unix, sem exposição TCP do motor. O erro do Docker Desktop continua sem correção; não se alteraram EFS/ACLs nem se executou factory reset. A tentativa inicial esgotou o espaço em C:, pelo que a distribuição foi parada, copiada com verificação SHA-256 e movida pelo comando oficial WSL. O sistema de ficheiros recuperou escrita; os dados de teste só foram criados depois.

Dois Supabase isolados publicam apenas em loopback: principal 57321 e restauro 58321. O principal passou de 8 para 10 migrations canónicas, em transações separadas; os oito registos anteriores conservaram checksum e data. O controlo restaurado permanece no baseline de oito migrations. Nenhuma migration cloud foi aplicada e produção permanece inalterada.

O restauro real recuperou dois utilizadores Auth, duas organizações, dois alunos e uma avaliação fictícia. Login e isolamento entre organizações passaram. Foi encontrada divergência de ACLs causada pelos privilégios por omissão do destino; corrigiu-se apenas o destino e repetiu-se a comparação de fingerprints de dados, funções, policies, RLS e grants, com igualdade. O helper de recuperação inclui agora essa normalização dentro da transação; a composição nova não foi novamente ensaiada num terceiro destino. O arquivo sintético tem SHA-256 `3b89227e433940b248c7dafec81fdc27d7653d98c67907ad4be8310b9e0d1178` e está em `E:\AURA-Development-20261014\backups\supabase-baseline-20261014`. Não representa uma política de backup de produção ou restauro de Storage.

Passaram 16 grupos reais das fundações (Auth/JWT/PostgREST, RLS, isolamento, competências, atribuições, aluno, correção concorrente e revogação com JWT existente) e seis grupos Auth adicionais (TTL 900s, metadata sem autoridade, schema privado, TOTP/AAL2, refresh/logout e recuperação de password no Mailpit). Evidência sanitizada em `docs/validation/foundations-local-20261014.log`; configurações e credenciais ficam exclusivamente no diretório ignorado `.aura-integration`.

Limite observado: logout revoga refresh, mas um access JWT emitido pode continuar válido até 900 segundos. As revogações de membership, competência, atribuição e aluno foram imediatas com JWT inalterado. MFA foi ensaiado, não imposto globalmente pela aplicação. É necessário decidir a política de sessões/MFA antes de um piloto com dados sensíveis. Continuam pendentes base jurídica, papéis de responsável/subcontratante, retenção, resposta a pedidos, avaliação de impacto e operação de backups; não se presume conformidade RGPD.

Estas evidências permitem desenvolver a Fase 2 com dados fictícios. Não demonstram configuração ou recuperação de staging cloud. O bootstrap WSL aceita `baseline|restore [--keep-alive]`; a sessão aberta mantém a distribuição ativa. Os scripts recusam destinos remotos e não fazem reset, deploy ou limpeza destrutiva.

## Registo histórico da preparação (anterior aos resultados acima)

O utilizador escolheu Supabase local com Docker, sem recursos cloud pagos. Esta opção permite ensaiar PostgreSQL/Auth/PostgREST reais localmente; não demonstra, por si só, recuperação ou configuração de um futuro staging cloud.

## Estado efetivo

- Docker Desktop 4.95.0.242831 instalado por utilizador; Docker CLI 29.8.2 disponível. Instalador oficial, SHA-256 `73431db38491f770543880366228a23c993f84d1e8e045f56d83b8a98940cf76`, assinatura Authenticode Valid / Docker Inc.
- WSL **2.7.13.0 instalado**, kernel 6.18.33.2-2. A primeira instalação tinha sido recusada com `0x80073d28`; após confirmação UAC pelo utilizador, o script administrativo concluiu com êxito. Transcript registou `VirtualMachinePlatform restart required: False`. Não houve reinício automático.
- A sessão Codex continua sem token administrativo; a instalação foi realizada no processo administrativo aprovado pelo utilizador. Não é necessário repetir a instalação WSL.
- Motor Docker ainda indisponível: o backend falha ao gravar/renomear `settings-store.json` em AppData/Roaming/Docker, com “The system cannot move the file to a different disk drive”. Um arranque limpo reproduziu o erro. A causa não foi determinada; não se alteraram ACLs, cifragem ou preferências nem se executou factory reset. Um probe de ficheiro fictício via Move-Item passou, mas não demonstra que o rename atómico usado pelo Docker funcione.
- Não há containers Supabase, app migrations aplicadas ou testes reais executados nesta preparação. O CI do commit 78633f5 passou (run 38630022204); não se repetiram manualmente as suites já aprovadas.
- Configuração de dois destinos preparada: `aura-foundations-local`, API/DB 57321/57322; `aura-foundations-restore`, API/DB 58321/58322. Os runtimes só devem arrancar em redes Docker distintas com publicação em 127.0.0.1.

## Código preparado

`supabase/local-validation/config.toml`: template local CLI 2.120.0 / PG17, API expõe apenas public; email confirmado, MFA TOTP habilitado para ensaio, TTL JWT 900s, refresh rotation, passwords mínimas de 12 caracteres; emails no Mailpit local. Não é política de produção nem alegação de MFA imposto pela aplicação.

`scripts/start-local-validation.ps1 -Instance baseline|restore`: exige Node22.23.3 e Docker Linux local via named pipe; rejeita DOCKER_HOST remoto e redes preexistentes incompatíveis; cria rede dedicada com bind loopback; recusa sobrescrever config divergente; inicia apenas o runtime local sem instalar as migrations AURA. Config/logs com possíveis chaves locais ficam em `.aura-integration/local-runtime`, ignorado pelo Git. Não existe delete/reset/cleanup/link/push/deploy no script. O startup completo ainda não foi validado.

`staging-safety.ts`: mantém os bloqueios cloud e permite modo `kind: local` apenas para os dois nomes e portas exatos, sempre com manifesto sintético e evidência de restauro. Não aceita localhost resolvido por DNS, 0.0.0.0, endereço LAN, outra porta ou produção em modo local. Nenhum manifesto de restauro aprovado foi criado antecipadamente.

Verificações novas executadas: TypeScript PASS; 5/5 testes dos guards PASS; parser PowerShell PASS; ensaio de arranque recusado antes de criar a rede por ausência de engine. Os 40 testes/25 Chromium anteriores não foram repetidos manualmente. Não se voltou a auditar o produto nem se reimplementaram as fundações.

## Passo externo necessário

O passo administrativo WSL foi concluído. Falta abrir Docker Desktop diretamente pelo menu Iniciar do Windows para verificar se o erro de gravação também ocorre nesse contexto. Fechar a janela de erro por Quit, sem factory reset. Se persistir, recolher a mensagem exata e investigar o problema local antes de criar containers; não repetir reinstalações ou alterar segurança do Windows sem evidência de que isso resolve a causa.

## Retoma quando o engine estiver disponível

1. Ativar Node22.23.3 e executar o arranque local baseline; verificar bindings Docker e confirmar apenas 127.0.0.1. Não usar a URL/chaves de `.env.local` do projeto publicado.
2. Instalar exclusivamente o baseline de oito ficheiros preservados e criar fixtures Auth sintéticos; registar os dois históricos, schema, grants/policies e dados. Não instalar já 1A/1B automaticamente ao arrancar.
3. Fazer backup lógico incluindo Auth sintético, public/app_private e histórico; SHA-256, configuração e inventário de objetos. Arrancar destino restore separado, novo/vazio, restaurar e provar dados, login real e RLS antes do upgrade. Não apagar destinos existentes para facilitar o ensaio.
4. Só após PASS, registar evidência efetiva de restauro e manifesto local. Aplicar as duas migrations de fundações preservando histórico no destino de validação. Adaptar operações locais de SQL via container/psql sem executar DDL em projetos cloud.
5. Executar o runner já existente `test:foundations:staging` com URL local e credenciais locais explícitas; completar MFA/sessões/password reset/redirects/privados expostos e rever falhas. Logs nunca devem publicar chaves administrativas ou tokens.
6. Apresentar evidências e decidir prontidão do ambiente de desenvolvimento para Fase2. O gate cloud/produção continua distinto e pendente.

Nenhuma funcionalidade da Fase2 foi iniciada. Produção, NutriTrack e as dez migrations versionadas permanecem inalterados.

Referências: [instalação Docker/WSL e privilégios](https://docs.docker.com/desktop/setup/install/windows-install/), [comandos WSL](https://learn.microsoft.com/en-us/windows/wsl/basic-commands), [Supabase local e rede loopback](https://supabase.com/docs/guides/local-development).
