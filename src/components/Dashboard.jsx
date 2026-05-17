import React from 'react';
import { useAuth } from '../contexts/AuthContext';
import GPATracker from '../GPATracker';
import styles from './Dashboard.module.css';

const Dashboard = () => {
  const { user, signOut } = useAuth();

  const handleSignOut = async () => {
    try {
      await signOut();
    } catch (error) {
      console.error('Error signing out:', error);
    }
  };

  return (
    <div className={styles.dashboardContainer}>
      <header className={styles.header}>
        <div className={styles.headerContent}>
          <h1>GPA Insights</h1>
          <div className={styles.userSection}>
            {user?.user_metadata?.avatar_url && (
              <img
                src={user.user_metadata.avatar_url}
                alt={user.user_metadata.full_name || 'User'}
                className={styles.avatar}
              />
            )}
            <span className={styles.userName}>
              {user?.user_metadata?.full_name || user?.email}
            </span>
            <button onClick={handleSignOut} className={styles.signOutButton}>
              Sign Out
            </button>
          </div>
        </div>
      </header>

      <main className={styles.main}>
        <GPATracker />
      </main>
    </div>
  );
};

export default Dashboard;
