// Initialisation du module
class FollowMeIfYouCan {
    static init() {
        // Ajout du lien vers GitHub
        game.settings.registerMenu("follow-me-if-you-can", "githubLink", {
            name: "GitHub",
            label: "GitHub",
            hint: game.i18n.localize("FOLLOWMEIFYOUCAN.Settings.GitHub.Hint"),
            icon: "fab fa-github",
            type: GitHubLink,
            restricted: false
        });
        
        game.settings.register("follow-me-if-you-can", "keepFollowingOnSceneChange", {
            name: game.i18n.localize("FOLLOWMEIFYOUCAN.Settings.KeepFollowing.Name"),
            hint: game.i18n.localize("FOLLOWMEIFYOUCAN.Settings.KeepFollowing.Hint"),
            scope: "world",
            config: true,
            type: Boolean,
            default: false
        });

        game.settings.register("follow-me-if-you-can", "instantFollow", {
            name: game.i18n.localize("FOLLOWMEIFYOUCAN.Settings.InstantFollow.Name"),
            hint: game.i18n.localize("FOLLOWMEIFYOUCAN.Settings.InstantFollow.Hint"),
            scope: "world",
            config: true,
            type: Boolean,
            default: true
        });

        // Ajouter un paramètre pour stocker les relations de suivi
        game.settings.register("follow-me-if-you-can", "followRelationships", {
            scope: "world",
            config: false,
            type: Array,
            default: []
        });
    }

    static ready() {
        if (game.user.isGM) {
            createFloatingControls();
        }
    }
}

// Stockage global des suivis
let followData = {
    relationships: new Map(), // Stocke les relations de suivi (qui suit qui)
    saveToFlags: async function() {
        const data = Array.from(this.relationships.values());
        await game.settings.set('follow-me-if-you-can', 'followRelationships', data);
    },
    loadFromFlags: async function() {
        const data = game.settings.get('follow-me-if-you-can', 'followRelationships') || [];
        this.relationships.clear();
        data.forEach(rel => {
            this.relationships.set(rel.followerId, rel);
        });
        return data;
    },
    clearAll: async function() {
        this.relationships.clear();
        await game.settings.set('follow-me-if-you-can', 'followRelationships', []);
    }
};

// Fonction pour mettre à jour la position des contrôles
function updateControlsPosition(container) {
    const sidebar = document.getElementById('sidebar');
    const sidebarWidth = sidebar ? sidebar.getBoundingClientRect().width : 300;
    const isSidebarCollapsed = sidebar ? sidebar.classList.contains('collapsed') : false;
    
    container.style.right = isSidebarCollapsed ? 
        '100px' : // Si le sidebar est replié
        `calc(${sidebarWidth}px + 20px)`; // Si le sidebar est déplié
}

