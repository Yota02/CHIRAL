/**
 * SERVER.JS - Serveur Multijoueur Chapitre 3
 * Serveur HTTP statique + WebSocket authoritative
 */

const http = require('http');
const fs = require('fs');
const path = require('path');
const { WebSocketServer } = require('ws');
const os = require('os');

// --- CONFIG ---
const PORT = 3000;
const TICK_RATE = 20; // ticks par seconde
const MAP_SIZE = 8000;
const VICTORY_POP = 30000;
const DIVISION_INTERVAL = 20;
const MAX_PLAYERS = 8;

const PLAYER_COLORS = [
    '#b944ff', '#ff4488', '#44bbff', '#ffaa22',
    '#22ffaa', '#ff6644', '#88ff44', '#ff44ff'
];

const FOOD_MAX_BASE = 500;
const FOOD_SPAWN_RATE = 8;
const POWERUP_MAX = 10;
const ORB_MAX = 15;

// --- PVP CONFIG ---
const PVP_STEAL_RATIO = 0.15; // % de population volee par tick de contact
const PVP_COOLDOWN = 1.0; // secondes de cooldown entre attaques sur le meme joueur

const ORB_TYPES = [
    { type: 'foodValue',       abbr: 'NUT', color: '#66ff66', min: 1, max: 10 },
    { type: 'foodCost',        abbr: 'ECO', color: '#ff66aa', min: 1, max: 5 },
    { type: 'speed',           abbr: 'VIT', color: '#44ddff', min: 1, max: 5 },
    { type: 'collectionRange', abbr: 'POR', color: '#ffaa44', min: 1, max: 5 },
    { type: 'regeneration',    abbr: 'REG', color: '#88ffaa', min: 1, max: 5 },
    { type: 'duplication',     abbr: 'DUP', color: '#ff88dd', min: 1, max: 5 }
];

// --- MIME TYPES ---
const MIME = {
    '.html': 'text/html',
    '.css': 'text/css',
    '.js': 'application/javascript',
    '.json': 'application/json',
    '.png': 'image/png',
    '.jpg': 'image/jpeg',
    '.svg': 'image/svg+xml'
};

// ==============================================
// GAME STATE
// ==============================================

let gamePhase = 'lobby'; // lobby | playing | victory
let players = new Map(); // id -> player data
let food = [];
let powerups = [];
let orbs = [];
let divisionTimer = DIVISION_INTERVAL;
let globalTime = 0;
let foodSpawnTimer = 0;
let powerupSpawnTimer = 0;
let orbSpawnTimer = 0;
let powerupSpawnInterval = 5 + Math.random() * 5;
let orbSpawnInterval = 7 + Math.random() * 8;
let nextPlayerId = 1;
let hostId = null;
let gameLoopInterval = null;

// ==============================================
// HTTP SERVER
// ==============================================

const server = http.createServer((req, res) => {
    let filePath = path.join(__dirname, 'public', req.url === '/' ? 'index.html' : req.url);
    const ext = path.extname(filePath);
    const contentType = MIME[ext] || 'application/octet-stream';

    fs.readFile(filePath, (err, data) => {
        if (err) {
            res.writeHead(404);
            res.end('Not Found');
            return;
        }
        res.writeHead(200, { 'Content-Type': contentType });
        res.end(data);
    });
});

// ==============================================
// WEBSOCKET SERVER
// ==============================================

const wss = new WebSocketServer({ server });

wss.on('connection', (ws) => {
    const id = 'p' + (nextPlayerId++);
    ws._playerId = id;

    ws.on('message', (data) => {
        try {
            const msg = JSON.parse(data);
            handleMessage(ws, id, msg);
        } catch (e) {
            // ignore invalid JSON
        }
    });

    ws.on('close', () => {
        players.delete(id);
        if (id === hostId) {
            // Transfer host
            const remaining = [...players.keys()];
            hostId = remaining.length > 0 ? remaining[0] : null;
        }
        broadcastLobby();

        if (gamePhase === 'playing' && players.size === 0) {
            resetGame();
        }
    });
});

