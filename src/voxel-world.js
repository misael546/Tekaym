import * as THREE from 'three';

const CHUNK_SIZE = 16;
const RENDER_DISTANCE = typeof window !== 'undefined' && window.innerWidth <= 800 ? 1 : 2;
const MAX_Y = 48;
const BLOCK = Object.freeze({ AIR: 0, GRASS: 1, DIRT: 2, STONE: 3, SAND: 4, WOOD: 5, LEAVES: 6, COAL_ORE: 7, IRON_ORE: 8, GOLD_ORE: 9, DIAMOND_ORE: 10, PLANKS: 11, CRAFTING_TABLE: 12, FURNACE: 13 });
const COLORS = {
  [BLOCK.GRASS]: new THREE.Color(0x609447),
  [BLOCK.DIRT]: new THREE.Color(0x79553a),
  [BLOCK.STONE]: new THREE.Color(0x777c80),
  [BLOCK.SAND]: new THREE.Color(0xc8b77a),
  [BLOCK.WOOD]: new THREE.Color(0x79502e),
  [BLOCK.LEAVES]: new THREE.Color(0x3e713b),
  [BLOCK.COAL_ORE]: new THREE.Color(0x34383d),
  [BLOCK.IRON_ORE]: new THREE.Color(0xb98f78),
  [BLOCK.GOLD_ORE]: new THREE.Color(0xe3bd36),
  [BLOCK.DIAMOND_ORE]: new THREE.Color(0x45d9d2),
  [BLOCK.PLANKS]: new THREE.Color(0xb98a52),
  [BLOCK.CRAFTING_TABLE]: new THREE.Color(0x8b5b32),
  [BLOCK.FURNACE]: new THREE.Color(0x55565a)
};
const DIRECTIONS = [
  { n: [1, 0, 0], v: [[1,0,0],[1,1,0],[1,1,1],[1,0,1]] },
  { n: [-1, 0, 0], v: [[0,0,1],[0,1,1],[0,1,0],[0,0,0]] },
  { n: [0, 1, 0], v: [[0,1,1],[1,1,1],[1,1,0],[0,1,0]] },
  { n: [0, -1, 0], v: [[0,0,0],[1,0,0],[1,0,1],[0,0,1]] },
  { n: [0, 0, 1], v: [[1,0,1],[1,1,1],[0,1,1],[0,0,1]] },
  { n: [0, 0, -1], v: [[0,0,0],[0,1,0],[1,1,0],[1,0,0]] }
];
const key = (x, y, z) => x + ',' + y + ',' + z;
const chunkKey = (x, z) => x + ',' + z;
function hash(x, z, seed = 7919) {
  let n = Math.imul(x ^ seed, 374761393) + Math.imul(z, 668265263);
  n = Math.imul(n ^ (n >>> 13), 1274126177);
  return ((n ^ (n >>> 16)) >>> 0) / 4294967295;
}
function terrainHeight(x, z) {
  const broad = Math.sin(x * 0.075) * 2.4 + Math.cos(z * 0.061) * 2.1;
  const detail = Math.sin((x + z) * 0.17) * 0.8 + Math.cos((x - z) * 0.13) * 0.55;
  return Math.max(3, Math.min(13, Math.floor(6 + broad + detail)));
}

