import React, { useState } from 'react';
import { useAuth } from '../contexts/AuthContext';
import GPATracker from '../GPATracker';
import styles from './Dashboard.module.css';

const Dashboard = () => {
  const { user, signOut } = useAuth();
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);

  const handleSignOut = async () => {
    try {
      await signOut();
    } catch (error) {
      console.error('Error signing out:', error);
    }
  };

  return (
    <div className={styles.dashboardContainer}>
      <main className={styles.main}>
        <GPATracker />
      </main>

      {/* Floating Settings Button */}
      <div className={styles.floatingSettings}>
        {!isSettingsOpen ? (
          <button
            onClick={() => setIsSettingsOpen(true)}
            className={styles.settingsCircle}
            aria-label="Open settings"
          >
            {user?.user_metadata?.avatar_url ? (
              <img
                src={user.user_metadata.avatar_url}
                alt="Settings"
                className={styles.settingsAvatar}
              />
            ) : (
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor">
                <circle cx="12" cy="12" r="3"/>
                <path d="M12 1v6m0 6v6m-9-9h6m6 0h6"/>
              </svg>
            )}
          </button>
        ) : (
          <div className={styles.settingsExpanded}>
            <div className={styles.settingsHeader}>
              {user?.user_metadata?.avatar_url && (
                <img
                  src={user.user_metadata.avatar_url}
                  alt={user.user_metadata.full_name || 'User'}
                  className={styles.expandedAvatar}
                />
              )}
              <div className={styles.userInfo}>
                <div className={styles.userName}>
                  {user?.user_metadata?.full_name || user?.email}
                </div>
                <div className={styles.userEmail}>{user?.email}</div>
              </div>
              <button
                onClick={() => setIsSettingsOpen(false)}
                className={styles.closeSettings}
                aria-label="Close settings"
              >
                ✕
              </button>
            </div>
            <button onClick={handleSignOut} className={styles.signOutButton}>
              Sign Out
            </button>
          </div>
        )}
      </div>
    </div>
  );
};

export default Dashboard;
