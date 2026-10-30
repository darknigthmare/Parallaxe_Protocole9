import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';

export type InspectorIdentity = { id: string; name: string; slot: number; color?: number };
export type InspectorAnimation = {
  time: number; speed: number; talking?: boolean; pitch?: number; independent?: boolean; mannequin?: boolean; radioSignal?: boolean;
  badgeMissing?: boolean; badgeCode?: string; heightOffset?: boolean; handsSwap?: boolean;
  visorTarget?: THREE.Vector3; noContact?: boolean; seated?: boolean;
};
export const INSPECTOR_COLORS = [0x3e756f, 0xa47b3d, 0x526e9c, 0x805d8c] as const;

/** Original articulated inspector, modelled in metres. Front is local -Z. */
export function createInspector(identity: InspectorIdentity, options: { local?: boolean; reflectionOnly?: boolean; nameplate?: boolean } = {}) {
  const root = new THREE.Group(); root.name = 'Inspecteur ' + identity.name;
  root.userData.inspector = { ...identity, originalProceduralModel: true };
  root.userData.localInspector = !!options.local;
  root.userData.reflectionOnly = !!options.reflectionOnly;
  const ownedMaterials: THREE.Material[] = [];
  const textures: THREE.Texture[] = [];
  let disposed = false;
  function material(config: THREE.MeshStandardMaterialParameters) { const m = new THREE.MeshStandardMaterial(config); ownedMaterials.push(m); return m; }
  const color = identity.color ?? INSPECTOR_COLORS[Math.abs(identity.slot || 0) % 4];
  const cloth = material({ color, roughness: .88 });
  const trouser = material({ color: 0x273536, roughness: .92 });
  const webbing = material({ color: 0x182323, roughness: .85 });
  const trim = material({ color: 0x98bbb1, roughness: .43, metalness: .25 });
  const rubber = material({ color: 0x101617, roughness: .75 });
  const skin = material({ color: [0xcaa68a, 0xa57452, 0x825d48, 0xb78e75][Math.abs(identity.slot || 0) % 4], roughness: .77 });
  const faceInk = material({ color: 0x18201e, roughness: .8 });
  const eyeWhite = material({ color: 0xc8d4b8, roughness: .38 });
  const irisMaterial = material({ color: 0x547d66, roughness: .28 });
  const metal = material({ color: 0x829692, roughness: .27, metalness: .78 });
  const visorMaterial = new THREE.MeshPhysicalMaterial({ color: 0x335a61, roughness: .11, metalness: .15, transparent: true, opacity: .63, clearcoat: 1 }); ownedMaterials.push(visorMaterial);
  const screenMaterial = material({ color: 0x9ccbad, emissive: 0x6eab86, emissiveIntensity: .45, roughness: .4 });
  const diodeMaterial = material({ color: 0x7bd19c, emissive: 0x56c281, emissiveIntensity: 1.4 });
  const originalColors = new Map<THREE.Material, THREE.Color>();
  function part(geometry: THREE.BufferGeometry, mat: THREE.Material, parent: THREE.Object3D = root) {
    const object = new THREE.Mesh(geometry, mat); object.castShadow = true; object.receiveShadow = true; parent.add(object); return object;
  }
  function rounded(w: number, h: number, d: number, x: number, y: number, z: number, mat: THREE.Material, parent: THREE.Object3D = root, r = .02) {
    const object = part(new RoundedBoxGeometry(w, h, d, 3, Math.min(r, w / 3, h / 3, d / 3)), mat, parent); object.position.set(x, y, z); return object;
  }
  function ball(r: number, x: number, y: number, z: number, mat: THREE.Material, parent: THREE.Object3D = root, segments = 32) {
    const object = part(new THREE.SphereGeometry(r, segments, segments / 2), mat, parent); object.position.set(x, y, z); return object;
  }
  function tube(radius: number, length: number, x: number, y: number, z: number, mat: THREE.Material, parent: THREE.Object3D = root, upper = radius) {
    const object = part(new THREE.CylinderGeometry(upper, radius, length, 24, 3), mat, parent); object.position.set(x, y, z); return object;
  }
  function textMap(lines: string[], background = '#16312d') {
    const canvas = document.createElement('canvas'); canvas.width = 256; canvas.height = 128;
    const ctx = canvas.getContext('2d')!; ctx.fillStyle = background; ctx.fillRect(0, 0, 256, 128);
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillStyle = '#d6e2ce';
    lines.forEach((line, index) => { ctx.font = `${/^\d{2}$/.test(line) ? 80 : index ? 20 : 30}px monospace`; ctx.fillText(line, 128, lines.length === 1 ? 64 : 44 + index * 54); });
    const result = new THREE.CanvasTexture(canvas); result.colorSpace = THREE.SRGBColorSpace; textures.push(result); return result;
  }
  const torso = new THREE.Group(); torso.position.y = 1.16; root.add(torso); torso.name = 'Torso';
  rounded(.43, .49, .25, 0, 0, .01, cloth, torso, .075);
  rounded(.39, .37, .055, 0, -.015, -.137, webbing, torso, .025);
  for (const x of [-.17, .17]) {
    rounded(.052, .47, .025, x, .025, -.16, trim, torso, .008);
    rounded(.10, .13, .055, x * .67, -.045, -.19, cloth, torso, .014);
    rounded(.065, .022, .008, x * .67, .004, -.224, metal, torso, .005);
  }
  for (const y of [-.08, .015, .11]) rounded(.25, .014, .018, 0, y, -.18, rubber, torso, .004);
  rounded(.45, .065, .26, 0, -.25, 0, webbing, torso, .015);
  rounded(.065, .045, .020, 0, -.25, -.15, metal, torso, .008);
  rounded(.14, .23, .10, -.21, -.18, .02, webbing, torso, .025);
  rounded(.12, .20, .08, .21, -.17, .03, webbing, torso, .02);
  // Equipment, ID and sewn shoulder details are actual meshes.
  const ownBadgeCode = String(identity.slot + 1).padStart(2, '0');
  const badgeMaps = new Map<string, THREE.Texture>();
  function badgeMap(code: string) {
    if (!badgeMaps.has(code)) badgeMaps.set(code, textMap(code ? [code, 'PARALLAXE'] : []));
    return badgeMaps.get(code)!;
  }
  const patchMat = material({ map: badgeMap(ownBadgeCode), roughness: .73, emissive: 0x9faf96, emissiveIntensity: .12 });
  rounded(.19, .125, .012, .07, .13, -.178, metal, torso, .006);
  const badge = part(new THREE.PlaneGeometry(.178, .108), patchMat, torso);
  badge.position.set(.07, .13, -.185); badge.rotation.y = Math.PI; badge.name = 'Identity badge';
  badge.userData.keepSeparate = true;
  rounded(.035, .23, .04, -.105, -.035, -.226, metal, torso, .01);
  rounded(.26, .33, .11, 0, .01, .19, webbing, torso, .045);
  for (const x of [-.13, .13]) rounded(.025, .33, .024, x, .01, .25, trim, torso, .006);
  const head = new THREE.Group(); head.position.y = 1.52; root.add(head); head.name = 'Head and helmet';
  tube(.055, .13, 0, -.05, 0, skin, head);
  const cranium = ball(.125, 0, .095, -.007, skin, head, 48); cranium.scale.set(.85, 1.17, .93);
  for (const side of [-1, 1]) { const ear = ball(.028, side * .107, .075, 0, skin, head, 24); ear.scale.set(.45, 1, .7); }
  const face = new THREE.Group(); head.add(face);
  const nose = ball(.026, 0, .07, -.118, skin, face, 24); nose.scale.set(.60, .75, .85);
  const eyes: THREE.Group[] = [];
  for (const x of [-.043, .043]) {
    const eye = new THREE.Group(); eye.position.set(x, .115, -.111); face.add(eye); eyes.push(eye); eye.name = x < 0 ? 'Left eye' : 'Right eye';
    const white = ball(.022, 0, 0, 0, eyeWhite, eye, 24); white.scale.set(1.1, .72, .62);
    const iris = ball(.009, 0, 0, -.013, irisMaterial, eye, 20); iris.scale.z = .36;
    const pupil = ball(.0045, 0, 0, -.016, faceInk, eye, 16); pupil.scale.z = .35;
  }
  rounded(.053, .006, .009, 0, .02, -.113, faceInk, face, .002);
  const helmet = part(new THREE.SphereGeometry(.145, 48, 24, 0, Math.PI * 2, 0, Math.PI * .56), cloth, head); helmet.position.set(0, .11, 0); helmet.scale.set(1.02, .85, 1.08);
  rounded(.27, .025, .04, 0, .12, -.135, rubber, head, .009);
  const visor = rounded(.243, .10, .035, 0, .087, -.14, visorMaterial, head, .025);
  for (const x of [-.10, .10]) rounded(.025, .035, .025, x, .202, -.07, trim, head, .004);
  rounded(.045, .045, .052, 0, .205, -.085, rubber, head, .012);
  rounded(.029, .027, .005, 0, .206, -.114, screenMaterial, head, .005);
  const headset = tube(.037, .025, .133, .095, 0, rubber, head); headset.rotation.z = Math.PI / 2;
  const boomPath = new THREE.CatmullRomCurve3([new THREE.Vector3(.14, .06, -.01), new THREE.Vector3(.13, -.015, -.10), new THREE.Vector3(.06, -.02, -.145)]);
  part(new THREE.TubeGeometry(boomPath, 20, .005, 8, false), metal, head);
  ball(.014, .06, -.02, -.145, rubber, head, 16);

  function hand(parent: THREE.Object3D, side: number) {
    const group = new THREE.Group(); group.position.y = -.30; parent.add(group); group.name = side < 0 ? 'Left hand' : 'Right hand';
    rounded(.075, .09, .045, 0, -.035, -.002, rubber, group, .019);
    for (let i = 0; i < 4; i++) {
      const finger = new THREE.Group(); finger.position.set(-.027 + i * .018, -.078, -.002); finger.rotation.x = -.15; group.add(finger);
      const length = [.038, .047, .046, .035][i];
      tube(.0075, length, 0, -length / 2, 0, rubber, finger);
      const joint = ball(.008, 0, -length, 0, rubber, finger, 16); joint.scale.y = 1.2;
      tube(.0065, .024, 0, -length - .011, -.007, rubber, finger).rotation.x = -.40;
    }
    const thumb = tube(.010, .047, side * .044, -.039, -.006, rubber, group); thumb.rotation.z = side * -.60;
    return group;
  }
  const shoulders: THREE.Group[] = [];
  const elbows: THREE.Group[] = [];
  const hands: THREE.Group[] = [];
  const hips: THREE.Group[] = [];
  const knees: THREE.Group[] = [];
  for (const side of [-1, 1]) {
    const shoulder = new THREE.Group(); shoulder.position.set(side * .258, 1.37, 0); root.add(shoulder); shoulders.push(shoulder); shoulder.name = side < 0 ? 'Left shoulder' : 'Right shoulder';
    const cap = ball(.09, 0, -.035, 0, cloth, shoulder, 32); cap.scale.set(.9, 1.15, 1);
    tube(.063, .27, 0, -.17, 0, cloth, shoulder, .075);
    rounded(.035, .05, .095, side * .065, -.055, 0, trim, shoulder, .008);
    const elbow = new THREE.Group(); elbow.position.y = -.31; shoulder.add(elbow); elbows.push(elbow);
    ball(.066, 0, 0, 0, webbing, elbow, 24);
    tube(.047, .26, 0, -.15, 0, cloth, elbow, .060);
    rounded(.105, .04, .104, 0, -.26, 0, webbing, elbow, .01);
    hands.push(hand(elbow, side));
    const hip = new THREE.Group(); hip.position.set(side * .122, .87, 0); root.add(hip); hips.push(hip); hip.name = side < 0 ? 'Left hip' : 'Right hip';
    tube(.09, .36, 0, -.18, 0, trouser, hip, .105);
    rounded(.105, .17, .035, side * .08, -.17, -.01, cloth, hip, .02);
    const knee = new THREE.Group(); knee.position.y = -.38; hip.add(knee); knees.push(knee);
    ball(.085, 0, 0, 0, trouser, knee, 24);
    rounded(.13, .15, .055, 0, -.01, -.07, rubber, knee, .03);
    tube(.067, .31, 0, -.19, 0, trouser, knee, .079);
    rounded(.17, .15, .31, 0, -.37, -.063, rubber, knee, .05);
    rounded(.174, .035, .31, 0, -.44, -.063, webbing, knee, .012);
    rounded(.13, .08, .13, 0, -.34, -.07, cloth, knee, .02);
    for (let i = 0; i < 4; i++) rounded(.11, .008, .008, 0, -.30 - i * .022, -.125 + i * .015, trim, knee, .002);
  }
  const radio = new THREE.Group(); hands[1].add(radio); radio.position.set(0, -.015, -.045); radio.rotation.x = -.12; radio.name = 'Handheld radio';
  rounded(.065, .14, .038, 0, 0, 0, rubber, radio, .011);
  rounded(.049, .040, .003, 0, .027, -.021, screenMaterial, radio, .004);
  for (let i = 0; i < 4; i++) rounded(.042, .004, .003, 0, -.022 - i * .009, -.022, metal, radio, .001);
  tube(.004, .11, -.02, .12, 0, rubber, radio);
  ball(.006, .022, .060, -.021, diodeMaterial, radio, 16);
  // The lowered prop is always present: handedness remains observable without microphone permission.
  radio.visible = true;
  const contactMaterial = new THREE.MeshBasicMaterial({ color: 0x071111, transparent: true, opacity: .24, depthWrite: false }); ownedMaterials.push(contactMaterial);
  const contactShadow = part(new THREE.CircleGeometry(.34, 40), contactMaterial);
  contactShadow.rotation.x = -Math.PI / 2; contactShadow.scale.y = .65; contactShadow.position.y = .009;
  contactShadow.castShadow = false; contactShadow.receiveShadow = false; contactShadow.name = 'Foot contact shadow';
  contactShadow.userData.keepSeparate = true;
  if (options.nameplate !== false && !options.local && !options.reflectionOnly) {
    const nameMaterial = new THREE.SpriteMaterial({ map: textMap([identity.name.slice(0, 18), `INSPECTEUR ${identity.slot + 1}`]), transparent: true, depthWrite: false });
    ownedMaterials.push(nameMaterial);
    const plate = new THREE.Sprite(nameMaterial); plate.position.y = 1.98; plate.scale.set(.78, .39, 1); root.add(plate);
  }
  // Preserve articulated joints while batching the rigid pieces of each bone.
  const boneGroups: THREE.Group[] = [];
  root.traverse(object => { if ((object as THREE.Group).isGroup) boneGroups.push(object as THREE.Group); });
  for (const bone of boneGroups.reverse()) {
    const batches = new Map<THREE.Material, THREE.Mesh[]>();
    for (const child of [...bone.children]) {
      const m = child as THREE.Mesh;
      if (!m.isMesh || Array.isArray(m.material) || m === visor || m.userData.keepSeparate) continue;
      const items = batches.get(m.material) || []; items.push(m); batches.set(m.material, items);
    }
    for (const [mat, pieces] of batches) if (pieces.length > 1) {
      const copies = pieces.map(piece => { piece.updateMatrix(); let geo = piece.geometry.clone(); if (geo.index) { const expanded = geo.toNonIndexed(); geo.dispose(); geo = expanded; } return geo.applyMatrix4(piece.matrix); });
      const merged = mergeGeometries(copies); copies.forEach(geo => geo.dispose());
      if (merged) { part(merged, mat, bone); pieces.forEach(piece => { bone.remove(piece); piece.geometry.dispose(); }); }
    }
  }
  for (const mat of ownedMaterials) if ('color' in mat) originalColors.set(mat, (mat as THREE.MeshStandardMaterial).color.clone());
  // The main camera excludes layer 1; reflector cameras include it.
  if (options.local) head.traverse(object => { if ((object as THREE.Mesh).isMesh) object.layers.set(1); });
  if (options.reflectionOnly) root.traverse(object => object.layers.set(1));
  let priorMannequin = false;
  function animate(state: InspectorAnimation) {
    const mannequin = !!state.mannequin;
    if (mannequin !== priorMannequin) {
      for (const [mat, original] of originalColors) (mat as THREE.MeshStandardMaterial).color.copy(mannequin ? new THREE.Color(0xc3bca6) : original);
      face.visible = !mannequin; visor.visible = !mannequin; priorMannequin = mannequin;
    }
    const tall = !!state.heightOffset;
    root.scale.set(tall ? 1.18 : 1, tall ? 1.48 : 1, tall ? 1.18 : 1);
    root.position.y = state.seated ? -.39 : state.noContact ? .20 : 0;
    contactShadow.position.y = (.009 - root.position.y) / root.scale.y;
    if (options.local) for (const group of [torso, ...shoulders]) group.traverse(object => { if ((object as THREE.Mesh).isMesh) object.layers.set(tall ? 1 : 0); });
    const code = state.badgeMissing ? '' : /^\d{2}$/.test(state.badgeCode || '') ? state.badgeCode! : ownBadgeCode;
    patchMat.map = badgeMap(code); badge.userData.code = code;
    const stride = mannequin || state.seated ? 0 : THREE.MathUtils.clamp(state.speed / 2.3, 0, 1.35);
    const cycle = state.time * (state.speed > 2.8 ? 11 : 8.2);
    for (let index = 0; index < 2; index++) {
      const step = Math.sin(cycle + index * Math.PI) * stride;
      hips[index].rotation.x = step * .53;
      knees[index].rotation.x = Math.max(0, -step) * .66;
      shoulders[index].rotation.x = -step * .36;
      shoulders[index].rotation.y = 0;
      shoulders[index].rotation.z = index === 0 ? .055 : -.055;
      elbows[index].rotation.x = -.10 - Math.max(0, step) * .15;
      hands[index].rotation.set(0, 0, 0);
    }
    torso.rotation.z = mannequin ? 0 : Math.sin(cycle) * stride * .015;
    head.rotation.set(mannequin ? 0 : (state.pitch || 0) * .4, state.independent ? Math.sin(state.time * .75) * .33 : 0, 0);
    root.updateMatrixWorld(true);
    for (const eye of eyes) {
      if (state.visorTarget && !mannequin) {
        const aim = eye.parent!.worldToLocal(state.visorTarget.clone()).sub(eye.position);
        eye.rotation.set(THREE.MathUtils.clamp(Math.atan2(aim.y, Math.hypot(aim.x, aim.z)), -.45, .45), THREE.MathUtils.clamp(Math.atan2(-aim.x, -aim.z), -1.0, 1.0), 0);
      } else eye.rotation.set(0, 0, 0);
    }
    visorMaterial.opacity = state.visorTarget ? .28 : .63;
    const usingRadio = !mannequin && (!!state.talking || !!state.radioSignal);
    const radioHand = state.handsSwap ? 0 : 1;
    if (radio.parent !== hands[radioHand]) hands[radioHand].add(radio);
    radio.visible = true;
    if (usingRadio) {
      shoulders[radioHand].rotation.set(1.60, radioHand ? .90 : -.90, radioHand ? -.15 : .15);
      elbows[radioHand].rotation.x = 1.10;
    }
    if (state.independent && !mannequin) {
      shoulders[1].rotation.set(2.25, 0, -.45);
      elbows[1].rotation.x = .35;
      hands[1].rotation.z = Math.sin(state.time * 4) * .30;
      radio.visible = false;
    }
    if (state.seated) {
      for (let index = 0; index < 2; index++) {
        hips[index].rotation.x = Math.PI / 2; knees[index].rotation.x = -Math.PI / 2;
        shoulders[index].rotation.set(.95, 0, index ? -.10 : .10); elbows[index].rotation.x = .35;
      }
      torso.rotation.z = 0; radio.visible = false;
    }
    screenMaterial.emissive.set(state.radioSignal ? 0xf24338 : 0x6eab86);
    diodeMaterial.color.set(state.radioSignal ? 0xff5143 : 0x7bd19c);
    diodeMaterial.emissive.set(state.radioSignal ? 0xff2116 : 0x56c281);
    diodeMaterial.emissiveIntensity = usingRadio ? 1.6 + Math.sin(state.time * (state.radioSignal ? 10 : 5)) * .5 : .4;
    // Raycasting can run before rendering; it must see the completed articulated pose.
    root.updateMatrixWorld(true);
  }
  function dispose() {
    if (disposed) return; disposed = true;
    const geometries = new Set<THREE.BufferGeometry>();
    root.traverse(object => { const m = object as THREE.Mesh; if (m.isMesh) geometries.add(m.geometry); });
    geometries.forEach(geometry => geometry.dispose()); ownedMaterials.forEach(mat => mat.dispose()); textures.forEach(map => map.dispose());
  }
  animate({ time: 0, speed: 0 });
  function setReflectionPass(enabled: boolean) {
    badge.scale.x = enabled ? -1 : 1;
    // A nested planar render updates matrices; restore them before the main pass continues.
    badge.updateMatrixWorld(true);
  }
  return { root, head, shoulders, elbows, hands, hips, knees, radio, badge, eyes, contactShadow, animate, setReflectionPass, dispose, identity: { ...identity } };
}

export type InspectorModel = ReturnType<typeof createInspector>;
