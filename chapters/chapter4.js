/**
 * CHAPITRE 4 : LA PROPAGATION
 *
 * Contexte : La bacterie rouge mutee doit se propager d'animal en animal.
 * Mecanique : Jeu de visee style Angry Birds - viser et ajuster la puissance
 * pour sauter d'un hote a l'autre.
 *
 * Concept scientifique : Transmission zoonotique inter-especes.
 * La bacterie miroir a mute et peut desormais infecter les organismes
 * multicellulaires. Elle doit traverser la chaine animale pour atteindre
 * l'humain - la contamination finale.
 */

export class Chapter4 {
    constructor(game) {
        this.game = game;
        this.colors = game.getColors();

        // Phases du jeu
        this.phase = 'intro'; // intro, aiming, flying, landed, infected, victory, complete

        // Camera
        this.camera = { x: 0, y: 0 };
        this.cameraTarget = { x: 0, y: 0 };
        this.cameraSmooth = 0.05;

        // Monde
        this.worldWidth = 6000;
        this.worldHeight = 800;
        this.groundY = 0; // sera calcule dans init

        // Bacterie (projectile)
        this.bacteria = {
            x: 0, y: 0,
            vx: 0, vy: 0,
            radius: 8,
            onAnimal: -1,
            flying: false,
            trail: []
        };

        // Gravite et puissance
        this.gravity = 600;
        this.maxPower = 700;
        this.minPower = 80;
        this.maxAimDistance = 250; // distance souris max pour puissance max

        // Visee - la souris controle directement direction + puissance
        this.aimAngle = 0;
        this.aimPower = 0;
        this.arrowPulse = 0;

        // Input direct - on gere nos propres events pour eviter les problemes d'overlay
        this.mouseX = 0;
        this.mouseY = 0;
        this.mouseClicked = false; // true une seule frame lors du clic

        // Animaux
        this.animals = [];
        this.currentAnimalIndex = 0;
        this.infectedAnimals = new Set();

        // Particules
        this.particles = [];

        // Animation
        this.time = 0;
        this.infectionTimer = 0;
        this.infectionDuration = 1.5;

        // Tentatives
        this.attempts = 0;
        this.maxAttempts = 3;

        // Fond - elements decoratifs
        this.bgElements = [];

        // Bound handlers pour pouvoir les retirer dans destroy()
        this._onMouseMove = (e) => {
            this.mouseX = e.clientX;
            this.mouseY = e.clientY;
        };
        this._onMouseDown = (e) => {
            this.mouseX = e.clientX;
            this.mouseY = e.clientY;
            this.mouseClicked = true;
        };
        this._onTouchStart = (e) => {
            const t = e.touches[0];
            this.mouseX = t.clientX;
            this.mouseY = t.clientY;
            this.mouseClicked = true;
        };
        this._onTouchMove = (e) => {
            const t = e.touches[0];
            this.mouseX = t.clientX;
            this.mouseY = t.clientY;
        };

        this.init();
    }

    async init() {
        const { width, height } = this.game.getCanvasSize();
        this.groundY = height * 0.75;

        // Installer nos propres listeners directement sur le canvas
        const canvas = document.getElementById('game-canvas');
        canvas.addEventListener('mousemove', this._onMouseMove);
        canvas.addEventListener('mousedown', this._onMouseDown);
        canvas.addEventListener('touchstart', this._onTouchStart, { passive: false });
        canvas.addEventListener('touchmove', this._onTouchMove, { passive: false });

        // Aussi sur window pour capter meme si l'overlay intercepte
        window.addEventListener('mousemove', this._onMouseMove);
        window.addEventListener('mousedown', this._onMouseDown);
        window.addEventListener('touchstart', this._onTouchStart, { passive: false });
        window.addEventListener('touchmove', this._onTouchMove, { passive: false });

        this.createAnimals();
        this.createBackground();

        // Placer la bacterie sur le premier animal
        this.placeBacteriaOnAnimal(0);
        this.infectedAnimals.add(0);

        // Centrer la camera
        this.camera.x = this.animals[0].x - width / 3;
        this.cameraTarget.x = this.camera.x;

        this.game.setInstructions('LA PROPAGATION');

        // Attendre que startChapter() ait fini de mettre state='playing'
        // avant d'appeler showDialogue (sinon state est ecrase)
        await new Promise(resolve => setTimeout(resolve, 50));

        // Reset mouseClicked pour eviter un lancement immediat
        // (le clic sur "CONTINUER" du dialogue precedent pourrait persister)
        this.mouseClicked = false;

        this.game.showDialogue([
            "An 2045 - La bacterie miroir a mute.",
            "Elle peut desormais infecter les organismes multicellulaires.",
            "Une seule bacterie rouge... c'est tout ce qu'il faut.",
            "// Deplacez la souris pour viser. La distance controle la puissance.",
            "// Cliquez pour sauter vers l'animal suivant.",
            "Objectif : atteindre l'humain. La contamination finale."
        ], () => {
            this.phase = 'aiming';
            this.mouseClicked = false; // Reset pour eviter un tir au sortir du dialogue
        });
    }

