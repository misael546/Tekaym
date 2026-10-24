import * as THREE from 'three';
import {GLTFLoader} from 'three/addons/loaders/GLTFLoader.js';
import {PointerLockControls} from 'three/addons/controls/PointerLockControls.js';
import {GAME_VERSION,SERVER_URL,HTTP_SERVER_URL} from './config.js';
import {createDirectHost,createDirectGuest} from './direct-p2p.js';
import {createVoxelWorld} from './voxel-world.js';

const $=id=>document.getElementById(id);
let toastTimer=0,toastElement=null;function showToast(message){if(!toastElement){toastElement=document.createElement('div');toastElement.setAttribute('role','status');toastElement.style.cssText='position:fixed;left:50%;top:64px;transform:translateX(-50%);max-width:88vw;padding:9px 13px;border:1px solid #5b6a78;border-radius:9px;background:#111a24ed;color:#f2f5f8;font:700 12px Arial,sans-serif;text-align:center;opacity:0;transition:opacity .15s;pointer-events:none;z-index:80';document.body.appendChild(toastElement)}toastElement.textContent=message;toastElement.style.opacity='1';clearTimeout(toastTimer);toastTimer=setTimeout(()=>{if(toastElement)toastElement.style.opacity='0'},1900)}
const isTouchDevice=('ontouchstart' in window)||navigator.maxTouchPoints>0||matchMedia('(pointer: coarse)').matches;
const serverIsConfigured=!/YOUR-SUBDOMAIN|YOUR-TEKAYM/.test(SERVER_URL);
const boot=$('boot'),bootStatus=$('bootStatus'),loginGate=$('loginGate'),loginStatus=$('loginStatus'),googleButton=$('googleButton'),gameMenu=$('gameMenu'),inventoryModal=$('inventoryModal'),recipeList=$('recipeList'),inventoryGrid=$('inventoryGrid'),hotbarEl=$('hotbar'); let gameStarted=false,selectedHotbar=0,hotbarSlots=Array(8).fill(null),worldSeed=7919,openedCraftingStation=false;
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
const inventory={1:0,2:0,3:0,4:0,5:0,6:0,7:0,8:0,9:0,10:0,11:0,12:0,13:0,14:0,planks:0,sticks:0,coal:0,furnaceFuel:0,ironIngot:0,goldIngot:0,pickaxe:0,stonePickaxe:0,ironPickaxe:0,axe:0,stoneAxe:0,shovel:0,stoneShovel:0,sword:0,stoneSword:0,ironSword:0,ironAxe:0,ironShovel:0,craftingTable:0,furnace:0,rawBeef:0,rawPork:0,rawChicken:0,cookedBeef:0,cookedPork:0,cookedChicken:0,leather:0,feathers:0,stoneTips:0,arrows:0};
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
const player={id:null,name:'Jugador',hp:100,maxHp:100,stamina:100,hunger:100,thirst:100,cooldown:0,dead:false,grounded:true,jumpVelocity:0};let autoJump=null;
let knife=null,handModel=null,heldVisual=null,heldSwing=0,blockParticles=[],droppedItems=[],miningIndicator=null,miningTarget=null,miningProgress=0,miningActive=false,mineSingle=false,miningNdc=null,fallPeakY=null,socket=null,googleIdToken='',lookYaw=0,lookPitch=0,last=performance.now(),lastNet=0,lastSentX=Infinity,lastSentZ=Infinity,lastAutoSave=0,lastP2PHeartbeat=0,googleReady=false,connected=false;
let p2pConnection=null,p2pRole=null,p2pRemoteId='p2p-guest',pendingP2PWorld=null;const p2pHostPeers=new Map();
function disconnectMultiplayer(){
 if(p2pConnection){try{p2pConnection.close()}catch{}}
 for(const peer of p2pHostPeers.values()){try{peer.close()}catch{}}p2pHostPeers.clear();
 p2pConnection=null;p2pRole=null;connected=false;
 const oldSocket=socket;
 socket=null;connected=false;player.id=null;
 if(oldSocket&&oldSocket.readyState<WebSocket.CLOSING){try{oldSocket.close(1000,'Volviendo al menú')}catch{}}
 for(const obj of remotePlayers.values()){
  scene.remove(obj);obj.geometry?.dispose();
  if(Array.isArray(obj.material))for(const mat of obj.material)mat?.dispose();else obj.material?.dispose();
 }
 remotePlayers.clear();
 for(const animal of animals){
  scene.remove(animal);
  animal.traverse(part=>{
   part.geometry?.dispose();
   const mats=Array.isArray(part.material)?part.material:part.material?[part.material]:[];
   for(const mat of mats)mat?.dispose();
  });
 }
 animals.length=0;
 for(const z of zombies)z.visible=false;
}


