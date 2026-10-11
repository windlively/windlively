import { Routes } from '@angular/router';
import { Home } from './features/home/home';

export const routes: Routes = [
  { path: '', component: Home, title: 'windlively · 清欢小院' },
  {
    path: 'tools',
    loadComponent: () => import('./features/tools/tools-layout').then((m) => m.ToolsLayout),
    children: [
      { path: '', redirectTo: 'ocr', pathMatch: 'full' },
      {
        path: 'ocr',
        title: '图片识别 · windlively',
        loadComponent: () => import('./features/tools/ocr/ocr-tool').then((m) => m.OcrTool),
      },
      {
        path: 'image-tools',
        title: '图片工具 · windlively',
        loadComponent: () =>
          import('./features/tools/image-tools/image-tools-tool').then((m) => m.ImageToolsTool),
      },
      {
        path: 'json-viewer',
        title: 'JSON 预览 · windlively',
        loadComponent: () =>
          import('./features/tools/json-viewer/json-viewer-tool').then((m) => m.JsonViewerTool),
      },
      {
        path: 'unit-convert',
        title: '单位转换 · windlively',
        loadComponent: () =>
          import('./features/tools/unit-convert/unit-convert-tool').then((m) => m.UnitConvertTool),
      },
      {
        path: 'monaco',
        title: 'Monaco 编辑器 · windlively',
        loadComponent: () => import('./features/tools/monaco/monaco-tool').then((m) => m.MonacoTool),
      },
      {
        path: 'lab',
        title: 'Angular 实验室 · windlively',
        loadComponent: () => import('./features/tools/lab/lab-tool').then((m) => m.LabTool),
      },
    ],
  },
  { path: '**', redirectTo: '' },
];
