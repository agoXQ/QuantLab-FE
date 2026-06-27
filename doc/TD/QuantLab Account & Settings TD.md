# QuantLab Account & Settings TD

Version: 1.0

Module: Account & Settings（前端）

Priority: P0

Owner: Architecture Team

Status: Draft

Last Update: 2026-06

Dependencies:

- User Service（后端）

---

# 服务定位

Account & Settings 前端模块负责：

```Plain Text
认证状态管理
登录 / 注册
个人主页
资料编辑
密码修改
```

---

# 核心目标

实现：

```Plain Text
注册 / 登录
↓
JWT 持久化（zustand persist + localStorage）
↓
路由守卫（Protected）
↓
个人主页 / 设置
```

---

# 服务边界

拥有：

```Plain Text
Login 页面
Profile 页面
Settings 页面
auth Store（src/store/auth.ts）
```

依赖：

```Plain Text
User Service API
```

---

# 组件设计

## Auth Store（src/store/auth.ts）

zustand + persist（localStorage，key: `quantlab-auth`）。

```TypeScript
interface AuthState {
  accessToken: string | null
  refreshToken: string | null
  userId: number | null
  isAuthenticated: boolean
  login: (tokens) => void
  logout: () => void
}
```

API Client 拦截器从 Store 读取 token 注入 `Authorization: Bearer`。

## 路由守卫（App.tsx Protected）

```Plain Text
isAuthenticated ? children : <Navigate to="/login" />
```

## Login 页面

```Plain Text
Segmented 切换 login / register
Ant Design Form
登录：userApi.login → store.login
注册：userApi.register → userApi.login（自动登录）→ store.login
```

注册接口只返回 user_id（对齐 proto），不返回 token，所以注册后需自动调 login。

## Profile 页面

```Plain Text
useQuery userApi.getProfile(uid)
useQuery userApi.listStrategies(uid)
Row 布局：头像 + 用户名 + 标签 + 简介 + 统计
关注按钮：useMutation userApi.follow(uid)
策略列表 Table
```

标签判断：

```Plain Text
verified_status === 2 → 已认证
creator_status === 2  → 创作者
membership_tier !== 'FREE' → 会员
```

## Settings 页面

### 个人资料 Tab

```Plain Text
Form：头像链接 / 昵称 / 简介 / 所在地
useMutation userApi.updateProfile(userId, data)
成功后 invalidate user + profile
```

### 账号安全 Tab

```Plain Text
Form：当前密码 / 新密码 / 确认密码
校验：新密码 ≥ 8 位，两次一致
useMutation userApi.changePassword(userId, data)
成功后提示重新登录
```

### 账号信息 Tab

只读 Descriptions：

```Plain Text
用户名 / 邮箱 / 账号状态 / 会员等级 / 创作者身份 / 认证状态 / 注册时间
```

枚举映射：

```Plain Text
status:         1=正常 2=冻结 3=注销
creator_status: 1=未开通 2=创作者
verified_status: 1=未认证 2=已认证 3=认证失败
```

---

# 数据模型

## User

对齐 `user.proto` User。

## Profile

```TypeScript
interface Profile {
  user: User
  follower_count: number
  following_count: number
  strategy_count: number
  backtest_count: number
}
```

---

# 接口契约

## User Service API

```Plain Text
POST /api/v1/users/register              注册（返回 user_id）
POST /api/v1/users/login                 登录（返回 tokens）
GET  /api/v1/users/:id                   获取用户
GET  /api/v1/users/:id/profile           主页资料
PUT  /api/v1/users/:id/profile           修改资料
POST /api/v1/users/:id/password          修改密码
POST /api/v1/users/:id/follow            关注
DELETE /api/v1/users/:id/follow          取消关注
GET  /api/v1/users/:id/strategies        用户策略列表
POST /api/v1/users/token/refresh         刷新 Token
```

注意：后端无 `/users/me`，所有接口通过 `:id` 定位，id 从 Store 的 userId 获取。

---

# 已知限制

## Token 存 localStorage

MVP 方案，XSS 风险。

生产应迁移 httpOnly cookie。

## 无 /users/me

后端用 `:id` 路由，`me` 会被解析为非法 id。

前端从 Store 取 userId 拼 `:id`。

## /users/:id/strategies 后端未实现

接口返回 404，Profile 页面策略列表显示空。

不影响页面渲染（react-query 隔离错误）。
