# Fronteira futura de medições NutriTrack

O contrato de leitura em `lib/measurement-contract.ts` foi a primeira fronteira técnica. Existe agora uma ponte efetiva de importação assistida do backup NutriTrack v2, descrita em NUTRITRACK_BRIDGE.md. Não liga bases de dados ou contas, nem ativa nutrição/sincronização automática. O NutriTrack pessoal permanece intacto. Os requisitos abaixo continuam aplicáveis ao futuro transporte automático.

Versão 1: origem `aura`/`nutritrack`, ID estável no sistema de origem, organization_id e client_id AURA, data civil da medição e valores com unidades explícitas. Campos suportados: peso em kg (duas casas), altura e cintura em cm (uma casa), com os mesmos limites atuais AURA. Rejeita unidades desconhecidas, valores não finitos/negativos, precisão excessiva, identidade diferente do contexto, campos extra e datas inválidas. Não converte silenciosamente libras, gramas ou polegadas.

Requisitos antes de implementar transporte/importação:

1. Autorizar separadamente o estabelecimento e o profissional, com competências próprias; aceitar um envelope nunca é autorização.
2. Criar mapeamento explícito de identidade entre origem e aluno AURA, confirmado por profissional autorizado. Nunca associar automaticamente por nome ou email.
3. Definir chave idempotente composta por organização, origem e ID da origem, com versão/revisão de origem. Uma alteração deve preservar auditoria e não substituir silenciosamente uma avaliação AURA.
4. Preservar data observada, data de importação e unidades; definir fuso horário quando a origem fornecer um instante. Evitar duplicação na evolução quando houver correções.
5. Mostrar origem e estado de sincronização, sem anunciar uma integração ativa enquanto só houver contratos. A projeção atual identifica somente medições AURA.
6. Separar nutrição de medições: planos, alimentos, porções e nutrientes exigem contrato próprio, permissões e decisões de privacidade. A aritmética pura existente não constitui um módulo nutricional completo.
7. Ensaiar apenas dados fictícios em staging, verificar isolamento e recuperação antes de considerar dados reais. Não reutilizar a base pessoal do NutriTrack.
