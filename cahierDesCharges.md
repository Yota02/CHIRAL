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
jeux de platforme en 2d ou on joue une bactérie qui essaye de s'echapper d'un laboratoire. Le joueur doit éviter les zones de lumière (représentant les systèmes de stérilisation) et se cacher dans l'ombre pour survivre. La bactérie peut se faufiler à travers des conduits d'aération et des fissures, mais doit éviter les pièges et les robots de nettoyage. Pour finir par arriver dans une flaque d'eau à l'extérieur, où elle peut se multiplier et contaminer l'environnement.

### Chapitre 3 : La Mutation 
* **Contexte :** 
Ce jeux se place sur une carte vue du dessus (top-down) représentant la flaque d'eau à l'extérieur du laboratoire. Elle doit être grande mais limité dans l'espace (ex: 8000x8000 pixels). On doit avoir une vue sur l'amas de bactérie qu'on controlle grace a la souris et en ce deplacant dans la flaque. On commence avec une bactérie se trouvant maintenant dans la flaque et essaye de survivre et de se multiplier. Pour cela elle est en compétition avec des bactéries normales (vertes) pour les ressources (nourriture). Toute les 20 s le nombre de bactérie est doublé par 2 et donc les besoins en nourriture sont doublé si le nombre de nouriture n'est pas suffisant alors on supprime toute les bactérie qui ne peuvent être nourie. Le joueur doit gérer la croissance de sa population tout en évitant l'extinction du au manque de nourriture. Il y a des points qui apparaisse aléatoirement sur la map et qu'on doit récupéré pour amélioré notre population. Une fois que la population a atteind une population de 30000 une des bactérie mute (devient rouge). Et c'est ainsi que le chapitre 3 se termine avec un gros zoom sur la bactérie rouge qui représente la menace ultime. 

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