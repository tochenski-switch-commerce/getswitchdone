'use client';

import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
/* AUTH: Replace with your auth hook */
import { useAuth } from '@/contexts/AuthContext';
import { useProjectBoard } from '@/hooks/useProjectBoard';
import { useTeams } from '@/hooks/useTeams';

import PullToRefreshIndicator from '@/components/PullToRefreshIndicator';
import FlameLoader from '@/components/FlameLoader';
import { usePullToRefresh } from '@/hooks/usePullToRefresh';
import { hapticLight } from '@/lib/haptics';
import {
  Plus,
  LayoutDashboard,
  Trash2,
  FolderKanban,
  Globe,
  User,
  Users,
  FileText,
  Copy,
  ChevronDown,
  Flag,
  Clock,
  Star,
  Printer,
  Bell,
  getBoardIcon,
  DEFAULT_ICON_COLOR,
} from '@/components/BoardIcons';
import type { BoardIconKey } from '@/components/BoardIcons';
import BoardWizardModal from '@/components/BoardWizardModal';
// import UpgradeBanner from '@/components/UpgradeBanner';
import { useSubscription } from '@/hooks/useSubscription';
import { useTemplates } from '@/hooks/useTemplates';
import type { TemplateData } from '@/types/board-types';
import { supabase } from '@/lib/supabase';

// ── Types ────────────────────────────────────────────────────────────────────
type CardRow = {
  id: string;
  board_id: string;
  due_date: string | null;
  is_complete: boolean;
  priority: string;
  updated_at: string;
  assignees?: string[] | null;
};

type ChecklistRow = {
  card_id: string;
  due_date: string | null;
  is_completed: boolean;
};

type BoardStats = {
  totalCards: number;
  completedCards: number;
  overdue: number;
  dueToday: number;
  dueThisWeek: number;
  highPriority: number;
  checklistOverdue: number;
  checklistDueToday: number;
  checklistDueThisWeek: number;
  lastActivity: string;
};

// ── Helpers ──────────────────────────────────────────────────────────────────
function relativeTime(isoStr: string): string {
  const diff = Date.now() - new Date(isoStr).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return 'Just now';
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days < 7) return `${days}d ago`;
  const weeks = Math.floor(days / 7);
  if (weeks < 5) return `${weeks}w ago`;
  return new Date(isoStr).toLocaleDateString();
}

