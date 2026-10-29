/** Actual Three.js props and private domain views; no WebGL or pixel rendering is simulated as a visual pass. */
import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, readFile, writeFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, dirname } from 'node:path';
import { createRequire } from 'node:module';
import { pathToFileURL } from 'node:url';
import ts from 'typescript';
import * as THREE from 'three';

const require = createRequire(import.meta.url);
const temp = await mkdtemp(join(tmpdir(), 'parallaxe-inspection-'));
const originalDocument = globalThis.document;
globalThis.document = {
  createElement(type) {
    assert.equal(type, 'canvas');
    const canvas = { width: 0, height: 0 };
    const ctx = { fillRect() {}, strokeRect() {}, fillText() {} };
    canvas.getContext = () => ctx; return canvas;
  },
};
for (const name of ['levels', 'catalog', 'rules', 'inspection-data', 'inspection-props']) {
  const source = await readFile(new URL(`../src/game/${name}.ts`, import.meta.url), 'utf8');
  let code = ts.transpileModule(source, { compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.ESNext } }).outputText;
  code = code.replace(/from '(\.\/[^']+)'/g, "from '$1.mjs'");
  code = code.replace("from 'three'", `from ${JSON.stringify(pathToFileURL(join(dirname(require.resolve('three')), 'three.module.js')).href)}`);
  code = code.replace(/from '(three\/addons\/[^']+)'/g, (_, specifier) => `from ${JSON.stringify(pathToFileURL(require.resolve(specifier)).href)}`);
  await writeFile(join(temp, `${name}.mjs`), code);
}
const { createInspectionProps, inspectionValues, normalizeInspectionRoster, INSPECTION_EFFECTS, INSPECTION_TARGETS } = await import(pathToFileURL(join(temp, 'inspection-props.mjs')));
const { createRun, getPersonalView } = await import(pathToFileURL(join(temp, 'rules.mjs')));
test.after(async () => { globalThis.document = originalDocument; await rm(temp, { recursive: true, force: true }); });

test('normal display combinations vary between passages and remain common to all four private views', () => {
  const variants = new Set();
  for (let index = 0; index < 80; index++) {
    const run = { ...createRun({ seed: `props-${index}`, players: 4 }), phase: 'inspect', loop: index + 1 };
    const views = [0, 1, 2, 3].map(slot => getPersonalView(run, slot));
    variants.add(views[0].variant);
    for (const view of views) assert.deepEqual(inspectionValues(view), inspectionValues(views[0]));
  }
  assert.ok(variants.size > 1, 'Ordinary values must vary between passages');
  for (const key of ['room', 'stamp', 'edition', 'tagA', 'guestbookEntry', 'hand', 'photoWeather']) {
    assert.ok(new Set([...variants].map(variant => inspectionValues({ variant, phase: 'inspect' })[key])).size > 1, key);
  }
});

test('each relational case changes only its intended private reading for every ordinary combination', () => {
  const changedKeys = {
    paired_room: ['room'], paired_stamp: ['stamp'], paired_newspaper: ['edition'], paired_luggage: ['tagA', 'tagB'],
    paired_guestbook: ['guestbookEntry'], paired_hand: ['hand'], paired_photo_weather: ['photoWeather'],
  };
  for (const [effect, allowed] of Object.entries(changedKeys)) for (let variant = 0; variant < 16; variant++) {
    const normal = inspectionValues({ variant, phase: 'inspect', effects: [] });
    const altered = inspectionValues({ variant, phase: 'inspect', effects: [effect] });
    assert.deepEqual(Object.keys(normal).filter(key => normal[key] !== altered[key]).sort(), allowed.sort());
    assert.ok(['204', '205'].includes(altered.room));
    assert.ok(['VALIDÉ', 'REFUSÉ'].includes(altered.stamp));
    assert.deepEqual([altered.tagA, altered.tagB].sort(), ['09', '18']);
  }
});

test('the real private projection produces one differing reading and an ordinary witness', () => {
  for (const effect of INSPECTION_EFFECTS) {
    const run = { ...createRun({ seed: effect, players: 4 }), phase: 'inspect', loop: 3, currentAnomalyId: effect, observerSlots: [2] };
    const normal = inspectionValues(getPersonalView(run, 0));
    const witness = inspectionValues(getPersonalView(run, 2));
    assert.notDeepEqual(witness, normal, effect);
    for (const slot of [1, 3]) assert.deepEqual(inspectionValues(getPersonalView(run, slot)), normal);
  }
});

