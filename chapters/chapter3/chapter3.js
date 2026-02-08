/**
 * CHAPITRE 3 : LA MUTATION
 *
 * Top-Down Survival dans une flaque d'eau
 * La bacterie miroir doit atteindre une population de 30 000
 * en collectant de la nourriture et en survivant aux divisions cellulaires.
 * Des colonies ennemies (bacteries normales vertes) competent pour les ressources.
 */

export class Chapter3 {
    constructor(game) {
        this.game = game;
        this.colors = game.getColors ? game.getColors() : {
            CYAN: '#00ffff', LIFE_MIRROR: '#b944ff',
            LIFE_NORMAL: '#44ff88', DANGER: '#ff4444',
            BG_DARK: '#111111', UI_TEXT: '#eeeeee', UI_DIM: '#666666'
        };

        // --- MAP ---
        this.MAP_SIZE = 8000;
        this.VICTORY_POP = 30000;

        // --- CAMERA ---
        this.cameraX = 0;
        this.cameraY = 0;
        this.cameraZoom = 1;
        this.targetZoom = 1;

        // --- PLAYER COLONY ---
        this.player = {
            x: this.MAP_SIZE / 2,
            y: this.MAP_SIZE / 2,
            population: 1,
            food: 0,
            speed: 200,
            collectionRadius: 40,
            sprites: [],
            visualRadius: 20
        };

        // --- ENEMIES ---
        this.enemies = [];
        this.ENEMY_COUNT = 10;

        // --- FOOD ---
        this.foodParticles = [];
         this.FOOD_MAX = 500;
         this.FOOD_SPAWN_RATE = 8; // per second
        this.foodSpawnTimer = 0;

        // --- DIVISION TIMER ---
        this.DIVISION_INTERVAL = 20;
        this.divisionTimer = this.DIVISION_INTERVAL;

        // --- POWER-UPS ---
        this.powerups = [];
         this.POWERUP_MAX = 10;
         this.powerupSpawnTimer = 0;
         this.powerupSpawnInterval = 12; // 10-17s randomized
        this.activePowerups = {
            speed: 0,
            efficiency: 0,
            magnet: 0,
            shield: false
        };

        // --- ORBS (permanent bonuses) ---
        this.orbs = [];
         this.ORB_MAX = 15;
         this.orbSpawnTimer = 0;
         this.orbSpawnInterval = 18;
        this.ORB_TYPES = [
            { type: 'foodValue',       label: 'NUTRIMENT',   abbr: 'NUT', color: '#66ff66', glowRgb: '102, 255, 102', min: 1, max: 10, unit: '+', desc: 'nourriture' },
            { type: 'foodCost',        label: 'ECONOMIE',    abbr: 'ECO', color: '#ff66aa', glowRgb: '255, 102, 170', min: 1, max: 5,  unit: '-%', desc: 'cout division' },
            { type: 'speed',           label: 'VELOCITE',    abbr: 'VIT', color: '#44ddff', glowRgb: '68, 221, 255',  min: 1, max: 5,  unit: '+', desc: 'vitesse' },
            { type: 'collectionRange', label: 'PORTEE',      abbr: 'POR', color: '#ffaa44', glowRgb: '255, 170, 68',  min: 1, max: 5,  unit: '+', desc: 'zone recolte' },
            { type: 'regeneration',    label: 'REGENERATION', abbr: 'REG', color: '#88ffaa', glowRgb: '136, 255, 170', min: 1, max: 5,  unit: '/s', desc: 'regen passive' },
            { type: 'duplication',     label: 'DUPLICATION', abbr: 'DUP', color: '#ff88dd', glowRgb: '255, 136, 221', min: 1, max: 5,  unit: '%', desc: 'bonus division' }
        ];
        this.orbBonuses = {
            foodValue: 0,
            foodCost: 0,
            speed: 0,
            collectionRange: 0,
            regeneration: 0,
            duplication: 0
        };
        this.orbNotifications = []; // floating text when orb collected

        // --- SPATIAL GRID ---
        this.GRID_CELL = 200;
        this.spatialGrid = new Map();

        // --- PARTICLES (visual effects) ---
        this.particles = [];

        // --- STATE ---
         this.closestBonus = null;
        this.globalTime = 0;
        this.minimapTimer = 0;
        this.minimapCtx = null;

        // --- TUTORIAL ---
        this.tutorialActive = false;
        this.tutorialStep = 0;
        this.tutorialSteps = [
            { title: "Chapitre 3 : La Mutation", content: "Vous etes la bacterie miroir, echappee dans une flaque d'eau. Survivez et multipliez-vous." },
            { title: "Deplacement", content: "Deplacez la souris pour guider votre colonie. Elle suivra le curseur." },
            { title: "Nourriture", content: "Collectez les particules jaune-vert pour nourrir votre colonie. Passez dessus pour les absorber." },
            { title: "Division Cellulaire", content: "Toutes les 20 secondes, votre population double. Mais il faut assez de nourriture, sinon les bacteries meurent !" },
            { title: "Objectif", content: "Atteignez une population de 30 000 pour declencher la mutation. Bonne chance." }
        ];

        // --- VICTORY ANIMATION ---
        this.victoryPhase = 0;
        this.victoryTimer = 0;
        this.mutationBacteria = null;
        this.victoryFlashAlpha = 0;

        // --- CAUSTIC PATTERN ---
         this.lowFoodWarning = false;

        this.init();
    }

    // ==========================================
    // INITIALIZATION
    // ==========================================

    async init() {
        await this.loadChapterUI();
        this.cacheDOMRefs();
        this.generateEnemies();
        this.generateInitialFood();
        this.generatePlayerSprites();
        this.centerCamera();
        this.phase = 'tutorial';
        this.showUI();
        this.startTutorial();
    }

    async loadChapterUI() {
        if (!document.getElementById('chapter3-css')) {
            const link = document.createElement('link');
            link.id = 'chapter3-css';
            link.rel = 'stylesheet';
            link.href = './chapters/chapter3/chapter3.css';
            document.head.appendChild(link);
            await new Promise(resolve => {
                link.onload = resolve;
                link.onerror = resolve;
            });
        }

        if (!document.getElementById('ch3-ui')) {
            const response = await fetch('./chapters/chapter3/chapter3.html');
            const html = await response.text();
            const parser = new DOMParser();
            const doc = parser.parseFromString(html, 'text/html');
            const template = doc.getElementById('chapter3-template');
            if (template) {
                const content = template.content.cloneNode(true);
                document.getElementById('ui-overlay').appendChild(content);
            }
        }
    }

    cacheDOMRefs() {
        this.dom = {
            ui: document.getElementById('ch3-ui'),
            popCount: document.getElementById('ch3-pop-count'),
            popBar: document.getElementById('ch3-pop-bar'),
            foodCount: document.getElementById('ch3-food-count'),
            foodBar: document.getElementById('ch3-food-bar'),
            timerValue: document.getElementById('ch3-timer-value'),
            powerups: document.getElementById('ch3-powerups'),
            warning: document.getElementById('ch3-warning'),
            minimap: document.getElementById('ch3-minimap'),
            tutorialOverlay: document.getElementById('ch3-tutorial-overlay'),
            tutorialBubble: document.getElementById('ch3-tutorial-bubble'),
            tutorialTitle: document.getElementById('ch3-tutorial-title'),
            tutorialContent: document.getElementById('ch3-tutorial-content'),
            tutorialNext: document.getElementById('ch3-tutorial-next'),
            tutorialSkip: document.getElementById('ch3-tutorial-skip'),
            tutorialProgress: document.getElementById('ch3-tutorial-progress'),
            bonuses: document.getElementById('ch3-bonuses')
        };

        if (this.dom.minimap) {
            this.minimapCtx = this.dom.minimap.getContext('2d');
        }
    }

