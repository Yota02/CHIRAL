/**
 * CHAPITRE 2 : LA BRÈCHE (HARD MODE)
 *
 * Platformer 2D complexe incluant :
 * - Mécaniques de base : Saut, Double Saut, Wall Jump, Dash
 * - Mécaniques avancées : Plateformes mobiles, Lasers intermittents, Plateformes fragiles
 * - Level Design : Haute difficulté
 */

export class Chapter2 {
    constructor(game) {
        this.game = game;
        this.colors = game.getColors ? game.getColors() : {
            CYAN: '#00ffff',
            LIFE_MIRROR: '#00ff00',
            DANGER: '#ff0000'
        };

        // --- CONSTANTES DE GAMEPLAY (AJUSTÉES POUR HARD MODE) ---
        this.GRAVITY = 2000;
        this.JUMP_VELOCITY = -650;
        this.WALL_JUMP_VELOCITY_X = 450;
        this.WALL_JUMP_VELOCITY_Y = -600;
        this.MOVE_SPEED = 320;
        this.DASH_SPEED = 900;
        this.DASH_DURATION = 0.15;
        this.DASH_COOLDOWN = 1.2;
        this.MAX_FALL_SPEED = 900;

        // --- ÉTAT DU JOUEUR ---
        this.player = {
            x: 100,
            y: 100,
            width: 30,
            height: 30,
            vx: 0,
            vy: 0,
            grounded: false,
            onWall: false,
            wallDirection: 0, // -1 = gauche, 1 = droite
            jumpsLeft: 2,
            canWallJump: false,
            isDashing: false,
            dashTimer: 0,
            dashCooldown: 0,
            dashDirection: 1,
            facingDirection: 1,
            isDead: false,
            attachedPlatform: null // Pour suivre les plateformes mobiles
        };

        // --- NIVEAU ---
        this.platforms = [];           // Sol/Murs statiques
        this.movingPlatforms = [];     // Bougent tout le temps
        this.crumblingPlatforms = [];  // Tombent après contact
        this.enemies = [];             // Drones
        this.uvZones = [];             // Lasers fixes
        this.pulsingLasers = [];       // Lasers ON/OFF
        this.goal = null;

        this.cameraX = 0;
        this.cameraY = 0;
        this.levelWidth = 5000;
        this.levelHeight = 1200;

        // Timer global pour synchroniser les lasers
        this.globalTime = 0;

        // --- UI & TUTORIEL ---
        this.tutorialActive = false;
        this.tutorialStep = 0;
        this.tutorialSteps = [
            {
                title: "Chapitre 2 : La Brèche",
                content: "Niveau de sécurité accru. Soyez précis.",
                target: null,
                placement: 'center'
            },
            {
                title: "Plateformes Mobiles",
                content: "Les plateformes bleues bougent. Votre inertie est conservée.",
                target: null,
                placement: 'center'
            },
            {
                title: "Lasers Pulsants",
                content: "Observez le rythme. Passez quand le laser est éteint.",
                target: null,
                placement: 'center'
            },
            {
                title: "Sols Fragiles",
                content: "Les plateformes fissurées s'effondrent rapidement. Ne restez pas immobile !",
                target: null,
                placement: 'center'
            }
        ];

        // Particules
        this.particles = [];

        // État du jeu
        this.gameOver = false;
        this.victory = false;

        this.init();
    }