// ── Component ────────────────────────────────────────────────────────────────
function BoardsListPage() {
  const { user, loading: authLoading } = useAuth();
  const router = useRouter();
  const searchParams = useSearchParams();
  const { boards, fetchBoards, createBoard, createBoardFromTemplate, deleteBoard, duplicateBoard, toggleBoardStar, loading } = useProjectBoard();
  const { teamTemplates, fetchTeamTemplates } = useTemplates();
  const { canCreateBoard, showPaywall } = useSubscription();
  const [duplicatingId, setDuplicatingId] = useState<string | null>(null);
  const [showWizard, setShowWizard] = useState(false);
  const [assigneeFilter, setAssigneeFilter] = useState<string>('');
  const [assigneeProfiles, setAssigneeProfiles] = useState<Map<string, string>>(new Map());

  // ── Stats flag (set to true when ready to ship) ───────────────────────────
  const STATS_ENABLED = true;

  // ── Notification counts by board ──────────────────────────────────────────
  const [notifCountByBoard, setNotifCountByBoard] = useState<Map<string, number>>(new Map());

  useEffect(() => {
    if (!user || !supabase) return;
    supabase
      .from('notifications')
      .select('board_id')
      .eq('user_id', user.id)
      .eq('is_read', false)
      .not('board_id', 'is', null)
      .then(({ data }) => {
        const counts = new Map<string, number>();
        for (const row of (data || [])) {
          if (row.board_id) counts.set(row.board_id, (counts.get(row.board_id) ?? 0) + 1);
        }
        setNotifCountByBoard(counts);
      });
  }, [user]);

  // ── Stats state ────────────────────────────────────────────────────────────
  const [rawCards, setRawCards] = useState<CardRow[]>([]);
  const [rawChecklists, setRawChecklists] = useState<ChecklistRow[]>([]);
  const [statsLoaded, setStatsLoaded] = useState(false);

  // Global expand/collapse — persisted to localStorage as an array of board IDs
  const [statsExpanded, setStatsExpanded] = useState<boolean>(() => {
    try {
      const saved = localStorage.getItem('boards-expanded-stats');
      return saved ? (JSON.parse(saved) as string[]).length > 0 : false;
    } catch {
      return false;
    }
  });

  const { teams, fetchTeams } = useTeams();

  const handlePullRefresh = useCallback(async () => {
    await fetchBoards();
  }, [fetchBoards]);
  const { pulling, pullDistance, refreshing } = usePullToRefresh(handlePullRefresh);

  useEffect(() => {
    if (!authLoading && !user) {
      router.replace('/auth?returnTo=%2Fboards');
    }
  }, [authLoading, user, router]);

  useEffect(() => {
    if (user) {
      fetchBoards();
      fetchTeams();
    }
  }, [user, fetchBoards, fetchTeams]);

  // Widget "Add Card" deep link: navigate to most recent board with addCard flag
  useEffect(() => {
    if (searchParams.get('addCard') === '1' && boards.length > 0) {
      router.replace(`/boards/${boards[0].id}?addCard=1`);
    }
  }, [searchParams, router, boards]);

  useEffect(() => {
    if (teams.length > 0 || user) {
      fetchTeamTemplates(teams.map(t => t.id));
    }
  }, [teams, user, fetchTeamTemplates]);

  // ── Fetch stats (once, after boards load) ─────────────────────────────────
  useEffect(() => {
    if (!STATS_ENABLED || statsLoaded || boards.length === 0 || !supabase) return;
    setStatsLoaded(true);

    const boardIds = boards.map(b => b.id);

    Promise.all([
      supabase
        .from('board_cards')
        .select('id, board_id, due_date, is_complete, priority, updated_at, assignees')
        .in('board_id', boardIds)
        .eq('is_archived', false),
      supabase
        .from('card_checklists')
        .select('card_id, due_date, is_completed'),
    ]).then(([cardsRes, checklistsRes]) => {
      if (cardsRes.data) setRawCards(cardsRes.data as CardRow[]);
      if (checklistsRes.data) setRawChecklists(checklistsRes.data as ChecklistRow[]);
    });
  }, [boards, statsLoaded]);

  // Reset stats guard when boards list itself changes (e.g. after delete/create)
  useEffect(() => {
    setStatsLoaded(false);
  }, [boards.length]);

  // ── Compute per-board stats ────────────────────────────────────────────────
  const boardStatsMap = useMemo<Map<string, BoardStats>>(() => {
    const map = new Map<string, BoardStats>();
    if (rawCards.length === 0 && rawChecklists.length === 0) return map;

    const todayStart = new Date();
    todayStart.setHours(0, 0, 0, 0);
    const todayStr = todayStart.toISOString().slice(0, 10);

    // Saturday of current Sun–Sat week
    const saturday = new Date(todayStart);
    saturday.setDate(todayStart.getDate() + (6 - todayStart.getDay()));
    const saturdayStr = saturday.toISOString().slice(0, 10);

    // Build lookup structures
    const cardBoardMap = new Map<string, string>();
    const cardsByBoard = new Map<string, CardRow[]>();

    for (const card of rawCards) {
      cardBoardMap.set(card.id, card.board_id);
      let arr = cardsByBoard.get(card.board_id);
      if (!arr) { arr = []; cardsByBoard.set(card.board_id, arr); }
      arr.push(card);
    }

    const checklistsByBoard = new Map<string, ChecklistRow[]>();
    for (const cl of rawChecklists) {
      const boardId = cardBoardMap.get(cl.card_id);
      if (!boardId) continue;
      let arr = checklistsByBoard.get(boardId);
      if (!arr) { arr = []; checklistsByBoard.set(boardId, arr); }
      arr.push(cl);
    }

    for (const board of boards) {
      const cards = cardsByBoard.get(board.id) ?? [];
      const checklists = checklistsByBoard.get(board.id) ?? [];
      const incomplete = cards.filter(c => !c.is_complete);
      const incompleteChk = checklists.filter(cl => !cl.is_completed);

      // Last activity = most recent card updated_at, falling back to board.updated_at
      let lastActivity = board.updated_at;
      for (const c of cards) {
        if (c.updated_at > lastActivity) lastActivity = c.updated_at;
      }

      map.set(board.id, {
        totalCards: cards.length,
        completedCards: cards.filter(c => c.is_complete).length,
        overdue: incomplete.filter(c => c.due_date && c.due_date < todayStr).length,
        dueToday: incomplete.filter(c => c.due_date === todayStr).length,
        dueThisWeek: incomplete.filter(c => c.due_date && c.due_date > todayStr && c.due_date <= saturdayStr).length,
        highPriority: incomplete.filter(c => c.priority === 'high' || c.priority === 'urgent').length,
        checklistOverdue: incompleteChk.filter(cl => cl.due_date && cl.due_date < todayStr).length,
        checklistDueToday: incompleteChk.filter(cl => cl.due_date === todayStr).length,
        checklistDueThisWeek: incompleteChk.filter(cl => cl.due_date && cl.due_date > todayStr && cl.due_date <= saturdayStr).length,
        lastActivity,
      });
    }

    return map;
  }, [rawCards, rawChecklists, boards]);

  // ── Unique assignees across all boards ────────────────────────────────────
  const uniqueAssigneeIds = useMemo(() => {
    const ids = new Set<string>();
    for (const card of rawCards) {
      for (const a of (card.assignees || [])) ids.add(a);
    }
    return Array.from(ids);
  }, [rawCards]);

  const assigneeKey = uniqueAssigneeIds.join(',');
  useEffect(() => {
    if (!assigneeKey || !supabase) return;
    supabase
      .from('user_profiles')
      .select('id, name')
      .in('id', uniqueAssigneeIds)
      .then(({ data }) => {
        if (data) setAssigneeProfiles(new Map(data.map((p: { id: string; name: string }) => [p.id, p.name || p.id])));
      });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [assigneeKey]);

  // ── Filter boards by assignee ──────────────────────────────────────────────
  const filteredBoards = useMemo(() => {
    if (!assigneeFilter) return boards;
    const matchingBoardIds = new Set<string>();
    for (const card of rawCards) {
      if (assigneeFilter === 'unassigned') {
        if (!card.assignees || card.assignees.length === 0) matchingBoardIds.add(card.board_id);
      } else {
        if (card.assignees?.includes(assigneeFilter)) matchingBoardIds.add(card.board_id);
      }
    }
    return boards.filter(b => matchingBoardIds.has(b.id));
  }, [boards, rawCards, assigneeFilter]);

  // ── Toggle expand (global — all cards together) ────────────────────────────
  const toggleStats = useCallback((e: React.MouseEvent) => {
    e.stopPropagation();
    setStatsExpanded(prev => {
      const next = !prev;
      try {
        localStorage.setItem(
          'boards-expanded-stats',
          JSON.stringify(next ? boards.map(b => b.id) : []),
        );
      } catch { /* ignore */ }
      return next;
    });
  }, [boards]);

  // ── Print a single board — navigate to overview with auto-print flag ────────
  const handlePrintBoard = (e: React.MouseEvent, board: typeof boards[0]) => {
    e.stopPropagation();
    router.push(`/boards/${board.id}/overview?print=1`);
  };

  // ── Board card renderer ────────────────────────────────────────────────────
  const renderBoardCard = (board: typeof boards[0], teamName?: string) => {
    const stats = boardStatsMap.get(board.id);
    const unreadCount = notifCountByBoard.get(board.id) ?? 0;
    const totalOverdue = stats ? stats.overdue + stats.checklistOverdue : 0;
    const totalDueToday = stats ? stats.dueToday + stats.checklistDueToday : 0;
    const progressPct = stats && stats.totalCards > 0
      ? Math.round((stats.completedCards / stats.totalCards) * 100)
      : 0;
    const hasChecklistDue = stats && (
      stats.checklistOverdue > 0 || stats.checklistDueToday > 0 || stats.checklistDueThisWeek > 0
    );

    return (
      <div
        key={board.id}
        className="kb-board-card"
        onClick={() => { hapticLight(); router.push(`/boards/${board.id}`); }}
      >
        <div className="kb-board-card-header">
          {React.createElement(getBoardIcon(board.icon), { size: 20, style: { color: board.icon_color || DEFAULT_ICON_COLOR } })}
          <h3 className="kb-board-card-title">{board.title}</h3>
          {unreadCount > 0 && (
            <span className="kb-notif-badge">
              <Bell size={10} />
              {unreadCount}
            </span>
          )}
          {board.is_public && (
            <span className="kb-visibility-badge public"><Globe size={10} /> Public</span>
          )}
          <button
            className={`kb-star-btn${board.is_starred ? ' kb-star-btn-active' : ''}`}
            onClick={e => { e.stopPropagation(); hapticLight(); toggleBoardStar(board.id); }}
            title={board.is_starred ? 'Unstar board' : 'Star board'}
          >
            <Star size={14} style={{ fill: board.is_starred ? '#f59e0b' : 'none', color: board.is_starred ? '#f59e0b' : '#4b5563' }} />
          </button>
        </div>
        {teamName && (
          <div className="kb-shared-by"><Users size={11} /> {teamName}</div>
        )}
        {!teamName && board.user_id !== user?.id && (
          <div className="kb-shared-by"><User size={11} /> Shared board</div>
        )}
        {board.description && (
          <p className="kb-board-card-desc">{board.description}</p>
        )}

        {/* ── Stats pills ─────────────────────────────────────────────────── */}
        {STATS_ENABLED && stats && (
          <div className="kb-stats-row" onClick={e => e.stopPropagation()}>
            <div className="kb-stats-pills">
              {/* Done pill with mini progress bar */}
              <span className="kb-pill kb-pill-done">
                <span
                  className="kb-pill-bar"
                  style={{ width: `${progressPct}%` }}
                />
                <span className="kb-pill-text">{stats.completedCards}/{stats.totalCards} done</span>
              </span>
              {/* Overdue */}
              {totalOverdue > 0 && (
                <span className="kb-pill kb-pill-overdue">{totalOverdue} overdue</span>
              )}
              {/* Due today */}
              {totalDueToday > 0 && (
                <span className="kb-pill kb-pill-today">{totalDueToday} today</span>
              )}
              {/* High / urgent priority */}
              {stats.highPriority > 0 && (
                <span className="kb-pill kb-pill-priority">
                  <Flag size={9} />
                  {stats.highPriority}
                </span>
              )}
            </div>
            <button
              className={`kb-stats-chevron${statsExpanded ? ' expanded' : ''}`}
              onClick={toggleStats}
              title={statsExpanded ? 'Collapse stats' : 'Expand stats'}
            >
              <ChevronDown size={13} />
            </button>
          </div>
        )}

        {/* ── Expanded detail grid ─────────────────────────────────────────── */}
        {STATS_ENABLED && stats && (
          <div className={`kb-stats-detail${statsExpanded ? ' expanded' : ''}`}>
            <div className="kb-stats-section-label">Cards</div>
            <div className="kb-stats-grid">
              <div className="kb-stat-cell">
                <span className="kb-stat-label">Total</span>
                <span className="kb-stat-value">{stats.totalCards}</span>
              </div>
              <div className="kb-stat-cell">
                <span className="kb-stat-label">Completed</span>
                <span className="kb-stat-value kb-stat-green">{stats.completedCards}</span>
              </div>
              <div className="kb-stat-cell">
                <span className="kb-stat-label">Overdue</span>
                <span className="kb-stat-value kb-stat-red">{stats.overdue}</span>
              </div>
              <div className="kb-stat-cell">
                <span className="kb-stat-label">Due Today</span>
                <span className="kb-stat-value kb-stat-amber">{stats.dueToday}</span>
              </div>
              <div className="kb-stat-cell">
                <span className="kb-stat-label">This Week</span>
                <span className="kb-stat-value kb-stat-blue">{stats.dueThisWeek}</span>
              </div>
              <div className="kb-stat-cell">
                <span className="kb-stat-label">High/Urgent</span>
                <span className="kb-stat-value kb-stat-amber">{stats.highPriority}</span>
              </div>
            </div>

            {hasChecklistDue && (
              <>
                <div className="kb-stats-section-label" style={{ marginTop: 10 }}>Checklist Items</div>
                <div className="kb-stats-grid kb-stats-grid-3">
                  <div className="kb-stat-cell">
                    <span className="kb-stat-label">Overdue</span>
                    <span className="kb-stat-value kb-stat-red">{stats.checklistOverdue}</span>
                  </div>
                  <div className="kb-stat-cell">
                    <span className="kb-stat-label">Due Today</span>
                    <span className="kb-stat-value kb-stat-amber">{stats.checklistDueToday}</span>
                  </div>
                  <div className="kb-stat-cell">
                    <span className="kb-stat-label">This Week</span>
                    <span className="kb-stat-value kb-stat-blue">{stats.checklistDueThisWeek}</span>
                  </div>
                </div>
              </>
            )}
          </div>
        )}

        <div className="kb-board-card-footer">
          <span className="kb-board-card-date">
            <Clock size={12} />
            {STATS_ENABLED && stats ? relativeTime(stats.lastActivity) : new Date(board.created_at).toLocaleDateString()}
          </span>
          <div style={{ display: 'flex', alignItems: 'center', gap: 2 }}>
            <button
              className="kb-btn-icon"
              onClick={e => handlePrintBoard(e, board)}
              title="Print board overview"
            >
              <Printer size={14} />
            </button>
            {board.user_id === user?.id && (
              <>
                <button
                  className="kb-btn-icon"
                  onClick={async e => {
                    e.stopPropagation();
                    setDuplicatingId(board.id);
                    const dup = await duplicateBoard(board.id);
                    setDuplicatingId(null);
                    if (dup) router.push(`/boards/${dup.id}`);
                  }}
                  title="Duplicate board"
                  disabled={duplicatingId === board.id}
                  style={duplicatingId === board.id ? { opacity: 0.5 } : undefined}
                >
                  <Copy size={14} />
                </button>
                <button
                  className="kb-btn-icon kb-btn-icon-danger"
                  onClick={e => {
                    e.stopPropagation();
                    if (confirm('Delete this board? This cannot be undone.')) {
                      deleteBoard(board.id);
                    }
                  }}
                  title="Delete board"
                >
                  <Trash2 size={14} />
                </button>
              </>
            )}
          </div>
        </div>
      </div>
    );
  };

  return (
    <div className="kb-root">
      <style>{boardsListStyles}</style>
      <PullToRefreshIndicator pulling={pulling} pullDistance={pullDistance} refreshing={refreshing} />
      <div className="kb-container">
        {/* Header */}
        <div className="kb-header">
          <div className="kb-header-left">
            <FolderKanban size={28} style={{ color: '#818cf8' }} />
            <h1 className="kb-page-title">Project Boards</h1>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginLeft: 'auto' }}>
            <button className="kb-btn kb-btn-ghost" onClick={() => router.push('/forms')}>
              <FileText size={16} />
              Forms
            </button>
            <button className="kb-btn kb-btn-primary" onClick={() => {
              if (!canCreateBoard(boards.length)) { showPaywall(); return; }
              setShowWizard(true);
            }}>
              <Plus size={16} />
              New Board
            </button>

          </div>
        </div>

        {/* Board Wizard */}
        {showWizard && (
          <BoardWizardModal
            onClose={() => setShowWizard(false)}
            onCreated={boardId => { setShowWizard(false); router.push(`/boards/${boardId}`); }}
            teams={teams}
            teamTemplates={teamTemplates}
            onCreateBlank={async (title, desc, icon, iconColor, teamId) => {
              const board = await createBoard(title, desc, icon, iconColor, teamId || undefined);
              return board?.id ?? null;
            }}
            onCreateFromTemplate={async (title, templateData, desc, icon, iconColor, teamId) => {
              const board = await createBoardFromTemplate(title, templateData, desc, icon, iconColor, teamId || undefined);
              return board?.id ?? null;
            }}
          />
        )}

        {/* Board grid */}
        {loading && boards.length === 0 ? (
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '80px 20px' }}>
            <FlameLoader delay={400} size={56} />
          </div>
        ) : boards.length === 0 ? (
          <div className="kb-empty">
            <LayoutDashboard size={48} style={{ color: '#4b5563', marginBottom: '16px' }} />
            <h3 style={{ color: '#e5e7eb', fontSize: '18px', fontWeight: 600, marginBottom: '8px' }}>No boards yet</h3>
            <p style={{ color: '#9ca3af', fontSize: '14px', marginBottom: '20px' }}>Create your first project board to get started.</p>
            <button className="kb-btn kb-btn-primary" onClick={() => {
              if (!canCreateBoard(boards.length)) { showPaywall(); return; }
              setShowWizard(true);
            }}>
              <Plus size={16} />
              Create Board
            </button>
          </div>
        ) : (
          <>
            {/* TODO: re-enable when paywall is ready to ship
            {!canCreateBoard(boards.length) && (
              <UpgradeBanner message="You've reached the free plan limit. Upgrade to Pro for unlimited boards." />
            )}
            */}

            {/* ── Assignee filter ──────────────────────────────────────────── */}
            {uniqueAssigneeIds.length > 0 && (
              <div className="kb-filter-bar">
                <select
                  className="kb-filter-select"
                  value={assigneeFilter}
                  onChange={e => setAssigneeFilter(e.target.value)}
                >
                  <option value="">All Assignees</option>
                  <option value="unassigned">Unassigned</option>
                  {uniqueAssigneeIds.map(id => (
                    <option key={id} value={id}>
                      {id === user?.id ? 'Me' : (assigneeProfiles.get(id) || id)}
                    </option>
                  ))}
                </select>
              </div>
            )}

            {/* My Boards */}
            {(() => {
              const knownTeamIds = new Set(teams.map(t => t.id));
              const myBoards = filteredBoards.filter(b => !b.team_id);
              const teamGroups = teams.map(t => ({ team: t, boards: filteredBoards.filter(b => b.team_id === t.id) })).filter(g => g.boards.length > 0);
              // Boards belonging to teams I'm not in (e.g. public)
              const otherTeamBoards = filteredBoards.filter(b => b.team_id && !knownTeamIds.has(b.team_id));
              const noResults = filteredBoards.length === 0 && assigneeFilter;
              return (
                <>
                  {noResults && (
                    <div style={{ color: '#6b7280', fontSize: 14, padding: '32px 0' }}>
                      No boards match this filter.
                    </div>
                  )}
                  {myBoards.length > 0 && (
                    <div style={{ marginBottom: 28 }}>
                      <h2 className="kb-section-label">My Boards</h2>
                      <div className="kb-board-grid">
                        {myBoards.map(board => renderBoardCard(board))}
                      </div>
                    </div>
                  )}
                  {teamGroups.map(({ team, boards: tBoards }) => (
                    <div key={team.id} style={{ marginBottom: 28 }}>
                      <h2 className="kb-section-label"><Users size={14} style={{ verticalAlign: -2 }} /> {team.name}</h2>
                      <div className="kb-board-grid">
                        {tBoards.map(board => renderBoardCard(board, team.name))}
                      </div>
                    </div>
                  ))}
                  {otherTeamBoards.length > 0 && (
                    <div style={{ marginBottom: 28 }}>
                      <h2 className="kb-section-label">Other Shared</h2>
                      <div className="kb-board-grid">
                        {otherTeamBoards.map(board => renderBoardCard(board))}
                      </div>
                    </div>
                  )}
                </>
              );
            })()}
          </>
        )}
      </div>

    </div>
  );
}