    createAnimals() {
        const groundY = this.groundY;

        const animalDefs = [
            {
                type: 'souris', name: 'Souris',
                width: 30, height: 20, color: '#aa8866',
                resistance: 0, speed: 0,
                description: 'Petit mammifere - Hote initial'
            },
            {
                type: 'oiseau', name: 'Moineau',
                width: 25, height: 20, color: '#cc9944',
                resistance: 1, speed: 40,
                description: 'Oiseau - Vecteur aerien rapide'
            },
            {
                type: 'rat', name: 'Rat',
                width: 40, height: 25, color: '#887766',
                resistance: 1, speed: 0,
                description: 'Rongeur - Reservoir naturel'
            },
            {
                type: 'chat', name: 'Chat',
                width: 50, height: 35, color: '#ddaa77',
                resistance: 2, speed: 25,
                description: 'Felin - Predateur opportuniste'
            },
            {
                type: 'chien', name: 'Chien',
                width: 60, height: 45, color: '#bb8855',
                resistance: 2, speed: 15,
                description: 'Canide - Contact humain frequent'
            },
            {
                type: 'cochon', name: 'Cochon',
                width: 70, height: 50, color: '#eea8a8',
                resistance: 3, speed: 0,
                description: 'Porcin - Creuset genetique ideal'
            },
            {
                type: 'singe', name: 'Singe',
                width: 45, height: 55, color: '#aa7744',
                resistance: 3, speed: 30,
                description: 'Primate - Proche cousin genetique'
            },
            {
                type: 'humain', name: 'Humain',
                width: 40, height: 70, color: '#eebb99',
                resistance: 4, speed: 0,
                description: 'Homo sapiens - Cible finale'
            }
        ];

        let xPos = 200;
        for (let i = 0; i < animalDefs.length; i++) {
            const def = animalDefs[i];
            const spacing = 400 + Math.random() * 300;

            let yOffset = 0;
            if (def.type === 'oiseau') yOffset = -120;
            if (def.type === 'singe') yOffset = -80;
            if (def.type === 'chat') yOffset = -40;

            const animal = {
                ...def,
                x: xPos,
                y: groundY - def.height / 2 + yOffset,
                baseX: xPos,
                baseY: groundY - def.height / 2 + yOffset,
                infected: i === 0,
                moveTimer: Math.random() * Math.PI * 2,
                moveRange: def.speed > 0 ? 60 : 0,
                hitRadius: Math.max(def.width, def.height) / 2 + 15,
                pulseTime: 0,
                platformY: yOffset < 0 ? groundY + yOffset : 0
            };

            this.animals.push(animal);
            xPos += spacing;
        }

        this.worldWidth = xPos + 400;
    }

    createBackground() {
        for (let x = 0; x < this.worldWidth; x += 80 + Math.random() * 120) {
            const type = Math.random();
            if (type < 0.3) {
                this.bgElements.push({
                    type: 'tree', x: x, y: this.groundY,
                    height: 80 + Math.random() * 60,
                    width: 20 + Math.random() * 15
                });
            } else if (type < 0.5) {
                this.bgElements.push({
                    type: 'rock', x: x, y: this.groundY,
                    size: 10 + Math.random() * 20
                });
            } else if (type < 0.7) {
                this.bgElements.push({
                    type: 'grass', x: x, y: this.groundY,
                    count: 3 + Math.floor(Math.random() * 4)
                });
            }
        }
    }

    placeBacteriaOnAnimal(index) {
        const animal = this.animals[index];
        this.bacteria.x = animal.x;
        this.bacteria.y = animal.y - animal.height / 2 - this.bacteria.radius;
        this.bacteria.vx = 0;
        this.bacteria.vy = 0;
        this.bacteria.flying = false;
        this.bacteria.onAnimal = index;
        this.bacteria.trail = [];
        this.currentAnimalIndex = index;
        this.attempts = 0;
    }

    update(deltaTime, timestamp) {
        if (this.phase === 'intro' || this.phase === 'complete') return;

        this.time += deltaTime;
        this.arrowPulse += deltaTime * 4;

        this.updateAnimals(deltaTime);
        this.updateParticles(deltaTime);

        const { width, height } = this.game.getCanvasSize();

        if (this.phase === 'aiming') {
            // Suivre l'animal actuel
            const animal = this.animals[this.currentAnimalIndex];
            this.bacteria.x = animal.x;
            this.bacteria.y = animal.y - animal.height / 2 - this.bacteria.radius;

            // Convertir position souris en coordonnees monde
            const worldMouseX = this.mouseX + this.camera.x;
            const worldMouseY = this.mouseY + this.camera.y;

            // Calculer angle et puissance depuis la bacterie vers la souris
            const dx = worldMouseX - this.bacteria.x;
            const dy = worldMouseY - this.bacteria.y;
            const dist = Math.sqrt(dx * dx + dy * dy);

            this.aimAngle = Math.atan2(dy, dx);
            // Puissance proportionnelle a la distance souris-bacterie
            this.aimPower = Math.min(this.maxPower, (dist / this.maxAimDistance) * this.maxPower);
            if (this.aimPower < this.minPower) this.aimPower = this.minPower;

            // Clic = lancer
            if (this.mouseClicked) {
                this.mouseClicked = false;
                this.launchBacteria();
                return;
            }

            // Camera suit l'animal actuel
            this.cameraTarget.x = this.bacteria.x - width / 3;
            this.cameraTarget.y = Math.min(0, this.bacteria.y - height / 2);

        } else if (this.phase === 'flying') {
            // Physique du projectile
            this.bacteria.vy += this.gravity * deltaTime;
            this.bacteria.x += this.bacteria.vx * deltaTime;
            this.bacteria.y += this.bacteria.vy * deltaTime;

            // Trainee
            this.bacteria.trail.push({ x: this.bacteria.x, y: this.bacteria.y, life: 0.5 });
            if (this.bacteria.trail.length > 30) this.bacteria.trail.shift();

            for (let i = this.bacteria.trail.length - 1; i >= 0; i--) {
                this.bacteria.trail[i].life -= deltaTime;
                if (this.bacteria.trail[i].life <= 0) {
                    this.bacteria.trail.splice(i, 1);
                }
            }

            // Collision avec les animaux
            for (let i = 0; i < this.animals.length; i++) {
                if (i === this.currentAnimalIndex) continue;
                if (this.infectedAnimals.has(i) && i < this.currentAnimalIndex) continue;

                const animal = this.animals[i];
                const adx = this.bacteria.x - animal.x;
                const ady = this.bacteria.y - animal.y;
                const adist = Math.sqrt(adx * adx + ady * ady);

                if (adist < animal.hitRadius) {
                    this.onAnimalHit(i);
                    return;
                }
            }

            // Tombe au sol ou sort de l'ecran
            if (this.bacteria.y > this.groundY + 50 ||
                this.bacteria.x < this.camera.x - 300 ||
                this.bacteria.x > this.camera.x + width + 600 ||
                this.bacteria.y > this.groundY + 200) {
                this.onMiss();
                return;
            }

            // Camera suit la bacterie
            this.cameraTarget.x = this.bacteria.x - width / 3;
            this.cameraTarget.y = Math.min(0, this.bacteria.y - height / 2 + 100);

        } else if (this.phase === 'infected') {
            this.infectionTimer += deltaTime;
            const animal = this.animals[this.currentAnimalIndex];

            this.bacteria.x = animal.x;
            this.bacteria.y = animal.y - animal.height / 2 - this.bacteria.radius;

            if (Math.random() < 0.3) {
                this.spawnInfectionParticle(animal.x, animal.y);
            }

            if (this.infectionTimer >= this.infectionDuration) {
                if (animal.type === 'humain') {
                    this.phase = 'victory';
                    this.game.showDialogue([
                        "Contamination reussie.",
                        "La bacterie miroir a atteint l'Homo sapiens.",
                        "Patient zero. La propagation humaine commence.",
                        "// La chiralite inversee se repand dans l'organisme.",
                        "// Les proteines ne sont plus reconnues. Le systeme immunitaire est aveugle.",
                        "Rien ne pourra l'arreter maintenant."
                    ], () => {
                        this.phase = 'complete';
                        this.game.chapterComplete(
                            "Patient zero confirme. La vie miroir a franchi la barriere des especes."
                        );
                    });
                } else {
                    this.phase = 'aiming';
                    this.infectionTimer = 0;
                }
            }
        }

        // Reset du clic (consomme apres usage)
        this.mouseClicked = false;

        // Camera smooth
        this.camera.x += (this.cameraTarget.x - this.camera.x) * this.cameraSmooth * 60 * deltaTime;
        this.camera.y += (this.cameraTarget.y - this.camera.y) * this.cameraSmooth * 60 * deltaTime;
        this.camera.x = Math.max(0, Math.min(this.worldWidth - width, this.camera.x));
    }

