/**
 * CHAPITRE 1 : LA SYNTHESE
 * * Gestion complète du chapitre : Canvas, UI, Upgrades, Animations
 */

export class Chapter1 {
    constructor(game) {
        this.game = game;
        this.colors = game.getColors();

        // --- ETAT DU JEU ---
        this.molecules = 0;
        this.totalProduced = 0;
        this.mirrorMode = false;
        this.money = 0;
        this.moleculesForMed = 0;
        this.totalUpgrades = 0;
        this.bacteriaLevel = 1;

        // Configuration
        this.decayRate = 2.0;
        this.moleculeTimer = 0;
        this.moleculeRate = 1.0;
        this.medicationDuration = 10.0;

        // Seuils & Objectifs
        this.EVENT_THRESHOLD = 15000; // Fin du chapitre

        // Entites
        this.particles = [];
        this.medications = [];

        // Upgrades
        this.upgrades = [
            {
                name: "Production +1",
                description: "Produit 1 molecule/s de plus",
                cost: 10,
                costMultiplier: 1.5,
                level: 0,
                maxLevel: 30,
                type: "production",
                effect: 1,
                hidden: false
            },
            {
                name: "Duree +2s",
                description: "Les medicaments durent 2s de plus",
                cost: 15,
                costMultiplier: 1.6,
                level: 0,
                maxLevel: 30,
                type: "duration",
                effect: 2,
                hidden: false
            },
            {
                name: "Production x2",
                description: "Double la production de molecules",
                cost: 50,
                costMultiplier: 2.0,
                level: 0,
                maxLevel: 15,
                type: "production_multiplier",
                effect: 2,
                hidden: false
            },
            {
                name: "Duree x1.5",
                description: "Augmente la duree de 50%",
                cost: 75,
                costMultiplier: 2.5,
                level: 0,
                maxLevel: 15,
                type: "duration_multiplier",
                effect: 1.5,
                hidden: false
            },
            // --- UPGRADE CACHÉE ---
            {
                name: "Bactérie Miroir",
                description: "Les médicaments ne se dégradent plus !",
                cost: 10000,
                costMultiplier: 1,
                level: 0,
                maxLevel: 1,
                type: "immortality",
                effect: 1,
                hidden: true // Caché au départ
            }
        ];

        // Animation
        this.bacteriumPulse = 0;
        this.flashIntensity = 0;
        this.liquidWavePhase = 0;

        // Images
        this.labBackgroundImage = new Image();
        this.labBackgroundImage.src = './img/paillasse.png';

        this.petriDishImage = new Image();
        this.petriDishImage.src = './img/boite_de_petri.png';

        this.moleculeImage = new Image();
        this.moleculeImage.src = './img/molecule.png';

        this.bacterieImages = [
            new Image(),
            new Image(),
            new Image(),
            new Image()
        ];
        this.bacterieImages[0].src = './img/bacterie_nv1.png';
        this.bacterieImages[1].src = './img/bacterie_nv2.png';
        this.bacterieImages[2].src = './img/bacterie_nv3.png';
        this.bacterieImages[3].src = './img/bacterie_nv4.png';

        // --- REFERENCES DOM ---
        this.domElements = {
            container: null,
            money: null,
            totalMolecules: null,
            medProgress: null,
            medCount: null,
            pillsContainer: null,
            upgrades: [],
            pipetteAnimation: null
        };
        this.pillElements = [];

        // Tracking pour optimisation des updates DOM
        this._lastMoney = -1;
        this._lastTotalProduced = -1;
        this._lastMoleculesForMed = -1;
        this._lastMedCount = -1;

        // Systeme de tutoriel
        this.tutorialActive = false;
        this.tutorialStep = 0;
        this.tutorialSteps = [
            {
                title: "Chapitre 1 : La Synthese",
                content: "Bienvenue dans le laboratoire. Vous allez creer la premiere <em>bacterie miroir</em>, un organisme a <strong>chiralite inversee</strong>.",
                position: { top: '50%', left: '50%', transform: 'translate(-50%, -50%)' },
                arrow: null,
                highlight: null
            },
            {
                title: "La Bacterie",
                content: "Cliquez sur la <strong>bacterie</strong> au centre pour produire des molecules manuellement.",
                position: { top: '30%', left: '50%', transform: 'translate(-50%, 0)' },
                arrow: 'down',
                highlight: { top: '50%', left: '50%', width: '200px', height: '200px', transform: 'translate(-50%, -50%)', borderRadius: '50%' }
            },
            {
                title: "Les Medicaments",
                content: "Toutes les <strong>10 molecules</strong>, un medicament est créé. Il genere de l'<strong>argent</strong> tant qu'il est actif.",
                position: { top: '150px', left: '260px' },
                arrow: 'left',
                highlight: { top: '10px', left: '10px', width: '240px', height: '200px', borderRadius: '10px', transform: 'none' }
            },
            {
                title: "Ameliorations",
                content: "Investissez votre argent pour automatiser la production et augmenter la duree de vie des medicaments.",
                position: { top: '400px', left: '260px' },
                arrow: 'left',
                highlight: { top: '220px', left: '10px', width: '240px', height: '400px', borderRadius: '10px', transform: 'none' }
            },
            {
                title: "Objectif",
                content: "Produisez <strong>20 000 molecules</strong> pour déclencher la révolution chirale.",
                position: { top: '50%', left: '50%', transform: 'translate(-50%, -50%)' },
                arrow: null,
                highlight: null
            }
        ];

        this.init();
    }

