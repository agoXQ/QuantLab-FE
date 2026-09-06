import { lazy, Suspense } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { ConfigProvider, App as AntdApp, Spin } from 'antd';
import zhCN from 'antd/locale/zh_CN';
import { quantlabTheme } from '@/theme';
import AppLayout from '@/components/AppLayout';
import ErrorBoundary from '@/components/ErrorBoundary';
import Login from '@/pages/Login';
import { useTokenStore } from '@/store/auth';

// Route-level code splitting keeps echarts / antd heavy views out of the
// initial bundle. The shell (layout + login) stays eager for fast first paint.
const Dashboard = lazy(() => import('@/pages/Dashboard'));
const StrategyList = lazy(() => import('@/pages/StrategyList'));
const StrategyDetail = lazy(() => import('@/pages/StrategyDetail'));
const StrategyEditor = lazy(() => import('@/pages/StrategyEditor'));
const Rankings = lazy(() => import('@/pages/Rankings'));
const Backtests = lazy(() => import('@/pages/Backtests'));
const Trainings = lazy(() => import('@/pages/Trainings'));
const TrainingRecordDetail = lazy(() => import('@/pages/TrainingRecordDetail'));
const Community = lazy(() => import('@/pages/Community'));
const CommunityDetail = lazy(() => import('@/pages/CommunityDetail'));
const BacktestCreate = lazy(() => import('@/pages/BacktestCreate'));
const BacktestDetail = lazy(() => import('@/pages/BacktestDetail'));
const Portfolios = lazy(() => import('@/pages/Portfolios'));
const PortfolioDetail = lazy(() => import('@/pages/PortfolioDetail'));
const Profile = lazy(() => import('@/pages/Profile'));
const Settings = lazy(() => import('@/pages/Settings'));
const FormulaWorkshop = lazy(() => import('@/pages/FormulaWorkshop'));
const FormulaSandbox = lazy(() => import('@/pages/FormulaSandbox'));
const FormulaScreener = lazy(() => import('@/pages/FormulaScreener'));
const NotFound = lazy(() => import('@/pages/NotFound'));

const queryClient = new QueryClient({
  defaultOptions: { queries: { retry: 1, refetchOnWindowFocus: false } },
});

function Protected({ children }: { children: React.ReactNode }) {
  const isAuth = useTokenStore((s) => s.isAuthenticated);
  return isAuth ? <>{children}</> : <Navigate to="/login" replace />;
}

function PageFallback() {
  return (
    <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: 320 }}>
      <Spin />
    </div>
  );
}

export default function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <ConfigProvider theme={quantlabTheme} locale={zhCN}>
        <AntdApp>
          <BrowserRouter>
            <ErrorBoundary>
            <Suspense fallback={<PageFallback />}>
              <Routes>
                <Route path="/login" element={<Login />} />
                <Route
                  element={
                    <Protected>
                      <AppLayout />
                    </Protected>
                  }
                >
                  <Route path="/" element={<Dashboard />} />
                  <Route path="/strategies" element={<StrategyList />} />
                  <Route path="/strategies/new" element={<StrategyEditor />} />
                  <Route path="/strategies/:id" element={<StrategyDetail />} />
                  <Route path="/strategies/:id/edit" element={<StrategyEditor />} />
                  <Route path="/strategies/:id/backtest" element={<BacktestCreate />} />
                  <Route path="/rankings" element={<Rankings />} />
                  <Route path="/backtests" element={<Backtests />} />
                  <Route path="/backtests/:id" element={<BacktestDetail />} />
                  <Route path="/trainings" element={<Trainings />} />
                  <Route path="/trainings/records/:sessionId" element={<TrainingRecordDetail />} />
                  <Route path="/community" element={<Community />} />
                  <Route path="/community/:id" element={<CommunityDetail />} />
                  <Route path="/portfolios" element={<Portfolios />} />
                  <Route path="/portfolios/:id" element={<PortfolioDetail />} />
                  <Route path="/u/:id" element={<Profile />} />
                  <Route path="/settings" element={<Settings />} />
                  <Route path="/formulas" element={<FormulaWorkshop />} />
                  <Route path="/formulas/sandbox" element={<FormulaSandbox />} />
                  <Route path="/formulas/screener" element={<FormulaScreener />} />
                </Route>
                <Route path="*" element={<NotFound />} />
              </Routes>
            </Suspense>
            </ErrorBoundary>
          </BrowserRouter>
        </AntdApp>
      </ConfigProvider>
    </QueryClientProvider>
  );
}