    updateAnimals(deltaTime) {
        for (const animal of this.animals) {
            animal.moveTimer += deltaTime;
            animal.pulseTime += deltaTime;
            if (animal.moveRange > 0) {
                animal.x = animal.baseX + Math.sin(animal.moveTimer * (animal.speed / 30)) * animal.moveRange;
            }
        }
    }

    launchBacteria() {
        this.phase = 'flying';
        this.bacteria.flying = true;
        this.bacteria.vx = Math.cos(this.aimAngle) * this.aimPower;
        this.bacteria.vy = Math.sin(this.aimAngle) * this.aimPower;
        this.bacteria.trail = [];
        this.attempts++;

        for (let i = 0; i < 10; i++) {
            this.particles.push({
                x: this.bacteria.x, y: this.bacteria.y,
                vx: (Math.random() - 0.5) * 200,
                vy: (Math.random() - 0.5) * 200,
                life: 0.5 + Math.random() * 0.3, maxLife: 0.8,
                color: this.colors.DANGER,
                size: 2 + Math.random() * 3
            });
        }
    }

    onAnimalHit(animalIndex) {
        const animal = this.animals[animalIndex];
        this.infectedAnimals.add(animalIndex);
        animal.infected = true;
        this.currentAnimalIndex = animalIndex;
        this.bacteria.flying = false;
        this.bacteria.onAnimal = animalIndex;

        for (let i = 0; i < 20; i++) {
            this.particles.push({
                x: animal.x, y: animal.y,
                vx: (Math.random() - 0.5) * 300,
                vy: (Math.random() - 0.5) * 300,
                life: 0.6 + Math.random() * 0.4, maxLife: 1.0,
                color: this.colors.LIFE_MIRROR,
                size: 2 + Math.random() * 4
            });
        }

        this.phase = 'infected';
        this.infectionTimer = 0;
    }

    onMiss() {
        this.bacteria.flying = false;

        for (let i = 0; i < 8; i++) {
            this.particles.push({
                x: this.bacteria.x, y: this.groundY,
                vx: (Math.random() - 0.5) * 150,
                vy: -Math.random() * 100,
                life: 0.5, maxLife: 0.5,
                color: this.colors.DANGER,
                size: 2
            });
        }

        if (this.attempts >= this.maxAttempts) {
            this.attempts = 0;
        }

        this.placeBacteriaOnAnimal(this.currentAnimalIndex);
        this.phase = 'aiming';
    }

    spawnInfectionParticle(x, y) {
        const angle = Math.random() * Math.PI * 2;
        const speed = 30 + Math.random() * 60;
        this.particles.push({
            x: x + (Math.random() - 0.5) * 30,
            y: y + (Math.random() - 0.5) * 30,
            vx: Math.cos(angle) * speed,
            vy: Math.sin(angle) * speed,
            life: 0.8 + Math.random() * 0.4, maxLife: 1.2,
            color: this.colors.DANGER,
            size: 2 + Math.random() * 2
        });
    }

    updateParticles(deltaTime) {
        for (let i = this.particles.length - 1; i >= 0; i--) {
            const p = this.particles[i];
            p.x += p.vx * deltaTime;
            p.y += p.vy * deltaTime;
            p.life -= deltaTime;
            if (p.life <= 0) {
                this.particles[i] = this.particles[this.particles.length - 1];
                this.particles.pop();
            }
        }
    }

    // ============================================
    // RENDU
    // ============================================

    draw(ctx) {
        const { width, height } = this.game.getCanvasSize();

        ctx.save();

        // Ciel
        this.drawSky(ctx, width, height);

        // Camera
        ctx.save();
        ctx.translate(-this.camera.x, -this.camera.y);

        this.drawBackground(ctx, width, height);
        this.drawGround(ctx, width, height);
        this.drawPlatforms(ctx);

        for (let i = 0; i < this.animals.length; i++) {
            this.drawAnimal(ctx, this.animals[i], i);
        }

        this.drawTrail(ctx);
        this.drawBacteria(ctx);

        // Fleche de visee et trajectoire
        if (this.phase === 'aiming') {
            this.drawAimArrow(ctx);
            this.drawTrajectory(ctx);
        }

        this.drawParticles(ctx);

        ctx.restore();

        // UI fixe
        this.drawUI(ctx, width, height);

        ctx.restore();
    }