    async init() {
        try {
            // CORRECTION: Nettoyer l'ancienne UI pour forcer le rechargement correct du HTML
            const oldUI = document.getElementById('ch1-ui');
            if (oldUI) oldUI.remove();

            // 1. Charger et injecter HTML/CSS
            await this.loadChapterUI();

            // Petit délai pour s'assurer que le DOM est prêt
            await new Promise(resolve => setTimeout(resolve, 100));

            // 2. Mettre en cache les references DOM
            this.cacheDOMReferences();

            // 3. Configurer les handlers de clics pour les upgrades
            this.setupUpgradeHandlers();

            // 4. Configurer les handlers du tutoriel
            this.setupTutorialHandlers();

            // 5. Afficher l'UI
            this.showUI();

            // 6. Initialiser le jeu
            this.game.setInstructions('');

            // 7. Demarrer le tutoriel
            this.startTutorial();
        } catch (error) {
            console.error('Erreur lors de l\'initialisation du chapitre 1:', error);
            this.game.showDialogue(['Erreur de chargement. Veuillez recharger la page.'], () => {});
        }
    }

    // --- CHARGEMENT HTML/CSS ---

    async loadChapterUI() {
        // Charger le CSS
        if (!document.getElementById('chapter1-css')) {
            const link = document.createElement('link');
            link.id = 'chapter1-css';
            link.rel = 'stylesheet';
            link.href = './chapters/chapter1/chapter1.css';
            document.head.appendChild(link);

            await new Promise(resolve => {
                link.onload = resolve;
                link.onerror = resolve;
            });
        }

        // Charger et injecter le template HTML
        if (!document.getElementById('ch1-ui')) {
            try {
                const response = await fetch('./chapters/chapter1/chapter1.html');
                const html = await response.text();

                const parser = new DOMParser();
                const doc = parser.parseFromString(html, 'text/html');
                const template = doc.getElementById('chapter1-template');

                if (template) {
                    const content = template.content.cloneNode(true);
                    document.getElementById('ui-overlay').appendChild(content);
                }
            } catch (error) {
                console.error('Erreur chargement UI chapitre 1:', error);
            }
        }
    }

