/**
 * CHAPITRE 3 : LA GRANDE MUTATION
 *
 * Contexte : L'ecosysteme mondial est remplace par la vie miroir.
 * Mecanique : Clicker / Gestion de territoire sur grille.
 *
 * Concept scientifique : Competition ecologique.
 * Les bacteries miroirs n'ont pas de predateurs naturels car aucun
 * organisme terrestre ne peut les consommer (chiralite incompatible).
 * Elles se propagent de facon exponentielle, etouffant toute vie normale.
 */

export class Chapter3 {
    constructor(game) {
        this.game = game;
        this.colors = game.getColors();

        // Etat du chapitre
        this.phase = 'intro'; // intro, playing, lost, complete

        // Grille de territoire
        this.gridWidth = 20;
        this.gridHeight = 12;
        this.cellSize = 0;
        this.gridOffsetX = 0;
        this.gridOffsetY = 0;

        // Etats des cellules : 'empty', 'normal', 'mirror', 'contested'
        this.grid = [];

        // Stats
        this.normalPercent = 0;
        this.mirrorPercent = 0;
        this.plantActions = 10; // Actions de plantation disponibles
        this.maxPlantActions = 10;
        this.actionRegenTime = 0;
        this.actionRegenRate = 3; // Secondes pour regagner une action

        // Timing
        this.gameTime = 0;
        this.spreadTimer = 0;
        this.spreadInterval = 0.5; // Secondes entre chaque propagation

        // Animation
        this.pulseTime = 0;

        this.init();
    }

    init() {
        this.calculateGridDimensions();
        this.initializeGrid();

        this.game.setInstructions('SURVEILLANCE GLOBALE');

        this.game.showDialogue([
            "Rapport de situation mondiale - An 2030",
            "La contamination a depasse le stade de confinement.",
            "Les bacteries miroirs se propagent dans tous les ecosystemes.",
            "Aucun predateur, aucune maladie ne peut les arreter.",
            "// Leur chiralite inversee les rend indigestibles.",
            "Cliquez pour planter des zones de vie normale...",
            "...mais je crains que ce soit deja trop tard."
        ], () => {
            this.phase = 'playing';
        });
    }

    calculateGridDimensions() {
        const { width, height } = this.game.getCanvasSize();

        // Calculer la taille des cellules pour remplir l'ecran
        const maxCellWidth = (width - 100) / this.gridWidth;
        const maxCellHeight = (height - 150) / this.gridHeight;
        this.cellSize = Math.floor(Math.min(maxCellWidth, maxCellHeight));

        // Centrer la grille
        this.gridOffsetX = (width - this.cellSize * this.gridWidth) / 2;
        this.gridOffsetY = (height - this.cellSize * this.gridHeight) / 2 + 20;
    }

    initializeGrid() {
        this.grid = [];

        for (let y = 0; y < this.gridHeight; y++) {
            const row = [];
            for (let x = 0; x < this.gridWidth; x++) {
                row.push({
                    state: 'empty',
                    transitionProgress: 0,
                    contested: false
                });
            }
            this.grid.push(row);
        }

        // Placer des zones normales initiales (vie terrestre)
        const normalSeeds = [
            { x: 3, y: 3 }, { x: 5, y: 8 }, { x: 10, y: 5 },
            { x: 15, y: 2 }, { x: 17, y: 9 }, { x: 8, y: 10 }
        ];

        for (const seed of normalSeeds) {
            if (this.isValidCell(seed.x, seed.y)) {
                this.grid[seed.y][seed.x].state = 'normal';
                // Etendre considérablement autour
                this.spreadNormal(seed.x, seed.y, 4);
            }
        }

        // Placer les premiers foyers de vie miroir
        const mirrorSeeds = [
            { x: 0, y: 0 }, { x: 19, y: 11 }
        ];

        for (const seed of mirrorSeeds) {
            if (this.isValidCell(seed.x, seed.y)) {
                this.grid[seed.y][seed.x].state = 'mirror';
            }
        }

        this.updatePercentages();
    }

    spreadNormal(cx, cy, radius) {
        for (let dy = -radius; dy <= radius; dy++) {
            for (let dx = -radius; dx <= radius; dx++) {
                const x = cx + dx;
                const y = cy + dy;
                if (this.isValidCell(x, y) && Math.abs(dx) + Math.abs(dy) <= radius) {
                    if (this.grid[y][x].state === 'empty') {
                        this.grid[y][x].state = 'normal';
                    }
                }
            }
        }
    }

    isValidCell(x, y) {
        return x >= 0 && x < this.gridWidth && y >= 0 && y < this.gridHeight;
    }

