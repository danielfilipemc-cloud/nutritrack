# Supabase local — preparação de 14/10/2026

O utilizador escolheu Supabase local com Docker, sem recursos cloud pagos. Esta opção permite ensaiar PostgreSQL/Auth/PostgREST reais localmente; não demonstra, por si só, recuperação ou configuração de um futuro staging cloud.

## Estado efetivo

- Docker Desktop 4.95.0.242831 instalado por utilizador; Docker CLI 29.8.2 disponível. Instalador oficial, SHA-256 `73431db38491f770543880366228a23c993f84d1e8e045f56d83b8a98940cf76`, assinatura Authenticode Valid / Docker Inc.
- WSL não instalado. Tentativa Microsoft.WSL 2.7.13 por winget recusada pelo Windows com `0x80073d28` (administrador necessário). Não foi rejeição da revisão automática.
- A sessão de execução não tem token administrativo. A elevação normal via UAC terminou com “operação cancelada”; nenhum transcript do script administrativo foi criado. Não se ativou VirtualMachinePlatform e não houve reinício.
- Motor Docker ainda indisponível (`docker_engine` named pipe inexistente). Não há containers Supabase, app migrations aplicadas ou testes reais executados nesta preparação.
- Configuração de dois destinos preparada: `aura-foundations-local`, API/DB 57321/57322; `aura-foundations-restore`, API/DB 58321/58322. Os runtimes só devem arrancar em redes Docker distintas com publicação em 127.0.0.1.

## Código preparado

`supabase/local-validation/config.toml`: template local CLI 2.120.0 / PG17, API expõe apenas public; email confirmado, MFA TOTP habilitado para ensaio, TTL JWT 900s, refresh rotation, passwords mínimas de 12 caracteres; emails no Mailpit local. Não é política de produção nem alegação de MFA imposto pela aplicação.

`scripts/start-local-validation.ps1 -Instance baseline|restore`: exige Node22.23.3 e Docker Linux local via named pipe; rejeita DOCKER_HOST remoto e redes preexistentes incompatíveis; cria rede dedicada com bind loopback; recusa sobrescrever config divergente; inicia apenas o runtime local sem instalar as migrations AURA. Config/logs com possíveis chaves locais ficam em `.aura-integration/local-runtime`, ignorado pelo Git. Não existe delete/reset/cleanup/link/push/deploy no script. O startup completo ainda não foi validado.

`staging-safety.ts`: mantém os bloqueios cloud e permite modo `kind: local` apenas para os dois nomes e portas exatos, sempre com manifesto sintético e evidência de restauro. Não aceita localhost resolvido por DNS, 0.0.0.0, endereço LAN, outra porta ou produção em modo local. Nenhum manifesto de restauro aprovado foi criado antecipadamente.

Verificações novas executadas: TypeScript PASS; 5/5 testes dos guards PASS; parser PowerShell PASS; ensaio de arranque recusado antes de criar a rede por ausência de engine. Os 40 testes/25 Chromium anteriores não foram repetidos manualmente. Não se voltou a auditar o produto nem se reimplementaram as fundações.

## Passo externo necessário

Executar a instalação WSL/ativação de VirtualMachinePlatform numa sessão administrativa. Foi entregue um script revisto fora do repositório para este computador, com `Enable-WindowsOptionalFeature ... -NoRestart` e instalação Microsoft.WSL 2.7.13 via winget. Não automatiza reinício. Após instalação, reiniciar manualmente se o Windows exigir, abrir Docker Desktop e aguardar engine Linux saudável.

Esta instalação é um requisito do Windows, não uma decisão menor de implementação AURA. A autorização de instalar já foi dada; falta a execução com o token administrativo do sistema. Não repetir tentativas de elevação sem resolver essa interação.

## Retoma quando o engine estiver disponível

1. Ativar Node22.23.3 e executar o arranque local baseline; verificar bindings Docker e confirmar apenas 127.0.0.1. Não usar a URL/chaves de `.env.local` do projeto publicado.
2. Instalar exclusivamente o baseline de oito ficheiros preservados e criar fixtures Auth sintéticos; registar os dois históricos, schema, grants/policies e dados. Não instalar já 1A/1B automaticamente ao arrancar.
3. Fazer backup lógico incluindo Auth sintético, public/app_private e histórico; SHA-256, configuração e inventário de objetos. Arrancar destino restore separado, novo/vazio, restaurar e provar dados, login real e RLS antes do upgrade. Não apagar destinos existentes para facilitar o ensaio.
4. Só após PASS, registar evidência efetiva de restauro e manifesto local. Aplicar as duas migrations de fundações preservando histórico no destino de validação. Adaptar operações locais de SQL via container/psql sem executar DDL em projetos cloud.
5. Executar o runner já existente `test:foundations:staging` com URL local e credenciais locais explícitas; completar MFA/sessões/password reset/redirects/privados expostos e rever falhas. Logs nunca devem publicar chaves administrativas ou tokens.
6. Apresentar evidências e decidir prontidão do ambiente de desenvolvimento para Fase2. O gate cloud/produção continua distinto e pendente.

Nenhuma funcionalidade da Fase2 foi iniciada. Produção, NutriTrack e as dez migrations versionadas permanecem inalterados.

Referências: [instalação Docker/WSL e privilégios](https://docs.docker.com/desktop/setup/install/windows-install/), [comandos WSL](https://learn.microsoft.com/en-us/windows/wsl/basic-commands), [Supabase local e rede loopback](https://supabase.com/docs/guides/local-development).
