// Initialisation du module
class FollowMeIfYouCan {
    static init() {
        console.log("Follow Me If You Can | Chargement du module");
        
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
    }

    static ready() {
        console.log("Follow Me If You Can | Module prêt");
    }
}

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

// Stockage des dernières positions
const lastPositions = new Map();
let selectionMode = false;
let sourceToken = null;

// Stockage global des suivis
let followData = {
    relationships: new Map(), // Stocke les relations de suivi (qui suit qui)
    hooks: new Map() // Stocke les hooks actifs
};

// Ajout du bouton dans les outils de token
Hooks.on('getSceneControlButtons', (controls) => {
    const tokenTools = controls.find(c => c.name === "token");
    if (tokenTools) {
        // Vérifier si le bouton existe déjà
        const existingStopButton = tokenTools.tools.find(t => t.name === "stopAllFollowing");
        if (!existingStopButton) {
            tokenTools.tools.push({
                name: "stopAllFollowing",
                title: game.i18n.localize("FOLLOWMEIFYOUCAN.Controls.StopAll"),
                icon: "fas fa-user-slash",
                visible: true,
                onClick: () => {
                    let count = 0;
                    
                    if (game.follow?.hooks) {
                        // Convertir Map en Array pour l'itération
                        const entries = Array.from(game.follow.hooks.entries());
                        
                        for (const [followerId, hookId] of entries) {
                            const followerToken = canvas.tokens.get(followerId);
                            if (followerToken) {
                                Hooks.off('updateToken', hookId);
                                game.follow.hooks.delete(followerId);
                                lastPositions.delete(followerId);
                                count++;
                                
                                ui.notifications.info(game.i18n.format("FOLLOWMEIFYOUCAN.Notifications.StoppedFollowing", {
                                    name: followerToken.name
                                }));
                            }
                        }
                        
                        // Réinitialisation complète
                        game.follow.hooks.clear();
                        lastPositions.clear();
                        sourceToken = null;
                        selectionMode = false;
                        
                        if (count === 0) {
                            ui.notifications.info(game.i18n.localize("FOLLOWMEIFYOUCAN.Notifications.NoActiveFollowing"));
                        }
                    } else {
                        // Réinitialisation du module si game.follow n'existe pas
                        game.follow = { hooks: new Map() };
                        lastPositions.clear();
                        sourceToken = null;
                        selectionMode = false;
                        ui.notifications.info(game.i18n.localize("FOLLOWMEIFYOUCAN.Notifications.NoActiveFollowing"));
                    }
                }
            });
        }
    }
});



// Gestion du HUD
Hooks.on('renderTokenHUD', (app, html, data) => {
    console.log("Follow Me If You Can | TokenHUD rendu", app, html, data);
    
    if (!app.object || !app.object.isOwner) return;
    
    const rightColumn = html.find('.col.right');
    if (rightColumn.length) {
        // Vérifier si le bouton existe déjà
        if (rightColumn.find('.follow-token').length === 0) {
            const button = $(`
                <div class="control-icon follow-token" title="${game.i18n.localize("FOLLOWMEIFYOUCAN.Controls.SelectToFollow")}">
                    <i class="fas fa-user-friends"></i>
                </div>
            `);
            
            button.click(async () => {
                console.log("Follow Me If You Can | Bouton cliqué");
                const token = app.object;
                app.clear();
                
                sourceToken = token;
                selectionMode = true;
                ui.notifications.info("Cliquez sur le token que vous souhaitez suivre");
            });
            
            rightColumn.append(button);
        }
    }
});

// Gestion de la sélection du token cible
// Gestion de la sélection du token cible
Hooks.on('controlToken', (token, selected) => {
    if (!selectionMode || !selected || !sourceToken || token.id === sourceToken.id) return;
    
    selectionMode = false;
    
    new Dialog({
        title: game.i18n.localize("FOLLOWMEIFYOUCAN.Dialog.ConfirmFollow.Title"),
        content: game.i18n.format("FOLLOWMEIFYOUCAN.Dialog.ConfirmFollow.Content", {
            source: sourceToken.name,
            target: token.name
        }),
        buttons: {
            yes: {
                icon: '<i class="fas fa-check"></i>',
                label: game.i18n.localize("FOLLOWMEIFYOUCAN.Dialog.Yes"),
                callback: () => startFollowing(sourceToken, token)
            },
            no: {
                icon: '<i class="fas fa-times"></i>',
                label: game.i18n.localize("FOLLOWMEIFYOUCAN.Dialog.No"),
                callback: () => {
                    sourceToken = null;
                    ui.notifications.info(game.i18n.localize("FOLLOWMEIFYOUCAN.Dialog.Canceled"));
                }
            }
        },
        default: "yes"
    }).render(true);
});