    async init() {
        try {
            // Nettoyer l'ancienne UI si elle existe
            const oldUI = document.getElementById('ch2-ui');
            if (oldUI) oldUI.remove();

            // Charger UI
            await this.loadChapterUI();
            
            // Setup
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
        // Fallback: Création d'une UI minimale si le fichier HTML n'est pas trouvé
        if (!document.getElementById('ch2-ui')) {
            const div = document.createElement('div');
            div.id = 'ch2-ui';
            div.innerHTML = `
                <div id="ch2-dash-meter">
                    <div class="ch2-dash-label">DASH</div>
                    <div class="ch2-dash-bar">
                        <div id="ch2-dash-fill" class="ch2-dash-fill"></div>
                    </div>
                </div>

                <!-- Tutorial Overlay -->
                <div id="ch2-tutorial-overlay" class="ch2-tutorial-overlay">
                    <div id="ch2-tutorial-highlight" class="ch2-tutorial-highlight"></div>
                    <div id="ch2-tutorial-bubble" class="ch2-tutorial-bubble">
                        <div class="ch2-tutorial-header">
                            <h3 class="ch2-tutorial-title" id="ch2-tutorial-title">Titre</h3>
                        </div>
                        <div class="ch2-tutorial-content" id="ch2-tutorial-content">
                            Contenu du tutoriel
                        </div>
                        <div class="ch2-tutorial-controls">
                            <button class="ch2-tutorial-btn ch2-tutorial-skip" id="ch2-tutorial-skip">Passer</button>
                            <button class="ch2-tutorial-btn ch2-tutorial-next" id="ch2-tutorial-next">Continuer</button>
                        </div>
                        <div class="ch2-tutorial-progress" id="ch2-tutorial-progress"></div>
                    </div>
                </div>
            `;
            document.body.appendChild(div);
        }
    }

    cacheDOMReferences() {
        this.domElements = {
            container: document.getElementById('ch2-ui'),
            dashFill: document.getElementById('ch2-dash-fill')
        };

        this.tutorialElements = {
            overlay: document.getElementById('ch2-tutorial-overlay'), // Peut être null si pas de HTML complet
            bubble: document.getElementById('ch2-tutorial-bubble')
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
        }
    }

    hideUI() {
        if (this.domElements.container) {
            this.domElements.container.style.display = 'none';
        }
    }

    destroy() {
        this.hideUI();
        this.endTutorial();
        const ui = document.getElementById('ch2-ui');
        if(ui) ui.remove();
    }

    // ============================================
    // GÉNÉRATION DU NIVEAU (HARD DESIGN)
    // ============================================

    generateLevel() {
        const w = this.levelWidth;
        const h = this.levelHeight;

        // Réinitialisation
        this.platforms = [];
        this.movingPlatforms = [];
        this.crumblingPlatforms = [];
        this.enemies = [];
        this.uvZones = [];
        this.pulsingLasers = [];

        // --- BORDURES ---
        this.platforms.push({ x: -50, y: 0, width: 50, height: h, type: 'wall' }); // Mur Gauche
        this.platforms.push({ x: w, y: 0, width: 50, height: h, type: 'wall' });   // Mur Droite
        this.platforms.push({ x: 0, y: -50, width: w, height: 50, type: 'ceiling' }); // Plafond

        // --- ZONE DE DÉPART (Safe) ---
        this.platforms.push({ x: 0, y: h - 100, width: 400, height: 100, type: 'floor' });

        // --- ZONE 1 : Verticalité (Wall Jumps) ---
        // Le joueur doit monter entre deux murs étroits
        this.platforms.push({ x: 400, y: h - 500, width: 50, height: 500, type: 'wall' }); // Mur bloqueur bas
        
        // Puits de wall jump
        this.platforms.push({ x: 500, y: h - 700, width: 40, height: 600, type: 'wall' });
        this.platforms.push({ x: 650, y: h - 700, width: 40, height: 600, type: 'wall' });
        
        // Laser statique au milieu du puits pour forcer le timing
        this.uvZones.push({ x: 540, y: h - 400, width: 110, height: 20 });

        // --- ZONE 2 : Plateformes Mobiles (Le Gouffre) ---
        // Plateforme d'arrivée du puits
        this.platforms.push({ x: 700, y: h - 700, width: 150, height: 20 });

        // Plateforme mobile horizontale 1
        this.movingPlatforms.push({
            x: 900, y: h - 700, width: 100, height: 20,
            startX: 900, endX: 1300, speed: 180, axis: 'x', dir: 1
        });

        // Ennemi patrouilleur sur une plateforme fixe au milieu
        this.platforms.push({ x: 1400, y: h - 750, width: 200, height: 20 });
        this.enemies.push({
            x: 1450, y: h - 790, width: 40, height: 40,
            startX: 1400, endX: 1560, speed: 200, direction: 1, vx: 200
        });

        // Plateforme mobile verticale (Ascenseur dangereux)
        this.movingPlatforms.push({
            x: 1700, y: h - 500, width: 100, height: 20,
            startY: h - 800, endY: h - 200, speed: 250, axis: 'y', dir: -1
        });

        // --- ZONE 3 : Lasers Pulsants (Timing) ---
        // Série de petites plateformes avec lasers intermittents entre elles
        this.platforms.push({ x: 1900, y: h - 500, width: 60, height: 20 });
        this.platforms.push({ x: 2100, y: h - 500, width: 60, height: 20 });
        this.platforms.push({ x: 2300, y: h - 500, width: 60, height: 20 });

        // Lasers verticaux qui bloquent le passage (Intervalle 2s, décalage progressif)
        this.pulsingLasers.push({ x: 2000, y: h - 600, width: 20, height: 300, interval: 2.0, offset: 0 });
        this.pulsingLasers.push({ x: 2200, y: h - 600, width: 20, height: 300, interval: 2.0, offset: 1.0 });

        // --- ZONE 4 : Plateformes Fragiles (Vitesse) ---
        // Longue section où il faut courir sans s'arrêter
        for (let i = 0; i < 8; i++) {
            this.crumblingPlatforms.push({
                x: 2500 + (i * 160),
                y: h - 500 - (i * 20), // Monte légèrement
                width: 100,
                height: 20,
                state: 'stable',
                timer: 0
            });
        }

        // Fosse mortelle (UV Zone en bas pour punir la chute)
        this.uvZones.push({ x: 2500, y: h - 100, width: 1500, height: 50 });

        // --- ZONE 5 : Le Final (Complexité combinée) ---
        this.platforms.push({ x: 3800, y: h - 700, width: 150, height: 20 });

        // Mur géant avec lasers horizontaux pulsants
        this.platforms.push({ x: 4100, y: 100, width: 50, height: 900, type: 'wall' });
        
        this.pulsingLasers.push({ x: 3950, y: h - 850, width: 150, height: 20, interval: 1.5, offset: 0 });
        this.pulsingLasers.push({ x: 3950, y: h - 950, width: 150, height: 20, interval: 1.5, offset: 0.75 });

        // Plateforme mobile finale très rapide pour contourner le mur par le haut
        this.movingPlatforms.push({
            x: 4000, y: 200, width: 80, height: 20,
            startX: 3900, endX: 4300, speed: 400, axis: 'x', dir: 1
        });

        // Plateforme d'arrivée
        this.platforms.push({ x: 4400, y: 300, width: 300, height: 20 });

        // Goal
        this.goal = { x: 4500, y: 150, width: 80, height: 150 };

        // Position de départ du joueur
        this.player.x = 50;
        this.player.y = h - 150;
    }

    // ============================================
    // UPDATE LOOP
    // ============================================

    update(deltaTime) {
        if (this.gameOver || this.victory) return;

        // Mise à jour du temps global (pour les lasers pulsants)
        this.globalTime += deltaTime;

        this.handleInput();
        
        // Physique des objets
        this.updateMovingPlatforms(deltaTime);
        this.updateCrumblingPlatforms(deltaTime);
        this.updatePulsingLasers(deltaTime);
        this.updateEnemies(deltaTime);
        
        // Physique du joueur
        this.updatePlayer(deltaTime);
        
        // Système
        this.updateCamera();
        this.updateParticles(deltaTime);
        this.checkCollisions();
        this.updateUI();
    }

    handleInput() {
        const keys = this.game.getKeys();
        const p = this.player;

        if (p.isDead || p.isDashing) return;

        // Déplacement horizontal
        let moveInput = 0;
        if (keys['ArrowLeft'] || keys['KeyA']) {
            moveInput = -1;
            p.facingDirection = -1;
        }
        if (keys['ArrowRight'] || keys['KeyD']) {
            moveInput = 1;
            p.facingDirection = 1;
        }

        // Physique plus nerveuse : arrêt instantané si pas d'input
        if (!p.onWall || (p.onWall && moveInput !== p.wallDirection)) {
            p.vx = moveInput * this.MOVE_SPEED;
        } else {
            p.vx = 0;
        }

        // Saut / Wall Jump
        if (keys['Space']) {
            if (!this.jumpPressed) {
                this.jumpPressed = true;

                if (p.onWall && p.canWallJump) {
                    // Wall Jump
                    p.vy = this.WALL_JUMP_VELOCITY_Y;
                    p.vx = -p.wallDirection * this.WALL_JUMP_VELOCITY_X;
                    p.facingDirection = -p.wallDirection;
                    p.onWall = false;
                    p.canWallJump = false;
                    p.jumpsLeft = 1;
                    p.attachedPlatform = null; // On se détache de la plateforme mobile
                    this.spawnParticles(p.x + p.width/2, p.y + p.height, 5, this.colors.CYAN);
                } else if (p.grounded) {
                    // Saut normal
                    p.vy = this.JUMP_VELOCITY;
                    p.grounded = false;
                    p.jumpsLeft = 1;
                    p.attachedPlatform = null;
                    this.spawnParticles(p.x + p.width/2, p.y + p.height, 5, '#ffffff');
                } else if (p.jumpsLeft > 0) {
                    // Double saut
                    p.vy = this.JUMP_VELOCITY;
                    p.jumpsLeft--;
                    p.attachedPlatform = null;
                    this.spawnParticles(p.x + p.width/2, p.y + p.height/2, 8, this.colors.LIFE_MIRROR);
                }
            }
        } else {
            this.jumpPressed = false;
        }

        // Dash
        if ((keys['ShiftLeft'] || keys['ShiftRight']) && !this.dashPressed && p.dashCooldown <= 0) {
            this.dashPressed = true;
            p.isDashing = true;
            p.dashTimer = this.DASH_DURATION;
            p.dashCooldown = this.DASH_COOLDOWN;
            p.dashDirection = p.facingDirection;
            p.vy = 0; // Annuler gravité pendant dash
            p.attachedPlatform = null;
            this.spawnParticles(p.x + p.width/2, p.y + p.height/2, 12, this.colors.CYAN);
        }

        if (!keys['ShiftLeft'] && !keys['ShiftRight']) {
            this.dashPressed = false;
        }
    }

    updatePlayer(dt) {
        const p = this.player;

        if (p.isDead) return;

        // Dash logic
        if (p.isDashing) {
            p.dashTimer -= dt;
            p.vx = p.dashDirection * this.DASH_SPEED;
            p.vy = 0;

            if (p.dashTimer <= 0) {
                p.isDashing = false;
                p.vx = 0;
            }
        }

        // Cooldown
        if (p.dashCooldown > 0) {
            p.dashCooldown -= dt;
        }

        // Gravité
        if (!p.isDashing) {
            p.vy += this.GRAVITY * dt;
            if (p.vy > this.MAX_FALL_SPEED) {
                p.vy = this.MAX_FALL_SPEED;
            }
        }

        // Application du mouvement
        p.x += p.vx * dt;
        p.y += p.vy * dt;

        // Mort par chute (hors map)
        if (p.y > this.levelHeight + 200) {
            this.killPlayer();
        }

        // Reset états par défaut (seront réactivés par checkCollisions)
        p.grounded = false;
        p.onWall = false;
        p.canWallJump = false;
        // On ne reset pas attachedPlatform ici, car on veut le garder entre les frames si pas sauté
    }

    updateMovingPlatforms(dt) {
        for (let p of this.movingPlatforms) {
            let moveAmount = p.speed * p.dir * dt;

            // Déplacement de la plateforme
            if (p.axis === 'x') {
                p.x += moveAmount;
                // Aller-retour
                if ((p.dir === 1 && p.x >= p.endX) || (p.dir === -1 && p.x <= p.startX)) {
                    p.dir *= -1;
                }
            } else {
                p.y += moveAmount;
                if ((p.dir === 1 && p.y >= p.endY) || (p.dir === -1 && p.y <= p.startY)) {
                    p.dir *= -1;
                }
            }

            // Si le joueur est attaché (posé dessus), il bouge avec la plateforme
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
                // Après 0.5s, la plateforme tombe
                if (p.timer > 0.5) {
                    p.state = 'falling';
                    p.vy = 0;
                }
            } else if (p.state === 'falling') {
                // Physique de chute simple
                p.vy = (p.vy || 0) + this.GRAVITY * dt;
                p.y += p.vy * dt;

                // Suppression si trop bas
                if (p.y > this.levelHeight + 100) {
                    this.crumblingPlatforms.splice(i, 1);
                }
            }
        }
    }

