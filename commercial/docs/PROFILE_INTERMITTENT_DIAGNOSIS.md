# Ficha intermitente — diagnóstico de 2026-10-18

Estado: **causa do incidente original não determinada; problema não declarado resolvido**. Base publicada `6823fe0b9d35db9f5edaa4939ed45a022ab01888`. Esta entrega acrescenta testes e diagnóstico, sem alterar o comportamento da aplicação, o staging ou a produção.

## Evidência original e alcance

Foram consultados `.aura-integration/deploy-pr27/PUBLICATION_REPORT.md`, `visual-capture-initial-failure.log`, `visual-evidence.json` e o procedimento de recolha. Depois de os sete testes funcionais passarem, uma abertura de ficha mostrou «Não foi possível abrir a ficha» e «Tentar abrir ficha». A repetição visual passou. O log original não contém estado HTTP, erro do serviço, duração do lookup ou correlação de pedido: não distingue timeout, transporte ou recusa do servidor. O abort de organization_members observado na repetição não prova a causa do lookup anterior.

## Caminho real no código

1. `lib/use-professional.ts:9–26`: valida utilizador, carrega vínculos e escolhe organização; invalida estado quando muda a identidade.
2. `components/AssessmentWorkspace.tsx:44–48`: invalida pedidos anteriores, limpa ficha/dados, verifica organização/id e consulta a tabela `clients` por **organization_id + id**. É um SELECT PostgREST, não um RPC de abertura de ficha. Existe AbortController com timeout explícito de **8000 ms**.
3. `AssessmentWorkspace.tsx:48`: uma resposta com r.error, uma rejeição de transporte e o abort por prazo convergem para a mesma mensagem genérica. Ausência de linha mostra antes «Aluno indisponível neste estabelecimento», sem tratar ausência como falha de rede.
4. `AssessmentWorkspace.tsx:49`: só depois do lookup válido corre `aura_client_permissions`. A interface fica sem controlos sensíveis enquanto a consulta de permissões não tiver sucesso. O contexto user/org/client protege a utilização dos resultados.
5. `AssessmentWorkspace.tsx:64`: a repetição exige ação explícita e incrementa lookupRevision. Troca de organização/rota ou logout invalida o scope, aborta o pedido e limpa o estado. Não foi encontrada evidência de retry automático de escrita nesta abertura.

Os números de linha referem-se ao SHA base; usar `rg -n '8000|Tentar abrir ficha|aura_client_permissions' commercial/components/AssessmentWorkspace.tsx` para reproduzir a inspeção. `RequestScope` invalida versões; não prova por si só autorização no banco.

## Reprodução local controlada

`e2e/profile-stability.spec.cjs` acrescenta **cinco casos**, todos com utilizadores/estabelecimentos fictícios e rede interceptada:

| Caso | Resultado observado |
|---|---|
| Resposta dentro do prazo, relógio avançado 7 s | Ficha abre com um lookup, sem retry |
| Pedido retido, relógio avançado 8,1 s | Mesma mensagem genérica do incidente; nenhum dado pessoal/controlos prematuros; retry explícito abre e limpa o erro |
| HTTP 401 seguido de 403 no retry | Ficha não aparece, nenhum RPC de permissões é lançado nem controlo de gravação exposto |
| Falha tardia da organização A depois de selecionar B | Não repõe ficha A nem mostra o erro antigo em B |
| Logout durante lookup | Resposta tardia não repõe identidade, ficha ou controlos |

**5/5 PASS**, 18,0 s na execução focada. O teste do prazo usa relógio virtual do Chromium, não latência real da cloud. Reproduz um mecanismo capaz de produzir o sintoma; **não estabelece que o incidente original tenha sido um timeout**. O teste já existente `e2e/profile-mvp.spec.cjs:17` cobre erro de transporte e retry; não foi duplicado.

## Sondagem Auth real, apenas leitura

Três testes delimitados usaram exclusivamente manager, coach e aluno do manifesto sintético READY já autorizado. Verificação de id e app_metadata.synthetic/aura_online_demo ao autenticar; nenhuma chave administrativa. Navegação alternada desktop/mobile: **6 fichas coach + 4 fichas manager + 3 aberturas do portal do aluno = 13 tentativas**, **3/3 testes PASS**, 23,6 s.

Os dez lookups de ficha devolveram HTTP 200, resposta em **84–520 ms**; zero falhas de lookup, zero repetições e zero tentativas de mutação bloqueadas. As três aberturas do portal não são lookups da ficha profissional. A sondagem permite apenas GET/HEAD/OPTIONS, login/refresh e uma allowlist de RPCs de consulta; outras escritas são bloqueadas. Não foram modificados objetivos, avaliações, agenda, atribuições, consentimentos ou configurações. Login cria sessões sintéticas normais; não se fez gestão administrativa de Auth nem revogação global.

Evidência privada local: `.aura-integration/stability-nutrition/{readonly-evidence.json,readonly-probe.log,readonly-probe.spec.cjs,playwright.readonly.config.cjs,profile-focused.log}`. Regista apenas papel, índice, caminho sem query, HTTP, duração e erro de transporte. Não regista passwords, headers, tokens ou corpos de dados. Configuração de traces, vídeos e screenshots de falha desligada.

## Conclusões e limites

- **Confirmado:** timeout de 8 s; mensagem comum a causas diferentes; limpeza/negação/repetição nos casos testados; incidente original não reproduzido na sondagem Auth real.
- **Hipóteses não demonstradas:** latência ocasional acima do prazo, erro transitório PostgREST, transporte abortado, resposta 401/403 ou concorrência específica da navegação. Cold start, plano gratuito e sessões não são causas estabelecidas pelos dados recolhidos.
- **Médio aberto:** observabilidade insuficiente para atribuir a causa da ocorrência original. Não aumentar timeout, adicionar retries automáticos ou alterar autenticação sem dados adicionais. Não há correção causal de aplicação para integrar neste PR.
- **Limites:** amostra pequena, uma organização fictícia, sem ensaio de suspensão/cold start forçado, falha de infraestrutura, refresh expirado real, desafio MFA ou revogação real de permissões. Nenhuma conclusão de segurança geral ou de desempenho/SLA.

## Próximo incremento condicionado

Se voltar a ocorrer, correlacionar uma única tentativa com categoria timeout/HTTP/transporte e duração monotónica; guardar só código/status e identificador técnico opaco de curta duração, nunca aluno, email, query, payload, token ou credencial. O identificador terá de ser correlacionável com logs do servidor sem expor dados pessoais; a instrumentação não está instalada nesta entrega. Qualquer retenção/envio de telemetria precisa de propósito e prazo definidos.

Reproduzir a categoria confirmada com fixtures e então abrir **PR de correção isolado**, mantendo guards, MFA, RLS, rascunhos e autorização no banco. Não considerar o desaparecimento após retry como resolução da causa. Nenhuma publicação ou migration está autorizada nesta fase. Continuam abertos os bloqueios altos de autenticação/sessões, recuperação cloud/conta/MFA e RGPD.

## Reprodução

Local: `npx playwright test e2e/profile-stability.spec.cjs --workers=2` após build do candidato. A suite completa e o CI ficam referenciados na descrição do PR.

Cloud por leitura: definir AURA_STAGING_BROWSER_CONFIRM=vgbwmamntjmhzrpvhxzb e AURA_ONLINE_DEMO_FILE para o manifesto privado READY já autorizado, depois executar `npx playwright test --config .aura-integration/stability-nutrition/playwright.readonly.config.cjs`. Nunca executar o provisionador ou a auditoria cloud mutável para reproduzir este diagnóstico.
