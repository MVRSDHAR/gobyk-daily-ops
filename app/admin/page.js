'use client';
import { useEffect, useState } from 'react';
import { supabase } from '../../lib/supabaseClient';
import { useRouter } from 'next/navigation';

function todayStr() {
  const d = new Date();
  return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
}

const TABS = [
  { key: 'daily', label: 'Daily', color: '#F5A623' },
  { key: 'monthly', label: 'Monthly', color: '#3B82F6' },
];

// Metric pairs available in the horizontal scroller.
// Each maps to two raw field names to sum/read from daily_entries,
// plus an optional "mtd" field name to use for the monthly fallback.
const METRIC_PAIRS = [
  { key: 'vol_rev', label: 'Vol / Revenue', color: '#F5A623',
    colB: { label: 'Vol', field: 'delivered_volume', mtdField: 'mtd_volume', money: false },
    colC: { label: 'Revenue', field: 'revenue', mtdField: 'mtd_revenue', money: true } },
  { key: 'cash_card', label: 'Cash / Card', color: '#3B82F6',
    colB: { label: 'Cash', field: 'cash', money: true },
    colC: { label: 'Card', field: 'card', money: true } },
  { key: 'scan_neft', label: 'Scan / NEFT', color: '#A855F7',
    colB: { label: 'Scan', field: 'scan', money: true },
    colC: { label: 'NEFT', field: 'neft', money: true } },
  { key: 'amc_reviews', label: 'AMC / Reviews', color: '#14B8A6',
    colB: { label: 'AMC', field: 'amc_count', mtdField: 'mtd_amc', money: false },
    colC: { label: 'Reviews', field: 'google_reviews', mtdField: 'mtd_reviews', money: false } },
  { key: 'parts_labour', label: 'Parts / Labour', color: '#EC4899',
    colB: { label: 'Parts', field: 'parts', money: true },
    colC: { label: 'Labour', field: 'labour', money: true } },
  { key: 'counter', label: 'Counter Sale', color: '#F5A623',
    colB: { label: 'CS Vol', field: 'counter_sale_volume', money: false },
    colC: { label: 'CS Revenue', field: 'counter_sale_revenue', money: true } },
];

function fmt(val, money) {
  const n = Number(val || 0);
  return money ? '₹' + n.toLocaleString('en-IN') : n.toLocaleString('en-IN');
}

