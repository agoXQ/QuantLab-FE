# QuantLab Formula Workshop TD

Version: 1.0

Module: Formula Workshop（前端）

Priority: P0

Owner: Architecture Team

Status: Draft

Last Update: 2026-06

Dependencies:

- Formula Engine（后端）
- Market Data Service（后端）

---

# 服务定位

Formula Workshop 前端模块负责：

```Plain Text
DSL 语法高亮
自动补全
实时校验
公式库 CRUD
公式试算
规则类型管理
```

不负责：

```Plain Text
策略组合
回测执行
公式持久化（后端）
```

---

# 核心目标

实现：

```Plain Text
用户输入 DSL
↓
语法高亮 + 自动补全
↓
防抖校验
↓
公式库管理 / 试算执行
```

---

# 服务边界

拥有：

```Plain Text
FormulaEditor 组件
DSL 语言定义
补全数据源
公式库 Store
FormulaWorkshop 页面
FormulaSandbox 页面
```

依赖：

```Plain Text
Formula Engine API（validate / evaluate / listFunctions）
Market Data API（listSecurities）
```

---

# 组件设计

## FormulaEditor

基于 `@uiw/react-codemirror`。

### 扩展链

```Plain Text
dslExtensions        语言 + 高亮 + 主题
buildCompletionExt   自动补全（函数 + 变量 + 关键字）
lintExt              异步校验（防抖 600ms）
EditorView.lineWrapping
```

### DSL 语言定义（src/dsl/language.ts）

使用 `StreamLanguage` 定义 tokenizer。

Token 类型：

```Plain Text
lineComment    // 注释
string         "字符串"
number         数字（含科学计数法）
typeName       函数名（标识符后跟 '('）
variableName   变量名
keyword        AND OR NOT TRUE FALSE
operator       + - * / % > < >= <= == !=
paren          ( )
separator      ,
```

### 高亮样式（dslHighlightStyle）

```Plain Text
注释      #484f58 italic
字符串    #a5d6ff
数字      #f0b90b
关键字    #ff7b72 bold
函数名    #d2a8ff
变量名    #79c0ff
运算符    #16c784
括号/分隔  #8b949e
```

### 自动补全（src/dsl/completion.ts）

补全数据源：

```Plain Text
函数    GET /formulas/functions → 22 个内置函数
变量    BUILTIN_VARIABLES（镜像后端 registry）
关键字  AND OR NOT TRUE FALSE
```

交互：

```Plain Text
输入即触发
Tab / Enter 确认选中项
函数补全自动补左括号
Ctrl+Space 手动触发
```

Keymap：

```Plain Text
Tab   → acceptCompletion（无补全时 fall through）
Enter → acceptCompletion（无补全时 fall through 换行）
```

### 校验（FormulaEditor 内 linter）

```Plain Text
防抖 600ms
↓
POST /formulas/validate { formula }
↓
valid=false → 解析 error 中的 pos:N → Diagnostic
valid=true  → 清除诊断
```

## 规则类型注册表（src/dsl/ruleTypes.ts）

七种规则类型，每种绑定：

```Plain Text
type          规则类型标识
field         StrategyVersion 字段名
label         中文标签
returnType    DSL 返回类型
required      是否必填
hint          提示文案
example       示例表达式
```

驱动：

```Plain Text
公式工作台的类型标签
策略编辑器的槽位过滤
公式试算的结果类型判断
```

## 公式库 Store（src/store/formula.ts）

zustand + persist（localStorage）。

```Plain Text
formulas    SavedFormula[]
add         新增（返回 id）
update      更新
remove      删除
getByType   按类型筛选
```

预置 5 个示例公式。

未来切换为后端 API 时，Store 接口不变，页面不改。

## FormulaWorkshop 页面

```Plain Text
Segmented 类型筛选
Table 公式列表（名称 / 类型 / 返回类型 / 表达式 / 时间 / 操作）
Modal 新建/编辑（名称 / 类型 / FormulaEditor / 描述）
Popconfirm 删除
```

## FormulaSandbox 页面

```Plain Text
左栏：公式输入（FormulaEditor + 公式库下拉）
右栏：执行参数（日期 + 股票池多选）
底部：试算结果（按 plan_type 渲染不同表格）
```

结果渲染：

```Plain Text
FILTER / SIGNAL → selection 列表
SORT            → ranking（代码 + 评分）
VALUE           → values（代码 + 数值）
```

---

# 数据模型

## SavedFormula

```TypeScript
interface SavedFormula {
  id: string
  name: string
  rule_type: RuleType
  expression: string
  description: string
  created_at: number
  updated_at: number
}
```

## BUILTIN_VARIABLES

21 个内置变量，镜像 `app/formula/infrastructure/variable/registry.go`。

分类：

```Plain Text
行情  OPEN HIGH LOW CLOSE VOL AMOUNT
财务  PE PB PS ROE ROA EPS
成长  RevenueGrowth ProfitGrowth
市值  MarketCap FloatMarketCap
别名  C O H L V
```

---

# 接口契约

## Formula Engine API

```Plain Text
GET  /api/v1/formulas/functions         函数列表
POST /api/v1/formulas/validate          公式校验
POST /api/v1/formulas/evaluate          公式试算
POST /api/v1/formulas/compile           公式编译（预留）
```

### evaluate 请求

```JSON
{
  "formula": "ROE > 15 AND PE < 20",
  "universe": ["000001", "000002"],
  "as_of_date": "2024-06-01"
}
```

### evaluate 响应

```JSON
{
  "formula_hash": "85104316...",
  "plan_type": "FILTER",
  "selection": ["000001"],
  "ranking": [],
  "values": []
}
```

## Market Data API

```Plain Text
GET  /api/v1/markets/securities        股票列表（股票池）
```

---

# 构建优化

CodeMirror 6 依赖拆为独立 vendor chunk：

```Plain Text
manualChunks:
  codemirror → @codemirror/* @uiw/* @lezer/*
  echarts    → echarts zrender
  antd       → antd rc-* @ant-design/*
```

StrategyEditor 页面代码 14KB，CodeMirror vendor 402KB 按需加载。

---

# 已知限制

## 变量列表非实时

`BUILTIN_VARIABLES` 镜像后端源码，不通过 API 获取。

后端新增内置变量时需同步更新。

彻底方案：后端补 `GET /formulas/variables` 接口。

## 公式库客户端持久化

localStorage 存储，不跨设备同步。

后端补公式 CRUD 后迁移。

## evaluate 网关代理

Evaluate 不在 gRPC proto 中，网关通过 HTTP reverse-proxy 转发到 formula service 的 8081 端口。
