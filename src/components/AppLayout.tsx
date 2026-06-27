import { useState } from 'react';
import { Layout, Menu, Avatar, Dropdown, Space, Typography, Badge } from 'antd';
import {
  DashboardOutlined,
  ExperimentOutlined,
  LineChartOutlined,
  TrophyOutlined,
  FundOutlined,
  FunctionOutlined,
  UserOutlined,
  BellOutlined,
  LogoutOutlined,
  SettingOutlined,
  MenuFoldOutlined,
  MenuUnfoldOutlined,
} from '@ant-design/icons';
import { Outlet, useNavigate, useLocation } from 'react-router-dom';
import { useTokenStore } from '@/store/auth';

const { Header, Sider, Content } = Layout;
const { Text } = Typography;

const menuItems = [
  { key: '/', icon: <DashboardOutlined />, label: '概览' },
  { key: '/strategies', icon: <ExperimentOutlined />, label: '策略' },
  { key: '/formulas', icon: <FunctionOutlined />, label: '公式' },
  { key: '/backtests', icon: <LineChartOutlined />, label: '回测' },
  { key: '/rankings', icon: <TrophyOutlined />, label: '排行榜' },
  { key: '/portfolios', icon: <FundOutlined />, label: '组合' },
];

export default function AppLayout() {
  const [collapsed, setCollapsed] = useState(false);
  const navigate = useNavigate();
  const location = useLocation();
  const { isAuthenticated, userId, logout } = useTokenStore();

  const selectedKey =
    menuItems.find((m) => m.key !== '/' && location.pathname.startsWith(m.key))?.key ??
    (location.pathname === '/' ? '/' : '/');

  return (
    <Layout style={{ minHeight: '100vh' }}>
      <Sider
        trigger={null}
        collapsible
        collapsed={collapsed}
        width={208}
        style={{ borderRight: '1px solid #21262d' }}
      >
        <div
          style={{
            height: 56,
            display: 'flex',
            alignItems: 'center',
            gap: 10,
            padding: '0 20px',
            borderBottom: '1px solid #21262d',
          }}
        >
          <div
            style={{
              width: 28,
              height: 28,
              borderRadius: 6,
              background: 'linear-gradient(135deg, #16c784 0%, #0ea968 100%)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontWeight: 800,
              fontSize: 15,
              color: '#0b0e11',
              flexShrink: 0,
            }}
          >
            Q
          </div>
          {!collapsed && (
            <Text strong style={{ fontSize: 15, letterSpacing: 0.5 }}>
              QuantLab
            </Text>
          )}
        </div>
        <Menu
          theme="dark"
          mode="inline"
          selectedKeys={[selectedKey]}
          items={menuItems}
          onClick={({ key }) => navigate(key)}
          style={{ borderRight: 0, marginTop: 8 }}
        />
      </Sider>
      <Layout>
        <Header
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            padding: '0 24px',
            borderBottom: '1px solid #21262d',
            height: 56,
          }}
        >
          <Space
            style={{ cursor: 'pointer', fontSize: 16, color: '#8b949e' }}
            onClick={() => setCollapsed(!collapsed)}
          >
            {collapsed ? <MenuUnfoldOutlined /> : <MenuFoldOutlined />}
          </Space>
          <Space size={20}>
            <Badge count={0} showZero={false} size="small">
              <BellOutlined style={{ fontSize: 17, color: '#8b949e', cursor: 'pointer' }} />
            </Badge>
            {isAuthenticated ? (
              <Dropdown
                menu={{
                  items: [
                    {
                      key: 'profile',
                      icon: <UserOutlined />,
                      label: '个人主页',
                      onClick: () => navigate(`/u/${userId}`),
                    },
                    { key: 'settings', icon: <SettingOutlined />, label: '设置', onClick: () => navigate('/settings') },
                    { type: 'divider' as const },
                    {
                      key: 'logout',
                      icon: <LogoutOutlined />,
                      label: '退出登录',
                      onClick: () => {
                        logout();
                        navigate('/login');
                      },
                    },
                  ],
                }}
                placement="bottomRight"
              >
                <Avatar
                  size={32}
                  style={{ background: '#1c2330', border: '1px solid #2a313c', cursor: 'pointer' }}
                  icon={<UserOutlined />}
                />
              </Dropdown>
            ) : (
              <Text
                style={{ color: '#16c784', cursor: 'pointer', fontSize: 13 }}
                onClick={() => navigate('/login')}
              >
                登录
              </Text>
            )}
          </Space>
        </Header>
        <Content style={{ padding: 24, overflow: 'auto' }}>
          <Outlet />
        </Content>
      </Layout>
    </Layout>
  );
}
