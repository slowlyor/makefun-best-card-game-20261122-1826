// main.js — wires Ember Court together: screens, mouse + keyboard input,
// the turn loop, and the ?screen= debug hook for honest screenshots.

import { newGame, playCard, attackWith, endPlayerTurn, beginPlayerTurn, canPlay } from './state.js';
import { takeAiTurn } from './ai.js';
import { renderTable, renderTitle, renderEnd } from './render.js';
import { sfxClick, sfxPlay, sfxAttack, sfxHurt, sfxWin, sfxLoss, sfxDraw, sfxTurn, setMuted, isMuted } from './audio.js';

const app = document.getElementById('app');
let state = newGame((Date.now() % 100000) + 11);
let aiTimer = null;

function render() {
  clearTimeout(aiTimer);
  if (state.phase === 'title') {
    renderTitle(app, { onStart: startDuel });
  } else if (state.phase === 'win' || state.phase === 'loss') {
    renderEnd(app, state, { onStart: restart });
  } else {
    renderTable(app, state, {
      onHandCard,
      onBoardCard,
      onTarget,
      onEndTurn,
      onMute: toggleMute,
    });
  }
}

function startDuel() {
  sfxClick();
  state.phase = 'play';
  state.player.maxEmber = 1;
  state.player.ember = 1;
  render();
}

function restart() {
  sfxClick();
  state = newGame((Date.now() % 100000) + 11);
  render();
}

function toggleMute() {
  setMuted(!isMuted());
  render();
}

// Click a hand card: select it (damage spells then need a target), or
// play it straight away when it needs no target.
function onHandCard(card) {
  if (state.phase !== 'play') return;
  if (!canPlay(state, state.player, card)) { sfxHurt(); return; }
  if (card.type === 'spell' && (card.effect === 'damage3' || card.effect === 'damage2' || card.effect === 'damage4')) {
    state.selected = state.selected === card.uid ? null : card.uid;
    state.attacker = null;
    sfxClick();
    render();
    return;
  }
  const ok = playCard(state, state.player, state.enemy, card, null);
  if (ok) { sfxPlay(); afterPlayerAction(); }
}

// Click one of your board creatures: arm it to attack.
function onBoardCard(card) {
  if (state.phase !== 'play' || !card.canAttack) return;
  state.attacker = state.attacker === card.uid ? null : card.uid;
  state.selected = null;
  sfxClick();
  render();
}

// Click a target: the enemy hero, or one of the Warden's creatures.
// Resolves a selected damage spell or an armed attacker.
function onTarget(target) {
  if (state.phase !== 'play') return;
  const enemyCreature = target === 'enemy' ? null :
    state.enemy.board.find((c) => c.uid === target.uid);
  const realTarget = target === 'enemy' ? 'enemy' : enemyCreature;
  if (!realTarget && target !== 'enemy') return;

  if (state.selected) {
    const card = state.player.hand.find((c) => c.uid === state.selected);
    if (!card) { state.selected = null; render(); return; }
    const ok = playCard(state, state.player, state.enemy, card, realTarget);
    state.selected = null;
    if (ok) { sfxAttack(); afterPlayerAction(); }
    return;
  }

  if (state.attacker) {
    const attacker = state.player.board.find((c) => c.uid === state.attacker);
    state.attacker = null;
    if (!attacker) { render(); return; }
    const ok = attackWith(state, state.player, state.enemy, attacker, realTarget);
    if (ok) { sfxAttack(); afterPlayerAction(); }
  }
}

function afterPlayerAction() {
  if (state.phase === 'win') { sfxWin(); render(); return; }
  if (state.phase === 'loss') { sfxLoss(); render(); return; }
  render();
}

function onEndTurn() {
  if (state.phase !== 'play') return;
  endPlayerTurn(state);
  sfxTurn();
  // The Warden takes its turn after a short beat so the player sees it happen.
  aiTimer = setTimeout(() => {
    takeAiTurn(state);
    if (state.phase === 'win') { sfxWin(); render(); return; }
    if (state.phase === 'loss') { sfxLoss(); render(); return; }
    beginPlayerTurn(state);
    sfxDraw();
    render();
  }, 650);
}

// Keyboard: 1-7 plays a hand card, Space/Enter ends the turn.
document.addEventListener('keydown', (e) => {
  if (state.phase === 'title' && (e.key === 'Enter' || e.key === ' ')) {
    e.preventDefault();
    startDuel();
    return;
  }
  if (state.phase === 'win' || state.phase === 'loss') {
    if (e.key === 'Enter') restart();
    return;
  }
  if (state.phase !== 'play') return;
  if (e.key >= '1' && e.key <= '7') {
    const card = state.player.hand[Number(e.key) - 1];
    if (card) onHandCard(card);
  } else if (e.key === ' ' || e.key === 'Enter') {
    e.preventDefault();
    onEndTurn();
  }
});

// Debug hook for screenshots: ?screen=title|table|win|loss forces a state.
// It only changes what is shown, never the rules — the table shot deals a
// real mid-game position, the win/loss shots end a real game.
function applyScreenParam() {
  const screen = new URLSearchParams(window.location.search).get('screen');
  if (!screen) return;
  if (screen === 'title') {
    state.phase = 'title';
  } else if (screen === 'table') {
    state.phase = 'play';
    state.player.maxEmber = 4; state.player.ember = 3;
    state.enemy.maxEmber = 4; state.enemy.ember = 1;
    state.turn = 5;
    state.player.life = 24; state.enemy.life = 19;
    // Deal a real mid-game board: two creatures each, hands full.
    // Pull creatures out of each deck explicitly so the shot always
    // shows a board on both sides, whatever the shuffle dealt.
    const p = state.player, e = state.enemy;
    const pull = (side, type, n) => {
      const found = [];
      for (let i = side.deck.length - 1; i >= 0 && found.length < n; i--) {
        if (side.deck[i].type === type) found.push(side.deck.splice(i, 1)[0]);
      }
      return found;
    };
    p.board.push(...pull(p, 'creature', 2));
    e.board.push(...pull(e, 'creature', 2));
    for (const c of [...p.board, ...e.board]) c.canAttack = true;
    p.hand.push(...pull(p, 'spell', 2), ...pull(p, 'creature', 1));
    e.hand.push(...pull(e, 'spell', 1));
    state.log.unshift(
      'Warden summons ' + e.board.map((c) => c.name).join(' and ') + '.',
      'You summon ' + p.board.map((c) => c.name).join(' and ') + '.');
  } else if (screen === 'win') {
    state.phase = 'win'; state.winner = 'player';
    state.enemy.life = 0; state.player.life = 12; state.turn = 9;
  } else if (screen === 'loss') {
    state.phase = 'loss'; state.winner = 'enemy';
    state.player.life = 0; state.enemy.life = 8; state.turn = 11;
  }
}

applyScreenParam();
render();
