'use client';

import { useState, useMemo } from 'react';
import type { BoardCard } from '@/types/board-types';
import type { FullBoard } from '@/hooks/useProjectBoard';
import { X, Search, Archive, RotateCcw } from '@/components/BoardIcons';

export default function ArchiveDrawer({
  board,
  archivedCards,
  onClose,
  onRestore,
  loading,
}: {
  board: FullBoard;
  archivedCards: BoardCard[];
  onClose: () => void;
  onRestore: (cardId: string, columnId: string) => Promise<void>;
  loading: boolean;
}) {
  const [search, setSearch] = useState('');
  const [restoringId, setRestoringId] = useState<string | null>(null);
  const [restoreTarget, setRestoreTarget] = useState<string>('');
  const [pickingForCardId, setPickingForCardId] = useState<string | null>(null);

  const filtered = useMemo(() => {
    if (!search.trim()) return archivedCards;
    const q = search.toLowerCase();
    return archivedCards.filter(c => c.title.toLowerCase().includes(q));
  }, [archivedCards, search]);

  const handleRestore = async (cardId: string, columnId: string) => {
    setRestoringId(cardId);
    try {
      await onRestore(cardId, columnId);
      setPickingForCardId(null);
      setRestoreTarget('');
    } finally {
      setRestoringId(null);
    }
  };

  const getColumnName = (columnId: string | null | undefined) => {
    if (!columnId) return null;
    return board.columns.find(c => c.id === columnId)?.title ?? null;
  };

  const formatArchivedAt = (archived_at: string | null | undefined) => {
    if (!archived_at) return '';
    return new Date(archived_at).toLocaleDateString('en-US', {
      month: 'short', day: 'numeric', year: 'numeric',
    });
  };

  return (
    <div className="kb-archive-drawer-overlay" onMouseDown={onClose}>
      <div className="kb-archive-drawer" onMouseDown={e => e.stopPropagation()}>
        {/* Header */}
        <div className="kb-archive-drawer-header">
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <Archive size={16} style={{ color: '#9ca3af' }} />
            <span style={{ fontWeight: 700, fontSize: 15, color: '#f9fafb' }}>Archive</span>
            {archivedCards.length > 0 && (
              <span className="kb-column-count">{archivedCards.length}</span>
            )}
          </div>
          <button className="kb-btn-icon-sm" onClick={onClose}><X size={16} /></button>
        </div>

        {/* Search */}
        <div className="kb-archive-search-row">
          <Search size={14} style={{ color: '#6b7280', flexShrink: 0 }} />
          <input
            className="kb-archive-search-input"
            placeholder="Search archived cards…"
            value={search}
            onChange={e => setSearch(e.target.value)}
            autoFocus
          />
          {search && (
            <button className="kb-btn-icon-sm" onClick={() => setSearch('')}><X size={13} /></button>
          )}
        </div>

        {/* Card list */}
        <div className="kb-archive-list">
          {loading ? (
            <div className="kb-archive-empty">Loading…</div>
          ) : filtered.length === 0 ? (
            <div className="kb-archive-empty">
              {search ? 'No cards match your search.' : 'No archived cards.'}
            </div>
          ) : (
            filtered.map(card => {
              const originalColName = getColumnName(card.pre_archive_column_id);
              const isPicking = pickingForCardId === card.id;

              return (
                <div key={card.id} className="kb-archive-card">
                  <div className="kb-archive-card-body">
                    <div className="kb-archive-card-title">{card.title}</div>
                    <div className="kb-archive-card-meta">
                      {originalColName && (
                        <span style={{ color: '#6b7280' }}>From: {originalColName}</span>
                      )}
                      {card.archived_at && (
                        <span style={{ color: '#4b5563' }}>{formatArchivedAt(card.archived_at)}</span>
                      )}
                    </div>
                  </div>

                  {isPicking ? (
                    <div className="kb-archive-restore-picker">
                      <span style={{ fontSize: 11, color: '#9ca3af', marginBottom: 4 }}>Restore to:</span>
                      <select
                        className="kb-input"
                        value={restoreTarget}
                        onChange={e => setRestoreTarget(e.target.value)}
                        style={{ fontSize: 12 }}
                        autoFocus
                      >
                        <option value="">Choose a column…</option>
                        {board.columns.map(col => (
                          <option key={col.id} value={col.id}>
                            {col.title}
                          </option>
                        ))}
                      </select>
                      <div style={{ display: 'flex', gap: 6, marginTop: 4 }}>
                        <button
                          className="kb-btn kb-btn-primary kb-btn-sm"
                          disabled={!restoreTarget || restoringId === card.id}
                          onClick={() => handleRestore(card.id, restoreTarget)}
                        >
                          <RotateCcw size={12} />
                          {restoringId === card.id ? 'Restoring…' : 'Restore'}
                        </button>
                        <button
                          className="kb-btn kb-btn-sm"
                          style={{ background: 'transparent', color: '#6b7280', border: '1px solid #374151' }}
                          onClick={() => { setPickingForCardId(null); setRestoreTarget(''); }}
                        >
                          Cancel
                        </button>
                      </div>
                    </div>
                  ) : (
                    <button
                      className="kb-btn kb-btn-sm"
                      style={{ background: 'transparent', color: '#9ca3af', border: '1px solid #374151', flexShrink: 0 }}
                      disabled={restoringId === card.id}
                      onClick={() => {
                        setPickingForCardId(card.id);
                        setRestoreTarget(card.pre_archive_column_id || (board.columns[0]?.id ?? ''));
                      }}
                    >
                      <RotateCcw size={12} />
                      Restore
                    </button>
                  )}
                </div>
              );
            })
          )}
        </div>
      </div>
    </div>
  );
}
