// Initialisation du module
class FollowMeIfYouCan {
    static init() {
        console.log("Follow Me If You Can | Initializing module");
        
        // Ajout du lien vers GitHub
        game.settings.registerMenu("follow-me-if-you-can", "githubLink", {
            name: "GitHub",
            label: "GitHub",
            hint: game.i18n.localize("FOLLOWMEIFYOUCAN.Settings.GitHub.Hint"),
            icon: "fab fa-github",
            type: GitHubLink,
            restricted: false
        });
        
        // Enregistrer les paramètres du module
        game.settings.register("follow-me-if-you-can", "keepFollowing", {
            name: game.i18n.localize("FOLLOWMEIFYOUCAN.Settings.KeepFollowing.Name"),
            hint: game.i18n.localize("FOLLOWMEIFYOUCAN.Settings.KeepFollowing.Hint"),
            scope: "world",
            config: true,
            type: Boolean,
            default: true,
            onChange: () => window.location.reload()
        });
        
        game.settings.register("follow-me-if-you-can", "instantFollow", {
            name: game.i18n.localize("FOLLOWMEIFYOUCAN.Settings.InstantFollow.Name"),
            hint: game.i18n.localize("FOLLOWMEIFYOUCAN.Settings.InstantFollow.Hint"),
            scope: "world",
            config: true,
            type: Boolean,
            default: false,
            onChange: () => window.location.reload()
        });
        
        game.settings.register("follow-me-if-you-can", "playerAccess", {
            name: game.i18n.localize("FOLLOWMEIFYOUCAN.Settings.PlayerAccess.Name"),
            hint: game.i18n.localize("FOLLOWMEIFYOUCAN.Settings.PlayerAccess.Hint"),
            scope: "world",
            config: true,
            type: Boolean,
            default: true,
            onChange: () => window.location.reload()
        });
        
        game.settings.register("follow-me-if-you-can", "showFloatingButtons", {
            name: game.i18n.localize("FOLLOWMEIFYOUCAN.Settings.ShowFloatingButtons.Name"),
            hint: game.i18n.localize("FOLLOWMEIFYOUCAN.Settings.ShowFloatingButtons.Hint"),
            scope: "world",
            config: true,
            type: Boolean,
            default: true,
            onChange: () => window.location.reload()
        });
        
        // Position par défaut des contrôles MJ
        const defaultPosition = {
            top: '70px',
            right: '310px',
            left: 'auto'
        };
        
        // Enregistrer la position des contrôles MJ
        game.settings.register("follow-me-if-you-can", "controlsPosition", {
            scope: "world",
            config: false,
            type: Object,
            default: defaultPosition
        });
        
        // Enregistrer la position par défaut des contrôles MJ (ne sera jamais modifié)
        game.settings.register("follow-me-if-you-can", "defaultControlsPosition", {
            scope: "world",
            config: false,
            type: Object,
            default: defaultPosition
        });
        
        // Position par défaut des contrôles joueur
        const defaultPlayerPosition = {
            top: '80px',
            bottom: 'auto',
            // right: 'auto',
            left: '120px'
        };
        
        // Enregistrer la position des contrôles joueur - pour le MJ uniquement
        game.settings.register("follow-me-if-you-can", "playerControlsPosition", {
            scope: "world",
            config: false,
            type: Object,
            default: defaultPlayerPosition
        });
        
        // Enregistrer la position par défaut des contrôles joueur (ne sera jamais modifié)
        game.settings.register("follow-me-if-you-can", "defaultPlayerControlsPosition", {
            scope: "world",
            config: false,
            type: Object,
            default: defaultPlayerPosition
        });
        
        // Stocker les relations de suivi
        game.settings.register("follow-me-if-you-can", "followRelationships", {
            scope: "world",
            config: false,
            type: Array,
            default: []
        });
        
        // Enregistrer l'écouteur pour les contrôles de scène
        Hooks.on('getSceneControlButtons', (controls) => {
            FollowMeIfYouCan.registerSceneControls(controls);
        });
    }
    
