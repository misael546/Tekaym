import * as THREE from 'three';
import {GLTFLoader} from 'three/addons/loaders/GLTFLoader.js';
import {PointerLockControls} from 'three/addons/controls/PointerLockControls.js';
import {GAME_VERSION,SERVER_URL,HTTP_SERVER_URL} from './config.js';
import {createVoxelWorld} from './voxel-world.js';

const $=id=>document.getElementById(id);
const isTouchDevice=('ontouchstart' in window)||navigator.maxTouchPoints>0||matchMedia('(pointer: coarse)').matches;
const boot=$('boot'),bootStatus=$('bootStatus'),loginGate=$('loginGate'),loginStatus=$('loginStatus'),googleButton=$('googleButton'),gameMenu=$('gameMenu'),inventoryModal=$('inventoryModal'),recipeList=$('recipeList'),inventoryGrid=$('inventoryGrid'),hotbarEl=$('hotbar'); let gameStarted=false,selectedHotbar=0,hotbarSlots=Array(9).fill(null),worldSeed=7919;
const hpText=$('hpText'),hpFill=$('hpFill'),stamText=$('stamText'),stamFill=$('stamFill'),hungerText=$('hungerText'),hungerFill=$('hungerFill'),thirstText=$('thirstText'),thirstFill=$('thirstFill'),zoneText=$('zoneText'),hint=$('hint'),damageFlash=$('damageFlash'),knifeHit=$('knifeHit'),mineButton=$('mineButton'),placeButton=$('placeButton'),inventoryText=$('inventoryText'),selectedText=$('selectedText');
let activeRoomCode='main';

const scene=new THREE.Scene();
scene.background=new THREE.Color(0x8bc5e8);
scene.fog=new THREE.Fog(0x8bc5e8,52,125);
const camera=new THREE.PerspectiveCamera(75,innerWidth/innerHeight,.05,260);
const renderer=new THREE.WebGLRenderer({antialias:true,powerPreference:'high-performance'});
renderer.setPixelRatio(Math.min(devicePixelRatio,isTouchDevice?1.15:1.6));renderer.setSize(innerWidth,innerHeight);renderer.shadowMap.enabled=!isTouchDevice;document.body.appendChild(renderer.domElement);
const controls=new PointerLockControls(camera,renderer.domElement);scene.add(controls.object);
const hemi=new THREE.HemisphereLight(0xb9e3ff,0x4b613c,1.65);scene.add(hemi);
const light=new THREE.DirectionalLight(0xffe2b8,1.6);light.position.set(22,30,16);light.castShadow=true;scene.add(light);
const sunMesh=new THREE.Mesh(new THREE.SphereGeometry(4,12,8),new THREE.MeshBasicMaterial({color:0xffdf88}));scene.add(sunMesh);
const moonMesh=new THREE.Mesh(new THREE.SphereGeometry(2.8,12,8),new THREE.MeshBasicMaterial({color:0xd9e4f5}));scene.add(moonMesh);
const starField=new THREE.Group();for(let i=0;i<70;i++){const star=new THREE.Mesh(new THREE.SphereGeometry(.22+Math.random()*.2,4,4),new THREE.MeshBasicMaterial({color:0xe8efff}));const a=Math.random()*Math.PI*2,e=.12+Math.random()*1.15,r=115;star.position.set(Math.cos(a)*Math.cos(e)*r,Math.sin(e)*r,Math.sin(a)*Math.cos(e)*r);starField.add(star)}scene.add(starField);

let voxelWorld=createVoxelWorld(scene,worldSeed);
zoneText.textContent='MUNDO CÚBICO';
const BLOCK=voxelWorld.BLOCK;
const inventory={1:0,2:0,3:0,4:0,5:0,6:0,7:0,8:0,9:0,10:0,11:0,12:0,13:0,14:0,planks:0,sticks:0,coal:0,furnaceFuel:0,ironIngot:0,goldIngot:0,pickaxe:0,stonePickaxe:0,ironPickaxe:0,axe:0,stoneAxe:0,shovel:0,stoneShovel:0,sword:0,stoneSword:0,ironSword:0,ironAxe:0,ironShovel:0,craftingTable:0,furnace:0,rawBeef:0,rawPork:0,rawChicken:0,cookedBeef:0,cookedPork:0,cookedChicken:0,leather:0,feathers:0};
let selectedBlock=BLOCK.DIRT,worldClock=0;
const torchLights=new Map();
let furnaceQueue=[],furnaceProgress=0;
let audioContext=null,ambientTimer=null,ambientOn=false,ambientIndex=0;
try{const saved=JSON.parse(localStorage.getItem('tekaym-voxel-save-v2-'+activeRoomCode)||'null');if(saved&&Array.isArray(saved.blocks))voxelWorld.applyChanges(saved.blocks);if(saved&&saved.inventory&&typeof saved.inventory==='object')for(const id of Object.keys(inventory))inventory[id]=Math.max(0,Math.min(9999,Number(saved.inventory[id])||0));if(Array.isArray(saved?.furnaceQueue))furnaceQueue=saved.furnaceQueue.filter(j=>j&&['cookedBeef','cookedPork','cookedChicken'].includes(j.output));furnaceProgress=Math.max(0,Math.min(9.99,Number(saved?.furnaceProgress)||0));selectedBlock=Number.isInteger(saved?.selectedBlock)?saved.selectedBlock:BLOCK.DIRT;worldClock=Number.isFinite(saved?.worldClock)?((saved.worldClock%1200)+1200)%1200:0;}catch(e){console.warn('[TEKAYM] No se pudo cargar el mundo guardado',e)}
controls.object.position.copy(voxelWorld.safeSpawn());
syncTorchLights();
const loader=new GLTFLoader(),assetRoot=new THREE.Group();scene.add(assetRoot);
const zombies=[],animals=[],remotePlayers=new Map();
let nightActive=false,lastAnimalSpawn=0,animalSequence=0;
const worldClockText=$('worldClock');let lastClockSave=0;
const keys={w:false,a:false,s:false,d:false};
let streamedChunkX=Infinity,streamedChunkZ=Infinity;
const player={id:null,name:'Jugador',hp:100,maxHp:100,stamina:100,hunger:100,thirst:100,cooldown:0,dead:false,grounded:true,jumpVelocity:0};
let knife=null,handModel=null,heldVisual=null,socket=null,googleIdToken='',lookYaw=0,lookPitch=0,last=performance.now(),lastNet=0,lastSentX=Infinity,lastSentZ=Infinity,lastAutoSave=0,googleReady=false,connected=false;

