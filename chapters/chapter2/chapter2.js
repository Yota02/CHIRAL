/**
 * CHAPITRE 2 : L'INVISIBLE
 *
 * Platformer 2D - Evasion d'un laboratoire
 * La bacterie miroir doit s'echapper en evitant:
 * - Les zones de lumiere UV (sterilisation)
 * - Les robots de nettoyage (avec cone de detection)
 * - Les lasers intermittents
 * En se faufilant dans les conduits d'aeration et les fissures
 * Pour atteindre une flaque d'eau a l'exterieur
 */

export class Chapter2 {
    constructor(game) {
        this.game = game;
        this.colors = game.getColors ? game.getColors() : {
            CYAN: '#00ffff', LIFE_MIRROR: '#b944ff',
            LIFE_NORMAL: '#44ff88', DANGER: '#ff4444'
        };

        // --- CONSTANTES DE GAMEPLAY ---
        this.GRAVITY = 1800;
        this.JUMP_VELOCITY = -620;
        this.WALL_JUMP_VELOCITY_X = 400;
        this.WALL_JUMP_VELOCITY_Y = -550;
        this.MOVE_SPEED = 280;
        this.DASH_SPEED = 800;
        this.DASH_DURATION = 0.15;
        this.DASH_COOLDOWN = 1.2;
        this.MAX_FALL_SPEED = 800;
        this.VENT_SPEED = 200; // Vitesse dans les conduits

        // --- ETAT DU JOUEUR ---
        this.player = {
            x: 80, y: 100, width: 24, height: 24,
            vx: 0, vy: 0,
            grounded: false, onWall: false, wallDirection: 0,
            jumpsLeft: 2, canWallJump: false,
            isDashing: false, dashTimer: 0, dashCooldown: 0,
            dashDirection: 1, facingDirection: 1,
            isDead: false, attachedPlatform: null,
            inVent: false // Dans un conduit de ventilation
        };

        // --- NIVEAU ---
        this.platforms = [];
        this.movingPlatforms = [];
        this.crumblingPlatforms = [];
        this.robots = [];          // Robots de nettoyage
        this.uvZones = [];         // Zones UV fixes
        this.pulsingLasers = [];   // Lasers ON/OFF
        this.lightCones = [];      // Cones de lumiere rotatifs
        this.vents = [];           // Conduits de ventilation
        this.shadowZones = [];     // Zones d'ombre (safe)
        this.decorations = [];     // Elements de decor
        this.goal = null;

        this.cameraX = 0;
        this.cameraY = 0;
        this.levelWidth = 6000;
        this.levelHeight = 1400;
        this.globalTime = 0;

        // Zones du niveau pour la palette progressive
        this.ZONE_LAB_END = 3800;
        this.ZONE_VENT_END = 4600;
        // Au-dela = exterieur

        // Particules
        this.particles = [];
        this.waterParticles = []; // Particules de flaque

        // Etat du jeu
        this.gameOver = false;
        this.victory = false;
        this.victoryAnimation = false;
        this.victoryTimer = 0;
        this.bacteriaClones = [];

        // Points de réapparition
        this.respawnPoints = [];
        this.currentRespawnIndex = 0;

        // Tutoriel
        this.tutorialActive = false;
        this.tutorialStep = 0;
        this.tutorialSteps = [
            { title: "Chapitre 2 : L'Invisible", content: "Vous etes la bacterie miroir. Echappez-vous du laboratoire.", placement: 'center' },
            { title: "Lumiere = Danger", content: "Les zones eclairees et les UV vous sont fatals. Restez dans l'ombre.", placement: 'center' },
            { title: "Robots de Nettoyage", content: "Evitez leur cone de detection. Observez leurs patrouilles.", placement: 'center' },
            { title: "Conduits d'Aeration", content: "Les grilles bleues menent a des conduits. Faufilez-vous !", placement: 'center' }
        ];

        // Input tracking
        this.jumpPressed = false;
        this.dashPressed = false;

        this.init();
    }

    async init() {
        try {
            const oldUI = document.getElementById('ch2-ui');
            if (oldUI) oldUI.remove();
            await this.loadChapterUI();
            this.cacheDOMReferences();
            this.setupEventHandlers();
            this.generateLevel();
            this.showUI();
            this.game.setInstructions('');
            this.startTutorial();
        } catch (error) {
            console.error('Erreur init chapitre 2:', error);
        }
    }

    async loadChapterUI() {
        // Charger le CSS
        if (!document.getElementById('chapter2-css')) {
            const link = document.createElement('link');
            link.id = 'chapter2-css';
            link.rel = 'stylesheet';
            link.href = './chapters/chapter2/chapter2.css';
            document.head.appendChild(link);
            await new Promise(resolve => { link.onload = resolve; link.onerror = resolve; });
        }
        // Charger le HTML
        if (!document.getElementById('ch2-ui')) {
            try {
                const response = await fetch('./chapters/chapter2/chapter2.html');
                const html = await response.text();
                const parser = new DOMParser();
                const doc = parser.parseFromString(html, 'text/html');
                const template = doc.getElementById('chapter2-template');
                if (template) {
                    const content = template.content.cloneNode(true);
                    document.getElementById('ui-overlay').appendChild(content);
                }
            } catch (e) {
                this.createFallbackUI();
            }
        }
    }

    createFallbackUI() {
        const div = document.createElement('div');
        div.id = 'ch2-ui';
        div.innerHTML = `
            <div id="ch2-dash-meter">
                <div class="ch2-dash-label">DASH</div>
                <div class="ch2-dash-bar"><div id="ch2-dash-fill" class="ch2-dash-fill"></div></div>
                <div id="ch2-dash-status">Recharge</div>
            </div>
            <div id="ch2-tutorial-overlay" class="ch2-tutorial-overlay">
                <div id="ch2-tutorial-bubble" class="ch2-tutorial-bubble">
                    <div class="ch2-tutorial-header"><h3 id="ch2-tutorial-title"></h3></div>
                    <div id="ch2-tutorial-content" class="ch2-tutorial-content"></div>
                    <div class="ch2-tutorial-controls">
                        <button id="ch2-tutorial-skip" class="ch2-tutorial-btn ch2-tutorial-skip">PASSER</button>
                        <button id="ch2-tutorial-next" class="ch2-tutorial-btn ch2-tutorial-next">CONTINUER</button>
                    </div>
                    <div id="ch2-tutorial-progress" class="ch2-tutorial-progress"></div>
                </div>
            </div>`;
        document.getElementById('ui-overlay').appendChild(div);
    }

    cacheDOMReferences() {
        this.domElements = {
            container: document.getElementById('ch2-ui'),
            dashFill: document.getElementById('ch2-dash-fill'),
            dashStatus: document.getElementById('ch2-dash-status')
        };
    }

    setupEventHandlers() {
        const nextBtn = document.getElementById('ch2-tutorial-next');
        const skipBtn = document.getElementById('ch2-tutorial-skip');
        if (nextBtn) nextBtn.addEventListener('click', () => this.nextTutorialStep());
        if (skipBtn) skipBtn.addEventListener('click', () => this.skipTutorial());
    }

    showUI() {
        if (this.domElements.container) {
            this.domElements.container.style.display = 'block';
            this.domElements.container.style.opacity = '1';
        }
    }

    hideUI() {
        if (this.domElements.container) this.domElements.container.style.display = 'none';
    }

    destroy() {
        this.hideUI();
        this.endTutorial();
        const ui = document.getElementById('ch2-ui');
        if (ui) ui.remove();
    }

    // ============================================
    // GENERATION DU NIVEAU
    // ============================================

    generateLevel() {
        const h = this.levelHeight;

        this.platforms = [];
        this.movingPlatforms = [];
        this.crumblingPlatforms = [];
        this.robots = [];
        this.uvZones = [];
        this.pulsingLasers = [];
        this.lightCones = [];
        this.vents = [];
        this.shadowZones = [];
        this.decorations = [];

        // --- BORDURES ---
        this.platforms.push({ x: -50, y: 0, width: 50, height: h, type: 'wall' });
        this.platforms.push({ x: this.levelWidth, y: 0, width: 50, height: h, type: 'wall' });
        this.platforms.push({ x: 0, y: -50, width: this.levelWidth, height: 50, type: 'ceiling' });

        this.generateZone1_LabStart(h);
        this.generateZone2_LabCorridors(h);
        this.generateZone3_LabSecurity(h);
        this.generateZone4_VentTransition(h);
         this.generateZone5_Exterior(h);
         this.generateDecorations(h);

         // Points de réapparition aux entrées de chaque zone
         this.respawnPoints = [
             {x: 80, y: (h - 120) - 24}, // Entrée Zone 1 : Salle de labo
             {x: 1220, y: (h - 120) - 24}, // Entrée Zone 2 : Couloirs du labo
             {x: 2620, y: (h - 120) - 24}, // Entrée Zone 3 : Sécurité renforcée
             {x: 3840, y: (h - 300) - 24}, // Entrée Zone 4 : Conduit de transition
             {x: 4630, y: (h - 120) - 24}, // Entrée Zone 5 : Extérieur
         ];

         // Position de depart
         this.player.x = 80;
         this.player.y = this.respawnPoints[0].y;
    }

