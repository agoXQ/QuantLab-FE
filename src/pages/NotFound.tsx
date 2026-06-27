import { Button, Typography } from 'antd';
import { useNavigate } from 'react-router-dom';

const { Title, Text } = Typography;

export default function NotFound() {
  const navigate = useNavigate();
  return (
    <div style={{ textAlign: 'center', padding: 120 }}>
      <Title style={{ color: '#484f58' }}>404</Title>
      <Text type="secondary">页面不存在</Text>
      <br />
      <Button type="primary" onClick={() => navigate('/')} style={{ marginTop: 16 }}>返回首页</Button>
    </div>
  );
}
