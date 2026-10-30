import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';

import { inspectionValues, normalizeInspectionRoster, type InspectionMember, type InspectionReading, type InspectionView } from './inspection-data';
export { INSPECTION_EFFECTS, INSPECTION_TARGETS, inspectionValues, normalizeInspectionRoster, type InspectionMember, type InspectionReading, type InspectionView } from './inspection-data';

/** Original detailed inspection furniture for Saint-Clair; no network state or answer is stored here. */
export function createInspectionProps() {
  const root = new THREE.Group(); root.name = 'Saint-Clair — postes de comparaison';
  const targets: THREE.Object3D[] = [];
  const colliders = [
    { x: -3.23, z: 9.25, rx: .42, rz: .94 },
    { x: 3.18, z: 1.9, rx: .44, rz: .93 },
    { x: -3.23, z: -7.2, rx: .42, rz: .93 },
    { x: 3.50, z: 9.20, rx: .18, rz: .74 },
    { x: -3.50, z: 6.95, rx: .18, rz: .89 },
  ];
  const geometries = new Set<THREE.BufferGeometry>();
  const materials = new Set<THREE.Material>();
  const textures = new Map<string, THREE.CanvasTexture>();
  let disposed = false;
  let values = inspectionValues({ phase: 'reference' });
  let lastView: InspectionView = { phase: 'reference', levelId: 'hotel' };
  let roster = normalizeInspectionRoster();
  let rosterKey = JSON.stringify(roster);
  const readings = new Map<string, InspectionReading>();

  function material(parameters: THREE.MeshStandardMaterialParameters) {
    const result = new THREE.MeshStandardMaterial(parameters); materials.add(result); return result;
  }
  const wood = material({ color: 0x382c24, roughness: .54 });
  const oak = material({ color: 0x79593c, roughness: .59 });
  const brass = material({ color: 0xbda16b, metalness: .8, roughness: .27 });
  const iron = material({ color: 0x172423, metalness: .68, roughness: .46 });
  const paper = material({ color: 0xe6d9b9, roughness: .92 });
  const sand = material({ color: 0xe0b16c, roughness: .82, emissive: 0x37220c, emissiveIntensity: .18 });
  const glass = material({ color: 0xc5d9ce, transparent: true, opacity: .17, roughness: .14, metalness: .1, depthWrite: false, side: THREE.DoubleSide });
  const ceramic = material({ color: 0xe0d4bc, roughness: .24 });
  const coffee = material({ color: 0x2c160c, roughness: .27 });

  function mesh(geometry: THREE.BufferGeometry, mat: THREE.Material, parent: THREE.Object3D, name?: string) {
    geometries.add(geometry);
    const result = new THREE.Mesh(geometry, mat); result.castShadow = true; result.receiveShadow = true;
    if (name) result.name = name;
    parent.add(result); return result;
  }
  function box(parent: THREE.Object3D, dimensions: [number, number, number], position: [number, number, number], mat = wood, radius = .015) {
    // Flat diagram marks and tiny seams gain nothing from hundreds of bevel triangles.
    const geometry = radius >= .01 && Math.min(...dimensions) > .025
      ? new RoundedBoxGeometry(...dimensions, 3, Math.min(radius, ...dimensions.map(n => n / 4)))
      : new THREE.BoxGeometry(...dimensions);
    const result = mesh(geometry, mat, parent);
    result.position.set(...position); return result;
  }
  function cylinder(parent: THREE.Object3D, top: number, bottom: number, height: number, position: [number, number, number], mat = brass, segments = 32) {
    const result = mesh(new THREE.CylinderGeometry(top, bottom, height, segments, 2), mat, parent);
    result.position.set(...position); return result;
  }
  function torus(parent: THREE.Object3D, radius: number, thickness: number, position: [number, number, number], mat = brass) {
    const result = mesh(new THREE.TorusGeometry(radius, thickness, 12, 36), mat, parent);
    result.position.set(...position); return result;
  }
  function map(lines: string[], tone: 'dark' | 'paper' = 'dark') {
    const key = tone + lines.join('\n');
    const old = textures.get(key); if (old) return old;
    const canvas = document.createElement('canvas'); canvas.width = 768; canvas.height = 512;
    const ctx = canvas.getContext('2d')!;
    ctx.fillStyle = tone === 'dark' ? '#152e2b' : '#e6d9b9'; ctx.fillRect(0, 0, 768, 512);
    ctx.strokeStyle = tone === 'dark' ? '#a68c59' : '#5b4a37'; ctx.lineWidth = 5; ctx.strokeRect(22, 22, 724, 468);
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    lines.forEach((text, index) => {
      ctx.fillStyle = tone === 'dark' ? '#f1e4bd' : '#242f29';
      ctx.font = `${index === 0 ? '500' : '700'} ${text.length > 25 ? 28 : text.length > 18 ? 33 : text.length > 11 ? 41 : 55}px sans-serif`;
      ctx.fillText(text, 384, lines.length === 1 ? 256 : 88 + index * 332 / (lines.length - 1), 686);
    });
    const texture = new THREE.CanvasTexture(canvas); texture.colorSpace = THREE.SRGBColorSpace;
    textures.set(key, texture); return texture;
  }
  function label(parent: THREE.Object3D, w: number, h: number, position: [number, number, number], lines: string[], tone: 'dark' | 'paper' = 'dark') {
    const texture = map(lines, tone);
    const mat = material({ map: texture, emissiveMap: texture, emissive: 0xffffff, emissiveIntensity: .16, roughness: .78 });
    const result = mesh(new THREE.PlaneGeometry(w, h), mat, parent);
    result.castShadow = false; result.position.set(...position);
    result.userData.text = lines.join('\n'); return result;
  }
  function relabel(plane: THREE.Mesh, lines: string[], tone: 'dark' | 'paper' = 'dark') {
    const text = lines.join('\n'); if (plane.userData.text === text) return;
    const mat = plane.material as THREE.MeshStandardMaterial;
    mat.map = mat.emissiveMap = map(lines, tone); plane.userData.text = text;
  }
  function inspect(object: THREE.Object3D, id: string, title: string) {
    object.userData.inspect = { id, label: title }; targets.push(object);
  }
  function wallStation(x: number, z: number, rotation: number, name: string) {
    const group = new THREE.Group(); group.name = name; group.position.set(x, 0, z); group.rotation.y = rotation; root.add(group);
    return group;
  }
  function cabinet(group: THREE.Group) {
    box(group, [1.68, .82, .54], [0, .55, 0]);
    box(group, [1.82, .08, .65], [0, 1.0, .025], oak, .025);
    for (const x of [-.72, .72]) for (const z of [-.20, .22]) cylinder(group, .034, .045, .2, [x, .1, z], iron);
    for (const x of [-.42, .42]) {
      box(group, [.72, .65, .025], [x, .56, .28], oak);
      box(group, [.2, .035, .06], [x, .72, .312], brass, .009);
    }
  }

  const bureau = wallStation(-3.35, 9.25, Math.PI / 2, 'Bureau de contrôle D2');
  cabinet(bureau);
  box(bureau, [1.82, 1.04, .06], [0, 1.77, -.18], wood);
  label(bureau, 1.65, .2, [0, 2.34, -.135], ['BUREAU DE CONTRÔLE D2']);
  const assignment = label(bureau, .77, .47, [-.43, 1.92, -.135], ['DOSSIER D2', 'CHAMBRE ASSIGNÉE', '204']);
  const stamp = label(bureau, .77, .47, [.43, 1.92, -.135], ['DOSSIER 09', 'DÉCISION', 'VALIDÉ'], 'paper');
  inspect(assignment, 'assignment', 'Dossier D2 — chambre assignée'); inspect(stamp, 'document', 'Dossier 09 — décision locale');
  const newspaper = new THREE.Group(); newspaper.position.set(0, 1.08, .10); newspaper.rotation.x = -.9; bureau.add(newspaper);
  box(newspaper, [1.38, .66, .018], [0, 0, 0], paper, .004);
  const edition = label(newspaper, 1.34, .62, [0, 0, .012], ['LE COURRIER DE SAINT-CLAIR', '26 OCTOBRE 2026', 'LE SERVICE CONTINUE'], 'paper');
  inspect(newspaper, 'newspaper', 'Journal — édition de Saint-Clair');

  const consigne = wallStation(3.25, 1.9, -Math.PI / 2, 'Consigne de comparaison C9');
  box(consigne, [1.76, .14, .70], [0, .16, .04], iron);
  box(consigne, [1.73, 1.64, .055], [0, 1.03, -.26], wood);
  label(consigne, 1.64, .26, [0, 1.98, -.22], ['CONSIGNE C9', 'A — GAUCHE / B — DROITE']);
  const bagLeather = material({ color: 0x8d5637, roughness: .69 });
  const bagGreen = material({ color: 0x405b50, roughness: .84 });
  function bag(x: number, round: boolean) {
    const group = new THREE.Group(); group.position.set(x, .28, .05); consigne.add(group);
    box(group, [.64, .83, .40], [0, .42, 0], round ? bagGreen : bagLeather, round ? .11 : .035);
    for (const strapX of [-.2, .2]) box(group, [.034, .78, .018], [strapX, .42, .21], iron, .005);
    for (const y of [.08, .75]) box(group, [.59, .025, .025], [0, y, .217], brass, .005);
    const handle = torus(group, .10, .016, [0, .87, .02], iron); handle.scale.y = .6;
    for (const wheelX of [-.22, .22]) { const wheel = cylinder(group, .047, .047, .034, [wheelX, -.01, 0], iron, 24); wheel.rotation.x = Math.PI / 2; }
    const tag = label(group, .23, .22, [0, .62, .227], ['09'], 'paper');
    return { group, tag };
  }
  const bagA = bag(-.42, false), bagB = bag(.42, true);
  relabel(bagB.tag, ['18'], 'paper');
  label(consigne, .34, .14, [-.42, .035, .40], ['A']); label(consigne, .34, .14, [.42, .035, .40], ['B']);
  inspect(consigne, 'luggage', 'Consigne C9 — étiquettes A et B');

  const witnesses = wallStation(-3.35, -7.2, Math.PI / 2, 'Objets témoins — gravité et clés');
  cabinet(witnesses);
  label(witnesses, 1.70, .22, [0, 2.35, -.12], ['OBJETS TÉMOINS — POSTE 09']);
  const hourglass = new THREE.Group(); hourglass.position.set(-.48, 1.04, .04); witnesses.add(hourglass);
  hourglass.name = 'Sablier de démonstration';
  for (const y of [.025, .62]) cylinder(hourglass, .18, .18, .05, [0, y, 0], brass, 48);
  for (const angle of [0, Math.PI * 2 / 3, Math.PI * 4 / 3]) cylinder(hourglass, .012, .012, .57, [Math.sin(angle) * .16, .32, Math.cos(angle) * .16], brass, 16);
  const profile = [[.112, .052], [.139, .10], [.125, .17], [.07, .25], [.014, .317], [.07, .39], [.125, .46], [.139, .54], [.112, .59]].map(([x, y]) => new THREE.Vector2(x, y));
  mesh(new THREE.LatheGeometry(profile, 64), glass, hourglass, 'Verre du sablier');
  cylinder(hourglass, .01, .106, .07, [0, .095, 0], sand, 40);
  cylinder(hourglass, .106, .01, .07, [0, .545, 0], sand, 40);
  const grains: THREE.Mesh[] = [];
  const grainGeometry = new THREE.SphereGeometry(.009, 10, 8);
  for (let i = 0; i < 14; i++) {
    const grain = mesh(grainGeometry, sand, hourglass, `Grain témoin ${i}`);
    grain.position.set(Math.sin(i * 2.4) * .006, .3, Math.cos(i * 2.4) * .006); grains.push(grain);
  }
  inspect(hourglass, 'hourglass', 'Sablier — sens du déplacement');

  const cup = new THREE.Group(); cup.name = 'Tasse et vapeur'; cup.position.set(.40, 1.045, .22); witnesses.add(cup);
  const cupProfile = [[0, 0], [.08, 0], [.10, .025], [.113, .17], [.106, .18], [.099, .165], [.085, .035], [0, .03]].map(([x, y]) => new THREE.Vector2(x, y));
  mesh(new THREE.LatheGeometry(cupProfile, 64), ceramic, cup);
  cylinder(cup, .145, .145, .018, [0, .006, 0], ceramic, 48);
  cylinder(cup, .096, .096, .005, [0, .152, 0], coffee, 48);
  const handle = torus(cup, .065, .017, [.115, .10, 0], ceramic); handle.scale.x = .8;
  const steam: THREE.Mesh[] = [];
  const steamGeometry = new THREE.SphereGeometry(.033, 16, 12);
  for (let i = 0; i < 9; i++) {
    const mat = material({ color: 0xd9e9df, emissive: 0x71867c, emissiveIntensity: .2, transparent: true, opacity: .24, depthWrite: false, roughness: 1 });
    const puff = mesh(steamGeometry, mat, cup, `Vapeur témoin ${i}`); puff.castShadow = false; puff.receiveShadow = false; steam.push(puff);
  }
  inspect(cup, 'cup', 'Tasse — trajectoire de la vapeur');
  label(witnesses, .70, .16, [-.48, .87, .365], ['SABLIER']); label(witnesses, .70, .16, [.40, .87, .365], ['TASSE']);

  const rack = new THREE.Group(); rack.name = 'Râtelier des clés'; rack.position.set(0, 1.93, -.16); witnesses.add(rack);
  box(rack, [1.4, .44, .08], [0, 0, 0], oak);
  for (const x of [-.46, 0, .46]) {
    const hook = torus(rack, .036, .009, [x, .11, .08]); hook.rotation.x = .8;
  }
  function key(x: number) {
    const group = new THREE.Group(); group.position.set(x, .07, .10); rack.add(group);
    torus(group, .049, .012, [0, 0, 0]);
    box(group, [.022, .15, .022], [0, -.11, 0], brass, .003);
    for (const y of [-.14, -.18]) box(group, [.055, .021, .022], [.018, y, 0], brass, .003);
    label(group, .13, .095, [0, .073, .02], ['09'], 'paper'); return group;
  }
  key(-.46); const duplicate = key(.46); duplicate.visible = false; duplicate.name = 'Deuxième clé 09';
  inspect(rack, 'keys', 'Râtelier — clés 09');

  // The reception archive occupies the wall above the end of the counter; its shared wall clearance remains fixed.
  const records = wallStation(3.48, 9.20, -Math.PI / 2, 'Archives de réception R9');
  box(records, [1.43, 1.46, .055], [0, 1.91, 0], wood);
  label(records, 1.40, .18, [0, 2.78, .034], ['ARCHIVES DE RÉCEPTION R9']);
  const ledger = new THREE.Group(); ledger.name = 'Registre des arrivées'; records.add(ledger); ledger.position.set(0, 2.23, .05);
  box(ledger, [1.23, .54, .03], [0, 0, 0], paper, .006);
  box(ledger, [.015, .49, .018], [0, 0, .024], brass, .002);
  const ledgerPage = label(ledger, 1.17, .48, [0, 0, .037], ['ARRIVÉE 03:09', 'LIGNE 09', 'ALPHA — Inspecteur'], 'paper');
  inspect(ledger, 'guestbook', 'Registre R9 — dernière arrivée');
  box(records, [.61, .51, .09], [-.36, 1.55, .04], iron);
  const tally = label(records, .55, .43, [-.36, 1.55, .091], ['PRÉSENTS', '01']);
  tally.name = 'Afficheur des occupants'; inspect(tally, 'occupancy', 'Afficheur R9 — occupants présents');
  const regulations = label(records, .63, .47, [.34, 1.55, .036], ['RÈGLEMENT 09', 'SIGNALEZ TOUTE', 'ANOMALIE'], 'paper');
  regulations.name = 'Règlement affiché'; inspect(regulations, 'regulations', 'Panneau du règlement de Saint-Clair');

  // A glove has four separate fingers, a cuff and a thumb. Its mirror changes handedness, not camera-relative labels.
  const gloveTray = new THREE.Group(); gloveTray.name = 'Présentation du gant C9'; consigne.add(gloveTray); gloveTray.position.set(0, 1.53, .47);
  box(gloveTray, [.73, .65, .055], [0, 0, 0], oak);
  const glove = new THREE.Group(); glove.name = 'Gant témoin C9'; gloveTray.add(glove); glove.position.set(0, -.01, .05);
  const gloveLeather = material({ color: 0xc3b081, roughness: .9 });
  box(glove, [.22, .24, .044], [0, 0, 0], gloveLeather, .025);
  box(glove, [.205, .06, .055], [0, -.14, 0], gloveLeather, .015);
  for (let index = 0; index < 4; index++) {
    const length = [.12, .17, .19, .15][index];
    box(glove, [.044, length, .041], [-.078 + index * .052, .105 + length / 2, 0], gloveLeather, .018);
    box(glove, [.009, length * .66, .005], [-.078 + index * .052, .12 + length / 2, .023], brass, .002);
  }
  const thumb = box(glove, [.053, .145, .046], [-.145, .015, 0], gloveLeather, .02); thumb.rotation.z = -.65;
  thumb.name = 'Pouce du gant';
  label(gloveTray, .67, .095, [0, -.255, .034], ['POIGNET VERS VOUS']);
  inspect(gloveTray, 'glove', 'Gant C9 — observer depuis le repère');
  const stance = label(consigne, .70, .26, [0, .012, .94], ['ICI — FACE AU GANT']); stance.rotation.x = -Math.PI / 2;

  // Three original photographs share a common quay silhouette. Rain, snow and sun are geometry, not a colour-only cue.
  const gallery = wallStation(-3.48, 6.95, Math.PI / 2, 'Galerie de comparaison G9');
  box(gallery, [1.72, 1.87, .05], [0, 1.82, 0], wood);
  label(gallery, 1.67, .18, [0, 2.88, .031], ['GALERIE G9 — QUAI / ÉQUIPE / PLAN']);
  const weatherFrame = new THREE.Group(); weatherFrame.name = 'Photographie du quai'; weatherFrame.position.set(-.43, 2.22, .05); gallery.add(weatherFrame);
  box(weatherFrame, [.78, .66, .06], [0, 0, 0], brass);
  const sky = material({ color: 0x435d69, roughness: .92 });
  const stone = material({ color: 0xa3a89f, roughness: .87 });
  const snowMaterial = material({ color: 0xf2f4e7, roughness: .96, emissive: 0x303c38, emissiveIntensity: .25 });
  const rainMaterial = material({ color: 0xadd5df, roughness: .58, emissive: 0x45636e, emissiveIntensity: .25 });
  const sunMaterial = material({ color: 0xf1c66b, roughness: .7, emissive: 0x8b5516, emissiveIntensity: .35 });
  box(weatherFrame, [.71, .57, .008], [0, 0, .035], sky, .002);
  box(weatherFrame, [.70, .095, .014], [0, -.19, .048], stone, .002);
  for (const y of [-.22, -.24]) box(weatherFrame, [.69, .008, .015], [0, y, .060], iron, .002);
  for (const x of [-.22, .22]) {
    box(weatherFrame, [.014, .20, .012], [x, -.02, .055], iron, .002);
    box(weatherFrame, [.12, .025, .012], [x, .085, .055], iron, .002);
  }
  const weatherGroups: Record<string, THREE.Group> = {};
  for (const kind of ['PLUIE', 'NEIGE', 'SOLEIL']) {
    const group = new THREE.Group(); group.name = `Météo du quai — ${kind}`; weatherFrame.add(group); weatherGroups[kind] = group;
  }
  for (let index = 0; index < 18; index++) {
    const drop = box(weatherGroups.PLUIE, [.007, .038, .007], [-.31 + (index % 6) * .12, .22 - Math.floor(index / 6) * .12, .073], rainMaterial, .002);
    drop.rotation.z = -.28;
  }
  const umbrellaShape = new THREE.Shape(); umbrellaShape.moveTo(-.083, 0); umbrellaShape.absarc(0, 0, .083, Math.PI, 0, true); umbrellaShape.lineTo(-.083, 0);
  const umbrella = mesh(new THREE.ShapeGeometry(umbrellaShape, 24), iron, weatherGroups.PLUIE, 'Parapluie du quai'); umbrella.position.set(-.07, -.04, .08);
  box(weatherGroups.PLUIE, [.009, .12, .008], [-.07, -.09, .08], iron, .002);
  box(weatherGroups.NEIGE, [.70, .025, .012], [0, -.131, .07], snowMaterial, .002);
  for (let index = 0; index < 8; index++) for (const angle of [0, Math.PI / 3, -Math.PI / 3]) {
    const flake = box(weatherGroups.NEIGE, [.006, .047, .007], [-.28 + (index % 4) * .18, .20 - Math.floor(index / 4) * .19, .075], snowMaterial, .001);
    flake.rotation.z = angle;
  }
  const sun = mesh(new THREE.CircleGeometry(.061, 32), sunMaterial, weatherGroups.SOLEIL, 'Soleil du quai'); sun.position.set(.10, .10, .075);
  for (let index = 0; index < 8; index++) {
    const angle = index * Math.PI / 4;
    const ray = box(weatherGroups.SOLEIL, [.008, .035, .006], [.10 + Math.sin(angle) * .092, .10 + Math.cos(angle) * .092, .075], sunMaterial, .002); ray.rotation.z = -angle;
  }
  inspect(weatherFrame, 'weather-photo', 'Photographie G9 — météo sur le quai');

  const teamFrame = new THREE.Group(); teamFrame.name = 'Photographie de l’équipe de service'; teamFrame.position.set(.43, 2.22, .05); gallery.add(teamFrame);
  box(teamFrame, [.78, .66, .06], [0, 0, 0], brass);
  box(teamFrame, [.71, .57, .008], [0, 0, .035], paper, .002);
  const photoFigures: THREE.Group[] = [];
  for (let index = 0; index < 4; index++) {
    const figure = new THREE.Group(); figure.name = `Silhouette photographiée ${index + 1}`; figure.position.set((index - 1.5) * .15, .055, .052); teamFrame.add(figure);
    const head = mesh(new THREE.CircleGeometry(.035, 24), iron, figure); head.position.y = .09;
    box(figure, [.10, .12, .008], [0, -.005, 0], iron, .02); photoFigures.push(figure);
  }
  const teamCaption = label(teamFrame, .68, .20, [0, -.18, .057], ['ÉQUIPE DU SERVICE DE NUIT', 'A. MOREL / E. VIAL / N. ROCHER'], 'paper');
  inspect(teamFrame, 'team-photo', 'Photographie G9 — équipe du service de nuit');

  const floorMap = new THREE.Group(); floorMap.name = 'Plan original des quatre chambres'; floorMap.position.set(0, 1.31, .06); gallery.add(floorMap);
  box(floorMap, [1.55, .71, .045], [0, 0, 0], paper, .008);
  box(floorMap, [.075, .48, .008], [0, -.015, .026], iron, .002);
  label(floorMap, .54, .095, [0, .27, .030], ['ISSUE 09'], 'paper');
  label(floorMap, .54, .095, [0, -.29, .030], ['ENTRÉE'], 'paper');
  const mapRooms = new Map<string, THREE.Group>();
  for (const [code, x, y] of [['901', -.46, -.14], ['902', .46, -.14], ['903', -.46, .12], ['904', .46, .12]] as const) {
    const group = new THREE.Group(); group.name = `Chambre ${code} sur le plan`; group.position.set(x, y, .029); floorMap.add(group);
    box(group, [.34, .19, .012], [0, 0, 0], oak, .006);
    box(group, [.27, .014, .012], [-Math.sign(x) * .29, 0, 0], iron, .002);
    label(group, .30, .14, [0, 0, .009], [code], 'paper'); mapRooms.set(code, group);
  }
  inspect(floorMap, 'floor-map', 'Plan G9 — chambres du passage');

  function setView(view: InspectionView) {
    if (disposed) return;
    lastView = { ...view, effects: [...(view.effects ?? [])] };
    root.visible = !view.levelId || view.levelId === 'hotel';
    values = inspectionValues({ ...view, roster });
    relabel(assignment, ['DOSSIER D2', 'CHAMBRE ASSIGNÉE', values.room]);
    relabel(stamp, ['DOSSIER 09', 'DÉCISION', values.stamp], 'paper');
    relabel(edition, ['LE COURRIER DE SAINT-CLAIR', values.edition, 'LE SERVICE CONTINUE'], 'paper');
    relabel(bagA.tag, [values.tagA], 'paper'); relabel(bagB.tag, [values.tagB], 'paper');
    duplicate.visible = values.keyCount === 2;
    relabel(ledgerPage, ['ARRIVÉE 03:09', 'LIGNE 09', values.guestbookEntry], 'paper');
    relabel(tally, ['PRÉSENTS', String(values.occupancy).padStart(2, '0')]);
    relabel(regulations, ['RÈGLEMENT 09', ...(values.regulation === 'SIGNALEZ TOUTE ANOMALIE' ? ['SIGNALEZ TOUTE', 'ANOMALIE'] : ['NE SIGNALEZ', 'AUCUNE ANOMALIE'])], 'paper');
    glove.scale.x = values.hand === 'GAUCHE' ? 1 : -1;
    for (const [kind, group] of Object.entries(weatherGroups)) group.visible = kind === values.photoWeather;
    relabel(teamCaption, ['ÉQUIPE DU SERVICE DE NUIT', ...values.teamCaption.split(' / ')], 'paper');
    photoFigures.forEach((figure, index) => { figure.visible = index < values.teamCount; figure.position.x = (index - (values.teamCount - 1) / 2) * .15; });
    for (const [code, room] of mapRooms) room.visible = values.mapRooms.split(',').includes(code);
    readings.set('assignment', { title: 'Dossier de chambre', location: 'Bureau de contrôle D2 · près de l’entrée', lines: ['DOSSIER D2', `CHAMBRE ASSIGNÉE : ${values.room}`] });
    readings.set('document', { title: 'Décision du dossier', location: 'Bureau de contrôle D2 · près de l’entrée', lines: ['DOSSIER 09', `TAMPON : ${values.stamp}`, 'Cette décision concerne uniquement le dossier exposé.'] });
    readings.set('newspaper', { title: 'Le Courrier de Saint-Clair', location: 'Bureau de contrôle D2 · près de l’entrée', lines: [`ÉDITION DU ${values.edition}`, 'LE SERVICE CONTINUE'] });
    readings.set('luggage', { title: 'Consigne C9', location: 'Mur droit · entre la porte 902 et le miroir', lines: [`CÔTÉ A — valise rectangulaire : ${values.tagA}`, `CÔTÉ B — valise arrondie : ${values.tagB}`] });
    readings.set('hourglass', { title: 'Sablier du poste 09', location: 'Objets témoins · mur gauche vers le fond', lines: [values.sandDirection > 0 ? 'Les grains visibles se déplacent vers le haut.' : 'Les grains visibles se déplacent vers le bas.'] });
    readings.set('cup', { title: 'Tasse du poste 09', location: 'Objets témoins · mur gauche vers le fond', lines: [values.steamDirection > 0 ? 'La vapeur monte au-dessus de la tasse.' : 'La vapeur descend devant le meuble, sous la tasse.'] });
    readings.set('keys', { title: 'Râtelier du poste 09', location: 'Au-dessus des objets témoins', lines: [`${values.keyCount} CLÉ${values.keyCount > 1 ? 'S' : ''} PORTANT LE NUMÉRO 09`] });
    readings.set('guestbook', { title: 'Registre des arrivées R9', location: 'Mur droit · archives près de la réception', lines: ['ARRIVÉE 03:09 — LIGNE 09', values.guestbookEntry] });
    readings.set('occupancy', { title: 'Afficheur des occupants R9', location: 'Mur droit · sous le registre', lines: [`PRÉSENTS : ${String(values.occupancy).padStart(2, '0')}`] });
    readings.set('regulations', { title: 'Règlement affiché R9', location: 'Mur droit · sous le registre', lines: ['RÈGLEMENT DE SAINT-CLAIR — ARTICLE 09', values.regulation] });
    readings.set('glove', { title: 'Gant témoin C9', location: 'Consigne C9 · face au repère ICI, poignet vers vous', lines: [`GANT ${values.hand}`, values.hand === 'GAUCHE' ? 'Depuis le repère, le pouce est du côté gauche du plateau.' : 'Depuis le repère, le pouce est du côté droit du plateau.'] });
    const weatherDescription = values.photoWeather === 'PLUIE' ? 'Des traits de pluie et un parapluie ouvert sont visibles sur le quai.' : values.photoWeather === 'NEIGE' ? 'Des flocons et une couche blanche sont visibles sur le quai.' : 'Un disque solaire et ses rayons sont visibles au-dessus du quai, sans précipitation.';
    readings.set('weather-photo', { title: 'Photographie du quai G9', location: 'Galerie G9 · mur gauche, après le bureau D2', lines: [weatherDescription] });
    readings.set('team-photo', { title: 'Photographie de l’équipe G9', location: 'Galerie G9 · cadre de droite', lines: ['ÉQUIPE DU SERVICE DE NUIT', `${values.teamCount} SILHOUETTE${values.teamCount > 1 ? 'S' : ''}`, ...values.teamCaption.split(' / ')] });
    readings.set('floor-map', { title: 'Plan du passage G9', location: 'Galerie G9 · sous les photographies', lines: ['ENTRÉE EN BAS — ISSUE 09 EN HAUT', 'PRÈS DE L’ENTRÉE : 901 À GAUCHE / 902 À DROITE', values.mapRooms.includes('903') ? 'VERS L’ISSUE : 903 À GAUCHE / 904 À DROITE' : 'VERS L’ISSUE : CASE GAUCHE VIDE / 904 À DROITE'] });
  }
  function update(elapsed: number) {
    if (disposed) return;
    const time = Number.isFinite(elapsed) ? Math.max(0, elapsed) : 0;
    grains.forEach((grain, index) => {
      const t = (time * .34 + index / grains.length) % 1;
      grain.position.y = values.sandDirection > 0 ? .12 + t * .40 : .52 - t * .40;
    });
    steam.forEach((puff, index) => {
      const t = (time * .21 + index / steam.length) % 1;
      puff.position.set(Math.sin(t * 5 + time * .4) * .055, .19 + values.steamDirection * t * .72, .10 + t * .18);
      puff.scale.set(1 + t * 1.3, 1.35 + t * 2, 1 + t);
      (puff.material as THREE.MeshStandardMaterial).opacity = Math.sin(t * Math.PI) * .27;
    });
  }
  setView({ phase: 'reference', levelId: 'hotel' }); update(0);
  return {
    root, targets, colliders, setView, update,
    setRoster(members: InspectionMember[]) {
      if (disposed) return;
      const next = normalizeInspectionRoster(members), key = JSON.stringify(next);
      if (key === rosterKey) return;
      roster = next; rosterKey = key; setView(lastView);
      // Retain the small set of ordinary variants but release obsolete names after long-lived sessions.
      if (textures.size > 80) {
        const inUse = new Set([...materials].flatMap(mat => {
          const m = mat as THREE.MeshStandardMaterial; return [m.map, m.emissiveMap].filter(Boolean);
        }));
        for (const [name, texture] of textures) if (!inUse.has(texture)) { texture.dispose(); textures.delete(name); }
      }
    },
    getReading(id?: string): InspectionReading | null {
      if (disposed || !root.visible || !id) return null;
      const entry = readings.get(id); return entry ? { ...entry, lines: [...entry.lines] } : null;
    },
    dispose() {
      if (disposed) return; disposed = true;
      geometries.forEach(g => g.dispose()); materials.forEach(m => m.dispose()); textures.forEach(t => t.dispose());
      root.clear(); readings.clear();
    },
  };
}