    // ZONE 1 : Salle de labo - Introduction (0 -> 1200)
    generateZone1_LabStart(h) {
        // Sol
        this.platforms.push({ x: 0, y: h - 120, width: 1200, height: 120, type: 'floor' });
        // Plafond de la salle
        this.platforms.push({ x: 0, y: 200, width: 1200, height: 40, type: 'ceiling_lab' });

        // Tables de labo (plateformes)
        this.platforms.push({ x: 200, y: h - 260, width: 180, height: 20, type: 'table' });
        this.platforms.push({ x: 500, y: h - 320, width: 150, height: 20, type: 'table' });
        this.platforms.push({ x: 750, y: h - 260, width: 160, height: 20, type: 'table' });

        // Zone d'ombre sous les tables
        this.shadowZones.push({ x: 200, y: h - 240, width: 180, height: 120 });
        this.shadowZones.push({ x: 750, y: h - 240, width: 160, height: 120 });

        // Premiere lumiere UV fixe (apprendre a eviter)
        this.uvZones.push({ x: 400, y: h - 260, width: 80, height: 140 });

        // Cone de lumiere rotatif lent
        this.lightCones.push({
            x: 600, y: 240, angle: Math.PI / 2,
            rotSpeed: 0.4, range: 350, width: 0.6,
            minAngle: Math.PI * 0.25, maxAngle: Math.PI * 0.75
        });

        // Decorations
        this.decorations.push({ x: 100, y: 200, type: 'lamp' });
        this.decorations.push({ x: 600, y: 200, type: 'lamp' });
        this.decorations.push({ x: 300, y: h - 260, type: 'microscope' });
        this.decorations.push({ x: 850, y: h - 260, type: 'flask' });
    }

    // ZONE 2 : Couloirs du labo (1200 -> 2600)
    generateZone2_LabCorridors(h) {
        // Mur separateur avec ouverture
        this.platforms.push({ x: 1200, y: 200, width: 40, height: h - 520, type: 'wall_lab' });
        this.platforms.push({ x: 1200, y: h - 120, width: 40, height: 120, type: 'wall_lab' });

        // Couloir bas
        this.platforms.push({ x: 1240, y: h - 120, width: 1360, height: 120, type: 'floor' });
        // Plafond couloir
        this.platforms.push({ x: 1240, y: 200, width: 1360, height: 40, type: 'ceiling_lab' });

        // Plateformes en hauteur
        this.platforms.push({ x: 1350, y: h - 400, width: 120, height: 20, type: 'shelf' });
        this.platforms.push({ x: 1600, y: h - 500, width: 100, height: 20, type: 'shelf' });
        this.platforms.push({ x: 1850, y: h - 380, width: 140, height: 20, type: 'shelf' });
        this.platforms.push({ x: 2100, y: h - 480, width: 120, height: 20, type: 'shelf' });

        // Robot de nettoyage 1 - patrouille au sol
        this.robots.push({
            x: 1400, y: h - 170, width: 50, height: 50,
            startX: 1300, endX: 1800, speed: 120, direction: 1, vx: 120,
            coneAngle: 0, coneRange: 200, coneWidth: 0.5,
            type: 'ground'
        });

        // Robot volant (drone) - patrouille en hauteur
        this.robots.push({
            x: 2000, y: h - 600, width: 40, height: 40,
            startX: 1800, endX: 2400, speed: 100, direction: 1, vx: 100,
            coneAngle: Math.PI / 2, coneRange: 250, coneWidth: 0.6,
            type: 'drone'
        });

        // Lasers pulsants dans le couloir
        this.pulsingLasers.push({ x: 1500, y: h - 320, width: 15, height: 200, interval: 2.5, offset: 0 });
        this.pulsingLasers.push({ x: 1950, y: h - 320, width: 15, height: 200, interval: 2.5, offset: 1.2 });

        // Zones d'ombre
        this.shadowZones.push({ x: 1240, y: h - 320, width: 100, height: 200 });
        this.shadowZones.push({ x: 1700, y: h - 300, width: 120, height: 180 });
        this.shadowZones.push({ x: 2200, y: h - 300, width: 100, height: 180 });

        // Cones de lumiere
        this.lightCones.push({
            x: 1500, y: 240, angle: Math.PI / 2,
            rotSpeed: 0.6, range: 300, width: 0.5,
            minAngle: Math.PI * 0.3, maxAngle: Math.PI * 0.7
        });
        this.lightCones.push({
            x: 2100, y: 240, angle: Math.PI / 2,
            rotSpeed: -0.5, range: 320, width: 0.5,
            minAngle: Math.PI * 0.3, maxAngle: Math.PI * 0.7
        });

        // Conduit de ventilation (raccourci par le haut)
        this.vents.push({
            entryX: 1280, entryY: h - 320, exitX: 1850, exitY: h - 400,
            width: 40, height: 40
        });

        this.decorations.push({ x: 1350, y: 200, type: 'lamp' });
        this.decorations.push({ x: 1800, y: 200, type: 'lamp' });
        this.decorations.push({ x: 2200, y: 200, type: 'lamp' });
        this.decorations.push({ x: 1600, y: h - 140, type: 'biohazard' });
    }

    // ZONE 3 : Securite renforcee (2600 -> 3800)
    generateZone3_LabSecurity(h) {
        // Mur separateur
        this.platforms.push({ x: 2600, y: 200, width: 40, height: h - 520, type: 'wall_lab' });
        this.platforms.push({ x: 2600, y: h - 120, width: 40, height: 120, type: 'wall_lab' });

        // Sol
        this.platforms.push({ x: 2640, y: h - 120, width: 1160, height: 120, type: 'floor' });
        // Plafond
        this.platforms.push({ x: 2640, y: 200, width: 1160, height: 40, type: 'ceiling_lab' });

        // Plateformes fragiles au-dessus du vide UV
        this.uvZones.push({ x: 2800, y: h - 140, width: 400, height: 20 });
        for (let i = 0; i < 4; i++) {
            this.crumblingPlatforms.push({
                x: 2820 + i * 100, y: h - 280,
                width: 70, height: 15,
                state: 'stable', timer: 0
            });
        }

        // Plateforme mobile verticale
        // this.movingPlatforms.push({
        //     x: 3250, y: h - 400, width: 80, height: 15,
        //     startY: h - 700, endY: h - 200, speed: 180, axis: 'y', dir: -1
        // });

        // Robot patrouilleur rapide
        this.robots.push({
            x: 2900, y: h - 170, width: 50, height: 50,
            startX: 2700, endX: 3100, speed: 180, direction: 1, vx: 180,
            coneAngle: 0, coneRange: 250, coneWidth: 0.6,
            type: 'ground'
        });

        // Robot drone rapide
        this.robots.push({
            x: 3400, y: h - 500, width: 40, height: 40,
            startX: 3200, endX: 3700, speed: 150, direction: -1, vx: -150,
            coneAngle: Math.PI / 2, coneRange: 280, coneWidth: 0.5,
            type: 'drone'
        });

        // Lasers croises
        this.pulsingLasers.push({ x: 3000, y: h - 500, width: 15, height: 380, interval: 2.0, offset: 0 });
        this.pulsingLasers.push({ x: 3300, y: h - 500, width: 15, height: 380, interval: 2.0, offset: 1.0 });
        this.pulsingLasers.push({ x: 3600, y: h - 400, width: 200, height: 12, interval: 1.8, offset: 0.5 });

        // Cones de lumiere rapides
        this.lightCones.push({
            x: 2900, y: 240, angle: Math.PI / 2,
            rotSpeed: 0.9, range: 350, width: 0.7,
            minAngle: Math.PI * 0.2, maxAngle: Math.PI * 0.8
        });
        this.lightCones.push({
            x: 3500, y: 240, angle: Math.PI / 2,
            rotSpeed: -0.7, range: 300, width: 0.6,
            minAngle: Math.PI * 0.2, maxAngle: Math.PI * 0.8
        });

        // Zones d'ombre
        this.shadowZones.push({ x: 2640, y: h - 280, width: 100, height: 160 });
        this.shadowZones.push({ x: 3100, y: h - 300, width: 80, height: 180 });

        // Conduit de ventilation vers la sortie
        this.vents.push({
            entryX: 3700, entryY: h - 300, exitX: 3850, exitY: h - 400,
            width: 40, height: 40
        });

        this.decorations.push({ x: 2800, y: 200, type: 'lamp' });
        this.decorations.push({ x: 3200, y: 200, type: 'lamp' });
        this.decorations.push({ x: 3600, y: 200, type: 'lamp' });
        this.decorations.push({ x: 3000, y: h - 140, type: 'biohazard' });
        this.decorations.push({ x: 3400, y: h - 140, type: 'biohazard' });
    }

