/**
 * GAME.JS - Client de jeu multijoueur
 * Rendu canvas, interpolation, HUD, input
 */

const MAP_SIZE = 8000;
const VICTORY_POP = 30000;

const ORB_TYPES = [
    { type: 'foodValue',       abbr: 'NUT', color: '#66ff66', glowRgb: '102, 255, 102' },
    { type: 'foodCost',        abbr: 'ECO', color: '#ff66aa', glowRgb: '255, 102, 170' },
    { type: 'speed',           abbr: 'VIT', color: '#44ddff', glowRgb: '68, 221, 255' },
    { type: 'collectionRange', abbr: 'POR', color: '#ffaa44', glowRgb: '255, 170, 68' },
    { type: 'regeneration',    abbr: 'REG', color: '#88ffaa', glowRgb: '136, 255, 170' },
    { type: 'duplication',     abbr: 'DUP', color: '#ff88dd', glowRgb: '255, 136, 221' }
];

// ==============================================
// GAME CLIENT
// ==============================================

class GameClient {
    constructor() {
        this.canvas = document.getElementById('game-canvas');
        this.ctx = this.canvas.getContext('2d');
        this.minimapCanvas = document.getElementById('minimap');
        this.minimapCtx = this.minimapCanvas.getContext('2d');

        // State
        this.myId = null;
        this.isHost = false;
        this.phase = 'lobby'; // lobby | playing | victory

        // Game state from server
        this.serverState = null;
        this.prevState = null;
        this.stateTime = 0;
        this.interpFactor = 0;

        // Local rendering state
        this.cameraX = 0;
        this.cameraY = 0;
        this.cameraZoom = 1;
        this.globalTime = 0;
        this.causticTime = 0;

        // Mouse
        this.mouseX = 0;
        this.mouseY = 0;

        // Sprites for swarm rendering (cached per entity)
        this.playerSprites = new Map();

        // PvP visual effects
        this.pvpEffects = [];

        // DOM refs
        this.dom = {
            lobbyOverlay: document.getElementById('lobby-overlay'),
            lobbyJoin: document.getElementById('lobby-join'),
            lobbyWaiting: document.getElementById('lobby-waiting'),
            playerName: document.getElementById('player-name'),
            btnJoin: document.getElementById('btn-join'),
            btnStart: document.getElementById('btn-start'),
            hostControls: document.getElementById('lobby-host-controls'),
            waitMsg: document.getElementById('lobby-wait-msg'),
            playerList: document.getElementById('player-list'),
            victoryOverlay: document.getElementById('victory-overlay'),
            victoryName: document.getElementById('victory-name'),
            btnReplay: document.getElementById('btn-replay'),
            hud: document.getElementById('game-hud'),
            hudPop: document.getElementById('hud-pop'),
            hudPopBar: document.getElementById('hud-pop-bar'),
            hudFood: document.getElementById('hud-food'),
            hudFoodBar: document.getElementById('hud-food-bar'),
            hudTimer: document.getElementById('hud-timer'),
            hudWarning: document.getElementById('hud-warning'),
            scoreboard: document.getElementById('scoreboard'),
            minimapContainer: document.getElementById('minimap-container')
        };

        this.setupInput();
        this.setupNetwork();
        this.resizeCanvas();
        window.addEventListener('resize', () => this.resizeCanvas());
        this.lastFrameTime = performance.now();
        this.minimapTimer = 0;
        requestAnimationFrame((t) => this.loop(t));
    }

    // ==============================================
    // INPUT
    // ==============================================

    setupInput() {
        this.canvas.addEventListener('mousemove', (e) => {
            this.mouseX = e.clientX;
            this.mouseY = e.clientY;
        });

        this.canvas.addEventListener('touchmove', (e) => {
            e.preventDefault();
            const t = e.touches[0];
            this.mouseX = t.clientX;
            this.mouseY = t.clientY;
        }, { passive: false });

        this.canvas.addEventListener('touchstart', (e) => {
            e.preventDefault();
            const t = e.touches[0];
            this.mouseX = t.clientX;
            this.mouseY = t.clientY;
        }, { passive: false });

        // Lobby buttons
        this.dom.btnJoin.addEventListener('click', () => this.joinGame());
        this.dom.playerName.addEventListener('keydown', (e) => {
            if (e.key === 'Enter') this.joinGame();
        });
        this.dom.btnStart.addEventListener('click', () => {
            window.network.startGame();
        });
        this.dom.btnReplay.addEventListener('click', () => {
            this.dom.victoryOverlay.classList.add('hidden');
            this.phase = 'lobby';
        });
    }

