/**
 * CHIRALITE - Moteur de jeu principal
 *
 * Ce fichier contient le coeur du jeu :
 * - State Machine pour gerer les etats (menu, chapitres, transitions)
 * - Game Loop avec requestAnimationFrame
 * - Systeme de narration avec effet machine a ecrire
 * - Gestion des inputs (souris/touch)
 */

// ============================================
// IMPORTS DES CHAPITRES
// ============================================

import { Chapter1 } from './chapters/chapter1/chapter1.js';
import { Chapter2 } from './chapters/chapter2/chapter2.js';
import { Chapter3 } from './chapters/chapter3/chapter3.js';
import { Chapter4 } from './chapters/chapter4.js';
import { Chapter5 } from './chapters/chapter5.js';

// ============================================
// CONSTANTES GLOBALES
// ============================================

const COLORS = {
    BG_DARK: '#111111',
    LIFE_NORMAL: '#44ff88',     // Vert Bio - Vie terrestre normale
    LIFE_MIRROR: '#b944ff',     // Violet Neon - Vie miroir (chiralite inversee)
    UI_TEXT: '#eeeeee',
    UI_DIM: '#666666',
    DANGER: '#ff4444',
    CYAN: '#44ffff'
};

// Donnees des chapitres (dates et titres pour les transitions)
const CHAPTERS_DATA = [
    { date: 'An 2025', title: 'Chapitre 1 : La Synthese', class: Chapter1 },
    { date: 'An 2026', title: 'Chapitre 2 : L\'Invisible', class: Chapter2 },
    { date: 'An 2030', title: 'Chapitre 3 : La Grande Mutation', class: Chapter3 },
    { date: 'An 2045', title: 'Chapitre 4 : La Propagation', class: Chapter4 },
    { date: 'An 2080', title: 'Chapitre 5 : Le Desert Silencieux', class: Chapter5 }
];

// ============================================
// CLASSE GAME - Moteur principal
// ============================================

class Game {
    constructor() {
        // Elements du DOM
        this.canvas = document.getElementById('game-canvas');
        this.ctx = this.canvas.getContext('2d');

        // UI Elements
        this.titleScreen = document.getElementById('title-screen');
        this.transitionScreen = document.getElementById('transition-screen');
        this.transitionDate = document.getElementById('transition-date');
        this.transitionTitle = document.getElementById('transition-title');
        this.dialogueBox = document.getElementById('dialogue-box');
        this.dialogueText = document.getElementById('dialogue-text');
        this.continueButton = document.getElementById('continue-button');
        this.chapterUI = document.getElementById('chapter-ui');
        this.chapterInstructions = document.getElementById('chapter-instructions');
        this.endMessage = document.getElementById('end-message');
        this.endText = document.getElementById('end-text');
        this.startButton = document.getElementById('start-button');
        
        // Etat du jeu
        this.state = 'title';  // title, transition, playing, dialogue, ending
        this.currentChapter = 0;
        this.chapter = null;

        // Systeme de narration
        this.dialogueQueue = [];
        this.currentDialogue = '';
        this.dialogueIndex = 0;
        this.typewriterSpeed = 30; // ms par caractere
        this.lastTypeTime = 0;
        this.dialogueComplete = false;
        this.onDialogueEnd = null;

        // Input
        this.mouse = { x: 0, y: 0, down: false, clicked: false };
        this.touch = { x: 0, y: 0, active: false };
        this.keys = {};

        // Timing
        this.lastTime = 0;
        this.deltaTime = 0;

        // Initialisation
        this.init();
    }

    init() {
        this.resizeCanvas();
        this.setupEventListeners();
        this.gameLoop(0);
    }

    resizeCanvas() {
        this.canvas.width = window.innerWidth;
        this.canvas.height = window.innerHeight;
    }

