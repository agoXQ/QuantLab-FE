# QuantLab Formula Screener PRD

Version: 1.0

Module: Formula Screener（公式选股）

Priority: P0

Status: Draft

Owner: Product Team

Last Update: 2026-06

Dependencies:

- Formula Engine（后端）
- Market Data Service（后端）
- Formula Workshop（前端）

---

# 模块定位

Formula Screener 是 QuantLab 面向投资研究工作流的公式选股工具。

负责：

```Plain Text
构建股票池
编写选股公式
执行横截面筛选
查看命中股票
保存公式
沉淀为策略入口
```

不负责：

```Plain Text
公式 DSL 编译器实现
行情数据采集
完整回测撮合
服务端结果快照持久化（MVP 暂不做）
```

---

# 产品目标

让用户能把一个选股想法快速变成可检查、可复用、可进入策略流程的结果。

```Plain Text
投资假设
↓
选股公式
↓
股票池与日期
↓
执行筛选
↓
检查结果
↓
保存公式 / 创建策略 / 进入回测
```

---

# MVP 范围

- 新增 `/formulas/screener` 公式选股页面。
- 使用 `POST /api/v1/formulas/screen` 执行服务端选股。
- 前端只提交公式、日期和股票池过滤条件，不在浏览器中拉取证券列表拼 universe。
- 支持从公式库加载 `stock_select` 公式、直接编辑、实时校验、保存公式。
- 支持交易所、行业、手工代码三类股票池条件；交易所和行业均为可选过滤项。
- 未选择交易所时默认使用全部交易所；未选择行业时默认使用全部行业。
- 股票池默认限定为上市股票（`asset_type=STOCK`、`status=LISTED`），不暴露给用户选择。
- `limit` 表示最多返回结果条数，不截断参与计算的候选股票池；服务端会分页扫描过滤后的股票池并设置保护性候选上限。
- 数据版本不暴露给用户，后端默认使用 Market Data 最新版本。
- 结果表展示股票代码、名称、交易所、行业、排名和分数。
- 点击结果股票可查看该股票 K 线，并在图中标注选股日期；若选股日非交易日，标注最近一个可见交易日并保留选股日期标签。
- 支持保留结果，后续进入策略/回测工作流。

---

# 后端能力

新增 Formula Service 应用用例：Screen。

接口：

```Plain Text
POST /api/v1/formulas/screen
```

请求：

```JSON
{
  "formula": "ROE > 15 AND PE < 20",
  "as_of_date": "2026-06-27",
  "universe_filter": {
    "market": "CN",
    "exchange": "SSE",
    "industry": "银行",
    "asset_type": "STOCK",
    "status": "LISTED",
    "stock_codes": []
  },
  "limit": 500
}
```

行为：

```Plain Text
接收公式和股票池过滤条件
↓
补齐默认股票池条件：STOCK + LISTED；空交易所/空行业不参与过滤
↓
由 Formula Service 的 Screen 用例通过 Market DataPort 查询股票池
↓
未指定 data_version 时解析 Market Data 最新版本
↓
调用现有 Evaluate pipeline 执行公式
↓
按 limit 截断返回结果，并返回带证券元信息的选股结果
```

响应：

```JSON
{
  "formula_hash": "...",
  "plan_type": "FILTER",
  "data_version": "2026.06.27",
  "universe_size": 500,
  "items": [
    {
      "stock_code": "600519",
      "stock_name": "贵州茅台",
      "exchange": "SSE",
      "industry": "白酒",
      "score": null,
      "selected": true
    }
  ]
}
```

边界：Formula Compiler 仍不拥有 Market Data；Screen 是 Formula Service application use case，通过 DataPort 读取证券主数据和行情/财务/因子数据。

---

# 后续增强

- 后端新增 Screener Run 结果快照与审计记录。
- 支持结果导出、收藏、对比和一键创建策略。
- 支持筛选公式与排序公式组合执行。
