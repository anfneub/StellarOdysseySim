import { CloneModifiers } from './dataclasses.js';
import { Player } from './player.js';

class CloneName {
    constructor(number) {
        this.value = `Clone ${number}`;
    }
}

class Clone {
    constructor(player, modifiers = null, clone_number = 1) {
        this.hp = player.hp;
        this.dmg = player.dmg;
        this.pre = player.pre;
        this.eva = player.eva;
        this.weapon_ele1 = player.weapon_ele1;
        this.weapon_ele2 = player.weapon_ele2;
        this.shield_ele1 = player.shield_ele1;
        this.shield_ele2 = player.shield_ele2;
        this.modifiers = modifiers;
        this.name = new CloneName(clone_number);

        this.crit_chance = 0.0;
        this.crit_dmg = 0.3;
        this.dual_shot_chance = 0.0;

        if (this.modifiers !== null) {
            this.crit_chance += modifiers.bonus_crit_chance;
            this.crit_dmg += modifiers.bonus_crit_damage;
            this.dual_shot_chance += modifiers.dual_shot_chance;
        }

        this.current_hp = this.hp;
        this.hit_counter = 0;
    }
}

export { Clone, CloneName }; 