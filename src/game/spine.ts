import type Phaser from 'phaser';

export type SpineActor = Phaser.GameObjects.GameObject & Phaser.GameObjects.Components.Transform & Phaser.GameObjects.Components.Depth & Phaser.GameObjects.Components.Alpha & {
  play: (animation: string, loop?: boolean, ignoreIfPlaying?: boolean) => SpineActor;
  setSkinByName: (name: string) => SpineActor;
  skeleton: { setSlotsToSetupPose: () => void };
  timeScale: number;
  width: number;
  height: number;
  displayOriginX: number;
  displayOriginY: number;
  setAttachment: (slot: string, attachment: string | null) => SpineActor;
  updateSize: () => SpineActor;
};

declare module 'phaser' {
  namespace Loader { interface LoaderPlugin { spine(key: string, json: string, atlas: string[], premultipliedAlpha?: boolean): this } }
  namespace GameObjects { interface GameObjectFactory { spine(x: number, y: number, key: string, animation?: string, loop?: boolean): SpineActor } }
}
