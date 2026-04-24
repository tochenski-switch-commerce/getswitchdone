'use client';

import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { useProjectBoard } from '@/hooks/useProjectBoard';
import type { WatchedCard } from '@/types/board-types';
import { PRIORITY_CONFIG } from '@/components/board-detail/helpers';
import { X, Eye, EyeOff, Flag, CalendarDays, User, Tag, MessageSquare, CheckSquare } from 'lucide-react';
import DOMPurify from 'isomorphic-dompurify';

const MONTHS = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];

function formatDate(dateStr: string): string {
  const [y, m, d] = dateStr.split('-').map(Number);
  return `${MONTHS[m - 1]} ${d}, ${y}`;
}

interface FullCardData {
  id: string;
  title: string;
  description?: string;
  priority: string | null;
  start_date?: string;
  due_date?: string;
  assignees?: string[];
  is_complete?: boolean;
  labels?: Array<{ id: string; name: string; color: string }>;
  checklists?: Array<{ id: string; title: string; is_completed: boolean }>;
  comments?: Array<{ id: string; content: string; created_at: string; user_profiles?: { name: string } }>;
  custom_field_values?: Array<{ field_id: string; value?: string; multi_value?: string[] }>;
}

interface AssigneeProfile {
  id: string;
  name: string;
}

