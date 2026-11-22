// state.js — the match state and the rules of a turn in Ember Court.
// One side is the player, the other the Ashen Warden (AI). First to 0 life loses.

import { buildDeck } from './cards.js';

export const MAX_LIFE = 30;
export const MAX_EMBER = 10;
export const MAX_HAND = 7;
export const START_HAND = 3;

export function newSide(seed) {
  return {
    life: MAX_LIFE,
    ember: 0,
    maxEmber: 0,
    deck: buildDeck(seed),
    hand: [],
    board: [],
    fatigue: 0,
  };
}

export function newGame(seed = 20261122) {
  const state = {
    seed,
    turn: 1,
    phase: 'title', // title | play | win | loss
    player: newSide(seed),
    enemy: newSide(seed + 77),
    log: [],
    selected: null, // uid of the hand card the player picked
    attacker: null, // uid of the board creature chosen to attack
    winner: null,
  };
  drawCards(state.player, START_HAND);
  drawCards(state.enemy, START_HAND);
  return state;
}

export function drawCards(side, n) {
  const drawn = [];
  for (let i = 0; i < n; i++) {
    if (side.deck.length === 0) {
      side.fatigue += 1;
      side.life -= side.fatigue;
      drawn.push(null);
      continue;
    }
    const card = side.deck.shift();
    if (side.hand.length < MAX_HAND) {
      side.hand.push(card);
      drawn.push(card);
    }
  }
  return drawn;
}

export function startTurn(state, side) {
  side.maxEmber = Math.min(MAX_EMBER, side.maxEmber + 1);
  side.ember = side.maxEmber;
  for (const creature of side.board) creature.canAttack = true;
  drawCards(side, 1);
}

// Can this side afford and legally play this hand card right now?
export function canPlay(state, side, card) {
  if (state.phase !== 'play') return false;
  if (card.cost > side.ember) return false;
  if (card.type === 'creature' && side.board.length >= 5) return false;
  return true;
}

// Play a hand card. For damage spells the caller passes a target:
// 'enemy' (hero) or a creature object on the enemy board.
export function playCard(state, side, foe, card, target) {
  const handIndex = side.hand.findIndex((c) => c.uid === card.uid);
  if (handIndex < 0 || !canPlay(state, side, card)) return false;
  side.hand.splice(handIndex, 1);
  side.ember -= card.cost;

  if (card.type === 'creature') {
    card.canAttack = false; // summoning sickness
    side.board.push(card);
    addLog(state, side === state.player ? 'You' : 'Warden', 'summons ' + card.name);
    return true;
  }

  applySpell(state, side, foe, card, target);
  return true;
}

export function applySpell(state, side, foe, card, target) {
  switch (card.effect) {
    case 'damage3':
      dealDamage(state, foe, target, 3);
      addLog(state, side === state.player ? 'You' : 'Warden', 'hurls Fireball for 3');
      break;
    case 'damage2':
      dealDamage(state, foe, target, 2);
      addLog(state, side === state.player ? 'You' : 'Warden', 'snares for 2');
      break;
    case 'damage4':
      dealDamage(state, foe, target, 4);
      addLog(state, side === state.player ? 'You' : 'Warden', 'blooms for 4');
      break;
    case 'heal5':
      side.life = Math.min(MAX_LIFE, side.life + 5);
      addLog(state, side === state.player ? 'You' : 'Warden', 'heals 5 life');
      break;
    case 'draw2':
      drawCards(side, 2);
      addLog(state, side === state.player ? 'You' : 'Warden', 'draws 2 cards');
      break;
    case 'ember2':
      side.ember = Math.min(MAX_EMBER, side.ember + 2);
      addLog(state, side === state.player ? 'You' : 'Warden', 'surges +2 ember');
      break;
  }
  checkEnd(state);
}

// Deal damage to a hero ('enemy' target) or to one creature.
export function dealDamage(state, foe, target, amount) {
  if (!target || target === 'enemy') {
    foe.life -= amount;
  } else {
    target.health -= amount;
    if (target.health <= 0) {
      const idx = foe.board.findIndex((c) => c.uid === target.uid);
      if (idx >= 0) foe.board.splice(idx, 1);
    }
  }
  checkEnd(state);
}

// One creature attacks: either the enemy hero or an enemy creature (a trade).
export function attackWith(state, side, foe, attacker, target) {
  if (!attacker.canAttack) return false;
  attacker.canAttack = false;
  if (!target || target === 'enemy') {
    foe.life -= attacker.attack;
    addLog(state, side === state.player ? 'You' : 'Warden',
      attacker.name + ' strikes for ' + attacker.attack);
  } else {
    target.health -= attacker.attack;
    attacker.health -= target.attack;
    addLog(state, side === state.player ? 'You' : 'Warden',
      attacker.name + ' trades with ' + target.name);
    if (target.health <= 0) {
      const ti = foe.board.findIndex((c) => c.uid === target.uid);
      if (ti >= 0) foe.board.splice(ti, 1);
    }
    if (attacker.health <= 0) {
      const ai = side.board.findIndex((c) => c.uid === attacker.uid);
      if (ai >= 0) side.board.splice(ai, 1);
    }
  }
  checkEnd(state);
  return true;
}

export function checkEnd(state) {
  if (state.phase !== 'play') return;
  if (state.enemy.life <= 0 && state.player.life <= 0) {
    state.phase = 'win'; // a draw counts as the court's favour
    state.winner = 'player';
  } else if (state.enemy.life <= 0) {
    state.phase = 'win';
    state.winner = 'player';
  } else if (state.player.life <= 0) {
    state.phase = 'loss';
    state.winner = 'enemy';
  }
}

export function addLog(state, who, what) {
  state.log.unshift(who + ' ' + what + '.');
  if (state.log.length > 6) state.log.length = 6;
}

export function endPlayerTurn(state) {
  if (state.phase !== 'play') return;
  state.selected = null;
  state.attacker = null;
}

// Advance to the next turn: the Warden's turn runs first (via ai.js),
// then the player's ember refills and a new card is drawn.
export function beginPlayerTurn(state) {
  state.turn += 1;
  startTurn(state, state.player);
  addLog(state, 'Turn ' + state.turn, 'begins — ember refilled');
}

// A snapshot of the visible numbers, for the HUD and the screenshots.
export function hudSnapshot(state) {
  return {
    turn: state.turn,
    playerLife: Math.max(0, state.player.life),
    enemyLife: Math.max(0, state.enemy.life),
    playerEmber: state.player.ember,
    playerMaxEmber: state.player.maxEmber,
    playerHand: state.player.hand.length,
    enemyHand: state.enemy.hand.length,
    playerDeck: state.player.deck.length,
    enemyDeck: state.enemy.deck.length,
  };
}
