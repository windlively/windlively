import { Component, computed, inject, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { BlogPost, ContentService, RepoItem, RepoSourceId } from '../../core/content';
import { Icon } from '../../shared/ui/icon';
import { ActivityCalendar } from './yard/activity-calendar';
import { YardCat } from './yard/yard-cat';
import { YardScene } from './yard/yard-scene';

type Tab = 'tools' | 'notes' | 'works' | 'about';
type Repo = 'github' | 'gitee';
type RepoKind = 'live' | 'cache' | 'snapshot';

const LANG_COLORS: Record<string, string> = {
  Java: '#b07219',
  TypeScript: '#3178c6',
  JavaScript: '#e3c25a',
  CSS: '#8f6b9e',
  HTML: '#c96a4a',
  Vue: '#41b883',
  Python: '#4b7c9e',
  Shell: '#89a05e',
  Dart: '#3aa9c4',
};

const POST_COUNT = 4;
const REPO_COUNT = 6;

@Component({
  selector: 'app-home',
  imports: [YardCat, YardScene, ActivityCalendar, RouterLink, Icon],
  templateUrl: './home.html',
  styleUrl: './home.scss',
})
export class Home {
  readonly tab = signal<Tab>('tools');
  readonly repo = signal<Repo>('github');

  readonly posts = signal<readonly BlogPost[] | null>(null);
  readonly postsLoaded = signal(false);

  readonly repos = signal<readonly RepoItem[] | null>(null);
  readonly reposLoaded = signal(false);
  readonly repoKind = signal<RepoKind | null>(null);
  readonly repoTime = signal('');
  readonly repoLoading = signal(false);

  readonly repoNote = computed(() => {
    if (!this.reposLoaded()) return '正在更新…';
    const kind = this.repoKind();
    if (!kind) return '暂时未取到数据';
    if (kind === 'snapshot') return `快照 · ${this.repoTime().slice(0, 10)}`;
    const ago = this.timeAgo(this.repoTime());
    return kind === 'live' ? `实时 · ${ago}` : `缓存 · ${ago}`;
  });

  private readonly content = inject(ContentService);

  constructor() {
    void this.loadPosts();
    void this.loadRepos(false);
  }

  setTab(tab: Tab): void {
    this.tab.set(tab);
  }

  setRepo(repo: Repo): void {
    if (repo === this.repo()) return;
    this.repo.set(repo);
    void this.loadRepos(false);
  }

  refreshRepos(): void {
    void this.loadRepos(true);
  }

  langColor(lang: string): string {
    return LANG_COLORS[lang] ?? '#aabb9e';
  }

  private async loadPosts(): Promise<void> {
    const items = await this.content.loadPosts();
    this.posts.set(items?.slice(0, POST_COUNT) ?? null);
    this.postsLoaded.set(true);
  }

  private async loadRepos(forceLive: boolean): Promise<void> {
    const source: RepoSourceId = this.repo();
    this.repoLoading.set(true);
    const result = await this.content.loadRepos(source, forceLive, (update) => {
      if (source === this.repo()) this.applyRepos(update);
    });
    this.repoLoading.set(false);
    if (source !== this.repo()) return;
    if (result) {
      this.applyRepos(result);
    } else {
      this.repos.set(null);
      this.repoKind.set(null);
      this.repoTime.set('');
    }
    this.reposLoaded.set(true);
  }

  private applyRepos(result: { items: readonly RepoItem[]; kind: RepoKind; time: string }): void {
    this.repos.set(result.items.slice(0, REPO_COUNT));
    this.repoKind.set(result.kind);
    this.repoTime.set(result.time);
    this.reposLoaded.set(true);
  }

  private timeAgo(iso: string): string {
    const ms = Date.now() - Date.parse(iso);
    if (!Number.isFinite(ms) || ms < 60_000) return '刚刚';
    const minutes = Math.floor(ms / 60_000);
    if (minutes < 60) return `${minutes} 分钟前`;
    const hours = Math.floor(minutes / 60);
    if (hours < 24) return `${hours} 小时前`;
    return `${Math.floor(hours / 24)} 天前`;
  }
}
