import * as Spec from '../components/spec';
import AssetExplorer from '../components/landing/AssetExplorer';
import PulseIcon from '../components/landing/PulseIcon';
import StockOrbitAnimation from '../components/landing/StockOrbitAnimation';
import MarketFloorAnimation from '../components/landing/MarketFloorAnimation';

const COMPONENT_GROUPS = [
  {
    title: 'Layout & Core Structure',
    names: ['Sidebar', 'PersonaToggle'],
  },
  {
    title: 'Authentication Components',
    names: [
      'LoginForm',
      'RegisterForm',
      'ForgotPasswordForm',
      'ResetPasswordForm',
      'EmailVerificationStatus',
      'OAuthButton',
    ],
  },
  {
    title: 'Dashboard & Page Containers',
    names: [
      'LandingPage',
      'AssetDetailView',
      'ScreenerPage',
      'PortfolioView',
      'WatchlistsView',
      'AlertsManager',
      'UserSettingsPanel',
    ],
  },
  {
    title: 'Market Data Widgets',
    names: [
      'LiveTickerTape',
      'MarketPulseCard',
      'SectorPerformanceTable',
      'AssetPriceHeader',
      'MarketSentimentGauge',
    ],
  },
  {
    title: 'Technical Analytics Components',
    names: [
      'TechnicalIndicatorsPanel',
      'TrendMatrixGrid',
      'PatternDetectionHighlight',
      'CompositeScoreDial',
      'MomentumChart',
      'MarketBreadthChart',
    ],
  },
  {
    title: 'Fundamental & Macro Components',
    names: [
      'ValuationMetricsGrid',
      'EconomicCalendarList',
      'MacroIndicatorChart',
      'SECFilingsTable',
      'EarningsHistory',
    ],
  },
  {
    title: 'Charts & Visualizations',
    names: [
      'InteractivePriceChart',
      'VolumeBarChart',
      'SectorRotationBubbleChart',
      'PortfolioAllocationPieChart',
    ],
  },
  {
    title: 'Discovery & Search',
    names: [
      'GlobalSearchBar',
      'SearchResultDropdown',
      'ScreenerFilterPanel',
      'ScreenerResultsGrid',
    ],
  },
  {
    title: 'User Management & Tools',
    names: [
      'WatchlistCard',
      'PortfolioHoldingsTable',
      'TransactionEntryForm',
      'AlertConfigurationModal',
      'NotificationFeed',
      'NewsFeedList',
      'ExportButtons',
    ],
  },
  {
    title: 'UI/UX States & Feedback',
    names: [
      'LoadingSpinner',
      'SkeletonLoader',
      'ErrorStateMessage',
      'OfflineIndicator',
      'WebSocketConnectionStatus',
      'ToastNotification',
    ],
  },
];

const RenderSpecComponent = ({ name }) => {
  const Component = Spec[name];

  if (!Component) {
    return (
      <div className="rounded-xl border border-rose-400/40 bg-rose-900/20 p-4 text-rose-200">
        Missing export for <span className="font-semibold">{name}</span>
      </div>
    );
  }

  return <Component />;
};

export default function SpecShowcasePage() {
  const { RootLayout, ErrorBoundary } = Spec;

  return (
    <ErrorBoundary>
      <RootLayout>
        <div className="mx-auto max-w-7xl space-y-10">
          <header className="rounded-2xl border border-white/10 bg-[#0f172a] p-6">
            <h1 className="text-2xl font-bold text-[#e2e8f0]">Component Scaffold Showcase</h1>
            <p className="mt-2 text-sm text-[#94a3b8]">
              This route wires the generated component stubs without changing existing page or build behavior.
            </p>
          </header>

          <section className="rounded-2xl border border-white/10 bg-[#0f172a] p-6">
            <h2 className="text-lg font-semibold text-[#e2e8f0]">Already implemented components</h2>
            <p className="mt-2 text-sm text-[#94a3b8]">
              Existing live implementations remain on current routes: Navbar/Footer on <code>/</code>, TraderDashboard on <code>/trader/dashboard</code>, InvestorDashboard on <code>/investor/dashboard</code>.
            </p>
          </section>

          <section className="space-y-4">
            <h2 className="text-xl font-semibold text-[#e2e8f0]">Landing Components (newly mounted)</h2>
            <p className="text-sm text-[#94a3b8]">
              These previously unmounted landing components are now mounted here to keep current production routes unchanged.
            </p>

            <div className="grid grid-cols-1 gap-4 xl:grid-cols-3">
              <div className="xl:col-span-2 rounded-2xl border border-white/10 bg-[#0f172a] p-4">
                <AssetExplorer />
              </div>
              <div className="rounded-2xl border border-white/10 bg-[#0f172a] p-4 min-h-[280px] flex items-center justify-center">
                <PulseIcon className="h-52 w-52" />
              </div>
            </div>

            <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
              <div className="rounded-2xl border border-white/10 bg-[#0f172a] p-4 min-h-[520px] flex items-center justify-center overflow-hidden">
                <StockOrbitAnimation />
              </div>
              <div className="rounded-2xl border border-white/10 bg-[#0f172a] p-4 min-h-[520px] overflow-hidden">
                <MarketFloorAnimation />
              </div>
            </div>
          </section>

          {COMPONENT_GROUPS.map((group) => (
            <section key={group.title} className="space-y-4">
              <h2 className="text-xl font-semibold text-[#e2e8f0]">{group.title}</h2>
              <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
                {group.names.map((name) => (
                  <RenderSpecComponent key={name} name={name} />
                ))}
              </div>
            </section>
          ))}
        </div>
      </RootLayout>
    </ErrorBoundary>
  );
}
