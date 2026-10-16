# AURA Business — pedido de auditoria independente

Rever `integration/aura-staging` e o diff contra `543e3a0b78e864cc65a8c07dec0736c8ee6c39af` (`saas-foundation`, PR #8). Os PRs #9–#14 explicam os blocos originais; a branch de integração conserva os mesmos commits, sem reescrever migrations. Confirmar as revisões atuais no GitHub antes de concluir.

## Pedido a enviar ao ChatGPT

Audita tecnicamente a AURA Business em `commercial/`, sem modificar o NutriTrack pessoal. Identifica problemas reproduzíveis por severidade, com ficheiro/linha, cenário de exploração ou regressão e correção sugerida. Distingue observação, hipótese e teste executado. Não declares segurança apenas com base nos testes existentes.

Prioriza autenticação/sessões, autorização por organização, competências e atribuições, projeções mínimas do aluno, revogação, funções SECURITY DEFINER e grants, concorrência/revisões, privacidade de avaliações, importação NutriTrack, recuperação e separação staging/produção. Verifica também acessibilidade, erros/ausência de dados, responsividade e consistência Dark Premium sem reconstruir a interface.

Consulta README, CODEX_HANDOFF, INTEGRATION_STATUS, LOCAL_VALIDATION, SECURITY_REVIEW_20261016, STAGING_RECOVERY_20261016, NUTRITRACK_BRIDGE e as migrations/testes. Examina implementações, não apenas relatórios. O backup NutriTrack v2 importa manualmente peso/cintura; nutrição e sincronização automática permanecem incompletas.

Não acedas a dados reais, não solicites chaves administrativas, não executes runners históricos contra produção e não publiques alterações. Os relatórios privados, dumps, credenciais e `.env` não são materiais de auditoria partilháveis. A demonstração sem conta está em https://aura-business-staging.onrender.com/demo/aluno-360. Só usar contas fictícias fornecidas por canal privado autorizado.

Entrega: achados críticos/altos primeiro; passos de reprodução e evidência; lacunas de testes; requisitos antes de aceitar dados reais; prioridades para um MVP útil. A recuperação demonstrada é lógica cloud → local, não PITR ou reposição operacional cloud. Proteção contra passwords comprometidas, política MFA/sessões e requisitos legais continuam pendentes.

## Critério de conclusão

Nenhum achado crítico/alto sem tratamento ou decisão explícita. Uma auditoria do ChatGPT complementa a revisão técnica; não equivale a certificação de segurança, revisão jurídica ou pentest independente.
