'use client';

import React, { useState } from 'react';
import type { BoardColumn, BoardLabel, ChecklistTemplate, ColumnAutomationAction, CardPriority } from '@/types/board-types';
import type { UserProfile } from '@/types/board-types';
import { X, SlidersHorizontal, User } from '@/components/BoardIcons';
import { PRIORITY_CONFIG } from './helpers';

const ACTION_TYPES: ColumnAutomationAction['type'][] = [
  'set_complete',
  'set_priority',
  'set_assignee',
  'set_labels',
  'add_checklist',
];

const ACTION_LABELS: Record<ColumnAutomationAction['type'], string> = {
  set_complete:  'Mark complete',
  set_priority:  'Set priority',
  set_assignee:  'Assign to',
  set_labels:    'Set labels',
  add_checklist: 'Add checklist',
};

const ACTION_ICONS: Record<ColumnAutomationAction['type'], string> = {
  set_complete:  '✓',
  set_priority:  '↑',
  set_assignee:  '@',
  set_labels:    '⬤',
  add_checklist: '☑',
};

function defaultForType(type: ColumnAutomationAction['type']): ColumnAutomationAction {
  switch (type) {
    case 'set_complete':  return { type: 'set_complete', value: true };
    case 'set_priority':  return { type: 'set_priority', value: null };
    case 'set_assignee':  return { type: 'set_assignee', value: '' };
    case 'set_labels':    return { type: 'set_labels', value: [] };
    case 'add_checklist': return { type: 'add_checklist', value: [] };
  }
}

