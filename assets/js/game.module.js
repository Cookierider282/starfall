// ===================== GAME STATE & CONFIG =====================
let gameStarted = false;
let gameOver = false;
let paused = false;
let gameWorld = null;
const keys = {};
let mouseX = 0;
let mouseY = 0;
let cameraMode = 'chase'; // 'chase' | 'cockpit'
let journalOpen = false;
let sessionEndedByDeath = false;
const PROGRESS_STORAGE_KEY = 'starfall_progress_v1';
const TUTORIAL_COMPLETED_KEY = 'starfall_tutorial_completed_v1';
let _lastAutoSaveAt = 0;

const settingsState = {
  masterVolume: 0.34,
  musicVolume: 1.9,
  sfxVolume: 0.42,
  controlSensitivity: 0.62,
  vfxIntensity: 1.0
};

function clamp(val, min, max) {
  const n = Number(val);
  if (!Number.isFinite(n)) return min;
  return Math.min(max, Math.max(min, n));
}

function loadSettingsState() {
  try {
    const raw = localStorage.getItem('starfall_settings');
    if (!raw) return;
    const data = JSON.parse(raw);
    if (!data || typeof data !== 'object') return;
    if (data.masterVolume != null) settingsState.masterVolume = clamp(Number(data.masterVolume), 0, 1.5);
    if (data.musicVolume != null) settingsState.musicVolume = clamp(Number(data.musicVolume), 0, 3);
    if (data.sfxVolume != null) settingsState.sfxVolume = clamp(Number(data.sfxVolume), 0, 2);
    if (data.controlSensitivity != null) settingsState.controlSensitivity = clamp(Number(data.controlSensitivity), 0.35, 1.2);
    if (data.vfxIntensity != null) settingsState.vfxIntensity = clamp(Number(data.vfxIntensity), 0, 1.5);
  } catch (e) {}
}

function saveSettingsState() {
  try {
    localStorage.setItem('starfall_settings', JSON.stringify(settingsState));
  } catch (e) {}
}

function applyAudioMixerSettings() {
  if (!bgMusic || !bgMusic.master || !bgMusic.musicMaster || !bgMusic.sfxMaster) return;
  bgMusic.master.gain.value = settingsState.masterVolume;
  bgMusic.musicMaster.gain.value = settingsState.musicVolume;
  bgMusic.sfxMaster.gain.value = settingsState.sfxVolume;
}

function applyLiveGameplaySettings() {
  if (gameWorld && gameWorld.ship) {
    gameWorld.ship.controlSensitivity = settingsState.controlSensitivity;
  }
}

function initSettingsBar() {
  loadSettingsState();
  const ids = {
    master: document.getElementById('setMaster'),
    music: document.getElementById('setMusic'),
    sfx: document.getElementById('setSfx'),
    control: document.getElementById('setControl'),
    vfx: document.getElementById('setVfx')
  };
  if (!ids.master || !ids.music || !ids.sfx || !ids.control || !ids.vfx) return;

  ids.master.value = String(settingsState.masterVolume);
  ids.music.value = String(settingsState.musicVolume);
  ids.sfx.value = String(settingsState.sfxVolume);
  ids.control.value = String(settingsState.controlSensitivity);
  ids.vfx.value = String(settingsState.vfxIntensity);

  const bind = (el, key, min, max, onChange) => {
    el.addEventListener('input', () => {
      settingsState[key] = clamp(Number(el.value), min, max);
      if (onChange) onChange();
      saveSettingsState();
    });
  };

  bind(ids.master, 'masterVolume', 0, 1.5, applyAudioMixerSettings);
  bind(ids.music, 'musicVolume', 0, 3, applyAudioMixerSettings);
  bind(ids.sfx, 'sfxVolume', 0, 2, applyAudioMixerSettings);
  bind(ids.control, 'controlSensitivity', 0.35, 1.2, applyLiveGameplaySettings);
  bind(ids.vfx, 'vfxIntensity', 0, 1.5, null);
}

function loadProgressData() {
  try {
    const raw = localStorage.getItem(PROGRESS_STORAGE_KEY);
    if (!raw) return null;
    const data = JSON.parse(raw);
    if (!data || typeof data !== 'object') return null;
    return data;
  } catch (e) {
    return null;
  }
}

function serializePlanetState(planet) {
  if (!planet || !planet.position) return null;
  const civ = planet.civilization || {};
  const eng = planet.engineering || {};
  return {
    id: planet.id || null,
    name: planet.name || null,
    position: { x: planet.position.x, y: planet.position.y, z: planet.position.z },
    radius: Number(planet.radius) || 40,
    color: planet.planetMesh && planet.planetMesh.material && planet.planetMesh.material.color
      ? planet.planetMesh.material.color.getHex()
      : (planet.color && typeof planet.color.getHex === 'function' ? planet.color.getHex() : 0x6699ff),
    hasBase: !!planet.hasBase,
    baseLevel: Math.max(0, Math.floor(Number(planet.baseLevel) || 0)),
    terraformed: !!planet.terraformed,
    engineering: {
      atmosphere: eng.atmosphere ? 1 : 0,
      movedMoons: Math.max(0, Math.floor(Number(eng.movedMoons) || 0)),
      artificialRings: Math.max(0, Math.floor(Number(eng.artificialRings) || 0)),
      starDetonated: eng.starDetonated ? 1 : 0,
      dysonSwarms: Math.max(0, Math.floor(Number(eng.dysonSwarms) || 0))
    },
    civilization: {
      founded: !!civ.founded,
      name: civ.name || null,
      owner: civ.owner || 'neutral',
      government: civ.government || 'None',
      governmentLevel: Math.max(0, Math.floor(Number(civ.governmentLevel) || 0)),
      legalLevel: Math.max(0, Math.floor(Number(civ.legalLevel) || 0)),
      economyTier: Math.max(0, Math.floor(Number(civ.economyTier) || 0)),
      civScore: Math.max(0, Math.floor(Number(civ.civScore) || 0)),
      territories: Math.max(0, Math.floor(Number(civ.territories) || 0)),
      defenseRating: Math.max(1, Number(civ.defenseRating) || 1),
      destroyed: !!civ.destroyed,
      atWar: !!civ.atWar,
      lastWarAt: Number(civ.lastWarAt) || 0,
      warEndsAt: Number(civ.warEndsAt) || 0,
      lastWarWaveAt: Number(civ.lastWarWaveAt) || 0,
      population: Math.max(0, Math.floor(Number(civ.population) || 0)),
      stability: Math.max(0, Math.min(100, Number(civ.stability) || 0))
    }
  };
}

function serializeWorldState() {
  if (!gameWorld || !gameWorld.ship) return null;
  const shipPos = gameWorld.ship.position.clone();
  const planets = (gameWorld.planets || [])
    .filter(p => p && p.position && p.position.distanceTo(shipPos) < 24000)
    .map(serializePlanetState)
    .filter(Boolean);
  return {
    planets,
    returnBaseTargetId: gameWorld.returnBaseTarget ? gameWorld.returnBaseTarget.id : null
  };
}

function restoreWorldState(worldState) {
  if (!gameWorld || !gameWorld.scene || !worldState || !Array.isArray(worldState.planets)) return;

  (gameWorld.planets || []).forEach(p => {
    if (p && p.mesh) gameWorld.scene.remove(p.mesh);
  });
  gameWorld.planets = [];

  const restoredById = new Map();
  worldState.planets.forEach(ps => {
    if (!ps || !ps.position) return;
    const pos = new THREE.Vector3(Number(ps.position.x) || 0, Number(ps.position.y) || 0, Number(ps.position.z) || 0);
    const radius = Number(ps.radius) || null;
    const color = new THREE.Color(Number(ps.color) || 0x6699ff);
    const planet = new Planet(gameWorld.scene, pos, radius, color);
    planet.id = ps.id || planet.id;
    planet.name = ps.name || planet.name;

    planet.terraformed = !!ps.terraformed;
    if (ps.engineering && typeof ps.engineering === 'object') {
      planet.engineering = {
        atmosphere: ps.engineering.atmosphere ? 1 : 0,
        movedMoons: Math.max(0, Math.floor(Number(ps.engineering.movedMoons) || 0)),
        artificialRings: Math.max(0, Math.floor(Number(ps.engineering.artificialRings) || 0)),
        starDetonated: ps.engineering.starDetonated ? 1 : 0,
        dysonSwarms: Math.max(0, Math.floor(Number(ps.engineering.dysonSwarms) || 0))
      };
    }
    if (ps.civilization && typeof ps.civilization === 'object') {
      planet.civilization = {
        founded: !!ps.civilization.founded,
        name: ps.civilization.name || null,
        owner: ps.civilization.owner || 'neutral',
        government: ps.civilization.government || 'None',
        governmentLevel: Math.max(0, Math.floor(Number(ps.civilization.governmentLevel) || 0)),
        legalLevel: Math.max(0, Math.floor(Number(ps.civilization.legalLevel) || 0)),
        economyTier: Math.max(0, Math.floor(Number(ps.civilization.economyTier) || 0)),
        civScore: Math.max(0, Math.floor(Number(ps.civilization.civScore) || 0)),
        territories: Math.max(0, Math.floor(Number(ps.civilization.territories) || 0)),
        defenseRating: Math.max(1, Number(ps.civilization.defenseRating) || 1),
        destroyed: !!ps.civilization.destroyed,
        atWar: !!ps.civilization.atWar,
        lastWarAt: Number(ps.civilization.lastWarAt) || 0,
        warEndsAt: Number(ps.civilization.warEndsAt) || 0,
        lastWarWaveAt: Number(ps.civilization.lastWarWaveAt) || 0,
        population: Math.max(0, Math.floor(Number(ps.civilization.population) || 0)),
        stability: Math.max(0, Math.min(100, Number(ps.civilization.stability) || 35))
      };
    }

    if (ps.hasBase) {
      planet.hasBase = true;
      planet.baseLevel = Math.max(1, Math.floor(Number(ps.baseLevel) || 1));
      if (typeof planet.buildBase === 'function') planet.buildBase(planet.baseLevel);
      ensurePlanetBaseShopUpgrades(planet);
    }
    if (planet.terraformed && typeof planet.ensureAtmosphereShell === 'function') {
      planet.ensureAtmosphereShell();
    }
    if ((planet.engineering.movedMoons || 0) > 0 && typeof planet.ensureMoons === 'function') {
      planet.ensureMoons(planet.engineering.movedMoons);
    }
    if ((planet.engineering.artificialRings || 0) > 0 && typeof planet.ensureArtificialRing === 'function') {
      planet.ensureArtificialRing(planet.engineering.artificialRings);
    }
    if ((planet.engineering.dysonSwarms || 0) > 0 && typeof planet.ensureDysonSwarm === 'function') {
      planet.ensureDysonSwarm(planet.engineering.dysonSwarms);
    }
    if (planet.civilization && planet.civilization.founded && typeof planet.ensureCivilizationBeacon === 'function') {
      planet.ensureCivilizationBeacon();
    }
    if (planet.civilization && planet.civilization.destroyed) {
      planet.hasBase = false;
      planet.baseLevel = 0;
      planet.terraformed = false;
      if (planet.baseStation) {
        planet.mesh.remove(planet.baseStation);
        planet.baseStation = null;
      }
      if (planet.planetMesh && planet.planetMesh.material && planet.planetMesh.material.color) {
        planet.planetMesh.material.color.setHex(0x3a3532);
      }
    }

    gameWorld.planets.push(planet);
    if (planet.id) restoredById.set(planet.id, planet);
  });

  gameWorld.returnBaseTarget = worldState.returnBaseTargetId ? (restoredById.get(worldState.returnBaseTargetId) || null) : null;
}

function buildProgressSnapshot() {
  if (!gameWorld || !gameWorld.ship) return null;
  const ship = gameWorld.ship;
  const landedPlanetId = ship.landedPlanet && ship.landedPlanet.id ? ship.landedPlanet.id : null;
  return {
    score: gameWorld.score || 0,
    kills: gameWorld.kills || 0,
    upgradePoints: gameWorld.upgradePoints || 0,
    upgrades: gameWorld.upgrades || {},
    resources: gameWorld.resources || { minerals: 0, salvage: 0 },
    modules: gameWorld.modules || [],
    tech: gameWorld.tech || {},
    satelliteTiers: gameWorld.satelliteTiers || { t1: 0, t2: 0, t3: 0 },
    satellites: gameWorld.satellites || 0,
    factionWarMode: !!gameWorld.factionWarMode,
    droneCounts: gameWorld.droneCounts || { combat: 0, harvester: 0 },
    purchaseCounts: gameWorld.purchaseCounts || {},
    artifactsCollected: gameWorld.artifactsCollected || 0,
    aiCivilizations: Array.isArray(gameWorld.aiCivilizations) ? gameWorld.aiCivilizations : [],
    worldState: serializeWorldState(),
    checkpoint: {
      shipPosition: { x: ship.position.x, y: ship.position.y, z: ship.position.z },
      shipVelocity: { x: ship.velocity.x, y: ship.velocity.y, z: ship.velocity.z },
      landed: !!ship.landed,
      landedPlanetId
    },
    resumeAllowed: !!(gameStarted && !gameOver && !sessionEndedByDeath && ship.health > 0),
    lastSessionEndedByDeath: !!sessionEndedByDeath,
    ship: {
      maxFuel: ship.maxFuel,
      fuel: ship.fuel,
      maxHealth: ship.maxHealth,
      health: ship.health,
      maxShield: ship.maxShield,
      shieldHealth: ship.shieldHealth,
      ammo: ship.ammo,
      maxAmmo: ship.maxAmmo || 999,
      maxSpeed: ship.maxSpeed,
      acceleration: ship.acceleration,
      fuelConsumption: ship.fuelConsumption,
      extraStages: ship.extraStages || 0
    },
    savedAt: Date.now()
  };
}

function saveProgressNow() {
  try {
    const snapshot = buildProgressSnapshot();
    if (!snapshot) return;
    localStorage.setItem(PROGRESS_STORAGE_KEY, JSON.stringify(snapshot));
  } catch (e) {}
}

function applyLoadedProgress(progress, options = {}) {
  if (!progress || !gameWorld || !gameWorld.ship) return;
  const ship = gameWorld.ship;
  const restoreCheckpoint = !!options.restoreCheckpoint;

  gameWorld.score = Math.max(0, Number(progress.score) || 0);
  gameWorld.kills = Math.max(0, Number(progress.kills) || 0);
  gameWorld.upgradePoints = Math.max(0, Number(progress.upgradePoints) || 0);
  gameWorld.upgrades = progress.upgrades && typeof progress.upgrades === 'object' ? progress.upgrades : gameWorld.upgrades;
  gameWorld.resources = progress.resources && typeof progress.resources === 'object' ? progress.resources : { minerals: 0, salvage: 0 };
  gameWorld.modules = Array.isArray(progress.modules) ? progress.modules : [];
  gameWorld.tech = progress.tech && typeof progress.tech === 'object' ? progress.tech : {};
  gameWorld.satelliteTiers = progress.satelliteTiers && typeof progress.satelliteTiers === 'object' ? progress.satelliteTiers : { t1: 0, t2: 0, t3: 0 };
  gameWorld.satellites = Math.max(0, Number(progress.satellites) || 0);
  gameWorld.factionWarMode = !!progress.factionWarMode;
  gameWorld.droneCounts = progress.droneCounts && typeof progress.droneCounts === 'object' ? progress.droneCounts : { combat: 0, harvester: 0 };
  gameWorld.purchaseCounts = progress.purchaseCounts && typeof progress.purchaseCounts === 'object' ? progress.purchaseCounts : {};
  gameWorld.artifactsCollected = Math.max(0, Number(progress.artifactsCollected) || 0);
  gameWorld.aiCivilizations = Array.isArray(progress.aiCivilizations) ? progress.aiCivilizations : [];

  if (progress.ship && typeof progress.ship === 'object') {
    ship.maxFuel = Math.max(50, Number(progress.ship.maxFuel) || ship.maxFuel);
    ship.fuel = clamp(Number(progress.ship.fuel), 0, ship.maxFuel);
    ship.maxHealth = Math.max(20, Number(progress.ship.maxHealth) || ship.maxHealth);
    ship.health = clamp(Number(progress.ship.health), 1, ship.maxHealth);
    ship.maxShield = Math.max(0, Number(progress.ship.maxShield) || ship.maxShield);
    ship.shieldHealth = clamp(Number(progress.ship.shieldHealth), 0, ship.maxShield);
    ship.ammo = Math.max(0, Number(progress.ship.ammo) || ship.ammo);
    ship.maxAmmo = Math.max(300, Number(progress.ship.maxAmmo) || ship.maxAmmo || 999);
    ship.ammo = Math.min(ship.maxAmmo, ship.ammo);
    ship.maxSpeed = Math.max(1, Number(progress.ship.maxSpeed) || ship.maxSpeed);
    ship.acceleration = Math.max(0.03, Number(progress.ship.acceleration) || ship.acceleration);
    ship.fuelConsumption = Math.max(0.01, Number(progress.ship.fuelConsumption) || ship.fuelConsumption);
    ship.extraStages = Math.max(0, Math.floor(Number(progress.ship.extraStages) || 0));
    if (typeof ship.refreshStageVisuals === 'function') ship.refreshStageVisuals();
  }

  if (restoreCheckpoint && progress.worldState && typeof progress.worldState === 'object') {
    restoreWorldState(progress.worldState);
  }

  if (restoreCheckpoint && progress.checkpoint && typeof progress.checkpoint === 'object') {
    const cp = progress.checkpoint;
    if (cp.shipPosition && typeof cp.shipPosition === 'object') {
      ship.position.set(
        Number(cp.shipPosition.x) || ship.position.x,
        Number(cp.shipPosition.y) || ship.position.y,
        Number(cp.shipPosition.z) || ship.position.z
      );
      ship.mesh.position.copy(ship.position);
    }
    if (cp.shipVelocity && typeof cp.shipVelocity === 'object') {
      ship.velocity.set(
        Number(cp.shipVelocity.x) || 0,
        Number(cp.shipVelocity.y) || 0,
        Number(cp.shipVelocity.z) || 0
      );
    }

    ship.landed = !!cp.landed;
    ship.landedPlanet = null;
    if (ship.landed && cp.landedPlanetId && Array.isArray(gameWorld.planets)) {
      ship.landedPlanet = gameWorld.planets.find(p => p && p.id === cp.landedPlanetId) || null;
    }
  }
  if (Array.isArray(gameWorld.planets)) {
    gameWorld.planets.forEach(p => {
      if (!p || !p.civilization) return;
      if (p.civilization.founded && (!p.civilization.owner || p.civilization.owner === 'neutral') && p.hasBase) {
        p.civilization.owner = 'player';
      }
    });
  }
  if (typeof gameWorld.ensureAICivilizations === 'function') gameWorld.ensureAICivilizations();

  if (window.updateHUD) updateHUD();
  if (window.updateUpgradesUI) updateUpgradesUI();
  if (window.updateModuleUI) updateModuleUI();
  if (window.updateTechUI) updateTechUI();
}

window.resetProgress = function() {
  const ok = window.confirm('Reset all saved progress? This will clear upgrades, resources, purchases, and skins.');
  if (!ok) return;
  try {
    localStorage.removeItem(PROGRESS_STORAGE_KEY);
    localStorage.removeItem('currentSkin');
    Object.keys(PROFESSIONAL_SKINS || {}).forEach((id) => localStorage.removeItem(`skin_${id}`));
  } catch (e) {}
  showFloatingText('Progress reset. Start a new mission.', 2200);
  if (gameStarted) restartGame();
};

const shipConfigs = {
  body: { sleek: { scale: 0.8, speed: 1.3, health: 80 }, heavy: { scale: 1.3, speed: 0.8, health: 150 }, balanced: { scale: 1.0, speed: 1.0, health: 100 } },
  tank: { standard: { accel: 0.25, maxSpeed: 12, fuel: 1.0 }, turbo: { accel: 0.35, maxSpeed: 16, fuel: 0.7 }, economy: { accel: 0.15, maxSpeed: 9, fuel: 1.5 } },
  // Shorter cooldowns and higher damage to make combat snappier
  engine: { pulse: { fireRate: 120, damage: 20, speed: 20, name: "Pulse Cannon" }, plasma: { fireRate: 220, damage: 42, speed: 15, name: "Plasma Rifle" }, missile: { fireRate: 460, damage: 96, speed: 12, name: "Missile Launcher" } }
};

let shipChoice = { body: null, tank: null, engine: null, shipClass: null };
const REQUIRED_SHIP_SELECTIONS = ['body', 'tank', 'engine', 'shipClass'];

function isShipBuilderComplete() {
  return REQUIRED_SHIP_SELECTIONS.every((key) => !!shipChoice[key]);
}

function updateStartButtonState() {
  const btn = document.getElementById('startBtn');
  if (!btn) return;
  const complete = isShipBuilderComplete();
  btn.disabled = !complete;
  btn.title = complete ? '' : 'Select body, tank, engine, and class first';
}

// ===================== UTILITY FUNCTIONS =====================
function isTooClose(newPos, planets, radius) {
  return planets.some(p => p.position.distanceTo(newPos) < p.radius + radius + 50);
}

function setShadowRecursive(obj, cast = true, receive = true) {
  if (!obj) return;
  obj.traverse((child) => {
    if (child && child.isMesh) {
      child.castShadow = cast;
      child.receiveShadow = receive;
    }
  });
}

// Combat globals
const CRIT_CHANCE = 0.12;      // 12% critical chance
const CRIT_MULTIPLIER = 1.75; // critical damage multiplier

// Ship class modifiers (applied on spawn)
const shipClasses = {
  fighter: { healthMul: 0.85, speedMul: 1.25, desc: 'Fast, lower health' },
  tank: { healthMul: 1.6, speedMul: 0.8, desc: 'Heavy armor, slow' },
  balanced: { healthMul: 1.0, speedMul: 1.0, desc: 'Balanced stats' },
  drone: { healthMul: 0.95, speedMul: 1.0, desc: 'Drone carrier: deploys drones (future)' }
};

const PROFESSIONAL_SKINS = {
  neon_blue: {
    label: 'Neon Blue',
    scene: { background: 0x020814, fog: 0x071225, sun: 0xcde5ff },
    player: { color: 0x48b6ff, emissive: 0x0f3b76, emissiveIntensity: 0.7, metalness: 0.55, roughness: 0.32 },
    enemy: { color: 0xff6e55, emissive: 0x5c1408, emissiveIntensity: 0.42, metalness: 0.35, roughness: 0.58 },
    mega: { color: 0x896a68, emissive: 0x2d1212, emissiveIntensity: 0.42, metalness: 0.42, roughness: 0.62 },
    colossal: { color: 0x4f5c75, emissive: 0x101f3d, emissiveIntensity: 0.32, metalness: 0.52, roughness: 0.46 },
    portal: { color: 0x5ad8ff, emissive: 0x1388b8, emissiveIntensity: 1.0, metalness: 0.18, roughness: 0.16 },
    interior: { color: 0x1b2333, emissive: 0x0a1730, emissiveIntensity: 0.24, metalness: 0.15, roughness: 0.72 },
    planet: { hueShift: 0.01, satMul: 1.05, lightMul: 0.98, roughness: 0.72, metalness: 0.06 }
  },
  crimson_red: {
    label: 'Crimson Red',
    scene: { background: 0x130306, fog: 0x1c080d, sun: 0xffd1cf },
    player: { color: 0xff5872, emissive: 0x6a1b2f, emissiveIntensity: 0.75, metalness: 0.5, roughness: 0.35 },
    enemy: { color: 0xff9a4a, emissive: 0x6a260c, emissiveIntensity: 0.45, metalness: 0.3, roughness: 0.61 },
    mega: { color: 0x8e4444, emissive: 0x431414, emissiveIntensity: 0.48, metalness: 0.45, roughness: 0.58 },
    colossal: { color: 0x6b4a57, emissive: 0x321222, emissiveIntensity: 0.34, metalness: 0.48, roughness: 0.49 },
    portal: { color: 0xff8f5a, emissive: 0xb43d1f, emissiveIntensity: 1.05, metalness: 0.15, roughness: 0.18 },
    interior: { color: 0x25161a, emissive: 0x17080e, emissiveIntensity: 0.28, metalness: 0.18, roughness: 0.73 },
    planet: { hueShift: -0.015, satMul: 1.1, lightMul: 0.94, roughness: 0.76, metalness: 0.04 }
  },
  electric_purple: {
    label: 'Electric Violet',
    scene: { background: 0x080313, fog: 0x120822, sun: 0xe7d8ff },
    player: { color: 0x9f6aff, emissive: 0x381d85, emissiveIntensity: 0.78, metalness: 0.56, roughness: 0.3 },
    enemy: { color: 0xff6cc7, emissive: 0x671d4d, emissiveIntensity: 0.46, metalness: 0.34, roughness: 0.57 },
    mega: { color: 0x725180, emissive: 0x2d1444, emissiveIntensity: 0.5, metalness: 0.45, roughness: 0.56 },
    colossal: { color: 0x54506e, emissive: 0x201a44, emissiveIntensity: 0.38, metalness: 0.5, roughness: 0.47 },
    portal: { color: 0xb76bff, emissive: 0x6226b6, emissiveIntensity: 1.12, metalness: 0.12, roughness: 0.17 },
    interior: { color: 0x201a2e, emissive: 0x120b22, emissiveIntensity: 0.3, metalness: 0.15, roughness: 0.72 },
    planet: { hueShift: 0.03, satMul: 1.14, lightMul: 0.96, roughness: 0.74, metalness: 0.05 }
  },
  golden_elite: {
    label: 'Golden Elite',
    scene: { background: 0x110b01, fog: 0x191203, sun: 0xfff0b8 },
    player: { color: 0xffcb58, emissive: 0x7b5813, emissiveIntensity: 0.68, metalness: 0.74, roughness: 0.23 },
    enemy: { color: 0x8cc0ff, emissive: 0x1b3f72, emissiveIntensity: 0.35, metalness: 0.35, roughness: 0.56 },
    mega: { color: 0xa68a56, emissive: 0x4d3f12, emissiveIntensity: 0.44, metalness: 0.62, roughness: 0.42 },
    colossal: { color: 0x867654, emissive: 0x342f1a, emissiveIntensity: 0.33, metalness: 0.64, roughness: 0.36 },
    portal: { color: 0xffd775, emissive: 0xb9851f, emissiveIntensity: 1.08, metalness: 0.18, roughness: 0.16 },
    interior: { color: 0x2f2816, emissive: 0x1d1508, emissiveIntensity: 0.26, metalness: 0.22, roughness: 0.64 },
    planet: { hueShift: 0.015, satMul: 1.08, lightMul: 1.02, roughness: 0.68, metalness: 0.08 }
  },
  obsidian_stealth: {
    label: 'Obsidian Stealth',
    scene: { background: 0x010203, fog: 0x05080c, sun: 0xc4d3e6 },
    player: { color: 0x3c454f, emissive: 0x10161f, emissiveIntensity: 0.34, metalness: 0.68, roughness: 0.28 },
    enemy: { color: 0x98a6b7, emissive: 0x253447, emissiveIntensity: 0.25, metalness: 0.4, roughness: 0.55 },
    mega: { color: 0x4d535f, emissive: 0x1b2029, emissiveIntensity: 0.32, metalness: 0.58, roughness: 0.42 },
    colossal: { color: 0x454d5a, emissive: 0x151b25, emissiveIntensity: 0.28, metalness: 0.62, roughness: 0.38 },
    portal: { color: 0x7cb0e8, emissive: 0x2d588e, emissiveIntensity: 0.85, metalness: 0.16, roughness: 0.2 },
    interior: { color: 0x11161f, emissive: 0x080d14, emissiveIntensity: 0.2, metalness: 0.2, roughness: 0.7 },
    planet: { hueShift: -0.01, satMul: 0.88, lightMul: 0.9, roughness: 0.8, metalness: 0.03 }
  },
  arctic_ops: {
    label: 'Arctic Ops',
    scene: { background: 0x021018, fog: 0x062032, sun: 0xdcf7ff },
    player: { color: 0x9be7ff, emissive: 0x2d6d7f, emissiveIntensity: 0.6, metalness: 0.46, roughness: 0.27 },
    enemy: { color: 0xffbf7a, emissive: 0x754920, emissiveIntensity: 0.33, metalness: 0.28, roughness: 0.57 },
    mega: { color: 0x84a6b5, emissive: 0x2d4d5a, emissiveIntensity: 0.35, metalness: 0.44, roughness: 0.48 },
    colossal: { color: 0x688696, emissive: 0x1e3b47, emissiveIntensity: 0.31, metalness: 0.5, roughness: 0.44 },
    portal: { color: 0x8df3ff, emissive: 0x2f95aa, emissiveIntensity: 0.98, metalness: 0.14, roughness: 0.17 },
    interior: { color: 0x1a2a33, emissive: 0x0b1a21, emissiveIntensity: 0.25, metalness: 0.17, roughness: 0.67 },
    planet: { hueShift: 0.02, satMul: 0.94, lightMul: 1.06, roughness: 0.7, metalness: 0.06 }
  }
};

function getProfessionalSkin(skinId = null) {
  const fallback = 'neon_blue';
  let id = skinId;
  if (!id) {
    try { id = localStorage.getItem('currentSkin') || fallback; } catch (e) { id = fallback; }
  }
  return PROFESSIONAL_SKINS[id] || PROFESSIONAL_SKINS[fallback];
}

function styleMaterial(mat, style) {
  if (!mat || !style) return;
  if (style.color != null && mat.color) mat.color.setHex(style.color);
  if (style.emissive != null && mat.emissive) mat.emissive.setHex(style.emissive);
  if (style.emissiveIntensity != null && typeof mat.emissiveIntensity === 'number') mat.emissiveIntensity = style.emissiveIntensity;
  if (style.metalness != null && typeof mat.metalness === 'number') mat.metalness = style.metalness;
  if (style.roughness != null && typeof mat.roughness === 'number') mat.roughness = style.roughness;
  mat.needsUpdate = true;
}

function styleObjectTheme(root, channel, skinId = null) {
  if (!root) return;
  const skin = getProfessionalSkin(skinId);
  const style = skin[channel];
  if (!style) return;
  root.traverse((child) => {
    if (!child || !child.isMesh || !child.material) return;
    if (Array.isArray(child.material)) {
      child.material.forEach((m) => styleMaterial(m, style));
    } else {
      styleMaterial(child.material, style);
    }
  });
}

function stylePlanetTheme(planet, skinId = null) {
  if (!planet || !planet.planetMesh || !planet.planetMesh.material) return;
  const skin = getProfessionalSkin(skinId);
  const p = skin.planet;
  if (!p) return;
  const mat = planet.planetMesh.material;
  if (mat.color && typeof mat.color.getHSL === 'function') {
    const hsl = { h: 0, s: 0, l: 0 };
    mat.color.getHSL(hsl);
    mat.color.setHSL(
      (hsl.h + (p.hueShift || 0) + 1) % 1,
      THREE.MathUtils.clamp(hsl.s * (p.satMul || 1), 0, 1),
      THREE.MathUtils.clamp(hsl.l * (p.lightMul || 1), 0, 1)
    );
  }
  if (p.roughness != null && typeof mat.roughness === 'number') mat.roughness = p.roughness;
  if (p.metalness != null && typeof mat.metalness === 'number') mat.metalness = p.metalness;
  mat.needsUpdate = true;
}

// ===================== CLASS DEFINITIONS =====================

class Planet {
  constructor(scene, position, radius = null, color = null) {
    this.id = `PL-${Date.now().toString(36)}-${Math.floor(Math.random() * 1e8).toString(36)}`;
    this.scene = scene;
    this.radius = radius || THREE.MathUtils.randFloat(30, 90);
    this.color = color || new THREE.Color(Math.random(), Math.random(), Math.random());
    this.position = position || new THREE.Vector3(
      THREE.MathUtils.randFloat(-1000, 1000),
      THREE.MathUtils.randFloat(-500, 500),
      -3000
    );

    // Create a group so we can attach rings, belts and clouds as children
    const group = new THREE.Group();

    // Base planet mesh
    const geometry = new THREE.SphereGeometry(this.radius, 64, 64);
    const material = new THREE.MeshStandardMaterial({ color: this.color, roughness: 0.6, metalness: 0.0 });
    const planetMesh = new THREE.Mesh(geometry, material);
    planetMesh.position.set(0, 0, 0);
    group.add(planetMesh);

    group.position.copy(this.position);

    this.mesh = group;           // keep compatibility with existing code
    this.planetMesh = planetMesh; // actual sphere mesh for material updates
    this.interactable = true;
    scene.add(this.mesh);
    setShadowRecursive(this.mesh, true, true);
    // Very slow system drift so planets feel alive without disrupting navigation.
    this.driftVelocity = new THREE.Vector3(
      THREE.MathUtils.randFloatSpread(0.054),
      THREE.MathUtils.randFloatSpread(0.021),
      THREE.MathUtils.randFloatSpread(0.054)
    );

    // Randomly pick a planet style
    const styles = ['ringed','belt','cloudy','ice','lava','rocky','gasgiant'];
    this.style = styles[Math.floor(Math.random() * styles.length)];

    // Optional components
    this.ringMesh = null;
    this.beltGroup = null;
    this.cloudMesh = null;

    // Helper to create a simple banded texture (canvas) for gas giants
    function createBandTexture(colors = ['#c88a6a','#a86f50','#f2c9b1']) {
      const w = 1024, h = 256;
      const canvas = document.createElement('canvas');
      canvas.width = w; canvas.height = h;
      const ctx = canvas.getContext('2d');
      // Fill with base
      ctx.fillStyle = colors[0];
      ctx.fillRect(0, 0, w, h);
      // Draw bands
      for (let i = 0; i < 30; i++) {
        const y = Math.floor((i / 30) * h);
        ctx.fillStyle = colors[i % colors.length];
        const bandHeight = 4 + Math.random() * 12;
        ctx.fillRect(0, y, w, bandHeight);
      }
      const tex = new THREE.CanvasTexture(canvas);
      tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
      tex.repeat.set(2,1);
      return tex;
    }

    // Add style-specific visuals
    if (this.style === 'ringed') {
      const ringGeo = new THREE.TorusGeometry(this.radius * 1.4, Math.max(1, this.radius * 0.12), 2, 128);
      const ringMat = new THREE.MeshStandardMaterial({ color: 0xaaaaaa, roughness: 1.0, metalness: 0.1, side: THREE.DoubleSide, transparent: true, opacity: 0.95 });
      this.ringMesh = new THREE.Mesh(ringGeo, ringMat);
      this.ringMesh.rotation.x = Math.PI / 2.2;
      this.ringMesh.position.set(0, 0, 0);
      this.mesh.add(this.ringMesh);
    }

    if (this.style === 'belt') {
      // Create an asteroid belt as child group
      this.beltGroup = new THREE.Group();
      const count = 60 + Math.floor(Math.random() * 80);
      for (let i = 0; i < count; i++) {
        const a = Math.random() * Math.PI * 2;
        const r = this.radius * 1.6 + Math.random() * this.radius * 0.8;
        const x = Math.cos(a) * r;
        const z = Math.sin(a) * r;
        const y = (Math.random() - 0.5) * this.radius * 0.2;
        const s = Math.random() * 2 + 0.5;
        const geo = new THREE.IcosahedronGeometry(s, 0);
        const mat = new THREE.MeshStandardMaterial({ color: 0x666666, roughness: 1.0, metalness: 0.0 });
        const rock = new THREE.Mesh(geo, mat);
        rock.position.set(x, y, z);
        rock.rotation.set(Math.random()*2, Math.random()*2, Math.random()*2);
        this.beltGroup.add(rock);
      }
      this.mesh.add(this.beltGroup);
      this.beltSpeed = 0.001 + Math.random() * 0.003;
    }

    if (this.style === 'cloudy') {
      const cloudGeo = new THREE.SphereGeometry(this.radius * 1.03, 64, 64);
      const cloudMat = new THREE.MeshStandardMaterial({ color: 0xffffff, transparent: true, opacity: 0.18, roughness: 1.0 });
      this.cloudMesh = new THREE.Mesh(cloudGeo, cloudMat);
      this.cloudMesh.rotation.x = Math.random() * Math.PI;
      this.mesh.add(this.cloudMesh);
    }

    if (this.style === 'gasgiant') {
      const tex = createBandTexture([ '#e6b58f', '#c78b6a', '#8f5a3a' ]);
      planetMesh.material.map = tex;
      planetMesh.material.needsUpdate = true;
      planetMesh.material.roughness = 1.0;
    }

    if (this.style === 'ice') {
      planetMesh.material.color.setHex(0xaaddff);
      planetMesh.material.roughness = 0.9;
      planetMesh.material.metalness = 0.0;
      // thin icy sheen
      const sheen = new THREE.Mesh(new THREE.SphereGeometry(this.radius * 1.01, 64, 64), new THREE.MeshStandardMaterial({ color: 0xffffff, transparent: true, opacity: 0.06 }));
      this.mesh.add(sheen);
    }

    if (this.style === 'lava') {
      planetMesh.material.color.setHex(0x663322);
      planetMesh.material.emissive.setHex(0x220000);
      planetMesh.material.roughness = 0.6;
      // add some emissive cracks as small sprites (cheap)
      const lavaGeo = new THREE.SphereGeometry(this.radius * 1.01, 8, 8);
      const lavaMat = new THREE.MeshBasicMaterial({ color: 0xff3300, transparent: true, opacity: 0.06 });
      const lavaLayer = new THREE.Mesh(lavaGeo, lavaMat);
      this.mesh.add(lavaLayer);
    }

    if (this.style === 'rocky') {
      planetMesh.material.roughness = 1.0;
      planetMesh.material.metalness = 0.0;
      // Slight random rotation to give character
      this.mesh.rotation.set(Math.random()*0.3, Math.random()*2*Math.PI, Math.random()*0.3);
    }

    // Basic NPC / Shop for this planet
    const merchantNames = ['Kor Trader', 'Maeve Outfitter', 'Orbital Bazaar', 'Vex Merchant', 'Luna Exchange'];
    const merchant = merchantNames[Math.floor(Math.random() * merchantNames.length)];
    this.name = merchant + "'s Outpost";
    this.hasBase = false;
    this.baseLevel = 0;
    this.stationTier = 0;
    this.baseStation = null;
    this.terraformed = false;
    this.engineering = {
      atmosphere: 0,
      movedMoons: 0,
      artificialRings: 0,
      starDetonated: 0,
      dysonSwarms: 0
    };
    this.civilization = {
      founded: false,
      name: null,
      owner: 'neutral',
      government: 'None',
      governmentLevel: 0,
      legalLevel: 0,
      economyTier: 0,
      civScore: 0,
      territories: 0,
      defenseRating: 1,
      destroyed: false,
      atWar: false,
      lastWarAt: 0,
      warEndsAt: 0,
      lastWarWaveAt: 0,
      population: 0,
      stability: 35
    };
    this.atmosphereShell = null;
    this.artificialRing = null;
    this.moons = [];
    this.dysonGroup = null;
    this.civBeacon = null;

    this.npc = {
      name: merchant,
      shop: [
        { name: 'Extra Rocket Stage', type: 'stage', price: 500, desc: 'Increase fuel & speed slightly' },
        { name: 'Satellite T1', type: 'satellite_t1', price: 800, desc: 'Passive income: +2 score/sec' },
        { name: 'Satellite T2', type: 'satellite_t2', price: 1800, desc: 'Requires T1. Passive income: +6 score/sec' },
        { name: 'Satellite T3', type: 'satellite_t3', price: 3200, desc: 'Requires T2. Passive income: +14 score/sec' },
        { name: 'Form Base', type: 'base', price: 2000, desc: 'Establish a base here: faster refuel/repair' },
        { name: 'Ammo Pack', type: 'ammo', price: 50, amount: 100 },
        { name: 'Fuel Canister', type: 'fuel', price: 75, amount: 50 },
        { name: 'Shield Module', type: 'shield', price: 100, amount: 100 },
        { name: 'Health Repair', type: 'health', price: 150, amount: 100 }
      ]
    };
    stylePlanetTheme(this);
  }