    cacheDOMReferences() {
        this.domElements.container = document.getElementById('ch1-ui');
        this.domElements.money = document.querySelector('#ch1-money');
        this.domElements.totalMolecules = document.querySelector('#ch1-total-molecules span');
        this.domElements.statLine = document.querySelector('#ch1-total-molecules');
        this.domElements.medProgress = document.querySelector('#ch1-med-progress span');
        this.domElements.medCount = document.querySelector('#ch1-med-count span');
        this.domElements.pillsContainer = document.getElementById('ch1-pills-container');
        this.domElements.pipetteAnimation = document.getElementById('ch1-pipette-animation');

        // IMPORTANT: On cherche maintenant 5 upgrades (indices 0 à 4)
        this.domElements.upgrades = []; // Reset array
        for (let i = 0; i < 5; i++) {
            const el = document.getElementById(`ch1-upgrade-${i}`);
            if (el) {
                this.domElements.upgrades.push({
                    element: el,
                    name: el.querySelector('.ch1-upgrade-name'),
                    cost: el.querySelector('.ch1-upgrade-cost'),
                    level: el.querySelector('.ch1-upgrade-level')
                });
            } else {
                console.warn(`Upgrade element ch1-upgrade-${i} not found`);
                // Placeholder pour éviter crash index
                this.domElements.upgrades.push(null);
            }
        }

        // Mettre en cache les elements du tutoriel
        this.cacheTutorialReferences();
    }

    cacheTutorialReferences() {
        this.tutorialElements = {
            overlay: document.getElementById('ch1-tutorial-overlay'),
            bubble: document.getElementById('ch1-tutorial-bubble'),
            title: document.getElementById('ch1-tutorial-title'),
            content: document.getElementById('ch1-tutorial-content'),
            nextBtn: document.getElementById('ch1-tutorial-next'),
            skipBtn: document.getElementById('ch1-tutorial-skip'),
            progress: document.getElementById('ch1-tutorial-progress'),
            highlight: document.getElementById('ch1-tutorial-highlight'),
            arrow: document.querySelector('.ch1-tutorial-arrow')
        };
    }

    setupUpgradeHandlers() {
        this.domElements.upgrades.forEach((upg, index) => {
            if (upg && upg.element) {
                upg.element.addEventListener('click', () => {
                    this.buyUpgrade(index);
                });
            }
        });
    }

    setupTutorialHandlers() {
        if (this.tutorialElements.nextBtn) {
            this.tutorialElements.nextBtn.addEventListener('click', () => {
                this.nextTutorialStep();
            });
        }

        if (this.tutorialElements.skipBtn) {
            this.tutorialElements.skipBtn.addEventListener('click', () => {
                this.skipTutorial();
            });
        }
    }

    showUI() {
        if (this.domElements.container) {
            this.domElements.container.style.display = 'block';
            this.domElements.container.classList.remove('hidden');
            setTimeout(() => {
                this.domElements.container.style.opacity = '1';
            }, 50);
        }
    }

    hideUI() {
        if (this.domElements.container) {
            this.domElements.container.style.opacity = '0';
            setTimeout(() => {
                this.domElements.container.classList.add('hidden');
                this.domElements.container.style.display = 'none';
            }, 300);
        }
    }

    destroy() {
        this.hideUI();
    }

    // --- MISE A JOUR DOM ---

    updateDOM() {
        // Argent
        if (this._lastMoney !== Math.floor(this.money)) {
            this._lastMoney = Math.floor(this.money);
            if (this.domElements.money) {
                this.domElements.money.textContent = `$ ${this._lastMoney}`;
            }
        }

        // Total molecules
        if (this._lastTotalProduced !== Math.floor(this.totalProduced)) {
            this._lastTotalProduced = Math.floor(this.totalProduced);
            if (this.domElements.totalMolecules) {
                this.domElements.totalMolecules.textContent = this._lastTotalProduced;
            }
        }

        // Couleur selon mode miroir
        if (this.domElements.statLine) {
            this.domElements.statLine.classList.toggle('ch1-mirror', this.mirrorMode);
        }

        // Progression medicament
        if (this._lastMoleculesForMed !== this.moleculesForMed) {
            this._lastMoleculesForMed = this.moleculesForMed;
            if (this.domElements.medProgress) {
                this.domElements.medProgress.textContent = this.moleculesForMed;
            }
        }

        // Nombre de medicaments
        if (this._lastMedCount !== this.medications.length) {
            this._lastMedCount = this.medications.length;
            if (this.domElements.medCount) {
                this.domElements.medCount.textContent = this.medications.length;
            }
        }

        // Pilules
        this.updatePillsDisplay();

        // Upgrades
        this.updateUpgradesDisplay();
    }

