import * as THREE from 'three';
import { createSpokenState, SPOKEN_ANCHORS } from './spoken-state';
import type { AcousticPose } from './acoustic-state';
import type { PropEvent, TemporalView } from './temporal-state';
/** Receiver and ventilation are physical NORMAL props, present with or without effects. */
export function createSpokenWorld(){
 const root=new THREE.Group();root.name='Saint-Clair — poste de contrôle vocal';
 const state=createSpokenState(),targets:THREE.Object3D[]=[],geometries=new Set<THREE.BufferGeometry>(),materials=new Set<THREE.Material>(),textures=new Set<THREE.Texture>();let disposed=false;
 const mat=(c:number,metal=.2)=>{const m=new THREE.MeshStandardMaterial({color:c,metalness:metal,roughness:.5});materials.add(m);return m;};
 const enamel=mat(0x284741),brass=mat(0xb9a373,.8),dark=mat(0x0a1514),red=mat(0xcfa95a);
 const lampMaterial=new THREE.MeshStandardMaterial({color:0xffd89b,emissive:0xffcc88,emissiveIntensity:1});materials.add(lampMaterial);
 function mesh(g:THREE.BufferGeometry,m:THREE.Material,p:THREE.Object3D,x=0,y=0,z=0){geometries.add(g);materials.add(m);const o=new THREE.Mesh(g,m);o.position.set(x,y,z);o.castShadow=true;o.receiveShadow=true;p.add(o);return o;}
 const radio=new THREE.Group();radio.position.set(...SPOKEN_ANCHORS.radio);radio.rotation.y=Math.PI/2;radio.name='Poste R9 — récepteur de service';radio.userData.inspect={id:'service-radio',label:'Poste R9 — E tester le relais'};root.add(radio);targets.push(radio);
 mesh(new THREE.BoxGeometry(.68,.42,.24),enamel,radio,0,0,0);
 mesh(new THREE.BoxGeometry(.76,.045,.32),brass,radio,0,-.24,0);
 for(let i=0;i<7;i++)mesh(new THREE.BoxGeometry(.26,.013,.015),dark,radio,-.16,-.12+i*.04,.126);
 const button=mesh(new THREE.CylinderGeometry(.045,.045,.04,20),brass,radio,.23,-.10,.15);button.rotation.x=Math.PI/2;
 mesh(new THREE.BoxGeometry(.20,.08,.015),red,radio,.20,.10,.13);
 mesh(new THREE.CylinderGeometry(.015,.018,.50,12),brass,radio,-.26,.45,-.06);
 const lamp=mesh(new THREE.SphereGeometry(.06,16,12),lampMaterial,radio,.23,.34,.03);lamp.name='Poste R9 — voyant du relais';
 function label(p:THREE.Object3D,text:string,w:number,y:number,z:number){const c=document.createElement('canvas');c.width=512;c.height=128;const ctx=c.getContext('2d')!;ctx.fillStyle='#122923';ctx.fillRect(0,0,512,128);ctx.fillStyle='#e7d6a9';ctx.font='22px sans-serif';ctx.textAlign='center';ctx.fillText(text,256,72,490);const t=new THREE.CanvasTexture(c);t.colorSpace=THREE.SRGBColorSpace;textures.add(t);const m=new THREE.MeshStandardMaterial({map:t,roughness:.8});const o=mesh(new THREE.PlaneGeometry(w,.10),m,p,0,y,z);o.castShadow=false;}
 label(radio,'R9 · E : TEST RELAIS',.68,-.32,.13);
 const vent=new THREE.Group();vent.position.set(...SPOKEN_ANCHORS.vent);vent.rotation.y=-Math.PI/2;vent.name='Conduit V9 — bouche d’aération';vent.userData.inspect={id:'vent',label:'Conduit V9 — écoute à deux mètres'};root.add(vent);targets.push(vent);
 mesh(new THREE.BoxGeometry(.60,.40,.07),brass,vent);mesh(new THREE.BoxGeometry(.52,.33,.08),dark,vent,0,0,.01);
 for(let i=0;i<6;i++)mesh(new THREE.BoxGeometry(.53,.024,.06),enamel,vent,0,-.14+i*.055,.07);
 label(vent,'V9 · AIR DE SERVICE',.57,-.27,.065);
 function apply(){lampMaterial.emissiveIntensity=state.snapshot().lampLit?1:0;lampMaterial.color.setHex(state.snapshot().lampLit?0xffd89b:0x423a25);}
 return {root,targets,setView(v:TemporalView){if(disposed)return;root.visible=(v.levelId??'hotel')==='hotel';state.setView(v);apply();},setIdentity:state.setIdentity,
 update(dt:number,pose:AcousticPose,active:boolean,frame:{now:number;events:readonly PropEvent[]}){if(disposed)return;state.update(dt,pose,active,frame);apply();},snapshot:state.snapshot,stop:state.stop,
 dispose(){if(disposed)return;disposed=true;geometries.forEach(g=>g.dispose());materials.forEach(m=>m.dispose());textures.forEach(t=>t.dispose());root.clear();}};
}