    // ZONE 4 : Conduit de transition (3800 -> 4600)
    generateZone4_VentTransition(h) {
        // Mur final du labo - COMPLETEMENT ferme, oblige le passage par la ventilation
        this.platforms.push({ x: 3800, y: 200, width: 40, height: h - 200, type: 'wall_lab' });

        // Conduit d'aeration - structure en tunnel
        // Sol du conduit
        this.platforms.push({ x: 3840, y: h - 300, width: 760, height: 20, type: 'vent_wall' });
        // Plafond du conduit
        this.platforms.push({ x: 3840, y: h - 500, width: 760, height: 20, type: 'vent_wall' });
        // Sol en dessous (mort si on tombe)
        this.platforms.push({ x: 3840, y: h - 80, width: 760, height: 80, type: 'floor' });

        // Ventilateurs (obstacles rotatifs, traites comme lasers)
        this.pulsingLasers.push({ x: 4000, y: h - 480, width: 12, height: 160, interval: 2.0, offset: 0, type: 'fan' });
        this.pulsingLasers.push({ x: 4200, y: h - 480, width: 12, height: 160, interval: 2.0, offset: 1.0, type: 'fan' });
        this.pulsingLasers.push({ x: 4400, y: h - 480, width: 12, height: 160, interval: 1.5, offset: 0.5, type: 'fan' });

        // Plateformes dans le conduit
        this.platforms.push({ x: 3900, y: h - 400, width: 80, height: 15, type: 'vent_platform' });
        this.platforms.push({ x: 4080, y: h - 380, width: 80, height: 15, type: 'vent_platform' });
        this.platforms.push({ x: 4280, y: h - 420, width: 80, height: 15, type: 'vent_platform' });
        this.platforms.push({ x: 4480, y: h - 380, width: 80, height: 15, type: 'vent_platform' });

         // Zones d'ombre dans le conduit
         this.shadowZones.push({ x: 3840, y: h - 480, width: 760, height: 180 });

         // Conduit d'évacuation débloqué - sortie vers l'extérieur
         this.vents.push({
             entryX: 4520, entryY: h - 400, exitX: 4630, exitY: h - 280,
             width: 40, height: 40
         });
    }

    // ZONE 5 : Exterieur - Flaque d'eau (4600 -> 6000)
    generateZone5_Exterior(h) {
        // Mur de sortie du conduit
        this.platforms.push({ x: 4600, y: h - 500, width: 30, height: 200, type: 'wall_exit' });

        // Sol exterieur (herbe/terre)
        this.platforms.push({ x: 4600, y: h - 120, width: 1400, height: 120, type: 'ground_ext' });

        // Petit rebord de sortie
        this.platforms.push({ x: 4630, y: h - 280, width: 100, height: 15, type: 'rock' });
        this.platforms.push({ x: 4780, y: h - 220, width: 80, height: 15, type: 'rock' });

        // Dernier obstacle : lumiere du soleil intermittente (nuages)
        // this.lightCones.push({
        //     x: 4900, y: 0, angle: Math.PI / 2,
        //     rotSpeed: 0, range: h, width: 1.2,
        //     minAngle: Math.PI / 2, maxAngle: Math.PI / 2,
        //     isSunlight: true, interval: 4.0, offset: 0
        // });

        // Rochers pour se cacher
        this.platforms.push({ x: 4950, y: h - 200, width: 60, height: 80, type: 'rock' });
        this.shadowZones.push({ x: 4950, y: h - 200, width: 60, height: 80 });

        this.platforms.push({ x: 5100, y: h - 180, width: 50, height: 60, type: 'rock' });
        this.shadowZones.push({ x: 5100, y: h - 180, width: 50, height: 60 });

        // OBJECTIF : La flaque d'eau
        this.goal = { x: 5200, y: h - 150, width: 400, height: 50 };

        // Decorations exterieures
        this.decorations.push({ x: 4700, y: h - 120, type: 'grass' });
        this.decorations.push({ x: 4900, y: h - 120, type: 'grass' });
        this.decorations.push({ x: 5100, y: h - 120, type: 'grass' });
        this.decorations.push({ x: 5400, y: h - 120, type: 'grass' });
    }

    generateDecorations() {
        // Tuyaux le long du plafond dans les zones labo
        for (let x = 50; x < 3800; x += 300) {
            this.decorations.push({ x, y: 240, type: 'pipe_h' });
        }
        // Tuyaux verticaux
        this.decorations.push({ x: 600, y: 240, type: 'pipe_v', height: 200 });
        this.decorations.push({ x: 1800, y: 240, type: 'pipe_v', height: 250 });
        this.decorations.push({ x: 3200, y: 240, type: 'pipe_v', height: 200 });
    }

    // ============================================
    // UPDATE LOOP
    // ============================================

    update(deltaTime) {
        if (this.victory) {
            this.updateVictoryAnimation(deltaTime);
            return;
        }
        if (this.gameOver) return;

        this.globalTime += deltaTime;
        this.handleInput();
        this.updateMovingPlatforms(deltaTime);
        this.updateCrumblingPlatforms(deltaTime);
        this.updatePulsingLasers();
        this.updateLightCones(deltaTime);
        this.updateRobots(deltaTime);
        this.updatePlayer(deltaTime);
        this.updateCamera();
        this.updateParticles(deltaTime);
        this.checkCollisions();
        this.updateUI();
    }

    handleInput() {
        const keys = this.game.getKeys();
        const p = this.player;
        if (p.isDead || p.isDashing) return;

        let moveInput = 0;
        if (keys['ArrowLeft'] || keys['KeyA']) { moveInput = -1; p.facingDirection = -1; }
        if (keys['ArrowRight'] || keys['KeyD']) { moveInput = 1; p.facingDirection = 1; }

        if (!p.onWall || (p.onWall && moveInput !== p.wallDirection)) {
            p.vx = moveInput * (p.inVent ? this.VENT_SPEED : this.MOVE_SPEED);
        } else {
            p.vx = 0;
        }

        // Saut / Wall Jump
        if (keys['Space']) {
            if (!this.jumpPressed) {
                this.jumpPressed = true;
                if (p.onWall && p.canWallJump) {
                    p.vy = this.WALL_JUMP_VELOCITY_Y;
                    p.vx = -p.wallDirection * this.WALL_JUMP_VELOCITY_X;
                    p.facingDirection = -p.wallDirection;
                    p.onWall = false; p.canWallJump = false;
                    p.jumpsLeft = 1; p.attachedPlatform = null;
                    this.spawnParticles(p.x + p.width / 2, p.y + p.height, 5, this.colors.CYAN);
                } else if (p.grounded) {
                    p.vy = this.JUMP_VELOCITY;
                    p.grounded = false; p.jumpsLeft = 1; p.attachedPlatform = null;
                    this.spawnParticles(p.x + p.width / 2, p.y + p.height, 5, '#ffffff');
                } else if (p.jumpsLeft > 0) {
                    p.vy = this.JUMP_VELOCITY;
                    p.jumpsLeft--; p.attachedPlatform = null;
                    this.spawnParticles(p.x + p.width / 2, p.y + p.height / 2, 8, this.colors.LIFE_MIRROR);
                }
            }
        } else {
            this.jumpPressed = false;
        }

        // Dash
        if ((keys['ShiftLeft'] || keys['ShiftRight']) && !this.dashPressed && p.dashCooldown <= 0) {
            this.dashPressed = true;
            p.isDashing = true; p.dashTimer = this.DASH_DURATION;
            p.dashCooldown = this.DASH_COOLDOWN;
            p.dashDirection = p.facingDirection;
            p.vy = 0; p.attachedPlatform = null;
            this.spawnParticles(p.x + p.width / 2, p.y + p.height / 2, 12, this.colors.LIFE_MIRROR);
        }
        if (!keys['ShiftLeft'] && !keys['ShiftRight']) this.dashPressed = false;
    }

