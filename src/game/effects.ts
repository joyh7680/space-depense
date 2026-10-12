export const SPINE_EFFECTS = {
  'green-light': {
    json: 'green-light/green-light.json',
    atlas: 'green-light/7f25d58526c32fa8032c10d12c228be36ffdfd24af1f309e596657ec327754c1.atlas',
    animation: 'animation', scale: 0.38, duration: 450,
  },
  'cooling-energy': {
    json: 'cooling-energy/5a4e0dbc093c382ff36298ce9eadf131450deba3c4051fbff6282c3b2667f988.json',
    atlas: 'cooling-energy/cooling-energy.atlas',
    animation: 'animation', scale: 0.28, duration: 1050,
  },
  'electric-energy': {
    json: 'electric-energy/7b5b747b7763a37a2403d64d8efede4427655645f9c957d2aaaacd86d8fabcc9.json',
    atlas: 'electric-energy/bb447bd1-fa9e-49aa-8ed7-8a4216e19f8b.atlas',
    animation: 'animation', scale: 0.26, duration: 500,
  },
  'game-clear': {
    json: 'game-clear/e5780c1598f4cd2cac5858b586bece866148067d16c9b8f1a422e0e949723155.json',
    atlas: 'game-clear/game-clear.atlas',
    animation: 'idle', scale: 1, duration: 4050,
  },
} as const;

export type SpineEffectKind = keyof typeof SPINE_EFFECTS;
