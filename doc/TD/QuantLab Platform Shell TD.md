# QuantLab Platform Shell TD

Version: 1.0

Module: Platform Shell（前端）

Priority: P0

Owner: Architecture Team

Status: Draft

Last Update: 2026-06

Dependencies:

- 全部业务模块
- Ranking Service（后端）
- Strategy Service（后端）

---

# 服务定位

Platform Shell 前端模块负责：

```Plain Text
全局布局
路由 + 懒加载
认证守卫
主题配置
API 客户端（axios 拦截器）
错误边界
仪表盘 / 排行榜 / 策略列表 / 策略详情
通用组件（MetricCard / MetricValue）
```

---

# 核心目标

实现：

```Plain Text
BrowserRouter
↓
Protected 守卫
↓
AppLayout（Sider + Header + Content）
↓
Suspense + lazy 加载业务页面
↓
ErrorBoundary 兜底
```

---

# 服务边界

拥有：

```Plain Text
App.tsx（路由 + Provider）
AppLayout 组件
ErrorBoundary 组件
MetricCard / MetricValue 组件
Dashboard / Rankings / StrategyList / StrategyDetail / NotFound 页面
theme/index.ts
api/client.ts
```

---

# 组件设计

## App.tsx

### Provider 链

```Plain Text
QueryClientProvider
  → ConfigProvider（theme + locale zhCN）
    → AntdApp
      → BrowserRouter
        → ErrorBoundary
          → Suspense（PageFallback）
            → Routes
```

### 路由懒加载

```Plain Text
Dashboard        lazy
StrategyList     lazy
StrategyDetail   lazy
StrategyEditor   lazy
Rankings         lazy
Backtests        lazy
BacktestCreate   lazy
BacktestDetail   lazy
Portfolios       lazy
PortfolioDetail  lazy
Profile          lazy
Settings         lazy
FormulaWorkshop  lazy
FormulaSandbox   lazy
NotFound         lazy
```

Login 和 AppLayout 保持 eager（首屏需要）。

### Protected 守卫

```Plain Text
isAuthenticated ? <AppLayout/> : <Navigate to="/login"/>
```

## AppLayout 组件

```Plain Text
Sider（208px，可折叠）
  Logo（Q 图标 + QuantLab 文字）
  Menu（概览 / 策略 / 公式 / 回测 / 排行榜 / 组合）
Header（56px）
  折叠按钮
  通知铃铛（Badge count=0）
  用户头像 Dropdown（个人主页 / 设置 / 退出）
Content
  Outlet
```

选中键逻辑：路径前缀匹配，`/` 特殊处理。

## 主题（src/theme/index.ts）

Ant Design `darkAlgorithm` + 自定义 token：

```Plain Text
colorPrimary    #16c784（绿）
colorWarning    #f0b90b（金）
colorError      #ea3943（红）
colorBgBase     #0b0e11
colorBgContainer #161b22
fontSize        13
borderRadius    6
```

组件级覆盖：Layout / Menu / Table / Card / Statistic。

## API Client（src/api/client.ts）

### 请求拦截器

```Plain Text
Authorization: Bearer {accessToken}
X-Request-Id: crypto.randomUUID()
```

### 响应拦截器

```Plain Text
code === 0 → unwrap data（normalize null items → []）
code !== 0 → throw ApiError(code, message, status, requestId)
```

### ApiError

```TypeScript
class ApiError extends Error {
  code: number
  status: number
  requestId?: string
}
```

## ErrorBoundary 组件

```Plain Text
getDerivedStateFromError → hasError
componentDidCatch → console.error
渲染：Result error + 重试 + 返回首页
```

## MetricCard 组件

```Plain Text
Card + Statistic
title / value / precision / suffix / prefix / valueColor
等宽字体（JetBrains Mono）
```

## MetricValue 组件

```Plain Text
正数绿色 + 号，负数红色，零灰色
等宽字体
```

## Dashboard 页面

```Plain Text
4 项指标卡片（活跃策略 / 今日回测 / 创作者 / 数据覆盖）
策略排行榜 Table（Segmented 周期筛选）
热门策略侧边栏（Card 列表）
```

## Rankings 页面

```Plain Text
Segmented 类型（收益 / 夏普 / 胜率 / 回撤）
Segmented 周期（近1月 / 近1年 / 全部）
Table 排行（排名着色：1金 2银 3铜）
```

## StrategyList 页面

```Plain Text
Input 搜索 + Segmented 排序 + 新建策略按钮
Table（行点击跳转详情）
```

## StrategyDetail 页面

```Plain Text
策略信息 + 操作按钮（收藏 / Fork / 编辑 / 回测）
Descriptions（收藏 / Fork / 浏览 / 创建时间）
版本历史 Timeline
公式预览 pre
Fork：useMutation → fork → 跳转编辑
```

---

# 数据模型

## Page\<T\>

```TypeScript
interface Page<T> {
  items: T[]
  cursor?: { next_cursor: string; has_more: boolean }
}
```

客户端拦截器将 `items: null` 归一为 `items: []`。

## RankingItem / Strategy / StrategyVersion

对齐对应 proto 定义。

---

# 接口契约

## Ranking Service API

```Plain Text
GET /api/v1/rankings?type=&period=&limit=    排行榜
```

类型枚举：1=收益 2=夏普 3=胜率 4=回撤 5=稳定性 6=综合 7=人气
周期枚举：3=月 4=季 5=年 6=全部

## Strategy Service API

```Plain Text
GET /api/v1/strategies?keyword=&sort=&limit=    策略列表
GET /api/v1/strategies/:id                      策略详情
GET /api/v1/strategies/:id/versions             版本列表
POST /api/v1/strategies/:id/fork                Fork
```

---

# 构建优化

```Plain Text
manualChunks:
  echarts    → echarts zrender
  codemirror → @codemirror/* @uiw/* @lezer/*
  antd       → antd rc-* @ant-design/*
```

chunkSizeWarningLimit: 1400（antd 本体 1.3MB）

首屏加载：Shell + Login（eager），其余 lazy。