    setupEventListeners() {
        // Redimensionnement
        window.addEventListener('resize', () => this.resizeCanvas());

        // Bouton de demarrage
        this.startButton.addEventListener('click', () => this.startGame());

        // Bouton continuer (dialogue)
        this.continueButton.addEventListener('click', () => this.advanceDialogue());

        // Souris - ecouter sur window pour capturer tous les evenements
        window.addEventListener('mousemove', (e) => {
            this.mouse.x = e.clientX;
            this.mouse.y = e.clientY;
        });

        window.addEventListener('mousedown', (e) => {
            // Ne pas capturer si on clique sur un element UI
            if (e.target.closest('#ui-overlay') && !e.target.closest('#dialogue-box')) {
                return;
            }
            this.mouse.down = true;
            this.mouse.clicked = true;
            this.mouse.x = e.clientX;
            this.mouse.y = e.clientY;
        });

        window.addEventListener('mouseup', () => {
            this.mouse.down = false;
        });

        // Touch - ecouter sur window
        window.addEventListener('touchstart', (e) => {
            // Ne pas capturer si on touche un element UI (sauf dialogue pour cliquer dessus)
            if (e.target.closest('#ui-overlay') && !e.target.closest('#dialogue-box')) {
                return;
            }
            const touch = e.touches[0];
            this.touch.x = touch.clientX;
            this.touch.y = touch.clientY;
            this.touch.active = true;
            this.mouse.x = touch.clientX;
            this.mouse.y = touch.clientY;
            this.mouse.down = true;
            this.mouse.clicked = true;
        }, { passive: false });

        window.addEventListener('touchmove', (e) => {
            if (e.target.closest('#ui-overlay') && !e.target.closest('#dialogue-box')) {
                return;
            }
            const touch = e.touches[0];
            this.touch.x = touch.clientX;
            this.touch.y = touch.clientY;
            this.mouse.x = touch.clientX;
            this.mouse.y = touch.clientY;
        }, { passive: false });

        window.addEventListener('touchend', () => {
            this.touch.active = false;
            this.mouse.down = false;
        });

        // Clavier
        window.addEventListener('keydown', (e) => {
            this.keys[e.code] = true;
            // Permettre d'avancer le dialogue avec Espace ou Entree
            if ((e.code === 'Space' || e.code === 'Enter') && this.state === 'dialogue') {
                this.advanceDialogue();
            }
        });

        window.addEventListener('keyup', (e) => {
            this.keys[e.code] = false;
        });
    }

    // ============================================
    // FLOW DU JEU
    // ============================================

    startGame() {
        this.titleScreen.classList.remove('active');
        this.titleScreen.classList.add('hidden');
        this.startChapter(3);  // Démarrer au chapitre 4 (index 3)
    }

    startChapter(chapterIndex) {
        // 1. Gestion de l'UI (Masquer Titre / Reset UI Chapitre)
        this.titleScreen.classList.remove('active');
        this.titleScreen.classList.add('hidden');
        this.chapterUI.classList.remove('active'); // On cache l'UI pendant la transition
        
        // 2. Nettoyer le chapitre précédent si existe (libérer la mémoire/event listeners)
        if (this.chapter && typeof this.chapter.destroy === 'function') {
            this.chapter.destroy();
        }
        this.chapter = null; // Sécurité

        this.currentChapter = chapterIndex;

        // 3. Vérifier si on a fini tous les chapitres
        if (chapterIndex >= CHAPTERS_DATA.length) {
            this.showFinalEnding();
            return;
        }

        const chapterData = CHAPTERS_DATA[chapterIndex];

        // 4. LANCEMENT DE LA TRANSITION
        // On passe une fonction (callback) qui sera exécutée à la fin de l'animation
        this.showTransition(chapterData.date, chapterData.title, () => {
            
            // --- Ce bloc s'exécute après les 4 secondes de transition ---
            
            // A. On instancie la classe du chapitre
            this.chapter = new chapterData.class(this);
            
            // B. On change l'état du jeu pour lancer l'update/draw
            this.state = 'playing';
            
            // C. On réactive l'interface utilisateur du jeu
            this.chapterUI.classList.add('active');
        });
    }

    showTransition(date, title, callback) {
        this.state = 'transition';
        this.transitionDate.textContent = date;
        this.transitionTitle.textContent = title;

        // Masquer la date et le titre initialement
        this.transitionDate.style.opacity = '0';
        this.transitionTitle.style.opacity = '0';

        // S'assurer que l'écran de transition est visible
        this.transitionScreen.style.opacity = '0';
        this.transitionScreen.classList.add('active');
        
        // Force reflow
        void this.transitionDate.offsetWidth;
        
        // Démarrer la transition d'opacité de l'écran
        this.transitionScreen.style.opacity = '1';

        // Révéler la date après 1 seconde (après que le fond noir soit apparu)
        setTimeout(() => {
            this.transitionDate.style.opacity = '1';
        }, 1000);

        // Révéler le titre après 2 secondes (après l'année)
        setTimeout(() => {
            this.transitionTitle.style.opacity = '1';
        }, 2000);

        setTimeout(() => {
            this.transitionScreen.style.opacity = '0';
            setTimeout(() => {
                this.transitionScreen.classList.remove('active');
                if (callback) callback();
            }, 500);
        }, 4000);
    }

    chapterComplete(endMessage) {
        this.chapterUI.classList.remove('active');
        this.showEndMessage(endMessage, () => {
            this.startChapter(this.currentChapter + 1);
        });
    }

