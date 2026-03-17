'use client';

import React, { useState, useRef, useEffect } from 'react';
import { X, Check, Loader, Trash2, ChevronDown, Sparkles } from '@/components/BoardIcons';
import { PRIORITY_CONFIG } from '@/components/board-detail/helpers';
import type { BoardColumn, CardPriority, UserProfile } from '@/types/board-types';

interface ExtractedCard {
  title: string;
  description?: string;
  priority: CardPriority;
  assigneeName?: string;
  assigneeId?: string;
  dueDate?: string;
  included: boolean;
}

interface Props {
  boardId: string;
  boardTitle: string;
  columns: BoardColumn[];
  userProfiles: UserProfile[];
  accessToken: string;
  onClose: () => void;
  onCardsCreated: () => void;
  addCard: (boardId: string, data: {
    column_id: string;
    title: string;
    description?: string;
    priority?: CardPriority | null;
    due_date?: string;
    assignee?: string;
    assignees?: string[];
  }) => Promise<unknown>;
}

export default function MeetingNotesModal({
  boardId,
  boardTitle,
  columns,
  userProfiles,
  accessToken,
  onClose,
  onCardsCreated,
  addCard,
}: Props) {
  const [step, setStep] = useState<'input' | 'preview' | 'creating' | 'done'>('input');
  const [notes, setNotes] = useState('');
  const [cards, setCards] = useState<ExtractedCard[]>([]);
  const [targetColumnId, setTargetColumnId] = useState(columns[0]?.id || '');
  const [extracting, setExtracting] = useState(false);
  const [error, setError] = useState('');
  const [createdCount, setCreatedCount] = useState(0);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    textareaRef.current?.focus();
  }, []);

  // Fuzzy match an assignee name to a user profile
  function resolveAssignee(name?: string): string | undefined {
    if (!name) return undefined;
    const lower = name.toLowerCase().trim();
    // Exact match
    const exact = userProfiles.find(p => p.name.toLowerCase() === lower);
    if (exact) return exact.id;
    // First-name match
    const firstName = userProfiles.find(p => p.name.toLowerCase().split(' ')[0] === lower);
    if (firstName) return firstName.id;
    // Contains match
    const partial = userProfiles.find(p =>
      p.name.toLowerCase().includes(lower) || lower.includes(p.name.toLowerCase().split(' ')[0])
    );
    return partial?.id;
  }

  async function handleExtract() {
    if (!notes.trim()) return;
    setExtracting(true);
    setError('');
    try {
      const res = await fetch('/api/ai/extract-cards', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${accessToken}` },
        body: JSON.stringify({
          notes: notes.trim(),
          memberNames: userProfiles.map(p => p.name),
          boardTitle,
        }),
      });
      if (!res.ok) throw new Error('AI extraction failed');
      const data = await res.json();
      const extracted: ExtractedCard[] = (data.cards || []).map((c: ExtractedCard) => ({
        ...c,
        assigneeId: resolveAssignee(c.assigneeName),
        included: true,
      }));
      setCards(extracted);
      setStep('preview');
    } catch {
      setError('Failed to extract cards. Try again.');
    } finally {
      setExtracting(false);
    }
  }

  function updateCard(idx: number, patch: Partial<ExtractedCard>) {
    setCards(prev => prev.map((c, i) => i === idx ? { ...c, ...patch } : c));
  }

  async function handleCreateAll() {
    const toCreate = cards.filter(c => c.included);
    if (toCreate.length === 0) return;
    setStep('creating');
    let created = 0;
    for (const card of toCreate) {
      try {
        await addCard(boardId, {
          column_id: targetColumnId,
          title: card.title,
          description: card.description || undefined,
          priority: card.priority,
          due_date: card.dueDate || undefined,
          assignee: card.assigneeId || undefined,
          assignees: card.assigneeId ? [card.assigneeId] : [],
        });
        created++;
      } catch {
        // continue with remaining cards
      }
    }
    setCreatedCount(created);
    setStep('done');
    onCardsCreated();
  }

  const includedCount = cards.filter(c => c.included).length;
  const targetColumn = columns.find(c => c.id === targetColumnId);

  return (
    <>
      <style>{meetingNotesStyles}</style>
      <div className="mn-overlay" onClick={onClose}>
        <div className="mn-modal" onClick={e => e.stopPropagation()}>
          {/* Header */}
          <div className="mn-header">
            <div className="mn-title-row">
              <div className="mn-title-icon"><Sparkles size={16} /></div>
              <h2 className="mn-title">
                {step === 'input' && 'Paste Meeting Notes'}
                {step === 'preview' && `Review ${includedCount} Card${includedCount !== 1 ? 's' : ''}`}
                {step === 'creating' && 'Creating cards…'}
                {step === 'done' && 'Done!'}
              </h2>
            </div>
            <button className="mn-close" onClick={onClose}><X size={18} /></button>
          </div>

          {/* ── Step 1: Input ── */}
          {step === 'input' && (
            <div className="mn-body">
              <textarea
                ref={textareaRef}
                className="mn-textarea"
                placeholder="Paste meeting notes, call transcript, or bullet points here…"
                value={notes}
                onChange={e => setNotes(e.target.value)}
                rows={8}
              />
              <p className="mn-hint">Works great with meeting notes, Slack threads, call transcripts, or a quick bullet dump.</p>
              {error && <div className="mn-error">{error}</div>}
              <div className="mn-footer">
                <button className="mn-btn mn-btn-ghost" onClick={onClose}>Cancel</button>
                <button
                  className="mn-btn mn-btn-primary"
                  onClick={handleExtract}
                  disabled={!notes.trim() || extracting}
                >
                  {extracting ? (
                    <><Loader size={14} /> Extracting…</>
                  ) : (
                    'Extract Cards'
                  )}
                </button>
              </div>
            </div>
          )}

          {/* ── Step 2: Preview & confirm ── */}
          {step === 'preview' && (
            <div className="mn-body">
              {/* Column selector */}
              <div className="mn-column-select">
                <span className="mn-column-label">Add to list:</span>
                <div className="mn-select-wrap">
                  <select
                    className="mn-select"
                    value={targetColumnId}
                    onChange={e => setTargetColumnId(e.target.value)}
                  >
                    {columns
                      .filter(c => c.column_type !== 'board_links')
                      .sort((a, b) => a.position - b.position)
                      .map(c => (
                        <option key={c.id} value={c.id}>{c.title}</option>
                      ))}
                  </select>
                  <ChevronDown size={14} className="mn-select-chevron" />
                </div>
              </div>

              {/* Card list */}
              <div className="mn-card-list">
                {cards.map((card, idx) => (
                  <div key={idx} className={`mn-card ${card.included ? '' : 'mn-card-excluded'}`}>
                    <div className="mn-card-top">
                      <label className="mn-checkbox-wrap">
                        <input
                          type="checkbox"
                          checked={card.included}
                          onChange={e => updateCard(idx, { included: e.target.checked })}
                        />
                        <span className="mn-checkbox-visual">
                          {card.included && <Check size={12} />}
                        </span>
                      </label>
                      <input
                        className="mn-card-title"
                        value={card.title}
                        onChange={e => updateCard(idx, { title: e.target.value })}
                      />
                      <button
                        className="mn-card-remove"
                        onClick={() => updateCard(idx, { included: false })}
                        title="Exclude"
                      >
                        <Trash2 size={13} />
                      </button>
                    </div>

                    {card.included && (
                      <div className="mn-card-meta">
                        {/* Priority */}
                        <select
                          className="mn-meta-select"
                          value={card.priority}
                          onChange={e => updateCard(idx, { priority: e.target.value as CardPriority })}
                          style={{
                            color: PRIORITY_CONFIG[card.priority].color,
                            borderColor: PRIORITY_CONFIG[card.priority].color + '44',
                          }}
                        >
                          {Object.entries(PRIORITY_CONFIG).map(([val, cfg]) => (
                            <option key={val} value={val}>{cfg.label}</option>
                          ))}
                        </select>

                        {/* Assignee */}
                        <select
                          className="mn-meta-select"
                          value={card.assigneeId || ''}
                          onChange={e => updateCard(idx, { assigneeId: e.target.value || undefined })}
                        >
                          <option value="">Unassigned</option>
                          {userProfiles.map(p => (
                            <option key={p.id} value={p.id}>{p.name}</option>
                          ))}
                        </select>

                        {/* Due date */}
                        <input
                          type="date"
                          className="mn-meta-date"
                          value={card.dueDate || ''}
                          onChange={e => updateCard(idx, { dueDate: e.target.value || undefined })}
                        />

                        {card.description && (
                          <div className="mn-card-desc">{card.description}</div>
                        )}
                      </div>
                    )}
                  </div>
                ))}
              </div>

              {cards.length === 0 && (
                <div className="mn-empty">No action items found. Try pasting different notes.</div>
              )}

              <div className="mn-footer">
                <button className="mn-btn mn-btn-ghost" onClick={() => setStep('input')}>
                  ← Back
                </button>
                <div className="mn-footer-right">
                  <span className="mn-footer-summary">
                    {includedCount} card{includedCount !== 1 ? 's' : ''} → <strong>{targetColumn?.title}</strong>
                  </span>
                  <button
                    className="mn-btn mn-btn-primary"
                    onClick={handleCreateAll}
                    disabled={includedCount === 0}
                  >
                    Create {includedCount} Card{includedCount !== 1 ? 's' : ''}
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* ── Step 3: Creating ── */}
          {step === 'creating' && (
            <div className="mn-body mn-center">
              <Loader size={32} />
              <p>Creating cards…</p>
            </div>
          )}

          {/* ── Step 4: Done ── */}
          {step === 'done' && (
            <div className="mn-body mn-center">
              <div className="mn-done-icon"><Check size={28} /></div>
              <p className="mn-done-text">
                Created <strong>{createdCount}</strong> card{createdCount !== 1 ? 's' : ''} in <strong>{targetColumn?.title}</strong>
              </p>
              <button className="mn-btn mn-btn-primary" onClick={onClose}>Done</button>
            </div>
          )}
        </div>
      </div>
    </>
  );
}

const meetingNotesStyles = `
.mn-overlay {
  position: fixed; inset: 0; z-index: 9000;
  background: rgba(0,0,0,0.55); backdrop-filter: blur(4px);
  display: flex; align-items: center; justify-content: center;
  padding: 16px;
}
.mn-modal {
  background: var(--kb-card, #1e1e2e);
  border: 1px solid rgba(99,102,241,0.25);
  border-radius: 16px;
  width: 100%; max-width: 620px;
  max-height: 85vh;
  display: flex; flex-direction: column;
  box-shadow: 0 24px 64px rgba(0,0,0,0.5), 0 0 0 1px rgba(99,102,241,0.1);
  overflow: hidden;
}
.mn-header {
  display: flex; align-items: center; justify-content: space-between;
  padding: 16px 20px;
  background: linear-gradient(135deg, rgba(99,102,241,0.12) 0%, rgba(139,92,246,0.06) 100%);
  border-bottom: 1px solid rgba(99,102,241,0.2);
}
.mn-title-row {
  display: flex; align-items: center; gap: 10px;
}
.mn-title-icon {
  width: 30px; height: 30px; border-radius: 8px;
  background: rgba(99,102,241,0.2);
  border: 1px solid rgba(99,102,241,0.3);
  display: flex; align-items: center; justify-content: center;
  color: #818cf8;
  flex-shrink: 0;
}
.mn-title {
  font-size: 16px; font-weight: 700; margin: 0;
  color: var(--kb-text, #e2e2e8);
}
.mn-close {
  background: none; border: none; cursor: pointer;
  color: var(--kb-muted, #888); padding: 4px;
  border-radius: 6px; transition: background 0.15s;
}
.mn-close:hover { background: var(--kb-hover, rgba(255,255,255,0.06)); }
.mn-body {
  padding: 16px 20px 20px;
  overflow-y: auto; overflow-x: hidden; flex: 1;
  display: flex; flex-direction: column; gap: 14px;
  min-width: 0;
}
.mn-center {
  align-items: center; justify-content: center; gap: 16px;
  min-height: 200px; text-align: center;
  color: var(--kb-muted, #888);
}
.mn-textarea {
  width: 100%; box-sizing: border-box; resize: vertical;
  background: rgba(0,0,0,0.25);
  color: var(--kb-text, #e2e2e8);
  border: 1px solid rgba(255,255,255,0.1);
  border-radius: 10px; padding: 14px;
  font-size: 14px; line-height: 1.6;
  font-family: inherit;
  min-height: 160px;
  transition: border-color 0.15s;
}
.mn-textarea:focus { outline: none; border-color: #6366f1; box-shadow: 0 0 0 3px rgba(99,102,241,0.15); }
.mn-hint {
  font-size: 12px; color: var(--kb-muted, #666);
  margin: 0; line-height: 1.5;
}
.mn-error {
  color: #ef4444; font-size: 13px; padding: 8px 12px;
  background: rgba(239,68,68,0.08); border-radius: 8px;
}
.mn-footer {
  display: flex; align-items: center; justify-content: space-between;
  gap: 12px; padding-top: 8px;
  border-top: 1px solid var(--kb-border, #333);
  margin-top: auto;
}
.mn-footer-right {
  display: flex; align-items: center; gap: 12px;
}
.mn-footer-summary {
  font-size: 13px; color: var(--kb-muted, #888);
}
.mn-btn {
  display: inline-flex; align-items: center; gap: 6px;
  padding: 9px 18px; border-radius: 10px;
  font-size: 14px; font-weight: 600;
  border: none; cursor: pointer;
  transition: background 0.15s, opacity 0.15s;
}
.mn-btn:disabled { opacity: 0.45; cursor: not-allowed; }
.mn-btn-primary {
  background: linear-gradient(135deg, #6366f1, #7c3aed); color: #fff;
  box-shadow: 0 2px 12px rgba(99,102,241,0.35);
}
.mn-btn-primary:hover:not(:disabled) { background: linear-gradient(135deg, #4f46e5, #6d28d9); }
.mn-btn-ghost {
  background: transparent; color: var(--kb-muted, #888);
}
.mn-btn-ghost:hover { background: var(--kb-hover, rgba(255,255,255,0.06)); }

/* Column selector */
.mn-column-select {
  display: flex; align-items: center; gap: 10px;
  padding: 10px 14px;
  background: var(--kb-bg, #0f0f17);
  border-radius: 10px;
  border: 1px solid var(--kb-border, #333);
}
.mn-column-label {
  font-size: 13px; font-weight: 600;
  color: var(--kb-muted, #888); white-space: nowrap;
}
.mn-select-wrap {
  position: relative; flex: 1;
}
.mn-select {
  width: 100%; padding: 7px 30px 7px 10px;
  background: var(--kb-card, #1e1e2e);
  color: var(--kb-text, #e2e2e8);
  border: 1px solid var(--kb-border, #333);
  border-radius: 8px; font-size: 14px; font-weight: 600;
  appearance: none; cursor: pointer;
}
.mn-select:focus { outline: none; border-color: #6366f1; }
.mn-select-chevron {
  position: absolute; right: 10px; top: 50%;
  transform: translateY(-50%);
  pointer-events: none;
  color: var(--kb-muted, #888);
}

/* Card list */
.mn-card-list {
  display: flex; flex-direction: column; gap: 8px;
  max-height: 50vh; overflow-y: auto;
}
.mn-card {
  background: var(--kb-bg, #0f0f17);
  border: 1px solid var(--kb-border, #333);
  border-radius: 10px; padding: 12px;
  transition: opacity 0.2s;
}
.mn-card-excluded { opacity: 0.35; }
.mn-card-top {
  display: flex; align-items: center; gap: 8px;
}
.mn-checkbox-wrap {
  display: flex; align-items: center; cursor: pointer;
}
.mn-checkbox-wrap input { display: none; }
.mn-checkbox-visual {
  width: 20px; height: 20px;
  border: 2px solid var(--kb-border, #444);
  border-radius: 5px;
  display: flex; align-items: center; justify-content: center;
  color: #fff; font-size: 12px;
  transition: background 0.15s, border-color 0.15s;
}
.mn-checkbox-wrap input:checked + .mn-checkbox-visual {
  background: #6366f1; border-color: #6366f1;
}
.mn-card-title {
  flex: 1;
  background: transparent; border: none;
  color: var(--kb-text, #e2e2e8);
  font-size: 14px; font-weight: 600;
  padding: 4px 0;
}
.mn-card-title:focus { outline: none; }
.mn-card-remove {
  background: none; border: none; cursor: pointer;
  color: var(--kb-muted, #666); padding: 4px;
  border-radius: 5px; transition: color 0.15s;
}
.mn-card-remove:hover { color: #ef4444; }
.mn-card-meta {
  display: flex; flex-wrap: wrap; gap: 8px;
  margin-top: 10px; padding-left: 28px;
}
.mn-meta-select, .mn-meta-date {
  padding: 5px 8px;
  background: var(--kb-card, #1e1e2e);
  color: var(--kb-text, #e2e2e8);
  border: 1px solid var(--kb-border, #333);
  border-radius: 6px; font-size: 12px;
  cursor: pointer;
}
.mn-meta-select:focus, .mn-meta-date:focus {
  outline: none; border-color: #6366f1;
}
.mn-meta-date { font-family: inherit; }
.mn-card-desc {
  width: 100%;
  font-size: 12px; color: var(--kb-muted, #888);
  line-height: 1.5; margin-top: 4px;
}
.mn-empty {
  text-align: center; padding: 32px;
  color: var(--kb-muted, #888); font-size: 14px;
}
.mn-done-icon {
  width: 56px; height: 56px; border-radius: 50%;
  background: rgba(34,197,94,0.15);
  color: #22c55e;
  display: flex; align-items: center; justify-content: center;
}
.mn-done-text {
  font-size: 15px; color: var(--kb-text, #e2e2e8);
}

/* Mobile */
@media (max-width: 640px) {
  .mn-overlay { padding: 0; align-items: flex-end; }
  .mn-modal {
    border-radius: 20px 20px 0 0;
    max-width: 100%; max-height: 90vh;
  }
  .mn-footer { flex-direction: column; gap: 10px; }
  .mn-footer-right { width: 100%; justify-content: space-between; }
  .mn-card-meta { padding-left: 0; }
}
`;
