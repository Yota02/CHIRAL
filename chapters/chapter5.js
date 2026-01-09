/**
 * CHAPITRE 5 : LE DESERT SILENCIEUX
 *
 * Contexte : 50 ans plus tard, une expedition a l'exterieur du dome.
 * Mecanique : Side-scroller narratif avec parallax.
 *
 * Concept scientifique : Un monde alien.
 * La vie miroir a completement remplace la biosphere terrestre.
 * Rien n'est comestible, rien n'est familier.
 * C'est toujours la Terre, mais ce n'est plus notre monde.
 */

export class Chapter5 {
    constructor(game) {
        this.game = game;
        this.colors = game.getColors();

        // Etat du chapitre
        this.phase = 'intro'; // intro, walking, examining, ending, complete

        // Position du joueur et de la camera
        this.playerX = 100;
        this.cameraX = 0;
        this.walkSpeed = 60;
        this.worldWidth = 3000;

        // Personnage
        this.player = {
            x: 100,
            y: 0,
            width: 30,
            height: 60,
            walking: false,
            frame: 0,
            frameTime: 0
        };

        // Parallax layers
        this.layers = [];

        // Objets interactifs
        this.interactables = [];
        this.currentInteraction = null;

        // Descriptions des objets
        this.descriptions = {
            flower: "Fleur cristallisee - Structure moleculaire inversee.\nIncomestible pour tout organisme terrestre.",
            water: "Eau visqueuse - Contaminee par des micro-organismes miroirs.\nNon potable. Toxique par contact prolonge.",
            tree: "Arbre fossilise - Mort depuis des decennies.\nRemplace par des structures cristallines violettes.",
            animal: "Squelette - Probablement un cervide.\nLa faune terrestre n'a pas survecu.",
            ruins: "Ruines - Anciennes habitations humaines.\nAbandonnees lors de l'Exode vers les domes.",
            crystal: "Formation cristalline - Croissance organique miroir.\nBeaute alien, hostilite absolue."
        };

        // Fin atteinte
        this.reachedEnd = false;

        // Animation
        this.time = 0;

        this.init();
    }

    init() {
        const { height } = this.game.getCanvasSize();
        this.player.y = height - 100 - this.player.height;

        this.initLayers();
        this.initInteractables();

        this.game.setInstructions('EXPEDITION EXTERIEURE');

        this.game.showDialogue([
            "Journal d'expedition - An 2080",
            "Premiere sortie du dome depuis 35 ans.",
            "Mission : Evaluer l'habitabilite de l'exterieur.",
            "// Combinaison etanche obligatoire.",
            "// Aucun contact avec l'environnement.",
            "Utilisez les fleches ou cliquez pour avancer.",
            "Approchez-vous des objets pour les examiner."
        ], () => {
            this.phase = 'walking';
        });
    }

    initLayers() {
        // Couches de parallax (du plus loin au plus proche)
        this.layers = [
            { speed: 0.1, elements: this.generateSkyElements() },
            { speed: 0.3, elements: this.generateMountains() },
            { speed: 0.5, elements: this.generateMidground() },
            { speed: 0.8, elements: this.generateForeground() }
        ];
    }

    generateSkyElements() {
        const elements = [];
        // Lune/soleil etrange
        elements.push({
            type: 'sun',
            x: 400,
            y: 80,
            size: 60
        });

        // Nuages etranges
        for (let i = 0; i < 5; i++) {
            elements.push({
                type: 'cloud',
                x: i * 600 + Math.random() * 200,
                y: 50 + Math.random() * 100,
                width: 100 + Math.random() * 100,
                height: 30 + Math.random() * 20
            });
        }
        return elements;
    }

    generateMountains() {
        const elements = [];
        for (let i = 0; i < 10; i++) {
            elements.push({
                type: 'mountain',
                x: i * 350,
                height: 150 + Math.random() * 100,
                width: 300 + Math.random() * 100
            });
        }
        return elements;
    }