    joinGame() {
        const name = this.dom.playerName.value.trim();
        if (!name) return;
        window.network.connect();
        window.network.on('connected', () => {
            window.network.join(name);
        });
    }

    // ==============================================
    // NETWORK HANDLERS
    // ==============================================

    setupNetwork() {
        const net = window.network;

        net.on('joined', (msg) => {
            this.myId = msg.id;
            this.isHost = msg.isHost;
            this.dom.lobbyJoin.classList.add('hidden');
            this.dom.lobbyWaiting.classList.remove('hidden');
            if (this.isHost) {
                this.dom.hostControls.classList.remove('hidden');
                this.dom.waitMsg.classList.add('hidden');
            }
        });

        net.on('lobby', (msg) => {
            this.renderLobbyPlayers(msg.players);
            // Update host status
            const me = msg.players.find(p => p.id === this.myId);
            if (me && me.isHost) {
                this.isHost = true;
                this.dom.hostControls.classList.remove('hidden');
                this.dom.waitMsg.classList.add('hidden');
            }
        });

        net.on('start', () => {
            this.phase = 'playing';
            this.dom.lobbyOverlay.classList.remove('active');
            this.dom.hud.classList.remove('hidden');
            this.globalTime = 0;
            this.causticTime = 0;
            this.playerSprites.clear();
            this.pvpEffects = [];
        });

        net.on('state', (msg) => {
            this.prevState = this.serverState;
            this.serverState = msg;
            this.stateTime = performance.now();
            this.interpFactor = 0;
        });

        net.on('division', (msg) => {
            // Visual feedback could be added here
        });

        net.on('pvp', (msg) => {
            // Flash effect on victim and attacker
            const state = this.serverState;
            if (!state) return;
            const attacker = state.players.find(p => p.id === msg.attackerId);
            const victim = state.players.find(p => p.id === msg.victimId);
            if (attacker && victim) {
                this.pvpEffects.push({
                    x: victim.x, y: victim.y,
                    color: attacker.color,
                    radius: 0, maxRadius: 80,
                    life: 0.6, maxLife: 0.6,
                    text: '-' + msg.stolen,
                    textColor: '#ff4444'
                });
                this.pvpEffects.push({
                    x: attacker.x, y: attacker.y,
                    color: attacker.color,
                    radius: 0, maxRadius: 50,
                    life: 0.4, maxLife: 0.4,
                    text: '+' + msg.stolen,
                    textColor: '#44ff44'
                });
            }
        });

        net.on('victory', (msg) => {
            this.phase = 'victory';
            this.dom.victoryName.textContent = msg.winnerName;
            this.dom.victoryName.style.color = this.getPlayerColor(msg.winnerId);
            this.dom.victoryOverlay.classList.remove('hidden');
            this.dom.hud.classList.add('hidden');
        });

        net.on('error', (msg) => {
            alert(msg.message);
        });

        net.on('disconnected', () => {
            if (this.phase === 'playing') {
                this.phase = 'lobby';
                this.dom.lobbyOverlay.classList.add('active');
                this.dom.hud.classList.add('hidden');
                this.dom.lobbyJoin.classList.remove('hidden');
                this.dom.lobbyWaiting.classList.add('hidden');
            }
        });
    }

    getPlayerColor(id) {
        if (!this.serverState) return '#ffffff';
        const p = this.serverState.players.find(p => p.id === id);
        return p ? p.color : '#ffffff';
    }

    renderLobbyPlayers(players) {
        let html = '';
        for (const p of players) {
            html += `<div class="player-list-item">
                <div class="player-color-dot" style="background:${p.color}"></div>
                <div class="player-list-name">${this.escapeHtml(p.name)}</div>
                ${p.isHost ? '<div class="player-list-host">HOTE</div>' : ''}
            </div>`;
        }
        this.dom.playerList.innerHTML = html;
    }