// Création des boutons flottants
function createFloatingControls() {
    let controlsContainer = document.getElementById('follow-me-controls');
    if (controlsContainer) {
        return;
    }
    
    controlsContainer = document.createElement('div');
    controlsContainer.id = 'follow-me-controls';
    
    Object.assign(controlsContainer.style, {
        position: 'fixed',
        top: '80px',
        right: 'calc(310px + 20px)',
        display: 'flex',
        flexDirection: 'column',
        gap: '10px',
        zIndex: '70',
        pointerEvents: 'all'
    });
    
    const interfaceElement = document.getElementById('interface');
    if (interfaceElement) {
        interfaceElement.appendChild(controlsContainer);
    } else {
        document.body.appendChild(controlsContainer);
    }

    // Gestionnaires d'événements pour la position
    window.addEventListener('resize', () => updateControlsPosition(controlsContainer));
    if (ui.sidebar) {
        const sidebarElement = document.getElementById('sidebar');
        const observer = new MutationObserver(() => updateControlsPosition(controlsContainer));
        observer.observe(sidebarElement, { attributes: true });
    }

    // Bouton Start
    const startButton = document.createElement('div');
    startButton.className = 'follow-me-button';
    Object.assign(startButton.style, {
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        width: '44px',
        height: '44px',
        borderRadius: '50%',
        background: 'rgba(50, 50, 50, 0.9)',
        border: '2px solid #ffd700',
        cursor: 'pointer',
        boxShadow: '0 0 10px rgba(0, 0, 0, 0.5)',
        transition: 'all 0.2s ease',
        pointerEvents: 'all',
        margin: '5px'
    });
    
    startButton.innerHTML = '<i class="fas fa-user-plus" style="color: #ffd700; font-size: 22px;"></i>';
    startButton.title = game.i18n.localize("FOLLOWMEIFYOUCAN.Controls.Start");
    startButton.onclick = () => {
        const followerToken = canvas.tokens.controlled[0];
        if (followerToken) {
            selectionMode = true;
            sourceToken = followerToken;
            ui.notifications.info(game.i18n.localize("FOLLOWMEIFYOUCAN.Notifications.SelectTarget"));
        } else {
            ui.notifications.warn(game.i18n.localize("FOLLOWMEIFYOUCAN.Notifications.NoActiveFollowing"));
        }
    };
    
    // Effets de hover pour Start
    startButton.onmouseover = () => {
        startButton.style.transform = 'scale(1.1)';
        startButton.style.background = 'rgba(70, 70, 70, 0.95)';
        startButton.style.boxShadow = '0 0 15px rgba(255, 215, 0, 0.5)';
    };
    startButton.onmouseout = () => {
        startButton.style.transform = 'scale(1)';
        startButton.style.background = 'rgba(50, 50, 50, 0.9)';
        startButton.style.boxShadow = '0 0 10px rgba(0, 0, 0, 0.5)';
    };
    
    controlsContainer.appendChild(startButton);

    // Bouton Stop
    const stopButton = document.createElement('div');
    stopButton.className = 'follow-me-button';
    Object.assign(stopButton.style, {
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        width: '44px',
        height: '44px',
        borderRadius: '50%',
        background: 'rgba(50, 50, 50, 0.9)',
        border: '2px solid #ffd700',
        cursor: 'pointer',
        boxShadow: '0 0 10px rgba(0, 0, 0, 0.5)',
        transition: 'all 0.2s ease',
        pointerEvents: 'all',
        margin: '5px'
    });
    
    stopButton.innerHTML = '<i class="fas fa-user-slash" style="color: #ffd700; font-size: 22px;"></i>';
    stopButton.title = game.i18n.localize("FOLLOWMEIFYOUCAN.Controls.StopAll");
    stopButton.onclick = () => {
        let count = 0;

        if (game.follow?.hooks) {
            const entries = Array.from(game.follow.hooks.entries());
            for (const [followerId, hookId] of entries) {
                Hooks.off('updateToken', hookId);
                game.follow.hooks.delete(followerId);
                count++;
            }
        }

        followData.clearAll();

        if (count > 0) {
            ui.notifications.info(game.i18n.format("FOLLOWMEIFYOUCAN.Notifications.FollowingStopped", {
                count: count
            }));
        } else {
            ui.notifications.warn(game.i18n.localize("FOLLOWMEIFYOUCAN.Notifications.NoFollowers"));
        }
    };
    
    // Effets de hover pour Stop
    stopButton.onmouseover = () => {
        stopButton.style.transform = 'scale(1.1)';
        stopButton.style.background = 'rgba(70, 70, 70, 0.95)';
        stopButton.style.boxShadow = '0 0 15px rgba(255, 215, 0, 0.5)';
    };
    stopButton.onmouseout = () => {
        stopButton.style.transform = 'scale(1)';
        stopButton.style.background = 'rgba(50, 50, 50, 0.9)';
        stopButton.style.boxShadow = '0 0 10px rgba(0, 0, 0, 0.5)';
    };
    
    controlsContainer.appendChild(stopButton);
    updateControlsPosition(controlsContainer);
}

