import { lazy, Suspense, useState, useEffect, useRef } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { useNavigate, useLocation, useParams, Link } from "react-router-dom";

import {
  LayoutDashboard,
  Star,
  Filter,
  Newspaper,
  Search,
  User,
  Settings,
  HelpCircle,
  LogOut,
  GraduationCap,
} from "lucide-react";
import { updateUserMode } from "../api/userApi";
import api from "../api/api";
import { fetchMarketData, fetchTrendingSearches, logSearchQuery, fetchUniversalSymbolSearch } from "../api/marketApi";
import { useHeaderData } from "../hooks/useHeaderData";
import MarketTicker from "../components/dashboard/MarketTicker";
import ProfileDropdown from "../components/common/ProfileDropdown";
import "./Dashboard.css";

const TraderView = lazy(() => import("./TraderDashboard"));
const InvestorMode = lazy(() => import("./InvestorDashboard"));

const displaySymbol = (value) => String(value || "").replace(/\.(NS|BO)$/i, "");

const formatNotificationTime = (value) => {
  if (!value) return "Now";

  const timestamp = new Date(value).getTime();
  if (Number.isNaN(timestamp)) return value;

  const diffMinutes = Math.max(0, Math.round((Date.now() - timestamp) / 60000));
  if (diffMinutes < 1) return "Just now";
  if (diffMinutes < 60) return `${diffMinutes}m ago`;

  const diffHours = Math.round(diffMinutes / 60);
  if (diffHours < 24) return `${diffHours}h ago`;

  const diffDays = Math.round(diffHours / 24);
  return `${diffDays}d ago`;
};

const DashboardLoader = ({ label = "Loading dashboard..." }) => (
  <div className="min-h-[60vh] flex items-center justify-center text-white">
    <div className="text-center opacity-80">
      <div className="mx-auto mb-4 h-10 w-10 rounded-full border-2 border-[#00f3ff]/30 border-t-[#00f3ff] animate-spin" />
      <p className="text-sm font-semibold tracking-wide">{label}</p>
    </div>
  </div>
);

const ProfileHeader = ({ email, username, initial }) => (
  <div className="dropdown-profile-header">
    <div className="dropdown-profile-avatar" aria-hidden="true">
      {initial}
    </div>
    <div className="dropdown-profile-copy">
      <p className="dropdown-profile-name">{username || 'Radar User'}</p>
      <p className="dropdown-profile-email">{email}</p>
    </div>
  </div>
);

const MenuItem = ({ icon: Icon, label, onClick }) => (
  <button type="button" onClick={onClick} className="dropdown-menu-item">
    <span className="dropdown-menu-icon">
      <Icon size={15} />
    </span>
    <span className="dropdown-menu-label">{label}</span>
  </button>
);

const MenuList = ({ onClose }) => (
  <div className="dropdown-menu-list">
    <MenuItem icon={User} label="My Profile" onClick={onClose} />
    <MenuItem icon={Settings} label="Settings" onClick={onClose} />
  </div>
);

const ToggleSwitch = ({ activeOption, onSelect }) => {
  const options = ["Investor", "Trader"];

  return (
    <div className="dropdown-toggle-group" role="tablist" aria-label="Choose your interface">
      {options.map((option) => {
        const isSelected = option === activeOption;
        return (
          <button
            key={option}
            type="button"
            role="tab"
            aria-selected={isSelected}
            onClick={() => onSelect(option)}
            className={`dropdown-toggle-option ${isSelected ? "selected" : ""}`}
          >
            {option}
          </button>
        );
      })}
    </div>
  );
};

const ToggleSection = ({ isTraderMode, onToggleMode }) => (
  <div className="dropdown-interface-section">
    <p className="dropdown-interface-title">CHOOSE YOUR INTERFACE</p>
    <ToggleSwitch
      activeOption={isTraderMode ? "Trader" : "Investor"}
      onSelect={(option) => {
        const shouldTraderMode = option === "Trader";
        if (shouldTraderMode !== isTraderMode) {
          onToggleMode();
        }
      }}
    />
  </div>
);

