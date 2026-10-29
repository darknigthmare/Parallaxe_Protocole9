import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import type { Reflector } from 'three/addons/objects/Reflector.js';
import type { InspectionReading } from './inspection-data';

export const CABIN_EFFECTS = ['cabine_table_size', 'cabine_chimney_face'] as const;
type ReflectionFactory = (width: number, height: number, tint?: number, opacity?: number) => Reflector;
type Target = { id: string; label: string };

/**
 * Original timber service module in a closed inspection hangar.
 * The exhibition rail defines one shared collision envelope: a perceived change
 * in table size never changes where another inspector may stand or blocks an exit.
 */
export function createCabinWorld(reflection: ReflectionFactory) {
  const root = new THREE.Group(); root.name = 'Chalet de service — module témoin';
  const targets: THREE.Object3D[] = [];
  const colliders: { x: number; z: number; rx: number; rz: number; effect?: string }[] = [];
  const reflectors: Reflector[] = [];
  const lights: { light: THREE.PointLight; intensity: number; color: THREE.Color }[] = [];
  const textures = new Set<THREE.Texture>();
  const ownedMaterials = new Set<THREE.Material>();
  let effects = new Set<string>(), relayValue = '0909', disposed = false;

  function material(parameters: THREE.MeshStandardMaterialParameters) {
    const value = new THREE.MeshStandardMaterial(parameters); ownedMaterials.add(value); return value;
  }
  const mats = {
    timber: material({ color: 0x956e44, roughness: .86 }),
    alternate: material({ color: 0x83603b, roughness: .91 }),
    endgrain: material({ color: 0x5d422c, roughness: .89 }),
    floor: material({ color: 0x70593c, roughness: .75 }),
    pale: material({ color: 0xc8b48b, roughness: .84 }),
    dark: material({ color: 0x182221, roughness: .87 }),
    iron: material({ color: 0x4b5552, metalness: .68, roughness: .48 }),
    brass: material({ color: 0xa58f59, metalness: .65, roughness: .42 }),
    green: material({ color: 0x30544b, roughness: .62 }),
    stone: material({ color: 0x746e62, roughness: .98 }),
    mortar: material({ color: 0x3c3b36, roughness: 1 }),
    cloth: material({ color: 0x666b50, roughness: .98 }),
    ceramic: material({ color: 0xc8c9b1, roughness: .26 }),
    paper: material({ color: 0xccc7a6, roughness: .95 }),
    glow: material({ color: 0xe0cc9b, emissive: 0xffd19b, emissiveIntensity: 1.25, roughness: .4 }),
  };
  function part(geometry: THREE.BufferGeometry, mat: THREE.Material, parent: THREE.Object3D = root) {
    const mesh = new THREE.Mesh(geometry, mat); mesh.castShadow = true; mesh.receiveShadow = true; parent.add(mesh); return mesh;
  }
  function box(w: number, h: number, d: number, x: number, y: number, z: number, mat: THREE.Material, parent: THREE.Object3D = root, radius = 0) {
    const geometry = radius ? new RoundedBoxGeometry(w, h, d, 2, Math.min(radius, w / 3, h / 3, d / 3)) : new THREE.BoxGeometry(w, h, d);
    const mesh = part(geometry, mat, parent); mesh.position.set(x, y, z); return mesh;
  }
  function cylinder(radius: number, height: number, x: number, y: number, z: number, mat: THREE.Material, parent: THREE.Object3D = root, segments = 20) {
    const mesh = part(new THREE.CylinderGeometry(radius, radius, height, segments), mat, parent); mesh.position.set(x, y, z); return mesh;
  }
  function ellipsoid(rx: number, ry: number, rz: number, x: number, y: number, z: number, mat: THREE.Material, parent: THREE.Object3D) {
    const mesh = part(new THREE.SphereGeometry(1, 24, 16), mat, parent); mesh.scale.set(rx, ry, rz); mesh.position.set(x, y, z); return mesh;
  }
  function tag(object: THREE.Object3D, id: string, label: string) { object.userData.inspect = { id, label }; targets.push(object); return object; }
  function textMap(lines: string[], background = '#19332d', foreground = '#d8d2ad') {
    const canvas = document.createElement('canvas'); canvas.width = 1024; canvas.height = 512;
    const ctx = canvas.getContext('2d')!; ctx.fillStyle = background; ctx.fillRect(0, 0, 1024, 512);
    ctx.strokeStyle = '#a6986c'; ctx.lineWidth = 5; ctx.strokeRect(16, 16, 992, 480);
    ctx.fillStyle = foreground; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    lines.forEach((line, index) => {
      ctx.font = `${/^\d{4}$/.test(line) ? 170 : line.length > 28 ? 36 : line.length > 18 ? 44 : 64}px monospace`;
      ctx.fillText(line, 512, 512 * (index + .5) / lines.length);
    });
    const map = new THREE.CanvasTexture(canvas); map.colorSpace = THREE.SRGBColorSpace; textures.add(map); return map;
  }
  function panel(w: number, h: number, x: number, y: number, z: number, map: THREE.Texture, parent: THREE.Object3D, glow = .18) {
    const mat = material({ map, emissiveMap: map, emissive: 0xffffff, emissiveIntensity: glow, roughness: .66 });
    const mesh = part(new THREE.PlaneGeometry(w, h), mat, parent); mesh.position.set(x, y, z); mesh.userData.keepSeparate = true; return mesh;
  }
  function wall(side: number, z: number) { const group = new THREE.Group(); group.position.set(side * 3.62, 0, z); group.rotation.y = -side * Math.PI / 2; root.add(group); return group; }
  function obstacle(x: number, z: number, rx: number, rz: number) { colliders.push({ x, z, rx, rz }); }
  function lamp(x: number, y: number, z: number, intensity = 13, color = 0xffd0a2, distance = 8) {
    const light = new THREE.PointLight(color, intensity, distance, 2); light.position.set(x, y, z); root.add(light);
    lights.push({ light, intensity, color: light.color.clone() }); return light;
  }

  // Floorboards, structural posts and roof beams are original metrically scaled geometry.
  box(7.65, .20, 28.4, 0, -.12, -2, mats.endgrain);
  for (let x = -3.57, column = 0; x < 3.7; x += .34, column++) {
    for (let z = -15.7, row = 0; z < 12; z += 3.08, row++) {
      box(.327, .035, Math.min(3.05, 12.05 - z), x, -.005, z + Math.min(3.05, 12.05 - z) / 2, (column + row) % 3 ? mats.floor : mats.alternate);
    }
  }
  const targetMat = new THREE.MeshBasicMaterial({ visible: false }); ownedMaterials.add(targetMat);
  tag(box(7.1, .008, 27.6, 0, .019, -2, targetMat), 'floor', 'Plancher du chalet');
  tag(box(7.1, .025, 27.6, 0, 3.42, -2, targetMat), 'ceiling', 'Poutres du chalet');
  for (const side of [-1, 1]) {
    // A real opening leaves the hangar visible beyond the west window.
    for (let y = .16, row = 0; y < 3.55; y += .26, row++) {
      const mat = row % 3 ? mats.timber : mats.alternate;
      if (side < 0 && y > 1.04 && y < 3.03) {
        box(.18, .247, 23.25, side * 3.82, y, .475, mat);
        box(.18, .247, 2.55, side * 3.82, y, -14.725, mat);
      } else box(.18, .247, 28.35, side * 3.82, y, -2, mat);
    }
    for (const z of [-15.85, -10.7, -5.6, -.5, 4.7, 10, 12.02]) box(.23, 3.46, .22, side * 3.62, 1.73, z, mats.endgrain);
    box(.18, .18, 28.1, side * 3.63, .09, -2, mats.endgrain);
  }
  for (const z of [-16, 12.12]) {
    box(7.65, 3.60, .18, 0, 1.80, z, mats.timber);
    for (let x = -3.55; x <= 3.6; x += .41) box(.018, 3.48, .035, x, 1.74, z + (z < 0 ? .11 : -.11), mats.endgrain);
  }
  box(7.6, .12, 28.3, 0, 3.55, -2, mats.endgrain);
  for (const z of [-14.8, -9.7, -4.6, .5, 5.6, 10.7]) {
    box(7.35, .19, .22, 0, 3.35, z, mats.alternate);
    for (const side of [-1, 1]) { const brace = box(.13, .86, .15, side * 3.35, 2.98, z, mats.endgrain); brace.rotation.z = side * -.72; }
  }
  for (const z of [8.45, 2.15, -4.9, -11.6]) {
    cylinder(.13, .045, 0, 3.20, z, mats.iron);
    cylinder(.018, .25, 0, 3.065, z, mats.brass);
    cylinder(.22, .07, 0, 2.90, z, mats.iron);
    const globe = ellipsoid(.14, .18, .14, 0, 2.76, z, mats.glow, root); globe.castShadow = false;
    lamp(0, 2.70, z, 16);
  }

  // Entry service fittings keep the two common reflection witnesses unobstructed.
  const entry = wall(1, 8.50);
  box(2.0, 1.14, .48, 0, .57, .29, mats.green, entry, .035);
  box(2.10, .075, .57, 0, 1.18, .31, mats.pale, entry, .02);
  for (const x of [-.5, .5]) {
    box(.92, .83, .025, x, .64, .55, mats.timber, entry, .01);
    box(.14, .03, .04, x, .98, .58, mats.brass, entry, .01);
  }
  panel(1.65, .21, 0, 1.53, .12, textMap(['CHALET DE SERVICE / MODULE 09']), entry);
  obstacle(3.30, 8.50, .40, 1.12);
  const relay = new THREE.Group(); relay.position.set(2.72, 1.46, 7.15); root.add(relay);
  box(.68, .45, .09, 0, 0, 0, mats.iron, relay, .025);
  const relayScreen = panel(.59, .36, 0, 0, .051, textMap(['RELAIS', relayValue]), relay, .65);
  tag(relay, 'radio', 'Relais du chalet — comparez le code');
  cylinder(.018, .30, .21, .37, 0, mats.brass, relay);
  const cloak = wall(-1, 7.0);
  box(1.5, .21, .10, 0, 1.74, .10, mats.endgrain, cloak);
  for (const x of [-.52, 0, .52]) {
    cylinder(.022, .16, x, 1.68, .22, mats.brass, cloak, 12);
    const hook = part(new THREE.TorusGeometry(.055, .012, 8, 16, Math.PI), mats.brass, cloak); hook.rotation.x = Math.PI / 2; hook.position.set(x, 1.62, .25);
  }
  box(1.60, .08, .49, 0, .46, .32, mats.pale, cloak, .025);
  for (const x of [-.62, .62]) box(.07, .43, .37, x, .215, .32, mats.endgrain, cloak);
  tag(cloak, 'chair', 'Banc du vestiaire'); obstacle(-3.26, 7.0, .39, .86);

  const mirrorFrame = wall(1, 3.75);
  box(1.38, 2.70, .11, 0, 1.65, .025, mats.endgrain, mirrorFrame, .025);
  box(1.27, 2.59, .04, 0, 1.65, .09, mats.brass, mirrorFrame, .01);
  const mirror = reflection(1.18, 2.50, 0x96988b, 1); mirror.position.set(0, 1.65, .12); mirrorFrame.add(mirror); reflectors.push(mirror);
  tag(mirrorFrame, 'mirror', 'Miroir de contrôle du chalet');
  const windowFrame = wall(-1, -12.25);
  const window = reflection(2.12, 1.84, 0x8d9f98, .30); window.position.set(0, 2.03, .10); windowFrame.add(window); reflectors.push(window);
  for (const x of [-1.11, 0, 1.11]) box(.065, 2.06, .15, x, 2.03, .14, mats.pale, windowFrame);
  for (const y of [1.02, 2.03, 3.04]) box(2.28, .075, .15, 0, y, .14, mats.pale, windowFrame);
  box(2.46, .10, .34, 0, .99, .14, mats.endgrain, windowFrame);
  tag(windowFrame, 'window', 'Fenêtre sur le hangar');
  // Visible exterior is enclosed scenery, beyond the unchanged walk boundary.
  box(.12, 4.35, 3.25, -6.55, 2.08, -12.25, mats.dark);
  box(2.75, .10, 3.25, -5.16, -.12, -12.25, mats.iron);
  for (const z of [-13.85, -10.65]) {
    box(2.85, 4.35, .12, -5.16, 2.08, z, mats.dark);
    box(.09, 3.70, .12, -6.15, 1.85, z + (z < -12 ? .2 : -.2), mats.iron);
  }
  for (const z of [-13.1, -11.4]) {
    const brace = box(.08, 3.3, .10, -6.05, 1.9, z, mats.iron); brace.rotation.x = z < -12 ? .43 : -.43;
  }
  lamp(-5.2, 3.2, -12.25, 6, 0x99b4b9, 5);

  // Inspectable table: the common rail reserves its maximum extent in every view.
  const table = new THREE.Group(); table.name = 'Table du chalet'; table.position.set(0, 0, -2); root.add(table);
  box(2.10, .10, 1.40, 0, .81, 0, mats.pale, table, .035);
  for (const x of [-.84, .84]) for (const z of [-.52, .52]) box(.10, .76, .10, x, .38, z, mats.endgrain, table, .01);
  for (const z of [-.52, .52]) box(1.78, .14, .055, 0, .69, z, mats.timber, table);
  for (const x of [-.84, .84]) box(.055, .13, 1.04, x, .69, 0, mats.timber, table);
  tag(table, 'table', 'Table du chalet — tasse et carnet');
  const tabletopProps = new THREE.Group(); tabletopProps.position.set(0, .86, -2); root.add(tabletopProps);
  const cup = new THREE.Group(); cup.name = 'Tasse du chalet'; cup.position.set(-.32, 0, .16); tabletopProps.add(cup);
  cylinder(.076, .15, 0, .075, 0, mats.ceramic, cup, 32);
  cylinder(.063, .008, 0, .154, 0, mats.dark, cup, 32);
  const cupHandle = part(new THREE.TorusGeometry(.055, .012, 8, 24), mats.ceramic, cup); cupHandle.position.set(.077, .085, 0);
  cylinder(.12, .013, 0, .007, 0, mats.ceramic, cup, 32);
  const notebook = new THREE.Group(); notebook.name = 'Carnet du chalet'; notebook.position.set(.44, .014, -.12); notebook.rotation.y = -.18; tabletopProps.add(notebook);
  box(.35, .023, .46, 0, 0, 0, mats.green, notebook, .008);
  box(.32, .017, .43, .004, .018, 0, mats.paper, notebook, .004);
  const notebookLabel = panel(.27, .34, 0, .029, 0, textMap(['MODULE 09', 'RELEVÉ', 'DE SERVICE'], '#ccc7a6', '#293c32'), notebook, 0); notebookLabel.rotation.x = -Math.PI / 2;
  const pencil = cylinder(.005, .28, .28, .025, -.08, mats.brass, tabletopProps, 8); pencil.rotation.z = Math.PI / 2;
  tag(tabletopProps, 'table', 'Tasse et carnet sur la table');
  const rail = new THREE.Group(); rail.name = 'Garde-corps de la baie témoin'; root.add(rail);
  for (const z of [-3.20, -.80]) {
    box(5.09, .055, .055, -1.165, .94, z, mats.iron, rail);
    box(5.09, .035, .035, -1.165, .45, z, mats.iron, rail);
    for (const x of [-3.65, -2.4, -1.15, .1, 1.38]) cylinder(.023, .94, x, .47, z, mats.brass, rail, 12);
  }
  for (const y of [.45, .94]) box(.055, .045, 2.40, 1.38, y, -2, mats.iron, rail);
  cylinder(.023, .94, 1.38, .47, -2, mats.brass, rail, 12);
  panel(1.24, .22, -.25, .97, -.765, textMap(['BAIE TÉMOIN / NE PAS FRANCHIR']), rail, .08);
  obstacle(-1.16, -2, 2.58, 1.23);
  // Stitched runner marks the permanent route without narrowing its collider.
  box(1.32, .014, 6.6, 2.48, .027, -2, mats.cloth);
  for (const x of [1.88, 3.08]) box(.019, .004, 6.4, x, .037, -2, mats.pale);

  // Cold stone fireplace. The face exists solely in the affected personal view.
  const fireplace = wall(1, -8.50); fireplace.name = 'Foyer froid';
  box(2.37, .12, .94, 0, .06, .49, mats.stone, fireplace);
  box(1.55, 1.34, .055, 0, .78, .10, mats.dark, fireplace);
  for (const side of [-1, 1]) {
    box(.36, 1.44, .74, side * .91, .78, .47, mats.mortar, fireplace);
    for (let row = 0; row < 6; row++) {
      box(.39, .22, .77, side * .91, .23 + row * .235, .47, row % 2 ? mats.stone : mats.pale, fireplace, .018);
      box(.014, .024, .79, side * .91, .35 + row * .235, .47, mats.mortar, fireplace);
    }
  }
  box(2.29, .23, .83, 0, 1.61, .48, mats.stone, fireplace, .02);
  box(2.44, .13, .94, 0, 1.79, .48, mats.endgrain, fireplace, .035);
  box(1.37, 1.52, .49, 0, 2.57, .31, mats.mortar, fireplace);
  for (let row = 0; row < 6; row++) box(1.40, .225, .52, 0, 1.94 + row * .25, .31, mats.stone, fireplace, .014);
  const fireTools = new THREE.Group(); fireTools.position.set(1.38, 0, .42); fireplace.add(fireTools);
  cylinder(.10, .035, 0, .02, 0, mats.iron, fireTools);
  cylinder(.012, .84, 0, .44, 0, mats.iron, fireTools, 12);
  for (const x of [-.065, .065]) { cylinder(.009, .70, x, .42, .035, mats.iron, fireTools, 10); box(.055, .08, .012, x, .075, .035, mats.iron, fireTools); }
  const face = new THREE.Group(); face.name = 'Visage au fond du conduit'; face.position.set(0, .88, .18); fireplace.add(face);
  const faceMat = material({ color: 0x9a967f, roughness: .94 });
  ellipsoid(.255, .37, .095, 0, 0, 0, faceMat, face);
  for (const side of [-1, 1]) {
    ellipsoid(.078, .055, .032, side * .10, .085, .074, mats.dark, face);
    ellipsoid(.029, .025, .018, side * .10, .086, .10, mats.pale, face);
    const brow = box(.14, .028, .045, side * .10, .148, .073, faceMat, face, .01); brow.rotation.z = side * -.16;
  }
  ellipsoid(.037, .084, .065, 0, -.035, .079, faceMat, face);
  ellipsoid(.082, .016, .018, 0, -.18, .075, mats.dark, face);
  face.visible = false; tag(fireplace, 'fireplace', 'Foyer du chalet — conduit froid');
  obstacle(3.18, -8.50, .52, 1.27);
  const hearthRug = box(1.55, .014, 2.65, 1.70, .025, -8.50, mats.cloth);
  hearthRug.name = 'Tapis devant le foyer';
  for (const z of [-9.76, -7.24]) box(1.45, .004, .035, 1.70, .035, z, mats.pale);
  lamp(2.20, 2.40, -8.50, 8, 0xd5c7a5, 4);
  // No flame, wood pile or smoke occupies the normal cold hearth.

  const exit = new THREE.Group(); exit.position.set(0, 0, -15.74); root.add(exit);
  box(2.17, 2.96, .18, 0, 1.48, 0, mats.endgrain, exit);
  for (const side of [-1, 1]) {
    box(.98, 2.76, .08, side * .50, 1.39, .13, mats.green, exit, .02);
    box(.63, .76, .025, side * .50, 1.91, .18, mats.dark, exit);
    box(.055, .39, .07, side * .17, 1.10, .21, mats.brass, exit, .01);
  }
  const exitNormal = textMap(['SORTIE', '↑ 09']), exitWrong = textMap(['AUCUNE SORTIE', 'RETOURNEZ-VOUS'], '#492724', '#f4c7ac');
  const exitSign = panel(1.44, .36, 0, 3.13, .12, exitNormal, exit, .80); tag(exit, 'exit', 'Issue du chalet');
  const terminal = new THREE.Group(); terminal.position.set(0, 0, -12.90); root.add(terminal);
  box(.64, .08, .52, 0, .04, 0, mats.iron, terminal, .025);
  box(.14, .96, .16, 0, .54, 0, mats.green, terminal, .015);
  const terminalHead = new THREE.Group(); terminalHead.position.set(0, 1.08, .03); terminalHead.rotation.x = -.40; terminal.add(terminalHead);
  box(.72, .46, .06, 0, 0, 0, mats.iron, terminalHead, .025);
  panel(.64, .36, 0, 0, .034, textMap(['PROTOCOLE 09', 'DIAGNOSTIC']), terminalHead, .65);
  tag(terminal, 'exit', 'Terminal de diagnostic — E'); obstacle(0, -12.90, .42, .32);
  const entryDoor = new THREE.Group(); entryDoor.position.set(0, 0, 11.94); entryDoor.rotation.y = Math.PI; root.add(entryDoor);
  box(2.12, 2.91, .15, 0, 1.46, 0, mats.endgrain, entryDoor);
  box(1.90, 2.72, .08, 0, 1.37, .12, mats.green, entryDoor, .025);
  panel(1.32, .22, 0, 3.09, .03, textMap(['MODULE 09 / SERVICE']), entryDoor);
  lamp(0, 2.75, -14.6, 12, 0xa4c4b1, 5);

  // Batch within semantic roots: table scaling, the face and target ownership remain intact.
  const groups: THREE.Group[] = []; root.traverse(object => { if ((object as THREE.Group).isGroup) groups.push(object as THREE.Group); });
  for (const group of groups.reverse()) {
    const batches = new Map<THREE.Material, THREE.Mesh[]>();
    for (const child of [...group.children]) {
      const mesh = child as THREE.Mesh;
      if (!mesh.isMesh || (mesh as Reflector).isReflector || mesh.userData.inspect || mesh.userData.keepSeparate || Array.isArray(mesh.material)) continue;
      const batch = batches.get(mesh.material) || []; batch.push(mesh); batches.set(mesh.material, batch);
    }
    for (const [mat, batch] of batches) if (batch.length > 2) {
      const copies = batch.map(mesh => {
        mesh.updateMatrix(); let geometry = mesh.geometry.clone();
        if (geometry.index) { const flat = geometry.toNonIndexed(); geometry.dispose(); geometry = flat; }
        return geometry.applyMatrix4(mesh.matrix);
      });
      const combined = mergeGeometries(copies); copies.forEach(geometry => geometry.dispose());
      if (combined) { part(combined, mat, group); batch.forEach(mesh => { group.remove(mesh); mesh.geometry.dispose(); }); }
    }
  }

  function setView(nextEffects: Set<string>, code = '0909') {
    if (disposed) return;
    effects = new Set(nextEffects);
    const expanded = effects.has('cabine_table_size');
    table.scale.x = expanded ? 4.70 / 2.10 : 1;
    table.position.x = expanded ? -1.30 : 0;
    // The right edge remains at +1.05 m; no collision or prop position changes.
    face.visible = effects.has('cabine_chimney_face');
    for (const item of lights) {
      item.light.intensity = item.intensity * (effects.has('blackout') ? .015 : 1);
      item.light.color.copy(item.color); if (effects.has('red_light')) item.light.color.set(0xe92c1e);
    }
    mats.glow.emissive.set(effects.has('red_light') ? 0xf72c1f : 0xffd19b);
    mats.glow.emissiveIntensity = effects.has('blackout') ? .015 : 1.25;
    const exitMat = exitSign.material as THREE.MeshStandardMaterial;
    exitMat.map = effects.has('exit_false') ? exitWrong : exitNormal; exitMat.emissiveMap = exitMat.map;
    const nextCode = typeof code === 'string' && /^\d{4}$/.test(code) ? code : '0909';
    if (nextCode !== relayValue) {
      relayValue = nextCode;
      const mat = relayScreen.material as THREE.MeshStandardMaterial, old = mat.map;
      mat.map = textMap(['RELAIS', relayValue]); mat.emissiveMap = mat.map;
      if (old) { textures.delete(old); old.dispose(); }
    }
  }
  function getReading(target?: Target | null): InspectionReading | null {
    if (!target) return null;
    if (target.id === 'table') return {
      title: 'Table du chalet', location: target.label,
      lines: [effects.has('cabine_table_size') ? 'Le plateau rejoint le mur gauche ; son bord droit reste près du garde-corps.' : 'Un espace sépare chaque extrémité du plateau des murs.', 'Quatre pieds portent le plateau.', 'Une tasse et un carnet reposent sur la table.'],
    };
    if (target.id === 'fireplace') return {
      title: 'Fond du conduit', location: target.label,
      lines: ['Le foyer est éteint.', effects.has('cabine_chimney_face') ? 'Un visage immobile et deux yeux se dessinent au fond du conduit.' : 'Le fond du conduit est vide.'],
    };
    if (target.id === 'radio' && target.label === 'Relais du chalet — comparez le code') return { title: 'Relais du chalet', location: target.label, lines: ['RELAIS', relayValue] };
    return null;
  }
  function update(_time: number) { /* Stable evidence: neither cabin clue depends on a brief frame or a timer. */ }
  function dispose() {
    if (disposed) return; disposed = true;
    const geometries = new Set<THREE.BufferGeometry>();
    root.traverse(object => {
      const mesh = object as THREE.Mesh; if (mesh.geometry) geometries.add(mesh.geometry);
      if (mesh.material) (Array.isArray(mesh.material) ? mesh.material : [mesh.material]).forEach(mat => ownedMaterials.add(mat));
    });
    geometries.forEach(geometry => geometry.dispose()); ownedMaterials.forEach(mat => mat.dispose()); textures.forEach(map => map.dispose());
    reflectors.forEach(reflector => reflector.getRenderTarget().dispose());
  }
  setView(new Set());
  return { id: 'cabin' as const, root, targets, colliders, reflectors, lights, setView, update, getReading, dispose };
}
