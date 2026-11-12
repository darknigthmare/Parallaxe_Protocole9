import * as THREE from 'three';
import type { InspectorModel } from './avatar';
import type { InspectionReading } from './inspection-data';
import { createBodyShadow } from './body-shadow';
import { atShadowStation,createShadowState,SHADOW_STATION,type ShadowActor,type ShadowView } from './shadow-state';

/** C9 is a fixed calibration station, identical in reference and every private view. */
export function createShadowWorld(){
  const root=new THREE.Group();root.name='C9 — observation des ombres';
  const models=new Map<string,ReturnType<typeof createBodyShadow>>();
  const state=createShadowState();let hotel=true,disposed=false,reading:InspectionReading|null=null;
  const geometries=new Set<THREE.BufferGeometry>(),materials=new Set<THREE.Material>(),textures=new Set<THREE.Texture>();
  function mesh(g:THREE.BufferGeometry,m:THREE.Material){geometries.add(g);materials.add(m);const o=new THREE.Mesh(g,m);root.add(o);return o;}
  // Painted L corners, no raised collision/obstacle. Same mark for all witnesses.
  const paint=new THREE.MeshBasicMaterial({color:0x9e9474});
  for(const side of [-1,1])for(const end of [-1,1]){
    const a=mesh(new THREE.PlaneGeometry(.42,.025),paint);a.rotation.x=-Math.PI/2;a.position.set(side*1.9,.013,SHADOW_STATION.z+end*1.3);
    const b=mesh(new THREE.PlaneGeometry(.025,.36),paint);b.rotation.x=-Math.PI/2;b.position.set(side*2.1,.013,SHADOW_STATION.z+end*1.13);
  }
  const canvas=document.createElement('canvas');canvas.width=1024;canvas.height=256;const c=canvas.getContext('2d')!;
  c.fillStyle='#18302e';c.fillRect(0,0,1024,256);c.fillStyle='#e3d8b8';c.textAlign='center';
  c.font='bold 52px sans-serif';c.fillText('C9 · OBSERVATION DES OMBRES',512,76);
  c.font='32px sans-serif';c.fillText('Tous au repère · Bras au repos · Regardez le sol',512,143);
  c.font='27px sans-serif';c.fillText('En solo : le support T1 sert de témoin, pas un joueur.',512,207);
  const map=new THREE.CanvasTexture(canvas);map.colorSpace=THREE.SRGBColorSpace;textures.add(map);
  const plaque=mesh(new THREE.PlaneGeometry(2.7,.675),new THREE.MeshStandardMaterial({map,roughness:.85}));
  plaque.position.set(0,.014,SHADOW_STATION.z+1.75);plaque.rotation.x=-Math.PI/2;
  plaque.name='C9 — repère central';plaque.userData.inspect={id:'body-shadow',label:'C9 — projection de votre corps'};
  // Luminaire aligned with the parallel projection rays; no added shadow-map pass.
  const fixture=mesh(new THREE.BoxGeometry(1.1,.06,.20),new THREE.MeshStandardMaterial({color:0xc9c0a1,emissive:0xffe9b7,emissiveIntensity:.45}));
  fixture.position.set(-.61,3.35,SHADOW_STATION.z+2.85);
  const light=new THREE.DirectionalLight(0xffe6b0,.55);light.position.copy(fixture.position);
  light.target.position.set(0,0,SHADOW_STATION.z);root.add(light,light.target);
  function setView(view:ShadowView){hotel=(view.levelId??'hotel')==='hotel';root.visible=hotel;state.setView(view);reading=null;
    // Restore source casting/contact immediately on change, before next frame.
    for(const model of models.values())model.update(null,false);
  }
  function update(dt:number,selfId:string,actors:readonly ShadowActor[],inspectors:readonly InspectorModel[],active=true,shared=false,fresh=true){
    if(disposed)return;
    state.update(dt,selfId,actors,active,shared,fresh);const frame=state.snapshot();
    const valid=inspectors.slice(0,4);const ids=new Set(valid.map(m=>m.identity.id));
    for(const [id,model]of models)if(!ids.has(id)){model.dispose();models.delete(id);}
    for(const inspector of valid){
      const id=inspector.identity.id;let model=models.get(id);
      if(model&&model.source!==inspector){model.dispose();models.delete(id);model=undefined;}
      const visible=hotel&&active&&atShadowStation({x:inspector.root.position.x,z:inspector.root.position.z});
      if(!model&&visible){model=createBodyShadow(inspector);models.set(id,model);root.add(model.root);}
      model?.update(id===selfId&&frame.pointing?frame.target:null,visible);
    }
    const self=models.get(selfId);const bounds=frame.reason;
    const instructions=bounds==='synchronizing'?'POSITIONS EN ATTENTE — AUCUNE OBSERVATION FIABLE':bounds==='gather'?'RÉUNISSEZ LES INSPECTEURS DANS LES QUATRE ANGLES C9':bounds==='partner-required'?'ATTENDEZ UN PARTENAIRE AU REPÈRE':'IMMOBILISEZ CORPS ET BRAS UN INSTANT';
    const lines=frame.ready&&self?['CORPS : BRAS AU REPOS',frame.pointing?'PROJECTION : BRAS DROIT ÉTENDU':'PROJECTION : BRAS AU REPOS',shared?'COMPAREZ LES PROJECTIONS AU MÊME REPÈRE':'ENTRAÎNEMENT : SUPPORT T1 DU MIROIR']:[instructions];
    reading=active&&hotel?{title:'Observation C9',location:'Repère central au sol',lines}:null;
  }
  function interrupt(){state.interrupt();reading=null;for(const model of models.values())model.update(null,false);}
  function reflectionMask(){
    const before=[...models.values()].map(model=>({model,visible:model.root.visible}));
    for(const {model}of before)model.root.visible=model.root.visible&&model.source.root.visible;
    return()=>{for(const {model,visible}of before)model.root.visible=visible;};
  }
  return{root,reflectionMask,release(id:string){models.get(id)?.dispose();models.delete(id);},targets:[plaque],setView,update,interrupt,snapshot:state.snapshot,getReading(id?:string){return id==='body-shadow'?reading:null;},dispose(){if(disposed)return;disposed=true;for(const model of models.values())model.dispose();models.clear();root.removeFromParent();root.clear();geometries.forEach(g=>g.dispose());materials.forEach(m=>m.dispose());textures.forEach(t=>t.dispose());}};
}