test('reference clears every effect and all observations match their displayed objects', () => {
  const props = createInspectionProps();
  try {
    props.setView({ phase: 'reference', variant: 15, effects: [...INSPECTION_EFFECTS], levelId: 'hotel' });
    const values = inspectionValues({ phase: 'reference' });
    assert.equal(values.room, '204'); assert.equal(values.keyCount, 1);
    assert.equal(props.root.getObjectByName('Deuxième clé 09').visible, false);
    assert.equal(props.targets.length, INSPECTION_TARGETS.length);
    for (const id of INSPECTION_TARGETS) {
      const reading = props.getReading(id);
      assert.ok(reading?.title && reading?.location && reading?.lines.length, id);
    }
    assert.match(props.getReading('assignment').lines.join(' '), /204/);
    assert.match(props.getReading('newspaper').lines.join(' '), /26 OCTOBRE 2026/);
    assert.match(props.getReading('luggage').lines.join(' '), /A.*09.*B.*18/);
    assert.match(props.getReading('keys').lines.join(' '), /^1 CLÉ/);
  } finally { props.dispose(); }
});

test('meshes have finite positions and normals, and each target can be reached by a ray from the corridor', () => {
  const props = createInspectionProps();
  try {
    let triangles = 0;
    props.root.updateMatrixWorld(true);
    props.root.traverse(object => {
      if (!object.isMesh) return;
      for (const attribute of ['position', 'normal']) {
        const values = object.geometry.attributes[attribute];
        assert.ok(values, `${object.name}: ${attribute}`);
        for (const number of values.array) assert.ok(Number.isFinite(number));
      }
      triangles += (object.geometry.index?.count ?? object.geometry.attributes.position.count) / 3;
    });
    assert.ok(triangles > 5000 && triangles < 60000, `Detailed props triangle budget: ${triangles}`);
    for (const target of props.targets) {
      const aim = new THREE.Box3().setFromObject(target).getCenter(new THREE.Vector3());
      const origin = new THREE.Vector3(0, 1.67, aim.z);
      const direction = aim.clone().sub(origin).normalize();
      const hits = new THREE.Raycaster(origin, direction, 0, 5.8).intersectObject(target, true);
      assert.ok(hits.length, target.userData.inspect.id);
    }
    for (const obstacle of props.colliders) assert.ok(Math.abs(obstacle.x) - obstacle.rx > 2.3, 'Central route remains free');
  } finally { props.dispose(); }
});

test('sand and steam really reverse direction, while duplicate key state resets after each passage', () => {
  const props = createInspectionProps();
  const sand = props.root.getObjectByName('Grain témoin 0');
  const steam = props.root.getObjectByName('Vapeur témoin 0');
  try {
    const sample = () => {
      props.update(.30); const a = [sand.position.y, steam.position.y];
      props.update(.35); return [sand.position.y - a[0], steam.position.y - a[1]];
    };
    props.setView({ phase: 'inspect', effects: [] }); let movement = sample();
    assert.ok(movement[0] < 0 && movement[1] > 0);
    props.setView({ phase: 'inspect', effects: ['sand_upward', 'steam_downward', 'same_key_twice'] }); movement = sample();
    assert.ok(movement[0] > 0 && movement[1] < 0);
    assert.equal(props.root.getObjectByName('Deuxième clé 09').visible, true);
    props.setView({ phase: 'inspect', effects: [] }); movement = sample();
    assert.ok(movement[0] < 0 && movement[1] > 0);
    assert.equal(props.root.getObjectByName('Deuxième clé 09').visible, false);
  } finally { props.dispose(); }
});

test('separate observers never share mutable props, and readings are defensive copies limited to this place', () => {
  const alpha = createInspectionProps(), beta = createInspectionProps();
  try {
    alpha.setView({ effects: ['paired_stamp'], phase: 'inspect', levelId: 'hotel' });
    beta.setView({ effects: [], phase: 'inspect', levelId: 'hotel' });
    assert.notDeepEqual(alpha.getReading('document'), beta.getReading('document'));
    const copy = beta.getReading('document'); copy.lines[0] = 'mutated';
    assert.equal(beta.getReading('document').lines[0], 'DOSSIER 09');
    alpha.setView({ levelId: 'metro', effects: [] });
    assert.equal(alpha.getReading('document'), null); assert.equal(alpha.root.visible, false);
    alpha.setView({ levelId: 'hotel', effects: [] });
    assert.equal(alpha.root.visible, true); assert.ok(alpha.getReading('document'));
  } finally { alpha.dispose(); beta.dispose(); }
});

