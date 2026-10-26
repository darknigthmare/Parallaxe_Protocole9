export type LevelId='hotel'|'metro'|'clinic';
export type GameMode='campaign'|'single';
export type Level={id:LevelId;name:string;subtitle:string;description:string;baseline:string[]};
export const LEVEL_ORDER:LevelId[]=['hotel','metro','clinic'];
export const LEVELS:Record<LevelId,Level>={
  hotel:{id:'hotel',name:'Saint-Clair',subtitle:'01 · L’hôtel sans neuvième étage',description:'Un hôtel désert sous la pluie. Des boiseries, des chambres closes et un service qui ne s’arrête jamais.',baseline:[
    'Les chambres 901, 902, 903 et 904 sont fermées. Le chariot et sa valise restent au sol.',
    'L’horloge indique 03:09 ; sa trotteuse avance dans le sens horaire. Les plantes sont vertes.',
    'Le tableau est rempli. Le miroir suit normalement votre silhouette, sans présence indépendante.',
    'Les fauteuils et le téléphone reposent sur leurs supports. Personne n’attend derrière la fenêtre.',
    'L’éclairage est chaud. Aucun regard au plafond, inscription ou traînée au sol.',
    'Le code du relais change normalement entre passages ; comparez-le entre inspecteurs dans le même passage.',
    'Le contrôle radio transmet trois tonalités distinctes : 1, 2, 3. Les pannes de connexion sont signalées séparément.',
  ]},
  metro:{id:'metro',name:'Terminus 09',subtitle:'02 · Le dernier quai',description:'Un quai souterrain désert, des panneaux lumineux et des rails qui continuent dans l’obscurité.',baseline:[
    'Le quai reste vide ; aucune rame ne traverse la zone condamnée.',
    'Le panneau indique QUAI 09 / SERVICE TERMINÉ. La signalisation ferroviaire demeure au vert.',
    'Les deux rails restent parallèles et au niveau du sol.',
    'La vitre réfléchissante reproduit votre silhouette sans retard ni mouvement indépendant.',
    'L’éclairage froid reste stable ; ni silhouette isolée, ni regard au plafond, ni trace au sol.',
    'Le code du relais peut changer entre passages, mais doit être identique pour tous dans le même passage.',
    'Le contrôle radio normal transmet 1, 2, 3. Une alerte technique ne compte pas comme anomalie du lieu.',
  ]},
  clinic:{id:'clinic',name:'Aile blanche',subtitle:'03 · La clinique de nuit',description:'Une unité de soins silencieuse. Des rideaux tirés, un moniteur et des équipements attendent des patients absents.',baseline:[
    'Le lit reste au sol. Aucun équipement ne flotte et personne n’est allongé dans le passage.',
    'Le moniteur affiche FC 072 / RYTHME SINUSAL et un tracé régulier.',
    'Le rideau reste à sa position de référence ; aucune silhouette ne le traverse.',
    'Le fauteuil roulant reste immobile à son emplacement de référence.',
    'Le miroir suit votre silhouette. Les couloirs sont dégagés, sans double ni présence au plafond.',
    'Le code de relais peut changer entre passages, mais doit être identique pour tous dans le même passage.',
    'L’étalonnage radio transmet 1, 2, 3. Comparez les transcriptions si le son n’est pas disponible.',
  ]},
};
Object.values(LEVELS).forEach(level=>level.baseline.push('La flèche et l’heure du panneau SYNCHRO peuvent changer entre passages, mais doivent être identiques pour tous les inspecteurs d’un même passage.'));
export function isLevelId(value:unknown):value is LevelId{return value==='hotel'||value==='metro'||value==='clinic';}
export function getLevel(value?:unknown):Level{return LEVELS[isLevelId(value)?value:'hotel'];}