export default function WatchCardDetailPanel({
  watchedCard,
  onClose,
  onUnwatch,
}: {
  watchedCard: WatchedCard;
  onClose: () => void;
  onUnwatch: () => Promise<void>;
}) {
  const { unwatchCard } = useProjectBoard();
  const [card, setCard] = useState<FullCardData | null>(null);
  const [assigneeProfiles, setAssigneeProfiles] = useState<AssigneeProfile[]>([]);
  const [loading, setLoading] = useState(true);
  const [unwatching, setUnwatching] = useState(false);

  useEffect(() => {
    async function fetchCard() {
      setLoading(true);

      const { data: cardRow, error: cardErr } = await supabase
        .from('board_cards')
        .select('id, title, description, priority, start_date, due_date, assignees, is_complete')
        .eq('id', watchedCard.card_id)
        .maybeSingle();

      if (cardErr || !cardRow) {
        console.error('[WatchCardDetailPanel] card fetch failed:', cardErr);
        setLoading(false);
        return;
      }

      const [labelAssignRes, checklistRes, commentsRes] = await Promise.all([
        supabase.from('card_label_assignments').select('label_id').eq('card_id', watchedCard.card_id),
        supabase.from('card_checklists').select('id, title, is_completed').eq('card_id', watchedCard.card_id),
        supabase.from('card_comments').select('id, content, created_at, user_id').eq('card_id', watchedCard.card_id).order('created_at', { ascending: true }),
      ]);

      const labelIds = (labelAssignRes.data || []).map((a: any) => a.label_id);
      let labels: Array<{ id: string; name: string; color: string }> = [];
      if (labelIds.length > 0) {
        const { data: labelRows } = await supabase
          .from('board_labels')
          .select('id, name, color')
          .in('id', labelIds);
        labels = (labelRows || []) as any[];
      }

      const commentUserIds = [...new Set((commentsRes.data || []).map((c: any) => c.user_id).filter(Boolean))];
      const assigneeIds: string[] = cardRow.assignees ?? [];
      const allProfileIds = [...new Set([...commentUserIds, ...assigneeIds])];

      let profileMap = new Map<string, { id: string; name: string }>();
      if (allProfileIds.length > 0) {
        const { data: profiles } = await supabase
          .from('user_profiles')
          .select('id, name')
          .in('id', allProfileIds);
        profileMap = new Map((profiles || []).map((p: any) => [p.id, p]));
      }

      const comments = (commentsRes.data || []).map((c: any) => ({
        id: c.id,
        content: c.content,
        created_at: c.created_at,
        user_profiles: profileMap.get(c.user_id),
      }));

      setCard({
        ...cardRow,
        labels,
        checklists: (checklistRes.data || []) as any[],
        comments,
      } as FullCardData);

      setAssigneeProfiles(assigneeIds.map((id) => profileMap.get(id)).filter(Boolean) as AssigneeProfile[]);

      setLoading(false);
    }
    fetchCard();
  }, [watchedCard.card_id]);

  async function handleUnwatch() {
    setUnwatching(true);
    await unwatchCard(watchedCard.card_id);
    await onUnwatch();
  }

  const pri = card?.priority ? PRIORITY_CONFIG[card.priority as keyof typeof PRIORITY_CONFIG] : null;
  const safeDesc = card?.description
    ? DOMPurify.sanitize(card.description)
    : null;

  return (
    <>
      {/* Backdrop */}
      <div
        onClick={onClose}
        style={{
          position: 'fixed',
          inset: 0,
          background: 'rgba(0,0,0,0.5)',
          zIndex: 900,
        }}
      />

      {/* Panel */}
      <div style={{
        position: 'fixed',
        top: 0,
        right: 0,
        bottom: 0,
        width: '100%',
        maxWidth: 560,
        background: '#131720',
        borderLeft: '1px solid rgba(255,255,255,0.08)',
        zIndex: 901,
        display: 'flex',
        flexDirection: 'column',
        overflow: 'hidden',
      }}>
        {/* Panel header */}
        <div style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '14px 20px',
          borderBottom: '1px solid rgba(255,255,255,0.08)',
          flexShrink: 0,
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <Eye size={15} color="#6366f1" />
            <span style={{ fontSize: 12, color: '#818cf8', fontWeight: 600 }}>Watching</span>
            <span style={{ fontSize: 12, color: '#4b5563', margin: '0 4px' }}>·</span>
            <span style={{ fontSize: 12, color: '#6b7280' }}>{watchedCard.board_title}</span>
            <span style={{ fontSize: 12, color: '#374151', margin: '0 2px' }}>›</span>
            <span style={{ fontSize: 12, color: '#6b7280' }}>{watchedCard.column_title}</span>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <button
              onClick={handleUnwatch}
              disabled={unwatching}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 5,
                background: 'rgba(99,102,241,0.1)',
                border: '1px solid rgba(99,102,241,0.25)',
                borderRadius: 6,
                color: '#818cf8',
                fontSize: 12,
                padding: '5px 10px',
                cursor: unwatching ? 'not-allowed' : 'pointer',
                opacity: unwatching ? 0.6 : 1,
              }}
            >
              <EyeOff size={12} />
              {unwatching ? 'Unwatching…' : 'Unwatch'}
            </button>
            <button
              onClick={onClose}
              style={{
                background: 'transparent',
                border: 'none',
                color: '#6b7280',
                cursor: 'pointer',
                padding: 4,
                display: 'flex',
              }}
            >
              <X size={18} />
            </button>
          </div>
        </div>

        {/* Scrollable body */}
        <div style={{ flex: 1, overflowY: 'auto', padding: '20px' }}>
          {loading ? (
            <div style={{ color: '#6b7280', fontSize: 14, textAlign: 'center', paddingTop: 40 }}>
              Loading…
            </div>
          ) : !card ? (
            <div style={{ color: '#6b7280', fontSize: 14, textAlign: 'center', paddingTop: 40 }}>
              Card not found.
            </div>
          ) : (
            <>
              {/* Title */}
              <h2 style={{
                margin: '0 0 20px',
                fontSize: 20,
                fontWeight: 700,
                color: card.is_complete ? '#6b7280' : '#f0f4ff',
                lineHeight: 1.35,
                textDecoration: card.is_complete ? 'line-through' : 'none',
              }}>
                {card.title}
              </h2>

              {/* Meta row */}
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10, marginBottom: 20 }}>
                {/* Priority */}
                {pri && (
                  <MetaBadge icon={<Flag size={11} />} label={pri.label} color={pri.color} bg={pri.bg} />
                )}

                {/* Due date */}
                {card.due_date && (
                  <MetaBadge
                    icon={<CalendarDays size={11} />}
                    label={formatDate(card.due_date)}
                    color="#9ca3af"
                    bg="rgba(156,163,175,0.1)"
                  />
                )}

                {/* Start date */}
                {card.start_date && (
                  <MetaBadge
                    icon={<CalendarDays size={11} />}
                    label={`Starts ${formatDate(card.start_date)}`}
                    color="#6b7280"
                    bg="rgba(107,114,128,0.1)"
                  />
                )}
              </div>

              {/* Assignees */}
              {assigneeProfiles.length > 0 && (
                <Section icon={<User size={13} />} title="Assignees">
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                    {assigneeProfiles.map(p => (
                      <span key={p.id} style={{
                        background: 'rgba(255,255,255,0.06)',
                        border: '1px solid rgba(255,255,255,0.1)',
                        borderRadius: 20,
                        fontSize: 12,
                        padding: '3px 10px',
                        color: '#d1d5db',
                      }}>
                        @{p.name}
                      </span>
                    ))}
                  </div>
                </Section>
              )}

              {/* Labels */}
              {(card.labels?.length ?? 0) > 0 && (
                <Section icon={<Tag size={13} />} title="Labels">
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                    {card.labels!.map(l => (
                      <span key={l.id} style={{
                        background: `${l.color}22`,
                        border: `1px solid ${l.color}55`,
                        borderRadius: 5,
                        fontSize: 11,
                        fontWeight: 600,
                        padding: '2px 8px',
                        color: l.color,
                      }}>
                        {l.name}
                      </span>
                    ))}
                  </div>
                </Section>
              )}

              {/* Description */}
              {safeDesc && (
                <Section title="Description">
                  <div
                    dangerouslySetInnerHTML={{ __html: safeDesc }}
                    style={{
                      fontSize: 14,
                      lineHeight: 1.65,
                      color: '#c9d3ea',
                    }}
                    className="kb-prose"
                  />
                </Section>
              )}

              {/* Checklists */}
              {(card.checklists?.length ?? 0) > 0 && (
                <Section icon={<CheckSquare size={13} />} title={`Checklist (${card.checklists!.filter(i => i.is_completed).length}/${card.checklists!.length})`}>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                    {card.checklists!.map(item => (
                      <div key={item.id} style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: 8,
                        fontSize: 13,
                        color: item.is_completed ? '#6b7280' : '#c9d3ea',
                      }}>
                        <div style={{
                          width: 14,
                          height: 14,
                          borderRadius: 3,
                          border: item.is_completed ? 'none' : '1.5px solid #4b5563',
                          background: item.is_completed ? '#6366f1' : 'transparent',
                          flexShrink: 0,
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                        }}>
                          {item.is_completed && (
                            <svg width="9" height="9" viewBox="0 0 12 12" fill="none">
                              <polyline points="2,6 5,9 10,3" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                            </svg>
                          )}
                        </div>
                        <span style={{ textDecoration: item.is_completed ? 'line-through' : 'none' }}>
                          {item.title}
                        </span>
                      </div>
                    ))}
                  </div>
                </Section>
              )}

              {/* Comments */}
              {(card.comments?.length ?? 0) > 0 && (
                <Section icon={<MessageSquare size={13} />} title={`Comments (${card.comments!.length})`}>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                    {card.comments!.map(comment => (
                      <div key={comment.id} style={{
                        background: 'rgba(255,255,255,0.03)',
                        border: '1px solid rgba(255,255,255,0.06)',
                        borderRadius: 8,
                        padding: '10px 12px',
                      }}>
                        <div style={{
                          display: 'flex',
                          alignItems: 'center',
                          gap: 6,
                          marginBottom: 6,
                          fontSize: 12,
                        }}>
                          <span style={{ fontWeight: 600, color: '#9ca3af' }}>
                            @{comment.user_profiles?.name ?? 'Unknown'}
                          </span>
                          <span style={{ color: '#4b5563' }}>
                            {new Date(comment.created_at).toLocaleDateString('en-US', {
                              month: 'short', day: 'numeric',
                            })}
                          </span>
                        </div>
                        <div
                          dangerouslySetInnerHTML={{
                            __html: DOMPurify.sanitize(comment.content),
                          }}
                          style={{ fontSize: 13, lineHeight: 1.6, color: '#9ca3af' }}
                        />
                      </div>
                    ))}
                  </div>
                </Section>
              )}
            </>
          )}
        </div>
      </div>
    </>
  );
}

function MetaBadge({ icon, label, color, bg }: { icon?: React.ReactNode; label: string; color: string; bg: string }) {
  return (
    <span style={{
      display: 'inline-flex',
      alignItems: 'center',
      gap: 4,
      fontSize: 12,
      fontWeight: 500,
      color,
      background: bg,
      borderRadius: 6,
      padding: '3px 8px',
    }}>
      {icon}
      {label}
    </span>
  );
}

function Section({ icon, title, children }: { icon?: React.ReactNode; title: string; children: React.ReactNode }) {
  return (
    <div style={{ marginBottom: 20 }}>
      <div style={{
        display: 'flex',
        alignItems: 'center',
        gap: 5,
        fontSize: 11,
        fontWeight: 600,
        color: '#6b7280',
        textTransform: 'uppercase',
        letterSpacing: '0.04em',
        marginBottom: 8,
      }}>
        {icon}
        {title}
      </div>
      {children}
    </div>
  );
}
