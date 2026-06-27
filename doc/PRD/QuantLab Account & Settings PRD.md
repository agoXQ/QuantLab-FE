# QuantLab Account & Settings PRD

Version: 1.0

Module: Account & Settings（前端）

Priority: P0

Status: Draft

Owner: Product Team

Last Update: 2026-06

Dependencies:

- User Service（后端）

---

# 模块定位

Account & Settings 是 QuantLab 前端的账户模块。

负责：

```Plain Text
注册
登录
个人主页
资料编辑
密码修改
账号信息展示
```

不负责：

```Plain Text
策略管理
回测管理
组合管理
```

---

# 产品目标

让用户注册登录后管理自己的资料和安全设置。

实现：

```Plain Text
注册 / 登录
↓
JWT 持久化
↓
个人主页展示
↓
资料编辑
↓
密码修改
```

---

# 设计原则

## 原则1：注册即登录

注册成功后自动登录，不要求二次输入。

## 原则2：Token 客户端持久化

MVP 阶段 Token 存 localStorage。

生产环境应迁移到 httpOnly cookie。

## 原则3：设置分 Tab

个人资料、账号安全、账号信息分区展示。

---

# 功能范围

## P0

### 登录注册（Login）

```Plain Text
登录 / 注册切换（Segmented）
登录：邮箱 + 密码
注册：用户名 + 邮箱 + 密码（≥8位）
注册成功后自动登录
JWT 存入 zustand persist
```

### 个人主页（Profile）

```Plain Text
头像 + 用户名
认证 / 创作者 / 会员标签
简介
注册时间
统计数据（策略 / 回测 / 粉丝 / 关注）
关注按钮（非自己时）
策略列表表格
```

### 设置（Settings）

三个 Tab：

```Plain Text
个人资料：头像链接 / 昵称 / 简介 / 所在地
账号安全：修改密码（当前密码 + 新密码 + 确认）
账号信息：用户名 / 邮箱 / 状态 / 会员 / 创作者 / 认证 / 注册时间（只读）
```

## P2

### 通知偏好

后端无 API，暂不做。

### 登录历史

后端有 login_log 表但无查询接口，暂不做。

---

# 页面清单

| 路由 | 页面 | 说明 |
|---|---|---|
| /login | Login | 登录注册 |
| /u/:id | Profile | 个人主页 |
| /settings | Settings | 设置 |

---

# 数据依赖

```Plain Text
POST /api/v1/users/register          注册
POST /api/v1/users/login             登录
GET  /api/v1/users/:id               获取用户
GET  /api/v1/users/:id/profile       获取主页资料
PUT  /api/v1/users/:id/profile       修改资料
POST /api/v1/users/:id/password      修改密码
POST /api/v1/users/:id/follow        关注
GET  /api/v1/users/:id/strategies    用户策略列表
```