    update(deltaTime, timestamp) {
        if (this.phase === 'intro') return;

        this.pulseTime += deltaTime * 2;
        this.gameTime += deltaTime;

        if (this.phase === 'playing') {
            // Regeneration des actions
            this.actionRegenTime += deltaTime;
            if (this.actionRegenTime >= this.actionRegenRate && this.plantActions < this.maxPlantActions) {
                this.plantActions++;
                this.actionRegenTime = 0;
            }

            // Propagation de la vie miroir (croissance exponentielle)
            this.spreadTimer += deltaTime;

            // La vitesse de propagation augmente avec le temps
            const currentInterval = this.spreadInterval / (1 + this.gameTime * 0.05);

            if (this.spreadTimer >= currentInterval) {
                this.spreadMirrorLife();
                this.spreadTimer = 0;
            }

            // Gestion des clics
            const mouse = this.game.getMouse();
            if (mouse.clicked) {
                this.handleClick(mouse.x, mouse.y);
            }

            // Verifier la condition de fin
            this.updatePercentages();
            if (this.mirrorPercent >= 90) {
                this.phase = 'lost';
                this.game.showDialogue([
                    "C'est termine.",
                    "La vie miroir a remplace 90% de la biomasse terrestre.",
                    "// Les chaines alimentaires se sont effondrees.",
                    "// Rien ne peut manger ces organismes.",
                    "L'extinction de masse est inevitable."
                ], () => {
                    this.phase = 'complete';
                    this.game.chapterComplete(
                        "Biomasse terrestre : 12%. Remplacement irreversible."
                    );
                });
            }
        }
    }

    spreadMirrorLife() {
        // Trouver toutes les cellules miroir actuelles
        const mirrorCells = [];
        for (let y = 0; y < this.gridHeight; y++) {
            for (let x = 0; x < this.gridWidth; x++) {
                if (this.grid[y][x].state === 'mirror') {
                    mirrorCells.push({ x, y });
                }
            }
        }

        // Propager vers les cellules adjacentes
        const directions = [
            { dx: -1, dy: 0 }, { dx: 1, dy: 0 },
            { dx: 0, dy: -1 }, { dx: 0, dy: 1 }
        ];

        for (const cell of mirrorCells) {
            // Chance de propagation proportionnelle au nombre de cellules miroir
            // Cela cree une croissance exponentielle
            const spreadChance = 0.3 + (this.mirrorPercent / 100) * 0.5;

            for (const dir of directions) {
                if (Math.random() < spreadChance) {
                    const nx = cell.x + dir.dx;
                    const ny = cell.y + dir.dy;

                    if (this.isValidCell(nx, ny)) {
                        const targetCell = this.grid[ny][nx];

                        if (targetCell.state === 'empty') {
                            // Colonisation immediate des zones vides
                            targetCell.state = 'mirror';
                        } else if (targetCell.state === 'normal') {
                            // Competition avec la vie normale
                            // La vie miroir gagne toujours car elle n'a pas de predateurs
                            targetCell.state = 'mirror';
                            targetCell.transitionProgress = 0;
                        }
                    }
                }
            }
        }
    }

    handleClick(mouseX, mouseY) {
        // Convertir en coordonnees de grille
        const gridX = Math.floor((mouseX - this.gridOffsetX) / this.cellSize);
        const gridY = Math.floor((mouseY - this.gridOffsetY) / this.cellSize);

        if (!this.isValidCell(gridX, gridY)) return;
        if (this.plantActions <= 0) return;

        const cell = this.grid[gridY][gridX];

        // On peut planter sur les cellules vides ou miroir
        if (cell.state !== 'normal') {
            // Planter de la vie normale
            cell.state = 'normal';
            cell.transitionProgress = 1;
            this.plantActions--;

            // Petit effet de propagation
            const directions = [
                { dx: -1, dy: 0 }, { dx: 1, dy: 0 },
                { dx: 0, dy: -1 }, { dx: 0, dy: 1 }
            ];

            for (const dir of directions) {
                const nx = gridX + dir.dx;
                const ny = gridY + dir.dy;
                if (this.isValidCell(nx, ny) && Math.random() < 0.3) {
                    if (this.grid[ny][nx].state === 'empty') {
                        this.grid[ny][nx].state = 'normal';
                    }
                }
            }
        }
    }

    updatePercentages() {
        let normalCount = 0;
        let mirrorCount = 0;
        const total = this.gridWidth * this.gridHeight;

        for (let y = 0; y < this.gridHeight; y++) {
            for (let x = 0; x < this.gridWidth; x++) {
                if (this.grid[y][x].state === 'normal') normalCount++;
                else if (this.grid[y][x].state === 'mirror') mirrorCount++;
            }
        }

        this.normalPercent = (normalCount / total) * 100;
        this.mirrorPercent = (mirrorCount / total) * 100;
    }

    draw(ctx) {
        const { width, height } = this.game.getCanvasSize();

        // Dessiner la grille
        this.drawGrid(ctx);

        // Interface
        this.drawUI(ctx, width, height);
    }

