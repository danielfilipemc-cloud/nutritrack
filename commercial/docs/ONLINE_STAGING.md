# Staging online e consolidação — 16/10/2026

## Destinos e revisões

O utilizador autorizou seguir a recomendação de consolidar os PRs e publicar staging separado com dados fictícios. PRs #9–#14 foram integrados em `saas-foundation`, sequencialmente, com verificação do SHA de cada head. Cada head tinha CI aprovado; o último é o run 38977399937. Os merges não alteraram a árvore final `78dd98b`; a revisão consolidada é `deea349103ddf7462d254efc35b26d9e87c5967f`.

Render staging: https://aura-business-staging.onrender.com, workspace Maryatchi hub já autorizado, serviço `srv-db9al5ajnfac73bivqr0`, Frankfurt, plano free, auto-deploy off. Não foi criado banco adicional. Build: `cd commercial && npm ci --include=dev && npm run check`; start: `cd commercial && npm run start -- --hostname 0.0.0.0 --port $PORT`. Node 22.23.3, telemetria desligada. Apenas URL e chave publicável do Supabase staging entram no frontend; nenhuma chave administrativa foi enviada ao Render.

Supabase staging: `vgbwmamntjmhzrpvhxzb`, catorze migrations já aplicadas no bloco anterior. Nenhuma migration adicional neste bloco. Produção (`vfplbkfxipfictuwkkoe`) e NutriTrack pessoal permanecem protegidos. O serviço anterior `aura-business-demo` mantém `saas-foundation` e auto-deploy off: avançar a branch não publicou código nesse serviço. Antes de qualquer publicação nesse destino, coordenar schema/permissões, obter autorização específica e fechar os gates de segurança.

## Demonstração fictícia

`scripts/staging-demo.ts` exige ID cloud exato, confirmação explícita, evidência de restauro com integridade verificada e todas as identidades existentes marcadas sintéticas com email `example.invalid`. Não carrega `.env` implicitamente, não apaga, não envia emails, não redefine passwords e não reutiliza a chave pessoal. Cada execução cria um conjunto novo; **não repetir para procurar credenciais**. O manifesto privado guarda progresso antes das chamadas seguintes; falhas parciais permanecem para análise, sem cleanup automático.

Run pronto: `0dbc6ba9-0341-4ec4-ae7e-d52a5276aa0a`. Credenciais em `.aura-integration/online-demo-<run>/credentials.private.json`, fora do Git. Gestor administra organização/equipa sem acesso implícito às medições; profissional tem quatro competências explícitas e atribuição ao aluno; aluno não é membro da equipa e só recebe uma avaliação publicada. Três avaliações fictícias, acompanhamento, objetivo e marcação demonstram a ficha existente.

Uma primeira execução `fe713805-8ff1-4be1-8770-0146159d9805` ficou parcial: contas, organização, aluno e avaliações criadas. A tentativa de o coach atribuir o responsável foi corretamente recusada, porque atribuições são reservadas à gestão. O gerador passou a criar acompanhamento sem atribuição de responsável; as permissões não foram relaxadas. Não houve eliminação dos dados fictícios parciais.

## Repetir verificações

`npm run test:deploy:staging` é leitura pública, destino fixo e sem ficheiros administrativos. Verifica cabeçalhos/HTTP em dez rotas e assets carregados, presença do ID staging e ausência de IDs protegidos ou valores com formato de secret key. A biblioteca contém o prefixo literal `sb_secret_`; isso não constitui uma chave. O scanner verifica valores completos com formato de chave, não esse literal. Não substitui uma auditoria de todos os artefactos.

`npm run test:e2e:staging` usa configuração separada, exige `AURA_STAGING_BROWSER_CONFIRM=vgbwmamntjmhzrpvhxzb` e `AURA_ONLINE_DEMO_FILE` para o manifesto privado pronto. Chromium só pode contactar o frontend staging e esse Supabase; traces, vídeos e screenshots desligados. Os três testes validam criação/conclusão de objetivo e evolução pelo coach, projeção partilhada do aluno e ausência de medições para o gestor. Estes testes criam objetivos fictícios adicionais; não se executam no CI público por necessitarem de credenciais privadas.

## Gates ainda abertos

- Login com password foi demonstrado. URLs de confirmação/recuperação Auth do novo staging ainda precisam de configuração e ensaio específicos; não assumir que os links de email apontam ao novo frontend. O conector não oferece alteração Auth. Não configurar o staging com URL de produção.
- Advisor: proteção contra passwords comprometidas desativada; política de MFA e sessões ainda requer decisão. Access JWT pode sobreviver ao logout até expirar.
- Recuperação demonstrada é cópia lógica de dados fictícios cloud para novo destino local; recuperação operacional cloud/PITR, RPO/RTO e Storage não foram demonstrados.
- Base jurídica, minimização, retenção/direitos e responsáveis operacionais precisam de fecho antes de dados reais. Staging não é produção clínica.
- NutriTrack importa manualmente peso/cintura do backup v2. Nutrição, sincronização automática, cobrança e portal completo do aluno continuam por desenvolver.
- Plano free pode suspender por inatividade e tem limites; não é compromisso de disponibilidade ou custo futuro.

O pedido para uma auditoria do ChatGPT está em INDEPENDENT_AUDIT_BRIEF.md. Nenhuma auditoria externa foi solicitada ou executada automaticamente.
