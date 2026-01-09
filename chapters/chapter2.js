/**
 * CHAPITRE 2 : L'INVISIBLE
 *
 * Contexte : Contamination accidentelle dans une goutte d'eau.
 * Mecanique : Tir Point & Click avec laser UV.
 *
 * Concept scientifique : L'immunite de la vie miroir.
 * Les antibiotiques et le systeme immunitaire ciblent des structures
 * moleculaires specifiques. La chiralite inversee rend les bacteries
 * miroirs INVISIBLES a ces mecanismes de defense.
 */

export class Chapter2 {
    constructor(game) {
        this.game = game;
        this.colors = game.getColors();

        // Etat du chapitre
        this.phase = 'intro'; // intro, playing, overwhelmed, complete

        // Organismes
        this.organisms = [];
        this.maxOrganisms = 50;

        // Stats
        this.normalKilled = 0;
        this.mirrorAttempts = 0;
        this.saturationLevel = 0; // 0 a 1

        // Timer
        this.gameTime = 0;
        this.gameDuration = 30; // secondes avant saturation

        // Effet laser
        this.laserEffect = null;

        // Zone de jeu (vue microscope)
        this.viewRadius = 0;

        this.init();
    }

    init() {
        const { width, height } = this.game.getCanvasSize();
        this.viewRadius = Math.min(width, height) * 0.4;

        // Introduction
        this.game.setInstructions('OBSERVATION MICROSCOPIQUE');

        this.game.showDialogue([
            "Alerte de confinement - Laboratoire B7",
            "Un echantillon a ete renverse. Contamination detectee.",
            "Activez le laser UV pour eliminer les organismes.",
            "ATTENTION : Les cibles vertes sont nos bacteries normales.",
            "Les cibles violettes sont... autre chose."
        ], () => {
            this.phase = 'playing';
            this.spawnInitialOrganisms();
        });
    }

    spawnInitialOrganisms() {
        // Spawner quelques organismes de chaque type
        for (let i = 0; i < 8; i++) {
            this.spawnOrganism('normal');
        }
        for (let i = 0; i < 3; i++) {
            this.spawnOrganism('mirror');
        }
    }

    spawnOrganism(type) {
        const { width, height } = this.game.getCanvasSize();
        const centerX = width / 2;
        const centerY = height / 2;

        // Position aleatoire dans le cercle de vue
        const angle = Math.random() * Math.PI * 2;
        const distance = Math.random() * (this.viewRadius - 30);

        const organism = {
            type: type,
            x: centerX + Math.cos(angle) * distance,
            y: centerY + Math.sin(angle) * distance,
            radius: type === 'normal' ? 8 + Math.random() * 5 : 10 + Math.random() * 8,
            vx: (Math.random() - 0.5) * 30,
            vy: (Math.random() - 0.5) * 30,
            color: type === 'normal' ? this.colors.LIFE_NORMAL : this.colors.LIFE_MIRROR,
            alive: true,
            pulsePhase: Math.random() * Math.PI * 2,
            flagella: Math.random() * Math.PI * 2 // Pour l'animation des flagelles
        };

        this.organisms.push(organism);
    }

    update(deltaTime, timestamp) {
        if (this.phase === 'intro') return;

        if (this.phase === 'playing') {
            this.gameTime += deltaTime;

            // Mise a jour des organismes
            this.updateOrganisms(deltaTime);

            // Gestion des clics
            const mouse = this.game.getMouse();
            if (mouse.clicked) {
                this.handleShoot(mouse.x, mouse.y);
            }

            // Spawn progressif de miroirs (croissance exponentielle)
            const spawnRate = 0.5 + (this.gameTime / this.gameDuration) * 2;
            if (Math.random() < spawnRate * deltaTime) {
                this.spawnOrganism('mirror');
            }

            // Spawn occasionnel de normaux
            if (Math.random() < 0.3 * deltaTime) {
                this.spawnOrganism('normal');
            }

            // Calculer le niveau de saturation
            const mirrorCount = this.organisms.filter(o => o.type === 'mirror' && o.alive).length;
            this.saturationLevel = mirrorCount / this.maxOrganisms;

            // Verifier la condition de fin
            if (this.saturationLevel >= 0.9 || this.gameTime >= this.gameDuration) {
                this.phase = 'overwhelmed';
                this.game.showDialogue([
                    "ECHEC DU CONFINEMENT",
                    "// Les organismes miroirs ne reagissent pas au laser UV.",
                    "// Leur structure chirale inverse reflechit les photons.",
                    "Ils se multiplient sans aucun predateur naturel..."
                ], () => {
                    this.phase = 'complete';
                    this.game.chapterComplete(
                        "Erreur critique. Cible non valide. Confinement brise."
                    );
                });
            }
        }

        // Mise a jour effet laser
        if (this.laserEffect) {
            this.laserEffect.time -= deltaTime;
            if (this.laserEffect.time <= 0) {
                this.laserEffect = null;
            }
        }
    }

