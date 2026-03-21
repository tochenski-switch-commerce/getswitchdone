'use client';

import { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { useCalendarData } from '@/hooks/useCalendarData';
import type { CalendarEvent } from '@/hooks/useCalendarData';
import type { CardPriority } from '@/types/board-types';
import FlameLoader from '@/components/FlameLoader';

// ─── Constants ───────────────────────────────────────────────────────────────

const BOARD_COLORS = [
  '#6366f1', '#8b5cf6', '#ec4899', '#f43f5e', '#f97316',
  '#f59e0b', '#22c55e', '#14b8a6', '#06b6d4', '#3b82f6',
  '#a78bfa', '#fb7185', '#34d399', '#60a5fa', '#fbbf24',
];

const PRIORITY_COLORS: Record<string, string> = {
  low: '#22c55e',
  medium: '#f59e0b',
  high: '#f97316',
  urgent: '#ef4444',
};

const PRIORITY_ORDER: Record<string, number> = {
  urgent: 0, high: 1, medium: 2, low: 3,
};

const DAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December'];

const LS_KEY = 'lumio_calendar_state';

type ViewMode = 'month' | 'week' | 'agenda' | 'day';

function getBoardColor(index: number) {
  return BOARD_COLORS[index % BOARD_COLORS.length];
}

function toDateKey(date: Date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
}

function parseLocalDate(dateStr: string): Date {
  const [y, m, d] = dateStr.split('-').map(Number);
  return new Date(y, m - 1, d);
}

function formatDisplayDate(dateStr: string) {
  const d = parseLocalDate(dateStr);
  return d.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' });
}

function formatShortDate(dateStr: string) {
  const d = parseLocalDate(dateStr);
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

function isToday(dateStr: string) {
  return dateStr === toDateKey(new Date());
}

function getWeekDays(dateStr: string): Date[] {
  const d = parseLocalDate(dateStr);
  const startOfWeek = new Date(d);
  startOfWeek.setDate(d.getDate() - d.getDay()); // Sunday
  const days: Date[] = [];
  for (let i = 0; i < 7; i++) {
    const day = new Date(startOfWeek);
    day.setDate(startOfWeek.getDate() + i);
    days.push(day);
  }
  return days;
}

function formatWeekRange(dateStr: string) {
  const days = getWeekDays(dateStr);
  const start = days[0];
  const end = days[6];
  const sameMonth = start.getMonth() === end.getMonth();
  if (sameMonth) {
    return `${start.toLocaleDateString('en-US', { month: 'long' })} ${start.getDate()}–${end.getDate()}, ${start.getFullYear()}`;
  }
  return `${start.toLocaleDateString('en-US', { month: 'short' })} ${start.getDate()} – ${end.toLocaleDateString('en-US', { month: 'short' })} ${end.getDate()}, ${end.getFullYear()}`;
}

function isOverdue(event: CalendarEvent) {
  if (event.isComplete) return false;
  return event.endDate < toDateKey(new Date());
}

function sortEvents(a: CalendarEvent, b: CalendarEvent) {
  const pa = PRIORITY_ORDER[a.priority ?? 'low'] ?? 3;
  const pb = PRIORITY_ORDER[b.priority ?? 'low'] ?? 3;
  if (pa !== pb) return pa - pb;
  return a.title.localeCompare(b.title);
}

// ─── Styles ──────────────────────────────────────────────────────────────────

const calendarStyles = `
  .cal-root {
    min-height: 100vh;
    background: #0f1117;
    color: #e5e7eb;
    font-family: -apple-system, BlinkMacSystemFont, 'SF Pro Text', system-ui, sans-serif;
  }

  .cal-container {
    max-width: 1400px;
    margin: 0 auto;
    padding: 0 16px 40px;
  }

  /* ── Header ── */
  .cal-header {
    padding: 20px 0 16px;
    border-bottom: 1px solid #1e2130;
    margin-bottom: 16px;
  }
  .cal-header-top {
    display: flex;
    align-items: flex-start;
    justify-content: space-between;
    gap: 16px;
    flex-wrap: wrap;
  }
  .cal-title {
    font-size: 22px;
    font-weight: 700;
    color: #f9fafb;
    margin: 0 0 4px;
  }
  .cal-subtitle {
    font-size: 13px;
    color: #6b7280;
  }
  .cal-subtitle span {
    color: #9ca3af;
  }

  /* ── Toolbar ── */
  .cal-toolbar {
    display: flex;
    align-items: center;
    gap: 10px;
    flex-wrap: wrap;
    padding: 12px 0 8px;
  }
  .cal-search {
    background: #1a1d27;
    border: 1px solid #2a2d3a;
    border-radius: 8px;
    padding: 7px 12px;
    font-size: 13px;
    color: #e5e7eb;
    outline: none;
    width: 220px;
    transition: border-color 0.15s;
  }
  .cal-search::placeholder { color: #4b5563; }
  .cal-search:focus { border-color: #4f52a0; }

  .cal-dropdown-wrap {
    position: relative;
  }
  .cal-dropdown-btn {
    background: #1a1d27;
    border: 1px solid #2a2d3a;
    border-radius: 8px;
    padding: 7px 12px;
    font-size: 13px;
    color: #e5e7eb;
    cursor: pointer;
    display: flex;
    align-items: center;
    gap: 6px;
    white-space: nowrap;
  }
  .cal-dropdown-btn:hover { border-color: #4f52a0; }

  .cal-dropdown-menu {
    position: absolute;
    top: calc(100% + 4px);
    left: 0;
    background: #1a1d27;
    border: 1px solid #2a2d3a;
    border-radius: 10px;
    padding: 6px;
    z-index: 200;
    min-width: 180px;
    max-height: 260px;
    overflow-y: auto;
    box-shadow: 0 8px 24px rgba(0,0,0,0.5);
  }
  .cal-dropdown-item {
    display: flex;
    align-items: center;
    gap: 8px;
    padding: 7px 10px;
    border-radius: 6px;
    cursor: pointer;
    font-size: 13px;
    color: #d1d5db;
  }
  .cal-dropdown-item:hover { background: #22253a; }
  .cal-dropdown-item.active { color: #f9fafb; }

  .cal-dot {
    width: 8px;
    height: 8px;
    border-radius: 50%;
    flex-shrink: 0;
  }

  /* ── View toggles ── */
  .cal-view-toggles {
    display: flex;
    background: #1a1d27;
    border: 1px solid #2a2d3a;
    border-radius: 8px;
    overflow: hidden;
  }
  .cal-view-btn {
    padding: 7px 14px;
    font-size: 13px;
    color: #9ca3af;
    background: none;
    border: none;
    cursor: pointer;
    transition: all 0.15s;
    border-right: 1px solid #2a2d3a;
  }
  .cal-view-btn:last-child { border-right: none; }
  .cal-view-btn:hover { color: #e5e7eb; background: #22253a; }
  .cal-view-btn.active { background: #6366f1; color: #fff; }

  .cal-add-btn {
    background: #6366f1;
    color: #fff;
    border: none;
    border-radius: 8px;
    padding: 7px 14px;
    font-size: 13px;
    font-weight: 600;
    cursor: pointer;
    display: flex;
    align-items: center;
    gap: 6px;
    transition: background 0.15s;
  }
  .cal-add-btn:hover { background: #5254cc; }

  /* ── Nav row ── */
  .cal-nav-row {
    display: flex;
    align-items: center;
    gap: 8px;
    flex-wrap: wrap;
  }
  .cal-nav-btn {
    background: #1a1d27;
    border: 1px solid #2a2d3a;
    border-radius: 8px;
    padding: 6px 12px;
    font-size: 13px;
    color: #e5e7eb;
    cursor: pointer;
    transition: all 0.15s;
  }
  .cal-nav-btn:hover { border-color: #6366f1; color: #818cf8; }
  .cal-nav-btn.today-active {
    background: #6366f1;
    border-color: #6366f1;
    color: #fff;
    font-weight: 600;
  }
  .cal-nav-btn.today-active:hover {
    background: #5254cc;
    border-color: #5254cc;
  }

  .cal-current-label {
    font-size: 15px;
    font-weight: 600;
    color: #f9fafb;
    min-width: 160px;
  }

  /* ── Month grid ── */
  .cal-grid-wrap {
    border: 1px solid #1e2130;
    border-radius: 12px;
    overflow: hidden;
  }
  .cal-day-headers {
    display: grid;
    grid-template-columns: repeat(7, calc(100% / 7));
    background: #13151f;
    border-bottom: 1px solid #1e2130;
  }
  .cal-day-header {
    text-align: center;
    padding: 8px 4px;
    font-size: 11px;
    font-weight: 600;
    color: #6b7280;
    text-transform: uppercase;
    letter-spacing: 0.05em;
  }
  .cal-grid {
    display: grid;
    grid-template-columns: repeat(7, calc(100% / 7));
  }
  .cal-cell {
    min-height: 110px;
    min-width: 0;
    overflow: hidden;
    border-right: 1px solid #1e2130;
    border-bottom: 1px solid #1e2130;
    padding: 28px 4px 4px;
    position: relative;
    cursor: pointer;
    transition: background 0.12s;
  }
  .cal-cell:nth-child(7n) { border-right: none; }
  .cal-cell:hover { background: rgba(99,102,241,0.04); }
  .cal-cell.other-month { opacity: 0.35; }
  .cal-cell.today-cell { background: rgba(99,102,241,0.05); }

  .cal-day-num {
    position: absolute;
    top: 4px;
    right: 4px;
    display: inline-flex;
    align-items: center;
    justify-content: center;
    width: 24px;
    height: 24px;
    border-radius: 50%;
    font-size: 12px;
    font-weight: 500;
    color: #9ca3af;
    line-height: 1;
  }
  .cal-day-num.today-num {
    background: #6366f1;
    color: #fff;
    font-weight: 700;
  }

  /* ── Event badges ── */
  .cal-event-badge {
    display: flex;
    align-items: center;
    gap: 4px;
    padding: 2px 4px;
    margin-bottom: 2px;
    border-radius: 3px;
    background: rgba(30,33,48,0.9);
    border-left: 3px solid transparent;
    font-size: 11px;
    color: #d1d5db;
    cursor: pointer;
    overflow: hidden;
    transition: background 0.12s;
    position: relative;
  }
  .cal-event-badge:hover { background: rgba(50,53,68,0.95); }
  .cal-event-badge.checklist-type {
    border-left-style: dashed;
    border-left-color: #818cf8;
  }
  .cal-event-badge.complete-badge {
    opacity: 0.45;
    text-decoration: line-through;
  }
  .cal-event-badge-title {
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
    flex: 1;
    min-width: 0;
  }
  .cal-priority-dot {
    width: 6px;
    height: 6px;
    border-radius: 50%;
    flex-shrink: 0;
  }

  .cal-more-link {
    font-size: 11px;
    color: #6b7280;
    cursor: pointer;
    padding: 2px 4px;
  }
  .cal-more-link:hover { color: #818cf8; }

  /* Multi-day event bar */
  .cal-span-bar {
    height: 18px;
    display: flex;
    align-items: center;
    padding: 0 6px;
    font-size: 11px;
    color: #fff;
    margin-bottom: 2px;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
    cursor: pointer;
  }
  .cal-span-start { border-radius: 4px 0 0 4px; }
  .cal-span-end { border-radius: 0 4px 4px 0; }
  .cal-span-single { border-radius: 4px; }
  .cal-span-mid { border-radius: 0; }

  /* ── Tooltip ── */
  .cal-tooltip {
    position: fixed;
    background: #1a1d27;
    border: 1px solid #2a2d3a;
    border-radius: 10px;
    padding: 12px 14px;
    z-index: 999;
    min-width: 200px;
    max-width: 280px;
    box-shadow: 0 8px 24px rgba(0,0,0,0.6);
    pointer-events: none;
  }
  .cal-tooltip-title {
    font-size: 13px;
    font-weight: 600;
    color: #f9fafb;
    margin-bottom: 8px;
  }
  .cal-tooltip-row {
    display: flex;
    align-items: center;
    gap: 6px;
    font-size: 12px;
    color: #9ca3af;
    margin-bottom: 4px;
  }
  .cal-tooltip-row:last-child { margin-bottom: 0; }

  /* ── Day view ── */
  .cal-day-header-bar {
    display: flex;
    align-items: center;
    gap: 12px;
    padding: 12px 0 16px;
    border-bottom: 1px solid #1e2130;
    margin-bottom: 16px;
  }
  .cal-day-heading {
    font-size: 18px;
    font-weight: 700;
    color: #f9fafb;
  }
  .cal-event-count {
    font-size: 13px;
    color: #6b7280;
    background: #1a1d27;
    border: 1px solid #2a2d3a;
    border-radius: 20px;
    padding: 2px 10px;
  }

  /* ── Day / Agenda event card ── */
  .cal-event-card {
    display: flex;
    align-items: flex-start;
    gap: 12px;
    background: #13151f;
    border: 1px solid #1e2130;
    border-radius: 10px;
    padding: 12px 14px;
    margin-bottom: 8px;
    cursor: pointer;
    transition: border-color 0.15s, background 0.12s;
    position: relative;
    overflow: hidden;
  }
  .cal-event-card::before {
    content: '';
    position: absolute;
    left: 0;
    top: 0;
    bottom: 0;
    width: 4px;
  }
  .cal-event-card:hover {
    border-color: #2a2d3a;
    background: #16192a;
  }
  .cal-event-card.complete-card {
    opacity: 0.5;
  }
  .cal-event-card.complete-card .cal-event-card-title {
    text-decoration: line-through;
    color: #6b7280;
  }

  .cal-event-card-checkbox {
    width: 18px;
    height: 18px;
    border-radius: 50%;
    border: 2px solid #374151;
    flex-shrink: 0;
    margin-top: 1px;
    cursor: pointer;
    display: flex;
    align-items: center;
    justify-content: center;
    transition: all 0.15s;
  }
  .cal-event-card-checkbox.checked {
    background: #22c55e;
    border-color: #22c55e;
  }
  .cal-event-card-checkbox:hover {
    border-color: #22c55e;
  }

  .cal-event-card-body {
    flex: 1;
    min-width: 0;
  }
  .cal-event-card-title-row {
    display: flex;
    align-items: center;
    gap: 8px;
    margin-bottom: 6px;
  }
  .cal-event-card-title {
    font-size: 14px;
    font-weight: 600;
    color: #f9fafb;
    flex: 1;
    min-width: 0;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .cal-priority-badge {
    font-size: 10px;
    font-weight: 700;
    padding: 2px 6px;
    border-radius: 4px;
    text-transform: uppercase;
    letter-spacing: 0.04em;
    flex-shrink: 0;
  }

  .cal-meta-row {
    display: flex;
    align-items: center;
    gap: 8px;
    flex-wrap: wrap;
  }
  .cal-meta-board {
    display: flex;
    align-items: center;
    gap: 5px;
    font-size: 12px;
    color: #9ca3af;
  }
  .cal-meta-dot {
    width: 6px;
    height: 6px;
    border-radius: 50%;
    flex-shrink: 0;
  }
  .cal-meta-col {
    font-size: 11px;
    color: #6b7280;
    background: #1e2130;
    padding: 2px 7px;
    border-radius: 20px;
  }
  .cal-meta-date {
    font-size: 12px;
    color: #6b7280;
    display: flex;
    align-items: center;
    gap: 4px;
  }
  .cal-meta-date.overdue { color: #ef4444; }
  .cal-meta-assignee {
    font-size: 12px;
    color: #9ca3af;
    display: flex;
    align-items: center;
    gap: 4px;
  }

  /* ── Empty state ── */
  .cal-empty {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    padding: 48px 24px;
    color: #4b5563;
    gap: 12px;
  }
  .cal-empty p {
    font-size: 14px;
    color: #6b7280;
    margin: 0;
  }

  /* ── Agenda View ── */
  .cal-agenda-wrap {
    display: flex;
    gap: 0;
    border: 1px solid #1e2130;
    border-radius: 12px;
    overflow: hidden;
    min-height: 600px;
  }
  .cal-agenda-sidebar {
    width: 300px;
    flex-shrink: 0;
    border-right: 1px solid #1e2130;
    background: #0d0f18;
    overflow-y: auto;
  }
  .cal-agenda-main {
    flex: 1;
    min-width: 0;
    overflow-y: auto;
  }
  .cal-agenda-main-header {
    position: sticky;
    top: 0;
    background: #0d0f18;
    border-bottom: 1px solid #1e2130;
    padding: 16px 20px;
    z-index: 10;
    display: flex;
    align-items: center;
    gap: 10px;
  }
  .cal-agenda-main-heading {
    font-size: 16px;
    font-weight: 700;
    color: #f9fafb;
  }
  .cal-today-badge {
    font-size: 11px;
    font-weight: 700;
    background: #6366f1;
    color: #fff;
    padding: 2px 8px;
    border-radius: 20px;
    text-transform: uppercase;
    letter-spacing: 0.05em;
  }
  .cal-agenda-events {
    padding: 16px 20px;
  }

  /* Mini calendar */
  .cal-mini-wrap {
    padding: 14px;
    border-bottom: 1px solid #1e2130;
  }
  .cal-mini-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    margin-bottom: 10px;
  }
  .cal-mini-title {
    font-size: 13px;
    font-weight: 600;
    color: #f9fafb;
  }
  .cal-mini-nav {
    background: none;
    border: none;
    color: #6b7280;
    cursor: pointer;
    padding: 2px 6px;
    border-radius: 4px;
    font-size: 14px;
    line-height: 1;
  }
  .cal-mini-nav:hover { color: #e5e7eb; background: #1e2130; }

  .cal-mini-grid {
    display: grid;
    grid-template-columns: repeat(7, 1fr);
    gap: 0;
    justify-items: center;
  }
  .cal-mini-day-header {
    text-align: center;
    font-size: 10px;
    font-weight: 600;
    color: #4b5563;
    padding: 3px 0;
    text-transform: uppercase;
  }
  .cal-mini-day {
    text-align: center;
    font-size: 12px;
    padding: 0;
    width: 28px;
    height: 28px;
    line-height: 28px;
    border-radius: 50%;
    cursor: pointer;
    color: #9ca3af;
    position: relative;
  }
  .cal-mini-day:hover { background: #1e2130; color: #e5e7eb; }
  .cal-mini-day.today { background: #6366f1; color: #fff; font-weight: 700; }
  .cal-mini-day.selected {
    background: transparent;
    box-shadow: inset 0 0 0 2px #6366f1;
    color: #818cf8;
    font-weight: 600;
  }
  .cal-mini-day.selected::after {
    display: none;
  }
  .cal-mini-day.other { opacity: 0.3; }
  .cal-mini-day.has-events::after {
    content: '';
    position: absolute;
    bottom: 2px;
    left: 50%;
    transform: translateX(-50%);
    width: 3px;
    height: 3px;
    background: #6366f1;
    border-radius: 50%;
  }

  /* Board filter pills */
  .cal-board-pills {
    padding: 10px 14px;
    display: flex;
    flex-direction: column;
    gap: 4px;
  }
  .cal-board-pill-label {
    font-size: 11px;
    font-weight: 600;
    color: #4b5563;
    text-transform: uppercase;
    letter-spacing: 0.05em;
    margin-bottom: 4px;
  }
  .cal-board-pill {
    display: flex;
    align-items: center;
    gap: 8px;
    padding: 6px 10px;
    border-radius: 8px;
    cursor: pointer;
    font-size: 12px;
    color: #9ca3af;
    transition: all 0.12s;
    border: 1px solid transparent;
  }
  .cal-board-pill:hover { background: #13151f; color: #e5e7eb; }
  .cal-board-pill.active { background: rgba(99,102,241,0.15); color: #e5e7eb; border-color: rgba(99,102,241,0.3); }

  /* ── Legend ── */
  .cal-legend {
    display: flex;
    flex-wrap: wrap;
    gap: 12px;
    padding: 14px 0 4px;
  }
  .cal-legend-item {
    display: flex;
    align-items: center;
    gap: 6px;
    font-size: 12px;
    color: #9ca3af;
    cursor: pointer;
    padding: 3px 8px;
    border-radius: 6px;
    transition: background 0.12s;
  }
  .cal-legend-item:hover { background: #1a1d27; color: #e5e7eb; }

  /* ── Modal ── */
  .cal-modal-overlay {
    position: fixed;
    inset: 0;
    background: rgba(0,0,0,0.7);
    backdrop-filter: blur(4px);
    z-index: 500;
    display: flex;
    align-items: center;
    justify-content: center;
    padding: 16px;
  }
  .cal-modal {
    background: #1a1d27;
    border: 1px solid #2a2d3a;
    border-radius: 14px;
    padding: 24px;
    width: 100%;
    max-width: 420px;
    box-shadow: 0 20px 60px rgba(0,0,0,0.7);
    color-scheme: dark;
  }
  .cal-modal-title {
    font-size: 16px;
    font-weight: 700;
    color: #f9fafb;
    margin: 0 0 20px;
  }
  .cal-modal-field {
    margin-bottom: 14px;
  }
  .cal-modal-label {
    font-size: 12px;
    font-weight: 600;
    color: #9ca3af;
    display: block;
    margin-bottom: 6px;
    text-transform: uppercase;
    letter-spacing: 0.04em;
  }
  .cal-modal-input {
    width: 100%;
    background: #0f1117;
    border: 1px solid #2a2d3a;
    border-radius: 8px;
    padding: 9px 12px;
    font-size: 14px;
    color: #e5e7eb;
    outline: none;
    transition: border-color 0.15s;
    box-sizing: border-box;
    font-family: inherit;
    color-scheme: dark;
  }
  .cal-modal-input:focus { border-color: #6366f1; }
  .cal-modal-input::placeholder { color: #4b5563; }
  .cal-modal-select {
    width: 100%;
    background: #0f1117;
    border: 1px solid #2a2d3a;
    border-radius: 8px;
    padding: 9px 12px;
    font-size: 14px;
    color: #e5e7eb;
    outline: none;
    cursor: pointer;
    appearance: none;
    box-sizing: border-box;
    font-family: inherit;
    color-scheme: dark;
    background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='12' viewBox='0 0 24 24' fill='none' stroke='%236b7280' stroke-width='2' stroke-linecap='round' stroke-linejoin='round'%3E%3Cpath d='M6 9l6 6 6-6'/%3E%3C/svg%3E");
    background-repeat: no-repeat;
    background-position: right 12px center;
    padding-right: 32px;
  }
  .cal-modal-select:focus { border-color: #6366f1; }
  .cal-modal-select option {
    background: #1a1d27;
    color: #e5e7eb;
  }
  .cal-modal-actions {
    display: flex;
    gap: 10px;
    justify-content: flex-end;
    margin-top: 20px;
  }
  .cal-modal-cancel {
    background: #22253a;
    border: 1px solid #2a2d3a;
    border-radius: 8px;
    padding: 8px 16px;
    font-size: 13px;
    color: #9ca3af;
    cursor: pointer;
    font-family: inherit;
    transition: all 0.15s;
  }
  .cal-modal-cancel:hover { color: #e5e7eb; background: #2a2d3a; }
  .cal-modal-save {
    background: #6366f1;
    border: none;
    border-radius: 8px;
    padding: 8px 18px;
    font-size: 13px;
    font-weight: 600;
    color: #fff;
    cursor: pointer;
    font-family: inherit;
    transition: background 0.15s;
  }
  .cal-modal-save:hover { background: #5254cc; }
  .cal-modal-save:disabled { opacity: 0.5; cursor: not-allowed; }

  /* ── Loading ── */
  .cal-loading {
    display: flex;
    align-items: center;
    justify-content: center;
    padding: 60px 24px;
    color: #4b5563;
    font-size: 14px;
    gap: 10px;
  }
  @keyframes cal-spin { to { transform: rotate(360deg); } }
  .cal-spinner {
    width: 18px;
    height: 18px;
    border: 2px solid #2a2d3a;
    border-top-color: #6366f1;
    border-radius: 50%;
    animation: cal-spin 0.8s linear infinite;
  }

  /* ── Week view ── */
  .cal-week-grid {
    display: grid;
    grid-template-columns: repeat(7, calc(100% / 7));
  }
  .cal-week-col {
    border-right: 1px solid #1e2130;
    min-height: 400px;
    min-width: 0;
    overflow: hidden;
    display: flex;
    flex-direction: column;
    position: relative;
  }
  .cal-week-col:last-child { border-right: none; }
  .cal-week-col-header {
    text-align: center;
    padding: 10px 4px 8px;
    border-bottom: 1px solid #1e2130;
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 4px;
    cursor: pointer;
    transition: background 0.12s;
  }
  .cal-week-col-header:hover { background: rgba(99,102,241,0.05); }
  .cal-week-col-header .cal-day-label {
    font-size: 11px;
    font-weight: 600;
    color: #6b7280;
    text-transform: uppercase;
    letter-spacing: 0.05em;
  }
  .cal-week-col-header .cal-day-num {
    position: static;
    margin: 0;
  }
  .cal-week-col-body {
    flex: 1;
    padding: 4px;
    overflow-y: auto;
  }
  .cal-week-col.today-col .cal-week-col-header {
    background: rgba(99,102,241,0.06);
  }
  .cal-week-col.drag-over {
    background: rgba(99,102,241,0.12);
    box-shadow: inset 0 0 0 2px #6366f1;
  }

  /* ── Drag and drop ── */
  .cal-cell.drag-over {
    background: rgba(99,102,241,0.12) !important;
    box-shadow: inset 0 0 0 2px #6366f1;
  }
  .cal-event-badge[draggable="true"],
  .cal-span-bar[draggable="true"] {
    cursor: grab;
  }
  .cal-event-badge[draggable="true"]:active,
  .cal-span-bar[draggable="true"]:active {
    cursor: grabbing;
    opacity: 0.6;
  }

  /* ── Mobile ── */
  @media (max-width: 767px) {
    .cal-container { padding: 0 10px 32px; }
    .cal-header { padding: 14px 0 10px; }
    .cal-title { font-size: 18px; }
    .cal-subtitle { font-size: 12px; }
    .cal-toolbar {
      flex-direction: column;
      align-items: stretch;
      gap: 8px;
      padding: 8px 0 6px;
    }
    .cal-search { width: 100%; box-sizing: border-box; }
    .cal-toolbar > .cal-dropdown-wrap,
    .cal-toolbar > .cal-view-toggles,
    .cal-toolbar > .cal-add-btn,
    .cal-toolbar > .cal-nav-row {
      width: 100%;
      box-sizing: border-box;
    }
    .cal-view-toggles {
      display: flex;
      width: 100%;
    }
    .cal-view-btn {
      flex: 1;
      text-align: center;
      padding: 8px 4px;
      font-size: 12px;
    }
    .cal-add-btn {
      justify-content: center;
      padding: 10px 14px;
    }
    .cal-nav-row {
      justify-content: space-between;
      flex-wrap: nowrap;
      gap: 6px;
    }
    .cal-nav-btn { padding: 6px 10px; font-size: 12px; }
    .cal-current-label {
      font-size: 13px;
      min-width: 0;
      text-align: center;
      flex: 1;
    }
    .cal-agenda-wrap { flex-direction: column; min-height: auto; }
    .cal-agenda-sidebar { width: 100%; border-right: none; border-bottom: 1px solid #1e2130; }
    .cal-agenda-main-header { padding: 12px 14px; }
    .cal-agenda-events { padding: 12px 14px; }
    .cal-modal { max-width: 92vw; }
    .cal-event-card { padding: 10px 12px; }
    .cal-event-card-title { white-space: normal; font-size: 13px; }
    .cal-cell { min-height: 60px; padding-top: 22px; }
    .cal-day-num { font-size: 11px; width: 20px; height: 20px; }
    .cal-event-badge { display: none; }
    .cal-span-bar { display: none; }
    .cal-more-link { display: none; }
    .cal-event-dots { display: flex; gap: 2px; justify-content: center; flex-wrap: wrap; padding: 2px 0; }
    .cal-day-header { font-size: 10px; padding: 6px 2px; }
    .cal-legend { gap: 8px; padding: 10px 0 4px; }
    .cal-legend-item { font-size: 11px; padding: 2px 6px; }
    .cal-day-header-bar { padding: 10px 0 12px; }
    .cal-day-heading { font-size: 15px; }
    /* Week view mobile */
    .cal-week-col { min-height: 250px; }
    .cal-week-col-header { padding: 6px 2px 4px; }
    .cal-week-col-header .cal-day-label { font-size: 9px; }
    .cal-week-col-header .cal-day-num { font-size: 11px; width: 20px; height: 20px; }
    .cal-week-col-body { padding: 2px; }
    .cal-week-col-body .cal-event-badge { display: flex; font-size: 10px; padding: 1px 2px; }
    .cal-week-col-body .cal-event-badge-title { font-size: 10px; }
    .cal-week-col-body .cal-priority-dot { width: 4px; height: 4px; }
  }
  @media (min-width: 768px) {
    .cal-event-dots { display: none; }
  }
`;

// ─── Icons ───────────────────────────────────────────────────────────────────

function CalIcon() {
  return (
    <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
      <rect x="3" y="4" width="18" height="18" rx="2" ry="2" />
      <line x1="16" y1="2" x2="16" y2="6" />
      <line x1="8" y1="2" x2="8" y2="6" />
      <line x1="3" y1="10" x2="21" y2="10" />
    </svg>
  );
}

function CheckIcon() {
  return (
    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3">
      <polyline points="20 6 9 17 4 12" />
    </svg>
  );
}

function PersonIcon() {
  return (
    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
      <circle cx="12" cy="7" r="4" />
    </svg>
  );
}

function ClockIcon() {
  return (
    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <circle cx="12" cy="12" r="10" />
      <polyline points="12 6 12 12 16 14" />
    </svg>
  );
}

function ChevronLeft() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
      <polyline points="15 18 9 12 15 6" />
    </svg>
  );
}