    drawSky(ctx, width, height) {
        const gradient = ctx.createLinearGradient(0, 0, 0, height);
        gradient.addColorStop(0, '#0a0a1a');
        gradient.addColorStop(0.5, '#111122');
        gradient.addColorStop(1, '#1a1a2e');
        ctx.fillStyle = gradient;
        ctx.fillRect(0, 0, width, height);

        ctx.fillStyle = '#ffffff';
        for (let i = 0; i < 50; i++) {
            const sx = (i * 137.5) % width;
            const sy = (i * 73.1) % (height * 0.5);
            const twinkle = Math.sin(this.time * 2 + i) * 0.5 + 0.5;
            ctx.globalAlpha = 0.3 + twinkle * 0.7;
            ctx.beginPath();
            ctx.arc(sx, sy, 0.5 + twinkle * 1, 0, Math.PI * 2);
            ctx.fill();
        }
        ctx.globalAlpha = 1;
    }

    drawBackground(ctx, width, height) {
        const startX = Math.max(0, Math.floor((this.camera.x - 100) / 200) * 200);
        const endX = this.camera.x + width + 100;

        for (const elem of this.bgElements) {
            if (elem.x < startX - 100 || elem.x > endX + 100) continue;

            if (elem.type === 'tree') {
                ctx.fillStyle = '#2a1a0a';
                ctx.fillRect(elem.x - elem.width / 4, elem.y - elem.height, elem.width / 2, elem.height);
                ctx.fillStyle = '#1a3a1a';
                ctx.beginPath();
                ctx.arc(elem.x, elem.y - elem.height, elem.width, 0, Math.PI * 2);
                ctx.fill();
            } else if (elem.type === 'rock') {
                ctx.fillStyle = '#333340';
                ctx.beginPath();
                ctx.arc(elem.x, elem.y, elem.size, Math.PI, 0);
                ctx.fill();
            } else if (elem.type === 'grass') {
                ctx.strokeStyle = '#1a4a2a';
                ctx.lineWidth = 1;
                for (let j = 0; j < elem.count; j++) {
                    const gx = elem.x + j * 5 - (elem.count * 2.5);
                    const sway = Math.sin(this.time * 1.5 + gx * 0.1) * 3;
                    ctx.beginPath();
                    ctx.moveTo(gx, elem.y);
                    ctx.quadraticCurveTo(gx + sway, elem.y - 15, gx + sway * 1.5, elem.y - 25);
                    ctx.stroke();
                }
            }
        }
    }

    drawGround(ctx, width, height) {
        const gradient = ctx.createLinearGradient(0, this.groundY, 0, this.groundY + 200);
        gradient.addColorStop(0, '#1a2a1a');
        gradient.addColorStop(0.3, '#0f1a0f');
        gradient.addColorStop(1, '#050a05');
        ctx.fillStyle = gradient;
        ctx.fillRect(this.camera.x - 10, this.groundY, width + 20, 200);

        ctx.strokeStyle = '#2a4a2a';
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.moveTo(this.camera.x - 10, this.groundY);
        ctx.lineTo(this.camera.x + width + 10, this.groundY);
        ctx.stroke();
    }

    drawPlatforms(ctx) {
        for (const animal of this.animals) {
            if (animal.platformY !== 0) {
                const platY = animal.baseY + animal.height / 2;
                const platWidth = animal.width + 30;

                ctx.fillStyle = '#333340';
                ctx.fillRect(animal.baseX - 3, platY, 6, this.groundY - platY);

                ctx.fillStyle = '#444455';
                ctx.fillRect(animal.baseX - platWidth / 2, platY, platWidth, 6);

                ctx.strokeStyle = this.colors.UI_DIM + '44';
                ctx.lineWidth = 1;
                ctx.strokeRect(animal.baseX - platWidth / 2, platY, platWidth, 6);
            }
        }
    }

    drawAnimal(ctx, animal, index) {
        const infected = this.infectedAnimals.has(index);
        const isCurrentTarget = index === this.currentAnimalIndex + 1;
        const isCurrent = index === this.currentAnimalIndex;
        const pulse = Math.sin(animal.pulseTime * 3) * 0.1 + 0.9;

        ctx.save();
        ctx.translate(animal.x, animal.y);

        if (isCurrentTarget && this.phase === 'aiming') {
            ctx.shadowColor = this.colors.LIFE_MIRROR;
            ctx.shadowBlur = 15 + Math.sin(this.time * 4) * 8;
        }

        const baseColor = infected ? this.colors.DANGER : animal.color;
        const outlineColor = infected ? this.colors.LIFE_MIRROR : '#ffffff44';

        this.drawAnimalShape(ctx, animal, baseColor, outlineColor, pulse);

        ctx.shadowBlur = 0;

        ctx.fillStyle = infected ? this.colors.DANGER : this.colors.UI_DIM;
        ctx.font = '10px Courier New';
        ctx.textAlign = 'center';
        ctx.fillText(animal.name, 0, animal.height / 2 + 18);

        if (infected && !isCurrent) {
            ctx.fillStyle = this.colors.DANGER;
            ctx.font = 'bold 8px Courier New';
            ctx.fillText('INFECTE', 0, -animal.height / 2 - 10);
        }

        if (isCurrentTarget && this.phase === 'aiming') {
            ctx.fillStyle = this.colors.LIFE_MIRROR;
            ctx.font = '9px Courier New';
            const stars = '\u2605'.repeat(animal.resistance + 1);
            ctx.fillText(stars, 0, -animal.height / 2 - 18);
            ctx.fillStyle = this.colors.UI_DIM;
            ctx.fillText(animal.description, 0, animal.height / 2 + 30);
        }

        ctx.restore();
    }

