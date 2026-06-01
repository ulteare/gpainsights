import React, { useState } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { useUserSettings } from '../hooks/useUserSettings';
import GPATracker from '../GPATracker';
import styles from './Dashboard.module.css';

const Dashboard = () => {
  const { user, signOut } = useAuth();
  const { settings, loading: settingsLoading, updateSchool } = useUserSettings();
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [isSwitchingSchool, setIsSwitchingSchool] = useState(false);

  const handleSignOut = async () => {
    try {
      await signOut();
    } catch (error) {
      console.error('Error signing out:', error);
    }
  };

  const handleSwitchSchool = async () => {
    if (!settings) return;

    try {
      setIsSwitchingSchool(true);
      const newSchool = settings.school === 'SMU' ? 'NUS' : 'SMU';
      await updateSchool(newSchool);
      // Reload the page to refresh all components with new grade scale
      window.location.reload();
    } catch (error) {
      console.error('Error switching school:', error);
    } finally {
      setIsSwitchingSchool(false);
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

            {/* School Setting */}
            <div className={styles.settingSection}>
              <div className={styles.settingLabel}>School</div>
              <div className={styles.settingValue}>
                {settingsLoading ? (
                  <span className={styles.loadingText}>Loading...</span>
                ) : (
                  <>
                    <span className={styles.currentSchool}>
                      {settings?.school || 'SMU'} ({settings?.school === 'SMU' ? '4.0' : '5.0'} scale)
                    </span>
                    <button
                      onClick={handleSwitchSchool}
                      className={styles.switchButton}
                      disabled={isSwitchingSchool || settingsLoading}
                    >
                      {isSwitchingSchool ? 'Switching...' : `Switch to ${settings?.school === 'SMU' ? 'NUS/NTU' : 'SMU'}`}
                    </button>
                  </>
                )}
              </div>
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
