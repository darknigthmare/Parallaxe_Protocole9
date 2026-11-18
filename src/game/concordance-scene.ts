import * as THREE from 'three';

export interface ConcordanceScene {
  render(progress: number): void;
  resize(width: number, height: number, pixelRatio?: number): void;
  dispose(): void;
}

const sheetWidth = .48;
const sheetDepth = .68;
const deskHeight = .92;
const mapZ = .04;

function makePrint(width: number, height: number, draw: (ctx: CanvasRenderingContext2D) => void) {
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('Impression des relevés indisponible');
  draw(ctx);
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  return texture;
}

type Point = readonly [number, number];
function line(ctx: CanvasRenderingContext2D, points: readonly Point[]) {
  ctx.beginPath();
  points.forEach(([x, y], i) => i === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y));
  ctx.stroke();
}

// The same survey is printed through three adjacent viewports. The ink reaches
// the cut edge of each sheet, so aligning the physical papers completes the route.
function printSheet(index: number) {
  const paper = ['#eadfbf', '#eee6d4', '#e2e6d7'];
  const letters = ['A', 'B', 'C'];
  return makePrint(384, 544, ctx => {
    ctx.fillStyle = paper[index];
    ctx.fillRect(0, 0, 384, 544);
    ctx.fillStyle = '#26464a';
    ctx.font = 'bold 35px sans-serif';
    ctx.fillText('RELEVÉ ' + letters[index], 24, 52);
    ctx.fillRect(24, 63, 336, 4);
    ctx.save();
    ctx.translate(-384 * index, 0);
    ctx.strokeStyle = '#a6b4a8';
    ctx.lineWidth = 1;
    for (let x = 0; x < 1152; x += 24) line(ctx, [[x, 91], [x, 450]]);
    for (let y = 91; y <= 450; y += 24) line(ctx, [[0, y], [1152, y]]);
    ctx.strokeStyle = '#365455';
    ctx.lineWidth = 7;
    line(ctx, [[58, 355], [58, 186], [236, 186], [236, 124], [570, 124], [570, 174], [730, 174], [730, 140], [1050, 140], [1050, 345], [924, 345]]);
    line(ctx, [[58, 355], [174, 355], [174, 398], [484, 398], [484, 350], [691, 350], [691, 393], [924, 393], [924, 345]]);
    line(ctx, [[292, 124], [292, 222], [334, 222]]);
    line(ctx, [[480, 124], [480, 219], [542, 219]]);
    line(ctx, [[751, 393], [751, 301], [804, 301]]);
    line(ctx, [[925, 141], [925, 229], [1002, 229]]);
    // Short ticks and stairs distinguish the three readings even without colour.
    ctx.lineWidth = 3;
    for (let x = 74; x < 156; x += 12) line(ctx, [[x, 198], [x, 231]]);
    for (let x = 511; x < 566; x += 11) line(ctx, [[x, 315], [x, 342]]);
    for (let x = 955; x < 1020; x += 12) line(ctx, [[x, 148], [x, 185]]);
    ctx.strokeStyle = '#aa3727';
    ctx.lineWidth = 11;
    ctx.lineJoin = 'round';
    line(ctx, [[102, 300], [213, 300], [213, 260], [575, 260], [575, 305], [720, 305], [720, 259], [964, 259]]);
    ctx.lineWidth = 7;
    ctx.beginPath(); ctx.arc(96, 300, 12, 0, Math.PI * 2); ctx.stroke();
    line(ctx, [[946, 244], [967, 259], [946, 274]]);
    ctx.restore();
    ctx.fillStyle = '#344d4d';
    ctx.fillRect(24, 476, 336, 2);
    ctx.font = '20px monospace';
    ctx.fillText(['ESCALIER', 'PALIER', 'SORTIE'][index], 24, 511);
    ctx.fillText('0' + (index + 1), 329, 511);
  });
}