function setBoot(text){if(bootStatus)bootStatus.textContent=text}
async function requestLandscape(){
 try{if(!document.fullscreenElement&&document.documentElement.requestFullscreen)await document.documentElement.requestFullscreen()}catch(e){console.debug('[TEKAYM] fullscreen unavailable',e)}
 try{if(screen.orientation?.lock)await screen.orientation.lock('landscape')}catch(e){console.debug('[TEKAYM] browser orientation lock unavailable; native APK uses Android manifest',e)}
}
function setKey(e,down){const c=e.code;if(c==='KeyW'||c==='ArrowUp')keys.w=down;else if(c==='KeyA'||c==='ArrowLeft')keys.a=down;else if(c==='KeyS'||c==='ArrowDown')keys.s=down;else if(c==='KeyD'||c==='ArrowRight')keys.d=down;else if(c==='ShiftLeft'||c==='ShiftRight')keys.shift=down;}
function itemLabel(k){return ({'1':'Pasto','2':'Tierra','3':'Piedra','4':'Arena','5':'Tronco','6':'Hojas','7':'Carbón','8':'Mineral de hierro','9':'Mineral de oro','10':'Diamante','11':'Tablas','12':'Mesa de trabajo','13':'Horno','14':'Antorcha',planks:'Tablas',sticks:'Palos',coal:'Carbón',ironIngot:'Lingote de hierro',goldIngot:'Lingote de oro',pickaxe:'Pico de madera',stonePickaxe:'Pico de piedra',ironPickaxe:'Pico de hierro',axe:'Hacha de madera',stoneAxe:'Hacha de piedra',ironAxe:'Hacha de hierro',shovel:'Pala de madera',stoneShovel:'Pala de piedra',ironShovel:'Pala de hierro',sword:'Espada de madera',stoneSword:'Espada de piedra',ironSword:'Espada de hierro',rawBeef:'Carne cruda',rawPork:'Cerdo crudo',rawChicken:'Pollo crudo',cookedBeef:'Carne cocida',cookedPork:'Cerdo cocido',cookedChicken:'Pollo cocido',craftingTable:'Mesa de trabajo',furnace:'Horno',leather:'Cuero',feathers:'Plumas',stoneTips:'Puntas de piedra',arrows:'Flechas'})[String(k)]||'Objeto'}
function itemGlyph(k){
 k=String(k);const l=k.toLowerCase();
 if(['1','2','3','4','5','6','7','8','9','10','11','12','13','14'].includes(k))return ({'1':'🌿','2':'🟫','3':'🪨','4':'🟨','5':'🪵','6':'🍃','7':'⚫','8':'⛏️','9':'🟡','10':'💎','11':'🪵','12':'🧰','13':'🔥','14':'🕯️'})[k];
 if(l==='planks')return '🪵';if(l==='sticks')return '🪄';if(l==='coal')return '⚫';if(l.includes('pickaxe'))return '⛏️';if(l.includes('sword'))return '🗡️';if(l.includes('axe'))return '🪓';if(l.includes('shovel'))return '⛏️';if(l.includes('iron')&&l.includes('ingot'))return '🔩';if(l.includes('gold')&&l.includes('ingot'))return '🟡';if(/beef|pork|chicken/i.test(k))return '🍖';if(l==='craftingtable')return '🧰';if(l==='furnace')return '🔥';if(l==='leather')return '🟤';if(l==='feathers')return '🪶';if(l==='stonetips')return '🔻';if(l==='arrows')return '➶';return '◆';
}
function updateHeldItem(){
 if(!handModel)return;
 if(heldVisual){handModel.remove(heldVisual);heldVisual.traverse(o=>{if(o.geometry)o.geometry.dispose();if(o.material){if(Array.isArray(o.material))o.material.forEach(m=>m.dispose());else o.material.dispose()}});heldVisual=null}
 const g=new THREE.Group(),mat=(color,roughness=.82,metalness=0)=>new THREE.MeshStandardMaterial({color,roughness,metalness});
 const sleeve=mat(0x426b8b),seam=mat(0x253f58),skin=mat(0xdba47c),shade=mat(0xb87955);
 const arm=new THREE.Mesh(new THREE.BoxGeometry(.19,.31,.2),sleeve);arm.position.set(.34,-.34,-.49);arm.rotation.z=-.22;g.add(arm);
 const cuff=new THREE.Mesh(new THREE.BoxGeometry(.195,.07,.205),seam);cuff.position.set(.365,-.205,-.515);cuff.rotation.z=-.22;g.add(cuff);
 const hand=new THREE.Mesh(new THREE.BoxGeometry(.145,.145,.16),skin);hand.position.set(.385,-.13,-.56);hand.rotation.z=-.18;g.add(hand);
 const thumb=new THREE.Mesh(new THREE.BoxGeometry(.06,.095,.075),shade);thumb.position.set(.31,-.145,-.51);thumb.rotation.z=.35;g.add(thumb);
 const key=hotbarSlots[selectedHotbar];if(key){
  const k=String(key),l=k.toLowerCase(),wood=mat(0x8a542e),woodLight=mat(0xb77a43),darkWood=mat(0x59361f),stone=mat(0x7e858b),iron=mat(0xc7d2da,.36,.62),gold=mat(0xe7bd42,.32,.55);
  const pivot=new THREE.Group();pivot.position.set(.39,-.105,-.62);g.add(pivot);
  const cube=(geo,m,pos,rot=null)=>{const o=new THREE.Mesh(geo,m);o.position.set(...pos);if(rot)o.rotation.set(...rot);pivot.add(o);return o};
  if(/^([1-9]|1[0-4])$/.test(k)){
   const c={1:0x609447,2:0x79553a,3:0x777c80,4:0xc8b77a,5:0x79502e,6:0x3e713b,7:0x34383d,8:0xb98f78,9:0xe3bd36,10:0x45d9d2,11:0xb98a52,12:0x8b5b32,13:0x55565a,14:0xe9a24b};
   cube(new THREE.BoxGeometry(.19,.19,.19),[.82,1,.68,.55,.9,.76].map(v=>mat(new THREE.Color(c[k]||0x999999).multiplyScalar(v))),[0,.015,0]);
   if(k==='12'){cube(new THREE.BoxGeometry(.195,.055,.195),woodLight,[0,.075,0]);for(const x of [-.045,.045])cube(new THREE.BoxGeometry(.018,.035,.19),darkWood,[x,.025,0])}
   if(k==='13'){cube(new THREE.BoxGeometry(.07,.07,.012),mat(0x242629),[0,.01,.101]);cube(new THREE.BoxGeometry(.045,.045,.016),mat(0xffa33d),[0,.01,.111])}
   if(k==='14'){cube(new THREE.BoxGeometry(.045,.12,.045),wood,[0,-.035,0]);cube(new THREE.BoxGeometry(.08,.07,.08),mat(0xffb23e,.4),[0,.055,0])}
  }else if(l.includes('sword')){const blade=l.includes('iron')?iron:l.includes('stone')?stone:woodLight;cube(new THREE.BoxGeometry(.075,.28,.035),blade,[0,.105,0],[0,0,-.1]);cube(new THREE.BoxGeometry(.16,.035,.055),gold,[0,-.045,0]);cube(new THREE.BoxGeometry(.045,.12,.045),wood,[0,-.12,0]);cube(new THREE.BoxGeometry(.055,.04,.055),darkWood,[0,-.19,0])}
  else if(l.includes('pickaxe')){const head=l.includes('iron')?iron:l.includes('stone')?stone:woodLight;cube(new THREE.BoxGeometry(.045,.27,.045),wood,[0,-.025,0],[0,0,-.12]);cube(new THREE.BoxGeometry(.25,.055,.055),head,[0,.105,0],[0,0,-.1]);cube(new THREE.BoxGeometry(.055,.09,.055),head,[-.095,.075,0],[0,0,-.42]);cube(new THREE.BoxGeometry(.055,.09,.055),head,[.095,.075,0],[0,0,.42])}
  else if(l.includes('axe')){const head=l.includes('iron')?iron:l.includes('stone')?stone:woodLight;cube(new THREE.BoxGeometry(.045,.27,.045),wood,[0,-.025,0],[0,0,-.12]);cube(new THREE.BoxGeometry(.13,.16,.055),head,[.075,.075,0],[0,0,-.15]);cube(new THREE.BoxGeometry(.065,.08,.06),head,[.135,.02,0],[0,0,-.3])}
  else if(l.includes('shovel')){const head=l.includes('iron')?iron:l.includes('stone')?stone:woodLight;cube(new THREE.BoxGeometry(.045,.27,.045),wood,[0,-.025,0],[0,0,-.1]);cube(new THREE.BoxGeometry(.11,.12,.055),head,[0,.13,0],[0,0,-.08])}
  else{cube(new THREE.BoxGeometry(.045,.25,.045),wood,[0,-.02,0]);cube(new THREE.BoxGeometry(.16,.12,.06),l.includes('ingot')?(l.includes('gold')?gold:iron):woodLight,[0,.11,0])}
 }
 handModel.add(g);heldVisual=g;
}
function swingHeldItem(){heldSwing=1}
function spawnDroppedItem(key,amount,x,y,z,color=null){
 const k=String(key),isBlock=Number.isInteger(Number(k))&&Number(k)>=1&&Number(k)<=14,material=new THREE.MeshStandardMaterial({color:color??({1:0x597342,2:0x6c4934,3:0x77766f,4:0xbda978,5:0x64452b,6:0x365b32,7:0x353633,8:0x8d7768,9:0xbca45b,10:0x5caeaa,11:0x98734b,12:0x785032,13:0x4b4b48,14:0xd7a05b}[k]||0x9a8a70),roughness:.92});
 const meat=/rawBeef|rawPork|rawChicken|cookedBeef|cookedPork|cookedChicken/.test(k),geo=isBlock?new THREE.BoxGeometry(.38,.38,.38):k==='feathers'?new THREE.BoxGeometry(.09,.32,.045):k==='leather'?new THREE.BoxGeometry(.28,.055,.24):k==='arrows'?new THREE.BoxGeometry(.34,.045,.045):meat?new THREE.BoxGeometry(.29,.16,.24):new THREE.BoxGeometry(.24,.24,.24);const mesh=new THREE.Mesh(geo,material);mesh.position.set(x+.5,y+.55,z+.5);mesh.rotation.set(Math.random(),Math.random(),Math.random());mesh.userData={key:k,amount:Math.max(1,amount|0),velocity:new THREE.Vector3((Math.random()-.5)*1.8,2+Math.random()*1.2,(Math.random()-.5)*1.8),life:120,bob:Math.random()*6.28};scene.add(mesh);droppedItems.push(mesh);return mesh;
}
function updateDroppedItems(dt,now){for(let i=droppedItems.length-1;i>=0;i--){const d=droppedItems[i];d.userData.life-=dt;d.userData.velocity.y-=9.8*dt;d.position.addScaledVector(d.userData.velocity,dt);const floor=voxelWorld.getHeightAt(d.position.x,d.position.z)-1.25;if(d.position.y<floor){d.position.y=floor;d.userData.velocity.y=Math.abs(d.userData.velocity.y)*.22;if(Math.abs(d.userData.velocity.y)<.55)d.userData.velocity.y=0;d.userData.velocity.x*=.72;d.userData.velocity.z*=.72}d.rotation.y+=dt*1.5;d.position.y+=Math.sin(now*.004+d.userData.bob)*.0009;if(gameStarted&&d.position.distanceTo(controls.object.position)<1.45){const k=d.userData.key,amt=d.userData.amount;inventory[k]=(inventory[k]||0)+amt;addToHotbar(k);showToast('Recogiste '+itemLabel(k)+(amt>1?' ×'+amt:''));scene.remove(d);d.geometry.dispose();d.material.dispose();droppedItems.splice(i,1);updateInventoryHud();saveWorld();continue}if(d.userData.life<=0){scene.remove(d);d.geometry.dispose();d.material.dispose();droppedItems.splice(i,1)}}}
function spawnBlockParticles(x,y,z,color){
 for(let i=0;i<9;i++){const p=new THREE.Mesh(new THREE.BoxGeometry(.055+Math.random()*.055,.055+Math.random()*.055,.055+Math.random()*.055),new THREE.MeshLambertMaterial({color}));
 p.position.set(x+.2+Math.random()*.6,y+.2+Math.random()*.6,z+.2+Math.random()*.6);p.userData.velocity=new THREE.Vector3((Math.random()-.5)*3,1+Math.random()*2.4,(Math.random()-.5)*3);p.userData.life=.38+Math.random()*.28;scene.add(p);blockParticles.push(p)}
}
function renderHotbar(){if(!hotbarEl)return;hotbarEl.innerHTML='';hotbarSlots.forEach((k,i)=>{const b=document.createElement('button');b.type='button';b.className='hotbarSlot'+(i===selectedHotbar?' active':'');b.innerHTML='<span class="slotNumber">'+(i+1)+'</span><span class="slotGlyph">'+(k?itemGlyph(k):'')+'</span>'+(k?'<span class="slotCount">'+(inventory[k]||0)+'</span>':'');b.addEventListener('click',()=>selectHotbar(i));hotbarEl.appendChild(b)});if(selectedText)selectedText.textContent=hotbarSlots[selectedHotbar]?'EN MANO: '+itemLabel(hotbarSlots[selectedHotbar]):'MANOS VACÍAS';updateHeldItem()}
function selectHotbar(i){selectedHotbar=Math.max(0,Math.min(7,i));const k=hotbarSlots[selectedHotbar];if(k&&Number(k)>=1&&Number(k)<=14)selectedBlock=Number(k);renderHotbar();updateInventoryHud();saveWorld()}
function addToHotbar(key){const k=String(key);if((inventory[k]||0)<=0)return false;if(hotbarSlots.some(v=>String(v)===k))return true;for(let offset=0;offset<hotbarSlots.length;offset++){const i=(selectedHotbar+offset)%hotbarSlots.length;if(hotbarSlots[i]==null||(inventory[String(hotbarSlots[i])]||0)<=0){hotbarSlots[i]=k;renderHotbar();return true}}return false}
const RECIPES=[{name:'Puntas de piedra ×4',cost:{3:1},out:'stoneTips',amount:4},{name:'Flecha ×1',cost:{sticks:1,stoneTips:1,feathers:1},out:'arrows',amount:1},{name:'Tablas ×4',cost:{5:1},out:'11',amount:4},{name:'Palos ×4',cost:{11:2},out:'sticks',amount:4},{name:'Mesa de trabajo',cost:{11:4},out:'12',amount:1},{name:'Pico de madera',cost:{11:3,sticks:2},out:'pickaxe',amount:1},{name:'Hacha de madera',cost:{11:3,sticks:2},out:'axe',amount:1},{name:'Pala de madera',cost:{11:1,sticks:2},out:'shovel',amount:1},{name:'Espada de madera',cost:{11:2,sticks:1},out:'sword',amount:1},{name:'Pico de piedra',cost:{3:3,sticks:2},out:'stonePickaxe',amount:1},{name:'Hacha de piedra',cost:{3:3,sticks:2},out:'stoneAxe',amount:1},{name:'Pala de piedra',cost:{3:1,sticks:2},out:'stoneShovel',amount:1},{name:'Espada de piedra',cost:{3:2,sticks:1},out:'stoneSword',amount:1},{name:'Horno',cost:{3:8},out:'13',amount:1},{name:'Antorchas ×4',cost:{coal:1,sticks:1},out:'14',amount:4},{name:'Pico de hierro',cost:{ironIngot:3,sticks:2},out:'ironPickaxe',amount:1},{name:'Hacha de hierro',cost:{ironIngot:3,sticks:2},out:'ironAxe',amount:1},{name:'Pala de hierro',cost:{ironIngot:1,sticks:2},out:'ironShovel',amount:1},{name:'Espada de hierro',cost:{ironIngot:2,sticks:1},out:'ironSword',amount:1}];
function canCraftRecipe(r){return Object.entries(r.cost).every(([k,n])=>(inventory[k]||0)>=n)}
function renderInventory(){if(!inventoryGrid||!recipeList)return;inventoryGrid.innerHTML='';const owned=Object.keys(inventory).filter(k=>(inventory[k]||0)>0);const assigned=new Set(hotbarSlots.filter(k=>k!=null).map(String));const keys=[...hotbarSlots,...owned.filter(k=>!assigned.has(String(k)))].slice(0,32);for(let i=0;i<32;i++){const k=i<8?hotbarSlots[i]:keys[i]||null;const b=document.createElement('button');b.className='inventoryItem inventorySlot'+(i<8?' quickSlot':'')+(i===selectedHotbar?' selectedInventorySlot':'');b.type='button';if(k){b.innerHTML='<span>'+itemGlyph(k)+'</span><b>'+itemLabel(k)+'</b><small>×'+(inventory[k]||0)+'</small>';}else{b.classList.add('emptySlot');b.innerHTML='<span></span><b></b>';}b.addEventListener('click',()=>{if(i<8){if(k){hotbarSlots[i]=null;renderHotbar();updateInventoryHud();saveWorld();renderInventory();showToast('Objeto guardado en el inventario.');}}else if(k){if(!addToHotbar(k))showToast('La barra rápida está llena. Guarda un objeto de la primera fila para liberar espacio.');updateInventoryHud();saveWorld();renderInventory();}});inventoryGrid.appendChild(b)}recipeList.innerHTML='';const TABLE_RECIPES=new Set(['Pico de piedra','Hacha de piedra','Pala de piedra','Espada de piedra','Pico de hierro','Espada de hierro','Hacha de hierro','Pala de hierro']);for(const r of RECIPES){const hasMaterials=canCraftRecipe(r),needsTable=TABLE_RECIPES.has(r.name),stationReady=!needsTable||openedCraftingStation;const b=document.createElement('button');b.className='recipeItem'+(!hasMaterials||!stationReady?' recipeUnavailable':'');b.type='button';b.disabled=!hasMaterials||!stationReady;b.innerHTML='<span class="recipeGlyph">'+itemGlyph(r.out)+'</span><span><b>'+r.name+'</b><small>'+Object.entries(r.cost).map(([k,n])=>itemLabel(k)+' '+n).join(' · ')+(needsTable&&!openedCraftingStation?' · Requiere mesa':'')+'</small></span><strong>'+(stationReady?(hasMaterials?'FABRICAR':'FALTAN MATERIALES'):'MESA')+'</strong>';b.addEventListener('click',()=>{if(!hasMaterials||!stationReady)return;if(craftRecipe(r.cost,r.out,r.amount,r.name)){renderInventory();renderHotbar()}});recipeList.appendChild(b)}}
function openInventory(){if(!gameStarted)return;openedCraftingStation=false;const title=$('inventoryTitle');if(title)title.textContent='INVENTARIO Y FABRICACIÓN';renderInventory();inventoryModal?.classList.remove('hidden');if(innerWidth>800&&controls.isLocked)controls.unlock()}
function openCraftingTable(){if(!gameStarted)return;openedCraftingStation=true;const title=$('inventoryTitle');if(title)title.textContent='MESA DE TRABAJO';renderInventory();inventoryModal?.classList.remove('hidden');playSfx('craft');if(innerWidth>800&&controls.isLocked)controls.unlock()}
function interactWithBlock(ndc=null){const hit=voxelWorld.targetFromCamera(camera,ndc);if(!hit)return false;if(voxelWorld.getBlock(hit.x,hit.y,hit.z)===BLOCK.CRAFTING_TABLE){openCraftingTable();return true}return false}
function closeInventory(){inventoryModal?.classList.add('hidden');openedCraftingStation=false;const title=$('inventoryTitle');if(title)title.textContent='INVENTARIO Y FABRICACIÓN'}
function beginLocalWorld(isNew){const worldConfig=arguments[1]??null;disconnectMultiplayer();miningActive=false;mineSingle=false;miningTarget=null;miningProgress=0;fallPeakY=null;for(const d of droppedItems){scene.remove(d);d.geometry.dispose();d.material.dispose()}droppedItems=[];if(isTouchDevice)requestLandscape();gameStarted=true;loginGate.classList.add('hidden');gameMenu.classList.add('hidden');$('worldCreateModal')?.classList.add('hidden');$('settingsModal')?.classList.add('hidden');inventoryModal?.classList.add('hidden');$('hud').style.display='block';$('touch').style.display='';if(isNew){miningActive=false;mineSingle=false;miningTarget=null;miningProgress=0;fallPeakY=null;for(const d of droppedItems){scene.remove(d);d.geometry.dispose();d.material.dispose()}droppedItems=[];worldSeed=Number.isFinite(Number(worldConfig?.seed))&&String(worldConfig?.seed).trim()!==''?Number(worldConfig.seed):Math.floor(Math.random()*2147483000)+1;activeRoomCode=worldConfig?.id||'local-'+Date.now().toString(36);currentWorldMeta={id:activeRoomCode,name:worldConfig?.name||'Mi mundo',seed:worldSeed,mode:worldConfig?.mode||'survival',difficulty:worldConfig?.difficulty||'normal',updatedAt:Date.now()};voxelWorld.dispose();voxelWorld=createVoxelWorld(scene,worldSeed);for(const k of Object.keys(inventory))inventory[k]=0;hotbarSlots=Array(8).fill(null);selectedHotbar=0;selectedBlock=BLOCK.DIRT;if(currentWorldMeta.mode==='creative'){hotbarSlots=[1,2,3,4,5,6,7,8];for(let id=1;id<=8;id++)inventory[id]=9999;}furnaceQueue=[];furnaceProgress=0;worldClock=0;player.hp=player.maxHp;player.stamina=100;player.hunger=100;player.thirst=100;player.grounded=true;player.jumpVelocity=0;controls.object.position.copy(voxelWorld.safeSpawn());camera.rotation.set(0,0,0);lookYaw=lookPitch=0;}else{miningActive=false;mineSingle=false;miningTarget=null;miningProgress=0;fallPeakY=null;player.grounded=true;player.jumpVelocity=0;activeRoomCode=worldConfig?.id||localStorage.getItem('tekaym-last-world')||'local-default';currentWorldMeta={...currentWorldMeta,...(worldConfig||{}),id:activeRoomCode};try{const saved=JSON.parse(localStorage.getItem(roomSaveKey())||'null');if(Number.isFinite(Number(saved?.worldSeed))){worldSeed=Number(saved.worldSeed);voxelWorld.dispose();voxelWorld=createVoxelWorld(scene,worldSeed);controls.object.position.copy(voxelWorld.safeSpawn())}if(saved?.blocks)voxelWorld.applyChanges(saved.blocks);if(Array.isArray(saved?.droppedItems))for(const d of saved.droppedItems){if(d&&typeof d.key==='string'&&Number.isFinite(Number(d.x))&&Number.isFinite(Number(d.y))&&Number.isFinite(Number(d.z)))spawnDroppedItem(d.key,d.amount,Number(d.x)-.5,Number(d.y)-.55,Number(d.z)-.5)}if(saved?.playerPosition&&Number.isFinite(Number(saved.playerPosition.x))&&Number.isFinite(Number(saved.playerPosition.z)))controls.object.position.set(Number(saved.playerPosition.x),Number(saved.playerPosition.y)||voxelWorld.getHeightAt(Number(saved.playerPosition.x),Number(saved.playerPosition.z)),Number(saved.playerPosition.z));if(saved?.inventory)for(const k of Object.keys(inventory))inventory[k]=Math.max(0,Math.min(9999,Number(saved.inventory[k])||0));if(Array.isArray(saved?.hotbarSlots))hotbarSlots=saved.hotbarSlots.slice(0,8).concat(Array(8).fill(null)).slice(0,8);selectedHotbar=Number(saved?.selectedHotbar)||0;selectedBlock=Number(saved?.selectedBlock)||BLOCK.DIRT;worldClock=Number(saved?.worldClock)||0;currentWorldMeta={...currentWorldMeta,name:saved?.worldName||currentWorldMeta.name,seed:worldSeed,mode:saved?.gameMode||currentWorldMeta.mode,difficulty:saved?.difficulty||currentWorldMeta.difficulty};furnaceQueue=Array.isArray(saved?.furnaceQueue)?saved.furnaceQueue:[];furnaceProgress=Number(saved?.furnaceProgress)||0;}catch(e){console.warn('No se pudo cargar el mundo',e)}}localStorage.setItem('tekaym-last-world',activeRoomCode);voxelWorld.updateStreaming(controls.object.position);streamedChunkX=Math.floor(controls.object.position.x/16);streamedChunkZ=Math.floor(controls.object.position.z/16);syncTorchLights();renderHotbar();spawnProceduralZombies(18);updateInventoryHud();saveWorld();zoneText.textContent=activeRoomCode.startsWith('local-')?'MUNDO LOCAL':'MUNDO '+activeRoomCode;hint.textContent=''}
function showGameMenu(){if(gameStarted)saveWorld();gameStarted=false;disconnectMultiplayer();gameMenu?.classList.remove('hidden');$('hud').style.display='none';$('touch').style.display='none';$('touchAimSphere').style.display='none';inventoryModal?.classList.add('hidden');renderSavedWorlds()}

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
function makePixelNoiseTexture(seed=1){
 const canvas=document.createElement('canvas');canvas.width=canvas.height=16;
 const ctx=canvas.getContext('2d');
 const palettes={
  17:['#477a52','#386346','#5d8f5b','#6b9b63'],
  29:['#6f9a55','#5e8248','#8eb86c','#a1c87c'],
  43:['#303e8b','#242f6f','#3c4caa','#5061ba'],
  53:['#ffffff','#eee5d7','#f8f2e8','#d9d0c1'],
  67:['#eaa0a0','#d98b8e','#f6b2b2','#f8c2b8'],
  79:['#f3f0e5','#fff8e9','#ece4d4','#d5c9b5']
 };
 const palette=palettes[seed]||['#77766f','#66655f','#8b8980','#a19e93','#565650'];
 let n=seed>>>0;const random=()=>{n=(n*1664525+1013904223)>>>0;return n/4294967296};
 for(let y=0;y<16;y++)for(let x=0;x<16;x++){
  const cluster=(Math.floor(x/2)+Math.floor(y/2)*3+Math.floor(random()*3))%palette.length;
  ctx.fillStyle=palette[cluster];ctx.fillRect(x,y,1,1);
 }
 // Tiny, deterministic patches make the 16px surfaces read as fabric, fur, or worn armor rather than white noise.
 for(let i=0;i<9;i++){const x=Math.floor(random()*14),y=Math.floor(random()*14);ctx.fillStyle=palette[Math.floor(random()*palette.length)];ctx.fillRect(x,y,2,2)}
 const texture=new THREE.CanvasTexture(canvas);texture.magFilter=THREE.NearestFilter;texture.minFilter=THREE.NearestFilter;texture.generateMipmaps=false;texture.colorSpace=THREE.SRGBColorSpace;return texture;
}
function spawnProceduralZombies(count){
 count=currentWorldMeta.mode==='creative'||currentWorldMeta.difficulty==='peaceful'?0:currentWorldMeta.difficulty==='easy'?8:currentWorldMeta.difficulty==='hard'?24:18;
 for(let i=0;i<count;i++){
  let z=zombies[i];
  if(!z){
   z=new THREE.Group();
   const shirt=new THREE.MeshStandardMaterial({color:0x477a52,roughness:1,map:makePixelNoiseTexture(17)});const torso=new THREE.Mesh(new THREE.BoxGeometry(.58,.78,.3),shirt);torso.position.y=.94;z.add(torso);
   const skin=new THREE.MeshStandardMaterial({color:0x6f9a55,roughness:1,map:makePixelNoiseTexture(29)}),white=new THREE.MeshStandardMaterial({color:0xe6e3d8,roughness:1}),pupil=new THREE.MeshStandardMaterial({color:0x201b18,roughness:1});const head=new THREE.Mesh(new THREE.BoxGeometry(.46,.46,.42),skin);head.position.set(0,1.58,0);z.add(head);for(const x of [-.105,.105]){const eye=new THREE.Mesh(new THREE.BoxGeometry(.09,.055,.025),white);eye.position.set(x,1.62,.222);z.add(eye);const dot=new THREE.Mesh(new THREE.BoxGeometry(.035,.045,.012),pupil);dot.position.set(x,1.62,.24);z.add(dot)}for(const x of [-.39,.39]){const arm=new THREE.Mesh(new THREE.BoxGeometry(.2,.68,.22),skin);arm.position.set(x,.97,0);arm.userData.isZombieArm=true;arm.userData.side=x;z.add(arm)}const pants=new THREE.MeshStandardMaterial({color:0x303e8b,roughness:1,map:makePixelNoiseTexture(43)});for(const x of [-.16,.16]){const leg=new THREE.Mesh(new THREE.BoxGeometry(.23,.55,.25),pants);leg.position.set(x,.28,0);z.add(leg)}
   zombies.push(z);scene.add(z);
  }
  z.position.copy(randomZombiePosition());
  const difficultySpeed=currentWorldMeta.difficulty==='easy'?.8:currentWorldMeta.difficulty==='hard'?1.3:1;
  z.userData={id:'z'+i,hp:45,speed:(1.05+Math.random()*.5)*difficultySpeed,phase:Math.random()*6.28};
  z.visible=false;
  if(z.parent!==scene)scene.add(z);
 }
 for(let i=count;i<zombies.length;i++)zombies[i].visible=false;
}
function makeAnimal(type){
 const root=new THREE.Group(),mat=(color)=>new THREE.MeshStandardMaterial({color,roughness:.9}),coat=mat(type==='cow'?0xe8e1d5:type==='pig'?0xeaa0a0:0xf3f0e5),dark=mat(0x42352d),pink=mat(0xf08e96),yellow=mat(0xe8b52d),red=mat(0xb52e39);
 coat.map=makePixelNoiseTexture(type==='cow'?53:type==='pig'?67:79);coat.needsUpdate=true;
 const size=type==='cow'?[.78,.66,1.05]:type==='pig'?[.72,.5,.9]:[.4,.4,.52],body=new THREE.Mesh(new THREE.BoxGeometry(...size),coat);body.position.y=type==='chicken'?.48:.62;root.add(body);
 if(type==='cow'){for(const [x,y,z] of [[-.2,.72,.12],[.2,.48,-.18]]){const patch=new THREE.Mesh(new THREE.BoxGeometry(.2,.2,.18),dark);patch.position.set(x,y,z);root.add(patch)}}
 const head=new THREE.Mesh(new THREE.BoxGeometry(type==='cow'?.38:.31,type==='chicken'?.28:type==='cow'?.34:.29,.34),coat);head.position.set(0,type==='chicken'?.76:.83,.44);root.add(head);const eyeMat=mat(0x171717),eyeWhite=mat(0xf5f1df);for(const x of [-.105,.105]){const eye=new THREE.Mesh(new THREE.BoxGeometry(.055,.06,.025),eyeWhite);eye.position.set(x,type==='chicken'?.79:.87,.615);root.add(eye);const pupil=new THREE.Mesh(new THREE.BoxGeometry(.025,.04,.012),eyeMat);pupil.position.set(x,type==='chicken'?.79:.87,.633);root.add(pupil)}if(type==='cow'){for(const x of [-.24,.24]){const horn=new THREE.Mesh(new THREE.BoxGeometry(.08,.16,.08),coat);horn.position.set(x,1.02,.42);root.add(horn)}}if(type==='pig'){for(const x of [-.12,.12]){const nostril=new THREE.Mesh(new THREE.BoxGeometry(.035,.04,.015),dark);nostril.position.set(x,.8,.685);root.add(nostril)}}
 if(type==='pig'){const snout=new THREE.Mesh(new THREE.BoxGeometry(.19,.13,.09),pink);snout.position.set(0,.8,.63);root.add(snout)}
 if(type==='chicken'){const beak=new THREE.Mesh(new THREE.ConeGeometry(.07,.14,4),yellow);beak.rotation.x=Math.PI/2;beak.position.set(0,.73,.59);root.add(beak);const comb=new THREE.Mesh(new THREE.SphereGeometry(.06,6,4),red);comb.position.set(0,.96,.42);root.add(comb)}
 if(type==='chicken'){for(const x of [-1,1]){const leg=new THREE.Mesh(new THREE.BoxGeometry(.055,.25,.055),dark);leg.position.set(x*.105,.17,.02);leg.userData.walkLeg=true;leg.userData.phase=x*Math.PI;root.add(leg)}}else{for(const x of [-1,1])for(const z of [-1,1]){const leg=new THREE.Mesh(new THREE.BoxGeometry(.12,.38,.12),dark);leg.position.set(x*size[0]*.3,.2,z*size[2]*.28);leg.userData.walkLeg=true;leg.userData.phase=(x+z)*Math.PI;root.add(leg)}}
 root.userData={type,hp:20,walk:Math.random()*6.28,nextTurn:0,dir:Math.random()*Math.PI*2};return root;
}
function spawnAnimal(type){const a=makeAnimal(type);a.position.copy(randomNearPlayer(8,26));a.userData.id='animal-'+(++animalSequence);scene.add(a);animals.push(a);return a}
function updateAnimals(now,dt){
 if(!connected&&(worldClock<650||worldClock>=1150)&&animals.filter(a=>a.visible&&!a.userData.networked).length<8&&now-lastAnimalSpawn>2200){spawnAnimal(['chicken','pig','cow'][Math.floor(Math.random()*3)]);lastAnimalSpawn=now}
 for(const a of animals){if(!a.visible)continue;for(const part of a.children){if(part.userData.walkLeg)part.rotation.x=Math.sin(now*.009+part.userData.phase)*.28}if(a.userData.networked){const tx=Number(a.userData.targetX),tz=Number(a.userData.targetZ);if(Number.isFinite(tx)&&Number.isFinite(tz)){a.position.x+=(tx-a.position.x)*Math.min(1,dt*5);a.position.z+=(tz-a.position.z)*Math.min(1,dt*5);a.position.y=voxelWorld.getHeightAt(a.position.x,a.position.z)-1.65}continue}a.userData.nextTurn-=dt;if(a.userData.nextTurn<=0){a.userData.dir=Math.random()*Math.PI*2;a.userData.nextTurn=2+Math.random()*4}
  const speed=a.userData.type==='chicken'?.58:.34,nx=a.position.x+Math.sin(a.userData.dir)*speed*dt,nz=a.position.z+Math.cos(a.userData.dir)*speed*dt;
  if(Math.hypot(nx-controls.object.position.x,nz-controls.object.position.z)<36){a.position.x=nx;a.position.z=nz;a.position.y=voxelWorld.getHeightAt(nx,nz)-1.65;a.rotation.y=a.userData.dir}
  if(Math.hypot(a.position.x-controls.object.position.x,a.position.z-controls.object.position.z)>58)a.visible=false;
 }
}
function jumpPlayer(){if(gameStarted&&!player.dead&&player.grounded){player.jumpVelocity=6.6;player.grounded=false;fallPeakY=controls.object.position.y;}}
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
 const sprinting=keys.shift&&player.stamina>1,speed=keys.crouch?1.45:(player.stamina<1?2.1:(sprinting?7.2:4.2));
 const v=new THREE.Vector3((keys.d?1:0)-(keys.a?1:0),0,(keys.s?1:0)-(keys.w?1:0));
 if(v.lengthSq()){v.normalize();const yaw=isTouchDevice?camera.rotation.y:controls.object.rotation.y,dir=v.applyAxisAngle(new THREE.Vector3(0,1,0),yaw),pos=controls.object.position,next=pos.clone().addScaledVector(dir,speed*dt);
  if(Math.abs(next.x)<99900&&Math.abs(next.z)<99900){if(player.grounded){const current=voxelWorld.getHeightAt(pos.x,pos.z),target=voxelWorld.getHeightAt(next.x,next.z);next.y=current;
   if(target>current+.08&&target-current<=.55){const step=next.clone();step.y=target;if(canOccupy(step.x,step.z,step.y)){controls.object.position.x=step.x;controls.object.position.z=step.z;autoJump={from:current,to:target,elapsed:0,duration:.18};player.grounded=false;player.jumpVelocity=0}}
   else if(target<current-.08){if(canOccupy(next.x,next.z,current)){controls.object.position.copy(next);player.grounded=false;player.jumpVelocity=0;fallPeakY=current}}
   else if(canOccupy(next.x,next.z,next.y))controls.object.position.copy(next);
  }else if(canOccupy(next.x,next.z,next.y))controls.object.position.copy(next)}
  player.stamina=Math.max(0,player.stamina-(sprinting?24:3)*dt)
 }else player.stamina=Math.min(100,player.stamina+22*dt);
 const pos=controls.object.position,ground=voxelWorld.getHeightAt(pos.x,pos.z);
 if(autoJump){autoJump.elapsed+=dt;const t=Math.min(1,autoJump.elapsed/autoJump.duration),ease=t*t*(3-2*t);pos.y=autoJump.from+(autoJump.to-autoJump.from)*ease;if(t>=1){pos.y=autoJump.to;autoJump=null;player.grounded=true;player.jumpVelocity=0}}else if(player.grounded){if(ground<pos.y-.18){fallPeakY=pos.y;player.grounded=false;player.jumpVelocity=0}else{pos.y=ground;player.jumpVelocity=0}}else{const old=pos.y;fallPeakY=Math.max(fallPeakY??pos.y,pos.y);player.jumpVelocity-=18*dt;pos.y+=player.jumpVelocity*dt;if(pos.y<=ground){const fallDistance=(fallPeakY??ground)-ground;pos.y=ground;player.jumpVelocity=0;player.grounded=true;if(fallDistance>4.2&&currentWorldMeta.mode!=='creative'){const damage=Math.min(100,Math.ceil((fallDistance-3.5)*11));player.hp=Math.max(0,player.hp-damage);showToast('Caída de '+Math.round(fallDistance)+' bloques: -'+damage+' de vida');flash();playSfx('hit');if(player.hp<=0&&!player.dead){player.dead=true;setBoot('Has muerto por la caída.');boot.classList.remove('hidden');setTimeout(()=>location.reload(),1200)}}fallPeakY=null}else if(!canOccupy(pos.x,pos.z,pos.y)){pos.y=old;player.jumpVelocity=Math.min(0,player.jumpVelocity)}}
 const cx=Math.floor(pos.x/16),cz=Math.floor(pos.z/16);if(cx!==streamedChunkX||cz!==streamedChunkZ){streamedChunkX=cx;streamedChunkZ=cz;voxelWorld.updateStreaming(pos)}
}
function updateNeeds(dt){
 if(currentWorldMeta.mode==='creative')return;
 player.hunger=Math.max(0,player.hunger-.18*dt);player.thirst=Math.max(0,player.thirst-.26*dt);
 if(player.hunger===0||player.thirst===0)player.hp=Math.max(0,player.hp-.8*dt);
 if(player.hp<=0&&!player.dead){player.dead=true;setBoot('Has muerto. Recargando…');boot.classList.remove('hidden');setTimeout(()=>location.reload(),1200)}
}
function roomSaveKey(){return 'tekaym-voxel-save-v2-'+activeRoomCode}
const WORLD_LIST_KEY='tekaym-saved-worlds-v1';
function getSavedWorlds(){try{const v=JSON.parse(localStorage.getItem(WORLD_LIST_KEY)||'[]');return Array.isArray(v)?v.filter(w=>w&&typeof w.id==='string'):[]}catch{return []}}
function putSavedWorld(meta){const list=getSavedWorlds().filter(w=>w.id!==meta.id);list.unshift({...meta,updatedAt:Date.now()});try{localStorage.setItem(WORLD_LIST_KEY,JSON.stringify(list.slice(0,30)))}catch(e){console.warn('[TEKAYM] No se pudo actualizar la lista de mundos',e)}}
function deleteSavedWorld(world){if(!world||!world.id)return;const name=world.name||'Mi mundo';if(!confirm('¿Borrar el mundo «'+name+'» y todo su progreso guardado en este dispositivo? Esta acción no se puede deshacer.'))return;try{localStorage.removeItem('tekaym-voxel-save-v2-'+world.id);const remaining=getSavedWorlds().filter(w=>w.id!==world.id);localStorage.setItem(WORLD_LIST_KEY,JSON.stringify(remaining));if(localStorage.getItem('tekaym-last-world')===world.id)localStorage.removeItem('tekaym-last-world');renderSavedWorlds()}catch(e){console.warn('[TEKAYM] No se pudo borrar el mundo',e);const status=$('menuStatus');if(status)status.textContent='No se pudo borrar el mundo. Revisa el almacenamiento disponible del navegador.'}}
function renderSavedWorlds(){
 const list=$('savedWorldList');if(!list)return;const worlds=getSavedWorlds();list.replaceChildren();
 if(!worlds.length){const empty=document.createElement('div');empty.className='settingsNote';empty.textContent='Todavía no tienes mundos guardados.';list.append(empty)}
 for(const w of worlds){const card=document.createElement('div');card.className='savedWorld';const info=document.createElement('div');info.className='savedWorldInfo';const title=document.createElement('strong');title.textContent=w.name||'Mi mundo';const details=document.createElement('small');details.textContent='Semilla: '+(w.seed??'aleatoria')+' · '+(w.mode==='creative'?'Creativo':'Supervivencia')+' · '+new Date(w.updatedAt||Date.now()).toLocaleDateString();info.append(title,details);const play=document.createElement('button');play.type='button';play.textContent='JUGAR';play.addEventListener('click',()=>beginLocalWorld(false,w));const remove=document.createElement('button');remove.type='button';remove.className='deleteWorldButton';remove.textContent='BORRAR';remove.setAttribute('aria-label','Borrar mundo '+(w.name||'Mi mundo'));remove.addEventListener('click',()=>deleteSavedWorld(w));card.append(info,play,remove);list.append(card)}
 const last=localStorage.getItem('tekaym-last-world');const cont=$('continueWorldButton');if(cont)cont.disabled=!worlds.some(w=>w.id===last);
 const status=$('menuStatus');if(status)status.textContent=worlds.length?worlds.length+' mundo(s) guardado(s) en este dispositivo.':'Crea tu primer mundo para empezar.';
}
let currentWorldMeta={id:'local-default',name:'Mi mundo',seed:7919,mode:'survival',difficulty:'normal'};
function saveWorld(){
 try{
  const meta={...currentWorldMeta,id:activeRoomCode||currentWorldMeta.id,seed:worldSeed,updatedAt:Date.now()};
  currentWorldMeta=meta;putSavedWorld(meta);
  localStorage.setItem(roomSaveKey(),JSON.stringify({blocks:voxelWorld.serializeChanges(),inventory,selectedBlock,selectedHotbar,hotbarSlots,worldSeed,worldName:meta.name,gameMode:meta.mode,difficulty:meta.difficulty,playerPosition:{x:controls.object.position.x,y:controls.object.position.y,z:controls.object.position.z},droppedItems:droppedItems.map(d=>({key:String(d.userData.key),amount:d.userData.amount,x:d.position.x,y:d.position.y,z:d.position.z})),worldClock,furnaceQueue,furnaceProgress,updatedAt:Date.now()}));
 }catch(e){console.warn('[TEKAYM] No se pudo guardar el mundo',e)}
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
 for(let i=0;i<hotbarSlots.length;i++){const k=hotbarSlots[i];if(k!=null&&(inventory[String(k)]||0)<=0)hotbarSlots[i]=null;}
 if(selectedHotbar>=hotbarSlots.length)selectedHotbar=0;
 if(inventoryText)inventoryText.textContent='Objetos: '+Object.values(inventory).reduce((a,v)=>a+(Number(v)||0),0);renderHotbar();
}
function miningTime(id){const tool=String(hotbarSlots[selectedHotbar]||''),isPick=/pickaxe/i.test(tool),isAxe=/axe/i.test(tool),isShovel=/shovel/i.test(tool);if(currentWorldMeta.mode==='creative')return .08;if(id===BLOCK.STONE||id===BLOCK.COAL_ORE)return isPick?(tool==='ironPickaxe'?.65:tool==='stonePickaxe'?1.05:1.45):7.5;if(id===BLOCK.IRON_ORE)return tool==='stonePickaxe'||tool==='ironPickaxe'?1.7:8.5;if(id===BLOCK.GOLD_ORE||id===BLOCK.DIAMOND_ORE)return tool==='ironPickaxe'?2.2:10;if(id===BLOCK.WOOD)return isAxe?.55:2.4;if(id===BLOCK.DIRT||id===BLOCK.GRASS||id===BLOCK.SAND)return isShovel?.35:.75;return isPick||isAxe?.5:1.1}
function ensureMiningIndicator(hit){const marker=$('touchAimSphere');if(!marker)return;marker.style.setProperty('--mine-progress',String(Math.max(0,Math.min(1,miningProgress))));marker.classList.add('mining');marker.setAttribute('aria-label','Progreso al romper bloque '+Math.round(miningProgress*100)+'%')}
function resetMiningIndicator(hide=false){const marker=$('touchAimSphere');if(marker){marker.style.setProperty('--mine-progress','0');marker.classList.remove('mining');marker.removeAttribute('aria-label');if(hide)marker.style.display='none'}}
function mineBlock(ndc=null){if(player.dead)return;miningNdc=ndc;const hit=voxelWorld.targetFromCamera(camera,ndc);if(!hit){miningActive=false;miningTarget=null;miningProgress=0;resetMiningIndicator();return}const id=voxelWorld.getBlock(hit.x,hit.y,hit.z);if(!id){miningActive=false;miningTarget=null;miningProgress=0;resetMiningIndicator();return}miningActive=true;const key=hit.x+','+hit.y+','+hit.z;if(!miningTarget||miningTarget.key!==key){miningTarget={key,x:hit.x,y:hit.y,z:hit.z,id};miningProgress=0}ensureMiningIndicator(hit);swingHeldItem()}
function updateMining(dt){if(!miningActive||player.dead){if(player.dead){miningActive=false;miningTarget=null;miningProgress=0}resetMiningIndicator();return}const hit=voxelWorld.targetFromCamera(camera,miningNdc);if(!hit){miningActive=false;miningTarget=null;miningProgress=0;resetMiningIndicator();return}const id=voxelWorld.getBlock(hit.x,hit.y,hit.z),key=hit.x+','+hit.y+','+hit.z;if(!id){miningActive=false;miningTarget=null;miningProgress=0;resetMiningIndicator();return}if(!miningTarget||miningTarget.key!==key){miningTarget={key,x:hit.x,y:hit.y,z:hit.z,id};miningProgress=0}ensureMiningIndicator(hit);miningProgress+=dt/miningTime(id);if(miningProgress<1)return;const target=miningTarget;if(!target){miningActive=false;miningProgress=0;resetMiningIndicator();return}const removed=voxelWorld.breakBlockAt(target.x,target.y,target.z,target.id);if(!removed){miningActive=false;miningTarget=null;miningProgress=0;resetMiningIndicator();return}const colors={1:0x597342,2:0x6c4934,3:0x77766f,4:0xbda978,5:0x64452b,6:0x365b32,7:0x353633,8:0x8d7768,9:0xbca45b,10:0x5caeaa,11:0x98734b,12:0x785032,13:0x4b4b48,14:0xd7a05b};spawnBlockParticles(hit.x,hit.y,hit.z,colors[removed]||0xaaaaaa);const drops={[BLOCK.GRASS]:BLOCK.DIRT,[BLOCK.DIRT]:BLOCK.DIRT,[BLOCK.STONE]:BLOCK.STONE,[BLOCK.SAND]:BLOCK.SAND,[BLOCK.WOOD]:BLOCK.WOOD,[BLOCK.LEAVES]:BLOCK.LEAVES,[BLOCK.COAL_ORE]:'coal',[BLOCK.IRON_ORE]:BLOCK.IRON_ORE,[BLOCK.GOLD_ORE]:BLOCK.GOLD_ORE,[BLOCK.DIAMOND_ORE]:BLOCK.DIAMOND_ORE,[BLOCK.PLANKS]:BLOCK.PLANKS,[BLOCK.CRAFTING_TABLE]:BLOCK.CRAFTING_TABLE,[BLOCK.FURNACE]:BLOCK.FURNACE,[BLOCK.TORCH]:BLOCK.TORCH};const need=removed===BLOCK.STONE||removed===BLOCK.COAL_ORE?'pickaxe':removed===BLOCK.IRON_ORE?'stonePickaxe':removed===BLOCK.GOLD_ORE||removed===BLOCK.DIAMOND_ORE?'ironPickaxe':null,held=String(hotbarSlots[selectedHotbar]||'');const hasRequiredTool=!need||(need==='pickaxe'?/pickaxe/i.test(held):need==='stonePickaxe'&&(held==='stonePickaxe'||held==='ironPickaxe')||need==='ironPickaxe'&&held==='ironPickaxe');const drop=drops[removed];if(drop!==undefined&&currentWorldMeta.mode!=='creative'&&hasRequiredTool){const amount=removed===BLOCK.WOOD&&(held==='axe'||held==='stoneAxe'||held==='ironAxe')?2:1;spawnDroppedItem(drop,amount,hit.x,hit.y,hit.z,colors[removed])}sendBlockEdit({x:hit.x,y:hit.y,z:hit.z,id:BLOCK.AIR});playSfx('mine');syncTorchLights();updateInventoryHud();saveWorld();miningTarget=null;miningProgress=0;if(miningIndicator)miningIndicator.visible=false;if(mineSingle){miningActive=false;mineSingle=false}}
function placeSelectedBlock(ndc=null){
 if(player.dead)return;const item=hotbarSlots[selectedHotbar];if(!item||!Number.isInteger(Number(item))||Number(item)<1||Number(item)>14){showToast('Selecciona un bloque en la barra rápida para colocarlo.');return}
 selectedBlock=Number(item);if(currentWorldMeta.mode!=='creative'&&(inventory[selectedBlock]||0)<1){showToast('No tienes bloques de ese tipo para colocar.');return}
 const hit=voxelWorld.targetFromCamera(camera,ndc);if(!hit)return;const x=hit.x+hit.normal.x,y=hit.y+hit.normal.y,z=hit.z+hit.normal.z;swingHeldItem();
 if(voxelWorld.placeBlock(camera,selectedBlock,controls.object.position,ndc)){if(currentWorldMeta.mode!=='creative')inventory[selectedBlock]--;sendBlockEdit({x,y,z,id:selectedBlock});spawnBlockParticles(x,y,z,{1:0x609447,2:0x79553a,3:0x777c80,4:0xc8b77a,5:0x79502e,6:0x3e713b,7:0x34383d,8:0xb98f78,9:0xe3bd36,10:0x45d9d2,11:0xb98a52,12:0x8b5b32,13:0x55565a,14:0xe9a24b}[selectedBlock]||0xaaaaaa);playSfx(selectedBlock===BLOCK.TORCH?'torch':'place');syncTorchLights();updateInventoryHud();saveWorld()}else showToast('No se puede colocar ahí: apunta a una cara libre del bloque.')
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
 if(bestType==='animal'){if(connected&&socket?.readyState===WebSocket.OPEN){socket.send(JSON.stringify({type:'animal_attack',targetId:best.userData.id,weapon:inventory.ironSword?'ironSword':inventory.stoneSword?'stoneSword':inventory.sword?'sword':inventory.ironAxe?'ironAxe':inventory.stoneAxe?'stoneAxe':inventory.axe?'axe':'knife'}));return}best.userData.hp-=damage;if(best.userData.hp<=0){if(best.userData.type==='cow'){spawnDroppedItem('rawBeef',2,best.position.x,best.position.y,best.position.z,0x9a3f3c);if(Math.random()<.7)spawnDroppedItem('leather',1,best.position.x+.2,best.position.y,best.position.z+.2,0x7b5035)}else if(best.userData.type==='pig')spawnDroppedItem('rawPork',2,best.position.x,best.position.y,best.position.z,0xb96d69);else{spawnDroppedItem('rawChicken',1,best.position.x,best.position.y,best.position.z,0xe8c8a5);if(Math.random()<.75)spawnDroppedItem('feathers',1,best.position.x+.2,best.position.y,best.position.z+.2,0xe8e6d8)}best.visible=false;hint.textContent=best.userData.type==='cow'?'Vaca: deja carne de res y a veces cuero.':best.userData.type==='pig'?'Cerdo: deja carne de cerdo.':'Pollo: deja pollo y a veces plumas.';updateInventoryHud();saveWorld()}return}
 if(socket?.readyState===WebSocket.OPEN&&connected)socket.send(JSON.stringify({type:'knife_attack',targetId:best.userData.id,weapon:inventory.ironSword?'ironSword':inventory.stoneSword?'stoneSword':inventory.sword?'sword':inventory.ironAxe?'ironAxe':inventory.stoneAxe?'stoneAxe':inventory.axe?'axe':'knife'}));
 else if(!connected){best.userData.hp-=damage;if(best.userData.hp<=0){best.visible=false;setTimeout(()=>{if(isNight()){best.position.copy(randomZombiePosition());best.userData.hp=45;best.visible=true}},4000)}}
}
function eatFood(){const type=inventory.cookedBeef?'cookedBeef':inventory.cookedPork?'cookedPork':inventory.cookedChicken?'cookedChicken':inventory.rawBeef?'rawBeef':inventory.rawPork?'rawPork':inventory.rawChicken?'rawChicken':null;if(!type){hint.textContent='No tienes carne. Caza animales para conseguir comida.';return}inventory[type]--;const cooked=type.startsWith('cooked');player.hunger=Math.min(100,player.hunger+(cooked?55:28));hint.textContent=cooked?'Comiste carne cocida: +55 de hambre.':'Comiste carne cruda: +28 de hambre. Cocínala para recuperar más.';playSfx('cook');updateInventoryHud();updateHud();saveWorld()}
addEventListener('keydown',e=>{if(document.activeElement?.tagName==='INPUT')return;if(gameStarted&&['ArrowUp','ArrowDown','ArrowLeft','ArrowRight','Space'].includes(e.code))e.preventDefault();setKey(e,true)});
addEventListener('keyup',e=>setKey(e,false));
addEventListener('keydown',e=>{if(e.repeat)return;if(e.code==='Space')jumpPlayer();if(e.code==='KeyE'){if(inventoryModal?.classList.contains('hidden')){if(!interactWithBlock())openInventory()}else closeInventory()}if(e.code==='Escape'){if(!inventoryModal?.classList.contains('hidden'))closeInventory();else if(gameStarted)showGameMenu()}if(e.code==='KeyQ')placeSelectedBlock();if(e.code==='KeyR')selectHotbar((selectedHotbar+1)%8);if(e.code==='KeyF')eatFood();if(e.code.startsWith('Digit')&&Number(e.code.slice(-1))>=1&&Number(e.code.slice(-1))<=8)selectHotbar(Number(e.code.slice(-1))-1);});
$('eatFood')?.addEventListener('click',eatFood);$('openInventory')?.addEventListener('click',openInventory);$('closeInventory')?.addEventListener('click',closeInventory);
$('newLocalWorldButton')?.addEventListener('click',()=>{$('worldCreateModal')?.classList.remove('hidden');$('worldNameInput').value='Mi mundo';$('worldSeedInput').value='';});
$('cancelWorldCreate')?.addEventListener('click',()=>$('worldCreateModal')?.classList.add('hidden'));
$('randomSeedButton')?.addEventListener('click',()=>$('worldSeedInput').value=String(Math.floor(Math.random()*2147483000)+1));
$('confirmWorldCreate')?.addEventListener('click',()=>{const name=$('worldNameInput').value.trim()||'Mi mundo';const raw=$('worldSeedInput').value.trim();const seed=raw===''?Math.floor(Math.random()*2147483000)+1:Number(raw);if(!Number.isFinite(seed)){ $('worldSeedInput').focus();return;}const cfg={id:'local-'+Date.now().toString(36)+'-'+Math.floor(Math.random()*9999).toString(36),name,seed,mode:$('worldModeInput').value,difficulty:$('worldDifficultyInput').value};localStorage.setItem('tekaym-last-world',cfg.id);beginLocalWorld(true,cfg);});
$('continueWorldButton')?.addEventListener('click',()=>{const id=localStorage.getItem('tekaym-last-world');const w=getSavedWorlds().find(v=>v.id===id);if(w)beginLocalWorld(false,w);else renderSavedWorlds();});
$('openSettingsButton')?.addEventListener('click',()=>$('settingsModal')?.classList.remove('hidden'));
$('closeSettingsButton')?.addEventListener('click',()=>$('settingsModal')?.classList.add('hidden'));
$('autosaveIntervalInput')?.addEventListener('change',e=>{const n=Number(e.target.value);if(Number.isFinite(n)&&n>=5&&n<=60)localStorage.setItem('tekaym-autosave-seconds',String(n));});
$('touchOpacityInput')?.addEventListener('input',e=>document.documentElement.style.setProperty('--touch-opacity',String(Number(e.target.value)/100)));
$('menuMultiplayerButton')?.addEventListener('click',()=>{$('settingsModal')?.classList.add('hidden');openDirectP2P();});
$('returnMenuButton')?.addEventListener('click',showGameMenu);

