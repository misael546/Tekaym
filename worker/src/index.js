import { DurableObject } from 'cloudflare:workers';

const MAX_PLAYERS = 16;
const MAX_ZOMBIES = 18;
const WORLD = { minX: -100000, maxX: 100000, minZ: -100000, maxZ: 100000 };
const MOVE_SPEED_LIMIT = 4.8;
const ATTACK_COOLDOWN_MS = 520;
const PLAYER_SAVE_MS = 120000;
const ALARM_MS = 10000;

function json(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store', 'access-control-allow-origin': '*' }
  });
}
function uid() { return crypto.randomUUID().replaceAll('-', '').slice(0, 16); }
function clamp(v, a, b) { return Math.max(a, Math.min(b, v)); }
function safeText(v, max = 160) { return String(v ?? '').trim().slice(0, max); }
function b64url(input) {
  return b64urlBytes(new TextEncoder().encode(String(input)));
}
function b64urlBytes(bytes) {
  let out = '';
  for (let i = 0; i < bytes.length; i += 0x8000) out += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
  return btoa(out).replaceAll('+', '-').replaceAll('/', '_').replaceAll('=', '');
}
function pemToArrayBuffer(pem) {
  const b64 = String(pem).replace(/-----BEGIN PRIVATE KEY-----|-----END PRIVATE KEY-----|\s+/g, '');
  const bin = atob(b64);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out.buffer;
}
let firebaseTokenCache = { value: '', exp: 0, email: '' };
async function firebaseAccessToken(env) {
  const raw = String(env.FIREBASE_SERVICE_ACCOUNT_JSON || '').trim();
  if (!raw) throw new Error('FIREBASE_SERVICE_ACCOUNT_JSON no configurado');
  const sa = JSON.parse(raw.replace(/^var\s+admin\s*=\s*/, '').replace(/;?\s*$/, ''));
  const now = Math.floor(Date.now() / 1000);
  if (firebaseTokenCache.value && firebaseTokenCache.exp > now + 60 && firebaseTokenCache.email === sa.client_email) return firebaseTokenCache.value;
  const key = await crypto.subtle.importKey('pkcs8', pemToArrayBuffer(sa.private_key), { name: 'RSASSA-PKCS1-v1_5', hash: 'SHA-256' }, false, ['sign']);
  const header = b64url(JSON.stringify({ alg: 'RS256', typ: 'JWT' }));
  const payload = b64url(JSON.stringify({ iss: sa.client_email, scope: 'https://www.googleapis.com/auth/datastore', aud: 'https://oauth2.googleapis.com/token', iat: now, exp: now + 3600 }));
  const signed = header + '.' + payload;
  const signature = await crypto.subtle.sign('RSASSA-PKCS1-v1_5', key, new TextEncoder().encode(signed));
  const jwt = signed + '.' + b64urlBytes(new Uint8Array(signature));
  const response = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'content-type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({ grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer', assertion: jwt })
  });
  if (!response.ok) throw new Error('No se pudo obtener el token de acceso de Firestore');
  const result = await response.json();
  firebaseTokenCache = { value: String(result.access_token || ''), exp: now + Number(result.expires_in || 3600), email: sa.client_email };
  return firebaseTokenCache.value;
}
function docId(sub) { return b64url(sub); }
function toFields(obj) {
  const fields = {};
  for (const [key, value] of Object.entries(obj || {})) {
    if (value === undefined || value === null) continue;
    if (typeof value === 'number' && Number.isFinite(value)) fields[key] = { doubleValue: value };
    else if (typeof value === 'boolean') fields[key] = { booleanValue: value };
    else fields[key] = { stringValue: String(value) };
  }
  return fields;
}
function fromFields(fields) {
  const out = {};
  for (const [key, value] of Object.entries(fields || {})) {
    if ('doubleValue' in value) out[key] = Number(value.doubleValue);
    else if ('integerValue' in value) out[key] = Number(value.integerValue);
    else if ('booleanValue' in value) out[key] = Boolean(value.booleanValue);
    else if ('stringValue' in value) out[key] = value.stringValue;
  }
  return out;
}
async function firestoreRequest(env, path, init = {}) {
  const project = String(env.FIREBASE_PROJECT_ID || '').trim();
  if (!project) throw new Error('FIREBASE_PROJECT_ID no configurado');
  const token = await firebaseAccessToken(env);
  return fetch('https://firestore.googleapis.com/v1/projects/' + encodeURIComponent(project) + '/databases/(default)/documents/' + path, {
    ...init,
    headers: { ...(init.headers || {}), authorization: 'Bearer ' + token, 'content-type': 'application/json' }
  });
}
async function loadPlayer(env, sub) {
  const response = await firestoreRequest(env, 'tekaym_players/' + encodeURIComponent(docId(sub)));
  if (response.status === 404) return null;
  if (!response.ok) throw new Error('Firestore no pudo cargar el progreso');
  return fromFields((await response.json()).fields);
}
async function savePlayer(env, sub, data) {
  const response = await firestoreRequest(env, 'tekaym_players/' + encodeURIComponent(docId(sub)), {
    method: 'PATCH',
    body: JSON.stringify({ fields: toFields({ ...data, googleSub: sub, updatedAt: Date.now() }) })
  });
  if (!response.ok) throw new Error('Firestore no pudo guardar el progreso');
}
async function ensureAccount(env, google) {
  const path = 'tekaym_accounts/' + encodeURIComponent(docId(google.sub));
  const mask = 'updateMask.fieldPaths=googleSub&updateMask.fieldPaths=email&updateMask.fieldPaths=name&updateMask.fieldPaths=updatedAt';
  const response = await firestoreRequest(env, path + '?' + mask, {
    method: 'PATCH',
    body: JSON.stringify({ fields: toFields({ googleSub: google.sub, email: google.email, name: google.name, updatedAt: Date.now() }) })
  });
  if (response.status === 404) {
    const create = await firestoreRequest(env, path, {
      method: 'PATCH',
      body: JSON.stringify({ fields: toFields({ googleSub: google.sub, email: google.email, name: google.name, createdAt: Date.now(), updatedAt: Date.now() }) })
    });
    if (!create.ok) throw new Error('Firestore no pudo crear la cuenta');
    return;
  }
  if (!response.ok) throw new Error('Firestore no pudo actualizar la cuenta');
}
async function verifyGoogle(idToken, env) {
  const clientId = String(env.GOOGLE_CLIENT_ID || '').trim();
  if (!clientId) throw new Error('GOOGLE_CLIENT_ID no configurado en Cloudflare');
  if (!idToken) throw new Error('Inicia sesión con Google');
  const response = await fetch('https://oauth2.googleapis.com/tokeninfo?id_token=' + encodeURIComponent(idToken), { cache: 'no-store' });
  if (!response.ok) throw new Error('Token de Google inválido');
  const payload = await response.json();
  if (String(payload.aud || '') !== clientId) throw new Error('La cuenta de Google no pertenece a Tekaym');
  if (!['accounts.google.com', 'https://accounts.google.com'].includes(String(payload.iss || ''))) throw new Error('Emisor de Google inválido');
  if (Number(payload.exp || 0) <= Math.floor(Date.now() / 1000)) throw new Error('Sesión de Google expirada');
  if (String(payload.email_verified || '').toLowerCase() !== 'true') throw new Error('Correo de Google no verificado');
  if (!payload.sub) throw new Error('Identidad de Google inválida');
  return { sub: String(payload.sub), email: String(payload.email || ''), name: safeText(payload.name || payload.email || 'Jugador', 20) };
}
function makeCells() {
  const cells = [];
  const offsets = [[-65, -48], [65, -48], [-65, 48], [65, 48]];
  for (let area = 0; area < offsets.length; area++) {
    const ox = offsets[area][0], oz = offsets[area][1];
    for (let side = 0; side < 2; side++) {
      for (let i = 0; i < 8; i++) {
        const x = ox + (i - 3.5) * 4;
        const z = oz + (side === 0 ? -11 : 11);
        cells.push({
          id: String.fromCharCode(65 + area) + '-' + String(i + 1).padStart(2, '0') + (side ? 'B' : 'A'),
          x,
          z: z + (side === 0 ? -1.2 : 1.2),
          centerX: x,
          centerZ: z
        });
      }
    }
  }
  return cells;
}
const CELLS = makeCells();
function isInsideCell(x, z, margin = 0) {
  return CELLS.some(cell => Math.abs(x - cell.centerX) < 2 - margin && Math.abs(z - cell.centerZ) < 2.5 - margin);
}
function randomCellSpawn() { return CELLS[Math.floor(Math.random() * CELLS.length)]; }
function randomZombieSpot() {
  for (let attempt = 0; attempt < 250; attempt++) {
    const x = (Math.random() * 2 - 1) * 54;
    const z = (Math.random() * 2 - 1) * 54;
    if (!isInsideCell(x, z, -0.1)) return { x, z };
  }
  return { x: 0, z: 0 };
}
function createZombies() {
  return Array.from({ length: MAX_ZOMBIES }, (_, i) => {
    const pos = randomZombieSpot();
    return { id: 'z' + i, x: pos.x, z: pos.z, hp: 45, maxHp: 45, speed: 1.05 + Math.random() * 0.45, lastHit: 0, respawnAt: 0 };
  });
}

