import * as THREE from 'three';
import {GLTFLoader} from 'three/addons/loaders/GLTFLoader.js';
import {PointerLockControls} from 'three/addons/controls/PointerLockControls.js';
import {GAME_VERSION,ASSETS,SERVER_URL,HTTP_SERVER_URL,WORLD} from './config.js';
import {createVoxelWorld} from './voxel-world.js';

const $=id=>document.getElementById(id);
const boot=$('boot'),bootStatus=$('bootStatus'),loginGate=$('loginGate'),loginStatus=$('loginStatus'),googleButton=$('googleButton');
const hpText=$('hpText'),hpFill=$('hpFill'),stamText=$('stamText'),stamFill=$('stamFill'),hungerText=$('hungerText'),hungerFill=$('hungerFill'),thirstText=$('thirstText'),thirstFill=$('thirstFill'),zoneText=$('zoneText'),hint=$('hint'),damageFlash=$('damageFlash'),knifeHit=$('knifeHit'),mineButton=$('mineButton'),placeButton=$('placeButton'),inventoryText=$('inventoryText'),selectedText=$('selectedText');
let activeRoomCode='main';

const scene=new THREE.Scene();
scene.background=new THREE.Color(0x8bc5e8);
scene.fog=new THREE.Fog(0x8bc5e8,52,125);
const camera=new THREE.PerspectiveCamera(75,innerWidth/innerHeight,.05,260);
const renderer=new THREE.WebGLRenderer({antialias:true,powerPreference:'high-performance'});
renderer.setPixelRatio(Math.min(devicePixelRatio,innerWidth<=800?1.2:1.6));renderer.setSize(innerWidth,innerHeight);renderer.shadowMap.enabled=innerWidth>800;document.body.appendChild(renderer.domElement);
const controls=new PointerLockControls(camera,renderer.domElement);scene.add(controls.object);
const hemi=new THREE.HemisphereLight(0xb9e3ff,0x4b613c,1.65);scene.add(hemi);
const light=new THREE.DirectionalLight(0xffe2b8,1.6);light.position.set(22,30,16);light.castShadow=true;scene.add(light);
const sunMesh=new THREE.Mesh(new THREE.SphereGeometry(4,12,8),new THREE.MeshBasicMaterial({color:0xffdf88}));scene.add(sunMesh);
const moonMesh=new THREE.Mesh(new THREE.SphereGeometry(2.8,12,8),new THREE.MeshBasicMaterial({color:0xd9e4f5}));scene.add(moonMesh);
const starField=new THREE.Group();for(let i=0;i<70;i++){const star=new THREE.Mesh(new THREE.SphereGeometry(.22+Math.random()*.2,4,4),new THREE.MeshBasicMaterial({color:0xe8efff}));const a=Math.random()*Math.PI*2,e=.12+Math.random()*1.15,r=115;star.position.set(Math.cos(a)*Math.cos(e)*r,Math.sin(e)*r,Math.sin(a)*Math.cos(e)*r);starField.add(star)}scene.add(starField);

const voxelWorld=createVoxelWorld(scene);
zoneText.textContent='MUNDO CÚBICO';
const BLOCK=voxelWorld.BLOCK;
const inventory={1:0,2:0,3:0,4:0,5:0,6:0,7:0,8:0,9:0,10:0,11:0,12:0,13:0,planks:0,sticks:0,coal:0,ironIngot:0,goldIngot:0,pickaxe:0,stonePickaxe:0,ironPickaxe:0,axe:0,stoneAxe:0,shovel:0,stoneShovel:0,sword:0,stoneSword:0,ironSword:0,ironAxe:0,ironShovel:0,craftingTable:0,furnace:0,rawBeef:0,rawPork:0,rawChicken:0,leather:0,feathers:0};
let selectedBlock=BLOCK.DIRT,worldClock=0;
try{const saved=JSON.parse(localStorage.getItem('tekaym-voxel-save-v2-'+activeRoomCode)||'null');if(saved&&Array.isArray(saved.blocks))voxelWorld.applyChanges(saved.blocks);if(saved&&saved.inventory&&typeof saved.inventory==='object')for(const id of Object.keys(inventory))inventory[id]=Math.max(0,Math.min(9999,Number(saved.inventory[id])||0));selectedBlock=Number.isInteger(saved?.selectedBlock)?saved.selectedBlock:BLOCK.DIRT;worldClock=Number.isFinite(saved?.worldClock)?((saved.worldClock%1200)+1200)%1200:0;}catch(e){console.warn('[TEKAYM] No se pudo cargar el mundo guardado',e)}
controls.object.position.copy(voxelWorld.safeSpawn());
const loader=new GLTFLoader(),assetRoot=new THREE.Group();scene.add(assetRoot);
const zombies=[],animals=[],remotePlayers=new Map();
let nightActive=false,lastAnimalSpawn=0,animalSequence=0;
const worldClockText=$('worldClock');let lastClockSave=0;
const keys={w:false,a:false,s:false,d:false};
let streamedChunkX=Infinity,streamedChunkZ=Infinity;
const player={id:null,name:'Jugador',hp:100,maxHp:100,stamina:100,hunger:100,thirst:100,cooldown:0,dead:false};
let knife=null,socket=null,googleIdToken='',lookYaw=0,lookPitch=0,last=performance.now(),lastNet=0,lastSentX=Infinity,lastSentZ=Infinity,googleReady=false,connected=false;

