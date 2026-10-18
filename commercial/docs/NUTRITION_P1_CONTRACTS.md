# Nutrição P1 — composição V1

Base integrada: d5341ca4d8e366e77c4dd5a9d6a896628b8ca4e6 (PR #28), árvore idêntica à revista. CI 39161721346, lint, TypeScript, build, 73 testes domínio/PostgreSQL e 168 Chromium aprovados; auditoria npm sem vulnerabilidades.

`lib/nutrition-contract.ts` reutiliza `portionNutrients`, preservando a API existente. Composição por 100 g, energia em kcal, macros em g; apenas quantidades em gramas. Sem conversões implícitas. Versionamento e campos são estritos. Desconhecido é null; zero conhecido permanece zero. Totais incompletos mostram subtotal conhecido e contagem de valores ausentes. Diário vazio não prova consumo zero; composição completa não prova registo diário completo. Não se deduz energia a partir dos macros.

Limites técnicos: 1000 kcal/100 g, macros 100 g/100 g, quantidade positiva até 5000 g, até três casas decimais e 1000 porções por agregação. Não são recomendações de consumo. Não se exige igualdade energética 4/4/9 nem se interpreta adequação clínica.

Cálculo sempre sobre composição original: limites permitem recuperar numeradores inteiros de 1e-8 após o cálculo existente, somar com segurança e arredondar half-up a duas casas apenas no fim. Teste independente BigInt cobre 1000 combinações fracionárias; regressões incluem 100→50→100, 1.005, negativos, unidades, campos omitidos, desconhecidos e zero conhecido.

Sem endpoints, persistência ou contratos de escrita RPC. Identidade, revisões e autorização alimentar pertencem a futura P3, não autorizada. Nenhuma migration ou alteração Auth/RLS. Falha intermitente da ficha continua em observação. Bloqueios altos de passwords comprometidas, sessões/JWT, recuperação cloud, conta/MFA e RGPD mantidos. Sem dados reais ou piloto comercial.