    showUI() {
        if (this.dom.ui) {
            this.dom.ui.classList.remove('hidden');
            this.dom.ui.style.opacity = '1';
        }
    }

    hideUI() {
        if (this.dom.ui) {
            this.dom.ui.style.opacity = '0';
        }
    }

    // ==========================================
    // GENERATION
    // ==========================================

    generateEnemies() {
        this.enemies = [];
        const count = 8 + Math.floor(Math.random() * 5); // 8-12

        for (let i = 0; i < count; i++) {
            const angle = (i / count) * Math.PI * 2 + (Math.random() - 0.5) * 0.5;
            const dist = 1500 + Math.random() * 2500;
            const cx = this.MAP_SIZE / 2 + Math.cos(angle) * dist;
            const cy = this.MAP_SIZE / 2 + Math.sin(angle) * dist;

            const x = Math.max(400, Math.min(this.MAP_SIZE - 400, cx));
            const y = Math.max(400, Math.min(this.MAP_SIZE - 400, cy));

            const enemy = {
                x, y,
                population: 5 + Math.floor(Math.random() * 10),
                food: 3,
                speed: 100 + Math.random() * 60,
                sprites: [],
                visualRadius: 20,
                targetX: x,
                targetY: y,
                wanderTimer: 0,
                dead: false
            };
            this.generateEnemySprites(enemy);
            this.enemies.push(enemy);
        }
    }

    generatePlayerSprites() {
        this.player.sprites = [];
        const count = Math.min(200, this.player.population);
        for (let i = 0; i < count; i++) {
            this.player.sprites.push(this.createSwarmSprite());
        }
    }

    generateEnemySprites(enemy) {
        enemy.sprites = [];
        const count = Math.min(30, enemy.population);
        for (let i = 0; i < count; i++) {
            enemy.sprites.push(this.createSwarmSprite());
        }
    }

    createSwarmSprite() {
        const angle = Math.random() * Math.PI * 2;
        const dist = Math.random();
        return {
            offsetX: Math.cos(angle) * dist,
            offsetY: Math.sin(angle) * dist,
            phase: Math.random() * Math.PI * 2,
            speed: 1 + Math.random() * 2,
            size: 2 + Math.random() * 3
        };
    }

    generateInitialFood() {
        for (let i = 0; i < 100; i++) {
            this.spawnFood();
        }
    }

    spawnFood() {
        const maxFood = Math.floor(this.FOOD_MAX * this.getFoodMultiplier());
        if (this.foodParticles.length >= maxFood) return;

        const margin = 300;
        const x = margin + Math.random() * (this.MAP_SIZE - margin * 2);
        const y = margin + Math.random() * (this.MAP_SIZE - margin * 2);

        this.foodParticles.push({
            x, y,
            value: 1 + Math.floor(this.globalTime / 15),
            size: 3 + Math.random() * 3,
            phase: Math.random() * Math.PI * 2,
            pulse: 0.5 + Math.random() * 0.5
        });
    }

    // ==========================================
    // SPATIAL GRID
    // ==========================================

    clearSpatialGrid() {
        this.spatialGrid.clear();
    }

    getSpatialKey(x, y) {
        const gx = Math.floor(x / this.GRID_CELL);
        const gy = Math.floor(y / this.GRID_CELL);
        return gx + ',' + gy;
    }

    insertIntoGrid(entity, type) {
        const key = this.getSpatialKey(entity.x, entity.y);
        if (!this.spatialGrid.has(key)) {
            this.spatialGrid.set(key, []);
        }
        this.spatialGrid.get(key).push({ entity, type });
    }

    queryGrid(x, y, radius) {
        const results = [];
        const minGx = Math.floor((x - radius) / this.GRID_CELL);
        const maxGx = Math.floor((x + radius) / this.GRID_CELL);
        const minGy = Math.floor((y - radius) / this.GRID_CELL);
        const maxGy = Math.floor((y + radius) / this.GRID_CELL);

        for (let gx = minGx; gx <= maxGx; gx++) {
            for (let gy = minGy; gy <= maxGy; gy++) {
                const key = gx + ',' + gy;
                const cell = this.spatialGrid.get(key);
                if (cell) {
                    for (const item of cell) {
                        const dx = item.entity.x - x;
                        const dy = item.entity.y - y;
                        if (dx * dx + dy * dy <= radius * radius) {
                            results.push(item);
                        }
                    }
                }
            }
        }
        return results;
    }

    rebuildSpatialGrid() {
        this.clearSpatialGrid();
        for (const food of this.foodParticles) {
            this.insertIntoGrid(food, 'food');
        }
        for (const pu of this.powerups) {
            this.insertIntoGrid(pu, 'powerup');
        }
        for (const orb of this.orbs) {
            this.insertIntoGrid(orb, 'orb');
        }
    }

    // ==========================================
    // UPDATE
    // ==========================================

    update(deltaTime, timestamp) {
        if (this.phase === 'loading') return;
        if (this.tutorialActive) return;

        if (this.phase === 'victory') {
            this.updateVictory(deltaTime);
            return;
        }

        if (this.phase !== 'playing') return;

        this.globalTime += deltaTime;
        this.causticTime += deltaTime;

         // Rebuild spatial grid
         this.rebuildSpatialGrid();

         this.updateClosestBonus();

        // Update systems
        this.updatePlayer(deltaTime);
        this.updateEnemies(deltaTime);
        this.updateFoodSpawning(deltaTime);
        this.updatePowerupSpawning(deltaTime);
        this.updateOrbSpawning(deltaTime);
        this.updateActivePowerups(deltaTime);
        this.updateRegeneration(deltaTime);
        this.updateDivisionTimer(deltaTime);
         this.updateClosestBonus();
         this.updateCollisions();
        this.updateParticles(deltaTime);
        this.updateOrbNotifications(deltaTime);
        this.updateCamera(deltaTime);
        this.updateHUD();
        this.updateMinimap(deltaTime);

        // Check victory
        if (this.player.population >= this.VICTORY_POP) {
            this.startVictory();
        }
    }

    // ==========================================
    // PLAYER
    // ==========================================

    updatePlayer(deltaTime) {
        const mouse = this.game.getMouse();
        const { width, height } = this.game.getCanvasSize();

        // Convert screen mouse to world coordinates
        const worldMouseX = mouse.x / this.cameraZoom + this.cameraX;
        const worldMouseY = mouse.y / this.cameraZoom + this.cameraY;

        // Move towards mouse
        const dx = worldMouseX - this.player.x;
        const dy = worldMouseY - this.player.y;
        const dist = Math.sqrt(dx * dx + dy * dy);

        if (dist > 5) {
            const speedMult = this.activePowerups.speed > 0 ? 1.5 : 1;
            const baseSpeed = 200 + this.orbBonuses.speed * 20;
            const speed = baseSpeed * speedMult;
            const moveX = (dx / dist) * speed * deltaTime;
            const moveY = (dy / dist) * speed * deltaTime;

            this.player.x += moveX;
            this.player.y += moveY;
        }

        // Clamp to map bounds with wrap-around
        this.player.x = ((this.player.x % this.MAP_SIZE) + this.MAP_SIZE) % this.MAP_SIZE;
        this.player.y = ((this.player.y % this.MAP_SIZE) + this.MAP_SIZE) % this.MAP_SIZE;

        // Update visual radius
        this.player.visualRadius = 20 + Math.sqrt(this.player.population) * 0.8;

        // Update sprite count
        this.syncSprites(this.player, 200);
    }

