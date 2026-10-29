/** Reproducible release ZIPs with Node's standard library; no extra packaging dependency. */
import { readFile, writeFile, mkdir, readdir, stat, copyFile, rm } from 'node:fs/promises';
import { resolve, join, relative, dirname, sep } from 'node:path';
import { fileURLToPath } from 'node:url';
import { execFileSync } from 'node:child_process';
import { deflateRawSync } from 'node:zlib';
import { createHash } from 'node:crypto';

const root=resolve(dirname(fileURLToPath(import.meta.url)),'..');
const version=JSON.parse(await readFile(join(root,'package.json'),'utf8')).version;
const commit=execFileSync('git',['rev-parse','HEAD'],{cwd:root,encoding:'utf8'}).trim();
const dirty=Boolean(execFileSync('git',['status','--porcelain','--untracked-files=all'],{cwd:root,encoding:'utf8'}).trim());
const sha256=data=>createHash('sha256').update(data).digest('hex');
const output=join(root,'outputs',`release-v${version}`);
await mkdir(output,{recursive:true});
const crcTable=Array.from({length:256},(_,value)=>{for(let i=0;i<8;i++)value=(value&1)?0xedb88320^(value>>>1):value>>>1;return value>>>0;});
function crc32(data){let value=0xffffffff;for(const byte of data)value=crcTable[(value^byte)&255]^(value>>>8);return (value^0xffffffff)>>>0;}

async function archive(path,entries){
  const files=[],directory=[];let offset=0;
  for(const [name,contents] of [...entries].sort(([a],[b])=>a.localeCompare(b))){
    const filename=Buffer.from(name.replaceAll('\\','/'));const data=Buffer.isBuffer(contents)?contents:Buffer.from(contents);
    const compressed=deflateRawSync(data,{level:9});const checksum=crc32(data);
    const local=Buffer.alloc(30);local.writeUInt32LE(0x04034b50,0);local.writeUInt16LE(20,4);local.writeUInt16LE(0x800,6);local.writeUInt16LE(8,8);local.writeUInt16LE(0x21,12);local.writeUInt32LE(checksum,14);local.writeUInt32LE(compressed.length,18);local.writeUInt32LE(data.length,22);local.writeUInt16LE(filename.length,26);
    files.push(local,filename,compressed);
    const central=Buffer.alloc(46);central.writeUInt32LE(0x02014b50,0);central.writeUInt16LE(20,4);central.writeUInt16LE(20,6);central.writeUInt16LE(0x800,8);central.writeUInt16LE(8,10);central.writeUInt16LE(0x21,14);central.writeUInt32LE(checksum,16);central.writeUInt32LE(compressed.length,20);central.writeUInt32LE(data.length,24);central.writeUInt16LE(filename.length,28);central.writeUInt32LE(offset,42);
    directory.push(central,filename);offset+=local.length+filename.length+compressed.length;
  }
  const central=Buffer.concat(directory),end=Buffer.alloc(22);end.writeUInt32LE(0x06054b50,0);end.writeUInt16LE(entries.size,8);end.writeUInt16LE(entries.size,10);end.writeUInt32LE(central.length,12);end.writeUInt32LE(offset,16);
  const buffer=Buffer.concat([...files,central,end]);await writeFile(path,buffer);
  return {file:path,files:entries.size,bytes:buffer.length,sha256:sha256(buffer)};
}
async function collect(folder,prefix,entries,filter=()=>true){
  for(const item of await readdir(folder,{withFileTypes:true})){const absolute=join(folder,item.name),name=prefix+'/'+item.name;
    if(!filter(name))continue;
    if(item.isDirectory())await collect(absolute,name,entries,filter);
    else if(item.isFile())entries.set(name,await readFile(absolute));
  }
}

