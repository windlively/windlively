import { CATEGORIES, formatNumber, fromBase, toBase } from './units';

function category(id: string) {
  const found = CATEGORIES.find((c) => c.id === id);
  if (!found) throw new Error(`category ${id} not found`);
  return found;
}

describe('unit-convert', () => {
  it('长度：5 米 = 0.005 千米 / 5000 毫米', () => {
    const length = category('length');
    const base = toBase(length, 'm', 5);
    expect(fromBase(length, 'km', base)).toBeCloseTo(0.005, 10);
    expect(fromBase(length, 'mm', base)).toBeCloseTo(5000, 6);
  });

  it('温度：-40 摄氏度 = -40 华氏度', () => {
    const temperature = category('temperature');
    const base = toBase(temperature, 'c', -40);
    expect(fromBase(temperature, 'f', base)).toBeCloseTo(-40, 10);
    expect(fromBase(temperature, 'k', base)).toBeCloseTo(233.15, 10);
  });

  it('质量与数据量：非线性类别之外均为线性换算', () => {
    const mass = category('mass');
    expect(fromBase(mass, 'jin', toBase(mass, 'kg', 2))).toBeCloseTo(4, 10);
    const data = category('data');
    expect(fromBase(data, 'mb', toBase(data, 'gb', 3))).toBeCloseTo(3072, 6);
  });

  it('formatNumber：小数与科学计数法', () => {
    expect(formatNumber(0.005)).toBe('0.005');
    expect(formatNumber(1000000)).toBe('1000000');
    expect(formatNumber(0.1 + 0.2)).toBe('0.3');
    expect(formatNumber(1e-12)).toContain('e-12');
  });
});
