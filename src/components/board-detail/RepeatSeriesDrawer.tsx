'use client';

import { useState } from 'react';
import type { RepeatRule, RepeatUnit, RepeatMode } from '@/types/board-types';
import type { RepeatSeriesRow } from '@/hooks/useProjectBoard';
import { X, RefreshCw, Pause, Play, Edit2, Check } from 'lucide-react';
import { formatRepeatSummary, formatNextDate } from './helpers';

const NTH_LABELS = ['1st', '2nd', '3rd', '4th', '5th'];
const WEEKDAY_NAMES = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

function EditForm({
  initial,
  onSave,
  onCancel,
  saving,
}: {
  initial: RepeatRule;
  onSave: (rule: RepeatRule) => void;
  onCancel: () => void;
  saving: boolean;
}) {
  const [mode, setMode] = useState<RepeatMode>(initial.mode ?? 'interval');
  const [every, setEvery] = useState(initial.every ?? 1);
  const [unit, setUnit] = useState<RepeatUnit>(initial.unit ?? 'days');
  const [nth, setNth] = useState(initial.nth ?? 1);
  const [weekday, setWeekday] = useState(initial.weekday ?? 1);
  const [endDate, setEndDate] = useState(initial.endDate ?? '');

  const buildRule = (): RepeatRule => {
    if (mode === 'monthly-weekday') {
      return { mode: 'monthly-weekday', every: 1, unit: 'months', nth, weekday, ...(endDate ? { endDate } : {}) };
    }
    return { mode: 'interval', every, unit, ...(endDate ? { endDate } : {}) };
  };

  return (
    <div className="kb-repeat-series-edit-form">
      {/* Mode */}
      <select
        className="kb-input"
        value={mode}
        onChange={e => setMode(e.target.value as RepeatMode)}
        style={{ fontSize: 12, marginBottom: 6 }}
      >
        <option value="interval">Every N days / weeks / months</option>
        <option value="monthly-weekday">Monthly on a specific day</option>
      </select>

      {mode === 'interval' ? (
        <div style={{ display: 'flex', gap: 6, marginBottom: 6 }}>
          <span style={{ fontSize: 12, color: '#9ca3af', alignSelf: 'center' }}>Every</span>
          <select
            className="kb-input"
            value={every}
            onChange={e => setEvery(parseInt(e.target.value))}
            style={{ width: 56, fontSize: 12 }}
          >
            {Array.from({ length: 12 }, (_, i) => i + 1).map(n => (
              <option key={n} value={n}>{n}</option>
            ))}
          </select>
          <select
            className="kb-input"
            value={unit}
            onChange={e => setUnit(e.target.value as RepeatUnit)}
            style={{ fontSize: 12 }}
          >
            <option value="days">Days</option>
            <option value="weeks">Weeks</option>
            <option value="months">Months</option>
          </select>
        </div>
      ) : (
        <div style={{ display: 'flex', gap: 6, marginBottom: 6 }}>
          <span style={{ fontSize: 12, color: '#9ca3af', alignSelf: 'center' }}>The</span>
          <select
            className="kb-input"
            value={nth}
            onChange={e => setNth(parseInt(e.target.value))}
            style={{ width: 64, fontSize: 12 }}
          >
            {NTH_LABELS.map((l, i) => <option key={i} value={i + 1}>{l}</option>)}
          </select>
          <select
            className="kb-input"
            value={weekday}
            onChange={e => setWeekday(parseInt(e.target.value))}
            style={{ fontSize: 12 }}
          >
            {WEEKDAY_NAMES.map((d, i) => <option key={i} value={i}>{d}</option>)}
          </select>
        </div>
      )}

      {/* End date */}
      <input
        type="date"
        className="kb-input"
        value={endDate}
        onChange={e => setEndDate(e.target.value)}
        placeholder="End date (optional)"
        style={{ fontSize: 12, marginBottom: 8, width: '100%' }}
      />

      <div style={{ display: 'flex', gap: 6 }}>
        <button
          className="kb-btn kb-btn-primary kb-btn-sm"
          disabled={saving}
          onClick={() => onSave(buildRule())}
        >
          <Check size={12} />
          {saving ? 'Saving…' : 'Save'}
        </button>
        <button
          className="kb-btn kb-btn-sm"
          style={{ background: 'transparent', color: '#6b7280', border: '1px solid #374151' }}
          onClick={onCancel}
        >
          Cancel
        </button>
      </div>
    </div>
  );
}

