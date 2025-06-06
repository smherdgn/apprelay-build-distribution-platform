import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/router';
import Link from 'next/link';
import { useAuth } from '../contexts/AuthContext';
import { UserRole } from '../types';
import GlassCard from '../components/ui/GlassCard';
import Input from '../components/ui/Input';
import Button from '../components/ui/Button';
import Select from '../components/ui/Select'; // Assuming you have a Select component

const SignUpPage: React.FC = () => {
  const [username, setUsername] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [role, setRole] = useState<UserRole>(UserRole.Tester); // Default role
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const [isRegistering, setIsRegistering] = useState(false);
  const { register, currentUser, isLoading } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (!isLoading && currentUser) {
      router.replace('/'); // Redirect if already logged in
    }
  }, [currentUser, isLoading, router]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setMessage('');

    if (password !== confirmPassword) {
      setError('Passwords do not match.');
      return;
    }
    if (password.length < 6) {
        setError('Password must be at least 6 characters long.');
        return;
    }

    setIsRegistering(true);
    // The structure here aligns with AppSpecificSignUpCredentials
    const result = await register({
      email,
      password,
      options: { // options is now non-nullable in AppSpecificSignUpCredentials
        data: { username, role }
        // emailRedirectTo can be added here if needed, e.g., options: { data: { username, role }, emailRedirectTo: '...' }
      }
    });

    if (result.success) {
      setMessage(result.message || 'Registration successful! Please check your email.');
      // Optionally redirect or clear form
      // router.push('/login');
    } else {
      setError(result.message || 'Registration failed. Please try again.');
      if (result.error?.message.includes('User already registered')) {
        setError('This email is already registered. Try logging in.');
      }
    }
    setIsRegistering(false);
  };
  
  const roleOptions = [
    { value: UserRole.Developer, label: 'Developer' },
    { value: UserRole.Tester, label: 'Tester' },
    // Add UserRole.Admin here if you want to allow self-registration as Admin
    // { value: UserRole.Admin, label: 'Admin' }, 
  ];

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
        <h1 className="text-3xl font-bold text-sky-300 text-center mb-6">Create AppRelay Account</h1>
        {message && <p className="text-sm text-green-400 bg-green-900/30 p-3 rounded-md mb-4">{message}</p>}
        <form onSubmit={handleSubmit} className="space-y-4">
          <Input 
            label="Username" 
            type="text" 
            id="username" 
            value={username} 
            onChange={e => setUsername(e.target.value)} 
            placeholder="Choose a username"
            required 
            autoComplete="username"
          />
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
            label="Password (min. 6 characters)" 
            type="password" 
            id="password" 
            value={password} 
            onChange={e => setPassword(e.target.value)} 
            placeholder="Create a strong password"
            required 
            autoComplete="new-password"
          />
          <Input 
            label="Confirm Password" 
            type="password" 
            id="confirmPassword" 
            value={confirmPassword} 
            onChange={e => setConfirmPassword(e.target.value)} 
            placeholder="Confirm your password"
            required 
            autoComplete="new-password"
          />
          <Select
            label="Role"
            id="role"
            options={roleOptions}
            value={role}
            onChange={e => setRole(e.target.value as UserRole)}
            required
          />
          {error && <p className="text-sm text-red-400 bg-red-900/30 p-2 rounded-md">{error}</p>}
          <Button type="submit" variant="primary" size="lg" className="w-full" disabled={isRegistering}>
            {isRegistering ? (
              <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white mr-2"></div>
            ) : null}
            {isRegistering ? 'Creating Account...' : 'Sign Up'}
          </Button>
        </form>
        <p className="text-sm text-slate-400 mt-6 text-center">
          Already have an account?{' '}
          <Link href="/login" legacyBehavior>
            <a className="font-medium text-sky-400 hover:text-sky-300">Log in</a>
          </Link>
        </p>
      </GlassCard>
    </div>
  );
};

export default SignUpPage;