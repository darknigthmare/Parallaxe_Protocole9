/** Original field correspondence. No hidden case, seed, witness or network data enters this module. */
import {isLevelId,type LevelId,type GameMode} from './levels';

export type MissionNote=Readonly<{id:string;levelId:LevelId;title:string;source:string;paragraphs:readonly string[]}>;
export const FIELD_NOTES_KEY='parallaxe-field-notes';
export const FIELD_NOTES_FORMAT='parallaxe-field-notes-v1';
export const MISSION_NOTES:readonly MissionNote[]=[
  {id:'SC-01',levelId:'hotel',title:'La relève de Saint-Clair',source:'Copie de consigne · service de nuit',paragraphs:[
    'La réception n’attribue aucun neuvième étage. Pourtant, notre feuille de relève porte quatre numéros : 901, 902, 903 et 904. Nous les avons conservés pour que les équipes parlent des mêmes portes.',
    'Un collègue a décrit un tableau vide. Une autre y voyait encore un paysage. Leurs comptes rendus sont signés à la même heure. Aucun des deux n’a été corrigé : nous avons joint les deux pages.',
    'Avant de reprendre le service, faites votre propre passage de référence. Un vieux rapport décrit un ancien passage, jamais la réponse à votre inspection actuelle.'
  ]},
  {id:'T9-01',levelId:'metro',title:'Le quai après le dernier service',source:'Copie de consigne · régulation du terminus',paragraphs:[
    'Le service est terminé. Le panneau reste allumé pour les équipes de contrôle ; il ne promet pas qu’une rame viendra vous chercher.',
    'Les agents ont laissé leurs relevés dans l’ordre où ils les ont dictés. À la question « qu’as-tu vu ? », la première réponse était toujours une position sur le quai, puis une description. Nous avons gardé cette méthode.',
    'Comparez les signaux du même passage. Deux codes relevés à des heures différentes ne constituent pas un désaccord entre témoins.'
  ]},
  {id:'AB-01',levelId:'clinic',title:'Le registre sans patient',source:'Copie de consigne · transmission de l’aile de nuit',paragraphs:[
    'Le lit est prêt, le moniteur fonctionne et personne n’a été admis dans cette aile. Les équipements sont restés en place pour servir de référence aux inspecteurs.',
    'Une feuille porte la mention « témoin absent ». Elle ne concerne aucun patient : l’équipe avait quitté le poste avant que son dernier collègue ait fini de parler.',
    'Le contrôle demande désormais de vérifier la présence de chacun avant le diagnostic. Un silence sur la ligne appelle une vérification de liaison, pas un verdict sur le lieu.'
  ]},
  {id:'CH-01',levelId:'cabin',title:'La garde du chalet',source:'Copie de consigne · annexe isolée',paragraphs:[
    'La table a été dressée avant notre arrivée. Le feu et la fenêtre nous donnaient deux façons de nous assurer que nous regardions la même pièce.',
    'Cette annexe ne fait pas partie de la traversée des trois secteurs. Son contrôle recommence ici et s’achève ici : neuf validations consécutives, sans raccourci par un autre lieu.',
    'La neige empêche de distinguer ce qui se trouve au-delà du vitrage. Décrivez ce que montre votre référence ; ne complétez pas les zones invisibles avec le récit d’une autre garde.'
  ]},
  {id:'O9-01',levelId:'observatory',title:'La consigne des volets',source:'Copie de consigne · galerie terrestre O9',paragraphs:[
    'Le télescope n’a pas été déplacé. Les volets de la baie se commandent depuis la galerie ; leur mouvement appartient à toute l’équipe, même lorsque les témoignages sur le ciel divergent.',
    'Le premier relevé décrit un relief nocturne. Le personnel a refusé d’en faire une carte définitive : une fenêtre donne un point de vue, pas une garantie sur ce qui se trouve derrière.',
    'Attendez que les volets soient complètement ouverts avant de comparer. Une baie fermée ne donne aucune information sur l’horizon.'
  ]}
];
const noteById=new Map(MISSION_NOTES.map(note=>[note.id,note]));
export function missionNote(levelId:unknown):MissionNote|null {
  return isLevelId(levelId)?MISSION_NOTES.find(note=>note.levelId===levelId)??null:null;
}
/** Corrupted or foreign local data never unlocks unknown notes or anomalies. */
export function readFieldNotes(raw:unknown):string[]{
  if(typeof raw!=='string'||raw.length>4096)return [];
  try{
    const data=JSON.parse(raw);
    if(!data||Array.isArray(data)||data.format!==FIELD_NOTES_FORMAT||!Array.isArray(data.ids)||data.ids.length>5)return [];
    const ids=new Set(data.ids.filter((id:unknown)=>typeof id==='string'&&noteById.has(id)));
    return MISSION_NOTES.filter(note=>ids.has(note.id)).map(note=>note.id);
  }catch{return [];}
}
export function storedMissionNotes(ids:readonly string[]):MissionNote[]{
  return MISSION_NOTES.filter(note=>ids.includes(note.id));
}
export function keepMissionNote(storage:Pick<Storage,'getItem'|'setItem'>,levelId:unknown,phase:unknown):string[]{
  const note=missionNote(levelId);
  if(!note||(phase!=='reference'&&phase!=='inspect'))throw new Error('Ouvrez le carnet pendant un passage pour conserver sa consigne.');
  try{
    const ids=readFieldNotes(storage.getItem(FIELD_NOTES_KEY));
    const ordered=MISSION_NOTES.filter(n=>n.id===note.id||ids.includes(n.id)).map(n=>n.id);
    storage.setItem(FIELD_NOTES_KEY,JSON.stringify({format:FIELD_NOTES_FORMAT,ids:ordered}));
    return ordered;
  }catch{throw new Error('Note non conservée : le stockage de cet appareil est indisponible. Le texte reste lisible.');}
}