function setBoot(text){if(bootStatus)bootStatus.textContent=text}
function updateHud(){
 const set=(text,fill,v,max=100)=>{text.textContent=Math.round(v)+' / '+Math.round(max);fill.style.width=Math.max(0,Math.min(100,v/max*100))+'%'};
 set(hpText,hpFill,player.hp,player.maxHp);set(stamText,stamFill,player.stamina);hungerText.textContent=Math.round(player.hunger)+'%';hungerFill.style.width=Math.max(0,Math.min(100,player.hunger))+'%';thirstText.textContent=Math.round(player.thirst)+'%';thirstFill.style.width=Math.max(0,Math.min(100,player.thirst))+'%';
}
function flash(){damageFlash.style.opacity='1';setTimeout(()=>damageFlash.style.opacity='0',120)}
function loadModel(url,scale=1){return new Promise((resolve,reject)=>loader.load(url,g=>{g.scene.scale.setScalar(scale);resolve(g.scene)},undefined,reject))}
async function loadAssets(){
 setBoot('Generando terreno cúbico…');
 await new Promise(resolve=>requestAnimationFrame(resolve));
 setBoot('Preparando herramientas…');
 try{const g=await loadModel(ASSETS.knife);g.scale.setScalar(.42);g.position.set(.26,-.28,-.55);g.rotation.set(-.4,.15,-.2);knife=g;camera.add(g)}catch(e){console.warn('[TEKAYM] knife asset',e);const h=new THREE.Group();const b=new THREE.Mesh(new THREE.BoxGeometry(.055,.34,.025),new THREE.MeshStandardMaterial({color:0xbfc7cf,metalness:.8,roughness:.28}));b.position.y=.12;h.add(b);const g=new THREE.Mesh(new THREE.BoxGeometry(.09,.16,.07),new THREE.MeshStandardMaterial({color:0x202327}));g.position.y=-.13;h.add(g);h.position.set(.25,-.3,-.55);knife=h;camera.add(h)}
 spawnProceduralZombies(18);
 updateInventoryHud();
}
function randomNearPlayer(min=10,max=28){
 for(let i=0;i<100;i++){const ang=Math.random()*Math.PI*2,d=min+Math.random()*(max-min),x=Math.floor(controls.object.position.x+Math.cos(ang)*d),z=Math.floor(controls.object.position.z+Math.sin(ang)*d),h=voxelWorld.getHeightAt(x,z),gy=Math.floor(h-2.65);
  if(Math.hypot(x-controls.object.position.x,z-controls.object.position.z)<min)continue;
  if(voxelWorld.getBlock(x,gy,z)!==BLOCK.GRASS||voxelWorld.getBlock(x,gy+1,z)||voxelWorld.getBlock(x,gy+2,z))continue;
  return new THREE.Vector3(x,h-1.65,z);
 }
 const x=Math.floor(controls.object.position.x+min),z=Math.floor(controls.object.position.z),h=voxelWorld.getHeightAt(x,z);return new THREE.Vector3(x,h-1.65,z);
}
function randomZombiePosition(){const p=randomNearPlayer(13,32);p.y=voxelWorld.getHeightAt(p.x,p.z)-1.65;return p}
function spawnProceduralZombies(count){
 for(let i=0;i<count;i++){const z=new THREE.Group(),body=new THREE.Mesh(new THREE.CapsuleGeometry(.3,.9,5,8),new THREE.MeshStandardMaterial({color:0x77706b,roughness:.9}));body.position.y=.8;z.add(body);const head=new THREE.Mesh(new THREE.SphereGeometry(.28,10,8),new THREE.MeshStandardMaterial({color:0x8d8882,roughness:.9}));head.position.y=1.55;z.add(head);z.position.copy(randomZombiePosition());z.userData={id:'z'+i,hp:45,speed:1.05+Math.random()*.5,phase:Math.random()*6.28};z.visible=false;scene.add(z);zombies.push(z)}
}
function makeAnimal(type){
 const root=new THREE.Group(),mat=(color)=>new THREE.MeshStandardMaterial({color,roughness:.9}),coat=mat(type==='cow'?0xe8e1d5:type==='pig'?0xeaa0a0:0xf3f0e5),dark=mat(0x42352d),pink=mat(0xf08e96),yellow=mat(0xe8b52d),red=mat(0xb52e39);
 const size=type==='cow'?[.78,.66,1.05]:type==='pig'?[.72,.5,.9]:[.4,.4,.52],body=new THREE.Mesh(new THREE.BoxGeometry(...size),coat);body.position.y=type==='chicken'?.48:.62;root.add(body);
 if(type==='cow'){for(const [x,y,z] of [[-.2,.72,.12],[.2,.48,-.18]]){const patch=new THREE.Mesh(new THREE.BoxGeometry(.2,.2,.18),dark);patch.position.set(x,y,z);root.add(patch)}}
 const head=new THREE.Mesh(type==='chicken'?new THREE.SphereGeometry(.18,8,6):new THREE.BoxGeometry(type==='cow'?.36:.3,type==='cow'?.34:.28,.34),coat);head.position.set(0,type==='chicken'?.76:.83,.44);root.add(head);
 if(type==='pig'){const snout=new THREE.Mesh(new THREE.BoxGeometry(.19,.13,.09),pink);snout.position.set(0,.8,.63);root.add(snout)}
 if(type==='chicken'){const beak=new THREE.Mesh(new THREE.ConeGeometry(.07,.14,4),yellow);beak.rotation.x=Math.PI/2;beak.position.set(0,.73,.59);root.add(beak);const comb=new THREE.Mesh(new THREE.SphereGeometry(.06,6,4),red);comb.position.set(0,.96,.42);root.add(comb)}
 for(const x of [-1,1])for(const z of [-1,1]){const leg=new THREE.Mesh(new THREE.BoxGeometry(.12,type==='chicken'?.25:.38,.12),dark);leg.position.set(x*size[0]*.3,type==='chicken'?.17:.2,z*size[2]*.28);root.add(leg)}
 root.userData={type,hp:20,walk:Math.random()*6.28,nextTurn:0,dir:Math.random()*Math.PI*2};return root;
}
function spawnAnimal(type){const a=makeAnimal(type);a.position.copy(randomNearPlayer(8,26));a.userData.id='animal-'+(++animalSequence);scene.add(a);animals.push(a);return a}
function updateAnimals(now,dt){
 if((worldClock<650||worldClock>=1150)&&animals.filter(a=>a.visible).length<8&&now-lastAnimalSpawn>2200){spawnAnimal(['chicken','pig','cow'][Math.floor(Math.random()*3)]);lastAnimalSpawn=now}
 for(const a of animals){if(!a.visible)continue;a.userData.nextTurn-=dt;if(a.userData.nextTurn<=0){a.userData.dir=Math.random()*Math.PI*2;a.userData.nextTurn=2+Math.random()*4}
  const speed=a.userData.type==='chicken'?.58:.34,nx=a.position.x+Math.sin(a.userData.dir)*speed*dt,nz=a.position.z+Math.cos(a.userData.dir)*speed*dt;
  if(Math.hypot(nx-controls.object.position.x,nz-controls.object.position.z)<36){a.position.x=nx;a.position.z=nz;a.position.y=voxelWorld.getHeightAt(nx,nz)-1.65;a.rotation.y=a.userData.dir}
  if(Math.hypot(a.position.x-controls.object.position.x,a.position.z-controls.object.position.z)>58)a.visible=false;
 }
}
function canOccupy(x,z,eyeY){
 const footY=eyeY-1.65;
 for(const px of [x-.28,x+.28])for(const pz of [z-.28,z+.28]){
  for(let y=Math.floor(footY+.1);y<=Math.floor(eyeY+.15);y++){
   if(voxelWorld.getBlock(Math.floor(px),y,Math.floor(pz)))return false;
  }
 }
 return true;
}
function moveLocal(dt){
 const sprinting=keys.shift&&player.stamina>1;const speed=player.stamina<1?2.1:(sprinting?7.2:4.2),v=new THREE.Vector3((keys.d?1:0)-(keys.a?1:0),0,(keys.s?1:0)-(keys.w?1:0));
 if(v.lengthSq()){v.normalize();const dir=v.applyAxisAngle(new THREE.Vector3(0,1,0),camera.rotation.y);const next=controls.object.position.clone().addScaledVector(dir,speed*dt);const limit=99900;if(Math.abs(next.x)<limit&&Math.abs(next.z)<limit){next.y=voxelWorld.getHeightAt(next.x,next.z);if(canOccupy(next.x,next.z,next.y))controls.object.position.copy(next)}player.stamina=Math.max(0,player.stamina-(sprinting?24:3)*dt)}else{player.stamina=Math.min(100,player.stamina+22*dt);controls.object.position.y=voxelWorld.getHeightAt(controls.object.position.x,controls.object.position.z)}
 const cx=Math.floor(controls.object.position.x/16),cz=Math.floor(controls.object.position.z/16);if(cx!==streamedChunkX||cz!==streamedChunkZ){streamedChunkX=cx;streamedChunkZ=cz;voxelWorld.updateStreaming(controls.object.position)}
}
function updateNeeds(dt){
 player.hunger=Math.max(0,player.hunger-.18*dt);player.thirst=Math.max(0,player.thirst-.26*dt);
 if(player.hunger===0||player.thirst===0)player.hp=Math.max(0,player.hp-.8*dt);
 if(player.hp<=0&&!player.dead){player.dead=true;setBoot('Has muerto. Recargando…');boot.classList.remove('hidden');setTimeout(()=>location.reload(),1200)}
}
function roomSaveKey(){return 'tekaym-voxel-save-v2-'+activeRoomCode}
function saveWorld(){
 try{localStorage.setItem(roomSaveKey(),JSON.stringify({blocks:voxelWorld.serializeChanges(),inventory,selectedBlock,worldClock,updatedAt:Date.now()}));}catch(e){console.warn('[TEKAYM] No se pudo guardar el mundo',e)}
}
function loadRoomInventory(){
 try{
  const saved=JSON.parse(localStorage.getItem(roomSaveKey())||'null');
  const defaults={};
  for(const id of Object.keys(inventory))inventory[id]=saved?.inventory&&id in saved.inventory?Math.max(0,Math.min(9999,Number(saved.inventory[id])||0)):defaults[id]||0;
  selectedBlock=Number(saved?.selectedBlock)||BLOCK.DIRT;
 }catch(e){console.warn('[TEKAYM] No se pudo cargar el inventario del mundo',e)}
 updateInventoryHud();
}
function updateInventoryHud(){
 if(inventoryText)inventoryText.textContent='TRONCOS '+inventory[BLOCK.WOOD]+' · TABLAS '+inventory[BLOCK.PLANKS]+' · PALOS '+inventory.sticks+' · PIEDRA '+inventory[BLOCK.STONE]+' · CARBÓN '+inventory.coal+' · HIERRO '+inventory[BLOCK.IRON_ORE]+' · LINGOTES '+inventory.ironIngot+' · ORO '+inventory[BLOCK.GOLD_ORE]+' · DIAMANTES '+inventory[BLOCK.DIAMOND_ORE]+' · PICO MADERA '+inventory.pickaxe+' · PICO PIEDRA '+inventory.stonePickaxe+' · PICO HIERRO '+inventory.ironPickaxe+' · ESPADAS '+(inventory.sword+inventory.stoneSword+inventory.ironSword);
 if(selectedText)selectedText.textContent='BLOQUE: '+voxelWorld.blockName(selectedBlock)+' ('+(inventory[selectedBlock]||0)+')';
}
function mineBlock(){
 if(player.dead)return;
 const hit=voxelWorld.targetFromCamera(camera);if(!hit)return;
 const id=voxelWorld.getBlock(hit.x,hit.y,hit.z);if(!id)return;
 const toolNeeded= id===BLOCK.STONE||id===BLOCK.COAL_ORE?'pickaxe':id===BLOCK.IRON_ORE?'stonePickaxe':id===BLOCK.GOLD_ORE||id===BLOCK.DIAMOND_ORE?'ironPickaxe':null;
 if(toolNeeded&&!inventory[toolNeeded]){hint.textContent=toolNeeded==='pickaxe'?'Necesitas un pico de madera para picar piedra y carbón.':toolNeeded==='stonePickaxe'?'Necesitas un pico de piedra para extraer hierro.':'Necesitas un pico de hierro para extraer oro y diamante.';return;}
 const removed=voxelWorld.breakBlock(camera);if(!removed)return;
 const drops={ [BLOCK.GRASS]:BLOCK.DIRT,[BLOCK.DIRT]:BLOCK.DIRT,[BLOCK.STONE]:BLOCK.STONE,[BLOCK.SAND]:BLOCK.SAND,[BLOCK.WOOD]:BLOCK.WOOD,[BLOCK.LEAVES]:BLOCK.LEAVES,[BLOCK.COAL_ORE]:'coal',[BLOCK.IRON_ORE]:BLOCK.IRON_ORE,[BLOCK.GOLD_ORE]:BLOCK.GOLD_ORE,[BLOCK.DIAMOND_ORE]:BLOCK.DIAMOND_ORE,[BLOCK.PLANKS]:BLOCK.PLANKS,[BLOCK.CRAFTING_TABLE]:BLOCK.CRAFTING_TABLE,[BLOCK.FURNACE]:BLOCK.FURNACE };
 const drop=drops[removed];if(drop!==undefined)inventory[drop]=(inventory[drop]||0)+(removed===BLOCK.WOOD&&(inventory.axe>0||inventory.stoneAxe>0||inventory.ironAxe>0)?2:1);
 if(socket?.readyState===WebSocket.OPEN&&connected)socket.send(JSON.stringify({type:'block_edit',x:hit.x,y:hit.y,z:hit.z,id:BLOCK.AIR}));
 updateInventoryHud();saveWorld();
}
function placeSelectedBlock(){
 if(player.dead)return;if((inventory[selectedBlock]||0)<1){hint.textContent='No tienes '+voxelWorld.blockName(selectedBlock)+' para colocar.';return;}
 const hit=voxelWorld.targetFromCamera(camera);if(!hit)return;
 const x=hit.x+hit.normal.x,y=hit.y+hit.normal.y,z=hit.z+hit.normal.z;
 if(voxelWorld.placeBlock(camera,selectedBlock,controls.object.position)){
  inventory[selectedBlock]--;if(socket?.readyState===WebSocket.OPEN&&connected)socket.send(JSON.stringify({type:'block_edit',x,y,z,id:selectedBlock}));
  updateInventoryHud();saveWorld();
 }
}
function selectNextBlock(){
 const ids=[BLOCK.DIRT,BLOCK.STONE,BLOCK.WOOD,BLOCK.SAND,BLOCK.GRASS,BLOCK.PLANKS,BLOCK.CRAFTING_TABLE,BLOCK.FURNACE];
 const at=Math.max(0,ids.indexOf(selectedBlock));selectedBlock=ids[(at+1)%ids.length];updateInventoryHud();saveWorld();
}
function craftPlanks(){
 if(inventory[BLOCK.WOOD]<1){hint.textContent='Tala un árbol y consigue un tronco primero.';return;}
 inventory[BLOCK.WOOD]--;inventory[BLOCK.PLANKS]=(inventory[BLOCK.PLANKS]||0)+4;hint.textContent='Fabricaste 4 tablas.';updateInventoryHud();saveWorld();
}
function craftSticks(){
 if(inventory[BLOCK.PLANKS]<2){hint.textContent='Necesitas 2 tablas para fabricar 4 palos.';return;}
 inventory[BLOCK.PLANKS]-=2;inventory.sticks+=4;hint.textContent='Fabricaste 4 palos.';updateInventoryHud();saveWorld();
}
function craftRecipe(cost,result,amount=1,label='Objeto'){
 for(const [item,n] of Object.entries(cost))if((inventory[item]||0)<n){hint.textContent=label+': te faltan recursos ('+n+' de '+item+').';return false;}
 for(const [item,n] of Object.entries(cost))inventory[item]-=n;
 inventory[result]=(inventory[result]||0)+amount;hint.textContent='Fabricaste: '+label;updateInventoryHud();saveWorld();return true;
}
function craftPickaxe(){craftRecipe({[BLOCK.PLANKS]:3,sticks:2},'pickaxe',1,'Pico de madera');}
function craftAxe(){craftRecipe({[BLOCK.PLANKS]:3,sticks:2},'axe',1,'Hacha de madera');}
function craftShovel(){craftRecipe({[BLOCK.PLANKS]:1,sticks:2},'shovel',1,'Pala de madera');}
function craftSword(){craftRecipe({[BLOCK.PLANKS]:2,sticks:1},'sword',1,'Espada de madera');}
function craftTable(){craftRecipe({[BLOCK.PLANKS]:4},BLOCK.CRAFTING_TABLE,1,'Mesa de trabajo');}
function hasStation(id){const px=Math.floor(controls.object.position.x),pz=Math.floor(controls.object.position.z),py=Math.floor(controls.object.position.y-1.65);for(let x=px-4;x<=px+4;x++)for(let z=pz-4;z<=pz+4;z++)for(let y=Math.max(0,py-2);y<=py+2;y++)if(voxelWorld.getBlock(x,y,z)===id)return true;return false;}
function craftStonePickaxe(){if(!hasStation(BLOCK.CRAFTING_TABLE)){hint.textContent='Necesitas una mesa de trabajo en tu inventario o colocada cerca.';return;}craftRecipe({3:3,sticks:2},'stonePickaxe',1,'Pico de piedra');}
function craftStoneAxe(){if(!hasStation(BLOCK.CRAFTING_TABLE)){hint.textContent='Necesitas una mesa de trabajo cerca.';return;}craftRecipe({3:3,sticks:2},'stoneAxe',1,'Hacha de piedra');}
function craftStoneSword(){if(!hasStation(BLOCK.CRAFTING_TABLE)){hint.textContent='Necesitas una mesa de trabajo cerca.';return;}craftRecipe({3:2,sticks:1},'stoneSword',1,'Espada de piedra');}
function craftStoneShovel(){if(!hasStation(BLOCK.CRAFTING_TABLE)){hint.textContent='Necesitas una mesa de trabajo cerca.';return;}craftRecipe({3:1,sticks:2},'stoneShovel',1,'Pala de piedra');}
function craftIronSword(){if(!hasStation(BLOCK.CRAFTING_TABLE)){hint.textContent='Necesitas una mesa de trabajo cerca.';return;}craftRecipe({ironIngot:2,sticks:1},'ironSword',1,'Espada de hierro');}
function craftIronAxe(){if(!hasStation(BLOCK.CRAFTING_TABLE)){hint.textContent='Necesitas una mesa de trabajo cerca.';return;}craftRecipe({ironIngot:3,sticks:2},'ironAxe',1,'Hacha de hierro');}
function craftIronShovel(){if(!hasStation(BLOCK.CRAFTING_TABLE)){hint.textContent='Necesitas una mesa de trabajo cerca.';return;}craftRecipe({ironIngot:1,sticks:2},'ironShovel',1,'Pala de hierro');}
function craftIronPickaxe(){if(!hasStation(BLOCK.CRAFTING_TABLE)){hint.textContent='Necesitas una mesa de trabajo cerca.';return;}craftRecipe({ironIngot:3,sticks:2},'ironPickaxe',1,'Pico de hierro');}
function smeltIron(){if(!hasStation(BLOCK.FURNACE)){hint.textContent='Primero fabrica y coloca un horno cerca.';return;}if(!inventory[BLOCK.IRON_ORE]||!inventory.coal){hint.textContent='Fundir hierro requiere mineral de hierro y carbón.';return;}inventory[BLOCK.IRON_ORE]--;inventory.coal--;inventory.ironIngot++;hint.textContent='Fundiste 1 lingote de hierro.';updateInventoryHud();saveWorld();}
function attack(){
 if(player.dead||player.cooldown>0)return;player.cooldown=.55;if(knife)knife.rotation.z-=.8;
 const origin=controls.object.position.clone(),forward=new THREE.Vector3();camera.getWorldDirection(forward);let best=null,bestD=2.5,bestType='zombie';
 for(const z of zombies){if(!z.visible||z.userData.hp<=0)continue;const to=z.position.clone().add(new THREE.Vector3(0,.8,0)).sub(origin),d=to.length();if(d>bestD)continue;to.normalize();if(forward.dot(to)<.15)continue;if(d<bestD){best=z;bestD=d;bestType='zombie'}}
 for(const animal of animals){if(!animal.visible)continue;const to=animal.position.clone().add(new THREE.Vector3(0,.55,0)).sub(origin),d=to.length();if(d>bestD)continue;to.normalize();if(forward.dot(to)<.15)continue;if(d<bestD){best=animal;bestD=d;bestType='animal'}}
 if(!best)return;
 const damage=inventory.ironSword?60:inventory.stoneSword?45:inventory.sword?30:inventory.ironAxe?40:inventory.stoneAxe?35:inventory.axe?28:20;
 if(bestType==='animal'){best.userData.hp-=damage;if(best.userData.hp<=0){if(best.userData.type==='cow'){inventory.rawBeef+=2;if(Math.random()<.7)inventory.leather++}else if(best.userData.type==='pig')inventory.rawPork+=2;else{inventory.rawChicken++;if(Math.random()<.75)inventory.feathers++}best.visible=false;hint.textContent=best.userData.type==='cow'?'Vaca: +2 carne cruda y posibilidad de cuero.':best.userData.type==='pig'?'Cerdo: +2 carne de cerdo.':'Pollo: +1 pollo crudo y posibilidad de plumas.';updateInventoryHud();saveWorld()}return}
 if(socket?.readyState===WebSocket.OPEN&&connected)socket.send(JSON.stringify({type:'knife_attack',targetId:best.userData.id,weapon:inventory.ironSword?'ironSword':inventory.stoneSword?'stoneSword':inventory.sword?'sword':inventory.ironAxe?'ironAxe':inventory.stoneAxe?'stoneAxe':inventory.axe?'axe':'knife'}));
 else if(!connected){best.userData.hp-=damage;if(best.userData.hp<=0){best.visible=false;setTimeout(()=>{if(isNight()){best.position.copy(randomZombiePosition());best.userData.hp=45;best.visible=true}},4000)}}
}
function eatFood(){const type=inventory.rawBeef?'rawBeef':inventory.rawPork?'rawPork':inventory.rawChicken?'rawChicken':null;if(!type){hint.textContent='No tienes carne. Caza animales para conseguir comida.';return}inventory[type]--;player.hunger=Math.min(100,player.hunger+28);hint.textContent='Comiste carne cruda: +28 de hambre.';updateInventoryHud();updateHud();saveWorld()}
addEventListener('keydown',e=>{if(document.activeElement?.tagName==='INPUT')return;setKey(e,true)});
addEventListener('keyup',e=>setKey(e,false));
addEventListener('keydown',e=>{if(e.repeat)return;if(e.code==='KeyE')mineBlock();if(e.code==='KeyQ')placeSelectedBlock();if(e.code==='KeyR')selectNextBlock();if(e.code==='KeyF')eatFood();});
$('eatFood')?.addEventListener('click',eatFood);
addEventListener('mousedown',e=>{if(innerWidth>800&&controls.isLocked){if(e.button===0)mineBlock();if(e.button===2)placeSelectedBlock();}});
renderer.domElement.addEventListener('contextmenu',e=>e.preventDefault());
knifeHit.addEventListener('click',attack);
mineButton?.addEventListener('click',mineBlock);
placeButton?.addEventListener('click',placeSelectedBlock);
$('copyRoomButton')?.addEventListener('click',async()=>{try{await navigator.clipboard.writeText(activeRoomCode);zoneText.textContent='CÓDIGO COPIADO: '+activeRoomCode;}catch{zoneText.textContent='CÓDIGO: '+activeRoomCode;}});
$('craftPlanks')?.addEventListener('click',craftPlanks);
$('craftSticks')?.addEventListener('click',craftSticks);
$('craftPickaxe')?.addEventListener('click',craftPickaxe);
$('craftAxe')?.addEventListener('click',craftAxe);$('craftShovel')?.addEventListener('click',craftShovel);$('craftSword')?.addEventListener('click',craftSword);$('craftTable')?.addEventListener('click',craftTable);$('craftStonePickaxe')?.addEventListener('click',craftStonePickaxe);$('craftStoneAxe')?.addEventListener('click',craftStoneAxe);$('craftStoneSword')?.addEventListener('click',craftStoneSword);$('craftStoneShovel')?.addEventListener('click',craftStoneShovel);$('craftIronPickaxe')?.addEventListener('click',craftIronPickaxe);$('craftIronSword')?.addEventListener('click',craftIronSword);$('craftIronAxe')?.addEventListener('click',craftIronAxe);$('craftIronShovel')?.addEventListener('click',craftIronShovel);$('craftFurnace')?.addEventListener('click',()=>craftRecipe({3:8},BLOCK.FURNACE,1,'Horno'));$('smeltIron')?.addEventListener('click',smeltIron);
selectedText?.addEventListener('click',selectNextBlock);
addEventListener('beforeunload',saveWorld);
renderer.domElement.addEventListener('click',()=>{if(innerWidth>800&&!controls.isLocked)controls.lock()});

