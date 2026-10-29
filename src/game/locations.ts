import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
import { Reflector } from 'three/addons/objects/Reflector.js';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { createLocationClues } from './location-clues';
import { createCabinWorld } from './cabin';

export type ExtraLocationId = 'metro' | 'clinic' | 'cabin';
export type WorldObstacle = { x: number; z: number; rx: number; rz: number; effect?: string };

export function reflectiveGlass(width: number, height: number, tint = 0x87999b, opacity = .38) {
  const shaderSource = (Reflector as typeof Reflector & { ReflectorShader: { name: string; uniforms: Record<string, THREE.IUniform>; vertexShader: string; fragmentShader: string } }).ReflectorShader;
  const shader = { ...shaderSource, fragmentShader: shaderSource.fragmentShader.replace('gl_FragColor = vec4( blendOverlay( base.rgb, color ), 1.0 );', `gl_FragColor = vec4( blendOverlay( base.rgb, color ), ${opacity.toFixed(2)} );`) };
  const glass = new Reflector(new THREE.PlaneGeometry(width, height), { color: tint, textureWidth: 256, textureHeight: 384, clipBias: .004, multisample: 0, shader });
  const mat = glass.material as THREE.ShaderMaterial; mat.transparent = opacity < 1; mat.depthWrite = opacity >= 1;
  glass.renderOrder = opacity < 1 ? 4 : 0;
  return glass;
}