    generateMidground() {
        const elements = [];
        // Arbres morts et cristaux
        for (let i = 0; i < 20; i++) {
            const type = Math.random() < 0.5 ? 'deadTree' : 'crystalFormation';
            elements.push({
                type: type,
                x: i * 160 + Math.random() * 80,
                height: 80 + Math.random() * 60
            });
        }
        return elements;
    }

    generateForeground() {
        const elements = [];
        // Petits cristaux et debris au premier plan
        for (let i = 0; i < 40; i++) {
            elements.push({
                type: 'smallCrystal',
                x: i * 80 + Math.random() * 40,
                height: 10 + Math.random() * 30
            });
        }
        return elements;
    }

    initInteractables() {
        this.interactables = [
            { type: 'flower', x: 300, description: this.descriptions.flower },
            { type: 'water', x: 600, description: this.descriptions.water },
            { type: 'tree', x: 900, description: this.descriptions.tree },
            { type: 'animal', x: 1300, description: this.descriptions.animal },
            { type: 'crystal', x: 1800, description: this.descriptions.crystal },
            { type: 'ruins', x: 2400, description: this.descriptions.ruins, isEnd: true }
        ];
    }

    update(deltaTime, timestamp) {
        if (this.phase === 'intro') return;

        this.time += deltaTime;

        if (this.phase === 'walking') {
            this.handleMovement(deltaTime);
            this.checkInteractions();
            this.updateCamera();
            this.updatePlayerAnimation(deltaTime);
        }
    }

    handleMovement(deltaTime) {
        const keys = this.game.getKeys();
        const mouse = this.game.getMouse();
        const { width } = this.game.getCanvasSize();

        let moving = false;

        // Mouvement clavier
        if (keys['ArrowRight'] || keys['KeyD']) {
            this.player.x += this.walkSpeed * deltaTime;
            moving = true;
        }
        if (keys['ArrowLeft'] || keys['KeyA']) {
            this.player.x -= this.walkSpeed * deltaTime;
            moving = true;
        }

        // Mouvement souris/touch - cliquer a droite pour avancer
        if (mouse.down) {
            if (mouse.x > width / 2 + 50) {
                this.player.x += this.walkSpeed * deltaTime;
                moving = true;
            } else if (mouse.x < width / 2 - 50) {
                this.player.x -= this.walkSpeed * deltaTime;
                moving = true;
            }
        }

        // Limites du monde
        this.player.x = Math.max(50, Math.min(this.worldWidth - 100, this.player.x));

        this.player.walking = moving;
    }

    checkInteractions() {
        const interactionRange = 80;

        for (const obj of this.interactables) {
            const distance = Math.abs(this.player.x - obj.x);

            if (distance < interactionRange && !obj.examined) {
                this.currentInteraction = obj;
                obj.examined = true;
                this.phase = 'examining';

                if (obj.isEnd) {
                    this.game.showDialogue([
                        obj.description,
                        "",
                        "...",
                        "C'est donc ainsi que ca finit.",
                        "Notre monde, devenu etranger.",
                        "La vie continue ici, mais ce n'est plus la notre."
                    ], () => {
                        this.phase = 'ending';
                        this.reachedEnd = true;
                        setTimeout(() => {
                            this.phase = 'complete';
                            this.game.chapterComplete(
                                "Nous avons joue a etre Dieu sans lire le manuel."
                            );
                        }, 2000);
                    });
                } else {
                    this.game.showDialogue([obj.description], () => {
                        this.phase = 'walking';
                        this.currentInteraction = null;
                    });
                }
                break;
            }
        }
    }

    updateCamera() {
        const { width } = this.game.getCanvasSize();

        // Camera suit le joueur
        const targetCameraX = this.player.x - width / 3;
        this.cameraX += (targetCameraX - this.cameraX) * 0.05;

        // Limites de la camera
        this.cameraX = Math.max(0, Math.min(this.worldWidth - width, this.cameraX));
    }

    updatePlayerAnimation(deltaTime) {
        if (this.player.walking) {
            this.player.frameTime += deltaTime;
            if (this.player.frameTime > 0.15) {
                this.player.frame = (this.player.frame + 1) % 4;
                this.player.frameTime = 0;
            }
        } else {
            this.player.frame = 0;
        }
    }