// Fonction pour suivre un token
async function startFollowing(follower, target) {
    console.log("Follow Me If You Can | Démarrage du suivi", {follower, target});
    
    if (!game.follow) game.follow = { hooks: new Map() };
    
    // Vérifier si la cible suit déjà le follower (éviter le suivi circulaire)
    const targetHookId = game.follow.hooks.get(target.document.id);
    if (targetHookId) {
        const targetFollowing = Array.from(game.follow.hooks.entries()).find(([_, hookId]) => 
            hookId === targetHookId && 
            lastPositions.get(follower.document.id)
        );
        
        if (targetFollowing) {
            ui.notifications.warn(game.i18n.format("FOLLOWMEIFYOUCAN.Notifications.CircularFollowingPrevented", {
                follower: follower.name,
                target: target.name
            }));
            return;
        }
    }
    
    // Arrêter le suivi existant si présent
    if (game.follow.hooks.get(follower.document.id)) {
        Hooks.off('updateToken', game.follow.hooks.get(follower.document.id));
    }
    
    // Sauvegarder la relation de suivi
    followData.relationships.set(follower.actor.id, {
        followerId: follower.actor.id,
        followerName: follower.name,
        targetId: target.actor.id,
        targetName: target.name
    });

    // Initialiser le suivi
    lastPositions.set(target.document.id, [{
        x: target.x,
        y: target.y,
        followerId: follower.document.id
    }]);
    
    const hookId = Hooks.on('updateToken', async (tokenDoc, changes) => {
        if (tokenDoc.id !== target.document.id) return;

        // Détecter si c'est un drag and drop (changement de position)
        const isDragDrop = changes.x !== undefined && changes.y !== undefined;

        // Log des changements de position
        if (isDragDrop) {
            console.log("Follow Me If You Can | Drag and Drop détecté", {
                changes,
                tokenId: tokenDoc.id,
                tokenName: tokenDoc.name
            });
        }

        const followerToken = canvas.tokens.get(follower.document.id);
        if (!followerToken) {
            console.log("Follow Me If You Can | Token suiveur non trouvé");
            return;
        }

        // Vérifier si le token cible essaie de se déplacer sur la position du suiveur
        const targetDestX = changes.x ?? tokenDoc.x;
        const targetDestY = changes.y ?? tokenDoc.y;
        const isMovingToFollowerPosition = 
            Math.round(targetDestX / canvas.grid.size) === Math.round(followerToken.x / canvas.grid.size) &&
            Math.round(targetDestY / canvas.grid.size) === Math.round(followerToken.y / canvas.grid.size);

        if (isMovingToFollowerPosition) {
            console.log("Follow Me If You Can | Le token cible essaie de se déplacer sur la position du suiveur - Pas de déplacement du suiveur");
            return;
        }

        // Log des positions initiales
        console.log("Follow Me If You Can | Positions initiales", {
            target: {
                name: tokenDoc.name,
                currentX: tokenDoc.x,
                currentY: tokenDoc.y,
                destinationX: changes.x,
                destinationY: changes.y
            },
            follower: {
                name: followerToken.name,
                currentX: followerToken.x,
                currentY: followerToken.y
            }
        });

        // Continuer avec la logique de déplacement existante
        if (isDragDrop) {
            // Calculer la direction du mouvement
            const dx = changes.x - followerToken.x;
            const dy = changes.y - followerToken.y;
            const angle = Math.atan2(dy, dx);
            
            // Déterminer la direction principale du mouvement
            const offsetX = Math.round(Math.cos(angle)) * canvas.grid.size;
            const offsetY = Math.round(Math.sin(angle)) * canvas.grid.size;

            // Calculer la position finale du suiveur pour qu'il soit derrière le token suivi
            const followX = changes.x - offsetX;
            const followY = changes.y - offsetY;

            console.log("Follow Me If You Can | Mise à jour de la position du suiveur", {
                followX,
                followY,
                isInstant: game.settings.get("follow-me-if-you-can", "instantFollow")
            });

            const isInstant = game.settings.get("follow-me-if-you-can", "instantFollow");
            await followerToken.document.update({
                x: followX,
                y: followY
            }, {animate: !isInstant});
        } else {
            // Déplacement normal (case par case)
            const followerToken = canvas.tokens.get(follower.document.id);
            if (!followerToken) return;

            // Calculer la position cible une case derrière
            const targetX = changes.x ?? tokenDoc.x;
            const targetY = changes.y ?? tokenDoc.y;
            
            // Calculer la direction du mouvement
            const dx = targetX - followerToken.x;
            const dy = targetY - followerToken.y;
            const angle = Math.atan2(dy, dx);
            
            // Déterminer la direction principale du mouvement
            const offsetX = Math.round(Math.cos(angle)) * canvas.grid.size;
            const offsetY = Math.round(Math.sin(angle)) * canvas.grid.size;

            console.log("Follow Me If You Can | Déplacement normal", {
                targetX,
                targetY,
                offsetX,
                offsetY
            });

            const isInstant = game.settings.get("follow-me-if-you-can", "instantFollow");
            await followerToken.document.update({
                x: targetX - offsetX,
                y: targetY - offsetY
            }, {animate: !isInstant});
        }
    });
    
    game.follow.hooks.set(follower.document.id, hookId);
    ui.notifications.info(game.i18n.format("FOLLOWMEIFYOUCAN.Notifications.StartedFollowing", {
        source: follower.name,
        target: target.name
    }));
}

