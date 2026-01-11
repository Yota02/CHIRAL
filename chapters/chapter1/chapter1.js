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

        // Configuration
        this.decayRate = 2.0;
        this.moleculeTimer = 0;
        this.moleculeRate = 1.0;
        this.medicationDuration = 10.0;
        this.moleculeThreshold = 10;

        // Seuils & Objectifs
        this.EVENT_THRESHOLD = 10;  // Changé de 15000 à 20000 pour correspondre à la demande et au tutoriel

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
            beakerMolecules: null, flyingMeds: null
        };
        this.pillElements = [];
        this.beakerMoleculeElements = [];

        // Tracking
        this._lastMoney = -1;
        this._lastTotalProduced = -1;
        this._lastMoleculesForMed = -1;
        this._lastMedCount = -1;
        this._lastMoleculeThreshold = -1;

        // --- SYSTEME DE TUTORIEL CONFIGURATION ---
        this.tutorialActive = false;
        this.tutorialStep = 0;
        this.tutorialSteps = [
            {
                title: "Chapitre 1 : La Synthèse",
                content: "Bienvenue dans le laboratoire. Vous allez créer la première <em>bactérie miroir</em>, un organisme à <strong>chiralité inversée</strong>.",
                target: null, // Pas de cible, centré
                placement: 'center'
            },
            {
                title: "La Bactérie",
                content: "Cliquez sur la <strong>bactérie</strong> au centre pour produire des molécules manuellement.",
                target: 'canvas-center', // Cible spéciale calculée dynamiquement
                placement: 'bottom'
            },
            {
                title: "Les Médicaments",
                content: "Toutes les <strong>10 molécules</strong>, un médicament est créé ici. Il génère de l'<strong>argent</strong> tant qu'il est actif.",
                target: '#ch1-medications-panel', // Cible l'ID HTML réel
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
                content: "Produisez <strong>20 000 molécules</strong> pour déclencher la révolution chirale.",
                target: '#ch1-total-molecules', // Cible le texte du score
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
        if (!document.getElementById('chapter1-css')) {
            const link = document.createElement('link');
            link.id = 'chapter1-css';
            link.rel = 'stylesheet';
            link.href = './chapters/chapter1/chapter1.css';
            document.head.appendChild(link);
            await new Promise(resolve => { link.onload = resolve; link.onerror = resolve; });
        }

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

    // --- MISE A JOUR DOM ---
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
        // Mirror mode
        if (this.domElements.statLine) this.domElements.statLine.classList.toggle('ch1-mirror', this.mirrorMode);
        
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

        while (this.pillElements.length < targetCount) {
            const pill = document.createElement('div');
            pill.className = 'ch1-pill';
            pill.innerHTML = `<div class="ch1-pill-left"></div><div class="ch1-pill-right"></div>`;
            container.appendChild(pill);
            this.pillElements.push(pill);
        }
        while (this.pillElements.length > targetCount) {
            this.pillElements.pop().remove();
        }

        const hasImmortality = this.upgrades[4] && this.upgrades[4].level > 0;
        this.pillElements.forEach((pill, index) => {
            if (this.medications[index]) {
                if (this.mirrorMode || hasImmortality) pill.style.opacity = 1.0;
                else pill.style.opacity = Math.max(0.2, this.medications[index].life / this.medicationDuration);
            }
        });
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
        while (this.beakerMoleculeElements.length < targetMolecules) {
            const molecule = document.createElement('div');
            molecule.className = 'ch1-beaker-molecule';
            molecule.style.left = `${10 + Math.random() * 60}%`;
            molecule.style.bottom = `${5 + Math.random() * (fillPercent * 0.6)}%`;
            molecule.style.animationDelay = `${Math.random() * 2}s`;
            this.domElements.beakerMolecules.appendChild(molecule);
            this.beakerMoleculeElements.push(molecule);
        }
        while (this.beakerMoleculeElements.length > targetMolecules) {
            this.beakerMoleculeElements.pop().remove();
        }
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
        
        const beakerRect = this.domElements.beaker.getBoundingClientRect();
        const pillsRect = this.domElements.pillsContainer.getBoundingClientRect();
        
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

    updateUpgradesDisplay() {
        this.upgrades.forEach((upgrade, index) => {
            const dom = this.domElements.upgrades[index];
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
            if (dom.level) dom.level.textContent = `Niveau: ${upgrade.level}/${upgrade.maxLevel}`;
            if (dom.cost) dom.cost.textContent = isMaxed ? 'MAX' : `$${upgrade.cost}`;
        });
    }

    // --- UPDATE LOOP ---
    update(deltaTime) {
        const { width, height } = this.game.getCanvasSize();

        // Reveal hidden upgrade
        if (this.totalProduced >= 10000 && this.upgrades[4].hidden) {
            this.upgrades[4].hidden = false;
        }

        // Auto generation
        this.moleculeTimer += deltaTime;
        if (this.moleculeTimer >= 1.0 / this.moleculeRate) {
            this.moleculeTimer = 0;
            this.molecules += 1;
            this.totalProduced += 1;
            this.moleculesForMed += 1;

            const centerX = width / 2 + 50;
            const centerY = height / 2 + 70;
            const angle = Math.random() * Math.PI * 2;
            const radius = Math.random() * 140;
            this.spawnParticle(centerX + Math.cos(angle) * radius, centerY + Math.sin(angle) * radius, "", this.mirrorMode ? this.colors.LIFE_MIRROR : this.colors.LIFE_NORMAL, false, this.moleculeImage);
            
            this.checkMedicationCreation();
            if (!this.mirrorMode && this.totalProduced >= this.EVENT_THRESHOLD) {
                this.triggerJournalDisplay();  // Remplacé par triggerJournalDisplay au lieu de triggerMirrorRevolution
            }
        }

        // Click Input
        const mouse = this.game.getMouse();
        if (mouse.clicked) {
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

        // Animation de la bactérie : flottement subtil
        const time = this.game.getTime ? this.game.getTime() : performance.now() / 1000;
        this.bacteriaXOffset = Math.sin(time * 1.5) * 6; // Oscillation horizontale légère (augmentée)
        this.bacteriaYOffset = Math.cos(time * 1.2) * 4; // Oscillation verticale légère (augmentée)

        // Logic
        this.updateParticles(deltaTime);
        const hasImmortality = this.upgrades[4].level > 0;
        for (let i = this.medications.length - 1; i >= 0; i--) {
            let med = this.medications[i];
            this.money += deltaTime;
            if (!this.mirrorMode && !hasImmortality) {
                med.life -= deltaTime;
                if (med.life <= 0) this.medications.splice(i, 1);
            }
        }

        this.updateDOM();
    }

    checkMedicationCreation() {
        while (this.moleculesForMed >= this.moleculeThreshold && this.molecules >= this.moleculeThreshold) {
            this.moleculesForMed -= this.moleculeThreshold;
            this.molecules -= this.moleculeThreshold;
            this.spawnMedication();
            const { width, height } = this.game.getCanvasSize();
            this.spawnParticle(80, height - 200, `-${this.moleculeThreshold}`, "#ff4444");
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

    // Nouvelle méthode pour afficher le journal
    async triggerJournalDisplay() {
        this.mirrorMode = false;  // Pas d'activation du mode miroir ici
        // Pas d'ajout de molécules bonus

        // Créer l'overlay pour le journal
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
        overlay.style.opacity = '0';  // Démarrer invisible
        overlay.style.transition = 'opacity 1s ease';  // Transition fluide

        // Charger et afficher le contenu du journal
        try {
            const response = await fetch('./chapters/chapter1/assets/journal.md');
            const journalContent = await response.text();
            overlay.innerText = journalContent;  // Affichage brut du Markdown (ASCII art)
        } catch (error) {
            overlay.innerText = 'Erreur lors du chargement du journal.';
            console.error('Erreur chargement journal:', error);
        }

        // Ajouter le bouton flèche en bas
        const buttonContainer = document.createElement('div');
        buttonContainer.style.position = 'absolute';
        buttonContainer.style.bottom = '20px';
        buttonContainer.style.right = '20px';  // Positionner à droite au lieu de centré
        buttonContainer.style.textAlign = 'right';  // Alignement à droite

        const arrowButton = document.createElement('button');
        arrowButton.innerHTML = '→';  // Flèche simple
        arrowButton.style.fontSize = '64px';  // Agrandir la flèche (de 48px à 64px)
        arrowButton.style.background = 'none';
        arrowButton.style.border = 'none';
        arrowButton.style.color = '#00ff00';
        arrowButton.style.cursor = 'pointer';
        arrowButton.style.padding = '10px';
        arrowButton.addEventListener('click', () => {
            overlay.remove(); 
            console.log('Journal fermé, démarrage du chapitre 2');
            this.game.startChapter(1); 
        });

        buttonContainer.appendChild(arrowButton);
        overlay.appendChild(buttonContainer);

        // Ajouter à la page et animer l'apparition
        document.body.appendChild(overlay);
        // Petit délai pour permettre au DOM de se mettre à jour avant l'animation
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
        for (let i = this.particles.length - 1; i >= 0; i--) {
            let p = this.particles[i];
            p.life -= dt;
            p.x += p.vx * dt;
            p.y += p.vy * dt;
            if (p.life <= 0) this.particles.splice(i, 1);
        }
    }

    dist(x1, y1, x2, y2) { return Math.sqrt((x2 - x1) ** 2 + (y2 - y1) ** 2); }

    // --- DRAW ---
    draw(ctx) {
        const { width, height } = this.game.getCanvasSize();
        if (this.labBackgroundImage.complete) ctx.drawImage(this.labBackgroundImage, 0, 0, width, height);
        else { ctx.fillStyle = '#111111'; ctx.fillRect(0, 0, width, height); }

        this.drawBacteria(ctx, width, height);
        this.drawParticles(ctx);
    }

    drawBacteria(ctx, w, h) {
        ctx.save();
        ctx.translate(w / 2 + 50, h / 2 + 70);  // Position fixe pour la boîte de Petri
        if (this.petriDishImage.complete) ctx.drawImage(this.petriDishImage, -250, -250, 500, 500);
        
        const image = this.bacterieImages[this.bacteriaLevel - 1];
        if (image && image.complete) {
            ctx.translate(this.bacteriaXOffset, this.bacteriaYOffset);  // Offset uniquement pour la bactérie
            const scale = 0.6;
            ctx.scale(scale, scale);
            ctx.drawImage(image, -image.naturalWidth / 2, -image.naturalHeight / 2);
        }
        ctx.restore();
    }

    drawParticles(ctx) {
        ctx.textAlign = 'center';
        ctx.font = 'bold 20px Arial';
        for (let p of this.particles) {
            ctx.globalAlpha = p.life;
            if (p.image && p.image.complete) {
                const size = 64 * (p.scale || 1.0);
                ctx.drawImage(p.image, p.x - size / 2, p.y - size / 2, size, size);
            } else {
                ctx.fillStyle = p.color;
                ctx.fillText(p.text, p.x, p.y);
            }
        }
        ctx.globalAlpha = 1.0;
    }

    // --- SYSTEME DE TUTORIEL DYNAMIQUE (LA CORRECTION) ---

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
        
        // 1. Textes
        if (this.tutorialElements.title) this.tutorialElements.title.textContent = step.title;
        if (this.tutorialElements.content) this.tutorialElements.content.innerHTML = step.content;
        if (this.tutorialElements.nextBtn) {
            this.tutorialElements.nextBtn.textContent = stepIndex === this.tutorialSteps.length - 1 ? 'COMMENCER' : 'SUIVANT';
        }

        // 2. Positionnement Dynamique (getBoundingClientRect)
        const highlight = this.tutorialElements.highlight;
        const bubble = this.tutorialElements.bubble;
        const arrow = this.tutorialElements.arrow;
        let targetRect = null;

        if (step.target === 'canvas-center') {
            const { width, height } = this.game.getCanvasSize();
            const centerX = width / 2 + 50 + this.bacteriaXOffset;
            const centerY = height / 2 + 70 + this.bacteriaYOffset;
            const image = this.bacterieImages[this.bacteriaLevel - 1];
            let size = 140; // Valeur par défaut si image non chargée
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

        // 3. Bulle
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
            
            // Sécurité mobile
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