    updatePlayer(dt) {
        const p = this.player;
        if (p.isDead) return;

        if (p.isDashing) {
            p.dashTimer -= dt;
            p.vx = p.dashDirection * this.DASH_SPEED;
            p.vy = 0;
            if (p.dashTimer <= 0) { p.isDashing = false; p.vx = 0; }
        }
        if (p.dashCooldown > 0) p.dashCooldown -= dt;

        if (!p.isDashing) {
            p.vy += this.GRAVITY * dt;
            if (p.vy > this.MAX_FALL_SPEED) p.vy = this.MAX_FALL_SPEED;
        }

         p.x += p.vx * dt;
         p.y += p.vy * dt;

         // Mise à jour du point de réapparition
         while (this.currentRespawnIndex < this.respawnPoints.length - 1 && p.x >= this.respawnPoints[this.currentRespawnIndex + 1].x) {
             this.currentRespawnIndex++;
         }

         if (p.y > this.levelHeight + 200) this.killPlayer();

        p.grounded = false;
        p.onWall = false;
        p.canWallJump = false;
        p.inVent = false;
    }

    updateMovingPlatforms(dt) {
        for (let p of this.movingPlatforms) {
            let moveAmount = p.speed * p.dir * dt;
            if (p.axis === 'x') {
                p.x += moveAmount;
                if ((p.dir === 1 && p.x >= p.endX) || (p.dir === -1 && p.x <= p.startX)) p.dir *= -1;
            } else {
                p.y += moveAmount;
                if ((p.dir === 1 && p.y >= p.endY) || (p.dir === -1 && p.y <= p.startY)) p.dir *= -1;
            }
            if (this.player.attachedPlatform === p && !this.player.isDashing) {
                if (p.axis === 'x') this.player.x += moveAmount;
                else this.player.y += moveAmount;
            }
        }
    }

    updateCrumblingPlatforms(dt) {
        for (let i = this.crumblingPlatforms.length - 1; i >= 0; i--) {
            const p = this.crumblingPlatforms[i];
            if (p.state === 'shaking') {
                p.timer += dt;
                if (p.timer > 0.6) { p.state = 'falling'; p.vy = 0; }
            } else if (p.state === 'falling') {
                p.vy = (p.vy || 0) + this.GRAVITY * dt;
                p.y += p.vy * dt;
                if (p.y > this.levelHeight + 100) this.crumblingPlatforms.splice(i, 1);
            }
        }
    }

    updatePulsingLasers() {
        for (let laser of this.pulsingLasers) {
            const cycle = (this.globalTime + laser.offset) % laser.interval;
            laser.active = cycle < (laser.interval * 0.55);
            laser.warning = !laser.active && cycle > (laser.interval * 0.55) - 0.4;
        }
    }

    updateLightCones(dt) {
        for (let cone of this.lightCones) {
            if (cone.isSunlight) {
                // Lumiere du soleil intermittente (nuages)
                const cycle = (this.globalTime + (cone.offset || 0)) % cone.interval;
                cone.isActive = cycle < (cone.interval * 0.5);
            } else {
                // Rotation
                cone.angle += cone.rotSpeed * dt;
                if (cone.angle > cone.maxAngle) { cone.angle = cone.maxAngle; cone.rotSpeed = -Math.abs(cone.rotSpeed); }
                if (cone.angle < cone.minAngle) { cone.angle = cone.minAngle; cone.rotSpeed = Math.abs(cone.rotSpeed); }
                cone.isActive = true;
            }
        }
    }

    updateRobots(dt) {
        for (let robot of this.robots) {
            robot.x += robot.vx * dt;
            if (robot.x <= robot.startX) {
                robot.x = robot.startX; robot.vx = robot.speed; robot.direction = 1;
            } else if (robot.x + robot.width >= robot.endX) {
                robot.x = robot.endX - robot.width; robot.vx = -robot.speed; robot.direction = -1;
            }
            // Cone de detection pointe dans la direction du mouvement
            robot.coneAngle = robot.direction > 0 ? 0 : Math.PI;
            // Flottement pour les drones
            if (robot.type === 'drone') {
                robot.floatOffset = Math.sin(this.globalTime * 2 + robot.x) * 8;
            }
        }
    }

    updateCamera() {
        const { width, height } = this.game.getCanvasSize();
        const lookAhead = this.player.facingDirection * 80;
        const targetX = this.player.x - width / 3 + lookAhead;
        const targetY = this.player.y - height / 1.8;
        this.cameraX += (targetX - this.cameraX) * 0.08;
        this.cameraY += (targetY - this.cameraY) * 0.08;
        this.cameraX = Math.max(0, Math.min(this.cameraX, this.levelWidth - width));
        this.cameraY = Math.max(0, Math.min(this.cameraY, this.levelHeight - height));
    }

    updateParticles(dt) {
        for (let i = this.particles.length - 1; i >= 0; i--) {
            const p = this.particles[i];
            p.life -= dt;
            p.x += p.vx * dt;
            p.y += p.vy * dt;
            p.vy += 200 * dt;
            if (p.life <= 0) this.particles.splice(i, 1);
        }
    }

    updateVictoryAnimation(dt) {
        this.victoryTimer += dt;
        this.updateParticles(dt);

        // Multiplication des bacteries
        if (this.victoryTimer < 4 && Math.random() < dt * 5) {
            this.bacteriaClones.push({
                x: this.goal.x + Math.random() * this.goal.width,
                y: this.goal.y - 10 - Math.random() * 40,
                size: 4 + Math.random() * 8,
                vx: (Math.random() - 0.5) * 60,
                vy: -20 - Math.random() * 40,
                alpha: 1
            });
            this.spawnParticles(
                this.goal.x + Math.random() * this.goal.width,
                this.goal.y, 3, this.colors.LIFE_MIRROR
            );
        }

        for (let clone of this.bacteriaClones) {
            clone.x += clone.vx * dt;
            clone.vy += 30 * dt;
            clone.y += clone.vy * dt;
            clone.size += dt * 2;
        }

        if (this.victoryTimer > 5 && !this._dialogueShown) {
            this._dialogueShown = true;
            this.game.showDialogue([
                "Contamination environnementale initiee.",
                "Multiplication exponentielle en cours...",
                "Les systemes immunitaires terrestres sont aveugles.",
                "L'Invisible se repand."
            ], () => {
                this.game.chapterComplete("Organisme libere. Ecosysteme compromis.");
            });
        }
    }

    // ============================================
    // COLLISIONS
    // ============================================

    checkCollisions() {
        const p = this.player;
        let stillAttached = false;

        this.handlePlatformCollisions(this.platforms);
        const attachedToMoving = this.handlePlatformCollisions(this.movingPlatforms, true);
        if (attachedToMoving) stillAttached = true;
        this.handlePlatformCollisions(this.crumblingPlatforms, false, true);
        if (!stillAttached) p.attachedPlatform = null;

        // Verifier si dans un conduit
        for (let vent of this.vents) {
            if (this.checkAABB(p, { x: vent.entryX, y: vent.entryY, width: vent.width, height: vent.height })) {
                p.inVent = true;
            }
        }

        if (!p.isDashing) {
            // UV Zones
            for (let uv of this.uvZones) {
                if (this.checkAABB(p, uv)) { this.killPlayer(); return; }
            }
            // Lasers pulsants actifs
            for (let laser of this.pulsingLasers) {
                if (laser.active && this.checkAABB(p, laser)) { this.killPlayer(); return; }
            }
            // Cones de lumiere
            for (let cone of this.lightCones) {
                if (cone.isActive && this.isInLightCone(p, cone)) {
                    // Verifier si dans une zone d'ombre (protection)
                    let inShadow = false;
                    for (let shadow of this.shadowZones) {
                        if (this.checkAABB(p, shadow)) { inShadow = true; break; }
                    }
                    if (!inShadow) { this.killPlayer(); return; }
                }
            }
            // Robots (collision directe + cone de detection)
            for (let robot of this.robots) {
                if (this.checkAABB(p, { x: robot.x, y: robot.y + (robot.floatOffset || 0), width: robot.width, height: robot.height })) {
                    this.killPlayer(); return;
                }
                if (this.isInRobotCone(p, robot)) {
                    let inShadow = false;
                    for (let shadow of this.shadowZones) {
                        if (this.checkAABB(p, shadow)) { inShadow = true; break; }
                    }
                    if (!inShadow) { this.killPlayer(); return; }
                }
            }
        }

        // Conduits de ventilation (teleportation)
        for (let vent of this.vents) {
            const entry = { x: vent.entryX, y: vent.entryY, width: vent.width, height: vent.height };
            if (this.checkAABB(p, entry)) {
                const keys = this.game.getKeys();
                if (keys['ArrowUp'] || keys['KeyW']) {
                    p.x = vent.exitX;
                    p.y = vent.exitY;
                    p.vy = -200;
                    this.spawnParticles(vent.entryX + 20, vent.entryY + 20, 8, this.colors.CYAN);
                    this.spawnParticles(vent.exitX + 20, vent.exitY + 20, 8, this.colors.CYAN);
                }
            }
        }

        // Victoire
        if (this.goal && this.checkAABB(p, this.goal)) {
            this.triggerVictory();
        }
    }

