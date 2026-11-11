import * as THREE from 'three';
/** Full-depth stationary cabin behind a permanent opening, never an extra exit. */
export type LiftFrame = {liftOpening:number;liftVisitor:boolean;liftVisitorProgress:number};
export function createLiftWorld() {
  const root=new THREE.Group();root.name='Saint-Clair — ascenseur de service';root.position.set(-2.45,0,-15.78);
  root.userData.inspect={id:'lift',label:'Ascenseur 09 — E appeler / ouvrir'};
  const geometries=new Set<THREE.BufferGeometry>(),materials=new Set<THREE.Material>(),textures=new Set<THREE.Texture>();let disposed=false;
  const mat=(p:THREE.MeshStandardMaterialParameters)=>{const m=new THREE.MeshStandardMaterial(p);materials.add(m);return m;};
  const brass=mat({color:0xb9a174,metalness:.70,roughness:.35}),wood=mat({color:0x554133,roughness:.70}),steel=mat({color:0x50635f,metalness:.65,roughness:.4}),dark=mat({color:0x112523,roughness:.8});
  function box(w:number,h:number,d:number,x:number,y:number,z:number,m:THREE.Material,parent:THREE.Object3D=root){const g=new THREE.BoxGeometry(w,h,d);geometries.add(g);const mesh=new THREE.Mesh(g,m);mesh.position.set(x,y,z);mesh.castShadow=true;mesh.receiveShadow=true;parent.add(mesh);return mesh;}
  function sphere(r:number,x:number,y:number,z:number,m:THREE.Material,parent:THREE.Object3D){const g=new THREE.SphereGeometry(r,16,12);geometries.add(g);const mesh=new THREE.Mesh(g,m);mesh.position.set(x,y,z);mesh.castShadow=true;parent.add(mesh);return mesh;}
  function sign(text:string,w:number,h:number,x:number,y:number,z:number){const c=document.createElement('canvas');c.width=512;c.height=128;const ctx=c.getContext('2d')!;ctx.fillStyle='#122925';ctx.fillRect(0,0,512,128);ctx.fillStyle='#e7d6ae';ctx.font='38px monospace';ctx.textAlign='center';ctx.fillText(text,256,82,480);const t=new THREE.CanvasTexture(c);t.colorSpace=THREE.SRGBColorSpace;textures.add(t);const m=mat({map:t,emissiveMap:t,emissive:0xffffff,emissiveIntensity:.35,roughness:.7});const g=new THREE.PlaneGeometry(w,h);geometries.add(g);const mesh=new THREE.Mesh(g,m);mesh.position.set(x,y,z);mesh.castShadow=false;root.add(mesh);return mesh;}
  // Separate back, two side walls, floor and ceiling. Floor remains fixed at 09.
  box(2.10,.12,1.95,0,-.03,-.85,steel);box(2.10,.10,1.95,0,2.65,-.85,wood);
  box(.10,2.65,1.95,-1.03,1.325,-.85,wood);box(.10,2.65,1.95,1.03,1.325,-.85,wood);
  box(2.10,2.65,.10,0,1.325,-1.80,wood);
  for(const x of [-.92,.92])box(.06,2.61,.14,x,1.305,.10,brass);
  box(1.90,.09,.16,0,2.60,.10,brass);
  box(1.9,.035,.13,0,.035,.10,brass);
  for(const x of [-.62,0,.62])box(.028,2.30,.025,x,1.35,-1.73,brass);
  box(1.75,.045,.065,0,.95,-1.67,brass);
  const glow=mat({color:0xffe1b6,emissive:0xffd5a0,emissiveIntensity:1.4});box(1.45,.045,.50,0,2.55,-.95,glow);
  // Keep lighting local to the cabin; no effect-dependent light or shadow change.
  const light=new THREE.PointLight(0xffdda8,7,3.2,2);light.position.set(0,2.40,-.9);root.add(light);
  const doors=[-1,1].map(side=>{const g=new THREE.Group();g.name=side<0?'Ascenseur — porte gauche':'Ascenseur — porte droite';root.add(g);box(.88,2.48,.06,0,1.28,-.35,steel,g);box(.025,2.40,.012,-side*.41,1.28,-.312,brass,g);return g;});
  sign('ÉTAGE 09',1.10,.21,0,2.87,.14).name='Ascenseur — étage fixe 09';
  sign('E · APPELER',.80,.13,0,3.12,.14);
  const call=box(.14,.25,.07,1.10,1.20,.12,brass);call.name='Ascenseur — bouton d’appel';
  const visitor=new THREE.Group();visitor.name='Ascenseur — passager persistant';root.add(visitor);
  const coat=mat({color:0x53605c,roughness:.9}),skin=mat({color:0xc2b9a0,roughness:.8}),shoes=mat({color:0x11211e,roughness:.9});
  box(.43,.73,.23,0,1.02,0,coat,visitor);box(.38,.15,.23,0,.66,0,coat,visitor);
  sphere(.13,0,1.57,0,skin,visitor).scale.y=1.25;sphere(.025,0,1.55,.13,skin,visitor);
  for(const side of [-1,1]){box(.12,.58,.15,side*.10,.35,0,coat,visitor);box(.14,.10,.25,side*.10,.08,.05,shoes,visitor);box(.095,.61,.12,side*.27,1.01,0,coat,visitor);sphere(.05,side*.27,.69,0,skin,visitor);sphere(.012,side*.045,1.62,.117,shoes,visitor);}
  box(.30,.03,.29,0,1.76,0,shoes,visitor);box(.23,.12,.22,0,1.83,0,shoes,visitor);
  function apply(f:LiftFrame){if(disposed)return;const open=Math.max(0,Math.min(1,f.liftOpening));doors.forEach((d,i)=>{d.position.x=(i===0?-1:1)*(.44+open*.88);});visitor.visible=f.liftVisitor;visitor.position.set(.22,0,-1.30+Math.max(0,Math.min(1,f.liftVisitorProgress))*1.30);}
  apply({liftOpening:0,liftVisitor:false,liftVisitorProgress:0});
  return{root,apply,dispose(){if(disposed)return;disposed=true;geometries.forEach(g=>g.dispose());materials.forEach(m=>m.dispose());textures.forEach(t=>t.dispose());root.clear();}};
}