function handleMessage(ws, id, msg) {
    switch (msg.type) {
        case 'join': {
            if (players.size >= MAX_PLAYERS) {
                ws.send(JSON.stringify({ type: 'error', message: 'Serveur plein' }));
                return;
            }
            if (gamePhase === 'playing') {
                ws.send(JSON.stringify({ type: 'error', message: 'Partie en cours' }));
                return;
            }
            const colorIndex = players.size;
            const player = createPlayer(id, msg.name || 'Joueur', colorIndex);
            players.set(id, player);
            player.ws = ws;

            if (!hostId) hostId = id;

            ws.send(JSON.stringify({ type: 'joined', id, isHost: id === hostId }));
            broadcastLobby();
            break;
        }

        case 'input': {
            const player = players.get(id);
            if (player && gamePhase === 'playing') {
                player.inputX = msg.mouseX;
                player.inputY = msg.mouseY;
            }
            break;
        }

        case 'start': {
            if (id === hostId && gamePhase === 'lobby' && players.size >= 1) {
                startGame();
            }
            break;
        }
    }
}

// ==============================================
// PLAYER CREATION
// ==============================================

function createPlayer(id, name, colorIndex) {
    const angle = (colorIndex / MAX_PLAYERS) * Math.PI * 2;
    const dist = 1500;
    const cx = MAP_SIZE / 2 + Math.cos(angle) * dist;
    const cy = MAP_SIZE / 2 + Math.sin(angle) * dist;

    return {
        id,
        name: name.substring(0, 16),
        color: PLAYER_COLORS[colorIndex % PLAYER_COLORS.length],
        x: cx,
        y: cy,
        population: 1,
        food: 0,
        speed: 200,
        inputX: cx,
        inputY: cy,
        orbBonuses: {
            foodValue: 0, foodCost: 0, speed: 0,
            collectionRange: 0, regeneration: 0, duplication: 0
        },
        activePowerups: { speed: 0, efficiency: 0, magnet: 0, shield: false },
        alive: true,
        pvpCooldowns: {},
        ws: null
    };
}

// ==============================================
// GAME LIFECYCLE
// ==============================================

function startGame() {
    gamePhase = 'playing';
    globalTime = 0;
    divisionTimer = DIVISION_INTERVAL;
    foodSpawnTimer = 0;
    powerupSpawnTimer = 0;
    orbSpawnTimer = 0;

    generateInitialFood();

    broadcast({ type: 'start' });

    gameLoopInterval = setInterval(gameTick, 1000 / TICK_RATE);
}

function resetGame() {
    gamePhase = 'lobby';
    if (gameLoopInterval) {
        clearInterval(gameLoopInterval);
        gameLoopInterval = null;
    }
    food = [];
    powerups = [];
    orbs = [];
    globalTime = 0;
    divisionTimer = DIVISION_INTERVAL;

    // Reset players for new game
    for (const [id, player] of players) {
        const colorIndex = [...players.keys()].indexOf(id);
        const angle = (colorIndex / MAX_PLAYERS) * Math.PI * 2;
        const dist = 1500;
        player.x = MAP_SIZE / 2 + Math.cos(angle) * dist;
        player.y = MAP_SIZE / 2 + Math.sin(angle) * dist;
        player.population = 1;
        player.food = 0;
        player.inputX = player.x;
        player.inputY = player.y;
        player.orbBonuses = {
            foodValue: 0, foodCost: 0, speed: 0,
            collectionRange: 0, regeneration: 0, duplication: 0
        };
        player.activePowerups = { speed: 0, efficiency: 0, magnet: 0, shield: false };
        player.pvpCooldowns = {};
        player.alive = true;
    }

    broadcastLobby();
}

// ==============================================
// GENERATION
// ==============================================

function generateInitialFood() {
    food = [];
    for (let i = 0; i < 100; i++) {
        spawnFood();
    }
}

function spawnFood() {
    const maxPop = getMaxPopulation();
    const mult = 1 + 9 * Math.min(1, maxPop / VICTORY_POP);
    const maxFood = Math.floor(FOOD_MAX_BASE * mult);
    if (food.length >= maxFood) return;

    const margin = 300;
    food.push({
        x: margin + Math.random() * (MAP_SIZE - margin * 2),
        y: margin + Math.random() * (MAP_SIZE - margin * 2),
        value: 1 + Math.floor(globalTime / 15),
        size: 3 + Math.random() * 3
    });
}