    draw(ctx) {
        const { width, height } = this.game.getCanvasSize();

        // Ciel gradient
        this.drawSky(ctx, width, height);

        // Couches de parallax
        for (const layer of this.layers) {
            this.drawLayer(ctx, layer, width, height);
        }

        // Sol
        this.drawGround(ctx, width, height);

        // Objets interactifs
        this.drawInteractables(ctx, height);

        // Joueur
        this.drawPlayer(ctx, height);

        // Interface
        this.drawUI(ctx, width, height);
    }

    drawSky(ctx, width, height) {
        const gradient = ctx.createLinearGradient(0, 0, 0, height);
        gradient.addColorStop(0, '#1a0a2e');
        gradient.addColorStop(0.5, '#2d1b4e');
        gradient.addColorStop(1, '#1a1a2e');
        ctx.fillStyle = gradient;
        ctx.fillRect(0, 0, width, height);
    }

    drawLayer(ctx, layer, width, height) {
        const offsetX = this.cameraX * layer.speed;

        for (const elem of layer.elements) {
            const screenX = elem.x - offsetX;

            // Ne dessiner que les elements visibles
            if (screenX < -200 || screenX > width + 200) continue;

            switch (elem.type) {
                case 'sun':
                    this.drawSun(ctx, screenX, elem.y, elem.size);
                    break;
                case 'cloud':
                    this.drawCloud(ctx, screenX, elem.y, elem.width, elem.height);
                    break;
                case 'mountain':
                    this.drawMountain(ctx, screenX, height, elem.width, elem.height);
                    break;
                case 'deadTree':
                    this.drawDeadTree(ctx, screenX, height - 100, elem.height);
                    break;
                case 'crystalFormation':
                    this.drawCrystalFormation(ctx, screenX, height - 100, elem.height);
                    break;
                case 'smallCrystal':
                    this.drawSmallCrystal(ctx, screenX, height - 100, elem.height);
                    break;
            }
        }
    }

    drawSun(ctx, x, y, size) {
        // Soleil etrange, violet
        const gradient = ctx.createRadialGradient(x, y, 0, x, y, size);
        gradient.addColorStop(0, '#ffaaff');
        gradient.addColorStop(0.5, this.colors.LIFE_MIRROR);
        gradient.addColorStop(1, 'transparent');
        ctx.fillStyle = gradient;
        ctx.beginPath();
        ctx.arc(x, y, size, 0, Math.PI * 2);
        ctx.fill();
    }

    drawCloud(ctx, x, y, w, h) {
        ctx.fillStyle = 'rgba(100, 50, 120, 0.3)';
        ctx.beginPath();
        ctx.ellipse(x + w / 2, y + h / 2, w / 2, h / 2, 0, 0, Math.PI * 2);
        ctx.fill();
    }

    drawMountain(ctx, x, groundY, w, h) {
        ctx.fillStyle = '#2a1a3a';
        ctx.beginPath();
        ctx.moveTo(x, groundY);
        ctx.lineTo(x + w / 2, groundY - h);
        ctx.lineTo(x + w, groundY);
        ctx.closePath();
        ctx.fill();
    }

    drawDeadTree(ctx, x, groundY, h) {
        ctx.strokeStyle = '#3a2a2a';
        ctx.lineWidth = 4;

        // Tronc
        ctx.beginPath();
        ctx.moveTo(x, groundY);
        ctx.lineTo(x, groundY - h);
        ctx.stroke();

        // Branches mortes
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.moveTo(x, groundY - h * 0.6);
        ctx.lineTo(x - 20, groundY - h * 0.8);
        ctx.moveTo(x, groundY - h * 0.7);
        ctx.lineTo(x + 25, groundY - h * 0.85);
        ctx.moveTo(x, groundY - h);
        ctx.lineTo(x - 10, groundY - h - 15);
        ctx.lineTo(x + 15, groundY - h - 10);
        ctx.stroke();
    }