    updatePulsingLasers(dt) {
        for (let laser of this.pulsingLasers) {
            // Cycle on/off basé sur le temps global
            const cycle = (this.globalTime + laser.offset) % laser.interval;
            // Actif pendant 60% du temps
            laser.active = cycle < (laser.interval * 0.6);
            // Warning juste avant activation
            laser.warning = !laser.active && cycle > (laser.interval * 0.6) - 0.5;
        }
    }

    updateEnemies(dt) {
        for (let enemy of this.enemies) {
            enemy.x += enemy.vx * dt;
            // Patrouille simple
            if (enemy.x <= enemy.startX) {
                enemy.x = enemy.startX;
                enemy.vx = enemy.speed;
                enemy.direction = 1;
            } else if (enemy.x >= enemy.endX) {
                enemy.x = enemy.endX;
                enemy.vx = -enemy.speed;
                enemy.direction = -1;
            }
        }
    }

    updateCamera() {
        const { width, height } = this.game.getCanvasSize();
        
        // Caméra qui regarde devant le joueur ("Look ahead")
        const lookAhead = this.player.facingDirection * 100;
        const targetX = this.player.x - width / 3 + lookAhead;
        const targetY = this.player.y - height / 1.5;

        // Lissage (Lerp)
        this.cameraX += (targetX - this.cameraX) * 0.1;
        this.cameraY += (targetY - this.cameraY) * 0.1;

        // Bornes du niveau
        this.cameraX = Math.max(0, Math.min(this.cameraX, this.levelWidth - width));
        this.cameraY = Math.max(0, Math.min(this.cameraY, this.levelHeight - height));
    }

