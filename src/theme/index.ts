import type { ThemeConfig } from 'antd';
import { theme } from 'antd';

// QuantLab visual identity: a dark "trading terminal" surface tuned for
// data density. The accent is a teal-green (positive-return semantics)
// with amber reserved for risk / drawdown. The palette avoids the
// cliché purple-gradient SaaS look; this is a tool, not a brochure.
const { darkAlgorithm } = theme;

export const quantlabTheme: ThemeConfig = {
  algorithm: darkAlgorithm,
  token: {
    colorPrimary: '#16c784',
    colorInfo: '#16c784',
    colorSuccess: '#16c784',
    colorWarning: '#f0b90b',
    colorError: '#ea3943',
    colorBgBase: '#0b0e11',
    colorBgContainer: '#161b22',
    colorBgElevated: '#1c2330',
    colorBgLayout: '#0b0e11',
    colorTextBase: '#e6edf3',
    colorBorder: '#2a313c',
    colorBorderSecondary: '#21262d',
    colorBgSpotlight: '#1c2330',
    borderRadius: 6,
    fontSize: 13,
    fontFamily:
      "'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'PingFang SC', 'Microsoft YaHei', monospace",
  },
  components: {
    Layout: {
      siderBg: '#0d1117',
      headerBg: '#0d1117',
      bodyBg: '#0b0e11',
      triggerBg: '#1c2330',
    },
    Menu: {
      darkItemBg: '#0d1117',
      darkSubMenuItemBg: '#0d1117',
      darkItemSelectedBg: 'rgba(22, 199, 132, 0.15)',
      darkItemHoverBg: 'rgba(255, 255, 255, 0.04)',
    },
    Table: {
      headerBg: '#11161d',
      rowHoverBg: 'rgba(22, 199, 132, 0.06)',
      borderColor: '#21262d',
    },
    Card: {
      colorBgContainer: '#161b22',
      colorBorderSecondary: '#21262d',
    },
    Statistic: {
      contentFontSize: 22,
    },
  },
};