await stat(join(root,'standalone-dist/index.html'));
const portable=new Map();
await collect(join(root,'standalone-dist'),'standalone-dist',portable,name=>!name.endsWith('.zip'));
portable.set('scripts/start-local.mjs',await readFile(join(root,'scripts/start-local.mjs')));
portable.set('package.json',JSON.stringify({name:'parallaxe-protocole-9-portable',version,private:true,type:'module',engines:{node:'>=22.13.0'},scripts:{start:'node scripts/start-local.mjs'}},null,2)+'\n');
portable.set('LANCER_JEU_WINDOWS.cmd','@echo off\r\ncd /d "%~dp0"\r\nnode scripts/start-local.mjs\r\npause\r\n');
portable.set('LANCER_COOP_RESEAU_WINDOWS.cmd','@echo off\r\ncd /d "%~dp0"\r\nnode scripts/start-local.mjs --lan\r\npause\r\n');
portable.set('lancer_jeu.sh','#!/usr/bin/env sh\ncd "$(dirname "$0")" || exit 1\nexec node scripts/start-local.mjs "$@"\n');
portable.set('lancer_coop_reseau.sh','#!/usr/bin/env sh\ncd "$(dirname "$0")" || exit 1\nexec node scripts/start-local.mjs --lan "$@"\n');
portable.set('LIRE_AVANT_DE_JOUER.txt',`PARALLAXE — PROTOCOLE 9 / v${version}\n\n1. Installer Node.js 22.13 ou ultérieur : https://nodejs.org/\n2. Décompresser entièrement ce dossier. Aucune commande npm install n’est nécessaire.\n3. Windows : ouvrir LANCER_JEU_WINDOWS.cmd. macOS/Linux : sh lancer_jeu.sh.\n4. Ouvrir http://localhost:4174 dans un navigateur compatible WebGL 2.\n\nCOOP : lancer le serveur avec --lan, transmettre son adresse puis le code du salon.\nVOIX : localhost ou HTTPS approuvé obligatoire. Une adresse réseau locale HTTP ne donne pas accès au micro.\nPour HTTPS : node scripts/start-local.mjs --lan --cert=/chemin/cert.pem --key=/chemin/key.pem\nVoir docs/RADIO.md pour HTTPS et les relais TURN nécessaires sur certains réseaux Internet.\n\nClavier : ZQSD/WASD, souris ; E repère, V vote, J carnet, F lampe, T talkie maintenu, Tab autre perception solo, Échap pause.\nLe bouton « Activer mon microphone » est dans le panneau talkie. Aucune voix n’est enregistrée par le serveur du jeu.\n\nSources et mises à jour : https://github.com/darknigthmare/Parallaxe_Protocole9\nLes détails de validation et les limites matérielles sont dans docs/QA.md.\n`);
await collect(join(root,'docs'),'docs',portable,name=>/\.(md|json|xlsx)$/.test(name)||!name.split('/').at(-1).includes('.'));
portable.set('THIRD_PARTY_NOTICES.txt',await readFile(join(root,'THIRD_PARTY_NOTICES.txt')));
const portablePath=join(output,`PARALLAXE_Jeu_PC_LAN_v${version}.zip`);

// Track/untracked source inventory is scoped to this checkout. Runtime rooms and secrets are never packaged.
const names=execFileSync('git',['ls-files','--cached','--others','--exclude-standard','-z'],{cwd:root,encoding:'utf8'}).split('\0').filter(Boolean);
const sources=new Map();
for(const name of new Set(names)){
  if(name.startsWith('public/downloads/')&&name.endsWith('.zip'))continue;
  if(/(^|\/)(\.env[^/]*|\.dev\.vars[^/]*|\.parallaxe-data|node_modules|dist|outputs|standalone-dist)(\/|$)|\.(pem|key|p12|pfx)$/i.test(name))continue;
  const absolute=resolve(root,name);if(!absolute.startsWith(root+sep))throw new Error('Invalid source path');
  try{if((await stat(absolute)).isFile())sources.set(name,await readFile(absolute));}catch(error){if(error.code!=='ENOENT')throw error;}
}
const sourcePath=join(output,`PARALLAXE_Sources_v${version}.zip`);
const sourceResult=await archive(sourcePath,sources);
// The portable edition includes its source download, but never embeds its own ZIP.
portable.set(`standalone-dist/downloads/PARALLAXE_Sources_v${version}.zip`,await readFile(sourcePath));
portable.set('COMMIT.txt',commit+'\n');
const portableResult=await archive(portablePath,portable);
await mkdir(join(root,'public/downloads'),{recursive:true});
for(const item of await readdir(join(root,'public/downloads')))if(/^PARALLAXE_(Jeu_PC_LAN|Sources)_v.*\.zip$/.test(item))await rm(join(root,'public/downloads',item));
await copyFile(portablePath,join(root,'public/downloads',relative(output,portablePath)));
await copyFile(sourcePath,join(root,'public/downloads',relative(output,sourcePath)));
const report={version,commit,dirty,portable:portableResult,sources:sourceResult};
await writeFile(join(output,'release-manifest.json'),JSON.stringify(report,null,2)+'\n');
await writeFile(join(output,'COMMIT.txt'),commit+'\n');
await writeFile(join(output,'SHA256SUMS.txt'),[portableResult,sourceResult].map(item=>`${item.sha256}  ${relative(output,item.file)}`).join('\n')+'\n');
console.log(JSON.stringify(report,null,2));
