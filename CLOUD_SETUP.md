# NutriTrack Cloud - ativacao Supabase

## 1. Criar projeto

1. Criar um projeto gratuito em https://supabase.com/dashboard
2. Abrir `SQL Editor`.
3. Executar o conteúdo de `supabase-setup.sql`.

## 2. Configurar credenciais públicas

1. No Supabase, abrir `Project Settings` > `API`.
2. Copiar `Project URL`.
3. Copiar a chave pública `anon` ou `publishable`.
4. Colocar ambas em `cloud-config.js`.

Exemplo:

```js
window.NUTRITRACK_CLOUD = {
  url: 'https://exemplo.supabase.co',
  anonKey: 'chave-publica'
};
```

A chave pública pode ser usada no browser. Nunca colocar uma chave `service_role` neste projeto.

## 3. Autenticacao por email

Em `Authentication` > `Providers`, manter Email ativo.

Durante testes, podes desligar a confirmação obrigatória de email. Para utilização pública, é recomendável voltar a ativá-la.

## 4. URLs de autenticacao

Em `Authentication` > `URL Configuration`:

- `Site URL`: `https://danielfilipemc-cloud.github.io/nutritrack/`
- Adicionar o mesmo endereço a `Redirect URLs`.

Isto permite regressar à app depois de confirmar o email ou pedir recuperação de palavra-passe.

## 5. Login Google sem SMTP proprio

Enquanto nao existir SMTP proprio, usar Google como opcao principal. Email e palavra-passe permanecem disponiveis como alternativa durante os testes.

1. Em https://console.cloud.google.com criar ou selecionar um projeto.
2. Em `Google Auth Platform`, configurar `Branding`, `Audience` e `Data Access`.
3. Em `Clients`, criar um cliente OAuth do tipo `Web application`.
4. Em `Authorized JavaScript origins`, adicionar `https://danielfilipemc-cloud.github.io`.
5. Em `Authorized redirect URIs`, adicionar `https://maipjryehnllaifxhunf.supabase.co/auth/v1/callback`.
6. Copiar o `Client ID` e o `Client Secret`.
7. No Supabase, abrir `Authentication` > `Providers` > `Google`, ativar o provider e guardar os dois valores.

## 6. SMTP para partilha publica futura

Antes de convidar utilizadores:

1. Em `Authentication` > `Providers` > `Email`, voltar a ativar `Confirm email`.
2. Em `Project Settings` > `Auth` > `SMTP Settings`, configurar um fornecedor SMTP próprio.
3. Definir remetente e nome visível, por exemplo `NutriTrack`.
4. Criar uma conta de teste real e confirmar receção dos emails de registo e recuperação.

O servidor de email incluído no Supabase serve apenas para testes limitados. Um SMTP próprio evita bloqueios rápidos de envio.

## O que sincroniza

- Perfil, refeições e templates.
- Água, plano diário, peso e medidas.
- Alimentos recentes e pessoais.
- Preferência de modo escuro.

As fotografias corporais permanecem apenas no dispositivo nesta primeira fase.

## Checklist físico móvel

Testar num Android e, quando possível, num iPhone:

1. Abrir a app e escolher `Continuar sem conta`.
2. Instalar pelo botão apresentado no Perfil ou por `Adicionar ao ecrã principal`.
3. Abrir `Registar` > `Scanner código de barras`.
4. Permitir a câmara e ler pelo menos dois produtos.
5. Confirmar o fallback de código manual quando o scanner automático não estiver disponível.
