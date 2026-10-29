import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
import { Reflector } from 'three/addons/objects/Reflector.js';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import { createInspector, type InspectorIdentity, type InspectorModel } from './avatar';
import { createLocation, reflectiveGlass, type LocationWorld } from './locations';

/** Original procedural environment. No downloaded models or textures are required. */
export type SceneInput = { forward: number; strafe: number; lookX?: number; lookY?: number; sprint?: boolean };
export type ScenePose = { x: number; y: number; z: number; yaw: number; pitch: number };
export type PersonalView = { effects?: string[]; variant?: number; phase?: string; loop?: number; relayCode?: string; levelId?: 'hotel' | 'metro' | 'clinic'; arrowDirection?: 'left' | 'right'; syncTime?: string };
export const SCENE_EFFECTS = [
  'clock_reverse', 'clock_missing', 'portrait_eyes', 'portrait_empty', 'door_number', 'door_open',
  'plant_dead', 'plant_tall', 'trolley_missing', 'red_light', 'blackout', 'shadow_figure',
  'ceiling_eyes', 'floor_trail', 'exit_false', 'chair_float', 'mirror_stranger', 'phone_float',
  'window_watcher', 'wall_message', 'corridor_fog', 'duplicate_chair', 'blood_handprint', 'missing_reflection', 'relay_mismatch',
  'reflection_delay', 'reflection_absent', 'reflection_independent', 'avatar_mannequin', 'avatar_double', 'avatar_shadow', 'radio_signal',
  'metro_train', 'metro_destination', 'metro_signal', 'metro_tracks', 'clinic_bed', 'clinic_monitor', 'clinic_curtain', 'clinic_wheelchair',
  'ceiling_lower', 'wall_pulse', 'luggage_breath', 'curtain_breath', 'clinic_bed_count', 'metro_shadow_train', 'paired_arrow', 'paired_clock',
] as const;