  buildBase(level = 1) {
    if (!this.mesh) return;
    if (!this.baseStation) {
      this.baseStation = new THREE.Group();
      this.baseStation.position.set(0, this.radius + 7, 0);
      this.mesh.add(this.baseStation);
    }
    this.baseLevel = Math.max(this.baseLevel, level);
    this.stationTier = Math.max(this.stationTier || 0, this.baseLevel);
    this.hasBase = true;

    while (this.baseStation.children.length) {
      this.baseStation.remove(this.baseStation.children[0]);
    }

    const core = new THREE.Mesh(
      new THREE.CylinderGeometry(2.2 + this.baseLevel * 0.4, 2.8 + this.baseLevel * 0.5, 5 + this.baseLevel, 10),
      new THREE.MeshStandardMaterial({ color: 0x66ffcc, emissive: 0x114433, emissiveIntensity: 0.6 })
    );
    core.position.y = 2;
    this.baseStation.add(core);

    const ring = new THREE.Mesh(
      new THREE.TorusGeometry(4 + this.baseLevel * 1.2, 0.45, 8, 26),
      new THREE.MeshStandardMaterial({ color: 0xaadfff, emissive: 0x335577, emissiveIntensity: 0.4 })
    );
    ring.rotation.x = Math.PI / 2;
    this.baseStation.add(ring);
  }

  ensureAtmosphereShell() {
    if (this.atmosphereShell) return;
    this.atmosphereShell = new THREE.Mesh(
      new THREE.SphereGeometry(this.radius * 1.1, 32, 32),
      new THREE.MeshStandardMaterial({
        color: 0x7ecbff,
        emissive: 0x113344,
        emissiveIntensity: 0.5,
        transparent: true,
        opacity: 0.18,
        depthWrite: false
      })
    );
    this.mesh.add(this.atmosphereShell);
  }

  ensureMoons(count = 1) {
    const target = Math.max(0, count);
    while (this.moons.length < target) {
      const moonRadius = Math.max(2.8, this.radius * (0.12 + Math.random() * 0.08));
      const moon = new THREE.Mesh(
        new THREE.SphereGeometry(moonRadius, 16, 16),
        new THREE.MeshStandardMaterial({ color: 0xb9c4d2, roughness: 0.95, metalness: 0.02 })
      );
      const moonData = {
        mesh: moon,
        angle: Math.random() * Math.PI * 2,
        speed: 0.00045 + Math.random() * 0.00025,
        distance: this.radius * (2.3 + Math.random() * 1.2),
        tilt: THREE.MathUtils.randFloatSpread(0.35)
      };
      this.mesh.add(moon);
      this.moons.push(moonData);
    }
  }

  ensureArtificialRing(level = 1) {
    const ringScale = 1 + Math.max(0, level - 1) * 0.18;
    if (!this.artificialRing) {
      this.artificialRing = new THREE.Mesh(
        new THREE.TorusGeometry(this.radius * 1.55, Math.max(1.2, this.radius * 0.09), 6, 72),
        new THREE.MeshStandardMaterial({
          color: 0x5fdfff,
          emissive: 0x113355,
          emissiveIntensity: 0.7,
          metalness: 0.45,
          roughness: 0.35,
          transparent: true,
          opacity: 0.82
        })
      );
      this.artificialRing.rotation.x = Math.PI / 2.1;
      this.mesh.add(this.artificialRing);
    }
    this.artificialRing.scale.setScalar(ringScale);
  }

  ensureDysonSwarm(level = 1) {
    const clamped = Math.max(0, Math.min(3, level));
    if (!this.dysonGroup) {
      this.dysonGroup = new THREE.Group();
      this.mesh.add(this.dysonGroup);
    }
    const targetNodes = clamped * 16;
    while (this.dysonGroup.children.length < targetNodes) {
      const node = new THREE.Mesh(
        new THREE.BoxGeometry(0.9, 0.9, 0.9),
        new THREE.MeshStandardMaterial({ color: 0xffd977, emissive: 0x664400, emissiveIntensity: 0.6, metalness: 0.55, roughness: 0.38 })
      );
      node.userData = {
        angle: Math.random() * Math.PI * 2,
        speed: 0.0015 + Math.random() * 0.0011,
        dist: this.radius * (2.2 + Math.random() * 0.8),
        tilt: THREE.MathUtils.randFloatSpread(0.5)
      };
      this.dysonGroup.add(node);
    }
  }

  ensureCivilizationBeacon() {
    if (this.civBeacon) return;
    this.civBeacon = new THREE.Mesh(
      new THREE.ConeGeometry(Math.max(1.2, this.radius * 0.06), Math.max(4.5, this.radius * 0.2), 12),
      new THREE.MeshStandardMaterial({ color: 0x88ffaa, emissive: 0x225544, emissiveIntensity: 0.55, transparent: true, opacity: 0.88 })
    );
    this.civBeacon.position.set(0, this.radius + 9, 0);
    this.mesh.add(this.civBeacon);
  }

  triggerStellarDetonation(gameWorld) {
    const blastRadius = 320 + this.radius * 1.8;
    let destroyed = 0;
    if (gameWorld && Array.isArray(gameWorld.enemies)) {
      gameWorld.enemies = gameWorld.enemies.filter(e => {
        if (!e || !e.position) return true;
        if (e.position.distanceTo(this.position) <= blastRadius) {
          if (typeof e.destroy === 'function') e.destroy();
          destroyed++;
          return false;
        }
        return true;
      });
    }

    const blast = new THREE.Mesh(
      new THREE.SphereGeometry(this.radius * 0.8, 24, 24),
      new THREE.MeshBasicMaterial({ color: 0xffb357, transparent: true, opacity: 0.6 })
    );
    blast.position.copy(this.position);
    this.scene.add(blast);
    let t = 0;
    const animateBlast = () => {
      t++;
      blast.scale.setScalar(1 + t * 0.24);
      blast.material.opacity = Math.max(0, 0.6 - t * 0.018);
      if (t < 36) requestAnimationFrame(animateBlast);
      else this.scene.remove(blast);
    };
    animateBlast();
    return destroyed;
  }

  update() {
    // Base rotation
    this.mesh.rotation.y += 0.0005;
    // Slow translational drift.
    this.mesh.position.add(this.driftVelocity);
    this.position.copy(this.mesh.position);

    // Rotate rings slowly
    if (this.ringMesh) this.ringMesh.rotation.z += 0.0008;

    // Rotate asteroid belt
    if (this.beltGroup) this.beltGroup.rotation.y += this.beltSpeed || 0.0015;

    // Rotate clouds for dynamic look
    if (this.cloudMesh) this.cloudMesh.rotation.y += 0.0009;
    if (this.baseStation) {
      this.baseStation.rotation.y += 0.003 + this.baseLevel * 0.0004;
    }
    if (this.atmosphereShell) this.atmosphereShell.rotation.y += 0.0006;
    if (this.artificialRing) this.artificialRing.rotation.z += 0.0005 + (this.engineering.artificialRings || 0) * 0.0001;
    this.moons.forEach(m => {
      m.angle += m.speed * (1 + (this.engineering.movedMoons || 0) * 0.15);
      m.mesh.position.set(
        Math.cos(m.angle) * m.distance,
        Math.sin(m.angle * 0.6) * (this.radius * 0.08) + (this.radius * 0.35) * m.tilt,
        Math.sin(m.angle) * m.distance
      );
      m.mesh.rotation.y += 0.004;
    });
    if (this.dysonGroup) {
      this.dysonGroup.children.forEach(n => {
        n.userData.angle += n.userData.speed;
        n.position.set(
          Math.cos(n.userData.angle) * n.userData.dist,
          Math.sin(n.userData.angle * 1.35) * (this.radius * 0.2) + this.radius * 0.28 * n.userData.tilt,
          Math.sin(n.userData.angle) * n.userData.dist
        );
      });
    }
    if (this.civBeacon && this.civilization && this.civilization.founded) {
      this.civBeacon.rotation.y += 0.01;
      const pulse = 0.82 + Math.sin(Date.now() * 0.005) * 0.14;
      this.civBeacon.material.opacity = pulse;
      this.civBeacon.material.color.setHex(this.civilization.atWar ? 0xff6677 : 0x88ffaa);
    }
  }

  interact() {
    // Open the planet's NPC shop when interacted with (landing + E)
    try { openPlanetShop(this.npc, this); } catch (e) { }
    return `Welcome to ${this.name}`;
  }
}

// ======= New World Features: Nebula, Black Hole, Asteroid Field, Derelict Ships ======
class Nebula {
  constructor(scene, position, radius = 600, color = 0x223355) {
    this.position = position.clone();
    this.radius = radius;
    this.color = new THREE.Color(color);
    this.scene = scene;

    // Visual: large transparent sphere
    const geo = new THREE.SphereGeometry(radius, 32, 32);
    const mat = new THREE.MeshBasicMaterial({ color: this.color, transparent: true, opacity: 0.12, depthWrite: false });
    this.mesh = new THREE.Mesh(geo, mat);
    this.mesh.position.copy(this.position);
    scene.add(this.mesh);
    setShadowRecursive(this.mesh, false, true);
  }

  contains(pos) {
    return pos.distanceTo(this.position) < this.radius;
  }

  destroy() { this.scene.remove(this.mesh); }
}

class BlackHole {
  constructor(scene, position, radius = 200) {
    this.position = position.clone();
    this.radius = radius; // event horizon
    this.gravityRadius = radius * 6; // effective gravity zone
    this.scene = scene;

    const geo = new THREE.SphereGeometry(radius * 0.6, 32, 32);
    const mat = new THREE.MeshBasicMaterial({ color: 0x000000 });
    this.mesh = new THREE.Mesh(geo, mat);
    this.mesh.position.copy(this.position);
    scene.add(this.mesh);

    // simple accretion disc
    const disc = new THREE.RingGeometry(radius * 0.8, radius * 2.0, 64);
    const discMat = new THREE.MeshBasicMaterial({ color: 0x222244, side: THREE.DoubleSide, transparent: true, opacity: 0.6 });
    this.disc = new THREE.Mesh(disc, discMat);
    this.disc.rotation.x = Math.PI / 2;
    this.disc.position.copy(this.position);
    scene.add(this.disc);
    setShadowRecursive(this.mesh, true, true);
  }

  applyGravity(target, deltaTime) {
    const dir = this.position.clone().sub(target.position);
    const dist = dir.length();
    if (dist < this.gravityRadius) {
      const strength = (1 - (dist / this.gravityRadius)) * 0.5; // gravity scaling
      target.velocity.add(dir.normalize().multiplyScalar(strength * (deltaTime || 1)));
    }
  }

  isEventHorizon(pos) {
    return pos.distanceTo(this.position) < this.radius;
  }

  destroy() { this.scene.remove(this.mesh); this.scene.remove(this.disc); }
}

class AsteroidField {
  constructor(scene, center, radius = 800, count = 120) {
    this.scene = scene;
    this.center = center.clone();
    this.radius = radius;
    this.asteroids = new THREE.Group();
    for (let i = 0; i < count; i++) {
      const a = Math.random() * Math.PI * 2;
      const r = Math.random() * radius;
      const x = center.x + Math.cos(a) * r;
      const z = center.z + Math.sin(a) * r;
      const y = center.y + (Math.random() - 0.5) * radius * 0.4;
      const s = Math.random() * 3 + 0.7;
      const geo = new THREE.IcosahedronGeometry(s, 0);
      const mat = new THREE.MeshStandardMaterial({ color: 0x777777, roughness: 1.0 });
      const rock = new THREE.Mesh(geo, mat);
      rock.position.set(x, y, z);
      rock.userData = {
        resource: Math.floor(5 + Math.random() * 25),
        spinX: Math.random() * 0.004,
        spinY: Math.random() * 0.004,
        spinZ: Math.random() * 0.004,
        driftVel: new THREE.Vector3(
          THREE.MathUtils.randFloatSpread(0.18),
          THREE.MathUtils.randFloatSpread(0.09),
          THREE.MathUtils.randFloatSpread(0.18)
        ),
        homeY: y,
        orbitSpeed: THREE.MathUtils.randFloat(0.0008, 0.003),
        orbitPhase: Math.random() * Math.PI * 2
      };
      rock.rotation.set(Math.random()*2, Math.random()*2, Math.random()*2);
      rock.castShadow = true;
      rock.receiveShadow = true;
      this.asteroids.add(rock);
    }
    scene.add(this.asteroids);
  }

  update() {
    const rocks = this.asteroids.children || [];
    for (let i = 0; i < rocks.length; i++) {
      const r = rocks[i];
      r.rotation.x += 0.002 + (r.userData.spinX || 0.0015);
      r.rotation.y += 0.001 + (r.userData.spinY || 0.001);
      r.rotation.z += 0.001 + (r.userData.spinZ || 0.0012);

      const data = r.userData || {};
      if (data.driftVel) {
        // Gentle drift so asteroids feel alive while still collectible.
        r.position.add(data.driftVel);
        data.driftVel.multiplyScalar(0.996);

        // Keep asteroids inside field radius with a soft inward pull.
        const toCenter = this.center.clone().sub(r.position);
        const dist = toCenter.length();
        if (dist > this.radius) {
          data.driftVel.add(toCenter.normalize().multiplyScalar(0.06));
        } else if (Math.random() < 0.015) {
          data.driftVel.add(new THREE.Vector3(
            THREE.MathUtils.randFloatSpread(0.05),
            THREE.MathUtils.randFloatSpread(0.03),
            THREE.MathUtils.randFloatSpread(0.05)
          ));
        }

        // Small orbital wobble around field center.
        const a = (Date.now() * (data.orbitSpeed || 0.0015) * 0.001) + (data.orbitPhase || 0);
        r.position.x += Math.cos(a) * 0.045;
        r.position.z += Math.sin(a) * 0.045;
        r.position.y += (Math.sin(a * 1.7) * 0.015) + ((data.homeY - r.position.y) * 0.002);
      }
    }
  }

  destroy() { this.scene.remove(this.asteroids); }
}

class DerelictShip {
  constructor(scene, position) {
    this.scene = scene;
    this.position = position.clone();
    const geo = new THREE.BoxGeometry(8, 3, 12);
    const mat = new THREE.MeshStandardMaterial({ color: 0x555555, roughness: 1.0 });
    this.mesh = new THREE.Mesh(geo, mat);
    this.mesh.position.copy(this.position);
    scene.add(this.mesh);
    setShadowRecursive(this.mesh, true, true);
    this.loot = { salvage: 15 + Math.floor(Math.random() * 36), items: [] };
    this.scavenged = false;
  }

  interact(gameWorld) {
    if (this.scavenged) return 'Already scavenged.';
    this.scavenged = true;
    if (!gameWorld.resources) gameWorld.resources = { minerals: 0, salvage: 0 };
    gameWorld.resources.salvage += this.loot.salvage;
    gameWorld.spawnPowerUp(this.position.clone());
    return `Scavenged derelict: +${this.loot.salvage} salvage`;
  }

  destroy() { this.scene.remove(this.mesh); }
}

class JumpGate {
  constructor(scene, position, pairId) {
    this.scene = scene;
    this.position = position.clone();
    this.pairId = pairId;
    this.linkedGate = null;
    this.cooldownUntil = 0;

    const group = new THREE.Group();
    const ring = new THREE.Mesh(
      new THREE.TorusGeometry(16, 2.2, 12, 36),
      new THREE.MeshStandardMaterial({ color: 0x66ccff, emissive: 0x114477, emissiveIntensity: 0.8 })
    );
    const core = new THREE.Mesh(
      new THREE.CircleGeometry(12, 28),
      new THREE.MeshBasicMaterial({ color: 0x66aaff, transparent: true, opacity: 0.35, side: THREE.DoubleSide })
    );
    core.rotation.y = Math.PI / 2;
    group.add(ring, core);
    group.position.copy(this.position);
    this.mesh = group;
    scene.add(this.mesh);
    setShadowRecursive(this.mesh, true, false);
  }

  update() {
    this.mesh.rotation.z += 0.006;
  }

  destroy() { this.scene.remove(this.mesh); }
}

class Artifact {
  constructor(scene, position) {
    this.scene = scene;
    this.position = position.clone();
    this.collected = false;
    const geom = new THREE.DodecahedronGeometry(3.2, 0);
    const mat = new THREE.MeshStandardMaterial({ color: 0xffd27a, emissive: 0x664411, emissiveIntensity: 0.7, metalness: 0.65, roughness: 0.3 });
    this.mesh = new THREE.Mesh(geom, mat);
    this.mesh.position.copy(this.position);
    scene.add(this.mesh);
    setShadowRecursive(this.mesh, true, false);
    this.spawnTime = Date.now();
  }

  update() {
    this.mesh.rotation.x += 0.014;
    this.mesh.rotation.y += 0.01;
    this.mesh.position.y = this.position.y + Math.sin((Date.now() - this.spawnTime) * 0.003) * 4;
  }

  destroy() { this.scene.remove(this.mesh); }
}

class PowerUp {
  constructor(scene, position, type) {
    this.position = position.clone();
    this.baseY = position.y; // Store base Y for oscillation
    this.type = type; // 'fuel', 'shield', 'ammo'
    
    const geo = new THREE.OctahedronGeometry(2, 2);
    const colors = { fuel: 0x00ff00, shield: 0x0088ff, ammo: 0xffaa00 };
    const mat = new THREE.MeshStandardMaterial({ 
      color: colors[type], 
      emissive: colors[type], 
      emissiveIntensity: 0.8,
      wireframe: true
    });
    this.mesh = new THREE.Mesh(geo, mat);
    this.mesh.position.copy(this.position);
    scene.add(this.mesh);
    this.scene = scene;
    this.spawnTime = Date.now();
  }
  
  update() {
    this.mesh.rotation.x += 0.02;
    this.mesh.rotation.y += 0.02;
    // Oscillate around baseY instead of drifting
    const elapsed = Date.now() - this.spawnTime;
    this.mesh.position.y = this.baseY + Math.sin(elapsed * 0.003) * 3;
  }
  
  destroy() {
    this.scene.remove(this.mesh);
  }
}

class Bullet {
  constructor(scene, position, direction, config) {
    this.velocity = direction.clone().normalize().multiplyScalar(config.speed);
    this.damage = config.damage;
    this.lifespan = 300;
    this.age = 0;
    this.collisionRadius = 1.2;
    this.trailPositions = [];

    const geometry = new THREE.SphereGeometry(0.3, 8, 8);
    const material = new THREE.MeshStandardMaterial({ color: 0xff8800, emissive: 0xff6600, emissiveIntensity: 1.5 });
    this.mesh = new THREE.Mesh(geometry, material);
    this.mesh.position.copy(position);
    
    scene.add(this.mesh);
    this.scene = scene;
    
    // Trail particles
    const trailGeo = new THREE.BufferGeometry();
    const trailPositions = new Float32Array(150 * 3);
    trailGeo.setAttribute("position", new THREE.BufferAttribute(trailPositions, 3));
    this.trailMesh = new THREE.Line(trailGeo, new THREE.LineBasicMaterial({ color: 0xff8800, transparent: true, opacity: 0.8 }));
    scene.add(this.trailMesh);
  }

  update() {
    this.mesh.position.add(this.velocity);
    this.age++;
    
    // Update trail
    this.trailPositions.push(this.mesh.position.clone());
    if (this.trailPositions.length > 50) this.trailPositions.shift();
    
    const trailArray = this.trailMesh.geometry.attributes.position.array;
    for (let i = 0; i < this.trailPositions.length; i++) {
      trailArray[i * 3] = this.trailPositions[i].x;
      trailArray[i * 3 + 1] = this.trailPositions[i].y;
      trailArray[i * 3 + 2] = this.trailPositions[i].z;
    }
    this.trailMesh.geometry.setDrawRange(0, this.trailPositions.length);
    this.trailMesh.geometry.attributes.position.needsUpdate = true;
    
    return this.age < this.lifespan;
  }

  destroy() {
    this.scene.remove(this.mesh);
    this.scene.remove(this.trailMesh);
  }
}

class EnemyBot {
  constructor(scene, position, type = 'standard') {
    this.type = type; // 'standard', 'fast', 'tank'
    const configs = {
      standard: { health: 50, speed: 3, shootInterval: 120, damage: 8 },
      fast: { health: 25, speed: 6, shootInterval: 60, damage: 4 },
      tank: { health: 120, speed: 1.2, shootInterval: 180, damage: 18 },
      swarm: { health: 18, speed: 7, shootInterval: 40, damage: 3 },
      sniper: { health: 35, speed: 2, shootInterval: 260, damage: 28 },
      kamikaze: { health: 20, speed: 9, shootInterval: 9999, damage: 45 },
      shielded: { health: 80, speed: 1.6, shootInterval: 200, damage: 12, shield: 50 },
      boss: { health: 800, speed: 0.8, shootInterval: 90, damage: 25 }
    };
    const cfg = configs[type] || configs.standard;
    const progression = gameWorld ? Math.min(1.2, (gameWorld.score || 0) / 6000) : 0;
    const healthScale = 0.82 + progression * 0.4;
    const damageScale = 0.85 + progression * 0.35;
    const speedScale = 0.9 + progression * 0.25;
    
    this.health = Math.max(8, Math.floor(cfg.health * healthScale));
    this.maxHealth = this.health;
    this.shield = cfg.shield || 0;
    this.position = position.clone();
    this.velocity = new THREE.Vector3();
    this.direction = new THREE.Vector3(0, 0, -1);
    this.shootCooldown = 0;
    this.shootInterval = cfg.shootInterval;
    this.speed = cfg.speed * speedScale;
    this.patrolRange = 1500;
    this.damage = Math.max(2, Math.floor(cfg.damage * damageScale));
    this.attachedToPlayer = false;
    this.attachTime = 0;
    this.lastDamageTime = 0;

    const group = new THREE.Group();
    const typeColors = { standard: 0xff3333, fast: 0xffff00, tank: 0x884444, swarm: 0xff66aa, sniper: 0xff8800, kamikaze: 0xff0066, shielded: 0x8888ff, boss: 0x9933ff };
    const color = typeColors[type] || 0xff3333;
    
    const bodyGeo = new THREE.CylinderGeometry(0.5, 0.8, 3, 12);
    const bodyMat = new THREE.MeshStandardMaterial({ color, emissive: color, emissiveIntensity: 0.5 });
    const body = new THREE.Mesh(bodyGeo, bodyMat);
    
    const noseGeo = new THREE.ConeGeometry(0.5, 1.5, 12);
    const noseMat = new THREE.MeshStandardMaterial({ color });
    const nose = new THREE.Mesh(noseGeo, noseMat);
    nose.position.y = 2;
    
    // Scale for tank enemies
    if (type === 'tank') {
      body.scale.set(1.5, 1.5, 1.5);
      nose.scale.set(1.3, 1.3, 1.3);
    }
    
    group.add(body, nose);
    group.rotation.x = Math.PI / 2;
    group.position.copy(this.position);
    
    this.mesh = group;
    this.scene = scene;
    scene.add(this.mesh);
    setShadowRecursive(this.mesh, true, true);
    setShadowRecursive(this.mesh, true, true);
    styleObjectTheme(this.mesh, 'enemy');
    
    const healthBarGeo = new THREE.PlaneGeometry(3, 0.3);
    const healthBarMat = new THREE.MeshBasicMaterial({ color: 0x00ff00 });
    this.healthBarMesh = new THREE.Mesh(healthBarGeo, healthBarMat);
    this.healthBarMesh.position.y = 3.5;
    this.mesh.add(this.healthBarMesh);
    
    this.initialPos = position.clone();
    // faction assignment
    const factions = ['Pirate', 'Raider', 'Mercenary'];
    this.faction = factions[Math.floor(Math.random() * factions.length)];
  }

  update(playerPos, playerShip) {
    if (this.shootCooldown > 0) this.shootCooldown--;

    // Handle attachment damage
    if (this.attachedToPlayer) {
      const now = Date.now();
      if (now - this.lastDamageTime >= 1000) { // Damage every second
        playerShip.health -= 5;
        this.lastDamageTime = now;
        playSound('damage');
      }
      
      // Move with player
      this.position.copy(playerShip.position).add(new THREE.Vector3(
        THREE.MathUtils.randFloat(-2, 2),
        THREE.MathUtils.randFloat(-2, 2),
        THREE.MathUtils.randFloat(-2, 2)
      ));
      this.mesh.position.copy(this.position);
      return; // Skip normal AI when attached
    }

    const toPlayer = playerPos.clone().sub(this.position);
    const distToPlayer = toPlayer.length();

    // Engagement distance varies by type
    let engagementRange = 400;
    let attackRange = 350;
    if (this.type === 'fast') { engagementRange = 500; attackRange = 400; }
    if (this.type === 'tank') { engagementRange = 300; attackRange = 250; }

    if (distToPlayer < engagementRange) {
      toPlayer.normalize();
      
      // Tank enemies maintain distance; fast enemies pursue aggressively
      if (this.type === 'tank' && distToPlayer < attackRange + 100) {
        // Keep distance - back away
        this.velocity.lerp(toPlayer.multiplyScalar(-this.speed * 0.7), 0.1);
      } else if (this.type === 'kamikaze') {
        // Kamikaze rushes and tries to attach/explode
        this.velocity.lerp(toPlayer.multiplyScalar(this.speed * 1.5), 0.2);
      } else {
        // Pursue
        this.velocity.lerp(toPlayer.multiplyScalar(this.speed), 0.1);
      }
    } else {
      // Patrol when player is not in range
      if (Math.random() < 0.02) {
        this.direction = new THREE.Vector3(
          THREE.MathUtils.randFloat(-1, 1),
          THREE.MathUtils.randFloat(-1, 1),
          THREE.MathUtils.randFloat(-1, 1)
        ).normalize();
      }
      this.velocity.lerp(this.direction.clone().multiplyScalar(this.speed * 0.5), 0.1);
    }

    this.position.add(this.velocity);
    this.mesh.position.copy(this.position);

    // Patrol range enforcement
    const dist = this.position.distanceTo(this.initialPos);
    if (dist > this.patrolRange) {
      this.position.lerp(this.initialPos, 0.1);
      this.mesh.position.copy(this.position);
    }

    // Look at movement direction
    if (this.velocity.length() > 0.1) {
      this.mesh.lookAt(this.position.clone().add(this.velocity));
    }

    // Update health bar
    const healthPercent = this.health / this.maxHealth;
    this.healthBarMesh.scale.x = healthPercent;
    this.healthBarMesh.material.color.setHex(healthPercent > 0.5 ? 0x00ff00 : (healthPercent > 0.25 ? 0xffff00 : 0xff0000));
    // Shield visualization (simple)
    if (this.shield > 0) {
      this.healthBarMesh.material.color.setHex(0x8888ff);
    }
  }

  takeDamage(amount) {
    // Shield absorbs damage first
    if (this.shield && this.shield > 0) {
      const absorbed = Math.min(this.shield, Math.floor(amount * 0.7));
      this.shield -= absorbed;
      amount -= absorbed;
    }
    this.health -= amount;
    return this.health > 0;
  }

  canShoot() {
    return this.shootCooldown <= 0;
  }

  shoot() {
    this.shootCooldown = this.shootInterval;
  }

  destroy() {
    this.scene.remove(this.mesh);
  }
}

class MegaShip {
  constructor(scene, position) {
    this.scene = scene;
    this.position = position.clone();
    this.velocity = new THREE.Vector3();
    this.health = 2200;
    this.maxHealth = 2200;
    this.shootCooldown = 0;
    this.shootInterval = 140;
    this.alienCooldownMs = 0;
    this.alienIntervalMs = 6000;
    this.collisionRadius = 14;

    const group = new THREE.Group();
    const hull = new THREE.Mesh(
      new THREE.CylinderGeometry(5.5, 8, 52, 14),
      new THREE.MeshStandardMaterial({ color: 0x663333, emissive: 0x220808, emissiveIntensity: 0.7 })
    );
    const bridge = new THREE.Mesh(
      new THREE.BoxGeometry(8, 4, 10),
      new THREE.MeshStandardMaterial({ color: 0x996666, emissive: 0x331111, emissiveIntensity: 0.5 })
    );
    bridge.position.set(0, 6, 6);
    const bay = new THREE.Mesh(
      new THREE.BoxGeometry(9, 5, 16),
      new THREE.MeshStandardMaterial({ color: 0x332222, emissive: 0x220000, emissiveIntensity: 0.35 })
    );
    bay.position.set(0, -5, -10);

    group.add(hull, bridge, bay);
    group.rotation.x = Math.PI / 2;
    group.position.copy(this.position);
    this.mesh = group;
    this.scene.add(this.mesh);
    setShadowRecursive(this.mesh, true, true);
    styleObjectTheme(this.mesh, 'mega');
  }

  update(targetPos) {
    if (this.shootCooldown > 0) this.shootCooldown--;
    const toTarget = targetPos.clone().sub(this.position);
    const dist = toTarget.length();
    if (dist > 500) {
      this.velocity.lerp(toTarget.normalize().multiplyScalar(0.9), 0.03);
    } else if (dist < 220) {
      this.velocity.lerp(toTarget.normalize().multiplyScalar(-0.5), 0.05);
    } else {
      this.velocity.multiplyScalar(0.985);
    }
    this.position.add(this.velocity);
    this.mesh.position.copy(this.position);
    this.mesh.lookAt(targetPos);
    this.alienCooldownMs = Math.max(0, this.alienCooldownMs - 16);
  }

  canShoot() {
    return this.shootCooldown <= 0;
  }

  shoot() {
    this.shootCooldown = this.shootInterval;
  }

  canSpawnAliens() {
    return this.alienCooldownMs <= 0;
  }

  spawnedAliens() {
    this.alienCooldownMs = this.alienIntervalMs;
  }

  takeDamage(amount) {
    this.health -= amount;
    return this.health > 0;
  }

  destroy() {
    this.scene.remove(this.mesh);
  }
}

class ColossalDerelict {
  constructor(scene, position, id) {
    this.scene = scene;
    this.position = position.clone();
    this.id = id;
    this.returnPosition = null;
    this.interiorOrigin = this.position.clone().add(new THREE.Vector3(0, -2600, 0));
    this.interiorSize = new THREE.Vector3(170, 70, 230);
    this.wallPadding = 7;

    this.group = new THREE.Group();
    const hull = new THREE.Mesh(
      new THREE.CylinderGeometry(22, 36, 280, 22),
      new THREE.MeshStandardMaterial({ color: 0x353a42, emissive: 0x10161f, emissiveIntensity: 0.35, roughness: 0.82, metalness: 0.22 })
    );
    const spine = new THREE.Mesh(
      new THREE.BoxGeometry(32, 14, 120),
      new THREE.MeshStandardMaterial({ color: 0x465163, emissive: 0x182130, emissiveIntensity: 0.28, roughness: 0.78 })
    );
    spine.position.set(0, 14, 10);
    const tower = new THREE.Mesh(
      new THREE.BoxGeometry(18, 20, 26),
      new THREE.MeshStandardMaterial({ color: 0x5f7087, emissive: 0x22324a, emissiveIntensity: 0.35 })
    );
    tower.position.set(0, 24, 34);
    this.group.add(hull, spine, tower);
    this.group.rotation.x = Math.PI / 2;
    this.group.position.copy(this.position);
    this.scene.add(this.group);
    setShadowRecursive(this.group, true, true);
    styleObjectTheme(this.group, 'colossal');

    const portalOffset = new THREE.Vector3(0, 12, 85);
    this.portalPosition = this.position.clone().add(portalOffset);
    this.outerPortal = new THREE.Group();
    const portalRing = new THREE.Mesh(
      new THREE.TorusGeometry(22, 3.2, 16, 48),
      new THREE.MeshStandardMaterial({ color: 0x66e6ff, emissive: 0x116688, emissiveIntensity: 1.0 })
    );
    const portalCore = new THREE.Mesh(
      new THREE.CircleGeometry(18, 40),
      new THREE.MeshBasicMaterial({ color: 0x66ccff, transparent: true, opacity: 0.36, side: THREE.DoubleSide })
    );
    this.outerPortal.add(portalRing, portalCore);
    this.outerPortal.position.copy(this.portalPosition);
    this.outerPortal.lookAt(this.position.clone().add(new THREE.Vector3(0, 12, 220)));
    this.scene.add(this.outerPortal);
    styleObjectTheme(this.outerPortal, 'portal');

    this.interiorGroup = new THREE.Group();
    const room = new THREE.Mesh(
      new THREE.BoxGeometry(this.interiorSize.x, this.interiorSize.y, this.interiorSize.z),
      new THREE.MeshStandardMaterial({ color: 0x141922, emissive: 0x0a1020, emissiveIntensity: 0.28, side: THREE.BackSide })
    );
    room.position.copy(this.interiorOrigin);
    this.interiorGroup.add(room);

    const exitRing = new THREE.Mesh(
      new THREE.TorusGeometry(12, 1.8, 12, 40),
      new THREE.MeshStandardMaterial({ color: 0x9fe6ff, emissive: 0x2d6180, emissiveIntensity: 0.7 })
    );
    this.exitPortalPosition = this.interiorOrigin.clone().add(new THREE.Vector3(0, 0, 95));
    exitRing.position.copy(this.exitPortalPosition);
    this.interiorGroup.add(exitRing);

    this.chests = [];
    const chestOffsets = [
      new THREE.Vector3(-45, -20, -65),
      new THREE.Vector3(38, -20, -22),
      new THREE.Vector3(0, -20, 28)
    ];
    for (let i = 0; i < chestOffsets.length; i++) {
      const chestPos = this.interiorOrigin.clone().add(chestOffsets[i]);
      const chest = new THREE.Mesh(
        new THREE.BoxGeometry(12, 8, 8),
        new THREE.MeshStandardMaterial({ color: 0xc6903f, emissive: 0x4d2f0a, emissiveIntensity: 0.55, metalness: 0.45, roughness: 0.35 })
      );
      chest.position.copy(chestPos);
      chest.userData = { opened: false, rewardSeed: Math.random() };
      this.chests.push(chest);
      this.interiorGroup.add(chest);
    }

    this.scene.add(this.interiorGroup);
    setShadowRecursive(this.interiorGroup, true, true);
    styleObjectTheme(this.interiorGroup, 'interior');
    // Keep interior hidden until player enters the portal.
    this.interiorGroup.visible = false;
  }

