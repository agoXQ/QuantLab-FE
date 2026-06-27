# QuantLab Portfolio UI TD

Version: 1.0

Module: Portfolio UI（前端）

Priority: P0

Owner: Architecture Team

Status: Draft

Last Update: 2026-06

Dependencies:

- Portfolio Service（后端）
- Strategy Service（后端）

---

# 服务定位

Portfolio UI 前端模块负责：

```Plain Text
组合 CRUD
策略添加 / 移除 / 权重调整
绩效指标展示
净值曲线渲染
组合发布
```

---

# 核心目标

实现：

```Plain Text
组合管理
↓
策略组合 + 权重
↓
绩效分析 + 净值曲线
↓
发布
```

---

# 服务边界

拥有：

```Plain Text
Portfolios 页面
PortfolioDetail 页面
EquityChart 组件
```

依赖：

```Plain Text
Portfolio Service API
Strategy Service API（策略元信息查询）
MetricCard / MetricValue 组件
echarts（按需引入 core + LineChart + Grid + Tooltip）
```

---

# 组件设计

## EquityChart 组件（src/components/EquityChart.tsx）

基于 `echarts/core` 按需引入：

```Plain Text
LineChart
GridComponent
TooltipComponent
CanvasRenderer
```

特性：

```Plain Text
绿色面积填充（LinearGradient）
暗色主题
响应式 resize
dispose 清理
```

数据格式：

```TypeScript
interface Point {
  trade_date: string
  nav: number
  return_rate: number
}
```

## Portfolios 页面

```Plain Text
Table：名称 / 描述 / 策略数 / 可见性 / 更新时间
Modal 创建（名称 + 描述）
行点击 → /portfolios/:id
```

## PortfolioDetail 页面

### 数据加载

```Plain Text
useQuery portfolioApi.get(id)
useQuery portfolioApi.getAnalytics(id)
useQuery portfolioApi.getEquityCurve(id)
```

### 添加策略

```Plain Text
Input 策略 ID（number）
InputNumber 权重（0-100，% 后缀）
实时查询策略元信息（显示标题）
提交 addItem → invalidate get
```

### 移除策略

```Plain Text
Popconfirm → removeItem → invalidate get
```

### 权重合计

```Plain Text
items.reduce((sum, item) => sum + item.weight, 0)
= 100% → 绿色
≠ 100% → 黄色提醒
```

### 绩效指标

4 项 MetricCard：

```Plain Text
累计收益    total_return * 100
年化收益    annual_return * 100
夏普比率    sharpe_ratio
最大回撤    max_drawdown * 100
```

---

# 数据模型

## Portfolio

对齐 `portfolio.proto` Portfolio。

```TypeScript
interface Portfolio {
  id: number
  owner_id: number
  name: string
  description: string
  status: number
  visibility: number
  current_version: number
  items: PortfolioItem[]
  rebalance_rule: RebalanceRule
  created_at: number
  updated_at: number
}
```

## PortfolioAnalytics

```TypeScript
interface PortfolioAnalytics {
  annual_return: number
  total_return: number
  sharpe_ratio: number
  max_drawdown: number
  volatility: number
  win_rate: number
}
```

## EquityPoint

```TypeScript
interface EquityPoint {
  trade_date: string
  nav: number
  return_rate: number
}
```

---

# 接口契约

## Portfolio Service API

```Plain Text
GET    /api/v1/portfolios                     列表
POST   /api/v1/portfolios                     创建
GET    /api/v1/portfolios/:id                 详情
PUT    /api/v1/portfolios/:id                 更新
DELETE /api/v1/portfolios/:id                 删除
POST   /api/v1/portfolios/:id/items           添加策略
DELETE /api/v1/portfolios/:id/items/:itemId   移除策略
PUT    /api/v1/portfolios/:id/weights         调整权重
POST   /api/v1/portfolios/:id/publish         发布
GET    /api/v1/portfolios/:id/analytics       分析报告
GET    /api/v1/portfolios/:id/equity-curve    净值曲线
```

equity-curve 响应兼容 `points` 和 `items` 两种字段名。

---

# 构建优化

echarts 拆为独立 vendor chunk（494KB），仅 PortfolioDetail 页面按需加载。

EquityChart 使用 `echarts/core` 按需引入，比全量 `import * as echarts` 减少 60% 体积。
