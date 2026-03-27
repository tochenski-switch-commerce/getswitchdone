'use client';

import React, { useState, useEffect, useMemo } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { useProjectBoard } from '@/hooks/useProjectBoard';
import type { BoardCard } from '@/types/board-types';
import FlameLoader from '@/components/FlameLoader';
import {
  ArrowLeft, Search, FolderKanban, Printer,
  ChevronDown,
  getBoardIcon, DEFAULT_ICON_COLOR,
} from '@/components/BoardIcons';
import { PRIORITY_CONFIG, PRIORITY_WEIGHT } from '@/components/board-detail/helpers';
import {
  getTodayStr,
  computeSummary,
computePriorityBreakdown,
  computeAssigneeWorkload,
  computeTimeline,
  filterCards,
} from '@/components/board-overview/overviewMetrics';
import { overviewStyles } from '@/components/board-overview/overview-styles';

const PRIORITY_ORDER = ['urgent', 'high', 'medium', 'low', 'none'] as const;

const fmtDate = (d: string | null | undefined) => {
  if (!d) return '—';
  const [y, m, day] = d.split('-');
  return `${m}-${day}-${y}`;
};

const esc = (s: string) => s
  .replace(/&/g, '&amp;')
  .replace(/</g, '&lt;')
  .replace(/>/g, '&gt;')
  .replace(/"/g, '&quot;');

const PRIORITY_PRINT: Record<string, { color: string; bg: string; label: string }> = {
  urgent: { color: '#dc2626', bg: '#fee2e2', label: 'URGENT' },
  high:   { color: '#c2410c', bg: '#ffedd5', label: 'HIGH' },
  medium: { color: '#b45309', bg: '#fef3c7', label: 'MEDIUM' },
  low:    { color: '#16a34a', bg: '#dcfce7', label: 'LOW' },
};

// Shared base CSS for all print windows.
// @page margin:0 removes the browser-generated running header/footer.
// Body padding provides content clearance instead.
const PRINT_BASE_CSS = `
  @page { size: landscape; margin: 0; }
  * { box-sizing: border-box; }
  body {
    font-family: -apple-system, BlinkMacSystemFont, 'Helvetica Neue', Arial, sans-serif;
    color: #0f172a; background: #fff; margin: 0;
    padding: 14mm 12mm;
    -webkit-print-color-adjust: exact; print-color-adjust: exact;
  }
  .doc-hdr { display: flex; align-items: flex-end; justify-content: space-between; border-bottom: 2px solid #e2e8f0; padding-bottom: 10px; margin-bottom: 16px; }
  .doc-title { font-size: 18px; font-weight: 700; margin: 0 0 3px; color: #0f172a; }
  .doc-sub { font-size: 11px; color: #64748b; margin: 0; }
  .doc-date { font-size: 11px; color: #94a3b8; }
  .section-hdr { font-size: 11px; font-weight: 700; text-transform: uppercase; letter-spacing: .07em; color: #64748b; margin: 18px 0 8px; padding-bottom: 6px; border-bottom: 1px solid #e2e8f0; }
  .group-label { font-size: 10px; font-weight: 700; text-transform: uppercase; letter-spacing: .07em; margin: 12px 0 4px; display: flex; align-items: center; gap: 6px; }
  .group-count { font-size: 10px; font-weight: 600; padding: 1px 6px; border-radius: 8px; background: #f1f5f9; color: #64748b; }
  table { width: 100%; border-collapse: collapse; font-size: 12px; margin-bottom: 6px; }
  thead th { background: #f1f5f9; font-size: 9.5px; font-weight: 700; text-transform: uppercase; letter-spacing: .06em; color: #64748b; padding: 6px 10px; text-align: left; border-bottom: 2px solid #cbd5e1; white-space: nowrap; }
  thead th.center { text-align: center; }
  tbody td { padding: 6px 10px; border-bottom: 1px solid #e2e8f0; vertical-align: middle; }
  tbody tr:nth-child(even) td { background: #f8fafc; }
  tbody tr:last-child td { border-bottom: none; }
  .ftr { margin-top: 12px; font-size: 10px; color: #94a3b8; display: flex; justify-content: space-between; }
  .page-break { page-break-before: always; }
`;

const openPrint = (title: string, bodyHtml: string) => {
  const html = `<!DOCTYPE html><html><head><meta charset="UTF-8"><title>${esc(title)}</title><style>${PRINT_BASE_CSS}</style></head><body>${bodyHtml}</body></html>`;
  const win = window.open('', '_blank', 'width=1100,height=800');
  if (!win) return;
  win.document.write(html);
  win.document.close();
  win.focus();
  setTimeout(() => { win.print(); win.close(); }, 350);
};

const priorityBadge = (priority: string | null | undefined) => {
  const p = priority ? PRIORITY_PRINT[priority] : null;
  return p
    ? `<span style="font-size:9px;font-weight:700;text-transform:uppercase;letter-spacing:.05em;padding:2px 7px;border-radius:3px;background:${p.bg};color:${p.color}">${p.label}</span>`
    : '<span style="color:#94a3b8">—</span>';
};

export default function BoardOverviewPage() {
  const params = useParams();
  const router = useRouter();
  const boardId = params?.id as string;
  const { fetchBoard, board, userProfiles, loading } = useProjectBoard();

  const [searchText, setSearchText] = useState('');
  const [filterPriority, setFilterPriority] = useState('');
  const [filterAssignee, setFilterAssignee] = useState('');
  const [filterDone, setFilterDone] = useState<'' | 'yes' | 'no'>('');
  const [sortCol, setSortCol] = useState<'title' | 'column' | 'priority' | 'assignee' | 'due' | 'done' | null>(null);
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('asc');

  useEffect(() => {
    if (boardId) fetchBoard(boardId);
  }, [boardId]); // eslint-disable-line react-hooks/exhaustive-deps

  const todayStr = useMemo(() => getTodayStr(), []);

  const summary = useMemo(() => board ? computeSummary(board, todayStr) : null, [board, todayStr]);
const priorityBreakdown = useMemo(() => board ? computePriorityBreakdown(board) : null, [board]);
  const assigneeWorkload = useMemo(() => board ? computeAssigneeWorkload(board, userProfiles, todayStr) : [], [board, userProfiles, todayStr]);
  const timeline = useMemo(() => board ? computeTimeline(board, todayStr) : null, [board, todayStr]);

  const columnById = useMemo(() => {
    if (!board) return new Map<string, string>();
    return new Map(board.columns.map(c => [c.id, c.title]));
  }, [board]);

  const filteredCards = useMemo(() => {
    if (!board) return [];
    return filterCards(board.cards, searchText, filterPriority, filterAssignee, filterDone);
  }, [board, searchText, filterPriority, filterAssignee, filterDone]);

  const sortedCards = useMemo(() => {
    if (!sortCol) return filteredCards;
    const dir = sortDir === 'asc' ? 1 : -1;
    const profileMap = new Map(userProfiles.map(p => [p.id, p.name]));
    const getAssigneeName = (card: BoardCard) => {
      const ids = (card.assignees && card.assignees.length > 0) ? card.assignees : (card.assignee ? [card.assignee] : []);
      return ids.length > 0 ? (profileMap.get(ids[0]) ?? '\uffff') : '\uffff';
    };
    return [...filteredCards].sort((a, b) => {
      switch (sortCol) {
        case 'title':
          return dir * a.title.localeCompare(b.title);
        case 'column': {
          const ca = columnById.get(a.column_id) ?? '';
          const cb = columnById.get(b.column_id) ?? '';
          return dir * ca.localeCompare(cb);
        }
        case 'priority': {
          const wa = PRIORITY_WEIGHT[a.priority ?? 'none'] ?? 4;
          const wb = PRIORITY_WEIGHT[b.priority ?? 'none'] ?? 4;
          return dir * (wa - wb);
        }
        case 'assignee':
          return dir * getAssigneeName(a).localeCompare(getAssigneeName(b));
        case 'due': {
          const da = a.due_date ?? '\uffff';
          const db = b.due_date ?? '\uffff';
          return dir * da.localeCompare(db);
        }
        case 'done':
          return dir * ((a.is_complete ? 1 : 0) - (b.is_complete ? 1 : 0));
        default:
          return 0;
      }
    });
  }, [filteredCards, sortCol, sortDir, columnById, userProfiles]);

  const handleSort = (col: typeof sortCol) => {
    if (sortCol === col) {
      setSortDir(d => d === 'asc' ? 'desc' : 'asc');
    } else {
      setSortCol(col);
      setSortDir('asc');
    }
  };

  // Unique assignees for the filter dropdown
  const assigneeOptions = useMemo(() => {
    if (!board) return [];
    const seen = new Set<string>();
    for (const card of board.cards) {
      if (card.is_archived) continue;
      const ids = (card.assignees && card.assignees.length > 0) ? card.assignees : (card.assignee ? [card.assignee] : []);
      for (const id of ids) seen.add(id);
    }
    return Array.from(seen).map(id => ({
      id,
      name: userProfiles.find(p => p.id === id)?.name ?? id.slice(0, 8),
    })).sort((a, b) => a.name.localeCompare(b.name));
  }, [board, userProfiles]);

  const handleCardClick = (card: BoardCard) => {
    router.push(`/boards/${boardId}?card=${card.id}`);
  };

  const buildTimelineHtml = () => {
    if (!timeline) return '';
    const profileById = new Map(userProfiles.map(p => [p.id, p.name]));
    const getAssignee = (card: BoardCard) => {
      const ids = (card.assignees && card.assignees.length > 0) ? card.assignees : (card.assignee ? [card.assignee] : []);
      return ids.length > 0 ? (profileById.get(ids[0]) ?? '—') : '—';
    };
    const groups = [
      { label: 'Overdue',        cards: timeline.overdue,    color: '#dc2626' },
      { label: 'Due Today',      cards: timeline.today,      color: '#d97706' },
      { label: 'Due This Week',  cards: timeline.thisWeek,   color: '#7c3aed' },
      { label: 'Due This Month', cards: timeline.thisMonth,  color: '#4b5563' },
      { label: 'No Due Date',    cards: timeline.noDate,     color: '#9ca3af' },
    ].filter(g => g.cards.length > 0);

    const groupsHtml = groups.map(({ label, cards, color }) => {
      const rows = cards.map(card => `<tr>
        <td style="max-width:300px;word-break:break-word">${esc(card.title)}</td>
        <td style="color:#475569;white-space:nowrap">${esc(columnById.get(card.column_id) ?? '—')}</td>
        <td>${priorityBadge(card.priority)}</td>
        <td style="color:#475569;white-space:nowrap">${esc(getAssignee(card))}</td>
        <td style="color:#475569;white-space:nowrap">${fmtDate(card.due_date)}</td>
      </tr>`).join('');
      return `
        <div class="group-label" style="color:${color}">${esc(label)}<span class="group-count">${cards.length}</span></div>
        <table>
          <thead><tr><th>Card</th><th>Column</th><th>Priority</th><th>Assignee</th><th>Due</th></tr></thead>
          <tbody>${rows}</tbody>
        </table>`;
    }).join('');
    return groupsHtml;
  };

  const buildCardSearchHtml = () => {
    const profileById = new Map(userProfiles.map(p => [p.id, p.name]));
    const totalNonArchived = board?.cards.filter(c => !c.is_archived).length ?? 0;
    const rows = sortedCards.map(card => {
      const assignees = (card.assignees && card.assignees.length > 0) ? card.assignees : (card.assignee ? [card.assignee] : []);
      const assigneeNames = assignees.map(id => profileById.get(id) ?? id.slice(0, 8)).join(', ') || '—';
      const doneCell = card.is_complete
        ? '<span style="color:#16a34a;font-weight:600">Yes</span>'
        : '<span style="color:#94a3b8">No</span>';
      return `<tr>
        <td style="max-width:320px;word-break:break-word">${esc(card.title)}</td>
        <td style="color:#475569;white-space:nowrap">${esc(columnById.get(card.column_id) ?? '—')}</td>
        <td>${priorityBadge(card.priority)}</td>
        <td style="color:#475569;white-space:nowrap">${esc(assigneeNames)}</td>
        <td style="color:#475569;white-space:nowrap">${fmtDate(card.due_date)}</td>
        <td style="text-align:center">${doneCell}</td>
      </tr>`;
    }).join('');
    return { rows, totalNonArchived };
  };

  const handlePrint = () => {
    const boardTitle = esc(board?.title ?? 'Board');
    const printedAt = new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' });
    const { rows, totalNonArchived } = buildCardSearchHtml();
    const body = `
      <div class="doc-hdr">
        <div>
          <div class="doc-title">${boardTitle} — Card Search</div>
          <div class="doc-sub">${sortedCards.length} of ${totalNonArchived} cards</div>
        </div>
        <div class="doc-date">Printed ${printedAt}</div>
      </div>
      <table>
        <thead><tr><th>Card</th><th>Column</th><th>Priority</th><th>Assignee</th><th>Due</th><th class="center">Done</th></tr></thead>
        <tbody>${rows}</tbody>
      </table>
      <div class="ftr"><span>Lumio · ${boardTitle}</span><span>${sortedCards.length} cards</span></div>`;
    openPrint(`${board?.title ?? 'Board'} — Card Search`, body);
  };

  const handlePrintTimeline = () => {
    if (!timeline) return;
    const boardTitle = esc(board?.title ?? 'Board');
    const printedAt = new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' });
    const totalCards = [timeline.overdue, timeline.today, timeline.thisWeek, timeline.thisMonth, timeline.noDate].reduce((n, g) => n + g.length, 0);
    const body = `
      <div class="doc-hdr">
        <div>
          <div class="doc-title">${boardTitle} — Timeline &amp; Due Dates</div>
          <div class="doc-sub">${totalCards} cards</div>
        </div>
        <div class="doc-date">Printed ${printedAt}</div>
      </div>
      ${buildTimelineHtml()}
      <div class="ftr"><span>Lumio · ${boardTitle}</span><span>${totalCards} cards</span></div>`;
    openPrint(`${board?.title ?? 'Board'} — Timeline`, body);
  };

  const handlePrintAll = () => {
    const boardTitle = esc(board?.title ?? 'Board');
    const printedAt = new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' });
    const { rows, totalNonArchived } = buildCardSearchHtml();
    const timelineTotal = timeline
      ? [timeline.overdue, timeline.today, timeline.thisWeek, timeline.thisMonth, timeline.noDate].reduce((n, g) => n + g.length, 0)
      : 0;
    const body = `
      <div class="doc-hdr">
        <div>
          <div class="doc-title">${boardTitle} — Overview Report</div>
          <div class="doc-sub">Timeline &amp; Due Dates · Card Search</div>
        </div>
        <div class="doc-date">Printed ${printedAt}</div>
      </div>

      <div class="section-hdr">Timeline &amp; Due Dates <span style="font-weight:400;text-transform:none;letter-spacing:0">(${timelineTotal} cards)</span></div>
      ${buildTimelineHtml()}

      <div class="section-hdr page-break">Card Search <span style="font-weight:400;text-transform:none;letter-spacing:0">(${sortedCards.length} of ${totalNonArchived})</span></div>
      <table>
        <thead><tr><th>Card</th><th>Column</th><th>Priority</th><th>Assignee</th><th>Due</th><th class="center">Done</th></tr></thead>
        <tbody>${rows}</tbody>
      </table>
      <div class="ftr"><span>Lumio · ${boardTitle}</span><span>${sortedCards.length + timelineTotal} total cards</span></div>`;
    openPrint(`${board?.title ?? 'Board'} — Overview Report`, body);
  };

  if (loading || !board || !summary) {
    return (
      <div className="kb-ov-root">
        <style>{overviewStyles}</style>
        <div className="kb-ov-loading"><FlameLoader delay={400} size={56} /></div>
      </div>
    );
  }

  const BoardIcon = board.icon ? getBoardIcon(board.icon) : FolderKanban;
  const iconColor = board.icon_color || DEFAULT_ICON_COLOR;

  return (
    <div className="kb-ov-root">
      <style>{overviewStyles}</style>

      {/* ── Header ── */}
      <div className="kb-ov-header">
        <div className="kb-ov-header-left">
          <button className="kb-ov-back-btn" onClick={() => router.push(`/boards/${boardId}`)}>
            <ArrowLeft size={14} /> Board
          </button>
          <div className="kb-ov-header-title">
            <BoardIcon size={18} style={{ color: iconColor, flexShrink: 0 }} />
            {board.title}
          </div>
          <div className="kb-ov-completion-badge">
            {summary.completionPct}% done
          </div>
        </div>
        <div className="kb-ov-header-actions">
          <button className="kb-ov-print-btn" onClick={handlePrintAll}>
            <Printer size={13} /> Print All
          </button>
        </div>
      </div>

      <div className="kb-ov-body">

        {/* ── Summary Strip ── */}
        <div className="kb-ov-summary-strip">
          <div className="kb-ov-stat-card">
            <div className="kb-ov-stat-label">Total Cards</div>
            <div className="kb-ov-stat-value">{summary.total}</div>
            <div className="kb-ov-stat-sub">{summary.completed} completed</div>
          </div>
          <div className={`kb-ov-stat-card ${summary.completionPct >= 80 ? 'success' : summary.completionPct >= 40 ? '' : ''}`}>
            <div className="kb-ov-stat-label">Completion</div>
            <div className="kb-ov-stat-value">{summary.completionPct}%</div>
            <div className="kb-ov-stat-sub">{summary.completed} of {summary.total}</div>
          </div>
          <div className={`kb-ov-stat-card ${summary.overdue > 0 ? 'danger' : ''}`}>
            <div className="kb-ov-stat-label">Overdue</div>
            <div className="kb-ov-stat-value">{summary.overdue}</div>
            <div className="kb-ov-stat-sub">{summary.dueToday} due today</div>
          </div>
          <div className={`kb-ov-stat-card ${summary.highPriorityCount > 0 ? 'warning' : ''}`}>
            <div className="kb-ov-stat-label">High Priority</div>
            <div className="kb-ov-stat-value">{summary.highPriorityCount}</div>
            <div className="kb-ov-stat-sub">urgent + high</div>
          </div>
        </div>


        {/* ── Priority Breakdown ── */}
        {priorityBreakdown && priorityBreakdown.total > 0 && (
          <div className="kb-ov-section">
            <div className="kb-ov-section-heading">Priority Breakdown</div>
            {PRIORITY_ORDER.map(key => {
              const count = key === 'none' ? priorityBreakdown.none : priorityBreakdown[key];
              if (count === 0) return null;
              const cfg = key !== 'none' ? PRIORITY_CONFIG[key] : null;
              const color = cfg ? cfg.color : '#4b5563';
              const label = cfg ? cfg.label : 'No Priority';
              const pct = priorityBreakdown.total > 0 ? Math.round((count / priorityBreakdown.total) * 100) : 0;
              return (
                <div key={key} className="kb-ov-priority-row">
                  <div className="kb-ov-priority-label" style={{ color }}>
                    {label}
                  </div>
                  <div className="kb-ov-bar-wrap">
                    <div className="kb-ov-bar-fill" style={{ width: `${pct}%`, background: color, opacity: 0.65 }} />
                  </div>
                  <div className="kb-ov-priority-count" style={{ color }}>{count}</div>
                </div>
              );
            })}
          </div>
        )}

        {/* ── Assignee Workload ── */}
        {assigneeWorkload.length > 0 && (
          <div className="kb-ov-section">
            <div className="kb-ov-section-heading">Assignee Workload</div>
            <table className="kb-ov-assignee-table">
              <thead>
                <tr>
                  <th>Assignee</th>
                  <th>Total</th>
                  <th>Done</th>
                  <th>Overdue</th>
                  <th>%</th>
                </tr>
              </thead>
              <tbody>
                {assigneeWorkload.map(({ userId, name, total, completed, overdue, completionPct }) => (
                  <tr key={userId ?? '__unassigned__'}>
                    <td className="kb-ov-assignee-name">{name}</td>
                    <td>{total}</td>
                    <td style={{ color: '#34d399' }}>{completed}</td>
                    <td style={{ color: overdue > 0 ? '#f87171' : '#6b7280' }}>{overdue}</td>
                    <td style={{ color: completionPct >= 75 ? '#34d399' : '#9ca3af' }}>{completionPct}%</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {/* ── Timeline / Due Dates ── */}
        {timeline && (
          <div className="kb-ov-section">
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
              <div className="kb-ov-section-heading" style={{ marginBottom: 0 }}>Timeline &amp; Due Dates</div>
              <button className="kb-ov-print-btn" onClick={handlePrintTimeline}>
                <Printer size={13} /> Print
              </button>
            </div>
            {[
              { label: 'Overdue', cards: timeline.overdue, color: '#f87171' },
              { label: 'Due Today', cards: timeline.today, color: '#fbbf24' },
              { label: 'Due This Week', cards: timeline.thisWeek, color: '#a5b4fc' },
              { label: 'Due This Month', cards: timeline.thisMonth, color: '#6b7280' },
              { label: 'No Due Date', cards: timeline.noDate, color: '#374151' },
            ].filter(g => g.cards.length > 0).map(({ label, cards, color }) => (
              <div key={label} className="kb-ov-timeline-group">
                <div className="kb-ov-timeline-group-header" style={{ color }}>
                  {label}
                  <span className="kb-ov-timeline-count">{cards.length}</span>
                </div>
                {cards.map(card => (
                  <TimelineCardRow
                    key={card.id}
                    card={card}
                    columnName={columnById.get(card.column_id) ?? ''}
                    profiles={userProfiles}
                    onClick={() => handleCardClick(card)}
                  />
                ))}
              </div>
            ))}
          </div>
        )}

        {/* ── Card Search & Filter ── */}
        <div className="kb-ov-section">
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
            <div className="kb-ov-section-heading" style={{ marginBottom: 0 }}>
              <Search size={13} /> Card Search
            </div>
            <button className="kb-ov-print-btn" onClick={handlePrint}>
              <Printer size={13} /> Print
            </button>
          </div>
          <div className="kb-ov-filter-bar">
            <div className="kb-ov-search-wrap">
              <span className="kb-ov-search-icon"><Search size={13} /></span>
              <input
                className="kb-ov-search-input"
                placeholder="Search cards…"
                value={searchText}
                onChange={e => setSearchText(e.target.value)}
              />
            </div>
            <select
              className="kb-ov-filter-select"
              value={filterPriority}
              onChange={e => setFilterPriority(e.target.value)}
            >
              <option value="">All Priorities</option>
              <option value="urgent">Urgent</option>
              <option value="high">High</option>
              <option value="medium">Medium</option>
              <option value="low">Low</option>
            </select>
            <select
              className="kb-ov-filter-select"
              value={filterAssignee}
              onChange={e => setFilterAssignee(e.target.value)}
            >
              <option value="">All Assignees</option>
              {assigneeOptions.map(a => (
                <option key={a.id} value={a.id}>{a.name}</option>
              ))}
            </select>
            <select
              className="kb-ov-filter-select"
              value={filterDone}
              onChange={e => setFilterDone(e.target.value as '' | 'yes' | 'no')}
            >
              <option value="">All</option>
              <option value="no">Not Done</option>
              <option value="yes">Done</option>
            </select>
            <span className="kb-ov-filter-count">
              {filteredCards.length} of {board.cards.filter(c => !c.is_archived).length}
            </span>
          </div>
          {sortedCards.length === 0 ? (
            <div className="kb-ov-empty">No cards match your filters.</div>
          ) : (
            <div className="kb-ov-card-table-wrap">
              <table className="kb-ov-card-table">
                <thead>
                  <tr>
                    {(['title', 'column', 'priority', 'assignee', 'due', 'done'] as const).map((col, i) => (
                      <th
                        key={col}
                        className="kb-ov-sort-th"
                        onClick={() => handleSort(col)}
                        style={{ cursor: 'pointer', userSelect: 'none', textAlign: i === 0 ? 'left' : undefined }}
                      >
                        <span className="kb-ov-sort-th-inner">
                          {col === 'title' ? 'Card' : col.charAt(0).toUpperCase() + col.slice(1)}
                          {sortCol === col
                            ? <ChevronDown size={11} style={{ transform: sortDir === 'asc' ? 'rotate(180deg)' : 'none', transition: 'transform 0.15s' }} />
                            : <span style={{ width: 11, display: 'inline-block' }} />}
                        </span>
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {sortedCards.map(card => {
                    const priorityCfg = card.priority ? PRIORITY_CONFIG[card.priority] : null;
                    const assignees = (card.assignees && card.assignees.length > 0) ? card.assignees : (card.assignee ? [card.assignee] : []);
                    const assigneeNames = assignees.map(id => userProfiles.find(p => p.id === id)?.name ?? id.slice(0, 8)).join(', ');
                    return (
                      <tr key={card.id} onClick={() => handleCardClick(card)}>
                        <td style={{ maxWidth: 240 }}>
                          <span style={{ display: 'block', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                            {card.title}
                          </span>
                        </td>
                        <td style={{ color: '#6b7280', whiteSpace: 'nowrap' }}>{columnById.get(card.column_id) ?? '—'}</td>
                        <td>
                          {priorityCfg ? (
                            <span
                              className="kb-ov-priority-badge"
                              style={{ color: priorityCfg.color, background: priorityCfg.bg }}
                            >
                              {priorityCfg.label}
                            </span>
                          ) : '—'}
                        </td>
                        <td style={{ color: '#9ca3af', whiteSpace: 'nowrap' }}>{assigneeNames || '—'}</td>
                        <td style={{ color: '#9ca3af', whiteSpace: 'nowrap' }}>{fmtDate(card.due_date)}</td>
                        <td style={{ color: card.is_complete ? '#34d399' : '#4b5563' }}>{card.is_complete ? 'Yes' : 'No'}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>

      </div>

    </div>
  );
}

// ── Timeline card row ─────────────────────────────────────────
function TimelineCardRow({
  card,
  columnName,
  profiles,
  onClick,
}: {
  card: BoardCard;
  columnName: string;
  profiles: { id: string; name: string }[];
  onClick: () => void;
}) {
  const priorityCfg = card.priority ? PRIORITY_CONFIG[card.priority] : null;
  const assignees = (card.assignees && card.assignees.length > 0) ? card.assignees : (card.assignee ? [card.assignee] : []);
  const assigneeName = assignees.length > 0
    ? (profiles.find(p => p.id === assignees[0])?.name ?? assignees[0].slice(0, 8))
    : null;

  return (
    <div className="kb-ov-card-row" onClick={onClick}>
      <span className="kb-ov-card-title">{card.title}</span>
      <span className="kb-ov-card-meta">{columnName}</span>
      {priorityCfg ? (
        <span
          className="kb-ov-priority-badge"
          style={{ color: priorityCfg.color, background: priorityCfg.bg }}
        >
          {priorityCfg.label}
        </span>
      ) : <span />}
      <span className="kb-ov-card-meta">{assigneeName ?? '—'}</span>
    </div>
  );
}
