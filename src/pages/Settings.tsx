import { useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  Card,
  Tabs,
  Form,
  Input,
  Button,
  Typography,
  Space,
  Descriptions,
  Tag,
  Avatar,
  Skeleton,
  Empty,
  App,
} from 'antd';
import {
  UserOutlined,
  LockOutlined,
  InfoCircleOutlined,
  KeyOutlined,
} from '@ant-design/icons';
import dayjs from 'dayjs';
import { userApi } from '@/api/user';
import { useTokenStore } from '@/store/auth';
import { ApiError } from '@/api/client';

const { Title, Text } = Typography;

// Read-only account badges. The status / creator / verified enums match
// the user-service valueobject definitions (1 = pending/inactive ...).
const statusLabel: Record<number, { text: string; color: string }> = {
  1: { text: '正常', color: 'green' },
  2: { text: '冻结', color: 'red' },
  3: { text: '注销', color: 'default' },
};
const creatorLabel: Record<number, { text: string; color: string }> = {
  1: { text: '未开通', color: 'default' },
  2: { text: '创作者', color: 'green' },
};
const verifiedLabel: Record<number, { text: string; color: string }> = {
  1: { text: '未认证', color: 'default' },
  2: { text: '已认证', color: 'blue' },
  3: { text: '认证失败', color: 'orange' },
};

interface ProfileForm {
  nickname: string;
  avatar: string;
  bio: string;
  location: string;
}

interface PasswordForm {
  current_password: string;
  new_password: string;
  confirm: string;
}

export default function Settings() {
  const userId = useTokenStore((s) => s.userId);
  const qc = useQueryClient();
  const { message } = App.useApp();
  const [profileForm] = Form.useForm<ProfileForm>();
  const [pwdForm] = Form.useForm<PasswordForm>();

  const { data: user, isLoading } = useQuery({
    queryKey: ['user', userId],
    queryFn: () => userApi.getUser(userId!),
    enabled: !!userId,
  });

  // Pre-fill the profile form once the user loads.
  useEffect(() => {
    if (!user) return;
    // The backend User carries bio/avatar but not nickname/location in
    // the proto (username stands in for display name); seed what we have.
    profileForm.setFieldsValue({
      nickname: user.username,
      avatar: user.avatar,
      bio: user.bio,
      location: '',
    });
  }, [user, profileForm]);

  const saveProfile = useMutation({
    mutationFn: (v: ProfileForm) =>
      userApi.updateProfile(userId!, {
        nickname: v.nickname,
        avatar: v.avatar,
        bio: v.bio,
        location: v.location,
      }),
    onSuccess: () => {
      message.success('资料已保存');
      qc.invalidateQueries({ queryKey: ['user', userId] });
      qc.invalidateQueries({ queryKey: ['profile', userId] });
    },
    onError: (e) => message.error(e instanceof ApiError ? e.message : '保存失败'),
  });

  const changePwd = useMutation({
    mutationFn: (v: PasswordForm) =>
      userApi.changePassword(userId!, {
        current_password: v.current_password,
        new_password: v.new_password,
      }),
    onSuccess: () => {
      message.success('密码已修改，请重新登录');
      pwdForm.resetFields();
    },
    onError: (e) => message.error(e instanceof ApiError ? e.message : '修改失败'),
  });

  if (isLoading) return <Skeleton active paragraph={{ rows: 8 }} />;
  if (!user) return <Empty description="未获取到用户信息" />;

  return (
    <Space direction="vertical" size={16} style={{ width: '100%' }}>
      <Title level={4} style={{ margin: 0 }}>设置</Title>

      <Card>
        <Tabs
          defaultActiveKey="profile"
          items={[
            {
              key: 'profile',
              label: (
                <span>
                  <UserOutlined /> 个人资料
                </span>
              ),
              children: (
                <ProfileTab
                  form={profileForm}
                  submitting={saveProfile.isPending}
                  onSave={(v) => saveProfile.mutate(v)}
                  avatar={user.avatar}
                />
              ),
            },
            {
              key: 'security',
              label: (
                <span>
                  <LockOutlined /> 账号安全
                </span>
              ),
              children: (
                <SecurityTab
                  form={pwdForm}
                  submitting={changePwd.isPending}
                  onSubmit={(v) => changePwd.mutate(v)}
                />
              ),
            },
            {
              key: 'account',
              label: (
                <span>
                  <InfoCircleOutlined /> 账号信息
                </span>
              ),
              children: <AccountTab user={user} />,
            },
          ]}
        />
      </Card>
    </Space>
  );
}

