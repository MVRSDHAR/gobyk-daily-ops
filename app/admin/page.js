'use client';
import { useEffect, useState } from 'react';
import { supabase } from '../../lib/supabaseClient';
import { useRouter } from 'next/navigation';

function todayStr() {
  const d = new Date();
  return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
}

export default function AdminDashboard() {
  const router = useRouter();
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [debugError, setDebugError] = useState('');

  useEffect(() => {
    async function load() {
      const { data: userData } = await supabase.auth.getUser();
      if (!userData?.user) { router.push('/login'); return; }

      const { data: branches, error: branchError } = await supabase.from('branches').select('*').order('name');
      const { data: entries, error: entryError } = await supabase
        .from('daily_entries')
        .select('*')
        .order('entry_date', { ascending: false });

      if (branchError) setDebugError('Branches error: ' + branchError.message);
      else if (entryError) setDebugError('Entries error: ' + entryError.message);
      else if (!branches || branches.length === 0) setDebugError('Branches query succeeded but returned 0 rows.');

      const combined = (branches || []).map((b) => {
        const latest = (entries || []).find((e) => e.branch_id === b.id);
        return { branch: b, latest };
      });

      setRows(combined);
      setLoading(false);
    }
    load();
  }, []);

  async function handleLogout() {
    await supabase.auth.signOut();
    router.push('/login');
  }

  const today = todayStr();
  const stale = rows.filter((r) => r.latest && r.latest.entry_date !== today).map((r) => r.branch.name);
  const noData = rows.filter((r) => !r.latest).map((r) => r.branch.name);

  const totalVolume = rows.reduce((sum, r) => sum + (r.latest?.delivered_volume || 0), 0);
  const totalRevenue = rows.reduce((sum, r) => sum + Number(r.latest?.revenue || 0), 0);

  return (
    <div style={{ padding: 14, maxWidth: 480, margin: '0 auto', color: '#E8E9ED' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
        <div style={{ background: '#161820', color: '#F5A623', border: '1px solid #2A2D3A', borderRadius: 10, padding: '8px 12px', fontWeight: 700, fontSize: 13 }}>
          🛡 Admin / HO
        </div><div onClick={() => router.push('/admin/entries')} style={{ background: '#161820', color: '#22C55E', border: '1px solid #2A2D3A', borderRadius: 10, padding: '8px 12px', fontWeight: 700, fontSize: 12, cursor: 'pointer', textAlign: 'center', marginTop: 8 }}>
  ✏️ Edit Entries
</div>
        <div onClick={handleLogout} style={{ fontSize: 11, color: '#9096A8', fontWeight: 700, cursor: 'pointer' }}>Log out</div>
      </div>

      {debugError && (
        <div style={{ background: 'rgba(255,77,94,0.15)', border: '1px solid #FF4D5E', color: '#FF8A93', borderRadius: 12, padding: '10px 12px', fontSize: 11, fontWeight: 700, margin: '14px 0' }}>
          🐛 DEBUG: {debugError}
        </div>
      )}

      {(stale.length > 0 || noData.length > 0) && (
        <div style={{ background: 'rgba(255,77,94,0.1)', border: '1px solid rgba(255,77,94,0.3)', color: '#FF8A93', borderRadius: 12, padding: '10px 12px', fontSize: 11, fontWeight: 700, margin: '14px 0' }}>
          {stale.length > 0 && <>⚠ Stale: {stale.join(', ')}. </>}
          {noData.length > 0 && <>No data yet: {noData.join(', ')}.</>}
        </div>
      )}

      <div style={{ background: '#161820', borderRadius: 16, padding: 16, marginTop: 14, marginBottom: 16 }}>
        <div style={{ fontSize: 12, fontWeight: 700, color: '#9096A8', textTransform: 'uppercase', marginBottom: 10 }}>Gobyk Summary</div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
          <div style={{ background: '#0D0E14', border: '1px solid #23252F', borderRadius: 12, padding: '10px 12px' }}>
            <div style={{ fontSize: 11, color: '#9096A8', fontWeight: 600 }}>Latest volume</div>
            <div style={{ fontSize: 18, fontWeight: 800 }}>{totalVolume}</div>
          </div>
          <div style={{ background: '#0D0E14', border: '1px solid #23252F', borderRadius: 12, padding: '10px 12px' }}>
            <div style={{ fontSize: 11, color: '#9096A8', fontWeight: 600 }}>Latest revenue</div>
            <div style={{ fontSize: 18, fontWeight: 800 }}>₹{totalRevenue.toLocaleString('en-IN')}</div>
          </div>
        </div>
      </div>

      <h3 style={{ color: '#9096A8', fontSize: 12, textTransform: 'uppercase', marginBottom: 10 }}>All Branches ({rows.length})</h3>
      {loading && <p style={{ color: '#9096A8' }}>Loading...</p>}
      {!loading && rows.length === 0 && <p style={{ color: '#9096A8' }}>No branches returned by the query.</p>}
      {rows.map((r) => (
        <div key={r.branch.id} style={{ background: '#161820', border: '1px solid #23252F', borderRadius: 12, padding: 12, marginBottom: 8, opacity: r.latest ? 1 : 0.4 }}>
          <div style={{ fontWeight: 700 }}>{r.branch.name}</div>
          <div style={{ fontSize: 13, color: '#9096A8' }}>
            {r.latest
              ? `${r.latest.entry_date} · Vol: ${r.latest.delivered_volume} · ₹${Number(r.latest.revenue).toLocaleString('en-IN')}`
              : 'No entries yet'}
          </div>
        </div>
      ))}
    </div>
  );
}