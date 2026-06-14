import React, { useState } from 'react';
import { useAuth } from '../contexts/AuthContext';
import styles from './Login.module.css';

const Login = () => {
  const { signInWithGoogle } = useAuth();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  // Check if browser is Chrome
  const isChrome = () => {
    const ua = navigator.userAgent;
    return ua.includes('Chrome') && !ua.includes('Edg') && !ua.includes('Arc');
  };
  const showBrowserWarning = !isChrome();

  const handleGoogleLogin = async () => {
    try {
      setLoading(true);
      setError(null);
      await signInWithGoogle();
    } catch (err) {
      setError(err.message);
      setLoading(false);
    }
  };

  return (
    <div className={styles.container}>
      {showBrowserWarning && (
        <div className={styles.browserWarning}>
          ⚠️ For the best experience uploading transcripts, please use Google Chrome
        </div>
      )}
      <button
        onClick={handleGoogleLogin}
        disabled={loading}
        className={styles.loginButton}
      >
        <svg className={styles.googleIcon} viewBox="0 0 24 24">
          <path
            fill="#4285F4"
            d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
          />
          <path
            fill="#34A853"
            d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
          />
          <path
            fill="#FBBC05"
            d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
          />
          <path
            fill="#EA4335"
            d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
          />
        </svg>
        {loading ? 'Signing in...' : 'Continue with Google'}
      </button>

      {error && <div className={styles.errorFixed}>{error}</div>}

      <div className={styles.content}>
        <div className={styles.hero}>
          <h1 className={styles.title}>Visualise<br />your transcript.</h1>
        </div>

        <div className={styles.valueProps}>
          <h2>What you get</h2>
          <ul>
            <li>Chart GPA on a pretty chart</li>
            <li>View distribution of grades</li>
            <li>Conduct 'What-if' analysis to predict future grades</li>
          </ul>
        </div>

        <div className={styles.instructions}>
          <h2>How to get started</h2>
          <p>This app is currently for SMU students only. You'll need to have your SMU unofficial academic transcript. Here's how to get it:</p>
          <ol>
            <li>
              <p>1. Go to SMU Oasis and search for unofficial transcript</p>
              <img src="/assets/smu_instructions/oasis1.png" alt="SMU Oasis search" />
            </li>
            <li>
              <p>2. Click 'run report'</p>
              <img src="/assets/smu_instructions/oasis2.png" alt="Run report button" />
            </li>
            <li>
              <p>3. Your request will be queued and you will see this page. Wait for 1-2 mins and your transcript will open automatically in a new tab.</p>
              <img src="/assets/smu_instructions/oasis3.png" alt="Queued page" />
            </li>
          </ol>
        </div>
      </div>
    </div>
  );
};

export default Login;
