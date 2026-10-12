import { readFileSync, writeFileSync } from 'node:fs';

const changes = {
  'cryo-bolt': {
    outer: ['M20 60', 'M21 40', 'M9 44', 'M17 3'],
    palette: {
      '#547490': '#77a9c9', '#b6c9d6': '#d3eaf2', '#73afc7': '#8bd4e5',
      '#cfdee6': '#e4f5f7', '#3b678b': '#5b9dc9', '#c1d5df': '#e4f5f7',
      '#94c9d9': '#a6e0eb', '#e1edf0': '#f0fbfa', '#4d89ab': '#78bdd6',
      '#c8dfe7': '#dbf2f4',
    },
    rings: { 'M27 49': '#70abc6', 'M19 14': '#436d89' },
  },
  'thermal-shock': {
    outer: ['M19 61', 'M20 41', 'M7 44', 'M19 4'],
    palette: {
      '#8d6553': '#c98b62', '#486d87': '#70aec7', '#cbd6da': '#e8f1ee',
      '#d69153': '#f3b26f', '#78b6cb': '#99dbe8', '#d5dee0': '#f0f5ed',
      '#a8623f': '#d99458', '#efbf7c': '#ffe0a6', '#aedfe6': '#d0f3f5',
    },
    rings: { 'M27 51': '#c9d8da', 'M18 15': '#436d89' },
  },
  'plasma': {
    outer: ['M20 61', 'M22 39', 'M8 44', 'M26 2'],
    palette: {
      '#716294': '#9783bd', '#cecddd': '#eee7f5', '#a18abd': '#c2a5e3',
      '#d4d9e5': '#f0edf7', '#b975a1': '#d999c0', '#edbad0': '#f7c6e2',
      '#f2e4ee': '#fff0f7', '#ded7eb': '#f4eafa', '#c4b3d8': '#e3d2f0',
    },
    rings: { 'M28 46': '#b9a2d7', 'M27 14': '#506080' },
  },
};
for (const [name, { outer, palette, rings }] of Object.entries(changes)) {
  const path = new URL(`../public/games/space/robots/${name}.svg`, import.meta.url);
  let svg = readFileSync(path, 'utf8');
  // Remove the backing silhouettes that formed the heavy exterior ink border.
  svg = svg.replace(/<path fill="#263145" d="([^"]+)"\/>\r?\n/g, (element, d) => {
    if (outer.some(start => d.startsWith(start))) return '';
    const ring = Object.entries(rings).find(([start]) => d.startsWith(start));
    if (!ring) throw new Error(`Unclassified dark border: ${name} ${d}`);
    return element.replace('#263145', ring[1]);
  });
  for (const [before, after] of Object.entries(palette)) svg = svg.replaceAll(before, after);
  svg = svg.replaceAll('#1d2b42', '#29425d').replaceAll('#385373', '#3f6581').replaceAll('#496d89', '#7299ae');
  writeFileSync(path, svg);
}
