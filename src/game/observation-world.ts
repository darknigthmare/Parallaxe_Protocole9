import * as THREE from 'three';
import { createObservationState, STAR_POSITIONS, type ObservationView, type ObservationPose } from './observation-state';
import type { InspectionReading } from './inspection-data';

/** Original Saint-Clair props. All mutations are per client; collisions never change with perception. */
export function createObservationWorld() {
  const root = new THREE.Group(); root.name = 'Saint-Clair — observations prolongées';
  const targets: THREE.Object3D[] = [];
  const colliders = [{ x: 3.43, z: -7.65, rx: .14, rz: .73 }];
  const state = createObservationState();
  const materials = new Set<THREE.Material>(), geometries = new Set<THREE.BufferGeometry>(), textures = new Set<THREE.Texture>();
  let disposed = false, previousAgeStep = -1;
  function mat(parameters: THREE.MeshStandardMaterialParameters) { const m = new THREE.MeshStandardMaterial(parameters); materials.add(m); return m; }
  const brass = mat({color:0xb99b5f, metalness:.75, roughness:.33});
  const wood = mat({color:0x382c24, roughness:.64});
  const iron = mat({color:0x172726, roughness:.50, metalness:.45});
  function mesh(g: THREE.BufferGeometry, m: THREE.Material, parent: THREE.Object3D = root) { geometries.add(g); materials.add(m); const o = new THREE.Mesh(g,m); o.castShadow = true; o.receiveShadow = true; parent.add(o); return o; }
  function box(size: [number,number,number], position: [number,number,number], m: THREE.Material, parent: THREE.Object3D = root) { const o = mesh(new THREE.BoxGeometry(...size),m,parent);o.position.set(...position);return o; }
  function sphere(radius:number,position:[number,number,number],m:THREE.Material,parent:THREE.Object3D = root) {const o=mesh(new THREE.SphereGeometry(radius,16,12),m,parent);o.position.set(...position);return o;}
  function canvas(width=512,height=512) {const element=document.createElement('canvas');element.width=width;element.height=height;const context=element.getContext('2d');if(!context)throw new Error('Canvas 2D requis pour les repères de Saint-Clair.');return {element,context};}
  function map(element:HTMLCanvasElement) {const result=new THREE.CanvasTexture(element);result.colorSpace=THREE.SRGBColorSpace;textures.add(result);return result;}
  function label(text:string) {const c=canvas(512,128);c.context.fillStyle='#172726';c.context.fillRect(0,0,512,128);c.context.fillStyle='#decca2';c.context.font='24px sans-serif';c.context.textAlign='center';c.context.fillText(text,256,72);return map(c.element);}
  function plane(w:number,h:number,position:[number,number,number],texture:THREE.Texture,parent:THREE.Object3D) {const m=mat({map:texture,emissiveMap:texture,emissive:0xffffff,emissiveIntensity:.12,roughness:.78});const o=mesh(new THREE.PlaneGeometry(w,h),m,parent);o.position.set(...position);return o;}
  function tag(group:THREE.Object3D,id:string,label:string) {group.userData.inspect={id,label};targets.push(group);}
  function wall(side:number,z:number) {const g=new THREE.Group();g.position.set(side*3.62,0,z);g.rotation.y=-side*Math.PI/2;root.add(g);return g;}

  // Six distant points occupy the upper window pane, behind the existing glass.
  // Left/right four-point masks share two points and reconstruct the same six positions.
  const sky = new THREE.Group();sky.position.set(-3.475,2.54,-12.25);sky.rotation.y=Math.PI/2;root.add(sky);
  sky.name='G9 — constellation six points';
  const starMaterial=new THREE.MeshBasicMaterial({color:0xf5e8b8});materials.add(starMaterial);
  const stars=STAR_POSITIONS.map(([x,y],i)=>{const o=sphere(.025,[x,y,0],starMaterial,sky);o.name=`G9 — étoile ${i+1}`;o.castShadow=false;return o;});
  const starTarget=box([1.10,.68,.008],[0,.03,.018],new THREE.MeshBasicMaterial({visible:false}),sky);
  starTarget.castShadow=false;tag(sky,'stars','Fenêtre G9 — motif de six étoiles');
  const station=new THREE.Group();station.position.set(-1.95,.018,-12.25);station.rotation.x=-Math.PI/2;root.add(station);
  const stationMap=label('ICI · FACE À LA FENÊTRE');plane(.90,.225,[0,0,0],stationMap,station).castShadow=false;

  // An original sepia portrait: same identity, progressive hair, posture and eye changes.
  const portrait=wall(-1,-14.2);portrait.name='P9 — portrait du gardien';
  box([1.02,1.38,.07],[0,2.05,.055],wood,portrait);
  box([.95,1.31,.03],[0,2.05,.10],brass,portrait);
  const photoCanvas=canvas(512,640);const photoMap=map(photoCanvas.element);
  plane(.85,1.18,[0,2.05,.125],photoMap,portrait);
  plane(.85,.12,[0,1.31,.13],label('PORTRAIT · SERVICE 09'),portrait);
  tag(portrait,'aged-photo','Portrait P9 — gardien du service');
  function drawPortrait(age:number) {
    const c=photoCanvas.context;const y=age*12;
    c.fillStyle='#655d4b';c.fillRect(0,0,512,640);
    c.fillStyle='#a89b7f';c.fillRect(28,22,456,596);
    c.fillStyle='#343c38';c.beginPath();c.moveTo(72,620);c.quadraticCurveTo(75,430+age*20,256,420+age*26);c.quadraticCurveTo(439,430+age*20,440,620);c.closePath();c.fill();
    c.fillStyle='#c0a782';c.fillRect(221,375+y,70,110);
    c.beginPath();c.ellipse(256,286+y,106-age*6,148+age*5,0,0,Math.PI*2);c.fill();
    c.fillStyle=age>.50?'#d0c7b2':age>.20?'#8f8a7a':'#49463c';
    c.beginPath();c.ellipse(256,175+y,108,53-age*19,0,Math.PI,Math.PI*2);c.lineTo(359,236);c.lineTo(338,206+age*8);c.quadraticCurveTo(254,142+age*10,169,210);c.lineTo(149,244);c.closePath();c.fill();
    for(const x of [152,349]){c.beginPath();c.ellipse(x,262+y,17,69,0,0,Math.PI*2);c.fill();}
    c.fillStyle='#e3d7bd';for(const x of [215,296]){c.beginPath();c.ellipse(x,284+y,23,11-age*3,0,0,Math.PI*2);c.fill();}
    c.fillStyle='#3d433a';for(const x of [218,293]){c.beginPath();c.arc(x,284+y,6,0,Math.PI*2);c.fill();}
    c.strokeStyle='#78684f';c.lineWidth=5;c.beginPath();c.moveTo(256,286+y);c.lineTo(246,338+y);c.lineTo(268,340+y);c.stroke();
    c.strokeStyle='#735742';c.lineWidth=4;c.beginPath();c.moveTo(224,376+y);c.quadraticCurveTo(256,385+age*8+y,287,376+y);c.stroke();
    c.globalAlpha=age*.82;c.strokeStyle='#786b53';c.lineWidth=2.7;
    for(let i=0;i<3;i++){c.beginPath();c.moveTo(198,232+i*11+y);c.quadraticCurveTo(255,223+i*11+y,310,232+i*11+y);c.stroke();}
    for(const side of [-1,1])for(let i=0;i<3;i++){c.beginPath();c.moveTo(256+side*67,284+y);c.lineTo(256+side*(85+i*4),281+i*9+y);c.stroke();}
    for(const side of [-1,1]){c.beginPath();c.moveTo(256+side*21,344+y);c.quadraticCurveTo(256+side*50,358+y,256+side*45,398+y);c.stroke();}
    c.globalAlpha=1;photoMap.needsUpdate=true;
    portrait.userData.age=age;
  }

  // A shallow landing and real horizontal railing stay identical for every observer.
  // Shadow artwork is independent of the shadow-map quality, including low graphics.
  const landing=wall(1,-7.65);landing.name='Palier de service — rampe et applique';
  box([1.45,.055,.38],[0,.027,.18],mat({color:0x8a8c7b,roughness:.8}),landing);
  box([1.28,.045,.045],[0,1.10,.20],iron,landing);
  for(let i=0;i<6;i++)box([.035,.92,.035],[-.57+i*.228,.62,.20],iron,landing);
  box([.19,.31,.12],[0,2.76,.15],brass,landing);
  box([.13,.21,.13],[0,2.76,.23],mat({color:0xffe1a1,emissive:0xffcb78,emissiveIntensity:1.4}),landing);
  function shadowMap(stairs:boolean) {const c=canvas(512,512);c.context.clearRect(0,0,512,512);c.context.fillStyle='rgba(7,19,19,.65)';
    if(stairs){for(let i=0;i<6;i++)c.context.fillRect(50+i*66,420-i*48,70,28+i*48);}
    else {c.context.fillRect(38,160,434,17);for(let i=0;i<6;i++)c.context.fillRect(50+i*78,170,12,255);}
    return map(c.element);
  }
  const normalShadow=shadowMap(false),impossibleShadow=shadowMap(true);
  const shadowMaterial=new THREE.MeshBasicMaterial({map:normalShadow,transparent:true,depthWrite:false});materials.add(shadowMaterial);
  const projection=mesh(new THREE.PlaneGeometry(1.43,1.32),shadowMaterial,landing);projection.position.set(0,1.85,.084);projection.castShadow=false;projection.name='Palier — projection';
  tag(landing,'landing','Palier — ombre de la rampe');

  // Slow inverted figure with actual rigid limb joints, never a pursuit collider.
  const walker=new THREE.Group();walker.name='Plafond — marcheur inversé';root.add(walker);
  const ink=mat({color:0x091516,roughness:.96});
  const hips=new THREE.Group();hips.position.y=.84;walker.add(hips);
  box([.40,.60,.22],[0,.32,0],ink,hips);sphere(.145,[0,.79,0],ink,hips);
  const shoulders:THREE.Group[]=[],legs:THREE.Group[]=[];
  for(const side of [-1,1]){
    const arm=new THREE.Group();arm.position.set(side*.26,.55,0);hips.add(arm);shoulders.push(arm);box([.09,.57,.10],[0,-.25,0],ink,arm);
    const leg=new THREE.Group();leg.position.set(side*.12,0,0);hips.add(leg);legs.push(leg);box([.13,.72,.14],[0,-.36,0],ink,leg);box([.15,.10,.24],[0,-.76,-.045],ink,leg);
  }
  walker.rotation.z=Math.PI;walker.position.set(-.60,3.45,-6.9);tag(walker,'ceiling','Silhouette au plafond — seconde travée');
  function apply() {
    const value=state.snapshot();
    stars.forEach((star,i)=>{star.visible=value.starIndices.includes(i);});
    const ageStep=Math.round(value.photoAge*32);
    if(ageStep!==previousAgeStep){previousAgeStep=ageStep;drawPortrait(ageStep/32);}
    shadowMaterial.map=value.stairShadow?impossibleShadow:normalShadow;
    walker.visible=value.walkerVisible;
    const angle=value.walkerTime*.18;
    walker.position.z=-6.9+2.3*Math.cos(angle);walker.rotation.y=Math.atan2(-Math.sin(angle),.16);
    const stride=Math.sin(value.walkerTime*2.1)*.28;
    legs.forEach((leg,i)=>{leg.rotation.x=i?stride:-stride;});
    shoulders.forEach((arm,i)=>{arm.rotation.x=i?-stride:stride;});
  }
  function setView(view:ObservationView) {if(disposed)return;root.visible=(view.levelId??'hotel')==='hotel';state.setView(view);apply();}
  function update(dt:number,pose:ObservationPose,active=true) {if(disposed)return;state.update(dt,pose,active);apply();}
  function getReading(id?:string):InspectionReading|null {
    if(disposed||!root.visible)return null;
    const value=state.snapshot();
    if(id==='stars'){const positions=['GAUCHE HAUT','CENTRE HAUT','DROITE HAUT','GAUCHE BAS','CENTRE BAS','DROITE BAS'];return {title:'Fenêtre G9',location:'Depuis le repère ICI, face à la fenêtre',lines:[`${value.starIndices.length} POINTS LUMINEUX`,...value.starIndices.map(i=>positions[i])]};}
    if(id==='aged-photo')return {title:'Portrait du service',location:'Cadre P9, au-delà de la fenêtre',lines:value.photoAge<.02?['CHEVEUX SOMBRES','REGARD OUVERT','POSTURE DROITE']:value.photoAge<.65?['CHEVEUX EN COURS DE GRISONNEMENT','RIDES AU FRONT ET AUX YEUX','ÉPAULES LÉGÈREMENT AFFAISSÉES']:['CHEVEUX BLANCS','RIDES MARQUÉES','POSTURE VOÛTÉE']};
    if(id==='landing')return {title:'Palier de service',location:'Sous l’applique du mur droit',lines:['RAMPE RÉELLE : BARRE HORIZONTALE ET SIX MONTANTS',value.stairShadow?'PROJECTION : SIX MARCHES ASCENDANTES':'PROJECTION : BARRE ET MONTANTS']};
    return null;
  }
  setView({phase:'reference',loop:0,levelId:'hotel'});
  return {root,targets,colliders,setView,update,getReading,dispose(){if(disposed)return;disposed=true;geometries.forEach(g=>g.dispose());materials.forEach(m=>m.dispose());textures.forEach(t=>t.dispose());root.clear();}};
}
