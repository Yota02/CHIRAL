/**
 * NETWORK.JS - Client WebSocket
 * Gestion de la connexion au serveur multijoueur
 */

class Network {
    constructor() {
        this.ws = null;
        this.connected = false;
        this.playerId = null;
        this.handlers = {};
        this.reconnectAttempts = 0;
        this.maxReconnectAttempts = 5;
        this.reconnectDelay = 2000;
    }

    connect() {
        const protocol = location.protocol === 'https:' ? 'wss:' : 'ws:';
        const url = `${protocol}//${location.host}`;

        this.ws = new WebSocket(url);

        this.ws.onopen = () => {
            this.connected = true;
            this.reconnectAttempts = 0;
            console.log('[Network] Connecte au serveur');
            this.emit('connected');
        };

        this.ws.onmessage = (event) => {
            try {
                const msg = JSON.parse(event.data);
                this.emit(msg.type, msg);
            } catch (e) {
                console.error('[Network] Message invalide:', e);
            }
        };

        this.ws.onclose = () => {
            this.connected = false;
            console.log('[Network] Deconnecte');
            this.emit('disconnected');
            this.tryReconnect();
        };

        this.ws.onerror = (err) => {
            console.error('[Network] Erreur WebSocket:', err);
        };
    }

    tryReconnect() {
        if (this.reconnectAttempts >= this.maxReconnectAttempts) {
            console.log('[Network] Nombre max de tentatives atteint');
            return;
        }
        this.reconnectAttempts++;
        console.log(`[Network] Reconnexion ${this.reconnectAttempts}/${this.maxReconnectAttempts}...`);
        setTimeout(() => this.connect(), this.reconnectDelay);
    }

    send(msg) {
        if (this.ws && this.ws.readyState === WebSocket.OPEN) {
            this.ws.send(JSON.stringify(msg));
        }
    }

    join(name) {
        this.send({ type: 'join', name });
    }

    sendInput(mouseX, mouseY) {
        this.send({ type: 'input', mouseX, mouseY });
    }

    startGame() {
        this.send({ type: 'start' });
    }

    on(event, handler) {
        if (!this.handlers[event]) this.handlers[event] = [];
        this.handlers[event].push(handler);
    }

    emit(event, data) {
        const handlers = this.handlers[event];
        if (handlers) {
            for (const h of handlers) h(data);
        }
    }
}

window.network = new Network();
