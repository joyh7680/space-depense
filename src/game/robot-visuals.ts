import type { RobotKind } from './types';

// A shared 64 × 80 canvas adds helmet facets while retaining a 96 × 120 world size.
export const ROBOT_ART_SCALE = 1.5;
export const ROBOT_VISUALS = {
  electric: { texture: 'robot-cryo-bolt', file: 'cryo-bolt.svg' },
  ice: { texture: 'robot-thermal-shock', file: 'thermal-shock.svg' },
  fire: { texture: 'robot-plasma', file: 'plasma.svg' },
} as const satisfies Record<RobotKind, { texture: string; file: string }>;

export function robotAssetUrl(kind: RobotKind): string {
  return `${import.meta.env.BASE_URL}games/space/robots/${ROBOT_VISUALS[kind].file}`;
}

export function robotPortraitStyle(kind: RobotKind): Record<string, string> {
  // CSS variables resolve relative URLs against the stylesheet, which lives in assets/ after build.
  const portraitUrl = new URL(robotAssetUrl(kind), document.baseURI).href;
  return { '--robot-portrait-url': `url("${portraitUrl}")` };
}