const MAX_ANIMALS = 10;
const ANIMAL_TYPES = ['chicken', 'pig', 'cow'];
function randomAnimalSpot(player, min = 8, max = 26) {
  for (let attempt = 0; attempt < 100; attempt++) {
    const angle = Math.random() * Math.PI * 2;
    const distance = min + Math.random() * (max - min);
    const x = clamp(Math.round(player.x + Math.cos(angle) * distance), WORLD.minX, WORLD.maxX);
    const z = clamp(Math.round(player.z + Math.sin(angle) * distance), WORLD.minZ, WORLD.maxZ);
    if (!isInsideCell(x, z, -0.1)) return { x, z };
  }
  return { x: clamp(player.x + min, WORLD.minX, WORLD.maxX), z: clamp(player.z, WORLD.minZ, WORLD.maxZ) };
}
function createAnimal(type, player) {
  const pos = randomAnimalSpot(player);
  return { id: 'animal-' + uid(), type, x: pos.x, z: pos.z, hp: 20, maxHp: 20, speed: type === 'chicken' ? 0.58 : 0.34, dir: Math.random() * Math.PI * 2, turnAt: Date.now() + 2000 + Math.random() * 4000, respawnAt: 0 };
}
function animalDrops(type) {
  if (type === 'cow') return { rawBeef: 2, ...(Math.random() < 0.7 ? { leather: 1 } : {}) };
  if (type === 'pig') return { rawPork: 2 };
  return { rawChicken: 1, ...(Math.random() < 0.75 ? { feathers: 1 } : {}) };
}

