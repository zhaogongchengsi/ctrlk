// copy-manifest.js
import { existsSync, mkdirSync, copyFileSync } from 'fs';
import { resolve, join } from 'path';

const root = process.cwd();
const src = resolve(root, 'manifest.json');
const destDir = resolve(root, 'extension');
const dest = join(destDir, 'manifest.json');

if (!existsSync(destDir)) {
	mkdirSync(destDir, { recursive: true });
}

copyFileSync(src, dest);
console.log(`Copied ${src} to ${dest}`);