import { Element } from './dataclasses.js';

class Player {
    constructor({ name = 'Player', power, precision, evasion, hull, available, weapon_dmg, shield_def, n_clones, vip_status, weapon_ele1 = null, weapon_ele2 = null, shield_ele1 = null, shield_ele2 = null, battle_boost = 0.0, pvp_boost = 0.0, mode = 'pve' }) {
        
        this.name = name;
        this.pow = power;
        this.pre_before_boost = precision
        this.eva_before_boost = evasion
        this.hull = hull;
        this.available = available;
        this.weapon_dmg = weapon_dmg;
        this.shield_def = shield_def;
        this.n_clones = n_clones;
        this.weapon_ele1 = weapon_ele1;
        this.weapon_ele2 = weapon_ele2;
        this.shield_ele1 = shield_ele1;
        this.shield_ele2 = shield_ele2;
        this.vip_status = vip_status;
        this.battle_boost = battle_boost;
        this.pvp_boost = pvp_boost;
        this.mode = mode;

        // Choose the correct boost based on mode
        const boost = (mode === 'pvp') ? pvp_boost : battle_boost;
        this.pre = Math.floor(precision * (1.0 + boost));
        this.eva = Math.floor(evasion * (1.0 + boost));
        this.hp = Math.floor(((7.0 * this.hull) + shield_def) * (1.0 + boost));
        this.dmg = Math.floor((((7.0 * this.pow) + weapon_dmg) * this.n_clones) * (1.0 + boost));

        if (this.mode === 'pvp') {
            this.hp = Math.floor(this.hp * 7.0 * this.n_clones);
            console.log(`${this.name} hp: ${this.hp}`);
        }

    }
    
    serialize() {
        return {
            name: this.name,
            power: this.pow,
            precision: this.pre_before_boost,
            evasion: this.eva_before_boost,
            hull: this.hull,
            available: this.available,
            weapon_dmg: this.weapon_dmg,
            shield_def: this.shield_def,
            n_clones: this.n_clones,
            vip_status: this.vip_status,
            weapon_ele1: this.weapon_ele1,
            weapon_ele2: this.weapon_ele2,
            shield_ele1: this.shield_ele1,
            shield_ele2: this.shield_ele2,
            battle_boost: this.battle_boost,
            pvp_boost: this.pvp_boost,
            mode: this.mode,
        };
    }
}

export { Player }; 