export class GameRoom extends DurableObject {
  constructor(ctx, env) {
    super(ctx, env);
    this.ctx = ctx;
    this.env = env;
    this.sessions = new Map();
    this.zombies = [];
    this.animals = [];
    this.blocks = new Map();
    this.roomOwnerSub = '';
    this.initialized = false;
    this.lastWorldTick = Date.now();
    this.worldClock = 0;
    for (const ws of this.ctx.getWebSockets()) {
      const attachment = ws.deserializeAttachment();
      if (attachment && attachment.id) this.sessions.set(attachment.id, { ...attachment, ws });
    }
  }

  async load() {
    if (this.initialized) return;
    this.initialized = true;
    this.zombies = await this.ctx.storage.get('zombies');
    this.animals = await this.ctx.storage.get('animals');
    if (!Array.isArray(this.animals)) this.animals = [];
    const savedWorldClock = await this.ctx.storage.get('worldClock');
    this.worldClock = Number.isFinite(Number(savedWorldClock)) ? ((Number(savedWorldClock) % 1200) + 1200) % 1200 : 0;
    this.roomOwnerSub = String(await this.ctx.storage.get('roomOwnerSub') || '');
    const savedBlocks = await this.ctx.storage.get('blocks');
    if (Array.isArray(savedBlocks)) {
      for (const block of savedBlocks) {
        if (!block || !Number.isInteger(block.x) || !Number.isInteger(block.y) || !Number.isInteger(block.z) || !Number.isInteger(block.id)) continue;
        if (Math.abs(block.x) > 100000 || Math.abs(block.z) > 100000 || block.y < 0 || block.y > 47 || block.id < 0 || block.id > 13) continue;
        this.blocks.set(block.x + ',' + block.y + ',' + block.z, block);
      }
    }
    if (!Array.isArray(this.zombies) || !this.zombies.length) {
      this.zombies = createZombies();
      await this.ctx.storage.put('zombies', this.zombies);
    }
    const nextAlarm = await this.ctx.storage.getAlarm();
    if (nextAlarm === null) await this.ctx.storage.setAlarm(Date.now() + ALARM_MS);
  }

