import { useState } from 'react';
import { Card, Form, Input, Button, Typography, Divider, message } from 'antd';
import { MailOutlined, LockOutlined, UserOutlined } from '@ant-design/icons';
import { useNavigate, Link } from 'react-router-dom';
import { userApi } from '@/api/user';
import { useTokenStore } from '@/store/auth';
import { ApiError } from '@/api/client';

const { Title, Text } = Typography;

export default function Login() {
  const [mode, setMode] = useState<'login' | 'register'>('login');
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();
  const login = useTokenStore((s) => s.login);
  const [form] = Form.useForm();

  const onFinish = async (values: Record<string, string>) => {
    setLoading(true);
    try {
      if (mode === 'login') {
        const res = await userApi.login({ email: values.email, password: values.password });
        login({ access_token: res.access_token, refresh_token: res.refresh_token, user_id: res.user_id });
      } else {
        // Register endpoint returns only user_id (per user.proto); auto-login
        // so the user lands in the app without a second round-trip.
        await userApi.register({
          username: values.username,
          email: values.email,
          password: values.password,
        });
        const res = await userApi.login({ email: values.email, password: values.password });
        login({ access_token: res.access_token, refresh_token: res.refresh_token, user_id: res.user_id });
      }
      message.success(mode === 'login' ? '登录成功' : '注册成功');
      navigate('/');
    } catch (e) {
      const msg = e instanceof ApiError ? e.message : '请求失败，请检查网络';
      message.error(msg);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div
      style={{
        minHeight: '100vh',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        background: '#0b0e11',
        position: 'relative',
        overflow: 'hidden',
      }}
    >
      {/* Subtle grid backdrop */}
      <div
        style={{
          position: 'absolute',
          inset: 0,
          backgroundImage:
            'linear-gradient(rgba(22,199,132,0.03) 1px, transparent 1px), linear-gradient(90deg, rgba(22,199,132,0.03) 1px, transparent 1px)',
          backgroundSize: '40px 40px',
          maskImage: 'radial-gradient(ellipse at center, black 30%, transparent 70%)',
        }}
      />
      <Card
        style={{
          width: 400,
          background: '#161b22',
          border: '1px solid #2a313c',
          position: 'relative',
          zIndex: 1,
        }}
      >
        <div style={{ textAlign: 'center', marginBottom: 28 }}>
          <div
            style={{
              width: 48,
              height: 48,
              borderRadius: 12,
              background: 'linear-gradient(135deg, #16c784 0%, #0ea968 100%)',
              display: 'inline-flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontWeight: 800,
              fontSize: 26,
              color: '#0b0e11',
              marginBottom: 16,
            }}
          >
            Q
          </div>
          <Title level={4} style={{ margin: 0, marginBottom: 4 }}>
            QuantLab
          </Title>
          <Text type="secondary" style={{ fontSize: 12 }}>
            量化策略实验室
          </Text>
        </div>

        <div style={{ display: 'flex', gap: 0, marginBottom: 24, background: '#0d1117', borderRadius: 6, padding: 3 }}>
          {(['login', 'register'] as const).map((m) => (
            <button
              key={m}
              onClick={() => setMode(m)}
              style={{
                flex: 1,
                padding: '7px 0',
                border: 'none',
                borderRadius: 4,
                background: mode === m ? '#16c784' : 'transparent',
                color: mode === m ? '#0b0e11' : '#8b949e',
                fontWeight: 600,
                fontSize: 13,
                cursor: 'pointer',
                transition: 'all 0.2s',
              }}
            >
              {m === 'login' ? '登录' : '注册'}
            </button>
          ))}
        </div>

        <Form form={form} layout="vertical" onFinish={onFinish} requiredMark={false}>
          {mode === 'register' && (
            <Form.Item name="username" rules={[{ required: true, message: '请输入用户名' }]}>
              <Input prefix={<UserOutlined />} placeholder="用户名" size="large" />
            </Form.Item>
          )}
          <Form.Item name="email" rules={[{ required: true, message: '请输入邮箱' }, { type: 'email', message: '邮箱格式不正确' }]}>
            <Input prefix={<MailOutlined />} placeholder="邮箱" size="large" />
          </Form.Item>
          <Form.Item name="password" rules={[{ required: true, message: '请输入密码' }, { min: 8, message: '密码至少 8 位' }]}>
            <Input.Password prefix={<LockOutlined />} placeholder="密码" size="large" />
          </Form.Item>
          <Form.Item style={{ marginBottom: 12 }}>
            <Button type="primary" htmlType="submit" block size="large" loading={loading}>
              {mode === 'login' ? '登录' : '创建账户'}
            </Button>
          </Form.Item>
        </Form>

        <Divider style={{ margin: '12px 0', borderColor: '#21262d' }} />
        <div style={{ textAlign: 'center' }}>
          {mode === 'login' ? (
            <Text style={{ fontSize: 12, color: '#8b949e' }}>
              还没有账户？
              <Link to="/login" onClick={() => setMode('register')} style={{ color: '#16c784', marginLeft: 4 }}>
                立即注册
              </Link>
            </Text>
          ) : (
            <Text style={{ fontSize: 12, color: '#8b949e' }}>
              已有账户？
              <Link to="/login" onClick={() => setMode('login')} style={{ color: '#16c784', marginLeft: 4 }}>
                去登录
              </Link>
            </Text>
          )}
        </div>
      </Card>
    </div>
  );
}
