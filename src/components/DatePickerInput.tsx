'use client';

import React, { useState, useRef, useEffect, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { CalendarDays, ChevronLeft, ChevronRight } from '@/components/BoardIcons';

interface DatePickerInputProps {
  value: string;            // 'YYYY-MM-DD' or ''
  onChange: (value: string) => void;
  className?: string;       // e.g. 'kb-input' or 'pf-input'
  style?: React.CSSProperties;
  placeholder?: string;
}

const DAYS = ['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa'];
const MONTHS = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
];

function daysInMonth(year: number, month: number) {
  return new Date(year, month + 1, 0).getDate();
}

function parseDate(value: string) {
  if (!value) return null;
  const [y, m, d] = value.split('-').map(Number);
  if (!y || !m || !d) return null;
  return { year: y, month: m - 1, day: d };
}

function formatDate(year: number, month: number, day: number): string {
  return `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
}

export default function DatePickerInput({ value, onChange, className = '', style, placeholder }: DatePickerInputProps) {
  const [open, setOpen] = useState(false);
  const parsed = parseDate(value);
  const today = new Date();
  const [viewYear, setViewYear] = useState(parsed?.year ?? today.getFullYear());
  const [viewMonth, setViewMonth] = useState(parsed?.month ?? today.getMonth());
  const containerRef = useRef<HTMLDivElement>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const [dropUp, setDropUp] = useState(false);
  const [dropdownPos, setDropdownPos] = useState<{ top: number; left: number } | null>(null);

  // Reset view when value changes externally
  useEffect(() => {
    const p = parseDate(value);
    if (p) {
      setViewYear(p.year);
      setViewMonth(p.month);
    }
  }, [value]);

  // Close on outside click
  useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent) => {
      if (
        containerRef.current && !containerRef.current.contains(e.target as Node) &&
        dropdownRef.current && !dropdownRef.current.contains(e.target as Node)
      ) {
        setOpen(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [open]);

  // Calculate dropdown position (fixed positioning to escape overflow:hidden parents)
  const reposition = useCallback(() => {
    if (!containerRef.current) return;
    const rect = containerRef.current.getBoundingClientRect();
    const dropdownHeight = 310;
    const dropdownWidth = 260;
    const margin = 8;
    const spaceBelow = window.innerHeight - rect.bottom;
    const spaceAbove = rect.top;

    let top: number;
    let isUp = false;

    if (spaceBelow >= dropdownHeight) {
      top = rect.bottom + 4;
    } else if (spaceAbove >= dropdownHeight) {
      top = rect.top - dropdownHeight - 4;
      isUp = true;
    } else {
      // Doesn't fit either way — clamp so it stays in viewport
      top = Math.max(margin, window.innerHeight - dropdownHeight - margin);
    }

    setDropUp(isUp);

    let left = rect.left;
    if (left + dropdownWidth > window.innerWidth - margin) {
      left = window.innerWidth - dropdownWidth - margin;
    }
    if (left < margin) left = margin;
    setDropdownPos({ top, left });
  }, []);

  useEffect(() => {
    if (!open) return;
    reposition();
    // Recalculate on scroll (modal panels scroll) and resize
    window.addEventListener('scroll', reposition, true);
    window.addEventListener('resize', reposition);
    return () => {
      window.removeEventListener('scroll', reposition, true);
      window.removeEventListener('resize', reposition);
    };
  }, [open, reposition]);

  const prevMonth = useCallback(() => {
    setViewMonth(m => {
      if (m === 0) { setViewYear(y => y - 1); return 11; }
      return m - 1;
    });
  }, []);

  const nextMonth = useCallback(() => {
    setViewMonth(m => {
      if (m === 11) { setViewYear(y => y + 1); return 0; }
      return m + 1;
    });
  }, []);

  const selectDay = (day: number) => {
    onChange(formatDate(viewYear, viewMonth, day));
    setOpen(false);
  };

  const clear = (e: React.MouseEvent) => {
    e.stopPropagation();
    onChange('');
    setOpen(false);
  };

  const goToday = () => {
    const now = new Date();
    const y = now.getFullYear();
    const m = now.getMonth();
    const d = now.getDate();
    setViewYear(y);
    setViewMonth(m);
    onChange(formatDate(y, m, d));
    setOpen(false);
  };

  // Build calendar grid
  const firstDow = new Date(viewYear, viewMonth, 1).getDay();
  const totalDays = daysInMonth(viewYear, viewMonth);
  const cells: (number | null)[] = [];
  for (let i = 0; i < firstDow; i++) cells.push(null);
  for (let d = 1; d <= totalDays; d++) cells.push(d);

  const todayStr = formatDate(today.getFullYear(), today.getMonth(), today.getDate());

  const displayValue = parsed
    ? new Date(parsed.year, parsed.month, parsed.day).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
    : '';

  return (
    <div ref={containerRef} className="dp-container" style={style}>
      <style>{datePickerStyles}</style>
      <div
        className={`dp-trigger ${className}`}
        onClick={() => setOpen(!open)}
      >
        <span className={displayValue ? 'dp-value' : 'dp-placeholder'}>
          {displayValue || placeholder || 'Select date…'}
        </span>
        <div className="dp-icons">
          {value && (
            <button className="dp-clear" onClick={clear} title="Clear date">×</button>
          )}
          <CalendarDays size={14} className="dp-cal-icon" />
        </div>
      </div>

      {open && dropdownPos && createPortal(
        <div
          ref={dropdownRef}
          className={`dp-dropdown ${dropUp ? 'dp-dropdown-up' : ''}`}
          style={{ top: dropdownPos.top, left: dropdownPos.left }}
        >
          <style>{datePickerStyles}</style>
          {/* Navigation header */}
          <div className="dp-header">
            <button className="dp-nav-btn" onClick={prevMonth}><ChevronLeft size={14} /></button>
            <span className="dp-month-label">{MONTHS[viewMonth]} {viewYear}</span>
            <button className="dp-nav-btn" onClick={nextMonth}><ChevronRight size={14} /></button>
          </div>

          {/* Day-of-week labels */}
          <div className="dp-grid dp-dow-row">
            {DAYS.map(d => <div key={d} className="dp-dow">{d}</div>)}
          </div>

          {/* Day cells */}
          <div className="dp-grid">
            {cells.map((day, i) => {
              if (day === null) return <div key={`e-${i}`} className="dp-cell dp-empty" />;
              const dateStr = formatDate(viewYear, viewMonth, day);
              const isSelected = dateStr === value;
              const isToday = dateStr === todayStr;
              return (
                <div
                  key={day}
                  className={`dp-cell dp-day${isSelected ? ' dp-selected' : ''}${isToday && !isSelected ? ' dp-today' : ''}`}
                  onClick={() => selectDay(day)}
                >
                  {day}
                </div>
              );
            })}
          </div>

          {/* Footer */}
          <div className="dp-footer">
            <button className="dp-today-btn" onClick={goToday}>Today</button>
          </div>
        </div>,
        document.body
      )}
    </div>
  );
}

const datePickerStyles = `
  .dp-container {
    position: relative;
    width: 100%;
  }
  .dp-trigger {
    display: flex;
    align-items: center;
    justify-content: space-between;
    cursor: pointer;
    user-select: none;
    min-height: 36px;
  }
  .dp-value {
    color: #e5e7eb;
    font-size: 13px;
  }
  .dp-placeholder {
    color: #6b7280;
    font-size: 13px;
  }
  .dp-icons {
    display: flex;
    align-items: center;
    gap: 4px;
    flex-shrink: 0;
  }
  .dp-cal-icon {
    color: #6b7280;
    pointer-events: none;
  }
  .dp-clear {
    background: none;
    border: none;
    color: #6b7280;
    font-size: 16px;
    line-height: 1;
    cursor: pointer;
    padding: 0 2px;
    border-radius: 3px;
  }
  .dp-clear:hover { color: #ef4444; }

  /* Dropdown */
  .dp-dropdown {
    position: fixed;
    z-index: 99999;
    background: #1a1d2e;
    border: 1px solid #374151;
    border-radius: 12px;
    padding: 12px;
    width: 260px;
    box-sizing: border-box;
    box-shadow: 0 12px 40px rgba(0,0,0,0.5);
    animation: dp-fade-in 0.12s ease;
  }
  @keyframes dp-fade-in {
    from { opacity: 0; transform: translateY(4px); }
    to { opacity: 1; transform: translateY(0); }
  }

  /* Header */
  .dp-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    margin-bottom: 8px;
  }
  .dp-month-label {
    font-size: 13px;
    font-weight: 600;
    color: #e5e7eb;
  }
  .dp-nav-btn {
    background: none;
    border: none;
    color: #9ca3af;
    cursor: pointer;
    padding: 4px;
    border-radius: 6px;
    display: flex;
    align-items: center;
    justify-content: center;
  }
  .dp-nav-btn:hover { background: #2d3148; color: #e5e7eb; }

  /* Grid */
  .dp-grid {
    display: grid;
    grid-template-columns: repeat(7, 1fr);
    gap: 2px;
  }
  .dp-dow-row { margin-bottom: 4px; }
  .dp-dow {
    text-align: center;
    font-size: 11px;
    font-weight: 600;
    color: #6b7280;
    padding: 2px 0;
  }
  .dp-cell {
    text-align: center;
    font-size: 12px;
    padding: 5px 0;
    border-radius: 6px;
  }
  .dp-empty { pointer-events: none; }
  .dp-day {
    color: #d1d5db;
    cursor: pointer;
    transition: background 0.1s;
  }
  .dp-day:hover { background: #2d3148; }
  .dp-selected {
    background: #4f46e5 !important;
    color: #fff !important;
    font-weight: 600;
  }
  .dp-today {
    border: 1px solid #6366f1;
    color: #a5b4fc;
  }

  /* Footer */
  .dp-footer {
    display: flex;
    justify-content: center;
    margin-top: 8px;
    padding-top: 8px;
    border-top: 1px solid #2d3148;
  }
  .dp-today-btn {
    background: none;
    border: none;
    color: #818cf8;
    font-size: 12px;
    cursor: pointer;
    padding: 3px 10px;
    border-radius: 6px;
  }
  .dp-today-btn:hover { background: #2d3148; }
`;
