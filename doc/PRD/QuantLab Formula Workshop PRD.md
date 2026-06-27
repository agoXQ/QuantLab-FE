# QuantLab Formula Workshop PRD

Version: 1.0

Module: Formula Workshop（前端）

Priority: P0

Status: Draft

Owner: Product Team

Last Update: 2026-06

Dependencies:

- Formula Engine（后端）
- Market Data Service（后端）

---

# 模块定位

Formula Workshop 是 QuantLab 前端的公式管理模块。

负责：

```Plain Text
公式编写
语法校验
自动补全
公式试算
公式库管理
```

不负责：

```Plain Text
策略组合
回测执行
行情数据采集
```

---

# 产品目标

让用户在编写策略之前，先独立地编写、校验、试算公式。

实现：

```Plain Text
投资想法
↓
公式表达
↓
语法校验
↓
试算验证
↓
存入公式库
↓
策略组合时复用
```

---

# 设计原则

## 原则1：公式与策略解耦

公式是独立的一等实体。

用户先写公式，再组策略。

不要把公式绑定在策略版本里从头写。

## 原则2：类型驱动

每个公式有明确的规则类型。

选股公式返回 Boolean。

买入信号返回 Signal。

排序公式返回 Number。

类型不匹配的公式不能填入对应策略槽位。

## 原则3：即时反馈

输入即校验。

输入即补全。

试算即出结果。

减少用户在「写完才发现错」上的等待。

## 原则4：客户端优先

公式库当前做客户端持久化（localStorage）。

后端补上公式 CRUD 后，Store 层切换为 API 调用，页面不变。

---

# 功能范围

## P0

### 公式编辑器（FormulaEditor）

基于 CodeMirror 6。

支持：

```Plain Text
DSL 语法高亮
函数 / 变量自动补全（Tab / Enter 确认）
实时语法校验（防抖调 /formulas/validate）
行号
括号匹配
自动闭合
```

### 公式工作台（FormulaWorkshop）

公式库管理。

支持：

```Plain Text
按类型筛选
新建公式
编辑公式
删除公式
表达式预览
```

### 公式试算器（FormulaSandbox）

单公式执行验证。

支持：

```Plain Text
选择公式（手动输入或从公式库加载）
选择股票池（从市场数据接口加载全市场股票）
选择试算日期
执行试算
查看结果（选股 / 排序 / 计算值）
```

## P2

### 公式版本管理

当前不做。

后端补上公式持久化后再考虑。

---

# 规则类型体系

七种规则类型，对应策略版本的七个字段：

```Plain Text
stock_select    选股规则    Boolean     必填
buy_rule        买入规则    Signal      必填
sell_rule       卖出规则    Signal      必填
position_rule   仓位规则    Number      可选
rebalance_rule  调仓规则    Boolean     可选
risk_rule       风险规则    Boolean     可选
ranking_rule    排序规则    Number      可选
```

类型驱动公式库筛选和策略槽位匹配。

---

# 用户流程

## 流程1：编写并保存公式

```Plain Text
进入公式工作台
↓
点击新建公式
↓
填写名称、选择类型
↓
在 CodeMirror 编辑器中编写 DSL
↓
实时校验通过
↓
保存到公式库
```

## 流程2：试算公式

```Plain Text
点击公式试算
↓
输入或从公式库加载公式
↓
选择股票池
↓
选择试算日期
↓
点击执行试算
↓
查看选股 / 排序 / 计算结果
```

## 流程3：在策略中复用

```Plain Text
进入策略编辑器
↓
某规则槽位的公式库下拉中选择
↓
表达式自动填入
↓
可内联修改
↓
保存策略版本
```

---

# 页面清单

| 路由 | 页面 | 说明 |
|---|---|---|
| /formulas | FormulaWorkshop | 公式库列表 + 新建/编辑 |
| /formulas/sandbox | FormulaSandbox | 公式试算器 |

---

# 数据依赖

## 公式库

当前：客户端 localStorage（zustand persist）。

未来：后端公式 CRUD 服务。

## 函数列表

来源：`GET /api/v1/formulas/functions`。

缓存：10 分钟。

## 股票列表

来源：`GET /api/v1/markets/securities`。

缓存：5 分钟。

## 公式校验

来源：`POST /api/v1/formulas/validate`。

防抖：600ms。

## 公式试算

来源：`POST /api/v1/formulas/evaluate`。