  update() {
    this.group.rotation.z += 0.0007;
    this.outerPortal.rotation.y += 0.016;
    this.outerPortal.rotation.z += 0.005;
    for (let i = 0; i < this.chests.length; i++) {
      const c = this.chests[i];
      if (!c.userData.opened) c.rotation.y += 0.01;
    }
  }

  isNearOuterPortal(pos) {
    return pos.distanceTo(this.portalPosition) < 34;
  }

  isNearExitPortal(pos) {
    return pos.distanceTo(this.exitPortalPosition) < 18;
  }

  getNearbyChest(pos) {
    for (let i = 0; i < this.chests.length; i++) {
      const c = this.chests[i];
      if (!c.userData.opened && c.position.distanceTo(pos) < 14) return c;
    }
    return null;
  }

  enter(gameWorld) {
    if (!gameWorld || !gameWorld.ship) return;
    this.returnPosition = gameWorld.ship.position.clone();
    const spawnPos = this.interiorOrigin.clone().add(new THREE.Vector3(0, -10, 72));
    this.interiorGroup.visible = true;
    gameWorld.ship.position.copy(spawnPos);
    gameWorld.ship.mesh.position.copy(spawnPos);
    gameWorld.ship.velocity.multiplyScalar(0);
    gameWorld.activeDerelictInterior = this;
    gameWorld.logEvent(`Entered colossal derelict ${this.id}`);
    showFloatingText('Entered colossal ship interior', 1600);
    playSound('achievement');
  }

  exit(gameWorld) {
    if (!gameWorld || !gameWorld.ship) return;
    const outPos = this.portalPosition.clone().add(new THREE.Vector3(0, 14, 52));
    this.interiorGroup.visible = false;
    gameWorld.ship.position.copy(outPos);
    gameWorld.ship.mesh.position.copy(outPos);
    gameWorld.ship.velocity.multiplyScalar(0);
    gameWorld.activeDerelictInterior = null;
    gameWorld.logEvent(`Exited colossal derelict ${this.id}`);
    showFloatingText('Exited colossal ship', 1400);
    playSound('pickup');
  }

  constrainInside(gameWorld) {
    if (!gameWorld || !gameWorld.ship) return;
    const ship = gameWorld.ship;
    const p = ship.position.clone();
    const local = p.clone().sub(this.interiorOrigin);
    const halfX = (this.interiorSize.x * 0.5) - this.wallPadding;
    const halfY = (this.interiorSize.y * 0.5) - this.wallPadding;
    const halfZ = (this.interiorSize.z * 0.5) - this.wallPadding;

    const clamped = new THREE.Vector3(
      THREE.MathUtils.clamp(local.x, -halfX, halfX),
      THREE.MathUtils.clamp(local.y, -halfY, halfY),
      THREE.MathUtils.clamp(local.z, -halfZ, halfZ)
    );

    if (!clamped.equals(local)) {
      const world = this.interiorOrigin.clone().add(clamped);
      ship.position.copy(world);
      ship.mesh.position.copy(world);

      if (local.x !== clamped.x) ship.velocity.x = 0;
      if (local.y !== clamped.y) ship.velocity.y = 0;
      if (local.z !== clamped.z) ship.velocity.z = 0;
    }
  }

  openChest(chest, gameWorld) {
    if (!chest || chest.userData.opened || !gameWorld) return false;
    chest.userData.opened = true;
    chest.material.color.setHex(0x6f6f6f);
    chest.material.emissive.setHex(0x111111);
    chest.rotation.x = Math.PI * 0.2;

    const seed = chest.userData.rewardSeed || Math.random();
    const scoreGain = 350 + Math.floor(seed * 500);
    const mineralsGain = 35 + Math.floor(seed * 75);
    const salvageGain = 20 + Math.floor(seed * 45);
    const upgradeGain = 20 + Math.floor(seed * 35);

    if (!gameWorld.resources) gameWorld.resources = { minerals: 0, salvage: 0 };
    gameWorld.score += scoreGain;
    gameWorld.resources.minerals += mineralsGain;
    gameWorld.resources.salvage += salvageGain;
    gameWorld.upgradePoints += upgradeGain;
    if (gameWorld.ship) {
      gameWorld.ship.addAmmo(80);
      gameWorld.ship.refillFuel(20);
      gameWorld.ship.addShield(25);
    }

    showFloatingText(`Chest opened: +${scoreGain} score, +${mineralsGain} minerals`, 2200);
    playSound('pickup');
    return true;
  }

  destroy() {
    this.scene.remove(this.group);
    this.scene.remove(this.outerPortal);
    this.scene.remove(this.interiorGroup);
  }
}

class HelperBot {
  constructor(scene, position, role = 'combat', source = 'player') {
    this.scene = scene;
    this.position = position.clone();
    this.velocity = new THREE.Vector3();
    this.role = role; // 'combat' | 'harvester' | 'faction'
    this.source = source; // 'player' | 'faction'
    this.health = role === 'faction' ? 140 : 110;
    this.maxHealth = this.health;
    this.attackCooldown = 0;
    this.collectCooldown = 0;
    this.collisionRadius = 3.4;

    const color = role === 'harvester' ? 0x55ddaa : (role === 'faction' ? 0x66ff66 : 0x55aaff);
    const mesh = new THREE.Group();
    const body = new THREE.Mesh(
      new THREE.SphereGeometry(1.5, 12, 12),
      new THREE.MeshStandardMaterial({ color, emissive: color, emissiveIntensity: 0.45 })
    );
    const wing = new THREE.Mesh(
      new THREE.BoxGeometry(3.5, 0.2, 1.2),
      new THREE.MeshStandardMaterial({ color: 0xbbddff, emissive: 0x223344, emissiveIntensity: 0.2 })
    );
    mesh.add(body, wing);
    mesh.position.copy(this.position);
    this.mesh = mesh;
    scene.add(this.mesh);
    setShadowRecursive(this.mesh, true, true);
  }

  destroy() {
    this.scene.remove(this.mesh);
  }
}

function buildShipVisual(config) {
  const scale = config.scale || 1.0;
  const bodyType = config.bodyType || 'balanced';
  const tankType = config.tankType || 'standard';
  const engineType = config.engineType || 'pulse';

  const group = new THREE.Group();

  // Body variants
  let bodyGeo;
  let bodyMat;
  if (bodyType === 'sleek') {
    bodyGeo = new THREE.CylinderGeometry(0.45 * scale, 0.95 * scale, 5.5 * scale, 14);
    bodyMat = new THREE.MeshStandardMaterial({ color: 0x5ecbff, emissive: 0x114466, emissiveIntensity: 0.7, metalness: 0.4, roughness: 0.35 });
  } else if (bodyType === 'heavy') {
    bodyGeo = new THREE.CylinderGeometry(0.95 * scale, 1.35 * scale, 4.8 * scale, 12);
    bodyMat = new THREE.MeshStandardMaterial({ color: 0xc78a4f, emissive: 0x442211, emissiveIntensity: 0.5, metalness: 0.25, roughness: 0.55 });
  } else {
    bodyGeo = new THREE.CylinderGeometry(0.7 * scale, 1.2 * scale, 5 * scale, 16);
    bodyMat = new THREE.MeshStandardMaterial({ color: 0x66e8b8, emissive: 0x124433, emissiveIntensity: 0.55, metalness: 0.35, roughness: 0.45 });
  }
  const body = new THREE.Mesh(bodyGeo, bodyMat);
  group.add(body);

  // Body extras for visual identity
  if (bodyType === 'sleek') {
    const finMat = new THREE.MeshStandardMaterial({ color: 0xa8e5ff, emissive: 0x224466, emissiveIntensity: 0.25 });
    const finL = new THREE.Mesh(new THREE.BoxGeometry(0.2 * scale, 1.6 * scale, 2.4 * scale), finMat);
    const finR = finL.clone();
    finL.position.set(-0.95 * scale, -0.1 * scale, -0.8 * scale);
    finR.position.set(0.95 * scale, -0.1 * scale, -0.8 * scale);
    group.add(finL, finR);
  } else if (bodyType === 'heavy') {
    const podMat = new THREE.MeshStandardMaterial({ color: 0x8e5d31, emissive: 0x2d1708, emissiveIntensity: 0.2 });
    const podL = new THREE.Mesh(new THREE.BoxGeometry(0.9 * scale, 0.8 * scale, 2.2 * scale), podMat);
    const podR = podL.clone();
    podL.position.set(-1.5 * scale, 0, -0.3 * scale);
    podR.position.set(1.5 * scale, 0, -0.3 * scale);
    group.add(podL, podR);
  } else {
    const ring = new THREE.Mesh(
      new THREE.TorusGeometry(0.95 * scale, 0.08 * scale, 10, 20),
      new THREE.MeshStandardMaterial({ color: 0x88ffd8, emissive: 0x224433, emissiveIntensity: 0.22 })
    );
    ring.rotation.x = Math.PI / 2;
    ring.position.y = -0.2 * scale;
    group.add(ring);
  }

  // Tank/booster variants
  let tank;
  if (tankType === 'turbo') {
    const turboMat = new THREE.MeshStandardMaterial({ color: 0xff7d3c, emissive: 0x6b2100, emissiveIntensity: 0.5 });
    const boosterL = new THREE.Mesh(new THREE.CylinderGeometry(0.24 * scale, 0.3 * scale, 2.2 * scale, 10), turboMat);
    const boosterR = boosterL.clone();
    boosterL.position.set(-0.8 * scale, -1.4 * scale, -0.2 * scale);
    boosterR.position.set(0.8 * scale, -1.4 * scale, -0.2 * scale);
    group.add(boosterL, boosterR);
    tank = boosterL;
  } else if (tankType === 'economy') {
    const ecoMat = new THREE.MeshStandardMaterial({ color: 0x56a8ff, emissive: 0x133b66, emissiveIntensity: 0.35 });
    tank = new THREE.Mesh(new THREE.CylinderGeometry(0.65 * scale, 0.75 * scale, 2.5 * scale, 12), ecoMat);
    tank.position.y = -1.25 * scale;
    group.add(tank);
  } else {
    const tankMat = new THREE.MeshStandardMaterial({ color: 0x4fb9ff, emissive: 0x1d4f77, emissiveIntensity: 0.4 });
    tank = new THREE.Mesh(new THREE.CylinderGeometry(0.5 * scale, 0.6 * scale, 2 * scale, 12), tankMat);
    tank.position.y = -1 * scale;
    group.add(tank);
  }

  // Weapon/nose variants
  let nose;
  if (engineType === 'plasma') {
    const plasmaMat = new THREE.MeshStandardMaterial({ color: 0xff4466, emissive: 0xaa1133, emissiveIntensity: 0.7 });
    const prongL = new THREE.Mesh(new THREE.ConeGeometry(0.3 * scale, 2.3 * scale, 12), plasmaMat);
    const prongR = prongL.clone();
    prongL.position.set(-0.3 * scale, 3.2 * scale, 0);
    prongR.position.set(0.3 * scale, 3.2 * scale, 0);
    group.add(prongL, prongR);
    nose = prongL;
  } else if (engineType === 'missile') {
    const missileMat = new THREE.MeshStandardMaterial({ color: 0xffb14a, emissive: 0x7a3b00, emissiveIntensity: 0.55 });
    const launcher = new THREE.Mesh(new THREE.BoxGeometry(1.2 * scale, 2.2 * scale, 1.1 * scale), missileMat);
    launcher.position.y = 3.1 * scale;
    group.add(launcher);
    nose = launcher;
  } else {
    const pulseMat = new THREE.MeshStandardMaterial({ color: 0x6ce5ff, emissive: 0x2288aa, emissiveIntensity: 0.7 });
    nose = new THREE.Mesh(new THREE.ConeGeometry(0.7 * scale, 2 * scale, 16), pulseMat);
    nose.position.y = 3.5 * scale;
    group.add(nose);
  }

  // Thruster flame
  const thrusterMat = new THREE.MeshStandardMaterial({ color: 0x00aaff, emissive: 0x0088ff, emissiveIntensity: 2 });
  const thruster = new THREE.Mesh(new THREE.SphereGeometry(0.3 * scale, 16, 16), thrusterMat);
  thruster.position.set(0, -2.5 * scale, 0);
  group.add(thruster);

  group.rotation.x = Math.PI / 2;

  return {
    group,
    bodyMesh: body,
    tankMesh: tank,
    engineMesh: nose,
    bodyMaterial: bodyMat
  };
}

class Ship {
  constructor(scene, config) {
    this.health = config.health;
    this.maxHealth = config.health;
    this.position = new THREE.Vector3(0, 10, 50);
    this.velocity = new THREE.Vector3();
    this.rotation = new THREE.Euler(0, 0, 0);
    
    this.acceleration = config.accel;
    this.maxSpeed = config.maxSpeed;
    this.friction = 0.965;
    this.controlSensitivity = settingsState.controlSensitivity;
    this.fuelConsumption = 1.0 / config.fuel;
    
    this.weaponConfig = config.weapon;
    this.shootCooldown = 0;
    
    this.fuel = 100;
    this.maxFuel = 100;
    this.shieldHealth = 0;
    this.maxShield = 50;
    this.shieldRegenRate = 0.1;
    this.ammo = 999;
    this.maxAmmo = 999;
    this.reloadAmount = 220;
    this.reloadCooldown = 0;
    this.reloadCooldownFrames = 22;
    this.passiveAmmoRegenTick = 0;
    this.stageFuelBoosts = [];
    this.damageLevel = 0;
    this.previousVelocity = new THREE.Vector3();
    
    this.landed = false;
    this.landedPlanet = null;
    this.safeLandingSpeed = 5;
    this.lastCrashTime = Date.now();
    this.extraStages = 0;
    this.detachedStageDebris = [];

    const visual = buildShipVisual(config);
    const group = visual.group;
    group.position.copy(this.position);
    
    this.mesh = group;
    this.bodyMesh = visual.bodyMesh;
    this.tankMesh = visual.tankMesh;
    this.engineMesh = visual.engineMesh;
    this.bodyMaterial = visual.bodyMaterial;
    this.scale = config.scale;
    this.scene = scene;
    scene.add(this.mesh);
    styleObjectTheme(this.mesh, 'player');

    // Layered thruster VFX: hot core + exhaust + smoke plume.
    this._vfxTick = 0;
    this._thrusterCoreCount = 240;
    this._thrusterExhaustCount = 420;
    this._thrusterSmokeCount = 320;

    const coreGeo = new THREE.BufferGeometry();
    this._corePositions = new Float32Array(this._thrusterCoreCount * 3);
    coreGeo.setAttribute("position", new THREE.BufferAttribute(this._corePositions, 3));
    this.thrusterParticles = new THREE.Points(coreGeo, new THREE.PointsMaterial({
      color: 0x8ee8ff, size: 0.2, transparent: true, opacity: 0.95, blending: THREE.AdditiveBlending, depthWrite: false
    }));
    this.thrusterParticles.frustumCulled = false;
    scene.add(this.thrusterParticles);

    const exhaustGeo = new THREE.BufferGeometry();
    this._exhaustPositions = new Float32Array(this._thrusterExhaustCount * 3);
    exhaustGeo.setAttribute("position", new THREE.BufferAttribute(this._exhaustPositions, 3));
    this.exhaustParticles = new THREE.Points(exhaustGeo, new THREE.PointsMaterial({
      color: 0x4dbdff, size: 0.28, transparent: true, opacity: 0.72, blending: THREE.AdditiveBlending, depthWrite: false
    }));
    this.exhaustParticles.frustumCulled = false;
    scene.add(this.exhaustParticles);

    const smokeGeo = new THREE.BufferGeometry();
    this._smokePositions = new Float32Array(this._thrusterSmokeCount * 3);
    smokeGeo.setAttribute("position", new THREE.BufferAttribute(this._smokePositions, 3));
    this.smokeParticles = new THREE.Points(smokeGeo, new THREE.PointsMaterial({
      color: 0x9aa4af, size: 0.42, transparent: true, opacity: 0.28, depthWrite: false
    }));
    this.smokeParticles.frustumCulled = false;
    scene.add(this.smokeParticles);

    this._coreState = Array.from({ length: this._thrusterCoreCount }, () => ({ vel: new THREE.Vector3(), life: 0 }));
    this._exhaustState = Array.from({ length: this._thrusterExhaustCount }, () => ({ vel: new THREE.Vector3(), life: 0 }));
    this._smokeState = Array.from({ length: this._thrusterSmokeCount }, () => ({ vel: new THREE.Vector3(), life: 0 }));
    
    // Damage particles (smoke/sparks)
    const damageGeo = new THREE.BufferGeometry();
    const damagePositions = new Float32Array(200 * 3);
    damageGeo.setAttribute("position", new THREE.BufferAttribute(damagePositions, 3));
    this.damageParticles = new THREE.Points(damageGeo, new THREE.PointsMaterial({ color: 0xff6600, size: 0.3, transparent: true, opacity: 0.6 }));
    scene.add(this.damageParticles);

    // Spark particles for mid-health damage state
    const sparkGeo = new THREE.BufferGeometry();
    const sparkPositions = new Float32Array(140 * 3);
    sparkGeo.setAttribute("position", new THREE.BufferAttribute(sparkPositions, 3));
    this.sparkParticles = new THREE.Points(sparkGeo, new THREE.PointsMaterial({ color: 0xffee88, size: 0.18, transparent: true, opacity: 0.0 }));
    scene.add(this.sparkParticles);

    // Engine trail line
    this.trailHistory = [];
    const trailGeo = new THREE.BufferGeometry();
    const trailArr = new Float32Array(90 * 3);
    trailGeo.setAttribute('position', new THREE.BufferAttribute(trailArr, 3));
    this.engineTrail = new THREE.Line(
      trailGeo,
      new THREE.LineBasicMaterial({ color: 0x66ccff, transparent: true, opacity: 0.45 })
    );
    scene.add(this.engineTrail);

    // Detachable parts for heavy damage state
    this.damagePanels = [];
    this.detachedDebris = [];
    this._partsDropped = 0;
    this._lastSparkPulse = 0;
    const panelGeo = new THREE.BoxGeometry(0.35 * config.scale, 0.12 * config.scale, 1.0 * config.scale);
    const panelMat = new THREE.MeshStandardMaterial({ color: 0x777777, metalness: 0.6, roughness: 0.5 });
    const leftPanel = new THREE.Mesh(panelGeo, panelMat.clone());
    leftPanel.position.set(-0.9 * config.scale, 0, -0.4 * config.scale);
    leftPanel.userData = { detached: false };
    const rightPanel = new THREE.Mesh(panelGeo, panelMat.clone());
    rightPanel.position.set(0.9 * config.scale, 0, -0.4 * config.scale);
    rightPanel.userData = { detached: false };
    this.mesh.add(leftPanel);
    this.mesh.add(rightPanel);
    this.damagePanels.push(leftPanel, rightPanel);

    // Stackable rocket stages (purchased in shop).
    this.stageStack = new THREE.Group();
    this.mesh.add(this.stageStack);
    this.refreshStageVisuals();
    
    // Apply current skin
    const currentSkin = localStorage.getItem('currentSkin');
    if (currentSkin) {
      setTimeout(() => applySkin(currentSkin), 100); // Delay to ensure mesh is ready
    }
  }

  updatePhysics(keys, planets) {
    this.updateStageFuelBoosts();
    if (this.landed) return;

    if (this.shootCooldown > 0) this.shootCooldown--;
    if (this.reloadCooldown > 0) this.reloadCooldown--;
    this.passiveAmmoRegenTick++;
    if (this.passiveAmmoRegenTick >= 60) {
      this.passiveAmmoRegenTick = 0;
      this.addAmmo(4);
    }
    const accelStep = this.acceleration * this.controlSensitivity;
    const outOfFuel = this.fuel <= 0.05;

    let isMoving = false;
    if (!outOfFuel) {
      if (keys["KeyW"]) { this.velocity.z -= accelStep; isMoving = true; }
      if (keys["KeyS"]) { this.velocity.z += accelStep; isMoving = true; }
      if (keys["KeyA"]) { this.velocity.x -= accelStep; isMoving = true; }
      if (keys["KeyD"]) { this.velocity.x += accelStep; isMoving = true; }
      if (keys["Space"]) { this.velocity.y += accelStep; isMoving = true; }
      if (keys["ShiftLeft"]) { this.velocity.y -= accelStep; isMoving = true; }
    }
    
    // Consume fuel when moving
    if (!outOfFuel && isMoving) {
      this.fuel = Math.max(0, this.fuel - 0.1 * (this.velocity.length() / this.maxSpeed));
      if (this.fuel <= 0) {
        this.velocity.multiplyScalar(0.9); // Slow down if out of fuel
      }
    }

    // Inertia mode: no thrust acceleration, but controls can steer travel direction.
    if (outOfFuel) {
      const steer = new THREE.Vector3(
        (keys["KeyD"] ? 1 : 0) - (keys["KeyA"] ? 1 : 0),
        (keys["Space"] ? 1 : 0) - (keys["ShiftLeft"] ? 1 : 0),
        (keys["KeyS"] ? 1 : 0) - (keys["KeyW"] ? 1 : 0)
      );
      const speed = this.velocity.length();
      if (steer.lengthSq() > 0.0001 && speed > 0.01) {
        const desiredDir = steer.normalize();
        const currentDir = this.velocity.clone().normalize();
        const steered = currentDir.lerp(desiredDir, 0.06).normalize();
        this.velocity.copy(steered.multiplyScalar(speed));
      }
      isMoving = speed > 0.2;
    }

    // Regenerate shield
    this.shieldHealth = Math.min(this.maxShield, this.shieldHealth + this.shieldRegenRate);

    this.velocity.clampLength(0, this.maxSpeed);
    this.velocity.multiplyScalar(outOfFuel ? 1.0 : this.friction);

    this.applyGravity(planets);

    this.position.add(this.velocity);
    this.mesh.position.copy(this.position);
    this.updateEngineTrail(isMoving);
    this.updateDetachedStages();
    
    // Check for high acceleration to detach enemies
    const acceleration = this.velocity.clone().sub(this.previousVelocity).length();
    if (acceleration > 2) { // Threshold for "aggressive" movement
      // This will be called from GameWorld
    }
    this.previousVelocity.copy(this.velocity);
  }

  refreshStageVisuals() {
    if (!this.stageStack) return;
    while (this.stageStack.children.length) {
      this.stageStack.remove(this.stageStack.children[0]);
    }
    for (let i = 0; i < this.extraStages; i++) {
      const seg = new THREE.Mesh(
        new THREE.CylinderGeometry(0.52 * this.scale, 0.62 * this.scale, 0.95 * this.scale, 12),
        new THREE.MeshStandardMaterial({ color: 0x8f9fb4, emissive: 0x243245, emissiveIntensity: 0.22, metalness: 0.62, roughness: 0.38 })
      );
      seg.position.set(0, -1.8 * this.scale - (i * 0.92 * this.scale), 0);
      this.stageStack.add(seg);
    }
    styleObjectTheme(this.stageStack, 'player');
  }

  addRocketStage() {
    this.extraStages += 1;
    this.maxFuel = Math.floor(this.maxFuel + 45);
    const stageFuelBoostAmount = 35;
    this.fuel = Math.min(this.maxFuel, this.fuel + stageFuelBoostAmount);
    this.stageFuelBoosts.push({ amount: stageFuelBoostAmount, expiresAt: Date.now() + 180000 });
    this.maxSpeed *= 1.035;
    this.acceleration *= 1.02;
    this.refreshStageVisuals();
    return this.extraStages;
  }

  separateStage() {
    if (this.extraStages <= 0) return false;

    this.extraStages -= 1;
    if (this.stageFuelBoosts.length) this.stageFuelBoosts.shift();
    this.maxFuel = Math.max(100, Math.floor(this.maxFuel - 28));
    this.fuel = Math.min(this.fuel, this.maxFuel);
    this.maxSpeed *= 1.06;
    this.acceleration *= 1.08;
    this.refillFuel(18);

    const stageMesh = new THREE.Mesh(
      new THREE.CylinderGeometry(0.52 * this.scale, 0.62 * this.scale, 0.95 * this.scale, 12),
      new THREE.MeshStandardMaterial({ color: 0x6f7c8e, emissive: 0x1c2632, emissiveIntensity: 0.15, metalness: 0.5, roughness: 0.55 })
    );
    stageMesh.position.copy(this.mesh.position.clone().add(new THREE.Vector3(0, -1.6 * this.scale, 0)));
    stageMesh.rotation.copy(this.mesh.rotation);
    this.scene.add(stageMesh);
    setShadowRecursive(stageMesh, true, true);
    this.detachedStageDebris.push({
      mesh: stageMesh,
      velocity: new THREE.Vector3(
        this.velocity.x * 0.25 + THREE.MathUtils.randFloatSpread(0.18),
        this.velocity.y - 0.28,
        this.velocity.z * 0.25 + THREE.MathUtils.randFloatSpread(0.18)
      ),
      age: 0
    });

    this.refreshStageVisuals();
    return true;
  }

  updateDetachedStages() {
    if (!this.detachedStageDebris.length) return;
    for (let i = this.detachedStageDebris.length - 1; i >= 0; i--) {
      const d = this.detachedStageDebris[i];
      d.age++;
      d.velocity.multiplyScalar(0.992);
      d.velocity.y -= 0.008;
      d.mesh.position.add(d.velocity);
      d.mesh.rotation.x += 0.03;
      d.mesh.rotation.z += 0.02;
      if (d.age > 280) {
        this.scene.remove(d.mesh);
        this.detachedStageDebris.splice(i, 1);
      }
    }
  }

  updateEngineTrail(isMoving) {
    const engineActive = !this.landed && this.fuel > 0.05;
    const backOffset = new THREE.Vector3(0, 0, 2.8 * this.scale).applyQuaternion(this.mesh.quaternion);
    const sample = this.position.clone().add(backOffset);
    if (engineActive && (isMoving || this.velocity.length() > 0.6)) {
      this.trailHistory.push(sample);
      if (this.trailHistory.length > 90) this.trailHistory.shift();
    } else if (this.trailHistory.length > 0) {
      this.trailHistory.shift();
    }
    const arr = this.engineTrail.geometry.attributes.position.array;
    for (let i = 0; i < 90; i++) {
      const p = this.trailHistory[i] || sample;
      arr[i * 3] = p.x;
      arr[i * 3 + 1] = p.y;
      arr[i * 3 + 2] = p.z;
    }
    this.engineTrail.geometry.attributes.position.needsUpdate = true;
    this.engineTrail.material.opacity = engineActive ? Math.min(0.75, 0.15 + this.velocity.length() * 0.04) : 0;
  }

  applyGravity(planets) {
    let closest = null;
    let minDist = Infinity;
    planets.forEach(p => {
      const dist = this.position.distanceTo(p.position);
      if (dist < minDist) { minDist = dist; closest = p; }
    });

    if (closest && minDist < 400) {
      const dir = closest.position.clone().sub(this.position).normalize();
      this.velocity.add(dir.multiplyScalar(0.015 * (400 / minDist)));
    }
  }

  updateThrusterParticles() {
    this._vfxTick += 0.016;
    // Keep a tiny floor so accidental slider/state issues don't fully hide thrust VFX.
    const vfxMul = Math.max(0.45, clamp(settingsState.vfxIntensity, 0, 1.5));
    const speedRatio = Math.min(1.35, this.velocity.length() / Math.max(1, this.maxSpeed));
    const engineActive = !this.landed && this.fuel > 0.05;
    const throttle = engineActive ? Math.max(0.2, 0.45 + speedRatio * 0.85) : 0;

    const nozzle = this.position.clone().add(new THREE.Vector3(0, 0, 2.6 * this.scale).applyQuaternion(this.mesh.quaternion));
    const back = new THREE.Vector3(0, 0, 1).applyQuaternion(this.mesh.quaternion).normalize();
    const shipInfluence = this.velocity.clone().multiplyScalar(0.09);

    const updateLayer = (positions, state, count, spawnRate, speedMul, spread, drag, lift) => {
      for (let i = 0; i < count; i++) {
        const idx = i * 3;
        const p = new THREE.Vector3(positions[idx], positions[idx + 1], positions[idx + 2]);
        const s = state[i];
        s.life -= 1;

        if (s.life <= 0 && Math.random() < spawnRate) {
          p.copy(nozzle).add(new THREE.Vector3(
            (Math.random() - 0.5) * 0.35 * this.scale,
            (Math.random() - 0.5) * 0.35 * this.scale,
            (Math.random() - 0.5) * 0.28 * this.scale
          ));
          const jitter = new THREE.Vector3(
            (Math.random() - 0.5) * spread,
            (Math.random() - 0.5) * spread * 0.6,
            (Math.random() - 0.5) * spread
          );
          s.vel.copy(back.clone().multiplyScalar(speedMul * (0.8 + Math.random() * 0.6) * throttle)).add(jitter).add(shipInfluence);
          s.life = 10 + Math.floor(Math.random() * 26);
        }

        if (s.life > 0) {
          s.vel.multiplyScalar(drag);
          s.vel.y += lift;
          s.vel.x += Math.sin(this._vfxTick * 10 + i * 0.19) * 0.0025;
          s.vel.z += Math.cos(this._vfxTick * 8 + i * 0.17) * 0.0025;
          p.add(s.vel);
          positions[idx] = p.x;
          positions[idx + 1] = p.y;
          positions[idx + 2] = p.z;
        } else {
          positions[idx] = 999999;
          positions[idx + 1] = 999999;
          positions[idx + 2] = 999999;
        }
      }
    };

    if (engineActive) {
      updateLayer(this._corePositions, this._coreState, this._thrusterCoreCount, 0.96 * vfxMul, 0.56, 0.045, 0.93, 0.0008);
      updateLayer(this._exhaustPositions, this._exhaustState, this._thrusterExhaustCount, 0.86 * vfxMul, 0.34, 0.12, 0.955, 0.0013);
      updateLayer(this._smokePositions, this._smokeState, this._thrusterSmokeCount, 0.76 * vfxMul, 0.17, 0.17, 0.975, 0.0024);
    } else {
      for (let i = 0; i < this._corePositions.length; i++) this._corePositions[i] = 999999;
      for (let i = 0; i < this._exhaustPositions.length; i++) this._exhaustPositions[i] = 999999;
      for (let i = 0; i < this._smokePositions.length; i++) this._smokePositions[i] = 999999;
    }

    this.thrusterParticles.geometry.attributes.position.needsUpdate = true;
    this.exhaustParticles.geometry.attributes.position.needsUpdate = true;
    this.smokeParticles.geometry.attributes.position.needsUpdate = true;
    this.thrusterParticles.material.opacity = engineActive ? THREE.MathUtils.clamp((0.5 + throttle * 0.5) * vfxMul, 0.08, 1) : 0;
    this.exhaustParticles.material.opacity = engineActive ? THREE.MathUtils.clamp((0.18 + throttle * 0.52) * vfxMul, 0.06, 0.85) : 0;
    this.smokeParticles.material.opacity = engineActive ? THREE.MathUtils.clamp((0.08 + speedRatio * 0.2) * vfxMul, 0.04, 0.34) : 0;
    
    // Damage particles when health is low
    if (this.health < this.maxHealth * 0.3) {
      this.damageLevel = (this.maxHealth * 0.3 - this.health) / (this.maxHealth * 0.3);
      const damagePositions = this.damageParticles.geometry.attributes.position.array;
      for (let i = 0; i < damagePositions.length; i += 3) {
        damagePositions[i] = this.position.x + (Math.random() - 0.5) * 2 * this.scale;
        damagePositions[i + 1] = this.position.y + (Math.random() - 0.5) * 2 * this.scale + 2 * this.scale;
        damagePositions[i + 2] = this.position.z + (Math.random() - 0.5) * 2 * this.scale;
      }
      this.damageParticles.geometry.attributes.position.needsUpdate = true;
      this.damageParticles.material.opacity = Math.min(1, this.damageLevel * 0.8);
    } else {
      this.damageParticles.material.opacity = 0;
    }

    // Spark state at moderate damage
    if (this.health < this.maxHealth * 0.6) {
      const sparkPositions = this.sparkParticles.geometry.attributes.position.array;
      for (let i = 0; i < sparkPositions.length; i += 3) {
        sparkPositions[i] = this.position.x + (Math.random() - 0.5) * 1.3 * this.scale;
        sparkPositions[i + 1] = this.position.y + (Math.random() - 0.3) * 1.0 * this.scale;
        sparkPositions[i + 2] = this.position.z + (Math.random() - 0.5) * 1.4 * this.scale;
      }
      this.sparkParticles.geometry.attributes.position.needsUpdate = true;
      this.sparkParticles.material.opacity = 0.25 + (1 - this.health / this.maxHealth) * 0.5;
      if (Date.now() - this._lastSparkPulse > 1400) {
        playSound('sparks');
        this._lastSparkPulse = Date.now();
      }
    } else {
      this.sparkParticles.material.opacity = 0;
    }

    // Severe damage: parts break off
    if (this.health < this.maxHealth * 0.22 && this._partsDropped < this.damagePanels.length) {
      const part = this.damagePanels[this._partsDropped];
      if (part && !part.userData.detached) {
        const worldPos = new THREE.Vector3();
        part.getWorldPosition(worldPos);
        this.mesh.remove(part);
        part.position.copy(worldPos);
        part.userData.detached = true;
        part.userData.velocity = new THREE.Vector3(
          (Math.random() - 0.5) * 1.5,
          Math.random() * 0.8,
          (Math.random() - 0.5) * 1.5
        );
        this.scene.add(part);
        this.detachedDebris.push(part);
        this._partsDropped++;
        playSound('asteroidHit');
      }
    }

    for (let i = this.detachedDebris.length - 1; i >= 0; i--) {
      const d = this.detachedDebris[i];
      const v = d.userData.velocity || new THREE.Vector3();
      d.position.add(v);
      v.multiplyScalar(0.985);
      d.rotation.x += 0.06;
      d.rotation.y += 0.045;
      if (d.position.distanceTo(this.position) > 1200) {
        this.scene.remove(d);
        this.detachedDebris.splice(i, 1);
      }
    }
  }

  checkLanding(planets, keys) {
    let closest = null;
    let minDist = Infinity;
    planets.forEach(p => {
      const dist = this.position.distanceTo(p.position);
      if (dist < minDist) { minDist = dist; closest = p; }
    });
    if (!closest) return null;

    const distanceToPlanet = this.position.distanceTo(closest.position);
    
    // Scale safe zone relative to planet radius
    const safeZoneStart = closest.radius;
    const safeZoneEnd = closest.radius + (closest.radius * 0.2 + 8);
    const isSafeZone = distanceToPlanet > safeZoneStart && distanceToPlanet < safeZoneEnd && this.velocity.length() < this.safeLandingSpeed;
    
    if (isSafeZone) {
      document.getElementById('landingZone').style.display = 'inline';
    } else {
      document.getElementById('landingZone').style.display = 'none';
    }
    
    // Handle takeoff if already landed
    if (this.landed && keys["KeyR"]) {
      this.landed = false;
      this.landedPlanet = null;
      this.velocity.set(0, 0, 2);
      return "TAKEOFF";
    }
    
    // Refuel continuously while landed
    if (this.landed) {
      // If planet has a player-formed base, refuel/repair faster
      const baseTier = this.landedPlanet && this.landedPlanet.hasBase ? (this.landedPlanet.baseLevel || 1) : 0;
      const baseRefill = baseTier > 0 ? (0.2 + Math.min(0.2, baseTier * 0.05)) : 0.05;
      this.fuel = Math.min(this.maxFuel, this.fuel + baseRefill);
      if (this.landedPlanet && this.landedPlanet.hasBase) {
        // Passive small repair when on base
        this.health = Math.min(this.maxHealth, this.health + 0.16 + Math.min(0.18, baseTier * 0.05));
      }
      if (distanceToPlanet > closest.radius * 1.5) {
        this.landed = false;
        this.landedPlanet = null;
      }
      return null;
    }
    
    // Attempt landing
    if (distanceToPlanet < closest.radius) {
      if (this.velocity.length() < this.safeLandingSpeed) {
        this.landed = true;
        this.landedPlanet = closest;
        this.velocity.set(0, 0, 0);
        this.position.copy(closest.position.clone().add(new THREE.Vector3(0, closest.radius + 5, 0)));
        this.mesh.position.copy(this.position);
        document.getElementById('landingZone').style.display = 'none';
        return "LANDED";
      } else {
        // Crash damage proportional to impact speed
        const impactDamage = Math.ceil((this.velocity.length() - this.safeLandingSpeed) * 2);
        this.health -= impactDamage;
        document.getElementById('landingZone').style.display = 'none';
        this.lastCrashTime = Date.now();
        return "CRASH";
      }
    }

    return null;
  }

