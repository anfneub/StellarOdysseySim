import { Clone, CloneName } from './clone.js';
import { Player } from './player.js';

class CloneSquad {
    constructor(player, list_modifiers = null) {
        if (list_modifiers !== null && list_modifiers.length !== player.n_clones) {
            throw new Error(`Number of clones (${player.n_clones}) and number of modifiers (${list_modifiers.length}) must be the same.`);
        }
        this.squad = [];
        for (let i = 0; i < player.n_clones; i++) {
            if (list_modifiers === null) {
                this.squad.push(new Clone(player, null, i + 1));
            } else {
                this.squad.push(new Clone(player, list_modifiers[i], i + 1));
            }
        }
    }
}

export { CloneSquad }; 