  async fetch(request) {
    await this.load();
    if (request.headers.get('Upgrade') !== 'websocket') {
      return json({ ok: true, game: 'Tekaym Online', version: this.env.GAME_VERSION || 'V1', players: this.sessions.size, maxPlayers: MAX_PLAYERS });
    }
    if (this.sessions.size >= MAX_PLAYERS) return json({ ok: false, error: 'Servidor lleno', maxPlayers: MAX_PLAYERS }, 503);
    const pair = new WebSocketPair();
    const client = pair[0], server = pair[1];
    const cell = { x: Math.round((Math.random() * 12 - 6) * 10) / 10, z: Math.round((Math.random() * 12 - 6) * 10) / 10, id: 'MUNDO' };
    const session = {
      id: uid(), name: 'Jugador', googleSub: '', email: '',
      x: cell.x, z: cell.z, cellId: cell.id,
      hp: 100, maxHp: 100, stamina: 100, hunger: 100, thirst: 100,
      joined: false, lastMove: 0, lastAttack: 0, lastSave: Date.now(), lastNeeds: Date.now()
    };
    this.ctx.acceptWebSocket(server, ['room:main', 'session:' + session.id]);
    server.serializeAttachment(session);
    session.ws = server;
    this.sessions.set(session.id, session);
    server.send(JSON.stringify({ type: 'connected', id: session.id, release: this.env.GAME_VERSION || 'V1', maxPlayers: MAX_PLAYERS, cellId: cell.id, x: cell.x, z: cell.z, googleConfigured: Boolean(this.env.GOOGLE_CLIENT_ID) }));
    this.persistSession(server, session);
    return new Response(null, { status: 101, webSocket: client });
  }

  refreshSession(ws) {
    const attachment = ws.deserializeAttachment();
    if (!attachment || !attachment.id) return null;
    let session = this.sessions.get(attachment.id);
    if (!session) {
      session = { ...attachment, ws };
      this.sessions.set(session.id, session);
    } else session.ws = ws;
    return session;
  }

  persistSession(ws, session) {
    const clean = { ...session };
    delete clean.ws;
    try { ws.serializeAttachment(clean); } catch {}
  }

  send(ws, data) {
    try { if (ws && ws.readyState === 1) ws.send(JSON.stringify(data)); } catch {}
  }

  broadcast(data) {
    const raw = JSON.stringify(data);
    for (const ws of this.ctx.getWebSockets()) {
      try { if (ws.readyState === 1) ws.send(raw); } catch {}
    }
  }

  updateNeeds(session, now = Date.now()) {
    const elapsed = Math.min(60, Math.max(0, (now - Number(session.lastNeeds || now)) / 1000));
    if (!elapsed) return;
    session.lastNeeds = now;
    session.hunger = clamp(session.hunger - elapsed * 0.18, 0, 100);
    session.thirst = clamp(session.thirst - elapsed * 0.26, 0, 100);
    if (session.hunger <= 0 || session.thirst <= 0) session.hp = clamp(session.hp - elapsed * 0.8, 0, session.maxHp);
  }