  canShoot() {
    return this.shootCooldown <= 0 && !this.landed && this.ammo > 0;
  }

  shoot() {
    this.shootCooldown = this.weaponConfig.fireRate;
  }

  takeDamage(amount) {
    // Shield absorbs some damage
    if (this.shieldHealth > 0) {
      const absorbed = Math.min(this.shieldHealth, amount * 0.5);
      this.shieldHealth -= absorbed;
      amount -= absorbed;
    }
    this.health -= amount;
    this.health = Math.max(0, this.health); // Clamp to zero
    screenShake(8, 200); // Trigger screen shake on impact
    screenFlash();
    playSound('damage');
  }
  
  refillFuel(amount) {
    this.fuel = Math.min(this.maxFuel, this.fuel + amount);
  }
  
  addShield(amount) {
    this.shieldHealth = Math.min(this.maxShield, this.shieldHealth + amount);
  }
  
  addAmmo(amount) {
    this.ammo = Math.min(this.maxAmmo, this.ammo + amount);
  }

  reloadAmmo(force = false) {
    if (!force && this.reloadCooldown > 0) return false;
    if (this.ammo >= this.maxAmmo) return false;
    this.addAmmo(this.reloadAmount);
    this.reloadCooldown = this.reloadCooldownFrames;
    return true;
  }

  updateStageFuelBoosts() {
    if (!this.stageFuelBoosts.length) return;
    const now = Date.now();
    for (let i = this.stageFuelBoosts.length - 1; i >= 0; i--) {
      const boost = this.stageFuelBoosts[i];
      if (now >= boost.expiresAt) {
        this.fuel = Math.max(0, this.fuel - (boost.amount || 0));
        this.stageFuelBoosts.splice(i, 1);
        showFloatingText('Rocket stage fuel boost depleted', 1700);
      }
    }
  }

  detachEnemies(gameWorld) {
    // Detach all attached enemies when player accelerates
    gameWorld.enemies.forEach(enemy => {
      if (enemy.attachedToPlayer) {
        enemy.attachedToPlayer = false;
        enemy.attachTime = 0;
        // Push enemy away from player
        const awayDir = enemy.position.clone().sub(this.position).normalize();
        enemy.velocity.add(awayDir.multiplyScalar(15));
      }
    });
  }
}

// ===================== MISSION SYSTEM =====================
class Mission {
  constructor(type = 'destroy', target = 5, gameWorld = null) {
    this.type = type; // 'destroy', 'collect', 'survive', 'noDamage'
    this.target = target;
    this.current = 0;
    this.completed = false;
    this.rewarded = false;
    this.reward = 100 + (target * 20);
    this.baseline = {
      time: Date.now(),
      kills: 0,
      powerUps: 0,
      health: 0
    };

    if (gameWorld) {
      this.captureBaseline(gameWorld);
    }
    
    const descriptions = {
      destroy: `Destroy ${target} enemy bots`,
      collect: `Collect ${target} power-ups`,
      survive: `Survive for ${target} seconds`,
      noDamage: `Complete mission without taking damage`
    };
    this.description = descriptions[type] || 'Unknown Mission';
  }

  captureBaseline(gameWorld) {
    this.baseline.time = Date.now();
    this.baseline.kills = gameWorld.kills;
    this.baseline.powerUps = gameWorld.powerUpsCollected || 0;
    this.baseline.health = gameWorld.ship ? gameWorld.ship.health : 0;
  }

  update(gameWorld) {
    if (this.completed) return;
    
    if (this.type === 'destroy') {
      this.current = Math.max(0, gameWorld.kills - this.baseline.kills);
    } else if (this.type === 'collect') {
      this.current = Math.max(0, (gameWorld.powerUpsCollected || 0) - this.baseline.powerUps);
    } else if (this.type === 'survive') {
      this.current = Math.floor((Date.now() - this.baseline.time) / 1000);
    } else if (this.type === 'noDamage') {
      this.current = gameWorld.ship.health >= this.baseline.health ? 1 : 0;
    }
    
    if (this.current >= this.target) {
      this.completed = true;
    }
  }

  getProgress() {
    return Math.min(100, Math.floor((this.current / this.target) * 100));
  }
}

// ===================== ACHIEVEMENT SYSTEM =====================
class Achievement {
  constructor(id, name, desc, icon, condition, reward = 100) {
    this.id = id;
    this.name = name;
    this.desc = desc;
    this.icon = icon;
    this.condition = condition;
    this.reward = reward;

    this.unlocked = false;

    // Snapshot of player state when achievement is created
    this.baseline = {};
  }
}

// ===================== UPGRADE SYSTEM =====================
const UPGRADES = {
  speed: { name: 'Engine Boost', max: 5, cost: 1000, icon: '\u26A1', stat: 'maxSpeed', multiplier: 1.1 },
  health: { name: 'Armor Plating', max: 5, cost: 1500, icon: '\u2665', stat: 'maxHealth', multiplier: 1.15 },
  weapon: { name: 'Weapon Damage', max: 5, cost: 1750, icon: '\u2694', stat: 'weaponDamage', multiplier: 1.2 },
  fuel: { name: 'Fuel Tank', max: 5, cost: 500, icon: '\u26FD', stat: 'maxFuel', multiplier: 1.15 },
  regen: { name: 'Shield Regen', max: 3, cost: 750, icon: '\u2728', stat: 'shieldRegen', multiplier: 1.5 }
};

function getUpgradeCost(cfg, ownedLevel) {
  return Math.floor(cfg.cost * (1 + ownedLevel * 0.4));
}

class GameWorld {
  constructor(scene) {
    this.scene = scene;
    this.planets = [];
    this.enemies = [];
    this.bullets = [];
    this.powerUps = [];
    this.ship = null;
    this.gravityStrength = 0.015;
    this.planetSpawnDistance = 3000;
    this.enemySpawnZ = 0;
    this.enemyCount = 0;
    this.maxEnemies = 5;
    this.score = 0;
    this.kills = 0;
    this.powerUpsCollected = 0;
    
    // Mission System
    this.missions = [];
    this.missionStartTime = Date.now();
    
    // Achievements
    this.achievements = this.createAchievements();
    this.unlockedAchievements = new Set();
    
    // Upgrades
    this.upgrades = {
      speed: 0,
      health: 0,
      weapon: 0,
      fuel: 0,
      regen: 0
    };
    this.upgradePoints = 0;
    // Satellites provide passive income; track them here
    this.satellites = 0;
    this.satelliteTiers = { t1: 0, t2: 0, t3: 0 };
    this.factionWarMode = false;
    this.helperBots = [];
    this.droneCounts = { combat: 0, harvester: 0 };
    this._lastFactionBotSpawn = Date.now();
    this._lastFactionWave = Date.now();
    this._factionWaveInterval = 22000;
    this._factionWaveCount = 0;
    this.returnBaseTarget = null;
    this._lastSatelliteTick = Date.now();
    this.gameStartTime = Date.now();
    this.megaShip = null;
    this.megaShipSpawned = false;
    // Environmental features
    this.nebulas = [];
    this.blackHoles = [];
    this.asteroidFields = [];
    this.derelicts = [];
    this.colossalDerelicts = [];
    this.activeDerelictInterior = null;
    this.jumpGates = [];
    this.artifacts = [];
    this.artifactsCollected = 0;
    this.journal = [];
    this._lastJournalPush = 0;
    this.cosmicEvent = null;
    this._nextCosmicEventAt = Date.now() + 90000;
    this._bhGravityMultiplier = 1.0;
    this._seenSectors = new Set();
    this._lastFeatureSpawn = Date.now();
    this._featureTickMs = 1800;
    this.inNebula = false;
    this._lastAsteroidCollision = 0;
    this._lastEngineHum = 0;
    this._lastAmbientPulse = 0;
    this._lastDerelictHint = 0;
    this._lastAlienWaveAt = Date.now();
    this._alienWaveIntervalMs = 18000;
    this._alienWaveNumber = 0;
    this.aiCivilizations = [];
    this._lastEmpireTickAt = Date.now();
    this._empireTickMs = 6500;
    this._lastAiPlayerRaidAt = 0;

    // Return-to-base visual guide
    const trailGeo = new THREE.BufferGeometry();
    trailGeo.setAttribute('position', new THREE.BufferAttribute(new Float32Array(60 * 3), 3));
    this.baseTrailLine = new THREE.Line(
      trailGeo,
      new THREE.LineBasicMaterial({ color: 0x66ffaa, transparent: true, opacity: 0.55 })
    );
    this.baseTrailLine.visible = false;
    this.scene.add(this.baseTrailLine);

    this.baseBeacon = new THREE.Mesh(
      new THREE.SphereGeometry(3, 12, 12),
      new THREE.MeshBasicMaterial({ color: 0x66ffaa, transparent: true, opacity: 0.8 })
    );
    this.baseBeacon.visible = false;
    this.scene.add(this.baseBeacon);
    
    // Audio hooks
    this.audioEnabled = true;
  }
  
  createAchievements() {
    const list = [
      new Achievement(
        'first_landing',
        '\uD83C\uDF0D First Steps',
        'Land on your first planet',
        '\uD83D\uDE80',
        (gw, ach) => gw.ship.landed,
        50
      ),

      new Achievement(
        'hundred_kills',
        '\uD83D\uDC80 Century',
        'Defeat 100 enemies',
        '\uD83C\uDFAF',
        (gw, ach) => (gw.kills - ach.baseline.kills) >= 100,
        200
      ),

      new Achievement(
        'no_damage',
        '\u2728 Untouchable',
        'Complete a mission with no damage',
        '\uD83D\uDEE1\uFE0F',
        (gw, ach) => gw.ship.health === gw.ship.maxHealth,
        150
      ),

      new Achievement(
        'maxed_shields',
        '\uD83D\uDD0B Full Shield',
        'Reach max shield capacity',
        '\u26A1',
        (gw, ach) => gw.ship.shieldHealth >= gw.ship.maxShield,
        125
      ),

      new Achievement(
        'thousand_score',
        '\u2B50 Legendary',
        'Earn 1000 score',
        '\uD83D\uDC51',
        (gw, ach) => (gw.score - ach.baseline.score) >= 1000,
        250
      ),

      new Achievement(
        'artifact_hunter',
        'Relic Hunter',
        'Recover 3 rare artifacts',
        'R',
        (gw, ach) => gw.artifactsCollected >= 3,
        320
      )
    ];

    // Snapshot baseline so new achievements don't auto-complete
    list.forEach(a => {
      a.baseline = {
        time: Date.now(),
        kills: this.kills,
        score: this.score,
        powerUps: this.powerUpsCollected
      };
    });

    return list;
  }
  
  generateMissions() {
    this.missions = [];
    const missionTypes = [
      { type: 'destroy', target: 3 + Math.floor(Math.random() * 7) },
      { type: 'collect', target: 2 + Math.floor(Math.random() * 4) },
      { type: 'survive', target: 30 + Math.floor(Math.random() * 90) }
    ];
    
    for (let i = 0; i < 2; i++) {
      const m = missionTypes[Math.floor(Math.random() * missionTypes.length)];
      this.missions.push(new Mission(m.type, m.target, this));
    }
  }

  initializeShip(config) {
    this.ship = new Ship(this.scene, config);
    this.enemySpawnZ = this.ship.position.z;
    this.enemySpawnX = this.ship.position.x;
    this.enemySpawnY = this.ship.position.y;
    // Track player resources
    this.resources = { minerals: 0, salvage: 0 };
  }

  generateInitialPlanets() {
    // Create a few procedurally generated star systems (each with several planets)
    const systems = 3;
    for (let s = 0; s < systems; s++) {
      const systemCenter = new THREE.Vector3(
        THREE.MathUtils.randFloat(-2000, 2000),
        THREE.MathUtils.randFloat(-800, 800),
        -3000 - s * 4000
      );
      const planetCount = 3 + Math.floor(Math.random() * 5);
      for (let i = 0; i < planetCount; i++) {
        const angle = Math.random() * Math.PI * 2;
        const dist = (i + 1) * (150 + Math.random() * 200);
        const pos = new THREE.Vector3(
          systemCenter.x + Math.cos(angle) * dist,
          systemCenter.y + (Math.random() - 0.5) * 100,
          systemCenter.z + Math.sin(angle) * dist
        );
        this.planets.push(new Planet(this.scene, pos));
      }

      // Randomly add features per system
      if (Math.random() < 0.5) {
        // Nebula around system center
        this.nebulas.push(new Nebula(this.scene, systemCenter.clone().add(new THREE.Vector3(Math.random()*400-200, Math.random()*200-100, Math.random()*400-200)), 800 + Math.random()*600));
      }
      if (Math.random() < 0.25) {
        // Add an asteroid field
        const center = systemCenter.clone().add(new THREE.Vector3(Math.random()*800-400, Math.random()*200-100, Math.random()*800-400));
        this.asteroidFields.push(new AsteroidField(this.scene, center, 500 + Math.random()*800, 60 + Math.floor(Math.random()*120)));
      }
      if (Math.random() < 0.15) {
        // Add a derelict ship
        const derPos = systemCenter.clone().add(new THREE.Vector3(Math.random()*800-400, Math.random()*200-100, Math.random()*800-400));
        this.derelicts.push(new DerelictShip(this.scene, derPos));
      }
      if (Math.random() < 0.08 && this.colossalDerelicts.length < 1) {
        const cdPos = systemCenter.clone().add(new THREE.Vector3(Math.random()*1400-700, Math.random()*260-130, Math.random()*1400-700));
        this.spawnColossalDerelict(cdPos);
      }
      if (Math.random() < 0.12) {
        // Add a black hole near system edge
        const bhPos = systemCenter.clone().add(new THREE.Vector3(Math.random()*2000-1000, Math.random()*600-300, Math.random()*2000-1000));
        this.blackHoles.push(new BlackHole(this.scene, bhPos, 200 + Math.random()*150));
      }
    }
  }

  spawnPlanets() {
    // Spawn planets in all directions as player moves
    const shipPos = this.ship.position;
    const spawnDistance = 4000;
    
    // Check all 8 directions
    const directions = [
      [1, 0, 0], [-1, 0, 0], [0, 1, 0], [0, -1, 0],
      [1, 0, 1], [-1, 0, 1], [1, 0, -1], [-1, 0, -1],
      [0, 1, 1], [0, -1, 1], [0, 1, -1], [0, -1, -1]
    ];
    
    directions.forEach(dir => {
      const checkPos = shipPos.clone().add(new THREE.Vector3(
        dir[0] * spawnDistance,
        dir[1] * spawnDistance * 0.5,
        dir[2] * spawnDistance
      ));
      
      // Check if we need a planet in this area
      const existingNearby = this.planets.some(p => p.position.distanceTo(checkPos) < 1500);
      if (!existingNearby && Math.random() < 0.02) { // 2% chance per direction per frame
        let newPos;
        let attempts = 0;
        do {
          newPos = checkPos.clone().add(new THREE.Vector3(
            THREE.MathUtils.randFloat(-500, 500),
            THREE.MathUtils.randFloat(-250, 250),
            THREE.MathUtils.randFloat(-500, 500)
          ));
          attempts++;
        } while (attempts < 5 && isTooClose(newPos, this.planets, 60));
        
        if (attempts < 5) {
          this.planets.push(new Planet(this.scene, newPos));
        }
      }
    });
    
    // Remove distant planets to prevent memory issues
    this.planets = this.planets.filter(p => {
      const dist = p.position.distanceTo(shipPos);
      if (dist > 8000) {
        this.scene.remove(p.mesh);
        return false;
      }
      return true;
    });
  }

  spawnDynamicFeatures() {
    if (!this.ship) return;
    const now = Date.now();
    if (now - this._lastFeatureSpawn < this._featureTickMs) return;
    this._lastFeatureSpawn = now;

    const shipPos = this.ship.position;
    const sectorSize = 3200;
    const sx = Math.floor(shipPos.x / sectorSize);
    const sy = Math.floor(shipPos.y / (sectorSize * 0.6));
    const sz = Math.floor(shipPos.z / sectorSize);

    for (let dx = -1; dx <= 1; dx++) {
      for (let dy = -1; dy <= 1; dy++) {
        for (let dz = -1; dz <= 1; dz++) {
          const cx = sx + dx;
          const cy = sy + dy;
          const cz = sz + dz;
          const key = `${cx}|${cy}|${cz}`;
          if (this._seenSectors.has(key)) continue;
          this._seenSectors.add(key);

          const center = new THREE.Vector3(
            cx * sectorSize + THREE.MathUtils.randFloat(-900, 900),
            cy * sectorSize * 0.6 + THREE.MathUtils.randFloat(-400, 400),
            cz * sectorSize + THREE.MathUtils.randFloat(-900, 900)
          );

          if (Math.random() < 0.35) {
            this.nebulas.push(new Nebula(this.scene, center.clone(), 700 + Math.random() * 700, 0x223355 + Math.floor(Math.random() * 0x111111)));
          }
          if (Math.random() < 0.28) {
            this.asteroidFields.push(new AsteroidField(this.scene, center.clone().add(new THREE.Vector3(
              THREE.MathUtils.randFloat(-700, 700),
              THREE.MathUtils.randFloat(-260, 260),
              THREE.MathUtils.randFloat(-700, 700)
            )), 450 + Math.random() * 900, 70 + Math.floor(Math.random() * 90)));
          }
          if (Math.random() < 0.12) {
            this.blackHoles.push(new BlackHole(this.scene, center.clone().add(new THREE.Vector3(
              THREE.MathUtils.randFloat(-1200, 1200),
              THREE.MathUtils.randFloat(-500, 500),
              THREE.MathUtils.randFloat(-1200, 1200)
            )), 180 + Math.random() * 120));
          }
          if (Math.random() < 0.2) {
            this.derelicts.push(new DerelictShip(this.scene, center.clone().add(new THREE.Vector3(
              THREE.MathUtils.randFloat(-800, 800),
              THREE.MathUtils.randFloat(-250, 250),
              THREE.MathUtils.randFloat(-800, 800)
            ))));
          }
          if (Math.random() < 0.018 && this.colossalDerelicts.length < 2) {
            this.spawnColossalDerelict(center.clone().add(new THREE.Vector3(
              THREE.MathUtils.randFloat(-1000, 1000),
              THREE.MathUtils.randFloat(-350, 350),
              THREE.MathUtils.randFloat(-1000, 1000)
            )));
          }
          if (Math.random() < 0.07) {
            this.spawnJumpGatePair(center.clone());
          }
          if (Math.random() < 0.1) {
            this.artifacts.push(new Artifact(this.scene, center.clone().add(new THREE.Vector3(
              THREE.MathUtils.randFloat(-700, 700),
              THREE.MathUtils.randFloat(-220, 220),
              THREE.MathUtils.randFloat(-700, 700)
            ))));
          }
        }
      }
    }

    const maxDist = 14000;
    this.nebulas = this.nebulas.filter(n => {
      if (n.position.distanceTo(shipPos) > maxDist) { n.destroy(); return false; }
      return true;
    });
    this.blackHoles = this.blackHoles.filter(b => {
      if (b.position.distanceTo(shipPos) > maxDist) { b.destroy(); return false; }
      return true;
    });
    this.asteroidFields = this.asteroidFields.filter(a => {
      if (a.center.distanceTo(shipPos) > maxDist) { a.destroy(); return false; }
      return true;
    });
    this.derelicts = this.derelicts.filter(d => {
      if (!d.mesh) return false;
      if (d.mesh.position.distanceTo(shipPos) > maxDist) { d.destroy(); return false; }
      return true;
    });
    this.colossalDerelicts = this.colossalDerelicts.filter(cd => {
      if (!cd || !cd.group) return false;
      if (this.activeDerelictInterior === cd) return true;
      if (cd.position.distanceTo(shipPos) > maxDist * 1.2) { cd.destroy(); return false; }
      return true;
    });
    this.jumpGates = this.jumpGates.filter(g => {
      if (!g.mesh) return false;
      if (g.position.distanceTo(shipPos) > maxDist * 1.2) { g.destroy(); return false; }
      return true;
    });
    this.artifacts = this.artifacts.filter(a => {
      if (!a.mesh || a.collected) return false;
      if (a.position.distanceTo(shipPos) > maxDist) { a.destroy(); return false; }
      return true;
    });
  }

  spawnColossalDerelict(position) {
    const id = `CD-${Math.floor(Math.random() * 90000 + 10000)}`;
    const tooClose = this.colossalDerelicts.some(cd => cd.position.distanceTo(position) < 3200);
    if (tooClose) return;
    const cd = new ColossalDerelict(this.scene, position, id);
    this.colossalDerelicts.push(cd);
    this.logEvent(`Deep-space anomaly detected: colossal derelict ${id}`);
    showFloatingText('Long-range scan: colossal ship found', 2100);
    playSound('achievement');
  }

  updateColossalDerelicts() {
    if (!this.ship) return;
    const now = Date.now();
    let nearPortal = false;
    let nearChest = false;
    let nearExit = false;

    for (let i = 0; i < this.colossalDerelicts.length; i++) {
      const cd = this.colossalDerelicts[i];
      cd.update();

      if (this.activeDerelictInterior === cd) {
        cd.constrainInside(this);
        if (cd.isNearExitPortal(this.ship.position)) nearExit = true;
        if (cd.getNearbyChest(this.ship.position)) nearChest = true;
      } else if (cd.isNearOuterPortal(this.ship.position)) {
        nearPortal = true;
      }
    }

    if (now - this._lastDerelictHint > 1800) {
      if (nearChest) {
        showFloatingText('Press E to open chest', 1100);
        this._lastDerelictHint = now;
      } else if (nearExit) {
        showFloatingText('Press E to exit ship interior', 1100);
        this._lastDerelictHint = now;
      } else if (nearPortal) {
        showFloatingText('Press E to enter colossal ship portal', 1100);
        this._lastDerelictHint = now;
      }
    }
    this.ensureAICivilizations();
  }

  tryInteractSpecial() {
    if (!this.ship) return false;

    if (this.activeDerelictInterior) {
      const cd = this.activeDerelictInterior;
      const chest = cd.getNearbyChest(this.ship.position);
      if (chest) {
        cd.openChest(chest, this);
        return true;
      }
      if (cd.isNearExitPortal(this.ship.position)) {
        cd.exit(this);
        return true;
      }
      showFloatingText('No chest or exit nearby', 900);
      return true;
    }

    for (let i = 0; i < this.colossalDerelicts.length; i++) {
      const cd = this.colossalDerelicts[i];
      if (cd.isNearOuterPortal(this.ship.position)) {
        cd.enter(this);
        return true;
      }
    }
    return false;
  }

  logEvent(text) {
    const now = Date.now();
    if (now - this._lastJournalPush < 120) return;
    this._lastJournalPush = now;
    const stamp = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    this.journal.unshift(`[${stamp}] ${text}`);
    if (this.journal.length > 40) this.journal.length = 40;
    if (window.updateJournalUI) window.updateJournalUI();
  }

  spawnJumpGatePair(center) {
    const pairId = `JG-${Math.floor(Math.random() * 90000 + 10000)}`;
    const aPos = center.clone().add(new THREE.Vector3(
      THREE.MathUtils.randFloat(-500, 500),
      THREE.MathUtils.randFloat(-200, 200),
      THREE.MathUtils.randFloat(-500, 500)
    ));
    const bPos = center.clone().add(new THREE.Vector3(
      THREE.MathUtils.randFloat(-2400, 2400),
      THREE.MathUtils.randFloat(-600, 600),
      THREE.MathUtils.randFloat(-2400, 2400)
    ));
    const g1 = new JumpGate(this.scene, aPos, pairId);
    const g2 = new JumpGate(this.scene, bPos, pairId);
    g1.linkedGate = g2;
    g2.linkedGate = g1;
    this.jumpGates.push(g1, g2);
    this.logEvent(`Discovered jump gate pair ${pairId}`);
  }

  updateArtifactsAndGates() {
    if (!this.ship) return;
    const now = Date.now();

    for (let i = this.jumpGates.length - 1; i >= 0; i--) {
      const g = this.jumpGates[i];
      g.update();
      const dist = g.position.distanceTo(this.ship.position);
      if (dist < 24 && g.linkedGate && now > g.cooldownUntil) {
        this.ship.position.copy(g.linkedGate.position.clone().add(new THREE.Vector3(0, 10, 20)));
        this.ship.mesh.position.copy(this.ship.position);
        this.ship.velocity.multiplyScalar(0.2);
        g.cooldownUntil = now + 2200;
        g.linkedGate.cooldownUntil = now + 2200;
        this.logEvent(`Jumped through gate ${g.pairId}`);
        showFloatingText(`Jumped to linked gate (${g.pairId})`, 1700);
        playSound('achievement');
      }
    }

    for (let i = this.artifacts.length - 1; i >= 0; i--) {
      const a = this.artifacts[i];
      a.update();
      const dist = a.mesh.position.distanceTo(this.ship.position);
      if (dist < 12) {
        a.collected = true;
        this.artifactsCollected++;
        this.score += 600;
        this.upgradePoints += 90;
        this.logEvent('Recovered a rare artifact and decoded lore fragments');
        showFloatingText('Artifact recovered: +600 score, +90 upgrade pts', 2300);
        playSound('achievement');
        a.destroy();
        this.artifacts.splice(i, 1);
      }
    }
  }

  updateCosmicEvents() {
    const now = Date.now();
    if (!this.cosmicEvent && now >= this._nextCosmicEventAt) {
      const types = ['supernova', 'blackhole_flare', 'asteroid_shower'];
      const type = types[Math.floor(Math.random() * types.length)];
      this.cosmicEvent = { type, endAt: now + 18000 };
      this._nextCosmicEventAt = now + 90000 + Math.floor(Math.random() * 60000);
      this.logEvent(`Cosmic event detected: ${type.replace('_', ' ')}`);
      showFloatingText(`Cosmic event: ${type.replace('_', ' ')}`, 2000);
      if (type === 'blackhole_flare') this._bhGravityMultiplier = 1.9;
      playSound('damage');
    }

    if (!this.cosmicEvent) return;

    if (this.cosmicEvent.type === 'supernova' && typeof sunLight !== 'undefined') {
      sunLight.intensity = 1.0 + Math.sin(Date.now() * 0.02) * 0.4 + 0.9;
    }

    if (this.cosmicEvent.type === 'asteroid_shower' && Math.random() < 0.045) {
      const p = this.ship.position.clone().add(new THREE.Vector3(
        THREE.MathUtils.randFloat(-900, 900),
        THREE.MathUtils.randFloat(-80, 300),
        THREE.MathUtils.randFloat(-900, 900)
      ));
      this.asteroidFields.push(new AsteroidField(this.scene, p, 180 + Math.random() * 160, 18 + Math.floor(Math.random() * 20)));
    }

    if (this.cosmicEvent.type === 'supernova' && Math.random() < 0.02) {
      for (let i = this.enemies.length - 1; i >= 0; i--) {
        const e = this.enemies[i];
        if (e.position.distanceTo(this.ship.position) < 850 && !e.takeDamage(14)) {
          this.createExplosion(e.position);
          e.destroy();
          this.enemies.splice(i, 1);
          this.kills++;
        }
      }
    }

    if (now >= this.cosmicEvent.endAt) {
      if (typeof sunLight !== 'undefined') sunLight.intensity = 1.0;
      if (this.cosmicEvent.type === 'blackhole_flare') this._bhGravityMultiplier = 1.0;
      this.logEvent(`Cosmic event ended: ${this.cosmicEvent.type.replace('_', ' ')}`);
      this.cosmicEvent = null;
    }
  }

  spawnEnemies() {
    // Progressive difficulty: increase max enemies based on score
    this.maxEnemies = 5 + Math.floor(this.score / 500);
    const spawnChance = 0.005 + (this.score / 10000) * 0.003; // Increase spawn rate with score
    const deepSpace = this.ship && this.ship.position.length() > 4500;
    
    if (this.enemies.length < this.maxEnemies && Math.random() < spawnChance) {
      const pos = this.ship.position.clone().add(new THREE.Vector3(
        THREE.MathUtils.randFloat(-800, 800),
        THREE.MathUtils.randFloat(-300, 300),
        THREE.MathUtils.randFloat(-800, 800)
      ));
      
      // Weight enemy types based on difficulty
        // choose from a wider variety of enemy types; bias towards easier ones early
        const pool = ['standard','fast','swarm','sniper','kamikaze','shielded','tank'];
        const difficultyFactor = Math.min(1, this.score / 2500);
        const r = Math.random();
        let type = 'standard';
        if (r < 0.45 - difficultyFactor * 0.1) type = 'standard';
        else if (r < 0.65 - difficultyFactor * 0.05) type = 'fast';
        else if (r < 0.75) type = 'swarm';
        else if (r < 0.85) type = 'sniper';
        else if (r < 0.93) type = 'kamikaze';
        else if (r < 0.98) type = 'shielded';
        else type = 'tank';
      
      this.enemies.push(new EnemyBot(this.scene, pos, type));
      // Rare boss spawn when player is doing well
      if (this.score > 2000 && Math.random() < 0.002) {
        const bossPos = this.ship.position.clone().add(new THREE.Vector3(0, 0, -1200));
        this.enemies.push(new EnemyBot(this.scene, bossPos, 'boss'));
        playSound('achievement');
      }
    }

    // Deep-space pirate patrol clusters
    if (deepSpace && Math.random() < 0.0025 && this.enemies.length < this.maxEnemies + 6) {
      const patrolCenter = this.ship.position.clone().add(new THREE.Vector3(
        THREE.MathUtils.randFloat(-1400, 1400),
        THREE.MathUtils.randFloat(-300, 300),
        THREE.MathUtils.randFloat(-1400, 1400)
      ));
      const size = 3 + Math.floor(Math.random() * 3);
      for (let i = 0; i < size; i++) {
        const p = patrolCenter.clone().add(new THREE.Vector3(
          THREE.MathUtils.randFloat(-140, 140),
          THREE.MathUtils.randFloat(-80, 80),
          THREE.MathUtils.randFloat(-140, 140)
        ));
        const type = Math.random() < 0.6 ? 'fast' : 'standard';
        const bot = new EnemyBot(this.scene, p, type);
        bot.faction = 'Pirate Patrol';
        this.enemies.push(bot);
      }
      this.logEvent('Pirate patrol detected in deep space');
    }
  }
  
  spawnPowerUp(position) {
    const types = ['fuel', 'shield', 'ammo'];
    const type = types[Math.floor(Math.random() * types.length)];
    const powerUp = new PowerUp(this.scene, position, type);
    this.powerUps.push(powerUp);
  }

  spawnMegaShip() {
    if (this.megaShip || !this.ship) return;
    const spawnPos = this.ship.position.clone().add(new THREE.Vector3(
      THREE.MathUtils.randFloat(-900, 900),
      THREE.MathUtils.randFloat(-220, 220),
      -1200
    ));
    this.megaShip = new MegaShip(this.scene, spawnPos);
    this.megaShipSpawned = true;
    showFloatingText('Warning: Mega Ship Detected', 2600);
    playSound('damage');
  }

  spawnHelperBot(role = 'combat', source = 'player') {
    if (!this.ship) return;
    const pos = this.ship.position.clone().add(new THREE.Vector3(
      THREE.MathUtils.randFloat(-80, 80),
      THREE.MathUtils.randFloat(-20, 20),
      THREE.MathUtils.randFloat(-80, 80)
    ));
    this.helperBots.push(new HelperBot(this.scene, pos, role, source));
  }

  updateHelperBots() {
    if (!this.helperBots || !this.helperBots.length) return;
    if (!this.resources) this.resources = { minerals: 0, salvage: 0 };

    const findNearestEnemy = (pos) => {
      let best = null;
      let bestDist = Infinity;
      for (let i = 0; i < this.enemies.length; i++) {
        const e = this.enemies[i];
        const d = e.position.distanceTo(pos);
        if (d < bestDist) { bestDist = d; best = e; }
      }
      return { enemy: best, dist: bestDist };
    };

    for (let i = this.helperBots.length - 1; i >= 0; i--) {
      const hb = this.helperBots[i];
      hb.attackCooldown = Math.max(0, hb.attackCooldown - 1);
      hb.collectCooldown = Math.max(0, hb.collectCooldown - 1);

      const guardPos = this.ship.position;
      const nearest = findNearestEnemy(hb.position);
      const enemy = nearest.enemy;

      let desired = guardPos.clone().sub(hb.position);
      if (enemy && nearest.dist < 900) {
        desired = enemy.position.clone().sub(hb.position);
      } else if (hb.role === 'harvester') {
        // Harvester preference: move toward nearest asteroid chunk.
        let nearestRock = null;
        let rockDist = Infinity;
        this.asteroidFields.forEach(af => {
          const rocks = af.asteroids.children || [];
          rocks.forEach(r => {
            const worldPos = r.getWorldPosition(new THREE.Vector3());
            const d = hb.position.distanceTo(worldPos);
            if (d < rockDist) { rockDist = d; nearestRock = { af, r, worldPos }; }
          });
        });
        if (nearestRock && rockDist < 700) desired = nearestRock.worldPos.clone().sub(hb.position);
      }

      if (desired.length() > 0.001) {
        const speed = hb.role === 'harvester' ? 1.8 : 2.2;
        hb.velocity.lerp(desired.normalize().multiplyScalar(speed), 0.08);
      } else {
        hb.velocity.multiplyScalar(0.95);
      }
      hb.position.add(hb.velocity);
      hb.mesh.position.copy(hb.position);
      hb.mesh.lookAt(hb.position.clone().add(hb.velocity));

      if ((hb.role === 'combat' || hb.role === 'faction') && enemy && nearest.dist < 360 && hb.attackCooldown <= 0) {
        const damage = hb.role === 'faction' ? 16 : 12;
        if (!enemy.takeDamage(damage)) {
          this.createExplosion(enemy.position);
          this.spawnPowerUp(enemy.position);
          this.score += hb.role === 'faction' ? 80 : 100;
          this.kills++;
          enemy.destroy();
          const idx = this.enemies.indexOf(enemy);
          if (idx >= 0) this.enemies.splice(idx, 1);
        }
        hb.attackCooldown = hb.role === 'faction' ? 20 : 26;
        playSound('fire');
      }

      if (hb.role === 'harvester' && hb.collectCooldown <= 0) {
        // Harvest asteroids
        let collected = false;
        for (let a = 0; a < this.asteroidFields.length && !collected; a++) {
          const af = this.asteroidFields[a];
          const rocks = af.asteroids.children || [];
          for (let r = rocks.length - 1; r >= 0; r--) {
            const rock = rocks[r];
            const wPos = rock.getWorldPosition(new THREE.Vector3());
            if (hb.position.distanceTo(wPos) < 8) {
              const amount = rock.userData && rock.userData.resource ? rock.userData.resource : 10;
              this.resources.minerals += Math.ceil(amount * 0.8);
              af.asteroids.remove(rock);
              this.scene.remove(rock);
              playSound('pickup');
              hb.collectCooldown = 45;
              collected = true;
              break;
            }
          }
        }

        // Salvage derelicts
        if (!collected) {
          for (let d = this.derelicts.length - 1; d >= 0; d--) {
            const der = this.derelicts[d];
            if (!der || der.scavenged || !der.mesh) continue;
            if (hb.position.distanceTo(der.mesh.position) < 12) {
              der.scavenged = true;
              this.resources.salvage += Math.ceil((der.loot && der.loot.salvage ? der.loot.salvage : 20) * 0.75);
              der.destroy();
              this.derelicts.splice(d, 1);
              playSound('pickup');
              hb.collectCooldown = 60;
              break;
            }
          }
        }
      }
    }
  }

