# NutriTrack Pro

App pessoal de nutricao em HTML/CSS/JavaScript puro, pronta para GitHub Pages.

## Cloud opcional

A app continua funcional apenas com armazenamento local. Para ativar contas e sincronizacao Supabase, segue [CLOUD_SETUP.md](./CLOUD_SETUP.md).

## Publicar no GitHub Pages

1. Cria um repositorio no GitHub chamado `nutritrack`.
2. Faz upload destes ficheiros para a raiz do repositorio.
3. Vai a `Settings` > `Pages`.
4. Em `Build and deployment`, escolhe `Deploy from a branch`.
5. Branch: `main`; folder: `/root`.
6. Guarda e abre o URL gerado.

Depois abre o URL no telemovel e escolhe `Adicionar ao ecra principal` / `Instalar app`.

## Privacidade

Sem configuracao cloud, os dados ficam apenas no `localStorage` do browser/dispositivo. Com Supabase ativo, perfil, refeicoes, agua, plano, peso, medidas e alimentos pessoais podem ser sincronizados. As fotos corporais continuam apenas no dispositivo.