    static ready() {
        console.log("Follow Me If You Can | Ready hook triggered");
        
        // Initialiser le système de suivi
        game.follow = game.follow || {
            hooks: new Map(),
            targets: new Map()
        };
        
        // Maintenant que game.user est disponible, on peut l'utiliser en toute sécurité
        if (game.user.isGM) {
            createFloatingControls();
            
            // Initialiser la communication socket côté MJ
            FollowMeIfYouCan.initSocketListeners();
            
            // Le MJ envoie un message "ready" pour informer tous les clients que le système de socket est prêt
            setTimeout(() => {
                game.socket.emit('module.follow-me-if-you-can', {
                    action: 'gmReady',
                    timestamp: Date.now()
                });
                console.log("Follow Me If You Can | GM Ready signal sent to players");
            }, 2000); // Attendre 2 secondes pour s'assurer que tout est chargé
        } else {
            // Pour les joueurs, stockage local des positions (client-side)
            const defaultPlayerPosition = game.settings.get("follow-me-if-you-can", "defaultPlayerControlsPosition");
            // Forcer l'utilisation des nouvelles positions par défaut
            localStorage.removeItem('followme-playerControlsPosition');
            localStorage.setItem('followme-playerControlsPosition', JSON.stringify(defaultPlayerPosition));
            
            createPlayerControls();
            
            // Initialiser la communication socket côté joueur
            game.socket.on('module.follow-me-if-you-can', (data) => {
                console.log("Follow Me If You Can | Socket message received by player:", data);
                
                try {
                    // Messages pour tout le monde
                    if (data.action === 'refreshControls') {
                        // Rafraîchir les contrôles flottants
                        console.log("Follow Me If You Can | Refreshing floating controls");
                        if (document.getElementById('follow-me-player-controls')) {
                            document.getElementById('follow-me-player-controls').remove();
                        }
                        createPlayerControls();
                    }
                    else if (data.action === 'socketTest' && data.response && data.testId) {
                        // Ne rien faire ici, le gestionnaire temporaire dans testSocketConnection s'en occupera
                        console.log("Follow Me If You Can | Socket test response received with ID:", data.testId);
                    }
                    else if (data.action === 'gmReady') {
                        console.log("Follow Me If You Can | GM socket system is ready");
                        // Informer le joueur que le MJ est prêt à recevoir des demandes de suivi
                        // ui.notifications.info(game.i18n.localize("FOLLOWMEIFYOUCAN.Notifications.GMReady"));
                    }
                } catch (error) {
                    console.error("Follow Me If You Can | Error processing socket message:", error);
                    ui.notifications.error(game.i18n.localize("FOLLOWMEIFYOUCAN.Errors.SocketProcessingError"));
                }
            });
        }
    }
    
    static initSocketListeners() {
        // Écouter les messages socket
        game.socket.on('module.follow-me-if-you-can', (data) => {
            console.log("Follow Me If You Can | Socket message received by GM:", data);
            
            try {
                // Messages destinés uniquement au MJ
                if (game.user.isGM) {
                    if (data.action === 'requestFollow') {
                        // Gérer la demande de suivi (anciennement dans initializeSocketListener)
                        const { playerId, followerTokenId, targetTokenId } = data;
                        const followerToken = canvas.tokens.get(followerTokenId);
                        const targetToken = canvas.tokens.get(targetTokenId);
                        
                        if (followerToken && targetToken) {
                            // Démarrer automatiquement le suivi sans confirmation
                            startFollowing(followerToken, targetToken);
                            
                            // Notification au MJ
                            ui.notifications.info(game.i18n.format("FOLLOWMEIFYOUCAN.Notifications.PlayerRequestedFollow", {
                                playerName: game.users.get(playerId)?.name || "Joueur",
                                followerName: followerToken.name,
                                target: targetToken.name
                            }));
                        }
                    } 
                    else if (data.action === 'savePlayerPosition') {
                        // Le MJ sauvegarde la position pour le joueur
                        game.settings.set("follow-me-if-you-can", "playerControlsPosition", data.position);
                        console.log("Follow Me If You Can | Player controls position saved by GM:", data.position);
                        
                        // Informer tous les clients que les positions ont été mises à jour
                        game.socket.emit('module.follow-me-if-you-can', {
                            action: 'refreshControls'
                        });
                    }
                    else if (data.action === 'socketTest') {
                        // Répondre au message de test pour confirmer que le socket fonctionne
                        console.log("Follow Me If You Can | Received socket test, sending response for ID:", data.testId);
                        game.socket.emit('module.follow-me-if-you-can', {
                            action: 'socketTest',
                            testId: data.testId,
                            response: true
                        });
                    }
                }
                
                // Messages pour tout le monde
                if (data.action === 'refreshControls') {
                    // Rafraîchir les contrôles flottants
                    console.log("Follow Me If You Can | Refreshing floating controls");
                    if (game.user.isGM) {
                        if (document.getElementById('follow-me-controls')) {
                            document.getElementById('follow-me-controls').remove();
                        }
                        createFloatingControls();
                    }
                }
            } catch (error) {
                console.error("Follow Me If You Can | Error processing socket message:", error);
                ui.notifications.error(game.i18n.localize("FOLLOWMEIFYOUCAN.Errors.SocketProcessingError"));
            }
        });
    }