    drawCrystalFormation(ctx, x, groundY, h) {
        ctx.fillStyle = this.colors.LIFE_MIRROR + '88';
        ctx.strokeStyle = this.colors.LIFE_MIRROR;
        ctx.lineWidth = 1;

        // Cristaux multiples
        const crystals = [
            { dx: 0, h: h },
            { dx: -15, h: h * 0.6 },
            { dx: 12, h: h * 0.7 }
        ];

        for (const c of crystals) {
            ctx.beginPath();
            ctx.moveTo(x + c.dx - 8, groundY);
            ctx.lineTo(x + c.dx, groundY - c.h);
            ctx.lineTo(x + c.dx + 8, groundY);
            ctx.closePath();
            ctx.fill();
            ctx.stroke();
        }
    }

    drawSmallCrystal(ctx, x, groundY, h) {
        const pulse = Math.sin(this.time * 2 + x * 0.1) * 0.3 + 0.7;
        ctx.fillStyle = this.colors.LIFE_MIRROR + Math.floor(pulse * 99).toString(16);
        ctx.beginPath();
        ctx.moveTo(x - 3, groundY);
        ctx.lineTo(x, groundY - h);
        ctx.lineTo(x + 3, groundY);
        ctx.closePath();
        ctx.fill();
    }

    drawGround(ctx, width, height) {
        const groundY = height - 100;

        // Sol principal
        ctx.fillStyle = '#1a1a1a';
        ctx.fillRect(0, groundY, width, 100);

        // Texture du sol
        ctx.strokeStyle = this.colors.LIFE_MIRROR + '22';
        ctx.lineWidth = 1;
        for (let i = 0; i < width; i += 20) {
            const offsetX = (i + this.cameraX) % 40;
            ctx.beginPath();
            ctx.moveTo(i - offsetX, groundY);
            ctx.lineTo(i - offsetX + 10, groundY + 5);
            ctx.stroke();
        }
    }

    drawInteractables(ctx, height) {
        const groundY = height - 100;

        for (const obj of this.interactables) {
            const screenX = obj.x - this.cameraX;

            // Indicateur d'interaction
            if (!obj.examined) {
                const pulse = Math.sin(this.time * 3) * 5;
                ctx.fillStyle = this.colors.CYAN;
                ctx.beginPath();
                ctx.moveTo(screenX, groundY - 80 + pulse);
                ctx.lineTo(screenX - 8, groundY - 65 + pulse);
                ctx.lineTo(screenX + 8, groundY - 65 + pulse);
                ctx.closePath();
                ctx.fill();
            }

            // Dessiner l'objet selon son type
            switch (obj.type) {
                case 'flower':
                    this.drawFlower(ctx, screenX, groundY);
                    break;
                case 'water':
                    this.drawWater(ctx, screenX, groundY);
                    break;
                case 'tree':
                    this.drawBigTree(ctx, screenX, groundY);
                    break;
                case 'animal':
                    this.drawSkeleton(ctx, screenX, groundY);
                    break;
                case 'crystal':
                    this.drawBigCrystal(ctx, screenX, groundY);
                    break;
                case 'ruins':
                    this.drawRuins(ctx, screenX, groundY);
                    break;
            }
        }
    }

    drawFlower(ctx, x, groundY) {
        // Tige
        ctx.strokeStyle = '#4a3a5a';
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.moveTo(x, groundY);
        ctx.lineTo(x, groundY - 40);
        ctx.stroke();

        // Fleur cristallisee
        ctx.fillStyle = this.colors.LIFE_MIRROR + 'aa';
        for (let i = 0; i < 5; i++) {
            const angle = (i / 5) * Math.PI * 2 - Math.PI / 2;
            ctx.beginPath();
            ctx.ellipse(
                x + Math.cos(angle) * 10,
                groundY - 40 + Math.sin(angle) * 10,
                8, 4, angle, 0, Math.PI * 2
            );
            ctx.fill();
        }
    }