    isInLightCone(player, cone) {
        if (!cone.isActive) return false;
        const px = player.x + player.width / 2;
        const py = player.y + player.height / 2;
        const dx = px - cone.x;
        const dy = py - cone.y;
        const dist = Math.sqrt(dx * dx + dy * dy);
        if (dist > cone.range) return false;
        const angle = Math.atan2(dy, dx);
        let diff = angle - cone.angle;
        while (diff > Math.PI) diff -= Math.PI * 2;
        while (diff < -Math.PI) diff += Math.PI * 2;
        return Math.abs(diff) < cone.width / 2;
    }

    isInRobotCone(player, robot) {
        const px = player.x + player.width / 2;
        const py = player.y + player.height / 2;
        const rx = robot.x + robot.width / 2;
        const ry = robot.y + robot.height / 2 + (robot.floatOffset || 0);
        const dx = px - rx;
        const dy = py - ry;
        const dist = Math.sqrt(dx * dx + dy * dy);
        if (dist > robot.coneRange) return false;
        const angle = Math.atan2(dy, dx);
        let diff = angle - robot.coneAngle;
        while (diff > Math.PI) diff -= Math.PI * 2;
        while (diff < -Math.PI) diff += Math.PI * 2;
        return Math.abs(diff) < robot.coneWidth / 2;
    }

    handlePlatformCollisions(platforms, isMoving = false, isCrumbling = false) {
        const p = this.player;
        let touched = false;
        for (let plat of platforms) {
            if (isCrumbling && plat.state === 'falling') continue;
            if (this.checkAABB(p, plat)) {
                const overlapX = Math.min(p.x + p.width - plat.x, plat.x + plat.width - p.x);
                const overlapY = Math.min(p.y + p.height - plat.y, plat.y + plat.height - p.y);
                if (overlapX < overlapY) {
                    if (p.x < plat.x) { p.x = plat.x - p.width; p.wallDirection = 1; }
                    else { p.x = plat.x + plat.width; p.wallDirection = -1; }
                    p.onWall = true; p.canWallJump = true;
                    if (p.vy > 0) p.vy *= 0.6;
                } else {
                    if (p.y < plat.y) {
                        p.y = plat.y - p.height; p.vy = 0;
                        p.grounded = true; p.jumpsLeft = 2;
                        if (isMoving) { p.attachedPlatform = plat; touched = true; }
                        if (isCrumbling && plat.state === 'stable') plat.state = 'shaking';
                    } else {
                        p.y = plat.y + plat.height; p.vy = 0;
                    }
                }
            }
        }
        return touched;
    }

    checkAABB(a, b) {
        return a.x < b.x + b.width && a.x + a.width > b.x &&
               a.y < b.y + b.height && a.y + a.height > b.y;
    }

    killPlayer() {
        if (this.player.isDead) return;
        this.player.isDead = true;
        this.spawnParticles(this.player.x + this.player.width / 2, this.player.y + this.player.height / 2, 20, this.colors.DANGER);
        setTimeout(() => {
            this.gameOver = true;
            this.game.showDialogue([
                "ALERTE : Organisme neutralise.",
                "Reinitialisation de la zone..."
            ], () => this.resetLevel());
        }, 800);
    }

    triggerVictory() {
        if (this.victory) return;
        this.victory = true;
        this.victoryTimer = 0;
        this.bacteriaClones = [];
        this._dialogueShown = false;
        this.spawnParticles(this.player.x + this.player.width / 2, this.player.y + this.player.height / 2, 30, this.colors.LIFE_MIRROR);
    }

     resetLevel() {
         this.endTutorial();
         const h = this.levelHeight;
         let respawn = this.respawnPoints[this.currentRespawnIndex];
         this.player.x = respawn.x;
         this.player.y = respawn.y;
         this.player.vx = 0; this.player.vy = 0;
         this.player.isDead = false; this.player.grounded = false;
         this.player.jumpsLeft = 2; this.player.dashCooldown = 0;
         this.player.attachedPlatform = null;
         this.gameOver = false; this.victory = false;

         // Reset plateformes fragiles
         this.crumblingPlatforms = [];
         const h2 = this.levelHeight;
         for (let i = 0; i < 4; i++) {
             this.crumblingPlatforms.push({
                 x: 2820 + i * 100, y: h2 - 280,
                 width: 70, height: 15, state: 'stable', timer: 0
             });
         }

         // Hide the dialogue box after resetting
         const dialogueBox = document.getElementById('ch2-dialogue-box');
         if (dialogueBox) dialogueBox.style.display = 'none';
     }

    updateUI() {
        if (!this.domElements || !this.domElements.dashFill) return;
        const pct = Math.max(0, 100 - (this.player.dashCooldown / this.DASH_COOLDOWN) * 100);
        this.domElements.dashFill.style.width = `${pct}%`;
        if (pct >= 100) {
            this.domElements.dashFill.style.backgroundColor = this.colors.LIFE_MIRROR;
            this.domElements.dashFill.style.boxShadow = `0 0 10px ${this.colors.LIFE_MIRROR}`;
        } else {
            this.domElements.dashFill.style.backgroundColor = '#331155';
            this.domElements.dashFill.style.boxShadow = 'none';
        }
        if (this.domElements.dashStatus) {
            this.domElements.dashStatus.textContent = pct >= 100 ? 'Prêt' : 'Recharge';
            this.domElements.dashStatus.style.color = pct >= 100 ? this.colors.LIFE_MIRROR : '#ffffff';
        }
    }

    spawnParticles(x, y, count, color) {
        for (let i = 0; i < count; i++) {
            const angle = Math.random() * Math.PI * 2;
            const speed = 80 + Math.random() * 180;
            this.particles.push({
                x, y, vx: Math.cos(angle) * speed, vy: Math.sin(angle) * speed - 80,
                life: 0.3 + Math.random() * 0.5, color, size: 2 + Math.random() * 4
            });
        }
    }

    // ============================================
    // RENDU (DRAW)
    // ============================================

    draw(ctx) {
        const { width, height } = this.game.getCanvasSize();
        ctx.fillStyle = '#030308';
        ctx.fillRect(0, 0, width, height);

        ctx.save();
        ctx.translate(-this.cameraX, -this.cameraY);

        this.drawBackground(ctx, width, height);
        this.drawShadowZones(ctx);
        this.drawDecorations(ctx);
        this.drawPlatforms(ctx);
        this.drawMovingPlatforms(ctx);
        this.drawCrumblingPlatforms(ctx);
        this.drawVents(ctx);
        this.drawUVZones(ctx);
        this.drawPulsingLasers(ctx);
        this.drawLightCones(ctx);
        this.drawRobots(ctx);
        this.drawGoal(ctx);
        this.drawPlayer(ctx);
        this.drawParticles(ctx);
        if (this.victory) this.drawVictoryEffect(ctx);

        ctx.restore();
    }

    drawBackground(ctx, viewW, viewH) {
        const startX = Math.floor(this.cameraX / 100) * 100;
        const startY = Math.floor(this.cameraY / 100) * 100;
        const endX = this.cameraX + viewW + 100;
        const endY = this.cameraY + viewH + 100;

        // Grille labo
        for (let x = startX; x < Math.min(endX, this.ZONE_LAB_END); x += 100) {
            for (let y = startY; y < endY; y += 100) {
                ctx.strokeStyle = 'rgba(30, 40, 50, 0.5)';
                ctx.lineWidth = 1;
                ctx.strokeRect(x, y, 100, 100);
            }
        }

        // Zone conduit - plus sombre, lignes metal
        for (let x = Math.max(startX, this.ZONE_LAB_END); x < Math.min(endX, this.ZONE_VENT_END); x += 60) {
            ctx.strokeStyle = 'rgba(40, 40, 40, 0.4)';
            ctx.lineWidth = 1;
            ctx.beginPath(); ctx.moveTo(x, startY); ctx.lineTo(x, endY); ctx.stroke();
        }

        // Zone exterieur - ciel nuit/crepuscule
        if (this.cameraX + viewW > this.ZONE_VENT_END) {
            const extStart = Math.max(this.ZONE_VENT_END, this.cameraX);
            const grad = ctx.createLinearGradient(extStart, 0, extStart, this.levelHeight);
            grad.addColorStop(0, '#0a0a2e');
            grad.addColorStop(0.5, '#0f1a2a');
            grad.addColorStop(1, '#1a2a1a');
            ctx.fillStyle = grad;
            ctx.fillRect(extStart, startY, endX - extStart, endY - startY);

            // Etoiles
            ctx.fillStyle = '#ffffff';
            for (let i = 0; i < 20; i++) {
                const sx = this.ZONE_VENT_END + 100 + (i * 73) % 1300;
                const sy = 50 + (i * 47) % 300;
                const size = 1 + (i % 3);
                ctx.globalAlpha = 0.3 + Math.sin(this.globalTime * 2 + i) * 0.3;
                ctx.fillRect(sx, sy, size, size);
            }
            ctx.globalAlpha = 1;
        }
    }

