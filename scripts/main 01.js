// Initialisation du module
class FollowMeIfYouCan {
    static init() {
        console.log("Follow Me If You Can | Chargement du module");
        
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
});



// Gestion du HUD
Hooks.on('renderTokenHUD', (app, html, data) => {
    console.log("Follow Me If You Can | TokenHUD rendu", app, html, data);
    
    if (!app.object || !app.object.isOwner) return;
    
    const rightColumn = html.find('.col.right');
    if (rightColumn.length) {
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

        // Log pour TOUS les mouvements
        console.log("Follow Me If You Can | Mouvement détecté", {
            type: isDragDrop ? "Drag & Drop" : "Normal",
            tokenName: tokenDoc.name,
            changes,
            currentPosition: {
                x: tokenDoc.x,
                y: tokenDoc.y
            }
        });
        
        if (isDragDrop) {
            const followerToken = canvas.tokens.get(follower.document.id);
            if (!followerToken) {
                console.log("Follow Me If You Can | Token suiveur non trouvé");
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

            // Obtenir la position finale du token cible directement depuis changes
            const targetGridX = Math.round(changes.x / canvas.grid.size);
            const targetGridY = Math.round(changes.y / canvas.grid.size);
            
            // Calculer la direction du mouvement
            const dx = changes.x - followerToken.x;
            const dy = changes.y - followerToken.y;
            const angle = Math.atan2(dy, dx);
            
            // Déterminer la direction principale du mouvement
            let offsetX = 0;
            let offsetY = 0;

            // Convertir l'angle en direction de grille
            const degrees = angle * (180 / Math.PI);
            if (degrees >= -45 && degrees < 45) { // Mouvement vers la droite
                offsetX = -1;
            } else if (degrees >= 45 && degrees < 135) { // Mouvement vers le bas
                offsetY = -1;
            } else if (degrees >= -135 && degrees < -45) { // Mouvement vers le haut
                offsetY = 1;
            } else { // Mouvement vers la gauche
                offsetX = 1;
            }

            // Calculer la position finale en coordonnées de grille
            const followGridX = targetGridX + offsetX;
            const followGridY = targetGridY + offsetY;

            // Convertir en pixels
            const followX = followGridX * canvas.grid.size;
            const followY = followGridY * canvas.grid.size;

            // Log détaillé des calculs
            console.log("Follow Me If You Can | Calculs de position", {
                target: {
                    gridX: targetGridX,
                    gridY: targetGridY,
                    pixelX: changes.x,
                    pixelY: changes.y
                },
                movement: {
                    dx,
                    dy,
                    angle: degrees,
                    offsetX,
                    offsetY
                },
                follower: {
                    gridX: followGridX,
                    gridY: followGridY,
                    pixelX: followX,
                    pixelY: followY
                }
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
            let offsetX = Math.round(Math.cos(angle)) * canvas.grid.size;
            let offsetY = Math.round(Math.sin(angle)) * canvas.grid.size;

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