function ChevronRight() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
      <polyline points="9 18 15 12 9 6" />
    </svg>
  );
}

function PlusIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
      <line x1="12" y1="5" x2="12" y2="19" />
      <line x1="5" y1="12" x2="19" y2="12" />
    </svg>
  );
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function getMonthDays(year: number, month: number): Date[] {
  const firstDay = new Date(year, month, 1);
  const lastDay = new Date(year, month + 1, 0);
  const days: Date[] = [];
  // Fill leading days from previous month
  for (let i = firstDay.getDay(); i > 0; i--) {
    days.push(new Date(year, month, 1 - i));
  }
  // Fill current month
  for (let d = 1; d <= lastDay.getDate(); d++) {
    days.push(new Date(year, month, d));
  }
  // Fill trailing days from next month
  const remaining = 42 - days.length;
  for (let d = 1; d <= remaining; d++) {
    days.push(new Date(year, month + 1, d));
  }
  return days;
}

function getEventsForDay(events: CalendarEvent[], dateKey: string): CalendarEvent[] {
  return events.filter(e => e.startDate <= dateKey && e.endDate >= dateKey);
}

/** Pre-compute a Map<dayKey, CalendarEvent[]> for a range of dates */
function buildEventIndex(events: CalendarEvent[], dayKeys: string[]): Map<string, CalendarEvent[]> {
  const index = new Map<string, CalendarEvent[]>();
  for (const key of dayKeys) index.set(key, []);
  for (const e of events) {
    for (const key of dayKeys) {
      if (e.startDate <= key && e.endDate >= key) {
        index.get(key)!.push(e);
      }
    }
  }
  return index;
}

