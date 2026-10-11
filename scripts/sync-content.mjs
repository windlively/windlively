// 生成首页内容聚合快照（博客文章 + GitHub/Gitee 仓库）
// 用法：npm run sync:content
// 直连失败且配置了 HTTPS_PROXY 时改走 curl 代理重试
import { mkdir, writeFile } from 'node:fs/promises';
import { execFileSync } from 'node:child_process';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const outDir = join(root, 'public', 'content');
const BLOG = 'https://windlively.github.io';
const USER = 'windlively';
const PROXY = process.env.HTTPS_PROXY || process.env.https_proxy || '';

async function get(url) {
  try {
    const resp = await fetch(url, { headers: { 'user-agent': 'windlively-homepage-sync' } });
    if (!resp.ok) throw new Error(`HTTP ${resp.status} for ${url}`);
    return await resp.text();
  } catch (err) {
    if (!PROXY) throw err;
    // Node fetch 不读取系统代理，失败且配置了代理时改用 curl
    console.log(`  ↻ 直连失败，走代理重试：${url}`);
    return execFileSync('curl', ['-fsSL', '-x', PROXY, url], {
      encoding: 'utf8',
      maxBuffer: 32 * 1024 * 1024,
    });
  }
}

function parsePosts(html) {
  const posts = [];
  const re =
    /<a href="([^"]+)" class="list-group-item[^"]*">\s*<span class="archive-post-title">([^<]+)<\/span>\s*<time[^>]*>([^<]*)<\/time>/g;
  let m;
  while ((m = re.exec(html)) !== null) {
    const url = new URL(m[1], BLOG).href;
    const dm = url.match(/\/(\d{4})\/(\d{2})\/(\d{2})\//);
    posts.push({
      title: m[2].trim(),
      url,
      date: dm ? `${dm[1]}-${dm[2]}-${dm[3]}` : m[3].trim(),
    });
  }
  return posts;
}

function mapGithub(list) {
  return list
    .filter((r) => !r.fork && !r.archived)
    .slice(0, 60)
    .map((r) => ({
      name: r.name ?? '',
      url: r.html_url ?? '',
      description: r.description ?? '',
      language: r.language ?? '',
      stars: r.stargazers_count ?? 0,
      forks: r.forks_count ?? 0,
      updatedAt: r.pushed_at ?? '',
      topics: r.topics ?? [],
      homepage: r.homepage ?? '',
      source: 'github',
    }));
}

function mapGitee(list) {
  return list
    .filter((r) => !r.fork)
    .slice(0, 60)
    .map((r) => ({
      name: r.name ?? '',
      url: r.html_url ?? '',
      description: r.description ?? '',
      language: r.language ?? '',
      stars: r.stargazers_count ?? 0,
      forks: r.forks_count ?? 0,
      updatedAt: r.pushed_at ?? '',
      topics: [],
      homepage: r.homepage ?? '',
      source: 'gitee',
    }));
}

const fetchedAt = new Date().toISOString();
console.log('拉取内容快照…');

const [archives, githubRaw, giteeRaw] = await Promise.all([
  get(`${BLOG}/archives/`),
  get(`https://api.github.com/users/${USER}/repos?per_page=100&sort=updated`),
  get(`https://gitee.com/api/v5/users/${USER}/repos?per_page=100&sort=updated`),
]);

const posts = parsePosts(archives);
const github = mapGithub(JSON.parse(githubRaw));
const gitee = mapGitee(JSON.parse(giteeRaw));

if (!posts.length) {
  throw new Error('博客归档解析结果为空，请检查归档页结构是否变化');
}

await mkdir(outDir, { recursive: true });
const write = (name, items) =>
  writeFile(join(outDir, name), JSON.stringify({ fetchedAt, items }, null, 2) + '\n', 'utf8');

await Promise.all([
  write('blog-posts.json', posts),
  write('github-repos.json', github),
  write('gitee-repos.json', gitee),
]);

console.log(`✓ 博客文章 ${posts.length} 篇`);
console.log(`✓ GitHub 仓库 ${github.length} 个`);
console.log(`✓ Gitee 仓库 ${gitee.length} 个`);
console.log('→ 输出目录：public/content/');
