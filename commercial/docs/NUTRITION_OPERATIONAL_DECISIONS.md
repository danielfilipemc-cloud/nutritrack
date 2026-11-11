# Nutrição — decisões e evidência antes da ativação

Revisão de requisitos, não aprovação jurídica, autorização cloud ou certificação.
Complementa `NUTRITION_PRIVACY_POLICY_PROPOSAL.md`; não substitui as decisões aí
pendentes. Exclusivamente fixtures inventadas. Nenhum prazo de retenção, base de
licitude ou habilitação profissional é presumido pelo código.

## Integração efetiva do PR #33

Head aprovado `d45b671468af65f85a1a3ba732c6082f8d05834b`, base
`f2a5e90cb8592043f839de2281c0a9c5cdf0ff0a`, CI anterior aprovado. Merge em
`saas-foundation`: **5d59e7651b4f7fb0ee531992275fdcc979b78569**. Árvore idêntica ao
candidato e alterações apenas em commercial/. CI integrado aprovado:
[39170299258](https://github.com/danielfilipemc-cloud/nutritrack/actions/runs/39170299258).

Revalidação local no código integrado: lint/TypeScript/build aprovados,
96/96 domínio/PostgreSQL, 178/178 Chromium, npm audit sem vulnerabilidades.
PostgreSQL 17.11 nativo descartável, sem rede/portas/mounts: upgrade 17→19,
replay/checksums, CAS, idempotência concorrente, grants e revogação de atribuição
enquanto uma gravação aguarda aprovados. Auth simulado, não GoTrue/PostgREST.
Primeira auditoria npm bloqueada por DNS do sandbox; repetição com acesso de
rede aprovada. Build inicial fora do sandbox encontrou EXDEV na configuração de
telemetria; repetição com NEXT_TELEMETRY_DISABLED=1 aprovada. Não houve alteração
remota, migration, publicação ou contorno de segurança.

## Registo obrigatório de decisões

Cada decisão precisa de identificador, responsável, âmbito/finalidade, opções,
fundamento revisto pelo responsável competente, aprovador, data, versão, prazo de
revisão, evidência e critério de suspensão. Um campo TBD não permite acumulação
indefinida. Evidência não deve conter dados alimentares ou segredos.

| Requisito | Decisão externa ainda necessária | Trabalho técnico possível após decisão | Evidência de fecho |
| --- | --- | --- | --- |
| Classificação/finalidade | Responsável e jurídico: âmbito permitido, condições aplicáveis, menores e papéis de cada interveniente | Avisos versionados e registo mínimo da finalidade autorizada; habilitações separadas de role técnico | Revisão assinada e testes de finalidade/vínculo; não uma checkbox genérica |
| Leitura/exportação | Âmbito por destinatário, histórico, autores/terceiros e verificação da identidade | Produtor transacional consistente, minimização e entrega privada com autorização revalidada | Oráculo de snapshot concorrente + GoTrue/PostgREST real + entrega ao destinatário correto |
| Retenção | Prazo/fundamento por refeições, versões, recibos, auditoria, exportações e backups; restrições de litígio | Configuração versionada e simulação dry-run, sem purge por defeito | Inventário reconciliado, aprovação de cada classe, ensaio de legal hold e restauro |
| Recibos idempotentes | Janela de retry e tratamento de pedidos antigos | Contrato de expiração/tombstone que nunca transforme retry antigo em nova refeição | Testes antes/depois da janela e de restauro; migration futura revista |
| Privacidade | Decisor e procedimento de acesso/retificação/restrição/eliminação e destinatários | Fluxo assistido auditável; nenhum apagamento definitivo automático | Caso sintético integral, minimização e reconciliação de cópias/backups |
| Recuperação | Responsável de incidente, objetivos RPO/RTO e dependências do fornecedor | Ensaio cloud isolado de DB, Auth, configuração e Storage aplicável, com reconciliação | Restauro operacional medido e acesso revogado ainda negado; dump cloud→local é insuficiente |

## RPO/RTO e recuperação — estado real

RPO/RTO não estão aprovados nem demonstrados operacionalmente. Para planeamento,
o responsável pode avaliar **RPO 24 h / RTO 8 h** como hipótese de ensaio, nunca
como SLA ou capacidade já disponível. Confirmar adequação ao negócio e viabilidade
no plano atual, sem contratar funcionalidades/recursos novos nesta fase.

O inventário tem de separar refeições/versões/itens, recibos/eventos, vínculos e
competências, Auth/MFA e revogação, parâmetros de Auth/redirects, código/schema e
Storage quando existir. Restaurar apenas public.* não recupera a conta completa.
Não copiar tabelas Auth nem reativar sessões antigas manualmente. O processo do
fornecedor e o tratamento de MFA devem ser aprovados, ensaiados e auditados.

Antes de reabrir um destino restaurado, reaplicar restrições, revogações e decisões
de privacidade aprovadas; reconciliar recibos e writes posteriores; verificar
checksums, autorização, contagens e snapshots históricos. Sem evidência desses
passos, recuperação cloud e conta/MFA continuam abertas. Não restaurar por cima
do staging ou produção nem criar outro projeto sem autorização específica.

## Gates e próximos PRs

1. Contrato de snapshot offline pode ser revisto sem acesso remoto. Hashes
   verificam o conjunto fixado, não a completude de uma base de dados omitida.
   O produtor transacional remoto continua por implementar/rever.
2. P5 é um ensaio em memória, não um cliente persistente. O seu sucesso não prova
   permissões, conflitos ou recuperação de rede no backend.
3. Matriz real e plano 18/19 exigem autorização independente do destino, SHA,
   checksums, manifesto privado e mutações. Não executar runners antigos ou
   aproveitar implicitamente autorizações de outros módulos.
4. Antes de piloto/dados reais: fechar ou obter decisão explícita sobre todos os
   bloqueios altos; concluir as decisões acima e a evidência de recuperação,
   exportação e autorização; nova auditoria independente. Nenhum destes PRs
   constitui autorização de piloto.

| Bloqueio alto | Estado e responsável pelo próximo passo |
| --- | --- |
| H-01 passwords comprometidas | Aberto; responsável confirma solução disponível no plano e ensaio negativo real, sem custo novo implícito |
| H-02 JWT/sessões | Aberto; política aprovada e testes reais de expiração, refresh, logout e JWT antigo; revogação no banco não resolve todos os casos |
| H-03 recuperação cloud | Aberto; procedimento autorizado e restauro operacional medido |
| H-04 conta/MFA | Aberto; recuperação assistida verificável sem bypass e confirmação de posse aprovada |
| H-05 RGPD | Aberto; responsável/jurídico aprovam finalidade, papéis, direitos, retenção e fornecedores |
