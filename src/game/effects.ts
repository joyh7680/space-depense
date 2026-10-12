export const SPINE_EFFECTS = {
  'game-clear': {
    json: 'game-clear/e5780c1598f4cd2cac5858b586bece866148067d16c9b8f1a422e0e949723155.json',
    atlas: 'game-clear/game-clear.atlas',
    animation: 'idle', scale: 1, duration: 4050,
  },
} as const;

export type SpineEffectKind = keyof typeof SPINE_EFFECTS;
