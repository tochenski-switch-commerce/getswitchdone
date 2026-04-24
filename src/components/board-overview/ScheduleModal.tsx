'use client';

import { useState } from 'react';
import { X, Calendar, Trash2, Mail } from 'lucide-react';
import { supabase } from '@/lib/supabase';

const DAY_OPTIONS = [
  { value: 0, label: 'Sunday' },
  { value: 1, label: 'Monday' },
  { value: 2, label: 'Tuesday' },
  { value: 3, label: 'Wednesday' },
  { value: 4, label: 'Thursday' },
  { value: 5, label: 'Friday' },
  { value: 6, label: 'Saturday' },
];

// Generate HH:MM options every 30 minutes
const TIME_OPTIONS: { value: string; label: string }[] = [];
for (let h = 0; h < 24; h++) {
  for (const m of [0, 30]) {
    const hh = String(h).padStart(2, '0');
    const mm = String(m).padStart(2, '0');
    const period = h >= 12 ? 'PM' : 'AM';
    const hour12 = h === 0 ? 12 : h > 12 ? h - 12 : h;
    TIME_OPTIONS.push({
      value: `${hh}:${mm}`,
      label: `${hour12}:${mm} ${period}`,
    });
  }
}

export interface OverviewSchedule {
  id: string;
  frequency: 'daily' | 'weekly';
  time_of_day: string;
  day_of_week: number | null;
  timezone: string;
  next_send_at: string;
}

interface Props {
  boardId: string;
  existing: OverviewSchedule | null;
  onClose: () => void;
  onSaved: (schedule: OverviewSchedule) => void;
  onDeleted: () => void;
}

export default function ScheduleModal({ boardId, existing, onClose, onSaved, onDeleted }: Props) {
  const detectedTz = typeof Intl !== 'undefined'
    ? Intl.DateTimeFormat().resolvedOptions().timeZone
    : 'UTC';

  const [frequency, setFrequency] = useState<'daily' | 'weekly'>(existing?.frequency ?? 'weekly');
  const [timeOfDay, setTimeOfDay] = useState(existing?.time_of_day ?? '08:00');
  const [dayOfWeek, setDayOfWeek] = useState<number>(existing?.day_of_week ?? 1);
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [sendingTest, setSendingTest] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [testSuccess, setTestSuccess] = useState<string | null>(null);

  const timezone = existing?.timezone ?? detectedTz;

  const handleSave = async () => {
    setSaving(true);
    setError(null);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) throw new Error('Not authenticated');

      const res = await fetch(`/api/boards/${boardId}/overview-schedule`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({
          frequency,
          time_of_day: timeOfDay,
          day_of_week: frequency === 'weekly' ? dayOfWeek : null,
          timezone,
        }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? 'Failed to save');
      onSaved(json.schedule);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    setDeleting(true);
    setError(null);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) throw new Error('Not authenticated');

      const res = await fetch(`/api/boards/${boardId}/overview-schedule`, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${session.access_token}`,
        },
      });
      if (!res.ok) {
        const json = await res.json();
        throw new Error(json.error ?? 'Failed to delete');
      }
      onDeleted();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong');
    } finally {
      setDeleting(false);
    }
  };

  const handleSendTest = async () => {
    setSendingTest(true);
    setError(null);
    setTestSuccess(null);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) throw new Error('Not authenticated');

      const res = await fetch(`/api/boards/${boardId}/send-overview-email`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${session.access_token}`,
        },
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? 'Failed to send');
      setTestSuccess(json.message);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong');
    } finally {
      setSendingTest(false);
    }
  };

  return (
    <div className="kb-ov-modal-overlay" onMouseDown={onClose}>
      <div className="kb-ov-modal" onMouseDown={e => e.stopPropagation()}>
        <div className="kb-ov-modal-header">
          <span className="kb-ov-modal-title" style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <Calendar size={15} />
            {existing ? 'Edit Schedule' : 'Schedule Email Report'}
          </span>
          <button className="kb-ov-btn-icon" onClick={onClose}><X size={16} /></button>
        </div>

        <div className="kb-ov-modal-body">
          <p className="kb-ov-modal-description">
            Send this overview to <strong>{typeof window !== 'undefined' ? '' : ''}</strong>your email on a recurring schedule.
          </p>

          {/* Frequency */}
          <div className="kb-ov-form-group">
            <label className="kb-ov-form-label">Frequency</label>
            <div className="kb-ov-seg-group">
              <button
                className={`kb-ov-seg-btn${frequency === 'daily' ? ' active' : ''}`}
                onClick={() => setFrequency('daily')}
              >Daily</button>
              <button
                className={`kb-ov-seg-btn${frequency === 'weekly' ? ' active' : ''}`}
                onClick={() => setFrequency('weekly')}
              >Weekly</button>
            </div>
          </div>

          {/* Day of week (weekly only) */}
          {frequency === 'weekly' && (
            <div className="kb-ov-form-group">
              <label className="kb-ov-form-label">Day</label>
              <select
                className="kb-ov-form-select"
                value={dayOfWeek}
                onChange={e => setDayOfWeek(parseInt(e.target.value))}
              >
                {DAY_OPTIONS.map(d => (
                  <option key={d.value} value={d.value}>{d.label}</option>
                ))}
              </select>
            </div>
          )}

          {/* Time */}
          <div className="kb-ov-form-group">
            <label className="kb-ov-form-label">Time</label>
            <select
              className="kb-ov-form-select"
              value={timeOfDay}
              onChange={e => setTimeOfDay(e.target.value)}
            >
              {TIME_OPTIONS.map(t => (
                <option key={t.value} value={t.value}>{t.label}</option>
              ))}
            </select>
          </div>

          {/* Timezone (read-only, auto-detected) */}
          <div className="kb-ov-form-group">
            <label className="kb-ov-form-label">Timezone</label>
            <div className="kb-ov-tz-display">{timezone}</div>
          </div>

          {/* Test email row */}
          <div className="kb-ov-test-row">
            <button
              type="button"
              className="kb-ov-test-link"
              onClick={handleSendTest}
              disabled={sendingTest}
            >
              <Mail size={13} />
              {sendingTest ? 'Sending test email…' : 'Send a test email now'}
            </button>
          </div>

          {error && <p className="kb-ov-form-error">{error}</p>}
          {testSuccess && <p className="kb-ov-form-success">{testSuccess}</p>}
        </div>

        <div className="kb-ov-modal-footer">
          {existing && (
            <button
              className="kb-ov-btn-danger"
              onClick={handleDelete}
              disabled={deleting}
              style={{ marginRight: 'auto' }}
            >
              <Trash2 size={13} />
              {deleting ? 'Removing…' : 'Remove'}
            </button>
          )}
          <button className="kb-ov-btn-ghost" onClick={onClose}>Cancel</button>
          <button
            className="kb-ov-btn-primary"
            onClick={handleSave}
            disabled={saving}
          >
            {saving ? 'Saving…' : existing ? 'Update Schedule' : 'Save Schedule'}
          </button>
        </div>
      </div>
    </div>
  );
}
