'use client';
import { useState } from 'react';
import { supabase } from '../../lib/supabaseClient';
import { useRouter } from 'next/navigation';

export default function ChangePin() {
  const router = useRouter();
  const [newPin, setNewPin] = useState('');
  const [confirmPin, setConfirmPin] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  async function handleChangePin(e) {
    e.preventDefault();
    setError('');

    if (newPin.length !== 6 || confirmPin.length !== 6) {
      setError('PIN must be exactly 6 digits.');
      return;
    }
    if (newPin === '123456') {
      setError('You cannot reuse the default PIN. Choose a different one.');
      return;
    }
    if (newPin !== confirmPin) {
      setError('PINs do not match. Please re-enter.');
      return;
    }

    setLoading(true);

    // Update the actual login password in Supabase Auth
    const { data: userData } = await supabase.auth.getUser();
    const { error: updateError } = await supabase.auth.updateUser({ password: newPin });

    if (updateError) {
      setError('Could not update PIN: ' + updateError.message);
      setLoading(false);
      return;
    }

    // Clear the must_change_pin flag using a safe, narrow database function
    const { error: flagError } = await supabase.rpc('clear_pin_flag');
    if (flagError) {
      setError('PIN was updated, but a settings step failed: ' + flagError.message);
      setLoading(false);
      return;
    }

    // Look up role to decide where to send them next
    const { data: profile } = await supabase
      .from('users')
      .select('role')
      .eq('auth_id', userData.user.id)
      .single();

    if (profile?.role === 'manager') {
      router.push('/manager');
    } else {
      router.push('/admin');
    }
  }

  return (
    <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 14 }}>
      <form onSubmit={handleChangePin} style={{ maxWidth: 380, width: '100%', background: '#161820', borderRadius: 18, padding: 24 }}>
        <div style={{ background: 'rgba(245,166,35,0.1)', border: '1px solid rgba(245,166,35,0.3)', borderRadius: 10, padding: 10, marginBottom: 16, fontSize: 12, color: '#F5A623', fontWeight: 600 }}>
          ⚠ This is your first login. Set a new 6-digit PIN before continuing — the default PIN cannot be used going forward.
        </div>

        <h2 style={{ color: '#F2F3F6', marginBottom: 16, fontSize: 18 }}>Set your new PIN</h2>

        <label style={{ color: '#9096A8', fontSize: 11, fontWeight: 600 }}>New 6-digit PIN</label>
        <input
          type="password"
          value={newPin}
          onChange={(e) => setNewPin(e.target.value)}
          maxLength={6}
          placeholder="••••••"
          style={{ width: '100%', padding: 12, marginBottom: 14, marginTop: 5, background: '#0D0E14', border: '1px solid #23252F', borderRadius: 10, color: '#F2F3F6', letterSpacing: 6 }}
        />

        <label style={{ color: '#9096A8', fontSize: 11, fontWeight: 600 }}>Confirm New PIN</label>
        <input
          type="password"
          value={confirmPin}
          onChange={(e) => setConfirmPin(e.target.value)}
          maxLength={6}
          placeholder="••••••"
          style={{ width: '100%', padding: 12, marginBottom: 14, marginTop: 5, background: '#0D0E14', border: '1px solid #23252F', borderRadius: 10, color: '#F2F3F6', letterSpacing: 6 }}
        />

        {error && <p style={{ color: '#FF8A93', fontSize: 12, marginBottom: 10 }}>{error}</p>}

        <button type="submit" disabled={loading} style={{ width: '100%', padding: 14, borderRadius: 12, border: 'none', background: loading ? '#3A3C46' : '#F5A623', color: '#14151C', fontWeight: 800, marginTop: 4 }}>
          {loading ? 'Updating...' : 'Set New PIN & Continue'}
        </button>
      </form>
    </div>
  );
}