export type DebriefInput=Readonly<{phase:string;mode:GameMode;levelId:LevelId;strikes:number;loop:number;streak:number;correctTotal:number;stage:number}>;
export type MissionDebrief=Readonly<{epilogue:'concordance'|null;id:string;heading:string;paragraphs:readonly string[];route:string;validated:number;attempts:number;errors:number}>;
const exitLines:Record<LevelId,string>={
  hotel:'La réception garde une copie de votre dernier relevé. Pour cette traversée de Saint-Clair, les neuf diagnostics sont certifiés.',
  metro:'Le dernier compte rendu rejoint le registre de régulation. Votre sortie ne dépendait pas de l’arrivée d’un train, mais des neuf diagnostics du terminus.',
  clinic:'Le registre de l’aile blanche est refermé. Aucun patient n’a été ajouté à la liste ; seules vos neuf validations y figurent.',
  cabin:'Vous laissez la table comme vous l’avez trouvée. Le contrôle de cette annexe est terminé : neuf validations, toutes obtenues au chalet.',
  observatory:'Le dernier relevé est classé avec les précédents. Les volets ne désignent pas la vérité : les neuf diagnostics de la galerie sont maintenant certifiés.'
};
/** Only already-public terminal counters select the text. No inferred trust score or secret ending. */
export function missionDebrief(input:DebriefInput):MissionDebrief|null{
  if(input.phase!=='won'&&input.phase!=='lost')return null;
  if(!isLevelId(input.levelId)||(input.mode!=='campaign'&&input.mode!=='single'))return null;
  if([input.strikes,input.loop,input.streak,input.correctTotal,input.stage].some(n=>!Number.isSafeInteger(n)||n<0||n>100000))return null;
  const won=input.phase==='won';
  const route=input.mode==='campaign'?'Saint-Clair → Terminus 09 → Aile blanche':({hotel:'Saint-Clair',metro:'Terminus 09',clinic:'Aile blanche',cabin:'Chalet',observatory:'Observatoire 09'}[input.levelId]);
  const heading=won?'Transmission de sortie':'Transmission de relève';
  const first=won?(input.mode==='campaign'?'Saint-Clair, Terminus 09, Aile blanche : les trois secteurs sont certifiés. Les pages ne racontent pas toutes le même lieu ; elles portent pourtant neuf diagnostics communs.':exitLines[input.levelId])
    :input.mode==='campaign'?`La tolérance du protocole est épuisée. ${input.stage} secteur${input.stage>1?'s':''} avai${input.stage>1?'ent':'t'} été certifié${input.stage>1?'s':''} avant cette interruption. Une nouvelle partie commencera une nouvelle traversée.`:'La série de cette annexe est interrompue. Une nouvelle partie repartira de la référence et de zéro validation.';
  const second=won?(input.strikes===0?'Aucun diagnostic erroné n’a été enregistré. Ce bilan atteste vos réponses, pas une mesure de confiance entre les personnes.':input.mode==='campaign'?'Le registre conserve aussi les erreurs et les reprises. Elles n’annulent pas les secteurs déjà certifiés ; elles expliquent le chemin suivi jusqu’à la sortie.':'Le registre conserve les erreurs et les séries recommencées. La série finale de neuf validations a été obtenue dans cette seule annexe.')
    :'Le contrôle n’attribue pas cet échec à un témoin. Des perceptions différentes ne rendent aucun inspecteur coupable ; comparez de nouveau avant de conclure.';
  const epilogue=won&&input.mode==='campaign'&&input.strikes===0?'concordance':null;
  return {epilogue,id:`${input.mode}-${input.levelId}-${won?(input.strikes===0?'clear':'recovered'):'interrupted'}`,heading,route,
    paragraphs:[first,second,'Les anomalies déjà découvertes et les consignes que vous avez conservées restent consultables dans les Archives, sur cet appareil.'],
    validated:input.correctTotal,attempts:input.loop,errors:input.strikes};
}
