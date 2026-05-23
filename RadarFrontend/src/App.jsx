import { Suspense, lazy, useEffect } from 'react';
import { BrowserRouter as Router, Routes, Route, Link, Navigate, useLocation, useParams, useSearchParams } from 'react-router-dom';
import { AssetProvider } from './context/AssetContext';
import { fetchUniverse } from './services/universeService';
import {
  VerifyEmailPage,
  ResetPasswordPage,
  GlobalSearchPage,
  DiscoveryPage,
  CalendarPage,
  NewsPage,
  InvestorWatchlistsPage,
  TraderWatchlistsPage,
  PortfolioPage,
  AlertsPage,
  ReportsExportPage,
  SettingsPage,
  HelpSupportPage,
  InvestorFilingsPage,
} from './pages/ContractPages';
import InvestorAdvancedCharts from './pages/InvestorAdvancedCharts';
import TraderHelpSupportPage from './pages/support/HelpSupportPage';

const Home = lazy(() => import('./pages/Home'));
const Dashboard = lazy(() => import('./pages/Dashboard'));
const Login = lazy(() => import('./pages/Login'));
const Register = lazy(() => import('./pages/Register'));
const ForgotPassword = lazy(() => import('./pages/ForgotPassword'));
const ResetPassword = lazy(() => import('./pages/ResetPassword'));
const TraderStockPage = lazy(() => import('./pages/TraderStockPage'));
const TradeTerminalPage = lazy(() => import('./pages/TradeTerminalPage'));
const MinimalChartPage = lazy(() => import('./pages/MinimalChartPage'));
const TraderSettingsPage = lazy(() => import('./pages/settings/SettingsPage'));
const AdminDashboard = lazy(() => import('./components/AdminDashboard'));
const RealtimeDemoPage = lazy(() => import('./pages/RealtimeDemoPage'));
const SpecShowcasePage = lazy(() => import('./pages/SpecShowcase'));
const Onboarding = lazy(() => import('./pages/Onboarding'));

const MarketResearchDashboard = lazy(() => import('./pages/MarketResearchDashboard'));
const ScreenerPage = lazy(() => import('./pages/ScreenerPage'));

// InvestorStockPage has been removed — stocks now open in Advanced Charts

const AppLoader = () => (
  <div className="min-h-screen flex items-center justify-center bg-[#020617] text-[#E2E8F0]">
    <div className="text-center">
      <div className="mx-auto mb-4 h-10 w-10 rounded-full border-2 border-[#00f3ff]/30 border-t-[#00f3ff] animate-spin" />
      <p className="text-sm font-semibold tracking-wide">Loading RADAR...</p>
    </div>
  </div>
);

const RouteStatusPage = ({ title, message, actionTo = '/', actionLabel = 'Go Home' }) => (
  <div className="min-h-screen flex items-center justify-center bg-[#020617] text-[#E2E8F0] px-4">
    <div className="w-full max-w-lg rounded-2xl border border-white/10 bg-white/5 p-8 text-center">
      <h1 className="text-3xl font-black tracking-tight mb-3">{title}</h1>
      <p className="text-sm text-[#cbd5e1] mb-6">{message}</p>
      <Link
        to={actionTo}
        className="inline-flex items-center justify-center rounded-xl bg-[#00f3ff] text-[#0f172a] px-5 py-2.5 font-bold text-sm"
      >
        {actionLabel}
      </Link>
    </div>
  </div>
);

const DashboardAliasRoute = ({ mode }) => {
  // Set localStorage immediately so Dashboard initializer picks it up
  if (typeof window !== 'undefined' && mode) {
    localStorage.setItem('mode', mode);
  }
  // key={mode} forces full remount when switching between trader/investor
  // This resets all useState initializers so isTraderMode is derived fresh from localStorage
  return <Dashboard key={mode} />;
};

const AssetAliasRoute = () => {
  const { symbol } = useParams();
  const nextSymbol = encodeURIComponent(String(symbol || '').trim());
  return <Navigate to={`/stocks/${nextSymbol}`} replace />;
};

