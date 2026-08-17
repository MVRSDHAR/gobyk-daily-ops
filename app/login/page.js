'use client';
import { useState, useEffect } from 'react';
import { supabase } from '../../lib/supabaseClient';
import { useRouter } from 'next/navigation';

export default function Login() {
  const router = useRouter();
  const [userId, setUserId] = useState('');
  const [pin, setPin] = useState('');
  const [error, setError] = useState('');

  // Remember the User ID on this device (but never the PIN)
  useEffect(() => {
    const saved = localStorage.getItem('gobyk_remembered_id');
    if (saved) setUserId(saved);
  }, []);

  async function handleLogin(e) {
    e.preventDefault();
    setError('');

    const loginEmail = userId.includes('@') ? userId : `${userId}@gobyk.in`;

    const { data, error: authError } = await supabase.auth.signInWithPassword({
      email: loginEmail,
      password: pin,
    });

    if (authError) {
      setError('Incorrect PIN. Please try again.');
      return;
    }

    localStorage.setItem('gobyk_remembered_id', userId);

    // Look up this user's role + must_change_pin flag
    const { data: profile } = await supabase
      .from('users')
      .select('role, must_change_pin')
      .eq('auth_id', data.user.id)
      .single();

    if (profile?.must_change_pin) {
      router.push('/change-pin');
    } else if (profile?.role === 'manager') {
      router.push('/manager');
    } else {
      router.push('/admin');
    }
  }

  return (
    <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 14 }}>
      <form onSubmit={handleLogin} style={{ maxWidth: 380, width: '100%', background: '#161820', borderRadius: 18, padding: 24 }}>
        <h2 style={{ color: '#F2F3F6', marginBottom: 4 }}>Gobyk Daily Ops</h2>
        <p style={{ color: '#9096A8', fontSize: 12, marginBottom: 20 }}>Enter your User ID and PIN</p>

        <label style={{ color: '#9096A8', fontSize: 11, fontWeight: 600 }}>User ID or Phone Number</label>
        <input
          value={userId}
          onChange={(e) => setUserId(e.target.value)}
          placeholder="Phone number or User ID"
          style={{ width: '100%', padding: 12, marginBottom: 14, marginTop: 5, background: '#0D0E14', border: '1px solid #23252F', borderRadius: 10, color: '#F2F3F6' }}
        />

        <label style={{ color: '#9096A8', fontSize: 11, fontWeight: 600 }}>PIN</label>
        <input
          type="password"
          value={pin}
          onChange={(e) => setPin(e.target.value)}
          maxLength={6}
          placeholder="••••••"
          style={{ width: '100%', padding: 12, marginBottom: 14, marginTop: 5, background: '#0D0E14', border: '1px solid #23252F', borderRadius: 10, color: '#F2F3F6', letterSpacing: 6 }}
        />

        {error && <p style={{ color: '#FF8A93', fontSize: 12 }}>{error}</p>}

        <button type="submit" style={{ width: '100%', padding: 14, borderRadius: 12, border: 'none', background: '#F5A623', color: '#14151C', fontWeight: 800, marginTop: 8 }}>
          Login
        </button>
      </form>
    </div>
  );
}
