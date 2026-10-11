import { Injectable } from '@angular/core';

export interface BlogPost {
  title: string;
  url: string;
  date: string;
}

export interface RepoItem {
  name: string;
  url: string;
  description: string;
  language: string;
  stars: number;
  forks: number;
  updatedAt: string;
  topics: string[];
  homepage: string;
  source: string;
}

interface Snapshot<T> {
  fetchedAt: string;
  items: T[];
}

export type RepoSourceId = 'github' | 'gitee';

export interface RepoResult {
  items: RepoItem[];
  kind: 'live' | 'cache' | 'snapshot';
  time: string;
}

const REPO_API: Record<RepoSourceId, string> = {
  github: 'https://api.github.com/users/windlively/repos?per_page=100&sort=updated',
  gitee: 'https://gitee.com/api/v5/users/windlively/repos?per_page=100&sort=updated',
};

const CACHE_PREFIX = 'wl-repos-v1-';

@Injectable({ providedIn: 'root' })
export class ContentService {
  async loadPosts(): Promise<BlogPost[] | null> {
    const snapshot = await this.fetchJson<Snapshot<BlogPost>>('content/blog-posts.json');
    return snapshot?.items ?? null;
  }

  /* 仓库：先渲染本地（缓存/快照），实时接口在后台升级；失败保持本地数据（§3.4/§9.2） */
  async loadRepos(
    source: RepoSourceId,
    forceLive = false,
    onUpgrade?: (result: RepoResult) => void,
  ): Promise<RepoResult | null> {
    const cached = this.readCache(source);
    const fresh = cached && Date.now() - Date.parse(cached.savedAt) < 6 * 3600 * 1000;
    if (!forceLive && fresh) {
      return { items: cached.items, kind: 'cache', time: cached.savedAt };
    }
    const local: RepoResult | null = cached
      ? { items: cached.items, kind: 'cache', time: cached.savedAt }
      : await this.snapshotRepos(source);

    const livePromise = this.fetchLiveRepos(source).then((live) => {
      if (!live) return null;
      this.writeCache(source, live.items);
      const result: RepoResult = { items: live.items, kind: 'live', time: new Date().toISOString() };
      onUpgrade?.(result);
      return result;
    });

    if (local) return local;
    return livePromise;
  }

  private async snapshotRepos(source: RepoSourceId): Promise<RepoResult | null> {
    const snapshot = await this.fetchJson<Snapshot<RepoItem>>(`content/${source}-repos.json`);
    if (!snapshot) return null;
    return { items: snapshot.items, kind: 'snapshot', time: snapshot.fetchedAt };
  }

  private async fetchLiveRepos(source: RepoSourceId): Promise<{ items: RepoItem[] } | null> {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 8000);
    try {
      const resp = await fetch(REPO_API[source], {
        headers: { accept: 'application/json' },
        signal: controller.signal,
      });
      if (!resp.ok) return null;
      const raw = (await resp.json()) as Record<string, unknown>[];
      if (!Array.isArray(raw)) return null;
      const items = raw
        .filter((r) => r['fork'] !== true && r['archived'] !== true)
        .map((r) => this.mapRepo(r, source))
        .filter((r) => r.name);
      return { items };
    } catch {
      return null;
    } finally {
      clearTimeout(timer);
    }
  }

  private mapRepo(r: Record<string, unknown>, source: RepoSourceId): RepoItem {
    const str = (key: string) => (typeof r[key] === 'string' ? (r[key] as string) : '');
    const num = (key: string) => (typeof r[key] === 'number' ? (r[key] as number) : 0);
    return {
      name: str('name'),
      url: str('html_url'),
      description: str('description'),
      language: str('language'),
      stars: num('stargazers_count'),
      forks: num('forks_count'),
      updatedAt: str('pushed_at') || str('updated_at'),
      topics: Array.isArray(r['topics']) ? (r['topics'] as string[]) : [],
      homepage: str('homepage'),
      source,
    };
  }

  private async fetchJson<T>(path: string): Promise<T | null> {
    try {
      const resp = await fetch(path, { headers: { accept: 'application/json' } });
      if (!resp.ok) return null;
      return (await resp.json()) as T;
    } catch {
      return null;
    }
  }

  private readCache(source: RepoSourceId): { savedAt: string; items: RepoItem[] } | null {
    try {
      const raw = localStorage.getItem(CACHE_PREFIX + source);
      if (!raw) return null;
      const parsed = JSON.parse(raw) as { savedAt: string; items: RepoItem[] };
      if (!Array.isArray(parsed.items)) return null;
      return parsed;
    } catch {
      return null;
    }
  }

  private writeCache(source: RepoSourceId, items: RepoItem[]): void {
    try {
      localStorage.setItem(CACHE_PREFIX + source, JSON.stringify({ savedAt: new Date().toISOString(), items }));
    } catch {
      /* 隐私模式或配额不足时静默降级 */
    }
  }
}