    updatePillsDisplay() {
        const container = this.domElements.pillsContainer;
        if (!container) return;

        const targetCount = Math.min(this.medications.length, 18); // Max 3 lignes

        while (this.pillElements.length < targetCount) {
            const pill = this.createPillElement();
            container.appendChild(pill);
            this.pillElements.push(pill);
        }

        while (this.pillElements.length > targetCount) {
            const pill = this.pillElements.pop();
            pill.remove();
        }

        const hasImmortality = this.upgrades[4] && this.upgrades[4].level > 0;
        
        this.pillElements.forEach((pill, index) => {
            if (this.medications[index]) {
                if (this.mirrorMode || hasImmortality) {
                    pill.style.opacity = 1.0;
                } else {
                    const opacity = this.medications[index].life / this.medicationDuration;
                    pill.style.opacity = Math.max(0.2, opacity);
                }
            }
        });
    }

    createPillElement() {
        const pill = document.createElement('div');
        pill.className = 'ch1-pill';
        pill.innerHTML = `
            <div class="ch1-pill-left"></div>
            <div class="ch1-pill-right"></div>
        `;
        return pill;
    }

    updateUpgradesDisplay() {
        this.upgrades.forEach((upgrade, index) => {
            const dom = this.domElements.upgrades[index];
            // CORRECTION: Vérification de sécurité pour éviter le crash si l'élément n'existe pas
            if (!dom || !dom.element) return;

            if (upgrade.hidden) {
                dom.element.style.display = 'none';
                return;
            } else {
                dom.element.style.display = 'block';
            }

            const canBuy = this.money >= upgrade.cost && upgrade.level < upgrade.maxLevel;
            const isMaxed = upgrade.level >= upgrade.maxLevel;

            dom.element.classList.toggle('ch1-can-buy', canBuy && !isMaxed);
            dom.element.classList.toggle('ch1-maxed', isMaxed);

            if (dom.level) {
                dom.level.textContent = `Niveau: ${upgrade.level}/${upgrade.maxLevel}`;
            }

            if (dom.cost) {
                dom.cost.textContent = isMaxed ? 'MAX' : `$${upgrade.cost}`;
            }
        });
    }

    // --- LOGIQUE DE JEU ---

    update(deltaTime) {
        const { width, height } = this.game.getCanvasSize();

        // 1. Apparition de l'upgrade cachée (1000 molecules pour tester, 10000 reel)
        if (this.totalProduced >= 10000 && this.upgrades[4].hidden) {
            this.upgrades[4].hidden = false;
            // Supprimé : this.game.showDialogue([...], () => {});
        }

        // Generation automatique de molecules
        this.moleculeTimer += deltaTime;
        if (this.moleculeTimer >= 1.0 / this.moleculeRate) {
            this.moleculeTimer = 0;
            this.molecules += 1;
            this.totalProduced += 1;
            this.moleculesForMed += 1;

            // Position aleatoire dans la boite de Petri (centrée)
            const centerX = width / 2 + 50;
            const centerY = height / 2 + 70;
            const angle = Math.random() * Math.PI * 2;
            const radius = Math.random() * 140;
            const randomX = centerX + Math.cos(angle) * radius;
            const randomY = centerY + Math.sin(angle) * radius;

            this.spawnParticle(
                randomX,
                randomY,
                "",
                this.mirrorMode ? this.colors.LIFE_MIRROR : this.colors.LIFE_NORMAL,
                false,
                this.moleculeImage
            );

            this.checkMedicationCreation();

            if (!this.mirrorMode && this.totalProduced >= this.EVENT_THRESHOLD) {
                this.triggerMirrorRevolution();
            }
        }

        // Input
        const mouse = this.game.getMouse();
        if (mouse.clicked) {
            // Clic sur la bacterie (centrée)
            const centerX = width / 2 + 50;
            const centerY = height / 2 + 70;
            if (this.dist(mouse.x, mouse.y, centerX, centerY) < 100) {
                this.molecules += 1;
                this.totalProduced += 1;
                this.moleculesForMed += 1;

                this.spawnParticle(mouse.x, mouse.y - 30, "+1", this.mirrorMode ? this.colors.LIFE_MIRROR : this.colors.LIFE_NORMAL);
                this.spawnMoleculeBurst(mouse.x, mouse.y, 3);

                this.checkMedicationCreation();
            }
        }

        // Animations
        this.bacteriumPulse += deltaTime * 5;
        if (this.flashIntensity > 0) this.flashIntensity -= deltaTime * 0.5;
        this.liquidWavePhase += deltaTime * 3;
        this.updateParticles(deltaTime);

        const hasImmortality = this.upgrades[4].level > 0;

        // Medicaments
        for (let i = this.medications.length - 1; i >= 0; i--) {
            let med = this.medications[i];
            this.money += deltaTime;
            
            if (!this.mirrorMode && !hasImmortality) {
                med.life -= deltaTime;
                if (med.life <= 0) {
                    this.medications.splice(i, 1);
                }
            }
        }

        this.updateDOM();
    }

