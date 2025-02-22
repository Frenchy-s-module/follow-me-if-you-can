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

        // Enregistrer les hooks pour les boutons de contrôle
        FollowMeIfYouCan.registerSceneControls();
    }

    static ready() {
        if (game.user.isGM) {
            createFloatingControls();
            // Forcer la mise à jour des contrôles
            ui.controls.render();
        }
    }

    static registerSceneControls() {
        // Ajouter les boutons dans la barre d'outils principale à gauche
        Hooks.on('getSceneControlButtons', (controls) => {
            const tokenTools = controls.find(c => c.name === "token");
            if (tokenTools) {
                tokenTools.tools.push(
                    {
                        name: "follow-start",
                        title: game.i18n.localize("FOLLOWMEIFYOUCAN.Controls.Start"),
                        icon: "fas fa-user-plus",
                        button: true,
                        visible: game.user.isGM,
                        onClick: () => {
                            const followerToken = canvas.tokens.controlled[0];
                            if (followerToken) {
                                selectionMode = true;
                                sourceToken = followerToken;
                                ui.notifications.info(game.i18n.localize("FOLLOWMEIFYOUCAN.Notifications.SelectTarget"));
                            } else {
                                ui.notifications.warn(game.i18n.localize("FOLLOWMEIFYOUCAN.Notifications.NoActiveFollowing"));
                            }
                        }
                    },
                    {
                        name: "follow-stop",
                        title: game.i18n.localize("FOLLOWMEIFYOUCAN.Controls.StopAll"),
                        icon: "fas fa-user-slash",
                        button: true,
                        visible: game.user.isGM,
                        onClick: () => {
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
                                ui.notifications.warn(game.i18n.localize("FOLLOWMEIFYOUCAN.Notifications.NoActiveFollowing"));
                            }
                        }
                    }
                );
            }
        });

        // Forcer la mise à jour des contrôles après le chargement de la scène
        Hooks.on('canvasReady', () => {
            if (game.user.isGM) {
                ui.controls.render();
            }
        });
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
    // Créer les boutons flottants
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
        pointerEvents: 'all',
        cursor: 'move' // Curseur pour indiquer que c'est déplaçable
    });

    // Rendre le conteneur déplaçable
    let isDragging = false;
    let currentX;
    let currentY;
    let initialX;
    let initialY;

    controlsContainer.addEventListener('mousedown', (e) => {
        isDragging = true;
        initialX = e.clientX - controlsContainer.offsetLeft;
        initialY = e.clientY - controlsContainer.offsetTop;
    });

    document.addEventListener('mousemove', (e) => {
        if (isDragging) {
            e.preventDefault();
            currentX = e.clientX - initialX;
            currentY = e.clientY - initialY;
            
            controlsContainer.style.left = `${currentX}px`;
            controlsContainer.style.top = `${currentY}px`;
            controlsContainer.style.right = 'auto';
        }
    });

    document.addEventListener('mouseup', () => {
        isDragging = false;
    });
    
    const interfaceElement = document.getElementById('interface');
    if (interfaceElement) {
        interfaceElement.appendChild(controlsContainer);
    } else {
        document.body.appendChild(controlsContainer);
    }

    // Création des boutons
    const createButton = (icon, title, onClick) => {
        const button = document.createElement('div');
        button.className = 'follow-me-button';
        Object.assign(button.style, {
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
        
        button.innerHTML = `<i class="${icon}" style="color: #ffd700; font-size: 22px;"></i>`;
        button.title = title;
        button.onclick = onClick;
        
        // Effets de hover
        button.onmouseover = () => {
            button.style.transform = 'scale(1.1)';
            button.style.background = 'rgba(70, 70, 70, 0.95)';
            button.style.boxShadow = '0 0 15px rgba(255, 215, 0, 0.5)';
        };
        button.onmouseout = () => {
            button.style.transform = 'scale(1)';
            button.style.background = 'rgba(50, 50, 50, 0.9)';
            button.style.boxShadow = '0 0 10px rgba(0, 0, 0, 0.5)';
        };
        
        return button;
    };

    // Bouton Start
    const startButton = createButton(
        'fas fa-user-plus',
        game.i18n.localize("FOLLOWMEIFYOUCAN.Controls.Start"),
        () => {
            const followerToken = canvas.tokens.controlled[0];
            if (followerToken) {
                selectionMode = true;
                sourceToken = followerToken;
                ui.notifications.info(game.i18n.localize("FOLLOWMEIFYOUCAN.Notifications.SelectTarget"));
            } else {
                ui.notifications.warn(game.i18n.localize("FOLLOWMEIFYOUCAN.Notifications.NoActiveFollowing"));
            }
        }
    );
    
    // Bouton Stop
    const stopButton = createButton(
        'fas fa-user-slash',
        game.i18n.localize("FOLLOWMEIFYOUCAN.Controls.StopAll"),
        () => {
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
                ui.notifications.warn(game.i18n.localize("FOLLOWMEIFYOUCAN.Notifications.NoActiveFollowing"));
            }
        }
    );
    
    controlsContainer.appendChild(startButton);
    controlsContainer.appendChild(stopButton);

    // Ajouter les boutons dans l'onglet "Outils de token"
    Hooks.on('renderTokenTools', (app, html) => {
        const tokenTools = html.find('#token-tools');
        if (!tokenTools.length) return;

        const tokenButtons = document.createElement('div');
        tokenButtons.className = 'follow-me-token-buttons';
        Object.assign(tokenButtons.style, {
            display: 'flex',
            flexDirection: 'column',
            gap: '5px',
            margin: '5px'
        });

        // Créer des copies des boutons pour l'onglet token
        const tokenStartButton = createButton(
            'fas fa-user-plus',
            game.i18n.localize("FOLLOWMEIFYOUCAN.Controls.Start"),
            startButton.onclick
        );
        const tokenStopButton = createButton(
            'fas fa-user-slash',
            game.i18n.localize("FOLLOWMEIFYOUCAN.Controls.StopAll"),
            stopButton.onclick
        );

        // Ajouter un titre pour la section
        const title = document.createElement('h3');
        title.textContent = 'Follow Me';
        title.style.borderBottom = '1px solid #782e22';
        title.style.marginBottom = '5px';
        title.style.paddingBottom = '3px';
        title.style.color = '#b5b3a4';
        
        tokenButtons.appendChild(title);
        tokenButtons.appendChild(tokenStartButton);
        tokenButtons.appendChild(tokenStopButton);

        // Ajouter les boutons au début de la section des outils de token
        tokenTools.prepend(tokenButtons);
    });
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