    // ==========================================
    // ENEMIES
    // ==========================================

    updateEnemies(deltaTime) {
        for (const enemy of this.enemies) {
            if (enemy.dead) continue;

            // AI: find closest food within 800px
            let closestFood = null;
            let closestDist = 800;

            for (const food of this.foodParticles) {
                const dx = food.x - enemy.x;
                const dy = food.y - enemy.y;
                const d = Math.sqrt(dx * dx + dy * dy);
                if (d < closestDist) {
                    closestDist = d;
                    closestFood = food;
                }
            }

            if (closestFood) {
                enemy.targetX = closestFood.x;
                enemy.targetY = closestFood.y;
                enemy.wanderTimer = 0;
            } else {
                // Wander randomly
                enemy.wanderTimer -= deltaTime;
                if (enemy.wanderTimer <= 0) {
                    enemy.wanderTimer = 2 + Math.random() * 3;
                    const angle = Math.random() * Math.PI * 2;
                    const wDist = 200 + Math.random() * 400;
                    enemy.targetX = Math.max(400, Math.min(this.MAP_SIZE - 400, enemy.x + Math.cos(angle) * wDist));
                    enemy.targetY = Math.max(400, Math.min(this.MAP_SIZE - 400, enemy.y + Math.sin(angle) * wDist));
                }
            }

            // Move towards target
            const dx = enemy.targetX - enemy.x;
            const dy = enemy.targetY - enemy.y;
            const dist = Math.sqrt(dx * dx + dy * dy);
            if (dist > 5) {
                enemy.x += (dx / dist) * enemy.speed * deltaTime;
                enemy.y += (dy / dist) * enemy.speed * deltaTime;
            }

            // Clamp with wrap-around
            enemy.x = ((enemy.x % this.MAP_SIZE) + this.MAP_SIZE) % this.MAP_SIZE;
            enemy.y = ((enemy.y % this.MAP_SIZE) + this.MAP_SIZE) % this.MAP_SIZE;

            // Update visual radius
            enemy.visualRadius = 15 + Math.sqrt(enemy.population) * 0.6;

            // Sync sprites
            this.syncSprites(enemy, 30);
        }

        // Remove dead enemies
        this.enemies = this.enemies.filter(e => !e.dead);
    }

    // ==========================================
    // FOOD SPAWNING
    // ==========================================

    getFoodMultiplier() {
        return 1 + 9 * Math.min(1, this.player.population / this.VICTORY_POP);
    }

    updateFoodSpawning(deltaTime) {
        const mult = this.getFoodMultiplier();
        const rate = this.FOOD_SPAWN_RATE * mult;
        this.foodSpawnTimer += deltaTime;
        const spawnInterval = 1 / rate;
        while (this.foodSpawnTimer >= spawnInterval) {
            this.foodSpawnTimer -= spawnInterval;
            this.spawnFood();
        }
    }

    // ==========================================
    // POWER-UPS
    // ==========================================

    updatePowerupSpawning(deltaTime) {
        this.powerupSpawnTimer += deltaTime;
        if (this.powerupSpawnTimer >= this.powerupSpawnInterval && this.powerups.length < this.POWERUP_MAX) {
            this.powerupSpawnTimer = 0;
             this.powerupSpawnInterval = 5 + Math.random() * 5;
            this.spawnPowerup();
        }
    }

    spawnPowerup() {
        const types = ['speed', 'efficiency', 'magnet', 'shield'];
        const type = types[Math.floor(Math.random() * types.length)];

        const margin = 500;
        const x = margin + Math.random() * (this.MAP_SIZE - margin * 2);
        const y = margin + Math.random() * (this.MAP_SIZE - margin * 2);

        this.powerups.push({
            x, y, type,
            size: 12,
            phase: Math.random() * Math.PI * 2
        });
    }

    updateActivePowerups(deltaTime) {
        if (this.activePowerups.speed > 0) this.activePowerups.speed -= deltaTime;
        if (this.activePowerups.efficiency > 0) this.activePowerups.efficiency -= deltaTime;
        if (this.activePowerups.magnet > 0) this.activePowerups.magnet -= deltaTime;
    }

    applyPowerup(type) {
        switch (type) {
            case 'speed':
                this.activePowerups.speed = 10;
                break;
            case 'efficiency':
                this.activePowerups.efficiency = 15;
                break;
            case 'magnet':
                this.activePowerups.magnet = 12;
                break;
            case 'shield':
                this.activePowerups.shield = true;
                break;
        }
    }

    // ==========================================
    // ORBS (permanent bonuses)
    // ==========================================

    updateOrbSpawning(deltaTime) {
        this.orbSpawnTimer += deltaTime;
        if (this.orbSpawnTimer >= this.orbSpawnInterval && this.orbs.length < this.ORB_MAX) {
            this.orbSpawnTimer = 0;
             this.orbSpawnInterval = 7 + Math.random() * 8;
            this.spawnOrb();
        }
    }

    spawnOrb() {
        const typeDef = this.ORB_TYPES[Math.floor(Math.random() * this.ORB_TYPES.length)];
        const value = typeDef.min + Math.floor(Math.random() * (typeDef.max - typeDef.min + 1));

        const margin = 600;
        const x = margin + Math.random() * (this.MAP_SIZE - margin * 2);
        const y = margin + Math.random() * (this.MAP_SIZE - margin * 2);

        this.orbs.push({
            x, y,
            typeDef,
            value,
            size: 16,
            phase: Math.random() * Math.PI * 2,
            rotation: Math.random() * Math.PI * 2
        });
    }

    collectOrb(orb) {
        // Apply permanent bonus
        this.orbBonuses[orb.typeDef.type] += orb.value;

        // Visual effect
        this.spawnCollectEffect(orb.x, orb.y, orb.typeDef.color);
        for (let i = 0; i < 15; i++) {
            const angle = Math.random() * Math.PI * 2;
            const speed = 60 + Math.random() * 120;
            this.particles.push({
                x: orb.x, y: orb.y,
                vx: Math.cos(angle) * speed,
                vy: Math.sin(angle) * speed,
                life: 0.6 + Math.random() * 0.4,
                maxLife: 1,
                color: orb.typeDef.color,
                size: 3 + Math.random() * 5
            });
        }

        // Floating notification
        let text;
        switch (orb.typeDef.type) {
            case 'foodValue':       text = `NUTRIMENT +${orb.value}`; break;
            case 'foodCost':        text = `ECONOMIE -${orb.value * 2}%`; break;
            case 'speed':           text = `VELOCITE +${orb.value}`; break;
            case 'collectionRange': text = `PORTEE +${orb.value}`; break;
            case 'regeneration':    text = `REGEN +${orb.value}/s`; break;
            case 'duplication':     text = `DUPLICATION +${orb.value}%`; break;
        }
        this.orbNotifications.push({
            text,
            color: orb.typeDef.color,
            x: orb.x,
            y: orb.y,
            life: 2,
            maxLife: 2
        });
    }