/** Separate original level meshes; these are not recolours of the hotel. */
export function createLocation(id: ExtraLocationId) {
  if (id === 'cabin') return createCabinWorld(reflectiveGlass);
  const root = new THREE.Group(); root.name = id === 'metro' ? 'Terminus 09 — métro désaffecté' : 'Aile blanche — clinique de nuit';
  const targets: THREE.Object3D[] = [];
  const colliders: WorldObstacle[] = [];
  const reflectors: Reflector[] = [];
  const lights: { light: THREE.PointLight; intensity: number; color: THREE.Color }[] = [];
  const textures: THREE.Texture[] = [];
  let effects = new Set<string>();
  let relayValue = '0909';
  let disposed = false;
  const ownMaterials: THREE.Material[] = [];
  function material(config: THREE.MeshStandardMaterialParameters) { const m = new THREE.MeshStandardMaterial(config); ownMaterials.push(m); return m; }
  const mats = {
    wall: material({ color: id === 'metro' ? 0x9ca9a1 : 0xd1d9d2, roughness: .85 }),
    floor: material({ color: id === 'metro' ? 0x505653 : 0x90aaa1, roughness: id === 'metro' ? .83 : .32 }),
    black: material({ color: 0x101b1d, roughness: .6 }),
    steel: material({ color: 0x889da0, metalness: .8, roughness: .29 }),
    enamel: material({ color: id === 'metro' ? 0x284748 : 0x4e7f7b, roughness: .37, metalness: .15 }),
    white: material({ color: 0xe1e1cc, roughness: .83 }),
    yellow: material({ color: 0xccb56c, roughness: .75 }),
    glow: material({ color: 0xdae6d5, emissive: 0xbad6cb, emissiveIntensity: 1.5 }),
    soft: material({ color: 0x829d96, roughness: .98, side: THREE.DoubleSide }),
  };
  function part(geo: THREE.BufferGeometry, mat: THREE.Material, parent: THREE.Object3D = root) { const m = new THREE.Mesh(geo, mat); m.castShadow = true; m.receiveShadow = true; parent.add(m); return m; }
  function box(w: number, h: number, d: number, x: number, y: number, z: number, mat: THREE.Material = mats.wall, parent: THREE.Object3D = root, r = 0) {
    const geo = r ? new RoundedBoxGeometry(w, h, d, 3, Math.min(r, w / 3, h / 3, d / 3)) : new THREE.BoxGeometry(w, h, d);
    const m = part(geo, mat, parent); m.position.set(x, y, z); return m;
  }
  function cylinder(r: number, h: number, x: number, y: number, z: number, mat: THREE.Material = mats.steel, parent: THREE.Object3D = root, segments = 32) {
    const m = part(new THREE.CylinderGeometry(r, r, h, segments, 2), mat, parent); m.position.set(x, y, z); return m;
  }
  function sphere(r: number, x: number, y: number, z: number, mat: THREE.Material, parent: THREE.Object3D = root) { const m = part(new THREE.SphereGeometry(r, 32, 20), mat, parent); m.position.set(x, y, z); return m; }
  function torus(r: number, tube: number, x: number, y: number, z: number, mat: THREE.Material, parent: THREE.Object3D = root) { const m = part(new THREE.TorusGeometry(r, tube, 12, 64), mat, parent); m.position.set(x, y, z); return m; }
  function tag(object: THREE.Object3D, target: string, label: string) { object.userData.inspect = { id: target, label }; targets.push(object); return object; }
  function texture(lines: string[], background = '#14292b', foreground = '#b9d6bc') {
    const canvas = document.createElement('canvas'); canvas.width = 512; canvas.height = 256;
    const ctx = canvas.getContext('2d')!; ctx.fillStyle = background; ctx.fillRect(0, 0, 512, 256); ctx.fillStyle = foreground; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    lines.forEach((line, i) => { ctx.font = `${lines.length === 2 && i === 1 && /^\d{4}$/.test(line) ? 100 : line.length > 20 ? 25 : 39}px monospace`; ctx.fillText(line, 256, 128 + (i - (lines.length - 1) / 2) * 83); });
    const map = new THREE.CanvasTexture(canvas); map.colorSpace = THREE.SRGBColorSpace; textures.push(map); return map;
  }
  function panel(w: number, h: number, x: number, y: number, z: number, map: THREE.Texture, parent: THREE.Object3D = root, emissive = .18) {
    const mat = material({ map, emissiveMap: map, emissive: 0xffffff, emissiveIntensity: emissive, roughness: .66 });
    const m = part(new THREE.PlaneGeometry(w, h), mat, parent); m.position.set(x, y, z); return m;
  }
  function wallGroup(side: number, z: number, y = 0) { const g = new THREE.Group(); g.position.set(side * 3.62, y, z); g.rotation.y = -side * Math.PI / 2; root.add(g); return g; }
  function lamp(x: number, y: number, z: number, intensity = 16, color = 0xb7d7d3, distance = 9) {
    const light = new THREE.PointLight(color, intensity, distance, 2); light.position.set(x, y, z); root.add(light); lights.push({ light, intensity, color: light.color.clone() }); return light;
  }
  function obstacle(x: number, z: number, rx: number, rz: number, effect?: string) { colliders.push({ x, z, rx, rz, effect }); }
  function silhouette(parent: THREE.Object3D) {
    const g = new THREE.Group(); parent.add(g);
    const dark = material({ color: 0x081314, roughness: .95 });
    const torso = sphere(.26, 0, 1.02, 0, dark, g); torso.scale.set(.82, 1.65, .55);
    const head = sphere(.14, 0, 1.57, 0, dark, g); head.scale.y = 1.2;
    for (const side of [-1, 1]) { cylinder(.053, .65, side * .24, 1, 0, dark, g); cylinder(.066, .71, side * .105, .38, 0, dark, g); }
    return g;
  }

  box(7.6, .20, 28.4, 0, -.1, -2, mats.floor);
  tag(box(7.1, .015, 27.6, 0, .008, -2, new THREE.MeshBasicMaterial({ visible: false })), 'floor', 'Sol du secteur');
  tag(box(7.1, .03, 27.6, 0, 3.42, -2, new THREE.MeshBasicMaterial({ visible: false })), 'ceiling', 'Plafond du secteur');
  box(7.6, 3.6, .20, 0, 1.8, -16, mats.wall);
  box(7.6, 3.6, .20, 0, 1.8, 12.1, mats.wall);
  box(.20, 3.6, 28.3, 3.85, 1.8, -2, mats.wall);

  // Shared functions use different physical furniture in each location.
  const exitGroup = new THREE.Group(); exitGroup.position.set(0, 0, -15.74); root.add(exitGroup);
  box(2.08, 2.93, .17, 0, 1.46, 0, mats.steel, exitGroup);
  for (const side of [-1, 1]) {
    box(.94, 2.75, .08, side * .49, 1.38, .13, mats.enamel, exitGroup, .02);
    box(.62, .75, .03, side * .49, 1.93, .19, mats.black, exitGroup, .025);
    box(.06, .44, .08, side * .17, 1.1, .21, mats.steel, exitGroup, .02);
  }
  const exitNormal = texture(['SORTIE', '↑ 09'], '#153a34'); const exitWrong = texture(['AUCUNE SORTIE', 'RETOURNEZ-VOUS'], '#4e2020', '#ffb5a0');
  const exitSign = panel(1.42, .35, 0, 3.15, .10, exitNormal, exitGroup, 1.3); tag(exitGroup, 'exit', 'Sas de diagnostic');
  lamp(0, 2.6, -14.4, 19, 0x89bbb4);
  const terminal = new THREE.Group(); terminal.position.set(0, 0, -12.9); root.add(terminal);
  box(.64, .08, .52, 0, .04, 0, mats.steel, terminal, .035); box(.13, .95, .14, 0, .53, 0, mats.enamel, terminal, .015);
  const head = new THREE.Group(); head.position.set(0, 1.07, .03); head.rotation.x = -.4; terminal.add(head);
  box(.72, .46, .05, 0, 0, 0, mats.black, head, .025); panel(.64, .36, 0, 0, .028, texture(['PROTOCOL 09', 'DIAGNOSTIC']), head, .65);
  tag(terminal, 'exit', 'Terminal de diagnostic — E'); obstacle(0, -12.9, .42, .32);
  const relay = new THREE.Group(); relay.position.set(2.72, 1.32, 7.72); relay.rotation.x = -.14; root.add(relay);
  box(.64, .43, .07, 0, 0, 0, mats.black, relay, .025);
  const relayScreen = panel(.56, .35, 0, 0, .038, texture(['RELAIS', '0909']), relay, .7); tag(relay, 'radio', 'Relais de calibration — comparez le code');
  const mirrorFrame = wallGroup(1, 3.75);
  box(1.33, 2.65, .09, 0, 1.65, .035, mats.steel, mirrorFrame, .02);
  const mirror = reflectiveGlass(1.18, 2.50, 0x8e9a97, 1); mirror.position.set(0, 1.65, .09); mirrorFrame.add(mirror); reflectors.push(mirror); tag(mirrorFrame, 'mirror', 'Miroir de contrôle');
  const windowGroup = wallGroup(-1, -12.25);
  const window = reflectiveGlass(2.12, 1.84, 0x809b9f, .32); window.position.set(0, 2.03, .12); windowGroup.add(window); reflectors.push(window);
  for (const x of [-1.08, 0, 1.08]) box(.045, 1.95, .09, x, 2.03, .18, mats.steel, windowGroup);
  for (const y of [1.05, 3.01]) box(2.20, .055, .09, 0, y, .18, mats.steel, windowGroup);
  tag(windowGroup, 'window', id === 'metro' ? 'Vitre du quai' : 'Vitre de la salle d’observation');

  let train: THREE.Group | undefined;
  let destination: THREE.Mesh | undefined;
  let normalDestination: THREE.Texture | undefined;
  let wrongDestination: THREE.Texture | undefined;
  let signalMat: THREE.MeshStandardMaterial | undefined;
  let trackSet: THREE.Group | undefined;
  let bed: THREE.Group | undefined;
  let monitor: THREE.Mesh | undefined;
  let monitorNormal: THREE.Texture | undefined;
  let monitorWrong: THREE.Texture | undefined;
  let curtainPresence: THREE.Group | undefined;
  let wheelchair: THREE.Group | undefined;
  let secondBed: THREE.Group | undefined;
  let trainShadow: THREE.Group | undefined;
  let curtainMesh: THREE.Mesh | undefined;
  let routePanel: THREE.Mesh | undefined;

  if (id === 'metro') {
    // Track pit, sleepers and rails are outside the walkable platform.
    box(4.75, .24, 28.4, -6.05, -.55, -2, mats.black);
    box(.25, 4.5, 28.4, -8.38, 1.7, -2, mats.black);
    box(7.5, .18, 28.4, 0, 3.52, -2, mats.black);
    box(.25, .30, 28.2, -3.72, -.02, -2, mats.steel);
    for (let z = -15.5; z < 12; z += .30) box(.36, .012, .025, -3.22, .014, z, mats.yellow);
    box(.06, .015, 27.8, -2.95, .014, -2, mats.yellow);
    box(.07, 2.85, .08, -3.62, 1.425, 9.85, mats.steel);
    trackSet = new THREE.Group(); trackSet.position.set(-5.94, -.28, -2); root.add(trackSet);
    for (let z = -13.2; z <= 13.2; z += .70) box(2.15, .09, .22, 0, -.05, z, mats.wall, trackSet);
    for (const x of [-.72, .72]) { box(.08, .13, 28, x, .05, 0, mats.steel, trackSet); box(.14, .035, 28, x, .13, 0, mats.steel, trackSet); }
    tag(trackSet, 'tracks', 'Rails et traverses');
    for (let z = -13.5; z <= 10.5; z += 4) {
      // The previous semicircle reached y=3.975 through the ceiling underside at 3.43.
      // A shallow vault joins the existing posts at 2.695 and stays below that ceiling.
      const arch = part(new THREE.TorusGeometry(3.5, .075, 12, 72, Math.PI), mats.steel);
      arch.name = 'Arceau du quai'; arch.position.set(0, 2.695, z); arch.scale.y = .18; arch.userData.keepSeparate = true;
      for (const x of [-3.5, 3.5]) { box(.24, 2.67, .28, x, 1.36, z, mats.enamel); box(.30, .11, .34, x, .08, z, mats.steel); }
      box(2.14, .055, .14, .35, 3.28, z + .24, mats.glow); lamp(.35, 3.08, z + .24, 18, 0xb3ccc3);
    }
    // Tiled walls with station stripes and exposed service conduits.
    for (let z = -15.5; z < 12; z += .65) for (let y = .25; y < 3.4; y += .42) box(.022, .013, .64, 3.73, y, z, mats.steel);
    box(.035, .34, 27.8, 3.71, 1.95, -2, mats.enamel);
    for (let y = 0; y < 3; y++) { const pipe = cylinder(.032, 27.5, 3.50 - y * .10, 3.15, -2, mats.steel); pipe.rotation.x = Math.PI / 2; }
    for (const z of [4, -6.8]) {
      const bench = new THREE.Group(); bench.position.set(2.66, 0, z); bench.rotation.y = -Math.PI / 2; root.add(bench);
      for (const x of [-.62, 0, .62]) {
        const seat = box(.54, .065, .48, x, .50, 0, mats.enamel, bench, .045);
        const back = box(.54, .55, .065, x, .80, -.21, mats.enamel, bench, .045); back.rotation.x = -.13;
        box(.04, .60, .04, x, .26, -.08, mats.steel, bench);
      }
      box(1.93, .055, .06, 0, .30, -.08, mats.steel, bench);
      tag(bench, 'chair', 'Banc du quai'); obstacle(2.66, z, .53, 1.08);
    }
    const vending = new THREE.Group(); vending.position.set(2.78, 0, 8.0); root.add(vending);
    box(1.22, 1.35, .60, 0, .675, 0, mats.enamel, vending, .055);
    box(.46, .11, .05, 0, .63, .33, mats.black, vending, .018);
    for (let i = 0; i < 3; i++) box(.075, .075, .012, -.16 + i * .16, .85, .32, mats.steel, vending, .014);
    panel(.78, .14, 0, 1.10, .321, texture(['POINT DE CONTRÔLE']), vending, .15); obstacle(2.78, 8, .72, .46);
    const routeMap = wallGroup(1, -.9);
    box(1.42, 1.26, .06, 0, 2.1, .05, mats.steel, routeMap);
    routePanel = panel(1.28, 1.12, 0, 2.1, .083, texture(['LIGNE 09', 'OBSERVATOIRE', 'QUAI TERMINAL'], '#cbd2bd', '#234740'), routeMap, .05);
    tag(routeMap, 'portrait', 'Plan de la ligne');
    const destinationGroup = new THREE.Group(); destinationGroup.position.set(0, 2.94, -6.15); root.add(destinationGroup);
    box(2.38, .47, .16, 0, 0, 0, mats.black, destinationGroup, .025);
    normalDestination = texture(['QUAI 09', 'SERVICE TERMINÉ']); wrongDestination = texture(['QUAI 00', 'DERNIER PASSAGE'], '#301819', '#ffb4a5');
    destination = panel(2.20, .34, 0, 0, .085, normalDestination, destinationGroup, .75); tag(destinationGroup, 'train', 'Afficheur de destination');
    for (const x of [-.8, .8]) box(.025, .4, .025, x, .4, 0, mats.steel, destinationGroup);
    const signal = wallGroup(1, -9.4);
    box(.27, .68, .13, 0, 2.22, .15, mats.black, signal, .04);
    signalMat = material({ color: 0x70b898, emissive: 0x44d499, emissiveIntensity: 1.1 });
    const lampLens = sphere(.083, 0, 2.22, .24, signalMat, signal); lampLens.scale.z = .3; tag(signal, 'signal', 'Signal du quai');
    train = new THREE.Group(); train.position.set(-6.15, -.12, -3); root.add(train); train.visible = false;
    box(2.5, 2.65, 15.2, 0, 1.51, 0, mats.steel, train, .20);
    box(2.53, .22, 14.9, 0, .76, 0, mats.enamel, train, .035);
    for (let z = -6.3; z < 7; z += 1.4) {
      box(.035, .85, .99, 1.27, 1.92, z, mats.black, train, .045);
      box(.04, .035, .98, 1.295, 1.51, z, mats.glow, train);
    }
    for (const z of [-4.6, 1]) { box(.05, 2.13, 1.3, 1.29, 1.24, z, mats.enamel, train, .025); box(.06, .75, .89, 1.33, 1.78, z, mats.black, train, .04); }
    for (const z of [-5.7, 5.7]) for (const x of [-.95, .95]) { const wheel = cylinder(.29, .10, x, .13, z, mats.black, train, 48); wheel.rotation.z = Math.PI / 2; }
    tag(train, 'train', 'Rame sans voyageurs');
    trainShadow = new THREE.Group(); trainShadow.position.set(3.69, 0, -3); root.add(trainShadow); trainShadow.visible = false;
    const shadowInk = new THREE.MeshBasicMaterial({ color: 0x071319, transparent: true, opacity: .79, depthWrite: false }); ownMaterials.push(shadowInk);
    box(.015, .29, 11.3, 0, .63, 0, shadowInk, trainShadow);
    box(.015, .24, 11.3, 0, 2.18, 0, shadowInk, trainShadow);
    for (let z = -5.4; z <= 5.4; z += 1.2) box(.015, 1.4, .22, 0, 1.45, z, shadowInk, trainShadow);
    tag(trainShadow, 'train', 'Ombre d’une rame absente');
    // The platform window is a genuine transparent reflective plane over the track view.
    for (let z = -10.5; z <= 10; z += 3) { box(.045, .85, .045, -3.68, .45, z, mats.steel); box(.055, .055, 2.95, -3.68, .86, z + 1.5, mats.steel); }
  } else {
    // Clinical corridor, glass observation room, suspended ceiling and handrails.
    box(.20, 3.6, 23, -3.85, 1.8, .5, mats.wall);
    box(.20, 3.6, 2.5, -3.85, 1.8, -14.75, mats.wall);
    box(.20, 1.04, 2.5, -3.85, .52, -12.25, mats.wall);
    box(.20, .55, 2.5, -3.85, 3.32, -12.25, mats.wall);
    box(7.6, .14, 28.3, 0, 3.52, -2, mats.white);
    for (let z = -15.4; z < 12; z += 1.2) box(7.3, .018, .016, 0, 3.435, z, mats.steel);
    for (let x = -3; x <= 3; x += 1.2) box(.016, .018, 27.6, x, 3.435, -2, mats.steel);
    for (let z = -13; z < 11; z += 4.7) { box(1.8, .025, .52, 0, 3.41, z, mats.glow); lamp(0, 3.1, z, 20, 0xc4d8cd); }
    for (const side of [-1, 1]) {
      box(.10, .17, 27.8, side * 3.62, .95, -2, mats.enamel, root, .04);
      box(.08, .18, 27.8, side * 3.67, .10, -2, mats.enamel);
    }
    for (let z = -15.5; z < 12; z += .7) { box(.02, .008, .67, 0, .015, z, mats.white); }
    for (const [side, z, title] of [[-1, 0, 'CONSULTATION'], [1, -.5, 'IMAGERIE'], [-1, -9.5, 'OBSERVATION'], [1, -10.6, 'ARCHIVES']] as [number, number, string][]) {
      const door = wallGroup(side, z);
      box(1.52, 2.73, .15, 0, 1.36, .02, mats.steel, door);
      box(1.36, 2.57, .07, 0, 1.30, .13, mats.enamel, door, .025);
      box(.48, .62, .025, 0, 1.84, .18, mats.black, door, .05);
      box(.16, .045, .10, .46, 1.10, .20, mats.steel, door, .015);
      panel(.91, .16, 0, 2.57, .18, texture([title], '#d6e0d3', '#2e5654'), door, .06);
      tag(door, 'door', title);
    }
    const station = new THREE.Group(); station.position.set(2.52, 0, 7.86); root.add(station);
    box(1.92, 1.12, .77, 0, .56, 0, mats.white, station, .06);
    box(2.04, .09, .93, 0, 1.15, 0, mats.enamel, station, .03);
    for (let x = -.65; x <= .66; x += .65) { box(.61, .78, .025, x, .60, .40, mats.soft, station, .015); box(.22, .022, .035, x, .84, .43, mats.steel, station, .008); }
    panel(.84, .17, 0, .65, .43, texture(['POSTE DE SOINS'], '#5b8c85'), station, .06); obstacle(2.52, 7.86, 1.10, .58);
    const sink = wallGroup(1, 3.75);
    box(.86, .15, .44, 0, .98, .28, mats.white, sink, .09);
    const basin = sphere(.26, 0, 1.05, .29, mats.steel, sink); basin.scale.set(1.2, .10, .65);
    cylinder(.018, .30, 0, 1.22, .12, mats.steel, sink);
    const spout = cylinder(.018, .16, 0, 1.36, .19, mats.steel, sink); spout.rotation.x = Math.PI / 2;
    box(.13, .26, .09, .64, 1.53, .13, mats.white, sink, .035);
    const trolley = new THREE.Group(); trolley.position.set(-2.70, 0, 7.6); root.add(trolley);
    for (const y of [.28, .70, 1.02]) box(.79, .04, .50, 0, y, 0, mats.steel, trolley, .02);
    for (const x of [-.34, .34]) for (const z of [-.20, .20]) { cylinder(.017, 1.0, x, .59, z, mats.steel, trolley); const caster = cylinder(.065, .05, x, .12, z, mats.black, trolley); caster.rotation.x = Math.PI / 2; }
    for (let i = 0; i < 4; i++) cylinder(.031, .16 + i * .02, -.25 + i * .15, 1.13, 0, mats.white, trolley);
    tag(trolley, 'trolley', 'Chariot de soins'); obstacle(-2.7, 7.6, .52, .38);

    bed = new THREE.Group(); bed.position.set(-2.32, 0, -3.3); root.add(bed);
    box(1.12, .09, 2.12, 0, .57, 0, mats.steel, bed, .045);
    box(1.04, .22, 1.98, 0, .72, 0, mats.white, bed, .09);
    const blanketGeo = new THREE.PlaneGeometry(1.05, 1.70, 32, 56);
    const bp = blanketGeo.attributes.position;
    for (let i = 0; i < bp.count; i++) bp.setZ(i, Math.sin(bp.getX(i) * 25 + bp.getY(i) * 4) * .014 + Math.sin(bp.getY(i) * 14) * .011);
    blanketGeo.computeVertexNormals(); const blanket = part(blanketGeo, mats.soft, bed); blanket.rotation.x = -Math.PI / 2; blanket.position.set(0, .839, .12);
    box(.67, .14, .40, 0, .87, -.70, mats.white, bed, .065);
    for (const x of [-.49, .49]) for (const z of [-.85, .85]) { cylinder(.026, .34, x, .38, z, mats.steel, bed); const wheel = cylinder(.095, .045, x, .15, z, mats.black, bed); wheel.rotation.z = Math.PI / 2; }
    for (const z of [-1.03, 1.03]) { box(1.14, .40, .055, 0, .88, z, mats.enamel, bed, .04); box(.74, .045, .065, 0, 1.1, z, mats.steel, bed, .018); }
    for (const x of [-.57, .57]) { box(.035, .035, 1.52, x, 1.02, 0, mats.steel, bed); for (let z = -.6; z <= .6; z += .3) cylinder(.013, .31, x, .85, z, mats.steel, bed, 16); }
    tag(bed, 'bed', 'Lit de consultation'); obstacle(-2.32, -3.3, .73, 1.25, 'clinic_bed');
    secondBed = bed.clone(true); secondBed.position.set(2.30, 0, -9.05); secondBed.rotation.y = .10; secondBed.visible = false; root.add(secondBed);
    tag(secondBed, 'bed', 'Second lit dans le couloir');
    const drip = new THREE.Group(); drip.position.set(-3.2, 0, -4.5); root.add(drip);
    cylinder(.017, 1.99, 0, 1.08, 0, mats.steel, drip); cylinder(.022, .40, 0, 2.05, 0, mats.steel, drip).rotation.z = Math.PI / 2;
    box(.17, .28, .07, .13, 1.85, 0, material({ color: 0xbccab4, transparent: true, opacity: .55, roughness: .18 }), drip, .035);
    for (let i = 0; i < 5; i++) { const a = i / 5 * Math.PI * 2; const spoke = box(.37, .025, .025, Math.cos(a) * .14, .10, Math.sin(a) * .14, mats.steel, drip); spoke.rotation.y = -a; }
    const screen = wallGroup(-1, -3.3);
    box(.82, .65, .14, 0, 1.95, .20, mats.white, screen, .035);
    monitorNormal = texture(['FC 072', 'RYTHME SINUSAL'], '#10272a', '#89dfa5'); monitorWrong = texture(['FC 000', 'LE PATIENT VOUS VOIT'], '#371c20', '#ffb0a9');
    monitor = panel(.69, .49, 0, 1.95, .276, monitorNormal, screen, .85);
    const linePoints: THREE.Vector3[] = [];
    for (let i = 0; i < 60; i++) { const x = -.30 + i * .01; const f = i % 20; linePoints.push(new THREE.Vector3(x, 1.92 + (f === 9 ? .075 : f === 10 ? -.055 : f === 11 ? .025 : Math.sin(i * .8) * .006), .282)); }
    const pulse = new THREE.Line(new THREE.BufferGeometry().setFromPoints(linePoints), new THREE.LineBasicMaterial({ color: 0x6be2a0 })); screen.add(pulse); pulse.userData.clinicPulse = true;
    tag(screen, 'monitor', 'Moniteur cardiaque');
    const curtain = new THREE.Group(); curtain.position.set(2.68, 0, -6.0); curtain.rotation.y = -.32; root.add(curtain);
    for (const x of [-.8, .8]) { cylinder(.02, 2.35, x, 1.20, 0, mats.steel, curtain); box(.42, .04, .55, x, .05, 0, mats.steel, curtain, .015); }
    const rail = cylinder(.02, 1.66, 0, 2.35, 0, mats.steel, curtain); rail.rotation.z = Math.PI / 2;
    const curtainGeo = new THREE.PlaneGeometry(1.58, 2.1, 64, 40); const cp = curtainGeo.attributes.position;
    for (let i = 0; i < cp.count; i++) cp.setZ(i, Math.sin(cp.getX(i) * 42) * .035); curtainGeo.computeVertexNormals();
    curtainMesh = part(curtainGeo, material({ color: 0xb3c6b8, roughness: .98, transparent: true, opacity: .86, side: THREE.DoubleSide }), curtain); curtainMesh.position.y = 1.23;
    curtainPresence = silhouette(curtain); curtainPresence.position.set(0, .06, -.16); curtainPresence.visible = false;
    tag(curtain, 'curtain', 'Paravent de soins'); obstacle(2.68, -6.0, .87, .30);
    wheelchair = new THREE.Group(); wheelchair.position.set(2.48, 0, 1.50); wheelchair.rotation.y = -.75; root.add(wheelchair);
    box(.53, .055, .49, 0, .52, 0, mats.enamel, wheelchair, .035); box(.53, .50, .045, 0, .77, .22, mats.enamel, wheelchair, .025);
    for (const side of [-1, 1]) {
      const wheel = torus(.32, .025, side * .36, .34, .11, mats.black, wheelchair); wheel.rotation.y = Math.PI / 2;
      const rim = torus(.27, .009, side * .40, .34, .11, mats.steel, wheelchair); rim.rotation.y = Math.PI / 2;
      for (let i = 0; i < 12; i++) { const a = i / 12 * Math.PI * 2; const spoke = cylinder(.003, .62, side * .36, .34, .11, mats.steel, wheelchair, 8); spoke.rotation.x = a; }
      cylinder(.015, .82, side * .27, .57, .23, mats.steel, wheelchair);
      box(.08, .04, .52, side * .28, .78, -.01, mats.black, wheelchair, .015);
      const caster = cylinder(.074, .04, side * .25, .11, -.37, mats.black, wheelchair); caster.rotation.z = Math.PI / 2;
      box(.20, .025, .23, side * .14, .18, -.40, mats.steel, wheelchair, .015);
    }
    tag(wheelchair, 'wheelchair', 'Fauteuil roulant'); obstacle(2.48, 1.5, .57, .63);
    // A real room is visible through the observation window.
    box(2.6, .18, 2.5, -5.15, -.09, -12.25, mats.floor);
    box(.20, 3.6, 2.7, -6.5, 1.8, -12.25, mats.enamel);
    for (const z of [-13.55, -10.95]) box(2.8, 3.6, .15, -5.2, 1.8, z, mats.wall);
    box(1.15, .22, 1.72, -5.2, .76, -12.25, mats.white, root, .08);
    lamp(-5.15, 2.8, -12.25, 10, 0x789cb4, 5);
  }

  const clues = createLocationClues(id, { routePanel, bed }); root.add(clues.root); targets.push(...clues.targets); colliders.push(...clues.colliders);
  // Batch rigid geometry within each articulated/inspectable root. The clue module owns its own meshes.
  const groups: THREE.Group[] = []; root.traverse(object => { if ((object as THREE.Group).isGroup) groups.push(object as THREE.Group); });
  for (const group of groups.reverse()) {
    const batches = new Map<THREE.Material, THREE.Mesh[]>();
    for (const child of [...group.children]) {
      const m = child as THREE.Mesh;
      if (!m.isMesh || (m as Reflector).isReflector || m.userData.inspect || m.userData.keepSeparate || Array.isArray(m.material)) continue;
      let owner: THREE.Object3D | null = m.parent;
      while (owner && owner !== clues.root) owner = owner.parent;
      if (owner === clues.root) continue;
      const pieces = batches.get(m.material) || []; pieces.push(m); batches.set(m.material, pieces);
    }
    for (const [mat, pieces] of batches) if (pieces.length >= 3) {
      const copies = pieces.map(piece => { piece.updateMatrix(); let geo = piece.geometry.clone(); if (geo.index) { const flat = geo.toNonIndexed(); geo.dispose(); geo = flat; } return geo.applyMatrix4(piece.matrix); });
      const merged = mergeGeometries(copies); copies.forEach(geo => geo.dispose());
      if (merged) { part(merged, mat, group); pieces.forEach(piece => { group.remove(piece); piece.geometry.dispose(); }); }
    }
  }
  const baseSignal = new THREE.Color(0x70b898);
  function setView(nextEffects: Set<string>, code = '0909') {
    effects = nextEffects;
    clues.setView(effects);
    for (const item of lights) { item.light.intensity = item.intensity * (effects.has('blackout') ? .015 : 1); item.light.color.copy(effects.has('red_light') ? new THREE.Color(0xe92c1e) : item.color); }
    mats.glow.emissive.set(effects.has('red_light') ? 0xf72c1f : 0xbad6cb); mats.glow.emissiveIntensity = effects.has('blackout') ? .015 : 1.5;
    const exitMat = exitSign.material as THREE.MeshStandardMaterial; exitMat.map = effects.has('exit_false') ? exitWrong : exitNormal; exitMat.emissiveMap = exitMat.map;
    if (train) train.visible = effects.has('metro_train');
    if (trainShadow) { trainShadow.visible = effects.has('metro_shadow_train'); trainShadow.position.z = -3; }
    if (trackSet) trackSet.rotation.y = effects.has('metro_tracks') ? .38 : 0;
    if (destination) { const mat = destination.material as THREE.MeshStandardMaterial; mat.map = effects.has('metro_destination') ? wrongDestination! : normalDestination!; mat.emissiveMap = mat.map; }
    if (signalMat) { signalMat.color.copy(effects.has('metro_signal') ? new THREE.Color(0xe94436) : baseSignal); signalMat.emissive.set(effects.has('metro_signal') ? 0xe52d25 : 0x44d499); }
    if (bed) bed.position.y = effects.has('clinic_bed') ? .58 : 0;
    if (secondBed) secondBed.visible = effects.has('clinic_bed_count');
    if (monitor) { const mat = monitor.material as THREE.MeshStandardMaterial; mat.map = effects.has('clinic_monitor') ? monitorWrong! : monitorNormal!; mat.emissiveMap = mat.map; }
    root.traverse(object => { if (object.userData.clinicPulse) { object.scale.y = effects.has('clinic_monitor') ? -1 : 1; object.position.y = effects.has('clinic_monitor') ? 3.84 : 0; } });
    if (curtainPresence) curtainPresence.visible = effects.has('clinic_curtain');
    if (wheelchair) wheelchair.rotation.y = -.75;
    if (curtainMesh) {
      const positions = curtainMesh.geometry.attributes.position;
      for (let i = 0; i < positions.count; i++) positions.setZ(i, Math.sin(positions.getX(i) * 42) * .035);
      positions.needsUpdate = true; curtainMesh.geometry.computeVertexNormals();
    }
    const nextCode = /^\d{4}$/.test(code) ? code : '0909';
    if (nextCode !== relayValue) {
      relayValue = nextCode; const mat = relayScreen.material as THREE.MeshStandardMaterial; const old = mat.map;
      mat.map = texture(['RELAIS', nextCode]); mat.emissiveMap = mat.map;
      if (old) { const index = textures.indexOf(old); if (index >= 0) textures.splice(index, 1); old.dispose(); }
    }
  }
  function update(time: number) {
    if (bed && effects.has('clinic_bed')) bed.position.y = .58 + Math.sin(time * 1.8) * .035;
    if (wheelchair && effects.has('clinic_wheelchair')) wheelchair.rotation.y = -.75 + time * .32;
    if (curtainPresence && effects.has('clinic_curtain')) curtainPresence.rotation.y = Math.sin(time * .6) * .10;
    if (trainShadow && effects.has('metro_shadow_train')) trainShadow.position.z = -3 + Math.sin(time * .28) * 5.5;
    if (curtainMesh && effects.has('curtain_breath')) {
      const positions = curtainMesh.geometry.attributes.position;
      for (let i = 0; i < positions.count; i++) {
        const x = positions.getX(i), y = positions.getY(i);
        const bulge = Math.max(0, Math.cos(x / .79 * Math.PI / 2)) * Math.max(0, Math.cos(y / 1.05 * Math.PI / 2));
        positions.setZ(i, Math.sin(x * 42) * .035 + bulge * (.24 + Math.sin(time * 1.25) * .17));
      }
      positions.needsUpdate = true; curtainMesh.geometry.computeVertexNormals();
    }
    clues.update(time);
  }
  function dispose() {
    if (disposed) return; disposed = true;
    root.remove(clues.root); clues.dispose();
    const geometries = new Set<THREE.BufferGeometry>(); const materials = new Set<THREE.Material>();
    root.traverse(object => { const m = object as THREE.Mesh; if (m.geometry) geometries.add(m.geometry); if (m.material) (Array.isArray(m.material) ? m.material : [m.material]).forEach(mat => materials.add(mat)); });
    geometries.forEach(geo => geo.dispose()); materials.forEach(mat => mat.dispose()); textures.forEach(map => map.dispose()); reflectors.forEach(reflector => reflector.getRenderTarget().dispose());
  }
  setView(new Set());
  return { id, root, targets, colliders, reflectors, lights, setView, update, getReading: clues.getReading, dispose };
}

export type LocationWorld = ReturnType<typeof createLocation>;