export function createVoxelWorld(scene) {
  const group = new THREE.Group();
  group.name = 'TekaymVoxelWorld';
  const blocks = new Map();
  const chunks = new Map();
  const dataChunks = new Set();
  const materials = new Map();
  const changes = new Map();
  const originals = new Map();
  const raycaster = new THREE.Raycaster();
  raycaster.far = 6;
  const center = new THREE.Vector3();
  const seed = 7919;

  function getBlock(x, y, z) {
    if (y < 0) return BLOCK.STONE;
    const k = key(x, y, z);
    if (changes.has(k)) return changes.get(k);
    return blocks.get(k) || BLOCK.AIR;
  }
  function putRaw(x, y, z, id) {
    if (y < 0 || y >= MAX_Y) return;
    const k = key(x, y, z);
    if (id === BLOCK.AIR) blocks.delete(k);
    else blocks.set(k, id);
  }
  function chunkOf(v) { return Math.floor(v / CHUNK_SIZE); }
  function surfaceY(x, z) { return terrainHeight(x, z); }
  function ensureChunkData(cx, cz) {
    const ck = chunkKey(cx, cz);
    if (dataChunks.has(ck)) return;
    dataChunks.add(ck);
    const startX = cx * CHUNK_SIZE, startZ = cz * CHUNK_SIZE;
    for (let x = startX; x < startX + CHUNK_SIZE; x++) {
      for (let z = startZ; z < startZ + CHUNK_SIZE; z++) {
        const top = surfaceY(x, z);
        for (let y = 0; y <= top; y++) {
          let id = y === top ? (top <= 4 ? BLOCK.SAND : BLOCK.GRASS) : y >= top - 3 ? BLOCK.DIRT : BLOCK.STONE;
          if (y > 1 && y < top - 3) {
            const ore = hash(x * 31 + y * 7, z * 29 - y * 11, seed + y * 101);
            if (y < 8 && ore > 0.997) id = BLOCK.DIAMOND_ORE;
            else if (y < 13 && ore > 0.992) id = BLOCK.GOLD_ORE;
            else if (y < 20 && ore > 0.965) id = BLOCK.IRON_ORE;
            else if (ore > 0.925) id = BLOCK.COAL_ORE;
          }
          putRaw(x, y, z, id);
        }
      }
    }
    // Generate deterministic tree canopies across chunk borders.
    for (let tx = startX - 2; tx < startX + CHUNK_SIZE + 2; tx++) {
      for (let tz = startZ - 2; tz < startZ + CHUNK_SIZE + 2; tz++) {
        if (tx % 5 !== 0 || tz % 5 !== 0 || hash(tx, tz, seed) < 0.66 || Math.hypot(tx, tz) < 9) continue;
        const ground = surfaceY(tx, tz), trunk = 3 + Math.floor(hash(tz, tx, seed + 1) * 3);
        for (let y = 1; y <= trunk; y++) putRaw(tx, ground + y, tz, BLOCK.WOOD);
        for (let dy = -1; dy <= 2; dy++) {
          const radius = dy === 2 ? 1 : 2;
          for (let dx = -radius; dx <= radius; dx++) for (let dz = -radius; dz <= radius; dz++) {
            if (Math.abs(dx) === radius && Math.abs(dz) === radius && hash(tx + dx, tz + dz, seed + dy) < 0.45) continue;
            const bx = tx + dx, by = ground + trunk + dy, bz = tz + dz;
            if (getBlock(bx, by, bz) === BLOCK.AIR) putRaw(bx, by, bz, BLOCK.LEAVES);
          }
        }
      }
    }
    for (const [k, id] of changes) {
      const [x, y, z] = k.split(',').map(Number);
      if (chunkOf(x) === cx && chunkOf(z) === cz) {
        if (id === BLOCK.AIR) blocks.delete(k); else blocks.set(k, id);
      }
    }
  }
  function unloadChunkData(cx, cz) {
    dataChunks.delete(chunkKey(cx, cz));
    const minX = cx * CHUNK_SIZE, maxX = minX + CHUNK_SIZE;
    const minZ = cz * CHUNK_SIZE, maxZ = minZ + CHUNK_SIZE;
    for (let x = minX; x < maxX; x++) {
      for (let z = minZ; z < maxZ; z++) {
        for (let y = 0; y < MAX_Y; y++) blocks.delete(key(x, y, z));
      }
    }
  }
  function updateStreaming(position) {
    const pcx = chunkOf(position.x), pcz = chunkOf(position.z);
    const wanted = new Set();
    for (let cx = pcx - RENDER_DISTANCE - 1; cx <= pcx + RENDER_DISTANCE + 1; cx++) {
      for (let cz = pcz - RENDER_DISTANCE - 1; cz <= pcz + RENDER_DISTANCE + 1; cz++) wanted.add(chunkKey(cx, cz));
    }
    for (const [ck, mesh] of Array.from(chunks.entries())) {
      if (!wanted.has(ck)) { group.remove(mesh); mesh.geometry.dispose(); chunks.delete(ck); }
    }
    for (const ck of Array.from(dataChunks)) {
      if (!wanted.has(ck)) { const [cx, cz] = ck.split(',').map(Number); unloadChunkData(cx, cz); }
    }
    const rebuild = new Set();
    for (const ck of wanted) {
      const [cx, cz] = ck.split(',').map(Number);
      ensureChunkData(cx, cz);
      if (!chunks.has(ck)) {
        rebuild.add(chunkKey(cx - 1, cz)); rebuild.add(chunkKey(cx + 1, cz));
        rebuild.add(chunkKey(cx, cz - 1)); rebuild.add(chunkKey(cx, cz + 1));
      }
    }
    for (const ck of wanted) {
      const [cx, cz] = ck.split(',').map(Number);
      if (!chunks.has(ck) || rebuild.has(ck)) buildChunk(cx, cz);
    }
  }

  function buildChunk(cx, cz) {
    ensureChunkData(cx, cz);
    const ck = chunkKey(cx, cz);
    const old = chunks.get(ck);
    if (old) { group.remove(old); old.geometry.dispose(); }
    const positions = [], colors = [], indices = [];
    let vertex = 0;
    const startX = cx * CHUNK_SIZE, startZ = cz * CHUNK_SIZE;
    for (let x = startX; x < startX + CHUNK_SIZE; x++) {
      for (let z = startZ; z < startZ + CHUNK_SIZE; z++) {
        for (let y = 0; y < MAX_Y; y++) {
          const id = getBlock(x, y, z);
          if (!id) continue;
          const base = COLORS[id];
          for (let face = 0; face < DIRECTIONS.length; face++) {
            const dir = DIRECTIONS[face];
            if (getBlock(x + dir.n[0], y + dir.n[1], z + dir.n[2])) continue;
            const shade = face === 2 ? 1 : face === 3 ? 0.58 : (face < 2 ? 0.78 : 0.88);
            const c = base.clone().multiplyScalar(shade);
            for (const v of dir.v) {
              positions.push(x + v[0], y + v[1], z + v[2]);
              colors.push(c.r, c.g, c.b);
            }
            indices.push(vertex, vertex + 1, vertex + 2, vertex, vertex + 2, vertex + 3);
            vertex += 4;
          }
        }
      }
    }
    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
    geometry.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3));
    geometry.setIndex(indices);
    geometry.computeVertexNormals();
    let material = materials.get('blocks');
    if (!material) {
      material = new THREE.MeshLambertMaterial({ vertexColors: true });
      materials.set('blocks', material);
    }
    const mesh = new THREE.Mesh(geometry, material);
    mesh.name = 'chunk-' + ck;
    mesh.userData.chunkX = cx; mesh.userData.chunkZ = cz;
    mesh.receiveShadow = true; mesh.castShadow = false;
    chunks.set(ck, mesh); group.add(mesh);
  }

  scene.add(group);
  updateStreaming(new THREE.Vector3(0.5, 0, 0.5));

  function rebuildAt(x, z) {
    const cx = Math.floor(x / CHUNK_SIZE), cz = Math.floor(z / CHUNK_SIZE);
    buildChunk(cx, cz);
    if (x - cx * CHUNK_SIZE === 0) buildChunk(cx - 1, cz);
    if (x - cx * CHUNK_SIZE === CHUNK_SIZE - 1) buildChunk(cx + 1, cz);
    if (z - cz * CHUNK_SIZE === 0) buildChunk(cx, cz - 1);
    if (z - cz * CHUNK_SIZE === CHUNK_SIZE - 1) buildChunk(cx, cz + 1);
  }
  function targetFromCamera(camera) {
    raycaster.setFromCamera(center, camera);
    const hit = raycaster.intersectObjects(Array.from(chunks.values()), false)[0];
    if (!hit || !hit.face) return null;
    const n = hit.face.normal.clone().transformDirection(hit.object.matrixWorld);
    const p = hit.point.clone();
    const bx = Math.floor(p.x - n.x * 0.01), by = Math.floor(p.y - n.y * 0.01), bz = Math.floor(p.z - n.z * 0.01);
    return { x: bx, y: by, z: bz, normal: { x: Math.round(n.x), y: Math.round(n.y), z: Math.round(n.z) }, point: hit.point.clone() };
  }
  function breakBlock(camera) {
    const hit = targetFromCamera(camera);
    if (!hit) return false;
    const id = getBlock(hit.x, hit.y, hit.z);
    if (!id || hit.y <= 0) return false;
    const k = key(hit.x, hit.y, hit.z);
    if (!changes.has(k)) originals.set(k, getBlock(hit.x, hit.y, hit.z));
    putRaw(hit.x, hit.y, hit.z, BLOCK.AIR);
    changes.set(k, BLOCK.AIR);
    rebuildAt(hit.x, hit.z);
    return id;
  }
  function placeBlock(camera, id = BLOCK.DIRT, playerPosition = null) {
    const hit = targetFromCamera(camera);
    if (!hit) return false;
    const x = hit.x + hit.normal.x, y = hit.y + hit.normal.y, z = hit.z + hit.normal.z;
    if (getBlock(x, y, z) !== BLOCK.AIR || y <= 0 || y >= MAX_Y) return false;
    if (playerPosition && Math.abs(x + 0.5 - playerPosition.x) < 0.8 && Math.abs(z + 0.5 - playerPosition.z) < 0.8 && y < playerPosition.y + 1.8 && y + 1 > playerPosition.y - 1.8) return false;
    const k = key(x, y, z);
    if (!changes.has(k)) originals.set(k, getBlock(x, y, z));
    putRaw(x, y, z, id);
    changes.set(k, id);
    rebuildAt(x, z);
    return true;
  }
  function isSolid(id) { return id !== BLOCK.AIR; }
  function isSafeSpawn(x = 0, z = 0) {
    ensureChunkData(chunkOf(x), chunkOf(z));
    const bx = Math.floor(x), bz = Math.floor(z);
    let top = 0;
    for (let y = MAX_Y - 1; y >= 0; y--) if (isSolid(getBlock(bx, y, bz))) { top = y; break; }
    for (let dx = -1; dx <= 1; dx++) for (let dz = -1; dz <= 1; dz++) {
      ensureChunkData(chunkOf(bx + dx), chunkOf(bz + dz));
      for (let y = top + 1; y <= Math.min(MAX_Y - 1, top + 6); y++) {
        const k = key(bx + dx, y, bz + dz);
        if (getBlock(bx + dx, y, bz + dz)) { changes.set(k, BLOCK.AIR); putRaw(bx + dx, y, bz + dz, BLOCK.AIR); }
      }
    }
    return new THREE.Vector3(x + 0.5, top + 2.65, z + 0.5);
  }
  function getHeightAt(x, z) {
    ensureChunkData(chunkOf(x), chunkOf(z));
    const bx = Math.floor(x), bz = Math.floor(z);
    const naturalTop = surfaceY(bx, bz);
    for (let y = Math.min(MAX_Y - 1, naturalTop + 1); y >= 0; y--) {
      if (getBlock(bx, y, bz)) return y + 2.65;
    }
    return 1.65;
  }
  function applyChanges(saved) {
    if (!Array.isArray(saved)) return;
    for (const entry of saved) {
      if (!entry || !Number.isInteger(entry.x) || !Number.isInteger(entry.y) || !Number.isInteger(entry.z)) continue;
      if (entry.y < 0 || entry.y >= MAX_Y) continue;
      ensureChunkData(chunkOf(entry.x), chunkOf(entry.z));
      const id = Number(entry.id);
      if (!Number.isInteger(id) || id < BLOCK.AIR || id > BLOCK.FURNACE) continue;
      const k = key(entry.x, entry.y, entry.z);
      if (!changes.has(k)) originals.set(k, getBlock(entry.x, entry.y, entry.z));
      putRaw(entry.x, entry.y, entry.z, id);
      changes.set(k, id);
    }
    const touched = new Set();
    for (const entry of saved) {
      if (!entry || !Number.isInteger(entry.x) || !Number.isInteger(entry.z)) continue;
      const cx = Math.floor(entry.x / CHUNK_SIZE), cz = Math.floor(entry.z / CHUNK_SIZE);
      touched.add(chunkKey(cx, cz));
      if ((entry.x - cx * CHUNK_SIZE) === 0) touched.add(chunkKey(cx - 1, cz));
      if ((entry.x - cx * CHUNK_SIZE) === CHUNK_SIZE - 1) touched.add(chunkKey(cx + 1, cz));
      if ((entry.z - cz * CHUNK_SIZE) === 0) touched.add(chunkKey(cx, cz - 1));
      if ((entry.z - cz * CHUNK_SIZE) === CHUNK_SIZE - 1) touched.add(chunkKey(cx, cz + 1));
    }
    for (const ck of touched) {
      const [cx, cz] = ck.split(',').map(Number);
      if (chunks.has(ck)) buildChunk(cx, cz);
    }
  }
  function resetChanges(position = new THREE.Vector3(0.5, 0, 0.5)) {
    for (const [k, id] of originals) {
      const [x, y, z] = k.split(',').map(Number);
      putRaw(x, y, z, id);
    }
    changes.clear();
    originals.clear();
    for (const mesh of chunks.values()) { group.remove(mesh); mesh.geometry.dispose(); }
    chunks.clear(); blocks.clear(); dataChunks.clear();
    updateStreaming(position);
  }
  function serializeChanges() {
    return Array.from(changes, ([k, id]) => {
      const [x, y, z] = k.split(',').map(Number);
      return { x, y, z, id };
    });
  }
  function blockName(id) {
    return ({1:'Pasto',2:'Tierra',3:'Piedra',4:'Arena',5:'Madera',6:'Hojas',7:'Mineral de carbón',8:'Mineral de hierro',9:'Mineral de oro',10:'Mineral de diamante',11:'Tablas',12:'Mesa de trabajo',13:'Horno'})[id] || 'Bloque';
  }
  function dispose() {
    for (const mesh of chunks.values()) mesh.geometry.dispose();
    for (const material of materials.values()) material.dispose();
    scene.remove(group);
  }

  return {
    group, BLOCK, getBlock, getHeightAt, breakBlock, placeBlock, targetFromCamera,
    applyChanges, resetChanges, serializeChanges, blockName, updateStreaming,
    safeSpawn: isSafeSpawn,
    get spawn() { return isSafeSpawn(0, 0); },
    dispose
  };
}
