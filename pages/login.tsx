import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/router';
import Link from 'next/link';
import { useAuth } from '../contexts/AuthContext';
import GlassCard from '../components/ui/GlassCard';
import Input from '../components/ui/Input';
import Button from '../components/ui/Button';

const LoginPage: React.FC = () => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [isLoggingIn, setIsLoggingIn] = useState(false);
  const { login, currentUser, isLoading } = useAuth();
  const router = useRouter();
  
  const fromPath = typeof router.query.from === 'string' ? router.query.from : "/";

  useEffect(() => {
    if (!isLoading && currentUser) {
      router.replace(fromPath);
    }
  }, [currentUser, isLoading, router, fromPath]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setIsLoggingIn(true);
    try {
      const success = await login(email, password);
      if (success) {
        // Redirection is handled by useEffect or onAuthStateChange triggering currentUser update
        // router.replace(fromPath); // Can be redundant if useEffect handles it well
      } else {
        setError('Invalid email or password.'); // Generic error
      }
    } catch (authError: any) {
        // Handle specific Supabase errors if needed
        if (authError.message.includes('Invalid login credentials')) {
             setError('Invalid email or password.');
        } else if (authError.message.includes('Email not confirmed')) {
            setError('Please confirm your email before logging in.');
        }
        else {
            setError('Login failed. Please try again.');
        }
        console.error("Login page submit error:", authError);
    }
    setIsLoggingIn(false);
  };

  // Prevent rendering login form if already logged in and redirecting
  if (isLoading || currentUser) {
    return (
      <div className="flex justify-center items-center h-screen bg-slate-900">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-sky-400" aria-label="Loading..."></div>
      </div>
    );
  }

  return (
    <div className="flex items-center justify-center min-h-screen bg-slate-900 p-4">
      <GlassCard className="w-full max-w-md">
        <h1 className="text-3xl font-bold text-sky-300 text-center mb-6">AppRelay Login</h1>
        <form onSubmit={handleSubmit} className="space-y-6">
          <Input 
            label="Email" 
            type="email" 
            id="email" 
            value={email} 
            onChange={e => setEmail(e.target.value)} 
            placeholder="you@example.com"
            required 
            autoComplete="email"
          />
          <Input 
            label="Password" 
            type="password" 
            id="password" 
            value={password} 
            onChange={e => setPassword(e.target.value)} 
            placeholder="Your password"
            required 
            autoComplete="current-password"
          />
          {error && <p className="text-sm text-red-400 bg-red-900/30 p-2 rounded-md">{error}</p>}
          <Button type="submit" variant="primary" size="lg" className="w-full" disabled={isLoggingIn}>
            {isLoggingIn ? (
              <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white mr-2"></div>
            ) : null}
            {isLoggingIn ? 'Logging In...' : 'Login'}
          </Button>
        </form>
        <p className="text-sm text-slate-400 mt-6 text-center">
          Don't have an account?{' '}
          <Link href="/signup" legacyBehavior>
            <a className="font-medium text-sky-400 hover:text-sky-300">Sign up</a>
          </Link>
        </p>
      </GlassCard>
    </div>
  );
};

export default LoginPage;