  updateFactionWar() {
    if (!this.factionWarMode) return;
    const now = Date.now();
    const factionCount = this.helperBots.filter(h => h.role === 'faction').length;
    if (factionCount < 5 && now - this._lastFactionBotSpawn > 8500) {
      this.spawnHelperBot('faction', 'faction');
      this._lastFactionBotSpawn = now;
      showFloatingText('Allied patrol joined the fight', 1400);
    }

    // Spawn alien counter-waves during faction war.
    if (now - this._lastFactionWave > this._factionWaveInterval && this.enemies.length < this.maxEnemies + 18) {
      this._lastFactionWave = now;
      this._factionWaveCount++;
      const waveSize = Math.min(10, 4 + this._factionWaveCount + Math.floor(Math.random() * 3));
      const pool = ['standard', 'fast', 'swarm', 'sniper', 'shielded'];
      for (let i = 0; i < waveSize; i++) {
        const ang = Math.random() * Math.PI * 2;
        const dist = THREE.MathUtils.randFloat(750, 1300);
        const pos = this.ship.position.clone().add(new THREE.Vector3(
          Math.cos(ang) * dist,
          THREE.MathUtils.randFloat(-220, 220),
          Math.sin(ang) * dist
        ));
        const t = pool[Math.floor(Math.random() * pool.length)];
        this.enemies.push(new EnemyBot(this.scene, pos, t));
      }
      showFloatingText(`Alien counter-wave incoming (${waveSize})`, 1800);
      playSound('damage');
    }
  }

  updateAlienWaves() {
    if (!this.ship) return;
    const now = Date.now();
    if (now - this._lastAlienWaveAt < this._alienWaveIntervalMs) return;
    this._lastAlienWaveAt = now;

    const maxAllowed = this.maxEnemies + 14;
    if (this.enemies.length >= maxAllowed) return;

    this._alienWaveNumber++;
    const base = 4 + Math.floor(this.score / 900);
    const waveSize = Math.min(16, base + Math.floor(this._alienWaveNumber * 0.5));
    const pool = ['standard', 'fast', 'swarm', 'sniper', 'shielded'];

    for (let i = 0; i < waveSize; i++) {
      const ang = Math.random() * Math.PI * 2;
      const dist = THREE.MathUtils.randFloat(650, 1250);
      const pos = this.ship.position.clone().add(new THREE.Vector3(
        Math.cos(ang) * dist,
        THREE.MathUtils.randFloat(-220, 220),
        Math.sin(ang) * dist
      ));
      const type = pool[Math.floor(Math.random() * pool.length)];
      this.enemies.push(new EnemyBot(this.scene, pos, type));
    }

    this.logEvent(`Alien wave ${this._alienWaveNumber} incoming (${waveSize})`);
    showFloatingText(`Alien wave ${this._alienWaveNumber}: ${waveSize} hostiles`, 2000);
    playSound('damage');
  }

  updateBaseReturnTrail() {
    if (!this.ship) return;
    const target = this.returnBaseTarget;

    if (!target || !target.mesh || !target.hasBase) {
      this.baseTrailLine.visible = false;
      this.baseBeacon.visible = false;
      return;
    }

    const start = this.ship.position.clone();
    const end = target.mesh.position.clone().add(new THREE.Vector3(0, target.radius + 18, 0));
    const points = 60;
    const arr = this.baseTrailLine.geometry.attributes.position.array;

    for (let i = 0; i < points; i++) {
      const t = i / (points - 1);
      const p = start.clone().lerp(end, t);
      p.y += Math.sin(t * Math.PI) * 50;
      arr[i * 3] = p.x;
      arr[i * 3 + 1] = p.y;
      arr[i * 3 + 2] = p.z;
    }
    this.baseTrailLine.geometry.attributes.position.needsUpdate = true;
    this.baseTrailLine.visible = true;

    this.baseBeacon.position.copy(end);
    this.baseBeacon.position.y += Math.sin(Date.now() * 0.004) * 4;
    this.baseBeacon.visible = true;

    if (this.ship.landed && this.ship.landedPlanet === target) {
      this.returnBaseTarget = null;
      this.baseTrailLine.visible = false;
      this.baseBeacon.visible = false;
    }
  }

  updateMegaShip() {
    if (!this.ship) return;

    if (!this.megaShipSpawned && (Date.now() - this.gameStartTime) >= 60000) {
      this.spawnMegaShip();
    }

    if (!this.megaShip) return;
    const ms = this.megaShip;
    ms.update(this.ship.position);

    const dist = ms.position.distanceTo(this.ship.position);
    if (ms.canShoot() && dist < 900) {
      const dir = this.ship.position.clone().sub(ms.position).normalize();
      const muzzle = ms.position.clone().add(dir.clone().multiplyScalar(ms.collisionRadius + 8));
      this.bullets.push(new Bullet(this.scene, muzzle, dir, { speed: 18, damage: 14 }));
      ms.shoot();
    }

    if (ms.canSpawnAliens() && this.enemies.length < this.maxEnemies + 6) {
      const spawnCount = Math.random() < 0.35 ? 2 : 1;
      for (let i = 0; i < spawnCount; i++) {
        const offset = new THREE.Vector3(
          THREE.MathUtils.randFloat(-35, 35),
          THREE.MathUtils.randFloat(-16, 16),
          THREE.MathUtils.randFloat(-35, 35)
        );
        const pos = ms.position.clone().add(offset);
        const alienType = Math.random() < 0.7 ? 'swarm' : 'fast';
        this.enemies.push(new EnemyBot(this.scene, pos, alienType));
      }
      ms.spawnedAliens();
    }

    for (let j = this.bullets.length - 1; j >= 0; j--) {
      const bullet = this.bullets[j];
      if (bullet.mesh.position.distanceTo(ms.position) < bullet.collisionRadius + ms.collisionRadius) {
        const damage = bullet.damage;
        const alive = ms.takeDamage(damage);
        bullet.destroy();
        this.bullets.splice(j, 1);
        if (!alive) {
          this.createExplosion(ms.position.clone());
          this.score += 1800;
          this.kills += 8;
          this.upgradePoints += 180;
          showFloatingText('Mega Ship Destroyed! +1800 score', 2800);
          ms.destroy();
          this.megaShip = null;
          break;
        }
      }
    }
  }

  updatePlanets() {
    this.planets.forEach(p => p.update());

    const farthestZ = Math.min(...this.planets.map(p => p.position.z));
    if (this.ship.position.z - farthestZ < this.planetSpawnDistance) {
      let newPos;
      let attempts = 0;
      do {
        newPos = new THREE.Vector3(
          THREE.MathUtils.randFloat(-1000, 1000),
          THREE.MathUtils.randFloat(-500, 500),
          farthestZ - THREE.MathUtils.randFloat(2000, 5000)
        );
        attempts++;
      } while (attempts < 10 && isTooClose(newPos, this.planets, 60));
      
      this.planets.push(new Planet(this.scene, newPos));
    }
  }

  updateEnemies() {
    this.spawnEnemies();
    
    // Use reverse loop to safely remove from array
    for (let i = this.enemies.length - 1; i >= 0; i--) {
      const enemy = this.enemies[i];
      let targetPos = this.ship.position;
      if (this.helperBots && this.helperBots.length) {
        let nearestHelper = null;
        let helperDist = Infinity;
        for (let h = 0; h < this.helperBots.length; h++) {
          const d = enemy.position.distanceTo(this.helperBots[h].position);
          if (d < helperDist) { helperDist = d; nearestHelper = this.helperBots[h]; }
        }
        const playerDist = enemy.position.distanceTo(this.ship.position);
        if (nearestHelper && helperDist < playerDist * 0.9) targetPos = nearestHelper.position;
      }
      enemy.update(targetPos, this.ship);
      // Simple faction behavior: nearby allies of same faction buff speed slightly
      try {
        const allies = this.enemies.filter(e => e !== enemy && e.faction === enemy.faction && e.position.distanceTo(enemy.position) < 200);
        if (allies.length >= 2) {
          enemy.speed = Math.min(enemy.speed * 1.15, enemy.speed + 0.5);
        }
      } catch (e) {}

      // Check for attachment to player
      if (!enemy.attachedToPlayer && enemy.position.distanceTo(this.ship.position) < 8) {
        enemy.attachedToPlayer = true;
        enemy.attachTime = Date.now();
        enemy.lastDamageTime = Date.now();
        playSound('damage');
      }

      // Enemy shooting behavior: vary by type and range
      const dist = enemy.position.distanceTo(this.ship.position);
      let attackRange = 400;
      if (enemy.type === 'sniper') attackRange = 1200;
      if (enemy.type === 'kamikaze') attackRange = 60; // they don't shoot
      if (enemy.canShoot() && dist < attackRange) {
        // Snipers use slower, higher-damage shots (bullet damage already set)
        const dir = this.ship.position.clone().sub(enemy.position);
        this.bullets.push(new Bullet(this.scene, enemy.position.clone(), dir, { speed: 22, damage: enemy.damage }));
        enemy.shoot();
      }

      // Check bullet collisions with reverse loop
      for (let j = this.bullets.length - 1; j >= 0; j--) {
        const bullet = this.bullets[j];
        if (bullet.mesh.position.distanceTo(enemy.position) < bullet.collisionRadius + 1.5) {
            // Apply critical hit chance
            let damage = bullet.damage;
            let crit = Math.random() < CRIT_CHANCE;
            if (crit) {
              damage = Math.ceil(damage * CRIT_MULTIPLIER);
              this.createHitEffect(enemy.position, 1.4);
              playSound('achievement');
            }
            if (enemy.takeDamage(damage)) {
              // Enemy still alive
            } else {
              // Enemy dead
              this.createExplosion(enemy.position);
              this.spawnPowerUp(enemy.position);
              this.score += 100 + (crit ? 50 : 0);
              this.kills++;
              enemy.destroy();
              this.enemies.splice(i, 1);
            }
          bullet.destroy();
          this.bullets.splice(j, 1);
          break; // Only one bullet can hit per update
        }
      }
    }
  }

  updateBullets() {
    this.bullets = this.bullets.filter(b => {
      if (b.update()) {
        return true;
      } else {
        b.destroy();
        return false;
      }
    });

    // Use reverse loop for safe removal
    for (let i = this.bullets.length - 1; i >= 0; i--) {
      const bullet = this.bullets[i];
      if (bullet.mesh.position.distanceTo(this.ship.position) < bullet.collisionRadius + 1.0) {
        // Enemy-fired bullet hitting the player: allow chance for critical (enemy criticals can be weaker)
        let damage = bullet.damage;
        let crit = Math.random() < (CRIT_CHANCE * 0.6); // enemies have slightly lower crit rate
        if (crit) {
          damage = Math.ceil(damage * (CRIT_MULTIPLIER * 0.9));
          this.createHitEffect(this.ship.position.clone().add(new THREE.Vector3(0,2,0)), 1.0);
        }
        this.ship.takeDamage(damage);
        bullet.destroy();
        this.bullets.splice(i, 1);
      }
    }
  }

  firePlayerWeapon() {
    if (this.ship.canShoot()) {
      const dir = new THREE.Vector3(0, 0, -1).applyQuaternion(this.ship.mesh.quaternion);
      this.bullets.push(new Bullet(this.scene, this.ship.position.clone(), dir, this.ship.weaponConfig));
      this.ship.shoot();
      this.ship.ammo--; // Consume ammo
    } else if (this.ship && this.ship.ammo <= 0) {
      this.ship.reloadAmmo();
    }
  }

  createExplosion(position) {
    playSound('explosion');
    const particleGeo = new THREE.BufferGeometry();
    const particleCount = 150;
    const positions = new Float32Array(particleCount * 3);
    const velocities = [];
    
    for (let i = 0; i < particleCount; i++) {
      const angle = Math.random() * Math.PI * 2;
      const elevation = Math.random() * Math.PI;
      const speed = Math.random() * 0.3 + 0.1;
      
      positions[i * 3] = position.x + (Math.random() - 0.5) * 5;
      positions[i * 3 + 1] = position.y + (Math.random() - 0.5) * 5;
      positions[i * 3 + 2] = position.z + (Math.random() - 0.5) * 5;
      
      velocities.push({
        x: Math.sin(elevation) * Math.cos(angle) * speed,
        y: Math.cos(elevation) * speed,
        z: Math.sin(elevation) * Math.sin(angle) * speed
      });
    }
    
    particleGeo.setAttribute("position", new THREE.BufferAttribute(positions, 3));
    const particles = new THREE.Points(particleGeo, new THREE.PointsMaterial({ 
      color: 0xff6600, 
      size: 1.5, 
      transparent: true,
      opacity: 0.9
    }));
    this.scene.add(particles);
    
    // Animate particles
    let age = 0;
    const maxAge = 60;
    const animateExplosion = () => {
      age++;
      const posArray = particles.geometry.attributes.position.array;
      for (let i = 0; i < particleCount; i++) {
        posArray[i * 3] += velocities[i].x;
        posArray[i * 3 + 1] += velocities[i].y - 0.01; // gravity
        posArray[i * 3 + 2] += velocities[i].z;
      }
      particles.geometry.attributes.position.needsUpdate = true;
      particles.material.opacity = 0.9 * (1 - age / maxAge);
      
      if (age < maxAge) {
        requestAnimationFrame(animateExplosion);
      } else {
        this.scene.remove(particles);
      }
    };
    animateExplosion();

    // Debris chunks for richer explosion visuals
    const debris = [];
    for (let i = 0; i < 8; i++) {
      const d = new THREE.Mesh(
        new THREE.BoxGeometry(0.5 + Math.random() * 1.2, 0.3 + Math.random() * 0.8, 0.5 + Math.random() * 1.2),
        new THREE.MeshStandardMaterial({ color: 0x665544, emissive: 0x221100, emissiveIntensity: 0.25, roughness: 0.9 })
      );
      d.position.copy(position.clone().add(new THREE.Vector3(
        THREE.MathUtils.randFloat(-2, 2),
        THREE.MathUtils.randFloat(-2, 2),
        THREE.MathUtils.randFloat(-2, 2)
      )));
      d.userData.vel = new THREE.Vector3(
        THREE.MathUtils.randFloat(-0.8, 0.8),
        THREE.MathUtils.randFloat(0.1, 1.0),
        THREE.MathUtils.randFloat(-0.8, 0.8)
      );
      this.scene.add(d);
      debris.push(d);
    }

    let debrisAge = 0;
    const debrisTick = () => {
      debrisAge++;
      debris.forEach(d => {
        d.position.add(d.userData.vel);
        d.userData.vel.multiplyScalar(0.985);
        d.userData.vel.y -= 0.01;
        d.rotation.x += 0.09;
        d.rotation.y += 0.06;
      });
      if (debrisAge < 110) requestAnimationFrame(debrisTick);
      else debris.forEach(d => this.scene.remove(d));
    };
    debrisTick();
  }

  createHitEffect(position, scale = 1.0) {
    // Small, short-lived hit effect used for critical strikes
    const particleGeo = new THREE.BufferGeometry();
    const particleCount = 30 * Math.max(1, Math.floor(scale));
    const positions = new Float32Array(particleCount * 3);
    const velocities = [];
    for (let i = 0; i < particleCount; i++) {
      positions[i * 3] = position.x;
      positions[i * 3 + 1] = position.y;
      positions[i * 3 + 2] = position.z;
      const ang = Math.random() * Math.PI * 2;
      const spd = 0.2 + Math.random() * 0.6 * scale;
      velocities.push({ x: Math.cos(ang) * spd, y: (Math.random() - 0.2) * spd, z: Math.sin(ang) * spd });
    }
    particleGeo.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    const mat = new THREE.PointsMaterial({ color: 0xffdd55, size: 0.8 * scale, transparent: true, opacity: 0.95 });
    const pts = new THREE.Points(particleGeo, mat);
    this.scene.add(pts);
    let age = 0;
    const maxAge = 30;
    const tick = () => {
      age++;
      const arr = pts.geometry.attributes.position.array;
      for (let i = 0; i < particleCount; i++) {
        arr[i * 3] += velocities[i].x;
        arr[i * 3 + 1] += velocities[i].y;
        arr[i * 3 + 2] += velocities[i].z;
      }
      pts.geometry.attributes.position.needsUpdate = true;
      pts.material.opacity = 0.9 * (1 - age / maxAge);
      if (age < maxAge) requestAnimationFrame(tick);
      else this.scene.remove(pts);
    };
    tick();
  }

  updatePowerUps() {
    this.powerUps = this.powerUps.filter(p => {
      p.update();
      const dist = p.position.distanceTo(this.ship.position);
      if (dist < 5) {
        if (p.type === 'fuel') this.ship.refillFuel(50);
        if (p.type === 'shield') this.ship.addShield(30);
        if (p.type === 'ammo') this.ship.addAmmo(50);
        this.powerUpsCollected++;
        p.destroy();
        playSound('pickup');
        return false;
      }
      return true;
    });
  }

  updateResourceAttraction() {
    if (!this.ship) return;
    if (!this.resources) this.resources = { minerals: 0, salvage: 0 };

    const shipPos = this.ship.position;
    const ROCK_ATTRACT_RANGE = 140;
    const ROCK_COLLECT_RANGE = 8;
    const DERELICT_ATTRACT_RANGE = 220;
    const DERELICT_COLLECT_RANGE = 16;

    // Pull nearby asteroid chunks toward the ship and auto-collect minerals.
    this.asteroidFields.forEach(af => {
      const rocks = af.asteroids.children || [];
      for (let i = rocks.length - 1; i >= 0; i--) {
        const r = rocks[i];
        const toShip = shipPos.clone().sub(r.position);
        const dist = toShip.length();

        if (dist < ROCK_ATTRACT_RANGE && dist > 0.001) {
          const pull = THREE.MathUtils.lerp(0.1, 2.2, 1 - (dist / ROCK_ATTRACT_RANGE));
          r.position.add(toShip.normalize().multiplyScalar(pull));
          r.rotation.x += 0.03;
          r.rotation.y += 0.02;
        }

        if (dist < 14 && dist > ROCK_COLLECT_RANGE && Date.now() - this._lastAsteroidCollision > 280) {
          playSound('asteroidHit');
          this._lastAsteroidCollision = Date.now();
        }

        if (dist < ROCK_COLLECT_RANGE) {
          const amount = r.userData && r.userData.resource ? r.userData.resource : 10;
          this.resources.minerals += amount;
          af.asteroids.remove(r);
          this.scene.remove(r);
          playSound('pickup');
        }
      }
    });

    // Pull derelicts toward the ship and auto-collect salvage.
    for (let i = this.derelicts.length - 1; i >= 0; i--) {
      const d = this.derelicts[i];
      if (!d || d.scavenged || !d.mesh) continue;

      const toShip = shipPos.clone().sub(d.mesh.position);
      const dist = toShip.length();

      if (dist < DERELICT_ATTRACT_RANGE && dist > 0.001) {
        const pull = THREE.MathUtils.lerp(0.08, 1.4, 1 - (dist / DERELICT_ATTRACT_RANGE));
        d.mesh.position.add(toShip.normalize().multiplyScalar(pull));
        d.position.copy(d.mesh.position);
        d.mesh.rotation.y += 0.01;
      }

      if (dist < DERELICT_COLLECT_RANGE) {
        d.scavenged = true;
        this.resources.salvage += d.loot && d.loot.salvage ? d.loot.salvage : 20;
        this.spawnPowerUp(d.mesh.position.clone());
        d.destroy();
        this.derelicts.splice(i, 1);
        playSound('pickup');
      }
    }
  }

  ensureAICivilizations() {
    if (!Array.isArray(this.aiCivilizations)) this.aiCivilizations = [];
    if (this.aiCivilizations.length > 0) return;
    const existingOwnerIds = Array.from(new Set((this.planets || [])
      .map(p => p && p.civilization ? p.civilization.owner : null)
      .filter(o => typeof o === 'string' && o.startsWith('ai_'))));
    if (existingOwnerIds.length) {
      this.aiCivilizations = existingOwnerIds.map((id, idx) => ({
        id,
        name: `AI Civilization ${idx + 1}`,
        score: 1000 + Math.floor(Math.random() * 500),
        aggression: 0.5 + Math.random() * 0.25
      }));
      return;
    }
    const names = ['Orion Combine', 'Helix Dominion', 'Crimson Accord', 'Vega Syndicate'];
    this.aiCivilizations = names.slice(0, 3).map((name, idx) => ({
      id: `ai_${idx + 1}`,
      name,
      score: 1200 + Math.floor(Math.random() * 700),
      aggression: 0.45 + Math.random() * 0.35
    }));

    // Seed one homeworld per AI on random unclaimed planets.
    const pool = (this.planets || []).filter(p => p && p.civilization && !p.civilization.founded).sort(() => Math.random() - 0.5);
    this.aiCivilizations.forEach((ai, i) => {
      const p = pool[i];
      if (!p) return;
      p.civilization.founded = true;
      p.civilization.name = `${ai.name} Prime`;
      p.civilization.owner = ai.id;
      p.civilization.government = 'Strategic Council';
      p.civilization.governmentLevel = 2;
      p.civilization.legalLevel = 1;
      p.civilization.economyTier = 2;
      p.civilization.civScore = ai.score;
      p.civilization.territories = 1;
      p.civilization.defenseRating = 1.2;
      p.civilization.population = 28000 + Math.floor(Math.random() * 18000);
      p.civilization.stability = 62;
      if (typeof p.ensureCivilizationBeacon === 'function') p.ensureCivilizationBeacon();
    });
  }

  calculateEmpirePower(ownerId) {
    const owned = (this.planets || []).filter(p => p && p.civilization && p.civilization.founded && p.civilization.owner === ownerId);
    if (!owned.length) return 0;
    return owned.reduce((sum, p) => {
      const c = p.civilization;
      const local = (c.economyTier || 0) * 28 + (c.governmentLevel || 0) * 18 + (c.legalLevel || 0) * 12 + (c.stability || 50) * 0.9;
      return sum + local;
    }, 0);
  }

  findRivalCivilizedPlanet(ownerId, originPlanet = null) {
    const rivals = (this.planets || []).filter(p => p && p.civilization && p.civilization.founded && !p.civilization.destroyed && p.civilization.owner !== ownerId);
    if (!rivals.length) return null;
    if (!originPlanet) return rivals[0];
    return rivals.sort((a, b) => a.position.distanceTo(originPlanet.position) - b.position.distanceTo(originPlanet.position))[0] || null;
  }

  getGalacticLeaderboard() {
    const aiRows = (this.aiCivilizations || []).map(ai => {
      const owned = (this.planets || []).filter(p => p && p.civilization && p.civilization.founded && p.civilization.owner === ai.id);
      const territories = owned.length;
      const territoryScore = owned.reduce((sum, p) => sum + (p.civilization.civScore || 0), 0);
      return {
        id: ai.id,
        name: ai.name,
        score: Math.max(0, Math.floor(territoryScore + territories * 350)),
        territories,
        isPlayer: false
      };
    });
    const playerTerritories = (this.planets || []).filter(p => p && p.civilization && p.civilization.founded && p.civilization.owner === 'player').length;
    const playerRow = {
      id: 'player',
      name: 'You',
      score: Math.max(0, Math.floor(this.score || 0)),
      territories: playerTerritories,
      isPlayer: true
    };
    return [playerRow, ...aiRows].sort((a, b) => b.score - a.score);
  }

  resolveCivAssault(attackerId, targetPlanet, force = 1.0, allowDestroy = true) {
    if (!targetPlanet || !targetPlanet.civilization || !targetPlanet.civilization.founded) return false;
    const t = targetPlanet.civilization;
    const attackerPower = this.calculateEmpirePower(attackerId) * (0.6 + Math.random() * 0.8) * force;
    const defenderPower = ((t.economyTier || 0) * 26 + (t.governmentLevel || 0) * 16 + (t.legalLevel || 0) * 13 + (t.stability || 50)) * (t.defenseRating || 1);

    if (attackerPower > defenderPower * 1.7 && allowDestroy) {
      t.destroyed = false;
      t.founded = true;
      t.owner = attackerId;
      t.name = attackerId === 'player'
        ? `Player Scorched Province ${Math.floor(Math.random() * 900 + 100)}`
        : `${attackerId.toUpperCase()} Occupied Zone`;
      targetPlanet.hasBase = false;
      targetPlanet.baseLevel = 0;
      targetPlanet.terraformed = false;
      if (targetPlanet.baseStation) {
        targetPlanet.mesh.remove(targetPlanet.baseStation);
        targetPlanet.baseStation = null;
      }
      if (targetPlanet.planetMesh && targetPlanet.planetMesh.material && targetPlanet.planetMesh.material.color) {
        targetPlanet.planetMesh.material.color.setHex(0x2e2928);
      }
      t.stability = Math.max(10, (t.stability || 50) - 25);
      return true;
    }

    if (attackerPower > defenderPower * 0.95) {
      const prevOwner = t.owner;
      t.owner = attackerId;
      t.founded = true;
      t.destroyed = false;
      t.stability = Math.max(28, (t.stability || 50) - 8);
      t.civScore = Math.max(100, Math.floor((t.civScore || 800) * 0.9));
      if (attackerId === 'player') {
        t.name = `Player Protectorate ${Math.floor(Math.random() * 900 + 100)}`;
      }
      if (prevOwner === 'player') {
        showFloatingText(`Your territory was claimed: ${targetPlanet.name}`, 2600);
        this.logEvent(`Territory lost at ${targetPlanet.name}`);
      }
      return true;
    }

    t.stability = Math.max(12, (t.stability || 50) - Math.ceil(4 + Math.random() * 7));
    return false;
  }

  updateCivilizationSystems() {
    if (!this.planets || !this.planets.length || !this.ship) return;
    this.ensureAICivilizations();
    const now = Date.now();
    for (let i = 0; i < this.planets.length; i++) {
      const p = this.planets[i];
      if (!p || !p.civilization || !p.civilization.founded) continue;
      const civ = p.civilization;

      if (civ.atWar && now > (civ.warEndsAt || 0)) {
        civ.atWar = false;
        civ.stability = Math.min(100, (civ.stability || 40) + 10);
        if (typeof this.logEvent === 'function') this.logEvent(`War campaign ended for ${civ.name}`);
      }

      const nearPlayer = this.ship.position.distanceTo(p.position) < 1400;
      if (civ.atWar && nearPlayer && now - (civ.lastWarWaveAt || 0) > 10000) {
        civ.lastWarWaveAt = now;
        const waveSize = 2 + Math.min(4, Math.floor((civ.governmentLevel || 1) * 0.8));
        for (let w = 0; w < waveSize; w++) {
          const pos = p.position.clone().add(new THREE.Vector3(
            THREE.MathUtils.randFloat(-260, 260),
            THREE.MathUtils.randFloat(-110, 110),
            THREE.MathUtils.randFloat(-260, 260)
          ));
          this.enemies.push(new EnemyBot(this.scene, pos, Math.random() < 0.5 ? 'standard' : 'swarm'));
        }
        showFloatingText(`Civilization war wave near ${p.name}`, 1800);
      }

      // Natural stability drift only; no passive score inflation.
      if (!civ.atWar) civ.stability = Math.min(100, (civ.stability || 50) + 0.03);
      civ.defenseRating = 1 + ((civ.governmentLevel || 0) * 0.08) + ((civ.legalLevel || 0) * 0.06);
    }

    if (now - this._lastEmpireTickAt < this._empireTickMs) return;
    this._lastEmpireTickAt = now;

    const foundedPlanets = (this.planets || []).filter(p => p && p.civilization && p.civilization.founded && !p.civilization.destroyed);
    const neutralPlanets = (this.planets || []).filter(p => p && p.civilization && !p.civilization.founded && !p.civilization.destroyed);
    const ownerCounts = {};
    foundedPlanets.forEach(p => {
      const owner = p.civilization.owner || 'neutral';
      ownerCounts[owner] = (ownerCounts[owner] || 0) + 1;
    });
    foundedPlanets.forEach(p => {
      p.civilization.territories = ownerCounts[p.civilization.owner || 'neutral'] || 1;
    });

    // AI evolution + expansion + wars (independent from player actions).
    this.aiCivilizations.forEach(ai => {
      const owned = foundedPlanets.filter(p => p.civilization.owner === ai.id);
      // Expand onto neutral worlds.
      if (owned.length < 4 && neutralPlanets.length && Math.random() < 0.35) {
        const target = neutralPlanets[Math.floor(Math.random() * neutralPlanets.length)];
        target.civilization.founded = true;
        target.civilization.owner = ai.id;
        target.civilization.name = `${ai.name} Colony ${Math.floor(Math.random() * 90 + 10)}`;
        target.civilization.government = 'Strategic Council';
        target.civilization.governmentLevel = 1 + Math.floor(Math.random() * 2);
        target.civilization.legalLevel = 1;
        target.civilization.economyTier = 1;
        target.civilization.civScore = 600 + Math.floor(Math.random() * 400);
        target.civilization.territories = 1;
        target.civilization.population = 9000 + Math.floor(Math.random() * 12000);
        target.civilization.stability = 54;
        if (typeof target.ensureCivilizationBeacon === 'function') target.ensureCivilizationBeacon();
      }

      const targetPool = foundedPlanets.filter(p => p.civilization.owner !== ai.id);
      if (targetPool.length && Math.random() < ai.aggression) {
        const target = targetPool[Math.floor(Math.random() * targetPool.length)];
        const changed = this.resolveCivAssault(ai.id, target, 1.0, true);
        if (changed && Math.random() < 0.75) {
          this.logEvent(`${ai.name} launched a successful assault near ${target.name}`);
        }
      }
    });

    // AI raids on player ship scale over time/score. Early game stays easier.
    const elapsedMinutes = Math.max(0, (now - this.gameStartTime) / 60000);
    const raidTier = Math.min(10, Math.floor(elapsedMinutes / 2.2) + Math.floor(this.score / 1800));
    const raidIntervalMs = Math.max(9000, 22000 - raidTier * 1200);
    const raidChance = Math.min(0.9, 0.35 + raidTier * 0.05);
    if (now - this._lastAiPlayerRaidAt > raidIntervalMs && this.aiCivilizations.length && Math.random() < raidChance) {
      this._lastAiPlayerRaidAt = now;
      const raidSize = Math.min(18, 2 + Math.floor(raidTier * 1.2) + Math.floor(Math.random() * (2 + Math.floor(raidTier * 0.6))));
      let raidPool = ['standard', 'fast'];
      if (raidTier >= 2) raidPool.push('swarm');
      if (raidTier >= 4) raidPool.push('sniper');
      if (raidTier >= 6) raidPool.push('shielded');
      if (raidTier >= 8) raidPool.push('tank');
      for (let i = 0; i < raidSize; i++) {
        const pos = this.ship.position.clone().add(new THREE.Vector3(
          THREE.MathUtils.randFloat(-240, 240),
          THREE.MathUtils.randFloat(-120, 120),
          THREE.MathUtils.randFloat(-240, 240)
        ));
        const raidType = raidPool[Math.floor(Math.random() * raidPool.length)];
        this.enemies.push(new EnemyBot(this.scene, pos, raidType));
      }
      showFloatingText(`AI raid incoming (${raidSize}) - Threat ${raidTier + 1}`, 1700);
    }
  }

  update(keys) {
      this.ship.updatePhysics(keys, this.planets);

      // Environmental effects: Nebula visibility and Black Hole gravity
      this.inNebula = false;
      for (let nb of this.nebulas) {
        if (nb.contains(this.ship.position)) {
          this.inNebula = true;
          // subtle visual cue: reduce scene fog visibility
          scene.fog = new THREE.FogExp2(nb.color.getHex(), 0.0008);
          break;
        } else {
          scene.fog = null;
        }
      }

      // Apply black hole gravity and check event horizon
      for (let bh of this.blackHoles) {
        bh.applyGravity(this.ship, this._bhGravityMultiplier || 1);
        if (bh.isEventHorizon(this.ship.position)) {
          // catastrophic: immediate game over
          triggerGameOver();
          return;
        }
      }

      // Check for high acceleration to detach enemies
      const acceleration = this.ship.velocity.clone().sub(this.ship.previousVelocity).length();
      if (acceleration > 2) {
        this.ship.detachEnemies(this);
      }

      this.ship.updateThrusterParticles();
      this.updatePlanets();
      this.spawnPlanets();
      this.spawnDynamicFeatures();
      this.updateColossalDerelicts();
      this.updateArtifactsAndGates();
      this.updateCosmicEvents();
      this.asteroidFields.forEach(af => af.update());
      this.updateFactionWar();
      this.updateAlienWaves();
      
      // Spawn enemy waves in all directions as you explore
      const spawnDistance = 1250;
      const numEnemies = 3 + Math.floor(Math.random() * 3); // 3-5 enemies
      
      // Forward (negative Z)
      if (this.ship.position.z < this.enemySpawnZ - spawnDistance) {
        this.enemySpawnZ -= spawnDistance;
        for (let i = 0; i < numEnemies; i++) {
          const pos = new THREE.Vector3(
            THREE.MathUtils.randFloat(-500, 500),
            THREE.MathUtils.randFloat(-200, 200),
            this.enemySpawnZ + THREE.MathUtils.randFloat(-200, 200)
          );
          this.enemies.push(new EnemyBot(this.scene, pos, 'standard'));
        }
      }
      
      // Backward (positive Z)
      if (this.ship.position.z > this.enemySpawnZ + spawnDistance) {
        this.enemySpawnZ += spawnDistance;
        for (let i = 0; i < numEnemies; i++) {
          const pos = new THREE.Vector3(
            THREE.MathUtils.randFloat(-500, 500),
            THREE.MathUtils.randFloat(-200, 200),
            this.enemySpawnZ + THREE.MathUtils.randFloat(-200, 200)
          );
          this.enemies.push(new EnemyBot(this.scene, pos, 'standard'));
        }
      }
      
      // Left (negative X)
      if (this.ship.position.x < this.enemySpawnX - spawnDistance) {
        this.enemySpawnX -= spawnDistance;
        for (let i = 0; i < numEnemies; i++) {
          const pos = new THREE.Vector3(
            this.enemySpawnX + THREE.MathUtils.randFloat(-200, 200),
            THREE.MathUtils.randFloat(-200, 200),
            THREE.MathUtils.randFloat(-800, 800)
          );
          this.enemies.push(new EnemyBot(this.scene, pos, 'standard'));
        }
      }
      
      // Right (positive X)
      if (this.ship.position.x > this.enemySpawnX + spawnDistance) {
        this.enemySpawnX += spawnDistance;
        for (let i = 0; i < numEnemies; i++) {
          const pos = new THREE.Vector3(
            this.enemySpawnX + THREE.MathUtils.randFloat(-200, 200),
            THREE.MathUtils.randFloat(-200, 200),
            THREE.MathUtils.randFloat(-800, 800)
          );
          this.enemies.push(new EnemyBot(this.scene, pos, 'standard'));
        }
      }
      
      // Up (positive Y)
      if (this.ship.position.y > this.enemySpawnY + spawnDistance) {
        this.enemySpawnY += spawnDistance;
        for (let i = 0; i < numEnemies; i++) {
          const pos = new THREE.Vector3(
            THREE.MathUtils.randFloat(-500, 500),
            this.enemySpawnY + THREE.MathUtils.randFloat(-200, 200),
            THREE.MathUtils.randFloat(-800, 800)
          );
          this.enemies.push(new EnemyBot(this.scene, pos, 'standard'));
        }
      }
      
      // Down (negative Y)
      if (this.ship.position.y < this.enemySpawnY - spawnDistance) {
        this.enemySpawnY -= spawnDistance;
        for (let i = 0; i < numEnemies; i++) {
          const pos = new THREE.Vector3(
            THREE.MathUtils.randFloat(-500, 500),
            this.enemySpawnY + THREE.MathUtils.randFloat(-200, 200),
            THREE.MathUtils.randFloat(-800, 800)
          );
          this.enemies.push(new EnemyBot(this.scene, pos, 'standard'));
        }
      }
      
      this.spawnEnemies();
      this.updateEnemies();
      this.updateHelperBots();
      this.updateMegaShip();
      this.updateBullets();
      this.updatePowerUps();
      this.updateResourceAttraction();
      this.updateCivilizationSystems();
      const wasLanded = this.ship.landed;
      const prevPlanet = this.ship.landedPlanet;
      this.ship.checkLanding(this.planets, keys);
      if (wasLanded && !this.ship.landed && prevPlanet && prevPlanet.hasBase) {
        this.returnBaseTarget = prevPlanet;
        showFloatingText('Return trail set to your base', 1600);
      }
      this.updateBaseReturnTrail();

      // Ambient/engine audio pulses
      const nowAudio = Date.now();
      if (this.ship.velocity.length() > 0.8 && nowAudio - this._lastEngineHum > 420) {
        playSound('engineHum');
        this._lastEngineHum = nowAudio;
      }
      if (nowAudio - this._lastAmbientPulse > 8000) {
        playSound('ambient');
        this._lastAmbientPulse = nowAudio;
      }

      // Update missions
      this.missions.forEach(m => m.update(this));

      // --- Achievements ---
      const ACHIEVEMENT_POINT = 2;      // points per achievement
      const ACHIEVEMENT_CAP = 30;       // max total from achievements per update
      let pointsFromAchievements = 0;

      this.achievements.forEach(ach => {
        if (!this.unlockedAchievements.has(ach.id) && ach.condition(this, ach)) {
          this.unlockedAchievements.add(ach.id);
          showAchievement(ach);

          this.upgradePoints += ach.reward;

          playSound('achievement');
          showFloatingText(`+${ach.reward} Upgrade Points`, 1800);
        }
      });

      // --- Completed Missions ---
      this.missions.forEach(mission => {
          if (mission.completed && !mission.rewarded) {
              this.upgradePoints += mission.reward;
              mission.rewarded = true;
              playSound('achievement');
          }
      });

      // --- Score-based upgrade points ---
      if (Math.floor(this.score / 500) > this.upgradePoints / 50) {
          this.upgradePoints += 25;
      }

      // Passive per-second score gain removed.

      // --- Generate new missions if all are completed ---
      if (this.missions.every(m => m.completed)) {
          this.generateMissions();
      }

      // Check if ship is dead
      if (this.ship.health <= 0) {
          triggerGameOver();
      }
  }

