import { mkdir, rm, copyFile, cp } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const root = fileURLToPath(new URL('../', import.meta.url));
const dist = path.join(root, 'dist');
await rm(dist, { recursive: true, force: true });
await mkdir(dist, { recursive: true });
for (const file of ['index.html', 'favicon.svg']) await copyFile(path.join(root, file), path.join(dist, file));
await cp(path.join(root, 'src'), path.join(dist, 'src'), { recursive: true });
console.log('DevTask build OK → dist/ (static HTML, CSS and ES modules)');