function setBoot(text){if(bootStatus)bootStatus.textContent=text}
async function requestLandscape(){
 try{if(!document.fullscreenElement&&document.documentElement.requestFullscreen)await document.documentElement.requestFullscreen()}catch(e){console.debug('[TEKAYM] fullscreen unavailable',e)}
 try{if(screen.orientation?.lock)await screen.orientation.lock('landscape')}catch(e){console.debug('[TEKAYM] browser orientation lock unavailable; native APK uses Android manifest',e)}
}
function setKey(e,down){const c=e.code;if(c==='KeyW'||c==='ArrowUp')keys.w=down;else if(c==='KeyA'||c==='ArrowLeft')keys.a=down;else if(c==='KeyS'||c==='ArrowDown')keys.s=down;else if(c==='KeyD'||c==='ArrowRight')keys.d=down;else if(c==='ShiftLeft'||c==='ShiftRight')keys.shift=down;}
function itemLabel(k){return ({'1':'Pasto','2':'Tierra','3':'Piedra','4':'Arena','5':'Tronco','6':'Hojas','7':'Carbón','8':'Mineral de hierro','9':'Mineral de oro','10':'Diamante','11':'Tablas','12':'Mesa de trabajo','13':'Horno','14':'Antorcha',planks:'Tablas',sticks:'Palos',coal:'Carbón',ironIngot:'Lingote de hierro',goldIngot:'Lingote de oro',pickaxe:'Pico de madera',stonePickaxe:'Pico de piedra',ironPickaxe:'Pico de hierro',axe:'Hacha de madera',stoneAxe:'Hacha de piedra',ironAxe:'Hacha de hierro',shovel:'Pala de madera',stoneShovel:'Pala de piedra',ironShovel:'Pala de hierro',sword:'Espada de madera',stoneSword:'Espada de piedra',ironSword:'Espada de hierro',rawBeef:'Carne cruda',rawPork:'Cerdo crudo',rawChicken:'Pollo crudo',cookedBeef:'Carne cocida',cookedPork:'Cerdo cocido',cookedChicken:'Pollo cocido',craftingTable:'Mesa de trabajo',furnace:'Horno',leather:'Cuero',feathers:'Plumas'})[String(k)]||'Objeto'}
function itemGlyph(k){k=String(k);if(['5','11','planks'].includes(k))return '▦';if(['3','7','8','9','10'].includes(k))return '◆';if(['12','13','craftingTable','furnace'].includes(k))return '▧';if(k==='14')return '♨';if(k==='sticks')return '╱';if(k.toLowerCase().includes('pickaxe'))return '⛏';if(k.toLowerCase().includes('axe'))return '⚒';if(k.toLowerCase().includes('sword'))return '⚔';if(k.toLowerCase().includes('shovel'))return '⛏';if(/Beef|Pork|Chicken/.test(k))return '◈';return '■'}
function updateHeldItem(){
 if(!handModel)return;
 if(heldVisual){handModel.remove(heldVisual);heldVisual.traverse(o=>{if(o.geometry)o.geometry.dispose();if(o.material)o.material.dispose()});heldVisual=null}
 const g=new THREE.Group(),skin=new THREE.MeshStandardMaterial({color:0xd6a078,roughness:.92}),sleeve=new THREE.MeshStandardMaterial({color:0x536a84,roughness:.95});
 for(const x of [-.25,.25]){
  const arm=new THREE.Mesh(new THREE.BoxGeometry(.13,.22,.14),sleeve);arm.position.set(x,-.27,-.53);g.add(arm);
  const fist=new THREE.Mesh(new THREE.BoxGeometry(.105,.09,.105),skin);fist.position.set(x,-.14,-.55);g.add(fist);
 }
 const key=hotbarSlots[selectedHotbar];if(key){const k=String(key);
  if(['1','2','3','4','5','6','7','8','9','10','11','12','13','14'].includes(k)){
   const colors={1:0x609447,2:0x79553a,3:0x777c80,4:0xc8b77a,5:0x79502e,6:0x3e713b,7:0x34383d,8:0xb98f78,9:0xe3bd36,10:0x45d9d2,11:0xb98a52,12:0x8b5b32,13:0x55565a,14:0xe9a24b};
   const block=new THREE.Mesh(new THREE.BoxGeometry(.16,.16,.16),new THREE.MeshStandardMaterial({color:colors[k]||0x999999,roughness:.85}));block.position.set(.28,-.12,-.61);g.add(block);
  }else{
   const handle=new THREE.Mesh(new THREE.BoxGeometry(.035,.22,.035),new THREE.MeshStandardMaterial({color:0x79502e,roughness:.9}));handle.position.set(.25,-.1,-.59);g.add(handle);
   if(/sword|pickaxe|axe|shovel/.test(k)){const metal=k.toLowerCase().includes('iron')?0xbec7d1:k.toLowerCase().includes('stone')?0x777c80:0x9b7547;const tool=new THREE.Mesh(new THREE.BoxGeometry(k.includes('sword') ? .045 : .16,k.includes('sword') ? .24 : .06,.035),new THREE.MeshStandardMaterial({color:metal,metalness:.3,roughness:.6}));tool.position.set(.25,.02,-.59);g.add(tool)}
  }
 }
 handModel.add(g);heldVisual=g;
}
function renderHotbar(){if(!hotbarEl)return;hotbarEl.innerHTML='';hotbarSlots.forEach((k,i)=>{const b=document.createElement('button');b.type='button';b.className='hotbarSlot'+(i===selectedHotbar?' active':'');b.innerHTML='<span class="slotNumber">'+(i+1)+'</span><span class="slotGlyph">'+(k?itemGlyph(k):'')+'</span>'+(k?'<span class="slotCount">'+(inventory[k]||0)+'</span>':'');b.addEventListener('click',()=>selectHotbar(i));hotbarEl.appendChild(b)});if(selectedText)selectedText.textContent=hotbarSlots[selectedHotbar]?'EN MANO: '+itemLabel(hotbarSlots[selectedHotbar]):'MANOS VACÍAS';updateHeldItem()}
function selectHotbar(i){selectedHotbar=Math.max(0,Math.min(8,i));const k=hotbarSlots[selectedHotbar];if(k&&Number(k)>=1&&Number(k)<=14)selectedBlock=Number(k);renderHotbar();updateInventoryHud();saveWorld()}
const RECIPES=[{name:'Tablas ×4',cost:{5:1},out:'11',amount:4},{name:'Palos ×4',cost:{11:2},out:'sticks',amount:4},{name:'Mesa de trabajo',cost:{11:4},out:'12',amount:1},{name:'Pico de madera',cost:{11:3,sticks:2},out:'pickaxe',amount:1},{name:'Hacha de madera',cost:{11:3,sticks:2},out:'axe',amount:1},{name:'Pala de madera',cost:{11:1,sticks:2},out:'shovel',amount:1},{name:'Espada de madera',cost:{11:2,sticks:1},out:'sword',amount:1},{name:'Pico de piedra',cost:{3:3,sticks:2},out:'stonePickaxe',amount:1},{name:'Hacha de piedra',cost:{3:3,sticks:2},out:'stoneAxe',amount:1},{name:'Pala de piedra',cost:{3:1,sticks:2},out:'stoneShovel',amount:1},{name:'Espada de piedra',cost:{3:2,sticks:1},out:'stoneSword',amount:1},{name:'Horno',cost:{3:8},out:'13',amount:1},{name:'Antorchas ×4',cost:{coal:1,sticks:1},out:'14',amount:4},{name:'Pico de hierro',cost:{ironIngot:3,sticks:2},out:'ironPickaxe',amount:1},{name:'Espada de hierro',cost:{ironIngot:2,sticks:1},out:'ironSword',amount:1}];
function canCraftRecipe(r){return Object.entries(r.cost).every(([k,n])=>(inventory[k]||0)>=n)}
function renderInventory(){if(!inventoryGrid||!recipeList)return;inventoryGrid.innerHTML='';const keys=Object.keys(inventory).filter(k=>(inventory[k]||0)>0);if(!keys.length)inventoryGrid.innerHTML='<div class="emptyInventory">Tu inventario está vacío. Tala un árbol para empezar.</div>';for(const k of keys){const b=document.createElement('button');b.className='inventoryItem';b.type='button';b.innerHTML='<span>'+itemGlyph(k)+'</span><b>'+itemLabel(k)+'</b><small>×'+inventory[k]+'</small>';b.addEventListener('click',()=>{let i=hotbarSlots.indexOf(String(k));if(i<0){i=hotbarSlots.findIndex(v=>!v);if(i>=0)hotbarSlots[i]=String(k)}if(i>=0)selectHotbar(i);renderInventory()});inventoryGrid.appendChild(b)}recipeList.innerHTML='';const avail=RECIPES.filter(canCraftRecipe);if(!avail.length)recipeList.innerHTML='<div class="emptyInventory">Las recetas aparecerán cuando tengas todos sus materiales.</div>';for(const r of avail){const b=document.createElement('button');b.className='recipeItem';b.type='button';b.innerHTML='<span class="recipeGlyph">'+itemGlyph(r.out)+'</span><span><b>'+r.name+'</b><small>'+Object.entries(r.cost).map(([k,n])=>itemLabel(k)+' '+n).join(' · ')+'</small></span><strong>FABRICAR</strong>';b.addEventListener('click',()=>{if(craftRecipe(r.cost,r.out,r.amount,r.name)){addToHotbar(r.out);renderInventory();renderHotbar()}});recipeList.appendChild(b)}}
function openInventory(){if(!gameStarted)return;renderInventory();inventoryModal?.classList.remove('hidden');if(innerWidth>800&&controls.isLocked)controls.unlock()}
function closeInventory(){inventoryModal?.classList.add('hidden')}
function beginLocalWorld(isNew){if(isTouchDevice)requestLandscape();gameStarted=true;loginGate.classList.add('hidden');gameMenu.classList.add('hidden');inventoryModal?.classList.add('hidden');$('hud').style.display='block';$('touch').style.display='';if(isNew){worldSeed=Math.floor(Math.random()*2147483000)+1;voxelWorld.dispose();voxelWorld=createVoxelWorld(scene,worldSeed);for(const k of Object.keys(inventory))inventory[k]=0;hotbarSlots=Array(9).fill(null);selectedHotbar=0;selectedBlock=BLOCK.DIRT;furnaceQueue=[];furnaceProgress=0;worldClock=0;player.hp=player.maxHp;player.stamina=100;player.hunger=100;player.thirst=100;player.grounded=true;player.jumpVelocity=0;activeRoomCode='local-'+Date.now().toString(36);controls.object.position.copy(voxelWorld.safeSpawn());camera.rotation.set(0,0,0);lookYaw=lookPitch=0;}else{player.grounded=true;player.jumpVelocity=0;activeRoomCode=localStorage.getItem('tekaym-last-world')||'local-default';try{const saved=JSON.parse(localStorage.getItem(roomSaveKey())||'null');if(Number.isFinite(Number(saved?.worldSeed))&&Number(saved.worldSeed)!==worldSeed){worldSeed=Number(saved.worldSeed);voxelWorld.dispose();voxelWorld=createVoxelWorld(scene,worldSeed);controls.object.position.copy(voxelWorld.safeSpawn())}if(saved?.blocks)voxelWorld.applyChanges(saved.blocks);if(saved?.playerPosition&&Number.isFinite(Number(saved.playerPosition.x))&&Number.isFinite(Number(saved.playerPosition.z)))controls.object.position.set(Number(saved.playerPosition.x),Number(saved.playerPosition.y)||voxelWorld.getHeightAt(Number(saved.playerPosition.x),Number(saved.playerPosition.z)),Number(saved.playerPosition.z));if(saved?.inventory)for(const k of Object.keys(inventory))inventory[k]=Math.max(0,Math.min(9999,Number(saved.inventory[k])||0));if(Array.isArray(saved?.hotbarSlots))hotbarSlots=saved.hotbarSlots.slice(0,9).concat(Array(9).fill(null)).slice(0,9);selectedHotbar=Number(saved?.selectedHotbar)||0;selectedBlock=Number(saved?.selectedBlock)||BLOCK.DIRT;worldClock=Number(saved?.worldClock)||0;furnaceQueue=Array.isArray(saved?.furnaceQueue)?saved.furnaceQueue:[];furnaceProgress=Number(saved?.furnaceProgress)||0;}catch(e){console.warn('No se pudo cargar el mundo',e)}}localStorage.setItem('tekaym-last-world',activeRoomCode);voxelWorld.updateStreaming(controls.object.position);streamedChunkX=Math.floor(controls.object.position.x/16);streamedChunkZ=Math.floor(controls.object.position.z/16);syncTorchLights();renderHotbar();spawnProceduralZombies(18);updateInventoryHud();saveWorld();zoneText.textContent='MUNDO '+activeRoomCode;hint.textContent='Tala un árbol con las manos. Pulsa E para inventario y crafteo.'}
function showGameMenu(){if(gameStarted)saveWorld();gameStarted=false;gameMenu?.classList.remove('hidden');$('hud').style.display='none';$('touch').style.display='none';inventoryModal?.classList.add('hidden')}

