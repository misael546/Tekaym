import * as THREE from 'three';

const CHUNK_SIZE = 16;
const WORLD_CHUNKS = 8;
const WORLD_SIZE = CHUNK_SIZE * WORLD_CHUNKS;
const HALF_WORLD = WORLD_SIZE / 2;
const MAX_Y = 28;
const BLOCK = Object.freeze({ AIR: 0, GRASS: 1, DIRT: 2, STONE: 3, SAND: 4, WOOD: 5, LEAVES: 6 });
const COLORS = {
  [BLOCK.GRASS]: new THREE.Color(0x609447),
  [BLOCK.DIRT]: new THREE.Color(0x79553a),
  [BLOCK.STONE]: new THREE.Color(0x777c80),
  [BLOCK.SAND]: new THREE.Color(0xc8b77a),
  [BLOCK.WOOD]: new THREE.Color(0x79502e),
  [BLOCK.LEAVES]: new THREE.Color(0x3e713b)
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
  const materials = new Map();
  const changes = new Map();
  const raycaster = new THREE.Raycaster();
  raycaster.far = 6;
  const center = new THREE.Vector3();
  const seed = 7919;

  function getBlock(x, y, z) {
    if (y < 0) return BLOCK.STONE;
    return blocks.get(key(x, y, z)) || BLOCK.AIR;
  }
  function putRaw(x, y, z, id) {
    if (y < 0 || y >= MAX_Y) return;
    const k = key(x, y, z);
    if (id === BLOCK.AIR) blocks.delete(k);
    else blocks.set(k, id);
  }
  function surfaceY(x, z) { return terrainHeight(x, z); }

  // Generate the initial terrain as voxel data, then render only exposed faces.
  for (let x = -HALF_WORLD; x < HALF_WORLD; x++) {
    for (let z = -HALF_WORLD; z < HALF_WORLD; z++) {
      const top = surfaceY(x, z);
      for (let y = 0; y <= top; y++) {
        const id = y === top ? (top <= 4 ? BLOCK.SAND : BLOCK.GRASS) : y >= top - 3 ? BLOCK.DIRT : BLOCK.STONE;
        putRaw(x, y, z, id);
      }
    }
  }
  for (let x = -HALF_WORLD + 3; x < HALF_WORLD - 3; x += 5) {
    for (let z = -HALF_WORLD + 3; z < HALF_WORLD - 3; z += 5) {
      if (hash(x, z, seed) < 0.66 || Math.hypot(x, z) < 9) continue;
      const ground = surfaceY(x, z);
      const trunk = 3 + Math.floor(hash(z, x, seed + 1) * 3);
      for (let y = 1; y <= trunk; y++) putRaw(x, ground + y, z, BLOCK.WOOD);
      for (let dy = -1; dy <= 2; dy++) {
        const radius = dy === 2 ? 1 : 2;
        for (let dx = -radius; dx <= radius; dx++) {
          for (let dz = -radius; dz <= radius; dz++) {
            if (Math.abs(dx) === radius && Math.abs(dz) === radius && hash(x + dx, z + dz, seed + dy) < 0.45) continue;
            const bx = x + dx, by = ground + trunk + dy, bz = z + dz;
            if (getBlock(bx, by, bz) === BLOCK.AIR) putRaw(bx, by, bz, BLOCK.LEAVES);
          }
        }
      }
    }
  }

  function buildChunk(cx, cz) {
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

  const minChunk = -Math.floor(WORLD_CHUNKS / 2);
  const maxChunk = minChunk + WORLD_CHUNKS - 1;
  for (let cx = minChunk; cx <= maxChunk; cx++) {
    for (let cz = minChunk; cz <= maxChunk; cz++) buildChunk(cx, cz);
  }
  scene.add(group);

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
    putRaw(hit.x, hit.y, hit.z, BLOCK.AIR);
    changes.set(key(hit.x, hit.y, hit.z), BLOCK.AIR);
    rebuildAt(hit.x, hit.z);
    return id;
  }
  function placeBlock(camera, id = BLOCK.DIRT, playerPosition = null) {
    const hit = targetFromCamera(camera);
    if (!hit) return false;
    const x = hit.x + hit.normal.x, y = hit.y + hit.normal.y, z = hit.z + hit.normal.z;
    if (getBlock(x, y, z) !== BLOCK.AIR || y <= 0 || y >= MAX_Y) return false;
    if (playerPosition && Math.abs(x + 0.5 - playerPosition.x) < 0.8 && Math.abs(z + 0.5 - playerPosition.z) < 0.8 && y < playerPosition.y + 1.8 && y + 1 > playerPosition.y - 1.8) return false;
    putRaw(x, y, z, id);
    changes.set(key(x, y, z), id);
    rebuildAt(x, z);
    return true;
  }
  function getHeightAt(x, z) { return surfaceY(Math.floor(x), Math.floor(z)) + 1.65; }
  function applyChanges(saved) {
    if (!Array.isArray(saved)) return;
    for (const entry of saved) {
      if (!entry || !Number.isInteger(entry.x) || !Number.isInteger(entry.y) || !Number.isInteger(entry.z)) continue;
      if (entry.x < -HALF_WORLD || entry.x >= HALF_WORLD || entry.z < -HALF_WORLD || entry.z >= HALF_WORLD || entry.y < 0 || entry.y >= MAX_Y) continue;
      const id = Number(entry.id);
      if (!Number.isInteger(id) || id < BLOCK.AIR || id > BLOCK.LEAVES) continue;
      putRaw(entry.x, entry.y, entry.z, id);
      changes.set(key(entry.x, entry.y, entry.z), id);
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
  function serializeChanges() {
    return Array.from(changes, ([k, id]) => {
      const [x, y, z] = k.split(',').map(Number);
      return { x, y, z, id };
    });
  }
  function blockName(id) {
    return ({1:'Pasto',2:'Tierra',3:'Piedra',4:'Arena',5:'Madera',6:'Hojas'})[id] || 'Bloque';
  }
  function dispose() {
    for (const mesh of chunks.values()) mesh.geometry.dispose();
    for (const material of materials.values()) material.dispose();
    scene.remove(group);
  }

  return {
    group, BLOCK, getBlock, getHeightAt, breakBlock, placeBlock, targetFromCamera,
    applyChanges, serializeChanges, blockName,
    get spawn() { return new THREE.Vector3(0.5, getHeightAt(0, 0), 0.5); },
    dispose
  };
}