  moveZombies(dt) {
    if (!(this.worldClock >= 650 && this.worldClock < 1150)) return;
    const step = clamp(dt, 0, 0.75);
    for (const zombie of this.zombies) {
      if (zombie.hp <= 0) {
        if (zombie.respawnAt && Date.now() >= zombie.respawnAt) {
          const pos = randomZombieSpot();
          zombie.x = pos.x; zombie.z = pos.z; zombie.hp = zombie.maxHp; zombie.respawnAt = 0;
        }
        continue;
      }
      let target = null, best = Infinity;
      for (const player of this.sessions.values()) {
        if (!player.joined || player.hp <= 0) continue;
        const d = Math.hypot(player.x - zombie.x, player.z - zombie.z);
        if (d < best) { best = d; target = player; }
      }
      if (!target) continue;
      if (best > 28) {
        const angle = Math.random() * Math.PI * 2, distance = 14 + Math.random() * 12;
        zombie.x = clamp(target.x + Math.cos(angle) * distance, WORLD.minX, WORLD.maxX);
        zombie.z = clamp(target.z + Math.sin(angle) * distance, WORLD.minZ, WORLD.maxZ);
        if (isInsideCell(zombie.x, zombie.z, 0)) zombie.x = clamp(zombie.x + 8, WORLD.minX, WORLD.maxX);
        continue;
      }
      const dx = target.x - zombie.x, dz = target.z - zombie.z;
      const length = Math.max(0.001, Math.hypot(dx, dz));
      const distance = Math.min(zombie.speed * step, length);
      const nextX = clamp(zombie.x + dx / length * distance, WORLD.minX, WORLD.maxX);
      const nextZ = clamp(zombie.z + dz / length * distance, WORLD.minZ, WORLD.maxZ);
      if (!isInsideCell(nextX, nextZ, 0)) { zombie.x = nextX; zombie.z = nextZ; }
      if (Math.hypot(target.x - zombie.x, target.z - zombie.z) <= 1.35 && Date.now() - Number(zombie.lastHit || 0) > 1200) {
        zombie.lastHit = Date.now();
        target.hp = clamp(target.hp - 8, 0, target.maxHp);
      }
    }
  }

  ensureAnimalsNearPlayers() {
    if (!(this.worldClock < 650 || this.worldClock >= 1150)) return;
    const active = [...this.sessions.values()].filter(p => p.joined && p.hp > 0);
    if (!active.length) return;
    while (this.animals.length < MAX_ANIMALS) {
      const player = active[Math.floor(Math.random() * active.length)];
      const type = ANIMAL_TYPES[Math.floor(Math.random() * ANIMAL_TYPES.length)];
      this.animals.push(createAnimal(type, player));
    }
  }

  moveAnimals(dt) {
    const active = [...this.sessions.values()].filter(p => p.joined && p.hp > 0);
    if (!active.length) return;
    const now = Date.now(), step = clamp(dt, 0, 5);
    const daylight = this.worldClock < 650 || this.worldClock >= 1150;
    if (daylight) this.ensureAnimalsNearPlayers();
    for (const animal of this.animals) {
      if (animal.hp <= 0) {
        if (animal.respawnAt && now >= animal.respawnAt && daylight) {
          const player = active[Math.floor(Math.random() * active.length)];
          const pos = randomAnimalSpot(player);
          animal.x = pos.x; animal.z = pos.z; animal.hp = animal.maxHp; animal.respawnAt = 0;
          animal.dir = Math.random() * Math.PI * 2; animal.turnAt = now + 2000 + Math.random() * 4000;
        }
        continue;
      }
      if (now >= Number(animal.turnAt || 0)) {
        animal.dir = Math.random() * Math.PI * 2;
        animal.turnAt = now + 2000 + Math.random() * 4000;
      }
      const speed = Number(animal.speed) || 0.34;
      const nx = clamp(animal.x + Math.sin(animal.dir) * speed * step, WORLD.minX, WORLD.maxX);
      const nz = clamp(animal.z + Math.cos(animal.dir) * speed * step, WORLD.minZ, WORLD.maxZ);
      if (!isInsideCell(nx, nz, 0)) { animal.x = nx; animal.z = nz; }
      const nearest = Math.min(...active.map(p => Math.hypot(p.x - animal.x, p.z - animal.z)));
      if (nearest > 62) {
        animal.hp = 0;
        animal.respawnAt = now + 5000;
      }
    }
  }

  statePayload() {
    return {
      type: 'state',
      worldClock: this.worldClock,
      players: [...this.sessions.values()].filter(p => p.joined).map(p => ({
        id: p.id, name: p.name, x: p.x, z: p.z, hp: p.hp, maxHp: p.maxHp,
        stamina: p.stamina, hunger: p.hunger, thirst: p.thirst, cellId: p.cellId
      })),
      zombies: this.zombies.map(z => ({ id: z.id, x: z.x, z: z.z, hp: z.hp, maxHp: z.maxHp })),
      animals: this.animals.map(a => ({ id: a.id, type: a.type, x: a.x, z: a.z, hp: a.hp, maxHp: a.maxHp }))
    };
  }

