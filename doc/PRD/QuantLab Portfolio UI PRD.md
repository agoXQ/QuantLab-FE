# QuantLab Portfolio UI PRD

Version: 1.0

Module: Portfolio UI（前端）

Priority: P0

Status: Draft

Owner: Product Team

Last Update: 2026-06

Dependencies:

- Portfolio Service（后端）
- Strategy Service（后端）

---

# 模块定位

Portfolio UI 是 QuantLab 前端的组合管理模块。

负责：

```Plain Text
组合列表
组合创建
组合详情
策略添加 / 移除
权重调整
组合发布
绩效分析
净值曲线
```

不负责：

```Plain Text
策略编写
回测执行
```

---

# 产品目标

让用户把多个策略组合成一个投资组合，查看组合层面的绩效和净值曲线。

实现：

```Plain Text
创建组合
↓
添加策略 + 设权重
↓
查看分析报告
↓
查看净值曲线
↓
发布组合
```

---

# 设计原则

## 原则1：权重可视化

权重合计实时计算，等于 100% 绿色，否则黄色提醒。

## 原则2：净值曲线核心

净值曲线是组合详情的主视觉。

用 ECharts 渲染，绿色面积填充。

## 原则3：策略可链接

组合中的每个策略可点击跳转到策略详情。

---

# 功能范围

## P0

### 组合列表（Portfolios）

```Plain Text
组合名称
描述
策略数
可见性
更新时间
新建组合（Modal）
行点击跳转详情
```

### 组合详情（PortfolioDetail）

```Plain Text
组合信息（名称 / 描述 / 策略数 / 权重合计 / 版本 / 更新时间）
4 项绩效指标卡片
净值曲线（EquityChart）
持仓策略表格（添加 / 移除 / 权重）
发布按钮
```

## P2

### 组合回测

后端有 `POST /portfolios/:id/backtests`，前端未接入。

---

# 页面清单

| 路由 | 页面 | 说明 |
|---|---|---|
| /portfolios | Portfolios | 组合列表 |
| /portfolios/:id | PortfolioDetail | 组合详情 |

---

# 数据依赖

```Plain Text
GET    /api/v1/portfolios                 组合列表
POST   /api/v1/portfolios                 创建组合
GET    /api/v1/portfolios/:id             组合详情
PUT    /api/v1/portfolios/:id             更新组合
DELETE /api/v1/portfolios/:id             删除组合
POST   /api/v1/portfolios/:id/items       添加策略
DELETE /api/v1/portfolios/:id/items/:itemId  移除策略
PUT    /api/v1/portfolios/:id/weights     调整权重
POST   /api/v1/portfolios/:id/publish     发布组合
GET    /api/v1/portfolios/:id/analytics   分析报告
GET    /api/v1/portfolios/:id/equity-curve  净值曲线
```