    escapeHtml(str) {
        const div = document.createElement('div');
        div.textContent = str;
        return div.innerHTML;
    }

    // ==============================================
    // CANVAS
    // ==============================================

    resizeCanvas() {
        this.canvas.width = window.innerWidth;
        this.canvas.height = window.innerHeight;
    }

    // ==============================================
    // MAIN LOOP
    // ==============================================

    loop(timestamp) {
        const dt = Math.min(0.1, (timestamp - this.lastFrameTime) / 1000);
        this.lastFrameTime = timestamp;
        this.globalTime += dt;
        this.causticTime += dt;

        if (this.phase === 'playing' && this.serverState) {
            // Send input (world coordinates)
            const worldMouseX = this.mouseX / this.cameraZoom + this.cameraX;
            const worldMouseY = this.mouseY / this.cameraZoom + this.cameraY;
            window.network.sendInput(worldMouseX, worldMouseY);

            // Interpolation factor
            this.interpFactor = Math.min(1, (performance.now() - this.stateTime) / (1000 / 20));

            this.updateCamera(dt);
            this.updateHUD();
            this.updateMinimap(dt);
            this.updatePvpEffects(dt);
        }

        this.draw();
        requestAnimationFrame((t) => this.loop(t));
    }

    // ==============================================
    // CAMERA
    // ==============================================

    updateCamera(dt) {
        const me = this.getMyPlayer();
        if (!me) return;

        const targetCamX = me.x - (this.canvas.width / 2) / this.cameraZoom;
        const targetCamY = me.y - (this.canvas.height / 2) / this.cameraZoom;

        const lerpSpeed = 3;
        this.cameraX += (targetCamX - this.cameraX) * lerpSpeed * dt;
        this.cameraY += (targetCamY - this.cameraY) * lerpSpeed * dt;

        this.cameraX = Math.max(0, Math.min(MAP_SIZE - this.canvas.width / this.cameraZoom, this.cameraX));
        this.cameraY = Math.max(0, Math.min(MAP_SIZE - this.canvas.height / this.cameraZoom, this.cameraY));
    }

    getMyPlayer() {
        if (!this.serverState) return null;
        return this.serverState.players.find(p => p.id === this.myId);
    }

    isVisible(x, y, margin) {
        margin = margin || 100;
        const screenX = (x - this.cameraX) * this.cameraZoom;
        const screenY = (y - this.cameraY) * this.cameraZoom;
        return screenX > -margin && screenX < this.canvas.width + margin &&
               screenY > -margin && screenY < this.canvas.height + margin;
    }

    // ==============================================
    // HUD
    // ==============================================

    updateHUD() {
        const me = this.getMyPlayer();
        if (!me) return;

        // Population
        this.dom.hudPop.textContent = this.formatNumber(me.population);
        const popPct = Math.min(100, (me.population / VICTORY_POP) * 100);
        this.dom.hudPopBar.style.width = popPct + '%';

        // Food
        this.dom.hudFood.textContent = this.formatNumber(Math.floor(me.food));
        const foodNeeded = me.population * 2;
        const foodPct = Math.min(100, (me.food / foodNeeded) * 100);
        this.dom.hudFoodBar.style.width = foodPct + '%';

        // Timer
        const timer = Math.max(0, Math.ceil(this.serverState.divisionTimer));
        this.dom.hudTimer.textContent = timer + 's';
        if (this.serverState.divisionTimer <= 5) {
            this.dom.hudTimer.classList.add('warning');
        } else {
            this.dom.hudTimer.classList.remove('warning');
        }

        // Warning
        if (this.serverState.divisionTimer <= 5 && me.food < me.population * 2) {
            this.dom.hudWarning.classList.remove('hidden');
        } else {
            this.dom.hudWarning.classList.add('hidden');
        }

        // Scoreboard
        this.updateScoreboard();
    }

    updateScoreboard() {
        const sorted = [...this.serverState.players].sort((a, b) => b.population - a.population);
        let html = '';
        for (const p of sorted) {
            const isSelf = p.id === this.myId;
            html += `<div class="score-row${isSelf ? ' self' : ''}" style="border-left-color:${p.color}">
                <span class="score-name" style="color:${p.color}">${this.escapeHtml(p.name)}</span>
                <span class="score-pop">${this.formatNumber(p.population)}</span>
            </div>`;
        }
        this.dom.scoreboard.innerHTML = html;
    }

