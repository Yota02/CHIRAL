/**
 * CHAPITRE 4 : LA FORTERESSE
 *
 * Contexte : Survivre dans un dome en convertissant la matiere miroir.
 * Mecanique : Jeu de rythme / Quick Time Event (QTE).
 *
 * Concept scientifique : Inversion chirale artificielle.
 * Un convertisseur chiral peut theoriquement inverser la chiralite
 * des molecules, transformant la nourriture miroir (non digestible)
 * en nourriture normale (comestible).
 */

export class Chapter4 {
    constructor(game) {
        this.game = game;
        this.colors = game.getColors();

        // Etat du chapitre
        this.phase = 'intro'; // intro, playing, survived, complete

        // Jauge de faim de la population
        this.hunger = 100; // 0 = famine, 100 = rassasie
        this.hungerDecayRate = 15; // Perte par seconde
        this.hungerGainOnSuccess = 25;

        // Formes a convertir (QTE)
        this.shapes = [];
        this.spawnTimer = 0;
        this.spawnInterval = 1.5; // Secondes entre chaque forme
        this.shapeSpeed = 150; // Pixels par seconde

        // Zone de conversion
        this.conversionZone = {
            x: 0,
            y: 0,
            width: 100,
            height: 80
        };

        // Touches valides
        this.validKeys = ['KeyA', 'KeyS', 'KeyD', 'KeyF'];
        this.keyLabels = { 'KeyA': 'A', 'KeyS': 'S', 'KeyD': 'D', 'KeyF': 'F' };

        // Stats
        this.successCount = 0;
        this.failCount = 0;
        this.gameTime = 0;
        this.gameDuration = 45; // Secondes

        // Animation
        this.pulseTime = 0;
        this.flashEffect = null;

        // Population
        this.population = 1247;

        this.init();
    }

    init() {
        const { width, height } = this.game.getCanvasSize();

        // Positionner la zone de conversion
        this.conversionZone.x = width / 2 - this.conversionZone.width / 2;
        this.conversionZone.y = height / 2 - this.conversionZone.height / 2;

        this.game.setInstructions('CONVERTISSEUR CHIRAL');

        this.game.showDialogue([
            "Dome de survie Omega-7 - An 2045",
            "Population restante : 1,247 ames.",
            "L'exterieur est entierement contamine par la vie miroir.",
            "Notre seule source de nourriture : convertir la matiere miroir.",
            "Le Convertisseur Chiral inverse la chiralite des molecules.",
            "// Appuyez sur A, S, D ou F quand les formes entrent dans la zone.",
            "Nourrir la colonie. C'est tout ce qui compte maintenant."
        ], () => {
            this.phase = 'playing';
        });
    }

    update(deltaTime, timestamp) {
        if (this.phase === 'intro') return;

        this.pulseTime += deltaTime * 3;

        if (this.phase === 'playing') {
            this.gameTime += deltaTime;

            // Decroissance de la faim
            this.hunger -= this.hungerDecayRate * deltaTime;

            // Augmenter la difficulte avec le temps
            this.spawnInterval = Math.max(0.8, 1.5 - this.gameTime * 0.015);
            this.shapeSpeed = 150 + this.gameTime * 2;
            this.hungerDecayRate = 15 + this.gameTime * 0.2;

            // Spawn de nouvelles formes
            this.spawnTimer += deltaTime;
            if (this.spawnTimer >= this.spawnInterval) {
                this.spawnShape();
                this.spawnTimer = 0;
            }

            // Mise a jour des formes
            this.updateShapes(deltaTime);

            // Gestion des touches
            this.handleInput();

            // Mise a jour de l'effet flash
            if (this.flashEffect) {
                this.flashEffect.time -= deltaTime;
                if (this.flashEffect.time <= 0) {
                    this.flashEffect = null;
                }
            }

            // Conditions de fin
            if (this.hunger <= 0) {
                this.hunger = 0;
                this.phase = 'survived'; // Meme en echec, on survit difficilement
            }

            if (this.gameTime >= this.gameDuration) {
                this.phase = 'survived';
            }

            if (this.phase === 'survived') {
                const message = this.hunger > 20
                    ? "La colonie survit. Pour combien de temps encore ?"
                    : "Rations critiques. Mais nous tenons.";

                this.game.showDialogue([
                    "Cycle de conversion termine.",
                    `Conversions reussies : ${this.successCount}`,
                    `Echecs : ${this.failCount}`,
                    message,
                    "// Nous ne pouvons pas sortir.",
                    "// Mais nous pouvons vivre."
                ], () => {
                    this.phase = 'complete';
                    this.game.chapterComplete(
                        "Systemes nominaux. La colonie survit. L'exterieur est perdu."
                    );
                });
            }
        }
    }