    drawAnimalShape(ctx, animal, color, outlineColor, pulse) {
        const w = animal.width * pulse;
        const h = animal.height * pulse;

        switch (animal.type) {
            case 'souris':
                ctx.fillStyle = color;
                ctx.beginPath();
                ctx.ellipse(0, 0, w / 2, h / 2, 0, 0, Math.PI * 2);
                ctx.fill();
                ctx.strokeStyle = outlineColor;
                ctx.lineWidth = 1;
                ctx.stroke();
                ctx.beginPath();
                ctx.arc(-w / 4, -h / 2, 6, 0, Math.PI * 2);
                ctx.arc(w / 4, -h / 2, 6, 0, Math.PI * 2);
                ctx.fill();
                ctx.strokeStyle = color;
                ctx.lineWidth = 2;
                ctx.beginPath();
                ctx.moveTo(w / 2, 0);
                ctx.quadraticCurveTo(w / 2 + 15, -10, w / 2 + 20, 5);
                ctx.stroke();
                ctx.fillStyle = '#111';
                ctx.beginPath();
                ctx.arc(-w / 6, -3, 2, 0, Math.PI * 2);
                ctx.fill();
                break;

            case 'oiseau':
                ctx.fillStyle = color;
                ctx.beginPath();
                ctx.ellipse(0, 0, w / 2, h / 3, 0, 0, Math.PI * 2);
                ctx.fill();
                ctx.strokeStyle = outlineColor;
                ctx.lineWidth = 1;
                ctx.stroke();
                ctx.beginPath();
                ctx.arc(-w / 3, -h / 4, h / 4, 0, Math.PI * 2);
                ctx.fill();
                ctx.stroke();
                ctx.fillStyle = '#ffaa00';
                ctx.beginPath();
                ctx.moveTo(-w / 2, -h / 4);
                ctx.lineTo(-w / 2 - 8, -h / 4 + 2);
                ctx.lineTo(-w / 2, -h / 4 + 4);
                ctx.fill();
                ctx.fillStyle = color + 'cc';
                ctx.beginPath();
                ctx.moveTo(0, -h / 4);
                ctx.quadraticCurveTo(w / 4, -h, w / 2, -h / 4);
                ctx.fill();
                ctx.fillStyle = '#111';
                ctx.beginPath();
                ctx.arc(-w / 3 - 2, -h / 3, 1.5, 0, Math.PI * 2);
                ctx.fill();
                break;

            case 'rat':
                ctx.fillStyle = color;
                ctx.beginPath();
                ctx.ellipse(0, 0, w / 2, h / 2.5, 0, 0, Math.PI * 2);
                ctx.fill();
                ctx.strokeStyle = outlineColor;
                ctx.lineWidth = 1;
                ctx.stroke();
                ctx.beginPath();
                ctx.moveTo(-w / 2, -h / 6);
                ctx.lineTo(-w / 2 - 12, 0);
                ctx.lineTo(-w / 2, h / 6);
                ctx.fill();
                ctx.beginPath();
                ctx.arc(-w / 4, -h / 2, 7, 0, Math.PI * 2);
                ctx.fill();
                ctx.strokeStyle = color;
                ctx.lineWidth = 2;
                ctx.beginPath();
                ctx.moveTo(w / 2, 0);
                ctx.bezierCurveTo(w / 2 + 10, -15, w / 2 + 25, 10, w / 2 + 30, -5);
                ctx.stroke();
                ctx.fillStyle = '#111';
                ctx.beginPath();
                ctx.arc(-w / 4, -2, 2, 0, Math.PI * 2);
                ctx.fill();
                break;

            case 'chat':
                ctx.fillStyle = color;
                ctx.beginPath();
                ctx.ellipse(0, 3, w / 2, h / 2.5, 0, 0, Math.PI * 2);
                ctx.fill();
                ctx.strokeStyle = outlineColor;
                ctx.lineWidth = 1;
                ctx.stroke();
                ctx.beginPath();
                ctx.arc(-w / 3, -h / 4, h / 3, 0, Math.PI * 2);
                ctx.fill();
                ctx.stroke();
                ctx.beginPath();
                ctx.moveTo(-w / 3 - 8, -h / 2);
                ctx.lineTo(-w / 3 - 5, -h / 2 - 12);
                ctx.lineTo(-w / 3 - 2, -h / 2);
                ctx.fill();
                ctx.beginPath();
                ctx.moveTo(-w / 3 + 2, -h / 2);
                ctx.lineTo(-w / 3 + 5, -h / 2 - 12);
                ctx.lineTo(-w / 3 + 8, -h / 2);
                ctx.fill();
                ctx.strokeStyle = color;
                ctx.lineWidth = 3;
                ctx.beginPath();
                ctx.moveTo(w / 2, 0);
                ctx.bezierCurveTo(w / 2 + 15, -20, w / 2 + 25, -25, w / 2 + 20, -30);
                ctx.stroke();
                ctx.fillStyle = '#44ff44';
                ctx.beginPath();
                ctx.arc(-w / 3 - 4, -h / 4 - 2, 2.5, 0, Math.PI * 2);
                ctx.arc(-w / 3 + 4, -h / 4 - 2, 2.5, 0, Math.PI * 2);
                ctx.fill();
                ctx.fillStyle = '#111';
                ctx.beginPath();
                ctx.ellipse(-w / 3 - 4, -h / 4 - 2, 1, 2.5, 0, 0, Math.PI * 2);
                ctx.ellipse(-w / 3 + 4, -h / 4 - 2, 1, 2.5, 0, 0, Math.PI * 2);
                ctx.fill();
                break;

            case 'chien':
                ctx.fillStyle = color;
                ctx.beginPath();
                ctx.ellipse(0, 3, w / 2, h / 2.5, 0, 0, Math.PI * 2);
                ctx.fill();
                ctx.strokeStyle = outlineColor;
                ctx.lineWidth = 1;
                ctx.stroke();
                ctx.beginPath();
                ctx.arc(-w / 3, -h / 4, h / 2.8, 0, Math.PI * 2);
                ctx.fill();
                ctx.stroke();
                ctx.fillStyle = color;
                ctx.beginPath();
                ctx.ellipse(-w / 2, -h / 6, 8, 5, 0, 0, Math.PI * 2);
                ctx.fill();
                ctx.fillStyle = '#222';
                ctx.beginPath();
                ctx.arc(-w / 2 - 3, -h / 6, 3, 0, Math.PI * 2);
                ctx.fill();
                ctx.fillStyle = color + 'cc';
                ctx.beginPath();
                ctx.ellipse(-w / 3 - 10, -h / 4 + 5, 6, 12, -0.3, 0, Math.PI * 2);
                ctx.fill();
                ctx.beginPath();
                ctx.ellipse(-w / 3 + 8, -h / 4 + 5, 6, 12, 0.3, 0, Math.PI * 2);
                ctx.fill();
                ctx.fillStyle = color;
                ctx.fillRect(-w / 3, h / 3, 8, 12);
                ctx.fillRect(w / 4, h / 3, 8, 12);
                ctx.strokeStyle = color;
                ctx.lineWidth = 4;
                ctx.beginPath();
                ctx.moveTo(w / 2, -5);
                ctx.quadraticCurveTo(w / 2 + 15, -20, w / 2 + 10, -25);
                ctx.stroke();
                ctx.fillStyle = '#111';
                ctx.beginPath();
                ctx.arc(-w / 3 - 4, -h / 3, 2, 0, Math.PI * 2);
                ctx.arc(-w / 3 + 4, -h / 3, 2, 0, Math.PI * 2);
                ctx.fill();
                break;

            case 'cochon':
                ctx.fillStyle = color;
                ctx.beginPath();
                ctx.ellipse(0, 0, w / 2, h / 2, 0, 0, Math.PI * 2);
                ctx.fill();
                ctx.strokeStyle = outlineColor;
                ctx.lineWidth = 1;
                ctx.stroke();
                ctx.beginPath();
                ctx.arc(-w / 2.5, -h / 6, h / 3, 0, Math.PI * 2);
                ctx.fill();
                ctx.stroke();
                ctx.fillStyle = '#dd8888';
                ctx.beginPath();
                ctx.ellipse(-w / 2.5 - 10, -h / 6 + 2, 7, 5, 0, 0, Math.PI * 2);
                ctx.fill();
                ctx.fillStyle = '#aa6666';
                ctx.beginPath();
                ctx.arc(-w / 2.5 - 12, -h / 6 + 1, 1.5, 0, Math.PI * 2);
                ctx.arc(-w / 2.5 - 8, -h / 6 + 1, 1.5, 0, Math.PI * 2);
                ctx.fill();
                ctx.fillStyle = color;
                ctx.beginPath();
                ctx.moveTo(-w / 2.5 - 5, -h / 3);
                ctx.lineTo(-w / 2.5 - 10, -h / 2.5 - 10);
                ctx.lineTo(-w / 2.5, -h / 3);
                ctx.fill();
                ctx.beginPath();
                ctx.moveTo(-w / 2.5 + 3, -h / 3);
                ctx.lineTo(-w / 2.5 + 8, -h / 2.5 - 10);
                ctx.lineTo(-w / 2.5 + 12, -h / 3);
                ctx.fill();
                ctx.fillRect(-w / 3, h / 2 - 5, 10, 12);
                ctx.fillRect(w / 4, h / 2 - 5, 10, 12);
                ctx.strokeStyle = color;
                ctx.lineWidth = 2;
                ctx.beginPath();
                ctx.moveTo(w / 2, 0);
                ctx.bezierCurveTo(w / 2 + 5, -8, w / 2 + 12, 5, w / 2 + 10, -8);
                ctx.stroke();
                ctx.fillStyle = '#111';
                ctx.beginPath();
                ctx.arc(-w / 2.5 - 4, -h / 4, 2, 0, Math.PI * 2);
                ctx.arc(-w / 2.5 + 4, -h / 4, 2, 0, Math.PI * 2);
                ctx.fill();
                break;

            case 'singe':
                ctx.fillStyle = color;
                ctx.beginPath();
                ctx.ellipse(0, 5, w / 2.5, h / 2.5, 0, 0, Math.PI * 2);
                ctx.fill();
                ctx.strokeStyle = outlineColor;
                ctx.lineWidth = 1;
                ctx.stroke();
                ctx.beginPath();
                ctx.arc(0, -h / 3, h / 4, 0, Math.PI * 2);
                ctx.fill();
                ctx.stroke();
                ctx.fillStyle = '#ddbb88';
                ctx.beginPath();
                ctx.ellipse(0, -h / 3 + 3, h / 6, h / 5, 0, 0, Math.PI * 2);
                ctx.fill();
                ctx.fillStyle = '#ddbb88';
                ctx.beginPath();
                ctx.arc(-h / 4 - 2, -h / 3, 5, 0, Math.PI * 2);
                ctx.arc(h / 4 + 2, -h / 3, 5, 0, Math.PI * 2);
                ctx.fill();
                ctx.strokeStyle = color;
                ctx.lineWidth = 4;
                ctx.beginPath();
                ctx.moveTo(-w / 3, 0);
                ctx.quadraticCurveTo(-w / 2 - 10, h / 3, -w / 3 - 5, h / 2);
                ctx.stroke();
                ctx.beginPath();
                ctx.moveTo(w / 3, 0);
                ctx.quadraticCurveTo(w / 2 + 10, h / 3, w / 3 + 5, h / 2);
                ctx.stroke();
                ctx.lineWidth = 3;
                ctx.beginPath();
                ctx.moveTo(0, h / 2.5);
                ctx.bezierCurveTo(15, h / 2, 25, h / 3, 20, 0);
                ctx.stroke();
                ctx.fillStyle = '#111';
                ctx.beginPath();
                ctx.arc(-5, -h / 3 - 2, 2, 0, Math.PI * 2);
                ctx.arc(5, -h / 3 - 2, 2, 0, Math.PI * 2);
                ctx.fill();
                break;

            case 'humain':
                ctx.fillStyle = '#4466aa';
                ctx.fillRect(-w / 4, -h / 6, w / 2, h / 2.5);
                ctx.fillStyle = color;
                ctx.beginPath();
                ctx.arc(0, -h / 3, h / 6, 0, Math.PI * 2);
                ctx.fill();
                ctx.strokeStyle = outlineColor;
                ctx.lineWidth = 1;
                ctx.stroke();
                ctx.fillStyle = '#332211';
                ctx.beginPath();
                ctx.arc(0, -h / 3 - 3, h / 6 + 1, Math.PI, 0);
                ctx.fill();
                ctx.fillStyle = '#334455';
                ctx.fillRect(-w / 5, h / 4, w / 5 - 2, h / 3);
                ctx.fillRect(2, h / 4, w / 5 - 2, h / 3);
                ctx.fillStyle = color;
                ctx.fillRect(-w / 2.5, -h / 6, w / 6, h / 3);
                ctx.fillRect(w / 4, -h / 6, w / 6, h / 3);
                ctx.fillStyle = '#111';
                ctx.beginPath();
                ctx.arc(-4, -h / 3 - 1, 1.5, 0, Math.PI * 2);
                ctx.arc(4, -h / 3 - 1, 1.5, 0, Math.PI * 2);
                ctx.fill();
                ctx.strokeStyle = '#111';
                ctx.lineWidth = 1;
                ctx.beginPath();
                ctx.arc(0, -h / 3 + 5, 3, 0, Math.PI);
                ctx.stroke();

                if (!animal.infected) {
                    ctx.fillStyle = this.colors.DANGER;
                    ctx.font = 'bold 14px Courier New';
                    ctx.textAlign = 'center';
                    const blink = Math.sin(this.time * 5) > 0;
                    if (blink) {
                        ctx.fillText('CIBLE FINALE', 0, -h / 2 - 25);
                    }
                }
                break;
        }
    }