test('resource cleanup is idempotent and closes observations after disposal', () => {
  const props = createInspectionProps(); const resources = new Map();
  props.root.traverse(object => {
    if (!object.isMesh) return;
    for (const resource of [object.geometry, object.material, object.material.map]) {
      if (!resource || resources.has(resource)) continue;
      resources.set(resource, 0); resource.addEventListener('dispose', () => resources.set(resource, resources.get(resource) + 1));
    }
  });
  props.dispose(); props.dispose();
  for (const times of resources.values()) assert.equal(times, 1);
  assert.equal(props.root.children.length, 0); assert.equal(props.getReading('keys'), null);
});

test('the archive roster is stable across observers, distinguishes duplicate pseudonyms and excludes disconnected members', () => {
  const members = [
    { id: 'second', name: 'Même pseudo', slot: 1 },
    { id: 'absent', name: 'Ancien', slot: 3, connected: false },
    { id: 'first', name: 'Même pseudo', slot: 0 },
    { id: 'first', name: 'Même pseudo', slot: 0 },
  ];
  const normalized = normalizeInspectionRoster(members);
  assert.deepEqual(normalized.map(member => member.id), ['first', 'second']);
  for (let variant = 0; variant < 16; variant++) {
    const baseline = inspectionValues({ phase: 'inspect', variant, roster: members });
    const reordered = inspectionValues({ phase: 'inspect', variant, roster: [...members].reverse() });
    assert.deepEqual(baseline, reordered);
    const witness = inspectionValues({ phase: 'inspect', variant, roster: members, effects: ['paired_guestbook'] });
    assert.notEqual(baseline.guestbookEntry, witness.guestbookEntry);
    assert.equal(baseline.occupancy, 2);
    assert.ok(!witness.guestbookEntry.includes('Ancien'));
  }
  const guarded = normalizeInspectionRoster([{ id: 'safe', name: 'Nom\nFaux\u202e'.repeat(8), slot: 9 }]);
  assert.ok(guarded[0].name.length <= 24);
  assert.ok(!/[\n\u202e]/.test(guarded[0].name));
  assert.equal(guarded[0].slot, 3);
});

test('handedness changes the actual glove thumb while retaining a shared fixed viewing marker', () => {
  const props = createInspectionProps();
  try {
    const glove = props.root.getObjectByName('Gant témoin C9');
    const thumb = props.root.getObjectByName('Pouce du gant');
    const marker = props.root.getObjectByName('Présentation du gant C9');
    const sample = effect => {
      props.setView({ phase: 'inspect', variant: 0, effects: effect ? ['paired_hand'] : [] });
      props.root.updateMatrixWorld(true);
      return { thumb: thumb.getWorldPosition(new THREE.Vector3()), glove: glove.getWorldPosition(new THREE.Vector3()), marker: marker.matrixWorld.clone() };
    };
    const normal = sample(false), witness = sample(true);
    assert.ok(normal.thumb.clone().sub(normal.glove).dot(witness.thumb.clone().sub(witness.glove)) < 0);
    assert.deepEqual(witness.marker.elements, normal.marker.elements);
    assert.match(props.getReading('glove').lines.join(' '), /DROIT.*côté droit/);
    props.setView({ phase: 'reference', effects: ['paired_hand'], variant: 15 });
    assert.equal(glove.scale.x, 1);
    assert.match(props.getReading('glove').lines.join(' '), /GAUCHE.*gauche/);
  } finally { props.dispose(); }
});