function isMultiDay(event: CalendarEvent) {
  return event.startDate !== event.endDate;
}

// ─── Tooltip ─────────────────────────────────────────────────────────────────

interface TooltipState {
  event: CalendarEvent;
  x: number;
  y: number;
}

function EventTooltip({ state }: { state: TooltipState }) {
  const { event, x, y } = state;
  const color = getBoardColor(event.boardIndex);
  const adj = {
    left: Math.min(x + 12, window.innerWidth - 300),
    top: y - 10,
  };
  return (
    <div className="cal-tooltip" style={{ left: adj.left, top: adj.top }}>
      <div className="cal-tooltip-title" style={{ borderBottom: `2px solid ${color}`, paddingBottom: 6, marginBottom: 8 }}>
        {event.title}
      </div>
      <div className="cal-tooltip-row">
        <span className="cal-meta-dot" style={{ background: color }} />
        {event.boardName}
      </div>
      <div className="cal-tooltip-row">
        <span style={{ background: '#1e2130', padding: '1px 6px', borderRadius: 4, fontSize: 11 }}>
          {event.columnName}
        </span>
      </div>
      {event.priority && (
        <div className="cal-tooltip-row">
          <span className="cal-priority-dot" style={{ background: PRIORITY_COLORS[event.priority] }} />
          {event.priority.charAt(0).toUpperCase() + event.priority.slice(1)}
        </div>
      )}
      {event.startDate !== event.endDate ? (
        <div className="cal-tooltip-row">
          <ClockIcon />
          {formatShortDate(event.startDate)} – {formatShortDate(event.endDate)}
        </div>
      ) : (
        <div className="cal-tooltip-row">
          <ClockIcon />
          {formatShortDate(event.endDate)}
        </div>
      )}
      {event.assignee && (
        <div className="cal-tooltip-row">
          <PersonIcon />
          {event.assignee}
        </div>
      )}
    </div>
  );
}