function spawnPowerup() {
    if (powerups.length >= POWERUP_MAX) return;
    const types = ['speed', 'efficiency', 'magnet', 'shield'];
    const margin = 500;
    powerups.push({
        x: margin + Math.random() * (MAP_SIZE - margin * 2),
        y: margin + Math.random() * (MAP_SIZE - margin * 2),
        type: types[Math.floor(Math.random() * types.length)],
        size: 12
    });
}

function spawnOrb() {
    if (orbs.length >= ORB_MAX) return;
    const typeDef = ORB_TYPES[Math.floor(Math.random() * ORB_TYPES.length)];
    const value = typeDef.min + Math.floor(Math.random() * (typeDef.max - typeDef.min + 1));
    const margin = 600;
    orbs.push({
        x: margin + Math.random() * (MAP_SIZE - margin * 2),
        y: margin + Math.random() * (MAP_SIZE - margin * 2),
        typeIndex: ORB_TYPES.indexOf(typeDef),
        value,
        size: 16
    });
}

// ==============================================
// GAME TICK
// ==============================================

function gameTick() {
    if (gamePhase !== 'playing') return;

    const dt = 1 / TICK_RATE;
    globalTime += dt;

    updatePlayers(dt);
    updateFoodSpawning(dt);
    updatePowerupSpawning(dt);
    updateOrbSpawning(dt);
    updateActivePowerups(dt);
    updateRegeneration(dt);
    updateCollisions();
    updatePvP(dt);
    updateDivisionTimer(dt);
    checkVictory();

    broadcastState();
}

// ==============================================
// UPDATE SYSTEMS
// ==============================================

function updatePlayers(dt) {
    for (const [id, player] of players) {
        if (!player.alive) continue;

        const dx = player.inputX - player.x;
        const dy = player.inputY - player.y;
        const dist = Math.sqrt(dx * dx + dy * dy);

        if (dist > 5) {
            const speedMult = player.activePowerups.speed > 0 ? 1.5 : 1;
            const baseSpeed = 200 + player.orbBonuses.speed * 20;
            const speed = baseSpeed * speedMult;
            player.x += (dx / dist) * speed * dt;
            player.y += (dy / dist) * speed * dt;
        }

        player.x = ((player.x % MAP_SIZE) + MAP_SIZE) % MAP_SIZE;
        player.y = ((player.y % MAP_SIZE) + MAP_SIZE) % MAP_SIZE;
    }
}

function updateFoodSpawning(dt) {
    const maxPop = getMaxPopulation();
    const mult = 1 + 9 * Math.min(1, maxPop / VICTORY_POP);
    const rate = FOOD_SPAWN_RATE * mult;
    foodSpawnTimer += dt;
    const interval = 1 / rate;
    while (foodSpawnTimer >= interval) {
        foodSpawnTimer -= interval;
        spawnFood();
    }
}

function updatePowerupSpawning(dt) {
    powerupSpawnTimer += dt;
    if (powerupSpawnTimer >= powerupSpawnInterval && powerups.length < POWERUP_MAX) {
        powerupSpawnTimer = 0;
        powerupSpawnInterval = 5 + Math.random() * 5;
        spawnPowerup();
    }
}

function updateOrbSpawning(dt) {
    orbSpawnTimer += dt;
    if (orbSpawnTimer >= orbSpawnInterval && orbs.length < ORB_MAX) {
        orbSpawnTimer = 0;
        orbSpawnInterval = 7 + Math.random() * 8;
        spawnOrb();
    }
}

function updateActivePowerups(dt) {
    for (const [, player] of players) {
        if (player.activePowerups.speed > 0) player.activePowerups.speed -= dt;
        if (player.activePowerups.efficiency > 0) player.activePowerups.efficiency -= dt;
        if (player.activePowerups.magnet > 0) player.activePowerups.magnet -= dt;
    }
}

function updateRegeneration(dt) {
    for (const [, player] of players) {
        if (player.orbBonuses.regeneration > 0) {
            player.food += player.orbBonuses.regeneration * dt;
        }
    }
}