export default function ColumnAutomationsModal({
  column,
  labels,
  userProfiles,
  checklistTemplates,
  onSave,
  onClose,
}: {
  column: BoardColumn;
  labels: BoardLabel[];
  userProfiles: UserProfile[];
  checklistTemplates: ChecklistTemplate[];
  onSave: (automations: ColumnAutomationAction[]) => Promise<void>;
  onClose: () => void;
}) {
  const [actions, setActions] = useState<ColumnAutomationAction[]>(column.automations ?? []);
  const [saving, setSaving] = useState(false);

  function getAction(type: ColumnAutomationAction['type']): ColumnAutomationAction | undefined {
    return actions.find(a => a.type === type);
  }

  function toggleAction(type: ColumnAutomationAction['type']) {
    if (getAction(type)) {
      setActions(prev => prev.filter(a => a.type !== type));
    } else {
      setActions(prev => [...prev, defaultForType(type)]);
    }
  }

  function updateAction(updated: ColumnAutomationAction) {
    setActions(prev => prev.map(a => a.type === updated.type ? updated : a));
  }

  async function handleSave() {
    setSaving(true);
    await onSave(actions);
    setSaving(false);
    onClose();
  }

  function renderValueEditor(action: ColumnAutomationAction): React.ReactNode {
    switch (action.type) {
      case 'set_complete':
        return (
          <div style={{ display: 'flex', gap: 4 }}>
            {[
              { val: true, label: 'Complete', color: '#22c55e', bg: 'rgba(34,197,94,0.15)' },
              { val: false, label: 'Incomplete', color: '#6b7280', bg: 'rgba(107,114,128,0.15)' },
            ].map(({ val, label, color, bg }) => (
              <button
                key={String(val)}
                onClick={() => updateAction({ type: 'set_complete', value: val })}
                style={{
                  fontSize: 11, fontWeight: 600, padding: '3px 9px', borderRadius: 5, cursor: 'pointer',
                  background: action.value === val ? bg : 'transparent',
                  color: action.value === val ? color : '#6b7280',
                  border: `1px solid ${action.value === val ? color + '66' : '#374151'}`,
                  transition: 'all 0.1s',
                }}
              >
                {label}
              </button>
            ))}
          </div>
        );

      case 'set_priority':
        return (
          <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
            {[
              { val: null, label: 'None', color: '#6b7280', bg: 'rgba(107,114,128,0.15)' },
              ...(Object.keys(PRIORITY_CONFIG) as CardPriority[]).map(p => ({
                val: p as CardPriority | null,
                label: PRIORITY_CONFIG[p].label,
                color: PRIORITY_CONFIG[p].color,
                bg: PRIORITY_CONFIG[p].bg,
              })),
            ].map(({ val, label, color, bg }) => (
              <button
                key={String(val)}
                onClick={() => updateAction({ type: 'set_priority', value: val })}
                style={{
                  fontSize: 11, fontWeight: 600, padding: '3px 9px', borderRadius: 5, cursor: 'pointer',
                  background: action.value === val ? bg : 'transparent',
                  color: action.value === val ? color : '#6b7280',
                  border: `1px solid ${action.value === val ? color + '66' : '#374151'}`,
                  transition: 'all 0.1s',
                }}
              >
                {label}
              </button>
            ))}
          </div>
        );

      case 'set_assignee':
        return userProfiles.length > 0 ? (
          <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
            {userProfiles.filter(u => u.name || u.id).map(u => (
              <button
                key={u.id}
                onClick={() => updateAction({ type: 'set_assignee', value: action.value === (u.name || u.id) ? '' : (u.name || u.id) })}
                style={{
                  display: 'inline-flex', alignItems: 'center', gap: 4,
                  fontSize: 11, padding: '3px 9px', borderRadius: 5, cursor: 'pointer',
                  background: action.value === (u.name || u.id) ? '#1f2937' : 'transparent',
                  color: action.value === (u.name || u.id) ? '#d1d5db' : '#6b7280',
                  border: `1px solid ${action.value === (u.name || u.id) ? '#4b5563' : '#374151'}`,
                  transition: 'all 0.1s',
                }}
              >
                <User size={10} />@{u.name || u.id}
              </button>
            ))}
          </div>
        ) : (
          <input
            className="kb-automation-input"
            placeholder="Username"
            value={action.value}
            onChange={e => updateAction({ type: 'set_assignee', value: e.target.value })}
          />
        );

      case 'set_labels':
        return (
          <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
            {labels.map(l => {
              const selected = action.value.includes(l.id);
              return (
                <button
                  key={l.id}
                  onClick={() => updateAction({
                    type: 'set_labels',
                    value: selected ? action.value.filter(id => id !== l.id) : [...action.value, l.id],
                  })}
                  style={{
                    fontSize: 11, fontWeight: 600, padding: '3px 9px', borderRadius: 5, cursor: 'pointer',
                    background: selected ? l.color : 'transparent',
                    color: selected ? '#fff' : l.color,
                    border: `1px solid ${l.color}${selected ? '' : '66'}`,
                    transition: 'all 0.1s',
                  }}
                >
                  {l.name}
                </button>
              );
            })}
            {labels.length === 0 && <span style={{ fontSize: 11, color: '#4b5563' }}>No labels on this board</span>}
          </div>
        );

      case 'add_checklist':
        return (
          <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
            {checklistTemplates.map(t => {
              const selected = action.value.includes(t.id);
              return (
                <button
                  key={t.id}
                  onClick={() => updateAction({
                    type: 'add_checklist',
                    value: selected ? action.value.filter(id => id !== t.id) : [...action.value, t.id],
                  })}
                  style={{
                    fontSize: 11, padding: '3px 9px', borderRadius: 5, cursor: 'pointer',
                    background: selected ? '#1f2937' : 'transparent',
                    color: selected ? '#e5e7eb' : '#6b7280',
                    border: `1px solid ${selected ? '#4b5563' : '#374151'}`,
                    transition: 'all 0.1s',
                  }}
                >
                  {t.name}
                </button>
              );
            })}
            {checklistTemplates.length === 0 && <span style={{ fontSize: 11, color: '#4b5563' }}>No saved checklists yet</span>}
          </div>
        );
    }
  }

  return (
    <div className="kb-modal-overlay" onClick={onClose}>
      <div className="kb-modal" style={{ maxWidth: 460 }} onClick={e => e.stopPropagation()}>
        <div className="kb-modal-header">
          <SlidersHorizontal size={15} />
          <span>Automations — {column.title}</span>
          <button className="kb-modal-close" onClick={onClose}><X size={16} /></button>
        </div>

        <div className="kb-modal-body">
          <p className="kb-automation-hint">When a card is moved into this list, automatically:</p>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {ACTION_TYPES.map(type => {
              const action = getAction(type);
              const enabled = !!action;

              return (
                <div
                  key={type}
                  style={{
                    background: enabled ? '#0d1117' : '#0a0c11',
                    border: `1px solid ${enabled ? '#2d3748' : '#161922'}`,
                    borderRadius: 8,
                    padding: '10px 12px',
                    transition: 'all 0.15s',
                  }}
                >
                  <label style={{
                    display: 'flex', alignItems: 'center', gap: 10,
                    cursor: 'pointer', userSelect: 'none',
                  }}>
                    <input
                      type="checkbox"
                      checked={enabled}
                      onChange={() => toggleAction(type)}
                      style={{ accentColor: '#818cf8', width: 14, height: 14, cursor: 'pointer' }}
                    />
                    <span style={{
                      display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
                      width: 20, height: 20, borderRadius: 4, fontSize: 11, fontWeight: 700,
                      background: enabled ? '#1e2130' : '#111318',
                      color: enabled ? '#818cf8' : '#374151',
                      border: `1px solid ${enabled ? '#374151' : '#1e2130'}`,
                      flexShrink: 0,
                    }}>
                      {ACTION_ICONS[type]}
                    </span>
                    <span style={{ fontSize: 13, color: enabled ? '#e5e7eb' : '#4b5563', fontWeight: enabled ? 500 : 400 }}>
                      {ACTION_LABELS[type]}
                    </span>
                  </label>

                  {enabled && action && (
                    <div style={{
                      marginTop: 10, paddingTop: 10,
                      borderTop: '1px solid #2a2d3a',
                    }}>
                      {renderValueEditor(action)}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>

        <div className="kb-modal-footer">
          <button className="kb-btn-secondary" onClick={onClose}>Cancel</button>
          <button className="kb-btn-primary" onClick={handleSave} disabled={saving}>
            {saving ? 'Saving…' : 'Save'}
          </button>
        </div>
      </div>
    </div>
  );
}
