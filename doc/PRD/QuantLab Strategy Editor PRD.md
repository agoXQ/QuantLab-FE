# QuantLab Strategy Editor PRD

Version: 1.0

Module: Strategy Editor（前端）

Priority: P0

Status: Draft

Owner: Product Team

Last Update: 2026-06

Dependencies:

- Strategy Service（后端）
- Formula Workshop（前端）

---

# 模块定位

Strategy Editor 是 QuantLab 前端的策略编辑模块。

负责：

```Plain Text
策略创建
策略编辑
规则组合（从公式库选择 + 内联编辑）
版本管理
策略发布
```

不负责：

```Plain Text
公式编写（Formula Workshop 负责）
回测执行
排行榜计算
```

---

# 产品目标

让用户通过组合已有公式，快速组装一个可回测的策略。

实现：

```Plain Text
公式库
↓
按类型选择
↓
内联微调
↓
保存版本
↓
发布策略
```

---

# 设计原则

## 原则1：选择优先于编写

每个规则槽位优先从公式库选择。

公式库按类型过滤，只显示匹配类型的公式。

选完后仍可内联编辑。

## 原则2：类型安全

七种规则槽位，每种只接受对应返回类型的公式。

槽位标签标注返回类型（Boolean / Signal / Number）。

## 原则3：版本不可变

每次保存创建新版本，不覆盖旧版本。

发布绑定具体版本。

---

# 功能范围

## P0

### 策略信息编辑

```Plain Text
策略名称（必填）
分类
标签
描述
```

### 规则组合

七个规则槽位：

```Plain Text
选股规则    Boolean  必填
买入规则    Signal   必填
卖出规则    Signal   必填
仓位规则    Number   可选
调仓规则    Boolean  可选
风险规则    Boolean  可选
排序规则    Number   可选
```

每个槽位：

```Plain Text
公式库下拉（按类型过滤）
FormulaEditor 内联编辑
返回类型标签
必填/可选标签
```

### 版本管理

```Plain Text
保存草稿（创建策略 + 首版本）
保存并发布（创建策略 + 首版本 + 发布）
编辑模式（更新策略信息 + 新版本）
变更说明
```

### DSL 参考面板

实时从 API 加载函数列表。

按分类分组展示函数签名 + 返回类型。

内置变量按分类展示。

运算符和关键字标签。

## P2

### 版本对比

当前不做。

### 策略复制

当前通过 Fork 实现。

---

# 用户流程

## 流程1：新建策略

```Plain Text
策略库 → 新建策略
↓
填写策略名称、分类、标签
↓
从公式库选择各规则公式（或手动输入）
↓
内联微调
↓
保存草稿 / 保存并发布
```

## 流程2：编辑策略

```Plain Text
策略详情 → 编辑
↓
加载策略信息 + 最新版本规则
↓
修改规则
↓
填写变更说明
↓
保存（创建新版本）
```

---

# 页面清单

| 路由 | 页面 | 说明 |
|---|---|---|
| /strategies/new | StrategyEditor | 新建策略 |
| /strategies/:id/edit | StrategyEditor | 编辑策略 |

---

# 数据依赖

## 策略信息

```Plain Text
POST   /api/v1/strategies              创建策略
PUT    /api/v1/strategies/:id          更新策略
GET    /api/v1/strategies/:id          获取策略
```

## 策略版本

```Plain Text
POST   /api/v1/strategies/:id/versions     创建版本
GET    /api/v1/strategies/:id/versions     版本列表
POST   /api/v1/strategies/:id/publish      发布策略
```

## 公式库

```Plain Text
客户端 Store（localStorage）
```