// Investor stock pages → redirect to Advanced Charts with symbol
const InvestorStockRedirect = () => {
  const { symbol } = useParams();
  const clean = encodeURIComponent(String(symbol || 'RELIANCE').trim().toUpperCase().replace(/\.(NS|BO)$/i, ''));
  return <Navigate to={`/investor/advanced-charts?symbol=${clean}`} replace />;
};

const OAuthCallbackRoute = () => {
  const location = useLocation();

  useEffect(() => {
    const searchParams = new URLSearchParams(location.search);
    const hashParams = new URLSearchParams(location.hash.replace(/^#/, ''));

    const token = searchParams.get('token')
      || searchParams.get('access_token')
      || hashParams.get('token')
      || hashParams.get('access_token');

    const mode = searchParams.get('mode') || hashParams.get('mode');

    if (token) {
      localStorage.setItem('token', token);
    }

    if (mode) {
      localStorage.setItem('mode', String(mode).toUpperCase() === 'TRADER' ? 'TRADER' : 'INVESTOR');
    }

    window.location.replace(token ? '/dashboard' : '/login');
  }, [location.hash, location.search]);

  return <AppLoader />;
};

const getStoredMode = () => {
  if (typeof window === 'undefined') {
    return 'INVESTOR';
  }

  return String(localStorage.getItem('mode') || 'INVESTOR').toUpperCase() === 'TRADER'
    ? 'TRADER'
    : 'INVESTOR';
};

const ProfileRoute = () => (
  getStoredMode() === 'TRADER'
    ? <Navigate to="/trader/dashboard/profile" replace />
    : <Navigate to="/investor/dashboard/profile" replace />
);

const SettingsRoute = () => (getStoredMode() === 'TRADER' ? <TraderSettingsPage /> : <SettingsPage />);

const SupportRoute = () => (getStoredMode() === 'TRADER' ? <Navigate to="/trader/dashboard/support" replace /> : <HelpSupportPage dashboardPath="/investor/dashboard" />);
const InvestorSupportRoute = () => <HelpSupportPage dashboardPath="/investor/dashboard" />;
const TraderSupportRoute = () => <TraderHelpSupportPage />;

const AdvancedChartsRoute = () => {
  const [searchParams] = useSearchParams();
  const mode = getStoredMode();

  if (mode === 'TRADER') {
    const symbol = String(searchParams.get('symbol') || 'RELIANCE').trim().toUpperCase();
    return <Navigate to={`/chart/${encodeURIComponent(symbol)}`} replace />;
  }

  return <InvestorAdvancedCharts />;
};

const DashboardRedirect = () => {
  const mode = getStoredMode();
  return <Navigate to={mode === 'TRADER' ? '/trader/dashboard' : '/investor/dashboard'} replace />;
};

function App() {
  // Initialize market universe on app startup
  useEffect(() => {
    fetchUniverse().catch(err => console.error('Failed to initialize universe:', err));
  }, []);

  return (
    <AssetProvider>
      <Router>
        <Suspense fallback={<AppLoader />}>
          <Routes>
            <Route path="/" element={<Home />} />
            <Route path="/dashboard" element={<DashboardRedirect />} />
            <Route path="/dashboard/trader" element={<Navigate to="/trader/dashboard" replace />} />
            <Route path="/dashboard/investor" element={<Navigate to="/investor/dashboard" replace />} />
            <Route path="/login" element={<Login />} />
            <Route path="/register" element={<Register />} />
            <Route path="/verify-email" element={<VerifyEmailPage />} />
            <Route path="/forgot-password" element={<ForgotPassword />} />
            <Route path="/reset-password/:token" element={<ResetPassword />} />
            <Route path="/auth/oauth/callback" element={<OAuthCallbackRoute />} />
            <Route path="/stocks/:symbol" element={<TraderStockPage />} />
            <Route path="/trade/:symbol" element={<TradeTerminalPage />} />
            <Route path="/chart/:symbol" element={<MinimalChartPage />} />
            <Route path="/investor-stock/:symbol" element={<InvestorStockRedirect />} />
            <Route path="/asset/:symbol" element={<AssetAliasRoute />} />

            {/* Persona Dashboards */}
            <Route path="/investor/dashboard/:module?" element={<DashboardAliasRoute mode="INVESTOR" />} />
            <Route path="/trader/dashboard/:module?" element={<DashboardAliasRoute mode="TRADER" />} />

            {/* Investor Specialized Routes */}
            <Route path="/investor/momentum" element={<DashboardAliasRoute mode="INVESTOR" />} />
            <Route path="/investor/valuation" element={<DashboardAliasRoute mode="INVESTOR" />} />
            <Route path="/investor/filings" element={<InvestorFilingsPage />} />
            <Route path="/investor/screener" element={<ScreenerPage />} />
            <Route path="/investor/search" element={<GlobalSearchPage />} />
            <Route path="/investor/discovery" element={<DiscoveryPage />} />
            <Route path="/investor/calendar" element={<CalendarPage />} />
            <Route path="/investor/news" element={<NewsPage />} />
            <Route path="/investor/watchlists" element={<InvestorWatchlistsPage />} />
            <Route path="/investor/portfolio" element={<PortfolioPage />} />
            <Route path="/investor/alerts" element={<AlertsPage />} />
            <Route path="/investor/reports/export" element={<ReportsExportPage />} />
            <Route path="/investor/profile" element={<Navigate to="/investor/dashboard/profile" replace />} />
            <Route path="/investor/settings" element={<SettingsPage />} />
            <Route path="/investor/support" element={<HelpSupportPage dashboardPath="/investor/dashboard" />} />
            <Route path="/investor/advanced-charts" element={<InvestorAdvancedCharts />} />

            {/* Trader Specialized Routes */}
            <Route path="/trader/profile" element={<Navigate to="/trader/dashboard/profile" replace />} />
            <Route path="/trader/settings" element={<Navigate to="/trader/dashboard/settings" replace />} />
            <Route path="/trader/support" element={<Navigate to="/trader/dashboard/support" replace />} />
            <Route path="/trader/terminal/:symbol" element={<TradeTerminalPage />} />
            <Route path="/trader/charts/:symbol" element={<MinimalChartPage />} />
            <Route path="/trader/watchlists" element={<TraderWatchlistsPage />} />

            {/* Legacy/Redirect Routes */}
            <Route path="/profile" element={<ProfileRoute />} />
            <Route path="/settings" element={<SettingsRoute />} />
            <Route path="/support" element={<SupportRoute />} />
            <Route path="/help" element={<SupportRoute />} />
            <Route path="/advanced-charts" element={<AdvancedChartsRoute />} />
            
            {/* Legacy Investor Mappings (Redirect to namespaced) */}
            <Route path="/screener" element={<Navigate to="/investor/screener" replace />} />
            <Route path="/search" element={<Navigate to="/investor/search" replace />} />
            <Route path="/discovery" element={<Navigate to="/investor/discovery" replace />} />
            <Route path="/calendar" element={<Navigate to="/investor/calendar" replace />} />
            <Route path="/news" element={<Navigate to="/investor/news" replace />} />
            <Route path="/watchlists" element={<Navigate to="/investor/watchlists" replace />} />
            <Route path="/portfolio" element={<Navigate to="/investor/portfolio" replace />} />
            <Route path="/alerts" element={<Navigate to="/investor/alerts" replace />} />
            <Route path="/reports/export" element={<Navigate to="/investor/reports/export" replace />} />
            <Route path="/trader-profile" element={<Navigate to="/trader/dashboard/profile" replace />} />
            <Route path="/admin" element={<AdminDashboard />} />
            <Route path="/admin/health" element={<Navigate to="/admin" replace />} />
            <Route path="/demo" element={<RealtimeDemoPage />} />
            <Route path="/research-dashboard" element={<MarketResearchDashboard />} />
            <Route path="/spec/components" element={<SpecShowcasePage />} />
            <Route path="/onboarding" element={<Onboarding />} />
            <Route path="/404" element={<RouteStatusPage title="404 - Not Found" message="The page you requested does not exist or may have moved." actionTo="/" actionLabel="Return Home" />} />
            <Route path="/500" element={<RouteStatusPage title="500 - Server Error" message="Something went wrong while processing your request. Please try again." actionTo="/" actionLabel="Return Home" />} />
            <Route path="*" element={<Navigate to="/404" replace />} />
          </Routes>
        </Suspense>
      </Router>
    </AssetProvider>
  );
}

export default App;