    static registerSceneControls(controls) {
        if (game.user.isGM || game.settings.get("follow-me-if-you-can", "playerAccess")) {
            const tokenControls = controls.find(c => c.name === "token");
            
            if (tokenControls) {
                tokenControls.tools.push({
                    name: "follow",
                    title: game.i18n.localize("FOLLOWMEIFYOUCAN.Controls.Start"),
                    icon: "fas fa-user-plus",
                    onClick: () => {
                        if (canvas.tokens.controlled.length === 0) {
                            ui.notifications.warn(game.i18n.localize("FOLLOWMEIFYOUCAN.Notifications.NoActiveToken"));
                            return;
                        }
                        
                        const followerToken = canvas.tokens.controlled[0];
                        
                        if (game.user.isGM) {
                            activateSelectionMode(followerToken);
                        } else {
                            showTokenSelectionDialog(followerToken);
                        }
                    },
                    button: true,
                    visible: true
                });
                
                // Bouton Stop uniquement visible pour le MJ
                if (game.user.isGM) {
                    tokenControls.tools.push({
                        name: "stopAllFollowing",
                        title: game.i18n.localize("FOLLOWMEIFYOUCAN.Controls.StopAll"),
                        icon: "fas fa-user-slash",
                        onClick: () => {
                            showStopFollowingDialog();
                        },
                        button: true,
                        visible: true
                    });
                }
            }
        }
    }

    static initializeSocketListener() {
        // Suppression de cette méthode qui est maintenant fusionnée avec initSocketListeners
    }
}

