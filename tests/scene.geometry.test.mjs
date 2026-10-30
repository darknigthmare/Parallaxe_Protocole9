/**
 * CPU-only scene verification. Uses the real Three.js geometry, transforms,
 * raycaster and materials. The WebGL renderer, canvas drawing and PMREM capture
 * are explicitly stubbed because CI may have no graphics context.
 *
 * This does NOT certify pixels, lighting appearance, shaders, FPS or GPU support.
 * Run from the repository root: node tests/scene.geometry.test.mjs
 */
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { createRequire } from 'node:module';
import { fileURLToPath, pathToFileURL } from 'node:url';
import ts from 'typescript';
import * as THREE from 'three';

const require = createRequire(import.meta.url);
const project = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'parallaxe-scene-geometry-'));
const originalWindow = globalThis.window;
const originalDocument = globalThis.document;
const originalCapture = globalThis.__parallaxeGeometryRenderer;
const passed = [];
let game;
let finalStats;

function check(name, callback) {
  callback();
  passed.push(name);
}

function canvasStub() {
  const canvas = { width: 0, height: 0, __text: [] };
  const drawing = new Proxy({}, {
    get(object, key) {
      if (key === 'createLinearGradient') return () => ({ addColorStop() {} });
      if (key === 'fillText') return text => canvas.__text.push(text);
      return object[key] || (() => {});
    },
    set(object, key, value) { object[key] = value; return true; },
  });
  canvas.getContext = () => drawing;
  return canvas;
}

