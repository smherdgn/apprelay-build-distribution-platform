
import type { AppProps } from 'next/app';
import { AuthProvider } from '../contexts/AuthContext';
import { SettingsProvider } from '../contexts/SettingsContext';
import '../styles/globals.css';

 

function MyApp({ Component, pageProps }: AppProps) {
  return (
    <SettingsProvider>
      <AuthProvider>
        <Component {...pageProps} />
      </AuthProvider>
    </SettingsProvider>
  );
}

export default MyApp;