    drawBacteria(ctx) {
        const b = this.bacteria;
        const pulse = 1 + Math.sin(this.time * 6) * 0.15;
        const r = b.radius * pulse;

        ctx.shadowColor = this.colors.DANGER;
        ctx.shadowBlur = 15;

        ctx.fillStyle = this.colors.DANGER;
        ctx.beginPath();
        ctx.arc(b.x, b.y, r, 0, Math.PI * 2);
        ctx.fill();

        ctx.strokeStyle = this.colors.LIFE_MIRROR;
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.arc(b.x, b.y, r + 2, 0, Math.PI * 2);
        ctx.stroke();

        ctx.strokeStyle = this.colors.DANGER + 'aa';
        ctx.lineWidth = 1.5;
        for (let i = 0; i < 5; i++) {
            const angle = (i / 5) * Math.PI * 2 + this.time * 2;
            const wobble = Math.sin(this.time * 8 + i * 2) * 3;
            ctx.beginPath();
            ctx.moveTo(
                b.x + Math.cos(angle) * r,
                b.y + Math.sin(angle) * r
            );
            ctx.quadraticCurveTo(
                b.x + Math.cos(angle) * (r + 8) + wobble,
                b.y + Math.sin(angle) * (r + 8) + wobble,
                b.x + Math.cos(angle) * (r + 14),
                b.y + Math.sin(angle) * (r + 14)
            );
            ctx.stroke();
        }

        ctx.shadowBlur = 0;
    }