try {
  const threeModule = pathToFileURL(path.join(path.dirname(require.resolve('three')), 'three.module.js')).href;
  let source = ts.transpileModule(fs.readFileSync(path.join(project, 'src/game/scene.ts'), 'utf8'), {
    compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.ES2022 },
  }).outputText;
  source = source.replace("import * as THREE from 'three';", `
    import * as THREE_REAL from ${JSON.stringify(threeModule)};
    const THREE = {
      ...THREE_REAL,
      WebGLRenderer: class {
        constructor() {
          this.shadowMap = {};
          this.capabilities = { getMaxAnisotropy: () => 8 };
          this.info = { render: { calls: 0, triangles: 0 } };
          this.xr = { enabled: false }; this.autoClear = true; this.renderTarget = null;
          this.state = { buffers: { depth: { setMask() {} } }, viewport() {} };
          this.captures = [];
          globalThis.__parallaxeGeometryRenderer = this;
        }
        setClearColor() {}
        setPixelRatio(value) { this.pixelRatio = value; }
        setSize() {}
        getRenderTarget() { return this.renderTarget; }
        setRenderTarget(value) { this.renderTarget = value; }
        render(scene, camera) {
          this.scene = scene; this.camera = camera;
          scene.updateMatrixWorld(true); camera.updateMatrixWorld(true);
          if (this.renderTarget) this.captures.push({
            localVisible: scene.children.find(object => object.userData.localInspector)?.visible,
            reflectedBodyVisible: scene.children.find(object => object.userData.reflectionOnly)?.visible,
            cameraLayers: camera.layers.mask,
            reflectedDoorVisible: scene.getObjectByName('Reflection-only chamber')?.visible,
            witnesses: [1, 2].map(index => scene.getObjectByName('Reflection witness body ' + index)?.visible),
            peers: Object.fromEntries(scene.getObjectByName('Connected inspectors').children.map(object => [object.userData.inspector.id, object.visible])),
          });
        }
        dispose() { this.disposed = true; }
      },
      PMREMGenerator: class {
        fromScene() { return { texture: new THREE_REAL.Texture(), dispose() {} }; }
        dispose() {}
      },
    };
  `);
  source = source.replace(/from '(three\/addons\/[^']+)'/g, (_, specifier) => `from ${JSON.stringify(pathToFileURL(require.resolve(specifier)).href)}`);
  for (const name of ['levels', 'avatar', 'cabin', 'location-clues', 'locations', 'inspection-data', 'inspection-props']) {
    let module = ts.transpileModule(fs.readFileSync(path.join(project, `src/game/${name}.ts`), 'utf8'), { compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.ES2022 } }).outputText;
    module = module.replace("from 'three'", `from ${JSON.stringify(threeModule)}`);
    module = module.replace(/from '(three\/addons\/[^']+)'/g, (_, specifier) => `from ${JSON.stringify(pathToFileURL(require.resolve(specifier)).href)}`);
    module = module.replace(/from '(\.\/(?:levels|avatar|cabin|location-clues|locations|inspection-data|inspection-props))'/g, (_, specifier) => `from ${JSON.stringify(pathToFileURL(path.join(directory, specifier + '.mjs')).href)}`);
    const compiledModule = path.join(directory, `${name}.mjs`); fs.writeFileSync(compiledModule, module);
    source = source.replace(`from './${name}'`, `from ${JSON.stringify(pathToFileURL(compiledModule).href)}`);
  }
  const compiled = path.join(directory, 'scene.mjs');
  fs.writeFileSync(compiled, source);
  globalThis.document = { createElement: () => canvasStub() };
  globalThis.window = { innerWidth: 1440, innerHeight: 900, devicePixelRatio: 2 };
  const { createScene, SCENE_EFFECTS } = await import(pathToFileURL(compiled).href);
  const { createInspector } = await import(pathToFileURL(path.join(directory, 'avatar.mjs')).href);
  let onReadyCount = 0;
  game = createScene({ clientWidth: 1440, clientHeight: 900 }, { onReady() { onReadyCount++; } });
  game.update(0);
  const renderer = globalThis.__parallaxeGeometryRenderer;
  const scene = renderer.scene;
  const allObjects = [];
  scene.traverse(object => allObjects.push(object));
  const roots = id => allObjects.filter(object => object.userData.inspect?.id === id);
  const rootByLabel = label => allObjects.find(object => object.userData.inspect?.label === label);

  for (const [name, previous, current] of [
    ['talkie to idle', { time: 2, speed: 0, talking: true }, { time: 3, speed: 0 }],
    ['talkie to walking', { time: 2, speed: 0, talking: true }, { time: 3, speed: 2.3 }],
    ['radio anomaly to normal', { time: 2, speed: 0, radioSignal: true }, { time: 3, speed: 0 }],
    ['talkie to mannequin', { time: 2, speed: 0, talking: true }, { time: 3, speed: 0, mannequin: true }],
    ['independent reflection to normal', { time: 2, speed: 0, independent: true }, { time: 3, speed: 0 }],
  ]) {
    check(`inspector restores articulated pose: ${name}`, () => {
      const identity = { id: 'pose-regression', name: 'Pose', slot: 0 };
      const actual = createInspector(identity, { nameplate: false });
      const reference = createInspector(identity, { nameplate: false });
      const rotations = model => [model.head, model.root.getObjectByName('Torso'), ...model.shoulders, ...model.elbows, ...model.hands, ...model.hips, ...model.knees].map(joint => joint.rotation.toArray());
      try {
        actual.animate(previous);
        if (previous.talking || previous.radioSignal) {
          assert.equal(actual.radio.visible, true, 'The talkie pose must remain functional');
          assert.equal(actual.shoulders[1].rotation.y, .90);
        } else {
          assert.equal(actual.shoulders[1].rotation.x, 2.25, 'The independent gesture must remain functional');
        }
        actual.animate(current);
        reference.animate(current);
        assert.deepEqual(rotations(actual), rotations(reference), 'A prior gesture must not contaminate the next pose');
        assert.equal(actual.radio.visible, reference.radio.visible);
      } finally {
        actual.dispose(); reference.dispose();
      }
    });
  }

  check('all geometry positions, normals and bounds are finite', () => {
    for (const object of allObjects) {
      if (!object.isMesh) continue;
      for (const attribute of [object.geometry.attributes.position, object.geometry.attributes.normal]) {
        if (!attribute) continue;
        for (const value of attribute.array) assert.ok(Number.isFinite(value), `Nonfinite vertex in ${object.name || object.type}`);
      }
      object.geometry.computeBoundingSphere();
      assert.ok(Number.isFinite(object.geometry.boundingSphere.radius), 'Nonfinite bounding sphere');
    }
    finalStats = game.getStats();
    assert.ok(finalStats.sceneTriangles > 100_000, 'Detailed scene geometry unexpectedly missing');
    assert.ok(finalStats.sceneTriangles < 1_500_000, 'Unexpected stored geometry growth');
    for (const count of Object.values(finalStats.levelTriangles)) assert.ok(count < 500_000, 'Unexpected per-location geometry growth');
    assert.ok(finalStats.meshes < 2_500, 'Unexpected mesh-count growth');
  });

  check('wall landmarks face inward; floor faces upward', () => {
    const landmarks = allObjects.filter(object => {
      const info = object.userData.inspect;
      return info && (['portrait', 'mirror', 'window', 'clock'].includes(info.id) || /^Porte 90/.test(info.label));
    });
    for (const landmark of landmarks) {
      const worldPosition = landmark.getWorldPosition(new THREE.Vector3());
      const forward = new THREE.Vector3(0, 0, 1).transformDirection(landmark.matrixWorld);
      assert.ok(forward.dot(new THREE.Vector3(-Math.sign(worldPosition.x), 0, 0)) > .99, `Outward-facing landmark: ${landmark.userData.inspect.label}`);
    }
    const rug = rootByLabel('Le tapis et le sol');
    assert.ok(new THREE.Vector3(0, 0, 1).transformDirection(rug.matrixWorld).y > .99);
  });

  check('wall lights align with their physical fixtures', () => {
    const sconces = allObjects.filter(object => object.isPointLight && object.intensity === 4.5);
    const fixtures = allObjects.filter(object => object.isMesh && object.geometry.type === 'CylinderGeometry' && object.material.emissive?.getHex() === 0xffc878);
    assert.equal(sconces.length, 4);
    for (const light of sconces) {
      const position = light.getWorldPosition(new THREE.Vector3());
      const closest = Math.min(...fixtures.map(fixture => position.distanceTo(fixture.getWorldPosition(new THREE.Vector3()))));
      assert.ok(closest < .4, `Light is ${closest.toFixed(2)} m from its nearest fixture`);
    }
  });

  function renderSignature() {
    return allObjects.map(object => {
      const materials = object.material ? (Array.isArray(object.material) ? object.material : [object.material]) : [];
      return [object.uuid, object.visible, ...materials.map(material => {
        const relayText = material.map?.image?.__text;
        const texture = relayText?.includes('RELAIS') ? relayText.join('|') : material.map?.uuid;
        return [texture, material.color?.getHex(), material.emissive?.getHex(), material.emissiveIntensity, material.visible];
      })];
    });
  }

  check('all registered visual effects apply and restore baseline visibility/materials', () => {
    assert.equal(new Set(SCENE_EFFECTS).size, SCENE_EFFECTS.length, 'Visual effect handlers must be unique');
    game.setView({ effects: [], phase: 'inspect', relayCode: '0909' });
    const before = renderSignature();
    for (const effect of SCENE_EFFECTS) {
      game.setView({ effects: [effect], relayCode: effect === 'relay_mismatch' ? '4271' : '0909' });
      game.update(0);
      game.setView({ effects: [], relayCode: '0909' });
      assert.deepEqual(renderSignature(), before, `Unrestored material or visibility after ${effect}`);
    }
  });

  check('relay values are legible text inputs, stable on repeat, and previous textures disposed', () => {
    const display = allObjects.find(object => object.material?.map?.image?.__text?.includes('RELAIS'));
    assert.ok(display);
    const oldMap = display.material.map;
    let disposed = false;
    oldMap.addEventListener('dispose', () => { disposed = true; });
    game.setView({ effects: [], relayCode: '1234' });
    assert.deepEqual(display.material.map.image.__text, ['RELAIS', '1234']);
    assert.ok(disposed);
    const repeated = display.material.map;
    game.setView({ effects: [], relayCode: '1234' });
    assert.equal(display.material.map, repeated);
    game.setView({ effects: [], relayCode: 'invalid' });
    assert.deepEqual(display.material.map.image.__text, ['RELAIS', '0909']);
  });

  function inspectFrom(effect, eye, point, expected, levelId = 'hotel') {
    game.setView({ effects: [effect], phase: 'inspect', levelId, relayCode: effect === 'relay_mismatch' ? '4271' : '0909', arrowDirection: effect === 'paired_arrow' ? 'left' : 'right', syncTime: effect === 'paired_clock' ? '04:17' : '03:09' });
    game.setActive(true);
    game.setPose({ x: eye[0], z: eye[1], yaw: 0, pitch: 0 });
    game.setInput({ forward: 1, strafe: 0 });
    game.update(.001);
    assert.ok(Math.abs(game.getPose().z - eye[1]) > .001, `${effect}: inspection vantage is blocked by a collider`);
    game.setInput({ forward: 0, strafe: 0 });
    game.setPose({ x: eye[0], z: eye[1] });
    game.update(0);
    const targetPoint = typeof point === 'function' ? point() : new THREE.Vector3(...point);
    const position = new THREE.Vector3(eye[0], 1.67, eye[1]);
    const direction = targetPoint.clone().sub(position).normalize();
    game.setPose({ yaw: Math.atan2(-direction.x, -direction.z), pitch: Math.asin(direction.y) });
    for (let frame = 0; frame < 4; frame++) game.update(0);
    assert.equal(game.getTarget()?.id, expected, `${effect}: landmark ray missed (${JSON.stringify(game.getTarget())}); eye=${position.toArray()} point=${targetPoint.toArray()} pose=${JSON.stringify(game.getPose())}`);
  }
  function centerOf(object) { return new THREE.Box3().setFromObject(object).getCenter(new THREE.Vector3()); }

  check('all 25 clue locations are raycast-inspectable from walkable positions', () => {
    const ceiling = [[0, 5], [0, 3.45, 2], 'ceiling'];
    const cases = {
      clock_reverse: [[1.8, -5.65], [3.5, 2.43, -5.65], 'clock'],
      clock_missing: [[1.8, -5.65], [3.5, 2.43, -5.65], 'clock'],
      portrait_eyes: [[-1.8, 5.15], [-3.45, 2.06, 5.15], 'portrait'],
      portrait_empty: [[-1.8, 5.15], [-3.45, 2.06, 5.15], 'portrait'],
      door_number: [[-1.8, 0], [-3.45, 2.31, 0], 'door'],
      door_open: [[-1.8, 0], [-3.45, 1.35, 0], 'door'],
      plant_dead: [[-1.8, 7.7], [-2.92, .9, 7.7], 'plant'],
      plant_tall: [[-1.8, 7.7], [-2.92, 1.3, 7.7], 'plant'],
      trolley_missing: [[1.6, -3.76], [2.66, .85, -3.76], 'trolley'],
      red_light: ceiling,
      blackout: ceiling,
      shadow_figure: [[0, -9], [-1.7, 1.2, -11.78], 'door'],
      ceiling_eyes: [[0, 6], [0, 3.43, 5], 'ceiling'],
      floor_trail: [[0, 7], [-.15, .013, 5.8], 'floor'],
      exit_false: [[0, -10.4], [0, 3.1, -15.7], 'exit'],
      chair_float: [[-1, 2.65], () => centerOf(rootByLabel('Fauteuil du salon')), 'chair'],
      mirror_stranger: [[1.8, 3.75], [3.45, 2.05, 3.75], 'mirror'],
      phone_float: [[2.4, 8.65], () => centerOf(rootByLabel('Téléphone de la réception').children.find(object => object.isGroup)), 'phone'],
      window_watcher: [[-2, -12.25], [-3.45, 2, -12.25], 'window'],
      wall_message: [[-1.7, -2.9], [-3.5, 2.15, -2.9], 'portrait'],
      corridor_fog: ceiling,
      duplicate_chair: [[.6, -5.5], [-.85, .8, -5.5], 'chair'],
      blood_handprint: [[1.8, 5.75], [3.5, 2.1, 5.75], 'portrait'],
      missing_reflection: [[1.8, 3.75], [3.45, 2.05, 3.75], 'mirror'],
      relay_mismatch: [[2.8, 8.7], [3.11, 1.32, 7.76], 'radio'],
    };
    for (const [effect, values] of Object.entries(cases)) inspectFrom(effect, ...values);
  });

  check('the 23 new visual clues are raycast-inspectable in their actual location', () => {
    const mirror = [[1.8, 3.75], [3.45, 2.05, 3.75], 'mirror'];
    const convergence = [[-1.7, 10.85], [-3.49, 2.06, 10.85], 'radio'];
    const cases = {
      reflection_delay: [...mirror], reflection_absent: [...mirror], reflection_independent: [...mirror],
      avatar_mannequin: [[0, 6], [0, .80, 5.8], 'player'],
      avatar_double: [[.1, -2.6], [-1.15, 1.25, -4.8], 'player'],
      avatar_shadow: [[0, 1.5], () => centerOf(rootByLabel('Ombre sans inspecteur')), 'player'],
      radio_signal: [[0, 6], () => centerOf(rootByLabel('Votre talkie-walkie')), 'radio'],
      metro_train: [[-2.8, -3], [-4.9, 1.8, -3], 'train', 'metro'],
      metro_destination: [[0, -2.8], [0, 2.94, -6.065], 'train', 'metro'],
      metro_signal: [[1.8, -9.4], [3.38, 2.22, -9.4], 'signal', 'metro'],
      metro_tracks: [[-2.9, -2], () => roots('tracks')[0].localToWorld(new THREE.Vector3(-.72, .13, 0)), 'tracks', 'metro'],
      clinic_bed: [[-1, -3.3], () => centerOf(rootByLabel('Lit de consultation')), 'bed', 'clinic'],
      clinic_monitor: [[-1.3, -3.3], [-3.344, 1.95, -3.3], 'monitor', 'clinic'],
      clinic_curtain: [[1, -4.5], [2.68, 1.3, -6], 'curtain', 'clinic'],
      clinic_wheelchair: [[.8, 1.5], [2.48, .52, 1.5], 'wheelchair', 'clinic'],
      ceiling_lower: [[0, 5.5], [0, 2.55, 3], 'ceiling'],
      wall_pulse: [[1.8, -1.8], [3.5, 1.99, -1.8], 'portrait'],
      luggage_breath: [[1.6, -3.76], [2.66, .85, -3.76], 'trolley'],
      curtain_breath: [[1, -4.5], [2.68, 1.3, -6], 'curtain', 'clinic'],
      clinic_bed_count: [[.7, -8], [2.3, .8, -9.05], 'bed', 'clinic'],
      metro_shadow_train: [[1.8, -3], [3.69, 2.18, -3], 'train', 'metro'],
      paired_arrow: [...convergence], paired_clock: [...convergence],
    };
    assert.equal(Object.keys(cases).length, 23);
    for (const [effect, values] of Object.entries(cases)) inspectFrom(effect, ...values);
  });

  check('reflection passes select the full local body, absent body or delayed body without recursion', () => {
    game.setQuality('high');
    game.setActive(true);
    const surface = allObjects.find(object => object.isReflector);
    const allSurfaces = allObjects.filter(object => object.isReflector);
    for (const effect of [null, 'reflection_absent', 'reflection_delay', 'reflection_independent', 'reflection_seated', 'reflection_badge_code']) {
      game.setView({ effects: effect ? [effect] : [], levelId: 'hotel' });
      game.setPose({ x: 1.8, z: 3.75, yaw: -Math.PI / 2, pitch: 0 }); game.update(0);
      const mainCamera = renderer.camera;
      const before = allSurfaces.map(object => object.visible);
      const count = renderer.captures.length;
      surface.onBeforeRender(renderer, scene, mainCamera, surface.geometry, surface.material, null);
      assert.equal(renderer.captures.length, count + 1, 'Exactly one planar capture expected');
      const capture = renderer.captures.at(-1);
      assert.equal(capture.localVisible, effect === null);
      assert.equal(capture.reflectedBodyVisible, ['reflection_delay', 'reflection_independent', 'reflection_seated', 'reflection_badge_code'].includes(effect));
      assert.ok((capture.cameraLayers & 2) === 2, 'Reflection camera must see the layer containing the local head');
      assert.equal(mainCamera.layers.mask & 2, 0, 'Main camera must exclude the local head');
      assert.deepEqual(allSurfaces.map(object => object.visible), before, 'Reflective surfaces were not restored');
      assert.equal(scene.children.find(object => object.userData.localInspector).visible, true);
      assert.equal(scene.children.find(object => object.userData.reflectionOnly).visible, false);
    }
  });

  check('the delayed reflection follows one-second history and the independent reflection gestures alone', () => {
    game.setView({ effects: ['reflection_delay'], levelId: 'hotel' }); game.setActive(true);
    game.setPose({ x: 0, z: 7, yaw: 0, pitch: 0 }); game.setInput({ forward: 1, strafe: 0 });
    for (let frame = 0; frame < 35; frame++) game.update(.05);
    const local = scene.children.find(object => object.userData.localInspector);
    const reflected = scene.children.find(object => object.userData.reflectionOnly);
    const lag = reflected.position.z - local.position.z;
    assert.ok(lag > 2.1 && lag < 2.6, `Incorrect one-second lag: ${lag} m`);
    game.setInput({ forward: 0, strafe: 0 }); game.setView({ effects: ['reflection_independent'], levelId: 'hotel' }); game.update(.05);
    assert.ok(Math.abs(reflected.getObjectByName('Right shoulder').rotation.x - local.getObjectByName('Right shoulder').rotation.x) > 1.5);
  });

  check('the extra chamber exists only in the primary hotel mirror capture and is restored after a failed capture', () => {
    const surface = allObjects.find(object => object.isReflector);
    const doorway = scene.getObjectByName('Reflection-only chamber');
    game.setPeers([]); game.setActive(true); game.setQuality('high');
    game.setView({ effects: ['mirror_extra_door'], levelId: 'hotel', phase: 'inspect' });
    game.setPose({ x: 1.8, z: 3.75, yaw: -Math.PI / 2, pitch: 0 }); game.update(0);
    const mainCamera = renderer.camera;
    assert.equal(doorway.visible, false, 'Turning around must never reveal the reflected door in the real room');
    const planeX = surface.getWorldPosition(new THREE.Vector3()).x;
    const actual = new THREE.Vector3(0, 1.45, .20); doorway.localToWorld(actual); actual.x = 2 * planeX - actual.x;
    const eye = renderer.camera.position, crossing = eye.clone().lerp(actual, (planeX - eye.x) / (actual.x - eye.x));
    const aperture = surface.worldToLocal(crossing);
    assert.ok(Math.abs(aperture.x) < surface.geometry.parameters.width / 2 && Math.abs(aperture.y) < surface.geometry.parameters.height / 2, 'The extra door must project inside the physical mirror');
    surface.onBeforeRender(renderer, scene, mainCamera, surface.geometry, surface.material, null);
    assert.equal(renderer.captures.at(-1).reflectedDoorVisible, true);
    assert.equal(doorway.visible, false);
    const render = renderer.render;
    renderer.render = () => { throw new Error('capture interruption'); };
    assert.throws(() => surface.onBeforeRender(renderer, scene, mainCamera, surface.geometry, surface.material, null), /capture interruption/);
    renderer.render = render; renderer.setRenderTarget(null);
    assert.equal(doorway.visible, false, 'A renderer error must not expose a private mirror-only object in the room');
    assert.equal(scene.children.find(object => object.userData.localInspector).visible, true);
    game.setView({ effects: ['mirror_extra_door'], phase: 'reference' }); game.update(0);
    surface.onBeforeRender(renderer, scene, mainCamera, surface.geometry, surface.material, null);
    assert.equal(renderer.captures.at(-1).reflectedDoorVisible, false, 'Reference must clear stale anomalous effects');
    game.setView({ effects: [], phase: 'inspect' });
  });

  check('group absence affects only reflected peers and provides a persistent solo mannequin comparison in every location', () => {
    game.setQuality('high'); game.setActive(true);
    const peerInput = [
      { id: 'seen-peer', name: 'Visible', slot: 1, pose: { x: 1, z: 4.5, yaw: 0 } },
      { id: 'gone-peer', name: 'Absent', slot: 2, connected: false, pose: { x: 1, z: 3, yaw: 0 } },
    ];
    const visible = object => { for (let p = object; p; p = p.parent) if (!p.visible) return false; return true; };
    for (const levelId of ['hotel', 'metro', 'clinic', 'cabin']) {
      game.setView({ effects: [], levelId, phase: 'inspect' }); game.setPeers(peerInput);
      game.setPose({ x: 1.8, z: 3.75, yaw: -Math.PI / 2, pitch: 0 }); game.update(0);
      const mainCamera = renderer.camera;
      const surface = allObjects.find(object => object.isReflector && object.getWorldPosition(new THREE.Vector3()).x > 3 && visible(object));
      assert.ok(surface, `${levelId}: missing accessible right-side reflection surface`);
      const capture = () => { surface.onBeforeRender(renderer, scene, mainCamera, surface.geometry, surface.material, null); return renderer.captures.at(-1); };
      assert.deepEqual(capture().peers, { 'seen-peer': true, 'gone-peer': false });
      game.setView({ effects: ['reflection_no_team'], levelId, phase: 'inspect' }); game.update(0);
      const anomalous = capture();
      assert.equal(anomalous.localVisible, true, 'The observer must still see their own reflection');
      assert.deepEqual(anomalous.peers, { 'seen-peer': false, 'gone-peer': false });
      assert.equal(scene.getObjectByName('Inspecteur Visible').visible, true);
      assert.equal(scene.getObjectByName('Inspecteur Absent').visible, false, 'Capture must not reconnect or unhide an absent participant');
      game.setPeers([]); game.setView({ effects: [], levelId }); game.update(0);
      assert.deepEqual([1, 2].map(index => scene.getObjectByName(`Reflection witness body ${index}`).visible), [true, true]);
      assert.deepEqual(capture().witnesses, [true, true], 'Solo normal passage must reflect both numbered witnesses');
      game.setView({ effects: ['reflection_no_team'] }); game.update(0);
      assert.deepEqual(capture().witnesses, [false, false]);
      assert.deepEqual([1, 2].map(index => scene.getObjectByName(`Reflection witness body ${index}`).visible), [true, true], 'Physical witnesses must persist for a direct comparison');
      game.setView({ effects: [], levelId }); game.update(0);
      assert.deepEqual(capture().witnesses, [true, true]);
    }
    game.setView({ effects: [], levelId: 'hotel', phase: 'inspect' });
  });

  check('roots grow below the threshold, wall drops rise and the exit gasket opens without changing the inspection route', () => {
    const roots = scene.getObjectByName('Roots below chamber 901'), drops = scene.getObjectByName('Upward wall droplets');
    const drop = scene.getObjectByName('Ascending wall drop 1'), gasket = scene.getObjectByName('Diagnostic exit gasket');
    const fifthDoor = scene.getObjectByName('Additional fifth chamber');
    game.setView({ effects: ['root_under_door'], levelId: 'hotel', phase: 'inspect', loop: 20 }); game.update(0);
    const beginning = new THREE.Box3().setFromObject(roots).getSize(new THREE.Vector3()).x;
    for (let frame = 0; frame < 80; frame++) game.update(.05);
    const grown = new THREE.Box3().setFromObject(roots).getSize(new THREE.Vector3()).x;
    assert.ok(roots.visible && grown > beginning * 4 && roots.scale.x === 1);
    assert.ok(new THREE.Box3().setFromObject(roots).max.x < -2, 'Roots must stop before the common walking aisle');
    game.setView({ effects: ['water_up_wall'], loop: 21 }); game.update(0); const beforeDrop = drop.position.y;
    game.update(.05); assert.ok(drop.position.y > beforeDrop && drops.visible, 'Opaque drops must have an actual upward trajectory');
    assert.ok(!drop.material.transparent, 'A low graphics setting must retain solid drop silhouettes');
    game.setView({ effects: ['exit_breath'], loop: 22 }); game.update(0);
    for (let frame = 0; frame < 50; frame++) game.update(.05);
    assert.ok(gasket.userData.opening > .9 && gasket.children[0].scale.x > 5, 'The gap must have a visible slow opening cycle');
    game.setView({ effects: ['extra_door'], loop: 23 }); game.update(0);
    assert.ok(fifthDoor.visible && !roots.visible && !drops.visible);
    assert.equal(gasket.children[0].scale.x, 1, 'The prior exit gap must reset immediately');
    for (const effect of ['', 'root_under_door', 'water_up_wall', 'extra_door', 'exit_breath']) {
      game.setView({ effects: effect ? [effect] : [], levelId: 'hotel', phase: 'inspect' }); game.setActive(true);
      game.setPose({ x: 0, z: 9, yaw: 0, pitch: 0 }); game.setInput({ forward: 1, strafe: 0 });
      for (let frame = 0; frame < 400; frame++) game.update(.03);
      assert.ok(game.getPose().z > -12.42 && game.getPose().z < -12.3, `${effect}: a private visual effect changed the shared path`);
    }
    game.setInput({ forward: 0, strafe: 0 });
    game.setView({ effects: ['root_under_door', 'water_up_wall', 'extra_door', 'exit_breath'], phase: 'reference' }); game.update(0);
    assert.ok(!roots.visible && !drops.visible && !fifthDoor.visible);
    assert.equal(gasket.userData.opening, 0); assert.equal(roots.scale.x, 1);
    game.setView({ effects: [], phase: 'inspect', levelId: 'metro' }); game.update(0);
    assert.equal(gasket.parent.visible, false, 'Hotel geometry must stay within its location');
    game.setView({ effects: [], phase: 'inspect', levelId: 'hotel' });
  });

  check('the new environmental clues remain reachable through actual full-scene inspection rays', () => {
    const rootPoint = () => {
      const mesh = scene.getObjectByName('Roots below chamber 901').children[0], { radialSegments, tubularSegments } = mesh.geometry.parameters;
      const point = new THREE.Vector3(), index = Math.floor(tubularSegments / 2) * (radialSegments + 1);
      for (let ring = 0; ring < radialSegments; ring++) point.add(new THREE.Vector3().fromBufferAttribute(mesh.geometry.attributes.position, index + ring));
      return mesh.localToWorld(point.divideScalar(radialSegments));
    };
    inspectFrom('root_under_door', [-1.85, .6], rootPoint, 'door');
    inspectFrom('water_up_wall', [1.8, -2.25], () => scene.getObjectByName('Ascending wall drop 1').getWorldPosition(new THREE.Vector3()), 'portrait');
    inspectFrom('extra_door', [1.8, -12.2], [3.405, 2.30, -12.2], 'door');
    inspectFrom('exit_breath', [.9, -14.0], [.8425, 1.41, -15.32], 'exit');
    inspectFrom('mirror_extra_door', [1.8, 3.75], [3.45, 2.05, 3.75], 'mirror');
  });

  check('the 14 added character and location clues are visible to inspection rays from walkable positions', () => {
    const body = [[0, 7], () => centerOf(scene.getObjectByName('Inspecteur Clue witness').getObjectByName('Torso')), 'player'];
    const mirror = [[1.8, 3.75], [3.45, 2.05, 3.75], 'mirror'];
    const cases = {
      avatar_badge_missing: [...body], avatar_height_offset: [...body], avatar_hands_swap: [...body], avatar_no_contact: [...body],
      avatar_visor_watch: [[0, 7], [0, 1.65, 5], 'player'], reflection_seated: [...mirror], reflection_badge_code: [...mirror],
      metro_timetable_loop: [[1.8, -12.8], [3.48, 2.08, -12.8], 'train', 'metro'],
      metro_route_poster: [[1.8, -.9], [3.5, 2.1, -.9], 'portrait', 'metro'],
      metro_platform_count: [[-1.9, 10.55], [-3.25, 1.42, 10.55], 'signal', 'metro'],
      metro_tunnel_daylight: [[-2.75, -14.2], [-5.94, 1.25, -15.75], 'tracks', 'metro'],
      clinic_tag_echo: [[-1, -1.2], [-2.32, 1.01, -2.207], 'bed', 'clinic'],
      clinic_shadow_bed: [[-1.25, -2.25], [-3.675, 2.18, -2.215], 'bed', 'clinic'],
      clinic_iv_reverse: [[-1.15, -4.7], [-3.05, 1.55, -4.42], 'iv', 'clinic'],
    };
    assert.equal(Object.keys(cases).length, 14);
    for (const [effect, values] of Object.entries(cases)) {
      game.setPeers(effect.startsWith('avatar_') ? [{ id: 'clue-witness', name: 'Clue witness', slot: 1, pose: { x: 0, z: 5, yaw: Math.PI } }] : []);
      inspectFrom(effect, ...values);
    }
    game.setPeers([]);
  });

  check('avatar changes affect real joints and restore identity, handedness, eyes, scale and ground contact', () => {
    game.setPeers([]); game.setActive(true); game.setPose({ x: 0, z: 6, yaw: 0, pitch: 0 });
    const local = scene.children.find(object => object.userData.localInspector);
    const badge = local.getObjectByName('Identity badge'), radio = local.getObjectByName('Handheld radio');
    const eye = local.getObjectByName('Left eye'), shadow = local.getObjectByName('Foot contact shadow');
    game.setView({ effects: [], levelId: 'hotel' }); game.update(0);
    const map = badge.material.map;
    assert.equal(badge.userData.code, '01'); assert.equal(radio.parent.name, 'Right hand'); assert.ok(radio.visible);
    game.setView({ effects: ['avatar_badge_missing'] }); game.update(0); assert.equal(badge.userData.code, '');
    game.setView({ effects: ['avatar_hands_swap'] }); game.update(0); assert.equal(radio.parent.name, 'Left hand');
    game.setTalking(true); game.update(0); assert.ok(local.getObjectByName('Left shoulder').rotation.x > 1.5);
    game.setTalking(false); game.setView({ effects: ['avatar_height_offset'] }); game.update(0);
    assert.equal(local.scale.y, 1.48); assert.equal(game.getPose().y, 1.67, 'Visual growth must not change camera/collision height');
    game.setView({ effects: ['avatar_no_contact'] }); game.update(0); assert.equal(local.position.y, .20);
    assert.ok(Math.abs(shadow.getWorldPosition(new THREE.Vector3()).y - .009) < .0001, 'Contact reference must stay on the floor');
    game.setView({ effects: ['avatar_visor_watch'] }); game.update(0); assert.ok(Math.abs(eye.rotation.y) > .3, 'The pupil must track independently inside the helmet');
    game.setView({ effects: [] }); game.update(0);
    assert.equal(badge.material.map, map); assert.equal(radio.parent.name, 'Right hand'); assert.equal(local.scale.y, 1); assert.equal(local.position.y, 0); assert.equal(eye.rotation.y, 0);
    game.setPeers([{ id: 'anomaly-peer', name: 'Beta', slot: 1, pose: { x: 1, z: 6, yaw: 0 } }]);
    game.setView({ effects: ['avatar_badge_missing'] }); game.update(0);
    const peer = scene.getObjectByName('Inspecteur Beta');
    assert.equal(peer.getObjectByName('Identity badge').userData.code, ''); assert.equal(badge.userData.code, '01');
    game.setPeers([]); game.update(0); assert.equal(badge.userData.code, '', 'Solo body must retain the clue after the last peer leaves');
    game.setView({ effects: [] }); game.update(0);
  });

  check('badge readings resolve raycast identities despite duplicate names and reserved-looking labels', () => {
    const witnesses = [
      { id: 'same-name-a', name: 'Inspecteur', slot: 1, pose: { x: -1.2, z: 5, yaw: Math.PI } },
      { id: 'same-name-b', name: 'Inspecteur', slot: 2, pose: { x: 0, z: 5, yaw: Math.PI } },
      { id: 'reserved-name', name: 'Un inspecteur en trop', slot: 3, pose: { x: 1.2, z: 5, yaw: Math.PI } },
    ];
    game.setPeers(witnesses);
    for (const witness of witnesses) {
      inspectFrom('', [witness.pose.x, 7], [witness.pose.x, 1.16, 5], 'player', 'hotel');
      assert.deepEqual(game.getTarget().inspector, { kind: 'peer', id: witness.id });
      assert.deepEqual(game.getInspection().lines, [`INSPECTEUR ${String(witness.slot + 1).padStart(2, '0')}`, 'PARALLAXE']);
    }
    inspectFrom('avatar_badge_missing', [0, 7], [0, 1.16, 5], 'player', 'hotel');
    assert.deepEqual(game.getInspection().lines, ['INSPECTEUR 03', 'PARALLAXE'], 'A different peer with the same name must retain their own badge');
    inspectFrom('avatar_badge_missing', [-1.2, 7], [-1.2, 1.16, 5], 'player', 'hotel');
    assert.deepEqual(game.getInspection().lines, ['PLAQUE VIERGE']);
    inspectFrom('avatar_double', [-1.15, -2.4], [-1.15, 1.16, -4.8], 'player', 'hotel');
    assert.deepEqual(game.getTarget().inspector, { kind: 'double', id: 'local' });
    assert.deepEqual(game.getInspection().lines, ['INSPECTEUR 01', 'PARALLAXE']);
    inspectFrom('avatar_double', [1.2, 7], [1.2, 1.16, 5], 'player', 'hotel');
    assert.deepEqual(game.getTarget().inspector, { kind: 'peer', id: 'reserved-name' });
    assert.deepEqual(game.getInspection().lines, ['INSPECTEUR 04', 'PARALLAXE']);
    game.setPeers([]);
    assert.equal(game.getInspection(), null, 'A departed peer must not resolve to a different body while the old target is still cached');
    game.setPeers([{ id: 'self-label-name', name: 'Votre tenue d’inspection', slot: 3, pose: { x: 0, z: 5, yaw: Math.PI } }]);
    inspectFrom('', [0, 7], [0, 1.16, 5], 'player', 'hotel');
    assert.deepEqual(game.getInspection().lines, ['INSPECTEUR 04', 'PARALLAXE']);
    game.setPeers([]); game.setView({ effects: [] }); game.update(0);
  });

  check('seated reflection has bent legs at the empty seat, and badge identity changes only in the reflection', () => {
    const local = scene.children.find(object => object.userData.localInspector), reflected = scene.children.find(object => object.userData.reflectionOnly);
    game.setView({ effects: ['reflection_seated'], levelId: 'hotel' }); game.setPose({ x: 1.8, z: 3.75, yaw: -Math.PI / 2, pitch: 0 }); game.update(0);
    assert.equal(reflected.position.x, 2.05); assert.equal(reflected.position.z, 4.40); assert.equal(reflected.position.y, -.39);
    assert.equal(reflected.getObjectByName('Left hip').rotation.x, Math.PI / 2);
    assert.equal(reflected.getObjectByName('Left hip').children.find(child => child.isGroup).rotation.x, -Math.PI / 2);
    assert.equal(local.position.y, 0);
    // Project the reflected head/hips through the actual mirror plane. Both must fit its aperture.
    const surface = allObjects.find(object => object.isReflector), planeX = surface.getWorldPosition(new THREE.Vector3()).x;
    for (const bone of ['Head and helmet', 'Left hip']) {
      const p = reflected.getObjectByName(bone).getWorldPosition(new THREE.Vector3()); p.x = 2 * planeX - p.x;
      const eye = renderer.camera.position, factor = (planeX - eye.x) / (p.x - eye.x);
      const intersection = eye.clone().lerp(p, factor); const within = surface.worldToLocal(intersection);
      assert.ok(Math.abs(within.x) < surface.geometry.parameters.width / 2 && Math.abs(within.y) < surface.geometry.parameters.height / 2, `${bone} outside mirror aperture`);
    }
    game.setView({ effects: ['reflection_badge_code'] }); game.update(0);
    assert.equal(local.getObjectByName('Identity badge').userData.code, '01'); assert.equal(reflected.getObjectByName('Identity badge').userData.code, '02');
    let observed = false; const render = renderer.render.bind(renderer);
    renderer.render = (world, camera) => { if (renderer.renderTarget) { observed = true; const badge = reflected.getObjectByName('Identity badge'); assert.equal(badge.scale.x, -1); assert.ok(badge.matrixWorld.determinant() < 0); } render(world, camera); };
    game.setQuality('high'); surface.onBeforeRender(renderer, scene, renderer.camera, surface.geometry, surface.material, null);
    renderer.render = render; assert.ok(observed); assert.equal(reflected.getObjectByName('Identity badge').scale.x, 1); assert.ok(reflected.getObjectByName('Identity badge').matrixWorld.determinant() > 0, 'The main render must not keep the reflection-only glyph transform');
    game.setView({ effects: [] }); game.update(0); assert.equal(reflected.getObjectByName('Identity badge').userData.code, '01'); assert.equal(reflected.position.y, 0);
  });

  check('metro readings, controlled count and gradual physical horizon reset without stale textures', () => {
    game.setView({ levelId: 'metro', effects: [] }); game.update(0);
    const board = rootByLabel('Tableau des départs archivés'); const display = board.children.find(object => object.material?.map);
    const normal = display.material.map;
    game.setView({ effects: ['metro_timetable_loop'] }); game.update(0);
    assert.ok(display.material.map.image.__text.some(line => line.includes('T09  ←')));
    game.setView({ effects: ['metro_route_poster'] }); game.update(0);
    const route = rootByLabel('Plan de la ligne').children.find(object => object.material?.map);
    assert.ok(route.material.map.image.__text.includes('NULLE PART'));
    game.setView({ effects: ['metro_platform_count'] }); game.update(0);
    const counter = allObjects.find(object => object.userData.counterValue !== undefined);
    const start = counter.userData.counterValue;
    for (let frame = 0; frame < 51; frame++) game.update(.05);
    assert.equal(counter.userData.counterValue, start + 1);
    let disposed = false; counter.material.map.addEventListener('dispose', () => { disposed = true; });
    game.setView({ effects: ['metro_tunnel_daylight'] }); game.update(0);
    assert.ok(disposed); assert.equal(counter.userData.counterValue, 0);
    const sky = scene.getObjectByName('Impossible daylight horizon'); assert.equal(sky.userData.strength, 0);
    for (let frame = 0; frame < 42; frame++) game.update(.05);
    assert.equal(sky.userData.strength, 1); assert.ok(sky.children.length >= 5);
    game.setView({ effects: [] }); game.update(0);
    assert.equal(display.material.map, normal); assert.equal(sky.visible, false); assert.ok(!route.material.map.image.__text.includes('NULLE PART'));
  });

  check('clinic has distinct bed labels, a separate flat occupant shadow and genuinely reversed drops', () => {
    game.setView({ levelId: 'clinic', effects: [] }); game.update(0);
    const secondBed = rootByLabel('Lit de la salle vitrée');
    let badge; secondBed.traverse(object => { if (object.material?.map) badge = object; });
    assert.deepEqual(badge.material.map.image.__text, ['LIT 10 · EXPOSITION']);
    game.setView({ effects: ['clinic_tag_echo'] }); game.update(0); assert.deepEqual(badge.material.map.image.__text, ['LIT 09 · EXPOSITION']);
    game.setView({ effects: ['clinic_shadow_bed'] }); game.update(0);
    const shadow = scene.getObjectByName('Seated occupant shadow'); assert.ok(shadow.visible);
    const bounds = new THREE.Box3().setFromObject(shadow).getSize(new THREE.Vector3()); assert.ok(bounds.x < .02 && bounds.y > 1.5, 'The occupant must remain a wall projection');
    const drop = scene.getObjectByName('Demonstration drop 1');
    game.setView({ effects: [] }); game.update(0); const normal = drop.userData.flowParameter; game.update(.05);
    assert.ok(Math.abs((drop.userData.flowParameter - normal + 1) % 1 - .011) < .0001);
    game.setView({ effects: ['clinic_iv_reverse'] }); game.update(0); const reverse = drop.userData.flowParameter; game.update(.05);
    assert.ok(Math.abs((reverse - drop.userData.flowParameter + 1) % 1 - .011) < .0001);
    game.setView({ effects: [] }); game.update(0); assert.equal(shadow.visible, false); assert.deepEqual(badge.material.map.image.__text, ['LIT 10 · EXPOSITION']);
  });

  check('the seven hotel exhibits remain inspectable in the complete scene and expose the exact current reading', () => {
    const cases = {
      paired_room: [[-1.7, 9.68], [-3.485, 1.92, 9.68], 'assignment', '205'],
      paired_stamp: [[-1.7, 8.82], [-3.485, 1.92, 8.82], 'document', 'REFUSÉ'],
      paired_newspaper: [[-1.7, 9.25], [-3.25, 1.08, 9.25], 'newspaper', '27 OCTOBRE 2026'],
      paired_luggage: [[1.8, 1.48], [2.973, .90, 1.48], 'luggage', 'rectangulaire : 18'],
      sand_upward: [[-1.7, -6.72], [-3.31, 1.36, -6.72], 'hourglass', 'vers le haut'],
      steam_downward: [[-1.7, -7.60], [-3.13, 1.16, -7.60], 'cup', 'descend'],
      same_key_twice: [[-1.7, -7.2], [-3.51, 1.93, -7.2], 'keys', '2 CLÉS'],
    };
    for (const [effect, [eye, point, expected, text]] of Object.entries(cases)) {
      inspectFrom(effect, eye, point, expected, 'hotel');
      const reading = game.getInspection(); assert.ok(reading?.lines.some(line => line.includes(text)), `${effect}: reading does not match the inspected prop`);
    }
    inspectFrom('metro_timetable_loop', [1.8, -12.8], [3.48, 2.08, -12.8], 'train', 'metro');
    assert.ok(game.getInspection().lines.includes('01:09 · T09 · ← BELVÉDÈRE'));
    inspectFrom('reflection_badge_code', [1.8, 3.75], [3.45, 2.05, 3.75], 'mirror', 'hotel');
    assert.deepEqual(game.getInspection().lines, ['INSPECTEUR 02', 'PARALLAXE']);
  });

  check('the seven added comparison exhibits are reachable in the complete hotel, without exposing another observer’s reading', () => {
    const records = [1.8, 9.2], gallery = [-1.8, 6.95];
    const cases = [
      ['paired_guestbook', records, 'Registre R9 — dernière arrivée', 'guestbook'],
      ['guest_tally', records, 'Afficheur R9 — occupants présents', 'occupancy'],
      ['rules_swap', records, 'Panneau du règlement de Saint-Clair', 'regulations'],
      ['paired_hand', [1.8, 1.9], 'Gant C9 — observer depuis le repère', 'glove'],
      ['paired_photo_weather', gallery, 'Photographie G9 — météo sur le quai', 'weather-photo'],
      ['wrong_team_photo', gallery, 'Photographie G9 — équipe du service de nuit', 'team-photo'],
      ['map_missing_room', gallery, 'Plan G9 — chambres du passage', 'floor-map'],
    ];
    for (const [effect, eye, label, id] of cases) {
      inspectFrom('', eye, () => centerOf(rootByLabel(label)), id); const ordinary = game.getInspection();
      inspectFrom(effect, eye, () => centerOf(rootByLabel(label)), id); const affected = game.getInspection();
      assert.ok(ordinary && affected && JSON.stringify(ordinary.lines) !== JSON.stringify(affected.lines), `${effect}: full-scene inspection lost its private change`);
      game.setView({ effects: [], phase: 'inspect' });
      assert.deepEqual(game.getInspection(), ordinary, `${effect}: old private reading persisted after reset`);
    }
  });

  check('solo perspective changes keep a stable inspection roster, and releasing it restores current connected identities', () => {
    game.setPeers([]); game.setInspectionRoster([{ id: 'training', name: 'Inspecteur', slot: 0 }]);
    const ledger = () => centerOf(rootByLabel('Registre R9 — dernière arrivée'));
    const tally = () => centerOf(rootByLabel('Afficheur R9 — occupants présents'));
    const photo = () => centerOf(rootByLabel('Photographie G9 — équipe du service de nuit'));
    game.setIdentity({ id: 'training', name: 'Inspecteur Alpha', slot: 0 });
    inspectFrom('', [1.8, 9.2], ledger, 'guestbook'); const alphaRegister = game.getInspection();
    game.setIdentity({ id: 'training', name: 'Inspecteur Bêta', slot: 1 });
    inspectFrom('', [1.8, 9.2], ledger, 'guestbook'); assert.deepEqual(game.getInspection(), alphaRegister);
    inspectFrom('paired_guestbook', [1.8, 9.2], ledger, 'guestbook'); assert.notDeepEqual(game.getInspection(), alphaRegister);
    inspectFrom('', [1.8, 9.2], tally, 'occupancy'); assert.equal(game.getInspection().lines[0], 'PRÉSENTS : 01');
    game.setInspectionRoster(null);
    game.setPeers([{ id: 'real-peer', name: 'Camille', slot: 0, pose: { x: -1, z: 5 } }]);
    inspectFrom('', [1.8, 9.2], tally, 'occupancy'); assert.equal(game.getInspection().lines[0], 'PRÉSENTS : 02');
    inspectFrom('wrong_team_photo', [-1.8, 6.95], photo, 'team-photo');
    assert.ok(game.getInspection().lines.some(line => line.includes('Camille')) && game.getInspection().lines.some(line => line.includes('Inspecteur Bêta')));
    game.setPeers([{ id: 'real-peer', name: 'Camille', slot: 0, connected: false }]);
    inspectFrom('', [1.8, 9.2], tally, 'occupancy'); assert.equal(game.getInspection().lines[0], 'PRÉSENTS : 01');
    game.setPeers([]); game.setIdentity({ id: 'local', name: 'Inspecteur', slot: 0 });
    game.setView({ effects: [], levelId: 'hotel', phase: 'inspect' });
  });

  check('delayed reflection preserves one second at multiple refresh rates', () => {
    const local = scene.children.find(object => object.userData.localInspector);
    const reflected = scene.children.find(object => object.userData.reflectionOnly);
    const patterns = [
      ['20 Hz', [1 / 20]], ['60 Hz', [1 / 60]], ['120 Hz', [1 / 120]],
      ['240 Hz', [1 / 240]], ['360 Hz', [1 / 360]],
      ['variable 30/360/60/240 Hz', [1 / 30, 1 / 360, 1 / 60, 1 / 240]],
    ];
    try {
      for (const [name, pattern] of patterns) {
        game.setActive(false);
        game.setView({ effects: [], levelId: 'clinic' });
        game.setView({ effects: ['reflection_delay'], levelId: 'hotel' });
        game.setPose({ x: 0, z: 7, yaw: 0, pitch: 0 });
        game.setActive(true);
        game.setInput({ forward: 1, strafe: 0 });
        for (let time = 0, frame = 0; time < 2 - 1e-12; frame++) {
          const dt = Math.min(pattern[frame % pattern.length], 2 - time);
          game.update(dt); time += dt;
        }
        const lag = reflected.position.z - local.position.z;
        const tolerance = 2.3 * (Math.max(...pattern) + 1 / 120) + 1e-6;
        assert.ok(lag >= 2.3 - 1e-6 && lag <= 2.3 + tolerance, `${name}: one-second reflection lag became ${lag} m`);
      }
    } finally {
      game.setActive(false);
      game.setInput({ forward: 0, strafe: 0 });
      game.setView({ effects: [], levelId: 'clinic' });
      game.setView({ effects: [], levelId: 'hotel' });
      game.setPose({ x: 0, z: 9, yaw: 0, pitch: 0 });
      game.update(0);
    }
  });

  check('each of the three locations has a walkable loop, a solid podium and two exit approaches', () => {
    for (const levelId of ['hotel', 'metro', 'clinic']) {
      game.setView({ effects: [], relayCode: '0909', levelId }); game.setActive(true);
      game.setPose({ x: 0, z: 9, yaw: 0, pitch: 0 }); game.setInput({ forward: 1, strafe: 0 });
      for (let frame = 0; frame < 800; frame++) game.update(.016);
      assert.ok(game.getPose().z > -12.42 && game.getPose().z < -12.3, `${levelId}: route to podium blocked`);
      for (const x of [-1, 1]) {
        game.setPose({ x, z: -12, yaw: 0, pitch: 0 });
        for (let frame = 0; frame < 200; frame++) game.update(.016);
        assert.ok(game.getPose().z < -15 && game.getPose().z >= -15.1, `${levelId}: exit approach blocked`);
      }
    }
    game.setInput({ forward: 0, strafe: 0 });
  });

  check('the cabin can be inspected and crossed using the same guarded route in all its private views', () => {
    inspectFrom('cabine_table_size', [2, -2], () => centerOf(rootByLabel('Table du chalet — tasse et carnet')), 'table', 'cabin');
    assert.ok(game.getInspection().lines[0].includes('rejoint le mur gauche'));
    inspectFrom('cabine_chimney_face', [1.8, -8.5], () => centerOf(scene.getObjectByName('Visage au fond du conduit')), 'fireplace', 'cabin');
    assert.ok(game.getInspection().lines[1].includes('Un visage'));
    const advance = (input, frames) => { game.setInput(input); for (let frame = 0; frame < frames; frame++) game.update(.05); };
    for (const effect of ['', 'cabine_table_size', 'cabine_chimney_face']) {
      game.setView({ effects: effect ? [effect] : [], levelId: 'cabin', phase: 'inspect' }); game.setActive(true); game.setPeers([]);
      game.setPose({ x: 0, z: 9, yaw: 0, pitch: 0 });
      advance({ forward: 1, strafe: 0 }, 65); assert.ok(game.getPose().z < 1.6 && game.getPose().z > 1.4, `${effect}: entry to the marked detour is obstructed`);
      advance({ forward: 0, strafe: 1 }, 18); assert.ok(game.getPose().x > 2 && game.getPose().x < 2.15);
      advance({ forward: 1, strafe: 0 }, 50); assert.ok(game.getPose().z < -4 && game.getPose().z > -4.4, `${effect}: the table's shared side passage is obstructed`);
      advance({ forward: 0, strafe: -1 }, 18); assert.ok(Math.abs(game.getPose().x) < .02);
      advance({ forward: 1, strafe: 0 }, 100); assert.ok(game.getPose().z > -12.5 && game.getPose().z < -12.2, `${effect}: the terminal is inaccessible`);
      for (const x of [-1, 1]) {
        game.setPose({ x, z: -12, yaw: 0, pitch: 0 }); advance({ forward: 1, strafe: 0 }, 50);
        assert.ok(game.getPose().z < -14.95 && game.getPose().z >= -15.1, `${effect}: exit approach is blocked`);
      }
    }
    game.setInput({ forward: 0, strafe: 0 }); game.setView({ effects: [], levelId: 'hotel' });
  });

  check('quality caps, peer cleanup and ready callback are consistent', () => {
    game.setQuality('medium'); assert.equal(renderer.pixelRatio, 1.25);
    game.setQuality('low'); assert.equal(renderer.pixelRatio, 1);
    game.setQuality('high'); assert.equal(renderer.pixelRatio, 1.5);
    const originalMeshes = game.getStats().meshes;
    game.setPeers([{ id: 'inspection-test', name: 'Test', pose: { x: 1, z: 3, yaw: 0 } }]);
    assert.ok(game.getStats().meshes > originalMeshes);
    game.setPeers([]); assert.equal(game.getStats().meshes, originalMeshes);
    assert.equal(onReadyCount, 1);
    const resources = new Set();
    scene.traverse(object => {
      if (object.geometry) resources.add(object.geometry);
      for (const mat of object.material ? (Array.isArray(object.material) ? object.material : [object.material]) : []) {
        resources.add(mat); if (mat.map) resources.add(mat.map);
      }
    });
    const disposals = new Map(); for (const resource of resources) resource.addEventListener('dispose', () => disposals.set(resource, (disposals.get(resource) || 0) + 1));
    game.dispose(); game.dispose(); assert.ok(renderer.disposed);
    for (const resource of resources) assert.equal(disposals.get(resource), 1, `Resource ${resource.type} was leaked or disposed twice`);
  });
} finally {
  game?.dispose();
  globalThis.window = originalWindow;
  globalThis.document = originalDocument;
  globalThis.__parallaxeGeometryRenderer = originalCapture;
  fs.rmSync(directory, { recursive: true, force: true });
}

console.log(JSON.stringify({
  verification: 'CPU geometry, transforms, materials, collision and raycasting only',
  passed: passed.length,
  checks: passed,
  sceneTriangles: finalStats.sceneTriangles,
  sceneMeshesIncludingInactiveAnomalies: finalStats.meshes,
  trianglesByLocationIncludingInactiveAnomalies: finalStats.levelTriangles,
  trianglesPerInspector: finalStats.inspectorTriangles,
  planarReflectiveSurfacesTotal: finalStats.reflectiveSurfaces,
  visualRendering: 'UNVERIFIED — no WebGL context, pixel, shader, lighting-appearance or FPS test',
}, null, 2));