  getStats() {
    let closest = null;
    let minDist = Infinity;
    this.planets.forEach(p => {
      const dist = this.ship.position.distanceTo(p.position);
      if (dist < minDist) { minDist = dist; closest = p; }
    });

    const altitude = closest ? Math.max(0, this.ship.position.distanceTo(closest.position) - closest.radius) : 0;
    return {
      speed: this.ship.velocity.length().toFixed(2),
      altitude: altitude.toFixed(1),
      health: this.ship.health,
      maxHealth: this.ship.maxHealth,
      weaponName: this.ship.weaponConfig.name,
      enemies: this.enemies.length,
      fuel: this.ship.fuel.toFixed(1),
      maxFuel: this.ship.maxFuel,
      shield: this.ship.shieldHealth.toFixed(0),
      ammo: this.ship.ammo,
      score: this.score,
      kills: this.kills,
      cooldown: Math.ceil(this.ship.shootCooldown / 10)
    };
  }
}

// ===================== SCENE SETUP =====================
const scene = new THREE.Scene();
scene.background = new THREE.Color(0x000000);

const camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 100000);
camera.position.set(0, 6, 18);

const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.setPixelRatio(window.devicePixelRatio);
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
document.body.appendChild(renderer.domElement);
renderer.domElement.style.pointerEvents = 'none';
renderer.domElement.style.zIndex = '-1';

scene.add(new THREE.AmbientLight(0xffffff, 0.5));
const sunLight = new THREE.DirectionalLight(0xffffff, 1.0);
sunLight.position.set(100, 200, 100);
sunLight.castShadow = true;
sunLight.shadow.mapSize.width = 2048;
sunLight.shadow.mapSize.height = 2048;
sunLight.shadow.camera.near = 10;
sunLight.shadow.camera.far = 2000;
sunLight.shadow.camera.left = -700;
sunLight.shadow.camera.right = 700;
sunLight.shadow.camera.top = 700;
sunLight.shadow.camera.bottom = -700;
scene.add(sunLight);

function createStars() {
  const geometry = new THREE.BufferGeometry();
  const vertices = [];
  for (let i = 0; i < 20000; i++) vertices.push((Math.random() - 0.5) * 100000, (Math.random() - 0.5) * 100000, (Math.random() - 0.5) * 100000);
  geometry.setAttribute("position", new THREE.Float32BufferAttribute(vertices, 3));
  const material = new THREE.PointsMaterial({ color: 0xffffff, size: 2 });
  scene.add(new THREE.Points(geometry, material));
}
createStars();

function ensureJournalUI() {
  if (document.getElementById('journalPanel')) return;
  const panel = document.createElement('div');
  panel.id = 'journalPanel';
  panel.style.position = 'fixed';
  panel.style.right = '16px';
  panel.style.bottom = '16px';
  panel.style.width = '320px';
  panel.style.maxHeight = '44vh';
  panel.style.overflowY = 'auto';
  panel.style.background = 'rgba(0,0,0,0.78)';
  panel.style.border = '1px solid rgba(120,220,255,0.5)';
  panel.style.borderRadius = '8px';
  panel.style.padding = '10px';
  panel.style.zIndex = '210';
  panel.style.display = 'none';
  panel.innerHTML = '<div style="color:#88e1ff;font-weight:bold;margin-bottom:8px;">JOURNAL / LOG</div><div id="journalItems" style="font-size:12px;line-height:1.4;color:#d7f4ff;"></div>';
  document.body.appendChild(panel);

  const btn = document.createElement('button');
  btn.id = 'journalButton';
  btn.textContent = 'JOURNAL';
  btn.style.position = 'fixed';
  btn.style.right = '16px';
  btn.style.top = '74px';
  btn.style.zIndex = '220';
  btn.style.padding = '8px 10px';
  btn.style.background = 'rgba(0,0,0,0.75)';
  btn.style.color = '#88e1ff';
  btn.style.border = '1px solid #88e1ff';
  btn.style.borderRadius = '6px';
  btn.style.cursor = 'pointer';
  btn.onclick = () => {
    journalOpen = !journalOpen;
    panel.style.display = journalOpen ? 'block' : 'none';
    updateJournalUI();
  };
  document.body.appendChild(btn);
}

window.updateJournalUI = function() {
  const el = document.getElementById('journalItems');
  if (!el) return;
  if (!gameWorld || !gameWorld.journal || !gameWorld.journal.length) {
    el.innerHTML = '<div>No entries yet.</div>';
    return;
  }
  el.innerHTML = gameWorld.journal.map(x => `<div style="margin-bottom:6px;">${x}</div>`).join('');
};

function ensureCockpitUI() {
  if (document.getElementById('cockpitOverlay')) return;
  const o = document.createElement('div');
  o.id = 'cockpitOverlay';
  o.style.position = 'fixed';
  o.style.left = '50%';
  o.style.bottom = '14px';
  o.style.transform = 'translateX(-50%)';
  o.style.padding = '8px 12px';
  o.style.background = 'rgba(0,0,0,0.55)';
  o.style.border = '1px solid rgba(120,220,255,0.45)';
  o.style.borderRadius = '8px';
  o.style.color = '#9de9ff';
  o.style.fontSize = '12px';
  o.style.zIndex = '215';
  o.style.display = 'none';
  o.innerHTML = '<span id=\"cockpitReadout\">COCKPIT</span>';
  document.body.appendChild(o);
}

function ensureLeaderboardUI() {
  if (document.getElementById('leaderboardPanel')) return;
  const panel = document.createElement('div');
  panel.id = 'leaderboardPanel';
  panel.style.position = 'fixed';
  panel.style.left = '16px';
  panel.style.top = '208px';
  panel.style.width = '280px';
  panel.style.maxHeight = '34vh';
  panel.style.overflowY = 'auto';
  panel.style.background = 'rgba(0,0,0,0.72)';
  panel.style.border = '1px solid rgba(255,215,140,0.5)';
  panel.style.borderRadius = '8px';
  panel.style.padding = '10px';
  panel.style.zIndex = '214';
  panel.style.display = 'none';
  panel.innerHTML = '<div style="color:#ffd38a;font-weight:bold;margin-bottom:8px;">GALACTIC LEADERBOARD</div><div id="leaderboardItems" style="font-size:12px;line-height:1.45;color:#fff2d1;"></div>';
  document.body.appendChild(panel);
}

window.updateLeaderboardUI = function() {
  const panel = document.getElementById('leaderboardPanel');
  const items = document.getElementById('leaderboardItems');
  if (!panel || !items) return;
  if (!gameStarted || !gameWorld || typeof gameWorld.getGalacticLeaderboard !== 'function') {
    panel.style.display = 'none';
    return;
  }
  const rows = gameWorld.getGalacticLeaderboard();
  panel.style.display = rows.length ? 'block' : 'none';
  const hudContent = document.getElementById('hudContent');
  const hudRoot = document.getElementById('hud');
  let anchor = null;
  if (hudContent && hudContent.style.display !== 'none') anchor = hudContent;
  else if (hudRoot) anchor = hudRoot;
  if (anchor) {
    const rect = anchor.getBoundingClientRect();
    panel.style.top = `${Math.max(16, Math.round(rect.bottom + 12))}px`;
  } else {
    panel.style.top = '208px';
  }
  items.innerHTML = rows.map((r, idx) => {
    const rank = idx + 1;
    const star = r.isPlayer ? 'YOU' : `AI`;
    const color = r.isPlayer ? '#90ffbf' : '#ffdca8';
    return `<div style="margin-bottom:6px;color:${color};">${rank}. ${r.name} <span style="color:#bbb;">(${star})</span><br><span style="color:#d7d7d7;">Score ${Math.floor(r.score)} | Territories ${r.territories}</span></div>`;
  }).join('');
};

// ===================== UI FUNCTIONS =====================
let builderScene, builderCamera, builderRenderer, builderShip;
let shopOpen = false;

function ensureMarketState() {
  if (!gameWorld) return;
  if (!gameWorld.purchaseCounts) gameWorld.purchaseCounts = {};
}

function getDynamicShopCost(baseCost, type = 'generic') {
  if (!gameWorld) return Math.floor(baseCost || 0);
  ensureMarketState();
  const bought = gameWorld.purchaseCounts[type] || 0;
  const repeatHeavy = ['ammo', 'fuel', 'shield', 'health', 'stage', 'satellite_t1', 'satellite_t2', 'satellite_t3', 'drone_combat', 'drone_harvester'];
  const step = repeatHeavy.includes(type) ? 0.22 : 0.14;
  const ownScale = 1 + (bought * step);
  const economyScale = 1 + Math.min(0.35, (gameWorld.score || 0) / 45000);
  return Math.max(1, Math.floor((baseCost || 0) * ownScale * economyScale));
}

function countOwnedSkins() {
  const ids = Object.keys(PROFESSIONAL_SKINS || {});
  let total = 0;
  for (let i = 0; i < ids.length; i++) {
    if (localStorage.getItem(`skin_${ids[i]}`) === 'true') total++;
  }
  return total;
}

function getDynamicSkinCost(baseCost, skinId) {
  const owned = countOwnedSkins();
  const base = Math.max(1, Math.floor(baseCost || 0));
  const ramp = 1 + (owned * 0.2);
  return Math.max(base, Math.floor(base * ramp));
}

window.selectOption = function(category, option, e) {
  // Update game choice
  shipChoice[category] = option;
  
  // Remove selection from all options in the same category
  const categoryNum = category === 'body' ? 1 : category === 'tank' ? 2 : 3;
  const sectionElement = e.target.closest('.builder-section');
  sectionElement.querySelectorAll('.builder-option').forEach(el => el.classList.remove('selected'));
  
  // Add selection to clicked option (find the parent .builder-option)
  let option_el = e.target.closest('.builder-option');
  if (option_el) {
    option_el.classList.add('selected');
  }
  
  // Update 3D preview
  updateBuilderPreview();
  updateStartButtonState();
};

function initBuilderPreview() {
  const container = document.getElementById('builderPreview');
  if (!container || builderScene) return;
  
  // Create scene
  builderScene = new THREE.Scene();
  builderScene.background = new THREE.Color(0x001a33);
  
  builderCamera = new THREE.PerspectiveCamera(75, 300 / 300, 0.1, 1000);
  builderCamera.position.z = 4.8;
  
  builderRenderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
  builderRenderer.setSize(300, 300);
  builderRenderer.setPixelRatio(window.devicePixelRatio);
  container.appendChild(builderRenderer.domElement);
  
  // Lighting
  const light = new THREE.DirectionalLight(0xffffff, 1.0);
  light.position.set(5, 10, 5);
  builderScene.add(light);
  builderScene.add(new THREE.AmbientLight(0xffffff, 0.6));
  
  // Initial preview
  updateBuilderPreview();
  
  // Animation loop
  const renderPreview = () => {
    requestAnimationFrame(renderPreview);
    if (builderShip) {
      builderShip.rotation.y += 0.01;
      builderShip.rotation.x += 0.005;
    }
    builderRenderer.render(builderScene, builderCamera);
  };
  renderPreview();
}

function updateBuilderPreview() {
  if (!builderScene) initBuilderPreview();
  if (!builderScene) return;
  
  // Remove old ship
  if (builderShip) builderScene.remove(builderShip);
  
  const bodyType = shipChoice.body || 'balanced';
  const bodyConfig = shipConfigs.body[bodyType];
  const previewConfig = {
    scale: bodyConfig.scale,
    bodyType,
    tankType: shipChoice.tank || 'standard',
    engineType: shipChoice.engine || 'pulse'
  };
  const preview = buildShipVisual(previewConfig);
  builderShip = preview.group;
  builderShip.position.set(0, -0.1, 0);
  builderScene.add(builderShip);
}

window.openShop = function() {
  // Open the global shop (clear any planet-specific shop context)
  window._activePlanetShop = null;
  window._activePlanetRef = null;
  shopOpen = true;
  document.getElementById('shopOverlay').style.display = 'flex';
  updateShopUI();
};

window.closeShop = function() {
  shopOpen = false;
  window._activePlanetShop = null;
  window._activePlanetRef = null;
  document.getElementById('shopOverlay').style.display = 'none';
};

function updateShopUI() {
  // shop: optional shop object (shop.shop array), planet: optional planet reference
  const shopItems = document.getElementById('shopItems');
  const score = gameWorld ? gameWorld.score : 0;
  const ship = gameWorld ? gameWorld.ship : null;

  // If a planet shop is provided via global temp, use it, otherwise show global items
  const currentShop = window._activePlanetShop || null;

  const defaultItems = [
    { name: 'Ammo Pack', price: 50, type: 'ammo', amount: 100 },
    { name: 'Fuel Canister', price: 75, type: 'fuel', amount: 50 },
    { name: 'Shield Module', price: 100, type: 'shield', amount: 100 },
    { name: 'Health Repair', price: 150, type: 'health', amount: 100 },
    { name: 'Combat Drone', price: 700, type: 'drone_combat', desc: 'Minion that fights enemy aliens near you' },
    { name: 'Harvester Drone', price: 900, type: 'drone_harvester', desc: 'Minion that gathers minerals and salvage' },
    { name: 'Faction War Protocol', price: 1200, type: 'faction_war', desc: 'Enable allied bot patrols vs alien factions' },
    { name: '\uD83D\uDE80 Neon Blue Skin', price: 200, type: 'skin', skinId: 'neon_blue' },
    { name: '\uD83D\uDD25 Crimson Red Skin', price: 200, type: 'skin', skinId: 'crimson_red' },
    { name: '\u26A1 Electric Purple Skin', price: 200, type: 'skin', skinId: 'electric_purple' },
    { name: '\uD83C\uDF1F Golden Elite Skin', price: 500, type: 'skin', skinId: 'golden_elite' },
    { name: '\uD83D\uDD76\uFE0F Obsidian Stealth', price: 650, type: 'skin', skinId: 'obsidian_stealth' },
    { name: '\u2744\uFE0F Arctic Ops', price: 650, type: 'skin', skinId: 'arctic_ops' }
  ];

  const items = currentShop ? currentShop.shop : defaultItems;

  shopItems.innerHTML = items.map((item) => {
    if (item.type === 'skin') {
      const owned = localStorage.getItem(`skin_${item.skinId}`) === 'true';
      const dynamicPrice = getDynamicSkinCost(item.price, item.skinId);
      return `
      <div class="shopItem">
        <div>
          <div class="itemName">${item.name} ${owned ? '(Owned)' : ''}</div>
          <div style="font-size: 11px; color: #aaa;">Cosmetic ship appearance</div>
        </div>
        <div class="itemPrice">\u2B50 ${dynamicPrice}</div>
        <button onclick="buySkin('${item.skinId}', ${item.price})" 
                ${score < dynamicPrice || owned ? 'disabled' : ''}>
          ${owned ? 'OWNED' : 'BUY'}
        </button>
      </div>
    `;
    } else if (item.type === 'base') {
      const planet = window._activePlanetRef;
      const already = planet && planet.hasBase;
      const dynamicPrice = getDynamicShopCost(item.price, item.type);
      return `
      <div class="shopItem">
        <div>
          <div class="itemName">${item.name} ${already ? '(Established)' : ''}</div>
          <div style="font-size: 11px; color: #aaa;">${item.desc}</div>
        </div>
        <div class="itemPrice">\u2B50 ${dynamicPrice}</div>
        <button onclick="buyItem('${item.type}', 0, ${item.price})" 
                ${score < dynamicPrice || already ? 'disabled' : ''}>
          ${already ? 'OWNED' : 'BUY'}
        </button>
      </div>
    `;
    } else if (
      item.type === 'stage' ||
      (item.type && item.type.startsWith('satellite')) ||
      (item.type && item.type.startsWith('drone_')) ||
      (item.type && item.type.startsWith('base_')) ||
      (item.type && item.type.startsWith('eng_')) ||
      (item.type && item.type.startsWith('civ_')) ||
      item.type === 'faction_war' ||
      item.type === 'terraform'
    ) {
      const planet = window._activePlanetRef;
      const requiresBase = item.type.startsWith('base_') || item.type === 'terraform' || item.type.startsWith('eng_') || item.type.startsWith('civ_');
      const baseMissing = requiresBase && (!planet || !planet.hasBase);
      const terraformDone = (item.type === 'terraform' || item.type === 'eng_atmosphere') && planet && planet.terraformed;
      const factionOwned = item.type === 'faction_war' && gameWorld && gameWorld.factionWarMode;
      const stationTier = planet ? (planet.baseLevel || 0) : 0;
      const stationLocked =
        (item.type === 'base_t2' && stationTier < 1) ||
        (item.type === 'base_t3' && stationTier < 2) ||
        (item.type === 'base_t4' && stationTier < 3);
      const stationAlready =
        (item.type === 'base_t2' && stationTier >= 2) ||
        (item.type === 'base_t3' && stationTier >= 3) ||
        (item.type === 'base_t4' && stationTier >= 4);
      const civ = planet && planet.civilization ? planet.civilization : {};
      const civMissing = item.type.startsWith('civ_') && !civ.founded && item.type !== 'civ_found';
      const civNotPlayerOwned = item.type.startsWith('civ_') && item.type !== 'civ_found' && civ.founded && civ.owner !== 'player';
      const civFoundAlready = item.type === 'civ_found' && !!civ.founded;
      const civGovernmentMaxed = item.type === 'civ_government' && (civ.governmentLevel || 0) >= 3;
      const civLegalMaxed = item.type === 'civ_legal' && (civ.legalLevel || 0) >= 4;
      const civEconomyMaxed = item.type === 'civ_economy' && (civ.economyTier || 0) >= 4;
      const civWarCooldown = item.type === 'civ_war' && civ.lastWarAt && (Date.now() - civ.lastWarAt < 28000);
      const civInvasionUnavailable = item.type === 'civ_invasion' && (!gameWorld || !planet || !civ.founded || !gameWorld.findRivalCivilizedPlanet('player', planet));
      const engineering = planet && planet.engineering ? planet.engineering : {};
      const engineeringMaxed =
        ((item.type === 'eng_move_moon') && (engineering.movedMoons || 0) >= 3) ||
        ((item.type === 'eng_artificial_rings') && (engineering.artificialRings || 0) >= 2) ||
        ((item.type === 'eng_detonate_star') && (engineering.starDetonated || 0) >= 1) ||
        ((item.type === 'eng_dyson_swarm') && (engineering.dysonSwarms || 0) >= 3);
      const dynamicPrice = getDynamicShopCost(item.price, item.type);
      const tierInfo = (() => {
        if (!gameWorld || !gameWorld.satelliteTiers) return '';
        if (item.type === 'satellite_t1') return `Owned: ${gameWorld.satelliteTiers.t1 || 0}`;
        if (item.type === 'satellite_t2') return `Owned: ${gameWorld.satelliteTiers.t2 || 0} | Needs T1`;
        if (item.type === 'satellite_t3') return `Owned: ${gameWorld.satelliteTiers.t3 || 0} | Needs T2`;
        if (item.type === 'drone_combat') return `Owned: ${(gameWorld.droneCounts && gameWorld.droneCounts.combat) || 0}`;
        if (item.type === 'drone_harvester') return `Owned: ${(gameWorld.droneCounts && gameWorld.droneCounts.harvester) || 0}`;
        if (item.type === 'base_t2') return `Current station tier: ${stationTier} | Requires Tier I`;
        if (item.type === 'base_t3') return `Current station tier: ${stationTier} | Requires Tier II`;
        if (item.type === 'base_t4') return `Current station tier: ${stationTier} | Requires Tier III`;
        if (item.type === 'eng_move_moon') return `Moons moved: ${engineering.movedMoons || 0}/3`;
        if (item.type === 'eng_artificial_rings') return `Artificial rings: ${engineering.artificialRings || 0}/2`;
        if (item.type === 'eng_dyson_swarm') return `Dyson tiers: ${engineering.dysonSwarms || 0}/3`;
        if (item.type === 'eng_detonate_star') return (engineering.starDetonated || 0) ? 'Completed' : 'One-time operation';
        if (item.type === 'civ_found') return civ.founded ? `Founded: ${civ.name || 'Civilization'}` : 'Requires base';
        if (item.type === 'civ_government') return `Government lvl: ${civ.governmentLevel || 0}/3`;
        if (item.type === 'civ_legal') return `Legal tier: ${civ.legalLevel || 0}/4`;
        if (item.type === 'civ_economy') return `Economy tier: ${civ.economyTier || 0}/4`;
        if (item.type === 'civ_war') return civWarCooldown ? 'Cooldown active' : (civ.atWar ? 'War active' : 'Launch campaign');
        if (item.type === 'civ_invasion') return civInvasionUnavailable ? 'No rival territory in range' : 'Invade nearest rival world';
        if (item.type === 'faction_war' && factionOwned) return 'Activated';
        if (item.type === 'terraform' && terraformDone) return 'Complete';
        if (requiresBase && baseMissing) return 'Requires base';
        if (civNotPlayerOwned) return 'Only player-owned civilizations can be managed';
        if (civMissing) return 'Found civilization first';
        if (stationLocked) return 'Requires lower station tier';
        return '';
      })();
      return `
      <div class="shopItem">
        <div>
          <div class="itemName">${item.name}</div>
          <div style="font-size: 11px; color: #aaa;">${item.desc || ''} ${tierInfo}</div>
        </div>
        <div class="itemPrice">\u2B50 ${dynamicPrice}</div>
        <button onclick="buyItem('${item.type}', 0, ${item.price})" 
                ${score < dynamicPrice || baseMissing || terraformDone || factionOwned || stationLocked || stationAlready || engineeringMaxed || civMissing || civNotPlayerOwned || civFoundAlready || civGovernmentMaxed || civLegalMaxed || civEconomyMaxed || civWarCooldown || civInvasionUnavailable ? 'disabled' : ''}>
          ${factionOwned || stationAlready || engineeringMaxed || civFoundAlready || civGovernmentMaxed || civLegalMaxed || civEconomyMaxed ? 'OWNED' : 'BUY'}
        </button>
      </div>
    `;
    } else {
      const currentAmount = item.type === 'ammo' ? (ship ? ship.ammo : 0) : 
                            item.type === 'fuel' ? (ship ? ship.fuel.toFixed(1) : 0) :
                            item.type === 'shield' ? (ship ? ship.shieldHealth.toFixed(0) : 0) :
                            item.type === 'health' ? (ship ? ship.health : 0) : 0;
      const dynamicPrice = getDynamicShopCost(item.price, item.type);
      return `
      <div class="shopItem">
        <div>
          <div class="itemName">${item.name}</div>
          <div style="font-size: 11px; color: #aaa;">Current: ${currentAmount} | +${item.amount}</div>
        </div>
        <div class="itemPrice">\u2B50 ${dynamicPrice}</div>
        <button onclick="buyItem('${item.type}', ${item.amount}, ${item.price})" 
                ${score < dynamicPrice ? 'disabled' : ''}>
          BUY
        </button>
      </div>
    `;
    }
  }).join('');
}

window.openMineralShop = function() {
  document.getElementById('mineralOverlay').style.display = 'flex';
  updateMineralUI();
};

window.closeMineralShop = function() {
  document.getElementById('mineralOverlay').style.display = 'none';
};

window.openInventory = function() {
  document.getElementById('inventoryOverlay').style.display = 'flex';
  updateInventoryUI();
};

window.closeInventory = function() {
  document.getElementById('inventoryOverlay').style.display = 'none';
};

window.openCrafting = function() {
  document.getElementById('craftingOverlay').style.display = 'flex';
  updateCraftingUI();
};

window.closeCrafting = function() {
  document.getElementById('craftingOverlay').style.display = 'none';
};

function getCraftRecipes() {
  return [
    { id: 'ammo_crate', name: 'Ammo Crate', desc: '+250 ammo', minerals: 20, salvage: 5 },
    { id: 'shield_battery', name: 'Shield Battery', desc: '+80 shield', minerals: 25, salvage: 8 },
    { id: 'fuel_cells', name: 'Fuel Cells', desc: '+80 fuel', minerals: 18, salvage: 6 },
    { id: 'field_repair', name: 'Field Repair Kit', desc: '+60 health', minerals: 30, salvage: 10 },
    { id: 'rocket_stage', name: 'Rocket Stage', desc: '+1 stage for Z separation', minerals: 45, salvage: 16 }
  ];
}

window.updateInventoryUI = function() {
  const el = document.getElementById('inventoryItems');
  if (!el) return;
  if (!gameWorld || !gameWorld.ship) { el.innerHTML = '<div>No game</div>'; return; }

  const r = gameWorld.resources || { minerals: 0, salvage: 0 };
  el.innerHTML = `
    <div class="shopItem">
      <div>
        <div class="itemName">Ship Cargo</div>
        <div style="font-size:11px;color:#aaa;">Current mission inventory</div>
      </div>
      <div class="itemPrice">LIVE</div>
    </div>
    <div style="padding:12px 4px; line-height:1.7;">
      <div>\u26CF\uFE0F Minerals: <strong>${r.minerals || 0}</strong></div>
      <div>\u2699 Salvage: <strong>${r.salvage || 0}</strong></div>
      <div>\uD83D\uDCA5 Ammo: <strong>${gameWorld.ship.ammo}</strong></div>
      <div>\u26FD Fuel: <strong>${Math.floor(gameWorld.ship.fuel)}</strong> / ${Math.floor(gameWorld.ship.maxFuel)}</div>
      <div>\uD83D\uDEE1\uFE0F Shield: <strong>${Math.floor(gameWorld.ship.shieldHealth)}</strong> / ${Math.floor(gameWorld.ship.maxShield)}</div>
      <div>\u2764\uFE0F Health: <strong>${Math.floor(gameWorld.ship.health)}</strong> / ${Math.floor(gameWorld.ship.maxHealth)}</div>
      <div>\uD83D\uDE80 Extra Stages: <strong>${gameWorld.ship.extraStages || 0}</strong></div>
    </div>
  `;
};

window.updateCraftingUI = function() {
  const el = document.getElementById('craftingItems');
  if (!el) return;
  if (!gameWorld || !gameWorld.ship) { el.innerHTML = '<div>No game</div>'; return; }
  const recipes = getCraftRecipes();
  const r = gameWorld.resources || { minerals: 0, salvage: 0 };

  el.innerHTML = `
    <div style="margin-bottom:10px;">Resources: <strong>\u26CF\uFE0F ${r.minerals || 0}</strong> minerals | <strong>\u2699 ${r.salvage || 0}</strong> salvage</div>
    ${recipes.map((rec) => {
      const can = (r.minerals || 0) >= rec.minerals && (r.salvage || 0) >= rec.salvage;
      return `
        <div class="shopItem">
          <div>
            <div class="itemName">${rec.name}</div>
            <div style="font-size:11px;color:#aaa;">${rec.desc} | Cost: ${rec.minerals} minerals, ${rec.salvage} salvage</div>
          </div>
          <button onclick="craftItem('${rec.id}')" ${can ? '' : 'disabled'}>${can ? 'CRAFT' : 'NEED MORE'}</button>
        </div>
      `;
    }).join('')}
  `;
};

window.craftItem = function(id) {
  if (!gameWorld || !gameWorld.ship) return;
  if (!gameWorld.resources) gameWorld.resources = { minerals: 0, salvage: 0 };
  const rec = getCraftRecipes().find(r => r.id === id);
  if (!rec) return;
  if (gameWorld.resources.minerals < rec.minerals || gameWorld.resources.salvage < rec.salvage) {
    showFloatingText('Not enough resources', 1400);
    return;
  }

  gameWorld.resources.minerals -= rec.minerals;
  gameWorld.resources.salvage -= rec.salvage;

  if (id === 'ammo_crate') gameWorld.ship.addAmmo(250);
  if (id === 'shield_battery') gameWorld.ship.addShield(80);
  if (id === 'fuel_cells') gameWorld.ship.refillFuel(80);
  if (id === 'field_repair') gameWorld.ship.health = Math.min(gameWorld.ship.maxHealth, gameWorld.ship.health + 60);
  if (id === 'rocket_stage') gameWorld.ship.addRocketStage();

  showFloatingText(`Crafted ${rec.name}`, 1700);
  playSound('pickup');
  updateHUD();
  if (window.updateInventoryUI) updateInventoryUI();
  if (window.updateCraftingUI) updateCraftingUI();
};

function updateMineralUI() {
  const el = document.getElementById('mineralItems');
  if (!gameWorld) { el.innerHTML = '<div>No game</div>'; return; }
  const minerals = gameWorld.resources ? gameWorld.resources.minerals : 0;
  el.innerHTML = `
    <div style="margin-bottom:12px;">You have <strong>${minerals}</strong> minerals</div>
    <div class="shopItem">
      <div><div class="itemName">Sell 10 Minerals</div><div style="font-size:11px;color:#aaa">Get 50 score</div></div>
      <div class="itemPrice">\u2B50 50</div>
      <button onclick="sellMinerals(10)" ${minerals < 10 ? 'disabled' : ''}>SELL</button>
    </div>
    <div class="shopItem">
      <div><div class="itemName">Sell 50 Minerals</div><div style="font-size:11px;color:#aaa">Get 260 score</div></div>
      <div class="itemPrice">\u2B50 260</div>
      <button onclick="sellMinerals(50)" ${minerals < 50 ? 'disabled' : ''}>SELL</button>
    </div>
    <div class="shopItem">
      <div><div class="itemName">Sell All</div><div style="font-size:11px;color:#aaa">Convert all minerals to score</div></div>
      <div class="itemPrice">\u2B50 varies</div>
      <button onclick="sellMinerals('all')" ${minerals <= 0 ? 'disabled' : ''}>SELL</button>
    </div>
  `;
}

window.sellMinerals = function(amount) {
  if (!gameWorld) return;
  if (!gameWorld.resources) gameWorld.resources = { minerals: 0, salvage: 0 };
  let minerals = gameWorld.resources.minerals || 0;
  if (amount === 'all') amount = minerals;
  amount = Math.min(amount, minerals);
  if (amount <= 0) return;
  // Price: 1 mineral = 5 score (with small bonus for bulk)
  let pricePer = 5;
  if (amount >= 50) pricePer = 5.2;
  const gained = Math.floor(amount * pricePer);
  gameWorld.resources.minerals -= amount;
  gameWorld.score += gained;
  updateMineralUI();
  updateHUD();
  showFloatingText(`Sold ${amount} minerals for ${gained} score`, 2500);
}

function ensurePlanetBaseShopUpgrades(planet) {
  if (!planet || !planet.npc || !Array.isArray(planet.npc.shop)) return;
  const extraItems = [
    { name: 'Base Refuel Service', type: 'base_refuel', price: 300, desc: 'Instant full fuel refill at your station' },
    { name: 'Base Crafting', type: 'base_craft', price: 450, desc: 'Convert salvage into modules and parts' },
    { name: 'Base Trading Contract', type: 'base_trade', price: 600, desc: 'Trade route payout from this planet base' },
    { name: 'Station Tier II', type: 'base_t2', price: 1400, desc: 'Upgrade station size/output. Requires Tier I base' },
    { name: 'Station Tier III', type: 'base_t3', price: 2600, desc: 'Upgrade station systems. Requires Tier II' },
    { name: 'Station Tier IV', type: 'base_t4', price: 4200, desc: 'Top-tier station with max support bonuses' },
    { name: 'Terraform Atmosphere', type: 'eng_atmosphere', price: 1200, desc: 'Add a breathable atmosphere layer and boost base efficiency' },
    { name: 'Move Moons', type: 'eng_move_moon', price: 1800, desc: 'Reposition moons into defensive mining orbits (up to 3)' },
    { name: 'Create Artificial Rings', type: 'eng_artificial_rings', price: 2200, desc: 'Build orbital ring infrastructure (up to 2)' },
    { name: 'Detonate Star (Controlled)', type: 'eng_detonate_star', price: 4500, desc: 'Massive nearby blast and score payout (one-time)' },
    { name: 'Build Dyson Swarm', type: 'eng_dyson_swarm', price: 5200, desc: 'Deploy solar collector swarm (+20 score/sec per tier, up to 3)' },
    { name: 'Found Civilization', type: 'civ_found', price: 1800, desc: 'Establish a new civilization from your base' },
    { name: 'Create Government', type: 'civ_government', price: 1400, desc: 'Advance government model and boost stability (up to 3)' },
    { name: 'Design Legal System', type: 'civ_legal', price: 1200, desc: 'Expand legal frameworks and local order (up to 4)' },
    { name: 'Build Economy', type: 'civ_economy', price: 1600, desc: 'Grow trade, industry, and output (up to 4)' },
    { name: 'Start War Campaign', type: 'civ_war', price: 2000, desc: 'Trigger a faction conflict wave near this world' },
    { name: 'Launch Invasion Fleet', type: 'civ_invasion', price: 2400, desc: 'Attack nearest rival civilization and attempt to claim territory' }
  ];
  extraItems.forEach(item => {
    if (!planet.npc.shop.some(existing => existing.type === item.type)) {
      planet.npc.shop.push(item);
    }
  });
}

// Open a planet-specific shop
window.openPlanetShop = function(shopObj, planetRef) {
  window._activePlanetShop = shopObj;
  window._activePlanetRef = planetRef;
  if (planetRef && planetRef.hasBase) ensurePlanetBaseShopUpgrades(planetRef);
  document.getElementById('shopOverlay').style.display = 'flex';
  shopOpen = true;
  updateShopUI();
};

