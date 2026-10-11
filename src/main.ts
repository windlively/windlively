import { bootstrapApplication } from '@angular/platform-browser';
import { appConfig } from './app/app.config';
import { App } from './app/app';

// iOS Safari 需页面存在 touchstart 监听才会对按钮等非链接元素触发 :active（按压反馈）
document.addEventListener('touchstart', () => {}, { passive: true });

bootstrapApplication(App, appConfig)
  .catch((err) => console.error(err));