// Stockage global des suivis
const followData = {
    relationships: new Map(), // Stocke les relations de suivi (qui suit qui)
    saveToFlags: async function() {
        try {
            // Vérifier que le jeu est complètement initialisé avant de sauvegarder
            if (!game.ready) {
                console.log("Follow Me If You Can | Game not ready yet, delaying save operation");
                // Programmer un enregistrement différé
                setTimeout(() => this.saveToFlags(), 1000);
                return;
            }
            
            const data = Array.from(this.relationships.values());
            await game.settings.set('follow-me-if-you-can', 'followRelationships', data);
            console.log("Follow Me If You Can | Saved follow relationships to settings");
        } catch (error) {
            console.error("Follow Me If You Can | Error saving follow relationships:", error);
        }
    },
    loadFromFlags: async function() {
        try {
            const data = game.settings.get('follow-me-if-you-can', 'followRelationships') || [];
            console.log("Follow Me If You Can | Loaded follow relationships from settings:", data);
            this.relationships.clear();
            data.forEach(rel => {
                this.relationships.set(rel.followerId, rel);
            });
            return data;
        } catch (error) {
            console.error("Follow Me If You Can | Error loading follow relationships:", error);
            return [];
        }
    },
    clearAll: async function() {
        try {
            this.relationships.clear();
            await game.settings.set("follow-me-if-you-can", "followRelationships", []);
            console.log("Follow Me If You Can | Cleared all follow relationships");
        } catch (error) {
            console.error("Follow Me If You Can | Error clearing follow relationships:", error);
        }
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
    // Vérifier si les boutons flottants sont activés
    if (!game.settings.get("follow-me-if-you-can", "showFloatingButtons")) {
        return;
    }
    
    // Créer les boutons flottants
    let controlsContainer = document.getElementById('follow-me-controls');
    if (controlsContainer) {
        return;
    }
    
    controlsContainer = document.createElement('div');
    controlsContainer.id = 'follow-me-controls';
    
    // Charger la position sauvegardée
    const savedPosition = game.settings.get("follow-me-if-you-can", "controlsPosition");
    Object.assign(controlsContainer.style, {
        position: 'fixed',
        top: savedPosition.top,
        right: savedPosition.right,
        left: savedPosition.left,
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
        // Vérifier si l'élément cliqué est le conteneur lui-même et non pas un bouton
        if (e.target === controlsContainer) {
            isDragging = true;
            initialX = e.clientX - controlsContainer.offsetLeft;
            initialY = e.clientY - controlsContainer.offsetTop;
        }
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
        if (isDragging) {
            // Sauvegarder la nouvelle position
            game.settings.set("follow-me-if-you-can", "controlsPosition", {
                top: controlsContainer.style.top,
                right: controlsContainer.style.right,
                left: controlsContainer.style.left
            });
        }
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
            // Montrer la boîte de dialogue pour sélectionner les suivis à arrêter
            showStopFollowingDialog();
        }
    );
    
    // Bouton Home pour réinitialiser la position
    const homeButton = createButton(
        'fas fa-home',
        game.i18n.localize("FOLLOWMEIFYOUCAN.Controls.Home"),
        () => {
            // Récupérer la position par défaut
            const defaultPosition = game.settings.get("follow-me-if-you-can", "defaultControlsPosition");
            
            // Appliquer la position par défaut
            Object.assign(controlsContainer.style, {
                top: defaultPosition.top,
                right: defaultPosition.right,
                left: defaultPosition.left
            });
            
            // Sauvegarder la position par défaut
            game.settings.set("follow-me-if-you-can", "controlsPosition", defaultPosition);
            
            ui.notifications.info(game.i18n.localize("FOLLOWMEIFYOUCAN.Notifications.ResetPosition"));
        }
    );
    
    controlsContainer.appendChild(startButton);
    controlsContainer.appendChild(stopButton);
    controlsContainer.appendChild(homeButton);

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

// Fonction pour créer les contrôles pour les joueurs
function createPlayerControls() {
    if (game.user.isGM || !game.settings.get("follow-me-if-you-can", "showFloatingButtons") || !game.settings.get("follow-me-if-you-can", "playerAccess")) {
        return;
    }
    
    // Si les contrôles existent déjà, les supprimer
    const existingControls = document.getElementById('follow-me-player-controls');
    if (existingControls) {
        existingControls.remove();
    }
    
    // Conteneur principal
    const playerControlsContainer = document.createElement('div');
    playerControlsContainer.id = 'follow-me-player-controls';
    playerControlsContainer.classList.add('follow-me-controls');
    
    // Style commun pour tous les joueurs
    Object.assign(playerControlsContainer.style, {
        position: 'fixed',
        zIndex: '100',
        display: 'flex',
        flexDirection: 'column',
        pointerEvents: 'all',
        cursor: 'move'  // Curseur pour indiquer que c'est déplaçable
    });
    
    // Ajouter une poignée de déplacement (drag handle)
    const dragHandle = document.createElement('div');
    dragHandle.classList.add('follow-me-drag-handle');
    dragHandle.title = game.i18n.localize("FOLLOWMEIFYOUCAN.Controls.DragHandle");
    Object.assign(dragHandle.style, {
        width: '100%',
        height: '14px',
        backgroundColor: 'rgba(50, 50, 50, 0.7)',
        borderRadius: '5px 5px 0 0',
        display: 'flex',
        justifyContent: 'center',
        alignItems: 'center',
        marginBottom: '3px'
    });
    
    // Ajouter des points pour indiquer visuellement que c'est déplaçable
    dragHandle.innerHTML = '<i class="fas fa-grip-lines" style="color: #ffd700; font-size: 10px;"></i>';
    
    // Ajouter la poignée au conteneur
    playerControlsContainer.appendChild(dragHandle);
    
    // Récupérer la position sauvegardée dans le localStorage
    let savedPosition;
    try {
        savedPosition = JSON.parse(localStorage.getItem('followme-playerControlsPosition'));
    } catch (e) {
        console.error("Follow Me If You Can | Error parsing player controls position:", e);
        savedPosition = null;
    }
    
    // Position par défaut si aucune position sauvegardée
    const defaultPosition = game.settings.get("follow-me-if-you-can", "defaultPlayerControlsPosition");
    const currentPosition = savedPosition || defaultPosition;
    
    // Appliquer la position
    Object.assign(playerControlsContainer.style, {
        top: currentPosition.top,
        bottom: currentPosition.bottom,
        right: currentPosition.right,
        left: currentPosition.left
    });
    
    // Rendre le conteneur déplaçable
    playerControlsContainer.setAttribute('draggable', 'true');
    
    // Variables pour le drag and drop
    let isDragging = false;
    let offsetX, offsetY;
    
    // Événements pour le drag and drop
    playerControlsContainer.addEventListener('dragstart', (e) => {
        // Empêcher l'aperçu fantôme par défaut
        const img = new Image();
        img.src = 'data:image/gif;base64,R0lGODlhAQABAIAAAAUEBAAAACwAAAAAAQABAAACAkQBADs=';
        e.dataTransfer.setDragImage(img, 0, 0);
        
        // Enregistrer la position initiale
        const rect = playerControlsContainer.getBoundingClientRect();
        offsetX = e.clientX - rect.left;
        offsetY = e.clientY - rect.top;
        
        isDragging = true;
    });
    
    // Au lieu de dragover, utiliser mousemove pour un mouvement plus fluide
    document.addEventListener('dragover', (e) => {
        e.preventDefault();
        if (!isDragging) return;
        
        // Calculer nouvelle position
        const newLeft = e.clientX - offsetX;
        const newTop = e.clientY - offsetY;
        
        // Vérifier que ça reste dans les limites de la fenêtre
        const windowWidth = window.innerWidth;
        const windowHeight = window.innerHeight;
        const controlWidth = playerControlsContainer.offsetWidth;
        const controlHeight = playerControlsContainer.offsetHeight;
        
        // Appliquer la position
        if (newLeft >= 0 && newLeft + controlWidth <= windowWidth) {
            playerControlsContainer.style.left = newLeft + 'px';
            playerControlsContainer.style.right = 'auto';
        }
        
        if (newTop >= 0 && newTop + controlHeight <= windowHeight) {
            playerControlsContainer.style.top = newTop + 'px';
            playerControlsContainer.style.bottom = 'auto';
        }
    });

    playerControlsContainer.addEventListener('dragend', (e) => {
        isDragging = false;
        
        // Sauvegarder la nouvelle position
        const newPosition = {
            top: playerControlsContainer.style.top,
            bottom: playerControlsContainer.style.bottom,
            right: playerControlsContainer.style.right,
            left: playerControlsContainer.style.left
        };
        
        // Sauvegarder localement
        localStorage.setItem('followme-playerControlsPosition', JSON.stringify(newPosition));
        
        // Envoyer la position au MJ via socket pour sauvegarde globale
        game.socket.emit('module.follow-me-if-you-can', {
            action: 'savePlayerPosition',
            position: newPosition,
            playerId: game.user.id
        });
        
        // Notification
        // ui.notifications.info(game.i18n.localize("FOLLOWMEIFYOUCAN.Notifications.PositionSaved"));
    });
    
    const interfaceElement = document.getElementById('interface');
    if (interfaceElement) {
        interfaceElement.appendChild(playerControlsContainer);
    } else {
        document.body.appendChild(playerControlsContainer);
    }

    // Création des boutons
    const createButton = (icon, title, onClick) => {
        const button = document.createElement('div');
        button.className = 'follow-me-player-button';
        Object.assign(button.style, {
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            width: '44px',
            height: '44px',
            borderRadius: '50%',
            background: 'rgba(50, 50, 50, 0.9)',
            border: '2px solid #5ea8dc',
            cursor: 'pointer',
            boxShadow: '0 0 10px rgba(0, 0, 0, 0.5)',
            transition: 'all 0.2s ease',
            pointerEvents: 'all',
            margin: '5px'
        });
        
        button.innerHTML = `<i class="${icon}" style="color: #5ea8dc; font-size: 22px;"></i>`;
        button.title = title;
        button.onclick = onClick;
        
        // Effets de hover
        button.onmouseover = () => {
            button.style.transform = 'scale(1.1)';
            button.style.background = 'rgba(70, 70, 70, 0.95)';
            button.style.boxShadow = '0 0 15px rgba(94, 168, 220, 0.5)';
        };
        button.onmouseout = () => {
            button.style.transform = 'scale(1)';
            button.style.background = 'rgba(50, 50, 50, 0.9)';
            button.style.boxShadow = '0 0 10px rgba(0, 0, 0, 0.5)';
        };
        
        return button;
    };

    // Bouton de suivi pour les joueurs
    const playerFollowButton = createButton(
        'fas fa-user-plus',
        game.i18n.localize("FOLLOWMEIFYOUCAN.Controls.Start"),
        () => {
            const followerToken = canvas.tokens.controlled[0];
            
            if (followerToken) {
                // Au lieu d'activer le mode sélection, afficher directement une boîte de dialogue
                // avec la liste des tokens disponibles
                showTokenSelectionDialog(followerToken);
            } else {
                ui.notifications.warn(game.i18n.localize("FOLLOWMEIFYOUCAN.Notifications.NoActiveFollowing"));
            }
        }
    );
    
    // Bouton Home pour réinitialiser la position
    const playerHomeButton = createButton(
        'fas fa-home',
        game.i18n.localize("FOLLOWMEIFYOUCAN.Controls.Home"),
        () => {
            const defaultPosition = game.settings.get("follow-me-if-you-can", "defaultPlayerControlsPosition");
            
            Object.assign(playerControlsContainer.style, {
                top: defaultPosition.top,
                bottom: defaultPosition.bottom,
                right: defaultPosition.right,
                left: defaultPosition.left
            });
            
            // Sauvegarder localement
            localStorage.setItem('followme-playerControlsPosition', JSON.stringify(defaultPosition));
            
            // Envoyer la position au MJ via socket pour sauvegarde globale
            game.socket.emit('module.follow-me-if-you-can', {
                action: 'savePlayerPosition',
                position: defaultPosition,
                playerId: game.user.id
            });
            
            ui.notifications.info(game.i18n.localize("FOLLOWMEIFYOUCAN.Notifications.ResetPosition"));
        }
    );
    
    playerControlsContainer.appendChild(playerFollowButton);
    playerControlsContainer.appendChild(playerHomeButton);
}

// Fonction pour afficher une boîte de dialogue permettant de sélectionner un token à suivre
async function showTokenSelectionDialog(followerToken) {
    // Vérifier si on a accès au socket
    if (!game.socket) {
        ui.notifications.error(game.i18n.localize("FOLLOWMEIFYOUCAN.Errors.SocketNotAvailable"));
        console.error("Follow Me If You Can | Socket system is not available!");
        return;
    }

    // Tester la connexion socket avant d'afficher la boîte de dialogue
    const socketConnected = await testSocketConnection();
    if (!socketConnected) {
        ui.notifications.error(game.i18n.localize("FOLLOWMEIFYOUCAN.Errors.SocketConnectionFailed"));
        return;
    }
        
    // Obtenir les tokens visibles dans la scène actuelle
    const visibleTokens = canvas.tokens.placeables.filter(t => {
        // Filtrer les tokens invisibles pour le joueur et ignorer le token suiveur
        // DISPOSITION_FRIENDLY = 1, DISPOSITION_NEUTRAL = 0, DISPOSITION_HOSTILE = -1
        return t.visible && t.id !== followerToken.id && t.document.disposition === CONST.TOKEN_DISPOSITIONS.FRIENDLY;
    });
    
    if (visibleTokens.length === 0) {
        ui.notifications.warn(game.i18n.localize("FOLLOWMEIFYOUCAN.Notifications.NoVisibleTargets"));
        return;
    }
    
    let content = `
    <form>
        <div class="form-group">
            <label>${game.i18n.localize("FOLLOWMEIFYOUCAN.Dialog.SelectTarget.Label")}</label>
            <select id="target-token-select" name="target-token-select">`;
                
    // Ajouter chaque token à la liste déroulante
    visibleTokens.forEach(token => {
        content += `<option value="${token.id}">${token.name}</option>`;
    });
    
    content += `</select>
        </div>
    </form>`;
        
    // Afficher la boîte de dialogue
    new Dialog({
        title: game.i18n.localize("FOLLOWMEIFYOUCAN.Dialog.SelectTarget.Title"),
        content: content,
        buttons: {
            follow: {
                icon: '<i class="fas fa-user-plus"></i>',
                label: game.i18n.localize("FOLLOWMEIFYOUCAN.Dialog.SelectTarget.Follow"),
                callback: html => {
                    const targetId = html.find('#target-token-select').val();
                    const targetToken = canvas.tokens.get(targetId);
                    
                    if (targetToken) {
                        // Envoyer la requête au MJ via socket
                        sendFollowRequest(followerToken, targetToken);
                    }
                }
            },
            cancel: {
                icon: '<i class="fas fa-times"></i>',
                label: game.i18n.localize("FOLLOWMEIFYOUCAN.Dialog.Cancel")
            }
        },
        default: "follow"
    }).render(true);
}

// Fonction pour tester la connexion socket
async function testSocketConnection(maxRetries = 3) {
    return new Promise(async (resolve, reject) => {
        if (!game.socket) {
            console.error("Follow Me If You Can | Socket system is not available!");
            ui.notifications.error(game.i18n.localize("FOLLOWMEIFYOUCAN.Errors.SocketNotAvailable"));
            resolve(false);
            return;
        }
        
        // Vérifier que le MJ est connecté
        const gmConnected = Array.from(game.users).some(u => u.isGM && u.active);
        if (!gmConnected) {
            console.error("Follow Me If You Can | No GM connected to the game!");
            ui.notifications.error(game.i18n.localize("FOLLOWMEIFYOUCAN.Errors.NoGM"));
            resolve(false);
            return;
        }
        
        let retries = 0;
        const testId = Date.now();
        let responseReceived = false;
        
        // Fonction pour retenter en cas d'échec
        const retryConnection = () => {
            if (retries >= maxRetries) {
                console.error(`Follow Me If You Can | Socket test failed after ${maxRetries} attempts`);
                ui.notifications.error(game.i18n.localize("FOLLOWMEIFYOUCAN.Errors.SocketTestFailed"));
                resolve(false);
                return;
            }
            
            retries++;
            console.log(`Follow Me If You Can | Socket test attempt ${retries}/${maxRetries}`);
            
            // Envoyer un message test
            game.socket.emit('module.follow-me-if-you-can', {
                action: 'socketTest',
                testId: testId,
                request: true,
                senderId: game.user.id
            });
            
            // Définir un timeout pour cette tentative
            setTimeout(() => {
                if (!responseReceived) {
                    retryConnection();
                }
            }, 2000);
        };
        
        // Configurer l'écouteur pour la réponse
        const socketListener = (data) => {
            if (data.action === 'socketTest' && data.response && data.testId === testId) {
                console.log(`Follow Me If You Can | Socket test successful (attempt ${retries + 1}/${maxRetries})`);
                responseReceived = true;
                game.socket.off('module.follow-me-if-you-can', socketListener);
                resolve(true);
            }
        };
        
        // Attacher l'écouteur
        game.socket.on('module.follow-me-if-you-can', socketListener);
        
        // Lancer la première tentative
        retryConnection();
    });
}

// Fonction pour envoyer une requête de suivi avec gestion des erreurs
async function sendFollowRequest(followerToken, targetToken) {
    if (!followerToken || !targetToken) {
        ui.notifications.error(game.i18n.localize("FOLLOWMEIFYOUCAN.Errors.MissingParameters"));
        return;
    }
    
    // Tester la connexion socket avant d'envoyer la requête
    const socketConnected = await testSocketConnection();
    if (!socketConnected) {
        ui.notifications.error(game.i18n.localize("FOLLOWMEIFYOUCAN.Errors.SocketConnectionFailed"));
        return;
    }
    
    console.log("Follow Me If You Can | Sending follow request", {
        follower: followerToken.name,
        target: targetToken.name
    });
    
    // Vérifier qu'un token ne se suit pas lui-même
    if (followerToken.id === targetToken.id) {
        ui.notifications.warn(game.i18n.format("FOLLOWMEIFYOUCAN.Notifications.CannotFollowSelf", {
            followerName: followerToken.name,
            target: targetToken.name
        }));
        return;
    }
    
    try {
        // Envoyer la requête au MJ
        game.socket.emit('module.follow-me-if-you-can', {
            action: 'requestFollow',
            playerId: game.user.id,
            followerTokenId: followerToken.id,
            targetTokenId: targetToken.id
        });
        
        ui.notifications.info(game.i18n.format("FOLLOWMEIFYOUCAN.Notifications.FollowRequestSent", {
            followerName: followerToken.name,
            target: targetToken.name
        }));
    } catch (error) {
        console.error("Follow Me If You Can | Error sending follow request:", error);
        ui.notifications.error(game.i18n.localize("FOLLOWMEIFYOUCAN.Errors.SocketError"));
    }
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

// Hooks pour maintenir les boutons des joueurs
Hooks.on('canvasReady', async () => {
    if (!game.user.isGM && game.settings.get("follow-me-if-you-can", "playerAccess")) {
        setTimeout(async () => {
            try {
                // Tester la connexion socket avant d'afficher les boutons joueur
                const socketConnected = await testSocketConnection();
                if (socketConnected) {
                    console.log("Follow Me If You Can | Socket connected, creating player controls");
                    // Vérifier que les contrôles n'existent pas déjà
                    if (!document.getElementById('follow-me-player-controls')) {
                        createPlayerControls();
                    }
                } else {
                    console.error("Follow Me If You Can | Socket connection failed, player controls not created");
                }
            } catch (error) {
                console.error("Follow Me If You Can | Error during player controls initialization:", error);
            }
        }, 2000); // Délai de 2 secondes pour laisser le MJ initialiser
    }
});

// Fonction pour afficher la boîte de dialogue de sélection des suivis à arrêter
function showStopFollowingDialog() {
    if (!game.follow?.hooks || game.follow.hooks.size === 0) {
        ui.notifications.warn(game.i18n.localize("FOLLOWMEIFYOUCAN.Notifications.NoActiveFollowing"));
        return;
    }
    
    let relationshipsList = '';
    
    // Générer la liste des relations de suivi actives dans la scène courante
    game.follow.hooks.forEach((hookId, followerId) => {
        const followerToken = canvas.tokens.get(followerId);
        if (followerToken) {
            // Relation de suivi active dans la scène courante
            const relation = followData.relationships.get(followerId);
            if (relation) {
                relationshipsList += `
                <div class="form-group">
                    <label>
                        <input type="checkbox" data-type="follow" value="${followerId}" checked />
                        <span>${followerToken.name} → ${relation.targetName}</span>
                    </label>
                </div>`;
            }
        }
    });
    
    // Vérifier s'il existe des relations de suivi dans d'autres scènes
    const allRelationships = Array.from(followData.relationships.entries());
    const offSceneRelationships = allRelationships.filter(([id, _]) => !canvas.tokens.get(id));
    
    if (offSceneRelationships.length > 0) {
        relationshipsList += `<h3>${game.i18n.localize("FOLLOWMEIFYOUCAN.Dialog.StopFollowing.OtherScenes")}</h3>`;
        
        offSceneRelationships.forEach(([id, rel]) => {
            relationshipsList += `
            <div class="form-group">
                <label>
                    <input type="checkbox" data-type="follow" value="${id}" checked />
                    <span>${rel.followerName} → ${rel.targetName}</span>
                </label>
            </div>`;
        });
    }
    
    // Contenu de la boîte de dialogue
    const content = `
    <form>
        <div class="form-group">
            <label>
                <input type="checkbox" id="select-all" checked />
                <strong>${game.i18n.localize("FOLLOWMEIFYOUCAN.Dialog.StopFollowing.SelectAll")}</strong>
            </label>
        </div>
        <div class="follow-relationships-list" style="max-height: 300px; overflow-y: auto; margin-bottom: 10px;">
            ${relationshipsList}
        </div>
        <div class="form-group">
            <label>
                <input type="checkbox" id="stop-all-scenes" />
                <strong>${game.i18n.localize("FOLLOWMEIFYOUCAN.Dialog.StopFollowing.StopAllScenes")}</strong>
            </label>
        </div>
    </form>`;
    
    // Créer et afficher la boîte de dialogue
    new Dialog({
        title: game.i18n.localize("FOLLOWMEIFYOUCAN.Dialog.StopFollowing.Title"),
        content: content,
        buttons: {
            stop: {
                icon: '<i class="fas fa-user-slash"></i>',
                label: game.i18n.localize("FOLLOWMEIFYOUCAN.Dialog.StopFollowing.Stop"),
                callback: html => {
                    // Vérifier si l'option "arrêter tous les suivis sur toutes les scènes" est cochée
                    if (html.find('#stop-all-scenes').is(':checked')) {
                        stopAllFollowingGlobal();
                        return;
                    }
                    
                    const selectedIds = [];
                    html.find('input[data-type="follow"]:checked').each((i, el) => {
                        selectedIds.push(el.value);
                    });
                    
                    if (selectedIds.length > 0) {
                        // Arrêter les suivis sélectionnés
                        selectedIds.forEach(id => {
                            stopFollowing(id);
                        });
                        
                        ui.notifications.info(game.i18n.format("FOLLOWMEIFYOUCAN.Notifications.SelectedFollowingStopped", {
                            count: selectedIds.length
                        }));
                    } else {
                        ui.notifications.warn(game.i18n.localize("FOLLOWMEIFYOUCAN.Notifications.NoFollowsSelected"));
                    }
                }
            },
            cancel: {
                icon: '<i class="fas fa-times"></i>',
                label: game.i18n.localize("FOLLOWMEIFYOUCAN.Dialog.Cancel"),
                callback: () => {}
            }
        },
        default: "stop",
        render: html => {
            // Ajouter un événement pour l'option "tout sélectionner"
            html.find('#select-all').change(event => {
                const checked = event.currentTarget.checked;
                html.find('input[data-type="follow"]').prop('checked', checked);
            });
        }
    }).render(true);
}

// Fonction pour arrêter tous les suivis (y compris sur les autres scènes)
function stopAllFollowingGlobal() {
    if (!game.follow?.hooks) return;
    
    // Arrêter tous les hooks de suivi
    game.follow.hooks.forEach((hookId, followerId) => {
        Hooks.off('updateToken', hookId);
    });
    
    // Vider les collections
    game.follow.hooks.clear();
    followData.relationships.clear();
    
    // Sauvegarder les modifications
    followData.saveToFlags();
    
    ui.notifications.info(game.i18n.localize("FOLLOWMEIFYOUCAN.Notifications.FollowingStoppedAll"));
}

// Gestion de la sélection des tokens pour le suivi
Hooks.on('controlToken', (token, selected) => {
    if (!selectionMode || !selected || !sourceToken || token.id === sourceToken.id) return;
    
    if (game.user.isGM) {
        startFollowing(sourceToken, token);
    } else if (game.settings.get("follow-me-if-you-can", "playerAccess")) {
        // Pour les joueurs, envoyer une requête au MJ via socket
        game.socket.emit('module.follow-me-if-you-can', {
            action: 'requestFollow',
            playerId: game.user.id,
            followerTokenId: sourceToken.id,
            targetTokenId: token.id
        });
        
        ui.notifications.info(game.i18n.format("FOLLOWMEIFYOUCAN.Notifications.FollowRequestSent", {
            followerName: sourceToken.name,
            target: token.name
        }));
    }
    
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
            followerName: followerToken.name,
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
    
    // Utiliser l'implémentation asynchrone de saveToFlags (qui vérifie déjà si le jeu est prêt)
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
        followerName: followerToken.name,
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
    // S'assurer que game.follow est initialisé
    if (!game.follow) {
        game.follow = {
            hooks: new Map(),
            targets: new Map()
        };
    }
    
    // Si l'option est activée, restaurer les suivis
    if (game.user?.isGM && shouldKeepFollowing()) {
        reloadFollowRelationships();
    }
});

// Fonction pour recharger les relations de suivi
async function reloadFollowRelationships() {
    if (!game.user?.isGM || !shouldKeepFollowing()) return;
    
    try {
        console.log("Follow Me If You Can | Reloading follow relationships");
        
        // S'assurer que le jeu est prêt avant de tenter de restaurer les suivis
        if (!game.ready) {
            console.log("Follow Me If You Can | Game not ready yet, delaying follow relationships reload");
            // Réessayer après un court délai
            setTimeout(() => {
                Hooks.once('canvasReady', () => {
                    reloadFollowRelationships();
                });
            }, 1000);
            return;
        }
        
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
                    console.log(`Follow Me If You Can | Reestablishing follow: ${followerToken.name} → ${targetToken.name}`);
                    startFollowing(followerToken, targetToken);
                }
            }
        }
    } catch (error) {
        console.error("Follow Me If You Can | Error reloading follow relationships:", error);
    }
}