test('the weather photographs show their stated precipitation or sun and never rely solely on a tint', () => {
  const props = createInspectionProps();
  try {
    for (const [variant, kind, phrase] of [[0, 'PLUIE', /pluie et un parapluie/], [1, 'NEIGE', /flocons et une couche blanche/], [2, 'SOLEIL', /disque solaire et ses rayons/]]) {
      props.setView({ phase: 'inspect', variant, effects: [] });
      for (const weather of ['PLUIE', 'NEIGE', 'SOLEIL']) {
        const group = props.root.getObjectByName(`Météo du quai — ${weather}`);
        assert.equal(group.visible, weather === kind);
        assert.ok(group.children.length >= 8);
      }
      assert.match(props.getReading('weather-photo').lines.join(' '), phrase);
      props.setView({ phase: 'inspect', variant, effects: ['paired_photo_weather'] });
      assert.equal(props.root.getObjectByName(`Météo du quai — ${kind}`).visible, false);
    }
  } finally { props.dispose(); }
});

test('archive details and in-world meshes reset after every one of the seven new effects', () => {
  const props = createInspectionProps(), ordinary = createInspectionProps();
  const roster = [{ id: 'a', name: 'Loïc', slot: 0 }, { id: 'b', name: 'Étoile', slot: 1 }];
  const cases = {
    paired_guestbook: 'guestbook', paired_hand: 'glove', paired_photo_weather: 'weather-photo',
    wrong_team_photo: 'team-photo', map_missing_room: 'floor-map', rules_swap: 'regulations', guest_tally: 'occupancy',
  };
  try {
    props.setRoster(roster); ordinary.setRoster(roster);
    ordinary.setView({ phase: 'inspect', variant: 0 });
    for (const [effect, target] of Object.entries(cases)) {
      props.setView({ phase: 'inspect', variant: 0, effects: [effect] });
      assert.notDeepEqual(props.getReading(target), ordinary.getReading(target), effect);
      const displayedText = [];
      props.root.traverse(object => { if (object.userData.text) displayedText.push(object.userData.text); });
      if (effect === 'wrong_team_photo') {
        assert.ok(displayedText.some(text => /Loïc/.test(text) && /Étoile/.test(text)));
        assert.equal(props.root.getObjectByName('Silhouette photographiée 3').visible, false);
      }
      if (effect === 'guest_tally') assert.match(props.root.getObjectByName('Afficheur des occupants').userData.text, /03$/);
      if (effect === 'map_missing_room') assert.equal(props.root.getObjectByName('Chambre 903 sur le plan').visible, false);
      if (effect === 'rules_swap') assert.match(props.root.getObjectByName('Règlement affiché').userData.text, /NE SIGNALEZ\nAUCUNE ANOMALIE/);
      props.setView({ phase: 'reference', variant: 15, effects: [effect] });
      ordinary.setView({ phase: 'reference' });
      for (const id of INSPECTION_TARGETS) assert.deepEqual(props.getReading(id), ordinary.getReading(id), `${effect}: ${id}`);
      assert.equal(props.root.getObjectByName('Chambre 903 sur le plan').visible, true);
      assert.equal(props.root.getObjectByName('Silhouette photographiée 3').visible, true);
      ordinary.setView({ phase: 'inspect', variant: 0 });
    }
  } finally { props.dispose(); ordinary.dispose(); }
});

test('roster updates refresh only the public identities and keep the current private anomaly', () => {
  const props = createInspectionProps();
  try {
    const alpha = { id: 'a', name: 'Alpha actuel', slot: 0 };
    const beta = { id: 'b', name: 'Bêta actuel', slot: 1 };
    props.setRoster([alpha, beta]);
    props.setView({ phase: 'inspect', effects: ['guest_tally', 'wrong_team_photo'], levelId: 'hotel' });
    assert.match(props.getReading('occupancy').lines[0], /03$/);
    assert.match(props.getReading('team-photo').lines.join(' '), /Alpha actuel.*Bêta actuel/);
    props.setRoster([alpha]);
    assert.match(props.getReading('occupancy').lines[0], /02$/);
    assert.ok(!props.getReading('team-photo').lines.join(' ').includes('Bêta actuel'));
    assert.equal(props.root.getObjectByName('Silhouette photographiée 2').visible, false);
    props.setView({ phase: 'reference', levelId: 'hotel' });
    assert.match(props.getReading('occupancy').lines[0], /01$/);
    assert.match(props.getReading('team-photo').lines.join(' '), /A\. MOREL.*E\. VIAL.*N\. ROCHER/);
    props.setView({ phase: 'inspect', effects: ['paired_guestbook'] });
    assert.match(props.getReading('guestbook').lines[1], /TÉMOIN/);
    assert.match(props.getReading('occupancy').lines[0], /01$/);
  } finally { props.dispose(); }
});