const FooterActions = ({ onSignOut }) => (
  <button type="button" onClick={onSignOut} className="dropdown-signout-btn">
    <LogOut size={15} />
    <span>Sign Out</span>
  </button>
);

export default function Dashboard() {
  const location = useLocation();
  const params = useParams();
  const navigate = useNavigate();
  const queryParams = new URLSearchParams(location.search);
  const pathModuleParam = String(params.module || "").trim().toUpperCase();
  const activeModuleParam = pathModuleParam || queryParams.get("module") || "DASHBOARD";

  const isTraderPath = location.pathname.includes('/trader');
  const isInvestorPath = location.pathname.includes('/investor');

  const [activeModule, setActiveModule] = useState(activeModuleParam);
  const [isTraderMode, setIsTraderMode] = useState(() => {
    if (isTraderPath) return true;
    if (isInvestorPath) return false;
    return String(localStorage.getItem("mode") || "INVESTOR").toUpperCase() === "TRADER";
  });

  useEffect(() => {
    setActiveModule(activeModuleParam);
  }, [activeModuleParam]);

  // Sync isTraderMode with URL path changes
  useEffect(() => {
    if (isTraderPath && !isTraderMode) {
      setIsTraderMode(true);
      localStorage.setItem('mode', 'TRADER');
    } else if (isInvestorPath && isTraderMode) {
      setIsTraderMode(false);
      localStorage.setItem('mode', 'INVESTOR');
    }
  }, [isTraderPath, isInvestorPath, isTraderMode]);

  const [isNotificationsOpen, setIsNotificationsOpen] = useState(false);
  const [isProfileOpen, setIsProfileOpen] = useState(false);
  const [isTransitioning, setIsTransitioning] = useState(false);
  const [showLogoutModal, setShowLogoutModal] = useState(false);
  const [traderSearchQuery, setTraderSearchQuery] = useState("");
  const [traderSearchResults, setTraderSearchResults] = useState([]);
  const [traderTrendingSearches, setTraderTrendingSearches] = useState([]);
  const [isTraderSearching, setIsTraderSearching] = useState(false);
  const [showTraderSearchDropdown, setShowTraderSearchDropdown] = useState(false);
  const [traderHighlightedIndex, setTraderHighlightedIndex] = useState(-1);
  const notifRef = useRef(null);
  const profileRef = useRef(null);
  const traderSearchContainerRef = useRef(null);
  const {
    profile,
    userInitial,
    notifications,
    unreadCount,
    isLoadingNotifications,
    isMarkingNotifications,
    markAllNotificationsRead,
  } = useHeaderData();


  useEffect(() => {
    let isMounted = true;
    const token = localStorage.getItem("token");
    const hasCompletedAssessment = localStorage.getItem("hasCompletedAssessment") === "true";

    // If not logged in or already confirmed assessment, skip check
    if (!token || hasCompletedAssessment) {
      return undefined;
    }

    const verifyAssessment = async () => {
      try {
        const response = await api.get('/user/profile');
        if (!isMounted) return;

        if (response.data?.investorDNA?.completedAt) {
          // Assessment confirmed complete — cache it and stay on dashboard
          localStorage.setItem("hasCompletedAssessment", "true");
          localStorage.setItem("investorDNA", JSON.stringify(response.data.investorDNA));
        }
        // If investorDNA is missing/null, do NOT redirect — user may have skipped or
        // the field is just not set yet. Only redirect if the backend explicitly says so.
      } catch (error) {
        // API failure (401, 500, network error) — do NOT redirect to onboarding.
        // Silently ignore so the dashboard still renders.
        console.warn("Could not verify assessment status (will not redirect):", error?.message);
      }
    };

    verifyAssessment();
    return () => {
      isMounted = false;
    };
  }, [navigate]);
  




  useEffect(() => {
    if (!isTraderMode) {
      // Apply Investor Mode "Minimalist Sky" Gradient to body
      document.body.style.backgroundColor = "#f0f9ff";
      document.body.style.backgroundImage = "linear-gradient(135deg, #f0f9ff 0%, #e0f2fe 50%, #f0f9ff 100%)";
    } else {
      // Apply Trader Mode Dark Background to body
      document.body.style.backgroundColor = "#020617";
      document.body.style.backgroundImage = "none";
    }
    return () => {
      document.body.style.backgroundColor = "";
      document.body.style.backgroundImage = "";
    };
  }, [isTraderMode]);

  const toggleMode = () => {
    const newMode = !isTraderMode;
    const modeStr = newMode ? 'TRADER' : 'INVESTOR';
    localStorage.setItem('mode', modeStr);
    updateUserMode(modeStr).catch((error) => {
      console.error('Failed to sync preferred mode:', error);
    });
    if (newMode) {
      // Investor → Trader: show transition animation then navigate
      setIsProfileOpen(false);
      setIsTransitioning(true);
      setTimeout(() => {
        setIsTransitioning(false);
        navigate('/trader/dashboard');
      }, 2200);
    } else {
      // Trader → Investor: navigate immediately (no animation needed)
      navigate('/investor/dashboard');
    }
  };
  useEffect(() => {
    const handler = (e) => {
      if (notifRef.current && !notifRef.current.contains(e.target)) {
        setIsNotificationsOpen(false);
      }
      if (traderSearchContainerRef.current && !traderSearchContainerRef.current.contains(e.target)) {
        setShowTraderSearchDropdown(false);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  useEffect(() => {
    if (!isTraderMode) return;

    let isMounted = true;
    const loadTrending = async () => {
      const trends = await fetchTrendingSearches();
      if (isMounted) {
        setTraderTrendingSearches(Array.isArray(trends) ? trends.slice(0, 6) : []);
      }
    };

    loadTrending();
    return () => {
      isMounted = false;
    };
  }, [isTraderMode]);

  const handleModuleChange = (module) => {
    setActiveModule(module);
    if (isTraderMode) {
      const nextPath = module === "DASHBOARD"
        ? "/trader/dashboard"
        : `/trader/dashboard/${module.toLowerCase()}`;
      navigate(nextPath, { replace: false });
    }
  };

  useEffect(() => {
    if (!isTraderMode) return;

    const query = traderSearchQuery.trim();
    if (!query) {
      setTraderSearchResults([]);
      setIsTraderSearching(false);
      return;
    }

    let isMounted = true;
    const timeout = setTimeout(async () => {
      try {
        setIsTraderSearching(true);
        let response = await fetchUniversalSymbolSearch(query, 8);
        if (!Array.isArray(response) || response.length === 0) {
          response = await fetchMarketData({ search: query });
        }
        if (isMounted) {
          setTraderSearchResults(Array.isArray(response) ? response.slice(0, 8) : []);
        }
      } catch (error) {
        if (isMounted) {
          setTraderSearchResults([]);
        }
      } finally {
        if (isMounted) {
          setIsTraderSearching(false);
        }
      }
    }, 200);

    return () => {
      isMounted = false;
      clearTimeout(timeout);
    };
  }, [isTraderMode, traderSearchQuery]);

  useEffect(() => {
    if (!showTraderSearchDropdown) {
      setTraderHighlightedIndex(-1);
      return;
    }

    const optionsLength = traderSearchQuery.trim().length > 0 ? traderSearchResults.length : traderTrendingSearches.length;
    if (optionsLength === 0) {
      setTraderHighlightedIndex(-1);
      return;
    }

    if (traderHighlightedIndex >= optionsLength) {
      setTraderHighlightedIndex(0);
    }
  }, [showTraderSearchDropdown, traderSearchQuery, traderSearchResults, traderTrendingSearches, traderHighlightedIndex]);

  const openTraderStockPage = async (value) => {
    const symbol = String(value || "").trim().toUpperCase().replace(/\.(NS|BO)$/i, '');
    if (!symbol) return;
    const mode = localStorage.getItem('mode') || 'INVESTOR';
    if (mode === 'INVESTOR') {
      navigate(`/investor/advanced-charts?symbol=${encodeURIComponent(symbol)}`);
    } else {
      navigate(`/stocks/${encodeURIComponent(symbol)}`);
    }
    await logSearchQuery(symbol);
  };

  const handleTraderSearchSelect = async (item) => {
    const label = item?.symbol || item?.name || "";
    setTraderSearchQuery(label);
    setShowTraderSearchDropdown(false);
    setTraderHighlightedIndex(-1);
    await openTraderStockPage(label);
  };

  const handleTraderTrendingSelect = async (term) => {
    setTraderSearchQuery(term);
    setShowTraderSearchDropdown(false);
    setTraderHighlightedIndex(-1);
    await openTraderStockPage(term);
  };

  const submitTraderSearch = () => {
    const query = String(traderSearchQuery || "").trim();
    if (!query) return;
    openTraderStockPage(query);
  };

  const handleLogout = () => {
    localStorage.removeItem("token");
    localStorage.removeItem("userMode");
    localStorage.removeItem("mode");
    navigate("/", { state: { skipPreloader: true } });
  };

  if (!isTraderMode && !isTransitioning) {
    return (
      <Suspense fallback={<DashboardLoader label="Loading investor mode..." />}>
        <InvestorMode onToggleMode={toggleMode} />
      </Suspense>
    );
  }

  return (
    <div
      className={`dashboard-container ${isTraderMode ? "trader-theme" : "investor-theme"
        }`}
    >
      {}
      <AnimatePresence>
        {isTransitioning && (
          <motion.div
            key="mode-preloader"
            initial={{ opacity: 1 }}
            exit={{ opacity: 0, transition: { duration: 0.6, ease: "easeInOut" } }}
            className="fixed inset-0 z-[9999] bg-[#020617] flex flex-col items-center justify-center"
          >
            <div className="absolute inset-0 overflow-hidden pointer-events-none">
              <div className="absolute top-[20%] left-[20%] w-[40vw] h-[40vw] bg-[#00f3ff]/5 rounded-full blur-[100px] animate-pulse" />
              <div className="absolute bottom-[20%] right-[20%] w-[30vw] h-[30vw] bg-purple-500/5 rounded-full blur-[80px] animate-pulse" style={{ animationDelay: '1s' }} />
            </div>
            <div className="relative z-10 flex flex-col items-center gap-8">
              <motion.div
                initial={{ scale: 0.8, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                transition={{ duration: 0.8, ease: "easeOut" }}
                className="relative"
              >
                <motion.div
                  animate={{ scale: [1, 1.2, 1], opacity: [0.5, 0.8, 0.5] }}
                  transition={{ duration: 2, repeat: Infinity }}
                  className="absolute inset-0 bg-[#00f3ff]/20 blur-3xl rounded-full"
                />
                <div className="relative p-1 rounded-full bg-gradient-to-br from-white/10 to-transparent border border-[#00f3ff]/20 shadow-2xl backdrop-blur-md">
                  <img src="/radar-logo-final.jpg" alt="Radar" className="w-24 h-24 md:w-32 md:h-32 rounded-full object-cover" />
                </div>
              </motion.div>
              <div className="text-center space-y-3">
                <motion.h1
                  initial={{ y: 20, opacity: 0 }}
                  animate={{ y: 0, opacity: 1 }}
                  transition={{ delay: 0.2, duration: 0.6 }}
                  className="text-4xl md:text-5xl font-black text-white tracking-tighter"
                >
                  RADAR
                </motion.h1>
                <motion.div
                  initial={{ width: 0, opacity: 0 }}
                  animate={{ width: '100%', opacity: 1 }}
                  transition={{ delay: 0.5, duration: 0.8 }}
                  className="h-[1px] bg-gradient-to-r from-transparent via-[#00f3ff]/50 to-transparent"
                />
                <motion.p
                  initial={{ y: 10, opacity: 0 }}
                  animate={{ y: 0, opacity: 1 }}
                  transition={{ delay: 0.6, duration: 0.5 }}
                  className="text-xs md:text-sm text-[#00f3ff] font-bold tracking-[0.3em] uppercase"
                >
                  Switching to Trader Dashboard
                </motion.p>
              </div>
              <div className="w-32 h-[2px] bg-white/5 rounded-full overflow-hidden relative">
                <motion.div
                  initial={{ x: '-100%' }}
                  animate={{ x: '100%' }}
                  transition={{ duration: 1.5, repeat: Infinity, ease: 'easeInOut' }}
                  className="absolute inset-0 bg-gradient-to-r from-transparent via-[#00f3ff] to-transparent w-1/2 h-full"
                />
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
      {isTraderMode && (
        <>
          <header className="navbar trader-glass-bar z-[100] px-6">
            <div className="max-w-[1920px] mx-auto w-full flex items-center justify-between">
              {}
              <div className="flex items-center gap-10">
                <a href="/" className="brand flex items-center gap-3">
                  <img
                    src="/radar-logo-final.jpg"
                    alt="Radar Logo"
                    className="w-8 h-8 rounded-full shadow-[0_0_10px_rgba(0,243,255,0.3)]"
                  />
                  <span className="brand-name text-lg font-bold tracking-widest text-white">
                    RADAR
                  </span>
                </a>

                {}
                <nav className="hidden lg:flex items-center gap-2">
                  {[
                    { id: "DASHBOARD", icon: LayoutDashboard, label: "Dashboard" },
                    { id: "WATCHLIST", icon: Star, label: "Watchlist" },
                    { id: "SCREENERS", icon: Filter, label: "Screeners" },
                    { id: "NEWS", icon: Newspaper, label: "News" },
                    { id: "ACADEMY", icon: GraduationCap, label: "Academy" },
                  ].map((item) => (
                    <button
                      key={item.id}
                      onClick={() => handleModuleChange(item.id)}
                      className={`nav-link flex items-center gap-2 px-4 py-2 rounded-lg text-xs font-bold uppercase tracking-wider transition-all duration-300 ${activeModule === item.id
                        ? isTraderMode
                          ? "bg-[#00f3ff]/10 text-[#00f3ff] border border-[#00f3ff]/20 shadow-[0_0_15px_rgba(0,243,255,0.1)]"
                          : "bg-blue-50 text-blue-600"
                        : isTraderMode
                          ? "text-gray-400 hover:text-white hover:bg-white/5"
                          : "text-slate-500 hover:text-slate-800 hover:bg-slate-50"
                        }`}
                    >
                      <item.icon size={14} />
                      {item.label}
                    </button>
                  ))}
                </nav>
              </div>

              {}
              <div className="flex items-center gap-6">
                <div 
                  className="trader-search-shell-wrap relative hidden xl:block" 
                  ref={traderSearchContainerRef}
                  style={{ zIndex: 999999 }}
                >
                  <div className="trader-search-shell">
                    <div className="trader-search-icon" aria-hidden="true">
                      <Search size={16} />
                    </div>
                    <input
                      type="text"
                      name="trader_search_unique_xyz"
                      autoComplete="new-password"
                      spellCheck="false"
                      placeholder="Search symbol"
                      value={traderSearchQuery}
                      onFocus={() => {
                        setShowTraderSearchDropdown(true);
                        setTraderHighlightedIndex(traderSearchQuery.trim().length > 0 ? (traderSearchResults.length > 0 ? 0 : -1) : (traderTrendingSearches.length > 0 ? 0 : -1));
                      }}
                      onChange={(e) => {
                        setTraderSearchQuery(e.target.value);
                        setShowTraderSearchDropdown(true);
                        setTraderHighlightedIndex(0);
                      }}
                      onKeyDown={async (e) => {
                        const usingSearchResults = traderSearchQuery.trim().length > 0;
                        const optionsLength = usingSearchResults ? traderSearchResults.length : traderTrendingSearches.length;

                        if (e.key === "ArrowDown" && optionsLength > 0) {
                          e.preventDefault();
                          setShowTraderSearchDropdown(true);
                          setTraderHighlightedIndex((prev) => (prev + 1 + optionsLength) % optionsLength);
                          return;
                        }

                        if (e.key === "ArrowUp" && optionsLength > 0) {
                          e.preventDefault();
                          setShowTraderSearchDropdown(true);
                          setTraderHighlightedIndex((prev) => (prev - 1 + optionsLength) % optionsLength);
                          return;
                        }

                        if (e.key === "Enter") {
                          e.preventDefault();
                          if (usingSearchResults && traderSearchResults.length > 0) {
                            const selected = traderSearchResults[Math.max(0, traderHighlightedIndex)] || traderSearchResults[0];
                            await handleTraderSearchSelect(selected);
                          } else if (!usingSearchResults && traderTrendingSearches.length > 0) {
                            const selectedTrend = traderTrendingSearches[Math.max(0, traderHighlightedIndex)] || traderTrendingSearches[0];
                            await handleTraderTrendingSelect(selectedTrend);
                          } else if (traderSearchQuery.trim()) {
                            await submitTraderSearch();
                          }
                          return;
                        }

                        if (e.key === "Escape") {
                          setShowTraderSearchDropdown(false);
                          setTraderHighlightedIndex(-1);
                        }
                      }}
                      className="trader-search-input"
                      style={{ background: 'transparent', backgroundColor: 'transparent', border: 'none', outline: 'none', boxShadow: 'none' }}
                    />

                    <button
                      type="button"
                      onClick={submitTraderSearch}
                      className="trader-search-go"
                    >
                      Go
                    </button>
                  </div>

                  {showTraderSearchDropdown && (
                    <div 
                      className="trader-search-dropdown absolute top-11 left-0 right-0 rounded-2xl shadow-xl overflow-hidden z-[9999]"
                      style={{ background: '#020617', backgroundColor: '#020617', border: '1px solid rgba(34, 211, 238, 0.3)', backdropFilter: 'none' }}
                    >
                      {isTraderSearching && (
                        <div className="px-4 py-3 text-xs font-semibold text-[#9fb4c8]">Searching market...</div>
                      )}

                      {!isTraderSearching && traderSearchQuery.trim().length > 0 && traderSearchResults.length === 0 && (
                        <div className="px-4 py-3 text-xs font-semibold text-[#9fb4c8]">No matching assets found.</div>
                      )}

                      {!isTraderSearching && traderSearchQuery.trim().length > 0 && traderSearchResults.length > 0 && (
                        <div className="max-h-72 overflow-y-auto">
                          {traderSearchResults.map((item) => (
                            <button
                              key={`${item.type}-${item.symbol}`}
                              onClick={() => handleTraderSearchSelect(item)}
                              className={`w-full text-left px-4 py-3 transition-colors border-b border-[#00f3ff]/10 ${traderHighlightedIndex >= 0 && traderSearchResults[traderHighlightedIndex] === item ? 'bg-[#00f3ff]/10' : 'hover:bg-[#00f3ff]/10'}`}
                            >
                              <div className="flex items-center justify-between">
                                <div>
                                  <p className="text-xs font-black text-[#EAF9FF]">{displaySymbol(item.symbol)}</p>
                                  <p className="text-[11px] text-[#9fb4c8]">{item.name}</p>
                                </div>
                                <span className="text-[10px] font-bold text-[#00f3ff]">{item.type}</span>
                              </div>
                            </button>
                          ))}
                        </div>
                      )}

                      {!isTraderSearching && traderSearchQuery.trim().length === 0 && (
                        <div className="px-4 py-3">
                          <p className="text-[10px] font-black uppercase tracking-wider text-[#8ca3b8] mb-2">Trending</p>
                          <div className="flex flex-wrap gap-2">
                            {traderTrendingSearches.map((term) => (
                              <button
                                key={term}
                                onClick={() => handleTraderTrendingSelect(term)}
                                className={`px-2.5 py-1 rounded-full text-[10px] font-black transition-colors ${traderHighlightedIndex >= 0 && traderTrendingSearches[traderHighlightedIndex] === term ? 'bg-[#00f3ff]/20 text-[#EAF9FF]' : 'bg-[#00f3ff]/10 text-[#9beeff] hover:bg-[#00f3ff]/20'}`}
                              >
                                {term}
                              </button>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                  )}
                </div>

                <div className="flex items-center gap-4 pl-4 border-l border-white/10">
                  <div className="profile-wrapper" ref={profileRef}>
                    <div
                      onClick={() => setIsProfileOpen(!isProfileOpen)}
                      className="w-8 h-8 rounded-full bg-[linear-gradient(135deg,#00c6ff_0%,#0072ff_100%)] flex items-center justify-center text-xs font-bold text-white cursor-pointer shadow-[0_0_10px_rgba(0,198,255,0.4)] hover:scale-105 hover:shadow-[0_0_16px_rgba(0,198,255,0.58)] transition-all duration-300"
                    >
                      {userInitial}
                    </div>

                    <ProfileDropdown
                      isOpen={isProfileOpen}
                      onClose={() => setIsProfileOpen(false)}
                      avatarRef={profileRef}
                      profile={profile}
                      userInitial={userInitial}
                      isTraderMode={isTraderMode}
                      onToggleMode={toggleMode}
                      onSignOut={() => {
                        setIsProfileOpen(false);
                        setShowLogoutModal(true);
                      }}
                    />
                  </div>
                </div>
              </div>
            </div>
          </header>
          {}
        </>
      )}

      <main className="content fade-in transition-all duration-300 w-full">
        <Suspense fallback={<DashboardLoader label="Loading trader mode..." />}>
          {isTraderMode && (
            <TraderView activeModule={activeModule} onRequestModuleChange={handleModuleChange} />
          )}
        </Suspense>
      </main>

      {}
      {showLogoutModal && (
        <div className="fixed inset-0 z-[10000] flex items-center justify-center bg-black/70 backdrop-blur-sm p-4">
          <motion.div
            initial={{ scale: 0.9, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            className="trader-logout-modal w-full max-w-md rounded-2xl p-6 shadow-2xl"
          >
            <div className="text-center">
              {}
              <div
                className="trader-logout-icon w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-4"
              >
                <LogOut size={32} />
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', width: '100%' }}>
                <div
                  className="trader-logout-title text-xl font-bold mb-2"
                >
                  Signing Out?
                </div>
                <p className="text-sm mb-8" style={{ color: '#9CA3AF', textAlign: 'center' }}>
                  Ready to sign off? Markets never sleep, but research does.
                </p>
              </div>

              <div className="flex gap-4">
                <button
                  onClick={() => setShowLogoutModal(false)}
                  className="trader-logout-btn trader-logout-btn-secondary flex-1 py-3 rounded-xl font-bold transition-all"
                >
                  No, Stay
                </button>
                <button
                  onClick={handleLogout}
                  className="trader-logout-btn trader-logout-btn-primary flex-1 py-3 rounded-xl font-bold text-[#020617] transition-all"
                >
                  Yes, Logout
                </button>
              </div>
            </div>
          </motion.div>
        </div>
      )}
    </div>
  );
}
