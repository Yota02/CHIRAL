/**
 * CHAPITRE 2 : L'INVISIBLE (Version autonome)
 *
 * Adaptation du chapitre original pour HTML/CSS/JS standalone.
 * Mécanique : Tir Point & Click avec laser UV.
 */

const COLORS = {
    BG_DARK: '#111111',
    LIFE_NORMAL: '#44ff88',
    LIFE_MIRROR: '#b944ff',
    UI_TEXT: '#eeeeee',
    UI_DIM: '#666666',
    DANGER: '#ff4444',
    CYAN: '#44ffff'
};

export class Chapter2 {
    constructor() {
        this.canvas = document.getElementById('game-canvas');
        this.ctx = this.canvas.getContext('2d');
        this.uiOverlay = document.getElementById('ui-overlay');
        this.instructions = document.getElementById('instructions');
        this.normalCounter = document.getElementById('normal-counter');
        this.mirrorCounter = document.getElementById('mirror-counter');
        this.barFill = document.getElementById('bar-fill');
        this.percentage = document.getElementById('percentage');
        this.warning = document.getElementById('warning');

        // État du chapitre
        this.phase = 'playing'; // Toujours en mode playing pour standalone
        this.organisms = [];
        this.maxOrganisms = 50;
        this.normalKilled = 0;
        this.mirrorAttempts = 0;
        this.saturationLevel = 0;
        this.gameTime = 0;
        this.gameDuration = 30;
        this.laserEffect = null;
        this.viewRadius = 0;

        // Inputs
        this.mouse = { x: 0, y: 0, down: false, clicked: false };
        this.keys = {};

        // Timing
        this.lastTime = 0;
        this.deltaTime = 0;

        this.init();
    }

    init() {
        this.resizeCanvas();
        this.setupEventListeners();
        this.spawnInitialOrganisms();
        this.gameLoop(0);
    }

    resizeCanvas() {
        this.canvas.width = window.innerWidth;
        this.canvas.height = window.innerHeight;
        this.viewRadius = Math.min(this.canvas.width, this.canvas.height) * 0.4;
    }

    setupEventListeners() {
        window.addEventListener('resize', () => this.resizeCanvas());

        // Souris
        this.canvas.addEventListener('mousemove', (e) => {
            const rect = this.canvas.getBoundingClientRect();
            this.mouse.x = e.clientX - rect.left;
            this.mouse.y = e.clientY - rect.top;
        });

        this.canvas.addEventListener('mousedown', (e) => {
            this.mouse.down = true;
            this.mouse.clicked = true;
        });

        this.canvas.addEventListener('mouseup', () => {
            this.mouse.down = false;
        });

        // Clavier
        window.addEventListener('keydown', (e) => {
            this.keys[e.code] = true;
        });

        window.addEventListener('keyup', (e) => {
            this.keys[e.code] = false;
        });
    }

    spawnInitialOrganisms() {
        for (let i = 0; i < 8; i++) {
            this.spawnOrganism('normal');
        }
        for (let i = 0; i < 3; i++) {
            this.spawnOrganism('mirror');
        }
    }

    spawnOrganism(type) {
        const centerX = this.canvas.width / 2;
        const centerY = this.canvas.height / 2;
        const angle = Math.random() * Math.PI * 2;
        const distance = Math.random() * (this.viewRadius - 30);

        const organism = {
            type: type,
            x: centerX + Math.cos(angle) * distance,
            y: centerY + Math.sin(angle) * distance,
            radius: type === 'normal' ? 8 + Math.random() * 5 : 10 + Math.random() * 8,
            vx: (Math.random() - 0.5) * 30,
            vy: (Math.random() - 0.5) * 30,
            color: type === 'normal' ? COLORS.LIFE_NORMAL : COLORS.LIFE_MIRROR,
            alive: true,
            pulsePhase: Math.random() * Math.PI * 2,
            flagella: Math.random() * Math.PI * 2
        };

        this.organisms.push(organism);
    }