window.buyItem = function(type, amount, cost) {
  if (!gameWorld) return;
  if (!gameWorld.satelliteTiers) gameWorld.satelliteTiers = { t1: 0, t2: 0, t3: 0 };
  if (!gameWorld.droneCounts) gameWorld.droneCounts = { combat: 0, harvester: 0 };
  ensureMarketState();
  const planet = window._activePlanetRef || null;
  const engineering = planet && planet.engineering ? planet.engineering : null;
  const civ = planet && planet.civilization ? planet.civilization : null;
  const effectiveCost = getDynamicShopCost(cost, type);

  if (type === 'satellite_t2' && (gameWorld.satelliteTiers.t1 || 0) < 1) {
    showFloatingText('Requires at least 1 Satellite T1', 1800);
    return;
  }
  if (type === 'satellite_t3' && (gameWorld.satelliteTiers.t2 || 0) < 1) {
    showFloatingText('Requires at least 1 Satellite T2', 1800);
    return;
  }
  if (type === 'faction_war' && gameWorld.factionWarMode) {
    showFloatingText('Faction War mode already active', 1700);
    return;
  }
  if (type === 'base_t2' && (!planet || !planet.hasBase || (planet.baseLevel || 0) < 1 || (planet.baseLevel || 0) >= 2)) {
    showFloatingText('Requires base tier I and not already upgraded', 1900);
    return;
  }
  if (type === 'base_t3' && (!planet || !planet.hasBase || (planet.baseLevel || 0) < 2 || (planet.baseLevel || 0) >= 3)) {
    showFloatingText('Requires station tier II', 1800);
    return;
  }
  if (type === 'base_t4' && (!planet || !planet.hasBase || (planet.baseLevel || 0) < 3 || (planet.baseLevel || 0) >= 4)) {
    showFloatingText('Requires station tier III', 1800);
    return;
  }
  if ((type === 'terraform' || (type && type.startsWith('eng_'))) && (!planet || !planet.hasBase)) {
    showFloatingText('Build a base first', 1700);
    return;
  }
  if (type && type.startsWith('civ_') && (!planet || !planet.hasBase)) {
    showFloatingText('Build a base first', 1700);
    return;
  }
  if ((type === 'terraform' || type === 'eng_atmosphere') && planet && planet.terraformed) {
    showFloatingText('Planet already terraformed', 1600);
    return;
  }
  if (type === 'eng_move_moon' && engineering && (engineering.movedMoons || 0) >= 3) {
    showFloatingText('Moon relocation is already maxed', 1800);
    return;
  }
  if (type === 'eng_artificial_rings' && engineering && (engineering.artificialRings || 0) >= 2) {
    showFloatingText('Artificial rings are already maxed', 1800);
    return;
  }
  if (type === 'eng_detonate_star' && engineering && (engineering.starDetonated || 0) >= 1) {
    showFloatingText('Stellar detonation already completed', 1800);
    return;
  }
  if (type === 'eng_dyson_swarm' && engineering && (engineering.dysonSwarms || 0) >= 3) {
    showFloatingText('Dyson swarm is already max tier', 1800);
    return;
  }
  if (type === 'civ_found' && civ && civ.founded) {
    showFloatingText('Civilization already founded here', 1800);
    return;
  }
  if ((type === 'civ_government' || type === 'civ_legal' || type === 'civ_economy' || type === 'civ_war' || type === 'civ_invasion') && civ && !civ.founded) {
    showFloatingText('Found a civilization first', 1800);
    return;
  }
  if ((type === 'civ_government' || type === 'civ_legal' || type === 'civ_economy' || type === 'civ_war' || type === 'civ_invasion') && civ && civ.founded && civ.owner !== 'player') {
    showFloatingText('You can only manage player-owned civilizations', 1900);
    return;
  }
  if (type === 'civ_government' && civ && (civ.governmentLevel || 0) >= 3) {
    showFloatingText('Government already at max level', 1800);
    return;
  }
  if (type === 'civ_legal' && civ && (civ.legalLevel || 0) >= 4) {
    showFloatingText('Legal system already at max tier', 1800);
    return;
  }
  if (type === 'civ_economy' && civ && (civ.economyTier || 0) >= 4) {
    showFloatingText('Economy already at max tier', 1800);
    return;
  }
  if (type === 'civ_war' && civ && civ.lastWarAt && (Date.now() - civ.lastWarAt < 28000)) {
    showFloatingText('War campaign is cooling down', 1800);
    return;
  }
  if (type === 'civ_invasion' && (!gameWorld.findRivalCivilizedPlanet('player', planet))) {
    showFloatingText('No rival civilization available to invade', 1900);
    return;
  }

  if (gameWorld.score < effectiveCost) {
    showFloatingText('Not enough score!', 1800);
    return;
  }
  
  gameWorld.score -= effectiveCost;
  if (type === 'ammo') {
    gameWorld.ship.ammo += amount;
  } else if (type === 'fuel') {
    gameWorld.ship.fuel = Math.min(gameWorld.ship.maxFuel, gameWorld.ship.fuel + amount);
  } else if (type === 'shield') {
    gameWorld.ship.shieldHealth = Math.min(gameWorld.ship.maxShield, gameWorld.ship.shieldHealth + amount);
  } else if (type === 'health') {
    gameWorld.ship.health = Math.min(gameWorld.ship.maxHealth, gameWorld.ship.health + amount);
  } else if (type === 'stage') {
    const stageCount = gameWorld.ship.addRocketStage();
    showFloatingText(`Stage installed. Total extra stages: ${stageCount} (press Z to separate)`, 2200);
  } else if (type === 'satellite' || type === 'satellite_t1') {
    gameWorld.satelliteTiers.t1 = (gameWorld.satelliteTiers.t1 || 0) + 1;
    gameWorld.satellites = (gameWorld.satellites || 0) + 1;
    showFloatingText('Satellite T1 deployed: +2 score/sec', 2000);
  } else if (type === 'satellite_t2') {
    gameWorld.satelliteTiers.t2 = (gameWorld.satelliteTiers.t2 || 0) + 1;
    gameWorld.satellites = (gameWorld.satellites || 0) + 1;
    showFloatingText('Satellite T2 deployed: +6 score/sec', 2000);
  } else if (type === 'satellite_t3') {
    gameWorld.satelliteTiers.t3 = (gameWorld.satelliteTiers.t3 || 0) + 1;
    gameWorld.satellites = (gameWorld.satellites || 0) + 1;
    showFloatingText('Satellite T3 deployed: +14 score/sec', 2000);
  } else if (type === 'drone_combat') {
    gameWorld.droneCounts.combat = (gameWorld.droneCounts.combat || 0) + 1;
    if (typeof gameWorld.spawnHelperBot === 'function') gameWorld.spawnHelperBot('combat', 'player');
    showFloatingText('Combat drone deployed', 1800);
  } else if (type === 'drone_harvester') {
    gameWorld.droneCounts.harvester = (gameWorld.droneCounts.harvester || 0) + 1;
    if (typeof gameWorld.spawnHelperBot === 'function') gameWorld.spawnHelperBot('harvester', 'player');
    showFloatingText('Harvester drone deployed', 1800);
  } else if (type === 'faction_war') {
    gameWorld.factionWarMode = true;
    gameWorld._lastFactionBotSpawn = Date.now() - 9000;
    if (typeof gameWorld.spawnHelperBot === 'function') gameWorld.spawnHelperBot('faction', 'faction');
    showFloatingText('Faction War protocol activated', 2200);
  } else if (type === 'base') {
    if (!planet) {
      showFloatingText('Cannot form base: no planet context', 1800);
    } else {
      if (!planet.hasBase) {
        planet.hasBase = true;
        planet.baseLevel = 1;
        if (typeof planet.buildBase === 'function') planet.buildBase(1);
        ensurePlanetBaseShopUpgrades(planet);
        gameWorld.upgradePoints += 200;
        showFloatingText('Base established! Station online. +200 upgrade pts', 2600);
      } else {
        gameWorld.score += effectiveCost;
        showFloatingText('Base already established here.', 1600);
      }
    }
  } else if (type === 'base_t2' || type === 'base_t3' || type === 'base_t4') {
    const targetTier = type === 'base_t2' ? 2 : type === 'base_t3' ? 3 : 4;
    planet.baseLevel = Math.max(planet.baseLevel || 1, targetTier);
    if (typeof planet.buildBase === 'function') planet.buildBase(planet.baseLevel);
    gameWorld.upgradePoints += 100 + targetTier * 45;
    showFloatingText(`Station upgraded to Tier ${targetTier}`, 2200);
  } else if (type === 'base_refuel') {
    if (!planet || !planet.hasBase) {
      showFloatingText('Requires a base on this planet', 1700);
      gameWorld.score += effectiveCost;
      return;
    }
    gameWorld.ship.fuel = gameWorld.ship.maxFuel;
    gameWorld.ship.shieldHealth = Math.min(gameWorld.ship.maxShield, gameWorld.ship.shieldHealth + 25);
    showFloatingText('Base refuel complete', 1800);
  } else if (type === 'base_craft') {
    if (!planet || !planet.hasBase) {
      showFloatingText('Requires a base on this planet', 1700);
      gameWorld.score += effectiveCost;
      return;
    }
    const salvage = gameWorld.resources ? (gameWorld.resources.salvage || 0) : 0;
    if (salvage < 10) {
      showFloatingText('Need 10 salvage to craft', 1700);
      gameWorld.score += effectiveCost;
      return;
    }
    gameWorld.resources.salvage -= 10;
    gameWorld.resources.minerals += 25;
    gameWorld.ship.ammo += 120;
    showFloatingText('Crafted supplies: +25 minerals, +120 ammo', 2100);
  } else if (type === 'base_trade') {
    if (!planet || !planet.hasBase) {
      showFloatingText('Requires a base on this planet', 1700);
      gameWorld.score += effectiveCost;
      return;
    }
    const lvl = planet.baseLevel || 1;
    const payout = 250 + lvl * 180 + Math.floor(Math.random() * 120);
    gameWorld.score += payout;
    showFloatingText(`Trade route returned +${payout} score`, 1900);
  } else if (type === 'terraform' || type === 'eng_atmosphere') {
    planet.terraformed = true;
    if (planet.engineering) planet.engineering.atmosphere = 1;
    planet.baseLevel = Math.max(2, (planet.baseLevel || 1) + 1);
    if (typeof planet.buildBase === 'function') planet.buildBase(planet.baseLevel);
    if (planet.mesh && planet.mesh.children && planet.mesh.children.length) {
      const pmesh = planet.mesh.children[0];
      if (pmesh && pmesh.material && pmesh.material.color) pmesh.material.color.offsetHSL(0.08, 0.08, 0.08);
    }
    if (typeof planet.ensureAtmosphereShell === 'function') planet.ensureAtmosphereShell();
    gameWorld.upgradePoints += 150;
    showFloatingText('Atmosphere terraformed: base output increased', 2300);
  } else if (type === 'eng_move_moon') {
    planet.engineering.movedMoons = (planet.engineering.movedMoons || 0) + 1;
    if (typeof planet.ensureMoons === 'function') planet.ensureMoons(planet.engineering.movedMoons);
    gameWorld.ship.maxShield += 10;
    gameWorld.ship.shieldHealth = Math.min(gameWorld.ship.maxShield, gameWorld.ship.shieldHealth + 18);
    showFloatingText('Moons repositioned into orbital paths', 2200);
  } else if (type === 'eng_artificial_rings') {
    planet.engineering.artificialRings = Math.min(2, (planet.engineering.artificialRings || 0) + 1);
    if (typeof planet.ensureArtificialRing === 'function') planet.ensureArtificialRing(planet.engineering.artificialRings);
    gameWorld.ship.maxFuel += 10;
    showFloatingText('Artificial ring infrastructure online', 2200);
  } else if (type === 'eng_detonate_star') {
    planet.engineering.starDetonated = 1;
    const destroyed = typeof planet.triggerStellarDetonation === 'function' ? planet.triggerStellarDetonation(gameWorld) : 0;
    const payout = 1000 + destroyed * 120;
    gameWorld.score += payout;
    showFloatingText(`Stellar detonation: ${destroyed} hostiles destroyed, +${payout} score`, 2600);
  } else if (type === 'eng_dyson_swarm') {
    planet.engineering.dysonSwarms = Math.min(3, (planet.engineering.dysonSwarms || 0) + 1);
    if (typeof planet.ensureDysonSwarm === 'function') planet.ensureDysonSwarm(planet.engineering.dysonSwarms);
    showFloatingText('Dyson swarm tier deployed: +20 score/sec', 2200);
  } else if (type === 'civ_found') {
    const prefix = ['Nova', 'Helio', 'Astra', 'Orion', 'Lumen', 'Vega', 'Kepler'];
    const suffix = ['Union', 'Collective', 'Republic', 'Dynasty', 'Federation', 'Order', 'Dominion'];
    planet.civilization.founded = true;
    planet.civilization.name = `${prefix[Math.floor(Math.random() * prefix.length)]} ${suffix[Math.floor(Math.random() * suffix.length)]}`;
    planet.civilization.owner = 'player';
    planet.civilization.government = 'Transitional Council';
    planet.civilization.governmentLevel = 1;
    planet.civilization.legalLevel = 1;
    planet.civilization.economyTier = 1;
    planet.civilization.civScore = 900;
    planet.civilization.territories = 1;
    planet.civilization.defenseRating = 1.15;
    planet.civilization.destroyed = false;
    planet.civilization.population = 12000 + Math.floor(Math.random() * 18000);
    planet.civilization.stability = 58;
    if (typeof planet.ensureCivilizationBeacon === 'function') planet.ensureCivilizationBeacon();
    gameWorld.score += 250;
    gameWorld.upgradePoints += 70;
    if (typeof gameWorld.logEvent === 'function') gameWorld.logEvent(`Civilization founded on ${planet.name}: ${planet.civilization.name}`);
    showFloatingText(`Civilization founded: ${planet.civilization.name}`, 2500);
  } else if (type === 'civ_government') {
    const govTrack = ['Transitional Council', 'Technocracy', 'Federal Senate', 'Interstellar Commonwealth'];
    planet.civilization.governmentLevel = Math.min(3, (planet.civilization.governmentLevel || 0) + 1);
    planet.civilization.government = govTrack[planet.civilization.governmentLevel] || govTrack[govTrack.length - 1];
    planet.civilization.stability = Math.min(100, (planet.civilization.stability || 50) + 8);
    planet.civilization.civScore = Math.max(0, (planet.civilization.civScore || 0) + 220);
    gameWorld.upgradePoints += 45;
    if (typeof gameWorld.logEvent === 'function') gameWorld.logEvent(`${planet.civilization.name} adopted ${planet.civilization.government}`);
    showFloatingText(`Government advanced: ${planet.civilization.government}`, 2300);
  } else if (type === 'civ_legal') {
    planet.civilization.legalLevel = Math.min(4, (planet.civilization.legalLevel || 0) + 1);
    planet.civilization.stability = Math.min(100, (planet.civilization.stability || 50) + 6);
    planet.civilization.civScore = Math.max(0, (planet.civilization.civScore || 0) + 170);
    gameWorld.ship.maxShield += 6;
    gameWorld.ship.shieldHealth = Math.min(gameWorld.ship.maxShield, gameWorld.ship.shieldHealth + 10);
    if (typeof gameWorld.logEvent === 'function') gameWorld.logEvent(`${planet.civilization.name} legal system expanded to tier ${planet.civilization.legalLevel}`);
    showFloatingText(`Legal system tier ${planet.civilization.legalLevel} established`, 2200);
  } else if (type === 'civ_economy') {
    planet.civilization.economyTier = Math.min(4, (planet.civilization.economyTier || 0) + 1);
    planet.civilization.population += 6000 + Math.floor(Math.random() * 5000);
    planet.civilization.stability = Math.min(100, (planet.civilization.stability || 50) + 5);
    planet.civilization.civScore = Math.max(0, (planet.civilization.civScore || 0) + 280);
    if (!gameWorld.resources) gameWorld.resources = { minerals: 0, salvage: 0 };
    gameWorld.resources.minerals += 20 * planet.civilization.economyTier;
    gameWorld.resources.salvage += 8 * planet.civilization.economyTier;
    if (typeof gameWorld.logEvent === 'function') gameWorld.logEvent(`${planet.civilization.name} economy reached tier ${planet.civilization.economyTier}`);
    showFloatingText(`Economy upgraded to tier ${planet.civilization.economyTier}`, 2200);
  } else if (type === 'civ_war') {
    planet.civilization.atWar = true;
    planet.civilization.lastWarAt = Date.now();
    planet.civilization.warEndsAt = Date.now() + 52000;
    planet.civilization.lastWarWaveAt = 0;
    const waveSize = 5 + (planet.civilization.governmentLevel || 1);
    for (let i = 0; i < waveSize; i++) {
      const pos = planet.position.clone().add(new THREE.Vector3(
        THREE.MathUtils.randFloat(-220, 220),
        THREE.MathUtils.randFloat(-90, 90),
        THREE.MathUtils.randFloat(-220, 220)
      ));
      gameWorld.enemies.push(new EnemyBot(gameWorld.scene, pos, Math.random() < 0.5 ? 'standard' : 'fast'));
    }
    planet.civilization.stability = Math.max(18, (planet.civilization.stability || 50) - 12);
    if (typeof gameWorld.logEvent === 'function') gameWorld.logEvent(`War campaign launched by ${planet.civilization.name}`);
    showFloatingText(`War campaign started: hostile wave x${waveSize}`, 2500);
  } else if (type === 'civ_invasion') {
    const target = gameWorld.findRivalCivilizedPlanet('player', planet);
    if (!target) {
      gameWorld.score += effectiveCost;
      showFloatingText('No rival territory detected', 1700);
      return;
    }
    const success = gameWorld.resolveCivAssault('player', target, 1.2, true);
    if (success) {
      planet.civilization.civScore = Math.max(0, (planet.civilization.civScore || 0) + 380);
      if (typeof gameWorld.logEvent === 'function') gameWorld.logEvent(`Invasion success: ${target.name} is now under player influence`);
      showFloatingText(`Invasion success at ${target.name}`, 2400);
    } else {
      planet.civilization.stability = Math.max(10, (planet.civilization.stability || 50) - 4);
      if (typeof gameWorld.logEvent === 'function') gameWorld.logEvent(`Invasion failed near ${target.name}`);
      showFloatingText(`Invasion repelled by ${target.name}`, 2200);
    }
  }
  gameWorld.purchaseCounts[type] = (gameWorld.purchaseCounts[type] || 0) + 1;
  
  updateShopUI();
  updateHUD();
};

window.buySkin = function(skinId, cost) {
  if (!gameWorld) return;
  const effectiveCost = getDynamicSkinCost(cost, skinId);
  if (gameWorld.score < effectiveCost) {
    showFloatingText('Not enough score!', 1600);
    return;
  }
  
  // Check if already owned
  if (localStorage.getItem(`skin_${skinId}`) === 'true') {
    showFloatingText('You already own this skin!', 1600);
    return;
  }
  
  gameWorld.score -= effectiveCost;
  localStorage.setItem(`skin_${skinId}`, 'true');
  localStorage.setItem('currentSkin', skinId);
  
  // Apply skin immediately
  applySkin(skinId);
  
  updateShopUI();
  updateHUD();
  showFloatingText('Skin purchased and applied!', 1600);
};

function applySkin(skinId) {
  if (!gameWorld) return;
  const skin = getProfessionalSkin(skinId);

  // Scene mood pass: background + fog tint + sunlight tint.
  if (skin.scene) {
    // Keep deep space fully black regardless of selected skin.
    if (scene && scene.background) scene.background = new THREE.Color(0x000000);
    if (typeof sunLight !== 'undefined' && sunLight && sunLight.color) {
      sunLight.color.setHex(skin.scene.sun);
    }
  }

  if (gameWorld.ship && gameWorld.ship.mesh) styleObjectTheme(gameWorld.ship.mesh, 'player', skinId);
  if (gameWorld.enemies && gameWorld.enemies.length) gameWorld.enemies.forEach(e => styleObjectTheme(e.mesh, 'enemy', skinId));
  if (gameWorld.megaShip && gameWorld.megaShip.mesh) styleObjectTheme(gameWorld.megaShip.mesh, 'mega', skinId);
  if (gameWorld.planets && gameWorld.planets.length) gameWorld.planets.forEach(p => stylePlanetTheme(p, skinId));
  if (gameWorld.colossalDerelicts && gameWorld.colossalDerelicts.length) {
    gameWorld.colossalDerelicts.forEach(cd => {
      styleObjectTheme(cd.group, 'colossal', skinId);
      styleObjectTheme(cd.outerPortal, 'portal', skinId);
      styleObjectTheme(cd.interiorGroup, 'interior', skinId);
    });
  }
}

// ===================== MISSIONS & UPGRADES =====================
function updateMissionsUI() {
  if (!gameWorld) return;
  const missionList = document.getElementById('missionList');
  missionList.innerHTML = gameWorld.missions.map((m, i) => `
    <div class="mission-item">
      <div class="mission-title">${m.description}</div>
      <div class="mission-progress">Progress: ${m.current}/${m.target} (${m.getProgress()}%)</div>
      <div class="mission-reward">${m.completed ? ' COMPLETE +' + m.reward + ' pts' : ''}</div>
    </div>
  `).join('');
}

function updateUpgradesUI() {
  if (!gameWorld) return;
  const upgradeList = document.getElementById('upgradeList');
  document.getElementById('upgradePoints').textContent = gameWorld.upgradePoints;
  
  // Build DOM nodes and attach capture-phase pointer handlers so clicks register
  upgradeList.innerHTML = '';
  Object.entries(UPGRADES).forEach(([key, cfg]) => {
    const owned = gameWorld.upgrades[key] || 0;
    const currentCost = getUpgradeCost(cfg, owned);
    const maxed = owned >= cfg.max;
    const canAfford = gameWorld.upgradePoints >= currentCost && !maxed;

    const item = document.createElement('div');
    item.className = 'upgrade-item';
    item.dataset.key = key;
    item.style.cursor = canAfford ? 'pointer' : 'default';
    if (canAfford) {
      item.style.background = 'rgba(0,255,0,0.1)';
      item.style.borderLeft = '3px solid #00ff00';
    }

    const nameSpan = document.createElement('span');
    nameSpan.className = 'upgrade-name';
    nameSpan.textContent = `${cfg.icon} ${cfg.name}`;

    const levelSpan = document.createElement('span');
    levelSpan.className = 'upgrade-level';
    levelSpan.textContent = `${owned}/${cfg.max}`;

    const costSpan = document.createElement('span');
    costSpan.className = 'upgrade-cost';
    costSpan.textContent = maxed ? 'MAX' : currentCost + 'P';

    item.appendChild(nameSpan);
    item.appendChild(levelSpan);
    item.appendChild(costSpan);

    // Use capture-phase pointerdown so UI receives input before any game-level handlers
    item.addEventListener('pointerdown', (e) => {
      e.stopPropagation();
      e.preventDefault();
      if (canAfford) buyUpgrade(key);
    }, { capture: true });

    upgradeList.appendChild(item);
  });
}

window.buyUpgrade = function(type) {
  console.log('buyUpgrade called with type:', type);
  if (!gameWorld) { if (window.showFloatingText) showFloatingText('No active game', 1500); return; }
  const cfg = UPGRADES[type];
  if (!cfg) { if (window.showFloatingText) showFloatingText('Unknown upgrade', 1500); return; }
  const owned = gameWorld.upgrades[type] || 0;
  const currentCost = getUpgradeCost(cfg, owned);
  if (owned >= cfg.max) { if (window.showFloatingText) showFloatingText('Upgrade already maxed', 1500); return; }
  if (gameWorld.upgradePoints < currentCost) { if (window.showFloatingText) showFloatingText('Not enough upgrade points', 1500); return; }

  gameWorld.upgradePoints -= currentCost;
  gameWorld.upgrades[type] = owned + 1;

  const level = gameWorld.upgrades[type];

  if (cfg.stat === 'maxSpeed' && gameWorld.ship) gameWorld.ship.maxSpeed *= cfg.multiplier;
  if (cfg.stat === 'maxHealth' && gameWorld.ship) gameWorld.ship.maxHealth = Math.floor(gameWorld.ship.maxHealth * cfg.multiplier);
  if (cfg.stat === 'maxFuel' && gameWorld.ship) gameWorld.ship.maxFuel *= cfg.multiplier;
  if (cfg.stat === 'weaponDamage' && gameWorld.ship && gameWorld.ship.weaponConfig) gameWorld.ship.weaponConfig.damage = Math.floor(gameWorld.ship.weaponConfig.damage * cfg.multiplier);
  if (cfg.stat === 'shieldRegen' && gameWorld.ship) gameWorld.ship.shieldRegenRate = (gameWorld.ship.shieldRegenRate || 0.1) * cfg.multiplier;

  updateUpgradesUI();
  updateHUD();
  if (window.playSound) playSound('pickup');
  if (window.showFloatingText) showFloatingText(cfg.name + ' +' + level, 1800);
};

window.openUpgrades = function() {
  const panel = document.getElementById('upgradePanel');

  const isOpen = panel.style.display !== 'none';

  if (isOpen) {
    panel.style.display = 'none';
    panel.style.pointerEvents = 'none';
  } else {
    panel.style.display = 'block';
    panel.style.pointerEvents = 'auto';
    updateUpgradesUI();
  }
};

window.toggleHUD = function() {
  const hudContent = document.getElementById('hudContent');
  hudContent.style.display = hudContent.style.display === 'none' ? 'block' : 'none';
};

// ===================== TUTORIAL SYSTEM =====================
let tutorialStep = 0;
let tutorialOpenedInGame = false;

const tutorials = [
  {
    npc: 'Commander Astra',
    title: 'Welcome to Starfall',
    text: 'Pilot, I am Commander Astra. I will guide you through combat, survival, and progression systems.',
    controls: 'Follow each step and use these tips in real missions.'
  },
  {
    npc: 'Commander Astra',
    title: 'Movement Controls',
    text: 'Master your ship first. W/S control forward/backward thrust, A/D control lateral movement, and SPACE/SHIFT move vertically.',
    controls: 'W/S: Forward/Back | A/D: Left/Right | SPACE: Up | SHIFT: Down'
  },
  {
    npc: 'Commander Astra',
    title: 'Combat Basics',
    text: 'Keep pressure on enemy swarms. Your weapons now fire faster, and quick reload keeps your ammo high.',
    controls: 'Press 1 to FIRE | Press Q to RELOAD quickly'
  },
  {
    npc: 'Commander Astra',
    title: 'Landing & Resources',
    text: 'Planets provide safe landing zones for refueling and repairs. Land by approaching slowly and pressing R.',
    controls: 'Press R to LAND / TAKEOFF'
  },
  {
    npc: 'Commander Astra',
    title: 'Missions & Objectives',
    text: 'Complete missions to earn upgrade points. New missions appear endlessly.',
    controls: 'Check MISSIONS panel (top-right)'
  },
  {
    npc: 'Commander Astra',
    title: 'Upgrades & Shop',
    text: 'Upgrade your ship stats and buy supplies in the shop.',
    controls: 'UPGRADES | SHOP'
  },
  {
    npc: 'Commander Astra',
    title: 'HUD & Minimap',
    text: 'HUD shows vital info. Minimap shows nearby planets and enemies.',
    controls: 'Use the HUD toggle any time'
  },
  {
    npc: 'Commander Astra',
    title: 'Advanced Combat',
    text: 'Enemies may attach and drain health. Shake them off by moving fast.',
    controls: 'Move erratically when enemies latch on'
  },
  {
    npc: 'Commander Astra',
    title: 'Survival Tips',
    text: 'Rocket stage fuel boosts are temporary. Use boosted fuel aggressively before it expires.',
    controls: 'P: Pause | E: Interact | Z: Separate Stage'
  },
  {
    npc: 'Commander Astra',
    title: 'Begin Mission',
    text: 'You are mission-ready. AI raids start small but scale in size and danger as you survive longer.',
    controls: 'Finish this tutorial and launch.'
  }
];

function hasCompletedTutorialOnce() {
  try { return localStorage.getItem(TUTORIAL_COMPLETED_KEY) === '1'; } catch (e) { return false; }
}

function updateTutorialButtons(step) {
  const skipBtn = document.getElementById('tutorialSkipBtn');
  const nextBtn = document.querySelector('#tutorialOverlay .tutorial-btn');
  if (skipBtn) skipBtn.style.display = hasCompletedTutorialOnce() ? 'inline-block' : 'none';
  if (nextBtn) nextBtn.textContent = step >= tutorials.length - 1 ? 'Finish Mission Briefing' : 'Next ->';
}

function syncTutorialProgressLabel(currentStep = tutorialStep) {
  const progressEl = document.getElementById('tutorialProgress');
  if (!progressEl) return;
  const current = Math.min(tutorials.length, Math.max(1, currentStep + 1));
  progressEl.textContent = `Step ${current}/${tutorials.length}`;
}

function showTutorialStep(step) {
  const t = tutorials[step];
  if (!t) return;
  tutorialStep = step;
  const npcEl = document.getElementById('tutorialNpcName');
  if (npcEl) npcEl.textContent = t.npc || 'Commander Astra';
  syncTutorialProgressLabel(step);
  document.getElementById('tutorialTitle').textContent = t.title;
  document.getElementById('tutorialText').textContent = t.text;
  document.getElementById('tutorialControls').textContent = t.controls;
  updateTutorialButtons(step);
}

window.nextTutorial = function() {
  tutorialStep++;
  if (tutorialStep >= tutorials.length) {
    closeTutorial(true);
  } else {
    showTutorialStep(tutorialStep);
  }
};

window.skipTutorial = function() {
  if (!hasCompletedTutorialOnce()) {
    showFloatingText('Finish tutorial once to unlock Skip', 1700);
    return;
  }
  closeTutorial(false);
};

function closeTutorial(markCompleted = false) {
  if (markCompleted) {
    try { localStorage.setItem(TUTORIAL_COMPLETED_KEY, '1'); } catch (e) {}
  }
  const overlay = document.getElementById('tutorialOverlay');
  overlay.style.display = 'none';
  overlay.style.pointerEvents = 'none';
  if (tutorialOpenedInGame && gameStarted && !gameOver) paused = false;
  tutorialOpenedInGame = false;
}

function startTutorialSequence() {
  tutorialStep = 0;
  tutorialOpenedInGame = !!gameStarted;
  const overlay = document.getElementById('tutorialOverlay');
  overlay.style.display = 'flex';
  overlay.style.pointerEvents = 'auto';
  if (tutorialOpenedInGame && !gameOver) paused = true;
  showTutorialStep(tutorialStep);
}

window.addEventListener('load', () => {
  initSettingsBar();
  updateStartButtonState();
  syncTutorialProgressLabel();
  closeTutorial(false);
});


window.startGame = function() {
  if (!isShipBuilderComplete()) {
    showFloatingText('Select all ship builder options first', 1700);
    updateStartButtonState();
    return;
  }
  stopBackgroundMusic();
  unlockAudio();
  ensureJournalUI();
  ensureCockpitUI();
  ensureLeaderboardUI();
  cameraMode = 'chase';
  journalOpen = false;
  const jp = document.getElementById('journalPanel');
  if (jp) jp.style.display = 'none';
  document.getElementById('shipBuilder').style.display = 'none';
  document.getElementById('gameOverOverlay').style.display = 'none';
  document.getElementById('shopButton').style.display = 'block';
  document.getElementById('upgradeButton').style.display = 'block';
  document.getElementById('mineralButton').style.display = 'block';
  document.getElementById('inventoryButton').style.display = 'block';
  document.getElementById('craftingButton').style.display = 'block';
  document.getElementById('moduleButton').style.display = 'block';
  document.getElementById('techButton').style.display = 'block';
  document.getElementById('missionPanel').style.display = 'block';
  const upgradePanelEl = document.getElementById('upgradePanel');
  upgradePanelEl.style.display = 'none';
  upgradePanelEl.style.pointerEvents = 'none';
  updateUpgradesUI();
  updateMissionsUI();
  
  gameStarted = true;
  gameOver = false;
  sessionEndedByDeath = false;
  
  const bodyConfig = shipConfigs.body[shipChoice.body];
  const tankConfig = shipConfigs.tank[shipChoice.tank];
  const engineConfig = shipConfigs.engine[shipChoice.engine];
  
  const finalConfig = {
    ...bodyConfig,
    ...tankConfig,
    weapon: engineConfig,
    scale: bodyConfig.scale,
    bodyType: shipChoice.body,
    tankType: shipChoice.tank,
    engineType: shipChoice.engine
  };
  // Apply ship class modifiers
  const cls = shipChoice.shipClass;
  if (shipClasses[cls]) {
    finalConfig.health = Math.floor(finalConfig.health * (shipClasses[cls].healthMul || 1));
    finalConfig.maxSpeed = finalConfig.maxSpeed * (shipClasses[cls].speedMul || 1);
    // Drone carrier placeholder
    if (cls === 'drone') finalConfig.hasDroneBay = true;
  }
  
  const savedProgress = loadProgressData();
  const diedLastSession = !!(savedProgress && savedProgress.lastSessionEndedByDeath);
  const canResumeFromCheckpoint = !!(savedProgress && savedProgress.resumeAllowed && !diedLastSession);
  const canLoadProgress = !!(savedProgress && !diedLastSession);

  gameWorld = new GameWorld(scene);
  // Expose module-scoped gameWorld to non-module scripts (overlays expect window.gameWorld)
  window.gameWorld = gameWorld;
  gameWorld.initializeShip(finalConfig);
  applyLiveGameplaySettings();
  gameWorld.generateInitialPlanets();
  if (canLoadProgress) {
    applyLoadedProgress(savedProgress, { restoreCheckpoint: canResumeFromCheckpoint });
  }
  gameWorld.generateMissions();
  if (canResumeFromCheckpoint) {
    gameWorld.logEvent('Mission resumed from last checkpoint');
  } else if (diedLastSession) {
    showFloatingText('Previous run ended in death. Starting fresh.', 2200);
    gameWorld.logEvent('New mission launched after loss');
  } else {
    gameWorld.logEvent('Mission launched');
  }
  applySkin(localStorage.getItem('currentSkin') || 'neon_blue');
  startBackgroundMusic();
  
  // Spawn initial enemies everywhere around the ship
  for (let i = 0; i < 5; i++) {
    const pos = gameWorld.ship.position.clone().add(new THREE.Vector3(
      THREE.MathUtils.randFloat(-800, 800),
      THREE.MathUtils.randFloat(-300, 300),
      THREE.MathUtils.randFloat(-800, 800)
    ));
    const type = 'standard';
    gameWorld.enemies.push(new EnemyBot(scene, pos, type));
  }
  gameWorld.missionStartTime = Date.now();
  gameWorld.gameStartTime = Date.now();
  gameWorld.megaShip = null;
  gameWorld.megaShipSpawned = false;
  startTutorialSequence();
}

function handleInteractAction() {
  if (!gameStarted || !gameWorld || !gameWorld.ship) return;
  if (gameWorld.tryInteractSpecial && gameWorld.tryInteractSpecial()) return;
  if (gameWorld.ship.landed) {
    if (gameWorld.ship.landedPlanet && gameWorld.ship.landedPlanet.npc) {
      openPlanetShop(gameWorld.ship.landedPlanet.npc, gameWorld.ship.landedPlanet);
    } else if (gameWorld.ship.landedPlanet) {
      gameWorld.ship.landedPlanet.interact();
    }
  }
}

// ===================== INPUT HANDLING =====================
window.addEventListener('pointerdown', unlockAudio, { passive: true });
window.addEventListener('touchstart', unlockAudio, { passive: true });

document.addEventListener("keydown", e => {
  if (gameOver) return; // Freeze controls during game over
  unlockAudio();
  
  keys[e.code] = true;
  
  if (gameStarted && e.code === "Digit1") {
    gameWorld.firePlayerWeapon();
  }
  if (gameStarted && e.code === "KeyQ" && !e.repeat && gameWorld && gameWorld.ship) {
    if (gameWorld.ship.reloadAmmo()) {
      showFloatingText(`Reloaded: ${gameWorld.ship.ammo}/${gameWorld.ship.maxAmmo}`, 900);
      playSound('pickup');
    } else if (gameWorld.ship.reloadCooldown > 0) {
      showFloatingText('Reload cooling down', 700);
    }
  }
  if (gameStarted && e.code === "KeyZ" && !e.repeat) {
    if (gameWorld && gameWorld.ship && gameWorld.ship.separateStage()) {
      if (window.playSound) playSound('achievement');
      showFloatingText(`Stage separated! Remaining stages: ${gameWorld.ship.extraStages}`, 1700);
    } else {
      showFloatingText('No extra stages to separate', 1000);
    }
  }
  if (gameStarted && e.code === "KeyE") {
    handleInteractAction();
  }
  if (gameStarted && e.code === "KeyP") {
    paused = !paused;
    document.getElementById('pauseOverlay').style.display = paused ? 'flex' : 'none';
  }
  if (gameStarted && e.code === "KeyC") {
    cameraMode = cameraMode === 'chase' ? 'cockpit' : 'chase';
    if (gameWorld && gameWorld.logEvent) gameWorld.logEvent(`Camera mode: ${cameraMode}`);
  }
  if (gameStarted && e.code === "KeyJ") {
    journalOpen = !journalOpen;
    const panel = document.getElementById('journalPanel');
    if (panel) panel.style.display = journalOpen ? 'block' : 'none';
    if (window.updateJournalUI) window.updateJournalUI();
  }
});
document.addEventListener("keyup", e => keys[e.code] = false);

// Mouse move for flight tilt
document.addEventListener("mousemove", e => {
  if (gameStarted && !gameOver) {
    mouseX = (e.clientX / window.innerWidth) * 2 - 1;
    mouseY = (e.clientY / window.innerHeight) * 2 - 1;
  }
});

// ===================== MOBILE CONTROLS =====================
let mobileAttackInterval = null;

function isElementVisible(id) {
  const el = document.getElementById(id);
  if (!el) return false;
  const style = window.getComputedStyle(el);
  return style.display !== 'none' && style.visibility !== 'hidden';
}

