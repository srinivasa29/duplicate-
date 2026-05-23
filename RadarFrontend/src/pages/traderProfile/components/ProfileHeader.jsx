import React from 'react';

const ProfileHeader = ({ name, email, status }) => {
  return (
    <header className="trader-profile-header">
      <div className="profile-identity-card">
        <div className="profile-avatar" aria-hidden="true">
          {name.slice(0, 1)}
        </div>
        <div>
          <h1 className="profile-name">{name}</h1>
          <p className="profile-email">{email}</p>
        </div>
        <span className="profile-status-badge">{status}</span>
      </div>
    </header>
  );
};

export default ProfileHeader;
