import React, { useEffect, useRef, useState } from 'react';
// React Router - Navigation and URL Location Hooks
import { useNavigate, useLocation } from 'react-router-dom';
import { motion } from 'framer-motion';
import { AlertCircle } from 'lucide-react';
import Logo from './Logo';
import WaveBackground from './WaveBackground';
import { useAuth } from '../contexts/AuthContext';

export default function OAuthCallback({ onOAuthSuccess, onOAuthError }) {
  // React Hook - useContext (Access authentication actions from AuthContext)
  const { loginWithGoogle, setTokensAndLogin } = useAuth();

  // React Router - useNavigate Hook (Programmatic redirect after auth completion)
  const navigate = useNavigate();
  // React Router - useLocation Hook (Access current search parameters from URL)
  const location = useLocation();

  // React Hook - useState (Tracks UI status message and error state)
  const [statusMessage, setStatusMessage] = useState('Verifying Google credentials...');
  const [isError, setIsError] = useState(false);

  // React Hook - useRef (Guards against double execution in React StrictMode)
  const processedRef = useRef(false);

  // React Hook - useEffect (Runs OAuth code exchange once on component mount)
  useEffect(() => {
    if (processedRef.current) return;
    processedRef.current = true;

    const handleCallback = async () => {
      // React Router - Parse search query parameters from current URL location
      const urlParams = new URLSearchParams(location.search || window.location.search);
      const code = urlParams.get('code');
      const state = urlParams.get('state');
      const error = urlParams.get('error');
      const errorDesc = urlParams.get('error_description');
      const accessToken = urlParams.get('access_token');
      const refreshToken = urlParams.get('refresh_token');

      // 1. Handle error returned by Google or backend
      if (error) {
        setIsError(true);
        let message = 'Google sign-in could not be completed.';
        if (error === 'access_denied') {
          message = 'Google sign-in was cancelled or access was denied. Please try again when you are ready.';
        } else if (error === 'redirect_uri_mismatch') {
          message = 'Redirect URI mismatch: Please add this callback URL to your Authorized redirect URIs in Google Cloud Console.';
        } else if (errorDesc) {
          message = errorDesc;
        }
        setStatusMessage(message);
        // Clear query parameters from URL bar
        window.history.replaceState({}, document.title, window.location.pathname);
        setTimeout(() => {
          onOAuthError?.(message);
          navigate('/login', { replace: true });
        }, 1200);
        return;
      }

      // 2. Handle direct tokens provided by backend redirect
      if (accessToken && refreshToken) {
        try {
          setStatusMessage('Authenticating session...');
          await setTokensAndLogin(accessToken, refreshToken);
          window.history.replaceState({}, document.title, '/');
          onOAuthSuccess?.();
          navigate('/', { replace: true });
          return;
        } catch (err) {
          setIsError(true);
          const msg = err.message || 'Failed to authenticate with received tokens.';
          setStatusMessage(msg);
          window.history.replaceState({}, document.title, '/');
          setTimeout(() => {
            onOAuthError?.(msg);
            navigate('/login', { replace: true });
          }, 1500);
          return;
        }
      }

      // 3. Handle authorization code flow
      if (code) {
        try {
          setStatusMessage('Completing Google authentication...');
          const redirectUri = `${window.location.origin}/auth/callback`;
          await loginWithGoogle(code, redirectUri, state || undefined);
          window.history.replaceState({}, document.title, '/');
          onOAuthSuccess?.();
          navigate('/', { replace: true });
        } catch (err) {
          setIsError(true);
          const msg = err.message || 'Google sign-in verification failed. Please try again.';
          setStatusMessage(msg);
          window.history.replaceState({}, document.title, '/');
          setTimeout(() => {
            onOAuthError?.(msg);
            navigate('/login', { replace: true });
          }, 2000);
        }
        return;
      }

      // 4. Fallback: No relevant OAuth parameters found
      window.history.replaceState({}, document.title, '/');
      onOAuthError?.('No OAuth authorization code received.');
      navigate('/login', { replace: true });
    };

    handleCallback();
  }, [loginWithGoogle, setTokensAndLogin, onOAuthSuccess, onOAuthError, location.search, navigate]);

  return (
    <div className="relative min-h-screen w-screen bg-register text-white flex items-center justify-center p-6 overflow-hidden font-sans select-none">
      <div className="grid-overlay" />
      <WaveBackground />

      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ duration: 0.4 }}
        className="relative z-10 w-full max-w-md bg-[#0c0c0c]/90 backdrop-blur-[24px] border border-[#57E389]/25 p-8 rounded-[28px] text-center shadow-[0_0_50px_rgba(87,227,137,0.08)] space-y-6"
      >
        <div className="relative mx-auto w-16 h-16 flex items-center justify-center">
          <motion.div
            animate={{ scale: [1, 1.2, 1], opacity: [0.3, 0.6, 0.3] }}
            transition={{ duration: 2, repeat: Infinity, ease: 'easeInOut' }}
            className={`absolute inset-0 rounded-full blur-xl ${isError ? 'bg-danger/30' : 'bg-[#57E389]/30'}`}
          />
          <div className="relative z-10">
            {isError ? (
              <AlertCircle className="w-12 h-12 text-danger stroke-[1.5]" />
            ) : (
              <Logo size={56} showGlow={true} />
            )}
          </div>
        </div>

        <div className="space-y-2">
          <h3 className="font-bold text-white text-lg font-sans tracking-wide">
            {isError ? 'Google Authentication Issue' : 'Connecting to NodeBeacon'}
          </h3>
          <p className="text-xs text-secondaryText leading-relaxed max-w-xs mx-auto">
            {statusMessage}
          </p>
        </div>

        {!isError ? (
          <div className="flex items-center justify-center gap-2 pt-2">
            <span className="w-2 h-2 rounded-full bg-accent animate-ping" />
            <span className="text-[11px] font-mono uppercase text-accent tracking-wider font-semibold">
              Authorizing Secure Access
            </span>
          </div>
        ) : (
          <div className="pt-2">
            <span className="text-[11px] font-mono text-secondaryText">
              Returning to login screen...
            </span>
          </div>
        )}
      </motion.div>
    </div>
  );
}