// Fonction pour arrêter le suivi
function stopFollowing(followerId) {
    if (!game.follow?.hooks) return;
    
    const hookId = game.follow.hooks.get(followerId);
    if (hookId) {
        Hooks.off('updateToken', hookId);
        game.follow.hooks.delete(followerId);
        lastPositions.delete(followerId);
        
        // Notification pour un seul token
        const token = canvas.tokens.get(followerId);
        if (token) {
            ui.notifications.info(game.i18n.format("FOLLOWMEIFYOUCAN.Notifications.StoppedFollowing", {
                name: token.name
            }));
        }
    }
}

// Nettoyage lors de la suppression d'un token
Hooks.on('deleteToken', (token) => {
    stopFollowing(token.id);
});

// Nettoyage lors du changement de scène
Hooks.on('canvasReady', async () => {
    console.log("Follow Me If You Can | Changement de scène détecté");
    
    const keepFollowing = game.settings.get("follow-me-if-you-can", "keepFollowingOnSceneChange");
    console.log("Follow Me If You Can | keepFollowing:", keepFollowing);
    
    if (!keepFollowing) {
        console.log("Follow Me If You Can | Nettoyage des suivis (keepFollowing désactivé)");
        cleanupAllFollows();
        return;
    }

    // Sauvegarder les relations existantes avant le changement de scène
    if (followData.relationships.size === 0 && game.follow?.hooks) {
        for (const [followerId, _] of game.follow.hooks) {
            const followerToken = canvas.tokens.get(followerId);
            if (!followerToken?.actor) continue;

            for (const [targetId, positions] of lastPositions) {
                if (positions[0]?.followerId === followerId) {
                    const targetToken = canvas.tokens.get(targetId);
                    if (!targetToken?.actor) continue;

                    followData.relationships.set(followerToken.actor.id, {
                        followerId: followerToken.actor.id,
                        followerName: followerToken.name,
                        targetId: targetToken.actor.id,
                        targetName: targetToken.name
                    });
                }
            }
        }
    }

    // Nettoyer les hooks existants
    cleanupAllFollows();

    // Attendre que la nouvelle scène soit chargée
    await new Promise(resolve => setTimeout(resolve, 500));

    // Recréer les suivis dans la nouvelle scène
    for (const [_, data] of followData.relationships) {
        const followerTokens = canvas.tokens.placeables.filter(t => 
            t.actor?.id === data.followerId && 
            t.name === data.followerName
        );
        
        const targetTokens = canvas.tokens.placeables.filter(t => 
            t.actor?.id === data.targetId && 
            t.name === data.targetName
        );

        console.log("Follow Me If You Can | Tokens trouvés:", {
            followers: followerTokens.map(t => t.name),
            targets: targetTokens.map(t => t.name)
        });

        for (const followerToken of followerTokens) {
            for (const targetToken of targetTokens) {
                console.log(`Follow Me If You Can | Recréation du suivi: ${followerToken.name} -> ${targetToken.name}`);
                await startFollowing(followerToken, targetToken);
            }
        }
    }
});

// Fonction pour nettoyer tous les suivis
function cleanupAllFollows() {
    if (game.follow?.hooks) {
        for (const hookId of game.follow.hooks.values()) {
            Hooks.off('updateToken', hookId);
        }
        game.follow.hooks.clear();
    }
    lastPositions.clear();
}

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
    console.log("Follow Me If You Can | Changement de scène détecté, réenregistrement des hooks");
    registerHooks();
});