    drawShadowZones(ctx) {
        for (let zone of this.shadowZones) {
            ctx.fillStyle = 'rgba(0, 0, 0, 0.3)';
            ctx.fillRect(zone.x, zone.y, zone.width, zone.height);
            // Indicateur discret
            ctx.strokeStyle = 'rgba(100, 100, 150, 0.15)';
            ctx.lineWidth = 1;
            ctx.setLineDash([4, 4]);
            ctx.strokeRect(zone.x, zone.y, zone.width, zone.height);
            ctx.setLineDash([]);
        }
    }

    drawDecorations(ctx) {
        for (let d of this.decorations) {
            switch (d.type) {
                case 'lamp':
                    // Lampe au plafond
                    ctx.fillStyle = '#333';
                    ctx.fillRect(d.x - 3, d.y, 6, 15);
                    ctx.fillStyle = '#ffcc44';
                    ctx.globalAlpha = 0.5 + Math.sin(this.globalTime * 3 + d.x) * 0.2;
                    ctx.beginPath();
                    ctx.arc(d.x, d.y + 18, 8, 0, Math.PI * 2);
                    ctx.fill();
                    ctx.globalAlpha = 1;
                    break;
                case 'pipe_h':
                    ctx.fillStyle = '#2a2a2a';
                    ctx.fillRect(d.x, d.y - 5, 250, 10);
                    ctx.strokeStyle = '#3a3a3a';
                    ctx.lineWidth = 1;
                    ctx.strokeRect(d.x, d.y - 5, 250, 10);
                    // Joints
                    for (let j = 0; j < 250; j += 50) {
                        ctx.fillStyle = '#3a3a3a';
                        ctx.fillRect(d.x + j, d.y - 7, 4, 14);
                    }
                    break;
                case 'pipe_v':
                    ctx.fillStyle = '#2a2a2a';
                    ctx.fillRect(d.x - 5, d.y, 10, d.height || 200);
                    ctx.strokeStyle = '#3a3a3a';
                    ctx.lineWidth = 1;
                    ctx.strokeRect(d.x - 5, d.y, 10, d.height || 200);
                    break;
                case 'microscope':
                    ctx.fillStyle = '#555';
                    ctx.fillRect(d.x, d.y - 30, 8, 30);
                    ctx.fillRect(d.x - 5, d.y - 35, 18, 5);
                    ctx.fillStyle = '#4488aa';
                    ctx.beginPath();
                    ctx.arc(d.x + 4, d.y - 38, 4, 0, Math.PI * 2);
                    ctx.fill();
                    break;
                case 'flask':
                    ctx.fillStyle = '#444';
                    ctx.fillRect(d.x + 5, d.y - 25, 6, 15);
                    ctx.fillStyle = 'rgba(68, 255, 136, 0.3)';
                    ctx.beginPath();
                    ctx.moveTo(d.x, d.y);
                    ctx.lineTo(d.x + 16, d.y);
                    ctx.lineTo(d.x + 11, d.y - 10);
                    ctx.lineTo(d.x + 5, d.y - 10);
                    ctx.closePath();
                    ctx.fill();
                    break;
                case 'biohazard':
                    ctx.save();
                    ctx.translate(d.x, d.y);
                    ctx.fillStyle = 'rgba(255, 200, 0, 0.4)';
                    ctx.font = '24px monospace';
                    ctx.fillText('\u2623', -8, 0);
                    ctx.restore();
                    break;
                case 'grass':
                    ctx.strokeStyle = '#1a4a1a';
                    ctx.lineWidth = 2;
                    for (let i = 0; i < 5; i++) {
                        const gx = d.x + i * 12;
                        const gh = 10 + Math.sin(this.globalTime + i) * 3;
                        ctx.beginPath();
                        ctx.moveTo(gx, d.y);
                        ctx.lineTo(gx + 3, d.y - gh);
                        ctx.stroke();
                    }
                    break;
            }
        }
    }

    drawPlatforms(ctx) {
        for (let plat of this.platforms) {
            switch (plat.type) {
                case 'floor':
                    if (plat.x >= this.ZONE_VENT_END) {
                        // Sol exterieur
                        ctx.fillStyle = '#1a2a1a';
                        ctx.fillRect(plat.x, plat.y, plat.width, plat.height);
                        ctx.strokeStyle = '#2a4a2a';
                    } else {
                        ctx.fillStyle = '#1a1a22';
                        ctx.fillRect(plat.x, plat.y, plat.width, plat.height);
                        ctx.strokeStyle = '#2a2a3a';
                    }
                    break;
                case 'wall': case 'wall_lab': case 'wall_exit':
                    ctx.fillStyle = '#1a1a22';
                    ctx.fillRect(plat.x, plat.y, plat.width, plat.height);
                    ctx.strokeStyle = '#2a2a3a';
                    // Rivets sur les murs du labo
                    if (plat.type === 'wall_lab') {
                        ctx.fillStyle = '#3a3a4a';
                        for (let ry = plat.y + 20; ry < plat.y + plat.height - 20; ry += 60) {
                            ctx.beginPath();
                            ctx.arc(plat.x + plat.width / 2, ry, 3, 0, Math.PI * 2);
                            ctx.fill();
                        }
                    }
                    break;
                case 'ceiling': case 'ceiling_lab':
                    ctx.fillStyle = '#151520';
                    ctx.fillRect(plat.x, plat.y, plat.width, plat.height);
                    ctx.strokeStyle = '#252530';
                    break;
                case 'table':
                    ctx.fillStyle = '#2a2a2a';
                    ctx.fillRect(plat.x, plat.y, plat.width, plat.height);
                    ctx.strokeStyle = '#4a4a4a';
                    // Pieds
                    ctx.fillStyle = '#222';
                    ctx.fillRect(plat.x + 5, plat.y + plat.height, 6, 40);
                    ctx.fillRect(plat.x + plat.width - 11, plat.y + plat.height, 6, 40);
                    break;
                case 'shelf':
                    ctx.fillStyle = '#252530';
                    ctx.fillRect(plat.x, plat.y, plat.width, plat.height);
                    ctx.strokeStyle = '#3a3a4a';
                    break;
                case 'vent_wall':
                    ctx.fillStyle = '#1a1a1a';
                    ctx.fillRect(plat.x, plat.y, plat.width, plat.height);
                    ctx.strokeStyle = '#333';
                    // Vis metal
                    for (let vx = plat.x + 30; vx < plat.x + plat.width; vx += 80) {
                        ctx.fillStyle = '#444';
                        ctx.beginPath();
                        ctx.arc(vx, plat.y + plat.height / 2, 2, 0, Math.PI * 2);
                        ctx.fill();
                    }
                    break;
                case 'vent_platform':
                    ctx.fillStyle = '#222';
                    ctx.fillRect(plat.x, plat.y, plat.width, plat.height);
                    ctx.strokeStyle = '#444';
                    break;
                case 'rock':
                    ctx.fillStyle = '#2a2a2a';
                    ctx.beginPath();
                    ctx.moveTo(plat.x, plat.y + plat.height);
                    ctx.lineTo(plat.x + plat.width * 0.2, plat.y);
                    ctx.lineTo(plat.x + plat.width * 0.8, plat.y + plat.height * 0.1);
                    ctx.lineTo(plat.x + plat.width, plat.y + plat.height);
                    ctx.closePath();
                    ctx.fill();
                    ctx.strokeStyle = '#3a3a3a';
                    ctx.stroke();
                    // Draw as rect for collision
                    break;
                case 'ground_ext':
                    const grd = ctx.createLinearGradient(plat.x, plat.y, plat.x, plat.y + plat.height);
                    grd.addColorStop(0, '#1a3a1a');
                    grd.addColorStop(1, '#0a1a0a');
                    ctx.fillStyle = grd;
                    ctx.fillRect(plat.x, plat.y, plat.width, plat.height);
                    ctx.strokeStyle = '#2a4a2a';
                    break;
                default:
                    ctx.fillStyle = '#1a1a22';
                    ctx.fillRect(plat.x, plat.y, plat.width, plat.height);
                    ctx.strokeStyle = '#2a2a3a';
            }
            ctx.lineWidth = 1;
            if (plat.type !== 'rock') ctx.strokeRect(plat.x, plat.y, plat.width, plat.height);
        }
    }