// Hooks pour maintenir les boutons
Hooks.on('canvasReady', () => {
    if (game.user.isGM) {
        setTimeout(() => {
            if (!document.getElementById('follow-me-controls')) {
                createFloatingControls();
            }
        }, 500);
    }
});

// Gestion de la sélection des tokens pour le suivi
Hooks.on('controlToken', (token, selected) => {
    if (!selectionMode || !selected || !sourceToken || token.id === sourceToken.id) return;
    
    startFollowing(sourceToken, token);
    selectionMode = false;
    token.control({releaseOthers: true});
});

// Stockage des dernières positions
const lastPositions = new Map();
let selectionMode = false;
let sourceToken = null;

// Classe pour le lien GitHub
class GitHubLink extends FormApplication {
    static get defaultOptions() {
        return mergeObject(super.defaultOptions, {
            id: "follow-me-github-link",
            title: "GitHub",
            template: "templates/settings/menu.html"
        });
    }

    render() {
        window.open("https://github.com/Frenchy-s-module", "_blank");
        return null;
    }
}

Hooks.once('init', FollowMeIfYouCan.init);
Hooks.once('ready', FollowMeIfYouCan.ready);

// Fonction pour démarrer le suivi entre deux tokens
function startFollowing(followerToken, targetToken) {
    // Vérifier si le suivi créerait une boucle
    if (isCircularFollowing(followerToken, targetToken)) {
        ui.notifications.warn(game.i18n.format("FOLLOWMEIFYOUCAN.Notifications.CircularFollowingPrevented", {
            follower: followerToken.name,
            target: targetToken.name
        }));
        return;
    }

    // Arrêter le suivi existant si présent
    if (game.follow?.hooks.get(followerToken.id)) {
        Hooks.off('updateToken', game.follow.hooks.get(followerToken.id));
    }

    // Sauvegarder la relation de suivi
    followData.relationships.set(followerToken.id, {
        followerId: followerToken.actor?.id || followerToken.id,
        followerName: followerToken.name,
        targetId: targetToken.actor?.id || targetToken.id,
        targetName: targetToken.name
    });
    followData.saveToFlags();

    // Créer un hook pour suivre les mises à jour du token cible
    const hookId = Hooks.on('updateToken', async (tokenDoc, changes) => {
        if (tokenDoc.id !== targetToken.id) return;

        // Détecter si c'est un drag and drop (changement de position)
        const isDragDrop = changes.x !== undefined && changes.y !== undefined;

        const followerTokenDoc = canvas.tokens.get(followerToken.id);
        if (!followerTokenDoc) {
            return;
        }

        // Vérifier si le token cible essaie de se déplacer sur la position du suiveur
        const targetDestX = changes.x ?? tokenDoc.x;
        const targetDestY = changes.y ?? tokenDoc.y;
        const isMovingToFollowerPosition = 
            Math.round(targetDestX / canvas.grid.size) === Math.round(followerTokenDoc.x / canvas.grid.size) &&
            Math.round(targetDestY / canvas.grid.size) === Math.round(followerTokenDoc.y / canvas.grid.size);

        if (isMovingToFollowerPosition) {
            return;
        }

        if (isDragDrop) {
            // Calculer la direction du mouvement
            const dx = changes.x - followerTokenDoc.x;
            const dy = changes.y - followerTokenDoc.y;
            const angle = Math.atan2(dy, dx);
            
            // Déterminer la direction principale du mouvement
            const offsetX = Math.round(Math.cos(angle)) * canvas.grid.size;
            const offsetY = Math.round(Math.sin(angle)) * canvas.grid.size;

            // Calculer la position finale du suiveur pour qu'il soit derrière le token suivi
            const followX = changes.x - offsetX;
            const followY = changes.y - offsetY;

            const isInstant = game.settings.get("follow-me-if-you-can", "instantFollow");
            await followerTokenDoc.document.update({
                x: followX,
                y: followY
            }, {animate: !isInstant});
        } else {
            // Déplacement normal (case par case)
            // Calculer la position cible une case derrière
            const targetX = changes.x ?? tokenDoc.x;
            const targetY = changes.y ?? tokenDoc.y;
            
            // Calculer la direction du mouvement
            const dx = targetX - followerTokenDoc.x;
            const dy = targetY - followerTokenDoc.y;
            const angle = Math.atan2(dy, dx);
            
            // Déterminer la direction principale du mouvement
            const offsetX = Math.round(Math.cos(angle)) * canvas.grid.size;
            const offsetY = Math.round(Math.sin(angle)) * canvas.grid.size;

            const isInstant = game.settings.get("follow-me-if-you-can", "instantFollow");
            await followerTokenDoc.document.update({
                x: targetX - offsetX,
                y: targetY - offsetY
            }, {animate: !isInstant});
        }
    });
    
    // Stocker le hook pour pouvoir l'arrêter plus tard
    if (!game.follow) game.follow = { hooks: new Map() };
    game.follow.hooks.set(followerToken.id, hookId);
    
    ui.notifications.info(game.i18n.format("FOLLOWMEIFYOUCAN.Notifications.StartedFollowing", {
        source: followerToken.name,
        target: targetToken.name
    }));
}