    drawWater(ctx, x, groundY) {
        // Mare d'eau visqueuse
        ctx.fillStyle = this.colors.LIFE_MIRROR + '66';
        ctx.beginPath();
        ctx.ellipse(x, groundY - 5, 40, 10, 0, 0, Math.PI * 2);
        ctx.fill();

        // Reflets
        ctx.strokeStyle = this.colors.LIFE_MIRROR;
        ctx.lineWidth = 1;
        const wave = Math.sin(this.time * 2) * 3;
        ctx.beginPath();
        ctx.moveTo(x - 20, groundY - 5 + wave);
        ctx.quadraticCurveTo(x, groundY - 10 + wave, x + 20, groundY - 5 + wave);
        ctx.stroke();
    }

    drawBigTree(ctx, x, groundY) {
        // Grand arbre mort
        ctx.strokeStyle = '#2a1a1a';
        ctx.lineWidth = 8;
        ctx.beginPath();
        ctx.moveTo(x, groundY);
        ctx.lineTo(x, groundY - 120);
        ctx.stroke();

        // Branches mortes
        ctx.lineWidth = 3;
        const branches = [
            { x1: x, y1: groundY - 80, x2: x - 40, y2: groundY - 100 },
            { x1: x, y1: groundY - 90, x2: x + 50, y2: groundY - 110 },
            { x1: x, y1: groundY - 100, x2: x - 30, y2: groundY - 130 },
            { x1: x, y1: groundY - 110, x2: x + 20, y2: groundY - 140 }
        ];

        for (const b of branches) {
            ctx.beginPath();
            ctx.moveTo(b.x1, b.y1);
            ctx.lineTo(b.x2, b.y2);
            ctx.stroke();
        }
    }

    drawSkeleton(ctx, x, groundY) {
        ctx.strokeStyle = '#8a8a7a';
        ctx.lineWidth = 2;

        // Colonne vertebrale
        ctx.beginPath();
        ctx.moveTo(x - 30, groundY - 10);
        ctx.lineTo(x + 20, groundY - 15);
        ctx.stroke();

        // Cotes
        for (let i = 0; i < 5; i++) {
            ctx.beginPath();
            ctx.moveTo(x - 20 + i * 8, groundY - 12);
            ctx.lineTo(x - 25 + i * 8, groundY - 25);
            ctx.stroke();
        }

        // Crane (cervide)
        ctx.beginPath();
        ctx.arc(x - 35, groundY - 15, 12, 0, Math.PI * 2);
        ctx.stroke();

        // Bois
        ctx.beginPath();
        ctx.moveTo(x - 40, groundY - 25);
        ctx.lineTo(x - 50, groundY - 45);
        ctx.lineTo(x - 55, groundY - 40);
        ctx.moveTo(x - 50, groundY - 45);
        ctx.lineTo(x - 45, groundY - 55);
        ctx.stroke();
    }

    drawBigCrystal(ctx, x, groundY) {
        ctx.fillStyle = this.colors.LIFE_MIRROR + 'cc';
        ctx.strokeStyle = this.colors.LIFE_MIRROR;
        ctx.lineWidth = 2;

        // Grand cristal central
        ctx.beginPath();
        ctx.moveTo(x - 20, groundY);
        ctx.lineTo(x, groundY - 100);
        ctx.lineTo(x + 20, groundY);
        ctx.closePath();
        ctx.fill();
        ctx.stroke();

        // Cristaux secondaires
        const secondary = [
            { dx: -35, h: 60 },
            { dx: 30, h: 70 },
            { dx: -50, h: 40 },
            { dx: 45, h: 50 }
        ];

        for (const s of secondary) {
            ctx.beginPath();
            ctx.moveTo(x + s.dx - 10, groundY);
            ctx.lineTo(x + s.dx, groundY - s.h);
            ctx.lineTo(x + s.dx + 10, groundY);
            ctx.closePath();
            ctx.fill();
            ctx.stroke();
        }

        // Lueur
        ctx.shadowColor = this.colors.LIFE_MIRROR;
        ctx.shadowBlur = 20;
        ctx.beginPath();
        ctx.arc(x, groundY - 50, 30, 0, Math.PI * 2);
        ctx.stroke();
        ctx.shadowBlur = 0;
    }