    updateParticles(dt) {
        for (let i = this.particles.length - 1; i >= 0; i--) {
            const part = this.particles[i];
            part.life -= dt;
            part.x += part.vx * dt;
            part.y += part.vy * dt;
            part.vy += 300 * dt;

            if (part.life <= 0) {
                this.particles.splice(i, 1);
            }
        }
    }

    // ============================================
    // COLLISIONS
    // ============================================

    checkCollisions() {
        const p = this.player;
        
        // On suppose qu'on est détaché par défaut à chaque frame, 
        // sauf si la collision sol le confirme
        let stillAttached = false;

        // 1. Plateformes Statiques
        this.handlePlatformCollisions(this.platforms);

        // 2. Plateformes Mobiles
        const attachedToMoving = this.handlePlatformCollisions(this.movingPlatforms, true);
        if (attachedToMoving) stillAttached = true;

        // 3. Plateformes Fragiles
        this.handlePlatformCollisions(this.crumblingPlatforms, false, true);

        // Si on n'a touché aucune plateforme mobile ce tour-ci, on détache
        if (!stillAttached) {
            p.attachedPlatform = null;
        }

        // 4. Dangers (Mort immédiate)
        if (!p.isDashing) {
            // UV Zones
            for (let uv of this.uvZones) {
                if (this.checkAABB(p, uv)) { this.killPlayer(); return; }
            }
            // Lasers Pulsants (Seulement si actifs)
            for (let laser of this.pulsingLasers) {
                if (laser.active && this.checkAABB(p, laser)) { this.killPlayer(); return; }
            }
            // Ennemis
            for (let enemy of this.enemies) {
                if (this.checkAABB(p, enemy)) { this.killPlayer(); return; }
            }
        }

        // 5. Victoire
        if (this.goal && this.checkAABB(p, this.goal)) {
            this.triggerVictory();
        }
    }

