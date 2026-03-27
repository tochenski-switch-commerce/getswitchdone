'use client';

import { useState } from 'react';
import type { UserProfile } from '@/types/board-types';
import type { FullBoard } from '@/hooks/useProjectBoard';
import { X, Download } from '@/components/BoardIcons';
import { PRIORITY_CONFIG } from '@/components/board-detail/helpers';
import {
  getTodayStr,
  computeSummary,
  computeColumnBreakdown,
  computePriorityBreakdown,
  computeAssigneeWorkload,
  computeTimeline,
} from './overviewMetrics';

const SECTIONS = [
  { id: 'summary',   label: 'Summary Metrics' },
  { id: 'columns',   label: 'Column Progress' },
  { id: 'priority',  label: 'Priority Breakdown' },
  { id: 'assignees', label: 'Assignee Workload' },
  { id: 'timeline',  label: 'Timeline / Due Dates' },
  { id: 'cards',     label: 'All Cards (full detail)' },
] as const;

type SectionId = (typeof SECTIONS)[number]['id'];

export default function ExportModal({
  board,
  userProfiles,
  todayStr,
  onClose,
}: {
  board: FullBoard;
  userProfiles: UserProfile[];
  todayStr: string;
  onClose: () => void;
}) {
  const [selected, setSelected] = useState<Set<SectionId>>(new Set(SECTIONS.map(s => s.id)));
  const [exporting, setExporting] = useState(false);

  const toggle = (id: SectionId) => {
    setSelected(prev => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  };

  const handleExport = async () => {
    if (selected.size === 0) return;
    setExporting(true);
    try {
      const XLSX = await import('xlsx');

      const wb = XLSX.utils.book_new();
      const profileById = new Map(userProfiles.map(p => [p.id, p.name]));

      const resolveAssignee = (card: typeof board.cards[number]): string => {
        const ids = (card.assignees && card.assignees.length > 0)
          ? card.assignees
          : (card.assignee ? [card.assignee] : []);
        return ids.map(id => profileById.get(id) ?? id.slice(0, 8)).join(', ') || '—';
      };

      // ── Summary ──
      if (selected.has('summary')) {
        const s = computeSummary(board, todayStr);
        const rows = [
          ['Metric', 'Value'],
          ['Board', board.title],
          ['Total Cards', s.total],
          ['Completed', s.completed],
          ['Completion Rate', `${s.completionPct}%`],
          ['Overdue', s.overdue],
          ['Due Today', s.dueToday],
          ['Due This Week', s.dueThisWeek],
          ['High/Urgent Priority', s.highPriorityCount],
        ];
        const ws = XLSX.utils.aoa_to_sheet(rows);
        ws['!cols'] = [{ wch: 22 }, { wch: 14 }];
        XLSX.utils.book_append_sheet(wb, ws, 'Summary');
      }

      // ── Column Progress ──
      if (selected.has('columns')) {
        const breakdown = computeColumnBreakdown(board);
        const rows = [
          ['Column', 'Total Cards', 'Completed', 'Completion %'],
          ...breakdown.map(({ column, total, completed, pct }) => [
            column.title, total, completed, `${pct}%`,
          ]),
        ];
        const ws = XLSX.utils.aoa_to_sheet(rows);
        ws['!cols'] = [{ wch: 22 }, { wch: 12 }, { wch: 12 }, { wch: 14 }];
        XLSX.utils.book_append_sheet(wb, ws, 'Column Progress');
      }

      // ── Priority Breakdown ──
      if (selected.has('priority')) {
        const p = computePriorityBreakdown(board);
        const entries: [string, number][] = [
          ['Urgent', p.urgent],
          ['High', p.high],
          ['Medium', p.medium],
          ['Low', p.low],
          ['No Priority', p.none],
        ];
        const rows = [
          ['Priority', 'Card Count', '% of Active'],
          ...entries.map(([label, count]) => [
            label,
            count,
            p.total > 0 ? `${Math.round((count / p.total) * 100)}%` : '0%',
          ]),
        ];
        const ws = XLSX.utils.aoa_to_sheet(rows);
        ws['!cols'] = [{ wch: 16 }, { wch: 12 }, { wch: 14 }];
        XLSX.utils.book_append_sheet(wb, ws, 'Priority Breakdown');
      }

      // ── Assignee Workload ──
      if (selected.has('assignees')) {
        const workload = computeAssigneeWorkload(board, userProfiles, todayStr);
        const rows = [
          ['Assignee', 'Total Assigned', 'Completed', 'Overdue', 'Completion %'],
          ...workload.map(({ name, total, completed, overdue, completionPct }) => [
            name, total, completed, overdue, `${completionPct}%`,
          ]),
        ];
        const ws = XLSX.utils.aoa_to_sheet(rows);
        ws['!cols'] = [{ wch: 22 }, { wch: 16 }, { wch: 12 }, { wch: 10 }, { wch: 14 }];
        XLSX.utils.book_append_sheet(wb, ws, 'Assignee Workload');
      }

      // ── Timeline ──
      if (selected.has('timeline')) {
        const tl = computeTimeline(board, todayStr);
        const colById = new Map(board.columns.map(c => [c.id, c.title]));
        const buckets: [string, typeof board.cards][] = [
          ['Overdue', tl.overdue],
          ['Due Today', tl.today],
          ['Due This Week', tl.thisWeek],
          ['Due This Month', tl.thisMonth],
          ['No Due Date', tl.noDate],
        ];
        const rows: (string | number | null)[][] = [
          ['Bucket', 'Title', 'Column', 'Priority', 'Assignee', 'Due Date'],
        ];
        for (const [bucket, cards] of buckets) {
          for (const card of cards) {
            const priorityCfg = card.priority ? PRIORITY_CONFIG[card.priority] : null;
            rows.push([
              bucket,
              card.title,
              colById.get(card.column_id) ?? '—',
              priorityCfg ? priorityCfg.label : '—',
              resolveAssignee(card),
              card.due_date ?? '—',
            ]);
          }
        }
        const ws = XLSX.utils.aoa_to_sheet(rows);
        ws['!cols'] = [{ wch: 16 }, { wch: 40 }, { wch: 18 }, { wch: 10 }, { wch: 22 }, { wch: 12 }];
        XLSX.utils.book_append_sheet(wb, ws, 'Timeline');
      }

      // ── All Cards ──
      if (selected.has('cards')) {
        const colById = new Map(board.columns.map(c => [c.id, c.title]));
        const activeCards = board.cards.filter(c => !c.is_archived);
        const rows: (string | number | boolean | null)[][] = [
          ['Title', 'Column', 'Priority', 'Assignee', 'Start Date', 'Due Date', 'Labels', 'Complete', 'Created'],
        ];
        for (const card of activeCards) {
          const priorityCfg = card.priority ? PRIORITY_CONFIG[card.priority] : null;
          const labels = (card.labels ?? []).map(l => l.name).join(', ') || '—';
          rows.push([
            card.title,
            colById.get(card.column_id) ?? '—',
            priorityCfg ? priorityCfg.label : '—',
            resolveAssignee(card),
            card.start_date ?? '—',
            card.due_date ?? '—',
            labels,
            card.is_complete ? 'Yes' : 'No',
            card.created_at ? card.created_at.slice(0, 10) : '—',
          ]);
        }
        const ws = XLSX.utils.aoa_to_sheet(rows);
        ws['!cols'] = [{ wch: 40 }, { wch: 18 }, { wch: 10 }, { wch: 22 }, { wch: 12 }, { wch: 12 }, { wch: 28 }, { wch: 8 }, { wch: 12 }];
        XLSX.utils.book_append_sheet(wb, ws, 'All Cards');
      }

      const filename = `${board.title.replace(/[^a-z0-9]/gi, '-').replace(/-+/g, '-')}-overview-${todayStr}.xlsx`;
      XLSX.writeFile(wb, filename);
      onClose();
    } catch (err) {
      console.error('Export failed', err);
    } finally {
      setExporting(false);
    }
  };

  return (
    <div className="kb-ov-modal-overlay" onMouseDown={onClose}>
      <div className="kb-ov-modal" onMouseDown={e => e.stopPropagation()}>
        <div className="kb-ov-modal-header">
          <span className="kb-ov-modal-title">Export to Excel</span>
          <button className="kb-ov-btn-icon" onClick={onClose}><X size={16} /></button>
        </div>
        <div className="kb-ov-modal-body">
          <div className="kb-ov-modal-select-all">
            <button onClick={() => setSelected(new Set(SECTIONS.map(s => s.id)))}>Select all</button>
            <button onClick={() => setSelected(new Set())}>Deselect all</button>
          </div>
          {SECTIONS.map(({ id, label }) => (
            <label key={id} className="kb-ov-checkbox-row" onClick={() => toggle(id)}>
              <input
                type="checkbox"
                checked={selected.has(id)}
                onChange={() => toggle(id)}
                onClick={e => e.stopPropagation()}
              />
              <span className="kb-ov-checkbox-label">{label}</span>
            </label>
          ))}
        </div>
        <div className="kb-ov-modal-footer">
          <button className="kb-ov-btn-ghost" onClick={onClose}>Cancel</button>
          <button
            className="kb-ov-btn-primary"
            onClick={handleExport}
            disabled={selected.size === 0 || exporting}
          >
            <Download size={13} />
            {exporting ? 'Exporting…' : 'Download .xlsx'}
          </button>
        </div>
      </div>
    </div>
  );
}
