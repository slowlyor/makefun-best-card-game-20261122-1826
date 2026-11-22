// render.js — draws the whole table from state: title screen, hands,
// boards, HUD, log, and the win/loss overlays. Cards slide, flip and snap
// with CSS transitions; this file only builds DOM and toggles classes.

import { SUITS } from './cards.js';

function el(tag, cls, text) {
  const node = document.createElement(tag);
  if (cls) node.className = cls;
  if (text !== undefined && text !== null) node.textContent = text;
  return node;
}

function suitBadge(suitKey) {
  const suit = SUITS[suitKey];
  const badge = el('span', 'suit-badge');
  badge.style.background = suit.bg;
  badge.style.color = suit.dark;
  badge.style.borderColor = suit.color;
  badge.textContent = suit.glyph + ' ' + suit.name;
  return badge;
}

// One card face. `faceDown` renders the card back instead of its values.
export function cardElement(card, opts = {}) {
  const { faceDown = false, playable = false, selected = false, canAttack = false } = opts;
  const node = el('div', 'card' + (faceDown ? ' face-down' : ''));
  if (card) node.dataset.uid = card.uid;
  if (playable) node.classList.add('playable');
  if (selected) node.classList.add('selected');
  if (canAttack) node.classList.add('can-attack');
  if (!card) return node;

  if (faceDown) {
    node.appendChild(el('div', 'card-back-glyph', '🔥'));
    node.appendChild(el('div', 'card-back-word', 'EMBER COURT'));
    return node;
  }

  const suit = SUITS[card.suit];
  node.style.setProperty('--suit', suit.color);
  node.style.setProperty('--suit-dark', suit.dark);
  node.style.setProperty('--suit-bg', suit.bg);

  const cost = el('div', 'cost', String(card.cost));
  cost.title = 'Ember cost';
  node.appendChild(cost);

  node.appendChild(el('div', 'card-glyph', suit.glyph));
  node.appendChild(el('div', 'card-name', card.name));
  node.appendChild(suitBadge(card.suit));
  node.appendChild(el('div', 'card-text', card.text));

  if (card.type === 'creature') {
    const stats = el('div', 'stats');
    stats.appendChild(el('span', 'atk', '⚔ ' + card.attack));
    stats.appendChild(el('span', 'hp', '♥ ' + card.health));
    node.appendChild(stats);
  } else {
    node.appendChild(el('div', 'spell-tag', '✦ SPELL ✦'));
  }
  return node;
}

// A dealt card pops in with a flip: the class is added on the next frame
// so the CSS transition runs instead of jumping straight to the end state.
export function animateDeal(node) {
  node.classList.add('dealt');
  requestAnimationFrame(() => requestAnimationFrame(() => node.classList.add('settled')));
}

function lifeBar(side, label) {
  const wrap = el('div', 'life-wrap');
  wrap.appendChild(el('span', 'life-label', label));
  const bar = el('div', 'life-bar');
  const fill = el('div', 'life-fill');
  fill.style.width = Math.max(0, Math.min(100, (side.life / 30) * 100)) + '%';
  fill.classList.add(side.life <= 10 ? 'low' : 'ok');
  bar.appendChild(fill);
  wrap.appendChild(bar);
  wrap.appendChild(el('span', 'life-num', side.life + ' ❤'));
  return wrap;
}

function emberPips(side) {
  const wrap = el('div', 'ember-wrap');
  wrap.appendChild(el('span', 'ember-label', '🔥 Ember'));
  const pips = el('div', 'ember-pips');
  for (let i = 0; i < 10; i++) {
    const pip = el('span', 'pip' + (i < side.ember ? ' on' : '') + (i < side.maxEmber ? '' : ' locked'));
    pips.appendChild(pip);
  }
  wrap.appendChild(pips);
  wrap.appendChild(el('span', 'ember-num', side.ember + ' / ' + side.maxEmber));
  return wrap;
}