function showLogin(text){loginGate.classList.remove('hidden');loginStatus.textContent=text}
async function createPersonalWorld(){
 try{
  const response=await fetch(HTTP_SERVER_URL+'/rooms/create',{cache:'no-store'});
  const data=await response.json();
  if(!response.ok||!data.ok||!data.code)throw new Error(data.error||'No se pudo crear el mundo');
  activeRoomCode=String(data.code);
  $('roomCode').value=activeRoomCode;
  $('roomStatus').textContent='Código de tu mundo: '+activeRoomCode+'. Inicia sesión para abrirlo.';
  loginStatus.textContent='Mundo preparado. Inicia sesión con Google para ser el anfitrión.';
 }catch(e){$('roomStatus').textContent='No se pudo crear el mundo: '+(e.message||'error de conexión')}
}
function joinPersonalWorld(){
 const code=String($('roomCode').value||'').trim().toUpperCase();
 if(!/^[A-F0-9]{6}$/.test(code)){ $('roomStatus').textContent='Escribe un código válido de 6 caracteres.';return; }
 activeRoomCode=code;
 $('roomStatus').textContent='Código '+code+' seleccionado. Inicia sesión con Google para entrar.';
 loginStatus.textContent='Mundo seleccionado. Inicia sesión con Google.';
}
$('createWorldButton')?.addEventListener('click',createPersonalWorld);
$('joinWorldButton')?.addEventListener('click',joinPersonalWorld);
async function initGoogle(){
 if(googleReady)return;
 try{
  const response=await fetch(HTTP_SERVER_URL+'/auth/google/config?cfg='+Date.now(),{cache:'no-store'});const cfg=await response.json();
  if(!cfg.ok||!cfg.clientId){showLogin('Google todavía no está configurado en el servidor.');return}
  const wait=()=>new Promise(resolve=>{if(window.google?.accounts?.id)return resolve();let n=0;const t=setInterval(()=>{if(window.google?.accounts?.id||++n>100){clearInterval(t);resolve()}},50)});
  await wait();if(!window.google?.accounts?.id){showLogin('No se pudo cargar el acceso de Google.');return}
  window.google.accounts.id.initialize({client_id:cfg.clientId,callback:onGoogleCredential,auto_select:false,cancel_on_tap_outside:true});
  googleButton.innerHTML='';window.google.accounts.id.renderButton(googleButton,{theme:'outline',size:'large',text:'signin_with'});
  googleReady=true;loginStatus.textContent='Crea un mundo o escribe un código y luego inicia sesión.';loginGate.classList.remove('hidden');
 }catch(e){console.error('[TEKAYM GOOGLE]',e);showLogin('No se pudo conectar con la configuración de cuenta.')}
}
async function onGoogleCredential(response){
 googleIdToken=String(response?.credential||'');if(!googleIdToken)return;
 loginStatus.textContent='Verificando cuenta…';await startSocket(true);
}
function startSocket(fromLogin=false){
 const url=SERVER_URL+'?room='+encodeURIComponent(activeRoomCode||'main');
 if(url.includes('YOUR-SUBDOMAIN')||url.includes('YOUR-TEKAYM')){loginGate.classList.remove('hidden');loginStatus.textContent='El servidor de Cloudflare todavía no está conectado. El prototipo local está disponible.';boot.classList.add('hidden');hint.textContent='Configura la URL del Worker en src/config.js para activar el multijugador.';spawnProceduralZombies(18);return}
 try{
  socket=new WebSocket(url);
  socket.addEventListener('open',()=>{socket.send(JSON.stringify({type:'join',version:GAME_VERSION,googleIdToken}))});
  socket.addEventListener('message',e=>{const m=JSON.parse(e.data);if(m.type==='connected'){if(Number.isFinite(Number(m.worldClock)))worldClock=Number(m.worldClock);player.id=m.id;if(Number.isFinite(Number(m.x))&&Number.isFinite(Number(m.z))){controls.object.position.set(Number(m.x),1.65,Number(m.z));zoneText.textContent='CELDA '+String(m.cellId||'');}}else if(m.type==='joined'){if(Number.isFinite(Number(m.worldClock)))worldClock=Number(m.worldClock);player.name=m.player.name||player.name;player.hp=Number(m.player.hp??player.hp);player.hunger=Number(m.player.hunger??player.hunger);player.thirst=Number(m.player.thirst??player.thirst);voxelWorld.resetChanges(controls.object.position);if(Array.isArray(m.blocks))voxelWorld.applyChanges(m.blocks);loadRoomInventory();if(Number.isFinite(Number(m.player.x))&&Number.isFinite(Number(m.player.z))){controls.object.position.set(Number(m.player.x),voxelWorld.getHeightAt(Number(m.player.x),Number(m.player.z)),Number(m.player.z));voxelWorld.updateStreaming(controls.object.position);streamedChunkX=Math.floor(controls.object.position.x/16);streamedChunkZ=Math.floor(controls.object.position.z/16);}zoneText.textContent='MUNDO '+activeRoomCode;connected=true;loginGate.classList.add('hidden');boot.classList.add('hidden');applyState({players:[m.player]});saveWorld();}else if(m.type==='block_edit'){voxelWorld.applyChanges([{x:Number(m.x),y:Number(m.y),z:Number(m.z),id:Number(m.id)}]);saveWorld();}else if(m.type==='room_closed'){showLogin(m.message||'El anfitrión no está conectado.');try{socket?.close()}catch{}connected=false;}else if(m.type==='auth_error'){showLogin(m.message||'Cuenta no válida.')}else if(m.type==='auth_required'){showLogin('Inicia sesión con Google para entrar.')}else if(m.type==='attack_ack'){const hit=zombies.find(z=>z.userData.id===m.targetId);if(hit&&Number.isFinite(Number(m.zombieHp))){hit.userData.hp=Number(m.zombieHp);hit.visible=hit.userData.hp>0;}}else if(m.type==='state'){applyState(m)}else if(m.type==='chat'){console.log('[CHAT]',m.from,m.text)}});
  socket.addEventListener('close',()=>{connected=false;if(!player.dead&&fromLogin)showLogin('Conexión cerrada. Crea o únete al mundo para volver a entrar.')});
 }catch(e){console.error('[TEKAYM WS]',e);showLogin('No se pudo conectar con el servidor.')}
}
function applyState(m){
 for(const p of m.players||[]){
  if(p.id===player.id){player.hp=Number(p.hp??player.hp);player.hunger=Number(p.hunger??player.hunger);player.thirst=Number(p.thirst??player.thirst);if(player.hp<=0&&!player.dead){player.dead=true;setBoot('Has muerto. Recargando…');boot.classList.remove('hidden');setTimeout(()=>location.reload(),1200)}continue}
  let obj=remotePlayers.get(p.id);
  if(!obj){obj=new THREE.Mesh(new THREE.CapsuleGeometry(.3,.9,5,8),new THREE.MeshStandardMaterial({color:0x6bb7ff,roughness:.9}));scene.add(obj);remotePlayers.set(p.id,obj)}
  obj.position.set(Number(p.x)||0,voxelWorld.getHeightAt(Number(p.x)||0,Number(p.z)||0)-.9,Number(p.z)||0);
 }
 for(const data of m.zombies||[]){
  const zombie=zombies.find(z=>z.userData.id===data.id);if(!zombie)continue;
  zombie.userData.hp=Number(data.hp??zombie.userData.hp);zombie.userData.targetX=Number(data.x);zombie.userData.targetZ=Number(data.z);
  zombie.visible=zombie.userData.hp>0&&isNight()&&Number(String(zombie.userData.id).slice(1))<7;
 }
}
function sendMove(now){
 if(socket?.readyState!==WebSocket.OPEN||!connected||now-lastNet<250)return;
 const x=controls.object.position.x,z=controls.object.position.z;
 if(Math.hypot(x-lastSentX,z-lastSentZ)<.12)return;
 lastNet=now;lastSentX=x;lastSentZ=z;socket.send(JSON.stringify({type:'move',x,z}));
}
function installTouch(){
 const move=$('moveStick'),mk=$('moveKnob'),look=$('lookStick'),lk=$('lookKnob');let mi=null,li=null;
 const point=(stick,knob,e)=>{const r=stick.getBoundingClientRect(),cx=r.width/2,cy=r.height/2;let x=e.clientX-r.left-cx,y=e.clientY-r.top-cy;const n=Math.hypot(x,y);if(n>38){x=x/n*38;y=y/n*38}knob.style.transform='translate('+x+'px,'+y+'px)';return{x:x/38,y:y/38}};
 move.addEventListener('pointerdown',e=>{mi=e.pointerId;move.setPointerCapture(mi);point(move,mk,e)});
 move.addEventListener('pointermove',e=>{if(e.pointerId!==mi)return;const v=point(move,mk,e);keys.a=v.x<-.2;keys.d=v.x>.2;keys.w=v.y<-.2;keys.s=v.y>.2});
 move.addEventListener('pointerup',()=>{mi=null;mk.style.transform='translate(0,0)';keys.w=keys.a=keys.s=keys.d=false});
 look.addEventListener('pointerdown',e=>{li=e.pointerId;look.setPointerCapture(li)});
 look.addEventListener('pointermove',e=>{if(e.pointerId!==li)return;const v=point(look,lk,e);lookYaw-=v.x*.035;lookPitch=Math.max(-1.2,Math.min(1.2,lookPitch-v.y*.025));camera.rotation.order='YXZ';camera.rotation.y=lookYaw;camera.rotation.x=lookPitch});
 look.addEventListener('pointerup',()=>{li=null;lk.style.transform='translate(0,0)'});
 $('touchAttack').addEventListener('click',attack);$('touchEat')?.addEventListener('click',eatFood);$('touchMine').addEventListener('click',mineBlock);$('touchPlace').addEventListener('click',placeSelectedBlock);$('touchSelect').addEventListener('click',selectNextBlock);$('touchCraft')?.addEventListener('click',craftPlanks);$('touchSword')?.addEventListener('click',craftSword);$('touchShovel')?.addEventListener('click',craftShovel);$('touchRun')?.addEventListener('click',()=>{keys.shift=!keys.shift;$('touchRun').textContent=keys.shift?'CORRIENDO':'CORRER';});$('touchFs').addEventListener('click',()=>document.documentElement.requestFullscreen?.());
}
installTouch();
addEventListener('resize',()=>{camera.aspect=innerWidth/innerHeight;camera.updateProjectionMatrix();renderer.setSize(innerWidth,innerHeight);renderer.setPixelRatio(Math.min(devicePixelRatio,innerWidth<=800?1.2:1.6));renderer.shadowMap.enabled=innerWidth>800});
async function bootGame(){
 setBoot('Cargando Tekaym Online · Mundo cúbico…');
 await loadAssets();
 const serverNotConfigured=SERVER_URL.includes('YOUR-SUBDOMAIN')||SERVER_URL.includes('YOUR-TEKAYM');
 if(serverNotConfigured){
  connected=false;boot.classList.add('hidden');loginGate.classList.add('hidden');
  hint.textContent='MUNDO CÚBICO · WASD para moverte · clic para minar · clic derecho para colocar · R cambia bloque.';
  zoneText.textContent='MUNDO PERSONAL · LOCAL';
  return;
 }
 await initGoogle();
 boot.classList.add('hidden');
 if(!googleReady)showLogin('Configura Google y el servidor para iniciar sesión.');
}
bootGame().catch(e=>{console.error('[TEKAYM BOOT]',e);setBoot('Error recuperable del prototipo.');setTimeout(()=>boot.classList.add('hidden'),700);const serverNotConfigured=SERVER_URL.includes('YOUR-SUBDOMAIN')||SERVER_URL.includes('YOUR-TEKAYM');if(serverNotConfigured)loginGate.classList.add('hidden');else initGoogle()});
function isNight(){return worldClock>=650&&worldClock<1150}
 function isDaylight(){return worldClock<650||worldClock>=1150}
 function updateDayCycle(dt){worldClock=(worldClock+dt)%1200;const phase=worldClock/1200*Math.PI*2,elevation=Math.sin(phase),day=THREE.MathUtils.clamp((elevation+.12)/.5,0,1),twilight=THREE.MathUtils.clamp(1-Math.abs(elevation)*4,0,1);const daylight=day*day*(3-2*day);const skyDay=new THREE.Color(0x8bc5e8),skyNight=new THREE.Color(0x071020),skyDawn=new THREE.Color(0xe99560),sky=new THREE.Color().copy(skyNight).lerp(skyDay,daylight).lerp(skyDawn,twilight*.42);scene.background.copy(sky);scene.fog.color.copy(sky);light.intensity=.08+daylight*1.55;light.color.set(isNight()?0x9bb8ed:0xffe2b8);light.position.set(Math.cos(phase)*45,Math.sin(phase)*42,16);hemi.intensity=.25+daylight*1.4;hemi.color.set(isNight()?0x536baf:0xb9e3ff);hemi.groundColor.set(isNight()?0x111a2a:0x4b613c);if(worldClockText){const label=worldClock<600?'DÍA':worldClock<650?'ATARDECER':worldClock<1150?'NOCHE':'AMANECER';const total=Math.floor(worldClock/1200*24*60),hh=String(Math.floor(total/60)).padStart(2,'0'),mm=String(total%60).padStart(2,'0');worldClockText.textContent=label+' · '+hh+':'+mm}const nowNight=isNight(),px=controls.object.position.x,py=controls.object.position.y,pz=controls.object.position.z;sunMesh.position.set(px+Math.cos(phase)*100,py+Math.sin(phase)*82,pz-55);moonMesh.position.set(px-Math.cos(phase)*92,py-Math.sin(phase)*76,pz-48);sunMesh.visible=!nowNight;moonMesh.visible=nowNight||worldClock>=600&&worldClock<650||worldClock>=1150;starField.position.set(px,py,pz);starField.visible=nowNight;if(nowNight&&!nightActive){nightActive=true;let n=0;for(const z of zombies){if(n++>=7)break;z.position.copy(randomZombiePosition());z.userData.hp=45;z.visible=true}}else if(!nowNight&&nightActive){nightActive=false;for(const z of zombies)z.visible=false}for(const z of zombies)if(!nowNight)z.visible=false;updateAnimals(performance.now(),dt);if(performance.now()-lastClockSave>5000){lastClockSave=performance.now();saveWorld();}}
 function animate(now){const dt=Math.min(.05,(now-last)/1000);last=now;if(!player.dead){updateDayCycle(dt);moveLocal(dt);updateNeeds(dt);player.cooldown=Math.max(0,player.cooldown-dt);if(knife)knife.rotation.z=Math.min(-.2,knife.rotation.z+.08);for(const z of zombies){if(!z.visible)continue;if(connected&&Number.isFinite(z.userData.targetX)&&Number.isFinite(z.userData.targetZ)){const tx=z.userData.targetX,tz=z.userData.targetZ;z.position.x+=(tx-z.position.x)*(1-Math.exp(-10*dt));z.position.z+=(tz-z.position.z)*(1-Math.exp(-10*dt));}else if(!connected){const to=controls.object.position.clone().sub(z.position);to.y=0;const d=to.length();if(d<14&&d>1.3){to.normalize();z.position.addScaledVector(to,z.userData.speed*dt);z.position.y=voxelWorld.getHeightAt(z.position.x,z.position.z)-1.65;z.rotation.y=Math.atan2(to.x,to.z)}}z.position.y=voxelWorld.getHeightAt(z.position.x,z.position.z)-1.65;}sendMove(now);updateHud()}renderer.render(scene,camera);requestAnimationFrame(animate)}
updateHud();requestAnimationFrame(animate);