    handlePlatformCollisions(platforms, isMoving = false, isCrumbling = false) {
        const p = this.player;
        let touched = false;

        for (let plat of platforms) {
            // Ignorer les plateformes qui tombent déjà
            if (isCrumbling && plat.state === 'falling') continue;

            if (this.checkAABB(p, plat)) {
                const overlapX = Math.min(p.x + p.width - plat.x, plat.x + plat.width - p.x);
                const overlapY = Math.min(p.y + p.height - plat.y, plat.y + plat.height - p.y);

                if (overlapX < overlapY) {
                    // Collision Horizontale (Mur)
                    if (p.x < plat.x) {
                        p.x = plat.x - p.width;
                        p.wallDirection = 1;
                    } else {
                        p.x = plat.x + plat.width;
                        p.wallDirection = -1;
                    }
                    
                    p.onWall = true;
                    p.canWallJump = true;
                    // Friction sur le mur
                    if (p.vy > 0) p.vy *= 0.6;
                } else {
                    // Collision Verticale
                    if (p.y < plat.y) {
                        // Atterrissage sur le dessus
                        p.y = plat.y - p.height;
                        p.vy = 0;
                        p.grounded = true;
                        p.jumpsLeft = 2;

                        // Logiques spécifiques
                        if (isMoving) {
                            p.attachedPlatform = plat;
                            touched = true;
                        }
                        if (isCrumbling && plat.state === 'stable') {
                            plat.state = 'shaking'; // Déclenche le compte à rebours
                        }
                    } else {
                        // Cogne le plafond
                        p.y = plat.y + plat.height;
                        p.vy = 0;
                    }
                }
            }
        }
        return touched;
    }