/* AUTH: Wrap with your own auth guard in layout/middleware */
export default BoardsListPage;

const boardsListStyles = `
  .kb-root {
    min-height: 100vh;
    background: #0f1117 !important;
    color: #e5e7eb !important;
    font-family: -apple-system, BlinkMacSystemFont, 'SF Pro Text', system-ui, sans-serif;
  }
  .kb-container {
    max-width: 1200px;
    margin: 0 auto;
    padding: 24px 16px 100px;
  }
  .kb-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    margin-bottom: 32px;
  }
  .kb-header-left {
    display: flex;
    align-items: center;
    gap: 12px;
  }
  .kb-page-title {
    font-size: 24px !important;
    font-weight: 700 !important;
    color: #f9fafb !important;
    margin: 0 !important;
  }

  /* Buttons */
  .kb-btn {
    display: inline-flex;
    align-items: center;
    gap: 6px;
    padding: 8px 16px;
    border-radius: 10px;
    font-size: 13px;
    font-weight: 600;
    cursor: pointer;
    transition: all 0.15s ease;
    border: none;
    outline: none;
    white-space: nowrap;
  }
  .kb-btn-primary {
    background: #6366f1 !important;
    color: #fff !important;
  }
  .kb-btn-primary:hover {
    background: #4f46e5 !important;
    transform: translateY(-1px);
  }
  .kb-btn-primary:disabled {
    opacity: 0.5;
    cursor: not-allowed;
    transform: none;
  }
  .kb-btn-ghost {
    background: transparent !important;
    color: #9ca3af !important;
    border: 1px solid #374151 !important;
  }
  .kb-btn-ghost:hover {
    background: #1f2937 !important;
    color: #e5e7eb !important;
  }
  .kb-btn-icon {
    background: none !important;
    border: none;
    padding: 6px;
    border-radius: 8px;
    cursor: pointer;
    color: #6b7280;
    transition: all 0.15s ease;
    display: flex;
    align-items: center;
    justify-content: center;
  }
  .kb-btn-icon:hover {
    background: #1f2937 !important;
    color: #e5e7eb !important;
  }
  .kb-btn-icon-danger:hover {
    background: rgba(239, 68, 68, 0.15) !important;
    color: #ef4444 !important;
  }

  /* Filter bar */
  .kb-filter-bar {
    display: flex;
    align-items: center;
    gap: 8px;
    margin-bottom: 20px;
  }
  .kb-filter-select {
    background: #1a1d27 !important;
    border: 1px solid #2a2d3a !important;
    border-radius: 10px !important;
    padding: 6px 10px !important;
    color: #e5e7eb !important;
    font-size: 12px !important;
    cursor: pointer;
    outline: none;
    -webkit-appearance: none;
  }
  .kb-filter-select:focus { border-color: #6366f1 !important; }

  /* Board grid */
  .kb-board-grid {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(min(300px, 100%), 1fr));
    gap: 16px;
  }
  .kb-board-card {
    background: #1a1d27 !important;
    border: 1px solid #2a2d3a;
    border-radius: 14px;
    padding: 20px;
    cursor: pointer;
    transition: all 0.2s ease;
  }
  .kb-board-card:hover {
    border-color: #6366f1;
    box-shadow: 0 0 0 1px rgba(99, 102, 241, 0.3), 0 8px 24px rgba(0,0,0,0.3);
    transform: translateY(-2px);
  }
  .kb-board-card-header {
    display: flex;
    align-items: center;
    gap: 10px;
    margin-bottom: 8px;
  }
  .kb-board-card-title {
    font-size: 16px !important;
    font-weight: 600 !important;
    color: #f9fafb !important;
    margin: 0 !important;
    flex: 1;
    min-width: 0;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }
  .kb-star-btn {
    display: flex;
    align-items: center;
    justify-content: center;
    width: 26px;
    height: 26px;
    flex-shrink: 0;
    margin-left: auto;
    background: transparent;
    border: none;
    border-radius: 6px;
    cursor: pointer;
    padding: 0;
    transition: opacity 0.15s, background 0.15s;
    opacity: 0;
  }
  .kb-board-card:hover .kb-star-btn,
  .kb-star-btn-active {
    opacity: 1 !important;
  }
  .kb-star-btn:hover {
    background: rgba(245,158,11,0.1);
  }
  .kb-notif-badge {
    display: inline-flex;
    align-items: center;
    gap: 3px;
    font-size: 10px;
    font-weight: 700;
    padding: 2px 6px;
    border-radius: 10px;
    background: rgba(239,68,68,0.15);
    color: #f87171;
    border: 1px solid rgba(239,68,68,0.3);
    white-space: nowrap;
    flex-shrink: 0;
    line-height: 1.2;
  }
  .kb-visibility-badge {
    display: inline-flex;
    align-items: center;
    gap: 3px;
    font-size: 9px;
    font-weight: 700;
    padding: 2px 7px;
    border-radius: 5px;
    text-transform: uppercase;
    letter-spacing: 0.04em;
    white-space: nowrap;
    flex-shrink: 0;
  }
  .kb-visibility-badge.public {
    background: rgba(34,197,94,0.12) !important;
    color: #22c55e;
    border: 1px solid rgba(34,197,94,0.25);
  }
  .kb-shared-by {
    display: flex;
    align-items: center;
    gap: 4px;
    font-size: 11px;
    color: #818cf8;
    margin-bottom: 6px;
  }
  .kb-section-label {
    font-size: 13px;
    font-weight: 700;
    color: #9ca3af;
    text-transform: uppercase;
    letter-spacing: 0.06em;
    margin: 0 0 12px 4px;
    display: flex;
    align-items: center;
    gap: 6px;
  }
  .kb-board-card-desc {
    font-size: 13px !important;
    color: #9ca3af !important;
    margin: 0 0 12px 0 !important;
    line-height: 1.4 !important;
    display: -webkit-box;
    -webkit-line-clamp: 2;
    -webkit-box-orient: vertical;
    overflow: hidden;
  }
  .kb-board-card-footer {
    display: flex;
    align-items: center;
    justify-content: space-between;
  }
  .kb-board-card-date {
    display: flex;
    align-items: center;
    gap: 4px;
    font-size: 12px;
    color: #6b7280;
  }

  /* ── Stats pills ──────────────────────────────────────────────────────── */
  .kb-stats-row {
    display: flex;
    align-items: center;
    gap: 6px;
    margin: 10px 0 8px;
  }
  .kb-stats-pills {
    display: flex;
    flex-wrap: wrap;
    gap: 5px;
    flex: 1;
    min-width: 0;
  }
  .kb-pill {
    position: relative;
    display: inline-flex;
    align-items: center;
    gap: 4px;
    font-size: 11px;
    font-weight: 600;
    padding: 3px 8px;
    border-radius: 20px;
    overflow: hidden;
    white-space: nowrap;
    flex-shrink: 0;
    z-index: 0;
  }
  .kb-pill-text {
    position: relative;
    z-index: 1;
  }
  /* Done pill — dark bg with green progress bar fill */
  .kb-pill-done {
    background: rgba(255,255,255,0.06);
    color: #d1d5db;
    border: 1px solid rgba(255,255,255,0.08);
  }
  .kb-pill-bar {
    position: absolute;
    left: 0;
    top: 0;
    bottom: 0;
    background: rgba(34,197,94,0.25);
    border-radius: 20px 0 0 20px;
    transition: width 0.4s ease;
    z-index: 0;
  }
  /* Overdue — red */
  .kb-pill-overdue {
    background: rgba(239,68,68,0.12);
    color: #f87171;
    border: 1px solid rgba(239,68,68,0.22);
  }
  /* Due today — amber */
  .kb-pill-today {
    background: rgba(245,158,11,0.12);
    color: #fbbf24;
    border: 1px solid rgba(245,158,11,0.22);
  }
  /* High/urgent priority — orange flag */
  .kb-pill-priority {
    background: rgba(249,115,22,0.12);
    color: #fb923c;
    border: 1px solid rgba(249,115,22,0.22);
  }
  /* Expand / collapse chevron */
  .kb-stats-chevron {
    background: none !important;
    border: 1px solid #2a2d3a !important;
    border-radius: 6px;
    padding: 3px 5px;
    color: #6b7280;
    cursor: pointer;
    display: flex;
    align-items: center;
    flex-shrink: 0;
    transition: color 0.15s ease, background 0.15s ease, transform 0.2s ease;
  }
  .kb-stats-chevron:hover {
    background: #23263a !important;
    color: #e5e7eb;
  }
  .kb-stats-chevron.expanded svg {
    transform: rotate(180deg);
    transition: transform 0.2s ease;
  }
  .kb-stats-chevron svg {
    transition: transform 0.2s ease;
  }

  /* ── Expanded detail grid ─────────────────────────────────────────────── */
  .kb-stats-detail {
    overflow: hidden;
    max-height: 0;
    opacity: 0;
    transform: translateY(-4px);
    transition: max-height 0.25s ease, opacity 0.2s ease, transform 0.2s ease;
    pointer-events: none;
  }
  .kb-stats-detail.expanded {
    max-height: 300px;
    opacity: 1;
    transform: translateY(0);
    pointer-events: auto;
    margin-bottom: 10px;
  }
  .kb-stats-section-label {
    font-size: 10px;
    font-weight: 700;
    color: #6b7280;
    text-transform: uppercase;
    letter-spacing: 0.07em;
    margin-bottom: 6px;
  }
  .kb-stats-grid {
    display: grid;
    grid-template-columns: repeat(3, 1fr);
    gap: 6px;
    margin-bottom: 4px;
  }
  .kb-stats-grid-3 {
    grid-template-columns: repeat(3, 1fr);
  }
  .kb-stat-cell {
    background: rgba(255,255,255,0.035);
    border: 1px solid rgba(255,255,255,0.06);
    border-radius: 8px;
    padding: 7px 8px;
    display: flex;
    flex-direction: column;
    gap: 2px;
  }
  .kb-stat-label {
    font-size: 10px;
    color: #6b7280;
    font-weight: 500;
  }
  .kb-stat-value {
    font-size: 16px;
    font-weight: 700;
    color: #e5e7eb;
    line-height: 1;
  }
  .kb-stat-green  { color: #4ade80; }
  .kb-stat-red    { color: #f87171; }
  .kb-stat-amber  { color: #fbbf24; }
  .kb-stat-blue   { color: #60a5fa; }

  /* Modal */
  .kb-modal-overlay {
    position: fixed;
    inset: 0;
    background: rgba(0,0,0,0.6);
    backdrop-filter: blur(4px);
    display: flex;
    align-items: center;
    justify-content: center;
    z-index: 50000;
    padding: 16px;
  }
  .kb-modal {
    background: #1a1d27 !important;
    border: 1px solid #2a2d3a;
    border-radius: 16px;
    padding: 28px;
    max-width: min(90vw, 480px);
    width: 100%;
    box-sizing: border-box;
    box-shadow: 0 24px 64px rgba(0,0,0,0.5);
  }
  .kb-modal-title {
    font-size: 18px !important;
    font-weight: 700 !important;
    color: #f9fafb !important;
    margin: 0 0 20px 0 !important;
  }
  .kb-modal-actions {
    display: flex;
    justify-content: flex-end;
    gap: 10px;
    margin-top: 20px;
  }

  /* Form */
  .kb-form-group { margin-bottom: 16px; }
  .kb-label {
    display: block;
    font-size: 12px !important;
    font-weight: 600 !important;
    color: #9ca3af !important;
    text-transform: uppercase;
    letter-spacing: 0.05em;
    margin-bottom: 6px !important;
  }
  .kb-input, .kb-textarea, .kb-select {
    width: 100%;
    background: #0f1117 !important;
    border: 1px solid #374151 !important;
    border-radius: 10px;
    padding: 10px 14px;
    font-size: 14px !important;
    color: #e5e7eb !important;
    outline: none;
    transition: border-color 0.15s ease;
    box-sizing: border-box;
  }
  .kb-input:focus, .kb-textarea:focus, .kb-select:focus {
    border-color: #6366f1 !important;
    box-shadow: 0 0 0 2px rgba(99,102,241,0.2);
  }
  .kb-textarea {
    resize: vertical;
    min-height: 80px;
    font-family: inherit;
  }

  /* Loading / Empty */
  .kb-loading, .kb-empty {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    padding: 80px 20px;
    text-align: center;
  }
  .kb-spinner {
    width: 32px;
    height: 32px;
    border: 3px solid #374151;
    border-top-color: #6366f1;
    border-radius: 50%;
    animation: kb-spin 0.8s linear infinite;
    margin-bottom: 16px;
  }
  @keyframes kb-spin {
    to { transform: rotate(360deg); }
  }

  /* User menu */
  .kb-user-avatar-btn {
    width: 36px;
    height: 36px;
    border-radius: 50%;
    background: #2a2d3a;
    border: 2px solid #374151;
    color: #e5e7eb;
    font-size: 15px;
    font-weight: 700;
    display: flex;
    align-items: center;
    justify-content: center;
    cursor: pointer;
    transition: all 0.15s ease;
  }
  .kb-user-avatar-btn:hover {
    border-color: #6366f1;
    background: #1e293b;
  }
  .kb-click-away {
    position: fixed;
    inset: 0;
    z-index: 49999;
  }
  .kb-user-dropdown {
    position: absolute;
    top: calc(100% + 8px);
    right: 0;
    background: #1a1d27;
    border: 1px solid #2a2d3a;
    border-radius: 12px;
    width: 280px;
    box-shadow: 0 16px 48px rgba(0,0,0,0.5);
    z-index: 50000;
    overflow: hidden;
  }
  .kb-user-dropdown-header {
    padding: 14px 16px 10px;
    border-bottom: 1px solid #2a2d3a;
  }
  .kb-user-dropdown-email {
    font-size: 12px;
    color: #9ca3af;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }
  .kb-user-dropdown-section {
    padding: 12px 16px;
  }
  .kb-user-dropdown-label {
    font-size: 10px;
    font-weight: 700;
    color: #6b7280;
    text-transform: uppercase;
    letter-spacing: 0.06em;
    margin-bottom: 8px;
  }
  .kb-user-name-display {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 8px;
  }
  .kb-user-name-value {
    font-size: 14px;
    color: #e5e7eb;
    font-weight: 600;
  }
  .kb-user-name-edit {
    display: flex;
    align-items: center;
    gap: 6px;
  }
  .kb-user-name-edit .kb-input {
    flex: 1;
    min-width: 0;
  }
  .kb-user-dropdown-divider {
    height: 1px;
    background: #2a2d3a;
  }
  .kb-user-dropdown-item {
    display: block;
    width: 100%;
    padding: 10px 16px;
    border: none;
    background: none;
    color: #e5e7eb;
    font-size: 13px;
    font-weight: 500;
    text-align: left;
    cursor: pointer;
    transition: background 0.12s ease;
  }
  .kb-user-dropdown-item:hover {
    background: #1f2937;
  }
  .kb-user-dropdown-item.danger {
    color: #ef4444;
  }
  .kb-user-dropdown-item.danger:hover {
    background: rgba(239,68,68,0.1);
  }

  /* Icon picker grid */
  .kb-icon-grid {
    display: flex;
    flex-wrap: wrap;
    gap: 6px;
  }
  .kb-icon-option {
    width: 36px;
    height: 36px;
    display: flex;
    align-items: center;
    justify-content: center;
    border-radius: 8px;
    border: 1.5px solid #2a2d3a;
    background: #1a1d27 !important;
    color: #9ca3af;
    cursor: pointer;
    transition: all 0.12s ease;
    padding: 0;
  }
  .kb-icon-option:hover {
    border-color: #6366f1;
    color: #e5e7eb;
    background: #23263a !important;
  }
  .kb-icon-option.selected {
    border-color: #818cf8;
    background: rgba(99,102,241,0.18) !important;
    color: #818cf8;
    box-shadow: 0 0 0 1px rgba(99,102,241,0.3);
  }
  .kb-icon-color-grid {
    display: flex;
    flex-wrap: wrap;
    gap: 6px;
  }
  .kb-color-swatch {
    width: 22px;
    height: 22px;
    border-radius: 6px;
    border: 2px solid transparent;
    cursor: pointer;
    padding: 0;
    transition: all 0.12s ease;
    box-sizing: border-box;
    -webkit-appearance: none;
    appearance: none;
    outline: none;
  }
  .kb-color-swatch:hover {
    transform: scale(1.15);
    border-color: rgba(255,255,255,0.4);
  }
  .kb-color-swatch.selected {
    border-color: #fff;
    box-shadow: 0 0 0 2px rgba(255,255,255,0.25);
    transform: scale(1.15);
  }
  .kb-hex-row {
    display: flex;
    align-items: center;
    gap: 6px;
    margin-top: 8px;
  }
  .kb-hex-label {
    font-size: 13px;
    font-weight: 600;
    color: #6b7280;
  }
  .kb-hex-input {
    flex: 1;
    background: #0f1117;
    border: 1px solid #2a2d3a;
    border-radius: 6px;
    color: #e5e7eb;
    font-size: 12px;
    font-family: monospace;
    padding: 5px 8px;
    outline: none;
    min-width: 0;
  }
  .kb-hex-input:focus {
    border-color: #6366f1;
  }
  .kb-hex-input::placeholder {
    color: #4b5563;
  }

  /* ── Responsive ── */
  @media (max-width: 768px) {
    .kb-header { flex-wrap: wrap; gap: 8px; }
    .kb-page-title { font-size: 20px !important; }
    .kb-board-grid { grid-template-columns: 1fr; }
    .kb-modal { max-width: min(90vw, 380px); padding: 20px; }
    .kb-modal-title { font-size: 16px !important; }
    .kb-user-dropdown { width: min(90vw, 260px); }
    .kb-board-card { padding: 16px; }
    .kb-icon-option { width: 32px; height: 32px; }
  }
`;