function updateTouchControlsVisibility() {
  const touchUI = document.getElementById('touchControls');
  if (!touchUI) return;

  const hideForUI = (
    isElementVisible('shipBuilder') ||
    isElementVisible('shopOverlay') ||
    isElementVisible('mineralOverlay') ||
    isElementVisible('inventoryOverlay') ||
    isElementVisible('craftingOverlay') ||
    isElementVisible('upgradePanel') ||
    isElementVisible('moduleOverlay') ||
    isElementVisible('techOverlay') ||
    isElementVisible('tutorialOverlay') ||
    isElementVisible('pauseOverlay') ||
    isElementVisible('gameOverOverlay')
  );

  touchUI.style.display = hideForUI ? 'none' : 'block';
}

function setupTouchControls() {
  const isTouch = ('ontouchstart' in window) || (navigator.maxTouchPoints > 0) || (window.matchMedia && window.matchMedia('(pointer: coarse)').matches);
  if (!isTouch) return;

  const ui = document.createElement('div');
  ui.id = 'touchControls';
  ui.style.position = 'fixed';
  ui.style.left = '0';
  ui.style.right = '0';
  ui.style.bottom = '0';
  ui.style.height = '44vh';
  ui.style.pointerEvents = 'none';
  ui.style.zIndex = '250';
  document.body.appendChild(ui);

  // On touch devices, move upgrade panel away from bottom-left joystick zone.
  const upgradePanel = document.getElementById('upgradePanel');
  if (upgradePanel) {
    upgradePanel.style.top = '50%';
    upgradePanel.style.right = '10px';
    upgradePanel.style.left = 'auto';
    upgradePanel.style.transform = 'translateY(-50%)';
    upgradePanel.style.bottom = 'auto';
    upgradePanel.style.maxHeight = '45vh';
    upgradePanel.style.overflowY = 'auto';
  }

  const joystickBase = document.createElement('div');
  joystickBase.id = 'touchJoystickBase';
  joystickBase.style.position = 'absolute';
  joystickBase.style.left = '20px';
  joystickBase.style.bottom = '20px';
  joystickBase.style.width = '130px';
  joystickBase.style.height = '130px';
  joystickBase.style.borderRadius = '50%';
  joystickBase.style.border = '2px solid rgba(120,220,255,0.7)';
  joystickBase.style.background = 'rgba(0,40,70,0.35)';
  joystickBase.style.pointerEvents = 'auto';
  joystickBase.style.touchAction = 'none';

  const joystickKnob = document.createElement('div');
  joystickKnob.id = 'touchJoystickKnob';
  joystickKnob.style.position = 'absolute';
  joystickKnob.style.left = '40px';
  joystickKnob.style.top = '40px';
  joystickKnob.style.width = '50px';
  joystickKnob.style.height = '50px';
  joystickKnob.style.borderRadius = '50%';
  joystickKnob.style.background = 'rgba(120,220,255,0.8)';
  joystickKnob.style.border = '2px solid rgba(255,255,255,0.65)';

  joystickBase.appendChild(joystickKnob);
  ui.appendChild(joystickBase);

  const attackBtn = document.createElement('button');
  attackBtn.id = 'touchAttackBtn';
  attackBtn.textContent = 'FIRE';
  attackBtn.style.position = 'absolute';
  attackBtn.style.right = '24px';
  // Lift above minimap area (bottom-right) so they never overlap.
  attackBtn.style.bottom = '190px';
  attackBtn.style.width = '96px';
  attackBtn.style.height = '96px';
  attackBtn.style.borderRadius = '50%';
  attackBtn.style.border = '2px solid rgba(255,190,120,0.85)';
  attackBtn.style.background = 'rgba(180,70,20,0.45)';
  attackBtn.style.color = '#fff';
  attackBtn.style.fontWeight = 'bold';
  attackBtn.style.fontSize = '16px';
  attackBtn.style.pointerEvents = 'auto';
  attackBtn.style.touchAction = 'none';
  ui.appendChild(attackBtn);

  const interactBtn = document.createElement('button');
  interactBtn.id = 'touchInteractBtn';
  interactBtn.textContent = 'INTERACT';
  interactBtn.style.position = 'absolute';
  interactBtn.style.right = '26px';
  interactBtn.style.bottom = '300px';
  interactBtn.style.width = '96px';
  interactBtn.style.height = '54px';
  interactBtn.style.borderRadius = '12px';
  interactBtn.style.border = '2px solid rgba(120,220,255,0.85)';
  interactBtn.style.background = 'rgba(24,80,130,0.52)';
  interactBtn.style.color = '#fff';
  interactBtn.style.fontWeight = 'bold';
  interactBtn.style.fontSize = '12px';
  interactBtn.style.pointerEvents = 'auto';
  interactBtn.style.touchAction = 'none';
  ui.appendChild(interactBtn);

  const upBtn = document.createElement('button');
  upBtn.id = 'touchUpBtn';
  upBtn.textContent = 'UP';
  upBtn.style.position = 'absolute';
  upBtn.style.left = '168px';
  upBtn.style.bottom = '116px';
  upBtn.style.width = '64px';
  upBtn.style.height = '48px';
  upBtn.style.borderRadius = '10px';
  upBtn.style.border = '2px solid rgba(160,255,190,0.9)';
  upBtn.style.background = 'rgba(12,110,38,0.5)';
  upBtn.style.color = '#fff';
  upBtn.style.fontWeight = 'bold';
  upBtn.style.pointerEvents = 'auto';
  upBtn.style.touchAction = 'none';
  ui.appendChild(upBtn);

  const downBtn = document.createElement('button');
  downBtn.id = 'touchDownBtn';
  downBtn.textContent = 'DOWN';
  downBtn.style.position = 'absolute';
  downBtn.style.left = '168px';
  downBtn.style.bottom = '56px';
  downBtn.style.width = '64px';
  downBtn.style.height = '48px';
  downBtn.style.borderRadius = '10px';
  downBtn.style.border = '2px solid rgba(255,160,160,0.9)';
  downBtn.style.background = 'rgba(110,20,20,0.55)';
  downBtn.style.color = '#fff';
  downBtn.style.fontWeight = 'bold';
  downBtn.style.fontSize = '11px';
  downBtn.style.pointerEvents = 'auto';
  downBtn.style.touchAction = 'none';
  ui.appendChild(downBtn);

  const reloadBtn = document.createElement('button');
  reloadBtn.id = 'touchReloadBtn';
  reloadBtn.textContent = 'RELOAD';
  reloadBtn.style.position = 'absolute';
  reloadBtn.style.right = '26px';
  reloadBtn.style.bottom = '130px';
  reloadBtn.style.width = '96px';
  reloadBtn.style.height = '48px';
  reloadBtn.style.borderRadius = '10px';
  reloadBtn.style.border = '2px solid rgba(255,230,120,0.9)';
  reloadBtn.style.background = 'rgba(120,100,20,0.52)';
  reloadBtn.style.color = '#fff';
  reloadBtn.style.fontWeight = 'bold';
  reloadBtn.style.fontSize = '12px';
  reloadBtn.style.pointerEvents = 'auto';
  reloadBtn.style.touchAction = 'none';
  ui.appendChild(reloadBtn);

  let joystickPointerId = null;
  let joyCenterX = 0;
  let joyCenterY = 0;
  const joyRadius = 52;

  function resetMoveKeys() {
    keys["KeyW"] = false;
    keys["KeyA"] = false;
    keys["KeyS"] = false;
    keys["KeyD"] = false;
    keys["Space"] = false;
    keys["ShiftLeft"] = false;
    mouseX = 0;
    mouseY = 0;
    joystickKnob.style.left = '40px';
    joystickKnob.style.top = '40px';
  }

  joystickBase.addEventListener('pointerdown', (e) => {
    e.preventDefault();
    joystickPointerId = e.pointerId;
    const r = joystickBase.getBoundingClientRect();
    joyCenterX = r.left + r.width / 2;
    joyCenterY = r.top + r.height / 2;
    joystickBase.setPointerCapture(e.pointerId);
  });

  joystickBase.addEventListener('pointermove', (e) => {
    if (joystickPointerId !== e.pointerId) return;
    e.preventDefault();
    let dx = e.clientX - joyCenterX;
    let dy = e.clientY - joyCenterY;
    const len = Math.hypot(dx, dy);
    if (len > joyRadius) {
      dx = (dx / len) * joyRadius;
      dy = (dy / len) * joyRadius;
    }
    joystickKnob.style.left = `${40 + dx}px`;
    joystickKnob.style.top = `${40 + dy}px`;

    const nx = dx / joyRadius;
    const ny = dy / joyRadius;
    keys["KeyA"] = nx < -0.22;
    keys["KeyD"] = nx > 0.22;
    keys["KeyW"] = ny < -0.22;
    keys["KeyS"] = ny > 0.22;
    mouseX = nx;
    mouseY = ny;
  });

  const endJoystick = (e) => {
    if (joystickPointerId !== e.pointerId) return;
    joystickPointerId = null;
    resetMoveKeys();
  };
  joystickBase.addEventListener('pointerup', endJoystick);
  joystickBase.addEventListener('pointercancel', endJoystick);

  function startAttack() {
    if (!gameStarted || gameOver || !gameWorld) return;
    gameWorld.firePlayerWeapon();
    if (!mobileAttackInterval) {
      mobileAttackInterval = setInterval(() => {
        if (!gameStarted || gameOver || !gameWorld) return;
        gameWorld.firePlayerWeapon();
      }, 160);
    }
  }
  function stopAttack() {
    if (mobileAttackInterval) {
      clearInterval(mobileAttackInterval);
      mobileAttackInterval = null;
    }
  }

  attackBtn.addEventListener('pointerdown', (e) => {
    e.preventDefault();
    attackBtn.setPointerCapture(e.pointerId);
    startAttack();
  });
  attackBtn.addEventListener('pointerup', (e) => {
    e.preventDefault();
    stopAttack();
  });
  attackBtn.addEventListener('pointercancel', stopAttack);
  interactBtn.addEventListener('pointerdown', (e) => {
    e.preventDefault();
    handleInteractAction();
  });
  const setVerticalKey = (code, on) => {
    keys[code] = on;
  };
  const bindHoldButton = (btn, code) => {
    btn.addEventListener('pointerdown', (e) => {
      e.preventDefault();
      btn.setPointerCapture(e.pointerId);
      setVerticalKey(code, true);
    });
    const release = (e) => {
      e.preventDefault();
      setVerticalKey(code, false);
    };
    btn.addEventListener('pointerup', release);
    btn.addEventListener('pointercancel', release);
  };
  bindHoldButton(upBtn, 'Space');
  bindHoldButton(downBtn, 'ShiftLeft');
  reloadBtn.addEventListener('pointerdown', (e) => {
    e.preventDefault();
    if (!gameStarted || gameOver || !gameWorld || !gameWorld.ship) return;
    if (gameWorld.ship.reloadAmmo()) {
      showFloatingText(`Reloaded: ${gameWorld.ship.ammo}/${gameWorld.ship.maxAmmo}`, 900);
      playSound('pickup');
    }
  });

  window.addEventListener('blur', () => {
    stopAttack();
    resetMoveKeys();
  });

  updateTouchControlsVisibility();
}

setupTouchControls();

// ===================== CAMERA =====================
function updateCamera() {
  if (!gameWorld || !gameWorld.ship) return;
  if (cameraMode === 'cockpit') {
    const cockpitOffset = new THREE.Vector3(0, 1.7, -0.8).applyQuaternion(gameWorld.ship.mesh.quaternion);
    const desired = gameWorld.ship.position.clone().add(cockpitOffset);
    camera.position.lerp(desired, 0.16);
    const forward = new THREE.Vector3(0, 0, -1).applyQuaternion(gameWorld.ship.mesh.quaternion);
    const targetLook = desired.clone().add(forward.multiplyScalar(120)).add(new THREE.Vector3(mouseX * 8, mouseY * 6, 0));
    camera.lookAt(targetLook);
    return;
  }

  const offset = new THREE.Vector3(0, 6, 18);
  const desired = gameWorld.ship.position.clone().add(offset);
  camera.position.lerp(desired, 0.07);

  // Mouse look tilt - aim ship based on mouse position
  const targetLookX = gameWorld.ship.position.x + mouseX * 50;
  const targetLookY = gameWorld.ship.position.y + mouseY * 30;
  const targetLookZ = gameWorld.ship.position.z - 30;

  const targetLook = new THREE.Vector3(targetLookX, targetLookY, targetLookZ);
  camera.lookAt(targetLook);
}

// ===================== EFFECTS & AUDIO =====================
function screenShake(intensity = 10, duration = 300) {
  const originalPos = camera.position.clone();
  const shakeTime = Date.now();
  
  const shakeInterval = setInterval(() => {
    const elapsed = Date.now() - shakeTime;
    if (elapsed > duration) {
      camera.position.copy(originalPos);
      clearInterval(shakeInterval);
      return;
    }
    
    const progress = 1 - (elapsed / duration);
    camera.position.x = originalPos.x + (Math.random() - 0.5) * intensity * progress;
    camera.position.y = originalPos.y + (Math.random() - 0.5) * intensity * progress;
  }, 16);
}

const bgMusic = {
  ctx: null,
  master: null,
  musicMaster: null,
  sfxMaster: null,
  timer: null,
  step: 0
};

function ensureMusicContext() {
  if (bgMusic.ctx) return bgMusic.ctx;
  try {
    const ctx = new (window.AudioContext || window.webkitAudioContext)();
    const master = ctx.createGain();
    const musicMaster = ctx.createGain();
    const sfxMaster = ctx.createGain();
    loadSettingsState();
    master.gain.value = settingsState.masterVolume;
    musicMaster.gain.value = settingsState.musicVolume;
    sfxMaster.gain.value = settingsState.sfxVolume;
    musicMaster.connect(master);
    sfxMaster.connect(master);
    master.connect(ctx.destination);
    bgMusic.ctx = ctx;
    bgMusic.master = master;
    bgMusic.musicMaster = musicMaster;
    bgMusic.sfxMaster = sfxMaster;
    return ctx;
  } catch (e) {
    return null;
  }
}

function playMusicTone(freq, duration, volume, type = 'sine') {
  const ctx = ensureMusicContext();
  if (!ctx || !bgMusic.musicMaster) return;
  if (!freq || freq <= 0) return;
  const now = ctx.currentTime;
  const osc = ctx.createOscillator();
  const gain = ctx.createGain();
  osc.type = type;
  osc.frequency.setValueAtTime(freq, now);
  osc.connect(gain);
  gain.connect(bgMusic.musicMaster);
  gain.gain.setValueAtTime(0.0001, now);
  gain.gain.exponentialRampToValueAtTime(volume, now + 0.03);
  gain.gain.exponentialRampToValueAtTime(0.0001, now + duration);
  osc.start(now);
  osc.stop(now + duration + 0.03);
}

function startBackgroundMusic() {
  if (!gameWorld || !gameWorld.audioEnabled) return;
  const ctx = ensureMusicContext();
  if (!ctx || bgMusic.timer) return;
  if (ctx.state === 'suspended') {
    try { ctx.resume(); } catch (e) {}
  }
  bgMusic.step = 0;
  const progression = [
    [130.81, 164.81, 196.0],   // C3-E3-G3
    [116.54, 146.83, 174.61],  // A#2-D3-F3
    [98.0, 123.47, 146.83],    // G2-B2-D3
    [110.0, 138.59, 164.81]    // A2-C#3-E3
  ];
  const leadMotifs = [
    [261.63, null, 293.66, null, 329.63, 293.66, null, 246.94],
    [220.0, null, 246.94, 261.63, null, 293.66, null, 246.94],
    [196.0, 220.0, null, 246.94, null, 261.63, 246.94, null]
  ];

  bgMusic.timer = setInterval(() => {
    if (!gameStarted || gameOver || paused) return;
    const step = bgMusic.step;
    const bar = Math.floor(step / 8);
    const beat = step % 8;
    const chord = progression[bar % progression.length];

    // Soft chord pad every bar.
    if (beat === 0) {
      playMusicTone(chord[0], 2.4, 0.06, 'triangle');
      playMusicTone(chord[1], 2.0, 0.05, 'sine');
      playMusicTone(chord[2], 1.8, 0.04, 'sine');
    }

    // Gentle bass pulse on downbeats.
    if (beat === 0 || beat === 4) {
      playMusicTone(chord[0] * 0.5, 0.9, 0.075, 'triangle');
    }

    // Calm melody with rests and slight variation.
    const motif = leadMotifs[Math.floor(bar / 2) % leadMotifs.length];
    const note = motif[beat];
    if (note && Math.random() > 0.18) {
      playMusicTone(note, 0.75, 0.05, 'sine');
    }

    // Very light bell shimmer occasionally.
    if (beat === 7 && Math.random() > 0.6) {
      playMusicTone(chord[2] * 2, 1.2, 0.02, 'triangle');
    }

    bgMusic.step++;
  }, 900);
}

function unlockAudio() {
  const ctx = ensureMusicContext();
  if (!ctx) return;
  if (ctx.state === 'suspended') {
    try { ctx.resume(); } catch (e) {}
  }
}

function stopBackgroundMusic() {
  if (bgMusic.timer) {
    clearInterval(bgMusic.timer);
    bgMusic.timer = null;
  }
}

function playSound(type) {
  // Audio hooks for future implementation
  if (!gameWorld || !gameWorld.audioEnabled) return;
  
  try {
    const audioContext = ensureMusicContext();
    if (!audioContext || !bgMusic.sfxMaster) return;
    if (audioContext.state === 'suspended') {
      try { audioContext.resume(); } catch (e) {}
    }
    const oscillator = audioContext.createOscillator();
    const gainNode = audioContext.createGain();
    
    oscillator.connect(gainNode);
    gainNode.connect(bgMusic.sfxMaster);
    
    const sounds = {
      fire: { freq: 800, duration: 0.1, volume: 0.1 },
      explosion: { freq: 200, duration: 0.3, volume: 0.2 },
      pickup: { freq: 600, duration: 0.2, volume: 0.15 },
      damage: { freq: 150, duration: 0.15, volume: 0.12 },
      landing: { freq: 400, duration: 0.25, volume: 0.18 },
      achievement: { freq: 1000, duration: 0.4, volume: 0.2 },
      engineHum: { freq: 95, duration: 0.25, volume: 0.03 },
      ambient: { freq: 42, duration: 0.9, volume: 0.02 },
      asteroidHit: { freq: 240, duration: 0.12, volume: 0.08 },
      sparks: { freq: 1200, duration: 0.06, volume: 0.035 }
    };
    
    const config = sounds[type];
    if (!config) return;
    
    oscillator.frequency.setValueAtTime(config.freq, audioContext.currentTime);
    oscillator.type = (type === 'ambient' || type === 'engineHum') ? 'sawtooth' : ((type === 'asteroidHit' || type === 'sparks') ? 'triangle' : 'square');
    
    gainNode.gain.setValueAtTime(config.volume, audioContext.currentTime);
    gainNode.gain.exponentialRampToValueAtTime(0.001, audioContext.currentTime + config.duration);
    
    oscillator.start(audioContext.currentTime);
    oscillator.stop(audioContext.currentTime + config.duration);
  } catch (e) {
    // Fallback - silent if Web Audio API not supported
  }
}

function showAchievement(achievement) {
  const notif = document.getElementById('achievementNotif');
  document.getElementById('achievementIcon').textContent = achievement.icon;
  document.getElementById('achievementName').textContent = achievement.name;
  document.getElementById('achievementDesc').textContent = achievement.desc;
  notif.style.display = 'block';
  
  setTimeout(() => {
    notif.style.display = 'none';
  }, 3000);
  
  playSound('achievement');
}

function screenFlash() {
  const flash = document.createElement('div');
  flash.style.position = 'fixed';
  flash.style.top = '0';
  flash.style.left = '0';
  flash.style.width = '100%';
  flash.style.height = '100%';
  flash.style.background = 'white';
  flash.style.opacity = '0.5';
  flash.style.pointerEvents = 'none';
  flash.style.zIndex = '999';
  document.body.appendChild(flash);
  
  setTimeout(() => {
    flash.style.transition = 'opacity 0.3s';
    flash.style.opacity = '0';
    setTimeout(() => document.body.removeChild(flash), 300);
  }, 50);
}

// Small floating text for unobtrusive feedback (bottom-center)
function showFloatingText(text, duration = 2000) {
  let el = document.createElement('div');
  el.style.position = 'fixed';
  el.style.bottom = '18px';
  el.style.left = '50%';
  el.style.transform = 'translateX(-50%)';
  el.style.background = 'rgba(0,0,0,0.7)';
  el.style.color = '#ffd27a';
  el.style.padding = '8px 14px';
  el.style.borderRadius = '8px';
  el.style.zIndex = 400;
  el.style.fontSize = '14px';
  el.textContent = text;
  document.body.appendChild(el);
  setTimeout(() => {
    el.style.transition = 'opacity 0.4s';
    el.style.opacity = '0';
    setTimeout(() => document.body.removeChild(el), 450);
  }, duration);
}

// ===================== UI UPDATE =====================
function triggerGameOver() {
  gameStarted = false;
  gameOver = true;
  sessionEndedByDeath = true;
  stopBackgroundMusic();
  saveProgressNow();
  
  // Create death explosion at ship
  if (gameWorld && gameWorld.ship) {
    gameWorld.createExplosion(gameWorld.ship.position);
    gameWorld.createExplosion(gameWorld.ship.position.clone().add(new THREE.Vector3(10, 0, 0)));
    gameWorld.createExplosion(gameWorld.ship.position.clone().add(new THREE.Vector3(-10, 0, 0)));
  }
  
  // Update overlay with stats
  document.getElementById('finalScore').textContent = `Final Score: ${gameWorld.score}`;
  document.getElementById('finalKills').textContent = `Final Kills: ${gameWorld.kills}`;
  
  // Show overlay
  document.getElementById('gameOverOverlay').style.display = 'flex';
}

window.restartGame = function() {
  stopBackgroundMusic();
  saveProgressNow();
  // Close shop if open
  closeShop();
  
  // Clear scene
  if (gameWorld) {
    gameWorld.planets.forEach(p => gameWorld.scene.remove(p.mesh));
    gameWorld.enemies.forEach(e => {
      e.destroy();
    });
    gameWorld.bullets.forEach(b => b.destroy());
    gameWorld.powerUps.forEach(p => p.destroy());
    if (gameWorld.helperBots && gameWorld.helperBots.length) {
      gameWorld.helperBots.forEach(h => h.destroy());
      gameWorld.helperBots = [];
    }
    if (gameWorld.megaShip) gameWorld.megaShip.destroy();
    gameWorld.nebulas.forEach(n => n.destroy());
    gameWorld.blackHoles.forEach(bh => bh.destroy());
    gameWorld.asteroidFields.forEach(af => af.destroy());
    gameWorld.derelicts.forEach(d => d.destroy());
    if (gameWorld.colossalDerelicts && gameWorld.colossalDerelicts.length) {
      gameWorld.colossalDerelicts.forEach(cd => cd.destroy());
      gameWorld.colossalDerelicts = [];
      gameWorld.activeDerelictInterior = null;
    }
    gameWorld.jumpGates.forEach(g => g.destroy());
    gameWorld.artifacts.forEach(a => a.destroy());
    if (gameWorld.baseTrailLine) gameWorld.scene.remove(gameWorld.baseTrailLine);
    if (gameWorld.baseBeacon) gameWorld.scene.remove(gameWorld.baseBeacon);
    if (gameWorld.ship) {
      gameWorld.scene.remove(gameWorld.ship.mesh);
      gameWorld.scene.remove(gameWorld.ship.thrusterParticles);
      if (gameWorld.ship.exhaustParticles) gameWorld.scene.remove(gameWorld.ship.exhaustParticles);
      if (gameWorld.ship.smokeParticles) gameWorld.scene.remove(gameWorld.ship.smokeParticles);
      gameWorld.scene.remove(gameWorld.ship.damageParticles);
      gameWorld.scene.remove(gameWorld.ship.sparkParticles);
      gameWorld.scene.remove(gameWorld.ship.engineTrail);
      if (gameWorld.ship.detachedDebris && gameWorld.ship.detachedDebris.length) {
        gameWorld.ship.detachedDebris.forEach(d => gameWorld.scene.remove(d));
      }
      if (gameWorld.ship.detachedStageDebris && gameWorld.ship.detachedStageDebris.length) {
        gameWorld.ship.detachedStageDebris.forEach(d => gameWorld.scene.remove(d.mesh));
      }
    }
  }
  
  // Reset state
  gameStarted = false;
  gameOver = false;
  shopOpen = false;
  keys['KeyW'] = false;
  keys['KeyS'] = false;
  keys['KeyA'] = false;
  keys['KeyD'] = false;
  keys['Space'] = false;
  keys['ShiftLeft'] = false;
  
  // Hide shop and show ship builder
  document.getElementById('shopButton').style.display = 'none';
  document.getElementById('upgradeButton').style.display = 'none';
  document.getElementById('inventoryButton').style.display = 'none';
  document.getElementById('craftingButton').style.display = 'none';
  document.getElementById('missionPanel').style.display = 'none';
  document.getElementById('upgradePanel').style.display = 'none';
  document.getElementById('inventoryOverlay').style.display = 'none';
  document.getElementById('craftingOverlay').style.display = 'none';
  const lb = document.getElementById('leaderboardPanel');
  if (lb) lb.style.display = 'none';
  // Clear global reference so overlays show correct state
  window.gameWorld = null;
  document.getElementById('shipBuilder').style.display = 'block';
  document.getElementById('gameOverOverlay').style.display = 'none';
}

function drawMinimap() {
  if (!gameStarted || !gameWorld) return;
  
  const canvas = document.getElementById('minimapCanvas');
  const ctx = canvas.getContext('2d');
  const centerX = canvas.width / 2;
  const centerY = canvas.height / 2;
  
  // Clear
  ctx.fillStyle = 'rgba(0, 0, 20, 0.9)';
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  
  const scale = 0.1; // Fixed scale for centered view
  
  // Helper to clamp coordinates to canvas
  const clampX = (x) => Math.max(2, Math.min(canvas.width - 2, x));
  const clampY = (y) => Math.max(2, Math.min(canvas.height - 2, y));
  
  // Draw planets relative to ship position
  gameWorld.planets.forEach(p => {
    const relX = p.position.x - gameWorld.ship.position.x;
    const relZ = p.position.z - gameWorld.ship.position.z;
    const x = centerX + relX * scale;
    const y = centerY + relZ * scale;
    const r = Math.max(2, p.radius * scale * 0.5);
    
    // Only draw if within reasonable distance
    if (Math.abs(relX) < 2000 && Math.abs(relZ) < 2000) {
      ctx.fillStyle = `rgb(${Math.floor(p.color.r * 255)}, ${Math.floor(p.color.g * 255)}, ${Math.floor(p.color.b * 255)})`;
      ctx.beginPath();
      ctx.arc(clampX(x), clampY(y), r, 0, Math.PI * 2);
      ctx.fill();
    }
  });
  
  // Draw enemies relative to ship (hidden inside nebula)
  if (!gameWorld.inNebula) {
    gameWorld.enemies.forEach(e => {
    const relX = e.position.x - gameWorld.ship.position.x;
    const relZ = e.position.z - gameWorld.ship.position.z;
    const x = centerX + relX * scale;
    const y = centerY + relZ * scale;
    
    if (Math.abs(relX) < 2000 && Math.abs(relZ) < 2000) {
      ctx.fillStyle = '#ff3333';
      ctx.fillRect(clampX(x) - 2, clampY(y) - 2, 4, 4);
    }
    });
  } else {
    // Draw subtle nebula indicator
    ctx.fillStyle = '#8855aa';
    ctx.font = '10px monospace';
    ctx.fillText('NEBULA: enemies hidden', 6, 12);
  }
  
  // Draw power-ups relative to ship
  if (!gameWorld.inNebula) {
    gameWorld.powerUps.forEach(p => {
      const relX = p.position.x - gameWorld.ship.position.x;
      const relZ = p.position.z - gameWorld.ship.position.z;
      const x = centerX + relX * scale;
      const y = centerY + relZ * scale;
      
      if (Math.abs(relX) < 2000 && Math.abs(relZ) < 2000) {
        const colors = { fuel: '#00ff00', shield: '#0088ff', ammo: '#ffaa00' };
        ctx.fillStyle = colors[p.type] || '#ffffff';
        ctx.beginPath();
        ctx.arc(clampX(x), clampY(y), 2, 0, Math.PI * 2);
        ctx.fill();
      }
    });
  }

  // Draw jump gates
  if (!gameWorld.inNebula && gameWorld.jumpGates && gameWorld.jumpGates.length) {
    gameWorld.jumpGates.forEach(g => {
      const relX = g.position.x - gameWorld.ship.position.x;
      const relZ = g.position.z - gameWorld.ship.position.z;
      if (Math.abs(relX) < 3000 && Math.abs(relZ) < 3000) {
        const x = centerX + relX * scale;
        const y = centerY + relZ * scale;
        ctx.strokeStyle = '#66ccff';
        ctx.lineWidth = 1.5;
        ctx.beginPath();
        ctx.arc(clampX(x), clampY(y), 4, 0, Math.PI * 2);
        ctx.stroke();
      }
    });
  }

  // Draw artifacts
  if (!gameWorld.inNebula && gameWorld.artifacts && gameWorld.artifacts.length) {
    gameWorld.artifacts.forEach(a => {
      const relX = a.position.x - gameWorld.ship.position.x;
      const relZ = a.position.z - gameWorld.ship.position.z;
      if (Math.abs(relX) < 3000 && Math.abs(relZ) < 3000) {
        const x = centerX + relX * scale;
        const y = centerY + relZ * scale;
        ctx.fillStyle = '#ffd27a';
        ctx.fillRect(clampX(x) - 2, clampY(y) - 2, 4, 4);
      }
    });
  }
  
  // Draw player at center
  ctx.fillStyle = '#00ff00';
  ctx.fillRect(centerX - 3, centerY - 3, 6, 6);
  
  // Draw border
  ctx.strokeStyle = '#00ffff';
  ctx.lineWidth = 2;
  ctx.strokeRect(0, 0, canvas.width, canvas.height);
}

function updateHUD() {
  if (!gameStarted || !gameWorld) return;
  const stats = gameWorld.getStats();
  document.getElementById('speed').textContent = `Speed: ${stats.speed} m/s`;
  document.getElementById('altitude').textContent = `Altitude: ${stats.altitude} m`;
  document.getElementById('weapon').textContent = `Weapon: ${stats.weaponName}`;
  document.getElementById('healthLabel').textContent = `Health: ${Math.max(0, stats.health)}/${stats.maxHealth}`;
  document.getElementById('fuel').textContent = `\u26FD Fuel: ${stats.fuel}/${stats.maxFuel}`;
  document.getElementById('shield').textContent = `\uD83D\uDEE1\uFE0F Shield: ${stats.shield}/${gameWorld.ship.maxShield}`;
  document.getElementById('ammo').textContent = `\uD83D\uDCA5 Ammo: ${stats.ammo}`;
  document.getElementById('cooldown').textContent = `\u23F1\uFE0F Cooldown: ${stats.cooldown}ms`;
  document.getElementById('score').textContent = `\u2B50 Score: ${stats.score}`;
  document.getElementById('kills').textContent = `\uD83D\uDC80 Kills: ${stats.kills}`;
  if (!document.getElementById('stageLabel')) {
    const stageEl = document.createElement('div');
    stageEl.id = 'stageLabel';
    stageEl.style.color = '#9fd6ff';
    stageEl.style.marginTop = '2px';
    document.getElementById('hudContent').appendChild(stageEl);
  }
  document.getElementById('stageLabel').textContent = `\uD83D\uDE80 Stages: ${gameWorld.ship.extraStages || 0} (Z to separate)`;
  // Resources
  const minerals = gameWorld.resources ? gameWorld.resources.minerals : 0;
  const salvage = gameWorld.resources ? gameWorld.resources.salvage : 0;
  const droneCombat = gameWorld.droneCounts ? (gameWorld.droneCounts.combat || 0) : 0;
  const droneHarvest = gameWorld.droneCounts ? (gameWorld.droneCounts.harvester || 0) : 0;
  const factionTag = gameWorld.factionWarMode ? ' | Faction War: ON' : '';
  // show below kills
  if (!document.getElementById('resourceLabel')) {
    const el = document.createElement('div');
    el.id = 'resourceLabel';
    el.style.color = '#ffd27a';
    el.style.marginTop = '4px';
    document.getElementById('hudContent').appendChild(el);
  }
  document.getElementById('resourceLabel').textContent = `\u26CF\uFE0F Minerals: ${minerals} | \u2699 Salvage: ${salvage} | Drones C/H: ${droneCombat}/${droneHarvest}${factionTag}`;
  
  // Calculate difficulty level based on score
  const difficultyLevel = 1 + Math.floor(gameWorld.score / 500);
  document.getElementById('difficulty').textContent = `\uD83D\uDCCA Wave: ${difficultyLevel} (${gameWorld.enemies.length}/${gameWorld.maxEnemies})`;
  
  // Check for collision warning
  let closestPlanet = null;
  let minDist = Infinity;
  gameWorld.planets.forEach(p => {
    const dist = gameWorld.ship.position.distanceTo(p.position);
    if (dist < minDist) { minDist = dist; closestPlanet = p; }
  });
  
  if (closestPlanet && minDist < closestPlanet.radius + 100) {
    const speed = parseFloat(stats.speed);
    if (speed > gameWorld.ship.safeLandingSpeed && minDist < closestPlanet.radius + 50) {
      document.getElementById('warning').style.display = 'inline';
    } else {
      document.getElementById('warning').style.display = 'none';
    }
  } else {
    document.getElementById('warning').style.display = 'none';
  }

  // Environment warnings (nebula / black hole proximity)
  const envEl = document.getElementById('envWarning');
  if (gameWorld.inNebula) {
    envEl.style.display = 'inline';
    envEl.textContent = '\uD83C\uDF2B\uFE0F Nebula: enemies hidden, sensors reduced';
  } else {
    // check black hole proximity
    let nearBH = false;
    if (gameWorld.blackHoles && gameWorld.blackHoles.length) {
      for (let bh of gameWorld.blackHoles) {
        const d = gameWorld.ship.position.distanceTo(bh.position);
        if (d < bh.gravityRadius * 0.9) { nearBH = true; break; }
      }
    }
    if (nearBH) {
      envEl.style.display = 'inline';
      envEl.textContent = '\u26AB BLACK HOLE: strong gravity, steer clear';
    } else {
      envEl.style.display = 'none';
    }
  }
  if (gameWorld.cosmicEvent) {
    envEl.style.display = 'inline';
    envEl.textContent = `COSMIC EVENT: ${gameWorld.cosmicEvent.type.replace('_', ' ')}`;
  }
  
  const healthPercent = Math.max(0, (stats.health / stats.maxHealth)) * 100;
  document.getElementById('healthFill').style.width = healthPercent + '%';
  
  // Pulsing effect when low health (but only if alive)
  if (stats.health > 0 && stats.health < stats.maxHealth * 0.3) {
    const pulse = Math.sin(Date.now() * 0.01) * 0.5 + 0.5;
    document.getElementById('healthFill').style.opacity = 0.5 + pulse * 0.5;
    if (!gameWorld._lastAlarmBeep || Date.now() - gameWorld._lastAlarmBeep > 1400) {
      playSound('damage');
      gameWorld._lastAlarmBeep = Date.now();
    }
  } else {
    document.getElementById('healthFill').style.opacity = 1;
  }
  
  if (gameWorld.ship.landed) {
    document.getElementById('speed').textContent += ' [LANDED]';
  }

  const cockpitOverlay = document.getElementById('cockpitOverlay');
  const cockpitReadout = document.getElementById('cockpitReadout');
  if (cockpitOverlay && cockpitReadout) {
    if (cameraMode === 'cockpit') {
      cockpitOverlay.style.display = 'block';
      cockpitReadout.textContent = `SPD ${stats.speed} | ALT ${stats.altitude} | SHD ${stats.shield} | AMMO ${stats.ammo}`;
    } else {
      cockpitOverlay.style.display = 'none';
    }
  }
  
  // Update missions and upgrades panels
  updateMissionsUI();
  updateUpgradesUI();
  if (window.updateLeaderboardUI) updateLeaderboardUI();
  
  drawMinimap();
}

// ===================== ANIMATION LOOP =====================
function animate() {
  requestAnimationFrame(animate);
  updateTouchControlsVisibility();
  
  if (gameStarted && gameWorld && !paused) {
    gameWorld.update(keys);
    updateCamera();
    updateHUD();
    const now = Date.now();
    if (now - _lastAutoSaveAt > 5000) {
      saveProgressNow();
      _lastAutoSaveAt = now;
    }
  }
  
  renderer.render(scene, camera);
}
animate();

// ===================== WINDOW RESIZE =====================
window.addEventListener("resize", () => {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
});



