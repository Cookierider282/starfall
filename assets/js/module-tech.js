// Module & Tech JS (moved out of CSS so functions are available)
(function(){
  const MODULES = {
    engine_mk1: { name: 'Engine Mk1', desc: 'Improves acceleration', costMinerals: 30, costScore: 500 },
    shield_mk1: { name: 'Shield Mk1', desc: 'Adds shield capacity', costMinerals: 40, costScore: 700 },
    fuel_cells: { name: 'Fuel Cells', desc: 'Increases max fuel and efficiency', costMinerals: 45, costScore: 900 },
    weapon_coil: { name: 'Weapon Coil', desc: 'Increases weapon damage output', costMinerals: 55, costScore: 1200 },
    ammo_rack: { name: 'Ammo Rack', desc: 'Adds reserve ammunition', costMinerals: 35, costScore: 850 },
    repair_gel: { name: 'Repair Gel', desc: 'Restores a chunk of hull integrity', costMinerals: 30, costScore: 1000 },
    overthruster: { name: 'Overthruster', desc: 'Boosts top speed', costMinerals: 60, costScore: 1400 },
    sensor_lattice: { name: 'Sensor Lattice', desc: 'Small bonus upgrade points', costMinerals: 50, costScore: 1500 }
  };

  const TECH_NODES = [
    { id: 'boost', name: 'Engine Boost', cost: 100, tier: 1 },
    { id: 'hull_plating', name: 'Hull Plating', cost: 110, tier: 1 },
    { id: 'capacitor', name: 'Shield Capacitor', cost: 120, tier: 1 },
    { id: 'recycler', name: 'Recycler Protocol', cost: 90, tier: 1 },
    { id: 'afterburners', name: 'Afterburners', cost: 160, tier: 2, req: 'boost' },
    { id: 'vector_thrusters', name: 'Vector Thrusters', cost: 170, tier: 2, req: 'boost' },
    { id: 'reinforced_bulkheads', name: 'Reinforced Bulkheads', cost: 180, tier: 2, req: 'hull_plating' },
    { id: 'adaptive_shields', name: 'Adaptive Shields', cost: 180, tier: 2, req: 'capacitor' },
    { id: 'kinetic_rails', name: 'Kinetic Rails', cost: 190, tier: 2, req: 'boost' },
    { id: 'resource_scanners', name: 'Resource Scanners', cost: 150, tier: 2, req: 'recycler' },
    { id: 'ion_overdrive', name: 'Ion Overdrive', cost: 260, tier: 3, req: 'afterburners' },
    { id: 'fortress_matrix', name: 'Fortress Matrix', cost: 260, tier: 3, req: 'reinforced_bulkheads' },
    { id: 'nanorepair', name: 'Nanorepair Gel', cost: 250, tier: 3, req: 'adaptive_shields' },
    { id: 'hypervelocity', name: 'Hypervelocity Rounds', cost: 270, tier: 3, req: 'kinetic_rails' },
    { id: 'salvage_drones', name: 'Salvage Drones', cost: 240, tier: 3, req: 'resource_scanners' },
    { id: 'combat_ai', name: 'Combat AI Uplink', cost: 290, tier: 3, req: 'vector_thrusters' }
  ];

  function hasTech(id) {
    return !!(gameWorld && gameWorld.tech && gameWorld.tech[id]);
  }

  function applyModuleEffect(id) {
    const ship = gameWorld && gameWorld.ship ? gameWorld.ship : null;
    if (!ship) return;
    if (id === 'engine_mk1') ship.acceleration = (ship.acceleration || 0.25) * 1.08;
    if (id === 'shield_mk1') ship.maxShield = (ship.maxShield || 50) + 25;
    if (id === 'fuel_cells') {
      ship.maxFuel = Math.floor((ship.maxFuel || 100) * 1.15);
      ship.fuelConsumption = (ship.fuelConsumption || 1) * 0.92;
    }
    if (id === 'weapon_coil' && ship.weaponConfig) ship.weaponConfig.damage = Math.floor((ship.weaponConfig.damage || 10) * 1.15);
    if (id === 'ammo_rack') ship.ammo += 300;
    if (id === 'repair_gel') ship.health = Math.min(ship.maxHealth || 100, (ship.health || 0) + 35);
    if (id === 'overthruster') ship.maxSpeed = (ship.maxSpeed || 1) * 1.12;
    if (id === 'sensor_lattice') gameWorld.upgradePoints = (gameWorld.upgradePoints || 0) + 35;
  }

  function applyTechEffect(id) {
    const ship = gameWorld && gameWorld.ship ? gameWorld.ship : null;
    if (!ship) return;

    if (id === 'boost') ship.maxSpeed = (ship.maxSpeed || 1) * 1.07;
    if (id === 'hull_plating') {
      ship.maxHealth = Math.floor((ship.maxHealth || 100) * 1.12);
      ship.health = Math.min(ship.maxHealth, ship.health + 20);
    }
    if (id === 'capacitor') ship.maxShield = (ship.maxShield || 50) + 15;
    if (id === 'recycler') gameWorld.resources.minerals += 25;
    if (id === 'afterburners') ship.acceleration = (ship.acceleration || 0.25) * 1.12;
    if (id === 'vector_thrusters') ship.acceleration = (ship.acceleration || 0.25) * 1.08;
    if (id === 'reinforced_bulkheads') {
      ship.maxHealth = Math.floor((ship.maxHealth || 100) * 1.14);
      ship.health = Math.min(ship.maxHealth, ship.health + 25);
    }
    if (id === 'adaptive_shields') ship.shieldRegenRate = (ship.shieldRegenRate || 0.1) + 0.04;
    if (id === 'kinetic_rails' && ship.weaponConfig) ship.weaponConfig.damage = Math.floor((ship.weaponConfig.damage || 10) * 1.12);
    if (id === 'resource_scanners') gameWorld.resources.minerals += 40;
    if (id === 'ion_overdrive') ship.maxSpeed = (ship.maxSpeed || 1) * 1.12;
    if (id === 'fortress_matrix') {
      ship.maxShield = (ship.maxShield || 50) + 30;
      ship.shieldHealth = Math.min(ship.maxShield, (ship.shieldHealth || 0) + 30);
    }
    if (id === 'nanorepair') {
      ship.maxHealth = Math.floor((ship.maxHealth || 100) * 1.1);
      ship.health = ship.maxHealth;
    }
    if (id === 'hypervelocity' && ship.weaponConfig) {
      ship.weaponConfig.fireRate = Math.max(60, Math.floor((ship.weaponConfig.fireRate || 200) * 0.86));
      ship.weaponConfig.damage = Math.floor((ship.weaponConfig.damage || 10) * 1.1);
    }
    if (id === 'salvage_drones') gameWorld.resources.salvage += 45;
    if (id === 'combat_ai' && ship.weaponConfig) {
      ship.weaponConfig.fireRate = Math.max(60, Math.floor((ship.weaponConfig.fireRate || 200) * 0.9));
      ship.weaponConfig.speed = (ship.weaponConfig.speed || 15) * 1.15;
    }
  }

  window.openModules = function() {
    const el = document.getElementById('moduleOverlay'); if (!el) return;
    el.style.display = 'flex'; updateModuleUI();
  };
  window.closeModules = function() { const el = document.getElementById('moduleOverlay'); if (!el) return; el.style.display = 'none'; };

  window.updateModuleUI = function() {
    const el = document.getElementById('moduleItems');
    if (!el) return;
    if (typeof gameWorld === 'undefined' || !gameWorld) { el.innerHTML = '<div>No game</div>'; return; }
    gameWorld.modules = gameWorld.modules || [];
    el.innerHTML = Object.entries(MODULES).map(([id,m])=>{
      const owned = gameWorld.modules.includes(id);
      const canAfford = (gameWorld.resources && gameWorld.resources.minerals >= m.costMinerals) || (gameWorld.score >= m.costScore);
      return `
        <div class="shopItem">
          <div><div class="itemName">${m.name} ${owned ? '(Installed)' : ''}</div><div style="font-size:11px;color:#aaa">${m.desc}</div></div>
          <div class="itemPrice">M ${m.costMinerals} | S ${m.costScore}</div>
          <button onclick="buyModule('${id}')" ${owned || !canAfford? 'disabled':''}>${owned ? 'OWNED' : 'BUY'}</button>
        </div>
      `;
    }).join('');
  };

  window.buyModule = function(id) {
    if (typeof gameWorld === 'undefined' || !gameWorld) return;
    const m = MODULES[id];
    if (!m) return;
    gameWorld.modules = gameWorld.modules || [];
    if (gameWorld.modules.includes(id)) return;
    if (!gameWorld.resources) gameWorld.resources = { minerals: 0, salvage: 0 };

    if (gameWorld.resources.minerals >= m.costMinerals) {
      gameWorld.resources.minerals -= m.costMinerals;
    } else if (gameWorld.score >= m.costScore) {
      gameWorld.score -= m.costScore;
    } else {
      if (window.showFloatingText) showFloatingText('Not enough resources', 1500);
      return;
    }

    gameWorld.modules.push(id);
    applyModuleEffect(id);
    if (window.updateModuleUI) updateModuleUI();
    if (window.updateHUD) updateHUD();
    if (window.showFloatingText) showFloatingText('Module installed: ' + m.name, 2000);
  };

  window.openTechTree = function() {
    const el = document.getElementById('techOverlay');
    if (!el) return;
    el.style.display = 'flex';
    updateTechUI();
  };
  window.closeTechTree = function() {
    const el = document.getElementById('techOverlay');
    if (!el) return;
    el.style.display = 'none';
  };

  window.updateTechUI = function() {
    const el = document.getElementById('techItems');
    if (!el) return;
    if (typeof gameWorld === 'undefined' || !gameWorld) { el.innerHTML = '<div>No game</div>'; return; }
    gameWorld.tech = gameWorld.tech || {};

    el.innerHTML = TECH_NODES.map(n => {
      const unlocked = hasTech(n.id);
      const reqMet = !n.req || hasTech(n.req);
      const canAfford = (gameWorld.upgradePoints || 0) >= n.cost;
      const disabled = unlocked || !reqMet || !canAfford;
      const reqNode = n.req ? TECH_NODES.find(t => t.id === n.req) : null;
      const reqText = reqNode ? ('Requires: ' + reqNode.name) : 'No prerequisite';
      return `
        <div class="shopItem">
          <div><div class="itemName">${n.name} ${unlocked ? '(Unlocked)' : ''}</div><div style="font-size:11px;color:#aaa">Tier ${n.tier} | Cost: ${n.cost} upgrade pts | ${reqText}</div></div>
          <div>${unlocked ? 'OK' : ''}</div>
          <button onclick="researchTech('${n.id}')" ${disabled ? 'disabled' : ''}>${unlocked ? 'OWNED' : 'RESEARCH'}</button>
        </div>
      `;
    }).join('');
  };

  window.researchTech = function(id) {
    if (!window.gameWorld) return;
    const node = TECH_NODES.find(n => n.id === id);
    if (!node) return;
    if (hasTech(id)) return;
    if (node.req && !hasTech(node.req)) return;
    if ((gameWorld.upgradePoints || 0) < node.cost) return;
    if (!gameWorld.resources) gameWorld.resources = { minerals: 0, salvage: 0 };

    gameWorld.upgradePoints = (gameWorld.upgradePoints || 0) - node.cost;
    gameWorld.tech = gameWorld.tech || {};
    gameWorld.tech[node.id] = true;

    applyTechEffect(node.id);

    if (window.updateTechUI) updateTechUI();
    if (window.updateUpgradesUI) updateUpgradesUI();
    if (window.updateHUD) updateHUD();
    if (window.showFloatingText) showFloatingText('Researched: ' + node.name, 2000);
  };

})();

