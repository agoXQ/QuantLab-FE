# QuantLab Backtest UI PRD

Version: 1.0

Module: Backtest UI（前端）

Priority: P0

Status: Draft

Owner: Product Team

Last Update: 2026-06

Dependencies:

- Backtest Engine（后端）
- Strategy Service（后端）

---

# 模块定位

Backtest UI 是 QuantLab 前端的回测模块。

负责：

```Plain Text
回测任务创建
回测任务列表
回测详情展示
绩效指标展示
交易记录展示
持仓历史展示
```

不负责：

```Plain Text
回测引擎执行
策略编辑
行情数据读取
```

---

# 产品目标

让用户选择策略和回测区间，一键发起回测，查看完整绩效报告。

实现：

```Plain Text
选择策略
↓
选择区间
↓
发起回测
↓
查看绩效指标
↓
查看交易记录 / 持仓
```

---

# 设计原则

## 原则1：指标优先

回测详情页第一时间展示 8 项核心绩效指标。

不把指标藏在折叠面板里。

## 原则2：状态感知

运行中的任务自动轮询刷新。

完成后停止轮询。

## 原则3：语义着色

正收益绿色，负收益红色，回撤红色，夏普达标绿色。

---

# 功能范围

## P0

### 回测列表（Backtests）

```Plain Text
任务 ID
策略链接
回测区间
状态标签
初始资金
创建时间
点击跳转详情
```

### 回测创建（BacktestCreate）

```Plain Text
日期区间选择（RangePicker）
策略概览（名称 / 分类 / 最新版本 / 公式预览）
以最新版本执行
```

### 回测详情（BacktestDetail）

```Plain Text
任务信息（策略 / 版本 / 区间 / 基准 / 初始资金）
状态标签
8 项绩效指标卡片
交易记录表格（分页）
期末持仓表格（浮盈计算）
运行中任务自动轮询（3s）
```

## P2

### 回测净值曲线

当前回测详情未展示净值曲线。

后端补上 equity-curve 接口后可复用 EquityChart 组件。

---

# 页面清单

| 路由 | 页面 | 说明 |
|---|---|---|
| /backtests | Backtests | 我的回测列表 |
| /strategies/:id/backtest | BacktestCreate | 新建回测 |
| /backtests/:id | BacktestDetail | 回测详情 |

---

# 数据依赖

```Plain Text
POST   /api/v1/backtests                 创建回测
GET    /api/v1/backtests                 回测列表
GET    /api/v1/backtests/:id             回测详情（含 config）
GET    /api/v1/backtests/:id/report      绩效报告
GET    /api/v1/backtests/:id/trades      交易记录
GET    /api/v1/backtests/:id/positions   持仓历史
POST   /api/v1/backtests/:id/cancel      取消回测（预留）
```