    updateOrganisms(deltaTime) {
        const { width, height } = this.game.getCanvasSize();
        const centerX = width / 2;
        const centerY = height / 2;

        // Supprimer les organismes morts
        this.organisms = this.organisms.filter(o => o.alive);

        // Limiter le nombre total
        while (this.organisms.length > this.maxOrganisms) {
            // Supprimer les plus vieux organismes normaux en priorite
            const normalIndex = this.organisms.findIndex(o => o.type === 'normal');
            if (normalIndex >= 0) {
                this.organisms.splice(normalIndex, 1);
            } else {
                break;
            }
        }

        for (const org of this.organisms) {
            // Mouvement brownien
            org.vx += (Math.random() - 0.5) * 50 * deltaTime;
            org.vy += (Math.random() - 0.5) * 50 * deltaTime;

            // Friction
            org.vx *= 0.98;
            org.vy *= 0.98;

            // Limiter la vitesse
            const speed = Math.sqrt(org.vx * org.vx + org.vy * org.vy);
            if (speed > 40) {
                org.vx = (org.vx / speed) * 40;
                org.vy = (org.vy / speed) * 40;
            }

            // Appliquer le mouvement
            org.x += org.vx * deltaTime;
            org.y += org.vy * deltaTime;

            // Rester dans le cercle de vue
            const dx = org.x - centerX;
            const dy = org.y - centerY;
            const dist = Math.sqrt(dx * dx + dy * dy);

            if (dist > this.viewRadius - org.radius) {
                // Rebondir sur le bord
                const nx = dx / dist;
                const ny = dy / dist;
                org.x = centerX + nx * (this.viewRadius - org.radius);
                org.y = centerY + ny * (this.viewRadius - org.radius);
                org.vx = -org.vx * 0.5;
                org.vy = -org.vy * 0.5;
            }

            // Animation
            org.pulsePhase += deltaTime * 3;
            org.flagella += deltaTime * 10;
        }
    }

    handleShoot(x, y) {
        let hitSomething = false;

        for (const org of this.organisms) {
            if (!org.alive) continue;

            const dx = org.x - x;
            const dy = org.y - y;
            const dist = Math.sqrt(dx * dx + dy * dy);

            if (dist < org.radius + 10) {
                if (org.type === 'normal') {
                    // Les organismes normaux sont detruits
                    org.alive = false;
                    this.normalKilled++;
                    hitSomething = true;

                    this.laserEffect = {
                        x: org.x,
                        y: org.y,
                        success: true,
                        time: 0.3
                    };
                } else {
                    // Les organismes miroirs sont IMMUNISES
                    // Le laser traverse ou rebondit sans effet
                    this.mirrorAttempts++;
                    hitSomething = true;

                    this.laserEffect = {
                        x: org.x,
                        y: org.y,
                        success: false,
                        time: 0.5
                    };

                    // Afficher un message la premiere fois
                    if (this.mirrorAttempts === 1) {
                        this.game.showDialogue([
                            "CIBLE INVALIDE",
                            "// Le laser UV n'a aucun effet sur les organismes miroirs.",
                            "// Leurs proteines chirales inversees ne l'absorbent pas."
                        ]);
                    }
                }
                break;
            }
        }

        if (!hitSomething) {
            this.laserEffect = {
                x: x,
                y: y,
                success: null,
                time: 0.2
            };
        }
    }

    draw(ctx) {
        const { width, height } = this.game.getCanvasSize();
        const centerX = width / 2;
        const centerY = height / 2;

        // Fond sombre avec effet microscope
        this.drawMicroscopeView(ctx, centerX, centerY);

        // Dessiner les organismes
        for (const org of this.organisms) {
            if (org.alive) {
                this.drawOrganism(ctx, org);
            }
        }

        // Effet laser
        if (this.laserEffect) {
            this.drawLaserEffect(ctx);
        }

        // Interface
        this.drawUI(ctx, width, height);

        // Reticule
        this.drawCrosshair(ctx);
    }

