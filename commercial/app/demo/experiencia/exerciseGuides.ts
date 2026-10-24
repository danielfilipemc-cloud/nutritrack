import type {ExerciseId} from './training';

// Original explanatory demo copy, not personalised prescription or substitutions.
export const exerciseGuides:Record<ExerciseId,{setup:string;steps:string[];variant:string}>={
 squat:{setup:'Banco estável, com espaço livre à frente e aos lados.',steps:['Posiciona-te de pé à frente do banco.','Aproxima o corpo do banco num movimento controlado.','Regressa à posição inicial para completar o exemplo.'],variant:'Exemplo para discutir com o profissional: alterar a altura do banco.'},
 row:{setup:'Elástico e ponto de fixação apropriado, previamente verificados.',steps:['Começa com os braços à frente.','Aproxima as mãos do tronco.','Regressa de forma controlada à posição inicial.'],variant:'Exemplo para discutir com o profissional: usar outro nível de resistência.'},
 wall:{setup:'Parede livre e superfície de apoio sem obstáculos.',steps:['Coloca as mãos na parede.','Aproxima o tronco da parede.','Afasta o tronco para regressar ao início.'],variant:'Exemplo para discutir com o profissional: ajustar a distância à parede.'},
 step:{setup:'Degrau estável e zona de chegada desimpedida.',steps:['Coloca um pé no degrau.','Transfere o apoio para subir.','Regressa ao chão de forma controlada.'],variant:'Exemplo para discutir com o profissional: alterar a altura do degrau.'},
 calf:{setup:'Superfície plana e apoio estável disponível.',steps:['Começa com os calcanhares apoiados.','Eleva os calcanhares.','Volta a apoiá-los de forma controlada.'],variant:'Exemplo para discutir com o profissional: executar sentado.'},
 march:{setup:'Espaço livre, sem necessidade de equipamento.',steps:['Começa de pé no espaço disponível.','Eleva alternadamente um pé e depois o outro.','Mantém a alternância durante o tempo definido no exemplo.'],variant:'Exemplo para discutir com o profissional: marcha com apoio.'},
};