    drawMovingPlatforms(ctx) {
        for (let p of this.movingPlatforms) {
            ctx.fillStyle = '#1a1a30';
            ctx.strokeStyle = this.colors.CYAN;
            ctx.lineWidth = 2;
            ctx.fillRect(p.x, p.y, p.width, p.height);
            ctx.strokeRect(p.x, p.y, p.width, p.height);
            // Rail
            ctx.strokeStyle = 'rgba(0, 255, 255, 0.1)';
            ctx.lineWidth = 1;
            ctx.beginPath();
            if (p.axis === 'x') {
                ctx.moveTo(p.startX, p.y + p.height / 2);
                ctx.lineTo(p.endX, p.y + p.height / 2);
            } else {
                ctx.moveTo(p.x + p.width / 2, p.startY);
                ctx.lineTo(p.x + p.width / 2, p.endY);
            }
            ctx.stroke();
        }
    }

    drawCrumblingPlatforms(ctx) {
        for (let p of this.crumblingPlatforms) {
            let dx = 0, dy = 0;
            if (p.state === 'shaking') {
                dx = (Math.random() - 0.5) * 6;
                dy = (Math.random() - 0.5) * 6;
                ctx.fillStyle = '#3a2020';
                ctx.strokeStyle = '#884444';
            } else {
                ctx.fillStyle = '#2a2a2a';
                ctx.strokeStyle = '#555';
            }
            ctx.lineWidth = 1;
            ctx.fillRect(p.x + dx, p.y + dy, p.width, p.height);
            ctx.strokeRect(p.x + dx, p.y + dy, p.width, p.height);
            // Fissure
            ctx.beginPath();
            ctx.moveTo(p.x + dx + 8, p.y + dy);
            ctx.lineTo(p.x + dx + p.width / 2, p.y + dy + p.height);
            ctx.stroke();
        }
    }

    drawVents(ctx) {
        for (let vent of this.vents) {
            // Entree
            ctx.fillStyle = '#1a2a3a';
            ctx.fillRect(vent.entryX, vent.entryY, vent.width, vent.height);
            ctx.strokeStyle = this.colors.CYAN;
            ctx.lineWidth = 2;
            ctx.strokeRect(vent.entryX, vent.entryY, vent.width, vent.height);
            // Grille
            for (let i = 0; i < 4; i++) {
                ctx.beginPath();
                ctx.moveTo(vent.entryX + (i + 1) * vent.width / 5, vent.entryY);
                ctx.lineTo(vent.entryX + (i + 1) * vent.width / 5, vent.entryY + vent.height);
                ctx.stroke();
            }
            // Sortie
            ctx.fillStyle = '#1a2a3a';
            ctx.fillRect(vent.exitX, vent.exitY, vent.width, vent.height);
            ctx.strokeStyle = this.colors.CYAN;
            ctx.strokeRect(vent.exitX, vent.exitY, vent.width, vent.height);
            // Indicateur fleche
            ctx.fillStyle = this.colors.CYAN;
            ctx.globalAlpha = 0.4 + Math.sin(this.globalTime * 3) * 0.3;
            ctx.font = '16px monospace';
            ctx.fillText('\u2191', vent.entryX + 12, vent.entryY - 5);
            ctx.globalAlpha = 1;
        }
    }

    drawUVZones(ctx) {
        for (let uv of this.uvZones) {
            ctx.fillStyle = 'rgba(180, 50, 255, 0.15)';
            ctx.fillRect(uv.x, uv.y, uv.width, uv.height);
            ctx.strokeStyle = 'rgba(180, 50, 255, 0.5)';
            ctx.lineWidth = 2;
            ctx.strokeRect(uv.x, uv.y, uv.width, uv.height);
            // Animation pulsante
            const t = this.globalTime * 3;
            ctx.strokeStyle = `rgba(180, 50, 255, ${0.2 + Math.sin(t) * 0.15})`;
            ctx.lineWidth = 1;
            ctx.beginPath();
            ctx.moveTo(uv.x, uv.y + uv.height / 2);
            ctx.lineTo(uv.x + uv.width, uv.y + uv.height / 2);
            ctx.stroke();
        }
    }

    drawPulsingLasers(ctx) {
        for (let l of this.pulsingLasers) {
            if (l.active) {
                const color = l.type === 'fan' ? 'rgba(100, 200, 255, 0.5)' : 'rgba(255, 30, 30, 0.5)';
                const stroke = l.type === 'fan' ? '#55aaff' : '#ff2222';
                ctx.fillStyle = color;
                ctx.fillRect(l.x, l.y, l.width, l.height);
                ctx.strokeStyle = stroke;
                ctx.lineWidth = 2;
                ctx.shadowBlur = 12;
                ctx.shadowColor = stroke;
                ctx.strokeRect(l.x, l.y, l.width, l.height);
                ctx.shadowBlur = 0;
            } else if (l.warning) {
                ctx.fillStyle = `rgba(255, 200, 0, ${0.2 + Math.random() * 0.2})`;
                ctx.fillRect(l.x, l.y, l.width, l.height);
            } else {
                ctx.strokeStyle = 'rgba(50, 20, 20, 0.3)';
                ctx.lineWidth = 1;
                ctx.strokeRect(l.x, l.y, l.width, l.height);
            }
        }
    }

    drawLightCones(ctx) {
        for (let cone of this.lightCones) {
            if (!cone.isActive) continue;
            ctx.save();
            ctx.translate(cone.x, cone.y);

            const startAngle = cone.angle - cone.width / 2;
            const endAngle = cone.angle + cone.width / 2;

            // Gradient conique
            const grad = ctx.createRadialGradient(0, 0, 0, 0, 0, cone.range);
            if (cone.isSunlight) {
                grad.addColorStop(0, 'rgba(255, 240, 200, 0.25)');
                grad.addColorStop(0.5, 'rgba(255, 240, 200, 0.1)');
                grad.addColorStop(1, 'rgba(255, 240, 200, 0)');
            } else {
                grad.addColorStop(0, 'rgba(255, 255, 200, 0.3)');
                grad.addColorStop(0.5, 'rgba(255, 255, 150, 0.12)');
                grad.addColorStop(1, 'rgba(255, 255, 100, 0)');
            }

            ctx.fillStyle = grad;
            ctx.beginPath();
            ctx.moveTo(0, 0);
            ctx.arc(0, 0, cone.range, startAngle, endAngle);
            ctx.closePath();
            ctx.fill();

            // Bord du cone
            ctx.strokeStyle = 'rgba(255, 255, 200, 0.15)';
            ctx.lineWidth = 1;
            ctx.beginPath();
            ctx.moveTo(0, 0);
            ctx.lineTo(Math.cos(startAngle) * cone.range, Math.sin(startAngle) * cone.range);
            ctx.stroke();
            ctx.beginPath();
            ctx.moveTo(0, 0);
            ctx.lineTo(Math.cos(endAngle) * cone.range, Math.sin(endAngle) * cone.range);
            ctx.stroke();

            ctx.restore();
        }
    }

    drawRobots(ctx) {
        for (let robot of this.robots) {
            const fy = robot.floatOffset || 0;

            // Cone de detection
            ctx.save();
            ctx.translate(robot.x + robot.width / 2, robot.y + robot.height / 2 + fy);
            const sa = robot.coneAngle - robot.coneWidth / 2;
            const ea = robot.coneAngle + robot.coneWidth / 2;
            const grad = ctx.createRadialGradient(0, 0, 0, 0, 0, robot.coneRange);
            grad.addColorStop(0, 'rgba(255, 100, 100, 0.15)');
            grad.addColorStop(1, 'rgba(255, 50, 50, 0)');
            ctx.fillStyle = grad;
            ctx.beginPath();
            ctx.moveTo(0, 0);
            ctx.arc(0, 0, robot.coneRange, sa, ea);
            ctx.closePath();
            ctx.fill();
            ctx.restore();

            // Corps du robot
            const rx = robot.x;
            const ry = robot.y + fy;
            if (robot.type === 'ground') {
                // Robot sol - forme rectangulaire avec roues
                ctx.fillStyle = '#444';
                ctx.fillRect(rx + 2, ry + 5, robot.width - 4, robot.height - 10);
                ctx.strokeStyle = '#ff4444';
                ctx.lineWidth = 2;
                ctx.strokeRect(rx + 2, ry + 5, robot.width - 4, robot.height - 10);
                // Oeil
                ctx.fillStyle = '#ff0000';
                const eyeX = robot.direction > 0 ? rx + robot.width - 15 : rx + 5;
                ctx.beginPath();
                ctx.arc(eyeX + 5, ry + robot.height / 2, 5, 0, Math.PI * 2);
                ctx.fill();
                ctx.fillStyle = '#fff';
                ctx.beginPath();
                ctx.arc(eyeX + 5 + robot.direction * 2, ry + robot.height / 2, 2, 0, Math.PI * 2);
                ctx.fill();
                // Roues
                ctx.fillStyle = '#333';
                ctx.beginPath();
                ctx.arc(rx + 10, ry + robot.height, 6, 0, Math.PI * 2);
                ctx.fill();
                ctx.beginPath();
                ctx.arc(rx + robot.width - 10, ry + robot.height, 6, 0, Math.PI * 2);
                ctx.fill();
            } else {
                // Drone - forme plus petite, avec helice
                ctx.fillStyle = '#3a3a3a';
                ctx.fillRect(rx + 5, ry + 10, robot.width - 10, robot.height - 15);
                ctx.strokeStyle = '#ff6666';
                ctx.lineWidth = 1;
                ctx.strokeRect(rx + 5, ry + 10, robot.width - 10, robot.height - 15);
                // Helice
                const spin = this.globalTime * 15;
                ctx.strokeStyle = '#888';
                ctx.lineWidth = 2;
                ctx.beginPath();
                ctx.moveTo(rx + robot.width / 2 - 15 * Math.cos(spin), ry + 5);
                ctx.lineTo(rx + robot.width / 2 + 15 * Math.cos(spin), ry + 5);
                ctx.stroke();
                // Oeil
                ctx.fillStyle = '#ff4444';
                ctx.beginPath();
                ctx.arc(rx + robot.width / 2, ry + robot.height / 2 + 3, 4, 0, Math.PI * 2);
                ctx.fill();
            }
        }
    }