  broadcastState() { this.broadcast(this.statePayload()); }

  async webSocketMessage(ws, message) {
    const p = this.refreshSession(ws);
    if (!p) return;
    const now = Date.now();
    this.updateNeeds(p, now);
    let msg;
    try { msg = JSON.parse(typeof message === 'string' ? message : new TextDecoder().decode(message)); } catch { return; }

    if (msg.type === 'join') {
      if (p.joined) { this.send(ws, { type: 'joined', player: { id: p.id, name: p.name, x: p.x, z: p.z, hp: p.hp, maxHp: p.maxHp, hunger: p.hunger, thirst: p.thirst, cellId: p.cellId }, blocks: [...this.blocks.values()], worldClock: this.worldClock }); return; }
      try {
        const google = await verifyGoogle(String(msg.googleIdToken || ''), this.env);
        if (this.roomOwnerSub && google.sub !== this.roomOwnerSub && ![...this.sessions.values()].some(s => s.joined && s.googleSub === this.roomOwnerSub)) {
          this.send(ws, { type: 'room_closed', message: 'El anfitrión no está conectado a este mundo.' });
          return;
        }
        if (!this.roomOwnerSub) {
          this.roomOwnerSub = google.sub;
          await this.ctx.storage.put('roomOwnerSub', google.sub);
        }
        await ensureAccount(this.env, google);
        const saved = await loadPlayer(this.env, google.sub);
        p.googleSub = google.sub;
        p.email = google.email;
        p.name = google.name;
        if (saved) {
          p.x = clamp(Number(saved.x ?? p.x), WORLD.minX, WORLD.maxX);
          p.z = clamp(Number(saved.z ?? p.z), WORLD.minZ, WORLD.maxZ);
          p.cellId = String(saved.cellId || 'PRISION');
          p.hp = clamp(Number(saved.hp ?? 100), 1, p.maxHp);
          p.hunger = clamp(Number(saved.hunger ?? 100), 0, 100);
          p.thirst = clamp(Number(saved.thirst ?? 100), 0, 100);
        }
        p.joined = true;
        await savePlayer(this.env, google.sub, this.playerSaveData(p));
        this.persistSession(ws, p);
        this.ensureAnimalsNearPlayers();
        await this.ctx.storage.put('animals', this.animals);
        this.send(ws, { type: 'joined', player: { id: p.id, name: p.name, x: p.x, z: p.z, hp: p.hp, maxHp: p.maxHp, hunger: p.hunger, thirst: p.thirst, cellId: p.cellId }, worldClock: this.worldClock });
        this.broadcastState();
      } catch (error) {
        this.send(ws, { type: 'auth_error', message: error && error.message ? error.message : 'Autenticación inválida.' });
      }
      return;
    }
    if (!p.joined) { this.send(ws, { type: 'auth_required', message: 'Inicia sesión con Google para jugar.' }); return; }

    if (msg.type === 'move') {
      const elapsed = clamp((now - Number(p.lastMove || now)) / 1000, 0.06, 0.45);
      const requestedX = Number(msg.x), requestedZ = Number(msg.z);
      if (Number.isFinite(requestedX) && Number.isFinite(requestedZ) && now - p.lastMove >= 70) {
        const dx = requestedX - p.x, dz = requestedZ - p.z;
        const length = Math.hypot(dx, dz), maxDistance = MOVE_SPEED_LIMIT * elapsed + 0.22;
        const ratio = length > maxDistance ? maxDistance / length : 1;
        const nextX = clamp(p.x + dx * ratio, WORLD.minX, WORLD.maxX);
        const nextZ = clamp(p.z + dz * ratio, WORLD.minZ, WORLD.maxZ);
        p.x = nextX; p.z = nextZ; p.lastMove = now;
        this.moveZombies(elapsed);
        this.moveAnimals(elapsed);
        this.persistSession(ws, p);
        this.broadcastState();
      }
      return;
    }
    if (msg.type === 'knife_attack') {
      if (now - Number(p.lastAttack || 0) < ATTACK_COOLDOWN_MS) return;
      const targetId = safeText(msg.targetId, 40);
      const zombie = this.zombies.find(z => z.id === targetId);
      if (!zombie || zombie.hp <= 0) return;
      if (Math.hypot(p.x - zombie.x, p.z - zombie.z) > 2.65) return;
      p.lastAttack = now;
      const weapon = ['knife','sword','stoneSword','ironSword','axe','stoneAxe','ironAxe'].includes(msg.weapon) ? msg.weapon : 'knife';
      const damage = weapon === 'ironSword' ? 60 : weapon === 'stoneSword' ? 45 : weapon === 'sword' ? 30 : weapon === 'ironAxe' ? 40 : weapon === 'stoneAxe' ? 35 : weapon === 'axe' ? 28 : 20;
      zombie.hp = Math.max(0, zombie.hp - damage);
      if (zombie.hp <= 0) zombie.respawnAt = now + 6000;
      this.persistSession(ws, p);
      this.broadcastState();
      this.send(ws, { type: 'attack_ack', targetId: zombie.id, damage, zombieHp: zombie.hp });
      return;
    }
    if (msg.type === 'animal_attack') {
      if (now - Number(p.lastAttack || 0) < ATTACK_COOLDOWN_MS) return;
      const targetId = safeText(msg.targetId, 48);
      const animal = this.animals.find(a => a.id === targetId);
      if (!animal || animal.hp <= 0 || !ANIMAL_TYPES.includes(animal.type)) return;
      if (Math.hypot(p.x - animal.x, p.z - animal.z) > 2.8) return;
      p.lastAttack = now;
      const weapon = ['knife','sword','stoneSword','ironSword','axe','stoneAxe','ironAxe'].includes(msg.weapon) ? msg.weapon : 'knife';
      const damage = weapon === 'ironSword' ? 60 : weapon === 'stoneSword' ? 45 : weapon === 'sword' ? 30 : weapon === 'ironAxe' ? 40 : weapon === 'stoneAxe' ? 35 : weapon === 'axe' ? 28 : 20;
      animal.hp = Math.max(0, animal.hp - damage);
      if (animal.hp <= 0) {
        animal.respawnAt = now + 45000 + Math.floor(Math.random() * 30000);
        this.send(ws, { type: 'animal_killed', targetId: animal.id, animalType: animal.type, drops: animalDrops(animal.type) });
      }
      await this.ctx.storage.put('animals', this.animals);
      this.broadcastState();
      return;
    }
    if (msg.type === 'block_edit') {
      const x = Number(msg.x), y = Number(msg.y), z = Number(msg.z), id = Number(msg.id);
      if (![x, y, z, id].every(Number.isInteger) || Math.abs(x) > 100000 || Math.abs(z) > 100000 || y < 0 || y > 47 || id < 0 || id > 13) return;
      if (Math.hypot(p.x - x, p.z - z) > 7) return;
      const key = x + ',' + y + ',' + z;
      // Keep AIR edits as tombstones so generated terrain stays broken for later visitors.
      this.blocks.set(key, { x, y, z, id });
      await this.ctx.storage.put('blocks', [...this.blocks.values()]);
      this.broadcast({ type: 'block_edit', x, y, z, id });
      return;
    }
    if (msg.type === 'chat') {
      const text = safeText(msg.text, 160);
      if (text) this.broadcast({ type: 'chat', from: p.name, text });
    }
  }