    updateRegeneration(deltaTime) {
        if (this.orbBonuses.regeneration > 0) {
            this.player.food += this.orbBonuses.regeneration * deltaTime;
        }
    }

    updateOrbNotifications(deltaTime) {
        for (let i = this.orbNotifications.length - 1; i >= 0; i--) {
            const n = this.orbNotifications[i];
            n.y -= 30 * deltaTime;
            n.life -= deltaTime;
            if (n.life <= 0) {
                this.orbNotifications.splice(i, 1);
            }
        }
    }

    updateClosestBonus() {
        let closest = null;
        let minDist = Infinity;
        const px = this.player.x;
        const py = this.player.y;

        // Check power-ups
        for (const pu of this.powerups) {
            const dx = pu.x - px;
            const dy = pu.y - py;
            const dist = dx * dx + dy * dy;
            if (dist < minDist) {
                minDist = dist;
                closest = pu;
            }
        }

        // Check orbs
        for (const orb of this.orbs) {
            const dx = orb.x - px;
            const dy = orb.y - py;
            const dist = dx * dx + dy * dy;
            if (dist < minDist) {
                minDist = dist;
                closest = orb;
            }
        }

        this.closestBonus = closest;
    }

    // ==========================================
    // DIVISION TIMER
    // ==========================================

    updateDivisionTimer(deltaTime) {
        this.divisionTimer -= deltaTime;

        // Check for low food warning
        const foodNeeded = this.player.population * 2;
        if (this.divisionTimer <= 5 && this.player.food < foodNeeded) {
            this.lowFoodWarning = true;
        } else {
            this.lowFoodWarning = false;
        }

        // Warning at 5 seconds
        if (this.dom.warning) {
            if (this.divisionTimer <= 5 && this.divisionTimer > 0) {
                this.dom.warning.classList.remove('hidden');
            } else {
                this.dom.warning.classList.add('hidden');
            }
        }

        if (this.divisionTimer <= 0) {
            this.performDivision();
            this.divisionTimer = this.DIVISION_INTERVAL;
        }
    }

    performDivision() {
        // Player division
        this.divideColony(this.player);

        // Enemy divisions
        for (const enemy of this.enemies) {
            if (!enemy.dead) {
                this.divideColony(enemy);
            }
        }

        // Spawn visual effect
        this.spawnDivisionEffect(this.player.x, this.player.y, '#b944ff');
    }

    divideColony(colony) {
        const newPop = colony.population * 2;
        // Apply food cost reduction from orbs (only for player)
        const costReduction = colony === this.player ? Math.max(0.2, 1 - this.orbBonuses.foodCost * 0.02) : 1;
        const foodNeeded = Math.ceil(newPop * costReduction);

        if (colony.food >= foodNeeded) {
            // Successful division + duplication bonus
            const dupBonus = colony === this.player ? Math.floor(newPop * this.orbBonuses.duplication * 0.01) : 0;
            colony.population = newPop + dupBonus;
            colony.food -= foodNeeded;
        } else if (colony === this.player && this.activePowerups.shield) {
            // Shield protects from failed division
            colony.population = newPop;
            this.activePowerups.shield = false;
        } else {
            // Failed division: only fed bacteria survive
            if (colony.food > 0) {
                colony.population = Math.floor(colony.food);
                colony.food = 0;
            }
            // Minimum 1 for player
            if (colony === this.player) {
                colony.population = Math.max(1, colony.population);
            } else {
                if (colony.population <= 0) {
                    colony.dead = true;
                    colony.population = 0;
                }
            }
        }
    }

    spawnDivisionEffect(x, y, color) {
        for (let i = 0; i < 20; i++) {
            const angle = Math.random() * Math.PI * 2;
            const speed = 50 + Math.random() * 150;
            this.particles.push({
                x, y,
                vx: Math.cos(angle) * speed,
                vy: Math.sin(angle) * speed,
                life: 0.5 + Math.random() * 0.5,
                maxLife: 1,
                color,
                size: 3 + Math.random() * 4
            });
        }
    }

    // ==========================================
    // COLLISIONS
    // ==========================================

    updateCollisions() {
        const magnetMult = this.activePowerups.magnet > 0 ? 2 : 1;
        const efficiencyMult = this.activePowerups.efficiency > 0 ? 2 : 1;
        const baseCollectRadius = 20 + this.orbBonuses.collectionRange * 10;
        const collectRadius = (this.player.visualRadius * 1.5 + baseCollectRadius) * magnetMult;

        // Player collects food
        const nearPlayer = this.queryGrid(this.player.x, this.player.y, collectRadius);
        for (const item of nearPlayer) {
            if (item.type === 'food') {
                const foodGain = (item.entity.value + this.orbBonuses.foodValue) * efficiencyMult;
                this.player.food += foodGain;
                const idx = this.foodParticles.indexOf(item.entity);
                if (idx !== -1) {
                    this.spawnCollectEffect(item.entity.x, item.entity.y, '#bbff44');
                    this.foodParticles.splice(idx, 1);
                }
            } else if (item.type === 'powerup') {
                this.applyPowerup(item.entity.type);
                const idx = this.powerups.indexOf(item.entity);
                if (idx !== -1) {
                    this.spawnCollectEffect(item.entity.x, item.entity.y, '#ffffff');
                    this.powerups.splice(idx, 1);
                }
            } else if (item.type === 'orb') {
                this.collectOrb(item.entity);
                const idx = this.orbs.indexOf(item.entity);
                if (idx !== -1) {
                    this.orbs.splice(idx, 1);
                }
            }
        }

        // Enemies collect food
        for (const enemy of this.enemies) {
            if (enemy.dead) continue;
            const enemyRadius = enemy.visualRadius + 30;
            for (let i = this.foodParticles.length - 1; i >= 0; i--) {
                const food = this.foodParticles[i];
                const dx = food.x - enemy.x;
                const dy = food.y - enemy.y;
                if (dx * dx + dy * dy <= enemyRadius * enemyRadius) {
                    enemy.food += food.value;
                    this.foodParticles.splice(i, 1);
                }
            }
        }
    }

    spawnCollectEffect(x, y, color) {
        for (let i = 0; i < 6; i++) {
            const angle = Math.random() * Math.PI * 2;
            const speed = 30 + Math.random() * 80;
            this.particles.push({
                x, y,
                vx: Math.cos(angle) * speed,
                vy: Math.sin(angle) * speed,
                life: 0.3 + Math.random() * 0.3,
                maxLife: 0.6,
                color,
                size: 2 + Math.random() * 3
            });
        }
    }

    // ==========================================
    // SPRITE SYNC
    // ==========================================

    syncSprites(colony, maxSprites) {
        const targetCount = Math.min(maxSprites, colony.population);
        while (colony.sprites.length < targetCount) {
            colony.sprites.push(this.createSwarmSprite());
        }
        while (colony.sprites.length > targetCount) {
            colony.sprites.pop();
        }
    }

    // ==========================================
    // PARTICLES
    // ==========================================

    updateParticles(deltaTime) {
        for (let i = this.particles.length - 1; i >= 0; i--) {
            const p = this.particles[i];
            p.x += p.vx * deltaTime;
            p.y += p.vy * deltaTime;
            p.life -= deltaTime;
            if (p.life <= 0) {
                this.particles.splice(i, 1);
            }
        }
    }

    // ==========================================
    // CAMERA
    // ==========================================

