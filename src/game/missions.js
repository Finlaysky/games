// Campaign missions. Maps are 10 x 8 grids written as ASCII rows.
// . plains  = road  T forest  ^ hills  # town  ~ river  % ruins

const CHARS = {
  '.': 'plains',
  '=': 'road',
  T: 'forest',
  '^': 'hills',
  '#': 'city',
  '~': 'river',
  '%': 'ruins',
};

export function parseMap(rows) {
  return rows
    .join('')
    .split('')
    .map((c) => CHARS[c] || 'plains');
}

export const MISSIONS = [
  {
    id: 'm1',
    name: 'BEACHHEAD',
    code: 'OP. TORCH',
    difficulty: 'Introductory',
    brief: 'Land, take the coastal road and seize the enemy command post.',
    tip: 'Select a unit, click a highlighted tile to move, then click a red-ringed enemy to fire.',
    rows: [
      '..T.....T.',
      '..........',
      '...^......',
      '#========#',
      '..........',
      '......^...',
      '..........',
      '..T.....T.',
    ],
    playerHQ: [0, 3],
    enemyHQ: [9, 3],
    supply: { player: 320, enemy: 300 },
    maxEnemy: 5,
    player: [
      { type: 'infantry', x: 1, y: 2 },
      { type: 'infantry', x: 1, y: 4 },
      { type: 'recon', x: 2, y: 3 },
    ],
    enemy: [
      { type: 'infantry', x: 8, y: 2 },
      { type: 'infantry', x: 8, y: 4 },
      { type: 'mg', x: 7, y: 3 },
    ],
  },
  {
    id: 'm2',
    name: 'BOCAGE BREAKOUT',
    code: 'OP. COBRA',
    difficulty: 'Moderate',
    brief: 'A river cuts the line. Only the bridge carries armour — everything else swims.',
    tip: 'Tanks and artillery cannot enter forest or rivers. Infantry and guns can.',
    rows: [
      '.T...~..T.',
      '.TT..~.TT.',
      '..T..~..T.',
      '#========#',
      '..T..~..T.',
      '.TT..~.TT.',
      '.T...~..T.',
      '.....~....',
    ],
    playerHQ: [0, 3],
    enemyHQ: [9, 3],
    supply: { player: 340, enemy: 420 },
    maxEnemy: 6,
    player: [
      { type: 'infantry', x: 1, y: 2 },
      { type: 'infantry', x: 1, y: 4 },
      { type: 'mg', x: 2, y: 3 },
      { type: 'tank', x: 1, y: 3 },
    ],
    enemy: [
      { type: 'infantry', x: 7, y: 2 },
      { type: 'infantry', x: 7, y: 4 },
      { type: 'mg', x: 8, y: 3 },
      { type: 'at', x: 7, y: 6 },
      { type: 'arty', x: 8, y: 5 },
    ],
  },
  {
    id: 'm3',
    name: 'HILL 214',
    code: 'OP. AVALANCHE',
    difficulty: 'Hard',
    brief: 'The enemy holds the high ground and has zeroed every approach. Dig them out.',
    tip: 'Hills and towns add defence. Artillery can shell the summit from outside return range.',
    rows: [
      '..........',
      '...^^^....',
      '..^^^^^...',
      '#^^^^^^^^#',
      '..^^^^^...',
      '...^^^....',
      '..........',
      '..........',
    ],
    playerHQ: [0, 3],
    enemyHQ: [9, 3],
    supply: { player: 380, enemy: 520 },
    maxEnemy: 7,
    player: [
      { type: 'infantry', x: 1, y: 1 },
      { type: 'infantry', x: 1, y: 6 },
      { type: 'at', x: 1, y: 3 },
      { type: 'tank', x: 2, y: 6 },
      { type: 'arty', x: 2, y: 1 },
    ],
    enemy: [
      { type: 'infantry', x: 7, y: 2 },
      { type: 'infantry', x: 8, y: 4 },
      { type: 'mg', x: 8, y: 3 },
      { type: 'arty', x: 8, y: 2 },
      { type: 'at', x: 7, y: 5 },
    ],
  },
  {
    id: 'm4',
    name: 'RUHR POCKET',
    code: 'OP. PLUNDER',
    difficulty: 'Brutal',
    brief: 'Street by street through the industrial belt. Enemy armour is everywhere.',
    tip: 'Anti-tank guns behind ruins break tank pushes. Towns give +3 defence.',
    rows: [
      '.#..%..%.#',
      '.#.%..%..#',
      '...#%%#...',
      '#========#',
      '...#%%#...',
      '.#.%..%..#',
      '.#..%..%.#',
      '..........',
    ],
    playerHQ: [0, 3],
    enemyHQ: [9, 3],
    supply: { player: 420, enemy: 600 },
    maxEnemy: 8,
    player: [
      { type: 'tank', x: 1, y: 3 },
      { type: 'tank', x: 1, y: 4 },
      { type: 'infantry', x: 1, y: 2 },
      { type: 'at', x: 2, y: 2 },
      { type: 'arty', x: 2, y: 5 },
    ],
    enemy: [
      { type: 'tank', x: 7, y: 3 },
      { type: 'tank', x: 8, y: 4 },
      { type: 'infantry', x: 7, y: 2 },
      { type: 'mg', x: 8, y: 3 },
      { type: 'arty', x: 8, y: 5 },
      { type: 'at', x: 7, y: 5 },
    ],
  },
];

export function getMission(id) {
  return MISSIONS.find((m) => m.id === id) ?? MISSIONS[0];
}
