'use client';

import { useState } from 'react';
import type { BoardColumn, BoardLabel, ChecklistTemplate, ColumnAutomationAction, CardPriority } from '@/types/board-types';
import type { UserProfile } from '@/types/board-types';
import { X, Trash2, Plus, SlidersHorizontal } from '@/components/BoardIcons';
import { PRIORITY_CONFIG } from './helpers';

const ACTION_LABELS: Record<ColumnAutomationAction['type'], string> = {
  set_complete:  'Mark complete',
  set_priority:  'Set priority',
  set_assignee:  'Assign to',
  set_labels:    'Set labels',
  add_checklist: 'Add checklist',
};

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
  const [newType, setNewType] = useState<ColumnAutomationAction['type']>('set_complete');
  const [newValue, setNewValue] = useState<string>('true');
  const [saving, setSaving] = useState(false);

  function buildAction(): ColumnAutomationAction | null {
    switch (newType) {
      case 'set_complete':
        return { type: 'set_complete', value: newValue === 'true' };
      case 'set_priority':
        return { type: 'set_priority', value: (newValue || null) as CardPriority | null };
      case 'set_assignee':
        return { type: 'set_assignee', value: newValue };
      case 'set_labels':
        return { type: 'set_labels', value: newValue ? newValue.split(',') : [] };
      case 'add_checklist':
        return { type: 'add_checklist', value: newValue ? newValue.split(',') : [] };
    }
  }

  function addAction() {
    const action = buildAction();
    if (!action) return;
    // replace existing action of same type
    setActions(prev => [...prev.filter(a => a.type !== newType), action]);
    setNewValue('true');
  }

  function removeAction(type: ColumnAutomationAction['type']) {
    setActions(prev => prev.filter(a => a.type !== type));
  }

  async function handleSave() {
    setSaving(true);
    await onSave(actions);
    setSaving(false);
    onClose();
  }

  function renderActionValue(action: ColumnAutomationAction) {
    switch (action.type) {
      case 'set_complete':
        return action.value ? 'Complete' : 'Incomplete';
      case 'set_priority':
        return action.value ? PRIORITY_CONFIG[action.value].label : 'None';
      case 'set_assignee':
        return action.value ? `@${action.value}` : '—';
      case 'set_labels': {
        if (!action.value.length) return 'Clear all';
        return action.value.map(id => labels.find(l => l.id === id)?.name ?? id).join(', ');
      }
      case 'add_checklist': {
        if (!action.value.length) return '—';
        return action.value.map(id => checklistTemplates.find(t => t.id === id)?.name ?? id).join(', ');
      }
    }
  }

  function toggleChip(id: string) {
    const ids = newValue.split(',').filter(Boolean);
    const next = ids.includes(id) ? ids.filter(x => x !== id) : [...ids, id];
    setNewValue(next.join(','));
  }

  function renderValueInput() {
    switch (newType) {
      case 'set_complete':
        return (
          <select className="kb-automation-select" value={newValue} onChange={e => setNewValue(e.target.value)}>
            <option value="true">Complete</option>
            <option value="false">Incomplete</option>
          </select>
        );
      case 'set_priority':
        return (
          <select className="kb-automation-select" value={newValue} onChange={e => setNewValue(e.target.value)}>
            <option value="">No priority</option>
            {(Object.keys(PRIORITY_CONFIG) as CardPriority[]).map(p => (
              <option key={p} value={p}>{PRIORITY_CONFIG[p].label}</option>
            ))}
          </select>
        );
      case 'set_assignee':
        return userProfiles.length > 0 ? (
          <select className="kb-automation-select" value={newValue} onChange={e => setNewValue(e.target.value)}>
            <option value="">Unassigned</option>
            {userProfiles.map(u => (
              <option key={u.id} value={u.name}>{u.name}</option>
            ))}
          </select>
        ) : (
          <input
            className="kb-automation-input"
            placeholder="Username"
            value={newValue}
            onChange={e => setNewValue(e.target.value)}
          />
        );
      case 'set_labels':
        return (
          <div className="kb-automation-chips">
            {labels.map(l => {
              const selected = newValue.split(',').filter(Boolean).includes(l.id);
              return (
                <button
                  key={l.id}
                  className={`kb-automation-chip ${selected ? 'selected' : ''}`}
                  style={{ borderColor: l.color, background: selected ? l.color : 'transparent', color: selected ? '#fff' : l.color }}
                  onClick={() => toggleChip(l.id)}
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
          <div className="kb-automation-chips">
            {checklistTemplates.map(t => {
              const selected = newValue.split(',').filter(Boolean).includes(t.id);
              return (
                <button
                  key={t.id}
                  className={`kb-automation-chip ${selected ? 'selected' : ''}`}
                  onClick={() => toggleChip(t.id)}
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
      <div className="kb-modal" style={{ maxWidth: 440 }} onClick={e => e.stopPropagation()}>
        <div className="kb-modal-header">
          <SlidersHorizontal size={15} />
          <span>Automations — {column.title}</span>
          <button className="kb-modal-close" onClick={onClose}><X size={16} /></button>
        </div>

        <div className="kb-modal-body">
          <p className="kb-automation-hint">When a card is moved into this list, automatically:</p>

          {actions.length === 0 && (
            <p className="kb-automation-empty">No automations yet.</p>
          )}
          <ul className="kb-automation-list">
            {actions.map(action => (
              <li key={action.type} className="kb-automation-item">
                <span className="kb-automation-type">{ACTION_LABELS[action.type]}</span>
                <span className="kb-automation-value">→ {renderActionValue(action)}</span>
                <button className="kb-automation-remove" onClick={() => removeAction(action.type)}>
                  <Trash2 size={12} />
                </button>
              </li>
            ))}
          </ul>

          {/* Add new action */}
          <div className="kb-automation-add">
            <select
              className="kb-automation-select"
              value={newType}
              onChange={e => { setNewType(e.target.value as ColumnAutomationAction['type']); setNewValue('true'); }}
            >
              {(Object.keys(ACTION_LABELS) as ColumnAutomationAction['type'][]).map(t => (
                <option key={t} value={t}>{ACTION_LABELS[t]}</option>
              ))}
            </select>
            {renderValueInput()}
            <button className="kb-btn-icon-sm" onClick={addAction} title="Add automation">
              <Plus size={14} />
            </button>
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
