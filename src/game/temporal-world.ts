import * as THREE from 'three';
import { createTemporalState, PROP_ANCHORS, type PropEvent, type PropTarget, type TemporalView } from './temporal-state';
/** Four authored props, a single shared gesture, and private reversible outcomes. */
export function createTemporalWorld() {
  const root = new THREE.Group(); root.name = 'Saint-Clair — gestes et délais';
  const targets: THREE.Object3D[] = [], geometries = new Set<THREE.BufferGeometry>(), materials = new Set<THREE.Material>(), textures = new Set<THREE.Texture>();
  const state=createTemporalState(); let disposed=false;
  const colliders=[{x:-3.30,z:-4.10,rx:.30,rz:.38},{x:3.22,z:11.10,rx:.70,rz:.62},{x:3.20,z:-14,rx:.36,rz:.43}];
  const mat=(p:THREE.MeshStandardMaterialParameters)=>{const m=new THREE.MeshStandardMaterial(p);materials.add(m);return m;};
  const brass=mat({color:0xb79a60,metalness:.8,roughness:.3}),oak=mat({color:0x644b34,roughness:.65}),iron=mat({color:0x162b29,metalness:.5,roughness:.5});
  const ceramic=mat({color:0xdfd1ae,roughness:.25}),green=mat({color:0x445e37,roughness:.8}),petal=mat({color:0xc9a573,roughness:.75});
  function mesh(g:THREE.BufferGeometry,m:THREE.Material,parent:THREE.Object3D=root){geometries.add(g);materials.add(m);const o=new THREE.Mesh(g,m);o.castShadow=true;o.receiveShadow=true;parent.add(o);return o;}
  function box(w:number,h:number,d:number,x:number,y:number,z:number,m:THREE.Material,parent:THREE.Object3D=root){const o=mesh(new THREE.BoxGeometry(w,h,d),m,parent);o.position.set(x,y,z);return o;}
  function sphere(r:number,x:number,y:number,z:number,m:THREE.Material,parent:THREE.Object3D=root){const o=mesh(new THREE.SphereGeometry(r,20,12),m,parent);o.position.set(x,y,z);return o;}
  function cylinder(top:number,bottom:number,h:number,x:number,y:number,z:number,m:THREE.Material,parent:THREE.Object3D=root){const o=mesh(new THREE.CylinderGeometry(top,bottom,h,24),m,parent);o.position.set(x,y,z);return o;}
  function group(name:string,position:readonly[number,number,number],id:PropTarget,label:string){const o=new THREE.Group();o.name=name;o.position.set(...position);o.userData.inspect={id,label};root.add(o);targets.push(o);return o;}
  function label(parent:THREE.Object3D,text:string,w:number,y:number,z:number){const c=document.createElement('canvas');c.width=512;c.height=128;const ctx=c.getContext('2d')!;ctx.fillStyle='#152e2b';ctx.fillRect(0,0,512,128);ctx.fillStyle='#e7d6ac';ctx.font='24px sans-serif';ctx.textAlign='center';ctx.fillText(text,256,72,480);const t=new THREE.CanvasTexture(c);t.colorSpace=THREE.SRGBColorSpace;textures.add(t);const m=mat({map:t,roughness:.8,side:THREE.DoubleSide});const o=mesh(new THREE.PlaneGeometry(w,.13),m,parent);o.position.set(0,y,z);o.castShadow=false;}
  const bell=group('Réception — cloche de service',PROP_ANCHORS.bell,'bell','Cloche de réception — E sonner');
  cylinder(.16,.18,.045,0,-.08,0,iron,bell);
  const dome=sphere(.14,0,-.05,0,brass,bell);dome.scale.y=.60;
  const button=cylinder(.037,.03,.055,0,.075,0,brass,bell);button.name='Cloche — bouton';
  label(bell,'E · APPELER',.34,-.13,.18);
  const vase=group('Salon — vase de service',PROP_ANCHORS.vase,'vase','Vase à fleur — E tourner de 90°');
  box(.58,.08,.58,0,-.19,0,oak,vase);box(.07,.90,.48,-.18,-.63,0,iron,vase);
  const vasePivot=new THREE.Group();vasePivot.name='Vase — pivot';vase.add(vasePivot);
  cylinder(.09,.16,.30,0,0,0,ceramic,vasePivot);cylinder(.10,.09,.05,0,.17,0,brass,vasePivot);
  box(.035,.20,.015,0,0,.148,brass,vasePivot);
  // Separate sibling pivot prevents the normal parent's rotation from leaking into the delayed stem.
  const flower=new THREE.Group();flower.name='Fleur — pivot indépendant';vase.add(flower);
  cylinder(.012,.018,.50,0,.37,0,green,flower);
  for(let i=0;i<3;i++){const leaf=sphere(.08,i%2?.06:-.06,.3+i*.1,0,green,flower);leaf.scale.set(1.2,.23,.5);leaf.rotation.z=i%2?.4:-.4;}
  const bloom=new THREE.Group();bloom.position.set(0,.65,.10);flower.add(bloom);
  sphere(.045,0,0,0,brass,bloom);
  for(let i=0;i<7;i++){const a=i*Math.PI*2/7;const p=sphere(.075,Math.cos(a)*.07,Math.sin(a)*.07,.015,petal,bloom);p.scale.set(.8,1,.28);}
  label(vase,'E · QUART DE TOUR',.55,-.26,.31);
  const door=group('Porte témoin — contrôle volontaire',[3.49,0,11.10],'witness-door','Porte témoin — E ouvrir');door.rotation.y=-Math.PI/2;
  box(1.07,2.18,.09,0,1.09,0,oak,door);box(.91,2.0,.035,0,1.04,.06,iron,door);
  const hinge=new THREE.Group();hinge.name='Porte témoin — charnière';hinge.position.set(-.43,0,.10);door.add(hinge);
  box(.86,1.95,.055,.43,1.04,0,oak,hinge);box(.08,.02,.07,.74,1.1,.065,brass,hinge);
  label(door,'PORTE TÉMOIN · E',.85,2.30,.10);
  // Explicit planar silhouette, not a shadow-map trick: visible in every graphics profile.
  const shadowPivot=new THREE.Group();shadowPivot.name='Porte témoin — ombre';shadowPivot.position.set(-.43,.015,.12);door.add(shadowPivot);
  const shadowMaterial=new THREE.MeshBasicMaterial({color:0x06110f,transparent:true,opacity:.65,side:THREE.DoubleSide,depthWrite:false});materials.add(shadowMaterial);
  const shadow=mesh(new THREE.PlaneGeometry(.86,1.0),shadowMaterial,shadowPivot);shadow.rotation.x=-Math.PI/2;shadow.position.set(.43,0,.50);shadow.castShadow=false;shadow.receiveShadow=false;
  // The physical door doesn't cast a competing automatic shadow on top of the authored proof.
  hinge.traverse(o=>o.castShadow=false);
  const vitrine=group('Vitrine — mannequin de service',[3.20,0,-14],'listening-mannequin','Mannequin de vitrine — E appeler');
  box(.66,.17,.70,0,.085,0,oak,vitrine);box(.66,.08,.70,0,2.05,0,oak,vitrine);
  for(const x of [-.30,.30])for(const z of [-.32,.32])box(.035,1.85,.035,x,1.08,z,brass,vitrine);
  const clear=mat({color:0xc5d7cb,transparent:true,opacity:.10,depthWrite:false,side:THREE.DoubleSide});
  box(.62,1.82,.005,0,1.08,.34,clear,vitrine);
  const body=new THREE.Group();body.rotation.y=state.snapshot().normalHeadYaw;vitrine.add(body);
  cylinder(.16,.12,.55,0,1.15,0,ceramic,body);sphere(.14,0,.87,0,ceramic,body);
  for(const x of [-.1,.1]){cylinder(.06,.07,.57,x,.50,0,ceramic,body);box(.13,.10,.24,x,.20,.05,iron,body);}
  for(const x of [-.22,.22]){sphere(.055,x,1.38,0,brass,body);cylinder(.045,.055,.48,x,1.12,0,ceramic,body);sphere(.055,x,.84,0,ceramic,body);}
  const head=new THREE.Group();head.name='Mannequin — tête articulée';head.position.y=1.59;body.add(head);
  cylinder(.055,.055,.09,0,-.06,0,brass,head);const skull=sphere(.14,0,.08,0,ceramic,head);skull.scale.y=1.22;
  sphere(.032,0,.07,.137,ceramic,head);for(const x of [-.05,.05])sphere(.014,x,.12,.124,iron,head);
  label(vitrine,'E · APPELER / MESSAGE',.64,1.98,.36);
  function apply(){const f=state.snapshot();button.position.y=.075-f.bellPress*.035;vasePivot.rotation.y=f.vaseYaw;flower.rotation.y=f.flowerYaw;hinge.rotation.y=f.door===0?0:-f.door*Math.PI/2;shadowPivot.rotation.y=f.shadow===0?0:-f.shadow*Math.PI/2;head.rotation.y=f.headYaw;}
  function setView(view:TemporalView){if(disposed)return;root.visible=(view.levelId??'hotel')==='hotel';state.setView(view);apply();}
  setView({phase:'menu',levelId:'hotel',loop:0});
  return {root,targets,colliders,setView,
    sync(events:readonly PropEvent[]|null,serverTime?:number){if(disposed)return;state.sync(events,serverTime);apply();},
    update(dt:number,active:boolean){if(disposed)return;state.update(dt,active);apply();},
    activate(target:PropTarget,pose:{x:number;z:number}){if(disposed)return false;const ok=state.activate(target,pose);apply();return ok;},
    snapshot:state.snapshot,focus:state.focus,clearFocus:state.clearFocus,
    dispose(){if(disposed)return;disposed=true;geometries.forEach(x=>x.dispose());materials.forEach(x=>x.dispose());textures.forEach(x=>x.dispose());root.clear();}};
}
