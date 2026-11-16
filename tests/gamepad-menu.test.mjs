import assert from 'node:assert/strict';
import test from 'node:test';
import fs from 'node:fs';
import {stripTypeScriptTypes} from 'node:module';
const source=fs.readFileSync(new URL('../src/game/gamepad-menu.ts',import.meta.url),'utf8');
const {MenuPadGate,GameplayPadGate,selectMenuPad,stepValue,navigateMenu,setControlValue,menuElements}=await import('data:text/javascript;base64,'+Buffer.from(stripTypeScriptTypes(source)).toString('base64'));
const pad=(pressed=[],axes=[0,0,0,0],extra={})=>({id:'standard-pad',index:1,connected:true,mapping:'standard',buttons:Array.from({length:17},(_,i)=>({pressed:pressed.includes(i)})),axes,...extra});
const menu=()=>{const gate=new MenuPadGate();gate.update(pad(),'menu',true,0);return gate;};
test('a standard controller may occupy any slot; unknown mappings are not guessed',()=>{assert.equal(selectMenuPad([null,pad([],[0,0],{mapping:''}),pad()]).index,1);assert.equal(selectMenuPad([null,pad([],[0,0],{mapping:''})]),null);});
test('held A at entry does not accept a screen before release',()=>{const g=new MenuPadGate();assert.deepEqual(g.update(pad([0]),'menu',true,0),[]);assert.deepEqual(g.update(pad([0]),'menu',true,500),[]);g.update(pad(),'menu',true,600);assert.deepEqual(g.update(pad([0]),'menu',true,700),['activate']);assert.deepEqual(g.update(pad([0]),'menu',true,1200),[]);});
test('back takes priority over simultaneous confirmation',()=>{assert.deepEqual(menu().update(pad([0,1]),'menu',true,20),['back']);});
test('menu transitions require release and prevent accepting the next dialog',()=>{const g=menu();g.update(pad([0]),'menu',true,10);assert.deepEqual(g.update(pad([0]),'confirm',true,20),[]);g.update(pad(),'confirm',true,30);assert.deepEqual(g.update(pad([0]),'confirm',true,40),['activate']);});
test('direction repeat is bounded and never catches up after a stall',()=>{const g=menu();assert.deepEqual(g.update(pad([13]),'menu',true,10),['next']);assert.deepEqual(g.update(pad([13]),'menu',true,400),[]);assert.deepEqual(g.update(pad([13]),'menu',true,431),['next']);assert.deepEqual(g.update(pad([13]),'menu',true,99999),['next']);});
test('drift is ignored; deliberate analog direction is supported',()=>{const g=menu();assert.deepEqual(g.update(pad([],[.3,.3]),'menu',true,20),[]);assert.deepEqual(g.update(pad([],[-.9,0]),'menu',true,40),['left']);assert.deepEqual(g.update(pad([],[0,-.9]),'menu',true,50),['previous']);});
test('focus loss, controller replacement and disconnect all disarm the menu',()=>{for(const mode of ['focus','replace','disconnect']){const g=menu();g.update(pad([0]),'menu',true,10);if(mode==='focus')g.update(pad(),'menu',false,20);if(mode==='disconnect')g.update(null,'menu',true,20);assert.deepEqual(g.update(pad([0],[],mode==='replace'?{id:'other'}:{}),'menu',true,30),[]);}});
test('non-finite clock or axis values cannot create menu directions',()=>{const g=menu();assert.deepEqual(g.update(pad([],[NaN,Infinity]),'menu',true,10),[]);assert.deepEqual(g.update(pad([0]),'menu',true,NaN),[]);});
test('gameplay stick must return to neutral after pause, focus or session transition',()=>{const g=new GameplayPadGate();assert.equal(g.accept(pad([],[1,0,0,0]),'one',true),false);assert.equal(g.accept(pad(),'one',true),false);assert.equal(g.accept(pad([],[1,0,0,0]),'one',true),true);g.accept(pad(),'one',false);assert.equal(g.accept(pad([],[1,0,0,0]),'one',true),false);g.accept(pad(),'one',true);assert.equal(g.accept(pad([0]),'two',true),false);});
test('slider stepping rounds decimal precision and respects both boundaries',()=>{assert.equal(stepValue(.3,0,1,.1,1),.4);assert.equal(stepValue(1,0,1,.1,1),1);assert.equal(stepValue(50,50,95,1,-1),50);assert.equal(stepValue(3,0,5,NaN,1),3);});
function dom(){const old=globalThis.document;globalThis.document={activeElement:null};let actions=[];const element=(name,kind='button',visible=true)=>({name,kind,getClientRects:()=>visible?[{}]:[],closest:()=>null,getAttribute:()=>null,focus(){document.activeElement=this;actions.push('focus:'+name);},click(){actions.push('click:'+name);},matches(s){return kind==='text'?s.startsWith('input:not'):false;},scrollIntoView(){}});const one=element('one'),two=element('two'),hidden=element('hidden','button',false),text=element('name','text');const root={querySelectorAll:()=>[one,hidden,two,text]};return {root,one,two,text,actions,restore(){globalThis.document=old;}};}
test('focus traverses only visible controls and wraps inside the current root',()=>{const d=dom();try{navigateMenu(d.root,'next',{back(){},edit(){}});assert.equal(document.activeElement,d.one);navigateMenu(d.root,'previous',{back(){},edit(){}});assert.equal(document.activeElement,d.text);assert.equal(menuElements(d.root).length,3);}finally{d.restore();}});
test('activation uses authored button handler, editing uses keyboard hook, back never clicks',()=>{const d=dom();try{const calls=[];const hooks={back:()=>calls.push('back'),edit:n=>calls.push(n.name)};d.one.focus();navigateMenu(d.root,'activate',hooks);assert.ok(d.actions.includes('click:one'));d.text.focus();navigateMenu(d.root,'activate',hooks);navigateMenu(d.root,'back',hooks);assert.deepEqual(calls,['name','back']);}finally{d.restore();}});
test('setting a controlled field uses its native setter and the correct input event',()=>{class Field{set value(v){this.stored=v;}get value(){return this.stored;}dispatchEvent(e){this.event=e;}}const f=new Field();f.tagName='INPUT';setControlValue(f,'Équipe 09');assert.equal(f.stored,'Équipe 09');assert.equal(f.event.type,'input');assert.equal(f.event.bubbles,true);f.tagName='SELECT';setControlValue(f,'high');assert.equal(f.event.type,'change');});


test('select navigation skips disabled options, clamps boundaries and dispatches change',()=>{
  const previous=globalThis.document;
  class Select{
    tagName='SELECT';stored='low';events=[];
    options=[{value:'low',disabled:false},{value:'unused',disabled:true},{value:'high',disabled:false}];
    get value(){return this.stored;}set value(v){this.stored=v;}
    matches(s){return s==='input[type="range"],select';}
    getClientRects(){return [{}];}closest(){return null;}getAttribute(){return null;}
    dispatchEvent(e){this.events.push(e.type);}
  }
  const select=new Select(),root={querySelectorAll:()=>[select]};
  globalThis.document={activeElement:select};
  try{
    const hooks={back(){throw new Error('unexpected back');},edit(){throw new Error('unexpected edit');}};
    navigateMenu(root,'right',hooks);assert.equal(select.value,'high');
    navigateMenu(root,'right',hooks);assert.equal(select.value,'high');
    navigateMenu(root,'left',hooks);assert.equal(select.value,'low');
    assert.deepEqual(select.events,['change','change','change']);
    select.options=[];navigateMenu(root,'right',hooks);assert.equal(select.value,'low');
  }finally{globalThis.document=previous;}
});