  playerSaveData(p) {
    return { name: p.name, cellId: p.cellId, x: p.x, z: p.z, hp: p.hp, hunger: p.hunger, thirst: p.thirst };
  }

  async webSocketClose(ws) {
    const p = this.refreshSession(ws);
    if (p && p.joined) {
      try { await savePlayer(this.env, p.googleSub, this.playerSaveData(p)); } catch (error) { console.error('[TEKAYM SAVE ON CLOSE]', error?.message || error); }
      if (p.googleSub && p.googleSub === this.roomOwnerSub) {
        for (const other of [...this.sessions.values()]) {
          if (other.id === p.id) continue;
          this.sessions.delete(other.id);
          try { other.ws.close(1001, 'El anfitrión salió del mundo'); } catch {}
        }
      }
      this.sessions.delete(p.id);
    } else if (p) this.sessions.delete(p.id);
    this.broadcastState();
  }

  async webSocketError(ws) {
    const p = this.refreshSession(ws);
    if (p && p.googleSub && p.googleSub === this.roomOwnerSub) {
      for (const other of [...this.sessions.values()]) {
        if (other.id === p.id) continue;
        this.sessions.delete(other.id);
        try { other.ws.close(1001, 'El anfitrión perdió la conexión'); } catch {}
      }
    }
    if (p) this.sessions.delete(p.id);
    this.broadcastState();
  }

