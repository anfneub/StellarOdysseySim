import { CloneSquad } from './cloneSquad.js';
import { Mob } from './mob.js';
import { Player } from './player.js';
import { Clone } from './clone.js';
import { CloneModifiers } from './dataclasses.js';
import { millify } from './utils.js';

class Battle {
    constructor({ player, mob, list_modifiers = null, verbose = false }) {
        this.player = player;
        this.clone_squad = new CloneSquad(this.player, list_modifiers);
        this.mob = mob;
        this.verbose = verbose;

        this.battle_is_over = false;
        this.current_round = 0;
        this.round_limit = 500;
        this.elemental_bonus_damage = 0.15;

        // Calculate total damage modifier once
        let weapon1 = player.weapon_ele1, weapon2 = player.weapon_ele2;
        if ((weapon1 && (!weapon2 || weapon2 === 'None')) && weapon1 !== 'None') weapon2 = weapon1;
        if ((weapon2 && (!weapon1 || weapon1 === 'None')) && weapon2 !== 'None') weapon1 = weapon2;
        let shield1 = player.shield_ele1, shield2 = player.shield_ele2;
        if ((shield1 && (!shield2 || shield2 === 'None')) && shield1 !== 'None') shield2 = shield1;
        if ((shield2 && (!shield1 || shield1 === 'None')) && shield2 !== 'None') shield1 = shield2;
        const modifications = [weapon1, weapon2, shield1, shield2];
        const target_weaknesses = mob.weaknesses || [];
        this.total_damage_modifier = 0.0;
        for (const mod of modifications) {
            if (mod && target_weaknesses.includes(mod)) {
                this.total_damage_modifier += this.elemental_bonus_damage;
            }
        }

        // Cache frequently used values
        this.mob_hp = mob.hp;
        this.mob_pre = mob.pre;
        this.mob_eva = mob.eva;
        this.credits_base = 300.0 * (1.0 + 0.1 * mob.lvl) * (player.vip_status ? 1.1 : 1.0);
        this.exp_base = Math.floor((20.0 + Math.floor(0.1 * mob.lvl)) * (player.vip_status ? 1.1 : 1.0));
    }

    fight() {
        while (!this.battle_is_over) {
            this.do_one_round();
            if (this.current_round > this.round_limit) {
                break;
            }
        }
        if (this.current_round > this.round_limit) {
            return `Fight did not end after ${this.round_limit} rounds, so mob wins!`;
        }
        if (this.mob.current_hp === 0.0) {
            return `Clones won after ${this.current_round} rounds.`;
        } else {
            return `Mob won after ${this.current_round} rounds.`;
        }
    }

    do_one_attack(attacker, target) {
        const attacker_hit_chance = attacker.pre / (attacker.pre + target.eva);
        let curr_dmg = attacker.dmg;
        const rng_attack = Math.random();
        if (rng_attack < attacker_hit_chance) {
            if (attacker instanceof Clone) {
                const rng_crit = Math.random();
                if (rng_crit < attacker.crit_chance) {
                    curr_dmg *= (1 + attacker.crit_dmg);
                }
                curr_dmg *= (1 + this.total_damage_modifier);
            }
            attacker.hit_counter += 1;
            target.current_hp = Math.max(0.0, target.current_hp - curr_dmg);
            if (this.verbose) {
                (`${attacker.name.value} attacks ${target.name.value} for ${curr_dmg.toFixed(2)} damage. ${target.name.value} is left with ${target.current_hp.toFixed(2)} HP.`);
            }
        } else if (this.verbose) {
            console.log(`${attacker.name.value} missed while attacking ${target.name.value}.`);
        }

        if (attacker instanceof Clone && attacker.dual_shot_chance > 0.0 && Math.random() < attacker.dual_shot_chance) {
            const rng_attack = Math.random();
            if (rng_attack < attacker_hit_chance) {
                curr_dmg = attacker.dmg;
                if (Math.random() < attacker.crit_chance) {
                    curr_dmg *= (1 + attacker.crit_dmg);
                }
                curr_dmg *= (1 + this.total_damage_modifier);
                attacker.hit_counter += 1;
                target.current_hp = Math.max(0.0, target.current_hp - curr_dmg);
                if (this.verbose) {
                    console.log(`${attacker.name.value} DUAL attacks ${target.name.value} for ${curr_dmg.toFixed(2)} damage. ${target.name.value} is left with ${target.current_hp.toFixed(2)} HP.`);
                }
            } else if (this.verbose) {
                console.log(`${attacker.name.value} missed DUAL attack to ${target.name.value}.`);
            }
        }
    }

