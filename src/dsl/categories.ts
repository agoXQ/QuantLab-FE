export const FUNCTION_CATEGORY_ORDER = [
  'Timeframe',
  'Signal',
  'Technical',
  'TimeSeries',
  'Math',
  'Financial',
  'Logical',
  'Growth',
  'MarketCap',
  'MarketData',
];

export const CATEGORY_LABEL: Record<string, string> = {
  Technical: '技术指标函数',
  Math: '数学函数',
  TimeSeries: '时序函数',
  Signal: '信号函数',
  Timeframe: '多周期函数',
  Financial: '财务函数',
  Logical: '逻辑函数',
  Growth: '成长函数',
  MarketCap: '市值函数',
  MarketData: '行情函数',
  行情: '行情变量',
  财务: '财务变量',
  成长: '成长变量',
  市值: '市值变量',
  别名: '变量别名',
};

export interface CategorizedItem {
  category: string;
  name: string;
}

export function categoryRank(category: string): number {
  const index = FUNCTION_CATEGORY_ORDER.indexOf(category);
  return index >= 0 ? index : FUNCTION_CATEGORY_ORDER.length;
}

export function compareCategoryNames(a: string, b: string): number {
  const rankDiff = categoryRank(a) - categoryRank(b);
  if (rankDiff !== 0) return rankDiff;
  return a.localeCompare(b);
}

export function compareCategorizedItems<T extends CategorizedItem>(a: T, b: T): number {
  const categoryDiff = compareCategoryNames(a.category, b.category);
  if (categoryDiff !== 0) return categoryDiff;
  return a.name.localeCompare(b.name);
}

export function sortCategorizedItems<T extends CategorizedItem>(items: T[]): T[] {
  return [...items].sort(compareCategorizedItems);
}
