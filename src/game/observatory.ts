import * as THREE from 'three';
import type { Reflector } from 'three/addons/objects/Reflector.js';
import type { InspectionReading } from './inspection-data';

type ReflectionFactory = (w:number,h:number,tint?:number,opacity?:number)=>Reflector;
/** Optional, traversable terrestrial observatory. Shared shutters, private sky; no moving collision. */
export function createObservatoryWorld(reflection:ReflectionFactory) {
  const id='observatory' as const, root=new THREE.Group();root.name='Observatoire 09 — galerie terrestre';
  const targets:THREE.Object3D[]=[],colliders:{x:number;z:number;rx:number;rz:number}[]=[],reflectors:Reflector[]=[];
  const lights:{light:THREE.PointLight;intensity:number;color:THREE.Color}[]=[];
  const geometries=new Set<THREE.BufferGeometry>(),materials=new Set<THREE.Material>(),textures=new Set<THREE.Texture>();
  let disposed=false,opening=0,relay='0909',effects=new Set<string>();
  function mat(p:THREE.MeshStandardMaterialParameters){const m=new THREE.MeshStandardMaterial(p);materials.add(m);return m;}
  const steel=mat({color:0x657d86,metalness:.7,roughness:.45}),dark=mat({color:0x16272e,roughness:.8}),wall=mat({color:0x6c7e84,roughness:.85});
  const warm=mat({color:0xc6bc96,roughness:.7}),floor=mat({color:0x43515c,roughness:.75}),glow=mat({color:0xe0d2ac,emissive:0xb5c7d0,emissiveIntensity:.9});
  function mesh(g:THREE.BufferGeometry,m:THREE.Material,parent:THREE.Object3D=root){geometries.add(g);materials.add(m);const o=new THREE.Mesh(g,m);parent.add(o);o.castShadow=true;o.receiveShadow=true;return o;}
  function box(w:number,h:number,d:number,x:number,y:number,z:number,m:THREE.Material=wall,parent:THREE.Object3D=root){const o=mesh(new THREE.BoxGeometry(w,h,d),m,parent);o.position.set(x,y,z);return o;}
  function tag(o:THREE.Object3D,name:string,label:string){o.userData.inspect={id:name,label};targets.push(o);return o;}
  function label(lines:string[]){const c=document.createElement('canvas');c.width=768;c.height=256;const ctx=c.getContext('2d')!;ctx.fillStyle='#122830';ctx.fillRect(0,0,768,256);ctx.fillStyle='#e6d6a6';ctx.textAlign='center';ctx.textBaseline='middle';ctx.font='30px monospace';lines.forEach((t,i)=>ctx.fillText(t,384,(i+.5)*256/lines.length));const t=new THREE.CanvasTexture(c);t.colorSpace=THREE.SRGBColorSpace;textures.add(t);return t;}
  function panel(w:number,h:number,x:number,y:number,z:number,lines:string[],parent:THREE.Object3D=root){const t=label(lines);const o=mesh(new THREE.PlaneGeometry(w,h),mat({map:t,emissiveMap:t,emissive:0xffffff,emissiveIntensity:.25}),parent);o.position.set(x,y,z);return o;}
  function wallGroup(side:number,z:number){const g=new THREE.Group();g.position.set(side*3.62,0,z);g.rotation.y=-side*Math.PI/2;root.add(g);return g;}
  function lamp(x:number,y:number,z:number){const l=new THREE.PointLight(0xc8dde8,16,10,2);l.position.set(x,y,z);root.add(l);lights.push({light:l,intensity:16,color:l.color.clone()});box(.6,.07,.18,x,y+.08,z,glow);}

  // The west wall has a physical opening, never a planet pasted onto an opaque wall.
  box(7.65,.2,28.4,0,-.1,-2,floor);box(.2,3.6,28.4,3.82,1.8,-2);
  box(.2,3.6,17.1,-3.82,1.8,3.55);box(.2,3.6,6.1,-3.82,1.8,-13.05);
  box(.2,.8,5.2,-3.82,.4,-7.6);box(.2,.35,5.2,-3.82,3.425,-7.6);
  for(const z of [-16,12.1])box(7.65,3.6,.2,0,1.8,z);
  box(7.65,.12,28.4,0,3.58,-2,dark);
  for(let z=-14.5;z<12;z+=3.8){box(7.3,.15,.13,0,3.36,z,steel);lamp(0,3.05,z);}
  for(let z=-15;z<12;z+=1.4)box(7.3,.006,.016,0,.007,z,steel);
  const invisible=new THREE.MeshBasicMaterial({visible:false});materials.add(invisible);
  tag(box(7.1,.01,27.6,0,.02,-2,invisible),'floor','Sol de la galerie O9');
  tag(box(7.1,.02,27.6,0,3.4,-2,invisible),'ceiling','Voûte de l’observatoire');

  const bay=wallGroup(-1,-7.6);bay.name='O9 — baie ouverte sur le relief';
  for(const x of [-2.59,2.59])box(.10,2.55,.32,x,2.04,0,steel,bay);
  for(const y of [.80,3.28])box(5.28,.12,.35,0,y,0,steel,bay);
  box(5.0,.12,.65,0,.80,.12,warm,bay);
  // All exterior geometry is in world space behind the opening and never in the HUD.
  const outside=new THREE.Group();outside.name='O9 — relief terrestre nocturne';bay.add(outside);
  const skyMat=new THREE.MeshBasicMaterial({color:0x0c1425,fog:false});materials.add(skyMat);
  box(54,28,.1,0,5,-35,skyMat,outside);
  for(let i=0;i<17;i++){
    const height=2.2+Math.sin(i*2.1)*.7+Math.cos(i*.72)*.8;
    const g=new THREE.ConeGeometry(3.8,height,4);const m=new THREE.MeshBasicMaterial({color:i%2?0x263744:0x1a2b38,fog:false});
    const peak=mesh(g,m,outside);peak.position.set(-25+i*3.1,height/2-1.15,-20-(i%3)*2);peak.rotation.y=i*.23;peak.castShadow=false;
  }
  const starMat=new THREE.MeshBasicMaterial({color:0xcbd9e0,fog:false});materials.add(starMat);
  for(let i=0;i<38;i++){const star=mesh(new THREE.SphereGeometry(.025,5,4),starMat,outside);star.position.set(Math.sin(i*17.2)*23,4+((i*23)%140)/12,-32);star.castShadow=false;}
  const planetTexture=(()=>{const c=document.createElement('canvas');c.width=512;c.height=256;const ctx=c.getContext('2d')!;ctx.fillStyle='#335c73';ctx.fillRect(0,0,512,256);
    for(let i=0;i<140;i++){const x=(i*71.3)%512,y=20+((i*43.7)%217);ctx.fillStyle=i%4?'#859783':'#b1b59b';ctx.beginPath();ctx.ellipse(x,y,8+(i%9)*2,4+(i%5)*2,i*.7,0,Math.PI*2);ctx.fill();}
    for(let i=0;i<28;i++){ctx.fillStyle='rgba(231,234,216,.42)';ctx.beginPath();ctx.ellipse((i*67)%512,(i*39)%256,45,6,Math.sin(i)*.3,0,Math.PI*2);ctx.fill();}
    const t=new THREE.CanvasTexture(c);t.colorSpace=THREE.SRGBColorSpace;textures.add(t);return t;})();
  const planet=mesh(new THREE.SphereGeometry(6.8,48,32),new THREE.MeshBasicMaterial({map:planetTexture,color:0xb0c4cc,fog:false}),outside);
  planet.name='O9 — planète privée';planet.position.set(.6,5.5,-22);planet.rotation.z=.16;planet.rotation.y=.6;planet.castShadow=false;
  const shutterMat=mat({color:0x435b6a,metalness:.7,roughness:.55});
  const shutters=[-1,1].map(side=>{const g=new THREE.Group();g.name=`O9 — volet ${side}`;bay.add(g);box(2.66,2.36,.09,0,2.04,.14,shutterMat,g);for(let y=1.04;y<3.2;y+=.25)box(2.5,.035,.05,0,y,.20,steel,g);return g;});
  // Public control is separated from the reading zone: E opens/closes; E on glass reads the horizon.
  const control=wallGroup(-1,-4.45);control.name='O9 — commande des volets';
  box(.46,.42,.18,0,1.23,.14,dark,control);box(.11,.11,.07,0,1.23,.28,glow,control);panel(.60,.20,0,1.60,.12,['E · VOLETS'],control);
  tag(control,'observatory-shutters','O9 — ouvrir / fermer les volets');
  const windowTarget=box(4.98,2.28,.012,0,2.03,.23,invisible,bay);windowTarget.castShadow=false;
  tag(windowTarget,'observatory-window','O9 — horizon à comparer');
  panel(2.25,.28,0,3.39,.20,['OBSERVATOIRE 09 · TERRE'],bay);

  // Optical equipment and its footprint leave the central route intact.
  const telescope=new THREE.Group();telescope.name='Télescope de contrôle';telescope.position.set(2.35,0,-7.7);root.add(telescope);
  box(.80,.12,.80,0,.06,0,steel,telescope);box(.18,1.18,.18,0,.65,0,steel,telescope);
  const tube=mesh(new THREE.CylinderGeometry(.18,.22,1.55,24),dark,telescope);tube.position.set(0,1.50,0);tube.rotation.z=.95;
  colliders.push({x:2.35,z:-7.7,rx:.55,rz:.6});
  for(const z of [-1.7,8.7]){box(.55,1.25,1.7,3.27,.625,z,dark);colliders.push({x:3.27,z,rx:.31,rz:.9});}
  const terminal=new THREE.Group();terminal.position.set(0,0,-12.9);root.add(terminal);
  box(.64,.08,.52,0,.04,0,steel,terminal);box(.14,.95,.14,0,.53,0,steel,terminal);
  panel(.72,.42,0,1.1,.08,['PROTOCOL 09','DIAGNOSTIC'],terminal);tag(terminal,'exit','Terminal de diagnostic — E');colliders.push({x:0,z:-12.9,rx:.42,rz:.32});
  const exit=panel(1.4,.35,0,3.15,-15.84,['SORTIE','09']);tag(exit,'exit','Sas de diagnostic');box(2.0,2.8,.12,0,1.4,-15.8,steel);
  const relayBody=new THREE.Group();relayBody.position.set(2.72,1.42,7.3);root.add(relayBody);box(.67,.43,.08,0,0,0,dark,relayBody);
  const screen=panel(.58,.35,0,0,.045,['RELAIS',relay],relayBody);tag(relayBody,'radio','Relais O9 — comparez le code');
  const frame=wallGroup(1,3.75);box(1.33,2.65,.09,0,1.65,.035,steel,frame);
  const mirror=reflection(1.18,2.5,0x81949c,1);mirror.position.set(0,1.65,.09);frame.add(mirror);reflectors.push(mirror);tag(frame,'mirror','Miroir de contrôle O9');
  // A second small control glass preserves the common two-surface budget.
  const glassFrame=wallGroup(-1,-12.25);box(2.2,2.0,.12,0,2.03,.02,dark,glassFrame);
  const glass=reflection(2.12,1.84,0x758894,1);glass.position.set(0,2.03,.10);glassFrame.add(glass);reflectors.push(glass);tag(glassFrame,'window','Vitre de contrôle intérieur O9');
  function apply(){shutters.forEach((g,i)=>{g.position.x=(i?1:-1)*(1.31+opening*2.65);});planet.visible=effects.has('observatory_earth')&&opening>.001;}
  function setOpening(value:number){if(disposed)return;opening=Number.isFinite(value)?Math.max(0,Math.min(1,value)):0;apply();}
  function setView(next:Set<string>,code='0909'){
    if(disposed)return;effects=new Set(next);const valid=/^\d{4}$/.test(code)?code:'0909';
    if(valid!==relay){relay=valid;const m=screen.material as THREE.MeshStandardMaterial;const old=m.map!;m.map=label(['RELAIS',relay]);m.emissiveMap=m.map;textures.delete(old);old.dispose();}
    apply();
  }
  function getReading(target?:{id:string;label:string}|null):InspectionReading|null{
    if(disposed||!target||!['observatory-window','observatory-shutters'].includes(target.id))return null;
    return {title:'Baie O9',location:'Observatoire terrestre, depuis la galerie',lines:opening<.98?['VOLETS '+Math.round(opening*100)+' % OUVERTS','Attendez l’ouverture complète pour comparer le même horizon.']:['VOLETS OUVERTS','RELIEF TERRESTRE NOCTURNE FIXE',planet.visible?'UN GRAND DISQUE PLANÉTAIRE AU-DESSUS DU RELIEF, DERRIÈRE LE CADRE':'CIEL ÉTOILÉ, SANS GRAND DISQUE AU-DESSUS DU RELIEF']};
  }
  function dispose(){if(disposed)return;disposed=true;root.traverse(o=>{const m=o as THREE.Mesh;if(m.geometry)geometries.add(m.geometry);if(m.material)(Array.isArray(m.material)?m.material:[m.material]).forEach(v=>materials.add(v));});geometries.forEach(g=>g.dispose());materials.forEach(m=>m.dispose());textures.forEach(t=>t.dispose());reflectors.forEach(r=>r.getRenderTarget().dispose());root.clear();}
  setView(new Set());setOpening(0);
  return {id,root,targets,colliders,reflectors,lights,setView,setOpening,update(_time:number){},getReading,dispose};
}
