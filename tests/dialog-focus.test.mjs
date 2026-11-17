import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {stripTypeScriptTypes} from 'node:module';
const data=text=>'data:text/javascript;base64,'+Buffer.from(stripTypeScriptTypes(text)).toString('base64');
const pad=data(readFileSync(new URL('../src/game/gamepad-menu.ts',import.meta.url),'utf8'));
const source=readFileSync(new URL('../src/game/dialog-focus.ts',import.meta.url),'utf8').replace("'./gamepad-menu'",JSON.stringify(pad));
const {containDialog,topDialog,DialogOpener}=await import(data(source));
function fixture(){
 const previous={HTMLElement:globalThis.HTMLElement,MutationObserver:globalThis.MutationObserver};
 const listeners=new Map();let observed,observerClosed=false;
 const doc={activeElement:null,defaultView:{getComputedStyle:e=>({visibility:e.visibility??'visible'})},addEventListener(k,f){if(!listeners.has(k))listeners.set(k,new Set());listeners.get(k).add(f);},removeEventListener(k,f){listeners.get(k)?.delete(f);}};
 class Element{
  attrs=new Map();children=[];parentElement=null;isConnected=true;hidden=false;tagName='BUTTON';ownerDocument=doc;scrolls=0;
  constructor(name,tag='BUTTON'){this.name=name;this.tagName=tag;}
  get tabIndex(){return this.attrs.has('tabindex')?Number(this.attrs.get('tabindex')):(this.tagName==='SECTION'?-1:0);}
  setAttribute(k,v){this.attrs.set(k,v);}getAttribute(k){return this.attrs.get(k)??null;}hasAttribute(k){return this.attrs.has(k);}removeAttribute(k){this.attrs.delete(k);}
  add(e){e.parentElement=this;this.children.push(e);return e;}
  contains(e){return this===e||this.children.some(c=>c.contains(e));}
  closest(s){for(let e=this;e;e=e.parentElement)if(e.hidden||e.hasAttribute('inert')||e.getAttribute('aria-hidden')==='true')return e;return null;}
  getClientRects(){return this.hidden?[]:[{}];}matches(s){return s===':disabled'&&this.hasAttribute('disabled');}
  querySelectorAll(){return this.children.flatMap(c=>[c,...c.querySelectorAll()]).filter(c=>['BUTTON','SUMMARY','INPUT','SELECT','TEXTAREA','A'].includes(c.tagName)||c.hasAttribute('tabindex'));}
  focus(){if(!this.isConnected||this.closest(''))return;doc.activeElement=this;for(const f of listeners.get('focusin')??[])f();}
  scrollIntoView(){this.scrolls++;}
 }
 globalThis.HTMLElement=Element;globalThis.MutationObserver=class{constructor(f){observed=f;}observe(){}disconnect(){observerClosed=true;}};
 const root=new Element('root','MAIN'),behind=root.add(new Element('behind','SECTION')),opener=behind.add(new Element('opener'));
 const backdrop=root.add(new Element('backdrop','SECTION')),panel=backdrop.add(new Element('panel','SECTION'));
 const a=panel.add(new Element('a')),b=panel.add(new Element('b'));opener.focus();
 let escapes=0;const mount=(restore)=>containDialog(panel,root,()=>escapes++,restore);
 const key=(name,extra={})=>{const e={key:name,defaultPrevented:false,stopped:false,preventDefault(){this.defaultPrevented=true;},stopPropagation(){this.stopped=true;},...extra};for(const f of listeners.get('keydown')??[])f(e);return e;};
 return {root,behind,backdrop,panel,a,b,opener,Element,doc,mount,key,changed:()=>observed(),get escapes(){return escapes;},get observerClosed(){return observerClosed;},restore(){Object.assign(globalThis,previous);}};
}
function check(fn){const f=fixture();let close;try{close=f.mount();fn(f,()=>{close();close=null;});}finally{close?.();f.restore();}}
test('dialog isolates outside controls without changing its own ancestor chain',()=>check(f=>{assert.ok(f.behind.hasAttribute('inert'));assert.ok(!f.backdrop.hasAttribute('inert'));assert.equal(f.doc.activeElement,f.a);f.opener.focus();assert.equal(f.doc.activeElement,f.a);}));
test('forward and reverse Tab wrap in visible controls',()=>check(f=>{f.b.focus();const e=f.key('Tab');assert.equal(f.doc.activeElement,f.a);assert.ok(e.defaultPrevented&&e.stopped);f.key('Tab',{shiftKey:true});assert.equal(f.doc.activeElement,f.b);}));
test('hidden, disabled, negative-index and invisible controls cannot take keyboard focus',()=>check(f=>{f.b.setAttribute('disabled','');const extra=f.panel.add(new f.Element('extra'));extra.setAttribute('tabindex','-1');f.key('Tab');assert.equal(f.doc.activeElement,f.a);f.b.removeAttribute('disabled');f.b.visibility='hidden';f.key('Tab');assert.equal(f.doc.activeElement,f.a);}));
test('Escape is consumed once and repeated/composing/modified gestures do not close another layer',()=>check(f=>{assert.ok(f.key('Escape').stopped);assert.equal(f.escapes,1);assert.ok(f.key('Escape',{repeat:true}).stopped);for(const state of [{ctrlKey:true},{altKey:true},{metaKey:true},{isComposing:true},{defaultPrevented:true}])f.key('Escape',state);assert.equal(f.escapes,1);}));
test('closing restores exact inert attributes and returns focus to the original opener',()=>{
 const f=fixture();f.behind.setAttribute('inert','existing');const other=f.root.add(new f.Element('other'));try{const close=f.mount();close();close();assert.equal(f.behind.getAttribute('inert'),'existing');assert.ok(!other.hasAttribute('inert'));assert.ok(f.observerClosed);assert.ok(!f.panel.hasAttribute('tabindex'));}finally{f.restore();}
});
test('normal closing returns focus and removes listeners',()=>check((f,close)=>{close();assert.equal(f.doc.activeElement,f.opener);const event=f.key('Escape');assert.equal(f.escapes,0);assert.equal(event.stopped,false);}));
test('removing every button gives the panel a fallback focus target',()=>check(f=>{f.a.hidden=true;f.b.hidden=true;f.changed();assert.equal(f.doc.activeElement,f.panel);f.key('Tab');assert.equal(f.doc.activeElement,f.panel);}));
test('detached openers are not focused on teardown',()=>check((f,close)=>{f.opener.isConnected=false;close();assert.notEqual(f.doc.activeElement,f.opener);}));
test('a replaced focused control repairs focus without waiting for another key',()=>check(f=>{f.b.focus();f.b.setAttribute('disabled','');f.changed();assert.equal(f.doc.activeElement,f.a);}));
test('a closed disclosure exposes its summary, not hidden inner controls',()=>check(f=>{
 const details=f.panel.add(new f.Element('details','DETAILS'));const summary=details.add(new f.Element('summary','SUMMARY'));details.add(new f.Element('inside'));f.b.focus();f.key('Tab');assert.equal(f.doc.activeElement,summary);f.key('Tab');assert.equal(f.doc.activeElement,f.a);
}));
test('graphics fault takes priority over virtual keyboard, then the ordinary modal',()=>{
 const entries=new Map();const root={querySelector:s=>entries.get(s)??null};const node=()=>({getClientRects:()=>[{}],hidden:false});
 entries.set('.modal-panel',node());assert.equal(topDialog(root),entries.get('.modal-panel'));entries.set('.pad-keyboard',node());assert.equal(topDialog(root),entries.get('.pad-keyboard'));entries.set('.graphics-error',node());assert.equal(topDialog(root),entries.get('.graphics-error'));entries.get('.graphics-error').hidden=true;assert.equal(topDialog(root),entries.get('.pad-keyboard'));
});

test('parent dialog remembers its opener across a nested containment suspension',()=>{
 const f=fixture(),origin=new DialogOpener();let close;
 try{
  close=containDialog(f.panel,f.root,()=>{},origin.remember(f.panel,'coop',f.doc.activeElement));
  f.b.focus();close();close=null;
  // The child closes and returns to the edited field before the parent remounts.
  f.b.focus();
  close=containDialog(f.panel,f.root,()=>{},origin.remember(f.panel,'coop',f.doc.activeElement));
  close();close=null;assert.equal(f.doc.activeElement,f.opener);
 }finally{close?.();f.restore();}
});
test('a different dialog, scope or fresh visit receives a new opener',()=>{
 const f=fixture(),origin=new DialogOpener();
 try{
  assert.equal(origin.remember(f.panel,'coop',f.opener),f.opener);
  assert.equal(origin.remember(f.panel,'settings',f.a),f.a);
  assert.equal(origin.remember(f.behind,'settings',f.b),f.b);
  origin.clear();assert.equal(origin.remember(f.behind,'settings',f.opener),f.opener);
 }finally{f.restore();}
});
