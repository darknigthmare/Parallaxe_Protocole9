import * as THREE from 'three';
import type { InspectorModel } from './avatar';

export const SHADOW_FLOOR_Y=.018;
// Parallel rays from the fixed C9 ceiling luminaire. The affine flattening is
// derived as (x,y,z) -> (x + .18*(y-h), h, z - .85*(y-h)).
export function bodyShadowMatrix(height=SHADOW_FLOOR_Y) {
  return new THREE.Matrix4().set(1,.18,0,-.18*height, 0,0,0,height, 0,-.85,1,.85*height, 0,0,0,1);
}
/** Copy the actual articulated hierarchy, share its immutable geometries, and
 * flatten it onto the floor. No second avatar, blob decal, pose mutation or GPU
 * shadow-map dependency. The unlit silhouette is opaque to avoid darkening each
 * overlapping triangle; the receiver supplies the normal lit floor. */
export function createBodyShadow(source: InspectorModel) {
  const projection=bodyShadowMatrix();
  const root=new THREE.Group();root.name='C9 — projection du corps '+source.identity.id;
  root.matrixAutoUpdate=false;root.userData.bodyShadow=true;
  const material=new THREE.MeshBasicMaterial({color:0x132522,side:THREE.DoubleSide,depthWrite:true,depthTest:true});
  const pairs: {source:THREE.Object3D;copy:THREE.Object3D}[]=[];
  const copies=new Map<THREE.Object3D,THREE.Object3D>();
  function mirror(node:THREE.Object3D,parent:THREE.Object3D) {
    // Labels, sprites and existing soft contact are not body geometry.
    if(node===source.contactShadow||(node as THREE.Sprite).isSprite)return;
    const mesh=node as THREE.Mesh;
    const copy=mesh.isMesh?new THREE.Mesh(mesh.geometry,material):new THREE.Group();
    copy.name=node.name;copy.layers.set(0);copy.castShadow=false;copy.receiveShadow=false;
    copy.frustumCulled=false;copy.raycast=()=>{}; // singular floor projection is not an inspectable volume
    parent.add(copy);copies.set(node,copy);pairs.push({source:node,copy});
    for(const child of node.children)mirror(child,copy);
  }
  for(const child of source.root.children)mirror(child,root);
  const shoulder=copies.get(source.shoulders[1])!;
  const elbow=copies.get(source.elbows[1])!;
  const hand=copies.get(source.hands[1])!;
  let disposed=false;
  const worldShoulder=new THREE.Vector3(),worldDirection=new THREE.Vector3(),rotation=new THREE.Quaternion();
  const downward=new THREE.Vector3(0,-1,0);
  const originalCasting=new Map<THREE.Mesh,boolean>();
  let savedContact:boolean|null=null;
  function restoreCasting() {
    for(const [mesh,cast]of originalCasting)mesh.castShadow=cast;
    originalCasting.clear();
    if(savedContact!==null){source.contactShadow.visible=savedContact;savedContact=null;}
  }
  function update(pointAt:{x:number;z:number}|null,visible=true) {
    if(disposed)return;
    root.visible=visible&&source.root.visible;
    if(!root.visible){restoreCasting();return;}
    source.root.updateWorldMatrix(true,true);
    root.matrix.multiplyMatrices(projection,source.root.matrixWorld);
    for(const pair of pairs){
      pair.copy.position.copy(pair.source.position);pair.copy.quaternion.copy(pair.source.quaternion);
      pair.copy.scale.copy(pair.source.scale);pair.copy.visible=pair.source.visible;
      const mesh=pair.source as THREE.Mesh;
      if(mesh.isMesh&&!originalCasting.has(mesh)){originalCasting.set(mesh,mesh.castShadow);mesh.castShadow=false;}
    }
    if(savedContact===null)savedContact=source.contactShadow.visible;
    source.contactShadow.visible=false;
    if(pointAt&&Number.isFinite(pointAt.x)&&Number.isFinite(pointAt.z)){
      source.shoulders[1].getWorldPosition(worldShoulder);worldShoulder.applyMatrix4(projection);
      worldDirection.set(pointAt.x-worldShoulder.x,0,pointAt.z-worldShoulder.z);
      if(worldDirection.lengthSq()>.04){
        source.root.getWorldQuaternion(rotation);worldDirection.normalize().applyQuaternion(rotation.invert());
        shoulder.quaternion.setFromUnitVectors(downward,worldDirection);
        elbow.quaternion.identity();hand.quaternion.identity();
        // The real radio stays in its real hand; do not leave a detached radio shadow.
      }
    }
    root.updateMatrixWorld(true);
  }
  function direction() {
    root.updateMatrixWorld(true);
    const from=shoulder.getWorldPosition(new THREE.Vector3());
    const to=hand.getWorldPosition(new THREE.Vector3());
    return {from:from.toArray(),to:to.toArray()};
  }
  return {root,source,update,direction,dispose(){if(disposed)return;disposed=true;restoreCasting();root.removeFromParent();root.clear();material.dispose();}};
}