    do_one_round() {
        if (this.verbose) {
            console.log(`\nRound ${this.current_round}`);
        }
        
        // mob attacks first
        for (const clone of this.clone_squad.squad) {
            if (clone.current_hp === 0.0) continue;
            this.do_one_attack(this.mob, clone);
        }
        
        // then clones attack
        for (const clone of this.clone_squad.squad) {
            if (clone.current_hp === 0.0) {
                if (this.verbose) {
                    console.log(`${clone.name.value} is exhausted.`);
                }
                continue;
            }
            if (this.mob.current_hp === 0.0) break;
            this.do_one_attack(clone, this.mob);
        }
        
        this.battle_is_over = this.mob.current_hp === 0.0 || this.clone_squad.squad.every(clone => clone.current_hp === 0.0);
        this.current_round += 1;
    }

    reset() {
        this.mob.current_hp = this.mob_hp;
        this.mob.hit_counter = 0;
        for (const clone of this.clone_squad.squad) {
            clone.current_hp = clone.hp;
            clone.hit_counter = 0;
        }
        this.battle_is_over = false;
        this.current_round = 0;
    }

    repeat_fights(fights) {
        let wins = 0;
        for (let i = 0; i < fights; i++) {
            const fight = this.fight();
            if (fight.startsWith('Clones')) {
                wins += 1;
            }
            this.reset();
        }
        return wins / fights;
    }

    get_revenue_print(win_chance = 1.0) {
        const revenue_per_hour = this.get_revenue('hourly', win_chance);
        const revenue_per_day = 24.0 * revenue_per_hour;
        return `Credits per hour: ${millify(revenue_per_hour)}/h\nCredits per day: ${millify(revenue_per_day)}/day`;
    }

    get_revenue(revenue_type, win_chance = 1.0, income_boost = 0.0, reputation = 0.0) {
        const tot_credits = this.credits_base * (1.0 + income_boost + reputation);
        if (revenue_type === 'hourly') {
            return tot_credits * 600 * win_chance;  // 10 * 60
        } else if (revenue_type === 'daily') {
            return tot_credits * 14400 * win_chance;  // 10 * 60 * 24
        }
        return 0.0;
    }

    get_experience(exp_type, win_chance = 1.0, reputation = 0.0) {
        const exp = Math.floor(this.exp_base * (1 + reputation));
        if (exp_type === 'hourly') {
            return exp * 600 * win_chance;  // 10 * 60
        } else if (exp_type === 'daily') {
            return exp * 14400 * win_chance;  // 10 * 60 * 24
        }
        return 0.0;
    }

}

class PvPBattle {
    constructor({ attackers, defenders, list_modifiers_attackers = null, list_modifiers_defenders = null, verbose = false }) {
        // Build attacker squads and pair with players
        let attackerSquads = attackers.map((player, idx) => ({
            player,
            squad: new CloneSquad(player, list_modifiers_attackers ? list_modifiers_attackers[idx] : null)
        }));
        // Sort by precision before boost
        attackerSquads.sort((a, b) => b.player.pre_before_boost - a.player.pre_before_boost);
        this.attackers = attackerSquads.map(pair => pair.player);
        this.squads_attackers = attackerSquads.map(pair => {
            for (const clone of pair.squad.squad) {
                clone.name.value = `${pair.player.name} ${clone.name.value}`;
            }
            return pair.squad;
        });

        // Build defender squads and pair with players
        let defenderSquads = defenders.map((player, idx) => ({
            player,
            squad: new CloneSquad(player, list_modifiers_defenders ? list_modifiers_defenders[idx] : null)
        }));
        defenderSquads.sort((a, b) => b.player.pre_before_boost - a.player.pre_before_boost);
        this.defenders = defenderSquads.map(pair => pair.player);
        this.squads_defenders = defenderSquads.map(pair => {
            for (const clone of pair.squad.squad) {
                clone.name.value = `${pair.player.name} ${clone.name.value}`;
            }
            return pair.squad;
        });

        this.verbose = verbose;
        this.round_limit = 200; // Increase limit for long duels
        this.current_round = 0;
        this.battle_is_over = false;
        this.elemental_bonus_damage = 0.0; // No elemental bonus in PvP
        this.current_attacker = 0; // index of current player in attackers
        this.current_defender = 0; // index of current player in defenders
    }