    showEndMessage(message, callback) {
        this.state = 'ending';
        this.endText.textContent = '';
        this.endMessage.classList.add('active');

        // Effet machine a ecrire pour le message de fin
        let index = 0;
        const typeInterval = setInterval(() => {
            if (index < message.length) {
                this.endText.textContent += message[index];
                index++;
            } else {
                clearInterval(typeInterval);
                setTimeout(() => {
                    this.endMessage.classList.remove('active');
                    if (callback) callback();
                }, 3000);
            }
        }, 50);
    }

    showFinalEnding() {
        this.state = 'ending';
        this.endText.textContent = '';
        this.endMessage.classList.add('active');

        const finalMessage = "Nous avons joue a etre Dieu sans lire le manuel.\n\nLa vie continue, mais ce n'est plus la notre.";

        let index = 0;
        const typeInterval = setInterval(() => {
            if (index < finalMessage.length) {
                this.endText.textContent += finalMessage[index];
                index++;
            } else {
                clearInterval(typeInterval);
            }
        }, 80);
    }

    // ============================================
    // SYSTEME DE NARRATION
    // ============================================

    showDialogue(messages, callback = null) {
        // Vérification de sécurité : éviter les appels si déjà en dialogue ou si les éléments DOM ne sont pas prêts
        if (this.state === 'dialogue' || !this.dialogueBox || !this.dialogueText) {
            return;
        }
        this.dialogueQueue = Array.isArray(messages) ? [...messages] : [messages];
        this.onDialogueEnd = callback;
        this.nextDialogue();
    }

    nextDialogue() {
        if (this.dialogueQueue.length === 0) {
            this.hideDialogue();
            if (this.onDialogueEnd) {
                this.onDialogueEnd();
                this.onDialogueEnd = null;
            }
            return;
        }

        this.currentDialogue = this.dialogueQueue.shift();
        this.dialogueIndex = 0;
        this.dialogueComplete = false;
        this.dialogueText.textContent = '';
        this.continueButton.classList.add('hidden');
        this.dialogueBox.classList.add('active');
        this.state = 'dialogue';
    }

    advanceDialogue() {
        if (!this.dialogueComplete) {
            // Skip to end of current dialogue
            this.dialogueText.textContent = this.currentDialogue;
            this.dialogueIndex = this.currentDialogue.length;
            this.dialogueComplete = true;
            this.continueButton.classList.remove('hidden');
        } else {
            this.nextDialogue();
        }
    }

    hideDialogue() {
        this.dialogueBox.classList.remove('active');
        this.state = 'playing';
    }

    updateDialogue(timestamp) {
        if (this.state !== 'dialogue' || this.dialogueComplete) return;

        if (timestamp - this.lastTypeTime > this.typewriterSpeed) {
            if (this.dialogueIndex < this.currentDialogue.length) {
                this.dialogueText.textContent += this.currentDialogue[this.dialogueIndex];
                this.dialogueIndex++;
                this.lastTypeTime = timestamp;
            } else {
                this.dialogueComplete = true;
                this.continueButton.classList.remove('hidden');
            }
        }
    }

    setInstructions(text) {
        this.chapterInstructions.textContent = text;
    }

    // ============================================
    // GAME LOOP
    // ============================================

    gameLoop(timestamp) {
        this.deltaTime = (timestamp - this.lastTime) / 1000;
        this.lastTime = timestamp;

        this.update(timestamp);
        this.draw();

        // Reset click state
        this.mouse.clicked = false;

        requestAnimationFrame((t) => this.gameLoop(t));
    }

    update(timestamp) {
        // Update dialogue typewriter
        this.updateDialogue(timestamp);

        // Update chapter
        if (this.state === 'playing' && this.chapter) {
            this.chapter.update(this.deltaTime, timestamp);
        }
    }

    draw() {
        // Clear canvas
        this.ctx.fillStyle = COLORS.BG_DARK;
        this.ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);

        // Draw chapter
        if ((this.state === 'playing' || this.state === 'dialogue') && this.chapter) {
            this.chapter.draw(this.ctx);
        }
    }

    // ============================================
    // UTILITAIRES
    // ============================================

    getColors() {
        return COLORS;
    }

    getCanvasSize() {
        return {
            width: this.canvas.width,
            height: this.canvas.height
        };
    }

    getMouse() {
        return { ...this.mouse };
    }

    getKeys() {
        return { ...this.keys };
    }

    getTime() {
        return this.lastTime / 1000;
    }
}

// ============================================
// INITIALISATION AU CHARGEMENT
// ============================================

window.addEventListener('DOMContentLoaded', () => {
    window.game = new Game();
});
