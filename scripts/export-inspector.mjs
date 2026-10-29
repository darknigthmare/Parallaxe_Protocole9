/**
 * Export the original procedural inspector without a GPU or additional packages.
 * The badge's runtime canvas lettering is deliberately omitted; all geometric
 * equipment, PBR base materials and articulated node transforms are preserved.
 */
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { createHash } from 'node:crypto';
import { createRequire } from 'node:module';
import { fileURLToPath, pathToFileURL } from 'node:url';
import ts from 'typescript';
import * as THREE from 'three';
import { GLTFExporter } from 'three/addons/exporters/GLTFExporter.js';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';

const require = createRequire(import.meta.url);
const project = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const temp = fs.mkdtempSync(path.join(os.tmpdir(), 'parallaxe-inspector-export-'));
const output = path.join(project, 'public', 'models');
const originalDocument = globalThis.document;
const originalFileReader = globalThis.FileReader;
let model;

class NodeBlobReader {
  result = null;
  onloadend = null;
  onerror = null;
  readAsArrayBuffer(blob) {
    blob.arrayBuffer().then(value => { this.result = value; this.onloadend?.(); }).catch(error => this.onerror?.(error));
  }
  readAsDataURL(blob) {
    blob.arrayBuffer().then(value => { this.result = `data:${blob.type || 'application/octet-stream'};base64,${Buffer.from(value).toString('base64')}`; this.onloadend?.(); }).catch(error => this.onerror?.(error));
  }
}