    get_living_clones(squad) {
        return squad.squad.filter(clone => clone.current_hp > 0.0);
    }

    do_one_attack(attacker, target, targetSquad) {
        // Same as PvE, but no elemental bonus; supports overflow to next in lineup
        const attacker_hit_chance = attacker.pre / (attacker.pre + target.eva);
        let curr_dmg = attacker.dmg;
        const rng_attack = Math.random();
        if (rng_attack < attacker_hit_chance) {
            if (attacker instanceof Clone) {
                const rng_crit = Math.random();
                if (rng_crit < attacker.crit_chance) {
                    curr_dmg *= (1 + attacker.crit_dmg);
                }
                // No elemental bonus
            }
            attacker.hit_counter += 1;
            this.apply_damage_chain(attacker, targetSquad, target, curr_dmg, false);
        } else if (this.verbose) {
            console.log(`${attacker.name.value} missed while attacking ${target.name.value}.`);
        }

        if (attacker instanceof Clone && attacker.dual_shot_chance > 0.0 && Math.random() < attacker.dual_shot_chance) {
            const rng_attack_dual = Math.random();
            if (rng_attack_dual < attacker_hit_chance) {
                curr_dmg = attacker.dmg;
                if (Math.random() < attacker.crit_chance) {
                    curr_dmg *= (1 + attacker.crit_dmg);
                }
                attacker.hit_counter += 1;
                this.apply_damage_chain(attacker, targetSquad, target, curr_dmg, true);
            } else if (this.verbose) {
                console.log(`${attacker.name.value} missed DUAL attack to ${target.name.value}.`);
            }
        }
    }

    get_next_target_in_lineup(squad, fromIndex) {
        const clones = squad.squad;
        for (let i = fromIndex + 1; i < clones.length; i++) {
            if (clones[i].current_hp > 0.0) return clones[i];
        }
        return null;
    }

    apply_damage_chain(attacker, targetSquad, initialTarget, totalDamage, isDual) {
        const clones = targetSquad.squad;
        let remainingDamage = totalDamage;
        let target = initialTarget;
        while (remainingDamage > 0 && target && target.current_hp > 0.0) {
            const applied = Math.min(remainingDamage, target.current_hp);
            target.current_hp = Math.max(0.0, target.current_hp - applied);
            if (this.verbose) {
                const tag = isDual ? 'DUAL ' : '';
                console.log(`${attacker.name.value} ${tag}attacks ${target.name.value} for ${applied.toFixed(2)} damage. ${target.name.value} is left with ${target.current_hp.toFixed(2)} HP.`);
            }
            remainingDamage -= applied;
            if (remainingDamage > 0) {
                const idx = clones.indexOf(target);
                target = this.get_next_target_in_lineup(targetSquad, idx);
            }
        }
    }

    duel(squad_attackers, squad_defenders) {
        // Both squads fight until one is exhausted
        let round = 0;
        while (this.get_living_clones(squad_attackers).length > 0 && this.get_living_clones(squad_defenders).length > 0 && round < this.round_limit) {
            // Defenders' living clones attack first
            let living_defenders = this.get_living_clones(squad_defenders);
            let living_attackers = this.get_living_clones(squad_attackers);
            for (const attacker of living_defenders) {
                living_attackers = this.get_living_clones(squad_attackers);
                if (living_attackers.length === 0) break;
                const target = living_attackers[Math.floor(Math.random() * living_attackers.length)];
                this.do_one_attack(attacker, target, squad_attackers);
            }
            // Then attackers' living clones attack
            living_defenders = this.get_living_clones(squad_defenders);
            living_attackers = this.get_living_clones(squad_attackers);
            for (const attacker of living_attackers) {
                living_defenders = this.get_living_clones(squad_defenders);
                if (living_defenders.length === 0) break;
                const target = living_defenders[Math.floor(Math.random() * living_defenders.length)];
                this.do_one_attack(attacker, target, squad_defenders);
            }
            round++;
        }
        // Return which squad is exhausted (or null for draw)
        const attackersAlive = this.get_living_clones(squad_attackers).length > 0;
        const defendersAlive = this.get_living_clones(squad_defenders).length > 0;
        if (attackersAlive && !defendersAlive) return 'defenders';
        if (!attackersAlive && defendersAlive) return 'attackers';
        return null; // draw (should be rare)
    }