    formatNumber(n) {
        if (n >= 1000) return (n / 1000).toFixed(1).replace(/\.0$/, '') + 'k';
        return Math.floor(n).toString();
    }

    // ==============================================
    // MINIMAP
    // ==============================================

    updateMinimap(dt) {
        this.minimapTimer += dt;
        if (this.minimapTimer < 0.5) return;
        this.minimapTimer = 0;

        const ctx = this.minimapCtx;
        const size = 150;
        const scale = size / MAP_SIZE;

        ctx.fillStyle = 'rgba(5, 10, 30, 0.9)';
        ctx.fillRect(0, 0, size, size);

        // Food
        ctx.fillStyle = '#bbff44';
        for (const f of this.serverState.food) {
            ctx.fillRect(f.x * scale, f.y * scale, 1, 1);
        }

        // Orbs
        for (const o of this.serverState.orbs) {
            ctx.fillStyle = ORB_TYPES[o.typeIndex].color;
            ctx.beginPath();
            ctx.arc(o.x * scale, o.y * scale, 2, 0, Math.PI * 2);
            ctx.fill();
        }

        // Players
        for (const p of this.serverState.players) {
            ctx.fillStyle = p.color;
            const r = Math.max(3, (20 + Math.sqrt(p.population) * 0.8) * scale * 2);
            ctx.beginPath();
            ctx.arc(p.x * scale, p.y * scale, r / 2, 0, Math.PI * 2);
            ctx.fill();
        }

        // Camera viewport
        ctx.strokeStyle = 'rgba(255, 255, 255, 0.3)';
        ctx.lineWidth = 1;
        ctx.strokeRect(
            this.cameraX * scale, this.cameraY * scale,
            (this.canvas.width / this.cameraZoom) * scale,
            (this.canvas.height / this.cameraZoom) * scale
        );
    }

    // ==============================================
    // DRAW
    // ==============================================

    draw() {
        const ctx = this.ctx;
        const w = this.canvas.width;
        const h = this.canvas.height;

        ctx.fillStyle = '#030a15';
        ctx.fillRect(0, 0, w, h);

        if (this.phase !== 'playing' || !this.serverState) return;

        ctx.save();
        ctx.scale(this.cameraZoom, this.cameraZoom);
        ctx.translate(-this.cameraX, -this.cameraY);

        this.drawBackground(ctx, w, h);
        this.drawFood(ctx);
        this.drawPowerups(ctx);
        this.drawOrbs(ctx);
        this.drawPlayers(ctx);
        this.drawCollectionRadius(ctx);
        this.drawPvpEffects(ctx);

        ctx.restore();
    }

    // ==============================================
    // DRAW: BACKGROUND (caustic water)
    // ==============================================

    drawBackground(ctx, screenWidth, screenHeight) {
        const viewLeft = this.cameraX;
        const viewTop = this.cameraY;
        const viewRight = this.cameraX + screenWidth / this.cameraZoom;
        const viewBottom = this.cameraY + screenHeight / this.cameraZoom;
        const center = MAP_SIZE / 2;

        const cellSize = 120;
        const startCol = Math.floor(viewLeft / cellSize);
        const endCol = Math.ceil(viewRight / cellSize);
        const startRow = Math.floor(viewTop / cellSize);
        const endRow = Math.ceil(viewBottom / cellSize);

        for (let row = startRow; row <= endRow; row++) {
            for (let col = startCol; col <= endCol; col++) {
                const x = col * cellSize;
                const y = row * cellSize;

                const dx = (x + cellSize / 2) - center;
                const dy = (y + cellSize / 2) - center;
                const distFromCenter = Math.sqrt(dx * dx + dy * dy);
                const edgeFactor = Math.max(0, 1 - distFromCenter / (MAP_SIZE * 0.45));

                const caustic = (
                    Math.sin((x * 0.008) + this.causticTime * 0.7) *
                    Math.sin((y * 0.008) + this.causticTime * 0.5) +
                    Math.sin((x * 0.012 + y * 0.006) + this.causticTime * 0.9) * 0.5
                ) * 0.5 + 0.5;

                const brightness = Math.floor(8 + caustic * 15 * edgeFactor);
                const blueBase = Math.floor(20 + caustic * 25 * edgeFactor);

                ctx.fillStyle = `rgb(${brightness}, ${brightness + 2}, ${blueBase})`;
                ctx.fillRect(x, y, cellSize + 1, cellSize + 1);
            }
        }
    }