function ProfileTab({
  form,
  submitting,
  onSave,
  avatar,
}: {
  form: ReturnType<typeof Form.useForm<ProfileForm>>[0];
  submitting: boolean;
  onSave: (v: ProfileForm) => void;
  avatar?: string;
}) {
  return (
    <Form
      form={form}
      layout="vertical"
      requiredMark={false}
      style={{ maxWidth: 480 }}
      onFinish={onSave}
    >
      <Form.Item label="头像">
        <Avatar size={64} src={avatar} icon={<UserOutlined />} style={{ background: '#1c2330' }} />
      </Form.Item>
      <Form.Item
        name="avatar"
        label="头像链接"
        tooltip="填写图片 URL"
      >
        <Input placeholder="https://..." />
      </Form.Item>
      <Form.Item
        name="nickname"
        label="昵称"
        rules={[{ required: true, message: '请输入昵称' }, { max: 32 }]}
      >
        <Input placeholder="展示给其他用户的名称" />
      </Form.Item>
      <Form.Item name="bio" label="个人简介">
        <Input.TextArea rows={3} placeholder="一句话介绍自己" />
      </Form.Item>
      <Form.Item name="location" label="所在地">
        <Input placeholder="例如：上海" />
      </Form.Item>
      <Form.Item>
        <Button type="primary" htmlType="submit" loading={submitting}>
          保存资料
        </Button>
      </Form.Item>
    </Form>
  );
}

function SecurityTab({
  form,
  submitting,
  onSubmit,
}: {
  form: ReturnType<typeof Form.useForm<PasswordForm>>[0];
  submitting: boolean;
  onSubmit: (v: PasswordForm) => void;
}) {
  return (
    <Form
      form={form}
      layout="vertical"
      requiredMark
      style={{ maxWidth: 480 }}
      onFinish={onSubmit}
    >
      <Form.Item
        name="current_password"
        label="当前密码"
        rules={[{ required: true, message: '请输入当前密码' }]}
      >
        <Input.Password prefix={<KeyOutlined />} placeholder="当前密码" />
      </Form.Item>
      <Form.Item
        name="new_password"
        label="新密码"
        rules={[
          { required: true, message: '请输入新密码' },
          { min: 8, message: '密码至少 8 位' },
        ]}
      >
        <Input.Password prefix={<LockOutlined />} placeholder="至少 8 位" />
      </Form.Item>
      <Form.Item
        name="confirm"
        label="确认新密码"
        dependencies={['new_password']}
        rules={[
          { required: true, message: '请再次输入新密码' },
          ({ getFieldValue }) => ({
            validator(_, value) {
              if (!value || getFieldValue('new_password') === value) return Promise.resolve();
              return Promise.reject(new Error('两次输入的密码不一致'));
            },
          }),
        ]}
      >
        <Input.Password prefix={<LockOutlined />} placeholder="再次输入新密码" />
      </Form.Item>
      <Form.Item>
        <Button type="primary" htmlType="submit" loading={submitting}>
          修改密码
        </Button>
      </Form.Item>
    </Form>
  );
}

function AccountTab({ user }: { user: import('@/types').User }) {
  const status = statusLabel[user.status] ?? { text: String(user.status), color: 'default' };
  const creator = creatorLabel[user.creator_status] ?? { text: '—', color: 'default' };
  const verified = verifiedLabel[user.verified_status] ?? { text: '—', color: 'default' };
  return (
    <Descriptions column={1} bordered size="small" style={{ maxWidth: 480 }}>
      <Descriptions.Item label="用户名">{user.username}</Descriptions.Item>
      <Descriptions.Item label="邮箱">{user.email}</Descriptions.Item>
      <Descriptions.Item label="账号状态">
        <Tag bordered={false} color={status.color}>{status.text}</Tag>
      </Descriptions.Item>
      <Descriptions.Item label="会员等级">
        <Tag bordered={false} color={user.membership_tier && user.membership_tier !== 'FREE' ? 'gold' : 'default'}>
          {user.membership_tier || 'FREE'}
        </Tag>
      </Descriptions.Item>
      <Descriptions.Item label="创作者身份">
        <Tag bordered={false} color={creator.color}>{creator.text}</Tag>
      </Descriptions.Item>
      <Descriptions.Item label="认证状态">
        <Tag bordered={false} color={verified.color}>{verified.text}</Tag>
      </Descriptions.Item>
      <Descriptions.Item label="注册时间">
        {user.created_at ? dayjs.unix(user.created_at).format('YYYY-MM-DD HH:mm') : '—'}
      </Descriptions.Item>
    </Descriptions>
  );
}
