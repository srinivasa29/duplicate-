import { createPortal } from "react-dom";
import { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { LogOut, User, Settings, HelpCircle } from "lucide-react";
import "../styles/ProfileDropdown.css";

const ProfileDropdown = ({ 
  isOpen, 
  onClose, 
  avatarRef, 
  profile, 
  userInitial,
  isTraderMode,
  onSignOut,
}) => {
  const navigate = useNavigate();
  const dropdownRef = useRef(null);
  const [position, setPosition] = useState({ top: 0, left: 0 });
  const [mode, setMode] = useState(isTraderMode ? "trader" : "investor");

  useEffect(() => {
    setMode(isTraderMode ? "trader" : "investor");
  }, [isTraderMode]);

  useEffect(() => {
    if (typeof isTraderMode === "boolean") {
      setMode(isTraderMode ? "trader" : "investor");
    }
  }, [isTraderMode]);

  // Calculate position based on avatar element
  useEffect(() => {
    if (!isOpen || !avatarRef?.current) return;

    const calculatePosition = () => {
      const rect = avatarRef.current.getBoundingClientRect();
      const dropdownWidth = 320;
      const padding = 12;
      const viewportWidth = window.innerWidth;

      let left = rect.right - dropdownWidth;
      
      // Ensure dropdown doesn't go off-screen on left side
      if (left < padding) {
        left = padding;
      }
      
      // Ensure dropdown doesn't go off-screen on right side
      if (left + dropdownWidth + padding > viewportWidth) {
        left = viewportWidth - dropdownWidth - padding;
      }

      setPosition({
        top: rect.bottom + 8,
        left: left
      });
    };

    calculatePosition();
    window.addEventListener("resize", calculatePosition);
    window.addEventListener("scroll", calculatePosition);

    return () => {
      window.removeEventListener("resize", calculatePosition);
      window.removeEventListener("scroll", calculatePosition);
    };
  }, [isOpen, avatarRef]);

  // Close on outside click
  useEffect(() => {
    if (!isOpen) return;

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
  }, [isOpen, onClose, avatarRef]);

  if (!isOpen) return null;

  const handleSelectMode = (nextMode) => {
    setMode(nextMode);
    navigate(nextMode === "investor" ? "/investor/dashboard" : "/trader/dashboard");
    onClose();
  };

  const content = (
    <div
      ref={dropdownRef}
      className="portal-profile-dropdown"
      style={{
        position: "fixed",
        top: `${position.top}px`,
        left: `${position.left}px`,
        width: "320px",
        zIndex: 9999,
        pointerEvents: "auto"
      }}
    >
      {/* Profile Header */}
      <div className="dropdown-profile-header">
        <div className="dropdown-profile-avatar">
          {userInitial}
        </div>
        <div className="dropdown-profile-copy">
          <p className="dropdown-profile-name">{profile?.username || "User"}</p>
          <p className="dropdown-profile-email">{profile?.email || "user@radar.com"}</p>
        </div>
      </div>

      <div className="profile-divider" />

      {/* Menu Items */}
      <div className="dropdown-menu-list">
        <button
          type="button"
          className="dropdown-menu-item"
          onClick={() => {
            onClose();
            navigate(isTraderMode ? "/trader/dashboard/profile" : "/investor/dashboard/profile");
          }}
        >
          <span className="dropdown-menu-icon">
            <User size={15} />
          </span>
          <span className="dropdown-menu-label">My Profile</span>
        </button>
        <button
          type="button"
          className="dropdown-menu-item"
          onClick={() => {
            onClose();
            navigate(isTraderMode ? "/trader/dashboard/settings" : "/investor/settings");
          }}
        >
          <span className="dropdown-menu-icon">
            <Settings size={15} />
          </span>
          <span className="dropdown-menu-label">Settings</span>
        </button>
        <button
          type="button"
          className="dropdown-menu-item"
          onClick={() => {
            onClose();
            navigate(isTraderMode ? "/trader/dashboard/support" : "/investor/support");
          }}
        >
          <span className="dropdown-menu-icon">
            <HelpCircle size={15} />
          </span>
          <span className="dropdown-menu-label">Help & Support</span>
        </button>
      </div>

      <div className="profile-divider" />

      {/* Mode Toggle */}
      <div className="dropdown-interface-section">
        <p className="dropdown-interface-title">CHOOSE YOUR INTERFACE</p>
        <div className="dropdown-toggle-group" role="tablist" aria-label="Choose your interface">
          {["Investor", "Trader"].map((option) => {
            return (
              <button
                key={option}
                type="button"
                role="tab"
                aria-selected={mode === option.toLowerCase()}
                onClick={() => handleSelectMode(option.toLowerCase())}
                className={`dropdown-toggle-option ${mode === option.toLowerCase() ? "selected active" : ""}`}
              >
                {option}
              </button>
            );
          })}
        </div>
      </div>

      <div className="profile-divider" />

      {/* Sign Out */}
      <button 
        type="button" 
        onClick={() => {
          if (typeof onSignOut === "function") {
            onSignOut();
            return;
          }

          onClose();
          localStorage.clear();
          navigate("/login");
        }}
        className="dropdown-signout-btn"
      >
        <LogOut size={15} />
        <span>Sign Out</span>
      </button>
    </div>
  );

  return createPortal(content, document.body);
};

export default ProfileDropdown;