    checkAABB(a, b) {
        return a.x < b.x + b.width &&
               a.x + a.width > b.x &&
               a.y < b.y + b.height &&
               a.y + a.height > b.y;
    }

    killPlayer() {
        if (this.player.isDead) return;

        this.player.isDead = true;
        this.spawnParticles(
            this.player.x + this.player.width/2,
            this.player.y + this.player.height/2,
            30,
            this.colors.DANGER
        );

        setTimeout(() => {
            this.gameOver = true;
            this.game.showDialogue([
                "ALERTE : Contamination éliminée.",
                "RÉINITIALISATION DE LA ZONE..."
            ], () => {
                this.resetLevel();
            });
        }, 1000);
    }

    triggerVictory() {
        if (this.victory) return;

        this.victory = true;
        this.spawnParticles(
            this.player.x + this.player.width/2,
            this.player.y + this.player.height/2,
            50,
            this.colors.LIFE_MIRROR
        );

        setTimeout(() => {
            this.game.showDialogue([
                "La Brèche a été franchie.",
                "Accès aux systèmes centraux...",
                "INITIALISATION DU CHAPITRE 3"
            ], () => {
                this.game.startChapter(3);
            });
        }, 1000);
    }

    resetLevel() {
        this.endTutorial(); // Masquer le tutoriel lors de la réinitialisation
        this.player.x = 50;
        this.player.y = this.levelHeight - 150;
        this.player.vx = 0;
        this.player.vy = 0;
        this.player.isDead = false;
        this.player.grounded = false;
        this.player.jumpsLeft = 2;
        this.player.dashCooldown = 0;
        this.player.attachedPlatform = null;
        this.gameOver = false;
        this.victory = false;

        // Reset plateformes fragiles (on les recrée)
        this.crumblingPlatforms = [];
        for (let i = 0; i < 8; i++) {
            this.crumblingPlatforms.push({
                x: 2500 + (i * 160),
                y: this.levelHeight - 500 - (i * 20),
                width: 100, height: 20, state: 'stable', timer: 0
            });
        }
    }

    updateUI() {
        if (!this.domElements || !this.domElements.dashFill) return;

        const dashPercent = Math.max(0, 100 - (this.player.dashCooldown / this.DASH_COOLDOWN) * 100);
        this.domElements.dashFill.style.width = `${dashPercent}%`;
        
        // Feedback visuel quand le dash est prêt
        if (dashPercent >= 100) {
            this.domElements.dashFill.style.backgroundColor = this.colors.CYAN;
            this.domElements.dashFill.style.boxShadow = `0 0 10px ${this.colors.CYAN}`;
        } else {
            this.domElements.dashFill.style.backgroundColor = '#005555';
            this.domElements.dashFill.style.boxShadow = 'none';
        }
    }

