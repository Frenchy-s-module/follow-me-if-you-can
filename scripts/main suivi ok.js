// Initialisation du module
class FollowMeIfYouCan {
    static init() {
        console.log("Follow Me If You Can | Chargement du module");
        
        // Enregistrement des paramètres du module
        game.settings.register("follow-me-if-you-can", "keepFollowingOnSceneChange", {
            name: "Maintenir le suivi lors du changement de scène",
            hint: "Si activé, les tokens continueront de suivre leur cible même après un changement de scène",
            scope: "world",
            config: true,
            type: Boolean,
            default: false
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



// Ajout du bouton dans les outils de token
Hooks.on('getSceneControlButtons', (controls) => {
    const tokenTools = controls.find(c => c.name === "token");
    if (tokenTools) {
        tokenTools.tools.push({
            name: "stopAllFollowing",
            title: "Arrêter tous les suivis",
            icon: "fas fa-user-slash",
            visible: true,
            onClick: () => {
                const tokens = canvas.tokens.placeables;
                let count = 0;
                
                if (game.follow?.hooks) {
                    for (const [followerId] of game.follow.hooks) {
                        stopFollowing(followerId);
                        count++;
                    }
                    
                    if (count > 0) {
                        ui.notifications.info(`${count} suivi(s) arrêté(s)`);
                    } else {
                        ui.notifications.info("Aucun suivi actif");
                    }
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
            <div class="control-icon follow-token" title="Sélectionnez un token à suivre">
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
Hooks.on('controlToken', (token, selected) => {
    if (!selectionMode || !selected || !sourceToken || token.id === sourceToken.id) return;
    
    selectionMode = false;
    
    new Dialog({
        title: "Confirmation de suivi",
        content: `<p>${sourceToken.name} va suivre ${token.name}. Êtes-vous sûr ?</p>`,
        buttons: {
            yes: {
                icon: '<i class="fas fa-check"></i>',
                label: "Oui",
                callback: () => startFollowing(sourceToken, token)
            },
            no: {
                icon: '<i class="fas fa-times"></i>',
                label: "Non",
                callback: () => {
                    sourceToken = null;
                    ui.notifications.info("Suivi annulé");
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
    
    if (game.follow.hooks.get(follower.document.id)) {
        Hooks.off('updateToken', game.follow.hooks.get(follower.document.id));
    }
    
    // Initialise les positions avec la position actuelle
    lastPositions.set(target.document.id, [{
        x: target.x,
        y: target.y
    }]);
    
    const hookId = Hooks.on('updateToken', (tokenDoc, changes) => {
        if (tokenDoc.id !== target.document.id) return;
        
        const positions = lastPositions.get(target.document.id);
        const newPos = {
            x: changes.x ?? tokenDoc.x,
            y: changes.y ?? tokenDoc.y
        };
        
        positions.push(newPos);
        if (positions.length > 2) positions.shift();
        
        const followerToken = canvas.tokens.get(follower.document.id);
        if (followerToken && positions.length > 1) {
            const targetPos = positions[0];
            followerToken.document.update({
                x: targetPos.x,
                y: targetPos.y
            });
        }
    });
    
    game.follow.hooks.set(follower.document.id, hookId);
    ui.notifications.info(`${follower.name} commence à suivre ${target.name}`);
}

// Fonction pour arrêter le suivi
function stopFollowing(followerId) {
    if (game.follow?.hooks?.get(followerId)) {
        Hooks.off('updateToken', game.follow.hooks.get(followerId));
        game.follow.hooks.delete(followerId);
        lastPositions.delete(followerId);
    }
}

// Nettoyage lors de la suppression d'un token
Hooks.on('deleteToken', (token) => {
    stopFollowing(token.id);
});

// Nettoyage lors du changement de scène
Hooks.on('canvasReady', () => {
    // Vérifie si on doit conserver les suivis
    const keepFollowing = game.settings.get("follow-me-if-you-can", "keepFollowingOnSceneChange");
    
    if (!keepFollowing && game.follow?.hooks) {
        for (const hookId of game.follow.hooks.values()) {
            Hooks.off('updateToken', hookId);
        }
        game.follow.hooks.clear();
        lastPositions.clear();
    }
});