    updateCamera(deltaTime) {
        const { width, height } = this.game.getCanvasSize();

        const targetCamX = this.player.x - (width / 2) / this.cameraZoom;
        const targetCamY = this.player.y - (height / 2) / this.cameraZoom;

        // Lerp
        const lerpSpeed = 3;
        this.cameraX += (targetCamX - this.cameraX) * lerpSpeed * deltaTime;
        this.cameraY += (targetCamY - this.cameraY) * lerpSpeed * deltaTime;

        // Zoom lerp
        this.cameraZoom += (this.targetZoom - this.cameraZoom) * 2 * deltaTime;

        // Clamp camera to map
        this.cameraX = Math.max(0, Math.min(this.MAP_SIZE - width / this.cameraZoom, this.cameraX));
        this.cameraY = Math.max(0, Math.min(this.MAP_SIZE - height / this.cameraZoom, this.cameraY));
    }

    centerCamera() {
        const { width, height } = this.game.getCanvasSize();
        this.cameraX = this.player.x - width / 2;
        this.cameraY = this.player.y - height / 2;
    }

    isVisible(x, y, margin = 100) {
        const { width, height } = this.game.getCanvasSize();
        const screenX = (x - this.cameraX) * this.cameraZoom;
        const screenY = (y - this.cameraY) * this.cameraZoom;
        return screenX > -margin && screenX < width + margin &&
               screenY > -margin && screenY < height + margin;
    }

    // ==========================================
    // HUD
    // ==========================================

    updateHUD() {
        if (!this.dom.popCount) return;

        // Population
        this.dom.popCount.textContent = this.formatNumber(this.player.population);
        const popPercent = Math.min(100, (this.player.population / this.VICTORY_POP) * 100);
        this.dom.popBar.style.width = popPercent + '%';

        // Food
        const foodNeeded = this.player.population * 2;
        this.dom.foodCount.textContent = this.formatNumber(Math.floor(this.player.food));
        const foodPercent = Math.min(100, (this.player.food / foodNeeded) * 100);
        this.dom.foodBar.style.width = foodPercent + '%';

        // Timer
        const timeLeft = Math.max(0, Math.ceil(this.divisionTimer));
        this.dom.timerValue.textContent = timeLeft + 's';
        if (this.divisionTimer <= 5) {
            this.dom.timerValue.classList.add('ch3-timer-warning');
        } else {
            this.dom.timerValue.classList.remove('ch3-timer-warning');
        }

        // Power-ups display
        this.updatePowerupDisplay();

        // Orb bonuses display
        this.updateBonusDisplay();
    }

    formatNumber(n) {
        if (n >= 1000) {
            return (n / 1000).toFixed(1).replace(/\.0$/, '') + 'k';
        }
        return Math.floor(n).toString();
    }

    updatePowerupDisplay() {
        if (!this.dom.powerups) return;

        let html = '';
        if (this.activePowerups.speed > 0) {
            const pct = (this.activePowerups.speed / 10) * 100;
            html += `<div class="ch3-powerup-icon ch3-powerup-speed" title="Vitesse"><span style="position:relative;z-index:1">SPD</span><div style="position:absolute;bottom:0;left:0;width:100%;height:${pct}%;background:rgba(68,255,255,0.3)"></div></div>`;
        }
        if (this.activePowerups.efficiency > 0) {
            const pct = (this.activePowerups.efficiency / 15) * 100;
            html += `<div class="ch3-powerup-icon ch3-powerup-efficiency" title="Efficacite"><span style="position:relative;z-index:1">EFF</span><div style="position:absolute;bottom:0;left:0;width:100%;height:${pct}%;background:rgba(255,204,68,0.3)"></div></div>`;
        }
        if (this.activePowerups.magnet > 0) {
            const pct = (this.activePowerups.magnet / 12) * 100;
            html += `<div class="ch3-powerup-icon ch3-powerup-magnet" title="Aimant"><span style="position:relative;z-index:1">MAG</span><div style="position:absolute;bottom:0;left:0;width:100%;height:${pct}%;background:rgba(255,136,68,0.3)"></div></div>`;
        }
        if (this.activePowerups.shield) {
            html += `<div class="ch3-powerup-icon ch3-powerup-shield" title="Bouclier"><span style="position:relative;z-index:1">SHD</span></div>`;
        }

        this.dom.powerups.innerHTML = html;
    }

    updateBonusDisplay() {
        if (!this.dom.bonuses) return;

        let html = '';
        for (const typeDef of this.ORB_TYPES) {
            const val = this.orbBonuses[typeDef.type];
            if (val <= 0) continue;

            let display;
            switch (typeDef.type) {
                case 'foodValue':       display = `+${val}`; break;
                case 'foodCost':        display = `-${val * 2}%`; break;
                case 'speed':           display = `+${val}`; break;
                case 'collectionRange': display = `+${val}`; break;
                case 'regeneration':    display = `+${val}/s`; break;
                case 'duplication':     display = `+${val}%`; break;
            }

            html += `<div class="ch3-bonus-item" style="border-color:${typeDef.color}; color:${typeDef.color}">
                <span class="ch3-bonus-abbr">${typeDef.abbr}</span>
                <span class="ch3-bonus-val">${display}</span>
            </div>`;
        }

        this.dom.bonuses.innerHTML = html;
    }

    // ==========================================
    // MINIMAP
    // ==========================================

    updateMinimap(deltaTime) {
        this.minimapTimer += deltaTime;
        if (this.minimapTimer < 0.5) return;
        this.minimapTimer = 0;

        if (!this.minimapCtx) return;
        const ctx = this.minimapCtx;
        const size = 150;
        const scale = size / this.MAP_SIZE;

        // Background
        ctx.fillStyle = 'rgba(5, 10, 30, 0.9)';
        ctx.fillRect(0, 0, size, size);

        // Puddle edge circle


        // Food (yellow dots)
        ctx.fillStyle = '#bbff44';
        for (const food of this.foodParticles) {
            const fx = food.x * scale;
            const fy = food.y * scale;
            ctx.fillRect(fx, fy, 1, 1);
        }

        // Orbs (colored dots)
        for (const orb of this.orbs) {
            ctx.fillStyle = orb.typeDef.color;
            const ox = orb.x * scale;
            const oy = orb.y * scale;
            ctx.beginPath();
            ctx.arc(ox, oy, 2, 0, Math.PI * 2);
            ctx.fill();
        }

        // Enemies (green dots)
        ctx.fillStyle = this.colors.LIFE_NORMAL;
        for (const enemy of this.enemies) {
            if (enemy.dead) continue;
            const ex = enemy.x * scale;
            const ey = enemy.y * scale;
            const eSize = Math.max(2, enemy.visualRadius * scale * 2);
            ctx.beginPath();
            ctx.arc(ex, ey, eSize / 2, 0, Math.PI * 2);
            ctx.fill();
        }

        // Player (purple dot)
        ctx.fillStyle = this.colors.LIFE_MIRROR;
        const px = this.player.x * scale;
        const py = this.player.y * scale;
        const pSize = Math.max(3, this.player.visualRadius * scale * 2);
        ctx.beginPath();
        ctx.arc(px, py, pSize / 2, 0, Math.PI * 2);
        ctx.fill();

        // Camera viewport rectangle
        const { width, height } = this.game.getCanvasSize();
        ctx.strokeStyle = 'rgba(255, 255, 255, 0.3)';
        ctx.lineWidth = 1;
        ctx.strokeRect(
            this.cameraX * scale,
            this.cameraY * scale,
            (width / this.cameraZoom) * scale,
            (height / this.cameraZoom) * scale
        );
    }

