'use client';
import { useEffect, useState } from 'react';
import { supabase } from '../../lib/supabaseClient';
import { useRouter } from 'next/navigation';
import Link from 'next/link';

function todayStr() {
  const d = new Date();
  return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
}

export default function ManagerDashboard() {
  const router = useRouter();
  const [entries, setEntries] = useState([]);
  const [branchName, setBranchName] = useState('');

  useEffect(() => {
    async function load() {
      const { data: userData } = await supabase.auth.getUser();
      if (!userData?.user) { router.push('/login'); return; }

      const { data } = await supabase
        .from('daily_entries')
        .select('*, branches(name)')
        .order('entry_date', { ascending: false })
        .limit(7);

      if (data && data.length > 0) {
        setEntries(data);
        setBranchName(data[0].branches?.name || '');
      } else {
        const { data: profile } = await supabase
          .from('users')
          .select('branches(name)')
          .eq('auth_id', userData.user.id)
          .single();
        setBranchName(profile?.branches?.name || 'My Branch');
      }
    }
    load();
  }, []);

  async function handleLogout() {
    await supabase.auth.signOut();
    router.push('/login');
  }

  const latestDate = entries.length > 0 ? entries[0].entry_date : null;
  const isCurrent = latestDate === todayStr();

  return (
    <div style={{ padding: 14, maxWidth: 480, margin: '0 auto', color: '#E6F1EF' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
        <div style={{ background: '#10231F', color: '#2DD4BF', border: '1px solid #164B42', borderRadius: 10, padding: '8px 12px', fontWeight: 700, fontSize: 13 }}>
          👤 {branchName} Manager
        </div>
        <div onClick={handleLogout} style={{ fontSize: 11, color: '#5EB8AB', fontWeight: 700, cursor: 'pointer' }}>Log out</div>
      </div>

      <div style={{
        display: 'inline-block', marginTop: 8, marginBottom: 16, fontSize: 11, fontWeight: 700, padding: '6px 10px', borderRadius: 8,
        background: isCurrent ? 'rgba(45,212,191,0.1)' : 'rgba(251,113,133,0.1)',
        color: isCurrent ? '#2DD4BF' : '#FB7185',
        border: '1px solid ' + (isCurrent ? 'rgba(45,212,191,0.3)' : 'rgba(251,113,133,0.3)')
      }}>
        {latestDate ? `Data as of: ${latestDate}${isCurrent ? ' (Today)' : ''}` : 'No entries yet'}
      </div>

      <Link href="/manager/entry" style={{ textDecoration: 'none' }}>
        <div style={{ background: '#2DD4BF', color: '#071612', fontWeight: 800, textAlign: 'center', padding: 14, borderRadius: 12, marginBottom: 20, cursor: 'pointer' }}>
          {isCurrent ? "Edit Today's Entry" : "Fill Today's Entry"}
        </div>
      </Link>

      <h3 style={{ color: '#5EB8AB', fontSize: 12, textTransform: 'uppercase', marginBottom: 10 }}>Last 7 Entries</h3>
      {entries.length === 0 && <p style={{ color: '#5EB8AB' }}>No entries yet. Fill today's report to get started.</p>}
      {entries.map((e) => (
        <div key={e.id} style={{ background: '#10231F', border: '1px solid #164B42', borderRadius: 12, padding: 12, marginBottom: 8 }}>
          <div style={{ fontWeight: 700 }}>{e.entry_date}</div>
          <div style={{ fontSize: 13, color: '#5EB8AB' }}>
            Volume: {e.delivered_volume} · Revenue: ₹{Number(e.revenue).toLocaleString('en-IN')}
          </div>
        </div>
      ))}
    </div>
  );
}