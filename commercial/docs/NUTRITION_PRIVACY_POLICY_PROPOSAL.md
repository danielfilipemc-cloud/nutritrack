# Registos nutricionais — política necessária, ainda não aprovada

Proposta de requisitos técnicos/operacionais para decisão do responsável e revisão jurídica, não parecer jurídico nem certificação RGPD. Apenas dados inventados nesta fase. A integração técnica de P3/P4 não autoriza persistência cloud, dados reais, plano alimentar ou prescrição. A classificação dos registos, finalidades e condições aplicáveis têm de ser confirmadas antes de tratamento real.

O RGPD exige limitar a conservação à finalidade e prevê condições específicas para categorias especiais. Não se presume que qualquer diário seja sempre clínico ou que nunca possa revelar saúde; a proposta AURA é protegê-lo conservadoramente enquanto essa avaliação está pendente. Acesso, retificação, apagamento, limitação e portabilidade precisam de procedimentos próprios; não são resolvidos por uma checkbox genérica. Fontes para revisão: [RGPD, em particular arts. 5, 6, 9, 15–20, 28, 32 e 35](https://eur-lex.europa.eu/legal-content/EN/TXT/?uri=CELEX%3A32016R0679), [direitos segundo o EDPB](https://www.edpb.europa.eu/topics/key-gdpr-concepts/data-subject-rights_en), [orientações EDPB sobre acesso](https://www.edpb.europa.eu/system/files/2023-04/edpb_guidelines_202201_data_subject_rights_access_v2_en.pdf).

## Decisões documentadas antes de dados reais

| Decisão do responsável/jurídico | Tradução técnica a preparar após aprovação |
|---|---|
| Finalidades permitidas, base de licitude e eventual condição adicional; tratamento de menores | Avisos/versionamento e fluxo verificável por finalidade; sem consentimento presumido nem reaproveitamento para marketing, treino de modelos ou diagnóstico |
| Papéis do estabelecimento, AURA e fornecedores, contratos e transferências | Registo de responsabilidades, acessos de suporte aprovados e rastreáveis; White Label não transfere automaticamente responsabilidade |
| Quem pode registar/corrigir/anular e habilitações necessárias | Competência explícita e atribuição vigentes; role coach/owner não prova habilitação. Sem plano/recomendação automática |
| Âmbito de exportação/acesso do titular e dados de terceiros | Contrato de exportação separado, verificação de identidade e escopo; acesso clínico do staff não é o único modo de exercer direitos |
| Prazos e fundamentos por classe de dado, obrigações de conservação e restrições por litígio | Configuração/revisão de retenção, legal holds e processo de destruição/anonymização aprovado; nenhuma limpeza automática neste candidato |
| Incidente, recuperação e pedidos pendentes durante restauro | Responsáveis, prazos aplicáveis, registo de decisões e reconciliação pós-restauro; recuperação não pode reabrir acesso revogado sem validação |

Sem estas decisões não há prazo legal de conservação escolhido pelo desenvolvimento. TBD não significa autorização para conservação ilimitada. Registos nutricionais não devem ser acumulados em produção enquanto a política estiver indefinida.

## Exportação proposta e bloqueio atual

`aura_visible_export` não inclui Nutrição. Não apresentar o ficheiro atual como exportação completa de dados nutricionais, nem conceder temporariamente competência alimentar para contornar essa ausência. Antes de ativar persistência acessível ao utilizador, rever a UI/contrato para explicitar o âmbito e implementar o fluxo nutricional num PR próprio; está pendente.

Formato proposto versionado: JSON legível por máquina e CSV derivado quando adequado, com organização/aluno autorizados, instante/fuso, período, versão do contrato, cobertura/limitações, refeições, revisão atual e histórico quando aplicável, estado anulado e origem/autoria permitida. Preservar composição original por 100 g, quantidade/unidade, null desconhecido e zero conhecido; não reconstruir dados antigos por um catálogo atual, não inferir calorias nem avaliações clínicas. Se forem fornecidos totais, usar cálculo não arredondado por item e identificar composição incompleta, cobertura do diário e limites de tamanho.

Exportar por várias páginas mutáveis não garante uma fotografia consistente: inserções antes do cursor podem faltar e correções podem mudar o dia de refeições já lidas. nextCursor=null só termina a consulta daquela página. Para declarar um export completo, o PR de exportação deve escolher e testar uma estratégia coerente (snapshot/limite de revisão e reconciliação, ou janela coordenada sem alterações), bem como paginação integral. Até lá, exportação nutricional completa fica bloqueada, não truncada silenciosamente.

Um pedido do titular não deve dar acesso a pedidos de outros titulares, notas de terceiros, tokens, segredos MFA, hashes de comandos ou metadados operacionais sem pertinência. A eventual inclusão de autores e de histórico exige avaliação de finalidade/direitos de terceiros. Provar a identidade e o vínculo no procedimento de direitos, sem depender de um gestor receber implicitamente autorização profissional. Não implementar agora esse acesso por service_role ou por mudança artificial de atribuição.

Guardar cada caso com identificador, identidade verificada por método aprovado, escopo, decisor, data, estado e referência de entrega, sem copiar o conteúdo alimentar para o histórico do pedido. Revalidar acesso ao gerar e entregar; saída privada criptografada, fora do Git, URLs com validade controlada quando houver infraestrutura aprovada. Não enviar dados por email/chat a partir deste processo sem autorização específica.

## Retenção por classe — sem TTL/purge atual

| Classe | Propriedades e decisão pendente |
|---|---|
| Refeições/versões/itens | Snapshots append-only para integridade; prazo ligado à finalidade e obrigações aprovadas. Correção cria revisão; anulação lógica não é apagamento |
| Recibos idempotentes | IDs de ator/aluno/refeição e hash podem continuar identificáveis. Definir janela, fundamento e tratamento de retries antigos; apagar recibos sem estratégia pode transformar um retry em criação duplicada |
| Eventos de auditoria | Conservar só ação/IDs/instante necessários, com prazo próprio. Não duplicar refeições, justificações livres, tokens ou payloads |
| Exportações privadas | Prazo de disponibilização, destinatário, expiração e destruição aprovados; catálogo de entregas mínimo separado do ficheiro |
| Backups | Prazo/rotação, acesso e restauro; definir como reaplicar decisões de apagamento/restrição antes de voltar a servir dados restaurados |
| Fixtures de staging | Duração do ensaio e revisão manual após conclusão; cessar sessões/competências de teste conforme manifesto. Não apagar histórico automaticamente nem incluir contas pessoais |

O backend atual não expira recibos nem executa purge. Uma futura política não pode ativar limpeza apenas por cron: precisa de novo contrato para retries antigos/tombstones e testes de idempotência, decisão jurídica, migration incremental revista e autorização de execução.

## Pedidos de retificação, eliminação e restrição

Separar correção de um lançamento alimentar (nova revisão) de um pedido de privacidade. Imutabilidade operacional não constitui justificação para recusar todos os direitos nem impõe conservar dados para sempre. Não remover triggers ou apagar linhas manualmente para satisfazer um pedido sem procedimento aprovado.

Fluxo assistido proposto: verificar identidade/âmbito; localizar dados e destinatários; avaliar restrições/fundamento de conservação com o responsável; suspender acessos aplicáveis por mecanismos auditados; decidir e registar motivo/resultado; preparar operação controlada de apagamento/anonymização ou resposta fundamentada e revisão, com backup/restauro reconciliados. Não é implementada eliminação definitiva nesta fase. Não adiar decisões indefinidamente porque existe backup; o procedimento futuro deve tratar cópias e informar adequadamente.

## Critérios técnicos e evidência antes de ativação

Testar export seletivo por empresa/aluno, titular vinculado e revogado, negação a gestor sem atribuição, ausência de terceiros/segredos, conservação de null/zero/origem/revisões, completude perante mais de uma página, retificação/anulação sem perda do original, retry fora da janela proposta e reaplicação de restrições após restauro. Sem aprovação da política e ensaios reais GoTrue/PostgREST não declarar concluído H-05, H-02 ou recuperação.

A proposta não altera o produto, consentimentos existentes ou configurações remotas. As decisões pendentes são bloqueios explícitos para dados reais/piloto; a janela futura de staging continua limitada a fixtures fictícias e depende da autorização própria descrita no plano de ativação.
