import { Component, type ReactNode } from 'react';
import { Result, Button } from 'antd';

interface Props {
  children: ReactNode;
}
interface State {
  hasError: boolean;
  message: string;
}

// Catches render-time errors so a single broken page cannot blank the
// whole app (the previous failure mode was a white screen with no clue).
export default class ErrorBoundary extends Component<Props, State> {
  state: State = { hasError: false, message: '' };

  static getDerivedStateFromError(err: unknown): State {
    return { hasError: true, message: err instanceof Error ? err.message : String(err) };
  }

  componentDidCatch(err: unknown) {
    // eslint-disable-next-line no-console
    console.error('[QuantLab] render error:', err);
  }

  render() {
    if (this.state.hasError) {
      return (
        <Result
          status="error"
          title="页面渲染出错"
          subTitle={this.state.message}
          extra={[
            <Button key="retry" type="primary" onClick={() => this.setState({ hasError: false, message: '' })}>
              重试
            </Button>,
            <Button key="home" onClick={() => { window.location.href = '/'; }}>
              返回首页
            </Button>,
          ]}
        />
      );
    }
    return this.props.children;
  }
}
