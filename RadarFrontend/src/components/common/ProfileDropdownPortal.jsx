import { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { User, Activity, TrendingUp, LogOut, Settings, HelpCircle } from "lucide-react";

// Investor mode profile dropdown with portal support
const ProfileDropdownPortal = ({ 
  avatarRef, 
  profile, 
  userInitial, 
  onClose
}) => {
  const navigate = useNavigate();
  const dropdownRef = useRef(null);
  const [position, setPosition] = useState({ top: 0, left: 0 });
  const [mode, setMode] = useState("trader");

  useEffect(() => {
    const saved = localStorage.getItem("mode");
    if (!saved) return;

    const normalized = String(saved).toLowerCase();
    if (normalized === "trader" || normalized === "investor") {
      setMode(normalized);
      return;
    }

    if (saved === "TRADER" || saved === "INVESTOR") {
      setMode(saved.toLowerCase());
    }
  }, []);

  useEffect(() => {
    localStorage.setItem("mode", mode);
  }, [mode]);

  // Calculate position based on avatar
  useEffect(() => {
    const calculatePosition = () => {
      if (avatarRef?.current) {
        const rect = avatarRef.current.getBoundingClientRect();
        const dropdownWidth = 256;
        const padding = 12;
        const viewportWidth = window.innerWidth;

        let left = rect.right - dropdownWidth;

        if (left < padding) {
          left = padding;
        }

        if (left + dropdownWidth + padding > viewportWidth) {
          left = viewportWidth - dropdownWidth - padding;
        }

        setPosition({
          top: rect.bottom + 8,
          left: left
        });
      }
    };

    calculatePosition();
    window.addEventListener("resize", calculatePosition);
    const scrollListener = () => requestAnimationFrame(calculatePosition);
    window.addEventListener("scroll", scrollListener);

    return () => {
      window.removeEventListener("resize", calculatePosition);
      window.removeEventListener("scroll", scrollListener);
    };
  }, [avatarRef]);

  // Close on outside click
  useEffect(() => {
    const handleClickOutside = (e) => {
      if (
        dropdownRef.current && 
        !dropdownRef.current.contains(e.target) &&
        avatarRef?.current &&
        !avatarRef.current.contains(e.target)
      ) {
        onClose();
      }
    };

    const handleEscape = (e) => {
      if (e.key === "Escape") {
        onClose();
      }
    };

    document.addEventListener("mousedown", handleClickOutside);
    document.addEventListener("keydown", handleEscape);

    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
      document.removeEventListener("keydown", handleEscape);
    };
  }, [onClose, avatarRef]);

  const handleSelectMode = (nextMode) => {
    setMode(nextMode);
    navigate(nextMode === "investor" ? "/investor/dashboard" : "/trader/dashboard");
    onClose();
  };

  return (
    <div
      ref={dropdownRef}
      className="fixed w-64 bg-white border border-blue-100 rounded-xl shadow-2xl py-2 z-[9999] animate-in fade-in slide-in-from-top-1"
      style={{
        top: `${position.top}px`,
        left: `${position.left}px`,
        pointerEvents: "auto"
      }}
    >
      {/* Profile Header */}
      <div className="px-4 py-3 border-b bg-blue-50/50">
        <p className="text-xs font-bold text-blue-900">{profile?.username || 'User'}</p>
        <p className="text-[10px] text-blue-600/70 font-medium truncate">{profile?.email || 'user@radar.com'}</p>
      </div>

      <div className="py-1">
        {/* My Profile */}
        <a 
          href="/profile" 
          onClick={(e) => {
            e.preventDefault();
            onClose();
            navigate("/profile");
          }} 
          className="flex items-center gap-3 px-4 py-2 text-xs font-bold text-slate-700 hover:bg-blue-50 transition-colors"
        >
          <User size={16} /> My Profile
        </a>

        <button
          type="button"
          onClick={() => {
            onClose();
            navigate("/investor/settings");
          }}
          className="w-full flex items-center gap-3 text-left px-4 py-2 text-xs font-bold text-slate-700 hover:bg-blue-50 transition-colors"
        >
          <Settings size={16} /> <span>Settings</span>
        </button>

        <button
          type="button"
          onClick={() => {
            onClose();
            navigate("/investor/support");
          }}
          className="w-full flex items-center gap-3 text-left px-4 py-2 text-xs font-bold text-slate-700 hover:bg-blue-50 transition-colors"
        >
          <HelpCircle size={16} /> <span>Help & Support</span>
        </button>

        {/* Mode Switcher */}
        <div className="border-t border-b border-blue-50 py-3 px-4 bg-blue-50/20 my-1">
          <div className="text-[10px] font-black uppercase tracking-wider mb-2 text-center text-blue-400">
            Choose Your Interface
          </div>

          <div className="relative w-full h-10 rounded-full flex items-center p-1 transition-all duration-300 shadow-inner group bg-slate-100 border border-slate-200">
            {/* Animated Slide Background */}
            <div 
              className={`absolute top-1 bottom-1 w-[calc(50%-4px)] rounded-full shadow-sm transition-all duration-500 ease-[cubic-bezier(0.34,1.56,0.64,1)] transform bg-white border border-slate-200 ${mode === "investor" ? "translate-x-0" : "translate-x-full"}`}
            ></div>

            {/* Mode Options */}
            <button
              type="button"
              onClick={() => handleSelectMode("investor")}
              className={`w-1/2 flex items-center justify-center relative z-10 gap-2 h-full ${mode === "investor" ? "active" : ""}`}
            >
              <Activity size={14} className="text-blue-600" />
              <span className="text-[11px] font-black text-blue-600">Investor</span>
            </button>

            <button
              type="button"
              onClick={() => handleSelectMode("trader")}
              className={`w-1/2 flex items-center justify-center relative z-10 gap-2 h-full hover:opacity-100 transition-opacity ${mode === "trader" ? "active opacity-100" : "opacity-50"}`}
            >
              <TrendingUp size={14} className="text-slate-500" />
              <span className="text-[11px] font-black text-slate-500">Trader</span>
            </button>
          </div>
        </div>

        {/* Sign Out */}
        <div className="mt-1">
          <button 
            onClick={() => {
              onClose();
              localStorage.clear();
              navigate("/login");
            }} 
            className="w-full flex items-center gap-3 px-4 py-3 text-xs font-bold text-rose-600 hover:bg-rose-50/50 transition-colors"
          >
            <LogOut size={16} /> Sign Out
          </button>
        </div>
      </div>
    </div>
  );
};

export default ProfileDropdownPortal;