function updateCollisions() {
    // Players collect food, powerups, orbs
    for (const [, player] of players) {
        if (!player.alive) continue;

        const magnetMult = player.activePowerups.magnet > 0 ? 2 : 1;
        const efficiencyMult = player.activePowerups.efficiency > 0 ? 2 : 1;
        const visualRadius = 20 + Math.sqrt(player.population) * 0.8;
        const baseCollect = 20 + player.orbBonuses.collectionRange * 10;
        const collectRadius = (visualRadius * 1.5 + baseCollect) * magnetMult;
        const cr2 = collectRadius * collectRadius;

        // Food
        for (let i = food.length - 1; i >= 0; i--) {
            const f = food[i];
            const dx = f.x - player.x;
            const dy = f.y - player.y;
            if (dx * dx + dy * dy <= cr2) {
                player.food += (f.value + player.orbBonuses.foodValue) * efficiencyMult;
                food.splice(i, 1);
            }
        }

        // Powerups
        for (let i = powerups.length - 1; i >= 0; i--) {
            const pu = powerups[i];
            const dx = pu.x - player.x;
            const dy = pu.y - player.y;
            if (dx * dx + dy * dy <= cr2) {
                applyPowerup(player, pu.type);
                powerups.splice(i, 1);
            }
        }

        // Orbs
        for (let i = orbs.length - 1; i >= 0; i--) {
            const orb = orbs[i];
            const dx = orb.x - player.x;
            const dy = orb.y - player.y;
            if (dx * dx + dy * dy <= cr2) {
                const typeDef = ORB_TYPES[orb.typeIndex];
                player.orbBonuses[typeDef.type] += orb.value;
                orbs.splice(i, 1);
            }
        }
    }

}

// ==============================================
// PVP - COMBAT ENTRE JOUEURS
// ==============================================

function updatePvP(dt) {
    const playerArr = [...players.values()].filter(p => p.alive);

    for (let i = 0; i < playerArr.length; i++) {
        for (let j = i + 1; j < playerArr.length; j++) {
            const a = playerArr[i];
            const b = playerArr[j];

            const dx = a.x - b.x;
            const dy = a.y - b.y;
            const dist2 = dx * dx + dy * dy;

            const radiusA = 20 + Math.sqrt(a.population) * 0.8;
            const radiusB = 20 + Math.sqrt(b.population) * 0.8;
            const contactDist = radiusA + radiusB;

            if (dist2 > contactDist * contactDist) continue;

            // Cooldown check
            const now = globalTime;
            const cdKeyAB = a.id + ':' + b.id;
            const cdKeyBA = b.id + ':' + a.id;
            if (a.pvpCooldowns[cdKeyAB] && now - a.pvpCooldowns[cdKeyAB] < PVP_COOLDOWN) continue;

            // Le plus gros absorbe le plus petit
            let attacker, victim;
            if (a.population > b.population) {
                attacker = a; victim = b;
            } else if (b.population > a.population) {
                attacker = b; victim = a;
            } else {
                continue; // Population egale, pas d'attaque
            }

            // Bouclier protege
            if (victim.activePowerups.shield) {
                victim.activePowerups.shield = false;
                a.pvpCooldowns[cdKeyAB] = now;
                b.pvpCooldowns[cdKeyBA] = now;
                continue;
            }

            // Voler de la population
            const stolen = Math.max(1, Math.floor(victim.population * PVP_STEAL_RATIO));
            victim.population = Math.max(1, victim.population - stolen);
            attacker.population += stolen;

            // Voler aussi de la nourriture
            const foodStolen = Math.floor(victim.food * 0.1);
            if (foodStolen > 0) {
                victim.food -= foodStolen;
                attacker.food += foodStolen;
            }

            // Set cooldown
            a.pvpCooldowns[cdKeyAB] = now;
            b.pvpCooldowns[cdKeyBA] = now;

            // Notifier les clients du combat
            broadcast({
                type: 'pvp',
                attackerId: attacker.id,
                victimId: victim.id,
                stolen
            });
        }
    }
}

function applyPowerup(player, type) {
    switch (type) {
        case 'speed': player.activePowerups.speed = 10; break;
        case 'efficiency': player.activePowerups.efficiency = 15; break;
        case 'magnet': player.activePowerups.magnet = 12; break;
        case 'shield': player.activePowerups.shield = true; break;
    }
}

// ==============================================
// DIVISION
// ==============================================

function updateDivisionTimer(dt) {
    divisionTimer -= dt;
    if (divisionTimer <= 0) {
        performDivision();
        divisionTimer = DIVISION_INTERVAL;
    }
}

function performDivision() {
    const results = [];

    for (const [id, player] of players) {
        if (!player.alive) continue;
        const before = player.population;
        divideColony(player);
        results.push({ id, before, after: player.population });
    }

    broadcast({ type: 'division', results });
}