    drawGoal(ctx) {
        if (!this.goal) return;
        const g = this.goal;

        // Flaque d'eau
        ctx.save();
        const waterGrad = ctx.createRadialGradient(
            g.x + g.width / 2, g.y + g.height / 2, 10,
            g.x + g.width / 2, g.y + g.height / 2, g.width / 2
        );
        waterGrad.addColorStop(0, 'rgba(30, 100, 180, 0.6)');
        waterGrad.addColorStop(0.6, 'rgba(20, 80, 150, 0.4)');
        waterGrad.addColorStop(1, 'rgba(10, 50, 100, 0.1)');
        ctx.fillStyle = waterGrad;
        ctx.beginPath();
        ctx.ellipse(g.x + g.width / 2, g.y + g.height / 2, g.width / 2, g.height / 2, 0, 0, Math.PI * 2);
        ctx.fill();

        // Reflets
        ctx.strokeStyle = `rgba(100, 180, 255, ${0.3 + Math.sin(this.globalTime * 2) * 0.15})`;
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.ellipse(g.x + g.width / 2, g.y + g.height / 2, g.width / 2 - 5, g.height / 2 - 3, 0, 0, Math.PI * 2);
        ctx.stroke();

        // Ondulations
        const t = this.globalTime;
        for (let i = 0; i < 3; i++) {
            const rx = g.width * (0.2 + i * 0.2) + Math.sin(t + i) * 10;
            ctx.strokeStyle = `rgba(100, 200, 255, ${0.1 + Math.sin(t * 2 + i) * 0.08})`;
            ctx.beginPath();
            ctx.ellipse(g.x + g.width / 2, g.y + g.height / 2, rx / 2, g.height * 0.3, 0, 0, Math.PI * 2);
            ctx.stroke();
        }
        ctx.restore();
    }

    drawPlayer(ctx) {
        const p = this.player;
        if (p.isDead) return;

        ctx.save();

        // Trail dash
        if (p.isDashing) {
            ctx.shadowBlur = 15;
            ctx.shadowColor = this.colors.LIFE_MIRROR;
        }

        // Corps - bacterie (forme organique)
        ctx.fillStyle = this.colors.LIFE_MIRROR;
        ctx.beginPath();
        ctx.ellipse(p.x + p.width / 2, p.y + p.height / 2, p.width / 2, p.height / 2, 0, 0, Math.PI * 2);
        ctx.fill();

        ctx.strokeStyle = '#dd77ff';
        ctx.lineWidth = 1.5;
        ctx.beginPath();
        ctx.ellipse(p.x + p.width / 2, p.y + p.height / 2, p.width / 2, p.height / 2, 0, 0, Math.PI * 2);
        ctx.stroke();

        // Flagelles (petites lignes qui bougent)
        ctx.strokeStyle = 'rgba(185, 68, 255, 0.6)';
        ctx.lineWidth = 1;
        const tailX = p.x + (p.facingDirection < 0 ? p.width : 0);
        for (let i = 0; i < 3; i++) {
            const offset = Math.sin(this.globalTime * 8 + i * 2) * 5;
            ctx.beginPath();
            ctx.moveTo(tailX, p.y + 6 + i * 6);
            ctx.lineTo(tailX - p.facingDirection * (8 + i * 3), p.y + 6 + i * 6 + offset);
            ctx.stroke();
        }

        // Noyau / oeil
        ctx.fillStyle = '#fff';
        const eyeX = p.x + p.width / 2 + p.facingDirection * 5;
        ctx.beginPath();
        ctx.arc(eyeX, p.y + p.height / 2 - 1, 3, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = '#220044';
        ctx.beginPath();
        ctx.arc(eyeX + p.facingDirection * 1.5, p.y + p.height / 2 - 1, 1.5, 0, Math.PI * 2);
        ctx.fill();

        ctx.restore();
    }

    drawParticles(ctx) {
        for (let part of this.particles) {
            ctx.fillStyle = part.color;
            ctx.globalAlpha = Math.max(0, part.life);
            ctx.fillRect(part.x, part.y, part.size, part.size);
        }
        ctx.globalAlpha = 1;
    }

    drawVictoryEffect(ctx) {
        // Bacteries qui se multiplient dans la flaque
        for (let clone of this.bacteriaClones) {
            ctx.fillStyle = this.colors.LIFE_MIRROR;
            ctx.globalAlpha = Math.max(0.3, clone.alpha);
            ctx.beginPath();
            ctx.ellipse(clone.x, clone.y, clone.size / 2, clone.size / 2.5, 0, 0, Math.PI * 2);
            ctx.fill();
        }
        ctx.globalAlpha = 1;

        // Halo violet qui grandit
        if (this.goal) {
            const radius = this.victoryTimer * 50;
            const grad = ctx.createRadialGradient(
                this.goal.x + this.goal.width / 2, this.goal.y,
                0, this.goal.x + this.goal.width / 2, this.goal.y, radius
            );
            grad.addColorStop(0, 'rgba(185, 68, 255, 0.2)');
            grad.addColorStop(1, 'rgba(185, 68, 255, 0)');
            ctx.fillStyle = grad;
            ctx.beginPath();
            ctx.arc(this.goal.x + this.goal.width / 2, this.goal.y, radius, 0, Math.PI * 2);
            ctx.fill();
        }
    }

    // ============================================
    // TUTORIEL
    // ============================================

    startTutorial() {
        this.tutorialActive = true;
        this.tutorialStep = 0;
        this.showTutorialStep();
    }

    showTutorialStep() {
        if (this.tutorialStep >= this.tutorialSteps.length) { this.endTutorial(); return; }
        const step = this.tutorialSteps[this.tutorialStep];
        const titleEl = document.getElementById('ch2-tutorial-title');
        const contentEl = document.getElementById('ch2-tutorial-content');
        const progressEl = document.getElementById('ch2-tutorial-progress');
        if (titleEl) titleEl.textContent = step.title;
        if (contentEl) contentEl.textContent = step.content;
        if (progressEl) {
            progressEl.innerHTML = '';
            for (let i = 0; i < this.tutorialSteps.length; i++) {
                const dot = document.createElement('div');
                dot.className = 'ch2-tutorial-dot' + (i === this.tutorialStep ? ' active' : '');
                progressEl.appendChild(dot);
            }
        }
        const overlay = document.getElementById('ch2-tutorial-overlay');
        if (overlay) overlay.classList.add('active');
        const bubble = document.getElementById('ch2-tutorial-bubble');
        if (bubble) {
            bubble.style.top = '50%';
            bubble.style.left = '50%';
            bubble.style.transform = 'translate(-50%, -50%)';
            bubble.classList.add('visible');
        }
    }

    nextTutorialStep() {
        this.tutorialStep++;
        if (this.tutorialStep >= this.tutorialSteps.length) this.endTutorial();
        else this.showTutorialStep();
    }

    skipTutorial() { this.endTutorial(); }

    endTutorial() {
        this.tutorialActive = false;
        const overlay = document.getElementById('ch2-tutorial-overlay');
        if (overlay) overlay.classList.remove('active');
    }
}