    // ==============================================
    // DRAW: FOOD
    // ==============================================

    drawFood(ctx) {
        for (const f of this.serverState.food) {
            if (!this.isVisible(f.x, f.y, 20)) continue;

            const pulse = Math.sin(this.globalTime * 2 + f.x * 0.01) * 0.3 + 0.7;
            const size = f.size * pulse;

            ctx.fillStyle = `rgba(180, 230, 80, ${0.6 + pulse * 0.4})`;
            ctx.beginPath();
            ctx.arc(f.x, f.y, size, 0, Math.PI * 2);
            ctx.fill();

            ctx.fillStyle = `rgba(200, 255, 100, ${0.15 * pulse})`;
            ctx.beginPath();
            ctx.arc(f.x, f.y, size * 2.5, 0, Math.PI * 2);
            ctx.fill();
        }
    }

    // ==============================================
    // DRAW: POWERUPS
    // ==============================================

    drawPowerups(ctx) {
        for (const pu of this.serverState.powerups) {
            if (!this.isVisible(pu.x, pu.y, 30)) continue;

            const bob = Math.sin(this.globalTime * 2 + pu.x * 0.01) * 4;
            const y = pu.y + bob;
            const glow = Math.sin(this.globalTime * 3 + pu.x * 0.01) * 0.3 + 0.7;

            let color, glowColor;
            switch (pu.type) {
                case 'speed':
                    color = '#44ffff'; glowColor = 'rgba(68,255,255,0.3)';
                    this.drawTriangle(ctx, pu.x, y, pu.size, color); break;
                case 'efficiency':
                    color = '#ffcc44'; glowColor = 'rgba(255,204,68,0.3)';
                    this.drawStar(ctx, pu.x, y, pu.size, color); break;
                case 'magnet':
                    color = '#ff8844'; glowColor = 'rgba(255,136,68,0.3)';
                    this.drawRing(ctx, pu.x, y, pu.size, color); break;
                case 'shield':
                    color = '#ffffff'; glowColor = 'rgba(255,255,255,0.3)';
                    this.drawDiamond(ctx, pu.x, y, pu.size, color); break;
            }

            ctx.fillStyle = glowColor;
            ctx.globalAlpha = glow * 0.5;
            ctx.beginPath();
            ctx.arc(pu.x, y, pu.size * 2, 0, Math.PI * 2);
            ctx.fill();
            ctx.globalAlpha = 1;
        }
    }

    drawTriangle(ctx, x, y, size, color) {
        ctx.fillStyle = color;
        ctx.beginPath();
        ctx.moveTo(x, y - size);
        ctx.lineTo(x - size * 0.87, y + size * 0.5);
        ctx.lineTo(x + size * 0.87, y + size * 0.5);
        ctx.closePath();
        ctx.fill();
    }

    drawStar(ctx, x, y, size, color) {
        ctx.fillStyle = color;
        ctx.beginPath();
        for (let i = 0; i < 5; i++) {
            const outerAngle = (i * 72 - 90) * Math.PI / 180;
            const innerAngle = ((i * 72) + 36 - 90) * Math.PI / 180;
            if (i === 0) ctx.moveTo(x + Math.cos(outerAngle) * size, y + Math.sin(outerAngle) * size);
            else ctx.lineTo(x + Math.cos(outerAngle) * size, y + Math.sin(outerAngle) * size);
            ctx.lineTo(x + Math.cos(innerAngle) * size * 0.4, y + Math.sin(innerAngle) * size * 0.4);
        }
        ctx.closePath();
        ctx.fill();
    }