// ─── Event Card (Day / Agenda view) ──────────────────────────────────────────

interface EventCardProps {
  event: CalendarEvent;
  onToggle: (e: CalendarEvent) => void;
  onClick: (e: CalendarEvent) => void;
}

function EventCard({ event, onToggle, onClick }: EventCardProps) {
  const color = getBoardColor(event.boardIndex);
  const overdue = isOverdue(event);

  return (
    <div
      className={`cal-event-card${event.isComplete ? ' complete-card' : ''}`}
      style={{ paddingLeft: 18 }}
      onClick={() => onClick(event)}
    >
      <div style={{ position: 'absolute', left: 0, top: 0, bottom: 0, width: 4, background: color, borderRadius: '10px 0 0 10px' }} />
      <div
        className={`cal-event-card-checkbox${event.isComplete ? ' checked' : ''}`}
        onClick={ev => { ev.stopPropagation(); onToggle(event); }}
      >
        {event.isComplete && <CheckIcon />}
      </div>
      <div className="cal-event-card-body">
        <div className="cal-event-card-title-row">
          <span className="cal-event-card-title">{event.title}</span>
          {event.priority && (
            <span
              className="cal-priority-badge"
              style={{ background: `${PRIORITY_COLORS[event.priority]}22`, color: PRIORITY_COLORS[event.priority] }}
            >
              {event.priority}
            </span>
          )}
        </div>
        <div className="cal-meta-row">
          <span className="cal-meta-board">
            <span className="cal-meta-dot" style={{ background: color }} />
            {event.boardName}
          </span>
          <span className="cal-meta-col">{event.columnName}</span>
          {event.startDate !== event.endDate && (
            <span className={`cal-meta-date${overdue ? ' overdue' : ''}`}>
              <ClockIcon />
              {formatShortDate(event.startDate)} – {formatShortDate(event.endDate)}
            </span>
          )}
          {event.assignee && (
            <span className="cal-meta-assignee">
              <PersonIcon />
              {event.assignee}
            </span>
          )}
        </div>
      </div>
    </div>
  );
}

