// 将 monaco-editor 运行时代码同步到 public/monaco，供懒加载使用（随 npm 版本升级自动更新）
import { cp, mkdir, rm } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const from = join(root, 'node_modules', 'monaco-editor', 'min', 'vs');
const to = join(root, 'public', 'monaco', 'vs');

if (!existsSync(from)) {
  console.warn('[copy-monaco] 未找到 node_modules/monaco-editor/min/vs，跳过（请先 npm install）');
  process.exit(0);
}

await rm(to, { recursive: true, force: true });
await mkdir(dirname(to), { recursive: true });
await cp(from, to, { recursive: true });
console.log('[copy-monaco] monaco-editor/min/vs -> public/monaco/vs');
