/** Real Three.js geometry and raycasts; Canvas is stubbed, no GPU or pixels certified. */
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
const temporary = fs.mkdtempSync(path.join(os.tmpdir(), 'parallaxe-cabin-geometry-'));
const originalDocument = globalThis.document;
const passed = [];
const check = (name, callback) => { callback(); passed.push(name); };
let cabin, metro;

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
function visible(object) { for (let node = object; node; node = node.parent) if (!node.visible) return false; return true; }
function firstVisibleHit(root, eye, point) {
  root.updateMatrixWorld(true);
  const ray = new THREE.Raycaster(new THREE.Vector3(...eye), new THREE.Vector3(...point).sub(new THREE.Vector3(...eye)).normalize(), .01, 6);
  return ray.intersectObject(root, true).find(hit => visible(hit.object) && hit.object.material?.visible !== false);
}
function targetOf(object) { for (let node = object; node; node = node.parent) if (node.userData.inspect) return node.userData.inspect.id; return null; }
function bounds(object) { object.updateWorldMatrix(true, true); return new THREE.Box3().setFromObject(object); }

try {
  const threeModule = pathToFileURL(path.join(path.dirname(require.resolve('three')), 'three.module.js')).href;
  for (const name of ['levels', 'cabin', 'location-clues', 'locations']) {
    let source = ts.transpileModule(fs.readFileSync(path.join(project, `src/game/${name}.ts`), 'utf8'), {
      compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.ES2022 },
    }).outputText;
    source = source.replace("from 'three'", `from ${JSON.stringify(threeModule)}`);
    source = source.replace(/from '(three\/addons\/[^']+)'/g, (_, specifier) => `from ${JSON.stringify(pathToFileURL(require.resolve(specifier)).href)}`);
    source = source.replace(/from '(\.\/(?:cabin|location-clues))'/g, (_, specifier) => `from ${JSON.stringify(pathToFileURL(path.join(temporary, `${specifier}.mjs`)).href)}`);
    fs.writeFileSync(path.join(temporary, `${name}.mjs`), source);
  }
  globalThis.document = { createElement: () => canvasStub() };
  const { createLocation } = await import(pathToFileURL(path.join(temporary, 'locations.mjs')).href);
  const { LEVEL_ORDER, SELECTABLE_LEVELS, getLevel, isLevelId } = await import(pathToFileURL(path.join(temporary, 'levels.mjs')).href);
  cabin = createLocation('cabin'); metro = createLocation('metro');
  cabin.root.updateMatrixWorld(true); metro.root.updateMatrixWorld(true);
  const table = cabin.root.getObjectByName('Table du chalet');
  const face = cabin.root.getObjectByName('Visage au fond du conduit');
  const cup = cabin.root.getObjectByName('Tasse du chalet');
  const notebook = cabin.root.getObjectByName('Carnet du chalet');
  const tableTarget = { id: 'table', label: 'Table du chalet — tasse et carnet' };
  const fireplaceTarget = { id: 'fireplace', label: 'Foyer du chalet — conduit froid' };
  let triangles = 0, meshes = 0;

  check('fourth optional location preserves three-stage campaign identity', () => {
    assert.deepEqual(LEVEL_ORDER, ['hotel', 'metro', 'clinic']);
    assert.deepEqual(SELECTABLE_LEVELS, ['hotel', 'metro', 'clinic', 'cabin']);
    assert.equal(isLevelId('cabin'), true); assert.equal(getLevel('cabin').name, 'Chalet de service');
    assert.equal(getLevel('unrecognized').id, 'hotel');
    assert.match(getLevel('cabin').baseline.join(' '), /tasse et le carnet/);
  });
  check('all cabin meshes have finite geometry, normals and nonzero bounds', () => {
    cabin.root.traverse(object => {
      if (!object.isMesh) return;
      meshes++; triangles += (object.geometry.index?.count || object.geometry.attributes.position.count) / 3;
      for (const attribute of [object.geometry.attributes.position, object.geometry.attributes.normal]) {
        assert.ok(attribute); for (const value of attribute.array) assert.ok(Number.isFinite(value));
      }
      object.geometry.computeBoundingSphere(); assert.ok(object.geometry.boundingSphere.radius > 0);
    });
    assert.ok(table && face && cup && notebook);
    assert.ok(cabin.targets.some(target => target.userData.inspect?.id === 'exit'));
  });
  check('two original planar surfaces face the walkable interior', () => {
    assert.equal(cabin.reflectors.length, 2);
    for (const surface of cabin.reflectors) {
      const p = surface.getWorldPosition(new THREE.Vector3());
      const direction = new THREE.Vector3(0, 0, 1).transformDirection(surface.matrixWorld);
      assert.ok(direction.dot(new THREE.Vector3(-Math.sign(p.x), 0, 0)) > .99);
    }
    const hit = firstVisibleHit(cabin.root, [1.8, 1.67, 3.75], [3.5, 1.67, 3.75]);
    assert.equal(targetOf(hit?.object), 'mirror');
  });
  check('normal table clearance and oversized left edge have observable geometry', () => {
    const normal = bounds(table), cupBefore = bounds(cup), notebookBefore = bounds(notebook);
    assert.ok(Math.abs(normal.min.x + 1.05) < .01); assert.ok(Math.abs(normal.max.x - 1.05) < .01);
    assert.match(cabin.getReading(tableTarget).lines.join(' '), /Un espace/);
    cabin.setView(new Set(['cabine_table_size']));
    const extended = bounds(table);
    assert.ok(extended.min.x < -3.63 && extended.min.x > -3.68);
    assert.ok(Math.abs(extended.max.x - normal.max.x) < .01);
    assert.ok(bounds(cup).equals(cupBefore)); assert.ok(bounds(notebook).equals(notebookBefore));
    assert.match(cabin.getReading(tableTarget).lines.join(' '), /rejoint le mur gauche/);
    cabin.setView(new Set()); assert.ok(bounds(table).equals(normal));
    assert.match(cabin.getReading(tableTarget).lines.join(' '), /Une tasse et un carnet/);
  });
  check('table and cold hearth can be inspected from unobstructed standing positions', () => {
    const tableHit = firstVisibleHit(cabin.root, [0, 1.67, .20], [0, .81, -2]);
    assert.equal(targetOf(tableHit?.object), 'table');
    assert.equal(face.visible, false); assert.match(cabin.getReading(fireplaceTarget).lines.join(' '), /vide/);
    cabin.setView(new Set(['cabine_chimney_face']));
    const point = face.getWorldPosition(new THREE.Vector3());
    const hit = firstVisibleHit(cabin.root, [1.5, 1.67, -8.5], point.toArray());
    assert.ok(hit, 'Face has no visible raycast surface');
    let ancestor = hit.object; while (ancestor && ancestor !== face) ancestor = ancestor.parent;
    assert.equal(ancestor, face, 'The authored face is occluded by the mantel or conduit');
    assert.equal(targetOf(hit.object), 'fireplace');
    assert.match(cabin.getReading(fireplaceTarget).lines.join(' '), /deux yeux/);
    cabin.setView(new Set()); assert.equal(face.visible, false);
    assert.match(cabin.getReading(fireplaceTarget).lines.join(' '), /vide/);
  });
  check('shared routes, mirror witness positions and colliders survive both private effects', () => {
    const baseline = structuredClone(cabin.colliders);
    function fits(x, z) {
      if (x < -3.32 || x > 3.32 || z < -15.1 || z > 11.3) return false;
      if (Math.abs(x - 2.05) < .43 && Math.abs(z - 4.4) < .43) return false;
      return !cabin.colliders.some(c => Math.abs(x - c.x) < c.rx + .19 && Math.abs(z - c.z) < c.rz + .19);
    }
    const route = [[0, 9], [0, .2], [2, .2], [2, -4.2], [0, -4.2], [0, -11.8], [.9, -11.8], [.9, -14.7]];
    for (const effects of [[], ['cabine_table_size'], ['cabine_chimney_face'], ['cabine_table_size', 'cabine_chimney_face']]) {
      cabin.setView(new Set(effects)); assert.deepEqual(cabin.colliders, baseline);
      for (let i = 1; i < route.length; i++) {
        const a = route[i - 1], b = route[i], steps = Math.ceil(Math.hypot(b[0] - a[0], b[1] - a[1]) / .04);
        for (let s = 0; s <= steps; s++) {
          const x = a[0] + (b[0] - a[0]) * s / steps, z = a[1] + (b[1] - a[1]) * s / steps;
          assert.ok(fits(x, z), `Blocked route for ${effects.join(',') || 'reference'} at ${x},${z}`);
        }
      }
      for (const [x, z] of [[1.7, 3.1], [1.7, 4.2], [1.5, -8.5], [-2, -12.25]]) {
        // The existing shared reflection seat at 2.05,4.4 applies only to the player.
        assert.ok(!cabin.colliders.some(c => Math.abs(x - c.x) < c.rx + .19 && Math.abs(z - c.z) < c.rz + .19));
      }
    }
    cabin.setView(new Set());
  });
  check('shared lighting, exit and relay effects restore their normal states', () => {
    const signature = () => {
      const values = [];
      cabin.root.traverse(object => {
        const m = object.material;
        values.push([object.uuid, object.visible, ...object.position.toArray(), ...object.scale.toArray(), m?.color?.getHex(), m?.emissive?.getHex(), m?.emissiveIntensity, m?.map?.uuid, object.isLight ? object.intensity : null]);
      });
      return values;
    };
    const reference = signature();
    for (const effect of ['cabine_table_size', 'cabine_chimney_face', 'red_light', 'blackout', 'exit_false']) {
      cabin.setView(new Set([effect])); cabin.update(75); cabin.setView(new Set()); assert.deepEqual(signature(), reference, effect);
    }
    const screen = cabin.root.getObjectsByProperty('isMesh', true).find(object => object.material?.map?.image?.__text?.includes('RELAIS'));
    let disposed = 0; screen.material.map.addEventListener('dispose', () => disposed++);
    cabin.setView(new Set(), '3142'); assert.equal(disposed, 1); assert.deepEqual(screen.material.map.image.__text, ['RELAIS', '3142']);
    const same = screen.material.map; cabin.setView(new Set(), '3142'); assert.equal(screen.material.map, same);
    cabin.setView(new Set(), 'invalid'); assert.deepEqual(screen.material.map.image.__text, ['RELAIS', '0909']);
  });
  check('metro arches fit below the actual ceiling and join the supporting posts', () => {
    const arches = []; metro.root.traverse(object => { if (object.name === 'Arceau du quai') arches.push(object); });
    assert.equal(arches.length, 7);
    for (const arch of arches) {
      const box = bounds(arch); assert.ok(box.max.y < 3.43, `Ceiling intersected at ${box.max.y}`);
      const endpoint = new THREE.Vector3(3.5, 0, 0).applyMatrix4(arch.matrixWorld);
      assert.ok(Math.abs(endpoint.x - 3.5) < 1e-6 && Math.abs(endpoint.y - 2.695) < 1e-6);
      assert.ok(box.min.y > 2.67);
    }
  });
  check('cabin disposal releases geometry, materials, textures and reflection targets once', () => {
    const resources = new Set();
    cabin.root.traverse(object => {
      if (object.geometry) resources.add(object.geometry);
      if (object.material) for (const material of Array.isArray(object.material) ? object.material : [object.material]) {
        resources.add(material); if (material.map) resources.add(material.map);
      }
    });
    cabin.reflectors.forEach(surface => resources.add(surface.getRenderTarget()));
    const counts = new Map(); for (const resource of resources) { counts.set(resource, 0); resource.addEventListener('dispose', () => counts.set(resource, counts.get(resource) + 1)); }
    cabin.dispose(); cabin.dispose();
    for (const count of counts.values()) assert.equal(count, 1);
  });
  process.stdout.write(JSON.stringify({ passed: passed.length, checks: passed, cabinTriangles: Math.round(triangles), cabinMeshes: meshes, limit: 'CPU geometry, collision, state, text inputs and raycasts only; no pixel, shader, frame-rate or device claim.' }, null, 2) + '\n');
} finally {
  cabin?.dispose(); metro?.dispose(); globalThis.document = originalDocument;
  fs.rmSync(temporary, { recursive: true, force: true });
}
