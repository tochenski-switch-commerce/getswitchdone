'use client';

import { useState } from 'react';
import type { BoardCard, BoardColumn, CardPriority, ChecklistTemplate, UserProfile } from '@/types/board-types';
import type { FullBoard } from '@/hooks/useProjectBoard';
import {
  CalendarDays, User, Flag, Tag, ArrowDownAZ,
  CheckSquare, FolderKanban, Trash2, X, Zap, Check,
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
                <div className="kb-list-action-controls">
                  <select
                    className="kb-input"
                    value={bulkAssignee}
                    onChange={e => setBulkAssignee(e.target.value)}
                    style={{ flex: 1 }}
                  >
                    <option value="">Choose a user...</option>
                    {userProfiles.filter(p => p.name).map(p => (
                      <option key={p.id} value={p.name}>@{p.name}</option>
                    ))}
                  </select>
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
                <div className="kb-list-action-controls">
                  <select
                    className="kb-input"
                    value={bulkPriority}
                    onChange={e => setBulkPriority(e.target.value)}
                    style={{ flex: 1 }}
                  >
                    <option value="">Choose a priority...</option>
                    <option value="none">None</option>
                    {(Object.keys(PRIORITY_CONFIG) as CardPriority[]).map(p => (
                      <option key={p} value={p}>{PRIORITY_CONFIG[p].label}</option>
                    ))}
                  </select>
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
                  <div className="kb-list-action-controls">
                    <select className="kb-input kb-import-select" value={bulkLabel} onChange={e => setBulkLabel(e.target.value)} style={{ flex: 1 }}>
                      <option value="">Choose a label...</option>
                      {board.labels.map(l => (
                        <option key={l.id} value={l.id}>{l.name}</option>
                      ))}
                    </select>
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
                  <div className="kb-list-action-controls">
                    <select className="kb-input kb-import-select" value={bulkMoveCol} onChange={e => setBulkMoveCol(e.target.value)} style={{ flex: 1 }}>
                      <option value="">Choose a list...</option>
                      {otherColumns.map(c => (
                        <option key={c.id} value={c.id}>{c.title}</option>
                      ))}
                    </select>
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
