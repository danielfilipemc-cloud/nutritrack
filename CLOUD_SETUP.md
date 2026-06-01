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

## 3. Autenticacao

Em `Authentication` > `Providers`, manter Email ativo.

Durante testes, podes desligar a confirmação obrigatória de email. Para utilização pública, é recomendável voltar a ativá-la.

## O que sincroniza

- Perfil, refeições e templates.
- Água, plano diário, peso e medidas.
- Alimentos recentes e pessoais.
- Preferência de modo escuro.

As fotografias corporais permanecem apenas no dispositivo nesta primeira fase.