    drawMicroscopeView(ctx, centerX, centerY) {
        // Cercle de vue
        ctx.save();

        // Masque circulaire
        ctx.beginPath();
        ctx.arc(centerX, centerY, this.viewRadius, 0, Math.PI * 2);
        ctx.clip();

        // Fond bleu tres sombre (eau)
        ctx.fillStyle = '#0a1520';
        ctx.fillRect(centerX - this.viewRadius, centerY - this.viewRadius,
                     this.viewRadius * 2, this.viewRadius * 2);

        // Particules flottantes (debris)
        ctx.fillStyle = 'rgba(100, 150, 200, 0.1)';
        for (let i = 0; i < 50; i++) {
            const x = centerX + (Math.sin(i * 7.3 + this.gameTime * 0.1) * this.viewRadius * 0.8);
            const y = centerY + (Math.cos(i * 11.7 + this.gameTime * 0.15) * this.viewRadius * 0.8);
            ctx.beginPath();
            ctx.arc(x, y, 1 + Math.sin(i) * 0.5, 0, Math.PI * 2);
            ctx.fill();
        }

        ctx.restore();

        // Bordure du microscope
        ctx.strokeStyle = this.colors.CYAN;
        ctx.lineWidth = 3;
        ctx.beginPath();
        ctx.arc(centerX, centerY, this.viewRadius, 0, Math.PI * 2);
        ctx.stroke();

        // Graduations
        ctx.strokeStyle = 'rgba(68, 255, 255, 0.3)';
        ctx.lineWidth = 1;
        for (let i = 0; i < 8; i++) {
            const angle = (i / 8) * Math.PI * 2;
            ctx.beginPath();
            ctx.moveTo(centerX + Math.cos(angle) * (this.viewRadius - 10),
                       centerY + Math.sin(angle) * (this.viewRadius - 10));
            ctx.lineTo(centerX + Math.cos(angle) * this.viewRadius,
                       centerY + Math.sin(angle) * this.viewRadius);
            ctx.stroke();
        }
    }

    drawOrganism(ctx, org) {
        const pulse = 1 + Math.sin(org.pulsePhase) * 0.1;
        const radius = org.radius * pulse;

        // Lueur
        ctx.shadowColor = org.color;
        ctx.shadowBlur = 15;

        // Corps principal
        ctx.fillStyle = org.color + '88';
        ctx.beginPath();
        ctx.arc(org.x, org.y, radius, 0, Math.PI * 2);
        ctx.fill();

        // Noyau
        ctx.fillStyle = org.color;
        ctx.beginPath();
        ctx.arc(org.x, org.y, radius * 0.4, 0, Math.PI * 2);
        ctx.fill();

        // Membrane
        ctx.strokeStyle = org.color;
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.arc(org.x, org.y, radius, 0, Math.PI * 2);
        ctx.stroke();

        // Flagelles (petits appendices)
        ctx.lineWidth = 1;
        for (let i = 0; i < 3; i++) {
            const angle = org.flagella + (i * Math.PI * 2 / 3);
            const fx = org.x + Math.cos(angle) * radius;
            const fy = org.y + Math.sin(angle) * radius;
            const wave = Math.sin(org.flagella * 2 + i) * 5;

            ctx.beginPath();
            ctx.moveTo(fx, fy);
            ctx.quadraticCurveTo(
                fx + Math.cos(angle) * 10 + wave,
                fy + Math.sin(angle) * 10,
                fx + Math.cos(angle) * 15,
                fy + Math.sin(angle) * 15 + wave
            );
            ctx.stroke();
        }

        ctx.shadowBlur = 0;

        // Marque speciale pour les miroirs (symbole de chiralite)
        if (org.type === 'mirror') {
            ctx.strokeStyle = 'rgba(255, 255, 255, 0.5)';
            ctx.lineWidth = 1;
            ctx.beginPath();
            ctx.moveTo(org.x - 3, org.y - 3);
            ctx.lineTo(org.x + 3, org.y + 3);
            ctx.moveTo(org.x + 3, org.y - 3);
            ctx.lineTo(org.x - 3, org.y + 3);
            ctx.stroke();
        }
    }

