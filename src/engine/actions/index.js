import { ACTION_MANIFEST, ACTION_REGISTRY, Action, findEntityLocation, moveEntity, registerEffect, revertEffect, sweepTurnEffects } from './core.js';

import { DealDamageAction } from './deal_damage.js';
import { HealAction } from './heal.js';
import { KillAction } from './kill.js';
import { ModifyStatAction } from './modify_stat.js';
import { ModifyResourceAction } from './modify_resource.js';
import { SetStatAction } from './set_stat.js';
import { GrantAbilityAction } from './grant_ability.js';
import { RemoveAbilityAction } from './remove_ability.js';
import { DrawCardAction } from './draw_card.js';
import { PlayAction } from './play.js';
import { AttackAction } from './attack.js';
import { HarvestAction } from './harvest.js';
import { DiscardAction } from './discard.js';
import { ShuffleAction } from './shuffle.js';
import { ReturnAction } from './return.js';
import { RecoverAction } from './recover.js';
import { TrashAction } from './trash.js';
import { BanishAction } from './banish.js';
import { FieldAction } from './field.js';
import { ReviveAction } from './revive.js';
import { AttachAction } from './attach.js';
import { UnattachAction } from './unattach.js';
import { UnfieldAction } from './unfield.js';
import { RebelAction } from './rebel.js';
import { DonateAction } from './donate.js';
import { SummonAction } from './summon.js';
import { BlockActAction } from './block_act.js';
import { BlockAttackAction } from './block_attack.js';
import { BlockRetaliateAction } from './block_retaliate.js';
import { BlockTargetingAction } from './block_targeting.js';
import { CancelEventAction } from './cancel_event.js';
import { CleanseAction } from './cleanse.js';
import { ChangeDestinationAction } from './change_destination.js';
import { ModifyEventAction } from './modify_event.js';
import { TransformAction } from './transform.js';
import { CustomScriptAction } from './custom_script.js';

ACTION_REGISTRY['DEAL_DAMAGE'] = DealDamageAction;
ACTION_REGISTRY['HEAL'] = HealAction;
ACTION_REGISTRY['KILL'] = KillAction;
ACTION_REGISTRY['MODIFY_STAT'] = ModifyStatAction;
ACTION_REGISTRY['MODIFY_RESOURCE'] = ModifyResourceAction;
ACTION_REGISTRY['SET_STAT'] = SetStatAction;
ACTION_REGISTRY['GRANT_ABILITY'] = GrantAbilityAction;
ACTION_REGISTRY['REMOVE_ABILITY'] = RemoveAbilityAction;
ACTION_REGISTRY['DRAW_CARD'] = DrawCardAction;
ACTION_REGISTRY['PLAY'] = PlayAction;
ACTION_REGISTRY['ATTACK'] = AttackAction;
ACTION_REGISTRY['HARVEST'] = HarvestAction;
ACTION_REGISTRY['DISCARD'] = DiscardAction;
ACTION_REGISTRY['DISCARD_CARD'] = DiscardAction; 
ACTION_REGISTRY['SHUFFLE'] = ShuffleAction;
ACTION_REGISTRY['RETURN'] = ReturnAction;
ACTION_REGISTRY['RECOVER'] = RecoverAction;
ACTION_REGISTRY['TRASH'] = TrashAction;
ACTION_REGISTRY['BANISH'] = BanishAction;
ACTION_REGISTRY['FIELD'] = FieldAction;
ACTION_REGISTRY['REVIVE'] = ReviveAction;
ACTION_REGISTRY['ATTACH'] = AttachAction;
ACTION_REGISTRY['UNATTACH'] = UnattachAction;
ACTION_REGISTRY['UNFIELD'] = UnfieldAction;
ACTION_REGISTRY['REBEL'] = RebelAction;
ACTION_REGISTRY['DONATE'] = DonateAction;
ACTION_REGISTRY['SUMMON'] = SummonAction;
ACTION_REGISTRY['BLOCK_ACT'] = BlockActAction;
ACTION_REGISTRY['BLOCK_ATTACK'] = BlockAttackAction;
ACTION_REGISTRY['BLOCK_RETALIATE'] = BlockRetaliateAction;
ACTION_REGISTRY['BLOCK_TARGETING'] = BlockTargetingAction;
ACTION_REGISTRY['CANCEL_EVENT'] = CancelEventAction;
ACTION_REGISTRY['CLEANSE'] = CleanseAction;
ACTION_REGISTRY['CHANGE_DESTINATION'] = ChangeDestinationAction;
ACTION_REGISTRY['MODIFY_EVENT'] = ModifyEventAction;
ACTION_REGISTRY['TRANSFORM'] = TransformAction;
ACTION_REGISTRY['CUSTOM_SCRIPT'] = CustomScriptAction;

export const ACTION_CATEGORIES = {
    'Combat & Stats': ['DEAL_DAMAGE', 'HEAL', 'KILL', 'ATTACK', 'MODIFY_STAT', 'SET_STAT', 'MODIFY_RESOURCE'],
    'Zone Movement': ['DRAW_CARD', 'PLAY', 'SUMMON', 'DISCARD', 'DISCARD_CARD', 'SHUFFLE', 'RETURN', 'RECOVER', 'REVIVE', 'TRASH', 'BANISH', 'CHANGE_DESTINATION'],
    'Attachments & Control': ['ATTACH', 'UNATTACH', 'REBEL', 'DONATE'],
    'Meta & Utility': ['BLOCK_ACT', 'BLOCK_ATTACK', 'BLOCK_RETALIATE', 'BLOCK_TARGETING', 'CANCEL_EVENT', 'MODIFY_EVENT', 'CLEANSE', 'GRANT_ABILITY', 'REMOVE_ABILITY', 'CUSTOM_SCRIPT', 'HARVEST', 'TRANSFORM']
};

export const EFFECT_TYPES = Object.keys(ACTION_MANIFEST);

export function getActionTriggers() {
    const triggers = [];
    Object.keys(ACTION_MANIFEST).forEach(action => {
        triggers.push(`WOULD_${action}`);
        triggers.push(`MODIFY_${action}`);
        triggers.push(`ON_${action}`);
        
        const pType = ACTION_MANIFEST[action].passiveType;
        if (pType) {
            triggers.push(`WOULD_${pType}`);
            triggers.push(`MODIFY_${pType}`);
            triggers.push(`ON_${pType}`);
        }
    });
    return triggers;
}

export {
    ACTION_MANIFEST, ACTION_REGISTRY, Action, findEntityLocation, moveEntity, registerEffect, revertEffect, sweepTurnEffects,
    DealDamageAction, HealAction, KillAction, ModifyStatAction, ModifyResourceAction, SetStatAction,
    GrantAbilityAction, RemoveAbilityAction, DrawCardAction, PlayAction, AttackAction, HarvestAction,
    DiscardAction, ShuffleAction, ReturnAction, RecoverAction, TrashAction, BanishAction, FieldAction,
    ReviveAction, AttachAction, UnattachAction, UnfieldAction, RebelAction, DonateAction, SummonAction, BlockActAction,
    BlockAttackAction, BlockRetaliateAction, BlockTargetingAction, CancelEventAction, CleanseAction,
    ChangeDestinationAction, ModifyEventAction, TransformAction, CustomScriptAction
};