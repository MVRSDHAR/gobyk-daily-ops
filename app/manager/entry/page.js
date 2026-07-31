'use client';
import { useEffect, useState } from 'react';
import { supabase } from '../../../lib/supabaseClient';
import { useRouter } from 'next/navigation';

function todayStr() {
  const d = new Date();
  return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
}

export default function EntryForm() {
  const router = useRouter();
  const [branchId, setBranchId] = useState(null);
  const [branchName, setBranchName] = useState('');
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState('');
  const [form, setForm] = useState({
    inward_volume: '', delivered_volume: '', revenue: '', amc_count: '', google_reviews: '',
    cash: '', card: '', scan: '', neft: '', advance: '',
    parts: '', labour: '', counter_sale_volume: '', counter_sale_revenue: ''
  });

  useEffect(() => {
    async function loadBranch() {
      const { data: userData } = await supabase.auth.getUser();
      if (!userData?.user) { router.push('/login'); return; }

      const { data: profile } = await supabase
        .from('users')
        .select('branch_id, branches(name)')
        .eq('auth_id', userData.user.id)
        .single();

      if (profile?.branch_id) {
        setBranchId(profile.branch_id);
        setBranchName(profile.branches?.name || '');

        const { data: existing } = await supabase
          .from('daily_entries')
          .select('*')
          .eq('branch_id', profile.branch_id)
          .eq('entry_date', todayStr())
          .maybeSingle();

        if (existing) {
          setForm({
            inward_volume: existing.inward_volume ?? '',
            delivered_volume: existing.delivered_volume ?? '',
            revenue: existing.revenue ?? '',
            amc_count: existing.amc_count ?? '',
            google_reviews: existing.google_reviews ?? '',
            cash: existing.cash ?? '', card: existing.card ?? '', scan: existing.scan ?? '',
            neft: existing.neft ?? '', advance: existing.advance ?? '',
            parts: existing.parts ?? '', labour: existing.labour ?? '',
            counter_sale_volume: existing.counter_sale_volume ?? '',
            counter_sale_revenue: existing.counter_sale_revenue ?? ''
          });
        }
      }
    }
    loadBranch();
  }, []);

  function update(field, value) {
    setForm((f) => ({ ...f, [field]: value }));
  }

  function num(field) {
    return parseFloat(form[field]) || 0;
  }

  const paymentTotal = num('cash') + num('card') + num('scan') + num('neft') + num('advance');
  const revenueVal = num('revenue');
  const diff = paymentTotal - revenueVal;
  const reconOk = Math.abs(diff) < 1;

  async function handleSave(e) {
    e.preventDefault();
    setMessage('');
    setSaving(true);

    const row = {
      branch_id: branchId,
      entry_date: todayStr(),
      inward_volume: num('inward_volume'),
      delivered_volume: num('delivered_volume'),
      revenue: num('revenue'),
      amc_count: num('amc_count'),
      google_reviews: num('google_reviews'),
      cash: num('cash'), card: num('card'), scan: num('scan'), neft: num('neft'), advance: num('advance'),
      parts: num('parts'), labour: num('labour'),
      counter_sale_volume: num('counter_sale_volume'),
      counter_sale_revenue: num('counter_sale_revenue')
    };

    const { error } = await supabase
      .from('daily_entries')
      .upsert(row, { onConflict: 'branch_id,entry_date' });

    setSaving(false);

    if (error) {
      setMessage('❌ Could not save: ' + error.message);
    } else {
      setMessage('✓ Saved successfully.');
      setTimeout(() => router.push('/manager'), 1200);
    }
  }

  const inputStyle = { width: '100%', padding: 10, marginTop: 5, background: '#0D0E14', border: '1px solid #23252F', borderRadius: 10, color: '#F2F3F6', fontWeight: 600 };
  const labelStyle = { color: '#5EB8AB', fontSize: 11, fontWeight: 600 };
  const fieldGrid = { display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 12 };

  return (
    <div style={{ padding: 14, maxWidth: 480, margin: '0 auto', color: '#E6F1EF' }}>
      <h2 style={{ color: '#2DD4BF' }}>{branchName || 'My Branch'} — Today's Entry</h2>
      <p style={{ color: '#5EB8AB', fontSize: 12, marginBottom: 16 }}>{todayStr()}</p>

      <form onSubmit={handleSave} style={{ background: '#10231F', border: '1px solid #164B42', borderRadius: 16, padding: 16 }}>
        <div style={fieldGrid}>
          <div><label style={labelStyle}>Inward Volume</label><input style={inputStyle} type="number" value={form.inward_volume} onChange={(e) => update('inward_volume', e.target.value)} /></div>
          <div><label style={labelStyle}>Delivered Volume</label><input style={inputStyle} type="number" value={form.delivered_volume} onChange={(e) => update('delivered_volume', e.target.value)} /></div>
          <div><label style={labelStyle}>Revenue (₹)</label><input style={inputStyle} type="number" value={form.revenue} onChange={(e) => update('revenue', e.target.value)} /></div>
          <div><label style={labelStyle}>AMC</label><input style={inputStyle} type="number" value={form.amc_count} onChange={(e) => update('amc_count', e.target.value)} /></div>
          <div><label style={labelStyle}>Google Reviews</label><input style={inputStyle} type="number" value={form.google_reviews} onChange={(e) => update('google_reviews', e.target.value)} /></div>
        </div>

        <h4 style={{ color: '#5EB8AB', fontSize: 12, textTransform: 'uppercase', marginBottom: 8 }}>Payments</h4>
        <div style={fieldGrid}>
          <div><label style={labelStyle}>Cash</label><input style={inputStyle} type="number" value={form.cash} onChange={(e) => update('cash', e.target.value)} /></div>
          <div><label style={labelStyle}>Card</label><input style={inputStyle} type="number" value={form.card} onChange={(e) => update('card', e.target.value)} /></div>
          <div><label style={labelStyle}>Scan/UPI</label><input style={inputStyle} type="number" value={form.scan} onChange={(e) => update('scan', e.target.value)} /></div>
          <div><label style={labelStyle}>NEFT</label><input style={inputStyle} type="number" value={form.neft} onChange={(e) => update('neft', e.target.value)} /></div>
          <div><label style={labelStyle}>Advance</label><input style={inputStyle} type="number" value={form.advance} onChange={(e) => update('advance', e.target.value)} /></div>
        </div>

        <div style={{
          borderRadius: 10, padding: '9px 11px', fontSize: 12, fontWeight: 700, marginBottom: 14,
          background: reconOk ? 'rgba(34,197,94,0.1)' : 'rgba(255,77,94,0.1)',
          color: reconOk ? '#22C55E' : '#FF4D5E'
        }}>
          {reconOk ? '✓ Payments match revenue' : `⚠ Mismatch: ₹${Math.abs(diff).toLocaleString('en-IN')} ${diff > 0 ? 'over' : 'short'}`}
        </div>

        <h4 style={{ color: '#5EB8AB', fontSize: 12, textTransform: 'uppercase', marginBottom: 8 }}>Parts, Labour & Counter Sale</h4>
        <div style={fieldGrid}>
          <div><label style={labelStyle}>Parts (₹)</label><input style={inputStyle} type="number" value={form.parts} onChange={(e) => update('parts', e.target.value)} /></div>
          <div><label style={labelStyle}>Labour (₹)</label><input style={inputStyle} type="number" value={form.labour} onChange={(e) => update('labour', e.target.value)} /></div>
          <div><label style={labelStyle}>Counter Volume</label><input style={inputStyle} type="number" value={form.counter_sale_volume} onChange={(e) => update('counter_sale_volume', e.target.value)} /></div>
          <div><label style={labelStyle}>Counter Revenue (₹)</label><input style={inputStyle} type="number" value={form.counter_sale_revenue} onChange={(e) => update('counter_sale_revenue', e.target.value)} /></div>
        </div>

        {message && <p style={{ fontSize: 12, marginBottom: 10, color: message.startsWith('✓') ? '#22C55E' : '#FF8A93' }}>{message}</p>}

        <button type="submit" disabled={saving} style={{ width: '100%', padding: 14, borderRadius: 12, border: 'none', background: saving ? '#3A3C46' : '#2DD4BF', color: '#071612', fontWeight: 800 }}>
          {saving ? 'Saving...' : "Save Today's Entry"}
        </button>
      </form>
    </div>
  );
}