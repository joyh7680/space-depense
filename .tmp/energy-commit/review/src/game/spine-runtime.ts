import Phaser from 'phaser';

let loading: Promise<void> | undefined;

export async function loadSpineRuntime() {
  const runtime = window as unknown as { Phaser: typeof Phaser; SpinePlugin?: Phaser.Types.Core.PluginObjectItem['plugin'] };
  runtime.Phaser = Phaser;
  if (!runtime.SpinePlugin) {
    loading ??= new Promise<void>((resolve, reject) => {
      const script = document.createElement('script');
      script.src = `${import.meta.env.BASE_URL}plugins/SpinePlugin.min.js`;
      script.onload = () => resolve();
      script.onerror = () => { loading = undefined; script.remove(); reject(new Error('Spine runtime could not load')); };
      document.head.append(script);
    });
    await loading;
  }
  return runtime.SpinePlugin!;
}