    drawRuins(ctx, x, groundY) {
        ctx.fillStyle = '#3a3a3a';
        ctx.strokeStyle = '#5a5a5a';
        ctx.lineWidth = 2;

        // Murs brises
        ctx.fillRect(x - 60, groundY - 80, 20, 80);
        ctx.fillRect(x + 40, groundY - 60, 20, 60);

        // Fondations
        ctx.fillRect(x - 70, groundY - 10, 150, 10);

        // Debris
        ctx.fillStyle = '#4a4a4a';
        ctx.fillRect(x - 20, groundY - 15, 30, 15);
        ctx.fillRect(x + 10, groundY - 20, 25, 20);

        // Panneau
        ctx.fillStyle = '#2a2a2a';
        ctx.fillRect(x - 10, groundY - 50, 40, 30);
        ctx.strokeRect(x - 10, groundY - 50, 40, 30);

        // Texte illisible sur le panneau
        ctx.fillStyle = '#5a5a5a';
        ctx.fillRect(x - 5, groundY - 45, 30, 3);
        ctx.fillRect(x - 5, groundY - 38, 25, 3);
        ctx.fillRect(x - 5, groundY - 31, 28, 3);
    }

    drawPlayer(ctx, height) {
        const groundY = height - 100;
        const screenX = this.player.x - this.cameraX;
        const y = groundY - this.player.height;

        // Combinaison de protection
        ctx.fillStyle = '#445566';
        ctx.strokeStyle = '#667788';
        ctx.lineWidth = 2;

        // Corps
        ctx.fillRect(screenX - 10, y + 20, 20, 30);
        ctx.strokeRect(screenX - 10, y + 20, 20, 30);

        // Casque
        ctx.fillStyle = '#556677';
        ctx.beginPath();
        ctx.arc(screenX, y + 12, 14, 0, Math.PI * 2);
        ctx.fill();
        ctx.stroke();

        // Visiere
        ctx.fillStyle = this.colors.CYAN + '88';
        ctx.beginPath();
        ctx.arc(screenX, y + 12, 8, 0, Math.PI * 2);
        ctx.fill();

        // Jambes (animation de marche)
        ctx.fillStyle = '#445566';
        const legOffset = this.player.walking ? Math.sin(this.player.frame * Math.PI / 2) * 5 : 0;
        ctx.fillRect(screenX - 8, y + 50, 6, 15);
        ctx.fillRect(screenX + 2, y + 50, 6, 15);

        // Bras
        ctx.fillRect(screenX - 18, y + 25, 8, 20);
        ctx.fillRect(screenX + 10, y + 25, 8, 20);

        // Equipement sur le dos
        ctx.fillStyle = '#334455';
        ctx.fillRect(screenX + 10, y + 22, 12, 20);
    }

    drawUI(ctx, width, height) {
        // Distance parcourue
        ctx.fillStyle = this.colors.UI_DIM;
        ctx.font = '12px Courier New';
        ctx.textAlign = 'left';
        ctx.fillText(`Distance : ${Math.floor(this.player.x / 10)}m`, 20, 30);

        // Indicateur de progression
        const progress = this.player.x / this.worldWidth;
        ctx.fillStyle = '#333';
        ctx.fillRect(20, 40, 150, 8);
        ctx.fillStyle = this.colors.CYAN;
        ctx.fillRect(20, 40, 150 * progress, 8);
        ctx.strokeStyle = this.colors.UI_DIM;
        ctx.lineWidth = 1;
        ctx.strokeRect(20, 40, 150, 8);

        // Instructions
        if (this.phase === 'walking') {
            ctx.fillStyle = this.colors.UI_DIM;
            ctx.textAlign = 'center';
            ctx.fillText('Fleches / Clic pour avancer', width / 2, height - 20);
        }

        // Marqueur de fin
        if (!this.reachedEnd) {
            ctx.fillStyle = this.colors.LIFE_MIRROR;
            ctx.textAlign = 'right';
            ctx.fillText('Objectif : Ruines', width - 20, 30);
        }
    }
}
