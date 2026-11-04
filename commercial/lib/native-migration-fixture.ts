/** Public, entirely invented export; never read from NutriTrack storage/accounts. */
export const migrationFixture = {
 app:'NutriTrack Pro',version:2,exportedAt:'2026-10-27T10:00:00Z',
 data:{nutritrackData:{meals:[
  {date:'2026-10-25',time:'08:30',type:'Pequeno-almoço',name:'Cereal fictício',quantity:75,calories:76,protein:1,carbs:17,fat:0},
  {date:'2026-10-25',time:'08:30',type:'Pequeno-almoço',name:'Cereal fictício',quantity:75,calories:76,protein:1,carbs:17,fat:0},
 ],templates:[{id:1,name:'Dia de exemplo',meals:[]}],bodyPhotos:[],profile:{name:'Pessoa fictícia',targetCalories:2000}},
 waterData:{'2026-10-25':3,'2026-10-26':0},weightLog:[{date:'2026-10-25',weight:80}],
 bodyMeasurements:[{date:'2026-10-25',weight:80,waist:90,hip:100,chest:null,arm:null,thigh:null}],
 customFoods:[{name:'Cereal fictício',cat:'Exemplo',source:'Pessoal',barcode:'',calories:101,protein:1,carbs:22,fat:0,serving:100,unit:'g'}],
 recentFoods:[],planDailyData:{'2026-10-25':{lunchComplete:true}},darkMode:false,
 fieldToReview:{note:'Campo desconhecido preservado no inventário'}},
};