    drawTrail(ctx) {
        for (const point of this.bacteria.trail) {
            const alpha = point.life / 0.5;
            ctx.fillStyle = `rgba(255, 68, 68, ${alpha * 0.4})`;
            ctx.beginPath();
            ctx.arc(point.x, point.y, 3 * alpha, 0, Math.PI * 2);
            ctx.fill();
        }
    }

    drawTrajectory(ctx) {
        const startX = this.bacteria.x;
        const startY = this.bacteria.y;
        const vx = Math.cos(this.aimAngle) * this.aimPower;
        const vy = Math.sin(this.aimAngle) * this.aimPower;

        ctx.setLineDash([5, 8]);
        ctx.strokeStyle = this.colors.UI_DIM + '66';
        ctx.lineWidth = 1;
        ctx.beginPath();

        let px = startX;
        let py = startY;
        let pvy = vy;
        const dt = 0.03;

        ctx.moveTo(px, py);

        for (let i = 0; i < 60; i++) {
            pvy += this.gravity * dt;
            px += vx * dt;
            py += pvy * dt;
            if (py > this.groundY + 20) break;
            ctx.lineTo(px, py);
        }

        ctx.stroke();
        ctx.setLineDash([]);
    }

    drawAimArrow(ctx) {
        const b = this.bacteria;
        const arrowLength = 30 + (this.aimPower / this.maxPower) * 50;
        const pulse = Math.sin(this.arrowPulse) * 0.1 + 0.9;

        const endX = b.x + Math.cos(this.aimAngle) * arrowLength * pulse;
        const endY = b.y + Math.sin(this.aimAngle) * arrowLength * pulse;

        // Ligne
        ctx.strokeStyle = this.colors.DANGER;
        ctx.lineWidth = 3;
        ctx.shadowColor = this.colors.DANGER;
        ctx.shadowBlur = 10;
        ctx.beginPath();
        ctx.moveTo(b.x, b.y);
        ctx.lineTo(endX, endY);
        ctx.stroke();

        // Pointe
        const headLength = 12;
        const headAngle = 0.4;
        ctx.beginPath();
        ctx.moveTo(endX, endY);
        ctx.lineTo(
            endX - Math.cos(this.aimAngle - headAngle) * headLength,
            endY - Math.sin(this.aimAngle - headAngle) * headLength
        );
        ctx.moveTo(endX, endY);
        ctx.lineTo(
            endX - Math.cos(this.aimAngle + headAngle) * headLength,
            endY - Math.sin(this.aimAngle + headAngle) * headLength
        );
        ctx.stroke();
        ctx.shadowBlur = 0;

        // Puissance
        const powerPercent = Math.round((this.aimPower / this.maxPower) * 100);
        ctx.fillStyle = this.colors.DANGER;
        ctx.font = 'bold 12px Courier New';
        ctx.textAlign = 'center';
        ctx.fillText(`${powerPercent}%`, b.x, b.y - 25);
    }