try {
  const threeModule = pathToFileURL(path.join(path.dirname(require.resolve('three')), 'three.module.js')).href;
  let source = ts.transpileModule(fs.readFileSync(path.join(project, 'src/game/avatar.ts'), 'utf8'), {
    compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.ES2022 },
  }).outputText;
  source = source.replace("from 'three'", `from ${JSON.stringify(threeModule)}`);
  source = source.replace(/from '(three\/addons\/[^']+)'/g, (_, specifier) => `from ${JSON.stringify(pathToFileURL(require.resolve(specifier)).href)}`);
  const modulePath = path.join(temp, 'avatar.mjs'); fs.writeFileSync(modulePath, source);
  // No image is synthesized: placeholder canvas maps are removed before export.
  globalThis.document = { createElement: () => ({ width: 0, height: 0, getContext: () => new Proxy({}, { get: () => () => {}, set: () => true }) }) };
  globalThis.FileReader = NodeBlobReader;
  const { createInspector } = await import(pathToFileURL(modulePath).href);
  model = createInspector({ id: 'original-parallaxe-inspector', name: 'Inspecteur', slot: 0 }, { nameplate: false });
  model.root.name = 'parallaxe_inspector';
  const joints = [
    [model.head, 'head'], [model.root.getObjectByName('Torso'), 'torso'],
    [model.shoulders[0], 'shoulder_l'], [model.shoulders[1], 'shoulder_r'],
    [model.elbows[0], 'forearm_l'], [model.elbows[1], 'forearm_r'],
    [model.hands[0], 'hand_l'], [model.hands[1], 'hand_r'],
    [model.hips[0], 'hip_l'], [model.hips[1], 'hip_r'],
    [model.knees[0], 'shin_l'], [model.knees[1], 'shin_r'],
  ];
  for (const [joint, name] of joints) joint.name = name;
  function clip(name, duration, state) {
    const times = Array.from({ length: 17 }, (_, index) => index / 16 * duration);
    const rotations = joints.map(() => []);
    for (const time of times) {
      model.animate(state(time));
      joints.forEach(([joint], index) => rotations[index].push(...joint.quaternion.toArray()));
    }
    const tracks = joints.map(([, name], index) => new THREE.QuaternionKeyframeTrack(`${name}.quaternion`, times, rotations[index]));
    return new THREE.AnimationClip(name, duration, tracks);
  }
  const animations = [
    clip('Marche', Math.PI * 2 / 8.2, time => ({ time, speed: 2.3 })),
    clip('Radio', 1.5, time => ({ time, speed: 0, talking: time > .1 && time < 1.3 })),
    clip('Salut', 2, time => ({ time, speed: 0, independent: time > .2 && time < 1.8 })),
  ];
  model.animate({ time: 0, speed: 0 });
  // Animation now restores the current badge map. Strip runtime-only canvas maps
  // after sampling all clips so the final export remains independent of a DOM.
  model.root.traverse(object => {
    if (!object.isMesh) return;
    const materials = Array.isArray(object.material) ? object.material : [object.material];
    for (const material of materials) {
      material.map = null; material.emissiveMap = null;
    }
  });
  model.radio.visible = true; // The reusable model carries its device in its hand.
  model.root.updateMatrixWorld(true);
  let bounds = new THREE.Box3().setFromObject(model.root);
  model.root.position.y -= bounds.min.y;
  model.root.updateMatrixWorld(true); bounds = new THREE.Box3().setFromObject(model.root);
  const dimensions = bounds.getSize(new THREE.Vector3());
  model.root.userData.export = {
    source: 'src/game/avatar.ts', originalProceduralGeometry: true,
    rig: 'Rigid articulated node hierarchy; no skin weights',
    omitted: ['Runtime badge lettering texture', 'Name sprite', 'Procedural gameplay and reflection effects'],
  };
  const binary = await new GLTFExporter().parseAsync(model.root, { binary: true, trs: true, onlyVisible: false, animations });
  if (!(binary instanceof ArrayBuffer)) throw new Error('Expected binary glTF output');
  fs.mkdirSync(output, { recursive: true });
  const assetPath = path.join(output, 'inspecteur-parallaxe.glb'); fs.writeFileSync(assetPath, Buffer.from(binary));
  // Round-trip through the standard loader verifies the actual file representation.
  const loaded = await new GLTFLoader().parseAsync(binary, '');
  let meshes = 0, triangles = 0, invalidValues = 0;
  loaded.scene.traverse(object => {
    if (!object.isMesh) return;
    meshes++;
    triangles += (object.geometry.index?.count || object.geometry.attributes.position.count) / 3;
    for (const value of object.geometry.attributes.position.array) if (!Number.isFinite(value)) invalidValues++;
  });
  if (invalidValues || meshes === 0 || loaded.animations.length !== 3) throw new Error('Export validation failed');
  const manifest = {
    file: 'inspecteur-parallaxe.glb', format: 'glTF 2.0 binary', bytes: binary.byteLength,
    origin: 'Original procedural geometry created for PARALLAXE; no downloaded third-party model',
    materialScope: 'PBR base materials. Runtime canvas badge lettering and name sprites are not embedded.',
    rig: '12 articulated transform nodes; rigid pieces attached to joints, no skinned deformation',
    animations: loaded.animations.map(animation => ({ name: animation.name, durationSeconds: animation.duration, tracks: animation.tracks.length })),
    dimensionsMetres: { width: Number(dimensions.x.toFixed(4)), height: Number(dimensions.y.toFixed(4)), depth: Number(dimensions.z.toFixed(4)) },
    triangles: Math.round(triangles), meshes,
    validation: 'Round-trip GLTFExporter → GLTFLoader passed; finite vertices; 3 animation clips',
    visualValidation: 'Not performed: no GPU render or screenshot certified',
    source: 'src/game/avatar.ts', rebuild: 'node scripts/export-inspector.mjs',
    sourceVersion: JSON.parse(fs.readFileSync(path.join(project, 'package.json'), 'utf8')).version,
    sourceSha256: createHash('sha256').update(fs.readFileSync(path.join(project, 'src/game/avatar.ts'))).digest('hex'),
  };
  fs.writeFileSync(path.join(output, 'inspecteur-parallaxe.manifest.json'), JSON.stringify(manifest, null, 2) + '\n');
  console.log(JSON.stringify({ saved: assetPath, ...manifest }, null, 2));
} finally {
  model?.dispose(); globalThis.document = originalDocument; globalThis.FileReader = originalFileReader;
  fs.rmSync(temp, { recursive: true, force: true });
}
