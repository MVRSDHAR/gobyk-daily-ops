'use client';
import { useEffect, useState } from 'react';
import { supabase } from '../../../lib/supabaseClient';
import { useRouter } from 'next/navigation';

const FIELDS = [
  'inward_volume', 'delivered_volume', 'revenue', 'amc_count', 'google_reviews',
  'cash', 'card', 'scan', 'neft', 'paytm', 'credit', 'advance',
  'third_party_revenue', 'parts', 'labour',
  'counter_sale_volume', 'counter_sale_revenue', 'scheme_7rs_count',
  'vehicle_2w_volume', 'vehicle_2w_revenue', 'vehicle_4w_volume', 'vehicle_4w_revenue',
];

export default function EditEntries() {
  const router = useRouter();
  const [rows, setRows] = useState([]);
  const [branches, setBranches] = useState([]);
  const [loading, setLoading] = useState(true);
  const [branchFilter, setBranchFilter] = useState('');
  const [editingId, setEditingId] = useState(null);
  const [editValues, setEditValues] = useState({});
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState('');

  async function load() {
    setLoading(true);
    const { data: userData } = await supabase.auth.getUser();
    if (!userData?.user) { router.push('/login'); return; }

    const { data: branchList } = await supabase.from('branches').select('*').order('name');
    setBranches(branchList || []);

    let query = supabase.from('daily_entries').select('*, branches(name)').order('entry_date', { ascending: false });
    if (branchFilter) query = query.eq('branch_id', branchFilter);
    const { data: entries, error } = await query;

    if (error) setMsg('Load error: ' + error.message);
    setRows(entries || []);
    setLoading(false);
  }

  useEffect(() => { load(); }, [branchFilter]);

  function startEdit(row) {
    setEditingId(row.id);
    const vals = {};
    FIELDS.forEach((f) => { vals[f] = row[f] ?? 0; });
    setEditValues(vals);
    setMsg('');
  }

  function cancelEdit() {
    setEditingId(null);
    setEditValues({});
  }

  async function saveEdit(id) {
    setSaving(true);
    const payload = {};
    FIELDS.forEach((f) => { payload[f] = editValues[f] === '' ? 0 : Number(editValues[f]); });
    payload.updated_at = new Date().toISOString();

    const { error } = await supabase.from('daily_entries').update(payload).eq('id', id);

    if (error) {
      setMsg('Save failed: ' + error.message);
    } else {
      setMsg('Saved.');
      setEditingId(null);
      await load();
    }
    setSaving(false);
  }

  return (
    <div style={{ padding: 14, maxWidth: 480, margin: '0 auto', color: '#E8E9ED' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
        <div style={{ background: '#161820', color: '#F5A623', border: '1px solid #2A2D3A', borderRadius: 10, padding: '8px 12px', fontWeight: 700, fontSize: 13 }}>
          ✏️ Edit Entries
        </div>
        <div onClick={() => router.push('/admin')} style={{ fontSize: 11, color: '#9096A8', fontWeight: 700, cursor: 'pointer' }}>← Back</div>
      </div>

      <select
        value={branchFilter}
        onChange={(e) => setBranchFilter(e.target.value)}
        style={{ width: '100%', background: '#161820', color: '#E8E9ED', border: '1px solid #2A2D3A', borderRadius: 10, padding: '10px 12px', marginBottom: 14, fontSize: 13 }}
      >
        <option value="">All branches</option>
        {branches.map((b) => (
          <option key={b.id} value={b.id}>{b.name}</option>
        ))}
      </select>

      {msg && (
        <div style={{ background: msg.startsWith('Saved') ? 'rgba(34,197,94,0.15)' : 'rgba(255,77,94,0.15)', color: msg.startsWith('Saved') ? '#22C55E' : '#FF8A93', border: '1px solid', borderColor: msg.startsWith('Saved') ? '#22C55E' : '#FF4D5E', borderRadius: 10, padding: '8px 12px', fontSize: 12, fontWeight: 700, marginBottom: 14 }}>
          {msg}
        </div>
      )}

      {loading && <p style={{ color: '#9096A8' }}>Loading...</p>}

      {!loading && rows.map((row) => (
        <div key={row.id} style={{ background: '#161820', border: '1px solid #23252F', borderRadius: 12, padding: 12, marginBottom: 8 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div>
              <div style={{ fontWeight: 700 }}>{row.branches?.name || 'Unknown'}</div>
              <div style={{ fontSize: 12, color: '#9096A8' }}>{row.entry_date} · Rev ₹{Number(row.revenue).toLocaleString('en-IN')}</div>
            </div>
            {editingId !== row.id && (
              <button
                onClick={() => startEdit(row)}
                style={{ background: '#F5A623', color: '#000', border: 'none', borderRadius: 8, padding: '6px 12px', fontWeight: 700, fontSize: 12, cursor: 'pointer' }}
              >
                Edit
              </button>
            )}
          </div>

          {editingId === row.id && (
            <div style={{ marginTop: 12, borderTop: '1px solid #23252F', paddingTop: 12 }}>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
                {FIELDS.map((f) => (
                  <div key={f}>
                    <div style={{ fontSize: 10, color: '#9096A8', marginBottom: 2, textTransform: 'uppercase' }}>{f.replace(/_/g, ' ')}</div>
                    <input
                      type="number"
                      value={editValues[f]}
                      onChange={(e) => setEditValues({ ...editValues, [f]: e.target.value })}
                      style={{ width: '100%', background: '#0D0E14', color: '#E8E9ED', border: '1px solid #2A2D3A', borderRadius: 6, padding: '6px 8px', fontSize: 12 }}
                    />
                  </div>
                ))}
              </div>
              <div style={{ display: 'flex', gap: 8, marginTop: 12 }}>
                <button
                  onClick={() => saveEdit(row.id)}
                  disabled={saving}
                  style={{ flex: 1, background: '#22C55E', color: '#000', border: 'none', borderRadius: 8, padding: '10px', fontWeight: 700, fontSize: 13, cursor: 'pointer' }}
                >
                  {saving ? 'Saving...' : 'Save'}
                </button>
                <button
                  onClick={cancelEdit}
                  style={{ flex: 1, background: '#23252F', color: '#E8E9ED', border: 'none', borderRadius: 8, padding: '10px', fontWeight: 700, fontSize: 13, cursor: 'pointer' }}
                >
                  Cancel
                </button>
              </div>
            </div>
          )}
        </div>
      ))}
    </div>
  );
}