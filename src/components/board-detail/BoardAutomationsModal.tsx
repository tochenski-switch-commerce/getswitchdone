'use client';

import { useState } from 'react';
import { X, Zap } from '@/components/BoardIcons';
import type {
  BoardColumn,
  BoardAutomationRule,
  BoardAutomationTrigger,
  BoardAutomationAction,
} from '@/types/board-types';

const TRIGGER_ICONS: Record<BoardAutomationTrigger, string> = {
  card_completed:     '✓',
  assignee_added:     '@',
  start_date_arrived: '▶',
  due_date_overdue:   '!',
};

const TRIGGER_LABELS: Record<BoardAutomationTrigger, string> = {
  card_completed:     'Card is marked complete',
  assignee_added:     'Assignee is added to card',
  start_date_arrived: 'Start date arrives',
  due_date_overdue:   'Due date is today or overdue',
};

const TRIGGERS: BoardAutomationTrigger[] = [
  'card_completed',
  'assignee_added',
  'start_date_arrived',
  'due_date_overdue',
];

export default function BoardAutomationsModal({
  automations: initialAutomations,
  columns,
  onSave,
  onClose,
}: {
  automations: BoardAutomationRule[];
  columns: BoardColumn[];
  onSave: (automations: BoardAutomationRule[]) => Promise<void>;
  onClose: () => void;
}) {
  const [rules, setRules] = useState<BoardAutomationRule[]>(initialAutomations);
  const [saving, setSaving] = useState(false);

  const normalColumns = columns.filter(c => c.column_type !== 'board_links');

  function getRuleForTrigger(trigger: BoardAutomationTrigger): BoardAutomationRule | undefined {
    return rules.find(r => r.trigger === trigger);
  }

  function defaultActionForTrigger(trigger: BoardAutomationTrigger): BoardAutomationAction {
    if (trigger === 'due_date_overdue') {
      return { type: 'move_to_top' };
    }
    return normalColumns.length > 0
      ? { type: 'move_to_column', column_id: normalColumns[0].id }
      : { type: 'move_to_top' };
  }

  function toggleTrigger(trigger: BoardAutomationTrigger) {
    const existing = getRuleForTrigger(trigger);
    if (existing) {
      setRules(prev => prev.filter(r => r.trigger !== trigger));
    } else {
      setRules(prev => [...prev, {
        id: Date.now().toString(36),
        trigger,
        action: defaultActionForTrigger(trigger),
        enabled: true,
      }]);
    }
  }

  function updateAction(trigger: BoardAutomationTrigger, action: BoardAutomationAction) {
    setRules(prev => prev.map(r => r.trigger === trigger ? { ...r, action } : r));
  }

  async function handleSave() {
    setSaving(true);
    await onSave(rules);
    setSaving(false);
    onClose();
  }

  return (
    <div className="kb-modal-overlay" onClick={onClose}>
      <div className="kb-modal" style={{ maxWidth: 480 }} onClick={e => e.stopPropagation()}>
        <div className="kb-modal-header">
          <Zap size={15} />
          <span>Board Automations</span>
          <button className="kb-modal-close" onClick={onClose}><X size={16} /></button>
        </div>

        <div className="kb-modal-body">
          <p className="kb-automation-hint">
            Automatically move cards when certain events happen on this board.
          </p>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {TRIGGERS.map(trigger => {
              const rule = getRuleForTrigger(trigger);
              const enabled = !!rule;

              return (
                <div
                  key={trigger}
                  style={{
                    background: enabled ? '#0d1117' : '#0a0c11',
                    border: `1px solid ${enabled ? '#2d3748' : '#161922'}`,
                    borderRadius: 8,
                    padding: '10px 12px',
                    transition: 'all 0.15s',
                  }}
                >
                  {/* Trigger row */}
                  <label style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 10,
                    cursor: 'pointer',
                    userSelect: 'none',
                  }}>
                    <input
                      type="checkbox"
                      checked={enabled}
                      onChange={() => toggleTrigger(trigger)}
                      style={{ accentColor: '#818cf8', width: 14, height: 14, cursor: 'pointer' }}
                    />
                    <span style={{
                      display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
                      width: 20, height: 20, borderRadius: 4, fontSize: 10, fontWeight: 700,
                      background: enabled ? '#1e2130' : '#111318',
                      color: enabled ? '#818cf8' : '#374151',
                      border: `1px solid ${enabled ? '#374151' : '#1e2130'}`,
                      flexShrink: 0,
                    }}>
                      {TRIGGER_ICONS[trigger]}
                    </span>
                    <span style={{ fontSize: 13, color: enabled ? '#e5e7eb' : '#4b5563', fontWeight: enabled ? 500 : 400 }}>
                      {TRIGGER_LABELS[trigger]}
                    </span>
                  </label>

                  {/* Action config */}
                  {enabled && rule && (
                    <div style={{
                      marginTop: 10,
                      paddingTop: 10,
                      borderTop: '1px solid #2a2d3a',
                    }}>
                      {/* Action type toggle */}
                      <div style={{ display: 'flex', gap: 6, marginBottom: 8 }}>
                        <span style={{ fontSize: 11, color: '#6b7280', alignSelf: 'center', marginRight: 2 }}>Then</span>
                        {([
                          { type: 'move_to_column', label: 'Move to list' },
                          { type: 'move_to_top', label: 'Move to top' },
                        ] as { type: BoardAutomationAction['type']; label: string }[]).map(opt => (
                          <button
                            key={opt.type}
                            onClick={() => {
                              if (opt.type === 'move_to_top') {
                                updateAction(trigger, { type: 'move_to_top' });
                              } else {
                                updateAction(trigger, {
                                  type: 'move_to_column',
                                  column_id: normalColumns[0]?.id ?? '',
                                });
                              }
                            }}
                            style={{
                              fontSize: 11, padding: '3px 10px', borderRadius: 5, cursor: 'pointer',
                              background: rule.action.type === opt.type ? '#374151' : 'transparent',
                              color: rule.action.type === opt.type ? '#e5e7eb' : '#6b7280',
                              border: `1px solid ${rule.action.type === opt.type ? '#4b5563' : '#1e2130'}`,
                              transition: 'all 0.1s',
                            }}
                          >
                            {opt.label}
                          </button>
                        ))}
                      </div>

                      {/* Column picker */}
                      {rule.action.type === 'move_to_column' && normalColumns.length > 0 && (
                        <div style={{ display: 'flex', gap: 5, flexWrap: 'wrap' }}>
                          {normalColumns.map(col => {
                            const selected = rule.action.type === 'move_to_column' && rule.action.column_id === col.id;
                            return (
                              <button
                                key={col.id}
                                onClick={() => updateAction(trigger, { type: 'move_to_column', column_id: col.id })}
                                style={{
                                  display: 'inline-flex', alignItems: 'center', gap: 5,
                                  fontSize: 11, padding: '3px 9px', borderRadius: 5, cursor: 'pointer',
                                  background: selected ? '#1f2937' : 'transparent',
                                  color: selected ? '#e5e7eb' : '#6b7280',
                                  border: `1px solid ${selected ? '#374151' : '#1e2130'}`,
                                  transition: 'all 0.1s',
                                }}
                              >
                                <span style={{
                                  width: 7, height: 7, borderRadius: '50%',
                                  background: col.color, flexShrink: 0,
                                }} />
                                {col.title}
                              </button>
                            );
                          })}
                        </div>
                      )}
                      {rule.action.type === 'move_to_column' && normalColumns.length === 0 && (
                        <span style={{ fontSize: 11, color: '#4b5563' }}>No lists available</span>
                      )}
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