    spawnShape() {
        const { width, height } = this.game.getCanvasSize();

        // Choisir une direction (gauche ou droite)
        const fromLeft = Math.random() < 0.5;

        // Choisir une touche aleatoire
        const keyIndex = Math.floor(Math.random() * this.validKeys.length);
        const key = this.validKeys[keyIndex];

        const shape = {
            x: fromLeft ? -50 : width + 50,
            y: this.conversionZone.y + this.conversionZone.height / 2,
            size: 40,
            direction: fromLeft ? 1 : -1,
            key: key,
            label: this.keyLabels[key],
            active: true,
            inZone: false,
            converted: false,
            missed: false
        };

        this.shapes.push(shape);
    }

    updateShapes(deltaTime) {
        const zone = this.conversionZone;

        for (const shape of this.shapes) {
            if (!shape.active) continue;

            // Mouvement
            shape.x += shape.direction * this.shapeSpeed * deltaTime;

            // Verifier si dans la zone de conversion
            const inZone = shape.x > zone.x && shape.x < zone.x + zone.width;
            shape.inZone = inZone;

            // Verifier si la forme a depasse la zone sans etre convertie
            if (shape.direction > 0 && shape.x > zone.x + zone.width + 50) {
                if (!shape.converted && !shape.missed) {
                    this.onMiss(shape);
                }
                shape.active = false;
            } else if (shape.direction < 0 && shape.x < zone.x - 50) {
                if (!shape.converted && !shape.missed) {
                    this.onMiss(shape);
                }
                shape.active = false;
            }
        }

        // Nettoyer les formes inactives
        this.shapes = this.shapes.filter(s => s.active);
    }

    handleInput() {
        const keys = this.game.getKeys();

        for (const key of this.validKeys) {
            if (keys[key]) {
                // Trouver une forme dans la zone avec cette touche
                const shape = this.shapes.find(s =>
                    s.active && s.inZone && s.key === key && !s.converted
                );

                if (shape) {
                    this.onSuccess(shape);
                }

                // Reset la touche pour eviter les repetitions
                keys[key] = false;
            }
        }
    }

    onSuccess(shape) {
        shape.converted = true;
        shape.active = false;
        this.successCount++;

        // Gagner de la faim
        this.hunger = Math.min(100, this.hunger + this.hungerGainOnSuccess);

        // Effet visuel
        this.flashEffect = {
            type: 'success',
            x: shape.x,
            y: shape.y,
            time: 0.3
        };
    }

    onMiss(shape) {
        shape.missed = true;
        this.failCount++;

        // Effet visuel
        this.flashEffect = {
            type: 'fail',
            x: shape.x,
            y: shape.y,
            time: 0.3
        };
    }

    draw(ctx) {
        const { width, height } = this.game.getCanvasSize();

        // Fond du dome
        this.drawDomeBackground(ctx, width, height);

        // Zone de conversion
        this.drawConversionZone(ctx);

        // Formes
        for (const shape of this.shapes) {
            if (shape.active) {
                this.drawShape(ctx, shape);
            }
        }

        // Effet flash
        if (this.flashEffect) {
            this.drawFlashEffect(ctx);
        }

        // Interface
        this.drawUI(ctx, width, height);
    }