export default function RepeatSeriesDrawer({
  series,
  onClose,
  onUpdate,
  onStop,
  loading,
}: {
  series: RepeatSeriesRow[];
  onClose: () => void;
  onUpdate: (seriesId: string, rule: RepeatRule) => Promise<boolean>;
  onStop: (seriesId: string) => Promise<boolean>;
  loading: boolean;
}) {
  const [editingId, setEditingId] = useState<string | null>(null);
  const [savingId, setSavingId] = useState<string | null>(null);
  const [stoppingId, setStoppingId] = useState<string | null>(null);
  // Local override for is_active after stopping (optimistic)
  const [stoppedIds, setStoppedIds] = useState<Set<string>>(new Set());

  const handleSave = async (seriesId: string, rule: RepeatRule) => {
    setSavingId(seriesId);
    const ok = await onUpdate(seriesId, rule);
    setSavingId(null);
    if (ok) setEditingId(null);
  };

  const handleStop = async (seriesId: string) => {
    setStoppingId(seriesId);
    const ok = await onStop(seriesId);
    setStoppingId(null);
    if (ok) setStoppedIds(prev => new Set(prev).add(seriesId));
  };

  const active = series.filter(s => s.is_active && !stoppedIds.has(s.id));
  const stopped = series.filter(s => !s.is_active || stoppedIds.has(s.id));

  return (
    <div className="kb-archive-drawer-overlay" onMouseDown={onClose}>
      <div className="kb-archive-drawer" onMouseDown={e => e.stopPropagation()}>
        {/* Header */}
        <div className="kb-archive-drawer-header">
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <RefreshCw size={15} style={{ color: '#9ca3af' }} />
            <span style={{ fontWeight: 700, fontSize: 15, color: '#f9fafb' }}>Repeating Cards</span>
            {active.length > 0 && (
              <span className="kb-column-count">{active.length}</span>
            )}
          </div>
          <button className="kb-btn-icon-sm" onClick={onClose}><X size={16} /></button>
        </div>

        {/* List */}
        <div className="kb-archive-list">
          {loading ? (
            <div className="kb-archive-empty">Loading…</div>
          ) : series.length === 0 ? (
            <div className="kb-archive-empty">No repeating cards on this board.</div>
          ) : (
            <>
              {active.map(s => (
                <SeriesRow
                  key={s.id}
                  series={s}
                  isEditing={editingId === s.id}
                  isSaving={savingId === s.id}
                  isStopping={stoppingId === s.id}
                  onEdit={() => setEditingId(s.id)}
                  onCancelEdit={() => setEditingId(null)}
                  onSave={rule => handleSave(s.id, rule)}
                  onStop={() => handleStop(s.id)}
                />
              ))}

              {stopped.length > 0 && (
                <>
                  <div style={{ padding: '10px 16px 4px', fontSize: 11, color: '#4b5563', fontWeight: 600, letterSpacing: '0.05em', textTransform: 'uppercase' }}>
                    Stopped
                  </div>
                  {stopped.map(s => (
                    <SeriesRow
                      key={s.id}
                      series={s}
                      stopped
                      isEditing={false}
                      isSaving={false}
                      isStopping={false}
                      onEdit={() => {}}
                      onCancelEdit={() => {}}
                      onSave={async () => {}}
                      onStop={() => Promise.resolve()}
                    />
                  ))}
                </>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}

function SeriesRow({
  series,
  stopped = false,
  isEditing,
  isSaving,
  isStopping,
  onEdit,
  onCancelEdit,
  onSave,
  onStop,
}: {
  series: RepeatSeriesRow;
  stopped?: boolean;
  isEditing: boolean;
  isSaving: boolean;
  isStopping: boolean;
  onEdit: () => void;
  onCancelEdit: () => void;
  onSave: (rule: RepeatRule) => Promise<void>;
  onStop: () => Promise<void>;
}) {
  const rule = series.repeat_rule;
  const summary = formatRepeatSummary(rule);
  const nextDate = series.cardStartDate
    ? formatNextDate(rule, series.cardStartDate)
    : rule.mode === 'monthly-weekday'
      ? formatNextDate(rule, '')
      : null;

  return (
    <div className="kb-archive-card" style={{ flexDirection: 'column', alignItems: 'stretch', gap: 8 }}>
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12 }}>
        <div className="kb-archive-card-body">
          <div className="kb-archive-card-title" style={{ color: stopped ? '#6b7280' : '#d1d5db' }}>
            {series.cardTitle ?? <span style={{ color: '#4b5563', fontStyle: 'italic' }}>No active cards</span>}
          </div>
          <div className="kb-archive-card-meta">
            <span style={{ color: '#6b7280' }}>{summary}</span>
            {nextDate && !stopped && (
              <span style={{ color: '#4b5563' }}>Next: {nextDate}</span>
            )}
            {stopped && (
              <span style={{ color: '#ef4444', opacity: 0.7 }}>Stopped</span>
            )}
          </div>
        </div>

        {!stopped && (
          <div style={{ display: 'flex', gap: 4, flexShrink: 0 }}>
            <button
              className="kb-btn-icon-sm"
              title="Edit schedule"
              onClick={onEdit}
              style={{ color: isEditing ? '#f97316' : undefined }}
            >
              <Edit2 size={13} />
            </button>
            <button
              className="kb-btn-icon-sm"
              title="Stop repeating"
              disabled={isStopping}
              onClick={onStop}
            >
              {isStopping ? <span style={{ fontSize: 10 }}>…</span> : <Pause size={13} />}
            </button>
          </div>
        )}
      </div>

      {isEditing && (
        <EditForm
          initial={rule}
          saving={isSaving}
          onSave={onSave}
          onCancel={onCancelEdit}
        />
      )}
    </div>
  );
}
