import { cp, mkdir, rm, readFile, writeFile } from 'node:fs/promises';
import { existsSync } from 'node:fs';
await rm('www',{recursive:true,force:true});
await mkdir('www',{recursive:true});
await cp('index.html','www/index.html');
await cp('src','www/src',{recursive:true});
// Bundle Three.js locally so the Android test APK does not depend on a CDN for its engine.
await mkdir('www/vendor/three',{recursive:true});
await cp('node_modules/three/build','www/vendor/three/build',{recursive:true});
await cp('node_modules/three/examples/jsm','www/vendor/three/examples/jsm',{recursive:true});
const indexPath='www/index.html';
let html=await readFile(indexPath,'utf8');
html=html.replace('https://cdn.jsdelivr.net/npm/three@0.186.1/build/three.module.js','./vendor/three/build/three.module.js');
html=html.replace('https://cdn.jsdelivr.net/npm/three@0.186.1/examples/jsm/','./vendor/three/examples/jsm/');
await writeFile(indexPath,html);
if(existsSync('recursos-prueba')) await cp('recursos-prueba','www/recursos-prueba',{recursive:true});
console.log('Web bundle staged with a local Three.js engine in www/');
