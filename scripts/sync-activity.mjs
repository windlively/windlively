// 生成活跃足迹快照（近一年 GitHub 贡献日历）
// 用法：npm run sync:activity（依赖已登录的 gh CLI）
import { execFileSync } from 'node:child_process';
import { existsSync } from 'node:fs';
import { mkdir, writeFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const outFile = join(root, 'public', 'content', 'activity.json');

function ghBin() {
  if (process.env.GH_BIN) return process.env.GH_BIN;
  if (existsSync('/opt/homebrew/bin/gh')) return '/opt/homebrew/bin/gh';
  return 'gh';
}

const query = `query($from: DateTime!, $to: DateTime!) {
  viewer {
    contributionsCollection(from: $from, to: $to) {
      contributionCalendar {
        totalContributions
        weeks {
          contributionDays { date contributionCount }
        }
      }
    }
  }
}`;

const to = new Date();
const from = new Date(to.getTime() - 366 * 86400 * 1000);

console.log('拉取 GitHub 贡献日历…');
const raw = execFileSync(
  ghBin(),
  ['api', 'graphql', '-f', `query=${query}`, '-f', `from=${from.toISOString()}`, '-f', `to=${to.toISOString()}`],
  { encoding: 'utf8', maxBuffer: 32 * 1024 * 1024 },
);

const calendar =
  JSON.parse(raw).data.viewer.contributionsCollection.contributionCalendar;
const days = calendar.weeks
  .flatMap((w) => w.contributionDays)
  .map((d) => ({ d: d.date, c: d.contributionCount }));

if (!days.length) {
  throw new Error('贡献日历为空，请检查 gh 登录状态与查询参数');
}

const snapshot = {
  fetchedAt: new Date().toISOString(),
  from: days[0].d,
  to: days[days.length - 1].d,
  total: calendar.totalContributions,
  days,
};

await mkdir(dirname(outFile), { recursive: true });
await writeFile(outFile, JSON.stringify(snapshot, null, 2) + '\n', 'utf8');

console.log(`✓ ${snapshot.from} → ${snapshot.to} 共 ${days.length} 天`);
console.log(`✓ 一年内贡献合计 ${calendar.totalContributions} 次`);
console.log('→ 输出：public/content/activity.json');
