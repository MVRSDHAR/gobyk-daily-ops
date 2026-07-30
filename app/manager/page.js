'use client';
import { useEffect, useState } from 'react';
import { supabase } from '../../lib/supabaseClient';

export default function ManagerDashboard() {
  const [entries, setEntries] = useState([]);
  const [branchName, setBranchName] = useState('');

  useEffect(() => {
    async function load() {
      // RLS automatically restricts this query to the logged-in
      // manager's own branch — no branch filter needs to be written here.
      const { data, error } = await supabase
        .from('daily_entries')
        .select('*, branches(name)')
        .order('entry_date', { ascending: false })
        .limit(7);

      if (data && data.length > 0) {
        setEntries(data);
        setBranchName(data[0].branches?.name || '');
      }
    }
    load();
  }, []);

  return (
    <div style={{ padding: 14, maxWidth: 480, margin: '0 auto', color: '#E6F1EF' }}>
      <h2 style={{ color: '#2DD4BF' }}>{branchName || 'My Branch'} — Last 7 Entries</h2>
      {entries.length === 0 && <p style={{ color: '#5EB8AB' }}>No entries yet. Fill today's report to get started.</p>}
      {entries.map((e) => (
        <div key={e.id} style={{ background: '#10231F', border: '1px solid #164B42', borderRadius: 12, padding: 12, marginBottom: 8 }}>
          <div style={{ fontWeight: 700 }}>{e.entry_date}</div>
          <div style={{ fontSize: 13, color: '#5EB8AB' }}>
            Volume: {e.delivered_volume} · Revenue: ₹{e.revenue?.toLocaleString('en-IN')}
          </div>
        </div>
      ))}
    </div>
  );
}