    drawParticles(ctx) {
        for (const p of this.particles) {
            const alpha = p.life / p.maxLife;
            ctx.globalAlpha = alpha;
            ctx.fillStyle = p.color;
            ctx.beginPath();
            ctx.arc(p.x, p.y, p.size * alpha, 0, Math.PI * 2);
            ctx.fill();
        }
        ctx.globalAlpha = 1;
    }

    drawUI(ctx, width, height) {
        const totalAnimals = this.animals.length;
        const infected = this.infectedAnimals.size;

        // Barre de progression
        ctx.fillStyle = '#000000aa';
        ctx.fillRect(15, 15, 260, 55);
        ctx.strokeStyle = this.colors.UI_DIM;
        ctx.lineWidth = 1;
        ctx.strokeRect(15, 15, 260, 55);

        ctx.fillStyle = this.colors.UI_TEXT;
        ctx.font = '11px Courier New';
        ctx.textAlign = 'left';
        ctx.fillText('CHAINE DE TRANSMISSION', 25, 32);

        const barWidth = 240;
        const barHeight = 14;
        const barX = 25;
        const barY = 40;

        ctx.fillStyle = '#222';
        ctx.fillRect(barX, barY, barWidth, barHeight);

        const progress = infected / totalAnimals;
        const gradient = ctx.createLinearGradient(barX, 0, barX + barWidth * progress, 0);
        gradient.addColorStop(0, this.colors.DANGER);
        gradient.addColorStop(1, this.colors.LIFE_MIRROR);
        ctx.fillStyle = gradient;
        ctx.fillRect(barX, barY, barWidth * progress, barHeight);

        ctx.strokeStyle = this.colors.UI_DIM;
        ctx.strokeRect(barX, barY, barWidth, barHeight);

        const segmentWidth = barWidth / totalAnimals;
        for (let i = 0; i < totalAnimals; i++) {
            const sx = barX + segmentWidth * i + segmentWidth / 2;
            const isInfected = this.infectedAnimals.has(i);
            ctx.fillStyle = isInfected ? this.colors.DANGER : this.colors.UI_DIM;
            ctx.font = '8px Courier New';
            ctx.textAlign = 'center';
            ctx.fillText(isInfected ? '\u2716' : '\u25CB', sx, barY + barHeight + 12);
        }

        // Tentatives
        if (this.phase === 'aiming' || this.phase === 'flying') {
            ctx.fillStyle = '#000000aa';
            ctx.fillRect(width - 180, 15, 165, 40);
            ctx.strokeStyle = this.colors.UI_DIM;
            ctx.strokeRect(width - 180, 15, 165, 40);

            ctx.fillStyle = this.colors.UI_TEXT;
            ctx.font = '11px Courier New';
            ctx.textAlign = 'right';
            ctx.fillText(`Tentatives : ${this.maxAttempts - this.attempts}/${this.maxAttempts}`, width - 25, 32);

            const current = this.animals[this.currentAnimalIndex];
            ctx.fillStyle = this.colors.DANGER;
            ctx.fillText(`Hote : ${current.name}`, width - 25, 48);
        }

        // Instructions en bas
        if (this.phase === 'aiming') {
            ctx.fillStyle = '#000000aa';
            ctx.fillRect(width / 2 - 200, height - 40, 400, 30);

            ctx.fillStyle = this.colors.UI_DIM;
            ctx.font = '11px Courier New';
            ctx.textAlign = 'center';
            ctx.fillText('Deplacez la souris pour viser - Cliquez pour sauter', width / 2, height - 22);
        }

        // Fleche vers animal suivant si hors ecran
        if (this.phase === 'aiming' && this.currentAnimalIndex < this.animals.length - 1) {
            const nextAnimal = this.animals[this.currentAnimalIndex + 1];
            const screenX = nextAnimal.x - this.camera.x;

            if (screenX > width - 50) {
                ctx.fillStyle = this.colors.LIFE_MIRROR;
                ctx.font = '16px Courier New';
                ctx.textAlign = 'center';
                const bobY = Math.sin(this.time * 3) * 5;
                ctx.fillText('\u25B6 ' + nextAnimal.name, width - 60, height / 2 + bobY);
            } else if (screenX < 50) {
                ctx.fillStyle = this.colors.LIFE_MIRROR;
                ctx.font = '16px Courier New';
                ctx.textAlign = 'center';
                const bobY = Math.sin(this.time * 3) * 5;
                ctx.fillText(nextAnimal.name + ' \u25C0', 60, height / 2 + bobY);
            }
        }
    }

    destroy() {
        // Retirer nos event listeners
        const canvas = document.getElementById('game-canvas');
        if (canvas) {
            canvas.removeEventListener('mousemove', this._onMouseMove);
            canvas.removeEventListener('mousedown', this._onMouseDown);
            canvas.removeEventListener('touchstart', this._onTouchStart);
            canvas.removeEventListener('touchmove', this._onTouchMove);
        }
        window.removeEventListener('mousemove', this._onMouseMove);
        window.removeEventListener('mousedown', this._onMouseDown);
        window.removeEventListener('touchstart', this._onTouchStart);
        window.removeEventListener('touchmove', this._onTouchMove);

        this.animals = [];
        this.particles = [];
        this.bgElements = [];
        this.bacteria.trail = [];
    }
}
