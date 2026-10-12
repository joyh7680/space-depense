import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { execFileSync } from 'node:child_process';
const root = process.cwd();
const selection = JSON.parse(fs.readFileSync(process.argv[2], 'utf8'));
const folder = path.join(root, '.tmp', selection.folder);
fs.mkdirSync(folder, { recursive: true });
const env = { ...process.env, GIT_INDEX_FILE: path.join(folder, 'index') };
const git = (args, options = {}) => execFileSync('git', args, { cwd: root, encoding: 'utf8', ...options });
const indexPath = path.resolve(root, git(['rev-parse', '--git-path', 'index']).trim());
const digest = () => crypto.createHash('sha256').update(fs.readFileSync(indexPath)).digest('hex');
const transform = (file, text) => {
  for (const [before, after] of selection.replacements[file]) {
    if (!text.includes(before) || text.indexOf(before) !== text.lastIndexOf(before)) throw new Error(`Expected unique anchor in ${file}: ${before}`);
    text = text.replace(before, after);
  }
  return text;
};
if (process.argv[3] === 'prepare') {
  const base = git(['rev-parse', 'HEAD']).trim();
  const previousIndexHash = digest();
  const preserved = {};
  git(['read-tree', 'HEAD'], { env });
  for (const file of Object.keys(selection.replacements)) {
    const selected = transform(file, git(['show', `HEAD:${file}`]));
    const blob = git(['hash-object', '-w', '--stdin'], { input: selected }).trim();
    git(['update-index', '--cacheinfo', `100644,${blob},${file}`], { env });
    preserved[file] = git(['hash-object', '-w', '--stdin'], { input: transform(file, git(['show', `:${file}`])) }).trim();
  }
  fs.writeFileSync(path.join(folder, 'manifest.json'), JSON.stringify({ base, previousIndexHash, preserved }, null, 2));
  git(['diff', '--cached', '--check'], { env });
  fs.writeFileSync(path.join(folder, 'review.patch'), git(['diff', '--cached'], { env }));
  console.log(git(['diff', '--cached', '--stat'], { env }));
  for (const file of git(['ls-files', 'src/game', 'tests', 'package.json']).trim().split('\n')) {
    const destination = path.join(folder, 'review', file);
    fs.mkdirSync(path.dirname(destination), { recursive: true });
    fs.writeFileSync(destination, git(['show', `:${file}`], { env }));
  }
} else if (process.argv[3] === 'commit') {
  const manifest = JSON.parse(fs.readFileSync(path.join(folder, 'manifest.json'), 'utf8'));
  if (git(['rev-parse', 'HEAD']).trim() !== manifest.base || digest() !== manifest.previousIndexHash) throw new Error('HEAD or staged changes changed; prepare again.');
  fs.copyFileSync(indexPath, path.join(folder, 'original-index'));
  console.log(git(['commit', '-m', selection.message], { env }));
  for (const [file, blob] of Object.entries(manifest.preserved)) git(['update-index', '--cacheinfo', `100644,${blob},${file}`]);
  console.log(git(['log', '-1', '--format=%h %s']));
} else throw new Error('Use prepare or commit');
