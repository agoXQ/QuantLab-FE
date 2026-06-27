# QuantLab Backtest UI TD

Version: 1.0

Module: Backtest UI（前端）

Priority: P0

Owner: Architecture Team

Status: Draft

Last Update: 2026-06

Dependencies:

- Backtest Engine（后端）
- Strategy Service（后端）

---

# 服务定位

Backtest UI 前端模块负责：

```Plain Text
回测任务 CRUD
绩效指标展示
交易 / 持仓表格
任务状态轮询
```

不负责：

```Plain Text
回测执行
策略编辑
```

---

# 核心目标

实现：

```Plain Text
选择策略 + 区间
↓
创建回测任务
↓
轮询状态
↓
COMPLETED → 展示指标 + 交易 + 持仓
```

---

# 服务边界

拥有：

```Plain Text
Backtests 页面
BacktestCreate 页面
BacktestDetail 页面
```

依赖：

```Plain Text
Backtest Engine API
Strategy Service API（策略概览）
MetricCard / MetricValue 组件
```

---

# 组件设计

## Backtests 页面

```Plain Text
Table：id / 策略链接 / 区间 / 状态 / 初始资金 / 创建时间
行点击 → /backtests/:id
按当前 userId 过滤
```

## BacktestCreate 页面

```Plain Text
左栏：RangePicker + 开始回测按钮
右栏：策略概览（Descriptions + 公式预览 pre）
提交：backtestApi.create(strategy_id, version_id, start, end)
成功后跳转 /backtests/:jobId
```

version_id 取策略最新版本。

## BacktestDetail 页面

### 数据加载

```Plain Text
useQuery backtestApi.get(jobId)
  refetchInterval: status=RUNNING|QUEUED → 3000ms，否则 false
useQuery backtestApi.getReport(jobId)     enabled: status=COMPLETED
useQuery backtestApi.getTrades(jobId)     enabled: status=COMPLETED
useQuery backtestApi.getPositions(jobId)  enabled: status=COMPLETED
```

### 绩效指标卡片

8 项 MetricCard：

```Plain Text
累计收益    total_return * 100     正绿负红
年化收益    annual_return * 100     正绿负红
夏普比率    sharpe_ratio            >=1 绿
最大回撤    max_drawdown * 100      红色
胜率        win_rate * 100
波动率      volatility * 100
Alpha       alpha                   正绿负红
Beta        beta
```

### 交易记录表格

```Plain Text
交易时间 / 代码 / 数量 / 价格 / 手续费
分页 pageSize=10
```

### 持仓表格

```Plain Text
代码 / 持仓 / 成本价 / 市价 / 市值 / 浮盈（计算）/ 日期
浮盈 = (market_price - cost_price) * quantity
MetricValue 着色
```

---

# 数据模型

## BacktestJob

对齐 `backtest.proto` BacktestJob。

## PerformanceReport

8 个 double 字段，对齐 `backtest.proto` PerformanceReport。

## Trade / Position

对齐 `backtest.proto` Trade / Position。

---

# 接口契约

## Backtest Engine API

```Plain Text
POST /api/v1/backtests                  创建回测
GET  /api/v1/backtests                  列表
GET  /api/v1/backtests/:id              详情（含 config）
GET  /api/v1/backtests/:id/report       绩效报告
GET  /api/v1/backtests/:id/trades       交易记录
GET  /api/v1/backtests/:id/positions    持仓历史
POST /api/v1/backtests/:id/cancel       取消（预留）
```

列表响应统一为 `{ items, cursor }`，空列表时 items 为 `[]`（客户端归一）。

---

# 已知限制

## 无净值曲线

回测详情未展示净值曲线。

后端补上 equity-curve 数据后，复用 EquityChart 组件即可。

## 无取消交互

cancel API 已封装但前端无按钮入口。