    checkMedicationCreation() {
        while (this.moleculesForMed >= 10 && this.molecules >= 10) {
            this.moleculesForMed -= 10;
            this.molecules -= 10;
            this.spawnMedication();

            const { width, height } = this.game.getCanvasSize();
            const particleX = 80 + (Math.random() * 40 - 20);
            const particleY = height - 200;

            this.spawnParticle(particleX, particleY, "-10", "#ff4444");
        }
    }

    spawnMedication() {
        this.medications.push({
            x: Math.random() * 100 + 50,
            y: Math.random() * 100 + 50,
            life: this.medicationDuration
        });
    }

    // --- LOGIQUE UPGRADE MISE A JOUR ---

    buyUpgrade(upgradeIndex) {
        const upgrade = this.upgrades[upgradeIndex];

        if (!upgrade) return false;
        if (upgrade.level >= upgrade.maxLevel) return false;
        if (this.money < upgrade.cost) return false;

        this.money -= upgrade.cost;
        upgrade.level++;
        upgrade.cost = Math.floor(upgrade.cost * upgrade.costMultiplier);

        this.totalUpgrades++;
        this.updateBacteriaLevel();

        this.recalculateStats();

        // DECLENCHEMENT DE L'ANIMATION PIPETTE
        this.triggerPipetteAnimation();

        return true;
    }

    updateBacteriaLevel() {
        if (this.mirrorMode) {
            this.bacteriaLevel = 4;
        } else if (this.totalUpgrades >= 20) {
            this.bacteriaLevel = 3;
        } else if (this.totalUpgrades >= 10) {
            this.bacteriaLevel = 2;
        } else {
            this.bacteriaLevel = 1;
        }
    }

    triggerPipetteAnimation() {
        const pipette = this.domElements.pipetteAnimation;
        
        if (pipette) {
            // 1. Reset
            pipette.classList.remove('active');
            
            // 2. Force Reflow (astuce pour redémarrer l'animation CSS immédiatement)
            void pipette.offsetWidth; 
            
            // 3. Start
            pipette.classList.add('active');
        }
    }

    recalculateStats() {
        let productionBonus = 0;
        let productionMultiplier = 1;
        let durationBonus = 0;
        let durationMultiplier = 1;

        this.upgrades.forEach(upgrade => {
            if (upgrade.level > 0) {
                switch (upgrade.type) {
                    case "production":
                        productionBonus += upgrade.effect * upgrade.level;
                        break;
                    case "production_multiplier":
                        productionMultiplier *= Math.pow(upgrade.effect, upgrade.level);
                        break;
                    case "duration":
                        durationBonus += upgrade.effect * upgrade.level;
                        break;
                    case "duration_multiplier":
                        durationMultiplier *= Math.pow(upgrade.effect, upgrade.level);
                        break;
                    case "immortality":
                        break;
                }
            }
        });

        this.moleculeRate = (1 + productionBonus) * productionMultiplier;
        this.medicationDuration = (10 + durationBonus) * durationMultiplier;
    }

