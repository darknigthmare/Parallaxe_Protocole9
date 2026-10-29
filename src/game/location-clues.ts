import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
import type { InspectionReading } from './inspection-data';

/** Original physical exhibits for the metro and clinic; no change to shared movement bounds. */
export function createLocationClues(id: 'metro' | 'clinic', links: { routePanel?: THREE.Mesh; bed?: THREE.Group }) {
  const root = new THREE.Group(); root.name = `${id} — témoins détaillés`;
  const targets: THREE.Object3D[] = [];
  const colliders: { x: number; z: number; rx: number; rz: number }[] = [];
  const materials: THREE.Material[] = [], textures: THREE.Texture[] = [];
  let effects = new Set<string>(), time = 0, disposed = false;
  let daylightStart: number | undefined, counterStart: number | undefined;
  const mat = (color: number, roughness = .65, metalness = 0) => { const m = new THREE.MeshStandardMaterial({ color, roughness, metalness }); materials.push(m); return m; };
  const steel = mat(0x849c9c, .28, .78), dark = mat(0x102426), enamel = mat(0x366361), cream = mat(0xc9d6c7);
  function mesh(g: THREE.BufferGeometry, m: THREE.Material, parent: THREE.Object3D = root) { const o = new THREE.Mesh(g, m); o.castShadow = true; o.receiveShadow = true; parent.add(o); return o; }
  function box(w: number, h: number, d: number, x: number, y: number, z: number, m: THREE.Material, parent: THREE.Object3D = root, radius = .012) {
    const o = mesh(new RoundedBoxGeometry(w, h, d, 2, Math.min(radius, w / 3, h / 3, d / 3)), m, parent); o.position.set(x, y, z); return o;
  }
  function tube(radius: number, height: number, x: number, y: number, z: number, parent: THREE.Object3D = root) {
    const o = mesh(new THREE.CylinderGeometry(radius, radius, height, 20), steel, parent); o.position.set(x, y, z); return o;
  }
  function tag(object: THREE.Object3D, target: string, label: string) { object.userData.inspect = { id: target, label }; targets.push(object); return object; }
  function canvasMap(draw: (ctx: CanvasRenderingContext2D, w: number, h: number) => void, width = 1024, height = 512) {
    const canvas = document.createElement('canvas'); canvas.width = width; canvas.height = height;
    draw(canvas.getContext('2d')!, width, height);
    const map = new THREE.CanvasTexture(canvas); map.colorSpace = THREE.SRGBColorSpace; textures.push(map); return map;
  }
  function textMap(lines: string[], bg = '#112c2b', ink = '#d2e0c3') {
    return canvasMap((ctx, w, h) => {
      ctx.fillStyle = bg; ctx.fillRect(0, 0, w, h); ctx.strokeStyle = '#527f71'; ctx.lineWidth = 5; ctx.strokeRect(12, 12, w - 24, h - 24);
      ctx.fillStyle = ink; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      lines.forEach((line, i) => { ctx.font = `${line.length > 28 ? 37 : line.length > 20 ? 43 : 60}px monospace`; ctx.fillText(line, w / 2, h * (i + .5) / lines.length); });
    });
  }
  function panel(w: number, h: number, x: number, y: number, z: number, map: THREE.Texture, parent: THREE.Object3D = root) {
    const m = new THREE.MeshStandardMaterial({ map, emissiveMap: map, emissive: 0xffffff, emissiveIntensity: .24, roughness: .65 }); materials.push(m);
    const o = mesh(new THREE.PlaneGeometry(w, h), m, parent); o.position.set(x, y, z); o.userData.keepSeparate = true; return o;
  }
  const swapMap = (object: THREE.Mesh, map: THREE.Texture) => { const m = object.material as THREE.MeshStandardMaterial; m.map = map; m.emissiveMap = map; };
  const wall = (z: number, x = 3.60) => { const g = new THREE.Group(); g.position.set(x, 0, z); g.rotation.y = x > 0 ? -Math.PI / 2 : Math.PI / 2; root.add(g); return g; };
  let timetable: THREE.Mesh | undefined, timetableNormal: THREE.Texture | undefined, timetableWrong: THREE.Texture | undefined;
  let routeNormal: THREE.Texture | undefined, routeWrong: THREE.Texture | undefined;
  let counter: THREE.Mesh | undefined, count = 0;
  const counterMaps = new Map<number, THREE.Texture>();
  let daylight: THREE.Group | undefined, daylightLight: THREE.PointLight | undefined;
  const skyMaterials: THREE.MeshBasicMaterial[] = [];
  let firstTag: THREE.Group | undefined, secondTag: THREE.Mesh | undefined, tagNormal: THREE.Texture | undefined, tagWrong: THREE.Texture | undefined;
  let bedShadow: THREE.Group | undefined;
  let flow: THREE.CatmullRomCurve3 | undefined;
  const drops: THREE.Mesh[] = [];

  if (id === 'metro') {
    const board = wall(-12.80);
    box(2.24, 1.02, .12, 0, 2.08, .05, dark, board, .025);
    for (const x of [-1.04, 1.04]) for (const y of [1.65, 2.52]) { const bolt = mesh(new THREE.SphereGeometry(.022, 12, 8), steel, board); bolt.position.set(x, y, .125); }
    timetableNormal = textMap(['ARCHIVES / SERVICE TERMINÉ', '01:09  T09  → OBSERVATOIRE', '01:12  T12  ← BELVÉDÈRE']);
    timetableWrong = textMap(['ARCHIVES / SERVICE TERMINÉ', '01:09  T09  → OBSERVATOIRE', '01:09  T09  ← BELVÉDÈRE']);
    timetable = panel(2.08, .86, 0, 2.08, .117, timetableNormal, board);
    tag(board, 'train', 'Tableau des départs archivés');
    function routeMap(extra: boolean) {
      return canvasMap((ctx, w, h) => {
        ctx.fillStyle = '#cbd2bd'; ctx.fillRect(0, 0, w, h); ctx.fillStyle = '#234740'; ctx.textAlign = 'left'; ctx.textBaseline = 'middle';
        ctx.font = '46px monospace'; ctx.fillText('LIGNE 09 · PLAN DE RÉFÉRENCE', 60, 56);
        const stations = extra ? ['BELVÉDÈRE', 'NULLE PART', 'OBSERVATOIRE', 'TERMINUS 09'] : ['BELVÉDÈRE', 'OBSERVATOIRE', 'TERMINUS 09'];
        ctx.strokeStyle = '#234740'; ctx.lineWidth = 12; ctx.beginPath(); ctx.moveTo(110, 142); ctx.lineTo(110, 434); ctx.stroke();
        stations.forEach((station, i) => { const y = 142 + i * 292 / (stations.length - 1); ctx.fillStyle = '#e3e4d3'; ctx.beginPath(); ctx.arc(110, y, 18, 0, Math.PI * 2); ctx.fill(); ctx.stroke(); ctx.fillStyle = '#173d36'; ctx.font = '49px monospace'; ctx.fillText(station, 160, y); });
      });
    }
    routeNormal = routeMap(false); routeWrong = routeMap(true);
    if (links.routePanel) swapMap(links.routePanel, routeNormal);

    // A locked, out-of-route gate makes the zero reference independent of real player crossings.
    const gate = new THREE.Group(); gate.position.set(-3.40, 0, 10.55); root.add(gate);
    colliders.push({ x: -3.40, z: 10.55, rx: .39, rz: .22 });
    for (const x of [-.33, .33]) { box(.095, 1.24, .11, x, .62, 0, steel, gate); box(.17, .04, .24, x, .025, 0, dark, gate); }
    box(.62, .08, .065, 0, .92, 0, enamel, gate);
    box(.62, .08, .065, 0, .47, 0, enamel, gate);
    const readout = new THREE.Group(); readout.rotation.y = Math.PI / 2; readout.position.set(.08, 1.42, 0); gate.add(readout);
    box(.82, .46, .09, 0, 0, 0, dark, readout);
    counterMaps.set(0, textMap(['PASSAGES / PORTIQUE SCELLÉ', '0000']));
    counter = panel(.75, .39, 0, 0, .051, counterMaps.get(0)!, readout);
    counter.userData.counterValue = 0; tag(gate, 'signal', 'Compteur du portique scellé');
    const lock = box(.13, .17, .09, 0, .89, .07, steel, gate, .018); lock.rotation.z = .14;

    // The portal is beyond the platform collision boundary. It is scenery, never a physical exit.
    const portal = new THREE.Group(); portal.position.set(-5.94, 0, -15.65); root.add(portal);
    const arch = mesh(new THREE.TorusGeometry(1.84, .12, 12, 64, Math.PI), steel, portal); arch.position.y = 1.0;
    for (const x of [-1.84, 1.84]) box(.24, 1.0, 3.2, x, .5, -1.5, dark, portal);
    box(3.54, 3.0, .04, 0, 1.45, -3.1, dark, portal);
    for (const x of [-1.3, -.65, 0, .65, 1.3]) box(.045, 2.7, .05, x, 1.35, -.12, steel, portal);
    box(3.4, .045, .05, 0, 1.25, -.1, steel, portal);
    daylight = new THREE.Group(); portal.add(daylight); daylight.name = 'Impossible daylight horizon'; daylight.visible = false;
    function skyMat(color: number) { const m = new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0, depthWrite: false }); materials.push(m); skyMaterials.push(m); return m; }
    const sky = mesh(new THREE.PlaneGeometry(3.52, 3.0), skyMat(0x9cceeb), daylight); sky.position.set(0, 1.45, -2.95);
    const sun = mesh(new THREE.CircleGeometry(.29, 48), skyMat(0xffe9b9), daylight); sun.position.set(.95, 2.34, -2.9);
    for (let layer = 0; layer < 3; layer++) {
      const shape = new THREE.Shape(); shape.moveTo(-1.76, 0); shape.lineTo(-1.76, .82 + layer * .18);
      for (let i = 0; i <= 7; i++) shape.lineTo(-1.76 + i * .503, .80 + Math.sin(i * 1.85 + layer) * .19 + layer * .18);
      shape.lineTo(1.76, 0); shape.closePath();
      const hill = mesh(new THREE.ShapeGeometry(shape), skyMat([0x507f72, 0x87aa91, 0xb7c4a1][layer]), daylight); hill.position.set(0, -.05, -2.60 - layer * .08);
    }
    daylightLight = new THREE.PointLight(0xe3f2dc, 0, 9, 2); daylightLight.position.set(0, 1.70, .7); portal.add(daylightLight);
    tag(portal, 'tracks', 'Tunnel fermé et horizon');
  } else {
    firstTag = new THREE.Group(); firstTag.position.set(-2.32, 0, -3.3); root.add(firstTag);
    box(.64, .25, .035, 0, 1.01, 1.072, steel, firstTag);
    panel(.59, .20, 0, 1.01, 1.093, textMap(['LIT 09 · EXPOSITION']), firstTag); tag(firstTag, 'bed', 'Plaque du lit 09');
    const room = new THREE.Group(); room.position.set(-5.2, 0, -12.25); root.add(room);
    box(1.22, .08, 1.84, 0, .59, 0, steel, room);
    box(.72, .13, .36, 0, .93, -.56, cream, room, .05);
    for (const x of [-.54, .54]) for (const z of [-.78, .78]) { tube(.025, .43, x, .34, z, room); const wheel = mesh(new THREE.TorusGeometry(.09, .022, 10, 24), dark, room); wheel.position.set(x, .13, z); wheel.rotation.y = Math.PI / 2; }
    for (const x of [-.60, .60]) { box(.035, .035, 1.65, x, 1.07, 0, steel, room); for (const z of [-.65, 0, .65]) tube(.013, .34, x, .90, z, room); }
    const plate = new THREE.Group(); plate.position.set(.65, 0, .15); plate.rotation.y = Math.PI / 2; room.add(plate);
    box(.76, .28, .035, 0, 1.0, 0, steel, plate);
    tagNormal = textMap(['LIT 10 · EXPOSITION']); tagWrong = textMap(['LIT 09 · EXPOSITION']);
    secondTag = panel(.70, .22, 0, 1.0, .021, tagNormal, plate); tag(room, 'bed', 'Lit de la salle vitrée');

    // An authored shadow projection, deliberately separate from dynamic player shadows.
    const projection = wall(-2.25, -3.70);
    const shadowMat = new THREE.MeshBasicMaterial({ color: 0x06191d, transparent: true, opacity: .70, depthWrite: false }); materials.push(shadowMat);
    for (const x of [-.76, .76]) box(.06, .72, .006, x, .56, .02, shadowMat, projection);
    box(1.85, .13, .006, 0, .96, .02, shadowMat, projection);
    bedShadow = new THREE.Group(); projection.add(bedShadow); bedShadow.name = 'Seated occupant shadow'; bedShadow.visible = false;
    const shape = new THREE.Shape(); shape.moveTo(-.25, 1.0); shape.lineTo(-.31, 1.85); shape.quadraticCurveTo(-.18, 2.12, .16, 2.0); shape.lineTo(.30, 1.25); shape.lineTo(.73, 1.16); shape.lineTo(.86, .61); shape.lineTo(.70, .57); shape.lineTo(.57, .99); shape.lineTo(-.25, 1.0);
    const body = mesh(new THREE.ShapeGeometry(shape, 16), shadowMat, bedShadow); body.position.z = .025;
    const head = mesh(new THREE.CircleGeometry(.18, 40), shadowMat, bedShadow); head.position.set(-.035, 2.18, .026); head.scale.y = 1.18;
    const arm = box(.13, .65, .007, .31, 1.63, .027, shadowMat, bedShadow, .04); arm.rotation.z = .43;
    tag(projection, 'bed', 'Ombre du lit vide');

    const demonstration = new THREE.Group(); demonstration.position.set(-3.2, 0, -4.5); root.add(demonstration);
    const tubeMat = new THREE.MeshPhysicalMaterial({ color: 0xb4d7ce, roughness: .12, transparent: true, opacity: .30, metalness: .1, side: THREE.DoubleSide }); materials.push(tubeMat);
    flow = new THREE.CatmullRomCurve3([new THREE.Vector3(.13, 1.71, .06), new THREE.Vector3(.16, 1.51, .08), new THREE.Vector3(.18, 1.09, .10), new THREE.Vector3(.31, .78, .19), new THREE.Vector3(.36, .53, .24)]);
    mesh(new THREE.TubeGeometry(flow, 64, .026, 12, false), tubeMat, demonstration);
    const chamber = mesh(new THREE.CylinderGeometry(.048, .040, .21, 24), tubeMat, demonstration); chamber.position.set(.15, 1.55, .08);
    const liquid = mat(0x65c6bb, .16); liquid.emissive.set(0x2e9c8d); liquid.emissiveIntensity = .40;
    for (let i = 0; i < 3; i++) { const drop = mesh(new THREE.SphereGeometry(.023, 16, 12), liquid, demonstration); drop.scale.y = 1.55; drop.name = `Demonstration drop ${i + 1}`; drop.userData.keepSeparate = true; drops.push(drop); }
    box(.43, .13, .30, .36, .46, .24, cream, demonstration, .035);
    const sign = new THREE.Group(); sign.position.set(.04, 2.29, .08); sign.rotation.y = Math.PI / 3; demonstration.add(sign);
    panel(.64, .23, 0, 0, 0, textMap(['DÉMONSTRATION', '↓ ÉCOULEMENT NORMAL']), sign);
    tag(demonstration, 'iv', 'Tube de démonstration — observez trois gouttes');
  }

  function setView(next: Set<string>) {
    if (next.has('metro_tunnel_daylight') && !effects.has('metro_tunnel_daylight')) daylightStart = undefined;
    if (next.has('metro_platform_count') && !effects.has('metro_platform_count')) counterStart = undefined;
    effects = next;
    if (timetable) swapMap(timetable, effects.has('metro_timetable_loop') ? timetableWrong! : timetableNormal!);
    if (links.routePanel && routeNormal) swapMap(links.routePanel, effects.has('metro_route_poster') ? routeWrong! : routeNormal);
    if (secondTag) swapMap(secondTag, effects.has('clinic_tag_echo') ? tagWrong! : tagNormal!);
    if (bedShadow) bedShadow.visible = effects.has('clinic_shadow_bed');
    if (daylight) daylight.visible = effects.has('metro_tunnel_daylight');
    if (!effects.has('metro_tunnel_daylight')) { skyMaterials.forEach(m => { m.opacity = 0; }); if (daylightLight) daylightLight.intensity = 0; }
    if (!effects.has('metro_platform_count') && counter) {
      const old = (counter.material as THREE.MeshStandardMaterial).map;
      if (old && old !== counterMaps.get(0)) { textures.splice(textures.indexOf(old), 1); old.dispose(); }
      count = 0; swapMap(counter, counterMaps.get(0)!); counter.userData.counterValue = 0;
    }
  }
  function update(nextTime: number) {
    time = nextTime;
    if (counter && effects.has('metro_platform_count')) {
      counterStart ??= time;
      const nextCount = Math.min(9999, Math.floor((time - counterStart) / 2.4));
      if (nextCount !== count) {
        count = nextCount;
        const old = (counter.material as THREE.MeshStandardMaterial).map;
        const map = textMap(['PASSAGES / PORTIQUE SCELLÉ', String(count).padStart(4, '0')]); swapMap(counter, map); counter.userData.counterValue = count;
        if (old && old !== counterMaps.get(0)) { textures.splice(textures.indexOf(old), 1); old.dispose(); }
      }
    }
    if (daylight && effects.has('metro_tunnel_daylight')) { daylightStart ??= time; const strength = THREE.MathUtils.clamp((time - daylightStart) / 2, 0, 1); skyMaterials.forEach(m => { m.opacity = strength; }); daylightLight!.intensity = strength * 13; daylight.userData.strength = strength; }
    if (firstTag && links.bed) firstTag.position.y = links.bed.position.y;
    if (flow) for (let i = 0; i < drops.length; i++) {
      const parameter = ((time * (effects.has('clinic_iv_reverse') ? -.22 : .22) + i / 3) % 1 + 1) % 1;
      drops[i].position.copy(flow.getPoint(parameter)); drops[i].userData.flowParameter = parameter;
    }
  }
  function dispose() {
    if (disposed) return; disposed = true;
    const geometries = new Set<THREE.BufferGeometry>(); root.traverse(object => { const o = object as THREE.Mesh; if (o.geometry) geometries.add(o.geometry); });
    geometries.forEach(g => g.dispose()); materials.forEach(m => m.dispose()); textures.forEach(t => t.dispose());
  }
  function getReading(target?: { id: string; label: string } | null): InspectionReading | null {
    if (!target) return null;
    const reading = (title: string, lines: string[]): InspectionReading => ({ title, location: id === 'metro' ? 'Terminus 09' : 'Aile blanche', lines });
    if (target.label === 'Tableau des départs archivés') return reading('Archives des départs', ['SERVICE TERMINÉ', '01:09 · T09 · → OBSERVATOIRE', effects.has('metro_timetable_loop') ? '01:09 · T09 · ← BELVÉDÈRE' : '01:12 · T12 · ← BELVÉDÈRE']);
    if (target.label === 'Plan de la ligne') return reading('Ligne 09', effects.has('metro_route_poster') ? ['BELVÉDÈRE', 'NULLE PART', 'OBSERVATOIRE', 'TERMINUS 09'] : ['BELVÉDÈRE', 'OBSERVATOIRE', 'TERMINUS 09']);
    if (target.label === 'Compteur du portique scellé') return reading('Portique scellé', ['PASSAGES', String(count).padStart(4, '0')]);
    if (target.label === 'Plaque du lit 09' || target.label === 'Lit de consultation') return reading('Plaque du lit de couloir', ['LIT 09 · EXPOSITION']);
    if (id === 'clinic' && (target.label === 'Lit de la salle vitrée' || target.label === 'Vitre de la salle d’observation')) return reading('Plaque du lit derrière la vitre', [effects.has('clinic_tag_echo') ? 'LIT 09 · EXPOSITION' : 'LIT 10 · EXPOSITION']);
    if (target.id === 'iv') return reading('Tube de démonstration', ['DÉMONSTRATION', '↓ ÉCOULEMENT NORMAL']);
    return null;
  }
  setView(new Set()); update(0);
  return { root, targets, colliders, setView, update, getReading, dispose };
}