function divideColony(colony) {
    const newPop = colony.population * 2;
    const costReduction = Math.max(0.2, 1 - colony.orbBonuses.foodCost * 0.02);
    const foodNeeded = Math.ceil(newPop * costReduction);

    if (colony.food >= foodNeeded) {
        const dupBonus = Math.floor(newPop * colony.orbBonuses.duplication * 0.01);
        colony.population = newPop + dupBonus;
        colony.food -= foodNeeded;
    } else if (colony.activePowerups.shield) {
        colony.population = newPop;
        colony.activePowerups.shield = false;
    } else {
        if (colony.food > 0) {
            colony.population = Math.floor(colony.food);
            colony.food = 0;
        }
        colony.population = Math.max(1, colony.population);
    }
}

// ==============================================
// VICTORY
// ==============================================

function checkVictory() {
    for (const [id, player] of players) {
        if (player.population >= VICTORY_POP) {
            gamePhase = 'victory';
            broadcast({ type: 'victory', winnerId: id, winnerName: player.name });
            if (gameLoopInterval) {
                clearInterval(gameLoopInterval);
                gameLoopInterval = null;
            }
            // Auto-reset to lobby after 10 seconds
            setTimeout(() => resetGame(), 10000);
            return;
        }
    }
}

// ==============================================
// BROADCAST
// ==============================================

function broadcastLobby() {
    const playerList = [];
    for (const [id, p] of players) {
        playerList.push({
            id, name: p.name, color: p.color,
            isHost: id === hostId
        });
    }
    broadcast({ type: 'lobby', players: playerList });
}

function broadcastState() {
    const playerData = [];
    for (const [id, p] of players) {
        playerData.push({
            id, name: p.name, color: p.color,
            x: Math.round(p.x), y: Math.round(p.y),
            population: p.population,
            food: Math.round(p.food),
            activePowerups: {
                speed: Math.max(0, p.activePowerups.speed),
                efficiency: Math.max(0, p.activePowerups.efficiency),
                magnet: Math.max(0, p.activePowerups.magnet),
                shield: p.activePowerups.shield
            },
            orbBonuses: p.orbBonuses
        });
    }

    // Send personalized state (each player gets their own id)
    const baseState = {
        type: 'state',
        players: playerData,
        food: food.map(f => ({ x: Math.round(f.x), y: Math.round(f.y), value: f.value, size: f.size })),
        powerups: powerups.map(p => ({ x: Math.round(p.x), y: Math.round(p.y), type: p.type, size: p.size })),
        orbs: orbs.map(o => ({ x: Math.round(o.x), y: Math.round(o.y), typeIndex: o.typeIndex, value: o.value, size: o.size })),
        divisionTimer: Math.max(0, divisionTimer),
        time: globalTime
    };

    const msg = JSON.stringify(baseState);

    for (const [id, player] of players) {
        if (player.ws && player.ws.readyState === 1) {
            player.ws.send(msg);
        }
    }
}

function broadcast(msg) {
    const data = JSON.stringify(msg);
    for (const [, player] of players) {
        if (player.ws && player.ws.readyState === 1) {
            player.ws.send(data);
        }
    }
}

// ==============================================
// UTILS
// ==============================================

function clamp(v, min, max) { return Math.max(min, Math.min(max, v)); }

function getMaxPopulation() {
    let max = 0;
    for (const [, p] of players) {
        if (p.population > max) max = p.population;
    }
    return max;
}

// ==============================================
// GET LOCAL IP
// ==============================================

function getLocalIP() {
    const interfaces = os.networkInterfaces();
    for (const name of Object.keys(interfaces)) {
        for (const iface of interfaces[name]) {
            if (iface.family === 'IPv4' && !iface.internal) {
                return iface.address;
            }
        }
    }
    return 'localhost';
}

// ==============================================
// START
// ==============================================

server.listen(PORT, '0.0.0.0', () => {
    const ip = getLocalIP();
    console.log('===========================================');
    console.log('  VICTORIA MIROIRE - MULTIJOUEUR');
    console.log('===========================================');
    console.log(`  Local:   http://localhost:${PORT}`);
    console.log(`  Reseau:  http://${ip}:${PORT}`);
    console.log('');
    console.log('  Partagez le lien reseau aux autres joueurs');
    console.log('  sur le meme WiFi.');
    console.log('===========================================');
});