    drawRing(ctx, x, y, size, color) {
        ctx.strokeStyle = color;
        ctx.lineWidth = 3;
        ctx.beginPath(); ctx.arc(x, y, size, 0, Math.PI * 2); ctx.stroke();
        ctx.beginPath(); ctx.arc(x, y, size * 0.5, 0, Math.PI * 2); ctx.stroke();
    }

    drawDiamond(ctx, x, y, size, color) {
        ctx.fillStyle = color;
        ctx.beginPath();
        ctx.moveTo(x, y - size);
        ctx.lineTo(x + size * 0.7, y);
        ctx.lineTo(x, y + size);
        ctx.lineTo(x - size * 0.7, y);
        ctx.closePath();
        ctx.fill();
    }

    // ==============================================
    // DRAW: ORBS
    // ==============================================

    drawOrbs(ctx) {
        for (const orb of this.serverState.orbs) {
            if (!this.isVisible(orb.x, orb.y, 40)) continue;

            const typeDef = ORB_TYPES[orb.typeIndex];
            const bob = Math.sin(this.globalTime * 1.5 + orb.x * 0.01) * 5;
            const y = orb.y + bob;
            const glow = Math.sin(this.globalTime * 2 + orb.x * 0.01) * 0.3 + 0.7;
            const rot = this.globalTime * 0.5;

            // Outer glow
            ctx.fillStyle = `rgba(${typeDef.glowRgb}, ${0.15 * glow})`;
            ctx.beginPath();
            ctx.arc(orb.x, y, orb.size * 3, 0, Math.PI * 2);
            ctx.fill();

            // Hexagon
            ctx.save();
            ctx.translate(orb.x, y);
            ctx.rotate(rot);
            ctx.fillStyle = typeDef.color;
            ctx.globalAlpha = 0.9;
            ctx.beginPath();
            for (let i = 0; i < 6; i++) {
                const a = (i * 60) * Math.PI / 180;
                const px = Math.cos(a) * orb.size;
                const py = Math.sin(a) * orb.size;
                if (i === 0) ctx.moveTo(px, py);
                else ctx.lineTo(px, py);
            }
            ctx.closePath();
            ctx.fill();

            // Inner highlight
            ctx.fillStyle = '#ffffff';
            ctx.globalAlpha = 0.4 * glow;
            ctx.beginPath();
            ctx.arc(0, 0, orb.size * 0.4, 0, Math.PI * 2);
            ctx.fill();
            ctx.globalAlpha = 1;
            ctx.restore();

            // Label
            ctx.fillStyle = typeDef.color;
            ctx.font = 'bold 10px Courier New';
            ctx.textAlign = 'center';
            ctx.fillText(typeDef.abbr, orb.x, y + orb.size + 14);
        }
        ctx.textAlign = 'start';
    }

    // ==============================================
    // DRAW: SWARMS (players & enemies)
    // ==============================================

    getOrCreateSprites(key, count, maxSprites) {
        let sprites = this.playerSprites.get(key);
        if (!sprites) {
            sprites = [];
            this.playerSprites.set(key, sprites);
        }
        const target = Math.min(maxSprites, count);
        while (sprites.length < target) {
            const angle = Math.random() * Math.PI * 2;
            const dist = Math.random();
            sprites.push({
                offsetX: Math.cos(angle) * dist,
                offsetY: Math.sin(angle) * dist,
                phase: Math.random() * Math.PI * 2,
                speed: 1 + Math.random() * 2,
                size: 2 + Math.random() * 3
            });
        }
        while (sprites.length > target) sprites.pop();
        return sprites;
    }

    drawSwarm(ctx, x, y, population, color, highlightRgb, sprites, visualRadius) {
        if (!this.isVisible(x, y, visualRadius + 50)) return;

        // Glow
        ctx.fillStyle = `rgba(${highlightRgb}, 0.08)`;
        ctx.beginPath();
        ctx.arc(x, y, visualRadius * 1.5, 0, Math.PI * 2);
        ctx.fill();

        // Bacteria sprites
        for (const sprite of sprites) {
            const wobbleX = Math.sin(this.globalTime * sprite.speed + sprite.phase) * 3;
            const wobbleY = Math.cos(this.globalTime * sprite.speed * 0.7 + sprite.phase) * 3;
            const sx = x + sprite.offsetX * visualRadius + wobbleX;
            const sy = y + sprite.offsetY * visualRadius + wobbleY;

            ctx.fillStyle = color;
            ctx.globalAlpha = 0.7 + Math.sin(this.globalTime * 2 + sprite.phase) * 0.3;
            ctx.beginPath();
            ctx.arc(sx, sy, sprite.size, 0, Math.PI * 2);
            ctx.fill();
        }
        ctx.globalAlpha = 1;
    }