    spawnParticles(x, y, count, color) {
        for (let i = 0; i < count; i++) {
            const angle = Math.random() * Math.PI * 2;
            const speed = 100 + Math.random() * 200;
            this.particles.push({
                x, y,
                vx: Math.cos(angle) * speed,
                vy: Math.sin(angle) * speed - 100,
                life: 0.3 + Math.random() * 0.4,
                color,
                size: 3 + Math.random() * 5
            });
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
        if (this.tutorialStep >= this.tutorialSteps.length) {
            this.endTutorial();
            return;
        }

        const step = this.tutorialSteps[this.tutorialStep];

        // Mettre à jour le contenu
        const titleEl = document.getElementById('ch2-tutorial-title');
        const contentEl = document.getElementById('ch2-tutorial-content');
        const progressEl = document.getElementById('ch2-tutorial-progress');

        if (titleEl) titleEl.textContent = step.title;
        if (contentEl) contentEl.textContent = step.content;

        // Mettre à jour les points de progression
        if (progressEl) {
            progressEl.innerHTML = '';
            for (let i = 0; i < this.tutorialSteps.length; i++) {
                const dot = document.createElement('div');
                dot.className = 'ch2-tutorial-dot' + (i === this.tutorialStep ? ' active' : '');
                progressEl.appendChild(dot);
            }
        }

        // Afficher l'overlay
        const overlay = document.getElementById('ch2-tutorial-overlay');
        if (overlay) {
            overlay.classList.add('active');
        }
    }

    nextTutorialStep() {
        this.tutorialStep++;
        if (this.tutorialStep >= this.tutorialSteps.length) {
            this.endTutorial();
        } else {
            this.showTutorialStep();
        }
    }

    skipTutorial() {
        this.endTutorial();
    }

    endTutorial() {
        this.tutorialActive = false;
        const overlay = document.getElementById('ch2-tutorial-overlay');
        if (overlay) {
            overlay.classList.remove('active');
        }
    }

    // ============================================
    // RENDU (DRAW)
    // ============================================

    draw(ctx) {
        const { width, height } = this.game.getCanvasSize();

        // Fond
        ctx.fillStyle = '#050505';
        ctx.fillRect(0, 0, width, height);

        // Grille techno
        ctx.strokeStyle = '#111';
        ctx.lineWidth = 1;
        for(let x = 0; x < width; x+=50) {
            ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, height); ctx.stroke();
        }

        ctx.save();
        ctx.translate(-this.cameraX, -this.cameraY);

        this.drawPlatforms(ctx);
        this.drawMovingPlatforms(ctx);
        this.drawCrumblingPlatforms(ctx);
        this.drawUVZones(ctx);
        this.drawPulsingLasers(ctx);
        this.drawEnemies(ctx);
        this.drawGoal(ctx);
        this.drawPlayer(ctx);
        this.drawParticles(ctx);

        ctx.restore();
    }

    drawPlatforms(ctx) {
        ctx.fillStyle = '#222';
        ctx.strokeStyle = '#444';
        ctx.lineWidth = 2;

        for (let plat of this.platforms) {
            ctx.fillRect(plat.x, plat.y, plat.width, plat.height);
            ctx.strokeRect(plat.x, plat.y, plat.width, plat.height);
        }
    }

    drawMovingPlatforms(ctx) {
        for (let p of this.movingPlatforms) {
            ctx.fillStyle = '#1a2a3a';
            ctx.strokeStyle = this.colors.CYAN;
            ctx.lineWidth = 2;
            
            // Dessin
            ctx.fillRect(p.x, p.y, p.width, p.height);
            ctx.strokeRect(p.x, p.y, p.width, p.height);

            // Rail de guidage (visuel)
            ctx.strokeStyle = 'rgba(0, 255, 255, 0.1)';
            ctx.lineWidth = 1;
            ctx.beginPath();
            if (p.axis === 'x') {
                ctx.moveTo(p.startX, p.y + p.height/2);
                ctx.lineTo(p.endX, p.y + p.height/2);
            } else {
                ctx.moveTo(p.x + p.width/2, p.startY);
                ctx.lineTo(p.x + p.width/2, p.endY);
            }
            ctx.stroke();
        }
    }

    drawCrumblingPlatforms(ctx) {
        for (let p of this.crumblingPlatforms) {
            let dx = 0, dy = 0;
            
            // Effet de tremblement
            if (p.state === 'shaking') {
                dx = (Math.random() - 0.5) * 5;
                dy = (Math.random() - 0.5) * 5;
                ctx.fillStyle = '#553333';
                ctx.strokeStyle = '#aa5555';
            } else {
                ctx.fillStyle = '#333';
                ctx.strokeStyle = '#666';
            }

            ctx.fillRect(p.x + dx, p.y + dy, p.width, p.height);
            ctx.strokeRect(p.x + dx, p.y + dy, p.width, p.height);
            
            // Fissure
            ctx.beginPath();
            ctx.moveTo(p.x + dx + 10, p.y + dy);
            ctx.lineTo(p.x + dx + p.width/2, p.y + dy + p.height);
            ctx.stroke();
        }
    }