    drawDomeBackground(ctx, width, height) {
        // Dome interieur
        const gradient = ctx.createRadialGradient(
            width / 2, height, 0,
            width / 2, height / 2, height
        );
        gradient.addColorStop(0, '#1a1a2e');
        gradient.addColorStop(1, '#0a0a12');
        ctx.fillStyle = gradient;
        ctx.fillRect(0, 0, width, height);

        // Arc du dome
        ctx.strokeStyle = this.colors.CYAN + '44';
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.arc(width / 2, height + 100, height, Math.PI, 0);
        ctx.stroke();

        // Lignes de structure
        for (let i = 0; i < 8; i++) {
            const angle = Math.PI + (i / 7) * Math.PI;
            ctx.beginPath();
            ctx.moveTo(width / 2, height + 100);
            ctx.lineTo(
                width / 2 + Math.cos(angle) * height,
                height + 100 + Math.sin(angle) * height
            );
            ctx.stroke();
        }
    }

    drawConversionZone(ctx) {
        const zone = this.conversionZone;
        const pulse = Math.sin(this.pulseTime) * 0.2 + 0.8;

        // Zone principale
        ctx.fillStyle = `rgba(68, 255, 255, ${0.1 * pulse})`;
        ctx.fillRect(zone.x, zone.y, zone.width, zone.height);

        // Bordure
        ctx.strokeStyle = this.colors.CYAN;
        ctx.lineWidth = 3;
        ctx.strokeRect(zone.x, zone.y, zone.width, zone.height);

        // Lueur
        ctx.shadowColor = this.colors.CYAN;
        ctx.shadowBlur = 20 * pulse;
        ctx.strokeRect(zone.x, zone.y, zone.width, zone.height);
        ctx.shadowBlur = 0;

        // Label
        ctx.fillStyle = this.colors.CYAN;
        ctx.font = '12px Courier New';
        ctx.textAlign = 'center';
        ctx.fillText('CONVERTISSEUR', zone.x + zone.width / 2, zone.y - 10);

        // Indicateurs de touche
        ctx.font = 'bold 14px Courier New';
        const keyY = zone.y + zone.height + 30;
        const keySpacing = 40;
        const startX = zone.x + zone.width / 2 - (keySpacing * 1.5);

        for (let i = 0; i < this.validKeys.length; i++) {
            const label = this.keyLabels[this.validKeys[i]];
            ctx.fillStyle = this.colors.UI_DIM;
            ctx.fillText(label, startX + i * keySpacing, keyY);
        }
    }

    drawShape(ctx, shape) {
        const pulse = shape.inZone ? 1.2 : 1;
        const size = shape.size * pulse;

        // Couleur selon l'etat
        let color = this.colors.LIFE_MIRROR;
        if (shape.inZone) {
            color = this.colors.LIFE_NORMAL; // Devient vert dans la zone !
        }

        // Lueur
        ctx.shadowColor = color;
        ctx.shadowBlur = shape.inZone ? 25 : 10;

        // Hexagone (forme de molecule)
        ctx.fillStyle = color + '88';
        ctx.strokeStyle = color;
        ctx.lineWidth = 2;

        ctx.beginPath();
        for (let i = 0; i < 6; i++) {
            const angle = (i / 6) * Math.PI * 2 - Math.PI / 2;
            const x = shape.x + Math.cos(angle) * size / 2;
            const y = shape.y + Math.sin(angle) * size / 2;
            if (i === 0) ctx.moveTo(x, y);
            else ctx.lineTo(x, y);
        }
        ctx.closePath();
        ctx.fill();
        ctx.stroke();

        ctx.shadowBlur = 0;

        // Label de touche
        ctx.fillStyle = '#fff';
        ctx.font = 'bold 20px Courier New';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(shape.label, shape.x, shape.y);
    }

