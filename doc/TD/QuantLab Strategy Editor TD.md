# QuantLab Strategy Editor TD

Version: 1.0

Module: Strategy Editor（前端）

Priority: P0

Owner: Architecture Team

Status: Draft

Last Update: 2026-06

Dependencies:

- Strategy Service（后端）
- Formula Workshop（前端）

---

# 服务定位

Strategy Editor 前端模块负责：

```Plain Text
策略信息表单
规则槽位组合
版本创建与发布
DSL 参考面板
```

不负责：

```Plain Text
公式编写
公式校验
回测执行
```

---

# 核心目标

实现：

```Plain Text
公式库选择
↓
类型匹配过滤
↓
内联编辑
↓
策略 + 版本保存
↓
发布
```

---

# 服务边界

拥有：

```Plain Text
StrategyEditor 页面
RuleSlot 组件
DslReferencePanel 组件
```

依赖：

```Plain Text
Formula Workshop（FormulaEditor、ruleTypes、formula store）
Strategy Service API
Formula Engine API（函数列表）
```

---

# 组件设计

## StrategyEditor 页面

### 状态管理

```Plain Text
rules: Record<field, string>     七个规则槽位的表达式
form: Ant Design Form            策略信息 + 变更说明
```

rules 与 form 双向同步：FormulaEditor onChange → 更新 rules + form.setFieldValue。

### 初始化

新建模式：

```Plain Text
rules 全空
form.category = '选股'
```

编辑模式：

```Plain Text
加载策略信息 → form
加载最新版本 → rules
```

### 保存流程

```Plain Text
form.validateFields()
↓
新建：create strategy → createVersion → navigate
编辑：update strategy → createVersion → navigate
```

### 发布流程

```Plain Text
save（mutateAsync）
↓
listVersions → 取最新版本 id
↓
publish(strategyId, versionId)
↓
navigate
```

## RuleSlot 组件

每个规则槽位渲染：

```Plain Text
标签行：规则名称 + 返回类型 Tag + 必填/可选 Tag + 公式库下拉
编辑器：FormulaEditor（height=72px）
```

公式库下拉：

```Plain Text
数据源：formulaStore.getByType(ruleType)
onChange：将选中公式的 expression 写入 rules[field]
value={undefined}（选择后清空，不保持选中态）
```

## DslReferencePanel 组件

函数列表按 category 分组：

```Plain Text
Technical   技术指标函数
Math        数学函数
TimeSeries  时序函数
Signal      信号函数
```

变量列表按 category 分组：

```Plain Text
行情 / 财务 / 成长 / 市值 / 别名
```

每项显示签名 + 返回类型 Tag + 描述。

---

# 数据模型

## 规则槽位与字段映射

```Plain Text
stock_select   → formula_text
buy_rule       → buy_rule
sell_rule      → sell_rule
position_rule  → position_rule
rebalance_rule → rebalance_rule
risk_rule      → risk_rule
ranking_rule   → ranking_rule
```

映射由 `RULE_TYPES` 的 `field` 属性定义。

## 保存请求

创建版本时提交的 ruleData：

```TypeScript
{
  formula_text: string
  buy_rule: string
  sell_rule: string
  risk_rule: string
  position_rule: string
  rebalance_rule: string
  change_log: string
}
```

对齐后端 `CreateVersionRequest`（strategy.proto）。

---

# 接口契约

## Strategy Service API

```Plain Text
POST   /api/v1/strategies                  创建策略
PUT    /api/v1/strategies/:id              更新策略
GET    /api/v1/strategies/:id              获取策略
POST   /api/v1/strategies/:id/versions     创建版本
GET    /api/v1/strategies/:id/versions     版本列表
POST   /api/v1/strategies/:id/publish      发布策略
POST   /api/v1/strategies/:id/fork         Fork 策略
```

## Formula Engine API

```Plain Text
GET /api/v1/formulas/functions    函数列表（DSL 参考面板）
```

---

# 已知限制

## ranking_rule 未提交后端

后端 `CreateVersionRequest` 没有 `ranking_rule` 字段（proto 中无）。

前端定义了该槽位但保存时不提交。

后端补上后前端无需改动。