    // ==========================================
    // TUTORIAL
    // ==========================================

    startTutorial() {
        this.tutorialActive = true;
        this.tutorialStep = 0;
        this.showTutorialStep();
    }

    showTutorialStep() {
        if (!this.dom.tutorialOverlay) return;

        const step = this.tutorialSteps[this.tutorialStep];
        if (!step) {
            this.endTutorial();
            return;
        }

        this.dom.tutorialOverlay.classList.add('active');
        this.dom.tutorialTitle.textContent = step.title;
        this.dom.tutorialContent.textContent = step.content;

        // Progress dots
        let dotsHtml = '';
        for (let i = 0; i < this.tutorialSteps.length; i++) {
            dotsHtml += `<div class="ch3-tutorial-dot ${i === this.tutorialStep ? 'active' : ''}"></div>`;
        }
        this.dom.tutorialProgress.innerHTML = dotsHtml;

        // Show bubble with animation
        setTimeout(() => {
            this.dom.tutorialBubble.classList.add('visible');
        }, 50);

        // Button handlers
        this.dom.tutorialNext.onclick = () => this.nextTutorialStep();
        this.dom.tutorialSkip.onclick = () => this.endTutorial();
    }

    nextTutorialStep() {
        this.dom.tutorialBubble.classList.remove('visible');
        this.tutorialStep++;

        if (this.tutorialStep >= this.tutorialSteps.length) {
            setTimeout(() => this.endTutorial(), 300);
        } else {
            setTimeout(() => this.showTutorialStep(), 300);
        }
    }

    endTutorial() {
        this.tutorialActive = false;
        if (this.dom.tutorialOverlay) {
            this.dom.tutorialOverlay.classList.remove('active');
            this.dom.tutorialBubble.classList.remove('visible');
        }
        this.phase = 'playing';
    }

    // ==========================================
    // VICTORY SEQUENCE
    // ==========================================

    startVictory() {
        this.phase = 'victory';
        this.victoryPhase = 0;
        this.victoryTimer = 0;
        this.victoryFlashAlpha = 0;

        // Choose a mutation bacteria position
        this.mutationBacteria = {
            x: this.player.x + (Math.random() - 0.5) * this.player.visualRadius,
            y: this.player.y + (Math.random() - 0.5) * this.player.visualRadius,
            pulseRadius: 0
        };
    }

    updateVictory(deltaTime) {
        this.victoryTimer += deltaTime;
        this.causticTime += deltaTime;

        switch (this.victoryPhase) {
            case 0: // Freeze (1s) + flash
                this.victoryFlashAlpha = Math.min(1, this.victoryTimer * 2);
                if (this.victoryTimer >= 1) {
                    this.victoryPhase = 1;
                    this.victoryTimer = 0;
                    this.victoryFlashAlpha = 1;
                }
                break;

            case 1: // Zoom out (2s)
                this.victoryFlashAlpha = Math.max(0, 1 - this.victoryTimer);
                this.targetZoom = 0.15;
                this.cameraZoom += (this.targetZoom - this.cameraZoom) * 1.5 * deltaTime;
                // Center on player
                {
                    const { width, height } = this.game.getCanvasSize();
                    const targetCamX = this.player.x - (width / 2) / this.cameraZoom;
                    const targetCamY = this.player.y - (height / 2) / this.cameraZoom;
                    this.cameraX += (targetCamX - this.cameraX) * 2 * deltaTime;
                    this.cameraY += (targetCamY - this.cameraY) * 2 * deltaTime;
                }
                if (this.victoryTimer >= 2) {
                    this.victoryPhase = 2;
                    this.victoryTimer = 0;
                }
                break;

            case 2: // Mutation (2s) - red pulse
                this.mutationBacteria.pulseRadius = this.victoryTimer * 300;
                if (this.victoryTimer >= 2) {
                    this.victoryPhase = 3;
                    this.victoryTimer = 0;
                }
                break;

            case 3: // Zoom in (4s) on mutation bacteria
                this.targetZoom = 4;
                this.cameraZoom += (this.targetZoom - this.cameraZoom) * 1.2 * deltaTime;
                {
                    const { width, height } = this.game.getCanvasSize();
                    const targetCamX = this.mutationBacteria.x - (width / 2) / this.cameraZoom;
                    const targetCamY = this.mutationBacteria.y - (height / 2) / this.cameraZoom;
                    this.cameraX += (targetCamX - this.cameraX) * 2 * deltaTime;
                    this.cameraY += (targetCamY - this.cameraY) * 2 * deltaTime;
                }
                if (this.victoryTimer >= 4) {
                    this.victoryPhase = 4;
                    this.victoryTimer = 0;
                    this.hideUI();
                    this.showVictoryDialogue();
                }
                break;

            case 4: // Dialogue (waiting for game.showDialogue callback)
                break;
        }
    }

    showVictoryDialogue() {
        this.game.showDialogue([
            "Une bacterie se detache du groupe.",
            "L'évolution a fait son travaille...",
            "Cette bacterie autrefois benine a subi une mutation aléatoire qui la rend maintenant agressive.",
        ], () => {
            this.game.chapterComplete("La vie trouve toujours un chemin...");
        });
    }
    // DRAW
    // ==========================================

    draw(ctx) {
        const { width, height } = this.game.getCanvasSize();

        // Clear
        ctx.fillStyle = '#030a15';
        ctx.fillRect(0, 0, width, height);

        ctx.save();
        ctx.scale(this.cameraZoom, this.cameraZoom);
        ctx.translate(-this.cameraX, -this.cameraY);

        // Background water
        this.drawBackground(ctx, width, height);

        // Food particles
        this.drawFood(ctx);

        // Power-ups
        this.drawPowerups(ctx);

        // Orbs
        this.drawOrbs(ctx);

        // Enemies
        this.drawEnemies(ctx);

        // Player
        this.drawPlayer(ctx);

        // Low food warning animation
        if (this.lowFoodWarning) {
            const pulse = Math.sin(this.globalTime * 10) * 0.3 + 0.7;
            ctx.strokeStyle = `rgba(255, 0, 0, ${pulse})`;
            ctx.lineWidth = 8;
            ctx.beginPath();
            ctx.arc(this.player.x, this.player.y, this.player.visualRadius + 15, 0, Math.PI * 2);
            ctx.stroke();
        }

        // Collection range indicator
        const magnetMult = this.activePowerups.magnet > 0 ? 2 : 1;
        const baseCollectRadius = 20 + this.orbBonuses.collectionRange * 10;
        const collectRadius = (this.player.visualRadius * 1.5 + baseCollectRadius) * magnetMult;
        ctx.fillStyle = 'rgba(128, 128, 128, 0.2)';
        ctx.beginPath();
        ctx.arc(this.player.x, this.player.y, collectRadius, 0, Math.PI * 2);
        ctx.fill();

        // Bonus arrow (world space)
        this.drawBonusArrowWorld(ctx);

        // Particles
        this.drawParticles(ctx);

        // Orb notifications (floating text)
        this.drawOrbNotifications(ctx);

        // Victory effects
        if (this.phase === 'victory') {
            this.drawVictoryEffects(ctx);
        }

        // Map boundary
        this.drawMapBoundary(ctx);

        ctx.restore();

        // Victory flash overlay (screen space)
        if (this.victoryFlashAlpha > 0) {
            ctx.fillStyle = `rgba(255, 255, 255, ${this.victoryFlashAlpha * 0.8})`;
            ctx.fillRect(0, 0, width, height);
        }
    }