    drawPulsingLasers(ctx) {
        for (let l of this.pulsingLasers) {
            if (l.active) {
                // Laser actif (Mortel)
                ctx.fillStyle = 'rgba(255, 0, 0, 0.6)';
                ctx.fillRect(l.x, l.y, l.width, l.height);
                
                ctx.strokeStyle = '#ff0000';
                ctx.lineWidth = 2;
                ctx.shadowBlur = 15;
                ctx.shadowColor = '#ff0000';
                ctx.strokeRect(l.x, l.y, l.width, l.height);
                ctx.shadowBlur = 0;
            } else if (l.warning) {
                // Warning (Clignote jaune)
                ctx.fillStyle = `rgba(255, 255, 0, ${0.3 + Math.random()*0.3})`;
                ctx.fillRect(l.x, l.y, l.width, l.height);
            } else {
                // Inactif (Structure)
                ctx.strokeStyle = 'rgba(50, 0, 0, 0.3)';
                ctx.lineWidth = 1;
                ctx.strokeRect(l.x, l.y, l.width, l.height);
            }
        }
    }

    drawUVZones(ctx) {
        ctx.fillStyle = 'rgba(255, 68, 68, 0.3)';
        ctx.strokeStyle = this.colors.DANGER;
        ctx.lineWidth = 2;

        for (let uv of this.uvZones) {
            ctx.fillRect(uv.x, uv.y, uv.width, uv.height);
            ctx.strokeRect(uv.x, uv.y, uv.width, uv.height);
            
            // Animation
            const t = performance.now() / 200;
            ctx.strokeStyle = `rgba(255,0,0,${0.3 + Math.sin(t)*0.2})`;
            ctx.beginPath();
            ctx.moveTo(uv.x, uv.y + uv.height/2);
            ctx.lineTo(uv.x + uv.width, uv.y + uv.height/2);
            ctx.stroke();
        }
    }

    drawEnemies(ctx) {
        for (let enemy of this.enemies) {
            ctx.fillStyle = this.colors.DANGER;
            ctx.fillRect(enemy.x, enemy.y, enemy.width, enemy.height);
            
            // Oeil
            ctx.fillStyle = '#fff';
            const eyeX = enemy.direction > 0 ? enemy.x + 25 : enemy.x + 5;
            ctx.fillRect(eyeX, enemy.y + 10, 10, 10);
            
            // Glow
            ctx.shadowBlur = 10;
            ctx.shadowColor = 'red';
            ctx.strokeRect(enemy.x, enemy.y, enemy.width, enemy.height);
            ctx.shadowBlur = 0;
        }
    }

    drawGoal(ctx) {
        if (!this.goal) return;
        const g = this.goal;

        ctx.fillStyle = '#0a2a0a';
        ctx.fillRect(g.x, g.y, g.width, g.height);
        
        ctx.strokeStyle = this.colors.LIFE_MIRROR;
        ctx.lineWidth = 3;
        ctx.strokeRect(g.x, g.y, g.width, g.height);
        
        // Pulsation
        const scale = 1 + Math.sin(performance.now() / 300) * 0.05;
        ctx.save();
        ctx.translate(g.x + g.width/2, g.y + g.height/2);
        ctx.scale(scale, scale);
        ctx.strokeStyle = 'rgba(0, 255, 0, 0.5)';
        ctx.strokeRect(-g.width/2 - 5, -g.height/2 - 5, g.width+10, g.height+10);
        ctx.restore();
    }

    drawPlayer(ctx) {
        const p = this.player;
        if (p.isDead) return;

        ctx.save();
        
        // Glow dash
        if (p.isDashing) {
            ctx.shadowBlur = 20;
            ctx.shadowColor = this.colors.CYAN;
        }

        ctx.fillStyle = this.colors.LIFE_MIRROR;
        ctx.fillRect(p.x, p.y, p.width, p.height);
        
        ctx.strokeStyle = '#fff';
        ctx.lineWidth = 2;
        ctx.strokeRect(p.x, p.y, p.width, p.height);

        // Yeux
        ctx.fillStyle = '#fff';
        const eyeOffset = p.facingDirection * 8;
        ctx.fillRect(p.x + p.width/2 + eyeOffset - 2, p.y + 8, 4, 4);

        ctx.restore();
    }

    drawParticles(ctx) {
        for (let part of this.particles) {
            ctx.fillStyle = part.color;
            ctx.globalAlpha = part.life;
            ctx.fillRect(part.x, part.y, part.size, part.size);
        }
        ctx.globalAlpha = 1.0;
    }
}