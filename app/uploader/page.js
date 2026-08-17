'use client';
import { useState, useEffect, useRef } from 'react';
import { supabase } from '../../lib/supabaseClient';

const FIELD_LABELS = {
  inward_volume: 'Inward Volume',
  delivered_volume: 'Delivered Volume',
  revenue: 'Revenue',
  amc_count: 'AMC Count',
  google_reviews: 'Google Reviews',
  cash: 'Cash',
  card: 'Card',
  scan: 'Scan/UPI',
  neft: 'NEFT',
  paytm: 'Paytm',
  credit: 'Credit',
  advance: 'Advance',
  third_party_revenue: 'Third-Party Revenue',
  parts: 'Parts',
  labour: 'Labour',
  counter_sale_volume: 'Counter Sale Volume',
  counter_sale_revenue: 'Counter Sale Revenue',
  scheme_7rs_count: 'Scheme 7Rs Count',
  vehicle_2w_volume: '2W Volume',
  vehicle_2w_revenue: '2W Revenue',
  vehicle_4w_volume: '4W Volume',
  vehicle_4w_revenue: '4W Revenue',
};

export default function Uploader() {
  const fileInputRef = useRef(null);
  const [branches, setBranches] = useState([]);
  const [branchId, setBranchId] = useState('');
  const [entryDate, setEntryDate] = useState(new Date().toISOString().slice(0, 10));
  const [imageFile, setImageFile] = useState(null);
  const [imagePreview, setImagePreview] = useState(null);
  const [reading, setReading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [fields, setFields] = useState(null);
  const [confidenceNotes, setConfidenceNotes] = useState('');
  const [message, setMessage] = useState('');
  const [dragOver, setDragOver] = useState(false);

  useEffect(() => {
    supabase.from('branches').select('id, name').then(({ data }) => {
      if (data) setBranches(data);
    });
  }, []);

  function handleFile(file) {
    if (!file) return;
    setImageFile(file);
    setImagePreview(URL.createObjectURL(file));
    setFields(null);
    setMessage('');
  }

  function handleDrop(e) {
    e.preventDefault();
    setDragOver(false);
    const file = e.dataTransfer.files?.[0];
    handleFile(file);
  }

  async function handleReadReport() {
    if (!imageFile) return;
    setReading(true);
    setMessage('');
    try {
      const formData = new FormData();
      formData.append('image', imageFile);
      const res = await fetch('/api/extract-report', { method: 'POST', body: formData });
      const data = await res.json();
      if (!res.ok) {
        setMessage('Could not read the photo. Try again or enter numbers manually below.');
        setFields(Object.fromEntries(Object.keys(FIELD_LABELS).map((k) => [k, ''])));
        return;
      }
      const extracted = data.extracted || {};
      const clean = {};
      Object.keys(FIELD_LABELS).forEach((k) => {
        clean[k] = extracted[k] ?? '';
      });
      setFields(clean);
      setConfidenceNotes(extracted.confidence_notes || '');
    } catch (err) {
      setMessage('Something went wrong reading the photo. Try again.');
    } finally {
      setReading(false);
    }
  }

  function updateField(key, value) {
    setFields((prev) => ({ ...prev, [key]: value }));
  }

  async function handleSave() {
    if (!branchId) {
      setMessage('Please select a branch first.');
      return;
    }
    if (!fields) return;
    setSaving(true);
    setMessage('');

    const { data: { user } } = await supabase.auth.getUser();

    const row = {
      branch_id: branchId,
      entry_date: entryDate,
      source: 'photo_upload',
      created_by: null,
    };
    Object.keys(FIELD_LABELS).forEach((k) => {
      row[k] = fields[k] === '' ? null : Number(fields[k]);
    });

    if (user) {
      const { data: profile } = await supabase.from('users').select('id').eq('auth_id', user.id).single();
      if (profile) row.created_by = profile.id;
    }

    const { error } = await supabase
      .from('daily_entries')
      .upsert(row, { onConflict: 'branch_id,entry_date' });

    setSaving(false);

    if (error) {
      setMessage('Save failed: ' + error.message);
    } else {
      setMessage('Saved successfully.');
      setFields(null);
      setImageFile(null);
      setImagePreview(null);
    }
  }

  return (
    <div style={{ minHeight: '100vh', background: '#000000', padding: 16, fontFamily: 'Manrope, sans-serif' }}>
      <h2 style={{ color: '#E8E9ED', marginBottom: 4 }}>Daily Report — Photo Upload</h2>
      <p style={{ color: '#9096A8', fontSize: 12, marginBottom: 20 }}>
        Select a branch, upload the photo, review the numbers, then confirm.
      </p>

      <div style={{ background: '#161820', border: '1px solid #23252F', borderRadius: 16, padding: 18, marginBottom: 16 }}>
        <label style={{ color: '#9096A8', fontSize: 11, fontWeight: 600 }}>Branch</label>
        <select
          value={branchId}
          onChange={(e) => setBranchId(e.target.value)}
          style={{ width: '100%', padding: 12, marginTop: 6, marginBottom: 14, background: '#0D0E14', border: '1px solid #23252F', borderRadius: 10, color: '#E8E9ED' }}
        >
          <option value="">Select branch</option>
          {branches.map((b) => (
            <option key={b.id} value={b.id}>{b.name}</option>
          ))}
        </select>

        <label style={{ color: '#9096A8', fontSize: 11, fontWeight: 600 }}>Report Date</label>
        <input
          type="date"
          value={entryDate}
          onChange={(e) => setEntryDate(e.target.value)}
          style={{ width: '100%', padding: 12, marginTop: 6, marginBottom: 14, background: '#0D0E14', border: '1px solid #23252F', borderRadius: 10, color: '#E8E9ED' }}
        />

        <label style={{ color: '#9096A8', fontSize: 11, fontWeight: 600 }}>Report Photo</label>
        <div
          onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
          onDragLeave={() => setDragOver(false)}
          onDrop={handleDrop}
          onClick={() => fileInputRef.current?.click()}
          style={{
            marginTop: 6, padding: 24, borderRadius: 12, textAlign: 'center', cursor: 'pointer',
            border: dragOver ? '2px dashed #F5A623' : '2px dashed #23252F',
            background: '#0D0E14', color: '#9096A8', fontSize: 13,
          }}
        >
          {imagePreview ? (
            <img src={imagePreview} alt="preview" style={{ maxWidth: '100%', maxHeight: 220, borderRadius: 8 }} />
          ) : (
            'Drag & drop the photo here, or tap to choose'
          )}
        </div>
        <input
          ref={fileInputRef}
          type="file"
          accept="image/*"
          style={{ display: 'none' }}
          onChange={(e) => handleFile(e.target.files?.[0])}
        />

        <button
          onClick={handleReadReport}
          disabled={!imageFile || reading}
          style={{
            width: '100%', padding: 14, marginTop: 14, borderRadius: 12, border: 'none',
            background: imageFile && !reading ? '#F5A623' : '#3A3D4A',
            color: '#14151C', fontWeight: 800, cursor: imageFile && !reading ? 'pointer' : 'not-allowed',
          }}
        >
          {reading ? 'Reading photo…' : 'Read Report'}
        </button>
      </div>

      {fields && (
        <div style={{ background: '#161820', border: '1px solid #23252F', borderRadius: 16, padding: 18, marginBottom: 16 }}>
          <h3 style={{ color: '#E8E9ED', fontSize: 14, marginBottom: 10 }}>Review Numbers</h3>
          {confidenceNotes && (
            <p style={{ color: '#F5A623', fontSize: 12, marginBottom: 12 }}>⚠ {confidenceNotes}</p>
          )}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
            {Object.keys(FIELD_LABELS).map((k) => (
              <div key={k}>
                <label style={{ color: '#9096A8', fontSize: 10, fontWeight: 600 }}>{FIELD_LABELS[k]}</label>
                <input
                  type="number"
                  value={fields[k]}
                  onChange={(e) => updateField(k, e.target.value)}
                  style={{ width: '100%', padding: 10, marginTop: 4, background: '#0D0E14', border: '1px solid #23252F', borderRadius: 8, color: '#E8E9ED' }}
                />
              </div>
            ))}
          </div>

          <button
            onClick={handleSave}
            disabled={saving}
            style={{
              width: '100%', padding: 14, marginTop: 16, borderRadius: 12, border: 'none',
              background: '#22C55E', color: '#0D0E14', fontWeight: 800, cursor: saving ? 'not-allowed' : 'pointer',
            }}
          >
            {saving ? 'Saving…' : 'Confirm & Save'}
          </button>
        </div>
      )}

      {message && <p style={{ color: '#9096A8', fontSize: 13, textAlign: 'center' }}>{message}</p>}
    </div>
  );
}