    update(deltaTime, timestamp) {
        this.gameTime += deltaTime;
        this.updateOrganisms(deltaTime);

        if (this.mouse.clicked) {
            this.handleShoot(this.mouse.x, this.mouse.y);
        }

        // Spawn progressif
        const spawnRate = 0.5 + (this.gameTime / this.gameDuration) * 2;
        if (Math.random() < spawnRate * deltaTime) {
            this.spawnOrganism('mirror');
        }
        if (Math.random() < 0.3 * deltaTime) {
            this.spawnOrganism('normal');
        }

        const mirrorCount = this.organisms.filter(o => o.type === 'mirror' && o.alive).length;
        this.saturationLevel = mirrorCount / this.maxOrganisms;

        if (this.saturationLevel >= 0.9 || this.gameTime >= this.gameDuration) {
            alert("ÉCHEC DU CONFINEMENT : Les organismes miroirs sont immunisés ! Rechargez la page pour recommencer.");
        }

        if (this.laserEffect) {
            this.laserEffect.time -= deltaTime;
            if (this.laserEffect.time <= 0) {
                this.laserEffect = null;
            }
        }

        this.updateUI();
    }

    updateOrganisms(deltaTime) {
        const centerX = this.canvas.width / 2;
        const centerY = this.canvas.height / 2;

        this.organisms = this.organisms.filter(o => o.alive);
        while (this.organisms.length > this.maxOrganisms) {
            const normalIndex = this.organisms.findIndex(o => o.type === 'normal');
            if (normalIndex >= 0) {
                this.organisms.splice(normalIndex, 1);
            } else {
                break;
            }
        }

        for (const org of this.organisms) {
            org.vx += (Math.random() - 0.5) * 50 * deltaTime;
            org.vy += (Math.random() - 0.5) * 50 * deltaTime;
            org.vx *= 0.98;
            org.vy *= 0.98;

            const speed = Math.sqrt(org.vx * org.vx + org.vy * org.vy);
            if (speed > 40) {
                org.vx = (org.vx / speed) * 40;
                org.vy = (org.vy / speed) * 40;
            }

            org.x += org.vx * deltaTime;
            org.y += org.vy * deltaTime;

            const dx = org.x - centerX;
            const dy = org.y - centerY;
            const dist = Math.sqrt(dx * dx + dy * dy);
            if (dist > this.viewRadius - org.radius) {
                const nx = dx / dist;
                const ny = dy / dist;
                org.x = centerX + nx * (this.viewRadius - org.radius);
                org.y = centerY + ny * (this.viewRadius - org.radius);
                org.vx = -org.vx * 0.5;
                org.vy = -org.vy * 0.5;
            }

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
                    org.alive = false;
                    this.normalKilled++;
                    this.laserEffect = { x: org.x, y: org.y, success: true, time: 0.3 };
                } else {
                    this.mirrorAttempts++;
                    this.laserEffect = { x: org.x, y: org.y, success: false, time: 0.5 };
                    if (this.mirrorAttempts === 1) {
                        alert("CIBLE INVALIDE : Le laser UV n'a aucun effet sur les organismes miroirs.");
                    }
                }
                hitSomething = true;
                break;
            }
        }
        if (!hitSomething) {
            this.laserEffect = { x: x, y: y, success: null, time: 0.2 };
        }
    }

    updateUI() {
        const normalCount = this.organisms.filter(o => o.type === 'normal' && o.alive).length;
        const mirrorCount = this.organisms.filter(o => o.type === 'mirror' && o.alive).length;

        if (this.normalCounter) this.normalCounter.textContent = `Bactéries normales: ${normalCount} | Éliminées: ${this.normalKilled}`;
        if (this.mirrorCounter) this.mirrorCounter.textContent = `Bactéries miroirs: ${mirrorCount} | Tirs échoués: ${this.mirrorAttempts}`;
        if (this.barFill) this.barFill.style.width = `${this.saturationLevel * 100}%`;
        if (this.percentage) this.percentage.textContent = `${Math.round(this.saturationLevel * 100)}%`;

        if (this.warning) {
            if (this.saturationLevel > 0.7) {
                this.warning.style.display = 'block';
            } else {
                this.warning.style.display = 'none';
            }
        }
    }

    draw() {
        const centerX = this.canvas.width / 2;
        const centerY = this.canvas.height / 2;

        this.ctx.fillStyle = COLORS.BG_DARK;
        this.ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);

        this.drawMicroscopeView(centerX, centerY);

        for (const org of this.organisms) {
            if (org.alive) {
                this.drawOrganism(org);
            }
        }

        if (this.laserEffect) {
            this.drawLaserEffect();
        }

        this.drawCrosshair();
    }

    drawMicroscopeView(centerX, centerY) {
        this.ctx.save();
        this.ctx.beginPath();
        this.ctx.arc(centerX, centerY, this.viewRadius, 0, Math.PI * 2);
        this.ctx.clip();
        this.ctx.fillStyle = '#0a1520';
        this.ctx.fillRect(centerX - this.viewRadius, centerY - this.viewRadius, this.viewRadius * 2, this.viewRadius * 2);

        this.ctx.fillStyle = 'rgba(100, 150, 200, 0.1)';
        for (let i = 0; i < 50; i++) {
            const x = centerX + Math.sin(i * 7.3 + this.gameTime * 0.1) * this.viewRadius * 0.8;
            const y = centerY + Math.cos(i * 11.7 + this.gameTime * 0.15) * this.viewRadius * 0.8;
            this.ctx.beginPath();
            this.ctx.arc(x, y, 1 + Math.sin(i) * 0.5, 0, Math.PI * 2);
            this.ctx.fill();
        }
        this.ctx.restore();

        this.ctx.strokeStyle = COLORS.CYAN;
        this.ctx.lineWidth = 3;
        this.ctx.beginPath();
        this.ctx.arc(centerX, centerY, this.viewRadius, 0, Math.PI * 2);
        this.ctx.stroke();

        this.ctx.strokeStyle = 'rgba(68, 255, 255, 0.3)';
        this.ctx.lineWidth = 1;
        for (let i = 0; i < 8; i++) {
            const angle = (i / 8) * Math.PI * 2;
            this.ctx.beginPath();
            this.ctx.moveTo(centerX + Math.cos(angle) * (this.viewRadius - 10), centerY + Math.sin(angle) * (this.viewRadius - 10));
            this.ctx.lineTo(centerX + Math.cos(angle) * this.viewRadius, centerY + Math.sin(angle) * this.viewRadius);
            this.ctx.stroke();
        }
    }

    drawOrganism(org) {
        const pulse = 1 + Math.sin(org.pulsePhase) * 0.1;
        const radius = org.radius * pulse;

        this.ctx.shadowColor = org.color;
        this.ctx.shadowBlur = 15;
        this.ctx.fillStyle = org.color + '88';
        this.ctx.beginPath();
        this.ctx.arc(org.x, org.y, radius, 0, Math.PI * 2);
        this.ctx.fill();

        this.ctx.fillStyle = org.color;
        this.ctx.beginPath();
        this.ctx.arc(org.x, org.y, radius * 0.4, 0, Math.PI * 2);
        this.ctx.fill();

        this.ctx.strokeStyle = org.color;
        this.ctx.lineWidth = 2;
        this.ctx.beginPath();
        this.ctx.arc(org.x, org.y, radius, 0, Math.PI * 2);
        this.ctx.stroke();

        this.ctx.lineWidth = 1;
        for (let i = 0; i < 3; i++) {
            const angle = org.flagella + (i * Math.PI * 2 / 3);
            const fx = org.x + Math.cos(angle) * radius;
            const fy = org.y + Math.sin(angle) * radius;
            const wave = Math.sin(org.flagella * 2 + i) * 5;
            this.ctx.beginPath();
            this.ctx.moveTo(fx, fy);
            this.ctx.quadraticCurveTo(fx + Math.cos(angle) * 10 + wave, fy + Math.sin(angle) * 10, fx + Math.cos(angle) * 15, fy + Math.sin(angle) * 15 + wave);
            this.ctx.stroke();
        }

        this.ctx.shadowBlur = 0;

        if (org.type === 'mirror') {
            this.ctx.strokeStyle = 'rgba(255, 255, 255, 0.5)';
            this.ctx.lineWidth = 1;
            this.ctx.beginPath();
            this.ctx.moveTo(org.x - 3, org.y - 3);
            this.ctx.lineTo(org.x + 3, org.y + 3);
            this.ctx.moveTo(org.x + 3, org.y - 3);
            this.ctx.lineTo(org.x - 3, org.y + 3);
            this.ctx.stroke();
        }
    }

    drawLaserEffect() {
        const effect = this.laserEffect;
        const alpha = effect.time / 0.5;

        if (effect.success === true) {
            this.ctx.fillStyle = `rgba(68, 255, 136, ${alpha})`;
            const size = (1 - effect.time / 0.3) * 30;
            this.ctx.beginPath();
            this.ctx.arc(effect.x, effect.y, size, 0, Math.PI * 2);
            this.ctx.fill();
        } else if (effect.success === false) {
            this.ctx.strokeStyle = `rgba(185, 68, 255, ${alpha})`;
            this.ctx.lineWidth = 3;
            const size = (1 - effect.time / 0.5) * 40;
            this.ctx.beginPath();
            this.ctx.arc(effect.x, effect.y, size, 0, Math.PI * 2);
            this.ctx.stroke();

            this.ctx.strokeStyle = `rgba(255, 68, 68, ${alpha})`;
            this.ctx.lineWidth = 4;
            this.ctx.beginPath();
            this.ctx.moveTo(effect.x - 15, effect.y - 15);
            this.ctx.lineTo(effect.x + 15, effect.y + 15);
            this.ctx.moveTo(effect.x + 15, effect.y - 15);
            this.ctx.lineTo(effect.x - 15, effect.y + 15);
            this.ctx.stroke();
        } else {
            this.ctx.fillStyle = `rgba(68, 255, 255, ${alpha})`;
            this.ctx.beginPath();
            this.ctx.arc(effect.x, effect.y, 5, 0, Math.PI * 2);
            this.ctx.fill();
        }
    }

    drawCrosshair() {
        this.ctx.strokeStyle = COLORS.CYAN;
        this.ctx.lineWidth = 1;
        this.ctx.beginPath();
        this.ctx.moveTo(this.mouse.x - 15, this.mouse.y);
        this.ctx.lineTo(this.mouse.x - 5, this.mouse.y);
        this.ctx.moveTo(this.mouse.x + 5, this.mouse.y);
        this.ctx.lineTo(this.mouse.x + 15, this.mouse.y);
        this.ctx.moveTo(this.mouse.x, this.mouse.y - 15);
        this.ctx.lineTo(this.mouse.x, this.mouse.y - 5);
        this.ctx.moveTo(this.mouse.x, this.mouse.y + 5);
        this.ctx.lineTo(this.mouse.x, this.mouse.y + 15);
        this.ctx.stroke();

        this.ctx.beginPath();
        this.ctx.arc(this.mouse.x, this.mouse.y, 20, 0, Math.PI * 2);
        this.ctx.stroke();
    }

    gameLoop(timestamp) {
        this.deltaTime = (timestamp - this.lastTime) / 1000;
        this.lastTime = timestamp;

        this.update(this.deltaTime, timestamp);
        this.draw();

        this.mouse.clicked = false;

        requestAnimationFrame((t) => this.gameLoop(t));
    }
}

// Initialisation
window.addEventListener('DOMContentLoaded', () => {
    new Chapter2();
});