    triggerMirrorRevolution() {
        this.mirrorMode = true;
        this.flashIntensity = 1;
        this.molecules += 100;
        this.updateBacteriaLevel();
        this.game.showDialogue([
            "OBJECTIF ATTEINT !",
            "Vous avez produit 20 000 molecules.",
            "La premiere bacterie miroir est prete.",
            "La revolution chirale commence..."
        ], () => {
            this.game.chapterComplete("Chapitre 1 termine : 20 000 molecules produites - La bacterie miroir est creee !");
        });
    }

    // --- SYSTEME DE PARTICULES ---

    spawnParticle(x, y, text, color, flyToBeaker = false, image = null) {
        const vx = (Math.random() - 0.5) * 60;
        const vy = -50 - (Math.random() * 50);

        this.particles.push({
            x, y, text, color,
            life: 1.0,
            vx: vx,
            vy: vy,
            flyToBeaker: flyToBeaker,
            image: image,
            scale: 0.5 + Math.random() * 0.5
        });
    }

    spawnMoleculeBurst(x, y, count) {
        for (let i = 0; i < count; i++) {
            const offsetX = (Math.random() - 0.5) * 20;
            const offsetY = (Math.random() - 0.5) * 20;

            this.spawnParticle(
                x + offsetX,
                y + offsetY,
                "",
                this.mirrorMode ? this.colors.LIFE_MIRROR : this.colors.LIFE_NORMAL,
                false,
                this.moleculeImage
            );
        }
    }

    updateParticles(dt) {
        for (let i = this.particles.length - 1; i >= 0; i--) {
            let p = this.particles[i];
            p.life -= dt;

            p.x += p.vx * dt;
            p.y += p.vy * dt;

            if (p.life <= 0) this.particles.splice(i, 1);
        }
    }

    dist(x1, y1, x2, y2) {
        return Math.sqrt((x2 - x1) ** 2 + (y2 - y1) ** 2);
    }

    // --- RENDU CANVAS ---

    draw(ctx) {
        const { width, height } = this.game.getCanvasSize();

        // 1. Fond
        if (this.labBackgroundImage.complete && this.labBackgroundImage.naturalWidth > 0) {
            ctx.drawImage(this.labBackgroundImage, 0, 0, width, height);
        } else {
            ctx.fillStyle = '#111111';
            ctx.fillRect(0, 0, width, height);
        }

        // 2. Bacterie
        this.drawBacteria(ctx, width, height);

        // 3. Particules
        this.drawParticles(ctx);

        // 4. Flash
        if (this.flashIntensity > 0) {
            ctx.fillStyle = `rgba(255, 255, 255, ${this.flashIntensity})`;
            ctx.fillRect(0, 0, width, height);
        }
    }

    drawBacteria(ctx, w, h) {
        ctx.save();
        // Centre de la bactérie (ajusté pour le layout)
        ctx.translate(w / 2 + 50, h / 2 + 70);

        if (this.petriDishImage.complete && this.petriDishImage.naturalWidth > 0) {
            ctx.drawImage(this.petriDishImage, -200, -200, 400, 400);
        } else {
            ctx.fillStyle = this.mirrorMode ? this.colors.LIFE_MIRROR : this.colors.LIFE_NORMAL;
            ctx.beginPath();
            ctx.arc(0, 0, 40, 0, Math.PI * 2);
            ctx.fill();
            ctx.strokeStyle = 'white';
            ctx.lineWidth = 3;
            ctx.stroke();
        }

        const image = this.bacterieImages[this.bacteriaLevel - 1];
        if (image && image.complete && image.naturalWidth > 0) {
            const bw = image.naturalWidth;
            const bh = image.naturalHeight;
            const scale = 0.5;
            // Petite pulsation
            const pulse = 1 + Math.sin(this.bacteriumPulse) * 0.05;
            
            ctx.scale(pulse, pulse);
            ctx.drawImage(image, -(bw * scale) / 2, -(bh * scale) / 2, bw * scale, bh * scale);
        }
        ctx.restore();
    }