    drawPlayers(ctx) {
        for (const p of this.serverState.players) {
            const visualRadius = 20 + Math.sqrt(p.population) * 0.8;
            const sprites = this.getOrCreateSprites('player_' + p.id, p.population, 200);

            // Convert hex color to rgb for highlight
            const r = parseInt(p.color.substr(1, 2), 16);
            const g = parseInt(p.color.substr(3, 2), 16);
            const b = parseInt(p.color.substr(5, 2), 16);

            this.drawSwarm(ctx, p.x, p.y, p.population, p.color, `${r}, ${g}, ${b}`, sprites, visualRadius);

            // Center dot (brighter)
            ctx.fillStyle = '#ffffff';
            ctx.globalAlpha = 0.6;
            ctx.beginPath();
            ctx.arc(p.x, p.y, 4, 0, Math.PI * 2);
            ctx.fill();
            ctx.globalAlpha = 1;

            // Name tag
            ctx.fillStyle = p.color;
            ctx.font = 'bold 12px Courier New';
            ctx.textAlign = 'center';
            ctx.fillText(p.name, p.x, p.y - visualRadius - 10);
        }
        ctx.textAlign = 'start';
    }

    drawCollectionRadius(ctx) {
        const me = this.getMyPlayer();
        if (!me) return;

        const visualRadius = 20 + Math.sqrt(me.population) * 0.8;
        const magnetMult = me.activePowerups.magnet > 0 ? 2 : 1;
        const baseCollect = 20 + me.orbBonuses.collectionRange * 10;
        const collectRadius = (visualRadius * 1.5 + baseCollect) * magnetMult;

        ctx.fillStyle = 'rgba(128, 128, 128, 0.15)';
        ctx.beginPath();
        ctx.arc(me.x, me.y, collectRadius, 0, Math.PI * 2);
        ctx.fill();

        // Low food warning
        if (this.serverState.divisionTimer <= 5 && me.food < me.population * 2) {
            const pulse = Math.sin(this.globalTime * 10) * 0.3 + 0.7;
            ctx.strokeStyle = `rgba(255, 0, 0, ${pulse})`;
            ctx.lineWidth = 8;
            ctx.beginPath();
            ctx.arc(me.x, me.y, visualRadius + 15, 0, Math.PI * 2);
            ctx.stroke();
        }
    }

    // ==============================================
    // PVP EFFECTS
    // ==============================================

    updatePvpEffects(dt) {
        for (let i = this.pvpEffects.length - 1; i >= 0; i--) {
            const e = this.pvpEffects[i];
            e.life -= dt;
            e.radius += (e.maxRadius / e.maxLife) * dt;
            e.y -= 20 * dt;
            if (e.life <= 0) {
                this.pvpEffects.splice(i, 1);
            }
        }
    }

    drawPvpEffects(ctx) {
        for (const e of this.pvpEffects) {
            const alpha = Math.max(0, e.life / e.maxLife);

            // Expanding ring
            ctx.strokeStyle = e.color;
            ctx.globalAlpha = alpha * 0.6;
            ctx.lineWidth = 3;
            ctx.beginPath();
            ctx.arc(e.x, e.y, e.radius, 0, Math.PI * 2);
            ctx.stroke();

            // Damage/heal text
            ctx.fillStyle = e.textColor;
            ctx.globalAlpha = alpha;
            ctx.font = 'bold 18px Courier New';
            ctx.textAlign = 'center';
            ctx.fillText(e.text, e.x, e.y - e.radius - 5);
        }
        ctx.globalAlpha = 1;
        ctx.textAlign = 'start';
    }
}

// ==============================================
// START
// ==============================================

window.addEventListener('DOMContentLoaded', () => {
    window.game = new GameClient();
});
