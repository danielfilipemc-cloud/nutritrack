# Recuperação assistida de segundo fator e ativação por organização

Revisão complementar do PR #17, 2026-10-17. Só dados fictícios; nenhuma operação de recuperação administrativa foi executada. Este procedimento prepara suporte e critérios de aceitação, não constitui um mecanismo de desbloqueio já validado.

## Princípios e limites

A recuperação de password não substitui TOTP. Um email, sessão AAL1, conhecimento de dados do aluno, alegação de ser owner ou metadata editável não autorizam retirar MFA. O suporte não pede password, segredo TOTP, QR, código corrente ou chave administrativa por chat. Não se desativa a política da organização para recuperar uma conta. Não se atribui owner temporário nem se alteram auth.sessions, claims, fatores ou tabelas privadas por SQL para fabricar AAL2.

O produto apenas permite cancelar inscrições TOTP ainda não verificadas. A remoção de um fator verificado e a substituição administrativa não estão disponibilizadas na interface. Não existe atualmente recuperação assistida validada de perda total do segundo fator: é um bloqueio para piloto, não uma exceção operacional implícita.

## Procedimento assistido

1. Abrir incidente privado com identificador, organização/conta afetadas, hora UTC, operador e revisor independente. Registar apenas informação mínima; nunca tokens, segredos ou documentos de identidade no log público. Aplicar a retenção e a base jurídica aprovadas para a verificação de identidade.
2. Distinguir dispositivo temporariamente indisponível, inscrição não concluída, fator perdido e suspeita de comprometimento. Não aceitar um pedido por email como prova suficiente. A política de verificação de identidade e a dupla aprovação devem ser definidas pelo responsável antes do piloto; enquanto faltarem, não executar substituição administrativa.
3. Se houver outro fator já verificado e sob controlo do utilizador, autenticar através desse fator usando o desafio normal do fornecedor. Confirmar sessão AAL2 recente no servidor. O eventual fluxo de troca de fator deve primeiro ser implementado e ensaiado no staging, incluindo fator antigo revogado, nova sessão e negação com JWT antigo. Não existe ainda um fluxo de troca entregue no produto.
4. Perda total ou comprometimento: manter o acesso sensível bloqueado e preservar a política MFA. Se houver risco de sessão comprometida, tratar a revogação por operador autorizado, em procedimento separado e auditado; não considerar que apagar um fator invalida todos os JWT. Nunca pedir credenciais administrativas ao utilizador.
5. A eventual recuperação pelo canal administrativo suportado pelo fornecedor exige autorização específica, prova de identidade aprovada e dois intervenientes. Antes de a usar com pessoas reais, definir e executar um ensaio completo em conta fictícia. Sem método suportado e testado, escalar ao fornecedor/responsável; não improvisar um bypass SQL ou endpoint de suporte.
6. Depois de um procedimento aprovado, o próprio utilizador inscreve um novo fator e completa o desafio normal. Verificar no banco sessão AAL2 ativa, TOTP recente e fator verificado. Confirmar que sessões/fator antigos não permitem leituras nem comandos sensíveis. Repetir login, logout e revogação; nenhuma nova password isoladamente pode satisfazer MFA.
7. Revisor encerra o incidente apenas com evidências da identidade/autorização, operações suportadas executadas, revogações, desafio novo, testes negativos e comunicação por canal previamente validado. Guardar resultado agregado sem material de autenticação. Falha em qualquer passo mantém o incidente e o acesso bloqueados.

## Ativação verificável para cada organização piloto

Não existe ativação global automática. Cada organização tem uma linha própria em app_private.organization_security; ausência de linha significa política desligada. A autorização clínica/atribuições continua independente de AAL2.

Antes da ativação, registar privadamente organização, owner autorizado, revisão do frontend/migrations, operador/revisor e todas as identidades participantes (incluindo alunos). Confirmar que conseguem autenticar com TOTP e que foi ensaiada a recuperação assistida. Não ativar num piloto com identidades incapazes de completar o desafio; não desligar a política para contornar esse requisito.

1. Owner usa /seguranca, inscreve/verifica o fator e completa desafio recente. Consultar aura_security_context para obter required/revision/can_configure; um erro é desconhecimento, nunca política desligada.
2. Owner confirma explicitamente a ativação. aura_security_policy_save exige AAL2 recente, sessão Auth ativa, fator TOTP verificado e revisão atual. Admin/coach/aluno/outro tenant, AAL1, sessão revogada e revisão antiga devem falhar. Em conflito ou rede incerta, reler o contexto antes de repetir; não presumir que a gravação falhou.
3. Reler contexto: required=true, revision incrementada. Verificar aura_security_requirement: AAL1 required=true/satisfied=false; AAL2 válido required=true/satisfied=true. O registo privado da alteração inclui updated_by/updated_at e o evento sensitive_mfa_enabled. Um revisor autorizado pode inspecionar esses campos no ambiente isolado; não conceder acesso direto às tabelas privadas para a interface.
4. Com uma sessão AAL1 emitida antes da ativação, verificar que a próxima leitura de alunos/avaliações não devolve dados e os comandos sensíveis são negados. Repetir com profissional atribuído e aluno. AAL2 não confere competências clínicas implícitas: sem atribuição/outro tenant continuam negados.
5. Com AAL2, testar acesso autorizado; depois expiração de TOTP, logout global e revogação de membro/atribuição/vínculo, repetindo com o mesmo JWT. Leituras e comandos devem perder acesso. Se falharem, suspender o piloto e investigar; não reduzir a política.
6. Em organização exclusivamente fictícia, ensaiar desligar/religar com owner AAL2, revisão atual e evento correspondente; revisão antiga deve dar PT409. Em piloto, desligar exige decisão de segurança separada, não uma ação de suporte de rotina.
7. Emitir ficha de aceitação: organização, SHA, migrations/checksums, owner/operador/revisor, revisão antes/depois, UTC de ativação, resultados individuais AAL1/AAL2/revogação/isolamento e referência privada do evento. Uma checklist sem resultados observados não é evidência. A aprovação é por organização; demonstração com MFA desligado não conta.

## Bloqueios preservados

Continuam altos: proteção contra passwords comprometidas desativada e decisão de plano/medidas compensatórias; TTL JWT cloud observado de 3600s e política de sessões por confirmar; restauro operacional cloud de Auth/DB/MFA/configuração não ensaiado; fluxo completo de recuperação de conta/email e allowlist não verificados; recuperação assistida de segundo fator ainda não ensaiada; requisitos jurídicos, retenção e resposta a incidentes sem aprovação. O redirect corrigido não encerra a recuperação de conta. Nenhum ensaio local/PGlite demonstra por si só a configuração ou recuperação cloud.
