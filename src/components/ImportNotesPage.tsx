'use client';

import React, { useCallback, useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Sparkles, Loader, Check, Trash2, ChevronDown, FileText } from '@/components/BoardIcons';
import { PRIORITY_CONFIG } from '@/components/board-detail/helpers';
import { useAuth } from '@/contexts/AuthContext';
import { useSubscription } from '@/hooks/useSubscription';
import { useImportData } from '@/hooks/useImportData';
import type { CardPriority, UserProfile } from '@/types/board-types';

interface PreviewCard {
  title: string;
  description: string;
  priority: CardPriority;
  assigneeName?: string;
  assigneeId?: string;
  dueDate?: string;
  boardId: string;
  columnId: string;
  included: boolean;
}

const DEFAULTS_KEY = 'lumio.import.defaults';

// Fuzzy-match an extracted assignee name to a user profile (exact → first-name → contains).
function resolveAssignee(name: string | undefined, profiles: UserProfile[]): string | undefined {
  if (!name) return undefined;
  const lower = name.toLowerCase().trim();
  const exact = profiles.find(p => p.name.toLowerCase() === lower);
  if (exact) return exact.id;
  const firstName = profiles.find(p => p.name.toLowerCase().split(' ')[0] === lower);
  if (firstName) return firstName.id;
  const partial = profiles.find(p =>
    p.name.toLowerCase().includes(lower) || lower.includes(p.name.toLowerCase().split(' ')[0])
  );
  return partial?.id;
}

