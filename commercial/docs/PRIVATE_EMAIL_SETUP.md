# Emails privados AURA — configuração preparada, envio pendente

Os ficheiros HTML deste incremento **não são instalados automaticamente** no
Supabase. Nenhum email, conta ou serviço SMTP foi criado por este documento.
O responsável informou que não consegue criar a conta SMTP neste momento.
Continuar o restante desenvolvimento não elimina esta dependência.

Destino exclusivo: `aura-business-private`, Supabase `ivwrvaycolqlpsjvdaod`.
URL: <https://aura-business-private.onrender.com>. Nunca colar chaves no Git/chat,
usar credenciais de outro projeto ou alterar a demonstração/staging/produção.

## Quando o responsável puder configurar

1. Criar conta **Free** na [Brevo](https://onboarding.brevo.com), confirmar o email
   e concluir a ativação do envio transacional. Não subscrever planos pagos.
2. Configurar/verificar o remetente. Se já existir um domínio próprio autorizado,
   configurar DKIM/DMARC conforme a Brevo. Não comprar um domínio automaticamente.
   Sem domínio autenticado, a Brevo pode substituir temporariamente o remetente;
   isto não prova entrega no Hotmail e não é solução comercial definitiva.
3. Em Brevo → Settings → SMTP & API → SMTP, obter o **Login SMTP** e criar uma
   **SMTP key**. O login pode diferir do email de entrada. Não usar uma API key,
   a palavra-passe da conta ou o host SMTP como login.
4. Abrir [SMTP do projeto privado](https://supabase.com/dashboard/project/ivwrvaycolqlpsjvdaod/auth/smtp),
   ativar Custom SMTP e preencher os campos abaixo diretamente no painel.

| Campo | Valor/origem |
| --- | --- |
| Host | `smtp-relay.brevo.com` |
| Port | `587` |
| Username | Login exato mostrado na página SMTP da Brevo |
| Password | SMTP key, apenas no campo secreto do Supabase |
| Sender name | `AURA Business` |
| Sender email | Remetente verificado/autorizado na Brevo |

O envio é feito pelo Auth do Supabase, não pelo servidor Render. Não acrescentar
segredos SMTP ao frontend/variáveis `NEXT_PUBLIC_*`. Preservar os limites de envio
e usar TLS conforme os requisitos atuais do fornecedor; não desligar validação de
certificados para obter uma ligação. Não desativar confirmação de email ou MFA.

5. Confirmar em [URL Configuration](https://supabase.com/dashboard/project/ivwrvaycolqlpsjvdaod/auth/url-configuration):
   Site URL `https://aura-business-private.onrender.com`; redirect permitido
   `https://aura-business-private.onrender.com/**`. Evitar wildcards de outros hosts.
6. Em [Email Templates](https://supabase.com/dashboard/project/ivwrvaycolqlpsjvdaod/auth/templates),
   preparar os dois modelos abaixo. Manter a URL de ação `{{ .ConfirmationURL }}`
   sem substituir por uma ligação fixa, token manual, pixel ou encurtador.
   Desativar tracking de cliques que reescreva os links de autenticação.

| Tipo Supabase | Assunto | Ficheiro |
| --- | --- | --- |
| Invite user | O teu convite para a AURA Business | `supabase/email-templates/invite.html` |
| Reset password | Define a tua palavra-passe — AURA Business | `supabase/email-templates/recovery.html` |

São templates para Auth do Supabase, enviados via relay SMTP. Não criar uma
campanha Brevo com os endereços dos participantes nem tentar renderizar as
variáveis GoTrue dentro do editor Brevo. Não alterar TTLs para compensar problemas
de entrega. Se a plataforma pré-abrir links para análise, investigar o consumo do
token antes de adotar um contrato alternativo; não desativar a utilização única.

## Ativação das duas contas

O conector atual não tem Auth Admin e o browser do painel não ficou disponível.
Depois de SMTP/schema validados, os convites têm de sair pelo Auth admin UI/API
autorizado. Não inserir utilizadores em tabelas Auth por SQL, extrair chaves do
servidor ou adicionar participantes à equipa Supabase para contornar o mailer.
Os endereços fornecidos pelo responsável permanecem no canal privado de operação,
nunca nos templates, fixtures ou relatórios públicos.

Cada pessoa confirma a sua caixa, escolhe a própria palavra-passe pelo fluxo já
existente e configura TOTP. Antes de acesso a registos, criar/verificar o vínculo
próprio e a política AAL2 obrigatória no âmbito privado correspondente. Nenhuma
competência profissional ou partilha entre participantes se concede para facilitar
o teste. O convite Auth, por si, não cria os vínculos da aplicação.

O botão Palavra-passe da área privada abre o pedido de recuperação existente.
O convite não envia uma password temporária previsível nem garante que a password
já foi definida. A recuperação mantém as exigências de MFA e os estados incertos.

## Critérios de aceitação de email

- Remetente autorizado; teste real de entrega e spam nos dois Hotmail, registado
  privadamente sem copiar links, tokens ou headers com segredos para o PR.
- Convite aceite apenas pelo fluxo válido; ligação expirada/repetida não conserva
  uma sessão anterior nem cria acesso a outra conta.
- Recuperação recebida e nova password aceite; password anterior recusada,
  segundo fator preservado e resultado incerto não reportado como sucesso.
- URLs finais no host privado; ausência de tokens no histórico/logs públicos,
  tracking ou pedidos a recursos externos dos templates.
- Conta sem vínculo, outro participante e utilizador revogado continuam negados
  no PostgREST, independentemente do sucesso do login/email.

HTML inline, sem imagens, scripts, fontes remotas ou conteúdo clínico. A pré-visualização
Chromium não certifica Outlook/Gmail, dark mode de clientes de email, leitores de
ecrã, entrega SMTP ou o contrato efetivo de templates do projeto remoto.

Fontes oficiais consultadas:
[Supabase SMTP](https://supabase.com/docs/guides/auth/auth-smtp),
[Supabase templates](https://supabase.com/docs/guides/auth/auth-email-templates),
[Brevo SMTP](https://help.brevo.com/hc/en-us/articles/7924908994450-Send-transactional-emails-using-Brevo-SMTP),
[Free](https://help.brevo.com/hc/en-us/articles/208580669-FAQs-What-are-the-limits-of-the-Free-plan),
[remetente/Hotmail](https://help.brevo.com/hc/en-us/articles/14925263522578-Comply-with-Gmail-Yahoo-and-Microsoft-s-requirements-for-email-senders).