// ─── Add Card Modal ───────────────────────────────────────────────────────────

interface AddCardModalProps {
  defaultDate: string;
  boards: { id: string; title: string; index: number }[];
  getColumnsForBoard: (boardId: string) => { id: string; title: string }[];
  onSave: (params: { boardId: string; columnId: string; title: string; dueDate: string }) => Promise<void>;
  onClose: () => void;
}

function AddCardModal({ defaultDate, boards, getColumnsForBoard, onSave, onClose }: AddCardModalProps) {
  const [boardId, setBoardId] = useState(boards[0]?.id ?? '');
  const [columnId, setColumnId] = useState('');
  const [title, setTitle] = useState('');
  const [dueDate, setDueDate] = useState(defaultDate);
  const [saving, setSaving] = useState(false);

  const columns = useMemo(() => getColumnsForBoard(boardId), [boardId, getColumnsForBoard]);

  useEffect(() => {
    const cols = getColumnsForBoard(boardId);
    setColumnId(cols[0]?.id ?? '');
  }, [boardId, getColumnsForBoard]);

  const handleSave = async () => {
    if (!title.trim() || !boardId || !columnId) return;
    setSaving(true);
    await onSave({ boardId, columnId, title: title.trim(), dueDate });
    setSaving(false);
    onClose();
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && title.trim()) handleSave();
    if (e.key === 'Escape') onClose();
  };

  return (
    <div className="cal-modal-overlay" onClick={onClose}>
      <div className="cal-modal" onClick={e => e.stopPropagation()}>
        <p className="cal-modal-title">Add Card</p>
        <div className="cal-modal-field">
          <label className="cal-modal-label">Board</label>
          <select className="cal-modal-select" value={boardId} onChange={e => setBoardId(e.target.value)}>
            {boards.map(b => (
              <option key={b.id} value={b.id}>{b.title}</option>
            ))}
          </select>
        </div>
        <div className="cal-modal-field">
          <label className="cal-modal-label">Column</label>
          <select className="cal-modal-select" value={columnId} onChange={e => setColumnId(e.target.value)}>
            {columns.map(c => (
              <option key={c.id} value={c.id}>{c.title}</option>
            ))}
          </select>
        </div>
        <div className="cal-modal-field">
          <label className="cal-modal-label">Title</label>
          <input
            className="cal-modal-input"
            placeholder="Card title…"
            value={title}
            onChange={e => setTitle(e.target.value)}
            onKeyDown={handleKeyDown}
            autoFocus
          />
        </div>
        <div className="cal-modal-field">
          <label className="cal-modal-label">Due Date</label>
          <input
            className="cal-modal-input"
            type="date"
            value={dueDate}
            onChange={e => setDueDate(e.target.value)}
          />
        </div>
        <div className="cal-modal-actions">
          <button className="cal-modal-cancel" onClick={onClose}>Cancel</button>
          <button
            className="cal-modal-save"
            onClick={handleSave}
            disabled={saving || !title.trim() || !boardId || !columnId}
          >
            {saving ? 'Saving…' : 'Add Card'}
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Month View ───────────────────────────────────────────────────────────────

interface MonthViewProps {
  year: number;
  month: number;
  events: CalendarEvent[];
  onDayClick: (dateKey: string) => void;
  onEventClick: (event: CalendarEvent) => void;
  onToggle: (event: CalendarEvent) => void;
  onReschedule: (event: CalendarEvent, newDateKey: string) => void;
}

function MonthView({ year, month, events, onDayClick, onEventClick, onToggle, onReschedule }: MonthViewProps) {
  const days = useMemo(() => getMonthDays(year, month), [year, month]);
  const dayKeys = useMemo(() => days.map(toDateKey), [days]);
  const eventIndex = useMemo(() => buildEventIndex(events, dayKeys), [events, dayKeys]);
  const [tooltip, setTooltip] = useState<TooltipState | null>(null);
  const [dragOverKey, setDragOverKey] = useState<string | null>(null);
  const todayKey = toDateKey(new Date());

  const handleBadgeMouseEnter = (ev: React.MouseEvent, event: CalendarEvent) => {
    setTooltip({ event, x: ev.clientX, y: ev.clientY });
  };
  const handleBadgeMouseLeave = () => setTooltip(null);

  const handleDragStart = (ev: React.DragEvent, event: CalendarEvent) => {
    ev.dataTransfer.setData('application/json', JSON.stringify({ id: event.id }));
    ev.dataTransfer.effectAllowed = 'move';
    setTooltip(null);
  };

  const handleDragOver = (ev: React.DragEvent, dayKey: string) => {
    ev.preventDefault();
    ev.dataTransfer.dropEffect = 'move';
    if (dragOverKey !== dayKey) setDragOverKey(dayKey);
  };

  const handleDragLeave = () => {
    setDragOverKey(null);
  };

  const handleDrop = (ev: React.DragEvent, dayKey: string) => {
    ev.preventDefault();
    setDragOverKey(null);
    try {
      const raw = ev.dataTransfer.getData('application/json');
      const data = JSON.parse(raw) as { id: string };
      const event = events.find(e => e.id === data.id);
      if (event && event.startDate !== dayKey) {
        onReschedule(event, dayKey);
      }
    } catch { /* ignore bad drops */ }
  };

  return (
    <>
      <div className="cal-grid-wrap">
        <div className="cal-day-headers">
          {DAYS.map(d => (
            <div key={d} className="cal-day-header">{d}</div>
          ))}
        </div>
        <div className="cal-grid">
          {days.map((day, idx) => {
            const dayKey = toDateKey(day);
            const inMonth = day.getMonth() === month;
            const today = dayKey === todayKey;
            const dayEvents = eventIndex.get(dayKey) || [];
            const sortedEvents = [...dayEvents].sort(sortEvents);
            const visibleEvents = sortedEvents.slice(0, 4);
            const hiddenCount = sortedEvents.length - visibleEvents.length;

            return (
              <div
                key={idx}
                className={`cal-cell${!inMonth ? ' other-month' : ''}${today ? ' today-cell' : ''}${dragOverKey === dayKey ? ' drag-over' : ''}`}
                onClick={() => onDayClick(dayKey)}
                onDragOver={ev => handleDragOver(ev, dayKey)}
                onDragLeave={handleDragLeave}
                onDrop={ev => handleDrop(ev, dayKey)}
              >
                <span className={`cal-day-num${today ? ' today-num' : ''}`}>
                  {day.getDate()}
                </span>

                {/* Mobile: dots */}
                <div className="cal-event-dots">
                  {dayEvents.slice(0, 3).map(e => (
                    <div
                      key={e.id}
                      style={{ width: 5, height: 5, borderRadius: '50%', background: getBoardColor(e.boardIndex) }}
                    />
                  ))}
                  {dayEvents.length > 3 && (
                    <span style={{ fontSize: 9, color: '#6b7280' }}>+{dayEvents.length - 3}</span>
                  )}
                </div>

                {/* Desktop: event badges */}
                {visibleEvents.map(event => {
                  const color = event.type === 'checklist' ? '#818cf8' : getBoardColor(event.boardIndex);
                  const isStart = event.startDate === dayKey;
                  const isEnd = event.endDate === dayKey;
                  const multi = isMultiDay(event);

                  if (multi) {
                    let spanClass = 'cal-span-mid';
                    if (isStart && isEnd) spanClass = 'cal-span-single';
                    else if (isStart) spanClass = 'cal-span-start';
                    else if (isEnd) spanClass = 'cal-span-end';

                    return (
                      <div
                        key={event.id + dayKey}
                        className={`cal-span-bar ${spanClass}${event.isComplete ? ' complete-badge' : ''}`}
                        style={{ background: color + 'cc' }}
                        draggable={isStart}
                        onDragStart={isStart ? ev => handleDragStart(ev, event) : undefined}
                        onClick={ev => { ev.stopPropagation(); onEventClick(event); }}
                        onMouseEnter={ev => handleBadgeMouseEnter(ev, event)}
                        onMouseLeave={handleBadgeMouseLeave}
                      >
                        {(isStart || day.getDay() === 0) && (
                          <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', fontSize: 11 }}>
                            {event.title}
                          </span>
                        )}
                      </div>
                    );
                  }

                  return (
                    <div
                      key={event.id}
                      className={`cal-event-badge${event.type === 'checklist' ? ' checklist-type' : ''}${event.isComplete ? ' complete-badge' : ''}`}
                      style={{
                        borderLeftColor: event.type === 'checklist' ? undefined : color,
                      }}
                      draggable
                      onDragStart={ev => handleDragStart(ev, event)}
                      onClick={ev => { ev.stopPropagation(); onEventClick(event); }}
                      onMouseEnter={ev => handleBadgeMouseEnter(ev, event)}
                      onMouseLeave={handleBadgeMouseLeave}
                    >
                      {event.priority && (
                        <span className="cal-priority-dot" style={{ background: PRIORITY_COLORS[event.priority] }} />
                      )}
                      <span className="cal-event-badge-title">{event.title}</span>
                    </div>
                  );
                })}

                {hiddenCount > 0 && (
                  <div className="cal-more-link" onClick={ev => { ev.stopPropagation(); onDayClick(dayKey); }}>
                    +{hiddenCount} more
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>

      {tooltip && <EventTooltip state={tooltip} />}
    </>
  );
}

// ─── Week View ────────────────────────────────────────────────────────────────

interface WeekViewProps {
  selectedDate: string;
  events: CalendarEvent[];
  onDayClick: (dateKey: string) => void;
  onEventClick: (event: CalendarEvent) => void;
  onToggle: (event: CalendarEvent) => void;
  onReschedule: (event: CalendarEvent, newDateKey: string) => void;
}

function WeekView({ selectedDate, events, onDayClick, onEventClick, onToggle, onReschedule }: WeekViewProps) {
  const weekDays = useMemo(() => getWeekDays(selectedDate), [selectedDate]);
  const dayKeys = useMemo(() => weekDays.map(toDateKey), [weekDays]);
  const eventIndex = useMemo(() => buildEventIndex(events, dayKeys), [events, dayKeys]);
  const [tooltip, setTooltip] = useState<TooltipState | null>(null);
  const [dragOverKey, setDragOverKey] = useState<string | null>(null);
  const todayKey = toDateKey(new Date());

  const handleBadgeMouseEnter = (ev: React.MouseEvent, event: CalendarEvent) => {
    setTooltip({ event, x: ev.clientX, y: ev.clientY });
  };
  const handleBadgeMouseLeave = () => setTooltip(null);

  const handleDragStart = (ev: React.DragEvent, event: CalendarEvent) => {
    ev.dataTransfer.setData('application/json', JSON.stringify({ id: event.id }));
    ev.dataTransfer.effectAllowed = 'move';
    setTooltip(null);
  };

  const handleDragOver = (ev: React.DragEvent, dayKey: string) => {
    ev.preventDefault();
    ev.dataTransfer.dropEffect = 'move';
    if (dragOverKey !== dayKey) setDragOverKey(dayKey);
  };

  const handleDragLeave = () => setDragOverKey(null);

  const handleDrop = (ev: React.DragEvent, dayKey: string) => {
    ev.preventDefault();
    setDragOverKey(null);
    try {
      const raw = ev.dataTransfer.getData('application/json');
      const data = JSON.parse(raw) as { id: string };
      const event = events.find(e => e.id === data.id);
      if (event && event.startDate !== dayKey) {
        onReschedule(event, dayKey);
      }
    } catch { /* ignore */ }
  };

  return (
    <>
      <div className="cal-grid-wrap">
        <div className="cal-week-grid">
          {weekDays.map(day => {
            const dayKey = toDateKey(day);
            const today = dayKey === todayKey;
            const dayEvents = (eventIndex.get(dayKey) || []).sort(sortEvents);

            return (
              <div
                key={dayKey}
                className={`cal-week-col${today ? ' today-col' : ''}${dragOverKey === dayKey ? ' drag-over' : ''}`}
                onDragOver={ev => handleDragOver(ev, dayKey)}
                onDragLeave={handleDragLeave}
                onDrop={ev => handleDrop(ev, dayKey)}
              >
                <div className="cal-week-col-header" onClick={() => onDayClick(dayKey)}>
                  <span className="cal-day-label">{DAYS[day.getDay()]}</span>
                  <span className={`cal-day-num${today ? ' today-num' : ''}`}>{day.getDate()}</span>
                </div>
                <div className="cal-week-col-body">
                  {dayEvents.map(event => {
                    const color = event.type === 'checklist' ? '#818cf8' : getBoardColor(event.boardIndex);
                    return (
                      <div
                        key={event.id}
                        className={`cal-event-badge${event.type === 'checklist' ? ' checklist-type' : ''}${event.isComplete ? ' complete-badge' : ''}`}
                        style={{ borderLeftColor: event.type === 'checklist' ? undefined : color }}
                        draggable
                        onDragStart={ev => handleDragStart(ev, event)}
                        onClick={ev => { ev.stopPropagation(); onEventClick(event); }}
                        onMouseEnter={ev => handleBadgeMouseEnter(ev, event)}
                        onMouseLeave={handleBadgeMouseLeave}
                      >
                        {event.priority && (
                          <span className="cal-priority-dot" style={{ background: PRIORITY_COLORS[event.priority] }} />
                        )}
                        <span className="cal-event-badge-title">{event.title}</span>
                      </div>
                    );
                  })}
                  {dayEvents.length === 0 && (
                    <div style={{ padding: '8px 4px', fontSize: 11, color: '#374151', textAlign: 'center' }}>—</div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>
      {tooltip && <EventTooltip state={tooltip} />}
    </>
  );
}

// ─── Day View ─────────────────────────────────────────────────────────────────

interface DayViewProps {
  dateKey: string;
  events: CalendarEvent[];
  onToggle: (e: CalendarEvent) => void;
  onEventClick: (e: CalendarEvent) => void;
}

function DayView({ dateKey, events, onToggle, onEventClick }: DayViewProps) {
  const dayEvents = useMemo(
    () => getEventsForDay(events, dateKey).sort(sortEvents),
    [events, dateKey]
  );

  return (
    <div>
      <div className="cal-day-header-bar">
        <span className="cal-day-heading">{formatDisplayDate(dateKey)}</span>
        <span className="cal-event-count">{dayEvents.length} {dayEvents.length === 1 ? 'event' : 'events'}</span>
      </div>
      {dayEvents.length === 0 ? (
        <div className="cal-empty">
          <CalIcon />
          <p>No events on this day</p>
        </div>
      ) : (
        dayEvents.map(event => (
          <EventCard key={event.id} event={event} onToggle={onToggle} onClick={onEventClick} />
        ))
      )}
    </div>
  );
}

// ─── Mini Calendar ────────────────────────────────────────────────────────────

interface MiniCalendarProps {
  year: number;
  month: number;
  selectedDate: string;
  events: CalendarEvent[];
  onSelectDate: (dateKey: string) => void;
  onMonthChange: (year: number, month: number) => void;
}

function MiniCalendar({ year, month, selectedDate, events, onSelectDate, onMonthChange }: MiniCalendarProps) {
  const days = useMemo(() => getMonthDays(year, month), [year, month]);
  const todayKey = toDateKey(new Date());

  const eventDateSet = useMemo(() => {
    const set = new Set<string>();
    for (const e of events) {
      const start = parseLocalDate(e.startDate);
      const end = parseLocalDate(e.endDate);
      const cur = new Date(start);
      while (cur <= end) {
        set.add(toDateKey(cur));
        cur.setDate(cur.getDate() + 1);
      }
    }
    return set;
  }, [events]);

  const prevMonth = () => {
    if (month === 0) onMonthChange(year - 1, 11);
    else onMonthChange(year, month - 1);
  };
  const nextMonth = () => {
    if (month === 11) onMonthChange(year + 1, 0);
    else onMonthChange(year, month + 1);
  };

  return (
    <div className="cal-mini-wrap">
      <div className="cal-mini-header">
        <button className="cal-mini-nav" onClick={prevMonth}><ChevronLeft /></button>
        <span className="cal-mini-title">{MONTHS[month]} {year}</span>
        <button className="cal-mini-nav" onClick={nextMonth}><ChevronRight /></button>
      </div>
      <div className="cal-mini-grid">
        {DAYS.map(d => (
          <div key={d} className="cal-mini-day-header">{d[0]}</div>
        ))}
        {days.map((day, idx) => {
          const dk = toDateKey(day);
          const inMonth = day.getMonth() === month;
          const today = dk === todayKey;
          const selected = dk === selectedDate && !today;
          const hasEvents = eventDateSet.has(dk);
          return (
            <div
              key={idx}
              className={`cal-mini-day${today ? ' today' : ''}${selected ? ' selected' : ''}${!inMonth ? ' other' : ''}${hasEvents ? ' has-events' : ''}`}
              onClick={() => onSelectDate(dk)}
            >
              {day.getDate()}
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ─── Agenda View ──────────────────────────────────────────────────────────────

interface AgendaViewProps {
  year: number;
  month: number;
  selectedDate: string;
  events: CalendarEvent[];
  boards: { id: string; title: string; index: number }[];
  filteredBoardIds: Set<string>;
  onSelectDate: (dateKey: string) => void;
  onMonthChange: (year: number, month: number) => void;
  onToggleBoard: (boardId: string) => void;
  onToggle: (e: CalendarEvent) => void;
  onEventClick: (e: CalendarEvent) => void;
}

function AgendaView({
  year, month, selectedDate, events, boards, filteredBoardIds,
  onSelectDate, onMonthChange, onToggleBoard, onToggle, onEventClick,
}: AgendaViewProps) {
  const dayEvents = useMemo(
    () => getEventsForDay(events, selectedDate).sort(sortEvents),
    [events, selectedDate]
  );
  const todayKey = toDateKey(new Date());

  return (
    <div className="cal-agenda-wrap">
      <div className="cal-agenda-sidebar">
        <MiniCalendar
          year={year}
          month={month}
          selectedDate={selectedDate}
          events={events}
          onSelectDate={onSelectDate}
          onMonthChange={onMonthChange}
        />
        <div className="cal-board-pills">
          <p className="cal-board-pill-label">Boards</p>
          {boards.map(b => {
            const active = !filteredBoardIds.has(b.id);
            return (
              <div
                key={b.id}
                className={`cal-board-pill${active ? ' active' : ''}`}
                onClick={() => onToggleBoard(b.id)}
              >
                <span className="cal-meta-dot" style={{ background: getBoardColor(b.index) }} />
                {b.title}
              </div>
            );
          })}
        </div>
      </div>
      <div className="cal-agenda-main">
        <div className="cal-agenda-main-header">
          <span className="cal-agenda-main-heading">{formatDisplayDate(selectedDate)}</span>
          {selectedDate === todayKey && <span className="cal-today-badge">Today</span>}
          <span className="cal-event-count">{dayEvents.length} {dayEvents.length === 1 ? 'event' : 'events'}</span>
        </div>
        <div className="cal-agenda-events">
          {dayEvents.length === 0 ? (
            <div className="cal-empty">
              <CalIcon />
              <p>No items on this day</p>
            </div>
          ) : (
            dayEvents.map(event => (
              <EventCard key={event.id} event={event} onToggle={onToggle} onClick={onEventClick} />
            ))
          )}
        </div>
      </div>
    </div>
  );
}

// ─── Board Filter Dropdown ────────────────────────────────────────────────────

interface BoardFilterProps {
  boards: { id: string; title: string; index: number }[];
  filteredBoardIds: Set<string>;
  onToggle: (boardId: string) => void;
}

function BoardFilter({ boards, filteredBoardIds, onToggle }: BoardFilterProps) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  const visibleCount = boards.length - filteredBoardIds.size;

  return (
    <div className="cal-dropdown-wrap" ref={ref}>
      <button className="cal-dropdown-btn" onClick={() => setOpen(o => !o)}>
        Boards
        {filteredBoardIds.size > 0 && (
          <span style={{ background: '#6366f1', color: '#fff', borderRadius: '50%', width: 18, height: 18, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 11, fontWeight: 700 }}>
            {visibleCount}
          </span>
        )}
        <ChevronRight />
      </button>
      {open && (
        <div className="cal-dropdown-menu">
          {boards.map(b => {
            const hidden = filteredBoardIds.has(b.id);
            return (
              <div
                key={b.id}
                className={`cal-dropdown-item${!hidden ? ' active' : ''}`}
                onClick={() => onToggle(b.id)}
              >
                <span className="cal-dot" style={{ background: getBoardColor(b.index) }} />
                <span style={{ flex: 1 }}>{b.title}</span>
                {!hidden && (
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#6366f1" strokeWidth="3">
                    <polyline points="20 6 9 17 4 12" />
                  </svg>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

// ─── Main Component ───────────────────────────────────────────────────────────

export default function CalendarPage() {
  const router = useRouter();
  const { events, boards, loading, error, totalCards, totalChecklistItems, refresh, toggleComplete, addCard, rescheduleEvent, getColumnsForBoard } = useCalendarData();

  // ── Persisted state ──
  const [viewMode, setViewMode] = useState<ViewMode>(() => {
    try {
      const saved = JSON.parse(localStorage.getItem(LS_KEY) || '{}');
      return saved.viewMode ?? 'month';
    } catch { return 'month'; }
  });
  const [year, setYear] = useState<number>(() => {
    try {
      const saved = JSON.parse(localStorage.getItem(LS_KEY) || '{}');
      return saved.year ?? new Date().getFullYear();
    } catch { return new Date().getFullYear(); }
  });
  const [month, setMonth] = useState<number>(() => {
    try {
      const saved = JSON.parse(localStorage.getItem(LS_KEY) || '{}');
      return saved.month ?? new Date().getMonth();
    } catch { return new Date().getMonth(); }
  });
  const [selectedDate, setSelectedDate] = useState<string>(() => {
    try {
      const saved = JSON.parse(localStorage.getItem(LS_KEY) || '{}');
      return saved.selectedDate ?? toDateKey(new Date());
    } catch { return toDateKey(new Date()); }
  });

  // ── Local state ──
  const [searchQuery, setSearchQuery] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [filteredBoardIds, setFilteredBoardIds] = useState<Set<string>>(new Set());
  const [showAddModal, setShowAddModal] = useState(false);
  const [agendaMiniYear, setAgendaMiniYear] = useState(year);
  const [agendaMiniMonth, setAgendaMiniMonth] = useState(month);

  // ── Load data on mount ──
  useEffect(() => { refresh(); }, [refresh]);

  // ── Debounced search ──
  useEffect(() => {
    const timer = setTimeout(() => setDebouncedSearch(searchQuery), 300);
    return () => clearTimeout(timer);
  }, [searchQuery]);

  // ── Persist state ──
  useEffect(() => {
    try {
      localStorage.setItem(LS_KEY, JSON.stringify({ viewMode, year, month, selectedDate }));
    } catch {}
  }, [viewMode, year, month, selectedDate]);

  // ── Filtered events ──
  const filteredEvents = useMemo(() => {
    let result = events;
    if (filteredBoardIds.size > 0) {
      result = result.filter(e => !filteredBoardIds.has(e.boardId));
    }
    if (debouncedSearch.trim()) {
      const q = debouncedSearch.toLowerCase();
      result = result.filter(e =>
        e.title.toLowerCase().includes(q) ||
        e.boardName.toLowerCase().includes(q) ||
        (e.assignee?.toLowerCase().includes(q) ?? false)
      );
    }
    return result;
  }, [events, filteredBoardIds, debouncedSearch]);

  // ── Navigation ──
  const todayKey = toDateKey(new Date());
  const isViewingToday = useMemo(() => {
    const now = new Date();
    if (viewMode === 'month') return year === now.getFullYear() && month === now.getMonth();
    if (viewMode === 'day') return selectedDate === todayKey;
    if (viewMode === 'week') {
      const weekDays = getWeekDays(selectedDate);
      return weekDays.some(d => toDateKey(d) === todayKey);
    }
    return agendaMiniYear === now.getFullYear() && agendaMiniMonth === now.getMonth();
  }, [viewMode, year, month, selectedDate, todayKey, agendaMiniYear, agendaMiniMonth]);

  const goToMonth = (y: number, m: number) => {
    let ny = y, nm = m;
    if (nm < 0) { nm = 11; ny -= 1; }
    if (nm > 11) { nm = 0; ny += 1; }
    setYear(ny);
    setMonth(nm);
  };

  const goToDay = (delta: number) => {
    const d = parseLocalDate(selectedDate);
    d.setDate(d.getDate() + delta);
    const dk = toDateKey(d);
    setSelectedDate(dk);
    setYear(d.getFullYear());
    setMonth(d.getMonth());
  };

  const goToToday = () => {
    const d = new Date();
    const dk = toDateKey(d);
    setSelectedDate(dk);
    setYear(d.getFullYear());
    setMonth(d.getMonth());
    setAgendaMiniYear(d.getFullYear());
    setAgendaMiniMonth(d.getMonth());
  };

  const handleDayClick = (dateKey: string) => {
    setSelectedDate(dateKey);
    setViewMode('day');
  };

  const handleEventClick = (event: CalendarEvent) => {
    router.push(`/boards/${event.boardId}?card=${event.cardId}`);
  };

  const handleToggleBoard = (boardId: string) => {
    setFilteredBoardIds(prev => {
      const next = new Set(prev);
      if (next.has(boardId)) next.delete(boardId);
      else next.add(boardId);
      return next;
    });
  };

  const handleLegendClick = (boardId: string) => {
    setFilteredBoardIds(prev => {
      const next = new Set(prev);
      // If all others are filtered, show all instead
      if (next.size === boards.length - 1 && !next.has(boardId)) {
        return new Set();
      }
      // Filter all boards except this one
      const allOthers = new Set(boards.map(b => b.id).filter(id => id !== boardId));
      if (next.size === 0) return allOthers;
      next.clear();
      return next;
    });
  };

  // ── Week navigation helpers ──
  const goWeek = useCallback((delta: number) => {
    const d = parseLocalDate(selectedDate);
    d.setDate(d.getDate() + delta * 7);
    const dk = toDateKey(d);
    setSelectedDate(dk);
    setYear(d.getFullYear());
    setMonth(d.getMonth());
  }, [selectedDate]);

  // ── Nav label ──
  const navLabel = useMemo(() => {
    if (viewMode === 'month') return `${MONTHS[month]} ${year}`;
    if (viewMode === 'week') return formatWeekRange(selectedDate);
    if (viewMode === 'day') return formatDisplayDate(selectedDate);
    return `${MONTHS[agendaMiniMonth]} ${agendaMiniYear}`;
  }, [viewMode, year, month, selectedDate, agendaMiniYear, agendaMiniMonth]);

  const handlePrev = () => {
    if (viewMode === 'month') goToMonth(year, month - 1);
    else if (viewMode === 'week') goWeek(-1);
    else if (viewMode === 'day') goToDay(-1);
    else {
      if (agendaMiniMonth === 0) { setAgendaMiniYear(y => y - 1); setAgendaMiniMonth(11); }
      else setAgendaMiniMonth(m => m - 1);
    }
  };
  const handleNext = () => {
    if (viewMode === 'month') goToMonth(year, month + 1);
    else if (viewMode === 'week') goWeek(1);
    else if (viewMode === 'day') goToDay(1);
    else {
      if (agendaMiniMonth === 11) { setAgendaMiniYear(y => y + 1); setAgendaMiniMonth(0); }
      else setAgendaMiniMonth(m => m + 1);
    }
  };

  const handleAgendaDateSelect = (dateKey: string) => {
    setSelectedDate(dateKey);
    const d = parseLocalDate(dateKey);
    setYear(d.getFullYear());
    setMonth(d.getMonth());
  };

  const handleAgendaMonthChange = (y: number, m: number) => {
    setAgendaMiniYear(y);
    setAgendaMiniMonth(m);
  };

  const handleAddCard = async (params: { boardId: string; columnId: string; title: string; dueDate: string }) => {
    await addCard(params);
  };

  return (
    <div className="cal-root">
      <style>{calendarStyles}</style>
      <div className="cal-container">
        {/* ── Header ── */}
        <div className="cal-header">
          <div className="cal-header-top">
            <div>
              <h1 className="cal-title">Calendar</h1>
              <p className="cal-subtitle">
                <span>{totalCards}</span> cards &middot; <span>{totalChecklistItems}</span> checklist items &middot; <span>{boards.length}</span> boards
              </p>
            </div>
          </div>

          {/* ── Toolbar ── */}
          <div className="cal-toolbar">
            <input
              className="cal-search"
              placeholder="Search cards, assignees…"
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
            />
            <BoardFilter
              boards={boards}
              filteredBoardIds={filteredBoardIds}
              onToggle={handleToggleBoard}
            />
            <div className="cal-view-toggles">
              {(['month', 'week', 'agenda', 'day'] as ViewMode[]).map(v => (
                <button
                  key={v}
                  className={`cal-view-btn${viewMode === v ? ' active' : ''}`}
                  onClick={() => setViewMode(v)}
                >
                  {v.charAt(0).toUpperCase() + v.slice(1)}
                </button>
              ))}
            </div>
            <button className="cal-add-btn" onClick={() => setShowAddModal(true)}>
              <PlusIcon /> Add Card
            </button>

            {/* ── Nav ── */}
            <div className="cal-nav-row" style={{ marginLeft: 'auto' }}>
              <button className="cal-nav-btn" onClick={handlePrev}><ChevronLeft /></button>
              <button className={`cal-nav-btn${isViewingToday ? ' today-active' : ''}`} onClick={goToToday}>Today</button>
              <button className="cal-nav-btn" onClick={handleNext}><ChevronRight /></button>
              <span className="cal-current-label">{navLabel}</span>
            </div>
          </div>
        </div>

        {/* ── Content ── */}
        {loading ? (
          <div className="cal-loading">
            <FlameLoader delay={400} size={48} />
          </div>
        ) : error ? (
          <div className="cal-empty">
            <p style={{ color: '#ef4444' }}>Error: {error}</p>
            <button className="cal-nav-btn" onClick={refresh}>Retry</button>
          </div>
        ) : (
          <>
            {viewMode === 'month' && (
              <>
                <MonthView
                  year={year}
                  month={month}
                  events={filteredEvents}
                  onDayClick={handleDayClick}
                  onEventClick={handleEventClick}
                  onToggle={toggleComplete}
                  onReschedule={rescheduleEvent}
                />
                {/* Legend */}
                {boards.length > 0 && (
                  <div className="cal-legend">
                    {boards.map(b => (
                      <div key={b.id} className="cal-legend-item" onClick={() => handleLegendClick(b.id)}>
                        <span className="cal-meta-dot" style={{ background: getBoardColor(b.index) }} />
                        <span style={{ opacity: filteredBoardIds.has(b.id) ? 0.35 : 1 }}>{b.title}</span>
                      </div>
                    ))}
                    <div className="cal-legend-item" style={{ marginLeft: 8 }}>
                      <span style={{ width: 12, height: 2, background: '#818cf8', borderRadius: 1, display: 'inline-block' }} />
                      <span>Checklist item</span>
                    </div>
                  </div>
                )}
              </>
            )}
            {viewMode === 'week' && (
              <WeekView
                selectedDate={selectedDate}
                events={filteredEvents}
                onDayClick={handleDayClick}
                onEventClick={handleEventClick}
                onToggle={toggleComplete}
                onReschedule={rescheduleEvent}
              />
            )}
            {viewMode === 'day' && (
              <DayView
                dateKey={selectedDate}
                events={filteredEvents}
                onToggle={toggleComplete}
                onEventClick={handleEventClick}
              />
            )}
            {viewMode === 'agenda' && (
              <AgendaView
                year={agendaMiniYear}
                month={agendaMiniMonth}
                selectedDate={selectedDate}
                events={filteredEvents}
                boards={boards}
                filteredBoardIds={filteredBoardIds}
                onSelectDate={handleAgendaDateSelect}
                onMonthChange={handleAgendaMonthChange}
                onToggleBoard={handleToggleBoard}
                onToggle={toggleComplete}
                onEventClick={handleEventClick}
              />
            )}
          </>
        )}
      </div>

      {/* ── Add Card Modal ── */}
      {showAddModal && boards.length > 0 && (
        <AddCardModal
          defaultDate={selectedDate}
          boards={boards}
          getColumnsForBoard={getColumnsForBoard}
          onSave={handleAddCard}
          onClose={() => setShowAddModal(false)}
        />
      )}
    </div>
  );
}
