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
  for (const name of ['avatar', 'locations']) {
    let module = ts.transpileModule(fs.readFileSync(path.join(project, `src/game/${name}.ts`), 'utf8'), { compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.ES2022 } }).outputText;
    module = module.replace("from 'three'", `from ${JSON.stringify(threeModule)}`);
    module = module.replace(/from '(three\/addons\/[^']+)'/g, (_, specifier) => `from ${JSON.stringify(pathToFileURL(require.resolve(specifier)).href)}`);
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

  check('all 48 visual effects apply and restore baseline visibility/materials', () => {
    assert.equal(SCENE_EFFECTS.length, 48);
    game.setView({ effects: [], relayCode: '0909' });
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
    game.setView({ effects: [effect], levelId, relayCode: effect === 'relay_mismatch' ? '4271' : '0909', arrowDirection: effect === 'paired_arrow' ? 'left' : 'right', syncTime: effect === 'paired_clock' ? '04:17' : '03:09' });
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
    assert.equal(game.getTarget()?.id, expected, `${effect}: landmark ray missed (${JSON.stringify(game.getTarget())})`);
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
    const convergence = [[-1.7, 9.85], [-3.49, 2.06, 9.85], 'radio'];
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
    for (const effect of [null, 'reflection_absent', 'reflection_delay', 'reflection_independent']) {
      game.setView({ effects: effect ? [effect] : [], levelId: 'hotel' });
      game.setPose({ x: 1.8, z: 3.75, yaw: -Math.PI / 2, pitch: 0 }); game.update(0);
      const mainCamera = renderer.camera;
      const before = allSurfaces.map(object => object.visible);
      const count = renderer.captures.length;
      surface.onBeforeRender(renderer, scene, mainCamera, surface.geometry, surface.material, null);
      assert.equal(renderer.captures.length, count + 1, 'Exactly one planar capture expected');
      const capture = renderer.captures.at(-1);
      assert.equal(capture.localVisible, effect === null);
      assert.equal(capture.reflectedBodyVisible, effect === 'reflection_delay' || effect === 'reflection_independent');
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

  check('quality caps, peer cleanup and ready callback are consistent', () => {
    game.setQuality('medium'); assert.equal(renderer.pixelRatio, 1.25);
    game.setQuality('low'); assert.equal(renderer.pixelRatio, 1);
    game.setQuality('high'); assert.equal(renderer.pixelRatio, 1.5);
    const originalMeshes = game.getStats().meshes;
    game.setPeers([{ id: 'inspection-test', name: 'Test', pose: { x: 1, z: 3, yaw: 0 } }]);
    assert.ok(game.getStats().meshes > originalMeshes);
    game.setPeers([]); assert.equal(game.getStats().meshes, originalMeshes);
    assert.equal(onReadyCount, 1);
    game.dispose(); game.dispose(); assert.ok(renderer.disposed);
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