function audioReady(){if(!audioContext){const C=window.AudioContext||window.webkitAudioContext;if(C)audioContext=new C()}if(audioContext?.state==='suspended')audioContext.resume().catch(()=>{});return audioContext}
function playTone(freq=220,duration=.09,volume=.035,wave='triangle'){const ac=audioReady();if(!ac)return;const osc=ac.createOscillator(),gain=ac.createGain();osc.type=wave;osc.frequency.setValueAtTime(freq,ac.currentTime);gain.gain.setValueAtTime(.0001,ac.currentTime);gain.gain.exponentialRampToValueAtTime(Math.max(.0002,volume),ac.currentTime+.012);gain.gain.exponentialRampToValueAtTime(.0001,ac.currentTime+duration);osc.connect(gain);gain.connect(ac.destination);osc.start();osc.stop(ac.currentTime+duration+.025)}
function playSfx(kind='craft'){const notes={mine:[115,.07,.04,'square'],place:[180,.06,.025,'triangle'],craft:[420,.12,.03,'sine'],cook:[660,.16,.025,'sine'],hit:[90,.1,.04,'sawtooth'],torch:[520,.09,.02,'triangle']};playTone(...(notes[kind]||notes.craft))}
function toggleMusic(){audioReady();ambientOn=!ambientOn;const b=$('audioToggle');if(b)b.textContent=ambientOn?'MÚSICA: ACTIVADA':'MÚSICA: ACTIVAR';if(ambientTimer){clearInterval(ambientTimer);ambientTimer=null}if(ambientOn){const melody=[261.63,329.63,392,329.63,293.66,349.23,440,349.23];ambientIndex=0;const tick=()=>{if(!ambientOn)return;playTone(melody[ambientIndex++%melody.length],.42,.012,'sine');if(ambientIndex%4===0)playTone(melody[(ambientIndex+2)%melody.length]/2,.7,.008,'triangle')};tick();ambientTimer=setInterval(tick,760)}}
function syncTorchLights(){const found=new Map(voxelWorld.serializeChanges().filter(b=>b.id===BLOCK.TORCH).map(b=>[b.x+','+b.y+','+b.z,b]));for(const [key,l] of torchLights){if(!found.has(key)){scene.remove(l);torchLights.delete(key)}}let count=0;for(const [key,b] of found){if(torchLights.has(key)||count++>=36)continue;const l=new THREE.PointLight(0xff9b45,1.25,12,2);l.position.set(b.x+.5,b.y+.65,b.z+.5);scene.add(l);torchLights.set(key,l)}}
function isTorchProtected(x,z){for(const b of voxelWorld.serializeChanges()){if(b.id===BLOCK.TORCH&&Math.abs(x-b.x)+Math.abs(z-b.z)<=11)return true}return false}
function consumeFurnaceFuel(){if(inventory.furnaceFuel<=0){if(inventory.coal<=0)return false;inventory.coal--;inventory.furnaceFuel=8}inventory.furnaceFuel--;return true}
function cookMeat(){if(!hasStation(BLOCK.FURNACE)){hint.textContent='Coloca un horno cerca para cocinar.';return}const raw=inventory.rawBeef?'rawBeef':inventory.rawPork?'rawPork':inventory.rawChicken?'rawChicken':null;if(!raw){hint.textContent='No tienes carne cruda para cocinar.';return}if(furnaceQueue.length>=16){hint.textContent='El horno tiene demasiada comida esperando.';return}if(inventory.furnaceFuel<=0&&inventory.coal<=0){hint.textContent='Necesitas carbón para encender el horno.';return}if(!consumeFurnaceFuel())return;inventory[raw]--;furnaceQueue.push({raw,output:raw.replace('raw','cooked')});hint.textContent='La carne se está cocinando: 10 segundos por pieza. En cola: '+furnaceQueue.length;playSfx('cook');updateInventoryHud();saveWorld()}
function updateFurnace(dt){if(!furnaceQueue.length)return;furnaceProgress+=dt;if(furnaceProgress<10)return;furnaceProgress-=10;const job=furnaceQueue.shift();inventory[job.output]=(inventory[job.output]||0)+1;hint.textContent='¡Carne cocida! '+(furnaceQueue.length?'Quedan '+furnaceQueue.length+' en el horno.':'');playSfx('cook');updateInventoryHud();saveWorld()}
function updateHud(){
 const set=(text,fill,v,max=100)=>{text.textContent=Math.round(v)+' / '+Math.round(max);fill.style.width=Math.max(0,Math.min(100,v/max*100))+'%'};
 set(hpText,hpFill,player.hp,player.maxHp);set(stamText,stamFill,player.stamina);hungerText.textContent=Math.round(player.hunger)+'%';hungerFill.style.width=Math.max(0,Math.min(100,player.hunger))+'%';thirstText.textContent=Math.round(player.thirst)+'%';thirstFill.style.width=Math.max(0,Math.min(100,player.thirst))+'%';
}
function flash(){damageFlash.style.opacity='1';setTimeout(()=>damageFlash.style.opacity='0',120)}
function loadModel(url,scale=1){return new Promise((resolve,reject)=>loader.load(url,g=>{g.scene.scale.setScalar(scale);resolve(g.scene)},undefined,reject))}
async function loadAssets(){setBoot('Generando terreno cúbico…');await new Promise(resolve=>requestAnimationFrame(resolve));setBoot('Preparando manos y mundo…');knife=null;handModel=new THREE.Group();handModel.position.set(0,0,0);camera.add(handModel);updateHeldItem();renderHotbar();updateInventoryHud()}
function randomNearPlayer(min=10,max=28){
 for(let i=0;i<100;i++){const ang=Math.random()*Math.PI*2,d=min+Math.random()*(max-min),x=Math.floor(controls.object.position.x+Math.cos(ang)*d),z=Math.floor(controls.object.position.z+Math.sin(ang)*d),h=voxelWorld.getHeightAt(x,z),gy=Math.floor(h-2.65);
  if(Math.hypot(x-controls.object.position.x,z-controls.object.position.z)<min)continue;
  if(voxelWorld.getBlock(x,gy,z)!==BLOCK.GRASS||voxelWorld.getBlock(x,gy+1,z)||voxelWorld.getBlock(x,gy+2,z))continue;
  return new THREE.Vector3(x,h-1.65,z);
 }
 const x=Math.floor(controls.object.position.x+min),z=Math.floor(controls.object.position.z),h=voxelWorld.getHeightAt(x,z);return new THREE.Vector3(x,h-1.65,z);
}
function randomZombiePosition(){let p;for(let i=0;i<24;i++){p=randomNearPlayer(24,32);if(!isTorchProtected(Math.floor(p.x),Math.floor(p.z)))break}p.y=voxelWorld.getHeightAt(p.x,p.z)-1.65;return p}
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
 if(!connected&&(worldClock<650||worldClock>=1150)&&animals.filter(a=>a.visible&&!a.userData.networked).length<8&&now-lastAnimalSpawn>2200){spawnAnimal(['chicken','pig','cow'][Math.floor(Math.random()*3)]);lastAnimalSpawn=now}
 for(const a of animals){if(!a.visible)continue;if(a.userData.networked){const tx=Number(a.userData.targetX),tz=Number(a.userData.targetZ);if(Number.isFinite(tx)&&Number.isFinite(tz)){a.position.x+=(tx-a.position.x)*Math.min(1,dt*5);a.position.z+=(tz-a.position.z)*Math.min(1,dt*5);a.position.y=voxelWorld.getHeightAt(a.position.x,a.position.z)-1.65}continue}a.userData.nextTurn-=dt;if(a.userData.nextTurn<=0){a.userData.dir=Math.random()*Math.PI*2;a.userData.nextTurn=2+Math.random()*4}
  const speed=a.userData.type==='chicken'?.58:.34,nx=a.position.x+Math.sin(a.userData.dir)*speed*dt,nz=a.position.z+Math.cos(a.userData.dir)*speed*dt;
  if(Math.hypot(nx-controls.object.position.x,nz-controls.object.position.z)<36){a.position.x=nx;a.position.z=nz;a.position.y=voxelWorld.getHeightAt(nx,nz)-1.65;a.rotation.y=a.userData.dir}
  if(Math.hypot(a.position.x-controls.object.position.x,a.position.z-controls.object.position.z)>58)a.visible=false;
 }
}
function jumpPlayer(){if(gameStarted&&!player.dead&&player.grounded){player.jumpVelocity=7.4;player.grounded=false;}}
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
 if(v.lengthSq()){v.normalize();const yaw=isTouchDevice?camera.rotation.y:controls.object.rotation.y;const dir=v.applyAxisAngle(new THREE.Vector3(0,1,0),yaw);const next=controls.object.position.clone().addScaledVector(dir,speed*dt);const limit=99900;if(Math.abs(next.x)<limit&&Math.abs(next.z)<limit){if(player.grounded)next.y=voxelWorld.getHeightAt(next.x,next.z);if(canOccupy(next.x,next.z,next.y))controls.object.position.copy(next)}player.stamina=Math.max(0,player.stamina-(sprinting?24:3)*dt)}else player.stamina=Math.min(100,player.stamina+22*dt);
 const pos=controls.object.position,groundY=voxelWorld.getHeightAt(pos.x,pos.z);
 if(player.grounded){pos.y=groundY;player.jumpVelocity=0}
 else{const oldY=pos.y;player.jumpVelocity-=18*dt;pos.y+=player.jumpVelocity*dt;if(pos.y<=groundY){pos.y=groundY;player.jumpVelocity=0;player.grounded=true}else if(!canOccupy(pos.x,pos.z,pos.y)){pos.y=oldY;player.jumpVelocity=Math.min(0,player.jumpVelocity)}}
 const cx=Math.floor(pos.x/16),cz=Math.floor(pos.z/16);if(cx!==streamedChunkX||cz!==streamedChunkZ){streamedChunkX=cx;streamedChunkZ=cz;voxelWorld.updateStreaming(pos)}
}
function updateNeeds(dt){
 player.hunger=Math.max(0,player.hunger-.18*dt);player.thirst=Math.max(0,player.thirst-.26*dt);
 if(player.hunger===0||player.thirst===0)player.hp=Math.max(0,player.hp-.8*dt);
 if(player.hp<=0&&!player.dead){player.dead=true;setBoot('Has muerto. Recargando…');boot.classList.remove('hidden');setTimeout(()=>location.reload(),1200)}
}
function roomSaveKey(){return 'tekaym-voxel-save-v2-'+activeRoomCode}
function saveWorld(){
 try{localStorage.setItem(roomSaveKey(),JSON.stringify({blocks:voxelWorld.serializeChanges(),inventory,selectedBlock,selectedHotbar,hotbarSlots,worldSeed,playerPosition:{x:controls.object.position.x,y:controls.object.position.y,z:controls.object.position.z},worldClock,furnaceQueue,furnaceProgress,updatedAt:Date.now()}));}catch(e){console.warn('[TEKAYM] No se pudo guardar el mundo',e)}
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
function updateInventoryHud(){if(inventoryText)inventoryText.textContent='Objetos: '+Object.values(inventory).reduce((a,v)=>a+(Number(v)||0),0);renderHotbar()}
function mineBlock(){
 if(player.dead)return;
 const hit=voxelWorld.targetFromCamera(camera);if(!hit)return;
 const id=voxelWorld.getBlock(hit.x,hit.y,hit.z);if(!id)return;
 const toolNeeded= id===BLOCK.STONE||id===BLOCK.COAL_ORE?'pickaxe':id===BLOCK.IRON_ORE?'stonePickaxe':id===BLOCK.GOLD_ORE||id===BLOCK.DIAMOND_ORE?'ironPickaxe':null;
 if(toolNeeded&&!inventory[toolNeeded]){hint.textContent=toolNeeded==='pickaxe'?'Necesitas un pico de madera para picar piedra y carbón.':toolNeeded==='stonePickaxe'?'Necesitas un pico de piedra para extraer hierro.':'Necesitas un pico de hierro para extraer oro y diamante.';return;}
 const removed=voxelWorld.breakBlock(camera);if(!removed)return;
 const drops={ [BLOCK.GRASS]:BLOCK.DIRT,[BLOCK.DIRT]:BLOCK.DIRT,[BLOCK.STONE]:BLOCK.STONE,[BLOCK.SAND]:BLOCK.SAND,[BLOCK.WOOD]:BLOCK.WOOD,[BLOCK.LEAVES]:BLOCK.LEAVES,[BLOCK.COAL_ORE]:'coal',[BLOCK.IRON_ORE]:BLOCK.IRON_ORE,[BLOCK.GOLD_ORE]:BLOCK.GOLD_ORE,[BLOCK.DIAMOND_ORE]:BLOCK.DIAMOND_ORE,[BLOCK.PLANKS]:BLOCK.PLANKS,[BLOCK.CRAFTING_TABLE]:BLOCK.CRAFTING_TABLE,[BLOCK.FURNACE]:BLOCK.FURNACE,[BLOCK.TORCH]:BLOCK.TORCH };
 const drop=drops[removed];if(drop!==undefined){inventory[drop]=(inventory[drop]||0)+(removed===BLOCK.WOOD&&(inventory.axe>0||inventory.stoneAxe>0||inventory.ironAxe>0)?2:1);addToHotbar(drop)}
 if(socket?.readyState===WebSocket.OPEN&&connected)socket.send(JSON.stringify({type:'block_edit',x:hit.x,y:hit.y,z:hit.z,id:BLOCK.AIR}));
 playSfx('mine');syncTorchLights();updateInventoryHud();saveWorld();
}
function placeSelectedBlock(){
 if(player.dead)return;const activeItem=hotbarSlots[selectedHotbar];if(!activeItem||!Number.isInteger(Number(activeItem))||Number(activeItem)<1||Number(activeItem)>14){hint.textContent='Selecciona un bloque en la barra rápida.';return;}selectedBlock=Number(activeItem);if((inventory[selectedBlock]||0)<1){hint.textContent='No tienes '+voxelWorld.blockName(selectedBlock)+' para colocar.';return;}
 const hit=voxelWorld.targetFromCamera(camera);if(!hit)return;
 const x=hit.x+hit.normal.x,y=hit.y+hit.normal.y,z=hit.z+hit.normal.z;
 if(voxelWorld.placeBlock(camera,selectedBlock,controls.object.position)){
  inventory[selectedBlock]--;if(socket?.readyState===WebSocket.OPEN&&connected)socket.send(JSON.stringify({type:'block_edit',x,y,z,id:selectedBlock}));
  playSfx(selectedBlock===BLOCK.TORCH?'torch':'place');syncTorchLights();updateInventoryHud();saveWorld();
 }
}
function selectNextBlock(){
 const ids=[BLOCK.DIRT,BLOCK.STONE,BLOCK.WOOD,BLOCK.SAND,BLOCK.GRASS,BLOCK.PLANKS,BLOCK.CRAFTING_TABLE,BLOCK.FURNACE,BLOCK.TORCH];
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
 inventory[result]=(inventory[result]||0)+amount;addToHotbar(result);hint.textContent='Fabricaste: '+label;playSfx('craft');updateInventoryHud();saveWorld();return true;
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
function smeltIron(){if(!hasStation(BLOCK.FURNACE)){hint.textContent='Primero fabrica y coloca un horno cerca.';return;}if(!inventory[BLOCK.IRON_ORE]){hint.textContent='Necesitas mineral de hierro.';return;}if(inventory.furnaceFuel<=0&&inventory.coal<=0){hint.textContent='Necesitas carbón como combustible.';return;}if(!consumeFurnaceFuel())return;inventory[BLOCK.IRON_ORE]--;inventory.ironIngot++;hint.textContent='Fundiste 1 lingote de hierro.';playSfx('cook');updateInventoryHud();saveWorld();}
function attack(){
 if(player.dead||player.cooldown>0)return;player.cooldown=.65;playSfx('hit');
 const origin=controls.object.position.clone(),forward=new THREE.Vector3();camera.getWorldDirection(forward);let best=null,bestD=2.5,bestType='zombie';
 for(const z of zombies){if(!z.visible||z.userData.hp<=0)continue;const to=z.position.clone().add(new THREE.Vector3(0,.8,0)).sub(origin),d=to.length();if(d>bestD)continue;to.normalize();if(forward.dot(to)<.15)continue;if(d<bestD){best=z;bestD=d;bestType='zombie'}}
 for(const animal of animals){if(!animal.visible)continue;const to=animal.position.clone().add(new THREE.Vector3(0,.55,0)).sub(origin),d=to.length();if(d>bestD)continue;to.normalize();if(forward.dot(to)<.15)continue;if(d<bestD){best=animal;bestD=d;bestType='animal'}}
 if(!best)return;playSfx('hit');
 const held=hotbarSlots[selectedHotbar];const damage=held==='ironSword'?60:held==='stoneSword'?45:held==='sword'?30:held==='ironAxe'?40:held==='stoneAxe'?35:held==='axe'?28:5;
 if(bestType==='animal'){if(connected&&socket?.readyState===WebSocket.OPEN){socket.send(JSON.stringify({type:'animal_attack',targetId:best.userData.id,weapon:inventory.ironSword?'ironSword':inventory.stoneSword?'stoneSword':inventory.sword?'sword':inventory.ironAxe?'ironAxe':inventory.stoneAxe?'stoneAxe':inventory.axe?'axe':'knife'}));return}best.userData.hp-=damage;if(best.userData.hp<=0){if(best.userData.type==='cow'){inventory.rawBeef+=2;if(Math.random()<.7)inventory.leather++}else if(best.userData.type==='pig')inventory.rawPork+=2;else{inventory.rawChicken++;if(Math.random()<.75)inventory.feathers++}best.visible=false;hint.textContent=best.userData.type==='cow'?'Vaca: +2 carne cruda y posibilidad de cuero.':best.userData.type==='pig'?'Cerdo: +2 carne de cerdo.':'Pollo: +1 pollo crudo y posibilidad de plumas.';updateInventoryHud();saveWorld()}return}
 if(socket?.readyState===WebSocket.OPEN&&connected)socket.send(JSON.stringify({type:'knife_attack',targetId:best.userData.id,weapon:inventory.ironSword?'ironSword':inventory.stoneSword?'stoneSword':inventory.sword?'sword':inventory.ironAxe?'ironAxe':inventory.stoneAxe?'stoneAxe':inventory.axe?'axe':'knife'}));
 else if(!connected){best.userData.hp-=damage;if(best.userData.hp<=0){best.visible=false;setTimeout(()=>{if(isNight()){best.position.copy(randomZombiePosition());best.userData.hp=45;best.visible=true}},4000)}}
}
function eatFood(){const type=inventory.cookedBeef?'cookedBeef':inventory.cookedPork?'cookedPork':inventory.cookedChicken?'cookedChicken':inventory.rawBeef?'rawBeef':inventory.rawPork?'rawPork':inventory.rawChicken?'rawChicken':null;if(!type){hint.textContent='No tienes carne. Caza animales para conseguir comida.';return}inventory[type]--;const cooked=type.startsWith('cooked');player.hunger=Math.min(100,player.hunger+(cooked?55:28));hint.textContent=cooked?'Comiste carne cocida: +55 de hambre.':'Comiste carne cruda: +28 de hambre. Cocínala para recuperar más.';playSfx('cook');updateInventoryHud();updateHud();saveWorld()}
addEventListener('keydown',e=>{if(document.activeElement?.tagName==='INPUT')return;if(gameStarted&&['ArrowUp','ArrowDown','ArrowLeft','ArrowRight','Space'].includes(e.code))e.preventDefault();setKey(e,true)});
addEventListener('keyup',e=>setKey(e,false));
addEventListener('keydown',e=>{if(e.repeat)return;if(e.code==='Space')jumpPlayer();if(e.code==='KeyE'){if(inventoryModal?.classList.contains('hidden'))openInventory();else closeInventory()}if(e.code==='Escape'){if(!inventoryModal?.classList.contains('hidden'))closeInventory();else if(gameStarted)showGameMenu()}if(e.code==='KeyQ')placeSelectedBlock();if(e.code==='KeyR')selectHotbar((selectedHotbar+1)%9);if(e.code==='KeyF')eatFood();if(e.code.startsWith('Digit')&&Number(e.code.slice(-1))>=1&&Number(e.code.slice(-1))<=9)selectHotbar(Number(e.code.slice(-1))-1);});
$('eatFood')?.addEventListener('click',eatFood);$('openInventory')?.addEventListener('click',openInventory);$('closeInventory')?.addEventListener('click',closeInventory);$('newLocalWorldButton')?.addEventListener('click',()=>beginLocalWorld(true));$('continueWorldButton')?.addEventListener('click',()=>beginLocalWorld(false));$('menuMultiplayerButton')?.addEventListener('click',()=>{gameMenu.classList.add('hidden');loginGate.classList.remove('hidden');loginStatus.textContent='El multijugador requiere servidor configurado; puedes empezar creando un mundo local.'});$('returnMenuButton')?.addEventListener('click',showGameMenu);
addEventListener('mousedown',e=>{if(innerWidth>800&&controls.isLocked){if(e.button===0)mineBlock();if(e.button===2)placeSelectedBlock();}});
renderer.domElement.addEventListener('contextmenu',e=>e.preventDefault());
renderer.domElement.addEventListener('pointerdown',()=>{if(!ambientOn)toggleMusic()},{once:true});
knifeHit.addEventListener('click',attack);
mineButton?.addEventListener('click',mineBlock);
placeButton?.addEventListener('click',placeSelectedBlock);
$('copyRoomButton')?.addEventListener('click',async()=>{try{await navigator.clipboard.writeText(activeRoomCode);zoneText.textContent='CÓDIGO COPIADO: '+activeRoomCode;}catch{zoneText.textContent='CÓDIGO: '+activeRoomCode;}});
$('craftPlanks')?.addEventListener('click',craftPlanks);
$('craftSticks')?.addEventListener('click',craftSticks);
$('craftPickaxe')?.addEventListener('click',craftPickaxe);
$('craftAxe')?.addEventListener('click',craftAxe);$('craftShovel')?.addEventListener('click',craftShovel);$('craftSword')?.addEventListener('click',craftSword);$('craftTable')?.addEventListener('click',craftTable);$('craftStonePickaxe')?.addEventListener('click',craftStonePickaxe);$('craftStoneAxe')?.addEventListener('click',craftStoneAxe);$('craftStoneSword')?.addEventListener('click',craftStoneSword);$('craftStoneShovel')?.addEventListener('click',craftStoneShovel);$('craftIronPickaxe')?.addEventListener('click',craftIronPickaxe);$('craftIronSword')?.addEventListener('click',craftIronSword);$('craftIronAxe')?.addEventListener('click',craftIronAxe);$('craftIronShovel')?.addEventListener('click',craftIronShovel);$('craftFurnace')?.addEventListener('click',()=>craftRecipe({3:8},BLOCK.FURNACE,1,'Horno'));$('smeltIron')?.addEventListener('click',smeltIron);$('cookMeat')?.addEventListener('click',cookMeat);$('craftTorch')?.addEventListener('click',()=>craftRecipe({sticks:1,coal:1},BLOCK.TORCH,4,'4 antorchas'));$('audioToggle')?.addEventListener('click',toggleMusic);
selectedText?.addEventListener('click',openInventory);
addEventListener('beforeunload',saveWorld);
addEventListener('pagehide',()=>{if(gameStarted)saveWorld();keys.w=keys.a=keys.s=keys.d=false;keys.shift=false});
document.addEventListener('visibilitychange',()=>{if(document.hidden){if(gameStarted)saveWorld();keys.w=keys.a=keys.s=keys.d=false;keys.shift=false;if($('touchRun'))$('touchRun').textContent='CORRER';}});
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
  socket.addEventListener('message',e=>{const m=JSON.parse(e.data);if(m.type==='connected'){if(Number.isFinite(Number(m.worldClock)))worldClock=Number(m.worldClock);player.id=m.id;if(Number.isFinite(Number(m.x))&&Number.isFinite(Number(m.z))){controls.object.position.set(Number(m.x),1.65,Number(m.z));zoneText.textContent='MUNDO '+activeRoomCode;}}else if(m.type==='joined'){if(Number.isFinite(Number(m.worldClock)))worldClock=Number(m.worldClock);player.name=m.player.name||player.name;player.hp=Number(m.player.hp??player.hp);player.hunger=Number(m.player.hunger??player.hunger);player.thirst=Number(m.player.thirst??player.thirst);voxelWorld.resetChanges(controls.object.position);if(Array.isArray(m.blocks))voxelWorld.applyChanges(m.blocks);syncTorchLights();loadRoomInventory();if(Number.isFinite(Number(m.player.x))&&Number.isFinite(Number(m.player.z))){controls.object.position.set(Number(m.player.x),voxelWorld.getHeightAt(Number(m.player.x),Number(m.player.z)),Number(m.player.z));voxelWorld.updateStreaming(controls.object.position);streamedChunkX=Math.floor(controls.object.position.x/16);streamedChunkZ=Math.floor(controls.object.position.z/16);}zoneText.textContent='MUNDO '+activeRoomCode;connected=true;for(const a of animals)if(!a.userData.networked)a.visible=false;loginGate.classList.add('hidden');boot.classList.add('hidden');applyState({players:[m.player]});saveWorld();}else if(m.type==='block_edit'){voxelWorld.applyChanges([{x:Number(m.x),y:Number(m.y),z:Number(m.z),id:Number(m.id)}]);syncTorchLights();saveWorld();}else if(m.type==='room_closed'){showLogin(m.message||'El anfitrión no está conectado.');try{socket?.close()}catch{}connected=false;}else if(m.type==='auth_error'){showLogin(m.message||'Cuenta no válida.')}else if(m.type==='auth_required'){showLogin('Inicia sesión con Google para entrar.')}else if(m.type==='attack_ack'){const hit=zombies.find(z=>z.userData.id===m.targetId);if(hit&&Number.isFinite(Number(m.zombieHp))){hit.userData.hp=Number(m.zombieHp);hit.visible=hit.userData.hp>0;}}else if(m.type==='animal_killed'){playSfx('hit');const drops=m.drops&&typeof m.drops==='object'?m.drops:{};for(const [key,value] of Object.entries(drops)){if(Object.prototype.hasOwnProperty.call(inventory,key))inventory[key]=Math.min(9999,inventory[key]+Math.max(0,Math.floor(Number(value)||0)))}hint.textContent=m.animalType==='cow'?'Vaca cazada: carne y posibles materiales añadidos.':m.animalType==='pig'?'Cerdo cazado: carne añadida al inventario.':'Pollo cazado: carne y posibles plumas añadidas.';updateInventoryHud();saveWorld()}else if(m.type==='state'){applyState(m)}else if(m.type==='chat'){console.log('[CHAT]',m.from,m.text)}});
  socket.addEventListener('close',()=>{connected=false;if(!player.dead&&fromLogin)showLogin('Conexión cerrada. Crea o únete al mundo para volver a entrar.')});
 }catch(e){console.error('[TEKAYM WS]',e);showLogin('No se pudo conectar con el servidor.')}
}
function applyState(m){
 if(Number.isFinite(Number(m.worldClock)))worldClock=((Number(m.worldClock)%1200)+1200)%1200;
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
 if(Array.isArray(m.animals)){
  for(const a of animals)if(a.userData.networked)a.visible=false;
  for(const data of m.animals){
   if(!data||!['chicken','pig','cow'].includes(data.type)||typeof data.id!=='string')continue;
   let a=animals.find(item=>item.userData.id===data.id);
   if(!a){a=makeAnimal(data.type);a.userData.id=data.id;a.userData.networked=true;a.position.set(Number(data.x)||0,voxelWorld.getHeightAt(Number(data.x)||0,Number(data.z)||0)-1.65,Number(data.z)||0);scene.add(a);animals.push(a)}
   a.userData.hp=Number(data.hp??a.userData.hp);a.userData.targetX=Number(data.x);a.userData.targetZ=Number(data.z);a.visible=a.userData.hp>0;
  }
 }

}
function sendMove(now){
 if(socket?.readyState!==WebSocket.OPEN||!connected||now-lastNet<250)return;
 const x=controls.object.position.x,z=controls.object.position.z;
 if(Math.hypot(x-lastSentX,z-lastSentZ)<.12)return;
 lastNet=now;lastSentX=x;lastSentZ=z;socket.send(JSON.stringify({type:'move',x,z}));
}
function installTouch(){
 const move=$('moveStick'),mk=$('moveKnob'),look=$('lookStick'),lk=$('lookKnob');let mi=null,li=null,lastLookX=0,lastLookY=0;
 const point=(stick,knob,e)=>{const r=stick.getBoundingClientRect(),cx=r.width/2,cy=r.height/2;let x=e.clientX-r.left-cx,y=e.clientY-r.top-cy;const n=Math.hypot(x,y);if(n>38){x=x/n*38;y=y/n*38}knob.style.transform='translate('+x+'px,'+y+'px)';return{x:x/38,y:y/38}};
 const resetMove=()=>{mi=null;mk.style.transform='translate(0,0)';keys.w=keys.a=keys.s=keys.d=false};
 const resetLook=()=>{li=null;lk.style.transform='translate(0,0)'};
 move.addEventListener('pointerdown',e=>{e.preventDefault();mi=e.pointerId;move.setPointerCapture(mi);const v=point(move,mk,e);keys.a=v.x<-.2;keys.d=v.x>.2;keys.w=v.y<-.2;keys.s=v.y>.2});
 move.addEventListener('pointermove',e=>{if(e.pointerId!==mi)return;e.preventDefault();const v=point(move,mk,e);keys.a=v.x<-.2;keys.d=v.x>.2;keys.w=v.y<-.2;keys.s=v.y>.2});
 move.addEventListener('pointerup',resetMove);move.addEventListener('pointercancel',resetMove);move.addEventListener('lostpointercapture',resetMove);
 look.addEventListener('pointerdown',e=>{e.preventDefault();li=e.pointerId;lastLookX=e.clientX;lastLookY=e.clientY;look.setPointerCapture(li)});
 look.addEventListener('pointermove',e=>{if(e.pointerId!==li)return;e.preventDefault();const dx=e.clientX-lastLookX,dy=e.clientY-lastLookY;lastLookX=e.clientX;lastLookY=e.clientY;lookYaw-=dx*.006;lookPitch=Math.max(-1.15,Math.min(1.15,lookPitch-dy*.0045));lk.style.transform='translate('+Math.max(-30,Math.min(30,dx*.45))+'px,'+Math.max(-30,Math.min(30,dy*.45))+'px)';camera.rotation.order='YXZ';camera.rotation.y=lookYaw;camera.rotation.x=lookPitch});
 look.addEventListener('pointerup',resetLook);look.addEventListener('pointercancel',resetLook);look.addEventListener('lostpointercapture',resetLook);
 $('touchAttack').addEventListener('click',attack);$('touchJump')?.addEventListener('click',jumpPlayer);$('touchInventory')?.addEventListener('click',openInventory);$('touchEat')?.addEventListener('click',eatFood);$('touchCook')?.addEventListener('click',cookMeat);$('touchTorch')?.addEventListener('click',()=>craftRecipe({sticks:1,coal:1},BLOCK.TORCH,4,'4 antorchas'));$('touchMusic')?.addEventListener('click',toggleMusic);$('touchMine').addEventListener('click',mineBlock);$('touchPlace').addEventListener('click',placeSelectedBlock);$('touchSelect')?.addEventListener('click',()=>selectHotbar((selectedHotbar+1)%9));$('touchCraft')?.addEventListener('click',craftPlanks);$('touchSword')?.addEventListener('click',craftSword);$('touchShovel')?.addEventListener('click',craftShovel);$('touchRun')?.addEventListener('click',()=>{keys.shift=!keys.shift;$('touchRun').textContent=keys.shift?'CORRIENDO':'CORRER';});$('touchFs').addEventListener('click',()=>requestLandscape());
}
installTouch();
addEventListener('resize',()=>{camera.aspect=innerWidth/innerHeight;camera.updateProjectionMatrix();renderer.setSize(innerWidth,innerHeight);renderer.setPixelRatio(Math.min(devicePixelRatio,isTouchDevice?1.15:1.6));renderer.shadowMap.enabled=!isTouchDevice});
async function bootGame(){setBoot('Cargando Tekaym Online…');await loadAssets();boot.classList.add('hidden');showGameMenu();const lastWorld=localStorage.getItem('tekaym-last-world');if($('continueWorldButton'))$('continueWorldButton').disabled=!lastWorld;if($('menuStatus'))$('menuStatus').textContent=lastWorld?'Hay un mundo guardado. Puedes continuar o crear otro.':'Crea tu primer mundo para empezar.'}
bootGame().catch(e=>{console.error('[TEKAYM BOOT]',e);setBoot('No se pudo preparar el juego. Recarga la aplicación.')});
function isNight(){return worldClock>=650&&worldClock<1150}
 function isDaylight(){return worldClock<650||worldClock>=1150}
 function updateDayCycle(dt){worldClock=(worldClock+dt)%1200;const phase=worldClock/1200*Math.PI*2,elevation=Math.sin(phase),day=THREE.MathUtils.clamp((elevation+.12)/.5,0,1),twilight=THREE.MathUtils.clamp(1-Math.abs(elevation)*4,0,1);const daylight=day*day*(3-2*day);const skyDay=new THREE.Color(0x8bc5e8),skyNight=new THREE.Color(0x071020),skyDawn=new THREE.Color(0xe99560),sky=new THREE.Color().copy(skyNight).lerp(skyDay,daylight).lerp(skyDawn,twilight*.42);scene.background.copy(sky);scene.fog.color.copy(sky);light.intensity=.08+daylight*1.55;light.color.set(isNight()?0x9bb8ed:0xffe2b8);light.position.set(Math.cos(phase)*45,Math.sin(phase)*42,16);hemi.intensity=.25+daylight*1.4;hemi.color.set(isNight()?0x536baf:0xb9e3ff);hemi.groundColor.set(isNight()?0x111a2a:0x4b613c);if(worldClockText){const label=worldClock<600?'DÍA':worldClock<650?'ATARDECER':worldClock<1150?'NOCHE':'AMANECER';const total=Math.floor(worldClock/1200*24*60),hh=String(Math.floor(total/60)).padStart(2,'0'),mm=String(total%60).padStart(2,'0');worldClockText.textContent=label+' · '+hh+':'+mm}const nowNight=isNight(),px=controls.object.position.x,py=controls.object.position.y,pz=controls.object.position.z;sunMesh.position.set(px+Math.cos(phase)*100,py+Math.sin(phase)*82,pz-55);moonMesh.position.set(px-Math.cos(phase)*92,py-Math.sin(phase)*76,pz-48);sunMesh.visible=!nowNight;moonMesh.visible=nowNight||worldClock>=600&&worldClock<650||worldClock>=1150;starField.position.set(px,py,pz);starField.visible=nowNight;if(nowNight&&!nightActive){nightActive=true;let n=0;for(const z of zombies){if(n++>=7)break;z.position.copy(randomZombiePosition());z.userData.hp=45;z.visible=true}}else if(!nowNight&&nightActive){nightActive=false;for(const z of zombies)z.visible=false}for(const z of zombies)if(!nowNight)z.visible=false;updateAnimals(performance.now(),dt);if(performance.now()-lastClockSave>5000){lastClockSave=performance.now();saveWorld();}}
 function animate(now){const dt=Math.min(.05,(now-last)/1000);last=now;if(gameStarted&&!player.dead){if(now-lastAutoSave>10000){saveWorld();lastAutoSave=now}updateDayCycle(dt);moveLocal(dt);updateNeeds(dt);updateFurnace(dt);player.cooldown=Math.max(0,player.cooldown-dt);for(const z of zombies){if(!z.visible)continue;if(connected&&Number.isFinite(z.userData.targetX)&&Number.isFinite(z.userData.targetZ)){const tx=z.userData.targetX,tz=z.userData.targetZ;z.position.x+=(tx-z.position.x)*(1-Math.exp(-10*dt));z.position.z+=(tz-z.position.z)*(1-Math.exp(-10*dt));}else if(!connected){const to=controls.object.position.clone().sub(z.position);to.y=0;const d=to.length();if(d<14&&d>1.3){to.normalize();z.position.addScaledVector(to,z.userData.speed*dt);z.position.y=voxelWorld.getHeightAt(z.position.x,z.position.z)-1.65;z.rotation.y=Math.atan2(to.x,to.z)}}z.position.y=voxelWorld.getHeightAt(z.position.x,z.position.z)-1.65;}sendMove(now);updateHud()}renderer.render(scene,camera);requestAnimationFrame(animate)}
updateHud();renderHotbar();requestAnimationFrame(animate);