/** Static deployment preflight. No DNS requests, microphone capture or TURN allocation. */
import {readFile} from 'node:fs/promises';
import {stripTypeScriptTypes} from 'node:module';
const source=await readFile(new URL('../src/game/radio-config.ts',import.meta.url),'utf8');
const compiled=stripTypeScriptTypes(source);
const {analyzeRadioSettings}=await import(`data:text/javascript;base64,${Buffer.from(compiled).toString('base64')}`);
const args=new Set(process.argv.slice(2));
if([...args].some(arg=>!['--json','--require-turn'].includes(arg))){
  console.error('Usage: node scripts/check-radio-config.mjs [--json] [--require-turn]');
  process.exitCode=2;
}else{
  const result=analyzeRadioSettings(process.env);
  const issues=result.diagnostics.issues;
  const errors=issues.filter(code=>['invalid-stun-url','invalid-turn-url','missing-turn-secret','unused-turn-secret'].includes(code));
  if(args.has('--require-turn')&&!result.turnConfigured)errors.push('turn-required');
  const report={ok:errors.length===0,scope:'static-configuration-only',stunServers:result.stun.length,
    turnServers:result.turnConfigured?result.turn.length:0,turnConfigured:result.turnConfigured,
    errors,diagnostics:result.diagnostics};
  if(args.has('--json'))console.log(JSON.stringify(report,null,2));
  else{
    console.log(`PARALLAXE · configuration radio : ${report.ok?'valide':'à corriger'}`);
    console.log(`STUN : ${report.stunServers} · TURN : ${report.turnServers}`);
    console.log(`Diagnostics : ${[...new Set([...issues,...errors])].join(', ')||'aucun'}`);
    console.log('Contrôle statique uniquement : connectivité, certificats, micros et écoute non testés.');
  }
  process.exitCode=report.ok?0:1;
}
