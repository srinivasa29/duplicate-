import React from 'react'
import ReactDOM from 'react-dom/client'
import './index.css'
import App from './App.jsx'
import { GoogleOAuthProvider } from '@react-oauth/google'
import { SettingsProvider } from './context/SettingsContext'

const googleClientId = import.meta.env.VITE_GOOGLE_CLIENT_ID || '';

function Root() {
  const app = (
    <SettingsProvider>
      <App />
    </SettingsProvider>
  );

  if (googleClientId) {
    return (
      <GoogleOAuthProvider clientId={googleClientId}>
        {app}
      </GoogleOAuthProvider>
    );
  }

  return app;
}

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <Root />
  </React.StrictMode>,
)