// The full table view. `handlers` wires clicks back into main.js.
export function renderTable(root, state, handlers) {
  root.innerHTML = '';
  root.className = 'screen table-screen';

  const hud = el('div', 'hud');
  const left = el('div', 'hud-left');
  left.appendChild(el('div', 'game-title', '🔥 EMBER COURT 🔥'));
  left.appendChild(el('div', 'turn-label', 'Turn ' + state.turn));
  hud.appendChild(left);
  hud.appendChild(lifeBar(state.player, 'You'));
  hud.appendChild(lifeBar(state.enemy, 'Ashen Warden'));
  hud.appendChild(emberPips(state.player));
  const muteBtn = el('button', 'mute-btn', '🔊 Sound');
  muteBtn.addEventListener('click', handlers.onMute);
  hud.appendChild(muteBtn);
  root.appendChild(hud);

  // Opponent row: face-down hand + board.
  const foeZone = el('div', 'zone foe-zone');
  foeZone.appendChild(el('div', 'zone-label', 'Ashen Warden — ' + state.enemy.hand.length + ' cards · deck ' + state.enemy.deck.length));
  const foeHand = el('div', 'hand foe-hand');
  for (const card of state.enemy.hand) foeHand.appendChild(cardElement(card, { faceDown: true }));
  foeZone.appendChild(foeHand);
  const foeBoard = el('div', 'board foe-board');
  for (const card of state.enemy.board) {
    const node = cardElement(card, {});
    node.addEventListener('click', () => handlers.onTarget(card));
    foeBoard.appendChild(node);
  }
  if (state.enemy.board.length === 0) foeBoard.appendChild(el('div', 'board-empty', 'No creatures yet'));
  foeZone.appendChild(foeBoard);
  root.appendChild(foeZone);

  // Middle strip: enemy hero target + log + end turn.
  const mid = el('div', 'mid-strip');
  const foeHero = el('button', 'hero-target', '👑 Ashen Warden — ' + Math.max(0, state.enemy.life) + ' ❤');
  foeHero.addEventListener('click', () => handlers.onTarget('enemy'));
  mid.appendChild(foeHero);
  const log = el('div', 'log');
  for (const line of state.log) log.appendChild(el('div', 'log-line', line));
  mid.appendChild(log);
  const endBtn = el('button', 'end-turn', 'End Turn ⏎');
  endBtn.addEventListener('click', handlers.onEndTurn);
  mid.appendChild(endBtn);
  root.appendChild(mid);

  // Player board + hand.
  const myZone = el('div', 'zone my-zone');
  const myBoard = el('div', 'board my-board');
  for (const card of state.player.board) {
    const node = cardElement(card, { canAttack: card.canAttack });
    node.addEventListener('click', () => handlers.onBoardCard(card));
    myBoard.appendChild(node);
  }
  if (state.player.board.length === 0) myBoard.appendChild(el('div', 'board-empty', 'Your creatures gather here'));
  myZone.appendChild(myBoard);
  myZone.appendChild(el('div', 'zone-label', 'Your hand — ' + state.player.hand.length + ' cards · deck ' + state.player.deck.length + ' · click a card, then a target'));
  const myHand = el('div', 'hand my-hand');
  state.player.hand.forEach((card, i) => {
    const playable = card.cost <= state.player.ember &&
      (card.type !== 'creature' || state.player.board.length < 5);
    const node = cardElement(card, {
      playable,
      selected: state.selected === card.uid,
    });
    node.addEventListener('click', () => handlers.onHandCard(card));
    const key = el('span', 'key-hint', String(i + 1));
    node.appendChild(key);
    myHand.appendChild(node);
  });
  myZone.appendChild(myHand);
  root.appendChild(myZone);

  const footer = el('div', 'table-footer');
  footer.appendChild(el('div', 'help', 'Keys: 1–7 play a card · Space / Enter ends turn · Click a creature, then a target, to attack'));
  root.appendChild(footer);
}

export function renderTitle(root, handlers) {
  root.innerHTML = '';
  root.className = 'screen title-screen';
  const wrap = el('div', 'title-wrap');
  wrap.appendChild(el('div', 'title-glyph', '🔥'));
  wrap.appendChild(el('h1', 'big-title', 'EMBER COURT'));
  wrap.appendChild(el('p', 'tagline', 'A turn-based card duel against the Ashen Warden.'));
  const suits = el('div', 'suit-row');
  for (const key of Object.keys(SUITS)) {
    const chip = el('span', 'suit-chip');
    chip.style.background = SUITS[key].bg;
    chip.style.color = SUITS[key].dark;
    chip.style.borderColor = SUITS[key].color;
    chip.textContent = SUITS[key].glyph + ' ' + SUITS[key].name;
    suits.appendChild(chip);
  }
  wrap.appendChild(suits);
  wrap.appendChild(el('p', 'rules',
    'Each side has 30 life. Draw a card and gain ember every turn — ember grows by 1, up to 10. ' +
    'Play creatures and spells, then strike. First to 0 life loses.'));
  const play = el('button', 'play-btn', '▶ Begin the Duel');
  play.addEventListener('click', handlers.onStart);
  wrap.appendChild(play);
  wrap.appendChild(el('p', 'keys-note', 'Mouse: click a card, then a target · Keyboard: 1–7 play cards, Space ends turn'));
  root.appendChild(wrap);
}

function endOverlay(root, state, handlers, won) {
  root.innerHTML = '';
  root.className = 'screen end-screen ' + (won ? 'win' : 'loss');
  const wrap = el('div', 'end-wrap');
  wrap.appendChild(el('div', 'end-glyph', won ? '👑' : '🌫️'));
  wrap.appendChild(el('h1', 'end-title', won ? 'THE COURT IS YOURS' : 'THE ASHES TAKE YOU'));
  wrap.appendChild(el('p', 'end-sub', won
    ? 'The Ashen Warden bows. Ember Court remembers your name.'
    : 'The Warden keeps the court — for now. Deal again and take it back.'));
  const score = el('div', 'end-score');
  score.appendChild(el('span', '', 'You ' + Math.max(0, state.player.life) + ' ❤'));
  score.appendChild(el('span', '', '·'));
  score.appendChild(el('span', '', 'Warden ' + Math.max(0, state.enemy.life) + ' ❤'));
  score.appendChild(el('span', '', '·'));
  score.appendChild(el('span', '', 'Turn ' + state.turn));
  wrap.appendChild(score);
  const again = el('button', 'play-btn', '↻ Play Again');
  again.addEventListener('click', handlers.onStart);
  wrap.appendChild(again);
  root.appendChild(wrap);
}

export function renderEnd(root, state, handlers) {
  endOverlay(root, state, handlers, state.phase === 'win');
}