    drawGrid(ctx) {
        for (let y = 0; y < this.gridHeight; y++) {
            for (let x = 0; x < this.gridWidth; x++) {
                const cell = this.grid[y][x];
                const px = this.gridOffsetX + x * this.cellSize;
                const py = this.gridOffsetY + y * this.cellSize;

                // Couleur selon l'etat
                let fillColor = '#1a1a1a'; // Vide
                let borderColor = '#333';

                if (cell.state === 'normal') {
                    fillColor = this.colors.LIFE_NORMAL + '88';
                    borderColor = this.colors.LIFE_NORMAL;
                } else if (cell.state === 'mirror') {
                    fillColor = this.colors.LIFE_MIRROR + '88';
                    borderColor = this.colors.LIFE_MIRROR;

                    // Effet de pulsation pour les cellules miroir
                    const pulse = Math.sin(this.pulseTime + x * 0.5 + y * 0.3) * 0.2 + 0.8;
                    ctx.globalAlpha = pulse;
                }

                // Remplir la cellule
                ctx.fillStyle = fillColor;
                ctx.fillRect(px + 1, py + 1, this.cellSize - 2, this.cellSize - 2);

                ctx.globalAlpha = 1;

                // Bordure
                ctx.strokeStyle = borderColor;
                ctx.lineWidth = 1;
                ctx.strokeRect(px + 1, py + 1, this.cellSize - 2, this.cellSize - 2);

                // Indicateur de propagation active pour les cellules miroir adjacentes a du normal
                if (cell.state === 'mirror') {
                    const hasNormalNeighbor = this.hasNeighborOfType(x, y, 'normal');
                    if (hasNormalNeighbor) {
                        ctx.fillStyle = this.colors.DANGER + '44';
                        ctx.fillRect(px + 1, py + 1, this.cellSize - 2, this.cellSize - 2);
                    }
                }
            }
        }
    }

    hasNeighborOfType(x, y, type) {
        const directions = [
            { dx: -1, dy: 0 }, { dx: 1, dy: 0 },
            { dx: 0, dy: -1 }, { dx: 0, dy: 1 }
        ];

        for (const dir of directions) {
            const nx = x + dir.dx;
            const ny = y + dir.dy;
            if (this.isValidCell(nx, ny) && this.grid[ny][nx].state === type) {
                return true;
            }
        }
        return false;
    }

    drawUI(ctx, width, height) {
        // Titre
        ctx.fillStyle = this.colors.UI_TEXT;
        ctx.font = 'bold 16px Courier New';
        ctx.textAlign = 'center';
        ctx.fillText('CARTE MONDIALE DE CONTAMINATION', width / 2, 30);

        // Statistiques
        ctx.font = '14px Courier New';
        ctx.textAlign = 'left';

        // Vie normale
        ctx.fillStyle = this.colors.LIFE_NORMAL;
        ctx.fillText(`Vie terrestre : ${this.normalPercent.toFixed(1)}%`, 20, 60);

        // Vie miroir
        ctx.fillStyle = this.colors.LIFE_MIRROR;
        ctx.fillText(`Vie miroir : ${this.mirrorPercent.toFixed(1)}%`, 20, 80);

        // Barre de progression
        const barWidth = 200;
        const barHeight = 20;
        const barX = 20;
        const barY = 90;

        ctx.fillStyle = '#333';
        ctx.fillRect(barX, barY, barWidth, barHeight);

        // Partie normale (verte)
        ctx.fillStyle = this.colors.LIFE_NORMAL;
        ctx.fillRect(barX, barY, barWidth * (this.normalPercent / 100), barHeight);

        // Partie miroir (violette) - depuis la droite
        ctx.fillStyle = this.colors.LIFE_MIRROR;
        ctx.fillRect(barX + barWidth * (1 - this.mirrorPercent / 100), barY,
                     barWidth * (this.mirrorPercent / 100), barHeight);

        ctx.strokeStyle = this.colors.UI_TEXT;
        ctx.strokeRect(barX, barY, barWidth, barHeight);

        // Actions disponibles
        ctx.textAlign = 'right';
        ctx.fillStyle = this.colors.LIFE_NORMAL;
        ctx.fillText(`Actions de plantation : ${this.plantActions}/${this.maxPlantActions}`, width - 20, 60);

        // Barre de regeneration
        if (this.plantActions < this.maxPlantActions) {
            ctx.fillStyle = '#333';
            ctx.fillRect(width - 170, 70, 150, 10);
            ctx.fillStyle = this.colors.LIFE_NORMAL + '88';
            ctx.fillRect(width - 170, 70, 150 * (this.actionRegenTime / this.actionRegenRate), 10);
            ctx.strokeStyle = this.colors.UI_DIM;
            ctx.strokeRect(width - 170, 70, 150, 10);
        }

        // Instructions
        ctx.textAlign = 'center';
        ctx.fillStyle = this.colors.UI_DIM;
        ctx.font = '12px Courier New';
        ctx.fillText('Cliquez pour planter de la vie normale', width / 2, height - 30);
        ctx.fillText('// La vie miroir se propage sans predateurs...', width / 2, height - 15);

        // Alerte si critique
        if (this.mirrorPercent > 70) {
            ctx.fillStyle = this.colors.DANGER;
            ctx.font = 'bold 14px Courier New';
            const blink = Math.sin(this.pulseTime * 5) > 0;
            if (blink) {
                ctx.fillText('ALERTE : POINT DE NON-RETOUR IMMINENT', width / 2, height - 50);
            }
        }
    }
}