function buildDirectP2PModal(){
 if($('directP2PModal'))return;
 const modal=document.createElement('div');modal.id='directP2PModal';modal.className='overlay hidden';
 modal.innerHTML=`<div class="settingsCard p2pCard"><div class="settingsTitle">MUNDO DIRECTO · P2P</div>
 <div class="settingsNote">Tu dispositivo aloja el mundo. No se sube el terreno a un servidor central. Intercambien los códigos completos por un chat privado y mantengan Tekaym abierto. La conexión directa puede revelar datos de red, como la IP, al otro participante; comparte códigos solo con personas de confianza. Algunas redes bloquean la conexión P2P.</div>
 <section class="p2pSection"><h3>SOY EL ANFITRIÓN</h3><button id="p2pMakeOffer" type="button">CREAR INVITACIÓN</button><label>Invitación para tu amigo<textarea id="p2pOfferOut" rows="3" placeholder="Pulsa Crear invitación…"></textarea></label><button id="p2pCopyOffer" class="secondary" type="button">COPIAR INVITACIÓN</button><label>Respuesta de tu amigo<textarea id="p2pAnswerIn" rows="3" placeholder="Pega aquí la respuesta que te envíe"></textarea></label><button id="p2pAcceptAnswer" type="button">CONECTAR AMIGO</button></section>
 <section class="p2pSection"><h3>QUIERO UNIRME</h3><label>Invitación del anfitrión<textarea id="p2pOfferIn" rows="3" placeholder="Pega aquí la invitación del anfitrión"></textarea></label><button id="p2pMakeAnswer" type="button">GENERAR RESPUESTA</button><label>Respuesta para el anfitrión<textarea id="p2pAnswerOut" rows="3" placeholder="Se generará al crear la respuesta"></textarea></label><button id="p2pCopyAnswer" class="secondary" type="button">COPIAR RESPUESTA</button></section>
 <div id="p2pStatus" class="settingsNote" role="status">La conexión directa necesita que ambos intercambien invitación y respuesta.</div>
 <div class="settingsActions"><button id="p2pClose" class="secondary" type="button">CERRAR</button></div></div>`;
 document.body.append(modal);
 const style=document.createElement('style');style.textContent=`#directP2PModal{z-index:90}.p2pCard{max-height:94dvh;overflow:auto;width:min(650px,96vw)}.p2pSection{display:grid;gap:8px;margin:12px 0;padding:10px;border:1px solid #66717b;background:#151d24;color:#f2f4f6}.p2pSection h3{margin:0;font-size:12px;letter-spacing:1px}.p2pSection textarea{box-sizing:border-box;width:100%;resize:vertical;min-height:70px;padding:8px;background:#0a1016;color:#fff;border:1px solid #566371;border-radius:5px;font:11px monospace;overflow-wrap:anywhere}.p2pSection button{padding:9px;border:1px solid #647789;border-radius:5px;background:#526d46;color:#fff;font-weight:800}.p2pSection button.secondary{background:#263544}`;
 document.head.append(style);
 $('p2pClose').addEventListener('click',()=>modal.classList.add('hidden'));
 $('p2pMakeOffer').addEventListener('click',async()=>{
  if(!gameStarted){$('p2pStatus').textContent='Primero abre el mundo que quieres alojar y vuelve a entrar aquí desde el botón AMIGOS.';return}
  try{
   if(p2pRole==='guest'&&p2pConnection){p2pConnection.close();p2pConnection=null;connected=false}
   p2pRole='host';player.id='p2p-host';
   $('p2pStatus').textContent='Preparando conexión directa…';
   const peerId='peer-'+Math.random().toString(36).slice(2,10);const peer=createDirectHost({peerId,onMessage:m=>handleP2PMessage(m,peerId),onOpen:()=>{connected=true;$('p2pStatus').textContent='Amigo conectado directamente. Puedes crear otra invitación para más amigos.';sendP2PWorldSnapshot(peer)},onClose:()=>{p2pHostPeers.delete(peerId);connected=p2pHostPeers.size>0;$('p2pStatus').textContent=connected?'Un amigo se desconectó; las demás conexiones siguen activas.':'La conexión con tu amigo se cerró.'}});p2pHostPeers.set(peerId,peer);p2pConnection=peer;
   $('p2pOfferOut').value=await peer.ready;
   $('p2pStatus').textContent='Invitación lista. Envíala a tu amigo. Después pega aquí la respuesta que él genere.';
  }catch(e){$('p2pStatus').textContent=e.message||'No se pudo crear la invitación.'}
 });
 $('p2pAcceptAnswer').addEventListener('click',async()=>{
  try{if(p2pRole!=='host'||!p2pHostPeers.size)throw new Error('Primero crea una invitación como anfitrión.');const answer=JSON.parse($('p2pAnswerIn').value);const peer=p2pHostPeers.get(answer.peerId);if(!peer)throw new Error('No encuentro la invitación de esta respuesta. Genera y conserva la invitación correspondiente.');await peer.acceptAnswer($('p2pAnswerIn').value);$('p2pStatus').textContent='Respuesta recibida; negociando conexión directa…';}catch(e){$('p2pStatus').textContent=e.message||'No se pudo aceptar la respuesta.'}
 });
 $('p2pMakeAnswer').addEventListener('click',async()=>{
  try{
   if(p2pConnection){p2pConnection.close();p2pConnection=null}for(const peer of p2pHostPeers.values()){try{peer.close()}catch{}}p2pHostPeers.clear();
   p2pRole='guest';p2pRemoteId='p2p-host';connected=false;player.id='p2p-guest';
   $('p2pStatus').textContent='Leyendo invitación y preparando respuesta…';
   p2pConnection=await createDirectGuest($('p2pOfferIn').value,{onMessage:handleP2PMessage,onOpen:()=>{$('p2pStatus').textContent='Conectado al anfitrión. Recibiendo el mundo…';connected=true},onClose:()=>{connected=false;$('p2pStatus').textContent='La conexión con el anfitrión se cerró.'}});
   $('p2pAnswerOut').value=p2pConnection.answerText;
   $('p2pStatus').textContent='Respuesta lista. Envíala al anfitrión y mantén esta pantalla abierta.';
  }catch(e){$('p2pStatus').textContent=e.message||'No se pudo generar la respuesta.'}
 });
 $('p2pCopyOffer').addEventListener('click',()=>copyP2PText('p2pOfferOut'));
 $('p2pCopyAnswer').addEventListener('click',()=>copyP2PText('p2pAnswerOut'));
}
async function copyP2PText(id){const value=$(id)?.value||'';if(!value){$('p2pStatus').textContent='Todavía no hay ningún código para copiar.';return}try{await navigator.clipboard.writeText(value);$('p2pStatus').textContent='Código copiado. Envíalo a tu amigo por un chat privado.'}catch{$(id).focus();$(id).select();$('p2pStatus').textContent='No se pudo copiar automáticamente; mantén pulsado el texto y selecciona Copiar.'}}
function openDirectP2P(){buildDirectP2PModal();$('directP2PModal').classList.remove('hidden');}
function sendP2P(message,target=null){try{if(p2pRole==='host'){if(target)return target.send(message);let sent=false;for(const peer of p2pHostPeers.values())sent=peer.send(message)||sent;return sent}if(p2pConnection&&connected)return p2pConnection.send(message)}catch(e){console.warn('[TEKAYM P2P] No se pudo enviar',e)}return false}
function sendP2PWorldSnapshot(target=null){const blocks=voxelWorld.serializeChanges();sendP2P({type:'world_init_start',seed:worldSeed,meta:currentWorldMeta,worldClock,inventory:{...inventory},hotbarSlots:[...hotbarSlots],selectedBlock,playerPosition:{x:controls.object.position.x,y:controls.object.position.y,z:controls.object.position.z},blockCount:blocks.length},target);for(let i=0;i<blocks.length;i+=250)sendP2P({type:'world_init_blocks',blocks:blocks.slice(i,i+250)},target);sendP2P({type:'world_init_end'},target);}
function sendBlockEdit(edit){
 if(!p2pConnection||!connected){if(socket?.readyState===WebSocket.OPEN)socket.send(JSON.stringify({type:'block_edit',...edit}));return}
 if(p2pRole==='guest')sendP2P({type:'block_request',...edit});
 else {sendP2P({type:'block_edit',...edit});}
}
function handleP2PMessage(message,sourcePeerId=null){
 if(message.type==='world_init_start'&&p2pRole==='guest'){pendingP2PWorld={...message,blocks:[]};return}
 if(message.type==='world_init_blocks'&&p2pRole==='guest'&&pendingP2PWorld){if(Array.isArray(message.blocks))pendingP2PWorld.blocks.push(...message.blocks);return}
 if(message.type==='world_init_end'&&p2pRole==='guest'&&pendingP2PWorld){
  const snapshot=pendingP2PWorld;pendingP2PWorld=null;
  if(Number.isFinite(Number(snapshot.seed))){worldSeed=Number(snapshot.seed);voxelWorld.dispose();voxelWorld=createVoxelWorld(scene,worldSeed);voxelWorld.applyChanges(snapshot.blocks);}
  currentWorldMeta={...(snapshot.meta||{}),id:'p2p-guest-'+String(snapshot.meta?.id||'world'),name:(snapshot.meta?.name||'Mundo de amigo')+' (invitado)',seed:worldSeed};
  activeRoomCode=currentWorldMeta.id;
  let guestSave=null;try{guestSave=JSON.parse(localStorage.getItem(roomSaveKey())||'null')}catch{}
  for(const k of Object.keys(inventory))inventory[k]=Math.max(0,Math.min(9999,Number(guestSave?.inventory?.[k])||0));
  if(Array.isArray(guestSave?.hotbarSlots))hotbarSlots=guestSave.hotbarSlots.slice(0,8).concat(Array(8).fill(null)).slice(0,8);else hotbarSlots=Array(8).fill(null);
  selectedHotbar=Number(guestSave?.selectedHotbar)||0;selectedBlock=Number(guestSave?.selectedBlock)||BLOCK.DIRT;worldClock=Number(snapshot.worldClock)||0;
  if(snapshot.playerPosition){const p=snapshot.playerPosition;controls.object.position.set(Number(p.x)||0,Number(p.y)||voxelWorld.getHeightAt(Number(p.x)||0,Number(p.z)||0),Number(p.z)||0)}
  gameStarted=true;gameMenu.classList.add('hidden');loginGate.classList.add('hidden');boot.classList.add('hidden');$('directP2PModal')?.classList.add('hidden');$('hud').style.display='block';$('touch').style.display='';
  voxelWorld.updateStreaming(controls.object.position);streamedChunkX=Math.floor(controls.object.position.x/16);streamedChunkZ=Math.floor(controls.object.position.z/16);syncTorchLights();renderHotbar();updateInventoryHud();saveWorld();zoneText.textContent='INVITADO · '+(snapshot.meta?.name||'MUNDO');
  $('p2pStatus').textContent='Mundo recibido. Los cambios de bloques se transmitirán al anfitrión.';return;
 }
 if(message.type==='block_request'&&p2pRole==='host'){
  const edit={x:Number(message.x),y:Number(message.y),z:Number(message.z),id:Number(message.id)};
  if([edit.x,edit.y,edit.z,edit.id].every(Number.isFinite)){voxelWorld.applyChanges([edit]);syncTorchLights();saveWorld();sendP2P({type:'block_edit',...edit})}return;
 }
 if(message.type==='block_edit'){const edit={x:Number(message.x),y:Number(message.y),z:Number(message.z),id:Number(message.id)};if([edit.x,edit.y,edit.z,edit.id].every(Number.isFinite)){voxelWorld.applyChanges([edit]);syncTorchLights();saveWorld()}return}
 if(message.type==='player_state'){
  if(p2pRole==='guest'&&Number.isFinite(Number(message.worldClock)))worldClock=((Number(message.worldClock)%1200)+1200)%1200;
  const id=p2pRole==='host'?'p2p-guest-'+String(sourcePeerId||'friend'):'p2p-host';applyState({players:[{id,x:Number(message.x)||0,z:Number(message.z)||0,hp:100,hunger:100,thirst:100}]});return;
 }
}

