export interface UnitDef {
  id: string;
  name: string;
  symbol: string;
  /* 相对基准单位的系数（线性类别） */
  factor?: number;
  /* 特殊类别（如温度）用自定义换算 */
  toBase?: (v: number) => number;
  fromBase?: (v: number) => number;
}

export interface CategoryDef {
  id: string;
  name: string;
  defaultUnit: string;
  units: UnitDef[];
}

const u = (id: string, name: string, symbol: string, factor: number): UnitDef => ({
  id,
  name,
  symbol,
  factor,
});

export const CATEGORIES: readonly CategoryDef[] = [
  {
    id: 'length',
    name: '长度',
    defaultUnit: 'm',
    units: [
      u('um', '微米', 'µm', 1e-6),
      u('mm', '毫米', 'mm', 0.001),
      u('cm', '厘米', 'cm', 0.01),
      u('dm', '分米', 'dm', 0.1),
      u('m', '米', 'm', 1),
      u('km', '千米', 'km', 1000),
      u('cun', '市寸', '寸', 1 / 30),
      u('chi', '市尺', '尺', 1 / 3),
      u('zhang', '市丈', '丈', 10 / 3),
      u('li', '市里', '里', 500),
      u('in', '英寸', 'in', 0.0254),
      u('ft', '英尺', 'ft', 0.3048),
      u('yd', '码', 'yd', 0.9144),
      u('mi', '英里', 'mi', 1609.344),
      u('nmi', '海里', 'nmi', 1852),
      u('au', '天文单位', 'AU', 1.495978707e11),
    ],
  },
  {
    id: 'area',
    name: '面积',
    defaultUnit: 'sqm',
    units: [
      u('sqcm', '平方厘米', 'cm²', 0.0001),
      u('sqm', '平方米', 'm²', 1),
      u('are', '公亩', 'a', 100),
      u('ha', '公顷', 'ha', 10000),
      u('sqkm', '平方千米', 'km²', 1e6),
      u('mu', '亩', '亩', 2000 / 3),
      u('sqft', '平方英尺', 'ft²', 0.09290304),
      u('acre', '英亩', 'ac', 4046.8564224),
    ],
  },
  {
    id: 'volume',
    name: '体积',
    defaultUnit: 'l',
    units: [
      u('ml', '毫升', 'mL', 0.001),
      u('cl', '厘升', 'cL', 0.01),
      u('l', '升', 'L', 1),
      u('m3', '立方米', 'm³', 1000),
      u('cup', '杯（美制）', 'cup', 0.2365882365),
      u('pt', '品脱（美制）', 'pt', 0.473176473),
      u('qt', '夸脱（美制）', 'qt', 0.946352946),
      u('gal', '加仑（美制）', 'gal', 3.785411784),
    ],
  },
  {
    id: 'mass',
    name: '质量',
    defaultUnit: 'kg',
    units: [
      u('mg', '毫克', 'mg', 1e-6),
      u('g', '克', 'g', 0.001),
      u('kg', '千克', 'kg', 1),
      u('t', '吨', 't', 1000),
      u('jin', '市斤', '斤', 0.5),
      u('liang', '两', '两', 0.05),
      u('lb', '磅', 'lb', 0.45359237),
      u('oz', '盎司', 'oz', 0.028349523125),
    ],
  },
  {
    id: 'temperature',
    name: '温度',
    defaultUnit: 'c',
    units: [
      { id: 'c', name: '摄氏度', symbol: '°C', toBase: (v) => v, fromBase: (v) => v },
      {
        id: 'f',
        name: '华氏度',
        symbol: '°F',
        toBase: (v) => ((v - 32) * 5) / 9,
        fromBase: (v) => (v * 9) / 5 + 32,
      },
      {
        id: 'k',
        name: '开尔文',
        symbol: 'K',
        toBase: (v) => v - 273.15,
        fromBase: (v) => v + 273.15,
      },
    ],
  },
  {
    id: 'time',
    name: '时间',
    defaultUnit: 's',
    units: [
      u('ms', '毫秒', 'ms', 0.001),
      u('s', '秒', 's', 1),
      u('min', '分钟', 'min', 60),
      u('h', '小时', 'h', 3600),
      u('d', '天', 'd', 86400),
      u('wk', '周', 'wk', 604800),
      u('yr', '年（365 天）', 'yr', 31536000),
    ],
  },
  {
    id: 'speed',
    name: '速度',
    defaultUnit: 'mps',
    units: [
      u('mps', '米/秒', 'm/s', 1),
      u('kph', '千米/时', 'km/h', 1 / 3.6),
      u('mph', '英里/时', 'mph', 0.44704),
      u('kn', '节', 'kn', 1852 / 3600),
      u('fps', '英尺/秒', 'ft/s', 0.3048),
    ],
  },
  {
    id: 'data',
    name: '数据存储',
    defaultUnit: 'mb',
    units: [
      u('bit', '比特', 'bit', 0.125),
      u('b', '字节', 'B', 1),
      u('kb', '千字节', 'KB', 1024),
      u('mb', '兆字节', 'MB', 1024 ** 2),
      u('gb', '吉字节', 'GB', 1024 ** 3),
      u('tb', '太字节', 'TB', 1024 ** 4),
      u('pb', '拍字节', 'PB', 1024 ** 5),
    ],
  },
];

export function toBase(category: CategoryDef, unitId: string, value: number): number {
  const unit = category.units.find((x) => x.id === unitId)!;
  return unit.toBase ? unit.toBase(value) : value * (unit.factor ?? 1);
}

export function fromBase(category: CategoryDef, unitId: string, base: number): number {
  const unit = category.units.find((x) => x.id === unitId)!;
  return unit.fromBase ? unit.fromBase(base) : base / (unit.factor ?? 1);
}

export function formatNumber(n: number): string {
  if (!Number.isFinite(n)) return '—';
  if (n === 0) return '0';
  const abs = Math.abs(n);
  if (abs >= 1e15 || abs < 1e-9) {
    return n
      .toExponential(6)
      .replace(/\.?0+e/, 'e')
      .replace('e+', 'e');
  }
  return String(Number(n.toPrecision(10)));
}
