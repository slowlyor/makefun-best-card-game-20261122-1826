// ai.js — the Ashen Warden's turn: a readable, counterable opponent.
// The Warden plays its biggest affordable creatures first, fires damage at
// the player's creatures when it can clear one (or at the hero when the
// board is empty), heals only when hurt, then attacks with everything ready.

import { canPlay, playCard, attackWith, startTurn } from './state.js';

function biggestFirst(a, b) {
  return (b.cost - a.cost) || (b.attack - a.attack);
}

export function takeAiTurn(state) {
  const me = state.enemy;
  const you = state.player;
  startTurn(state, me);

  // 1. Spend ember on creatures, biggest first — the Warden likes a board.
  const creatures = me.hand.filter((c) => c.type === 'creature').sort(biggestFirst);
  for (const card of creatures) {
    if (state.phase !== 'play') return;
    if (canPlay(state, me, card)) playCard(state, me, you, card, null);
  }

  // 2. Spells: damage clears a threat when it can, otherwise hits the hero.
  const spells = me.hand.filter((c) => c.type === 'spell').sort(biggestFirst);
  for (const card of spells) {
    if (state.phase !== 'play') return;
    if (!canPlay(state, me, card)) continue;
    if (card.effect === 'heal5') {
      if (me.life <= 22) playCard(state, me, you, card, null);
    } else if (card.effect === 'draw2' || card.effect === 'ember2') {
      playCard(state, me, you, card, null);
    } else {
      // damage spell: pick the player's weakest creature it can kill,
      // else the biggest threat, else the hero.
      const dmg = card.effect === 'damage4' ? 4 : card.effect === 'damage3' ? 3 : 2;
      const killable = you.board.filter((c) => c.health <= dmg)
        .sort((a, b) => b.attack - a.attack)[0];
      const target = killable || you.board.slice().sort((a, b) => b.attack - a.attack)[0] || 'enemy';
      playCard(state, me, you, card, target);
    }
  }

  // The Warden never holds ember back: unspent ember is a wasted turn, so
// cheap spells fire even without a perfect target — a readable habit the
// player can exploit by keeping a fat blocker on the board.

// 3. Attack with every ready creature: clear a blocker when the trade
// is even or better, otherwise go for the hero.
  for (const creature of me.board.slice()) {
    if (state.phase !== 'play') return;
    if (!creature.canAttack) continue;
    const blocker = you.board.filter((c) => c.attack <= creature.health)
      .sort((a, b) => b.attack - a.attack)[0];
    const target = blocker || 'enemy';
    attackWith(state, me, you, creature, target);
  }
}