const friendsButton=document.createElement('button');friendsButton.type='button';friendsButton.className='worldbtn';friendsButton.id='directP2PButton';friendsButton.textContent='AMIGOS';friendsButton.addEventListener('click',openDirectP2P);$('hud')?.querySelector('.worldbar')?.append(friendsButton);
addEventListener('mousedown',e=>{if(!isTouchDevice&&innerWidth>800&&controls.isLocked){if(e.button===0){mineSingle=false;mineBlock()}if(e.button===2)placeSelectedBlock();}});addEventListener('mouseup',e=>{if(e.button===0){miningActive=false;mineSingle=false;miningTarget=null;miningProgress=0;resetMiningIndicator();}});
renderer.domElement.addEventListener('contextmenu',e=>e.preventDefault());
renderer.domElement.addEventListener('pointerdown',()=>{if(!ambientOn)toggleMusic()},{once:true});
knifeHit?.addEventListener('click',attack);
mineButton?.addEventListener('pointerdown',e=>{e.preventDefault();mineSingle=false;mineBlock();});mineButton?.addEventListener('pointerup',()=>{miningActive=false;mineSingle=false;miningTarget=null;miningProgress=0;resetMiningIndicator();});mineButton?.addEventListener('pointercancel',()=>{miningActive=false;mineSingle=false;miningTarget=null;miningProgress=0;resetMiningIndicator();});
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
$('loginBackButton')?.addEventListener('click',()=>{loginGate.classList.add('hidden');$('settingsModal')?.classList.add('hidden');gameMenu.classList.remove('hidden');renderSavedWorlds()});
async function createPersonalWorld(){
 if(!serverIsConfigured){$('roomStatus').textContent='El multijugador está pendiente de configurar. Puedes jugar en el mundo local desde el menú principal.';loginStatus.textContent='Falta desplegar el servidor y configurar su URL en src/config.js.';return}
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
 if(!serverIsConfigured){showLogin('Multijugador pendiente: falta desplegar el Worker y configurar su URL en src/config.js. Pulsa VOLVER AL MENÚ para jugar localmente.');return}
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
 if(!serverIsConfigured){loginGate.classList.remove('hidden');loginStatus.textContent='El servidor de Cloudflare todavía no está conectado. El prototipo local está disponible.';boot.classList.add('hidden');hint.textContent='Configura la URL del Worker en src/config.js para activar el multijugador.';spawnProceduralZombies(18);return}
 try{
  gameStarted=false;disconnectMultiplayer();
  const connection=new WebSocket(url);socket=connection;
  connection.addEventListener('open',()=>{if(socket!==connection)return;connection.send(JSON.stringify({type:'join',version:GAME_VERSION,googleIdToken}))});
  connection.addEventListener('message',e=>{if(socket!==connection)return;const m=JSON.parse(e.data);if(m.type==='connected'){if(Number.isFinite(Number(m.worldClock)))worldClock=Number(m.worldClock);player.id=m.id;if(Number.isFinite(Number(m.x))&&Number.isFinite(Number(m.z))){controls.object.position.set(Number(m.x),1.65,Number(m.z));zoneText.textContent='MUNDO '+activeRoomCode;}}else if(m.type==='joined'){if(Number.isFinite(Number(m.worldClock)))worldClock=Number(m.worldClock);player.name=m.player.name||player.name;player.hp=Number(m.player.hp??player.hp);player.hunger=Number(m.player.hunger??player.hunger);player.thirst=Number(m.player.thirst??player.thirst);voxelWorld.resetChanges(controls.object.position);if(Array.isArray(m.blocks))voxelWorld.applyChanges(m.blocks);syncTorchLights();loadRoomInventory();if(Number.isFinite(Number(m.player.x))&&Number.isFinite(Number(m.player.z))){controls.object.position.set(Number(m.player.x),voxelWorld.getHeightAt(Number(m.player.x),Number(m.player.z)),Number(m.player.z));voxelWorld.updateStreaming(controls.object.position);streamedChunkX=Math.floor(controls.object.position.x/16);streamedChunkZ=Math.floor(controls.object.position.z/16);}zoneText.textContent='MUNDO '+activeRoomCode;connected=true;spawnProceduralZombies(18);for(const a of animals)if(!a.userData.networked)a.visible=false;gameStarted=true;gameMenu.classList.add('hidden');loginGate.classList.add('hidden');boot.classList.add('hidden');$('hud').style.display='block';$('touch').style.display='';inventoryModal?.classList.add('hidden');applyState({players:[m.player]});saveWorld();}else if(m.type==='block_edit'){voxelWorld.applyChanges([{x:Number(m.x),y:Number(m.y),z:Number(m.z),id:Number(m.id)}]);syncTorchLights();saveWorld();}else if(m.type==='room_closed'){showLogin(m.message||'El anfitrión no está conectado.');try{socket?.close()}catch{}connected=false;}else if(m.type==='auth_error'){showLogin(m.message||'Cuenta no válida.')}else if(m.type==='auth_required'){showLogin('Inicia sesión con Google para entrar.')}else if(m.type==='attack_ack'){const hit=zombies.find(z=>z.userData.id===m.targetId);if(hit&&Number.isFinite(Number(m.zombieHp))){hit.userData.hp=Number(m.zombieHp);hit.visible=hit.userData.hp>0;}}else if(m.type==='animal_killed'){playSfx('hit');const drops=m.drops&&typeof m.drops==='object'?m.drops:{},animal=animals.find(a=>a.userData.id===m.targetId);for(const [key,value] of Object.entries(drops)){const amount=Math.max(0,Math.floor(Number(value)||0));if(!Object.prototype.hasOwnProperty.call(inventory,key)||amount<=0)continue;if(animal){spawnDroppedItem(key,amount,animal.position.x,animal.position.y,animal.position.z,key==='rawBeef'?0x9a3f3c:key==='rawPork'?0xb96d69:key==='rawChicken'?0xe8c8a5:key==='feathers'?0xe8e6d8:0x7b5035)}else inventory[key]=Math.min(9999,inventory[key]+amount)}hint.textContent=m.animalType==='cow'?'Vaca cazada: la carne y el cuero cayeron al suelo.':m.animalType==='pig'?'Cerdo cazado: la carne cayó al suelo.':'Pollo cazado: el pollo y las plumas cayeron al suelo.';updateInventoryHud();saveWorld()}else if(m.type==='state'){applyState(m)}else if(m.type==='chat'){console.log('[CHAT]',m.from,m.text)}});
  connection.addEventListener('close',()=>{if(socket!==connection)return;socket=null;connected=false;player.id=null;if(!player.dead&&fromLogin)showLogin('Conexión cerrada. Crea o únete al mundo para volver a entrar.')});
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
 if(!connected||now-lastNet<200)return;
 const x=controls.object.position.x,z=controls.object.position.z, moved=Math.hypot(x-lastSentX,z-lastSentZ)>=.08;
 if(p2pConnection){if(!moved&&now-lastP2PHeartbeat<1000)return;lastNet=now;lastP2PHeartbeat=now;lastSentX=x;lastSentZ=z;sendP2P({type:'player_state',id:p2pRole==='host'?'p2p-host':'p2p-guest',x,z,hp:player.hp,hunger:player.hunger,thirst:player.thirst,worldClock});return}
 if(!moved)return;lastNet=now;lastSentX=x;lastSentZ=z;
 if(socket?.readyState===WebSocket.OPEN)socket.send(JSON.stringify({type:'move',x,z}));
}
function installTouch(){
 const padKeys=[['dpadUp','w'],['dpadDown','s'],['dpadLeft','a'],['dpadRight','d']];
 const bindHold=(id,key)=>{const el=$(id);if(!el)return;const down=e=>{e.preventDefault();keys[key]=true;try{el.setPointerCapture(e.pointerId)}catch{}};const up=e=>{e.preventDefault();keys[key]=false};el.addEventListener('pointerdown',down);el.addEventListener('pointerup',up);el.addEventListener('pointercancel',up);el.addEventListener('lostpointercapture',up)};
 for(const [id,key] of padKeys)bindHold(id,key);
 const crouch=$('touchCrouch');if(crouch)crouch.addEventListener('click',()=>{keys.crouch=!keys.crouch;crouch.classList.toggle('active',keys.crouch);crouch.textContent=keys.crouch?'●':'○'});
 $('touchJump')?.addEventListener('pointerdown',e=>{e.preventDefault();jumpPlayer()});
 let activePointer=null,startX=0,startY=0,lastX=0,lastY=0,startedAt=0,moved=false,mineTimer=0,holdMining=false,activeNdc=null;
 const sphere=$('touchAimSphere');
 const stopMine=()=>{if(mineTimer)clearTimeout(mineTimer);mineTimer=0;holdMining=false;miningActive=false;mineSingle=false;miningTarget=null;miningProgress=0;resetMiningIndicator()};
 const mineWhileHeld=pointerId=>{if(activePointer!==pointerId||moved||!holdMining)return;mineBlock(activeNdc)};
 renderer.domElement.addEventListener('pointerdown',e=>{
  if(!isTouchDevice||!gameStarted||!inventoryModal.classList.contains('hidden')||e.pointerType==='mouse')return;
  const rect=renderer.domElement.getBoundingClientRect();
  activeNdc={x:((e.clientX-rect.left)/rect.width)*2-1,y:-(((e.clientY-rect.top)/rect.height)*2-1)};
  activePointer=e.pointerId;startX=lastX=e.clientX;startY=lastY=e.clientY;startedAt=performance.now();moved=false;holdMining=true;miningActive=false;mineSingle=false;miningTarget=null;miningProgress=0;resetMiningIndicator();
  if(sphere){sphere.style.left=e.clientX+'px';sphere.style.top=e.clientY+'px';sphere.style.display='block';}
  try{renderer.domElement.setPointerCapture(e.pointerId)}catch{}
  stopMine();holdMining=true;mineTimer=setTimeout(()=>mineWhileHeld(e.pointerId),520);
 });
 renderer.domElement.addEventListener('pointermove',e=>{
  if(e.pointerId!==activePointer)return;
  const dx=e.clientX-lastX,dy=e.clientY-lastY;lastX=e.clientX;lastY=e.clientY;
  const rect=renderer.domElement.getBoundingClientRect();
  if(!moved&&activeNdc){activeNdc={x:((e.clientX-rect.left)/rect.width)*2-1,y:-(((e.clientY-rect.top)/rect.height)*2-1)};miningNdc=activeNdc;}
  if(sphere){sphere.style.left=e.clientX+'px';sphere.style.top=e.clientY+'px';}
  if(!moved&&Math.hypot(e.clientX-startX,e.clientY-startY)>12){moved=true;stopMine();lastX=e.clientX;lastY=e.clientY;return}
  if(moved){lookYaw-=dx*.006;lookPitch=Math.max(-1.15,Math.min(1.15,lookPitch-dy*.0045));camera.rotation.order='YXZ';camera.rotation.y=lookYaw;camera.rotation.x=lookPitch}
 });
 const finish=e=>{if(e.pointerId!==activePointer)return;const duration=performance.now()-startedAt,wasMoved=moved,ndc=activeNdc;stopMine();activePointer=null;try{renderer.domElement.releasePointerCapture(e.pointerId)}catch{}if(!wasMoved&&duration<260){if(!interactWithBlock(ndc)){const held=hotbarSlots[selectedHotbar];if(held&&Number(held)>=1&&Number(held)<=14&&(inventory[held]||0)>0)placeSelectedBlock(ndc);else if(held&&(inventory[held]||0)>0)attack()}}resetMiningIndicator(true);activeNdc=null};
 renderer.domElement.addEventListener('pointerup',finish);renderer.domElement.addEventListener('pointercancel',e=>{if(e.pointerId===activePointer){stopMine();activePointer=null;activeNdc=null;try{renderer.domElement.releasePointerCapture(e.pointerId)}catch{}resetMiningIndicator(true)}});
}
installTouch();
addEventListener('resize',()=>{camera.aspect=innerWidth/innerHeight;camera.updateProjectionMatrix();renderer.setSize(innerWidth,innerHeight);renderer.setPixelRatio(Math.min(devicePixelRatio,isTouchDevice?1.15:1.6));renderer.shadowMap.enabled=!isTouchDevice});
async function bootGame(){setBoot('Cargando Tekaym Online…');await loadAssets();boot.classList.add('hidden');showGameMenu();renderSavedWorlds()}
bootGame().catch(e=>{console.error('[TEKAYM BOOT]',e);setBoot('No se pudo preparar el juego. Recarga la aplicación.')});
function isNight(){return worldClock>=650&&worldClock<1150}
 function isDaylight(){return worldClock<650||worldClock>=1150}
 function updateDayCycle(dt){worldClock=(worldClock+dt)%1200;const phase=worldClock/1200*Math.PI*2,elevation=Math.sin(phase),day=THREE.MathUtils.clamp((elevation+.12)/.5,0,1),twilight=THREE.MathUtils.clamp(1-Math.abs(elevation)*4,0,1);const daylight=day*day*(3-2*day);const skyDay=new THREE.Color(0x8bc5e8),skyNight=new THREE.Color(0x071020),skyDawn=new THREE.Color(0xe99560),sky=new THREE.Color().copy(skyNight).lerp(skyDay,daylight).lerp(skyDawn,twilight*.42);scene.background.copy(sky);scene.fog.color.copy(sky);light.intensity=.08+daylight*1.55;light.color.set(isNight()?0x9bb8ed:0xffe2b8);light.position.set(Math.cos(phase)*45,Math.sin(phase)*42,16);hemi.intensity=.25+daylight*1.4;hemi.color.set(isNight()?0x536baf:0xb9e3ff);hemi.groundColor.set(isNight()?0x111a2a:0x4b613c);if(worldClockText){const label=worldClock<600?'DÍA':worldClock<650?'ATARDECER':worldClock<1150?'NOCHE':'AMANECER';const total=Math.floor(worldClock/1200*24*60),hh=String(Math.floor(total/60)).padStart(2,'0'),mm=String(total%60).padStart(2,'0');worldClockText.textContent=label+' · '+hh+':'+mm}const nowNight=isNight(),px=controls.object.position.x,py=controls.object.position.y,pz=controls.object.position.z;sunMesh.position.set(px+Math.cos(phase)*100,py+Math.sin(phase)*82,pz-55);moonMesh.position.set(px-Math.cos(phase)*92,py-Math.sin(phase)*76,pz-48);sunMesh.visible=!nowNight;moonMesh.visible=nowNight||worldClock>=600&&worldClock<650||worldClock>=1150;starField.position.set(px,py,pz);starField.visible=nowNight;if(nowNight&&!nightActive){nightActive=true;if(currentWorldMeta.mode!=='creative'&&currentWorldMeta.difficulty!=='peaceful'){let n=0;for(const z of zombies){if(n++>=7)break;z.position.copy(randomZombiePosition());z.userData.hp=45;z.visible=true}}}else if(!nowNight&&nightActive){nightActive=false;for(const z of zombies)z.visible=false}for(const z of zombies)if(!nowNight||currentWorldMeta.mode==='creative'||currentWorldMeta.difficulty==='peaceful')z.visible=false;updateAnimals(performance.now(),dt);}
 function animate(now){const dt=Math.min(.05,(now-last)/1000);last=now;if(heldVisual){if(heldSwing>0){heldSwing=Math.max(0,heldSwing-dt*5.8);const swing=Math.sin((1-heldSwing)*Math.PI);heldVisual.rotation.x=-.45-swing*.95;heldVisual.rotation.z=-.12+swing*.16}else{heldVisual.rotation.x+=(-.45-heldVisual.rotation.x)*Math.min(1,dt*10);heldVisual.rotation.z+=(-.12-heldVisual.rotation.z)*Math.min(1,dt*10)}}updateMining(dt);updateDroppedItems(dt,now);for(let i=blockParticles.length-1;i>=0;i--){const p=blockParticles[i];p.userData.life-=dt;p.userData.velocity.y-=8*dt;p.position.addScaledVector(p.userData.velocity,dt);p.rotation.x+=dt*5;p.rotation.z+=dt*4;if(p.userData.life<=0){scene.remove(p);p.geometry.dispose();p.material.dispose();blockParticles.splice(i,1)}}if(gameStarted&&!player.dead){if(now-lastAutoSave>(Math.max(5,Math.min(60,Number(localStorage.getItem('tekaym-autosave-seconds'))||10))*1000)){saveWorld();lastAutoSave=now}updateDayCycle(dt);moveLocal(dt);updateNeeds(dt);updateFurnace(dt);player.cooldown=Math.max(0,player.cooldown-dt);for(const z of zombies){if(!z.visible)continue;for(const part of z.children){if(part.userData.isZombieArm)part.rotation.x=Math.sin(now*.006+part.userData.side)*.16}if(connected&&Number.isFinite(z.userData.targetX)&&Number.isFinite(z.userData.targetZ)){const tx=z.userData.targetX,tz=z.userData.targetZ;z.position.x+=(tx-z.position.x)*(1-Math.exp(-10*dt));z.position.z+=(tz-z.position.z)*(1-Math.exp(-10*dt));}else if(!connected){const to=controls.object.position.clone().sub(z.position);to.y=0;const d=to.length();if(d<14&&d>1.3){to.normalize();z.position.addScaledVector(to,z.userData.speed*dt);z.position.y=voxelWorld.getHeightAt(z.position.x,z.position.z)-1.65;z.rotation.y=Math.atan2(to.x,to.z)}}z.position.y=voxelWorld.getHeightAt(z.position.x,z.position.z)-1.65;}sendMove(now);updateHud()}renderer.render(scene,camera);requestAnimationFrame(animate)}
updateHud();requestAnimationFrame(animate);