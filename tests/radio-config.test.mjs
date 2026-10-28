import assert from 'node:assert/strict';
import test from 'node:test';
import {readFile} from 'node:fs/promises';
import {stripTypeScriptTypes} from 'node:module';
import {createHmac} from 'node:crypto';
import {spawnSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';
const source=await readFile(new URL('../src/game/radio-config.ts',import.meta.url),'utf8');
const compiled=stripTypeScriptTypes(source);
const {normalizeIceUrl,analyzeRadioSettings,makeRadioConfig,RADIO_CREDENTIAL_TTL}=await import(`data:text/javascript;base64,${Buffer.from(compiled).toString('base64')}`);
const now=1793160000123,secret='test-only-shared-secret-not-for-production-42';
const turnSettings={PARALLAXE_TURN_URLS:'turn:relay.example:3478?transport=udp,turns:relay.example:5349?transport=tcp',PARALLAXE_TURN_SECRET:secret};

for(const [input,kind,expected] of [
  ['stun:relay.example','stun','stun:relay.example'],
  [' STUN:RELAY.EXAMPLE:03478 ','stun','stun:relay.example:3478'],
  ['stuns:relay.example:5349','stun','stuns:relay.example:5349'],
  ['turn:192.0.2.1:3478?transport=udp','turn','turn:192.0.2.1:3478?transport=udp'],
  ['turns:relay.example:443?transport=tcp','turn','turns:relay.example:443?transport=tcp'],
  ['TURN:RELAY.EXAMPLE?TRANSPORT=TCP','turn','turn:relay.example?transport=tcp'],
  ['stun:[2001:db8::1]:3478','stun','stun:[2001:db8::1]:3478'],
  ['turn:[::ffff:192.0.2.1]:3478','turn','turn:[::ffff:192.0.2.1]:3478'],
  ['turn:[1:2:3:4:5:6:7:8]','turn','turn:[1:2:3:4:5:6:7:8]'],
  ['stun:localhost','stun','stun:localhost'],
  ['stun:relay.example.','stun','stun:relay.example.'],
  ['turn:xn--exmple-cua.example:65535','turn','turn:xn--exmple-cua.example:65535'],
  ['turn:[::]','turn','turn:[::]'],
])test(`ICE accepts ${input}`,()=>assert.equal(normalizeIceUrl(input,kind),expected));

for(const input of [
  'turn://relay.example','turn:user:password@relay.example','turn:relay.example/path',
  'turn:relay.example#fragment','turn:relay.example?transport=sctp','turn:relay.example?foo=udp',
  'turn:relay.example?transport=udp&credential=private','turns:relay.example?transport=udp',
  'turn:relay.example:0','turn:relay.example:65536','turn:relay.example:-1','turn:relay.example:',
  'turn:999.1.2.3','turn:01.2.3.4','turn:1.2.3','turn:relay..example','turn:-relay.example',
  'turn:relay_.example','turn:relay.example\nprivate','turn:[2001:db8:::1]',
  'turn:[1:2:3:4:5:6:7]','turn:[1:2:3:4:5:6:7:8:9]','turn:[1:2:3:4:5:6:7:8::]',
  'turn:[::ffff:999.0.0.1]','turn:[192.0.2.1::]','turn:[fe80::1%25eth0]',
  'turn:2001:db8::1','turn:.','https://relay.example',`turn:${'a'.repeat(64)}.example`,
])test(`ICE rejects ${JSON.stringify(input)}`,()=>assert.equal(normalizeIceUrl(input,'turn'),null));

test('ICE rejects a transport parameter on STUN and a mismatched family',()=>{
  assert.equal(normalizeIceUrl('stun:relay.example?transport=udp','stun'),null);
  assert.equal(normalizeIceUrl('turn:relay.example','stun'),null);
  assert.equal(normalizeIceUrl('stun:relay.example','turn'),null);
  assert.equal(normalizeIceUrl(null,'turn'),null);
  assert.equal(normalizeIceUrl(`turn:${'a'.repeat(2050)}`,'turn'),null);
});
test('default STUN is retained; an explicit empty value disables it',async()=>{
  const normal=await makeRadioConfig({},'inspector',now);
  assert.deepEqual(normal.iceServers,[{urls:'stun:stun.l.google.com:19302'}]);
  assert.equal(normal.turnConfigured,false);
  const disabled=await makeRadioConfig({PARALLAXE_STUN_URLS:''},'inspector',now);
  assert.deepEqual(disabled.iceServers,[]);
  assert.ok(disabled.diagnostics.issues.includes('no-ice-servers'));
});
test('deduplication occurs before the limit; invalid entries cannot exhaust it',()=>{
  const result=analyzeRadioSettings({PARALLAXE_STUN_URLS:'invalid,STUN:A.EXAMPLE,stun:a.example,stun:b.example,stun:c.example,stun:d.example,stun:e.example'});
  assert.deepEqual(result.stun,['stun:a.example','stun:b.example','stun:c.example','stun:d.example']);
  assert.equal(result.diagnostics.invalidUrls,1);assert.equal(result.diagnostics.duplicateUrls,1);assert.equal(result.diagnostics.omittedUrls,1);
});
test('TURN and STUN have independent limits',()=>{
  const result=analyzeRadioSettings({...turnSettings,PARALLAXE_TURN_URLS:Array.from({length:7},(_,i)=>`turn:relay${i}.example`).join(',')});
  assert.equal(result.stun.length,1);assert.equal(result.turn.length,4);assert.equal(result.diagnostics.omittedUrls,3);
});
test('blank secrets never enable TURN',async()=>{
  for(const value of [undefined,'','   ','\n\t']){
    const result=await makeRadioConfig({...turnSettings,PARALLAXE_TURN_SECRET:value},'inspector',now);
    assert.equal(result.turnConfigured,false);assert.equal(result.iceServers.length,1);
    assert.ok(result.diagnostics.issues.includes('missing-turn-secret'));
  }
});
test('invalid URLs are omitted, not forwarded to the browser',async()=>{
  const result=await makeRadioConfig({...turnSettings,PARALLAXE_TURN_URLS:'turn://broken,turn:good.example'},'inspector',now);
  assert.deepEqual(result.iceServers.at(-1).urls,['turn:good.example']);
  assert.ok(result.diagnostics.issues.includes('invalid-turn-url'));
});
test('HMAC and reported expiry match TURN REST credentials exactly',async()=>{
  const result=await makeRadioConfig(turnSettings,'inspector_09',now);
  const server=result.iceServers.at(-1);
  assert.equal(server.username,`${Math.floor((now+RADIO_CREDENTIAL_TTL)/1000)}:inspector_09`);
  assert.equal(server.credential,createHmac('sha1',secret).update(server.username).digest('base64'));
  assert.equal(result.expiresAt,Number(server.username.split(':')[0])*1000);
  assert.ok(result.expiresAt>now);assert.ok(result.expiresAt<=now+RADIO_CREDENTIAL_TTL);
  assert.equal(JSON.stringify(result).includes(secret),false);
});
test('nonblank secret is not trimmed; short keys are flagged, not silently changed',async()=>{
  const key=' key with spaces ';
  const result=await makeRadioConfig({...turnSettings,PARALLAXE_TURN_SECRET:key},'inspector',now);
  const server=result.iceServers.at(-1);
  assert.equal(server.credential,createHmac('sha1',key).update(server.username).digest('base64'));
  assert.ok(result.diagnostics.issues.includes('weak-turn-secret'));
});
test('credentials are bound to the player and renewal time',async()=>{
  const a=await makeRadioConfig(turnSettings,'alpha',now),b=await makeRadioConfig(turnSettings,'beta',now),c=await makeRadioConfig(turnSettings,'alpha',now+60_000);
  assert.notEqual(a.iceServers.at(-1).credential,b.iceServers.at(-1).credential);
  assert.notEqual(a.iceServers.at(-1).credential,c.iceServers.at(-1).credential);
});
test('invalid identity and clock values fail without reflecting input',async()=>{
  for(const id of ['',':forged','a\nb','x'.repeat(129),null])await assert.rejects(makeRadioConfig(turnSettings,id,now),/Identité radio invalide/);
  for(const time of [NaN,Infinity,-1,1.25,Number.MAX_SAFE_INTEGER])await assert.rejects(makeRadioConfig(turnSettings,'alpha',time),/Horloge radio invalide/);
});
test('diagnostics never include a rejected URI or secret',()=>{
  const result=analyzeRadioSettings({PARALLAXE_STUN_URLS:'stun:private:password@invalid',PARALLAXE_TURN_URLS:'turn:private:password@invalid',PARALLAXE_TURN_SECRET:secret});
  const report=JSON.stringify(result);
  for(const value of ['password',secret,'private:'])assert.equal(report.includes(value),false);
  assert.ok(result.diagnostics.issues.includes('unused-turn-secret'));
});
test('runtime non-string configuration is diagnosed instead of throwing',()=>{
  const result=analyzeRadioSettings({PARALLAXE_STUN_URLS:23,PARALLAXE_TURN_URLS:[],PARALLAXE_TURN_SECRET:{}});
  assert.equal(result.turnConfigured,false);assert.equal(result.diagnostics.invalidUrls,2);
});
function check(args=[],env={}){
  const cleaned={...process.env};for(const key of Object.keys(cleaned))if(key.startsWith('PARALLAXE_'))delete cleaned[key];
  return spawnSync(process.execPath,[fileURLToPath(new URL('../scripts/check-radio-config.mjs',import.meta.url)),'--json',...args],{env:{...cleaned,...env},encoding:'utf8'});
}
test('preflight succeeds by default and explicitly disclaims connectivity',()=>{
  const result=check();assert.equal(result.status,0,result.stderr);
  assert.equal(JSON.parse(result.stdout).scope,'static-configuration-only');
});
test('preflight --require-turn fails with no relay and succeeds with valid settings',()=>{
  const missing=check(['--require-turn']);assert.equal(missing.status,1);assert.ok(JSON.parse(missing.stdout).errors.includes('turn-required'));
  const valid=check(['--require-turn'],turnSettings);assert.equal(valid.status,0,valid.stderr);
  assert.equal(JSON.parse(valid.stdout).turnConfigured,true);
  assert.equal(valid.stdout.includes(secret),false);assert.equal(valid.stdout.includes('relay.example'),false);
});
test('preflight returns nonzero for malformed settings and redacts them',()=>{
  const result=check([],{PARALLAXE_TURN_URLS:'turn:private:password@invalid',PARALLAXE_TURN_SECRET:secret});
  assert.equal(result.status,1);assert.equal(result.stdout.includes('password'),false);assert.equal(result.stderr.includes(secret),false);
});
test('preflight rejects unknown flags with a usage error',()=>assert.equal(check(['--unknown']).status,2));
