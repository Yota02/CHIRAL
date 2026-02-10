/**
 * CHAPITRE 1 : LA SYNTHESE
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
        this.journalDisplayed = false;

        // Configuration
        this.decayRate = 2.0;
        this.moleculeTimer = 0;
        this.moleculeRate = 1.0;
        this.medicationDuration = 10.0;
        this.moleculeThreshold = 10;

        // Seuils & Objectifs
        this.EVENT_THRESHOLD = 100000;

        // Entites
        this.particles = [];
        this.medications = [];

        // Upgrades
        this.upgrades = [
            {
                name: "Production +1",
                description: "Produit 1 molecule/s de plus",
                cost: 10, costMultiplier: 1.5, level: 0, maxLevel: 30,
                type: "production", effect: 1, hidden: false
            },
            {
                name: "Duree +2s",
                description: "Les medicaments durent 2s de plus",
                cost: 15, costMultiplier: 1.6, level: 0, maxLevel: 30,
                type: "duration", effect: 2, hidden: false
            },
            {
                name: "Production x2",
                description: "Double la production de molecules",
                cost: 50, costMultiplier: 2.0, level: 0, maxLevel: 15,
                type: "production_multiplier", effect: 2, hidden: false
            },
            {
                name: "Duree x1.5",
                description: "Augmente la duree de 50%",
                cost: 75, costMultiplier: 2.5, level: 0, maxLevel: 15,
                type: "duration_multiplier", effect: 1.5, hidden: false
            },
            {
                name: "Bactérie Miroir",
                description: "Les médicaments ne se dégradent plus !",
                cost: 10000, costMultiplier: 1, level: 0, maxLevel: 1,
                type: "immortality", effect: 1, hidden: true
            },
            {
                name: "Réduction Molécules",
                description: "Réduit de 1 le nombre de molécules nécessaires par médicament",
                cost: 20, costMultiplier: 2.0, level: 0, maxLevel: 9,
                type: "molecule_threshold_reduction", effect: 1, hidden: false
            }
        ];

        // Images
        this.labBackgroundImage = new Image();
        this.labBackgroundImage.src = './img/paillasse.png';
        this.petriDishImage = new Image();
        this.petriDishImage.src = './img/boite_de_petri.png';
        this.moleculeImage = new Image();
        this.moleculeImage.src = './img/molecule.png';
        
        this.bacterieImages = [new Image(), new Image(), new Image(), new Image()];
        this.bacterieImages[0].src = './img/bacterie_nv1.png';
        this.bacterieImages[1].src = './img/bacterie_nv2.png';
        this.bacterieImages[2].src = './img/bacterie_nv3.png';
        this.bacterieImages[3].src = './img/bacterie_nv4.png';

        // --- REFERENCES DOM ---
        this.domElements = {
            container: null, money: null, totalMolecules: null, medProgress: null,
            medCount: null, pillsContainer: null, upgrades: [],
            pipetteAnimation: null, beakerFill: null, beaker: null,
            beakerMolecules: null, flyingMeds: null, journalIcon: null
        };
        this.pillElements = [];
        this.beakerMoleculeElements = [];

        // Tracking (dirty flags)
        this._lastMoney = -1;
        this._lastTotalProduced = -1;
        this._lastMoleculesForMed = -1;
        this._lastMedCount = -1;
        this._lastMoleculeThreshold = -1;
        this._upgradesDirty = true;
        this._cachedBeakerRect = null;
        this._cachedPillsRect = null;
        this._rectCacheTime = 0;

        // --- SYSTEME DE TUTORIEL CONFIGURATION ---
        this.tutorialActive = false;
        this.tutorialStep = 0;
        this.tutorialSteps = [
            {
                title: "Chapitre 1 : La Synthèse",
                content: "Bienvenue dans le laboratoire. Vous êtes un scientifique travaillant pour un laboratoire privé. Votre mission est de créer la première <em>bactérie miroir</em>, un organisme à <strong>chiralité inversée</strong>.",
                target: null,
                placement: 'center'
            },
            {
                title: "Journal de Présentation",
                content: "En haut à droite, vous trouverez le journal de présentation. Il contient des informations importantes sur la chiralité. Cliquez dessus pour l'ouvrir et en apprendre plus.",
                target: '#ch1-journal-icon',
                placement: 'bottom'
            },
            {
                title: "La Bactérie",
                content: "La bactérie sur laquelle vous travaillez génère des molécules à l'intérieur de la boîte de pétri.",
                target: 'canvas-center',
                placement: 'bottom'
            },
            {
                title: "Les Médicaments",
                content: "Toutes les <strong>10 molécules</strong>, un médicament est créé. Il génère de l'<strong>argent</strong> tant qu'il est actif. En effet le corps des patients détruit les médicaments au fil du temps, vous devez donc en produire constamment pour maintenir vos revenus.",
                target: '#ch1-medications-panel',
                placement: 'right'
            },
            {
                title: "Améliorations",
                content: "Investissez votre argent ici pour automatiser la production et augmenter la durée de vie des médicaments.",
                target: '#ch1-upgrades-panel',
                placement: 'right'
            },
            {
                title: "Objectif",
                content: "Produisez <strong>100 000 molécules</strong> pour déclencher la révolution chirale.",
                target: '#ch1-total-molecules',
                placement: 'bottom'
            }
        ];

        this.bacteriaXOffset = 0;
        this.bacteriaYOffset = 0;

        this.init();
    }

    async init() {
        try {
            const oldUI = document.getElementById('ch1-ui');
            if (oldUI) oldUI.remove();

            await this.loadChapterUI();
            await new Promise(resolve => setTimeout(resolve, 100));

            this.cacheDOMReferences();
            this.setupUpgradeHandlers();
            this.setupTutorialHandlers();
            this.showUI();
            
            this.game.setInstructions('');
            this.startTutorial();
        } catch (error) {
            console.error('Erreur init chap 1:', error);
        }
    }

    // --- CHARGEMENT ---
    async loadChapterUI() {
        // Charger le CSS
        if (!document.getElementById('chapter1-css')) {
            const link = document.createElement('link');
            link.id = 'chapter1-css';
            link.rel = 'stylesheet';
            link.href = './chapters/chapter1/chapter1.css';
            document.head.appendChild(link);
            await new Promise(resolve => { link.onload = resolve; link.onerror = resolve; });
        }

        // Charger le HTML
        if (!document.getElementById('ch1-ui')) {
            const response = await fetch('./chapters/chapter1/chapter1.html');
            const html = await response.text();
            const parser = new DOMParser();
            const doc = parser.parseFromString(html, 'text/html');
            const template = doc.getElementById('chapter1-template');
            if (template) {
                const content = template.content.cloneNode(true);
                document.getElementById('ui-overlay').appendChild(content);
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
        this.domElements.medThreshold = document.querySelector('#ch1-med-threshold');
        this.domElements.beakerFill = document.getElementById('ch1-beaker-fill');
        this.domElements.beaker = document.querySelector('.ch1-beaker');
        this.domElements.beakerMolecules = document.getElementById('ch1-beaker-molecules');
        this.domElements.flyingMeds = document.getElementById('ch1-flying-meds');
        this.domElements.journalIcon = document.getElementById('ch1-journal-icon');

        this.domElements.upgrades = [];
        for (let i = 0; i < 6; i++) {
            const el = document.getElementById(`ch1-upgrade-${i}`);
            if (el) {
                this.domElements.upgrades.push({
                    element: el,
                    name: el.querySelector('.ch1-upgrade-name'),
                    cost: el.querySelector('.ch1-upgrade-cost'),
                    level: el.querySelector('.ch1-upgrade-level')
                });
            } else {
                this.domElements.upgrades.push(null);
            }
        }

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
                upg.element.addEventListener('click', () => this.buyUpgrade(index));
            }
        });

        if (this.domElements.journalIcon) {
            this.domElements.journalIcon.addEventListener('click', () => this.triggerChiraliteDisplay());
        }
    }

    setupTutorialHandlers() {
        if (this.tutorialElements.nextBtn) {
            this.tutorialElements.nextBtn.addEventListener('click', () => this.nextTutorialStep());
        }
        if (this.tutorialElements.skipBtn) {
            this.tutorialElements.skipBtn.addEventListener('click', () => this.skipTutorial());
        }
    }

    showUI() {
        if (this.domElements.container) {
            this.domElements.container.style.display = 'block';
            this.domElements.container.classList.remove('hidden');
            setTimeout(() => { this.domElements.container.style.opacity = '1'; }, 50);
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

    async triggerChiraliteDisplay() {
        this.journalDisplayed = true;

        const overlay = document.createElement('div');
        overlay.id = 'ch1-chiralite-overlay';
        overlay.style.position = 'fixed';
        overlay.style.top = '0';
        overlay.style.left = '0';
        overlay.style.width = '100%';
        overlay.style.height = '100%';
        overlay.style.backgroundColor = 'rgba(0, 0, 0, 0.8)';
        overlay.style.display = 'flex';
        overlay.style.flexDirection = 'column';
        overlay.style.alignItems = 'center';
        overlay.style.justifyContent = 'center';
        overlay.style.zIndex = '1000';
        overlay.style.fontFamily = 'monospace';
        overlay.style.color = '#00ff00';
        overlay.style.whiteSpace = 'pre-wrap';
        overlay.style.overflowY = 'auto';
        overlay.style.padding = '20px';
        overlay.style.opacity = '0';
        overlay.style.transition = 'opacity 1s ease';

        try {
            const response = await fetch('./chapters/chapter1/assets/chiralite.md');
            const chiraliteContent = await response.text();
            overlay.innerText = chiraliteContent;
        } catch (error) {
            overlay.innerText = 'Erreur lors du chargement de chiralite.';
            console.error('Erreur chargement chiralite:', error);
        }

        const buttonContainer = document.createElement('div');
        buttonContainer.style.position = 'absolute';
        buttonContainer.style.bottom = '20px';
        buttonContainer.style.right = '20px';
        buttonContainer.style.textAlign = 'right';

        const closeButton = document.createElement('button');
        closeButton.innerHTML = 'Fermer';
        closeButton.style.fontSize = '24px';
        closeButton.style.background = 'none';
        closeButton.style.border = 'none';
        closeButton.style.color = '#00ff00';
        closeButton.style.cursor = 'pointer';
        closeButton.style.padding = '10px';
        closeButton.addEventListener('click', () => {
            overlay.remove(); 
            this.journalDisplayed = false;
        });

        buttonContainer.appendChild(closeButton);
        overlay.appendChild(buttonContainer);

        document.body.appendChild(overlay);
        setTimeout(() => {
            overlay.style.opacity = '1';
        }, 50);
    }

    // --- PARTICLES ---
    spawnParticle(x, y, text, color, flyToBeaker = false, image = null) {
        this.particles.push({
            x, y, text, color, life: 1.0, vx: (Math.random() - 0.5) * 60, vy: -50 - Math.random() * 50,
            flyToBeaker, image, scale: 0.5 + Math.random() * 0.5
        });
    }

    spawnMoleculeBurst(x, y, count) {
        for (let i = 0; i < count; i++) {
            this.spawnParticle(x + (Math.random()-0.5)*20, y + (Math.random()-0.5)*20, "", 
            this.mirrorMode ? this.colors.LIFE_MIRROR : this.colors.LIFE_NORMAL, false, this.moleculeImage);
        }
    }

    updateParticles(dt) {
        let i = this.particles.length;
        while (i--) {
            const p = this.particles[i];
            p.life -= dt;
            p.x += p.vx * dt;
            p.y += p.vy * dt;
            if (p.life <= 0) {
                // Swap-and-pop : O(1) au lieu de O(n) avec splice
                this.particles[i] = this.particles[this.particles.length - 1];
                this.particles.pop();
            }
        }
    }

    dist(x1, y1, x2, y2) { return Math.sqrt((x2 - x1) ** 2 + (y2 - y1) ** 2); }

    // --- UPDATE LOOP ---
    update(deltaTime) {
        if (this.journalDisplayed) return;

        const w = this.game.canvas.width;
        const h = this.game.canvas.height;

        // Reveal hidden upgrade (une seule fois)
        if (this.upgrades[4].hidden && this.totalProduced >= 10000) {
            this.upgrades[4].hidden = false;
            this._upgradesDirty = true;
        }

        // Auto generation - temps cumulé pour hautes vitesses
        this.moleculeTimer += deltaTime;
        const timePerMolecule = 1.0 / this.moleculeRate;

        if (this.moleculeTimer >= timePerMolecule) {
            const numToProduce = Math.floor(this.moleculeTimer / timePerMolecule);

            this.molecules += numToProduce;
            this.totalProduced += numToProduce;
            this.moleculesForMed += numToProduce;
            this.moleculeTimer -= (numToProduce * timePerMolecule);

            // Effets Visuels : 1 particule par frame max
            const centerX = w / 2 + 50;
            const centerY = h / 2 + 70;
            const angle = Math.random() * Math.PI * 2;
            const radius = Math.random() * 140;
            
            // Affiche "+N" si on en produit plusieurs d'un coup
            const textDisplay = numToProduce > 1 ? `+${numToProduce}` : "";
            
            this.spawnParticle(
                centerX + Math.cos(angle) * radius, 
                centerY + Math.sin(angle) * radius, 
                textDisplay, 
                this.mirrorMode ? this.colors.LIFE_MIRROR : this.colors.LIFE_NORMAL, 
                false, 
                this.moleculeImage
            );
            
            this.checkMedicationCreation();
            
            if (!this.mirrorMode && this.totalProduced >= this.EVENT_THRESHOLD) {
                this.triggerJournalDisplay();
            }
        }

        // Click Input - accès direct pour éviter la copie d'objet
        const mouse = this.game.mouse;
        if (mouse.clicked) {
            const centerX = w / 2 + 50;
            const centerY = h / 2 + 70;
            if (this.dist(mouse.x, mouse.y, centerX, centerY) < 100) {
                this.molecules += 1;
                this.totalProduced += 1;
                this.moleculesForMed += 1;
                this.spawnParticle(mouse.x, mouse.y - 30, "+1", this.mirrorMode ? this.colors.LIFE_MIRROR : this.colors.LIFE_NORMAL);
                this.spawnMoleculeBurst(mouse.x, mouse.y, 3);
                this.checkMedicationCreation();
            }
        }

        // Animation de la bactérie
        const time = this.game.getTime ? this.game.getTime() : performance.now() / 1000;
        this.bacteriaXOffset = Math.sin(time * 1.5) * 6;
        this.bacteriaYOffset = Math.cos(time * 1.2) * 4;

        // Logic
        this.updateParticles(deltaTime);
        const hasImmortality = this.upgrades[4] && this.upgrades[4].level > 0;
        const medCount = this.medications.length;
        this.money += deltaTime * medCount;
        if (!this.mirrorMode && !hasImmortality) {
            let i = this.medications.length;
            while (i--) {
                this.medications[i].life -= deltaTime;
                if (this.medications[i].life <= 0) {
                    this.medications[i] = this.medications[this.medications.length - 1];
                    this.medications.pop();
                }
            }
        }

        this.updateDOM();
    }

    checkMedicationCreation() {
        let created = 0;
        while (this.moleculesForMed >= this.moleculeThreshold && this.molecules >= this.moleculeThreshold) {
            this.moleculesForMed -= this.moleculeThreshold;
            this.molecules -= this.moleculeThreshold;
            this.spawnMedication();
            created++;
        }
        // Effet visuel groupé : max 1 animation par frame
        if (created > 0 && this.medications.length < 200) {
            const h = this.game.canvas.height;
            const label = created > 1 ? `-${this.moleculeThreshold * created}` : `-${this.moleculeThreshold}`;
            this.spawnParticle(80, h - 200, label, "#ff4444");
            this.triggerBeakerEmptyAnimation();
            this.spawnFlyingMedication();
        }
    }

    spawnMedication() {
        this.medications.push({ x: 0, y: 0, life: this.medicationDuration });
    }

    buyUpgrade(upgradeIndex) {
        const upgrade = this.upgrades[upgradeIndex];
        if (!upgrade || upgrade.level >= upgrade.maxLevel || this.money < upgrade.cost) return false;

        this.money -= upgrade.cost;
        upgrade.level++;
        upgrade.cost = Math.floor(upgrade.cost * upgrade.costMultiplier);
        this.totalUpgrades++;
        this._upgradesDirty = true;
        this.updateBacteriaLevel();
        this.recalculateStats();
        this.triggerPipetteAnimation();
        return true;
    }

    updateBacteriaLevel() {
        if (this.mirrorMode) this.bacteriaLevel = 4;
        else if (this.totalUpgrades >= 20) this.bacteriaLevel = 3;
        else if (this.totalUpgrades >= 10) this.bacteriaLevel = 2;
        else this.bacteriaLevel = 1;
    }

    triggerPipetteAnimation() {
        const pipette = this.domElements.pipetteAnimation;
        if (pipette) {
            pipette.classList.remove('active');
            void pipette.offsetWidth;
            pipette.classList.add('active');
        }
    }

    recalculateStats() {
        let productionBonus = 0;
        let productionMultiplier = 1;
        let durationBonus = 0;
        let durationMultiplier = 1;
        let thresholdReduction = 0;

        this.upgrades.forEach(upgrade => {
            if (upgrade.level > 0) {
                switch (upgrade.type) {
                    case "production": productionBonus += upgrade.effect * upgrade.level; break;
                    case "production_multiplier": productionMultiplier *= Math.pow(upgrade.effect, upgrade.level); break;
                    case "duration": durationBonus += upgrade.effect * upgrade.level; break;
                    case "duration_multiplier": durationMultiplier *= Math.pow(upgrade.effect, upgrade.level); break;
                    case "molecule_threshold_reduction": thresholdReduction += upgrade.effect * upgrade.level; break;
                }
            }
        });

        this.moleculeRate = (1 + productionBonus) * productionMultiplier;
        this.medicationDuration = (10 + durationBonus) * durationMultiplier;
        this.moleculeThreshold = Math.max(1, 10 - thresholdReduction);
    }

    async triggerJournalDisplay() {
        this.mirrorMode = false;
        this.journalDisplayed = true;

        const overlay = document.createElement('div');
        overlay.id = 'ch1-journal-overlay';
        overlay.style.position = 'fixed';
        overlay.style.top = '0';
        overlay.style.left = '0';
        overlay.style.width = '100%';
        overlay.style.height = '100%';
        overlay.style.backgroundColor = 'rgba(0, 0, 0, 0.8)';
        overlay.style.display = 'flex';
        overlay.style.flexDirection = 'column';
        overlay.style.alignItems = 'center';
        overlay.style.justifyContent = 'center';
        overlay.style.zIndex = '1000';
        overlay.style.fontFamily = 'monospace';
        overlay.style.color = '#00ff00';
        overlay.style.whiteSpace = 'pre-wrap';
        overlay.style.overflowY = 'auto';
        overlay.style.padding = '20px';
        overlay.style.opacity = '0';
        overlay.style.transition = 'opacity 1s ease';

        try {
            const response = await fetch('./chapters/chapter1/assets/journal.md');
            const journalContent = await response.text();
            overlay.innerText = journalContent;
        } catch (error) {
            overlay.innerText = 'Erreur lors du chargement du journal.';
            console.error('Erreur chargement journal:', error);
        }

        const buttonContainer = document.createElement('div');
        buttonContainer.style.position = 'absolute';
        buttonContainer.style.bottom = '20px';
        buttonContainer.style.right = '20px';
        buttonContainer.style.textAlign = 'right';

        const arrowButton = document.createElement('button');
        arrowButton.innerHTML = '→';
        arrowButton.style.fontSize = '64px';
        arrowButton.style.background = 'none';
        arrowButton.style.border = 'none';
        arrowButton.style.color = '#00ff00';
        arrowButton.style.cursor = 'pointer';
        arrowButton.style.padding = '10px';
        arrowButton.addEventListener('click', () => {
            overlay.remove(); 
            console.log('Journal fermé, démarrage du chapitre 2');
            this.journalDisplayed = false;
            this.game.startChapter(1); 
        });

        buttonContainer.appendChild(arrowButton);
        overlay.appendChild(buttonContainer);

        document.body.appendChild(overlay);
        setTimeout(() => {
            overlay.style.opacity = '1';
        }, 50);
    }

    triggerBeakerEmptyAnimation() {
        if (!this.domElements.beaker) return;
        this.domElements.beaker.classList.add('creating');
        this.beakerMoleculeElements.forEach(mol => mol.remove());
        this.beakerMoleculeElements = [];
        setTimeout(() => { this.domElements.beaker.classList.remove('creating'); }, 400);
    }

    spawnFlyingMedication() {
        if (!this.domElements.flyingMeds || !this.domElements.pillsContainer || !this.domElements.beaker) return;

        // Cache les rects pendant 500ms pour éviter les reflows répétés
        const now = performance.now();
        if (!this._cachedBeakerRect || now - this._rectCacheTime > 500) {
            this._cachedBeakerRect = this.domElements.beaker.getBoundingClientRect();
            this._cachedPillsRect = this.domElements.pillsContainer.getBoundingClientRect();
            this._rectCacheTime = now;
        }

        const beakerRect = this._cachedBeakerRect;
        const pillsRect = this._cachedPillsRect;

        const startX = beakerRect.left + beakerRect.width / 2;
        const startY = beakerRect.top + beakerRect.height / 2;
        const endX = pillsRect.left + pillsRect.width / 2;
        const endY = pillsRect.top + pillsRect.height / 2;

        const flyingMed = document.createElement('div');
        flyingMed.className = 'ch1-flying-med';
        flyingMed.innerHTML = `<span class="ch1-flying-med-plus">+</span><div class="ch1-flying-med-pill"><div class="ch1-flying-med-pill-left"></div><div class="ch1-flying-med-pill-right"></div></div>`;
        flyingMed.style.left = `${startX}px`;
        flyingMed.style.top = `${startY}px`;
        this.domElements.flyingMeds.appendChild(flyingMed);

        const duration = 800;
        const startTime = performance.now();
        const animate = (currentTime) => {
            const elapsed = currentTime - startTime;
            const progress = Math.min(elapsed / duration, 1);
            const easeProgress = 1 - Math.pow(1 - progress, 3);
            const currentX = startX + (endX - startX) * easeProgress;
            const currentY = startY + (endY - startY) * easeProgress - Math.sin(progress * Math.PI) * 50;
            flyingMed.style.left = `${currentX}px`;
            flyingMed.style.top = `${currentY}px`;

            if (progress < 1) requestAnimationFrame(animate);
            else setTimeout(() => flyingMed.remove(), 100);
        };
        requestAnimationFrame(animate);
    }

    updateDOM() {
        // Argent
        if (this._lastMoney !== Math.floor(this.money)) {
            this._lastMoney = Math.floor(this.money);
            if (this.domElements.money) this.domElements.money.textContent = `$ ${this._lastMoney}`;
        }
        // Total molecules
        if (this._lastTotalProduced !== Math.floor(this.totalProduced)) {
            this._lastTotalProduced = Math.floor(this.totalProduced);
            if (this.domElements.totalMolecules) this.domElements.totalMolecules.textContent = this._lastTotalProduced;
        }
        // Mirror mode (seulement quand ça change)
        if (this._lastMirrorMode !== this.mirrorMode) {
            this._lastMirrorMode = this.mirrorMode;
            if (this.domElements.statLine) this.domElements.statLine.classList.toggle('ch1-mirror', this.mirrorMode);
        }

        // Progress
        if (this._lastMoleculesForMed !== this.moleculesForMed) {
            this._lastMoleculesForMed = this.moleculesForMed;
            if (this.domElements.medProgress) this.domElements.medProgress.textContent = this.moleculesForMed;
        }
        // Threshold
        if (this._lastMoleculeThreshold !== this.moleculeThreshold) {
            this._lastMoleculeThreshold = this.moleculeThreshold;
            if (this.domElements.medThreshold) this.domElements.medThreshold.textContent = this.moleculeThreshold;
        }
        // Count
        if (this._lastMedCount !== this.medications.length) {
            this._lastMedCount = this.medications.length;
            if (this.domElements.medCount) this.domElements.medCount.textContent = this.medications.length;
        }

        this.updatePillsDisplay();
        this.updateBeakerDisplay();
        this.updateUpgradesDisplay();
    }

    updatePillsDisplay() {
        const container = this.domElements.pillsContainer;
        if (!container) return;
        const targetCount = Math.min(this.medications.length, 18);

        // Ajuster le nombre de pilules DOM seulement si nécessaire
        if (this.pillElements.length !== targetCount) {
            while (this.pillElements.length < targetCount) {
                const pill = document.createElement('div');
                pill.className = 'ch1-pill';
                pill.innerHTML = '<div class="ch1-pill-left"></div><div class="ch1-pill-right"></div>';
                container.appendChild(pill);
                this.pillElements.push(pill);
            }
            while (this.pillElements.length > targetCount) {
                this.pillElements.pop().remove();
            }
        }

        // Mise à jour de l'opacité
        const hasImmortality = this.upgrades[4] && this.upgrades[4].level > 0;
        const fullOpacity = this.mirrorMode || hasImmortality;
        for (let i = 0; i < this.pillElements.length; i++) {
            const med = this.medications[i];
            if (med) {
                const opacity = fullOpacity ? 1.0 : Math.max(0.2, med.life / this.medicationDuration);
                this.pillElements[i].style.opacity = opacity;
            }
        }
    }

    updateBeakerDisplay() {
        if (!this.domElements.beakerFill) return;
        const fillPercent = (this.moleculesForMed / this.moleculeThreshold) * 100;
        this.domElements.beakerFill.style.height = `${Math.min(fillPercent, 100)}%`;
        this.updateBeakerMolecules(fillPercent);
    }

    updateBeakerMolecules(fillPercent) {
        if (!this.domElements.beakerMolecules) return;
        const targetMolecules = Math.floor(fillPercent / 20);
        if (targetMolecules === this.beakerMoleculeElements.length) return;
        while (this.beakerMoleculeElements.length < targetMolecules) {
            const molecule = document.createElement('div');
            molecule.className = 'ch1-beaker-molecule';
            molecule.style.cssText = `left:${10 + Math.random() * 60}%;bottom:${5 + Math.random() * (fillPercent * 0.6)}%;animation-delay:${Math.random() * 2}s`;
            this.domElements.beakerMolecules.appendChild(molecule);
            this.beakerMoleculeElements.push(molecule);
        }
        while (this.beakerMoleculeElements.length > targetMolecules) {
            this.beakerMoleculeElements.pop().remove();
        }
    }

    updateUpgradesDisplay() {
        // Ne recalculer que si l'argent ou un upgrade a changé
        const moneyFloor = Math.floor(this.money);
        if (!this._upgradesDirty && this._lastMoneyForUpgrades === moneyFloor) return;
        this._lastMoneyForUpgrades = moneyFloor;
        this._upgradesDirty = false;

        for (let index = 0; index < this.upgrades.length; index++) {
            const upgrade = this.upgrades[index];
            const dom = this.domElements.upgrades[index];
            if (!dom || !dom.element) continue;

            if (upgrade.hidden) {
                dom.element.style.display = 'none';
                continue;
            } else {
                dom.element.style.display = 'block';
            }

            const isMaxed = upgrade.level >= upgrade.maxLevel;
            const canBuy = moneyFloor >= upgrade.cost && !isMaxed;

            dom.element.classList.toggle('ch1-can-buy', canBuy);
            dom.element.classList.toggle('ch1-maxed', isMaxed);
            if (dom.level) dom.level.textContent = `Niveau: ${upgrade.level}/${upgrade.maxLevel}`;
            if (dom.cost) dom.cost.textContent = isMaxed ? 'MAX' : `$${upgrade.cost}`;
        }
    }

    // --- DRAW ---
    draw(ctx) {
        const w = this.game.canvas.width;
        const h = this.game.canvas.height;
        if (this.labBackgroundImage.complete) ctx.drawImage(this.labBackgroundImage, 0, 0, w, h);
        else { ctx.fillStyle = '#111111'; ctx.fillRect(0, 0, w, h); }

        this.drawBacteria(ctx, w, h);
        this.drawParticles(ctx);
    }

    drawBacteria(ctx, w, h) {
        ctx.save();
        ctx.translate(w / 2 + 50, h / 2 + 70);
        if (this.petriDishImage.complete) ctx.drawImage(this.petriDishImage, -250, -250, 500, 500);
        
        const image = this.bacterieImages[this.bacteriaLevel - 1];
        if (image && image.complete) {
            ctx.translate(this.bacteriaXOffset, this.bacteriaYOffset);
            const scale = 0.6;
            ctx.scale(scale, scale);
            ctx.drawImage(image, -image.naturalWidth / 2, -image.naturalHeight / 2);
        }
        ctx.restore();
    }

    drawParticles(ctx) {
        const len = this.particles.length;
        if (len === 0) return;
        ctx.save();
        ctx.textAlign = 'center';
        ctx.font = 'bold 20px Arial';
        for (let i = 0; i < len; i++) {
            const p = this.particles[i];
            ctx.globalAlpha = p.life;
            if (p.image && p.image.complete) {
                const size = 64 * (p.scale || 1.0);
                ctx.drawImage(p.image, p.x - size / 2, p.y - size / 2, size, size);
            } else if (p.text) {
                ctx.fillStyle = p.color;
                ctx.fillText(p.text, p.x, p.y);
            }
        }
        ctx.restore();
    }

    // --- SYSTEME DE TUTORIEL DYNAMIQUE ---

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
        if (this.tutorialElements.nextBtn) {
            this.tutorialElements.nextBtn.textContent = stepIndex === this.tutorialSteps.length - 1 ? 'COMMENCER' : 'SUIVANT';
        }

        const highlight = this.tutorialElements.highlight;
        const bubble = this.tutorialElements.bubble;
        const arrow = this.tutorialElements.arrow;
        let targetRect = null;

        if (step.target === 'canvas-center') {
            const { width, height } = this.game.getCanvasSize();
            const centerX = width / 2 + 50 + this.bacteriaXOffset;
            const centerY = height / 2 + 70 + this.bacteriaYOffset;
            const image = this.bacterieImages[this.bacteriaLevel - 1];
            let size = 140; 
            if (image && image.complete) {
                const scale = 0.6;
                size = image.naturalWidth * scale;
            }
            targetRect = { top: centerY - size/2, left: centerX - size/2, width: size, height: size };
            highlight.style.borderRadius = '50%';
        } else if (step.target) {
            const el = document.querySelector(step.target);
            if (el) {
                targetRect = el.getBoundingClientRect();
                highlight.style.borderRadius = '12px';
            }
        }

        if (targetRect) {
            highlight.style.display = 'block';
            const padding = 10;
            highlight.style.top = `${targetRect.top - padding}px`;
            highlight.style.left = `${targetRect.left - padding}px`;
            highlight.style.width = `${targetRect.width + (padding * 2)}px`;
            highlight.style.height = `${targetRect.height + (padding * 2)}px`;
        } else {
            highlight.style.display = 'none';
        }

        bubble.className = 'ch1-tutorial-bubble'; 
        arrow.style = '';
        bubble.style.transform = 'none';

        if (!targetRect || step.placement === 'center') {
            bubble.style.top = '50%';
            bubble.style.left = '50%';
            bubble.style.transform = 'translate(-50%, -50%)';
            arrow.style.display = 'none';
        } else {
            const gap = 25;
            if (step.placement === 'right') {
                let topPos = targetRect.top;
                if (topPos + 200 > window.innerHeight) topPos = window.innerHeight - 220;
                bubble.style.left = `${targetRect.left + targetRect.width + gap}px`;
                bubble.style.top = `${topPos}px`;
                arrow.style.left = '-6px'; arrow.style.top = '20px'; arrow.style.transform = 'rotate(45deg)';
            } else if (step.placement === 'bottom') {
                bubble.style.left = `${targetRect.left + (targetRect.width / 2) - 150}px`;
                bubble.style.top = `${targetRect.top + targetRect.height + gap}px`;
                arrow.style.top = '-6px'; arrow.style.left = '50%'; arrow.style.transform = 'translate(-50%, 0) rotate(135deg)';
            }
            
            if (parseInt(bubble.style.left) + 300 > window.innerWidth) {
                 bubble.style.left = 'auto'; bubble.style.right = '10px';
            }
        }

        if (this.tutorialElements.overlay) this.tutorialElements.overlay.classList.add('active');
        setTimeout(() => { bubble.classList.add('visible'); }, 50);
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
        setTimeout(() => { this.endTutorial(); }, 300);
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