'use client';

import { useEffect, useState, useCallback } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { useProjectBoard } from '@/hooks/useProjectBoard';
import type { WatchedCard } from '@/types/board-types';
import { PRIORITY_CONFIG } from '@/components/board-detail/helpers';
import { Eye, ChevronRight } from 'lucide-react';
import FlameLoader from '@/components/FlameLoader';
import WatchCardDetailPanel from '@/components/WatchCardDetailPanel';

const MONTHS = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];

function formatDueDate(dateStr: string): { label: string; color: string } {
  const [y, m, d] = dateStr.split('-').map(Number);
  const date = new Date(y, m - 1, d);
  const now = new Date(); now.setHours(0, 0, 0, 0);
  const diff = Math.round((date.getTime() - now.getTime()) / 86400000);
  const label = diff < 0
    ? `${MONTHS[m - 1]} ${d}`
    : diff === 0 ? 'Today'
    : diff === 1 ? 'Tomorrow'
    : `${MONTHS[m - 1]} ${d}`;
  const color = diff < 0 ? '#ef4444' : diff === 0 ? '#fa420f' : '#9ca3af';
  return { label, color };
}

export default function WatchingPage() {
  const { user } = useAuth();
  const { fetchWatchedCards, fetchWatcherProfiles } = useProjectBoard();
  const [cards, setCards] = useState<WatchedCard[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedCard, setSelectedCard] = useState<WatchedCard | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    const data = await fetchWatchedCards();
    setCards(data);
    setLoading(false);
  }, [fetchWatchedCards]);

  useEffect(() => {
    if (user) load();
  }, [user, load]);

  if (!user) return null;

  return (
    <div style={{
      minHeight: '100vh',
      background: 'var(--kb-bg, #0f1117)',
      color: '#e2e8f0',
      padding: '24px 20px',
      maxWidth: 900,
      margin: '0 auto',
    }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 24 }}>
        <Eye size={20} color="#6366f1" />
        <h1 style={{ margin: 0, fontSize: 20, fontWeight: 700, color: '#f0f4ff' }}>Watching</h1>
        {cards.length > 0 && (
          <span style={{
            background: 'rgba(99,102,241,0.15)',
            color: '#818cf8',
            fontSize: 12,
            fontWeight: 600,
            padding: '2px 8px',
            borderRadius: 20,
          }}>
            {cards.length}
          </span>
        )}
      </div>

      {loading ? (
        <div style={{ display: 'flex', justifyContent: 'center', paddingTop: 60 }}>
          <FlameLoader />
        </div>
      ) : cards.length === 0 ? (
        <EmptyState />
      ) : (
        <div style={{
          background: 'rgba(255,255,255,0.03)',
          border: '1px solid rgba(255,255,255,0.08)',
          borderRadius: 12,
          overflow: 'hidden',
        }}>
          {/* Table header */}
          <div style={{
            display: 'grid',
            gridTemplateColumns: '1fr 160px 140px 90px 100px 32px',
            gap: 0,
            padding: '10px 16px',
            borderBottom: '1px solid rgba(255,255,255,0.06)',
            fontSize: 11,
            fontWeight: 600,
            color: '#6b7280',
            textTransform: 'uppercase',
            letterSpacing: '0.04em',
          }}>
            <span>Card</span>
            <span>Board</span>
            <span>Column</span>
            <span>Priority</span>
            <span>Due Date</span>
            <span />
          </div>

          {/* Rows */}
          {cards.map((c) => (
            <WatchedCardRow
              key={c.card_id}
              card={c}
              onClick={() => setSelectedCard(c)}
            />
          ))}
        </div>
      )}

      {/* Detail panel */}
      {selectedCard && (
        <WatchCardDetailPanel
          watchedCard={selectedCard}
          onClose={() => setSelectedCard(null)}
          onUnwatch={async () => {
            setSelectedCard(null);
            await load();
          }}
        />
      )}
    </div>
  );
}

function WatchedCardRow({ card, onClick }: { card: WatchedCard; onClick: () => void }) {
  const pri = card.card_priority ? PRIORITY_CONFIG[card.card_priority] : null;
  const due = card.card_due_date ? formatDueDate(card.card_due_date) : null;

  return (
    <button
      onClick={onClick}
      style={{
        display: 'grid',
        gridTemplateColumns: '1fr 160px 140px 90px 100px 32px',
        gap: 0,
        padding: '12px 16px',
        borderBottom: '1px solid rgba(255,255,255,0.04)',
        background: 'transparent',
        border: 'none',
        borderBottomWidth: 1,
        borderBottomStyle: 'solid',
        borderBottomColor: 'rgba(255,255,255,0.04)',
        color: 'inherit',
        textAlign: 'left',
        cursor: 'pointer',
        width: '100%',
        alignItems: 'center',
        transition: 'background 0.15s',
      }}
      onMouseEnter={e => (e.currentTarget.style.background = 'rgba(255,255,255,0.03)')}
      onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
    >
      {/* Title */}
      <span style={{
        fontSize: 14,
        fontWeight: 500,
        color: card.card_is_complete ? '#6b7280' : '#e2e8f0',
        textDecoration: card.card_is_complete ? 'line-through' : 'none',
        overflow: 'hidden',
        textOverflow: 'ellipsis',
        whiteSpace: 'nowrap',
        paddingRight: 12,
      }}>
        {card.card_title}
      </span>

      {/* Board */}
      <span style={{
        fontSize: 13,
        color: '#9ca3af',
        overflow: 'hidden',
        textOverflow: 'ellipsis',
        whiteSpace: 'nowrap',
        paddingRight: 8,
      }}>
        {card.board_title}
      </span>

      {/* Column */}
      <span style={{
        fontSize: 13,
        color: '#6b7280',
        overflow: 'hidden',
        textOverflow: 'ellipsis',
        whiteSpace: 'nowrap',
        paddingRight: 8,
      }}>
        {card.column_title}
      </span>

      {/* Priority */}
      <span>
        {pri ? (
          <span style={{
            fontSize: 11,
            fontWeight: 600,
            color: pri.color,
            background: pri.bg,
            padding: '2px 7px',
            borderRadius: 5,
          }}>
            {pri.label}
          </span>
        ) : (
          <span style={{ color: '#4b5563', fontSize: 12 }}>—</span>
        )}
      </span>

      {/* Due date */}
      <span style={{
        fontSize: 12,
        color: due?.color ?? '#4b5563',
      }}>
        {due?.label ?? '—'}
      </span>

      {/* Chevron */}
      <ChevronRight size={14} color="#4b5563" />
    </button>
  );
}

function EmptyState() {
  return (
    <div style={{
      textAlign: 'center',
      padding: '60px 20px',
      color: '#6b7280',
    }}>
      <Eye size={40} color="#374151" style={{ marginBottom: 16 }} />
      <p style={{ margin: '0 0 8px', fontSize: 17, fontWeight: 700, color: '#d1d5db' }}>
        Stay close to what matters
      </p>
      <p style={{ margin: '0 0 10px', fontSize: 14, color: '#9ca3af', maxWidth: 340, marginLeft: 'auto', marginRight: 'auto', lineHeight: 1.65 }}>
        Watching is how you keep an eye on cards without being assigned to them. Get notified when they're updated, commented on, or completed.
      </p>
      <p style={{ margin: 0, fontSize: 13, color: '#6b7280', maxWidth: 300, marginLeft: 'auto', marginRight: 'auto', lineHeight: 1.6 }}>
        Open any card and click <strong style={{ color: '#818cf8' }}>Watch</strong> to start tracking it here.
      </p>
    </div>
  );
}