function dawnSky() {
  return makePrint(512, 256, ctx => {
    const sky = ctx.createLinearGradient(0, 0, 0, 256);
    sky.addColorStop(0, '#80a2ad');
    sky.addColorStop(.5, '#f3c5a0');
    sky.addColorStop(.82, '#ffe4ac');
    sky.addColorStop(1, '#9e9894');
    ctx.fillStyle = sky;
    ctx.fillRect(0, 0, 512, 256);
    ctx.fillStyle = '#fff4c8';
    ctx.beginPath(); ctx.arc(196, 148, 17, 0, 2 * Math.PI); ctx.fill();
    for (let layer = 0; layer < 2; layer++) {
      ctx.fillStyle = ['#a79b94', '#758589'][layer];
      ctx.beginPath(); ctx.moveTo(0, 256);
      for (let x = 0; x <= 512; x += 4) {
        ctx.lineTo(x, 167 + layer * 25 + 12 * Math.sin(x / 46 + layer) + 7 * Math.sin(x / 21 + layer * 2));
      }
      ctx.lineTo(512, 256); ctx.closePath(); ctx.fill();
    }
  });
}

export function buildConcordanceRoom() {
  const scene = new THREE.Scene();
  scene.background = new THREE.Color('#7b8e91');
  const camera = new THREE.PerspectiveCamera(48, 1, .035, 35);
  const resources = new Set<{dispose(): void}>();
  function own<T extends {dispose(): void}>(resource: T): T {
    resources.add(resource);
    return resource;
  }
  function pigment(color: string, metalness = 0) {
    return own(new THREE.MeshStandardMaterial({color, metalness, roughness: .72}));
  }
  const cube = own(new THREE.BoxGeometry(1, 1, 1));
  const plane = own(new THREE.PlaneGeometry(1, 1));
  function box(parent: THREE.Object3D, material: THREE.Material, x: number, y: number, z: number, width: number, height: number, depth: number) {
    const mesh = new THREE.Mesh(cube, material);
    mesh.position.set(x, y, z);
    mesh.scale.set(width, height, depth);
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    parent.add(mesh);
    return mesh;
  }
  function dispose() {
    for (const resource of resources) resource.dispose();
    resources.clear();
    scene.clear();
  }

  try {
    const plaster = pigment('#8eaa9e'), dado = pigment('#325759');
    const iron = pigment('#254346', .25), brass = pigment('#a18851', .4);
    const walnut = pigment('#704e37'), cork = pigment('#705e4d'), stone = pigment('#9f9b82');
    const carpet = pigment('#4d6560'), ivory = pigment('#dad2ad');

    // The exterior is visible through an actual opening in the masonry.
    box(scene, plaster, 0, 3.24, .2, 7.4, .12, 8).castShadow = false;
    for (const z of [-2.45, .65]) box(scene, dado, 0, 3.12, z, 7.22, .14, .12).castShadow = false;
    box(scene, stone, 0, -.09, .2, 7.4, .18, 8);
    box(scene, carpet, 0, .004, .5, 4.4, .008, 5.6);
    for (const x of [-2.09, 2.09]) box(scene, brass, x, .011, .5, .014, .003, 5.38);
    for (const x of [-3.6, 3.6]) {
      box(scene, plaster, x, 1.6, .2, .18, 3.2, 7.8);
      box(scene, dado, x * .976, .53, .2, .08, 1.06, 7.8);
      box(scene, brass, x * .966, 1.07, .2, .035, .024, 7.8);
    }
    const rear = -3.58;
    box(scene, dado, 0, .48, rear, 7.2, .96, .22);
    box(scene, walnut, 0, .98, rear + .03, 7.15, .09, .37);
    for (const x of [-2.88, 2.88]) box(scene, plaster, x, 2.075, rear, 1.44, 2.25, .22);
    box(scene, plaster, 0, 3.06, rear, 4.32, .32, .22);
    for (const y of [1.08, 2.38, 2.85]) box(scene, iron, 0, y, rear + .03, 4.38, .055, .125);
    for (const x of [-2.16, -1.08, 0, 1.08, 2.16]) box(scene, iron, x, 1.96, rear + .03, .052, 1.85, .14);
    const skyMaterial = own(new THREE.MeshBasicMaterial({map: own(dawnSky()), toneMapped: false}));
    const sky = new THREE.Mesh(plane, skyMaterial);
    sky.position.set(0, 2.3, -6);
    sky.scale.set(15, 5, 1);
    scene.add(sky);

    // A small clock faces the table from the side wall. Its time matches the dawn light.
    const clockPrint = makePrint(192, 192, ctx => {
      ctx.fillStyle = '#ded8bf';
      ctx.fillRect(0, 0, 192, 192);
      ctx.translate(96, 96);
      ctx.strokeStyle = '#304749';
      for (let hour = 0; hour < 12; hour++) {
        ctx.lineWidth = hour % 3 === 0 ? 5 : 3;
        line(ctx, [[0, -80], [0, -69]]);
        ctx.rotate(Math.PI / 6);
      }
      ctx.lineWidth = 7;
      line(ctx, [[-2, 39], [0, 0], [48, -34]]);
      ctx.fillStyle = '#ae543a';
      ctx.beginPath(); ctx.arc(0, 0, 6, 0, 2 * Math.PI); ctx.fill();
    });
    const clockFace = own(new THREE.MeshStandardMaterial({map: own(clockPrint), roughness: .65}));
    const clock = new THREE.Group();
    clock.position.set(-3.49, 2.04, -1.52);
    clock.rotation.y = Math.PI / 2;
    const clockRim = new THREE.Mesh(own(new THREE.CylinderGeometry(.26, .26, .075, 48)), brass);
    clockRim.rotation.x = Math.PI / 2;
    const dial = new THREE.Mesh(own(new THREE.CircleGeometry(.239, 48)), clockFace);
    dial.position.z = .039;
    clock.add(clockRim, dial);
    scene.add(clock);

    const cabinet = pigment('#496664'), label = pigment('#cebf98');
    for (const x of [-2.64, -1.87]) {
      box(scene, iron, x, .84, -2.58, .75, 1.65, .69);
      for (let row = 0; row < 4; row++) {
        const y = .23 + row * .395;
        box(scene, cabinet, x, y, -2.22, .70, .365, .05);
        box(scene, label, x, y + .075, -2.185, .16, .055, .014);
        box(scene, iron, x, y - .032, -2.158, .21, .032, .06);
      }
    }
    // Timber writing desk with a brass edge and inset blotter.
    box(scene, walnut, 0, deskHeight - .065, 0, 2.78, .12, 1.44);
    box(scene, brass, 0, deskHeight - .086, 0, 2.79, .018, 1.45);
    for (const x of [-1.27, 1.27]) for (const z of [-.59, .59]) box(scene, iron, x, .41, z, .071, .82, .071);
    box(scene, cork, 0, deskHeight, mapZ, 2.22, .019, 1.08);
    function chair(x: number, z: number, yaw: number) {
      const seat = new THREE.Group();
      seat.position.set(x, 0, z);
      seat.rotation.y = yaw;
      scene.add(seat);
      box(seat, dado, 0, .46, 0, .52, .085, .48);
      box(seat, dado, 0, .82, -.23, .52, .28, .06);
      for (const side of [-.21, .21]) {
        box(seat, iron, side, .45, -.21, .035, .9, .035);
        box(seat, iron, side, .225, .19, .035, .45, .035);
      }
    }
    chair(-.74, -1.11, -.12);
    chair(1.84, -.15, -1.77);

    // Banker's lamp and docket trays bracket the plans without covering them.
    const lampX = -1.17, lampZ = -.45;
    box(scene, iron, lampX, .946, lampZ, .27, .056, .18);
    box(scene, brass, lampX, 1.13, lampZ, .032, .37, .032);
    box(scene, brass, lampX, 1.31, lampZ + .045, .35, .024, .024);
    const shade = box(scene, dado, lampX, 1.31, lampZ + .09, .39, .11, .15);
    shade.rotation.x = -.18;
    box(scene, ivory, lampX, 1.257, lampZ + .097, .35, .014, .126);
    for (let i = 0; i < 3; i++) {
      box(scene, i % 2 ? ivory : walnut, 1.16 - i * .014, .941 + i * .028, -.40 + i * .012, .31, .027, .34).rotation.y = .07 * i;
    }

    const sheets = [0, 1, 2].map(index => {
      const sheet = new THREE.Group();
      sheet.name = 'Relevé ' + ['A', 'B', 'C'][index];
      box(sheet, ivory, 0, -.0026, 0, sheetWidth, .005, sheetDepth).castShadow = false;
      const print = own(new THREE.MeshStandardMaterial({map: own(printSheet(index)), roughness: .96}));
      const face = new THREE.Mesh(plane, print);
      face.name = 'Plan imprimé';
      face.rotation.x = -Math.PI / 2;
      face.scale.set(sheetWidth, sheetDepth, 1);
      face.receiveShadow = true;
      sheet.add(face);
      scene.add(sheet);
      return sheet;
    });

    const light = new THREE.DirectionalLight('#ffdc9b', 2.75);
    light.position.set(-2.5, 3.2, -5.25);
    light.target.position.set(.2, .15, .8);
    light.castShadow = true;
    Object.assign(light.shadow.camera, {left: -4.3, right: 4.3, top: 3.7, bottom: -3.7, near: .1, far: 14});
    light.shadow.mapSize.set(1024, 1024);
    light.shadow.normalBias = .006;
    light.shadow.intensity = .70;
    own(light.shadow);
    scene.add(light, light.target, new THREE.HemisphereLight('#e4eff7', '#a89b85', 1.48));

    const startX = [-.67, .03, .72], startZ = [.13, -.12, .14], startYaw = [.14, -.11, -.20];
    const target = new THREE.Vector3();
    function pose(progress: number, aspect: number) {
      const t = Number.isFinite(progress) ? THREE.MathUtils.clamp(progress, 0, 1) : 0;
      const fit = THREE.MathUtils.smoothstep(t, 2 / 3, .82);
      sheets.forEach((sheet, i) => {
        sheet.position.set(THREE.MathUtils.lerp(startX[i], (i - 1) * sheetWidth, fit), deskHeight + .015, THREE.MathUtils.lerp(startZ[i], mapZ, fit));
        sheet.rotation.y = startYaw[i] * (1 - fit);
      });
      const shot = Math.min(Math.floor(t * 3), 2);
      const pan = THREE.MathUtils.smoothstep(t * 3 - shot, 0, 1);
      if (shot === 0) {
        camera.position.set(2.16 - .33 * pan, 1.72, 3.25 - .21 * pan);
        target.set(-.43, 1.30, -.85);
      } else if (shot === 1) {
        camera.position.set(.58 - .37 * pan, 1.90 + .11 * pan, 1.56 - .07 * pan);
        target.set(0, deskHeight, -.015);
      } else {
        camera.position.set(.07 * (1 - pan), 2.52, .56 - .24 * pan);
        target.set(0, deskHeight, mapZ);
      }
      // Preserve the whole set of sheets even in tall portrait viewports.
      camera.aspect = Number.isFinite(aspect) && aspect > 0 ? aspect : 1;
      const fov = [49, 42, 44][shot];
      const spread = Math.max(1, 1.72 / camera.aspect);
      camera.fov = THREE.MathUtils.radToDeg(2 * Math.atan(Math.tan(THREE.MathUtils.degToRad(fov / 2)) * spread));
      camera.lookAt(target);
      camera.updateProjectionMatrix();
      camera.updateMatrixWorld();
    }
    pose(0, 1);
    return {scene, camera, pose, dispose};
  } catch (error) {
    dispose();
    throw error;
  }
}