    // ==========================================
    // DRAW: BACKGROUND
    // ==========================================

    drawBackground(ctx, screenWidth, screenHeight) {
        const viewLeft = this.cameraX;
        const viewTop = this.cameraY;
        const viewRight = this.cameraX + screenWidth / this.cameraZoom;
        const viewBottom = this.cameraY + screenHeight / this.cameraZoom;

        // Water gradient (slightly visible grid for depth)
        const center = this.MAP_SIZE / 2;

        // Draw caustic light patterns
        const cellSize = 120;
        const startCol = Math.floor(viewLeft / cellSize);
        const endCol = Math.ceil(viewRight / cellSize);
        const startRow = Math.floor(viewTop / cellSize);
        const endRow = Math.ceil(viewBottom / cellSize);

        for (let row = startRow; row <= endRow; row++) {
            for (let col = startCol; col <= endCol; col++) {
                const x = col * cellSize;
                const y = row * cellSize;

                // Distance from center for puddle edge darkening
                const dx = (x + cellSize / 2) - center;
                const dy = (y + cellSize / 2) - center;
                const distFromCenter = Math.sqrt(dx * dx + dy * dy);
                const edgeFactor = Math.max(0, 1 - distFromCenter / (this.MAP_SIZE * 0.45));

                // Caustic pattern using sin waves
                const caustic = (
                    Math.sin((x * 0.008) + this.causticTime * 0.7) *
                    Math.sin((y * 0.008) + this.causticTime * 0.5) +
                    Math.sin((x * 0.012 + y * 0.006) + this.causticTime * 0.9) * 0.5
                ) * 0.5 + 0.5;

                const brightness = Math.floor(8 + caustic * 15 * edgeFactor);
                const blueBase = Math.floor(20 + caustic * 25 * edgeFactor);

                ctx.fillStyle = `rgb(${brightness}, ${brightness + 2}, ${blueBase})`;
                ctx.fillRect(x, y, cellSize + 1, cellSize + 1);
            }
        }

        // Removed puddle edge ring
    }

    // ==========================================
    // DRAW: FOOD
    // ==========================================

    drawFood(ctx) {
        for (const food of this.foodParticles) {
            if (!this.isVisible(food.x, food.y, 20)) continue;

            const pulse = Math.sin(this.globalTime * food.pulse * 4 + food.phase) * 0.3 + 0.7;
            const size = food.size * pulse;

            ctx.fillStyle = `rgba(180, 230, 80, ${0.6 + pulse * 0.4})`;
            ctx.beginPath();
            ctx.arc(food.x, food.y, size, 0, Math.PI * 2);
            ctx.fill();

            // Glow
            ctx.fillStyle = `rgba(200, 255, 100, ${0.15 * pulse})`;
            ctx.beginPath();
            ctx.arc(food.x, food.y, size * 2.5, 0, Math.PI * 2);
            ctx.fill();
        }
    }

    // ==========================================
    // DRAW: POWER-UPS
    // ==========================================

    drawPowerups(ctx) {
        for (const pu of this.powerups) {
            if (!this.isVisible(pu.x, pu.y, 30)) continue;

            const bob = Math.sin(this.globalTime * 2 + pu.phase) * 4;
            const y = pu.y + bob;
            const glow = (Math.sin(this.globalTime * 3 + pu.phase) * 0.3 + 0.7);

            let color, glowColor;
            switch (pu.type) {
                case 'speed':
                    color = '#44ffff';
                    glowColor = 'rgba(68, 255, 255, 0.3)';
                    this.drawTriangle(ctx, pu.x, y, pu.size, color);
                    break;
                case 'efficiency':
                    color = '#ffcc44';
                    glowColor = 'rgba(255, 204, 68, 0.3)';
                    this.drawStar(ctx, pu.x, y, pu.size, color);
                    break;
                case 'magnet':
                    color = '#ff8844';
                    glowColor = 'rgba(255, 136, 68, 0.3)';
                    this.drawRing(ctx, pu.x, y, pu.size, color);
                    break;
                case 'shield':
                    color = '#ffffff';
                    glowColor = 'rgba(255, 255, 255, 0.3)';
                    this.drawDiamond(ctx, pu.x, y, pu.size, color);
                    break;
            }

            // Glow aura
            ctx.fillStyle = glowColor;
            ctx.globalAlpha = glow * 0.5;
            ctx.beginPath();
            ctx.arc(pu.x, y, pu.size * 2, 0, Math.PI * 2);
            ctx.fill();
            ctx.globalAlpha = 1;
        }
    }

    drawTriangle(ctx, x, y, size, color) {
        ctx.fillStyle = color;
        ctx.beginPath();
        ctx.moveTo(x, y - size);
        ctx.lineTo(x - size * 0.87, y + size * 0.5);
        ctx.lineTo(x + size * 0.87, y + size * 0.5);
        ctx.closePath();
        ctx.fill();
    }

    drawStar(ctx, x, y, size, color) {
        ctx.fillStyle = color;
        ctx.beginPath();
        for (let i = 0; i < 5; i++) {
            const outerAngle = (i * 72 - 90) * Math.PI / 180;
            const innerAngle = ((i * 72) + 36 - 90) * Math.PI / 180;
            if (i === 0) {
                ctx.moveTo(x + Math.cos(outerAngle) * size, y + Math.sin(outerAngle) * size);
            } else {
                ctx.lineTo(x + Math.cos(outerAngle) * size, y + Math.sin(outerAngle) * size);
            }
            ctx.lineTo(x + Math.cos(innerAngle) * size * 0.4, y + Math.sin(innerAngle) * size * 0.4);
        }
        ctx.closePath();
        ctx.fill();
    }

    drawRing(ctx, x, y, size, color) {
        ctx.strokeStyle = color;
        ctx.lineWidth = 3;
        ctx.beginPath();
        ctx.arc(x, y, size, 0, Math.PI * 2);
        ctx.stroke();
        ctx.beginPath();
        ctx.arc(x, y, size * 0.5, 0, Math.PI * 2);
        ctx.stroke();
    }

    drawDiamond(ctx, x, y, size, color) {
        ctx.fillStyle = color;
        ctx.beginPath();
        ctx.moveTo(x, y - size);
        ctx.lineTo(x + size * 0.7, y);
        ctx.lineTo(x, y + size);
        ctx.lineTo(x - size * 0.7, y);
        ctx.closePath();
        ctx.fill();
    }

    // ==========================================
    // DRAW: ORBS
    // ==========================================