// Fonction pour réenregistrer les hooks
function registerHooks() {
    Hooks.on('updateToken', handleTokenUpdate);
}

// Fonction pour gérer la mise à jour des tokens
async function handleTokenUpdate(tokenDoc, changes) {
    // Votre logique de suivi ici
}

// Enregistrer les hooks lors du changement de scène
Hooks.on('canvasReady', () => {
    registerHooks();
});

// Fonction pour vérifier s'il y aurait un suivi circulaire
function checkCircularFollowing(followerId, targetId) {
    if (!game.follow?.hooks) return false;
    
    let currentId = targetId;
    const visited = new Set();
    
    while (game.follow.hooks.has(currentId)) {
        if (visited.has(currentId)) return false;
        visited.add(currentId);
        
        // Trouver le token que suit le token actuel
        const followedTokenId = Array.from(canvas.tokens.placeables).find(t => 
            Hooks.events.updateToken?.some(h => 
                h.fn.toString().includes(t.id) && 
                h.id === game.follow.hooks.get(currentId)
            )
        )?.id;
        
        if (!followedTokenId) break;
        if (followedTokenId === followerId) return true;
        
        currentId = followedTokenId;
        if (!currentId) break;
    }
    
    return false;
}

// Vérifier la valeur du paramètre de conservation du suivi lors du changement de scène
function shouldKeepFollowing() {
    return game.settings.get("follow-me-if-you-can", "keepFollowing");
}
