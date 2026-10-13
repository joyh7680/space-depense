// Wave 1, 2 and 3 each summon their corresponding boss once, after 100 seconds.
export const SUMMONED_MONSTERS = [
  { texture: 'boss-mint', portrait: 'monster/monster-mint.png', name: '민트색 괴물', json: 'acef8de87e1f/acef8de87e1f2fe72202365bc0c517f690041bd8ab24a55f592a2b2a3c1df8b5.json', atlas: 'monster/1bae1e1a9bf8/1bae1e1a9bf8c1ac49b4b6c9a7cfd1d56c0eeaab03fef737bf139078ca66add0.atlas' },
  { texture: 'boss-orange', portrait: 'monster/monster-orange.png', name: '주황색 괴물', json: 'e5f5d6e48832/e5f5d6e488328c87d1425a4f224f6a092f5e53c4fdd4421447947414656c12c0.json', atlas: 'monster/aa9ad7124c35/aa9ad7124c353e510a8d0365a30f0d2097ed46ea8f4f1ad89b87b320e9e6c68a.atlas' },
  { texture: 'boss-green', portrait: 'monster/monster-green.png', name: '초록색 괴물', json: '52081da08bde/52081da08bde93ae825e4e531268cd4dd0f33a0bbb05d7f2bba70e96d9c9aba4.json', atlas: 'monster/45b71e6cd32e/45b71e6cd32e7249a55675fbc23d0a34f14aea5d68ba0e58e04fcf2f8c663043.atlas' },
] as const;

export function getSummonedMonster(index = 0) {
  return SUMMONED_MONSTERS[index] ?? SUMMONED_MONSTERS[0];
}