    drawOrbs(ctx) {
        for (const orb of this.orbs) {
            if (!this.isVisible(orb.x, orb.y, 40)) continue;

            const bob = Math.sin(this.globalTime * 1.5 + orb.phase) * 5;
            const y = orb.y + bob;
            const glow = Math.sin(this.globalTime * 2 + orb.phase) * 0.3 + 0.7;
            const rot = orb.rotation + this.globalTime * 0.5;

            // Outer glow
            ctx.fillStyle = `rgba(${orb.typeDef.glowRgb}, ${0.15 * glow})`;
            ctx.beginPath();
            ctx.arc(orb.x, y, orb.size * 3, 0, Math.PI * 2);
            ctx.fill();

            // Hexagon shape
            ctx.save();
            ctx.translate(orb.x, y);
            ctx.rotate(rot);
            ctx.fillStyle = orb.typeDef.color;
            ctx.globalAlpha = 0.9;
            ctx.beginPath();
            for (let i = 0; i < 6; i++) {
                const a = (i * 60) * Math.PI / 180;
                const px = Math.cos(a) * orb.size;
                const py = Math.sin(a) * orb.size;
                if (i === 0) ctx.moveTo(px, py);
                else ctx.lineTo(px, py);
            }
            ctx.closePath();
            ctx.fill();

            // Inner highlight
            ctx.fillStyle = '#ffffff';
            ctx.globalAlpha = 0.4 * glow;
            ctx.beginPath();
            ctx.arc(0, 0, orb.size * 0.4, 0, Math.PI * 2);
            ctx.fill();

            ctx.globalAlpha = 1;
            ctx.restore();

            // Value label
            ctx.fillStyle = orb.typeDef.color;
            ctx.font = 'bold 10px Courier New';
            ctx.textAlign = 'center';
            ctx.fillText(orb.typeDef.abbr, orb.x, y + orb.size + 14);
        }
    }

    drawOrbNotifications(ctx) {
        for (const n of this.orbNotifications) {
            const alpha = Math.min(1, n.life / (n.maxLife * 0.3));
            ctx.fillStyle = n.color;
            ctx.globalAlpha = alpha;
            ctx.font = 'bold 16px Courier New';
            ctx.textAlign = 'center';
            ctx.fillText(n.text, n.x, n.y);
        }
        ctx.globalAlpha = 1;
        ctx.textAlign = 'start';
    }

    // ==========================================
    // DRAW: SWARM (player or enemy)
    // ==========================================

    drawSwarm(ctx, colony, baseColor, highlightColor) {
        if (!this.isVisible(colony.x, colony.y, colony.visualRadius + 50)) return;

        const radius = colony.visualRadius;

        // Glow underneath
        ctx.fillStyle = `rgba(${highlightColor}, 0.08)`;
        ctx.beginPath();
        ctx.arc(colony.x, colony.y, radius * 1.5, 0, Math.PI * 2);
        ctx.fill();

        // Individual bacteria sprites
        for (const sprite of colony.sprites) {
            const wobbleX = Math.sin(this.globalTime * sprite.speed + sprite.phase) * 3;
            const wobbleY = Math.cos(this.globalTime * sprite.speed * 0.7 + sprite.phase) * 3;
            const sx = colony.x + sprite.offsetX * radius + wobbleX;
            const sy = colony.y + sprite.offsetY * radius + wobbleY;

            ctx.fillStyle = baseColor;
            ctx.globalAlpha = 0.7 + Math.sin(this.globalTime * 2 + sprite.phase) * 0.3;
            ctx.beginPath();
            ctx.arc(sx, sy, sprite.size, 0, Math.PI * 2);
            ctx.fill();
        }
        ctx.globalAlpha = 1;
    }

    drawPlayer(ctx) {
        this.drawSwarm(ctx, this.player, '#c060ff', '185, 68, 255');

        // Center bright spot
        ctx.fillStyle = '#e0a0ff';
        ctx.beginPath();
        ctx.arc(this.player.x, this.player.y, 4, 0, Math.PI * 2);
        ctx.fill();
    }

    drawEnemies(ctx) {
        for (const enemy of this.enemies) {
            if (enemy.dead) continue;
            this.drawSwarm(ctx, enemy, '#44cc66', '68, 204, 102');
        }
    }

    // ==========================================
    // DRAW: PARTICLES
    // ==========================================

    drawParticles(ctx) {
        for (const p of this.particles) {
            const alpha = Math.max(0, p.life / p.maxLife);
            ctx.fillStyle = p.color;
            ctx.globalAlpha = alpha;
            ctx.beginPath();
            ctx.arc(p.x, p.y, p.size * alpha, 0, Math.PI * 2);
            ctx.fill();
        }
        ctx.globalAlpha = 1;
    }

    // ==========================================
    // DRAW: MAP BOUNDARY
    // ==========================================

    drawMapBoundary(ctx) {
        // Removed large boundary circles
    }

    // ==========================================
    // DRAW: VICTORY EFFECTS
    // ==========================================

    drawVictoryEffects(ctx) {
        if (!this.mutationBacteria) return;

        // Red mutation bacteria
        if (this.victoryPhase >= 2) {
            const mb = this.mutationBacteria;

            // Red pulse wave
            if (mb.pulseRadius > 0) {
                ctx.strokeStyle = 'rgba(255, 50, 50, 0.4)';
                ctx.lineWidth = 6;
                ctx.beginPath();
                ctx.arc(mb.x, mb.y, mb.pulseRadius, 0, Math.PI * 2);
                ctx.stroke();

                // Second wave
                if (mb.pulseRadius > 100) {
                    ctx.strokeStyle = 'rgba(255, 50, 50, 0.2)';
                    ctx.lineWidth = 4;
                    ctx.beginPath();
                    ctx.arc(mb.x, mb.y, mb.pulseRadius * 0.6, 0, Math.PI * 2);
                    ctx.stroke();
                }
            }

            // The mutated bacteria itself
            const pulse = Math.sin(this.victoryTimer * 6) * 3 + 10;
            ctx.fillStyle = '#ff3333';
            ctx.shadowColor = '#ff0000';
            ctx.shadowBlur = 20;
            ctx.beginPath();
            ctx.arc(mb.x, mb.y, pulse, 0, Math.PI * 2);
            ctx.fill();
            ctx.shadowBlur = 0;

            // Inner glow
            ctx.fillStyle = '#ff8888';
            ctx.beginPath();
            ctx.arc(mb.x, mb.y, pulse * 0.4, 0, Math.PI * 2);
            ctx.fill();
        }
    }

    drawBonusArrowWorld(ctx) {
        if (!this.closestBonus || this.phase !== 'playing') return;

        const px = this.player.x;
        const py = this.player.y;
        const bx = this.closestBonus.x;
        const by = this.closestBonus.y;

        // Vector from player to bonus
        const dx = bx - px;
        const dy = by - py;
        const dist = Math.sqrt(dx * dx + dy * dy);
        if (dist < 100) return; // Don't show if too close

        // Direction
        const dirX = dx / dist;
        const dirY = dy / dist;

        // Arrow position: 50 units ahead of player
        const arrowX = px + dirX * 50;
        const arrowY = py + dirY * 50;

        // Draw arrow
        ctx.save();
        ctx.translate(arrowX, arrowY);
        const angle = Math.atan2(dirY, dirX);
        ctx.rotate(angle);

        // Arrow shape
        ctx.fillStyle = '#ffffff';
        ctx.beginPath();
        ctx.moveTo(0, 0);
        ctx.lineTo(-8, -4);
        ctx.lineTo(-4, 0);
        ctx.lineTo(-8, 4);
        ctx.closePath();
        ctx.fill();

        // Glow
        ctx.fillStyle = 'rgba(255, 255, 255, 0.3)';
        ctx.beginPath();
        ctx.arc(0, 0, 12, 0, Math.PI * 2);
        ctx.fill();

        ctx.restore();
    }

    // ==========================================
    // DESTROY (cleanup)
    // ==========================================

    destroy() {
        this.hideUI();
        const ui = document.getElementById('ch3-ui');
        if (ui) ui.remove();
        const tutOverlay = document.getElementById('ch3-tutorial-overlay');
        if (tutOverlay) tutOverlay.remove();
    }
}