export function createConcordanceScene(canvas: HTMLCanvasElement): ConcordanceScene {
  const renderer = new THREE.WebGLRenderer({canvas, antialias: true, alpha: false});
  let room: ReturnType<typeof buildConcordanceRoom> | undefined;
  let progress = 0;
  let aspect = 1;
  let disposed = false;
  function dispose() {
    if (disposed) return;
    disposed = true;
    room?.dispose();
    renderer.dispose();
    renderer.forceContextLoss();
  }
  function render(next: number) {
    if (disposed || !room) return;
    progress = next;
    room.pose(progress, aspect);
    renderer.render(room.scene, room.camera);
  }
  function resize(width: number, height: number, pixelRatio = window.devicePixelRatio) {
    if (disposed || !Number.isFinite(width) || !Number.isFinite(height) || width <= 0 || height <= 0) return;
    aspect = width / height;
    renderer.setDrawingBufferSize(Math.max(1, Math.round(width)), Math.max(1, Math.round(height)), THREE.MathUtils.clamp(Number.isFinite(pixelRatio) ? pixelRatio : 1, .5, 1.5));
    render(progress);
  }
  try {
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFShadowMap;
    // The daylight, mullions and furniture are fixed. A paper is only 5 mm tall.
    renderer.shadowMap.autoUpdate = false;
    renderer.shadowMap.needsUpdate = true;
    room = buildConcordanceRoom();
    resize(canvas.clientWidth || 1, canvas.clientHeight || 1);
    return {render, resize, dispose};
  } catch (error) {
    dispose();
    throw error;
  }
}