export default function ImportNotesPage() {
  const router = useRouter();
  const { user, session, loading: authLoading } = useAuth();
  const { showPaywall } = useSubscription();
  const { boards, userProfiles, columnsByBoard, loading: dataLoading, fetchBoardColumns, bulkCreateCards } = useImportData();

  const [step, setStep] = useState<'input' | 'preview' | 'creating' | 'done'>('input');
  const [notes, setNotes] = useState('');
  const [cards, setCards] = useState<PreviewCard[]>([]);
  const [extracting, setExtracting] = useState(false);
  const [error, setError] = useState('');
  const [result, setResult] = useState<{ created: number; failed: number }>({ created: 0, failed: 0 });

  // Defaults
  const [defaultBoardId, setDefaultBoardId] = useState('');
  const [defaultColumnId, setDefaultColumnId] = useState('');
  const [defaultAssigneeId, setDefaultAssigneeId] = useState('');
  const [applyDefaultAssignee, setApplyDefaultAssignee] = useState(false);
  const hydratedRef = useRef(false);

  const accessToken = session?.access_token ?? '';

  // Auth guard
  useEffect(() => {
    if (!authLoading && !user) router.replace('/auth?returnTo=/import');
  }, [authLoading, router, user]);

  // Hydrate defaults from localStorage once boards are available.
  useEffect(() => {
    if (hydratedRef.current || dataLoading || boards.length === 0) return;
    hydratedRef.current = true;
    let storedBoard = '', storedColumn = '', storedAssignee = '', storedApply = false;
    try {
      const raw = localStorage.getItem(DEFAULTS_KEY);
      if (raw) {
        const parsed = JSON.parse(raw);
        storedBoard = parsed.boardId || '';
        storedColumn = parsed.columnId || '';
        storedAssignee = parsed.assigneeId || '';
        storedApply = !!parsed.applyDefaultAssignee;
      }
    } catch { /* ignore */ }

    const boardId = boards.some(b => b.id === storedBoard) ? storedBoard : boards[0].id;
    setDefaultBoardId(boardId);
    setDefaultAssigneeId(storedAssignee);
    setApplyDefaultAssignee(storedApply);
    void fetchBoardColumns(boardId).then(cols => {
      const colId = cols.some(c => c.id === storedColumn) ? storedColumn : (cols[0]?.id || '');
      setDefaultColumnId(colId);
    }).catch(() => {});
  }, [dataLoading, boards, fetchBoardColumns]);

  // Persist defaults whenever they change.
  useEffect(() => {
    if (!hydratedRef.current) return;
    try {
      localStorage.setItem(DEFAULTS_KEY, JSON.stringify({
        boardId: defaultBoardId,
        columnId: defaultColumnId,
        assigneeId: defaultAssigneeId,
        applyDefaultAssignee,
      }));
    } catch { /* ignore */ }
  }, [defaultBoardId, defaultColumnId, defaultAssigneeId, applyDefaultAssignee]);

  // Ensure columns are loaded for every board referenced by the default or a card.
  useEffect(() => {
    const ids = new Set<string>([defaultBoardId, ...cards.map(c => c.boardId)].filter(Boolean));
    ids.forEach(id => { if (!columnsByBoard[id]) void fetchBoardColumns(id).catch(() => {}); });
  }, [defaultBoardId, cards, columnsByBoard, fetchBoardColumns]);

  const defaultBoard = boards.find(b => b.id === defaultBoardId);

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
          boardTitle: defaultBoard?.title || '',
        }),
      });
      if (res.status === 403) {
        showPaywall();
        setError('AI import requires a Pro subscription.');
        return;
      }
      if (!res.ok) throw new Error('AI extraction failed');
      const data = await res.json();
      const extracted: PreviewCard[] = (data.cards || []).map((c: {
        title: string; description?: string | null; priority: CardPriority; assigneeName?: string | null; dueDate?: string | null;
      }) => {
        const assigneeName = c.assigneeName ?? undefined;
        const matched = resolveAssignee(assigneeName, userProfiles);
        return {
          title: c.title,
          description: c.description || '',
          priority: c.priority,
          assigneeName,
          assigneeId: matched || (applyDefaultAssignee ? (defaultAssigneeId || undefined) : undefined),
          dueDate: c.dueDate ?? undefined,
          boardId: defaultBoardId,
          columnId: defaultColumnId,
          included: true,
        };
      });
      setCards(extracted);
      setStep('preview');
    } catch {
      setError('Failed to extract cards. Try again.');
    } finally {
      setExtracting(false);
    }
  }

  function updateCard(idx: number, patch: Partial<PreviewCard>) {
    setCards(prev => prev.map((c, i) => i === idx ? { ...c, ...patch } : c));
  }

  // Changing the default board moves every card that's still on the previous default.
  async function handleDefaultBoardChange(newBoardId: string) {
    const cols = await fetchBoardColumns(newBoardId);
    const newColId = cols[0]?.id || '';
    const oldB = defaultBoardId, oldC = defaultColumnId;
    setDefaultBoardId(newBoardId);
    setDefaultColumnId(newColId);
    setCards(prev => prev.map(c =>
      (c.boardId === oldB && c.columnId === oldC) ? { ...c, boardId: newBoardId, columnId: newColId } : c
    ));
  }

  function handleDefaultColumnChange(newColId: string) {
    const oldB = defaultBoardId, oldC = defaultColumnId;
    setDefaultColumnId(newColId);
    setCards(prev => prev.map(c =>
      (c.boardId === oldB && c.columnId === oldC) ? { ...c, columnId: newColId } : c
    ));
  }

  function handleToggleDefaultAssignee(on: boolean) {
    setApplyDefaultAssignee(on);
    if (on && defaultAssigneeId) {
      setCards(prev => prev.map(c => c.assigneeId ? c : { ...c, assigneeId: defaultAssigneeId }));
    }
  }

  function handleDefaultAssigneeChange(id: string) {
    setDefaultAssigneeId(id);
    if (applyDefaultAssignee && id) {
      setCards(prev => prev.map(c => c.assigneeId ? c : { ...c, assigneeId: id }));
    }
  }

  async function handleCardBoardChange(idx: number, newBoardId: string) {
    const cols = await fetchBoardColumns(newBoardId);
    updateCard(idx, { boardId: newBoardId, columnId: cols[0]?.id || '' });
  }

  function removeCard(idx: number) {
    setCards(prev => prev.filter((_, i) => i !== idx));
  }

  async function handleCreateAll() {
    const toCreate = cards.filter(c => c.included && c.boardId && c.columnId);
    if (toCreate.length === 0) return;
    setStep('creating');
    const res = await bulkCreateCards(toCreate.map(c => ({
      board_id: c.boardId,
      column_id: c.columnId,
      title: c.title,
      description: c.description || undefined,
      priority: c.priority,
      due_date: c.dueDate || undefined,
      assignee: c.assigneeId || undefined,
    })));
    setResult(res);
    setStep('done');
  }

  function resetForMore() {
    setNotes('');
    setCards([]);
    setError('');
    setStep('input');
  }

  const includedCount = cards.filter(c => c.included).length;
  const missingTarget = cards.some(c => c.included && (!c.boardId || !c.columnId));

  if (authLoading || (dataLoading && !boards.length)) {
    return (
      <div className="imp-root">
        <style>{importStyles}</style>
        <div className="imp-loading"><Loader size={28} /> Loading…</div>
      </div>
    );
  }

  return (
    <div className="imp-root">
      <style>{importStyles}</style>
      <div className="imp-container">
        {/* Header */}
        <div className="imp-header">
          <div className="imp-header-left">
            <div className="imp-title-icon"><Sparkles size={20} /></div>
            <div>
              <h1 className="imp-page-title">Import from Notes</h1>
              <p className="imp-subtitle">Paste meeting notes and turn them into cards — review everything before it lands.</p>
            </div>
          </div>
        </div>

        {/* ── Step 1: Input ── */}
        {step === 'input' && (
          <div className="imp-input-wrap">
            <textarea
              className="imp-textarea"
              placeholder="Paste meeting notes, a call transcript, a backlog dump, or bullet points here…"
              value={notes}
              onChange={e => setNotes(e.target.value)}
              autoFocus
            />
            <p className="imp-hint">Works great with meeting notes, Slack threads, call transcripts, or a quick bullet dump. Dates and owners are detected automatically.</p>
            {error && <div className="imp-error">{error}</div>}
            <div className="imp-input-footer">
              <button
                className="imp-btn imp-btn-primary imp-btn-lg"
                onClick={handleExtract}
                disabled={!notes.trim() || extracting}
              >
                {extracting ? <><Loader size={16} /> Extracting…</> : <><Sparkles size={16} /> Extract Cards</>}
              </button>
            </div>
          </div>
        )}

        {/* ── Step 2: Preview ── */}
        {step === 'preview' && (
          <div className="imp-preview">
            {/* Defaults bar */}
            <div className="imp-defaults">
              <div className="imp-defaults-row">
                <div className="imp-field">
                  <label className="imp-field-label">Default board</label>
                  <div className="imp-select-wrap">
                    <select className="imp-select" value={defaultBoardId} onChange={e => handleDefaultBoardChange(e.target.value)}>
                      {boards.map(b => <option key={b.id} value={b.id}>{b.title}</option>)}
                    </select>
                    <ChevronDown size={14} className="imp-select-chevron" />
                  </div>
                </div>
                <div className="imp-field">
                  <label className="imp-field-label">Default list</label>
                  <div className="imp-select-wrap">
                    <select className="imp-select" value={defaultColumnId} onChange={e => handleDefaultColumnChange(e.target.value)}>
                      {(columnsByBoard[defaultBoardId] || []).map(c => <option key={c.id} value={c.id}>{c.title}</option>)}
                    </select>
                    <ChevronDown size={14} className="imp-select-chevron" />
                  </div>
                </div>
              </div>
              <div className="imp-defaults-row">
                <div className="imp-field">
                  <label className="imp-field-label">Default assignee for unmatched</label>
                  <div className="imp-select-wrap">
                    <select className="imp-select" value={defaultAssigneeId} onChange={e => handleDefaultAssigneeChange(e.target.value)}>
                      <option value="">— None —</option>
                      {userProfiles.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
                    </select>
                    <ChevronDown size={14} className="imp-select-chevron" />
                  </div>
                </div>
                <label className="imp-toggle">
                  <input
                    type="checkbox"
                    checked={applyDefaultAssignee}
                    onChange={e => handleToggleDefaultAssignee(e.target.checked)}
                    disabled={!defaultAssigneeId}
                  />
                  <span className="imp-toggle-visual">{applyDefaultAssignee && <Check size={12} />}</span>
                  <span>Apply to anyone we couldn’t match</span>
                </label>
              </div>
            </div>

            {/* Card list */}
            <div className="imp-card-list">
              {cards.map((card, idx) => {
                const cols = columnsByBoard[card.boardId] || [];
                const unmatched = card.assigneeName && !card.assigneeId;
                return (
                  <div key={idx} className={`imp-card ${card.included ? '' : 'imp-card-excluded'}`}>
                    <div className="imp-card-top">
                      <label className="imp-checkbox-wrap" title={card.included ? 'Exclude' : 'Include'}>
                        <input type="checkbox" checked={card.included} onChange={e => updateCard(idx, { included: e.target.checked })} />
                        <span className="imp-checkbox-visual">{card.included && <Check size={12} />}</span>
                      </label>
                      <input
                        className="imp-card-title"
                        value={card.title}
                        onChange={e => updateCard(idx, { title: e.target.value })}
                        placeholder="Card title"
                      />
                      <button className="imp-card-remove" onClick={() => removeCard(idx)} title="Reject card">
                        <Trash2 size={14} />
                      </button>
                    </div>

                    <textarea
                      className="imp-card-desc"
                      value={card.description}
                      onChange={e => updateCard(idx, { description: e.target.value })}
                      placeholder="Description (optional)"
                      rows={2}
                    />

                    <div className="imp-card-meta">
                      {/* Board */}
                      <div className="imp-meta-field">
                        <span className="imp-meta-label">Board</span>
                        <select className="imp-meta-select" value={card.boardId} onChange={e => handleCardBoardChange(idx, e.target.value)}>
                          {boards.map(b => <option key={b.id} value={b.id}>{b.title}</option>)}
                        </select>
                      </div>
                      {/* List */}
                      <div className="imp-meta-field">
                        <span className="imp-meta-label">List</span>
                        <select className="imp-meta-select" value={card.columnId} onChange={e => updateCard(idx, { columnId: e.target.value })}>
                          {cols.length === 0 && <option value="">Loading…</option>}
                          {cols.map(c => <option key={c.id} value={c.id}>{c.title}</option>)}
                        </select>
                      </div>
                      {/* Priority */}
                      <div className="imp-meta-field">
                        <span className="imp-meta-label">Priority</span>
                        <select
                          className="imp-meta-select"
                          value={card.priority}
                          onChange={e => updateCard(idx, { priority: e.target.value as CardPriority })}
                          style={{ color: PRIORITY_CONFIG[card.priority].color, borderColor: PRIORITY_CONFIG[card.priority].color + '44' }}
                        >
                          {Object.entries(PRIORITY_CONFIG).map(([val, cfg]) => <option key={val} value={val}>{cfg.label}</option>)}
                        </select>
                      </div>
                      {/* Assignee */}
                      <div className="imp-meta-field">
                        <span className="imp-meta-label">Assignee {unmatched && <span className="imp-unmatched" title={`“${card.assigneeName}” didn’t match a user`}>· {card.assigneeName}?</span>}</span>
                        <select className="imp-meta-select" value={card.assigneeId || ''} onChange={e => updateCard(idx, { assigneeId: e.target.value || undefined })}>
                          <option value="">Unassigned</option>
                          {userProfiles.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
                        </select>
                      </div>
                      {/* Due date */}
                      <div className="imp-meta-field">
                        <span className="imp-meta-label">Due</span>
                        <input type="date" className="imp-meta-date" value={card.dueDate || ''} onChange={e => updateCard(idx, { dueDate: e.target.value || undefined })} />
                      </div>
                    </div>
                  </div>
                );
              })}
              {cards.length === 0 && <div className="imp-empty">No action items found. Try pasting different notes.</div>}
            </div>

            {/* Footer */}
            <div className="imp-preview-footer">
              <button className="imp-btn imp-btn-ghost" onClick={() => setStep('input')}>← Back to notes</button>
              <div className="imp-footer-right">
                {missingTarget && <span className="imp-warn">Some cards need a list selected.</span>}
                <span className="imp-footer-summary">{includedCount} card{includedCount !== 1 ? 's' : ''} ready</span>
                <button className="imp-btn imp-btn-primary" onClick={handleCreateAll} disabled={includedCount === 0 || missingTarget}>
                  Import {includedCount} Card{includedCount !== 1 ? 's' : ''}
                </button>
              </div>
            </div>
          </div>
        )}

        {/* ── Step 3: Creating ── */}
        {step === 'creating' && (
          <div className="imp-center"><Loader size={32} /><p>Creating cards…</p></div>
        )}

        {/* ── Step 4: Done ── */}
        {step === 'done' && (
          <div className="imp-center">
            <div className="imp-done-icon"><Check size={28} /></div>
            <p className="imp-done-text">
              Imported <strong>{result.created}</strong> card{result.created !== 1 ? 's' : ''}
              {result.failed > 0 && <span className="imp-warn"> · {result.failed} failed</span>}
            </p>
            <div className="imp-done-actions">
              <button className="imp-btn imp-btn-ghost" onClick={() => router.push(`/boards/${defaultBoardId}`)}>
                <FileText size={15} /> View board
              </button>
              <button className="imp-btn imp-btn-primary" onClick={resetForMore}>Import more</button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

const importStyles = `
.imp-root { min-height: 100%; color: var(--kb-text, #e2e2e8); }
.imp-container { max-width: 860px; margin: 0 auto; padding: 24px 20px 80px; }
.imp-loading, .imp-center {
  display: flex; flex-direction: column; align-items: center; justify-content: center;
  gap: 14px; min-height: 320px; color: var(--kb-muted, #888); text-align: center;
}

/* Header */
.imp-header { margin-bottom: 22px; }
.imp-header-left { display: flex; align-items: flex-start; gap: 14px; }
.imp-title-icon {
  width: 40px; height: 40px; border-radius: 10px; flex-shrink: 0;
  background: rgba(99,102,241,0.18); border: 1px solid rgba(99,102,241,0.3);
  display: flex; align-items: center; justify-content: center; color: #818cf8;
}
.imp-page-title { font-size: 22px; font-weight: 700; margin: 0; }
.imp-subtitle { font-size: 13px; color: var(--kb-muted, #888); margin: 4px 0 0; line-height: 1.5; }

/* Input */
.imp-input-wrap { display: flex; flex-direction: column; gap: 12px; }
.imp-textarea {
  width: 100%; box-sizing: border-box; resize: vertical; min-height: 320px;
  background: rgba(0,0,0,0.25); color: var(--kb-text, #e2e2e8);
  border: 1px solid rgba(255,255,255,0.1); border-radius: 12px; padding: 16px;
  font-size: 14px; line-height: 1.6; font-family: inherit; transition: border-color 0.15s;
}
.imp-textarea:focus { outline: none; border-color: #6366f1; box-shadow: 0 0 0 3px rgba(99,102,241,0.15); }
.imp-hint { font-size: 12px; color: var(--kb-muted, #666); margin: 0; line-height: 1.5; }
.imp-input-footer { display: flex; justify-content: flex-end; }

/* Buttons */
.imp-btn {
  display: inline-flex; align-items: center; gap: 7px;
  padding: 9px 18px; border-radius: 10px; font-size: 14px; font-weight: 600;
  border: none; cursor: pointer; transition: background 0.15s, opacity 0.15s;
}
.imp-btn:disabled { opacity: 0.45; cursor: not-allowed; }
.imp-btn-lg { padding: 12px 24px; font-size: 15px; }
.imp-btn-primary {
  background: linear-gradient(135deg, #6366f1, #7c3aed); color: #fff;
  box-shadow: 0 2px 12px rgba(99,102,241,0.35);
}
.imp-btn-primary:hover:not(:disabled) { background: linear-gradient(135deg, #4f46e5, #6d28d9); }
.imp-btn-ghost { background: transparent; color: var(--kb-muted, #888); }
.imp-btn-ghost:hover { background: var(--kb-hover, rgba(255,255,255,0.06)); }

.imp-error {
  color: #ef4444; font-size: 13px; padding: 9px 12px;
  background: rgba(239,68,68,0.08); border-radius: 8px;
}

/* Defaults bar */
.imp-defaults {
  display: flex; flex-direction: column; gap: 12px;
  padding: 14px 16px; margin-bottom: 16px;
  background: var(--kb-bg, #0f0f17); border: 1px solid var(--kb-border, #333); border-radius: 12px;
}
.imp-defaults-row { display: flex; gap: 16px; flex-wrap: wrap; align-items: flex-end; }
.imp-field { display: flex; flex-direction: column; gap: 5px; flex: 1; min-width: 180px; }
.imp-field-label { font-size: 11px; font-weight: 600; text-transform: uppercase; letter-spacing: 0.03em; color: var(--kb-muted, #888); }
.imp-select-wrap { position: relative; }
.imp-select {
  width: 100%; padding: 8px 30px 8px 10px;
  background: var(--kb-card, #1e1e2e); color: var(--kb-text, #e2e2e8);
  border: 1px solid var(--kb-border, #333); border-radius: 8px;
  font-size: 13px; font-weight: 600; appearance: none; cursor: pointer;
}
.imp-select:focus { outline: none; border-color: #6366f1; }
.imp-select-chevron { position: absolute; right: 10px; top: 50%; transform: translateY(-50%); pointer-events: none; color: var(--kb-muted, #888); }
.imp-toggle {
  display: flex; align-items: center; gap: 8px; cursor: pointer;
  font-size: 13px; color: var(--kb-muted, #aaa); padding-bottom: 8px; user-select: none;
}
.imp-toggle input { display: none; }
.imp-toggle-visual {
  width: 18px; height: 18px; border: 2px solid var(--kb-border, #444); border-radius: 5px;
  display: flex; align-items: center; justify-content: center; color: #fff; flex-shrink: 0;
}
.imp-toggle input:checked + .imp-toggle-visual { background: #6366f1; border-color: #6366f1; }
.imp-toggle input:disabled ~ * { opacity: 0.5; }

/* Card list */
.imp-card-list { display: flex; flex-direction: column; gap: 10px; }
.imp-card {
  background: var(--kb-bg, #0f0f17); border: 1px solid var(--kb-border, #333);
  border-radius: 12px; padding: 14px; transition: opacity 0.2s, border-color 0.15s;
}
.imp-card:hover { border-color: #3a3d4a; }
.imp-card-excluded { opacity: 0.4; }
.imp-card-top { display: flex; align-items: center; gap: 10px; }
.imp-checkbox-wrap { display: flex; align-items: center; cursor: pointer; }
.imp-checkbox-wrap input { display: none; }
.imp-checkbox-visual {
  width: 20px; height: 20px; border: 2px solid var(--kb-border, #444); border-radius: 5px;
  display: flex; align-items: center; justify-content: center; color: #fff; flex-shrink: 0;
  transition: background 0.15s, border-color 0.15s;
}
.imp-checkbox-wrap input:checked + .imp-checkbox-visual { background: #6366f1; border-color: #6366f1; }
.imp-card-title {
  flex: 1; background: transparent; border: none; color: var(--kb-text, #e2e2e8);
  font-size: 15px; font-weight: 600; padding: 4px 0; min-width: 0;
}
.imp-card-title:focus { outline: none; }
.imp-card-remove {
  background: none; border: none; cursor: pointer; color: var(--kb-muted, #666);
  padding: 5px; border-radius: 6px; transition: color 0.15s, background 0.15s; flex-shrink: 0;
}
.imp-card-remove:hover { color: #ef4444; background: rgba(239,68,68,0.1); }
.imp-card-desc {
  width: 100%; box-sizing: border-box; resize: vertical; margin: 8px 0 0;
  background: rgba(0,0,0,0.2); color: var(--kb-muted, #c0c0c8);
  border: 1px solid var(--kb-border, #2a2a36); border-radius: 8px; padding: 8px 10px;
  font-size: 13px; line-height: 1.5; font-family: inherit; min-height: 44px;
}
.imp-card-desc:focus { outline: none; border-color: #6366f1; color: var(--kb-text, #e2e2e8); }
.imp-card-meta { display: flex; flex-wrap: wrap; gap: 10px 14px; margin-top: 12px; }
.imp-meta-field { display: flex; flex-direction: column; gap: 4px; }
.imp-meta-label { font-size: 10px; font-weight: 600; text-transform: uppercase; letter-spacing: 0.03em; color: var(--kb-muted, #777); }
.imp-unmatched { color: #f59e0b; text-transform: none; letter-spacing: 0; font-weight: 500; }
.imp-meta-select, .imp-meta-date {
  padding: 6px 8px; background: var(--kb-card, #1e1e2e); color: var(--kb-text, #e2e2e8);
  border: 1px solid var(--kb-border, #333); border-radius: 7px; font-size: 12px; cursor: pointer;
  max-width: 200px;
}
.imp-meta-select:focus, .imp-meta-date:focus { outline: none; border-color: #6366f1; }
.imp-meta-date { font-family: inherit; }
.imp-empty { text-align: center; padding: 40px; color: var(--kb-muted, #888); font-size: 14px; }

/* Preview footer */
.imp-preview-footer {
  display: flex; align-items: center; justify-content: space-between; gap: 12px;
  margin-top: 18px; padding-top: 16px; border-top: 1px solid var(--kb-border, #333);
  position: sticky; bottom: 0; background: var(--kb-page-bg, #0a0a0f);
}
.imp-footer-right { display: flex; align-items: center; gap: 14px; }
.imp-footer-summary { font-size: 13px; color: var(--kb-muted, #888); }
.imp-warn { font-size: 12px; color: #f59e0b; }

.imp-done-icon {
  width: 60px; height: 60px; border-radius: 50%; background: rgba(34,197,94,0.15);
  color: #22c55e; display: flex; align-items: center; justify-content: center;
}
.imp-done-text { font-size: 16px; color: var(--kb-text, #e2e2e8); }
.imp-done-actions { display: flex; gap: 10px; margin-top: 6px; }

/* Mobile */
@media (max-width: 640px) {
  .imp-container { padding: 16px 14px 80px; }
  .imp-defaults-row { flex-direction: column; align-items: stretch; gap: 12px; }
  .imp-field { min-width: 0; }
  .imp-preview-footer { flex-direction: column; align-items: stretch; gap: 12px; }
  .imp-footer-right { width: 100%; justify-content: space-between; }
  .imp-meta-select, .imp-meta-date { max-width: 100%; }
}
`;
