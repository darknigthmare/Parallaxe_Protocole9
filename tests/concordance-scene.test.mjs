import assert from 'node:assert/strict';
import {after, test} from 'node:test';
import * as THREE from 'three';
import {buildConcordanceRoom} from '../src/game/concordance-scene.ts';

const oldDocument = globalThis.document;
globalThis.document = {
  createElement() {
    const gradient = {addColorStop() {}};
    const ctx = new Proxy({createLinearGradient: () => gradient}, {
      get(target, key) { return target[key] ?? (() => {}); },
    });
    return {width: 0, height: 0, getContext: () => ctx};
  },
};
after(() => {globalThis.document = oldDocument;});

function fixture(t) {
  const room = buildConcordanceRoom();
  t.after(room.dispose);
  const sheets = ['A', 'B', 'C'].map(id => room.scene.getObjectByName('Relevé ' + id));
  return {...room, sheets};
}

function pointOnPrint(sheet, x, y) {
  return sheet.getObjectByName('Plan imprimé').localToWorld(new THREE.Vector3(x, y, 0));
}

test('loose, separately legible drawings physically meet at both cut edges in the last shot', t => {
  const {pose, sheets} = fixture(t);
  for (const [progress, assembled] of [[.5, false], [5 / 6, true], [1, true], [0, false]]) {
    pose(progress, 1.6);
    for (const i of [0, 1]) {
      for (const y of [-.5, 0, .5]) {
        const gap = pointOnPrint(sheets[i], .5, y).distanceTo(pointOnPrint(sheets[i + 1], -.5, y));
        assert.ok(assembled ? gap < 1e-6 : gap > .05, 'Gap between sheets: ' + gap);
      }
    }
  }
});

test('all four corners of each drawing are inside the close and overhead shots in portrait and landscape', t => {
  const {camera, pose, sheets} = fixture(t);
  for (const aspect of [16 / 9, 4 / 3, 9 / 16]) {
    for (const progress of [1 / 3, .5, .65, 2 / 3, 5 / 6, 1]) {
      pose(progress, aspect);
      for (const sheet of sheets) for (const x of [-.5, .5]) for (const y of [-.5, .5]) {
        const point = pointOnPrint(sheet, x, y).project(camera);
        assert.ok(Math.abs(point.x) < 1 && Math.abs(point.y) < 1 && Math.abs(point.z) < 1,
          'Paper clipped at ' + [aspect, progress, point.x, point.y].join(' / '));
      }
    }
  }
});

test('the camera sees printed faces ahead of the furniture in all three compositions', t => {
  const {camera, pose, scene, sheets} = fixture(t);
  for (const progress of [1 / 6, .5, 5 / 6]) {
    pose(progress, 1.6);
    scene.updateMatrixWorld(true);
    for (const sheet of sheets) {
      const face = sheet.getObjectByName('Plan imprimé');
      const point = face.getWorldPosition(new THREE.Vector3());
      const ray = new THREE.Raycaster(camera.position, point.sub(camera.position).normalize());
      assert.equal(ray.intersectObject(scene, true)[0]?.object, face);
    }
  }
});

test('each material, texture, geometry and shadow owned by the room releases once across repeated exits', t => {
  const {scene, dispose} = fixture(t);
  const resources = new Set();
  scene.traverse(object => {
    if (object.isMesh) {
      resources.add(object.geometry);
      resources.add(object.material);
      if (object.material.map) resources.add(object.material.map);
    }
    if (object.shadow) resources.add(object.shadow);
  });
  const calls = new Map();
  for (const resource of resources) {
    const original = resource.dispose;
    resource.dispose = function () {
      calls.set(resource, (calls.get(resource) ?? 0) + 1);
      return original.call(this);
    };
  }
  dispose(); dispose();
  assert.ok(resources.size > 15);
  assert.equal(calls.size, resources.size);
  for (const count of calls.values()) assert.equal(count, 1);
});
