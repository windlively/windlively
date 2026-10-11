export type ToolId = 'ocr' | 'image-tools' | 'json-viewer' | 'unit-convert' | 'monaco' | 'lab';

export interface ToolMeta {
  id: ToolId;
  no: string;
  name: string;
  desc: string;
  path: string;
  icon: string;
}

export const TOOLS: readonly ToolMeta[] = [
  { id: 'ocr', no: '01', name: '图片识别', desc: '印刷体与手写体 OCR', path: '/tools/ocr', icon: 'camera' },
  { id: 'image-tools', no: '02', name: '图片工具', desc: '编码与格式转换', path: '/tools/image-tools', icon: 'image' },
  { id: 'json-viewer', no: '03', name: 'JSON 预览', desc: '格式化与树形查看', path: '/tools/json-viewer', icon: 'braces' },
  { id: 'unit-convert', no: '04', name: '单位转换', desc: '常用单位换算', path: '/tools/unit-convert', icon: 'ruler' },
  { id: 'monaco', no: '05', name: 'Monaco 编辑器', desc: '浏览器里的代码编辑器', path: '/tools/monaco', icon: 'monitor' },
  { id: 'lab', no: '06', name: 'Angular 实验室', desc: 'Angular 特性演示', path: '/tools/lab', icon: 'flask' },
];

export function toolMeta(id: ToolId): ToolMeta {
  return TOOLS.find((t) => t.id === id)!;
}