    fight() {
        // Main PvP battle loop
        while (this.current_attacker < this.squads_attackers.length && this.current_defender < this.squads_defenders.length) {
            const squad_attackers = this.squads_attackers[this.current_attacker];
            const squad_defenders = this.squads_defenders[this.current_defender];
            if (this.verbose) {
                const attackerName = this.attackers[this.current_attacker]?.name || `Attacker Player ${this.current_attacker + 1}`;
                const defenderName = this.defenders[this.current_defender]?.name || `Defender Player ${this.current_defender + 1}`;
                console.log(`\nDuel: ${attackerName} vs ${defenderName}`);
            }
            const exhausted = this.duel(squad_attackers, squad_defenders);
            if (exhausted === 'attackers') {
                this.current_attacker += 1;
            } else if (exhausted === 'defenders') {
                this.current_defender += 1;
            } else {
                // Both squads exhausted (draw), both move to next
                this.current_attacker += 1;
                this.current_defender += 1;
            }
            // Check if either team has any living clones left
            const any_attackers = this.squads_attackers.slice(this.current_attacker).some(squad => this.get_living_clones(squad).length > 0);
            const any_defenders = this.squads_defenders.slice(this.current_defender).some(squad => this.get_living_clones(squad).length > 0);
            if (!any_attackers || !any_defenders) break;
        }
        // Determine winner
        const any_attackers = this.squads_attackers.slice(this.current_attacker).some(squad => this.get_living_clones(squad).length > 0);
        const any_defenders = this.squads_defenders.slice(this.current_defender).some(squad => this.get_living_clones(squad).length > 0);
        if (any_attackers && !any_defenders) {
            return `Attackers won!`;
        } else if (any_defenders && !any_attackers) {
            return `Defenders won!`;
        } else {
            return `Draw!`;
        }
    }

    reset() {
        for (const squad of this.squads_attackers) {
            for (const clone of squad.squad) {
                clone.current_hp = clone.hp;
                clone.hit_counter = 0;
            }
        }
        for (const squad of this.squads_defenders) {
            for (const clone of squad.squad) {
                clone.current_hp = clone.hp;
                clone.hit_counter = 0;
            }
        }
        this.battle_is_over = false;
        this.current_round = 0;
        this.current_attacker = 0;
        this.current_defender = 0;
    }
}

function parseSquadJSON(json) {
    const players = [];
    const modifiers = [];
    for (const p of json.squad) {
        players.push(new Player({
            name: p.name || 'Player',
            power: p.power,
            precision: p.precision,
            evasion: p.evasion,
            hull: p.hull,
            available: true,
            weapon_dmg: p.weapon_dmg,
            shield_def: p.shield_def,
            n_clones: p.n_clones,
            vip_status: false,
            mode: 'pvp',
            pvp_boost: p.pvp_boost || 0
        }));
        modifiers.push(
            (p.clone_modifiers || []).map(
                m => new CloneModifiers(
                    m.crit_chance || 0,
                    m.crit_dmg || 0,
                    m.dual_shot_chance || 0
                )
            )
        );
    }
    return { players, modifiers };
}

PvPBattle.fromJSON = function(attackers_json, defenders_json, verbose = false) {
    const attackersData = parseSquadJSON(attackers_json);
    const defendersData = parseSquadJSON(defenders_json);
    return new PvPBattle({
        attackers: attackersData.players,
        defenders: defendersData.players,
        list_modifiers_attackers: attackersData.modifiers,
        list_modifiers_defenders: defendersData.modifiers,
        verbose
    });
};

export { Battle, PvPBattle }; 
