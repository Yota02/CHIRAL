# Cahier des charges : Projet "CHIRALITÉ" (Jeu Web de Vulgarisation)

## 1. Vue d'ensemble du projet
**Titre :** CHIRALITÉ (Nom de code)
**Concept :** Une expérience narrative interactive en 5 chapitres racontant l'apparition, la propagation et les conséquences fatales des "bactéries miroirs" (vie à chiralité inversée).
**Objectif :** Vulgariser le concept de chiralité et les risques de contamination biologique par une narration de science-fiction sombre ("Found footage" / Simulation).
**Plateforme :** Navigateur Web (Desktop & Mobile).

## 2. Stack Technique
* **Langage :** HTML5, CSS3, JavaScript (Vanilla ES6+).
* **Rendu graphique :** HTML5 Canvas API (pour les mini-jeux) + DOM Overlay (pour le texte/UI).
* **Dépendances :** Aucune (Pas de framework type React ou Phaser, on reste sur du natif pour la légèreté).
* **Stockage :** Aucun (Session unique).

## 3. Direction Artistique (Graphismes & UI)
* **Style :** Minimaliste, géométrique, abstrait. Ambiance "Interface Terminal / Laboratoire".
* **Palette de couleurs (Sémantique) :**
    * **Fond :** Noir (`#111111`) ou Gris très sombre.
    * **Vie Normale (Terrestre) :** Vert Bio (`#44ff88`) ou Bleu Cyan.
    * **Vie Miroir (Menace) :** Violet Néon (`#b944ff`) ou Gris Métallique.
    * **UI/Texte :** Blanc Terminal (`#eeeeee`) avec police Monospace (type 'Courier New' ou 'Fira Code').
* **Son (Optionnel) :** Bips légers d'interface, bourdonnement sourd.

## 4. Architecture du Code
Le code doit être modulaire pour faciliter l'ajout des chapitres.

* `index.html` : Conteneur Canvas + Divs pour l'UI (Dialogues, Boutons).
* `style.css` : Styles globaux, effets CRT (scanlines), animations de texte.
* `main.js` :
    * Gestionnaire d'état (State Machine) : `currentChapter`.
    * Boucle de jeu principale (`requestAnimationFrame`).
    * Gestionnaire d'Input (Souris/Touch).
* `chapters/` (Logique spécifique) :
    * Chaque chapitre doit être une classe ou une fonction qui possède ses propres méthodes `update()` et `draw()`.

## 5. Détails des Chapitres (Gameplay & Scénario)

### Chapitre 1 : La Synthèse (Puzzle)
* **Contexte :** Le joueur assemble la première bactérie artificielle.
* **Mécanique :** Drag & Drop ou Rotation.
* **Gameplay :**
    * Afficher une forme "Récepteur" (ex: un carré avec une encoche en L).
    * Afficher des pièces de puzzle "Nutriments".
    * Le joueur essaie de mettre une pièce "L" (Lévogyre) -> Ça rentre, mais rien ne se passe.
    * Le joueur doit choisir la pièce "D" (Dextrogyre/Miroir) -> La bactérie s'active et change de couleur (devient Violette).
* **Message de fin :** "Séquence complétée. Organisme stable. Immunité totale confirmée."

### Chapitre 2 : L'Invisible (Action/Observation)
* **Contexte :** Contamination accidentelle dans une goutte d'eau.
* **Mécanique :** Tir (Point & Click).
* **Gameplay :**
    * Vue microscope. Des organismes verts (normaux) et violets (miroirs) bougent.
    * Outil : "Laser UV" ou "Antibiotique".
    * Le joueur clique sur les verts -> Ils explosent.
    * Le joueur clique sur les violets -> **Rien ne se passe** (le tir traverse ou rebondit).
    * Timer : La population violette augmente jusqu'à saturation de l'écran.
* **Message de fin :** "Erreur critique. Cible non valide. Confinement brisé."

### Chapitre 3 : La Grande Mutation (Simulation)
* **Contexte :** L'écosystème mondial est remplacé.
* **Mécanique :** Clicker / Gestion de territoire.
* **Gameplay :**
    * Une grille ou une carte simplifiée.
    * La zone Violette s'étend automatiquement (taux de croissance exponentiel).
    * Le joueur clique pour "Planter" ou "Sauver" des zones Vertes.
    * Chaque action du joueur ralentit à peine la progression. La zone Violette étouffe la Verte (compétition pour l'espace).
    * Fin inévitable quand la carte est à 90% violette.
* **Message de fin :** "Biomasse terrestre : 12%. Remplacement irréversible."

### Chapitre 4 : La Forteresse (Rythme/Gestion)
* **Contexte :** Survivre dans un dôme en convertissant la matière miroir en nourriture comestible.
* **Mécanique :** Jeu de rythme ou Quick Time Event (QTE).
* **Gameplay :**
    * Une jauge "Faim de la population" descend vite.
    * Une machine "Convertisseur Chiral" est au centre.
    * Des formes géométriques arrivent. Le joueur doit appuyer sur la bonne touche au bon moment pour inverser la chiralité (passer du Violet au Vert).
    * Si succès : La jauge remonte.
    * Le jeu dure 30-60 secondes. La survie est assurée, mais confinée.
* **Message de fin :** "Systèmes nominaux. La colonie survit. L'extérieur est perdu."

### Chapitre 5 : Le Désert Silencieux (Narratif)
* **Contexte :** 50 ans plus tard, une expédition dehors.
* **Mécanique :** Side-scroller (Marche vers la droite) avec Parallax.
* **Gameplay :**
    * Le personnage marche lentement dans un paysage étrange (cristaux, formes grises).
    * Pas d'ennemis. Juste de l'ambiance.
    * Le joueur s'approche d'objets interactifs pour lire des descriptions : "Fleur cristallisée - Incomestible", "Eau visqueuse - Non potable".
    * Arrivée à un point final (ruines).
* **Message final (Épilogue) :** "Nous avons joué à être Dieu sans lire le manuel. La vie continue, mais ce n'est plus la nôtre."

## 6. Système de Narration
* Une zone de texte (overlay semi-transparent) en bas de l'écran.
* Effet "Machine à écrire" pour l'affichage du texte (lettre par lettre).
* Bouton "Continuer" clignotant pour passer au dialogue suivant.
* Transitions entre chapitres : Écran noir avec une date (ex: "An 2025", "An 2026", "An 2080").

## 7. Instructions pour l'IA Développeuse
1.  Commence par mettre en place la **structure HTML/CSS** de base et le **moteur de jeu (Game Loop)** dans `main.js`.
2.  Développe les chapitres **un par un** pour s'assurer que chaque mécanique fonctionne.
3.  Utilise des classes JS pour encapsuler la logique de chaque mini-jeu.
4.  Utilise des rectangles/cercles de couleur (`ctx.fillRect`, `ctx.arc`) pour les graphismes (pas d'images externes pour l'instant).
5.  Ajoute des commentaires dans le code pour expliquer la logique scientifique (ex: `// Les collisions sont ignorées ici car la chiralité est opposée`).