export default function AdminDashboard() {
  const router = useRouter();
  const [branches, setBranches] = useState([]);
  const [allEntries, setAllEntries] = useState([]);
  const [loading, setLoading] = useState(true);
  const [role, setRole] = useState('admin');
  const [debugError, setDebugError] = useState('');

  const [mode, setMode] = useState('daily');
  const [selectedDate, setSelectedDate] = useState(todayStr());
  const [selectedMonth, setSelectedMonth] = useState(todayStr().slice(0, 7));
  const [metricKey, setMetricKey] = useState('vol_rev');
  const [sortDir, setSortDir] = useState('asc');
  const [sortCol, setSortCol] = useState('name'); // 'name' | 'colB' | 'colC'

  useEffect(() => {
    async function load() {
      const { data: userData } = await supabase.auth.getUser();
      if (!userData?.user) { router.push('/login'); return; }

      const { data: profile } = await supabase.from('users').select('role').eq('auth_id', userData.user.id).single();
      if (profile?.role) setRole(profile.role);

      const { data: branchList, error: branchError } = await supabase.from('branches').select('*').order('name');
      const { data: entries, error: entryError } = await supabase
        .from('daily_entries')
        .select('*')
        .order('entry_date', { ascending: false });

      if (branchError) setDebugError('Branches error: ' + branchError.message);
      else if (entryError) setDebugError('Entries error: ' + entryError.message);

      setBranches(branchList || []);
      setAllEntries(entries || []);

      if (entries && entries.length > 0) {
        setSelectedDate(entries[0].entry_date);
        setSelectedMonth(entries[0].entry_date.slice(0, 7));
      }
      setLoading(false);
    }
    load();
  }, []);

  async function handleLogout() {
    await supabase.auth.signOut();
    router.push('/login');
  }

  const metric = METRIC_PAIRS.find((m) => m.key === metricKey);

  function valueFor(colDef, entry, monthEntries) {
    if (mode === 'daily') {
      return Number(entry?.[colDef.field] || 0);
    }
    // monthly
    if (monthEntries && monthEntries.length > 1) {
      return monthEntries.reduce((s, e) => s + Number(e[colDef.field] || 0), 0);
    }
    // single-entry fallback: prefer static MTD field if this metric has one, else raw field
    const single = monthEntries && monthEntries[0];
    if (colDef.mtdField && single?.[colDef.mtdField] != null) {
      return Number(single[colDef.mtdField]);
    }
    return Number(single?.[colDef.field] || 0);
  }

  let branchRows = [];
  let summaryLabel = '';

  if (mode === 'daily') {
    summaryLabel = selectedDate
      ? new Date(selectedDate + 'T00:00:00').toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })
      : '—';
    branchRows = branches.map((b) => {
      const entry = allEntries.find((e) => e.branch_id === b.id && e.entry_date === selectedDate);
      return {
        branch: b, entry,
        colB: valueFor(metric.colB, entry, null),
        colC: valueFor(metric.colC, entry, null),
        volume: entry?.delivered_volume || 0,
        revenue: Number(entry?.revenue || 0),
      };
    });
  } else {
    summaryLabel = selectedMonth
      ? new Date(selectedMonth + '-01T00:00:00').toLocaleDateString('en-IN', { month: 'long', year: 'numeric' })
      : '—';
    branchRows = branches.map((b) => {
      const monthEntries = allEntries.filter((e) => e.branch_id === b.id && e.entry_date.startsWith(selectedMonth));
      const latest = monthEntries[0];

      let volume, revenue;
      if (monthEntries.length > 1) {
        volume = monthEntries.reduce((s, e) => s + (e.delivered_volume || 0), 0);
        revenue = monthEntries.reduce((s, e) => s + Number(e.revenue || 0), 0);
      } else {
        volume = Number(latest?.mtd_volume ?? latest?.delivered_volume ?? 0);
        revenue = Number(latest?.mtd_revenue ?? latest?.revenue ?? 0);
      }

      return {
        branch: b, entry: latest,
        colB: valueFor(metric.colB, latest, monthEntries),
        colC: valueFor(metric.colC, latest, monthEntries),
        volume, revenue,
        asOf: latest?.entry_date, dayCount: monthEntries.length,
      };
    });
  }

  branchRows = [...branchRows].sort((a, b) => {
    let av, bv;
    if (sortCol === 'name') { av = a.branch.name; bv = b.branch.name; }
    else if (sortCol === 'colB') { av = a.colB; bv = b.colB; }
    else { av = a.colC; bv = b.colC; }
    if (typeof av === 'string') return sortDir === 'asc' ? av.localeCompare(bv) : bv.localeCompare(av);
    return sortDir === 'asc' ? av - bv : bv - av;
  });

  const totalVolume = branchRows.reduce((s, r) => s + r.volume, 0);
  const totalRevenue = branchRows.reduce((s, r) => s + r.revenue, 0);
  const missing = branchRows.filter((r) => !r.entry).map((r) => r.branch.name);

  const canEdit = role === 'admin' || role === 'ho_manager';

  function toggleSort(col) {
    if (sortCol === col) setSortDir(sortDir === 'asc' ? 'desc' : 'asc');
    else { setSortCol(col); setSortDir('asc'); }
  }

  return (
    <div style={{ fontFamily: "'Manrope', sans-serif", background: '#000000', minHeight: '100vh', padding: 14 }}>
      <div style={{ maxWidth: 480, margin: '0 auto', color: '#E8E9ED' }}>

        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
          <div style={{ background: '#161820', color: '#F5A623', border: '1px solid #2A2D3A', borderRadius: 10, padding: '8px 12px', fontWeight: 700, fontSize: 13 }}>
            🛡 {role === 'admin' ? 'Admin' : role === 'ho_manager' ? 'HO Manager' : 'Manager'}
          </div>
          <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
            <div
              onClick={() => canEdit && router.push('/admin/entries')}
              title="Edit entries"
              style={{
                width: 34, height: 34, borderRadius: 9, display: 'flex', alignItems: 'center', justifyContent: 'center',
                background: '#161820', border: '1px solid #2A2D3A',
                opacity: canEdit ? 1 : 0.35, cursor: canEdit ? 'pointer' : 'not-allowed',
                fontSize: 15,
              }}
            >
              ✏️
            </div>
            <div onClick={handleLogout} style={{ fontSize: 11, color: '#9096A8', fontWeight: 700, cursor: 'pointer' }}>Log out</div>
          </div>
        </div>

        {debugError && (
          <div style={{ background: 'rgba(255,77,94,0.15)', border: '1px solid #FF4D5E', color: '#FF8A93', borderRadius: 12, padding: '10px 12px', fontSize: 11, fontWeight: 700, marginBottom: 12 }}>
            🐛 {debugError}
          </div>
        )}

        <div style={{ background: '#161820', borderRadius: 16, padding: 16, marginBottom: 16 }}>
          <div style={{ fontSize: 11, fontWeight: 700, color: '#9096A8', textTransform: 'uppercase', marginBottom: 2 }}>
            {mode === 'daily' ? 'Daily Summary' : 'Monthly Summary (MTD)'}
          </div>
          <div style={{ fontSize: 13, fontWeight: 700, color: TABS.find(t => t.key === mode).color, marginBottom: 10 }}>
            {summaryLabel}
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
            <div style={{ background: '#0D0E14', border: '1px solid #23252F', borderRadius: 12, padding: '10px 12px' }}>
              <div style={{ fontSize: 11, color: '#9096A8', fontWeight: 600 }}>Volume</div>
              <div style={{ fontSize: 20, fontWeight: 800, fontVariantNumeric: 'tabular-nums' }}>{totalVolume}</div>
              <div style={{ fontSize: 11, color: '#22C55E', fontWeight: 700 }}>{branchRows.filter(r => r.entry).length}/{branchRows.length} reporting</div>
            </div>
            <div style={{ background: '#0D0E14', border: '1px solid #23252F', borderRadius: 12, padding: '10px 12px' }}>
              <div style={{ fontSize: 11, color: '#9096A8', fontWeight: 600 }}>Revenue</div>
              <div style={{ fontSize: 20, fontWeight: 800, fontVariantNumeric: 'tabular-nums' }}>₹{totalRevenue.toLocaleString('en-IN')}</div>
              <div style={{ fontSize: 11, color: missing.length > 0 ? '#FF4D5E' : '#22C55E', fontWeight: 700 }}>
                {missing.length > 0 ? `${missing.length} missing` : 'All reported'}
              </div>
            </div>
          </div>
        </div>

        <div style={{ display: 'flex', gap: 18, borderBottom: '1px solid #23252F', marginBottom: 12 }}>
          {TABS.map((t) => (
            <div
              key={t.key}
              onClick={() => setMode(t.key)}
              style={{
                paddingBottom: 8, fontSize: 13, fontWeight: 700, cursor: 'pointer',
                color: mode === t.key ? t.color : '#9096A8',
                opacity: mode === t.key ? 1 : 0.45,
                borderBottom: mode === t.key ? `2px solid ${t.color}` : '2px solid transparent',
              }}
            >
              {t.label}
            </div>
          ))}
        </div>

        {mode === 'daily' ? (
          <input type="date" value={selectedDate} onChange={(e) => setSelectedDate(e.target.value)}
            style={{ width: '100%', background: '#161820', color: '#E8E9ED', border: '1px solid #2A2D3A', borderRadius: 10, padding: '10px 12px', marginBottom: 12, fontSize: 13 }} />
        ) : (
          <input type="month" value={selectedMonth} onChange={(e) => setSelectedMonth(e.target.value)}
            style={{ width: '100%', background: '#161820', color: '#E8E9ED', border: '1px solid #2A2D3A', borderRadius: 10, padding: '10px 12px', marginBottom: 12, fontSize: 13 }} />
        )}

        {/* Horizontal metric-pair scroller — picks what shows in columns B/C below */}
        <div style={{
          display: 'flex', gap: 8, overflowX: 'auto', paddingBottom: 8, marginBottom: 12,
          WebkitOverflowScrolling: 'touch', scrollbarWidth: 'none',
        }}>
          {METRIC_PAIRS.map((m) => (
            <div
              key={m.key}
              onClick={() => setMetricKey(m.key)}
              style={{
                flexShrink: 0, whiteSpace: 'nowrap', fontSize: 12, fontWeight: 700, cursor: 'pointer',
                padding: '7px 14px', borderRadius: 999,
                background: metricKey === m.key ? m.color : '#161820',
                color: metricKey === m.key ? '#000' : '#9096A8',
                border: `1px solid ${metricKey === m.key ? m.color : '#2A2D3A'}`,
                opacity: metricKey === m.key ? 1 : 0.75,
              }}
            >
              {m.label}
            </div>
          ))}
        </div>

        {missing.length > 0 && (
          <div style={{ background: 'rgba(255,77,94,0.1)', border: '1px solid rgba(255,77,94,0.3)', color: '#FF8A93', borderRadius: 12, padding: '10px 12px', fontSize: 11, fontWeight: 700, marginBottom: 14 }}>
            ⚠ No {mode === 'daily' ? 'entry for this date' : 'data this month'}: {missing.join(', ')}
          </div>
        )}

        {loading ? (
          <p style={{ color: '#9096A8' }}>Loading...</p>
        ) : (
          <div style={{ background: '#161820', borderRadius: 12, border: '1px solid #23252F', overflow: 'hidden' }}>
            <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr 1.2fr', padding: '10px 12px', borderBottom: '1px solid #23252F' }}>
              <div onClick={() => toggleSort('name')} style={{ fontSize: 11, color: '#9096A8', fontWeight: 700, cursor: 'pointer' }}>
                Branch {sortCol === 'name' && (sortDir === 'asc' ? '▾' : '▴')}
              </div>
              <div onClick={() => toggleSort('colB')} style={{ fontSize: 11, color: '#9096A8', fontWeight: 700, cursor: 'pointer', textAlign: 'right' }}>
                {metric.colB.label} {sortCol === 'colB' && (sortDir === 'asc' ? '▾' : '▴')}
              </div>
              <div onClick={() => toggleSort('colC')} style={{ fontSize: 11, color: '#9096A8', fontWeight: 700, cursor: 'pointer', textAlign: 'right' }}>
                {metric.colC.label} {sortCol === 'colC' && (sortDir === 'asc' ? '▾' : '▴')}
              </div>
            </div>

            <div style={{ maxHeight: 420, overflowY: 'auto' }}>
              {branchRows.map((r, i) => (
                <div
                  key={r.branch.id}
                  style={{
                    display: 'grid', gridTemplateColumns: '2fr 1fr 1.2fr', padding: '12px',
                    borderBottom: i < branchRows.length - 1 ? '1px solid #1B1D26' : 'none',
                    opacity: r.entry ? 1 : 0.4,
                  }}
                >
                  <div>
                    <div style={{ fontSize: 13, fontWeight: 700 }}>{r.branch.name}</div>
                    {mode === 'monthly' && r.asOf && (
                      <div style={{ fontSize: 10, color: '#9096A8' }}>
                        {r.dayCount > 1 ? `${r.dayCount} days logged` : `as of ${r.asOf}`}
                      </div>
                    )}
                  </div>
                  <div style={{ fontSize: 13, textAlign: 'right', fontVariantNumeric: 'tabular-nums' }}>
                    {fmt(r.colB, metric.colB.money)}
                  </div>
                  <div style={{ fontSize: 13, textAlign: 'right', fontVariantNumeric: 'tabular-nums', fontWeight: 700 }}>
                    {fmt(r.colC, metric.colC.money)}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}