    drawLaserEffect(ctx) {
        const effect = this.laserEffect;
        const alpha = effect.time / 0.5;

        if (effect.success === true) {
            // Explosion verte (organisme normal detruit)
            ctx.fillStyle = `rgba(68, 255, 136, ${alpha})`;
            const size = (1 - effect.time / 0.3) * 30;
            ctx.beginPath();
            ctx.arc(effect.x, effect.y, size, 0, Math.PI * 2);
            ctx.fill();
        } else if (effect.success === false) {
            // Rebond violet (organisme miroir immune)
            ctx.strokeStyle = `rgba(185, 68, 255, ${alpha})`;
            ctx.lineWidth = 3;
            const size = (1 - effect.time / 0.5) * 40;
            ctx.beginPath();
            ctx.arc(effect.x, effect.y, size, 0, Math.PI * 2);
            ctx.stroke();

            // X rouge
            ctx.strokeStyle = `rgba(255, 68, 68, ${alpha})`;
            ctx.lineWidth = 4;
            ctx.beginPath();
            ctx.moveTo(effect.x - 15, effect.y - 15);
            ctx.lineTo(effect.x + 15, effect.y + 15);
            ctx.moveTo(effect.x + 15, effect.y - 15);
            ctx.lineTo(effect.x - 15, effect.y + 15);
            ctx.stroke();
        } else {
            // Tir dans le vide
            ctx.fillStyle = `rgba(68, 255, 255, ${alpha})`;
            ctx.beginPath();
            ctx.arc(effect.x, effect.y, 5, 0, Math.PI * 2);
            ctx.fill();
        }
    }

    drawCrosshair(ctx) {
        const mouse = this.game.getMouse();

        ctx.strokeStyle = this.colors.CYAN;
        ctx.lineWidth = 1;

        // Croix
        ctx.beginPath();
        ctx.moveTo(mouse.x - 15, mouse.y);
        ctx.lineTo(mouse.x - 5, mouse.y);
        ctx.moveTo(mouse.x + 5, mouse.y);
        ctx.lineTo(mouse.x + 15, mouse.y);
        ctx.moveTo(mouse.x, mouse.y - 15);
        ctx.lineTo(mouse.x, mouse.y - 5);
        ctx.moveTo(mouse.x, mouse.y + 5);
        ctx.lineTo(mouse.x, mouse.y + 15);
        ctx.stroke();

        // Cercle
        ctx.beginPath();
        ctx.arc(mouse.x, mouse.y, 20, 0, Math.PI * 2);
        ctx.stroke();
    }

    drawUI(ctx, width, height) {
        // Compteurs
        const normalCount = this.organisms.filter(o => o.type === 'normal' && o.alive).length;
        const mirrorCount = this.organisms.filter(o => o.type === 'mirror' && o.alive).length;

        ctx.font = '14px Courier New';
        ctx.textAlign = 'left';

        // Compteur normal
        ctx.fillStyle = this.colors.LIFE_NORMAL;
        ctx.fillText(`Bacteries normales: ${normalCount}`, 20, 30);
        ctx.fillText(`Eliminees: ${this.normalKilled}`, 20, 50);

        // Compteur miroir
        ctx.fillStyle = this.colors.LIFE_MIRROR;
        ctx.fillText(`Bacteries miroirs: ${mirrorCount}`, 20, 80);
        ctx.fillText(`Tirs echoues: ${this.mirrorAttempts}`, 20, 100);

        // Barre de saturation
        ctx.fillStyle = this.colors.UI_DIM;
        ctx.fillText('NIVEAU DE CONTAMINATION', width - 220, 30);

        ctx.fillStyle = '#333';
        ctx.fillRect(width - 220, 40, 200, 20);

        const satColor = this.saturationLevel > 0.7 ? this.colors.DANGER :
                         this.saturationLevel > 0.4 ? '#ffaa00' : this.colors.LIFE_MIRROR;
        ctx.fillStyle = satColor;
        ctx.fillRect(width - 220, 40, 200 * this.saturationLevel, 20);

        ctx.strokeStyle = this.colors.UI_TEXT;
        ctx.lineWidth = 1;
        ctx.strokeRect(width - 220, 40, 200, 20);

        // Pourcentage
        ctx.fillStyle = this.colors.UI_TEXT;
        ctx.textAlign = 'center';
        ctx.fillText(`${Math.round(this.saturationLevel * 100)}%`, width - 120, 55);

        // Avertissement
        if (this.saturationLevel > 0.7) {
            ctx.fillStyle = this.colors.DANGER;
            ctx.font = 'bold 16px Courier New';
            ctx.fillText('ALERTE : SATURATION IMMINENTE', width / 2, height - 30);
        }
    }
}