  async alarm() {
    await this.load();
    const now = Date.now();
    const realElapsed = clamp((now - this.lastWorldTick) / 1000, 0, 30);
    const elapsed = clamp(realElapsed, 0, 5);
    this.lastWorldTick = now;
    for (const p of this.sessions.values()) {
      this.updateNeeds(p, now);
      if (p.joined && now - Number(p.lastSave || 0) >= PLAYER_SAVE_MS) {
        try { await savePlayer(this.env, p.googleSub, this.playerSaveData(p)); p.lastSave = now; }
        catch (error) { console.error('[TEKAYM AUTOSAVE]', error?.message || error); }
      }
      if (p.ws) this.persistSession(p.ws, p);
    }
    this.moveZombies(elapsed || 1);
    this.worldClock = (this.worldClock + (realElapsed || 1)) % 1200;
    this.moveAnimals(realElapsed || 1);
    await this.ctx.storage.put('worldClock', this.worldClock);
    await this.ctx.storage.put('zombies', this.zombies);
    await this.ctx.storage.put('animals', this.animals);
    if (this.sessions.size) this.broadcastState();
    await this.ctx.storage.setAlarm(Date.now() + ALARM_MS);
  }
}

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    if (request.method === 'OPTIONS') return new Response(null, { status: 204, headers: { 'access-control-allow-origin': '*', 'access-control-allow-methods': 'GET,POST,OPTIONS', 'access-control-allow-headers': 'content-type', 'access-control-max-age': '86400' } });
    if (url.pathname === '/' || url.pathname === '/health') {
      return json({ ok: true, game: 'Tekaym Online', version: env.GAME_VERSION || 'V1', status: 'online', maxPlayers: MAX_PLAYERS, server: 'cloudflare-durable-object', googleConfigured: Boolean(env.GOOGLE_CLIENT_ID), firebaseConfigured: Boolean(env.FIREBASE_PROJECT_ID && env.FIREBASE_SERVICE_ACCOUNT_JSON) });
    }
    if (url.pathname === '/auth/google/config') return json({ ok: Boolean(env.GOOGLE_CLIENT_ID), clientId: String(env.GOOGLE_CLIENT_ID || '') });
    if (url.pathname === '/rooms/create') {
      const code = crypto.randomUUID().replaceAll('-', '').slice(0, 6).toUpperCase();
      return json({ ok: true, code, hostMode: 'while-online' });
    }
    if (url.pathname === '/rooms') {
      const code = String(url.searchParams.get('code') || 'main').toUpperCase();
      if (code !== 'MAIN' && !/^[A-F0-9]{6}$/.test(code)) return json({ ok: false, error: 'Código de mundo inválido' }, 400);
      const id = env.GAME_ROOMS.idFromName('world:' + code);
      return env.GAME_ROOMS.get(id).fetch(new Request(new URL('/rooms', url), request));
    }
    if (url.pathname === '/ws') {
      if (request.headers.get('Upgrade') !== 'websocket') return json({ ok: false, error: 'WebSocket upgrade requerido' }, 426);
      const code = String(url.searchParams.get('room') || 'main').toUpperCase();
      if (code !== 'MAIN' && !/^[A-F0-9]{6}$/.test(code)) return json({ ok: false, error: 'Código de mundo inválido' }, 400);
      const id = env.GAME_ROOMS.idFromName('world:' + code);
      return env.GAME_ROOMS.get(id).fetch(request);
    }
    return json({ ok: false, error: 'Not Found' }, 404);
  }
};