export function createScene(canvas: HTMLCanvasElement, opts: {
  onInteract?: (target: string) => void; onReady?: () => void;
} = {}) {
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: false, powerPreference: 'high-performance' });
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.35;
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  renderer.setClearColor(0x0b1719, 1);
  const scene = new THREE.Scene();
  scene.background = new THREE.Color(0x0b1719);
  scene.fog = new THREE.FogExp2(0x142326, .013);
  const pmrem = new THREE.PMREMGenerator(renderer);
  const environmentRoom = new RoomEnvironment();
  const environmentTarget = pmrem.fromScene(environmentRoom, .04);
  scene.environment = environmentTarget.texture; scene.environmentIntensity = .28;
  environmentRoom.dispose(); pmrem.dispose();
  const camera = new THREE.PerspectiveCamera(65, 1, .06, 65);
  camera.rotation.order = 'YXZ';
  const world = new THREE.Group();
  world.name = 'Saint-Clair — hôtel';
  scene.add(world);
  const hotelLights = new THREE.Group(); hotelLights.name = 'Éclairage Saint-Clair'; scene.add(hotelLights);
  const commonWorld = new THREE.Group(); commonWorld.name = 'Effets communs aux trois lieux'; scene.add(commonWorld);
  let levelId: 'hotel' | 'metro' | 'clinic' = 'hotel';
  let extraWorlds: Record<'metro' | 'clinic', LocationWorld>;
  const textures: THREE.Texture[] = [];
  const targets: THREE.Object3D[] = [];
  const lightSources: { light: THREE.PointLight | THREE.SpotLight; base: number; color: THREE.Color }[] = [];
  const lightPanels: THREE.Mesh[] = [];
  const anomalyRoots = new Map<string, THREE.Object3D>();
  const occluders: { x: number; z: number; rx: number; rz: number }[] = [];
  const pose: ScenePose = { x: 0, y: 1.67, z: 9, yaw: 0, pitch: 0 };
  let input: SceneInput = { forward: 0, strafe: 0 };
  let active = false;
  let alive = true;
  let elapsed = 0;
  let quality: 'low' | 'medium' | 'high' = 'high';
  let effects = new Set<string>();
  let phase = 'menu';
  let loop = 0;
  let currentWidth = 0;
  let currentHeight = 0;
  let flashlightOn = false;
  let frame = 0;
  let target: { id: string; label: string } | null = null;
  let shaderCompiled = false;
  let disposed = false;
  let relayCode = '0909';
  let arrowDirection: 'left' | 'right' = 'right';
  let syncTime = '03:09';
  let talking = false;
  let selfIdentity: InspectorIdentity = { id: 'local', name: 'Inspecteur', slot: 0 };
  let selfAvatar = createInspector(selfIdentity, { local: true });
  let reflectionAvatar = createInspector(selfIdentity, { reflectionOnly: true, nameplate: false });
  let doubleAvatar = createInspector(selfIdentity, { nameplate: false });
  scene.add(selfAvatar.root, reflectionAvatar.root, doubleAvatar.root);
  reflectionAvatar.root.visible = false; doubleAvatar.root.visible = false;
  const poseHistory: { time: number; pose: ScenePose; speed: number; talking: boolean }[] = [];
  const raycaster = new THREE.Raycaster();
  const center = new THREE.Vector2(0, 0);
  const vector = new THREE.Vector3();
  const peerGroup = new THREE.Group();
  scene.add(peerGroup);
  const peers = new Map<string, { group: THREE.Group; model: InspectorModel; target: ScenePose; name: string; talking: boolean; slot: number }>();

  // Textures are procedural and deterministic: a reference passage never changes by accident.
  function seeded(seed = 8941) {
    return () => { seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0; return seed / 4294967296; };
  }
  function texture(draw: (ctx: CanvasRenderingContext2D, size: number) => void, size = 512) {
    const c = document.createElement('canvas');
    c.width = c.height = size;
    const ctx = c.getContext('2d')!;
    draw(ctx, size);
    const result = new THREE.CanvasTexture(c);
    result.colorSpace = THREE.SRGBColorSpace;
    result.anisotropy = Math.min(renderer.capabilities.getMaxAnisotropy(), 8);
    textures.push(result);
    return result;
  }
  function labelTexture(text: string, color = '#e8d6ac', background = '#153031', size = 256) {
    return texture((ctx, s) => {
      ctx.fillStyle = background; ctx.fillRect(0, 0, s, s);
      ctx.fillStyle = color; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      ctx.font = `500 ${Math.floor(s * (text.length > 10 ? .084 : text.length > 5 ? .13 : .28))}px sans-serif`;
      const lines = text.split('\n');
      lines.forEach((line, i) => ctx.fillText(line, s / 2, s / 2 + (i - (lines.length - 1) / 2) * s * .18));
    }, size);
  }
  function relayTexture(code: string) {
    return texture((ctx, s) => {
      ctx.fillStyle = '#102520'; ctx.fillRect(0, 0, s, s);
      ctx.strokeStyle = '#41695a'; ctx.lineWidth = 2; ctx.strokeRect(s * .05, s * .08, s * .90, s * .84);
      ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillStyle = '#8cae9d';
      ctx.font = `500 ${s * .085}px monospace`; ctx.fillText('RELAIS', s / 2, s * .28);
      ctx.fillStyle = '#d4f6d9'; ctx.font = `500 ${s * .29}px monospace`; ctx.fillText(code, s / 2, s * .61);
    }, 512);
  }
  const woodMap = texture((ctx, s) => {
    ctx.fillStyle = '#413026'; ctx.fillRect(0, 0, s, s);
    const rand = seeded(42);
    for (let i = 0; i < 1200; i++) {
      const x = rand() * s;
      ctx.strokeStyle = `rgba(${rand() > .5 ? '138,105,72' : '13,9,7'},${.02 + rand() * .12})`;
      ctx.lineWidth = .5 + rand() * 2.5;
      ctx.beginPath(); ctx.moveTo(x, 0);
      for (let y = 0; y <= s; y += 8) ctx.lineTo(x + Math.sin(y * .017 + x) * 4, y);
      ctx.stroke();
    }
  });
  woodMap.wrapS = woodMap.wrapT = THREE.RepeatWrapping;
  const stoneMap = texture((ctx, s) => {
    const rand = seeded(99);
    ctx.fillStyle = '#938b76'; ctx.fillRect(0, 0, s, s);
    for (let i = 0; i < 12000; i++) {
      const value = Math.floor(60 + rand() * 130);
      ctx.fillStyle = `rgba(${value},${value},${value},.045)`;
      ctx.fillRect(rand() * s, rand() * s, 1 + rand() * 3, 1 + rand() * 3);
    }
    for (let i = 0; i < 22; i++) {
      ctx.strokeStyle = 'rgba(32,40,37,.04)'; ctx.lineWidth = rand() * 4 + 1;
      ctx.beginPath(); let x = rand() * s; ctx.moveTo(x, 0);
      for (let y = 0; y < s; y += 15) { x += rand() * 35 - 17.5; ctx.lineTo(x, y); }
      ctx.stroke();
    }
  });
  stoneMap.wrapS = stoneMap.wrapT = THREE.RepeatWrapping;
  stoneMap.repeat.set(2, 2);
  const floorMap = texture((ctx, s) => {
    const rand = seeded(23);
    ctx.fillStyle = '#192628'; ctx.fillRect(0, 0, s, s);
    for (let y = 0; y < 4; y++) for (let x = 0; x < 4; x++) {
      const q = 35 + rand() * 17;
      ctx.fillStyle = `rgb(${q},${q + 11},${q + 9})`;
      ctx.fillRect(x * s / 4 + 1, y * s / 4 + 1, s / 4 - 2, s / 4 - 2);
      ctx.strokeStyle = 'rgba(218,200,165,.12)';
      ctx.strokeRect(x * s / 4 + 1, y * s / 4 + 1, s / 4 - 2, s / 4 - 2);
    }
    for (let i = 0; i < 6000; i++) {
      ctx.fillStyle = `rgba(210,210,190,${rand() * .045})`;
      ctx.fillRect(rand() * s, rand() * s, 2, 1);
    }
  });
  floorMap.wrapS = floorMap.wrapT = THREE.RepeatWrapping; floorMap.repeat.set(2, 7);
  const rugMap = texture((ctx, s) => {
    const rand = seeded(31);
    ctx.fillStyle = '#343f37'; ctx.fillRect(0, 0, s, s);
    ctx.fillStyle = '#8b8060'; ctx.fillRect(8, 0, 15, s); ctx.fillRect(s - 23, 0, 15, s);
    ctx.fillStyle = '#171f1c'; ctx.fillRect(28, 0, 4, s); ctx.fillRect(s - 32, 0, 4, s);
    ctx.strokeStyle = 'rgba(163,149,100,.24)'; ctx.lineWidth = 1.5;
    for (let y = -40; y < s + 40; y += 64) for (let x = 64; x < s - 40; x += 64) {
      ctx.beginPath(); ctx.moveTo(x, y - 24); ctx.lineTo(x + 16, y); ctx.lineTo(x, y + 24); ctx.lineTo(x - 16, y); ctx.closePath(); ctx.stroke();
    }
    for (let i = 0; i < 11000; i++) { ctx.fillStyle = `rgba(${rand() > .5 ? '210,210,190' : '0,0,0'},.075)`; ctx.fillRect(rand() * s, rand() * s, 1, 3); }
  });
  rugMap.wrapT = THREE.RepeatWrapping; rugMap.repeat.set(1, 8);
  const mats = {
    wall: new THREE.MeshStandardMaterial({ color: 0xc9be9e, map: stoneMap, roughness: .94 }),
    stone: new THREE.MeshStandardMaterial({ color: 0xa6a390, map: stoneMap, roughness: .66 }),
    floor: new THREE.MeshStandardMaterial({ color: 0xffffff, map: floorMap, roughness: .25, metalness: .12 }),
    wood: new THREE.MeshStandardMaterial({ color: 0x9e7955, map: woodMap, roughness: .42 }),
    woodDark: new THREE.MeshStandardMaterial({ color: 0x4b3328, map: woodMap, roughness: .48 }),
    brass: new THREE.MeshStandardMaterial({ color: 0xb99b5f, roughness: .28, metalness: .84 }),
    black: new THREE.MeshStandardMaterial({ color: 0x070e0e, roughness: .57 }),
    darkMetal: new THREE.MeshStandardMaterial({ color: 0x1c2927, metalness: .85, roughness: .33 }),
    fabric: new THREE.MeshStandardMaterial({ color: 0x665a37, roughness: .98 }),
    redFabric: new THREE.MeshStandardMaterial({ color: 0x523b2d, roughness: .94 }),
    cream: new THREE.MeshStandardMaterial({ color: 0xc2b89a, roughness: .8 }),
    porcelain: new THREE.MeshStandardMaterial({ color: 0xa0b7ae, roughness: .23 }),
    glow: new THREE.MeshStandardMaterial({ color: 0xffe3a8, emissive: 0xffc878, emissiveIntensity: 2 }),
    tealGlow: new THREE.MeshStandardMaterial({ color: 0x8ab5ae, emissive: 0x4d9ca2, emissiveIntensity: .9 }),
  };
  function mesh(geometry: THREE.BufferGeometry, material: THREE.Material | THREE.Material[], parent: THREE.Object3D = world) {
    const m = new THREE.Mesh(geometry, material); m.castShadow = true; m.receiveShadow = true; parent.add(m); return m;
  }
  function box(w: number, h: number, d: number, x: number, y: number, z: number, mat: THREE.Material = mats.wood, parent: THREE.Object3D = world, bevel = 0) {
    const g = bevel > 0 ? new RoundedBoxGeometry(w, h, d, 3, Math.min(bevel, w / 3, h / 3, d / 3)) : new THREE.BoxGeometry(w, h, d);
    const m = mesh(g, mat, parent); m.position.set(x, y, z); return m;
  }
  function cylinder(radius: number, height: number, x: number, y: number, z: number, mat: THREE.Material, parent: THREE.Object3D = world, top = radius, segments = 48) {
    const m = mesh(new THREE.CylinderGeometry(top, radius, height, segments, 2), mat, parent); m.position.set(x, y, z); return m;
  }
  function sphere(r: number, x: number, y: number, z: number, mat: THREE.Material, parent: THREE.Object3D = world, segments = 32) {
    const m = mesh(new THREE.SphereGeometry(r, segments, Math.max(12, segments / 2)), mat, parent); m.position.set(x, y, z); return m;
  }
  function tag(object: THREE.Object3D, id: string, label: string) {
    object.userData.inspect = { id, label }; targets.push(object); return object;
  }
  function panel(w: number, h: number, x: number, y: number, z: number, map: THREE.Texture, parent: THREE.Object3D = world, emissive = 0) {
    const mat = new THREE.MeshStandardMaterial({ map, roughness: .68, emissive: 0xffffff, emissiveMap: map, emissiveIntensity: emissive });
    const m = mesh(new THREE.PlaneGeometry(w, h), mat, parent); m.position.set(x, y, z); return m;
  }
  function anomaly(key: string, object: THREE.Object3D) { object.visible = false; anomalyRoots.set(key, object); return object; }
  function wallGroup(side: number, z: number, y = 0) {
    const group = new THREE.Group(); group.position.set(side * 3.62, y, z); group.rotation.y = -side * Math.PI / 2; world.add(group); return group;
  }
  function pointLight(x: number, y: number, z: number, intensity: number, color = 0xffd69b, distance = 10) {
    const light = new THREE.PointLight(color, intensity, distance, 2); light.position.set(x, y, z); hotelLights.add(light);
    lightSources.push({ light, base: intensity, color: light.color.clone() }); return light;
  }
  function obstacle(x: number, z: number, rx: number, rz: number) { occluders.push({ x, z, rx, rz }); }
  function torus(radius: number, tube: number, x: number, y: number, z: number, mat: THREE.Material, parent: THREE.Object3D = world) {
    const m = mesh(new THREE.TorusGeometry(radius, tube, 16, 64), mat, parent); m.position.set(x, y, z); return m;
  }
  function batchGroup(group: THREE.Group) {
    const batches = new Map<THREE.Material, THREE.Mesh[]>();
    for (const child of [...group.children]) {
      const item = child as THREE.Mesh;
      if (!item.isMesh || item.userData.inspect || Array.isArray(item.material)) continue;
      const batch = batches.get(item.material) || []; batch.push(item); batches.set(item.material, batch);
    }
    for (const [material, items] of batches) {
      if (items.length < 3) continue;
      const geometries = items.map(item => {
        item.updateMatrix(); let geometry = item.geometry.clone();
        if (geometry.index) { const expanded = geometry.toNonIndexed(); geometry.dispose(); geometry = expanded; }
        return geometry.applyMatrix4(item.matrix);
      });
      const geometry = mergeGeometries(geometries, false); geometries.forEach(g => g.dispose());
      if (geometry) { const result = mesh(geometry, material, group); result.name = 'Batched prop'; items.forEach(item => group.remove(item)); }
    }
  }

  // Architectural shell and long, repeated sightlines.
  box(7.6, .18, 28.4, 0, -.09, -2, mats.floor);
  const runner = mesh(new THREE.PlaneGeometry(2.6, 25.7), new THREE.MeshStandardMaterial({ map: rugMap, roughness: .99 }));
  runner.rotation.x = -Math.PI / 2; runner.position.set(0, .006, -1.2);
  tag(runner, 'floor', 'Le tapis et le sol');
  box(.22, 3.6, 28.4, -3.85, 1.8, -2, mats.wall);
  box(.22, 3.6, 28.4, 3.85, 1.8, -2, mats.wall);
  box(7.8, .16, 28.4, 0, 3.6, -2, mats.stone);
  box(7.6, 3.6, .25, 0, 1.8, -16, mats.wall);
  box(7.6, 3.6, .25, 0, 1.8, 12.1, mats.wall);
  for (const side of [-1, 1]) {
    box(.06, 1.04, 28, side * 3.707, .55, -2, mats.woodDark);
    for (const y of [.11, .96, 1.09, 3.35]) box(.09, .045, 28, side * 3.65, y, -2, mats.brass);
    box(.12, .12, 28, side * 3.66, 3.43, -2, mats.wood);
    for (let z = -15.5; z < 12; z += 1.4) {
      box(.035, .81, .035, side * 3.64, .53, z, mats.brass);
      box(.055, 2.19, .11, side * 3.65, 2.23, z, mats.stone);
    }
  }
  for (let z = -14.3; z <= 10; z += 4.1) {
    box(7.35, .12, .13, 0, 3.46, z, mats.woodDark);
    for (const side of [-1, 1]) box(.10, 3.36, .18, side * 3.61, 1.69, z, mats.woodDark);
    const fixture = box(1.6, .035, .32, 0, 3.45, z - 1.5, mats.glow);
    fixture.castShadow = false; lightPanels.push(fixture);
    box(1.82, .06, .48, 0, 3.50, z - 1.5, mats.darkMetal);
    pointLight(0, 3.12, z - 1.5, 17, 0xffdca1, 8.5);
  }
  // Recessed perimeter lighting and brass grilles.
  for (const side of [-1, 1]) {
    box(.025, .025, 27.6, side * 3.47, 3.34, -2, mats.glow).castShadow = false;
    for (let z = -11; z < 10; z += 7) {
      const g = wallGroup(side, z); box(.54, .18, .02, 0, 3.02, .06, mats.darkMetal, g);
      for (let j = 0; j < 7; j++) box(.46, .008, .03, 0, 2.96 + j * .02, .08, mats.brass, g);
    }
  }
  const hemi = new THREE.HemisphereLight(0xa6c7d0, 0x4f3b27, .68); scene.add(hemi);
  const moon = new THREE.DirectionalLight(0x89c1d0, 1.9); moon.position.set(-6, 6, -14); moon.target.position.set(0, 0, -7);
  moon.castShadow = true; moon.shadow.mapSize.set(2048, 2048);
  Object.assign(moon.shadow.camera, { left: -10, right: 10, top: 18, bottom: -18, near: .5, far: 45 });
  moon.shadow.bias = -.0005; moon.shadow.normalBias = .03; scene.add(moon, moon.target);
  moon.shadow.camera.layers.enable(1);

  // Four fully modelled inspection doors.
  const doorLeaves: THREE.Group[] = [];
  const doorNumberMaterials: THREE.MeshStandardMaterial[] = [];
  const doorNumberMaps: THREE.Texture[] = [];
  const wrongNumberMap = labelTexture('909', '#ddc797', '#282e25');
  const doorZ = [0, -9.4];
  for (let i = 0; i < 4; i++) {
    const side = i % 2 === 0 ? -1 : 1;
    const group = wallGroup(side, doorZ[Math.floor(i / 2)]);
    box(1.62, 2.77, .15, 0, 1.385, 0, mats.woodDark, group);
    box(1.41, 2.55, .04, 0, 1.30, .09, mats.black, group);
    for (const x of [-.745, .745]) box(.08, 2.71, .18, x, 1.38, .13, mats.brass, group, .015);
    box(1.57, .08, .18, 0, 2.70, .13, mats.brass, group);
    const pivot = new THREE.Group(); pivot.position.set(-.69, 0, .17); group.add(pivot); doorLeaves.push(pivot);
    box(1.36, 2.54, .10, .68, 1.30, 0, mats.wood, pivot, .02);
    box(1.13, 1.48, .025, .68, 1.46, .065, mats.woodDark, pivot, .01);
    for (const x of [.10, 1.26]) box(.018, 2.35, .02, x, 1.30, .07, mats.brass, pivot);
    box(.07, .30, .04, 1.20, 1.14, .10, mats.brass, pivot, .01);
    box(.18, .045, .07, 1.13, 1.20, .145, mats.brass, pivot, .015);
    cylinder(.022, .09, 1.20, 1.06, .145, mats.black, pivot, .022, 24).rotation.x = Math.PI / 2;
    const nmap = labelTexture(String(901 + i), '#ddc797', '#282e25'); doorNumberMaps.push(nmap);
    const num = panel(.36, .24, .68, 2.31, .074, nmap, pivot, .13); doorNumberMaterials.push(num.material as THREE.MeshStandardMaterial);
    tag(group, 'door', `Porte ${901 + i}`);
    const sconce = new THREE.Group(); sconce.position.set(1.18, 2.13, .1); group.add(sconce);
    box(.12, .52, .05, 0, 0, 0, mats.brass, sconce, .015);
    cylinder(.075, .36, 0, 0, .13, mats.glow, sconce, .075, 32);
    box(.19, .035, .20, 0, -.20, .11, mats.brass, sconce);
    box(.19, .035, .20, 0, .20, .11, mats.brass, sconce);
    pointLight(side * 3.12, 2.13, doorZ[Math.floor(i / 2)] + side * 1.18, 4.5, 0xffca85, 4);
  }

  // A tiled threshold and teal exit door terminate the procession.
  box(1.94, 2.95, .2, 0, 1.475, -15.78, mats.brass);
  box(1.77, 2.82, .23, 0, 1.41, -15.61, new THREE.MeshStandardMaterial({ color: 0x1e4a48, metalness: .22, roughness: .35 }), world, .035);
  box(.035, 2.65, .025, 0, 1.4, -15.47, mats.brass);
  for (const x of [-.47, .47]) {
    box(.65, 1.02, .035, x, 1.84, -15.47, mats.tealGlow, world, .02);
    box(.05, .48, .11, x * .35, 1.05, -15.42, mats.brass, world, .02);
  }
  const exitMap = labelTexture('SORTIE\n↑ 09', '#dcffe7', '#164c3d');
  const falseExitMap = labelTexture('NE SORTEZ\nPAS', '#ffd9c9', '#511c1b');
  box(1.34, .37, .12, 0, 3.1, -15.78, mats.black, world, .03);
  const exitSign = panel(1.24, .31, 0, 3.1, -15.70, exitMap, world, 1.9);
  tag(exitSign, 'exit', 'Signalisation du sas');
  const endLamp = pointLight(0, 2.6, -14.1, 21, 0x89cfca, 8);
  const endDoor = new THREE.Group(); world.add(endDoor); endDoor.position.set(0, 1.3, -15.35);
  const exitCollider = box(1.9, 2.8, .08, 0, 0, 0, new THREE.MeshBasicMaterial({ visible: false }), endDoor);
  tag(exitCollider, 'exit', 'Le sas de diagnostic');
  const terminal = new THREE.Group(); world.add(terminal); terminal.position.set(0, 0, -12.9);
  box(.64, .10, .52, 0, .05, 0, mats.darkMetal, terminal, .04);
  box(.14, .93, .14, 0, .53, 0, mats.brass, terminal, .02);
  const terminalHead = new THREE.Group(); terminalHead.position.set(0, 1.07, .04); terminalHead.rotation.x = -.40; terminal.add(terminalHead);
  box(.72, .46, .055, 0, 0, 0, mats.darkMetal, terminalHead, .025);
  panel(.64, .37, 0, 0, .029, labelTexture('PROTOCOL 09\nDIAGNOSTIC', '#a6d9c2', '#112922'), terminalHead, .8);
  tag(terminal, 'exit', 'Terminal de diagnostic — E'); obstacle(0, -12.9, .42, .32);

  // Reception counter with fluted walnut, paperwork and a proper handset.
  const desk = new THREE.Group(); desk.position.set(2.52, 0, 7.72); world.add(desk);
  box(1.84, 1.02, .74, 0, .54, 0, mats.woodDark, desk, .06);
  for (let x = -.84; x <= .85; x += .085) cylinder(.025, .83, x, .54, .385, mats.wood, desk, .025, 12);
  box(1.98, .085, .91, 0, 1.075, 0, mats.stone, desk, .035);
  box(1.78, .045, .04, 0, .15, .42, mats.brass, desk);
  panel(.52, .16, 0, .66, .41, labelTexture('RÉCEPTION', '#c4b584', '#352f24'), desk, .1);
  box(.34, .014, .25, -.50, 1.13, -.03, mats.cream, desk).rotation.y = -.21;
  box(.31, .006, .23, -.48, 1.14, -.02, mats.cream, desk).rotation.y = -.16;
  cylinder(.052, .14, .60, 1.19, -.10, mats.brass, desk, .052, 32);
  for (let i = 0; i < 3; i++) cylinder(.006, .23, .59 + i * .015, 1.30, -.10, mats.darkMetal, desk, .006, 8).rotation.z = -.16 + i * .13;
  obstacle(2.52, 7.72, 1.10, .55);
  const phone = new THREE.Group(); phone.position.set(2.56, 1.14, 7.65); world.add(phone);
  box(.35, .09, .25, 0, .02, 0, mats.black, phone, .035);
  const phoneReceiver = new THREE.Group(); phoneReceiver.position.y = .11; phone.add(phoneReceiver);
  box(.31, .04, .06, 0, .025, .015, mats.darkMetal, phoneReceiver, .015);
  for (const side of [-1, 1]) {
    const earpiece = sphere(.056, side * .135, 0, .015, mats.black, phoneReceiver, 32); earpiece.scale.set(1, .55, 1.3);
  }
  for (let x = 0; x < 3; x++) for (let y = 0; y < 4; y++) box(.022, .004, .018, -.027 + x * .027, .070, -.04 + y * .022, mats.cream, phone, .002);
  const cordPath: THREE.Vector3[] = [];
  for (let i = 0; i < 120; i++) cordPath.push(new THREE.Vector3(-.20 + Math.cos(i * .9) * .012, .07 - i * .0015, -.03 + Math.sin(i * .9) * .012 + i * .001));
  mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(cordPath), 160, .003, 6, false), mats.black, phone);
  tag(phone, 'phone', 'Téléphone de la réception');
  const relay = new THREE.Group(); relay.position.set(3.11, 1.32, 7.76); relay.rotation.x = -.18; world.add(relay);
  box(.57, .36, .045, 0, 0, 0, mats.darkMetal, relay, .025);
  const relayDisplay = panel(.52, .31, 0, 0, .026, relayTexture('0909'), relay, .75);
  tag(relay, 'radio', 'Relais de calibration — comparez le code');

  // Upholstered lounge seating: rounded cushions, piping, buttons and wood supports.
  function makeChair(x: number, z: number, angle: number, duplicate = false) {
    const g = new THREE.Group(); g.position.set(x, 0, z); g.rotation.y = angle; world.add(g);
    for (const xx of [-.38, .38]) for (const zz of [-.35, .35]) cylinder(.035, .26, xx, .15, zz, mats.woodDark, g, .028, 24);
    box(.89, .17, .82, 0, .32, 0, mats.woodDark, g, .055);
    box(.77, .21, .73, 0, .46, .03, mats.fabric, g, .085);
    const back = box(.84, .80, .20, 0, .81, -.33, mats.fabric, g, .085); back.rotation.x = -.10;
    for (const xx of [-.49, .49]) {
      box(.17, .32, .82, xx, .61, 0, mats.fabric, g, .06);
      box(.18, .055, .70, xx, .79, .025, mats.wood, g, .025);
    }
    for (const xx of [-.24, 0, .24]) for (const yy of [.69, .91]) sphere(.015, xx, yy, -.218, mats.woodDark, g, 16);
    const piping = new THREE.Group(); g.add(piping);
    for (const xx of [-.37, .37]) box(.008, .008, .63, xx, .545, .03, mats.brass, piping);
    box(.74, .008, .008, 0, .545, .343, mats.brass, piping);
    if (!duplicate) { tag(g, 'chair', 'Fauteuil du salon'); obstacle(x, z, .60, .61); }
    return g;
  }
  const floatingChair = makeChair(-2.53, 2.65, Math.PI * .18);
  makeChair(2.59, -7.10, -Math.PI * .37);
  const duplicateChair = makeChair(-.85, -5.5, Math.PI * .15, true); anomaly('duplicate_chair', duplicateChair); tag(duplicateChair, 'chair', 'Fauteuil au milieu du couloir');
  const sideTable = new THREE.Group(); world.add(sideTable); sideTable.position.set(-2.72, 0, 4.3);
  cylinder(.37, .045, 0, .68, 0, mats.stone, sideTable, .37, 64);
  cylinder(.035, .63, 0, .35, 0, mats.brass, sideTable, .035, 32);
  cylinder(.26, .035, 0, .04, 0, mats.darkMetal, sideTable, .26, 48);
  const radio = new THREE.Group(); sideTable.add(radio); radio.position.set(0, .73, 0);
  box(.39, .23, .16, 0, .08, 0, mats.wood, radio, .025);
  box(.22, .15, .008, -.05, .08, .09, mats.darkMetal, radio, .01);
  for (let i = 0; i < 10; i++) box(.21, .004, .008, -.05, .02 + i * .013, .098, mats.brass, radio);
  for (let y = 0; y < 2; y++) cylinder(.029, .024, .13, .025 + y * .105, .102, mats.brass, radio, .029, 32).rotation.x = Math.PI / 2;
  cylinder(.004, .36, .13, .36, -.03, mats.brass, radio, .004, 12).rotation.z = -.18;
  tag(radio, 'radio', 'Radio — fréquence 09'); obstacle(-2.72, 4.3, .45, .45);

  // Plant geometry uses bent leaves, lathed planters, stems, soil and stone grains.
  const plantLeafMat = new THREE.MeshStandardMaterial({ color: 0x2c5635, roughness: .73, side: THREE.DoubleSide });
  const deadLeafMat = new THREE.MeshStandardMaterial({ color: 0x493325, roughness: .99, side: THREE.DoubleSide });
  function leafGeometry(length: number, width: number) {
    const geo = new THREE.PlaneGeometry(width, length, 8, 20);
    const p = geo.attributes.position;
    for (let i = 0; i < p.count; i++) {
      const y = p.getY(i); const t = THREE.MathUtils.clamp((y + length / 2) / length, 0, 1);
      const curve = Math.max(0, Math.sin(t * Math.PI));
      p.setXYZ(i, p.getX(i) * curve ** .7, y + length / 2, curve * length * .22 + Math.abs(p.getX(i)) * .22);
    }
    geo.computeVertexNormals(); return geo;
  }
  const leafGeo = leafGeometry(.66, .23);
  const plants: { group: THREE.Group; foliage: THREE.Group; leaves: THREE.Mesh[] }[] = [];
  function plant(x: number, z: number, seed: number) {
    const rand = seeded(seed); const g = new THREE.Group(); g.position.set(x, 0, z); world.add(g);
    const potProfile = [[.22, 0], [.24, .02], [.25, .06], [.32, .48], [.34, .50], [.34, .54], [.30, .54], [.29, .49]].map(([a, b]) => new THREE.Vector2(a, b));
    mesh(new THREE.LatheGeometry(potProfile, 64), new THREE.MeshStandardMaterial({ color: 0x77644c, roughness: .73 }), g);
    cylinder(.295, .018, 0, .49, 0, mats.woodDark, g, .295, 48);
    for (let i = 0; i < 22; i++) { const a = rand() * Math.PI * 2, r = rand() * .27; sphere(.018, Math.cos(a) * r, .503, Math.sin(a) * r, mats.stone, g, 8); }
    const foliage = new THREE.Group(); foliage.position.y = .52; g.add(foliage);
    const leaves: THREE.Mesh[] = [];
    for (let i = 0; i < 28; i++) {
      const a = i * 2.39996; const len = .65 + rand() * .70; const radius = .15 + rand() * .25;
      const end = new THREE.Vector3(Math.cos(a) * radius, len, Math.sin(a) * radius);
      const stem = mesh(new THREE.CylinderGeometry(.005, .009, end.length(), 8), plantLeafMat, foliage);
      stem.position.copy(end).multiplyScalar(.5); stem.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), end.clone().normalize());
      for (let j = 0; j < 3; j++) {
        const leaf = mesh(leafGeo, plantLeafMat, foliage);
        leaf.position.copy(end).multiplyScalar(.48 + j * .18);
        leaf.rotation.set(.40 + rand() * .7, a + j * .8, .3 + rand() * .4);
        leaf.scale.setScalar(.48 + rand() * .52); leaves.push(leaf);
      }
    }
    batchGroup(foliage);
    const renderedFoliage = foliage.children.filter(child => (child as THREE.Mesh).isMesh) as THREE.Mesh[];
    plants.push({ group: g, foliage, leaves: renderedFoliage }); tag(g, 'plant', 'Plante du couloir'); obstacle(x, z, .40, .40); return g;
  }
  plant(-2.92, 7.70, 51); plant(2.92, -11.62, 71);

  // Brass luggage trolley, leather case, stitching and folded linens.
  const trolley = new THREE.Group(); trolley.position.set(2.66, 0, -3.76); trolley.rotation.y = -.12; world.add(trolley);
  box(.95, .08, .57, 0, .20, 0, mats.wood, trolley, .045);
  for (const x of [-.42, .42]) for (const z of [-.23, .23]) {
    cylinder(.10, .065, x, .10, z, mats.black, trolley, .10, 32).rotation.z = Math.PI / 2;
    cylinder(.018, 1.35, x, .89, z, mats.brass, trolley, .018, 24);
  }
  for (const z of [-.23, .23]) {
    cylinder(.018, .83, 0, 1.56, z, mats.brass, trolley, .018, 24).rotation.z = Math.PI / 2;
    box(.89, .035, .04, 0, .83, z, mats.brass, trolley, .01);
  }
  for (const x of [-.42, .42]) cylinder(.018, .46, x, 1.56, 0, mats.brass, trolley, .018, 24).rotation.x = Math.PI / 2;
  const luggage = box(.63, .45, .30, -.06, .47, -.04, mats.redFabric, trolley, .065);
  for (const x of [-.25, .13]) box(.025, .44, .32, x, .47, -.04, mats.brass, trolley, .006);
  const suitcaseHandle = torus(.065, .012, -.06, .72, -.04, mats.darkMetal, trolley); suitcaseHandle.scale.set(1.2, .55, 1);
  for (let i = 0; i < 3; i++) box(.48 - i * .02, .055, .28, .12, .75 + i * .055, .03, mats.cream, trolley, .02);
  tag(trolley, 'trolley', 'Chariot à bagages'); obstacle(2.66, -3.76, .59, .40);
  // A missing object still has an inspectable reference location for cooperative pings.
  const trolleyAnchor = box(1.12, 1.62, .70, 2.66, .81, -3.76, new THREE.MeshBasicMaterial({ visible: false }));
  tag(trolleyAnchor, 'trolley', 'Emplacement du chariot à bagages');

  // Original canvas artwork, painted on texture and mounted under a glassless frame.
  const portraitNormal = texture((ctx, s) => {
    const gradient = ctx.createLinearGradient(0, 0, 0, s); gradient.addColorStop(0, '#3a5558'); gradient.addColorStop(.65, '#8d9077'); gradient.addColorStop(1, '#2b4647');
    ctx.fillStyle = gradient; ctx.fillRect(0, 0, s, s);
    ctx.fillStyle = '#c3b78e'; ctx.beginPath(); ctx.arc(s * .62, s * .27, s * .12, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = '#1e3738'; ctx.beginPath(); ctx.moveTo(0, s * .83); ctx.bezierCurveTo(s * .25, s * .40, s * .35, s * .80, s * .55, s * .58); ctx.bezierCurveTo(s * .75, s * .25, s * .85, s * .65, s, s * .45); ctx.lineTo(s, s); ctx.lineTo(0, s); ctx.fill();
    const rand = seeded(55); for (let i = 0; i < 8000; i++) { ctx.fillStyle = `rgba(${rand() > .5 ? '235,217,158' : '8,18,19'},.035)`; ctx.fillRect(rand() * s, rand() * s, 1 + rand() * 4, 1 + rand() * 11); }
    ctx.strokeStyle = '#a8996c'; ctx.lineWidth = s * .004; ctx.beginPath(); ctx.moveTo(s * .06, s * .92); ctx.lineTo(s * .18, s * .90); ctx.stroke();
  });
  const portraitEmpty = texture((ctx, s) => { ctx.fillStyle = '#bbb59b'; ctx.fillRect(0, 0, s, s); ctx.strokeStyle = '#aaa38c'; ctx.strokeRect(s * .04, s * .04, s * .92, s * .92); });
  const painting = wallGroup(-1, 5.15);
  box(1.40, 1.72, .08, 0, 2.06, .06, mats.woodDark, painting, .02);
  box(1.30, 1.62, .045, 0, 2.06, .12, mats.brass, painting, .01);
  box(1.20, 1.52, .025, 0, 2.06, .15, mats.cream, painting);
  const paintingCanvas = panel(1.01, 1.31, 0, 2.06, .171, portraitNormal, painting);
  tag(painting, 'portrait', 'Tableau « Le dernier rivage »');
  panel(.38, .11, .40, 1.12, .13, labelTexture('LE DERNIER RIVAGE', '#b8aa81', '#272d25'), painting);
  const paintingEyes = new THREE.Group(); painting.add(paintingEyes); paintingEyes.position.set(0, 2.09, .19); anomaly('portrait_eyes', paintingEyes);
  for (const x of [-.22, .22]) {
    const eye = sphere(.12, x, 0, 0, new THREE.MeshStandardMaterial({ color: 0xe5d8ad, emissive: 0xad9a69, emissiveIntensity: .3 }), paintingEyes, 32); eye.scale.set(1.25, .52, .16);
    const pupil = sphere(.035, x, 0, .027, mats.black, paintingEyes, 24); pupil.scale.z = .1;
  }
  const smallArt = wallGroup(-1, -5.10);
  box(.88, 1.12, .07, 0, 2.15, .03, mats.brass, smallArt, .02);
  panel(.74, .98, 0, 2.15, .071, portraitNormal, smallArt);

  // The clock is always 03:09 at calibration; its second hand gives a readable direction cue.
  const clock = wallGroup(1, -5.65); clock.position.y = 2.43;
  box(.88, .88, .035, 0, 0, .035, new THREE.MeshBasicMaterial({ visible: false }), clock);
  const clockBody = new THREE.Group(); clock.add(clockBody);
  const dial = cylinder(.37, .055, 0, 0, .07, mats.cream, clockBody, .37, 96); dial.rotation.x = Math.PI / 2;
  torus(.37, .027, 0, 0, .08, mats.brass, clockBody);
  for (let i = 0; i < 60; i++) {
    const a = i / 60 * Math.PI * 2; const r = i % 5 === 0 ? .292 : .31;
    const tick = box(i % 5 === 0 ? .017 : .007, i % 5 === 0 ? .065 : .025, .006, Math.sin(a) * r, Math.cos(a) * r, .105, mats.darkMetal, clockBody);
    tick.rotation.z = -a;
  }
  const hourHand = new THREE.Group(); clockBody.add(hourHand); hourHand.position.z = .12;
  box(.025, .19, .012, 0, .06, 0, mats.darkMetal, hourHand, .004); hourHand.rotation.z = -(3.15 / 12) * Math.PI * 2;
  const minuteHand = new THREE.Group(); clockBody.add(minuteHand); minuteHand.position.z = .13;
  box(.015, .29, .009, 0, .11, 0, mats.darkMetal, minuteHand, .003); minuteHand.rotation.z = -9 / 60 * Math.PI * 2;
  const secondHand = new THREE.Group(); clockBody.add(secondHand); secondHand.position.z = .14;
  box(.006, .34, .008, 0, .10, 0, new THREE.MeshStandardMaterial({ color: 0x6f3026 }), secondHand);
  sphere(.027, 0, 0, .155, mats.brass, clockBody, 24);
  tag(clock, 'clock', 'Horloge — 03 h 09');

  // Real planar reflection, with a separate matte cover for the no-reflection event.
  const mirrorGroup = wallGroup(1, 3.75);
  box(1.38, 1.95, .09, 0, 1.99, .04, mats.woodDark, mirrorGroup, .06);
  box(1.26, 1.83, .035, 0, 1.99, .103, mats.brass, mirrorGroup, .03);
  const mirror = new Reflector(new THREE.PlaneGeometry(1.14, 1.70), { color: 0x91a59c, textureWidth: 512, textureHeight: 768, clipBias: .004 });
  mirror.position.set(0, 1.99, .13); mirrorGroup.add(mirror);
  const mirrorCover = panel(1.14, 1.70, 0, 1.99, .139, labelTexture('', '#121c1c', '#121c1c'), mirrorGroup);
  mirrorCover.visible = false;
  tag(mirrorGroup, 'mirror', 'Miroir du vestibule');

  function makeStranger(parent: THREE.Object3D, scale = 1) {
    const g = new THREE.Group(); g.scale.setScalar(scale); parent.add(g);
    const material = new THREE.MeshStandardMaterial({ color: 0x050b0b, roughness: .96 });
    const bodyPoints = [[.10, 0], [.22, .12], [.25, .65], [.19, 1.14], [.29, 1.30], [.23, 1.48], [.10, 1.53]].map(([x, y]) => new THREE.Vector2(x, y));
    mesh(new THREE.LatheGeometry(bodyPoints, 48), material, g);
    const head = sphere(.16, 0, 1.70, 0, material, g, 48); head.scale.set(.78, 1.38, .9);
    for (const side of [-1, 1]) {
      const arm = cylinder(.045, .94, side * .27, .98, .025, material, g, .07, 32); arm.rotation.z = side * .13;
      const leg = cylinder(.055, .57, side * .11, .23, 0, material, g, .09, 32); leg.rotation.z = side * -.03;
      const eye = sphere(.011, side * .044, 1.75, .139, mats.cream, g, 16); eye.scale.y = .55;
    }
    return g;
  }
  const mirrorStranger = makeStranger(mirrorGroup, .67); mirrorStranger.position.set(.14, 1.18, .155); mirrorStranger.scale.z = .018; anomaly('mirror_stranger', mirrorStranger);
  const shadowFigure = makeStranger(world, 1.18); shadowFigure.position.set(-1.70, .02, -11.78); anomaly('shadow_figure', shadowFigure); tag(shadowFigure, 'door', 'Une présence dans le couloir');

  // Rain on the window. The outside is intentionally unreadable beyond a cold courtyard.
  const windowGroup = wallGroup(-1, -12.25);
  box(1.58, 2.05, .13, 0, 1.99, .04, mats.darkMetal, windowGroup, .02);
  const rainMap = texture((ctx, s) => {
    const grad = ctx.createLinearGradient(0, 0, 0, s); grad.addColorStop(0, '#122b38'); grad.addColorStop(.65, '#466466'); grad.addColorStop(1, '#182f32'); ctx.fillStyle = grad; ctx.fillRect(0, 0, s, s);
    const rand = seeded(16);
    for (let i = 0; i < 400; i++) { ctx.strokeStyle = `rgba(145,197,211,${.05 + rand() * .18})`; ctx.lineWidth = .4 + rand() * 1.4; const x = rand() * s, y = rand() * s; ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x - 1, y + 8 + rand() * 50); ctx.stroke(); }
    ctx.fillStyle = 'rgba(8,25,28,.6)'; ctx.fillRect(s * .72, s * .27, s * .10, s * .75); ctx.fillRect(s * .17, s * .38, s * .11, s * .75);
  });
  panel(1.43, 1.90, 0, 1.99, .12, rainMap, windowGroup, .45);
  const hotelWindowGlass = reflectiveGlass(1.43, 1.90, 0x879fa3, .32);
  hotelWindowGlass.position.set(0, 1.99, .17); windowGroup.add(hotelWindowGlass);
  const windowWatcher = makeStranger(windowGroup, .79); windowWatcher.position.set(-.10, 1.10, .13); windowWatcher.scale.z = .08; anomaly('window_watcher', windowWatcher);
  for (const x of [-.70, 0, .70]) box(.045, 1.93, .075, x, 1.99, .20, mats.darkMetal, windowGroup);
  box(1.43, .045, .075, 0, 1.99, .20, mats.darkMetal, windowGroup);
  box(1.76, .10, .37, 0, .99, .18, mats.stone, windowGroup, .02);
  tag(windowGroup, 'window', 'Fenêtre sur la cour');
  pointLight(-2.95, 2.50, -12.25, 16, 0x6caabb, 7);

  // Every anomaly has its own recoverable scene object or material mutation.
  const ceilingEyes = new THREE.Group(); world.add(ceilingEyes); anomaly('ceiling_eyes', ceilingEyes);
  for (let i = 0; i < 7; i++) {
    const cx = Math.sin(i * 2.399) * 2.3; const z = 5 - i * 2.3;
    for (const side of [-1, 1]) {
      const eye = sphere(.14, cx + side * .19, 3.43, z, mats.cream, ceilingEyes, 32); eye.scale.set(1.4, .13, .65);
      const pupil = sphere(.04, cx + side * .19, 3.398, z, mats.black, ceilingEyes, 24); pupil.scale.y = .2;
    }
  }
  tag(ceilingEyes, 'ceiling', 'Le plafond');
  const floorTrail = new THREE.Group(); world.add(floorTrail); anomaly('floor_trail', floorTrail);
  const stainMat = new THREE.MeshStandardMaterial({ color: 0x081211, roughness: .12, metalness: .05, transparent: true, opacity: .94 });
  for (let i = 0; i < 19; i++) {
    const xx = Math.sin(i * .3) * .5 + (i % 2 ? .15 : -.15); const z = 5.8 - i * .63;
    const foot = mesh(new THREE.CircleGeometry(.095, 32), stainMat, floorTrail); foot.rotation.x = -Math.PI / 2; foot.rotation.z = -.12; foot.scale.y = 1.9; foot.position.set(xx, .013, z);
    for (let t = 0; t < 4; t++) { const toe = mesh(new THREE.CircleGeometry(.018, 16), stainMat, floorTrail); toe.rotation.x = -Math.PI / 2; toe.position.set(xx - .05 + t * .032, .014, z - .19); }
  }
  tag(floorTrail, 'floor', 'Des traces humides sur le tapis');
  const messageGroup = wallGroup(-1, -2.9); anomaly('wall_message', messageGroup);
  const messageMap = texture((ctx, s) => {
    ctx.clearRect(0, 0, s, s); ctx.fillStyle = '#2b211b'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.font = `700 ${s * .065}px monospace`;
    ['VOUS ÊTES', 'DÉJÀ SORTIS.', '', 'QUI EST RESTÉ ?'].forEach((line, i) => ctx.fillText(line, s / 2, s * (.30 + i * .13)));
  });
  const messageMat = new THREE.MeshStandardMaterial({ map: messageMap, transparent: true, roughness: 1, depthWrite: false });
  const messageMesh = mesh(new THREE.PlaneGeometry(1.6, 1.6), messageMat, messageGroup); messageMesh.position.set(0, 2.15, .10); tag(messageGroup, 'portrait', 'Écriture sur le mur');
  const handGroup = wallGroup(1, 5.75); anomaly('blood_handprint', handGroup);
  const handMap = texture((ctx, s) => {
    ctx.clearRect(0, 0, s, s); ctx.fillStyle = '#5c2e23'; ctx.globalAlpha = .84;
    ctx.beginPath(); ctx.ellipse(s * .5, s * .60, s * .15, s * .20, -.13, 0, Math.PI * 2); ctx.fill();
    ctx.lineCap = 'round'; ctx.strokeStyle = '#5c2e23'; ctx.lineWidth = s * .052;
    const fingers = [[.36, .49, .27, .30], [.43, .43, .39, .15], [.51, .42, .51, .10], [.59, .43, .64, .17], [.62, .56, .75, .45]];
    for (const [x, y, ex, ey] of fingers) { ctx.beginPath(); ctx.moveTo(x * s, y * s); ctx.lineTo(ex * s, ey * s); ctx.stroke(); }
    ctx.lineWidth = s * .015; ctx.globalAlpha = .5; ctx.beginPath(); ctx.moveTo(s * .52, s * .70); ctx.lineTo(s * .54, s * .92); ctx.stroke();
  });
  const handMesh = mesh(new THREE.PlaneGeometry(.64, .80), new THREE.MeshStandardMaterial({ map: handMap, transparent: true, roughness: .74, depthWrite: false }), handGroup);
  handMesh.position.set(0, 2.10, .10); tag(handGroup, 'portrait', 'Empreinte couleur rouille');

  // Small environmental details keep the reference room legible and lived in.
  for (const side of [-1, 1]) {
    const fire = wallGroup(side, 10.2);
    box(.30, .45, .02, 0, 1.5, .10, mats.darkMetal, fire);
    panel(.25, .39, 0, 1.5, .12, labelTexture('09\nPROTOCOL\nOBSERVEZ.', '#c5c7ad', '#12312c'), fire, .1);
  }
  const introDoor = new THREE.Group(); introDoor.position.set(0, 0, 11.94); introDoor.rotation.y = Math.PI; world.add(introDoor);
  box(2.32, 2.84, .13, 0, 1.42, .02, mats.woodDark, introDoor);
  for (const x of [-.58, .58]) { box(1.10, 2.67, .06, x, 1.35, .12, mats.wood, introDoor); box(.05, .45, .10, x * .23, 1.1, .18, mats.brass, introDoor, .02); }
  panel(1.35, .25, 0, 3.07, .02, labelTexture('SECTEUR 09', '#c6b88f', '#213632'), introDoor, .3);
  const ceilingTarget = box(6.8, .05, 27, 0, 3.45, -2, new THREE.MeshBasicMaterial({ visible: false })); tag(ceilingTarget, 'ceiling', 'Le plafond');
  commonWorld.add(shadowFigure, ceilingEyes, floorTrail);
  const lowerCeiling = box(7.45, .13, 27.8, 0, 2.62, -2, mats.stone, commonWorld);
  anomaly('ceiling_lower', lowerCeiling); tag(lowerCeiling, 'ceiling', 'Plafond abaissé');
  const pulseWallGeometry = new THREE.PlaneGeometry(3.1, 2.22, 48, 36);
  const pulseWallMaterial = new THREE.MeshStandardMaterial({ color: 0xc9be9e, roughness: .88, side: THREE.DoubleSide });
  const pulseWall = mesh(pulseWallGeometry, pulseWallMaterial, commonWorld); pulseWall.rotation.y = -Math.PI / 2; pulseWall.position.set(3.69, 1.99, -1.8);
  anomaly('wall_pulse', pulseWall); tag(pulseWall, 'portrait', 'Paroi du secteur');
  const independentShadow = makeStranger(commonWorld, 1);
  independentShadow.rotation.x = -Math.PI / 2; independentShadow.scale.z = .008; independentShadow.position.set(.5, .025, -1.0);
  const shadowMaterial = new THREE.MeshBasicMaterial({ color: 0x010707, transparent: true, opacity: .79, depthWrite: false });
  independentShadow.traverse(object => { const m = object as THREE.Mesh; if (m.isMesh) { m.material = shadowMaterial; m.castShadow = false; } });
  anomaly('avatar_shadow', independentShadow); tag(independentShadow, 'player', 'Ombre sans inspecteur');
  const convergence = wallGroup(-1, 9.85); commonWorld.add(convergence);
  box(1.20, .80, .07, 0, 2.06, .08, mats.darkMetal, convergence, .025);
  function convergenceTexture(direction: 'left' | 'right', time: string) {
    return texture((ctx, size) => {
      ctx.fillStyle = '#142e2b'; ctx.fillRect(0, 0, size, size);
      ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillStyle = '#b9ccae';
      ctx.font = `${size * .072}px monospace`; ctx.fillText('CONSIGNE DE CONVERGENCE', size / 2, size * .17);
      ctx.font = `${size * .36}px sans-serif`; ctx.fillText(direction === 'left' ? '←' : '→', size / 2, size * .45);
      ctx.font = `${size * .10}px monospace`; ctx.fillText(`SYNCHRO ${time}`, size / 2, size * .80);
    });
  }
  const convergenceDisplay = panel(1.10, .70, 0, 2.06, .121, convergenceTexture('right', '03:09'), convergence, .45);
  tag(convergence, 'radio', 'Flèche et horodatage de convergence');

  [desk, trolley, floatingChair, duplicateChair, sideTable, radio, phone, phoneReceiver, ...doorLeaves].forEach(batchGroup);

  // Batch static shell meshes by material. Inspection roots and moving props remain separate.
  world.updateMatrixWorld(true);
  const mergeBatches = new Map<THREE.Material, THREE.Mesh[]>();
  for (const child of [...world.children]) {
    const candidate = child as THREE.Mesh;
    if (!candidate.isMesh || candidate.userData.inspect || Array.isArray(candidate.material)) continue;
    const batch = mergeBatches.get(candidate.material) || []; batch.push(candidate); mergeBatches.set(candidate.material, batch);
  }
  for (const [material, batch] of mergeBatches) {
    if (batch.length < 3) continue;
    const copies = batch.map(m => {
      let geo = m.geometry.clone();
      if (geo.index) { const nonIndexed = geo.toNonIndexed(); geo.dispose(); geo = nonIndexed; }
      return geo.applyMatrix4(m.matrixWorld);
    });
    const merged = mergeGeometries(copies, false);
    copies.forEach(geo => geo.dispose());
    if (!merged) continue;
    const combined = mesh(merged, material); combined.name = 'Batched architecture';
    batch.forEach(m => { world.remove(m); m.geometry.dispose(); });
  }

  // Subtle motes: atmospheric particles, not noise covering the observation landmarks.
  const random = seeded(678);
  const particlePositions = new Float32Array(240 * 3);
  for (let i = 0; i < 240; i++) { particlePositions[i * 3] = random() * 7 - 3.5; particlePositions[i * 3 + 1] = random() * 3.1 + .2; particlePositions[i * 3 + 2] = random() * 27 - 15.5; }
  const particleGeometry = new THREE.BufferGeometry(); particleGeometry.setAttribute('position', new THREE.BufferAttribute(particlePositions, 3));
  const particles = new THREE.Points(particleGeometry, new THREE.PointsMaterial({ color: 0xb9c5ad, size: .014, transparent: true, opacity: .30, depthWrite: false, sizeAttenuation: true })); scene.add(particles);
  const flashlight = new THREE.SpotLight(0xf1e8d2, 0, 19, .37, .45, 1.4); flashlight.position.copy(camera.position); scene.add(flashlight, flashlight.target);
  extraWorlds = { metro: createLocation('metro'), clinic: createLocation('clinic') };
  for (const location of Object.values(extraWorlds)) { scene.add(location.root); location.root.visible = false; targets.push(...location.targets); }
  const reflectors = [mirror, hotelWindowGlass, ...extraWorlds.metro.reflectors, ...extraWorlds.clinic.reflectors];
  let reflectionDepth = 0;
  for (const reflector of reflectors) {
    reflector.getReflectionCamera(camera).layers.enable(1);
    const capture = reflector.onBeforeRender;
    reflector.userData.reflectiveSurface = true;
    reflector.onBeforeRender = function (gl, renderingScene, renderingCamera, geometry, material, group) {
      if (reflectionDepth > 0 || (quality === 'low' && frame % 3 !== 0) || (quality === 'medium' && frame % 2 !== 0)) return;
      reflectionDepth++;
      const surfaceVisibility = reflectors.map(surface => surface.visible);
      const localVisible = selfAvatar.root.visible;
      const delayedVisible = reflectionAvatar.root.visible;
      for (const surface of reflectors) if (surface !== reflector) surface.visible = false;
      reflector.getReflectionCamera(renderingCamera).layers.enable(1);
      if (effects.has('reflection_absent')) selfAvatar.root.visible = false;
      else if (effects.has('reflection_delay') || effects.has('reflection_independent')) { selfAvatar.root.visible = false; reflectionAvatar.root.visible = active; }
      try { capture.call(reflector, gl, renderingScene, renderingCamera, geometry, material, group); }
      finally {
        reflectors.forEach((surface, index) => { surface.visible = surfaceVisibility[index]; });
        selfAvatar.root.visible = localVisible; reflectionAvatar.root.visible = delayedVisible; reflectionDepth--;
      }
    };
  }
  tag(selfAvatar.root, 'player', 'Votre tenue d’inspection');
  tag(selfAvatar.radio, 'radio', 'Votre talkie-walkie');
  tag(doubleAvatar.root, 'player', 'Un inspecteur en trop');

  function look(dx: number, dy: number) {
    if (!active) return;
    pose.yaw -= dx * .0022; pose.pitch = THREE.MathUtils.clamp(pose.pitch - dy * .0022, -1.35, 1.35);
  }
  function fits(x: number, z: number) {
    if (x < -3.32 || x > 3.32 || z < -15.10 || z > 11.3) return false;
    const currentObstacles = levelId === 'hotel' ? occluders : extraWorlds[levelId].colliders;
    for (const c of currentObstacles) {
      if (effects.has('trolley_missing') && c.x === 2.66 && c.z === -3.76) continue;
      if (effects.has('chair_float') && c.x === -2.53 && c.z === 2.65) continue;
      if (Math.abs(x - c.x) < c.rx + .19 && Math.abs(z - c.z) < c.rz + .19) return false;
    }
    return true;
  }
  function applyView(view: PersonalView) {
    effects = new Set((view.effects || []).filter(e => (SCENE_EFFECTS as readonly string[]).includes(e)));
    phase = view.phase || phase; loop = view.loop || 0;
    const nextLevel = view.levelId === 'metro' || view.levelId === 'clinic' ? view.levelId : view.levelId === 'hotel' ? 'hotel' : levelId;
    if (nextLevel !== levelId) { levelId = nextLevel; pose.x = 0; pose.z = 9; pose.yaw = 0; pose.pitch = 0; poseHistory.length = 0; }
    world.visible = levelId === 'hotel'; hotelLights.visible = levelId === 'hotel';
    for (const location of Object.values(extraWorlds)) { location.root.visible = location.id === levelId; location.setView(effects, view.relayCode || '0909'); }
    for (const [key, object] of anomalyRoots) object.visible = effects.has(key);
    clockBody.visible = !effects.has('clock_missing');
    (paintingCanvas.material as THREE.MeshStandardMaterial).map = effects.has('portrait_empty') ? portraitEmpty : portraitNormal;
    doorNumberMaterials.forEach((material, i) => { material.map = i === 0 && effects.has('door_number') ? wrongNumberMap : doorNumberMaps[i]; material.emissiveMap = material.map; });
    doorLeaves.forEach((leaf, i) => { leaf.rotation.y = i === 0 && effects.has('door_open') ? -1.12 : 0; });
    plants.forEach((p, i) => {
      const dead = i === 0 && effects.has('plant_dead');
      p.foliage.scale.set(1, i === 0 && effects.has('plant_tall') ? 1.85 : dead ? .68 : 1, 1);
      p.leaves.forEach(leaf => { leaf.material = dead ? deadLeafMat : plantLeafMat; });
    });
    trolley.visible = !effects.has('trolley_missing');
    mirror.visible = !effects.has('missing_reflection'); mirrorCover.visible = effects.has('missing_reflection');
    (exitSign.material as THREE.MeshStandardMaterial).map = effects.has('exit_false') ? falseExitMap : exitMap;
    (exitSign.material as THREE.MeshStandardMaterial).emissiveMap = effects.has('exit_false') ? falseExitMap : exitMap;
    (scene.fog as THREE.FogExp2).density = effects.has('corridor_fog') ? .115 : .013;
    (scene.fog as THREE.FogExp2).color.set(effects.has('corridor_fog') ? 0x364543 : 0x142326);
    hemi.intensity = effects.has('blackout') ? .13 : .68;
    moon.intensity = effects.has('blackout') ? .38 : 1.9;
    lightSources.forEach(({ light, base, color }) => {
      light.intensity = effects.has('blackout') ? base * .015 : base;
      light.color.copy(color);
      if (effects.has('red_light')) light.color.set(0xe92c1e);
    });
    (mats.glow as THREE.MeshStandardMaterial).emissive.set(effects.has('red_light') ? 0xff2010 : 0xffc878);
    (mats.glow as THREE.MeshStandardMaterial).emissiveIntensity = effects.has('blackout') ? .015 : 2;
    floatingChair.position.y = effects.has('chair_float') ? .72 : 0;
    floatingChair.rotation.z = 0;
    luggage.scale.set(1, 1, 1);
    phoneReceiver.position.y = effects.has('phone_float') ? .62 : .11;
    phoneReceiver.rotation.z = 0;
    endLamp.color.set(effects.has('exit_false') ? 0xe45d37 : effects.has('red_light') ? 0xe92c1e : 0x89cfca);
    const nextRelayCode = typeof view.relayCode === 'string' && /^\d{4}$/.test(view.relayCode) ? view.relayCode : '0909';
    if (nextRelayCode !== relayCode) {
      relayCode = nextRelayCode;
      const material = relayDisplay.material as THREE.MeshStandardMaterial;
      const oldMap = material.map;
      material.map = relayTexture(relayCode);
      material.emissiveMap = material.map;
      if (oldMap) { const index = textures.indexOf(oldMap); if (index >= 0) textures.splice(index, 1); oldMap.dispose(); }
    }
    const nextDirection = view.arrowDirection === 'left' ? 'left' : 'right';
    const nextTime = typeof view.syncTime === 'string' && /^\d{2}:\d{2}$/.test(view.syncTime) ? view.syncTime : '03:09';
    if (nextDirection !== arrowDirection || nextTime !== syncTime) {
      arrowDirection = nextDirection; syncTime = nextTime;
      const mat = convergenceDisplay.material as THREE.MeshStandardMaterial; const old = mat.map;
      mat.map = convergenceTexture(arrowDirection, syncTime); mat.emissiveMap = mat.map;
      if (old) { const index = textures.indexOf(old); if (index >= 0) textures.splice(index, 1); old.dispose(); }
    }
    pulseWallMaterial.color.set(levelId === 'hotel' ? 0xc9be9e : levelId === 'metro' ? 0x9ca9a1 : 0xd1d9d2);
    selfAvatar.root.visible = active; reflectionAvatar.root.visible = false;
    doubleAvatar.root.visible = active && effects.has('avatar_double');
    refreshAvatarAppearance(0);
  }
  function setQuality(q: 'low' | 'medium' | 'high') {
    quality = q; renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, q === 'high' ? 1.5 : q === 'medium' ? 1.25 : 1));
    renderer.shadowMap.enabled = q !== 'low';
    moon.shadow.mapSize.set(q === 'high' ? 2048 : 1024, q === 'high' ? 2048 : 1024);
    if (moon.shadow.map) { moon.shadow.map.dispose(); moon.shadow.map = null; }
    for (const surface of reflectors) surface.getRenderTarget().setSize(q === 'high' ? 512 : q === 'medium' ? 256 : 128, q === 'high' ? 768 : q === 'medium' ? 384 : 192);
    particles.visible = q !== 'low'; currentWidth = 0;
  }
  function createPeer(id: string, name: string, slot: number, color?: number) {
    const model = createInspector({ id, name, slot, color }); const group = model.root; peerGroup.add(group);
    tag(group, 'player', name);
    tag(model.radio, 'radio', `Talkie-walkie de ${name}`);
    const result = { group, model, target: { x: 0, y: 1.67, z: 9, yaw: 0, pitch: 0 }, name, talking: false, slot };
    peers.set(id, result); return result;
  }
  function setPeers(items: any[]) {
    const ids = new Set<string>();
    items.forEach((item, index) => {
      const id = String(item.id || item.playerId || String(item.slot ?? index));
      if (id === selfIdentity.id) return;
      ids.add(id);
      const peer = peers.get(id) || createPeer(id, String(item.name || item.label || `Inspecteur ${index + 1}`), Number.isInteger(item.slot) ? item.slot : index, typeof item.color === 'number' ? item.color : undefined);
      const p = item.pose || item;
      if (Number.isFinite(p.x) && Number.isFinite(p.z)) {
        peer.target = { x: THREE.MathUtils.clamp(p.x, -3.4, 3.4), y: 1.67, z: THREE.MathUtils.clamp(p.z, -15, 11.2), yaw: Number(p.yaw) || 0, pitch: Number(p.pitch) || 0 };
        if (!peer.group.userData.placed) { peer.group.position.set(peer.target.x, 0, peer.target.z); peer.group.userData.placed = true; }
      }
      peer.group.visible = item.connected !== false;
      peer.talking = item.talking === true;
    });
    for (const [id, peer] of peers) if (!ids.has(id)) {
      peerGroup.remove(peer.group); peers.delete(id);
      removeInspectionTargets(peer.group); peer.model.dispose();
    }
  }
  function refreshAvatarAppearance(speed: number) {
    const visiblePeers = [...peers.values()].filter(peer => peer.group.visible).sort((a, b) => a.slot - b.slot);
    selfAvatar.animate({ time: elapsed, speed, talking, pitch: pose.pitch, mannequin: effects.has('avatar_mannequin') && visiblePeers.length === 0, radioSignal: effects.has('radio_signal') });
    for (const peer of visiblePeers) peer.model.animate({ time: elapsed, speed: 0, talking: peer.talking, pitch: peer.target.pitch, mannequin: effects.has('avatar_mannequin') && peer === visiblePeers[0] });
  }
  function setIdentity(identity: InspectorIdentity) {
    const next = { id: String(identity.id || 'local'), name: String(identity.name || 'Inspecteur').slice(0, 24), slot: Number.isInteger(identity.slot) ? identity.slot : 0, color: identity.color };
    if (next.id === selfIdentity.id && next.name === selfIdentity.name && next.slot === selfIdentity.slot && next.color === selfIdentity.color) return;
    for (const model of [selfAvatar, reflectionAvatar, doubleAvatar]) { scene.remove(model.root); removeInspectionTargets(model.root); model.dispose(); }
    selfIdentity = next;
    selfAvatar = createInspector(next, { local: true }); reflectionAvatar = createInspector(next, { reflectionOnly: true, nameplate: false }); doubleAvatar = createInspector(next, { nameplate: false });
    scene.add(selfAvatar.root, reflectionAvatar.root, doubleAvatar.root);
    tag(selfAvatar.root, 'player', 'Votre tenue d’inspection'); tag(doubleAvatar.root, 'player', 'Un inspecteur en trop');
    tag(selfAvatar.radio, 'radio', 'Votre talkie-walkie');
    selfAvatar.root.visible = active; reflectionAvatar.root.visible = false; doubleAvatar.root.visible = active && effects.has('avatar_double');
    poseHistory.length = 0; refreshAvatarAppearance(0);
  }
  function removeInspectionTargets(root: THREE.Object3D) {
    root.traverse(object => { const index = targets.indexOf(object); if (index >= 0) targets.splice(index, 1); });
  }
  function update(dt: number) {
    if (!alive) return;
    dt = THREE.MathUtils.clamp(Number.isFinite(dt) ? dt : .016, 0, .05); elapsed += dt; frame++;
    const oldX = pose.x, oldZ = pose.z;
    const width = Math.max(1, canvas.clientWidth || canvas.width || window.innerWidth);
    const height = Math.max(1, canvas.clientHeight || canvas.height || window.innerHeight);
    if (width !== currentWidth || height !== currentHeight) {
      currentWidth = width; currentHeight = height; renderer.setSize(width, height, false); camera.aspect = width / height; camera.updateProjectionMatrix();
    }
    if (active) {
      if (input.lookX || input.lookY) look((input.lookX || 0) * dt * 500, (input.lookY || 0) * dt * 500);
      const rawX = input.strafe || 0; const rawZ = input.forward || 0;
      const mag = Math.max(1, Math.hypot(rawX, rawZ));
      const speed = (input.sprint ? 3.65 : 2.30) * dt;
      const dx = (Math.cos(pose.yaw) * rawX - Math.sin(pose.yaw) * rawZ) / mag * speed;
      const dz = (-Math.sin(pose.yaw) * rawX - Math.cos(pose.yaw) * rawZ) / mag * speed;
      if (fits(pose.x + dx, pose.z)) pose.x += dx;
      if (fits(pose.x, pose.z + dz)) pose.z += dz;
      // No involuntary head bob: landmarks remain stable and camera sickness is reduced.
      camera.position.set(pose.x, pose.y, pose.z); camera.rotation.set(pose.pitch, pose.yaw, 0, 'YXZ');
    } else {
      camera.position.set(-1.64 + Math.sin(elapsed * .055) * .12, 1.67, 9.55);
      camera.lookAt(.30 + Math.sin(elapsed * .05) * .16, 1.70, -7.2);
    }
    secondHand.rotation.z = (effects.has('clock_reverse') ? 1 : -1) * (elapsed % 60) / 60 * Math.PI * 2;
    if (effects.has('chair_float')) { floatingChair.position.y = .70 + Math.sin(elapsed * 1.65) * .07; floatingChair.rotation.z = Math.sin(elapsed * .73) * .025; }
    if (effects.has('phone_float')) { phoneReceiver.position.y = .60 + Math.sin(elapsed * 2) * .035; phoneReceiver.rotation.z = Math.sin(elapsed) * .12; }
    if (effects.has('luggage_breath')) { const breath = Math.sin(elapsed * 1.3); luggage.scale.set(1 + breath * .075, 1 + breath * .11, 1 + breath * .075); }
    if (effects.has('wall_pulse')) {
      const positions = pulseWallGeometry.attributes.position;
      for (let i = 0; i < positions.count; i++) {
        const x = positions.getX(i) / 1.55, y = positions.getY(i) / 1.11;
        positions.setZ(i, Math.max(0, (1 - x * x) * (1 - y * y)) * (.14 + Math.sin(elapsed * 1.4) * .11));
      }
      positions.needsUpdate = true; pulseWallGeometry.computeVertexNormals();
    }
    if (effects.has('avatar_shadow')) { independentShadow.rotation.z = Math.sin(elapsed * .7) * .85; independentShadow.position.x = .5 + Math.sin(elapsed * .35) * .28; }
    if (effects.has('shadow_figure')) { shadowFigure.lookAt(camera.position.x, shadowFigure.position.y, camera.position.z); }
    if (effects.has('red_light')) {
      const flicker = .92 + Math.sin(elapsed * 2.2) * .05; lightSources.forEach(({ light, base }) => light.intensity = base * flicker);
    }
    flashlight.intensity = flashlightOn && active ? 17 : 0;
    flashlight.position.copy(camera.position); flashlight.position.y -= .12;
    camera.getWorldDirection(vector); flashlight.target.position.copy(camera.position).addScaledVector(vector, 8);
    particles.rotation.y = Math.sin(elapsed * .02) * .01;
    if (levelId !== 'hotel') extraWorlds[levelId].update(elapsed);
    const selfSpeed = active && dt > 0 ? Math.hypot(pose.x - oldX, pose.z - oldZ) / dt : 0;
    selfAvatar.root.position.set(pose.x, 0, pose.z); selfAvatar.root.rotation.y = pose.yaw; selfAvatar.root.visible = active;
    const connectedPeers = [...peers.values()].filter(peer => peer.group.visible).sort((a, b) => a.slot - b.slot);
    selfAvatar.animate({ time: elapsed, speed: selfSpeed, talking, pitch: pose.pitch, mannequin: effects.has('avatar_mannequin') && connectedPeers.length === 0, radioSignal: effects.has('radio_signal') });
    // Keep a full second of history without making its duration depend on refresh rate.
    if (active && dt > 0 && (!poseHistory.length || elapsed - poseHistory[poseHistory.length - 1].time >= 1 / 120)) {
      poseHistory.push({ time: elapsed, pose: { ...pose }, speed: selfSpeed, talking });
      while (poseHistory.length > 2 && poseHistory[1].time < elapsed - 1.15) poseHistory.shift();
      while (poseHistory.length > 180) poseHistory.shift();
    }
    let remembered = { time: elapsed, pose: { ...pose }, speed: selfSpeed, talking };
    if (effects.has('reflection_delay') && poseHistory.length) {
      remembered = poseHistory[0];
      for (const sample of poseHistory) { if (sample.time <= elapsed - 1) remembered = sample; else break; }
    }
    reflectionAvatar.root.position.set(remembered.pose.x, 0, remembered.pose.z); reflectionAvatar.root.rotation.y = remembered.pose.yaw;
    reflectionAvatar.animate({ time: effects.has('reflection_delay') ? remembered.time : elapsed, speed: remembered.speed, talking: remembered.talking, pitch: remembered.pose.pitch, independent: effects.has('reflection_independent') });
    reflectionAvatar.root.visible = false;
    doubleAvatar.root.position.set(-1.15, 0, -4.8); doubleAvatar.root.rotation.y = Math.atan2(-(pose.x + 1.15), -(pose.z + 4.8));
    doubleAvatar.root.visible = active && effects.has('avatar_double'); doubleAvatar.animate({ time: elapsed, speed: 0 });
    for (const peer of peers.values()) {
      const before = peer.group.position.clone();
      peer.group.position.lerp(new THREE.Vector3(peer.target.x, 0, peer.target.z), 1 - Math.exp(-dt * 12));
      const delta = Math.atan2(Math.sin(peer.target.yaw - peer.group.rotation.y), Math.cos(peer.target.yaw - peer.group.rotation.y));
      peer.group.rotation.y += delta * (1 - Math.exp(-dt * 12));
      const speed = dt > 0 ? before.distanceTo(peer.group.position) / dt : 0;
      peer.model.animate({ time: elapsed, speed, talking: peer.talking, pitch: peer.target.pitch, mannequin: effects.has('avatar_mannequin') && peer === connectedPeers[0] });
    }
    if (frame % 4 === 0 && active) {
      raycaster.setFromCamera(center, camera); raycaster.far = 5.8;
      const hits = raycaster.intersectObjects(targets, true);
      target = null;
      for (const hit of hits) {
        let object: THREE.Object3D | null = hit.object;
        let visible = true; let found = null;
        while (object) { if (!object.visible) visible = false; if (object.userData.inspect && !found) found = object.userData.inspect; object = object.parent; }
        if (visible && found) { target = found; break; }
      }
    } else if (!active) target = null;
    renderer.render(scene, camera);
    if (!shaderCompiled) { shaderCompiled = true; opts.onReady?.(); }
  }
  function getStats() {
    let triangles = 0, meshes = 0;
    scene.traverse(obj => {
      const m = obj as THREE.Mesh;
      if (m.isMesh && m.geometry) { meshes++; triangles += (m.geometry.index ? m.geometry.index.count : m.geometry.attributes.position?.count || 0) / 3; }
    });
    function count(group: THREE.Object3D) { let total = 0; group.traverse(object => { const m = object as THREE.Mesh; if (m.isMesh) total += (m.geometry.index?.count || m.geometry.attributes.position?.count || 0) / 3; }); return Math.round(total); }
    const common = count(commonWorld);
    const levelTriangles = { hotel: count(world) + common, metro: count(extraWorlds.metro.root) + common, clinic: count(extraWorlds.clinic.root) + common };
    return { sceneTriangles: Math.round(triangles), meshes, levelId, levelTriangles, activeLevelTriangles: levelTriangles[levelId], inspectorTriangles: count(selfAvatar.root), reflectiveSurfaces: reflectors.length, activeReflectiveSurfaces: 2, drawCalls: renderer.info.render.calls, renderedTriangles: renderer.info.render.triangles, quality, supportedEffects: [...SCENE_EFFECTS] };
  }
  function dispose() {
    if (disposed) return; disposed = true; alive = false;
    for (const model of [selfAvatar, reflectionAvatar, doubleAvatar, ...[...peers.values()].map(peer => peer.model)]) { scene.remove(model.root); peerGroup.remove(model.root); model.dispose(); }
    for (const location of Object.values(extraWorlds)) { scene.remove(location.root); location.dispose(); }
    const geometries = new Set<THREE.BufferGeometry>(); const materials = new Set<THREE.Material>();
    scene.traverse(obj => { const m = obj as THREE.Mesh; if (m.geometry) geometries.add(m.geometry); if (m.material) (Array.isArray(m.material) ? m.material : [m.material]).forEach(mat => materials.add(mat)); });
    geometries.forEach(g => g.dispose()); materials.forEach(m => m.dispose()); textures.forEach(t => t.dispose());
    mirror.getRenderTarget().dispose(); hotelWindowGlass.getRenderTarget().dispose(); environmentTarget.dispose(); renderer.dispose();
  }
  setQuality(window.innerWidth < 750 ? 'medium' : 'high');
  applyView({ effects: [], phase: 'menu', loop: 0 });
  return {
    update,
    setInput(next: SceneInput) { input = { ...next }; },
    look,
    setView: applyView,
    getPose: () => ({ ...pose }),
    setPose(next: Partial<ScenePose>) {
      if (Number.isFinite(next.x)) pose.x = THREE.MathUtils.clamp(next.x!, -3.32, 3.32);
      if (Number.isFinite(next.z)) pose.z = THREE.MathUtils.clamp(next.z!, -15.10, 11.3);
      if (Number.isFinite(next.yaw)) pose.yaw = next.yaw!;
      if (Number.isFinite(next.pitch)) pose.pitch = THREE.MathUtils.clamp(next.pitch!, -1.35, 1.35);
    },
    setPeers,
    setIdentity,
    setTalking(next: boolean) { talking = !!next; },
    setQuality,
    setFlashlight(on: boolean) { flashlightOn = on; },
    setActive(next: boolean) { active = next; input = { forward: 0, strafe: 0 }; selfAvatar.root.visible = active; reflectionAvatar.root.visible = false; doubleAvatar.root.visible = active && effects.has('avatar_double'); },
    getTarget: () => target,
    dispose,
    getStats,
  };
}
