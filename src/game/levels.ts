export type LevelId='hotel'|'metro'|'clinic'|'cabin';
export type GameMode='campaign'|'single';
export type Level={id:LevelId;name:string;subtitle:string;description:string;baseline:string[]};
export const LEVEL_ORDER:LevelId[]=['hotel','metro','clinic'];
/** Optional locations never extend an existing campaign or change its save checkpoints. */
export const SELECTABLE_LEVELS:LevelId[]=[...LEVEL_ORDER,'cabin'];
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
  cabin:{id:'cabin',name:'Chalet de service',subtitle:'04 · Le module témoin',description:'Un chalet de bois assemblé dans un hangar silencieux. La table de contrôle, le foyer froid et les fenêtres donnent des repères à comparer.',baseline:[
    'La table possède quatre pieds et un plateau de 2,10 m sur 1,40 m, éloigné des deux murs. La tasse et le carnet reposent dessus.',
    'Le garde-corps délimite la même baie d’observation pour tous ; le passage le long du mur droit reste ouvert, même si la table paraît différente.',
    'Le foyer du mur droit est vide et éteint. Le fond du conduit ne comporte ni visage ni yeux ; observez-le depuis le bord du tapis.',
    'Le miroir reproduit votre corps. La fenêtre montre les fermes fixes du hangar, sans personne derrière la vitre.',
    'Les lampes diffusent une lumière chaude et stable. Les poutres et les lames du plancher restent à leur place.',
    'Le panneau SORTIE et le terminal sont au fond. Le code RELAIS peut varier entre passages mais doit être identique pour tous dans le même passage.',
    'L’étalonnage radio transmet 1, 2, 3 après le code RELAIS. Un problème de liaison ne constitue pas une anomalie du chalet.',
  ]},
};
LEVELS.hotel.baseline.push(
  'Bureau D2 près de l’entrée : chambre assignée 204 ou 205, dossier 09 VALIDÉ ou REFUSÉ, journal du 26 ou du 27 octobre 2026. Ces valeurs varient entre passages mais doivent concorder entre joueurs dans un même passage. E permet une lecture agrandie.',
  'Consigne C9 sur le mur droit : deux valises A et B, avec les étiquettes 09 et 18. Leur attribution peut changer entre passages ; comparez les mêmes côtés de la consigne.',
  'Poste 09 sur le mur gauche vers le fond : le sable descend, la vapeur de la tasse monte, une seule clé 09 est suspendue au râtelier.',
  'Réception R9 : le registre de 03:09 porte une ligne 09. Les noms peuvent varier entre passages, mais doivent concorder entre inspecteurs. Le compteur indique seulement les membres présents : 01 en solo ; le témoin fictif du registre ne compte pas.',
  'Consigne C9 : le gant peut normalement être gauche ou droit selon le passage. Comparez son pouce depuis le repère ICI, poignet vers vous : tous doivent voir la même main dans un même passage.',
  'Galerie G9 : la photographie du quai peut montrer pluie, neige ou soleil selon le passage, mais la météo doit concorder entre inspecteurs. La photographie d’équipe porte les trois signatures A. MOREL, E. VIAL et N. ROCHER.',
  'Le plan G9 montre 901 à gauche et 902 à droite près de l’entrée, puis 903 à gauche et 904 à droite vers la sortie. Le règlement R9 demande SIGNALEZ TOUTE ANOMALIE.',
  'Aucune racine ne sort sous les portes ; les murs restent secs, le joint de sortie immobile, et le miroir ne crée pas de porte supplémentaire.',
);
LEVELS.metro.baseline.push(
  'Le tableau ARCHIVES reste fixe : 01:09 T09 → OBSERVATOIRE et 01:12 T12 ← BELVÉDÈRE. Le plan relie BELVÉDÈRE, OBSERVATOIRE et TERMINUS 09, sans station intermédiaire.',
  'Le portique SCELLÉ affiche 0000, sans passage physique possible. Le tunnel ne laisse entrer ni ciel bleu ni soleil.',
);
LEVELS.clinic.baseline.push(
  'Le lit du couloir porte la plaque 09 ; celui de la salle vitrée porte 10. Aucun occupant ne se dessine dans l’ombre du lit vide.',
  'Les gouttes du dispositif de démonstration du pied de perfusion descendent dans le tube.',
);
Object.values(LEVELS).forEach(level=>level.baseline.push(
  'Les inspecteurs gardent leur badge, leur taille et leurs pieds au sol. Le talkie reste dans la main droite, même sans microphone. Les yeux sous la visière ne suivent pas indépendamment l’observateur.',
  'Le reflet adopte la même posture et porte le même numéro de badge que le corps réel. Le siège témoin reste vide.',
  'Sans coéquipier présent, les mannequins témoins numérotés T1 et T2 restent sur leurs socles près du miroir et apparaissent aussi dans le reflet. Ce sont des repères, pas des membres de l’équipe ; ils ne changent pas le compteur de présence.',
  'Le contrôle radio émet le code RELAIS en tonalités téléphoniques puis 1, 2, 3, un clic de clôture et le silence. Les deux canaux sont présents ; comparez le relevé écrit si nécessaire.',
));
Object.values(LEVELS).forEach(level=>level.baseline.push('La flèche et l’heure du panneau SYNCHRO peuvent changer entre passages, mais doivent être identiques pour tous les inspecteurs d’un même passage.'));
export function isLevelId(value:unknown):value is LevelId{return value==='hotel'||value==='metro'||value==='clinic'||value==='cabin';}
export function getLevel(value?:unknown):Level{return LEVELS[isLevelId(value)?value:'hotel'];}
