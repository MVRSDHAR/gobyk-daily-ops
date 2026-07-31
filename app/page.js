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

// Same metric-pair set as /admin, kept identical so both dashboards behave consistently.
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
    colB: { label: 'Parts', field: 'parts', mtdField: 'mtd_parts', money: true },
    colC: { label: 'Labour', field: 'labour', mtdField: 'mtd_labour', money: true } },
  { key: 'counter', label: 'Counter Sale', color: '#F5A623',
    colB: { label: 'CS Vol', field: 'counter_sale_volume', mtdField: 'mtd_counter_sale_volume', money: false },
    colC: { label: 'CS Revenue', field: 'counter_sale_revenue', mtdField: 'mtd_counter_sale_revenue', money: true } },
];

function fmt(val, money) {
  const n = Number(val || 0);
  return money ? '₹' + n.toLocaleString('en-IN') : n.toLocaleString('en-IN');
}

export default function ManagerDashboard() {
  const router = useRouter();
  const [branchName, setBranchName] = useState('');
  const [entries, setEntries] = useState([]);
  const [loading, setLoading] = useState(true);
  const [debugError, setDebugError] = useState('');

  const [mode, setMode] = useState('daily');
  const [selectedDate, setSelectedDate] = useState(todayStr());
  const [selectedMonth, setSelectedMonth] = useState(todayStr().slice(0, 7));
  const [metricKey, setMetricKey] = useState('vol_rev');
  const [sortDir, setSortDir] = useState('desc');
  const [sortCol, setSortCol] = useState('date'); // 'date' | 'colB' | 'colC'

  useEffect(() => {
    async function load() {
      const { data: userData } = await supabase.auth.getUser();
      if (!userData?.user) { router.push('/login'); return; }

      const { data: profile } = await supabase
        .from('users')
        .select('branch_id, branches(name)')
        .eq('auth_id', userData.user.id)
        .single();

      if (!profile?.branch_id) {
        setDebugError('No branch assigned to this account.');
        setLoading(false);
        return;
      }
      setBranchName(profile.branches?.name || '');

      const { data: entryData, error: entryError } = await supabase
        .from('daily_entries')
        .select('*')
        .eq('branch_id', profile.branch_id)
        .order('entry_date', { ascending: false });

      if (entryError) setDebugError('Entries error: ' + entryError.message);
      setEntries(entryData || []);

      if (entryData && entryData.length > 0) {
        setSelectedDate(entryData[0].entry_date);
        setSelectedMonth(entryData[0].entry_date.slice(0, 7));
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
  const hasMtdSource = !!(metric.colB.mtdField || metric.colC.mtdField);

  function valueForRow(colDef, entry, monthEntries) {
    if (mode === 'daily') return Number(entry?.[colDef.field] || 0);
    if (monthEntries && monthEntries.length > 1) {
      return monthEntries.reduce((s, e) => s + Number(e[colDef.field] || 0), 0);
    }
    const single = monthEntries && monthEntries[0];
    if (colDef.mtdField && single?.[colDef.mtdField] != null) return Number(single[colDef.mtdField]);
    return Number(single?.[colDef.field] || 0);
  }

  const monthEntries = entries.filter((e) => e.entry_date.startsWith(selectedMonth));
  const todayEntry = entries.find((e) => e.entry_date === selectedDate);

  // Summary card totals (single branch, so this is just the one figure — daily = that day, monthly = MTD)
  const summaryColB = mode === 'daily'
    ? valueForRow(metric.colB, todayEntry, null)
    : valueForRow(metric.colB, monthEntries[0], monthEntries);
  const summaryColC = mode === 'daily'
    ? valueForRow(metric.colC, todayEntry, null)
    : valueForRow(metric.colC, monthEntries[0], monthEntries);

  const summaryLabel = mode === 'daily'
    ? (selectedDate ? new Date(selectedDate + 'T00:00:00').toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' }) : '—')
    : (selectedMonth ? new Date(selectedMonth + '-01T00:00:00').toLocaleDateString('en-IN', { month: 'long', year: 'numeric' }) : '—');

  // Grid: list of this branch's own logged days (last 30, or within selected month for monthly mode)
  const listSource = mode === 'daily' ? entries.slice(0, 30) : monthEntries;
  let rows = listSource.map((e) => ({
    date: e.entry_date,
    colB: Number(e[metric.colB.field] || 0),
    colC: Number(e[metric.colC.field] || 0),
  }));

  rows = [...rows].sort((a, b) => {
    let av, bv;
    if (sortCol === 'date') { av = a.date; bv = b.date; }
    else if (sortCol === 'colB') { av = a.colB; bv = b.colB; }
    else { av = a.colC; bv = b.colC; }
    if (typeof av === 'string') return sortDir === 'asc' ? av.localeCompare(bv) : bv.localeCompare(av);
    return sortDir === 'asc' ? av - bv : bv - av;
  });

  function toggleSort(col) {
    if (sortCol === col) setSortDir(sortDir === 'asc' ? 'desc' : 'asc');
    else { setSortCol(col); setSortDir(col === 'date' ? 'desc' : 'asc'); }
  }

  const noDataToday = mode === 'daily' && !todayEntry;

  return (
    <div style={{ fontFamily: "'Manrope', sans-serif", background: '#000000', minHeight: '100vh', padding: 14 }}>
      <div style={{ maxWidth: 480, margin: '0 auto', color: '#E8E9ED' }}>

        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
          <div style={{ background: '#161820', color: '#F5A623', border: '1px solid #2A2D3A', borderRadius: 10, padding: '8px 12px', fontWeight: 700, fontSize: 13 }}>
            👤 {branchName || 'Manager'}
          </div>
          <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
            <div
              onClick={() => router.push('/manager/entry')}
              title="Log today's entry"
              style={{
                width: 34, height: 34, borderRadius: 9, display: 'flex', alignItems: 'center', justifyContent: 'center',
                background: '#161820', border: '1px solid #2A2D3A', cursor: 'pointer', fontSize: 16, color: '#22C55E',
              }}
            >
              +
            </div>
            <div onClick={handleLogout} style={{ fontSize: 11, color: '#9096A8', fontWeight: 700, cursor: 'pointer' }}>Log out</div>
          </div>
        </div>

        {debugError && (
          <div style={{ background: 'rgba(255,77,94,0.15)', border: '1px solid #FF4D5E', color: '#FF8A93', borderRadius: 12, padding: '10px 12px', fontSize: 11, fontWeight: 700, marginBottom: 12 }}>
            🐛 {debugError}
          </div>
        )}

        {/* Summary card — tracks whichever metric pair is selected */}
        <div style={{ background: '#161820', borderRadius: 16, padding: 16, marginBottom: 16 }}>
          <div style={{ fontSize: 11, fontWeight: 700, color: '#9096A8', textTransform: 'uppercase', marginBottom: 2 }}>
            {mode === 'daily' ? 'Daily Summary' : 'Monthly Summary (MTD)'} · {metric.label}
          </div>
          <div style={{ fontSize: 13, fontWeight: 700, color: metric.color, marginBottom: 10 }}>
            {summaryLabel}
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
            <div style={{ background: '#0D0E14', border: '1px solid #23252F', borderRadius: 12, padding: '10px 12px' }}>
              <div style={{ fontSize: 11, color: '#9096A8', fontWeight: 600 }}>{metric.colB.label}</div>
              <div style={{ fontSize: 20, fontWeight: 800, fontVariantNumeric: 'tabular-nums' }}>{fmt(summaryColB, metric.colB.money)}</div>
            </div>
            <div style={{ background: '#0D0E14', border: '1px solid #23252F', borderRadius: 12, padding: '10px 12px' }}>
              <div style={{ fontSize: 11, color: '#9096A8', fontWeight: 600 }}>{metric.colC.label}</div>
              <div style={{ fontSize: 20, fontWeight: 800, fontVariantNumeric: 'tabular-nums' }}>{fmt(summaryColC, metric.colC.money)}</div>
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

        {/* Horizontal metric-pair scroller */}
        <div style={{
          display: 'flex', gap: 8, overflowX: 'auto', paddingBottom: 8, marginBottom: 8,
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

        {mode === 'monthly' && !hasMtdSource && (
          <div style={{ background: 'rgba(59,130,246,0.1)', border: '1px solid rgba(59,130,246,0.3)', color: '#8AB4F8', borderRadius: 12, padding: '10px 12px', fontSize: 11, fontWeight: 600, marginBottom: 12 }}>
            ℹ {metric.label} has no separate MTD record — this month's total will match today's figure until you log a 2nd day.
          </div>
        )}

        {noDataToday && (
          <div style={{ background: 'rgba(255,77,94,0.1)', border: '1px solid rgba(255,77,94,0.3)', color: '#FF8A93', borderRadius: 12, padding: '10px 12px', fontSize: 11, fontWeight: 700, marginBottom: 14 }}>
            ⚠ No entry logged for this date. Tap + above to add it.
          </div>
        )}

        <h3 style={{ color: '#9096A8', fontSize: 11, textTransform: 'uppercase', marginBottom: 8, fontWeight: 700 }}>
          {mode === 'daily' ? 'Recent Entries' : 'This Month\'s Entries'} ({rows.length})
        </h3>

        {loading ? (
          <p style={{ color: '#9096A8' }}>Loading...</p>
        ) : rows.length === 0 ? (
          <p style={{ color: '#9096A8', fontSize: 13 }}>No entries yet.</p>
        ) : (
          <div style={{ background: '#161820', borderRadius: 12, border: '1px solid #23252F', overflow: 'hidden' }}>
            <div style={{ display: 'grid', gridTemplateColumns: '1.4fr 1fr 1.2fr', padding: '10px 12px', borderBottom: '1px solid #23252F' }}>
              <div onClick={() => toggleSort('date')} style={{ fontSize: 11, color: '#9096A8', fontWeight: 700, cursor: 'pointer' }}>
                Date {sortCol === 'date' && (sortDir === 'asc' ? '▾' : '▴')}
              </div>
              <div onClick={() => toggleSort('colB')} style={{ fontSize: 11, color: '#9096A8', fontWeight: 700, cursor: 'pointer', textAlign: 'right' }}>
                {metric.colB.label} {sortCol === 'colB' && (sortDir === 'asc' ? '▾' : '▴')}
              </div>
              <div onClick={() => toggleSort('colC')} style={{ fontSize: 11, color: '#9096A8', fontWeight: 700, cursor: 'pointer', textAlign: 'right' }}>
                {metric.colC.label} {sortCol === 'colC' && (sortDir === 'asc' ? '▾' : '▴')}
              </div>
            </div>
            <div style={{ maxHeight: 420, overflowY: 'auto' }}>
              {rows.map((r, i) => (
                <div
                  key={r.date}
                  style={{
                    display: 'grid', gridTemplateColumns: '1.4fr 1fr 1.2fr', padding: '12px',
                    borderBottom: i < rows.length - 1 ? '1px solid #1B1D26' : 'none',
                  }}
                >
                  <div style={{ fontSize: 13, fontWeight: 700 }}>{r.date}</div>
                  <div style={{ fontSize: 13, textAlign: 'right', fontVariantNumeric: 'tabular-nums' }}>{fmt(r.colB, metric.colB.money)}</div>
                  <div style={{ fontSize: 13, textAlign: 'right', fontVariantNumeric: 'tabular-nums', fontWeight: 700 }}>{fmt(r.colC, metric.colC.money)}</div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}