// Fonction pour vérifier si un suivi créerait une boucle
function isCircularFollowing(followerToken, targetToken) {
    if (!game.follow?.hooks) return false;
    
    let currentToken = targetToken;
    const visited = new Set();
    
    while (game.follow.hooks.has(currentToken.id)) {
        if (visited.has(currentToken.id)) return false;
        visited.add(currentToken.id);
        
        // Trouver le token que suit le token actuel
        const followedTokenId = Array.from(canvas.tokens.placeables).find(t => 
            Hooks.events.updateToken?.some(h => 
                h.fn.toString().includes(t.id) && 
                h.id === game.follow.hooks.get(currentToken.id)
            )
        )?.id;
        
        if (!followedTokenId) break;
        if (followedTokenId === followerToken.id) return true;
        
        currentToken = canvas.tokens.get(followedTokenId);
        if (!currentToken) break;
    }
    
    return false;
}

// Fonction pour arrêter le suivi
function stopFollowing(followerId) {
    if (!game.follow?.hooks) return;
    
    const hookId = game.follow.hooks.get(followerId);
    if (hookId) {
        Hooks.off('updateToken', hookId);
        game.follow.hooks.delete(followerId);
        followData.relationships.delete(followerId);
        followData.saveToFlags();
    }
}

// Nettoyage lors de la suppression d'un token
Hooks.on('deleteToken', (token) => {
    stopFollowing(token.id);
});

// Gestion du changement de scène
Hooks.on('canvasReady', async () => {
    // Si l'option est activée, restaurer les suivis
    if (game.settings.get('follow-me-if-you-can', 'keepFollowingOnSceneChange')) {
        const relationships = await followData.loadFromFlags();
        
        if (relationships && relationships.length > 0) {
            for (const rel of relationships) {
                // Chercher les tokens correspondants dans la scène actuelle
                const followerToken = canvas.tokens.placeables.find(t => 
                    t.actor?.id === rel.followerId || t.id === rel.followerId
                );
                const targetToken = canvas.tokens.placeables.find(t => 
                    t.actor?.id === rel.targetId || t.id === rel.targetId
                );
                
                if (followerToken && targetToken) {
                    startFollowing(followerToken, targetToken);
                }
            }
        }
    }
});

// Fonction pour réenregistrer les hooks
function registerHooks() {
    Hooks.on('updateToken', handleTokenUpdate);
}

// Fonction pour gérer la mise à jour des tokens
async function handleTokenUpdate(tokenDoc, changes) {
    // Votre logique de suivi ici
}

// Enregistrer les hooks lors de l'initialisation
Hooks.once('init', () => {
    registerHooks();
});

// Réenregistrer les hooks lors du changement de scène
Hooks.on('canvasReady', () => {
    registerHooks();
});