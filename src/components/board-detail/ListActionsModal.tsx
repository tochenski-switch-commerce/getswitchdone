'use client';

import { useState } from 'react';
import type { BoardCard, BoardColumn, CardPriority, ChecklistTemplate, UserProfile } from '@/types/board-types';
import type { FullBoard } from '@/hooks/useProjectBoard';
import {
  CalendarDays, User, Flag, Tag, ArrowDownAZ,
  CheckSquare, FolderKanban, Trash2, X, Zap, Check, Target,
} from '@/components/BoardIcons';
import DatePickerInput from '@/components/DatePickerInput';
import { PRIORITY_CONFIG } from './helpers';

export default function ListActionsModal({
  column,
  cards,
  board,
  onUpdateCard,
  onDeleteCard,
  onMoveCard,
  onAddChecklistItem,
  checklistTemplates,
  onApplyTemplate,
  onSortCards,
  onUpdateColumn,
  onClose,
  userProfiles,
}: {
  column: BoardColumn;
  cards: BoardCard[];
  board: FullBoard;
  onUpdateCard: (cardId: string, updates: any) => Promise<void>;
  onDeleteCard: (cardId: string) => Promise<void>;
  onMoveCard: (cardId: string, newColumnId: string) => Promise<void>;
  onAddChecklistItem: (cardId: string, title: string) => Promise<void>;
  checklistTemplates: ChecklistTemplate[];
  onApplyTemplate: (cardId: string, templateId: string) => Promise<void>;
  onSortCards: (columnId: string, direction: 'asc' | 'desc') => Promise<void>;
  onUpdateColumn: (updates: { card_limit?: number | null }) => Promise<void>;
  onClose: () => void;
  userProfiles: UserProfile[];
}) {
  const [bulkDueDate, setBulkDueDate] = useState('');
  const [bulkAssignee, setBulkAssignee] = useState('');
  const [bulkPriority, setBulkPriority] = useState('');
  const [bulkLabel, setBulkLabel] = useState('');
  const [bulkMoveCol, setBulkMoveCol] = useState('');
  const [bulkChecklistItem, setBulkChecklistItem] = useState('');
  const [bulkTemplate, setBulkTemplate] = useState('');
  const [applying, setApplying] = useState(false);
  const [result, setResult] = useState('');
  const [limitInput, setLimitInput] = useState(column.card_limit != null ? String(column.card_limit) : '');
  const [savingLimit, setSavingLimit] = useState(false);

  const otherColumns = board.columns.filter(c => c.id !== column.id);

  const apply = async (label: string, fn: () => Promise<void>) => {
    setApplying(true);
    setResult('');
    try {
      await fn();
      setResult(`${label} applied to ${cards.length} card${cards.length !== 1 ? 's' : ''}`);
    } catch {
      setResult('Something went wrong');
    } finally {
      setApplying(false);
    }
  };

  return (
    <div className="kb-modal-overlay" onMouseDown={onClose}>
      <div className="kb-list-actions-modal" onMouseDown={e => e.stopPropagation()}>
        {/* Header */}
        <div className="kb-import-header">
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <span className="kb-column-dot" style={{ background: column.color }} />
            <h3 className="kb-import-title">List Actions — {column.title}</h3>
            <span className="kb-column-count">{cards.length} cards</span>
          </div>
          <button className="kb-btn-icon-sm" onClick={onClose}><X size={16} /></button>
        </div>

        <div className="kb-list-actions-body">
          {/* Card Limit */}
          <div className="kb-list-action-row">
            <div className="kb-list-action-label"><Target size={13} /> Card Limit</div>
            <div className="kb-list-action-controls">
              <input
                className="kb-input"
                type="number"
                min={1}
                value={limitInput}
                onChange={e => setLimitInput(e.target.value)}
                placeholder="No limit"
                style={{ flex: 1, maxWidth: 90 }}
              />
              <button
                className="kb-btn kb-btn-primary kb-btn-sm"
                disabled={savingLimit}
                onClick={async () => {
                  setSavingLimit(true);
                  const val = limitInput.trim() === '' ? null : parseInt(limitInput, 10);
                  await onUpdateColumn({ card_limit: val });
                  setSavingLimit(false);
                }}
              >
                Save
              </button>
              {column.card_limit != null && (
                <button
                  className="kb-btn kb-btn-sm"
                  style={{ background: '#1f2937', color: '#9ca3af', border: '1px solid #374151' }}
                  disabled={savingLimit}
                  onClick={async () => {
                    setSavingLimit(true);
                    setLimitInput('');
                    await onUpdateColumn({ card_limit: null });
                    setSavingLimit(false);
                  }}
                >
                  Remove
                </button>
              )}
            </div>
          </div>

          {cards.length === 0 ? (
            <div className="kb-import-empty">No cards in this list</div>
          ) : (
            <>
              {/* Set Due Date */}
              <div className="kb-list-action-row">
                <div className="kb-list-action-label"><CalendarDays size={13} /> Set Due Date</div>
                <div className="kb-list-action-controls">
                  <DatePickerInput
                    className="kb-input"
                    value={bulkDueDate}
                    onChange={setBulkDueDate}
                    style={{ flex: 1 }}
                    placeholder="Select due date…"
                  />
                  <button
                    className="kb-btn kb-btn-primary kb-btn-sm"
                    disabled={!bulkDueDate || applying}
                    onClick={() => apply('Due date', async () => {
                      for (const card of cards) await onUpdateCard(card.id, { due_date: bulkDueDate });
                    })}
                  >
                    Apply
                  </button>
                </div>
              </div>

              {/* Set Assignee */}
              <div className="kb-list-action-row">
                <div className="kb-list-action-label"><User size={13} /> Set Assignee</div>
                <div className="kb-list-action-controls" style={{ flexDirection: 'column', alignItems: 'flex-start', gap: 8 }}>
                  <div style={{ display: 'flex', gap: 5, flexWrap: 'wrap' }}>
                    {userProfiles.filter(p => p.name).map(p => (
                      <button
                        key={p.id}
                        onClick={() => setBulkAssignee(bulkAssignee === p.name ? '' : p.name)}
                        style={{
                          display: 'inline-flex', alignItems: 'center', gap: 4,
                          fontSize: 11, padding: '4px 9px', borderRadius: 5, cursor: 'pointer',
                          background: bulkAssignee === p.name ? '#1f2937' : 'transparent',
                          color: bulkAssignee === p.name ? '#d1d5db' : '#6b7280',
                          border: `1px solid ${bulkAssignee === p.name ? '#4b5563' : '#374151'}`,
                          transition: 'all 0.1s',
                        }}
                      >
                        <User size={10} />@{p.name}
                      </button>
                    ))}
                    {userProfiles.filter(p => p.name).length === 0 && (
                      <span style={{ fontSize: 11, color: '#4b5563' }}>No team members</span>
                    )}
                  </div>
                  <button
                    className="kb-btn kb-btn-primary kb-btn-sm"
                    disabled={!bulkAssignee.trim() || applying}
                    onClick={() => apply('Assignee', async () => {
                      for (const card of cards) await onUpdateCard(card.id, { assignee: bulkAssignee.trim() });
                    })}
                  >
                    Apply
                  </button>
                </div>
              </div>

              {/* Set Priority */}
              <div className="kb-list-action-row">
                <div className="kb-list-action-label"><Flag size={13} /> Set Priority</div>
                <div className="kb-list-action-controls" style={{ flexDirection: 'column', alignItems: 'flex-start', gap: 8 }}>
                  <div style={{ display: 'flex', gap: 5, flexWrap: 'wrap' }}>
                    {([
                      { val: 'none', label: 'None', color: '#6b7280', bg: 'rgba(107,114,128,0.12)' },
                      ...(Object.keys(PRIORITY_CONFIG) as CardPriority[]).map(p => ({
                        val: p,
                        label: PRIORITY_CONFIG[p].label,
                        color: PRIORITY_CONFIG[p].color,
                        bg: PRIORITY_CONFIG[p].bg,
                      })),
                    ]).map(({ val, label, color, bg }) => (
                      <button
                        key={val}
                        onClick={() => setBulkPriority(bulkPriority === val ? '' : val)}
                        style={{
                          fontSize: 11, fontWeight: 600, padding: '4px 9px', borderRadius: 5, cursor: 'pointer',
                          background: bulkPriority === val ? bg : 'transparent',
                          color: bulkPriority === val ? color : '#6b7280',
                          border: `1px solid ${bulkPriority === val ? color + '66' : '#374151'}`,
                          transition: 'all 0.1s',
                        }}
                      >
                        {label}
                      </button>
                    ))}
                  </div>
                  <button
                    className="kb-btn kb-btn-primary kb-btn-sm"
                    disabled={!bulkPriority || applying}
                    onClick={() => apply('Priority', async () => {
                      const val = bulkPriority === 'none' ? null : bulkPriority;
                      for (const card of cards) await onUpdateCard(card.id, { priority: val });
                    })}
                  >
                    Apply
                  </button>
                </div>
              </div>

              {/* Add Label */}
              {board.labels.length > 0 && (
                <div className="kb-list-action-row">
                  <div className="kb-list-action-label"><Tag size={13} /> Add Label</div>
                  <div className="kb-list-action-controls" style={{ flexDirection: 'column', alignItems: 'flex-start', gap: 8 }}>
                    <div style={{ display: 'flex', gap: 5, flexWrap: 'wrap' }}>
                      {board.labels.map(l => (
                        <button
                          key={l.id}
                          onClick={() => setBulkLabel(bulkLabel === l.id ? '' : l.id)}
                          style={{
                            fontSize: 11, fontWeight: 600, padding: '4px 9px', borderRadius: 5, cursor: 'pointer',
                            background: bulkLabel === l.id ? l.color : 'transparent',
                            color: bulkLabel === l.id ? '#fff' : l.color,
                            border: `1px solid ${l.color}${bulkLabel === l.id ? '' : '66'}`,
                            transition: 'all 0.1s',
                          }}
                        >
                          {l.name}
                        </button>
                      ))}
                    </div>
                    <button
                      className="kb-btn kb-btn-primary kb-btn-sm"
                      disabled={!bulkLabel || applying}
                      onClick={() => apply('Label', async () => {
                        for (const card of cards) {
                          const existing = (card.labels || []).map(l => l.id);
                          if (!existing.includes(bulkLabel)) {
                            await onUpdateCard(card.id, { label_ids: [...existing, bulkLabel] });
                          }
                        }
                      })}
                    >
                      Apply
                    </button>
                  </div>
                </div>
              )}

              {/* Sort A-Z / Z-A */}
              <div className="kb-list-action-row">
                <div className="kb-list-action-label"><ArrowDownAZ size={13} /> Sort Cards</div>
                <div className="kb-list-action-controls">
                  <button
                    className="kb-btn kb-btn-primary kb-btn-sm"
                    disabled={applying}
                    onClick={() => apply('Sort A→Z', async () => { await onSortCards(column.id, 'asc'); })}
                  >
                    A → Z
                  </button>
                  <button
                    className="kb-btn kb-btn-primary kb-btn-sm"
                    disabled={applying}
                    onClick={() => apply('Sort Z→A', async () => { await onSortCards(column.id, 'desc'); })}
                  >
                    Z → A
                  </button>
                </div>
              </div>

              {/* Mark as Complete */}
              <div className="kb-list-action-row">
                <div className="kb-list-action-label"><Check size={13} /> Mark as Complete</div>
                <div className="kb-list-action-controls">
                  <button
                    className="kb-btn kb-btn-primary kb-btn-sm"
                    disabled={applying}
                    onClick={() => apply('Marked complete', async () => {
                      for (const card of cards) await onUpdateCard(card.id, { is_complete: true });
                    })}
                  >
                    Mark All Complete
                  </button>
                  <button
                    className="kb-btn kb-btn-sm"
                    style={{ background: '#1f2937', color: '#9ca3af', border: '1px solid #374151' }}
                    disabled={applying}
                    onClick={() => apply('Marked incomplete', async () => {
                      for (const card of cards) await onUpdateCard(card.id, { is_complete: false });
                    })}
                  >
                    Mark All Incomplete
                  </button>
                </div>
              </div>

              {/* Add Checklist Item */}
              <div className="kb-list-action-row">
                <div className="kb-list-action-label"><CheckSquare size={13} /> Add Checklist Item</div>
                <div className="kb-list-action-controls">
                  <input
                    className="kb-input"
                    value={bulkChecklistItem}
                    onChange={e => setBulkChecklistItem(e.target.value)}
                    placeholder="Checklist item text..."
                    style={{ flex: 1 }}
                  />
                  <button
                    className="kb-btn kb-btn-primary kb-btn-sm"
                    disabled={!bulkChecklistItem.trim() || applying}
                    onClick={() => apply('Checklist item', async () => {
                      for (const card of cards) await onAddChecklistItem(card.id, bulkChecklistItem.trim());
                    })}
                  >
                    Apply
                  </button>
                </div>
              </div>

              {/* Apply Checklist Template */}
              {checklistTemplates.length > 0 && (
                <div className="kb-list-action-row">
                  <div className="kb-list-action-label"><CheckSquare size={13} /> Apply Checklist Template</div>
                  <div className="kb-list-action-controls">
                    <select className="kb-input kb-import-select" value={bulkTemplate} onChange={e => setBulkTemplate(e.target.value)} style={{ flex: 1 }}>
                      <option value="">Choose a template...</option>
                      {checklistTemplates.map(t => (
                        <option key={t.id} value={t.id}>{t.name} ({t.items.length} items)</option>
                      ))}
                    </select>
                    <button
                      className="kb-btn kb-btn-primary kb-btn-sm"
                      disabled={!bulkTemplate || applying}
                      onClick={() => apply('Checklist template', async () => {
                        for (const card of cards) await onApplyTemplate(card.id, bulkTemplate);
                      })}
                    >
                      Apply
                    </button>
                  </div>
                </div>
              )}

              {/* Move All Cards */}
              {otherColumns.length > 0 && (
                <div className="kb-list-action-row">
                  <div className="kb-list-action-label"><FolderKanban size={13} /> Move All Cards</div>
                  <div className="kb-list-action-controls" style={{ flexDirection: 'column', alignItems: 'flex-start', gap: 8 }}>
                    <div style={{ display: 'flex', gap: 5, flexWrap: 'wrap' }}>
                      {otherColumns.map(c => (
                        <button
                          key={c.id}
                          onClick={() => setBulkMoveCol(bulkMoveCol === c.id ? '' : c.id)}
                          style={{
                            display: 'inline-flex', alignItems: 'center', gap: 5,
                            fontSize: 11, padding: '4px 9px', borderRadius: 5, cursor: 'pointer',
                            background: bulkMoveCol === c.id ? '#1f2937' : 'transparent',
                            color: bulkMoveCol === c.id ? '#e5e7eb' : '#6b7280',
                            border: `1px solid ${bulkMoveCol === c.id ? '#374151' : '#374151'}`,
                            transition: 'all 0.1s',
                          }}
                        >
                          <span style={{
                            width: 7, height: 7, borderRadius: '50%',
                            background: c.color, flexShrink: 0,
                          }} />
                          {c.title}
                        </button>
                      ))}
                    </div>
                    <button
                      className="kb-btn kb-btn-primary kb-btn-sm"
                      disabled={!bulkMoveCol || applying}
                      onClick={() => apply('Move', async () => {
                        for (const card of cards) await onMoveCard(card.id, bulkMoveCol);
                      })}
                    >
                      Move
                    </button>
                  </div>
                </div>
              )}

              {/* Clear All */}
              <div className="kb-list-action-row kb-list-action-danger">
                <div className="kb-list-action-label"><Trash2 size={13} /> Clear All Cards</div>
                <div className="kb-list-action-controls">
                  <button
                    className="kb-btn kb-btn-sm kb-btn-danger"
                    disabled={applying}
                    onClick={() => {
                      if (!confirm(`Delete all ${cards.length} cards from "${column.title}"? This cannot be undone.`)) return;
                      apply('Clear', async () => {
                        for (const card of cards) await onDeleteCard(card.id);
                      });
                    }}
                  >
                    Delete {cards.length} Card{cards.length !== 1 ? 's' : ''}
                  </button>
                </div>
              </div>
            </>
          )}

          {/* Result feedback */}
          {result && <div className="kb-list-action-result">{result}</div>}
        </div>
      </div>
    </div>
  );
}