    drawParticles(ctx) {
        ctx.textAlign = 'center';
        ctx.font = 'bold 20px Arial';
        for (let p of this.particles) {
            ctx.globalAlpha = p.life;
            if (p.image && p.image.complete && p.image.naturalWidth > 0) {
                const s = p.scale || 1.0;
                const size = 64 * s;
                ctx.drawImage(p.image, p.x - size / 2, p.y - size / 2, size, size);
            } else {
                ctx.fillStyle = p.color;
                ctx.fillText(p.text, p.x, p.y);
            }
        }
        ctx.globalAlpha = 1.0;
    }

    lightenColor(color, percent) {
        if (color === this.colors.LIFE_NORMAL) return '#88ffaa';
        if (color === this.colors.LIFE_MIRROR) return '#dd88ff';
        return '#ffffff';
    }

    // --- SYSTEME DE TUTORIEL ---

    startTutorial() {
        this.tutorialActive = true;
        this.tutorialStep = 0;

        if (this.tutorialElements.progress) {
            this.tutorialElements.progress.innerHTML = '';
            for (let i = 0; i < this.tutorialSteps.length; i++) {
                const dot = document.createElement('div');
                dot.className = 'ch1-tutorial-dot';
                if (i === 0) dot.classList.add('active');
                this.tutorialElements.progress.appendChild(dot);
            }
        }

        this.showTutorialStep(0);
    }

    showTutorialStep(stepIndex) {
        if (stepIndex >= this.tutorialSteps.length) {
            this.endTutorial();
            return;
        }

        const step = this.tutorialSteps[stepIndex];

        if (this.tutorialElements.title) this.tutorialElements.title.textContent = step.title;
        if (this.tutorialElements.content) this.tutorialElements.content.innerHTML = step.content;

        if (this.tutorialElements.bubble) Object.assign(this.tutorialElements.bubble.style, step.position);

        if (this.tutorialElements.arrow) {
            this.tutorialElements.arrow.className = 'ch1-tutorial-arrow';
            if (step.arrow) this.tutorialElements.arrow.classList.add(step.arrow);
        }

        if (this.tutorialElements.highlight) {
            if (step.highlight) {
                this.tutorialElements.highlight.style.display = 'block';
                Object.assign(this.tutorialElements.highlight.style, step.highlight);
            } else {
                this.tutorialElements.highlight.style.display = 'none';
            }
        }

        if (this.tutorialElements.nextBtn) {
            this.tutorialElements.nextBtn.textContent = stepIndex === this.tutorialSteps.length - 1 ? 'COMMENCER' : 'SUIVANT';
        }

        if (this.tutorialElements.overlay) this.tutorialElements.overlay.classList.add('active');

        setTimeout(() => {
            if (this.tutorialElements.bubble) this.tutorialElements.bubble.classList.add('visible');
        }, 50);

        this.updateTutorialProgress(stepIndex);
    }

    nextTutorialStep() {
        if (this.tutorialElements.bubble) this.tutorialElements.bubble.classList.remove('visible');
        setTimeout(() => {
            this.tutorialStep++;
            this.showTutorialStep(this.tutorialStep);
        }, 300);
    }

    skipTutorial() {
        if (this.tutorialElements.bubble) this.tutorialElements.bubble.classList.remove('visible');
        setTimeout(() => {
            this.endTutorial();
        }, 300);
    }

    endTutorial() {
        this.tutorialActive = false;
        if (this.tutorialElements.overlay) this.tutorialElements.overlay.classList.remove('active');
        if (this.tutorialElements.highlight) this.tutorialElements.highlight.style.display = 'none';
    }

    updateTutorialProgress(currentStep) {
        if (!this.tutorialElements.progress) return;
        const dots = this.tutorialElements.progress.querySelectorAll('.ch1-tutorial-dot');
        dots.forEach((dot, index) => {
            if (index === currentStep) dot.classList.add('active');
            else dot.classList.remove('active');
        });
    }
}
