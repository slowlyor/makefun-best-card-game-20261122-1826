// cards.js — the card pool of Ember Court: suits, card definitions, deck building.
// Suits are told apart by colour AND glyph, never by text alone.

export const SUITS = {
  flame: { name: 'Flame', glyph: '🔥', color: '#e2483d', dark: '#8f1d16', bg: '#fde8e4' },
  tide: { name: 'Tide', glyph: '🌊', color: '#2b7fd4', dark: '#144a80', bg: '#e2f0fd' },
  thorn: { name: 'Thorn', glyph: '🍃', color: '#3d9b4f', dark: '#1e5c2a', bg: '#e4f5e6' },
  gale: { name: 'Gale', glyph: '🌀', color: '#b98a1d', dark: '#6e4f08', bg: '#fdf3d7' },
};

// Every card in the game. Creatures have attack/health; spells have an effect.
export const CARD_POOL = [
  { id: 'imp', name: 'Ember Imp', suit: 'flame', type: 'creature', cost: 1, attack: 2, health: 1, text: 'Quick and hungry.' },
  { id: 'wolf', name: 'Cinder Wolf', suit: 'flame', type: 'creature', cost: 2, attack: 3, health: 2, text: 'Runs through the ash.' },
  { id: 'drake', name: 'Pyre Drake', suit: 'flame', type: 'creature', cost: 5, attack: 6, health: 5, text: 'Its wings are wildfire.' },
  { id: 'sprite', name: 'Tide Sprite', suit: 'tide', type: 'creature', cost: 1, attack: 1, health: 2, text: 'Dances on the foam.' },
  { id: 'serpent', name: 'River Serpent', suit: 'tide', type: 'creature', cost: 3, attack: 4, health: 3, text: 'Coils around the bank.' },
  { id: 'leviathan', name: 'Deep Leviathan', suit: 'tide', type: 'creature', cost: 6, attack: 7, health: 6, text: 'The river remembers.' },
  { id: 'sprout', name: 'Thorn Sprout', suit: 'thorn', type: 'creature', cost: 1, attack: 1, health: 3, text: 'Small, sharp, patient.' },
  { id: 'stag', name: 'Briar Stag', suit: 'thorn', type: 'creature', cost: 3, attack: 3, health: 4, text: 'Antlers of green glass.' },
  { id: 'ancient', name: 'Grove Ancient', suit: 'thorn', type: 'creature', cost: 5, attack: 5, health: 7, text: 'Older than the court.' },
  { id: 'hawk', name: 'Gale Hawk', suit: 'gale', type: 'creature', cost: 2, attack: 2, health: 3, text: 'Rides the high wind.' },
  { id: 'roc', name: 'Storm Roc', suit: 'gale', type: 'creature', cost: 4, attack: 5, health: 4, text: 'Thunder in its wings.' },
  { id: 'djinn', name: 'Zephyr Djinn', suit: 'gale', type: 'creature', cost: 6, attack: 6, health: 6, text: 'Grants only storms.' },
  { id: 'fireball', name: 'Fireball', suit: 'flame', type: 'spell', cost: 2, effect: 'damage3', text: 'Deal 3 damage.' },
  { id: 'rain', name: 'Healing Rain', suit: 'tide', type: 'spell', cost: 2, effect: 'heal5', text: 'Restore 5 life.' },
  { id: 'snare', name: 'Thorn Snare', suit: 'thorn', type: 'spell', cost: 2, effect: 'damage2', text: 'Deal 2 damage.' },
  { id: 'gust', name: 'Gust of Pages', suit: 'gale', type: 'spell', cost: 1, effect: 'draw2', text: 'Draw 2 cards.' },
  { id: 'surge', name: 'Ember Surge', suit: 'flame', type: 'spell', cost: 0, effect: 'ember2', text: 'Gain 2 ember.' },
  { id: 'bloom', name: 'Bloom Burst', suit: 'thorn', type: 'spell', cost: 3, effect: 'damage4', text: 'Deal 4 damage.' },
];

export function cardById(id) {
  return CARD_POOL.find((c) => c.id === id);
}

// A small seeded PRNG (mulberry32) so each match shuffles deterministically.
export function makeRng(seed) {
  let a = seed >>> 0;
  return function next() {
    a |= 0; a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function shuffleDeck(cards, rng) {
  const deck = cards.slice();
  for (let i = deck.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [deck[i], deck[j]] = [deck[j], deck[i]];
  }
  return deck;
}

// How many cards of each suit a deck holds — used by the table's deck counter.
export function deckSummary(deck) {
  const counts = { flame: 0, tide: 0, thorn: 0, gale: 0 };
  for (const card of deck) counts[card.suit]++;
  return counts;
}

// Build a 20-card deck: two copies of each pool card, shuffled with the seed.
// Two copies keep the pool small enough to learn in one match, big enough
// that no two matches play the same.
export function buildDeck(seed) {
  const rng = makeRng(seed);
  const ids = [];
  for (const card of CARD_POOL) { ids.push(card.id, card.id); }
  const shuffled = shuffleDeck(ids, rng);
  return shuffled.slice(0, 20).map((id) => makeInstance(id));
}

let instanceCounter = 0;
export function makeInstance(cardId) {
  const def = cardById(cardId);
  return {
    uid: 'c' + (++instanceCounter) + '-' + cardId,
    id: cardId,
    name: def.name,
    suit: def.suit,
    type: def.type,
    cost: def.cost,
    attack: def.attack || 0,
    health: def.health || 0,
    maxHealth: def.health || 0,
    effect: def.effect || null,
    text: def.text,
    canAttack: false,
  };
}
