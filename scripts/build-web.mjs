import { cp, mkdir, rm } from 'node:fs/promises';
import { existsSync } from 'node:fs';
await rm('www',{recursive:true,force:true});
await mkdir('www',{recursive:true});
await cp('index.html','www/index.html');
await cp('src','www/src',{recursive:true});
if(existsSync('recursos-prueba')) await cp('recursos-prueba','www/recursos-prueba',{recursive:true});
console.log('Web bundle staged in www/');
