# QuantLab Platform Shell PRD

Version: 1.0

Module: Platform Shell（前端）

Priority: P0

Status: Draft

Owner: Product Team

Last Update: 2026-06

Dependencies:

- Ranking Service（后端）
- Strategy Service（后端）
- 全部业务模块

---

# 模块定位

Platform Shell 是 QuantLab 前端的基础框架模块。

负责：

```Plain Text
全局布局
侧边导航
路由守卫
仪表盘
排行榜
策略列表
策略详情
错误边界
主题配置
API 客户端
```

不负责：

```Plain Text
具体业务逻辑（各业务模块负责）
```

---

# 产品目标

为所有业务页面提供统一的外壳：导航、布局、主题、错误兜底、数据请求基础设施。

实现：

```Plain Text
用户访问
↓
路由匹配
↓
认证守卫
↓
AppLayout 渲染
↓
业务页面加载（lazy）
```

---

# 设计原则

## 原则1：暗色交易终端风格

深色背景，绿色主色调，高数据密度。

不做营销页面的装饰性元素。

## 原则2：路由级懒加载

所有业务页面 lazy import + Suspense。

首屏只加载 Shell + Login。

## 原则3：错误兜底

ErrorBoundary 包裹路由，单页崩溃不白屏。

---

# 功能范围

## P0

### 全局布局（AppLayout）

```Plain Text
Sider：Logo + 导航菜单（可折叠）
Header：折叠按钮 + 通知 + 用户头像下拉
Content：Outlet
```

导航项：概览 / 策略 / 公式 / 回测 / 排行榜 / 组合

用户下拉：个人主页 / 设置 / 退出登录

### 仪表盘（Dashboard）

```Plain Text
4 项平台指标卡片
策略排行榜表格（含周期筛选）
热门策略侧边栏
```

### 排行榜（Rankings）

```Plain Text
类型筛选（收益 / 夏普 / 胜率 / 回撤）
周期筛选（近1月 / 近1年 / 全部）
排行表格（排名 / 策略 / 作者 / 评分 / 收益 / 夏普 / 回撤 / 胜率）
```

### 策略列表（StrategyList）

```Plain Text
搜索 + 排序（最热 / 最新 / 浏览）
表格（名称 / 分类 / 标签 / 状态 / 收藏 / Fork / 浏览）
新建策略按钮
```

### 策略详情（StrategyDetail）

```Plain Text
策略信息 + 收藏 / Fork / 编辑 / 回测按钮
版本历史（Timeline）
公式预览
```

### 错误边界（ErrorBoundary）

```Plain Text
捕获渲染异常
显示错误信息 + 重试 + 返回首页
防止白屏
```

### 404 页面

## P2

### 通知中心

Header 有铃铛图标，后端 Notification Service 是 P2。

---

# 页面清单

| 路由 | 页面 | 说明 |
|---|---|---|
| / | Dashboard | 仪表盘 |
| /strategies | StrategyList | 策略库 |
| /strategies/:id | StrategyDetail | 策略详情 |
| /rankings | Rankings | 排行榜 |
| * | NotFound | 404 |

---

# 数据依赖

```Plain Text
GET /api/v1/rankings                   排行榜
GET /api/v1/strategies                 策略列表
GET /api/v1/strategies/:id             策略详情
GET /api/v1/strategies/:id/versions    策略版本
```