    drawFlashEffect(ctx) {
        const effect = this.flashEffect;
        const alpha = effect.time / 0.3;

        if (effect.type === 'success') {
            // Explosion verte
            ctx.strokeStyle = `rgba(68, 255, 136, ${alpha})`;
            ctx.lineWidth = 3;
            const size = (1 - effect.time / 0.3) * 60;
            ctx.beginPath();
            ctx.arc(effect.x, effect.y, size, 0, Math.PI * 2);
            ctx.stroke();

            // Particules
            for (let i = 0; i < 8; i++) {
                const angle = (i / 8) * Math.PI * 2;
                const dist = size * 1.5;
                ctx.fillStyle = `rgba(68, 255, 136, ${alpha * 0.5})`;
                ctx.beginPath();
                ctx.arc(
                    effect.x + Math.cos(angle) * dist,
                    effect.y + Math.sin(angle) * dist,
                    3, 0, Math.PI * 2
                );
                ctx.fill();
            }
        } else {
            // X rouge
            ctx.strokeStyle = `rgba(255, 68, 68, ${alpha})`;
            ctx.lineWidth = 4;
            const size = 20;
            ctx.beginPath();
            ctx.moveTo(effect.x - size, effect.y - size);
            ctx.lineTo(effect.x + size, effect.y + size);
            ctx.moveTo(effect.x + size, effect.y - size);
            ctx.lineTo(effect.x - size, effect.y + size);
            ctx.stroke();
        }
    }

    drawUI(ctx, width, height) {
        // Jauge de faim
        ctx.fillStyle = this.colors.UI_TEXT;
        ctx.font = '14px Courier New';
        ctx.textAlign = 'left';
        ctx.fillText('RESERVES ALIMENTAIRES', 20, 30);

        const barWidth = 250;
        const barHeight = 25;

        ctx.fillStyle = '#333';
        ctx.fillRect(20, 40, barWidth, barHeight);

        // Couleur selon le niveau
        let hungerColor = this.colors.LIFE_NORMAL;
        if (this.hunger < 30) hungerColor = this.colors.DANGER;
        else if (this.hunger < 60) hungerColor = '#ffaa00';

        ctx.fillStyle = hungerColor;
        ctx.fillRect(20, 40, barWidth * (this.hunger / 100), barHeight);

        ctx.strokeStyle = this.colors.UI_TEXT;
        ctx.lineWidth = 2;
        ctx.strokeRect(20, 40, barWidth, barHeight);

        // Pourcentage
        ctx.fillStyle = '#fff';
        ctx.font = 'bold 14px Courier New';
        ctx.textAlign = 'center';
        ctx.fillText(`${Math.round(this.hunger)}%`, 20 + barWidth / 2, 57);

        // Population
        ctx.textAlign = 'right';
        ctx.font = '14px Courier New';
        ctx.fillStyle = this.colors.UI_TEXT;
        ctx.fillText(`Population : ${this.population}`, width - 20, 30);

        // Stats
        ctx.fillStyle = this.colors.LIFE_NORMAL;
        ctx.fillText(`Conversions : ${this.successCount}`, width - 20, 55);
        ctx.fillStyle = this.colors.DANGER;
        ctx.fillText(`Echecs : ${this.failCount}`, width - 20, 75);

        // Timer
        const timeLeft = Math.max(0, this.gameDuration - this.gameTime);
        ctx.textAlign = 'center';
        ctx.fillStyle = this.colors.UI_TEXT;
        ctx.font = '16px Courier New';
        ctx.fillText(`Temps restant : ${Math.ceil(timeLeft)}s`, width / 2, 30);

        // Alerte famine
        if (this.hunger < 30) {
            ctx.fillStyle = this.colors.DANGER;
            ctx.font = 'bold 16px Courier New';
            const blink = Math.sin(this.pulseTime * 5) > 0;
            if (blink) {
                ctx.fillText('ALERTE FAMINE', width / 2, height - 30);
            }
        }

        // Instructions
        ctx.fillStyle = this.colors.UI_DIM;
        ctx.font = '12px Courier New';
        ctx.fillText('Appuyez sur A, S, D ou F quand la forme est dans la zone', width / 2, height - 10);
    }
}
