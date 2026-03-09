export const kanbanStyles = `
  .kb-root {
    min-height: 100vh;
    background: #0f1117 !important;
    color: #e5e7eb !important;
    font-family: -apple-system, BlinkMacSystemFont, 'SF Pro Text', system-ui, sans-serif;
  }

  /* ── Top bar ── */
  .kb-topbar {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 12px 16px;
    border-bottom: 1px solid #1e2130;
    background: rgba(15, 17, 23, 0.95);
    backdrop-filter: blur(8px);
    position: sticky;
    top: 0;
    z-index: 100;
    gap: 12px;
    flex-wrap: wrap;
  }
  .kb-topbar-left {
    display: flex;
    align-items: center;
    gap: 10px;
    min-width: 0;
  }
  .kb-topbar-right {
    display: flex;
    align-items: center;
    gap: 8px;
    flex-wrap: wrap;
  }
  .kb-board-title {
    font-size: 18px !important;
    font-weight: 700 !important;
    color: #f9fafb !important;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }

  /* ── Board icon picker ── */
  .kb-board-icon-btn {
    display: flex;
    align-items: center;
    justify-content: center;
    width: 32px;
    height: 32px;
    border-radius: 8px;
    border: 1.5px solid transparent;
    background: none;
    color: #818cf8;
    cursor: pointer;
    transition: all 0.12s ease;
    padding: 0;
  }
  .kb-board-icon-btn:hover {
    background: rgba(99,102,241,0.12);
    border-color: #6366f1;
  }
  .kb-board-icon-popover {
    position: absolute;
    top: 100%;
    left: 0;
    margin-top: 6px;
    background: #1a1d27;
    border: 1px solid #2a2d3a;
    border-radius: 12px;
    padding: 12px;
    z-index: 1000;
    width: 282px;
    max-height: 60vh;
    overflow-y: auto;
    box-shadow: 0 12px 32px rgba(0,0,0,0.5);
  }
  .kb-board-icon-popover-title {
    font-size: 11px;
    font-weight: 600;
    color: #9ca3af;
    text-transform: uppercase;
    letter-spacing: 0.04em;
    margin-bottom: 8px;
  }
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
  .kb-public-badge {
    display: inline-flex;
    align-items: center;
    gap: 4px;
    font-size: 10px;
    font-weight: 700;
    padding: 3px 8px;
    border-radius: 6px;
    background: rgba(34,197,94,0.12) !important;
    color: #22c55e;
    border: 1px solid rgba(34,197,94,0.25);
    white-space: nowrap;
    text-transform: uppercase;
    letter-spacing: 0.04em;
  }
  .kb-team-badge {
    display: inline-flex;
    align-items: center;
    gap: 4px;
    font-size: 10px;
    font-weight: 700;
    padding: 3px 8px;
    border-radius: 6px;
    background: rgba(99,102,241,0.12) !important;
    color: #818cf8;
    border: 1px solid rgba(99,102,241,0.25);
    white-space: nowrap;
    text-transform: uppercase;
    letter-spacing: 0.04em;
  }

  /* ── Search ── */
  .kb-search-box {
    display: flex;
    align-items: center;
    gap: 6px;
    padding: 6px 12px;
    background: #1a1d27 !important;
    border: 1px solid #2a2d3a;
    border-radius: 10px;
    transition: border-color 0.15s ease;
  }
  .kb-search-box:focus-within { border-color: #6366f1; }
  .kb-search-input {
    background: transparent !important;
    border: none !important;
    outline: none !important;
    color: #e5e7eb !important;
    font-size: 13px !important;
    width: 160px;
    padding: 0 !important;
  }
  .kb-search-input::placeholder { color: #4b5563 !important; }

  /* ── Filter select ── */
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

  /* ── Buttons ── */
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
  .kb-btn-sm { padding: 5px 12px; font-size: 12px; }
  .kb-btn-primary {
    background: #6366f1 !important;
    color: #fff !important;
  }
  .kb-btn-primary:hover { background: #4f46e5 !important; }
  .kb-btn-primary:disabled { opacity: 0.5; cursor: not-allowed; }
  .kb-btn-ghost {
    background: transparent !important;
    color: #9ca3af !important;
    border: 1px solid #374151 !important;
  }
  .kb-btn-ghost:hover { background: #1f2937 !important; color: #e5e7eb !important; }
  .kb-btn-danger {
    background: rgba(239, 68, 68, 0.1) !important;
    color: #ef4444 !important;
    border: 1px solid rgba(239, 68, 68, 0.2) !important;
  }
  .kb-btn-danger:hover { background: rgba(239, 68, 68, 0.2) !important; }
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
  .kb-btn-icon:hover { background: #1f2937 !important; color: #e5e7eb !important; }
  .kb-btn-icon-sm {
    background: none !important;
    border: none;
    padding: 3px;
    border-radius: 6px;
    cursor: pointer;
    color: #4b5563;
    transition: all 0.15s ease;
    display: flex;
    align-items: center;
  }
  .kb-btn-icon-sm:hover { background: #1f2937 !important; color: #9ca3af !important; }

  /* ── Dropdown ── */
  .kb-click-away { position: fixed; inset: 0; z-index: 999; }
  .kb-dropdown {
    position: absolute;
    right: 0;
    top: calc(100% + 6px);
    background: #1a1d27 !important;
    border: 1px solid #2a2d3a;
    border-radius: 12px;
    padding: 6px;
    min-width: 180px;
    box-shadow: 0 12px 32px rgba(0,0,0,0.4);
    z-index: 1000;
  }
  .kb-dropdown-item {
    display: flex;
    align-items: center;
    gap: 8px;
    width: 100%;
    padding: 8px 12px;
    border-radius: 8px;
    font-size: 13px;
    color: #d1d5db;
    background: none !important;
    border: none;
    cursor: pointer;
    transition: all 0.1s ease;
    text-align: left;
  }
  .kb-dropdown-item:hover { background: #252836 !important; color: #f9fafb; }
  .kb-dropdown-item.danger { color: #f87171; }
  .kb-dropdown-item.danger:hover { background: rgba(239,68,68,0.1) !important; }

  /* ── Columns scroll container ── */
  .kb-columns-scroll {
    overflow-x: auto;
    overflow-y: hidden;
    padding: 20px 16px 120px;
    -webkit-overflow-scrolling: touch;
  }
  .kb-columns-scroll::-webkit-scrollbar { height: 6px; }
  .kb-columns-scroll::-webkit-scrollbar-track { background: transparent; }
  .kb-columns-scroll::-webkit-scrollbar-thumb { background: #374151; border-radius: 3px; }

  .kb-columns {
    display: flex;
    gap: 16px;
    align-items: flex-start;
    min-height: calc(100vh - 140px);
  }

  /* ── Column ── */
  .kb-column {
    flex-shrink: 0;
    width: 300px;
    min-width: 300px;
    background: #14161e !important;
    border: 1px solid #1e2130;
    border-radius: 14px;
    display: flex;
    flex-direction: column;
    max-height: calc(100vh - 140px);
    transition: border-color 0.2s ease, box-shadow 0.2s ease;
  }
  .kb-column.drag-over {
    border-color: #6366f1 !important;
    box-shadow: 0 0 0 2px rgba(99,102,241,0.2) inset;
  }
  .kb-column-header {
    padding: 12px 14px 8px;
    display: flex;
    flex-direction: column;
    gap: 6px;
    border-bottom: 1px solid #1e2130;
  }
  .kb-column-title-row {
    display: flex;
    align-items: center;
    gap: 8px;
    min-width: 0;
  }
  .kb-column-actions {
    display: flex;
    align-items: center;
    gap: 2px;
    justify-content: flex-end;
  }
  .kb-column-dot {
    width: 8px;
    height: 8px;
    border-radius: 50%;
    flex-shrink: 0;
  }
  .kb-column-title {
    font-size: 14px !important;
    font-weight: 600 !important;
    color: #e5e7eb !important;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }
  .kb-column-count {
    font-size: 11px;
    font-weight: 600;
    color: #6b7280;
    background: #1e2130;
    padding: 1px 7px;
    border-radius: 10px;
    flex-shrink: 0;
  }
  .kb-column-cards {
    flex: 1;
    overflow-y: auto;
    padding: 10px;
    display: flex;
    flex-direction: column;
    gap: 8px;
  }
  .kb-column-cards::-webkit-scrollbar { width: 4px; }
  .kb-column-cards::-webkit-scrollbar-track { background: transparent; }
  .kb-column-cards::-webkit-scrollbar-thumb { background: #2a2d3a; border-radius: 2px; }

  /* ── Card wrapper & drop indicators ── */
  .kb-card-wrapper {
    position: relative;
  }
  .kb-card-wrapper.drop-above::before {
    content: '';
    position: absolute;
    top: -5px;
    left: 4px;
    right: 4px;
    height: 3px;
    background: #6366f1;
    border-radius: 2px;
    z-index: 10;
  }
  .kb-card-wrapper.drop-below::after {
    content: '';
    position: absolute;
    bottom: -5px;
    left: 4px;
    right: 4px;
    height: 3px;
    background: #6366f1;
    border-radius: 2px;
    z-index: 10;
  }

  /* ── Card ── */
  .kb-card {
    background: #1a1d27 !important;
    border: 1px solid #252836;
    border-radius: 10px;
    padding: 12px;
    cursor: pointer;
    transition: all 0.15s ease;
    user-select: none;
    overflow: hidden;
    min-width: 0;
  }
  .kb-card:hover {
    border-color: #3b3f52;
    box-shadow: 0 4px 12px rgba(0,0,0,0.2);
    transform: translateY(-1px);
  }
  .kb-card.dragging {
    opacity: 0.5;
    transform: rotate(2deg);
  }
  .kb-card-labels {
    display: flex;
    flex-wrap: wrap;
    gap: 4px;
    margin-bottom: 8px;
    min-width: 0;
  }
  .kb-card-label {
    font-size: 10px;
    font-weight: 600;
    color: #fff !important;
    padding: 2px 8px;
    border-radius: 6px;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
    max-width: 120px;
  }
  .kb-card-title {
    font-size: 13px !important;
    font-weight: 500 !important;
    color: #e5e7eb !important;
    margin: 0 0 8px 0 !important;
    line-height: 1.4 !important;
    word-break: break-word;
  }
  .kb-card-meta {
    display: flex;
    align-items: center;
    gap: 4px 6px;
    flex-wrap: wrap;
    min-width: 0;
  }
  .kb-card-priority-select {
    font-size: 10px;
    font-weight: 600;
    padding: 2px 6px;
    border-radius: 6px;
    border: 1px solid #2a2d3a;
    background: rgba(255,255,255,0.04);
    color: #6b7280;
    cursor: pointer;
    outline: none;
    -webkit-appearance: none;
    appearance: none;
    max-width: 90px;
  }
  .kb-card-priority-select:hover {
    border-color: #3b3f52;
  }
  .kb-card-dates {
    display: inline-flex;
    align-items: center;
    gap: 3px;
    font-size: 10px;
    color: #9ca3af;
    padding: 2px 6px;
    border-radius: 6px;
    background: rgba(255,255,255,0.04);
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
    max-width: 100%;
    min-width: 0;
  }
  .kb-card-dates.overdue {
    color: #ef4444;
    background: rgba(239,68,68,0.12);
    font-weight: 600;
  }
  .kb-card-dates.due-soon {
    color: #f59e0b;
    background: rgba(245,158,11,0.12);
    font-weight: 600;
  }
  .kb-card-date-sep {
    opacity: 0.5;
    margin: 0 1px;
  }
  .kb-card-counts {
    margin-left: auto;
    display: flex;
    align-items: center;
    gap: 6px;
    flex-shrink: 0;
  }
  .kb-card-count {
    display: inline-flex;
    align-items: center;
    gap: 3px;
    font-size: 10px;
    color: #6b7280;
  }
  .kb-card-count.done { color: #22c55e; }
  .kb-card-repeat-badge { color: #818cf8; }
  .kb-card-repeat-front {
    display: inline-flex;
    align-items: center;
    gap: 4px;
    font-size: 10px;
    font-weight: 600;
    color: #818cf8;
    background: rgba(99,102,241,0.1);
    padding: 2px 8px;
    border-radius: 6px;
    max-width: 100%;
    min-width: 0;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }
  .kb-card-assignee {
    display: flex;
    align-items: center;
    gap: 4px;
    font-size: 11px;
    color: #6b7280;
    margin-top: 6px;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
    min-width: 0;
  }
  .kb-card-alert {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    flex-shrink: 0;
    width: 20px;
    height: 20px;
    border-radius: 50%;
    background: rgba(245,158,11,0.15);
    color: #f59e0b;
    margin-top: 1px;
    animation: kb-alert-pulse 2s ease-in-out infinite;
  }
  @keyframes kb-alert-pulse {
    0%, 100% { opacity: 1; }
    50% { opacity: 0.5; }
  }

  /* ── Keyboard shortcut help bar ── */
  .kb-shortcut-bar {
    position: fixed;
    bottom: 0;
    left: 0;
    right: 0;
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 6px;
    padding: 6px 16px;
    padding-bottom: max(6px, env(safe-area-inset-bottom));
    font-size: 11px;
    color: #6b7280;
    background: rgba(15,17,23,0.85);
    border-top: 1px solid #1e2130;
    backdrop-filter: blur(8px);
    z-index: 50;
    pointer-events: none;
    animation: kb-bar-in 0.2s ease;
  }
  .kb-shortcut-bar-item {
    display: inline-flex;
    align-items: center;
    gap: 3px;
    color: #9ca3af;
  }
  .kb-shortcut-bar-sep {
    color: #3b3f52;
  }
  .kb-shortcut-bar kbd {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    min-width: 16px;
    height: 16px;
    padding: 0 3px;
    font-size: 9px;
    font-family: inherit;
    font-weight: 700;
    color: #c9cdd5;
    background: #1e2130;
    border: 1px solid #3b3f52;
    border-radius: 3px;
    line-height: 1;
  }
  @keyframes kb-bar-in {
    from { opacity: 0; transform: translateY(8px); }
    to { opacity: 1; transform: translateY(0); }
  }

  /* ── Card detail nav buttons ── */
  .kb-detail-header-actions {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 8px 12px 0;
  }
  .kb-detail-nav {
    display: flex;
    gap: 4px;
  }
  .kb-detail-nav-btn {
    display: flex;
    align-items: center;
    justify-content: center;
    width: 28px;
    height: 28px;
    border-radius: 6px;
    border: 1px solid #2a2d3a;
    background: #1a1d27;
    color: #9ca3af;
    cursor: pointer;
    transition: all 0.15s ease;
  }
  .kb-detail-nav-btn:hover {
    background: #252836;
    color: #e5e7eb;
    border-color: #3b3f52;
  }

  /* ── Add card ── */
  .kb-add-card-btn {
    display: flex;
    align-items: center;
    gap: 6px;
    width: 100%;
    padding: 10px 14px;
    background: none !important;
    border: none;
    border-top: 1px solid #1e2130;
    border-radius: 0 0 14px 14px;
    font-size: 13px;
    color: #6b7280;
    cursor: pointer;
    transition: all 0.15s ease;
  }
  .kb-add-card-btn:hover { color: #e5e7eb; background: rgba(255,255,255,0.03) !important; }
  .kb-quick-add {
    display: flex;
    flex-direction: column;
    gap: 8px;
  }
  .kb-quick-add-actions {
    display: flex;
    align-items: center;
    gap: 8px;
  }

  /* ── Add column ── */
  .kb-add-column {
    flex-shrink: 0;
    width: 300px;
    min-width: 300px;
  }
  .kb-add-column-btn {
    display: flex;
    align-items: center;
    gap: 8px;
    width: 100%;
    padding: 14px;
    background: rgba(255,255,255,0.03) !important;
    border: 2px dashed #2a2d3a;
    border-radius: 14px;
    font-size: 14px;
    font-weight: 500;
    color: #6b7280;
    cursor: pointer;
    transition: all 0.15s ease;
  }
  .kb-add-column-btn:hover { border-color: #6366f1; color: #a5b4fc; background: rgba(99,102,241,0.05) !important; }
  .kb-add-column-form {
    background: #14161e !important;
    border: 1px solid #2a2d3a;
    border-radius: 14px;
    padding: 14px;
    display: flex;
    flex-direction: column;
    gap: 8px;
  }

  /* ── Add column type toggle ── */
  .kb-add-column-type-toggle {
    display: flex;
    gap: 4px;
    margin-bottom: 2px;
  }
  .kb-col-type-btn {
    flex: 1;
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 5px;
    padding: 6px 8px;
    border-radius: 8px;
    border: 1px solid #2a2d3a;
    background: transparent;
    color: #94a3b8;
    font-size: 12px;
    cursor: pointer;
    transition: all 0.15s ease;
  }
  .kb-col-type-btn:hover { border-color: #6366f1; color: #c7d2fe; }
  .kb-col-type-btn.active {
    background: #2563eb;
    border-color: #2563eb;
    color: #fff;
  }

  /* ── Board link cards ── */
  .kb-board-link-card {
    display: flex;
    align-items: center;
    gap: 10px;
    padding: 10px 12px;
    background: #1a1d2e;
    border: 1px solid #2a2d3a;
    border-radius: 10px;
    cursor: pointer;
    transition: all 0.15s ease;
    position: relative;
  }
  .kb-board-link-card:hover {
    border-color: #6366f1;
    background: #1e2138;
  }
  .kb-board-link-card.kb-dragging {
    opacity: 0.4;
  }
  .kb-board-link-card.drop-above {
    border-top: 2px solid #6366f1;
    margin-top: -1px;
  }
  .kb-board-link-card.drop-below {
    border-bottom: 2px solid #6366f1;
    margin-bottom: -1px;
  }
  .kb-board-link-icon {
    flex-shrink: 0;
    width: 32px;
    height: 32px;
    display: flex;
    align-items: center;
    justify-content: center;
    border-radius: 8px;
    background: rgba(99,102,241,0.1);
  }
  .kb-board-link-info {
    flex: 1;
    min-width: 0;
  }
  .kb-board-link-title {
    font-size: 13px;
    font-weight: 500;
    color: #e5e7eb;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }
  .kb-board-link-stats {
    font-size: 11px;
    color: #64748b;
    margin-top: 1px;
  }
  .kb-board-link-remove {
    position: absolute;
    top: 4px;
    right: 4px;
    background: none;
    border: none;
    color: #64748b;
    cursor: pointer;
    border-radius: 4px;
    padding: 2px;
    opacity: 0;
    transition: opacity 0.15s ease;
  }
  .kb-board-link-card:hover .kb-board-link-remove {
    opacity: 1;
  }
  .kb-board-link-remove:hover {
    color: #ef4444;
    background: rgba(239,68,68,0.1);
  }

  /* ── Link picker ── */
  .kb-link-picker {
    padding: 8px;
    display: flex;
    flex-direction: column;
    gap: 6px;
  }
  .kb-link-picker-list {
    max-height: 200px;
    overflow-y: auto;
    display: flex;
    flex-direction: column;
    gap: 2px;
  }
  .kb-link-picker-item {
    display: flex;
    align-items: center;
    gap: 8px;
    padding: 7px 10px;
    border-radius: 8px;
    border: none;
    background: transparent;
    color: #e5e7eb;
    font-size: 13px;
    cursor: pointer;
    text-align: left;
    transition: background 0.15s ease;
  }
  .kb-link-picker-item:hover {
    background: rgba(99,102,241,0.12);
  }
  .kb-link-picker-item span {
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }

  /* ── Board links column accent ── */
  .kb-column-links {
    border-top: 2px solid rgba(99,102,241,0.4);
  }

  /* ── Inline edit ── */
  .kb-inline-edit {
    background: rgba(99,102,241,0.1) !important;
    border: 1px solid #6366f1 !important;
    border-radius: 6px;
    padding: 2px 8px;
    font-size: inherit;
    font-weight: inherit;
    color: #e5e7eb !important;
    outline: none;
    width: 100%;
  }

  /* ── Inputs ── */
  .kb-input, .kb-textarea {
    width: 100%;
    background: #0f1117 !important;
    border: 1px solid #374151 !important;
    border-radius: 10px;
    padding: 8px 12px;
    font-size: 13px !important;
    color: #e5e7eb !important;
    outline: none;
    transition: border-color 0.15s ease;
    box-sizing: border-box;
    font-family: inherit;
    max-width: 100%;
  }
  select.kb-input {
    appearance: none !important;
    -webkit-appearance: none !important;
    background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='12' viewBox='0 0 24 24' fill='none' stroke='%239ca3af' stroke-width='2'%3E%3Cpath d='M6 9l6 6 6-6'/%3E%3C/svg%3E") !important;
    background-repeat: no-repeat !important;
    background-position: right 12px center !important;
    padding-right: 32px !important;
    cursor: pointer !important;
  }
  select.kb-input option {
    background: #1a1d2e;
    color: #e5e7eb;
  }
  .kb-input:focus, .kb-textarea:focus { border-color: #6366f1 !important; box-shadow: 0 0 0 2px rgba(99,102,241,0.15); }
  .kb-textarea { resize: vertical; min-height: 60px; }

  /* ── Loading ── */
  .kb-loading {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    padding: 120px 20px;
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
  @keyframes kb-spin { to { transform: rotate(360deg); } }

  /* ── Modal (detail) ── */
  .kb-modal-overlay {
    position: fixed;
    inset: 0;
    background: rgba(0,0,0,0.65);
    backdrop-filter: blur(6px);
    display: flex;
    align-items: flex-start;
    justify-content: center;
    z-index: 50000;
    padding: 40px 16px 120px;
    padding-top: max(40px, env(safe-area-inset-top, 40px));
    overflow-y: auto;
  }
  .kb-detail-modal {
    background: #1a1d27 !important;
    border: 1px solid #2a2d3a;
    border-radius: 18px;
    max-width: min(900px, 100%);
    width: 100%;
    box-shadow: 0 32px 80px rgba(0,0,0,0.6);
    position: relative;
    animation: kb-modal-in 0.2s ease;
    overflow: hidden;
    box-sizing: border-box;
  }
  @keyframes kb-modal-in {
    from { opacity: 0; transform: translateY(20px) scale(0.97); }
    to { opacity: 1; transform: translateY(0) scale(1); }
  }
  .kb-detail-close {
    position: static;
    background: none !important;
    border: none;
    color: #6b7280;
    cursor: pointer;
    padding: 6px;
    border-radius: 8px;
    transition: all 0.15s ease;
    z-index: 10;
    display: flex;
  }
  .kb-detail-close:hover { background: #252836 !important; color: #e5e7eb; }
  .kb-detail-body {
    display: flex;
    gap: 0;
    min-width: 0;
    overflow: hidden;
  }
  .kb-detail-main {
    flex: 1;
    padding: 28px 24px;
    min-width: 0;
    border-right: 1px solid #2a2d3a;
    overflow: hidden;
  }
  .kb-detail-sidebar {
    width: 260px;
    flex-shrink: 0;
    padding: 28px 20px;
    min-width: 0;
    overflow: hidden;
    box-sizing: border-box;
  }
  .kb-detail-title-input {
    width: 100%;
    background: transparent !important;
    border: none !important;
    outline: none;
    font-size: 20px !important;
    font-weight: 700 !important;
    color: #f9fafb !important;
    padding: 0 0 12px 0 !important;
    margin-bottom: 12px;
    border-bottom: 1px solid #2a2d3a !important;
  }
  .kb-detail-column-badge {
    display: inline-flex;
    align-items: center;
    font-size: 11px;
    font-weight: 600;
    padding: 3px 10px;
    border-radius: 8px;
    border: 1px solid;
    margin-bottom: 16px;
    background: rgba(255,255,255,0.03);
  }
  .kb-detail-section-label {
    display: flex;
    align-items: center;
    gap: 6px;
    font-size: 12px !important;
    font-weight: 600 !important;
    color: #9ca3af !important;
    text-transform: uppercase;
    letter-spacing: 0.04em;
    margin-bottom: 8px;
  }

  /* ── Labels ── */
  .kb-label-chips {
    display: flex;
    flex-wrap: wrap;
    gap: 6px;
    margin-bottom: 8px;
  }
  .kb-label-chip {
    display: inline-flex;
    align-items: center;
    gap: 4px;
    font-size: 11px;
    font-weight: 600;
    padding: 3px 10px;
    border-radius: 8px;
    border: 1px solid;
  }
  .kb-label-picker {
    display: flex;
    flex-direction: column;
    gap: 2px;
    padding: 8px;
    background: #14161e !important;
    border: 1px solid #2a2d3a;
    border-radius: 10px;
    margin-bottom: 8px;
  }
  .kb-label-picker-item {
    display: flex;
    align-items: center;
    gap: 8px;
    padding: 6px 10px;
    border-radius: 8px;
    font-size: 12px;
    color: #d1d5db;
    background: none !important;
    border: none;
    cursor: pointer;
    transition: all 0.1s ease;
    text-align: left;
  }
  .kb-label-picker-item:hover { background: #1e2130 !important; }
  .kb-label-picker-item.selected { background: rgba(99,102,241,0.1) !important; }
  .kb-label-dot { width: 10px; height: 10px; border-radius: 50%; flex-shrink: 0; }



  /* ── Form groups ── */
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

  /* ── Checklist ── */
  .kb-checklist-progress { margin-bottom: 10px; }
  .kb-checklist-bar {
    height: 6px;
    background: #252836;
    border-radius: 3px;
    overflow: hidden;
  }
  .kb-checklist-fill {
    height: 100%;
    background: #6366f1;
    border-radius: 3px;
    transition: width 0.3s ease;
  }
  .kb-checklist-items { display: flex; flex-direction: column; gap: 4px; margin-bottom: 10px; }
  .kb-checklist-item {
    display: flex;
    align-items: center;
    gap: 8px;
    padding: 4px 0;
  }
  .kb-checkbox {
    width: 18px;
    height: 18px;
    border-radius: 5px;
    border: 2px solid #4b5563;
    background: transparent !important;
    cursor: pointer;
    display: flex;
    align-items: center;
    justify-content: center;
    flex-shrink: 0;
    transition: all 0.15s ease;
    color: transparent;
    padding: 0;
  }
  .kb-checkbox.checked {
    background: #6366f1 !important;
    border-color: #6366f1;
    color: #fff;
  }
  .kb-checklist-text { font-size: 13px; color: #d1d5db; flex: 1; }
  .kb-checklist-text.completed { text-decoration: line-through; color: #6b7280; }
  .kb-checklist-add { display: flex; gap: 8px; align-items: center; }

  /* ── Checklist Templates ── */
  .kb-template-actions { display: flex; gap: 6px; margin-top: 8px; flex-wrap: wrap; }
  .kb-template-save-row { display: flex; gap: 6px; align-items: center; width: 100%; }
  .kb-btn-ghost {
    background: transparent !important;
    color: #9ca3af !important;
    border: 1px dashed #374151 !important;
  }
  .kb-btn-ghost:hover {
    background: rgba(99, 102, 241, 0.1) !important;
    color: #a5b4fc !important;
    border-color: #6366f1 !important;
  }
  .kb-template-picker {
    margin-top: 8px;
    border: 1px solid #1e2130;
    border-radius: 10px;
    overflow: hidden;
    background: #14161e !important;
  }
  .kb-template-item {
    display: flex;
    align-items: center;
    border-bottom: 1px solid #1e2130;
  }
  .kb-template-item:last-child { border-bottom: none; }
  .kb-template-apply {
    flex: 1;
    display: flex;
    align-items: center;
    gap: 8px;
    padding: 8px 12px;
    background: transparent !important;
    border: none !important;
    color: #d1d5db !important;
    cursor: pointer;
    text-align: left;
    font-size: 13px;
  }
  .kb-template-apply:hover { background: rgba(99, 102, 241, 0.1) !important; }
  .kb-template-name { flex: 1; }
  .kb-template-count { font-size: 11px; color: #6b7280; }

  /* ── Import Modal ── */
  .kb-import-modal {
    width: 640px;
    max-width: 95vw;
    max-height: 85vh;
    background: #1a1d2e !important;
    border: 1px solid #2a2d3e;
    border-radius: 14px;
    display: flex;
    flex-direction: column;
    overflow: hidden;
  }
  .kb-import-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 16px 20px;
    border-bottom: 1px solid #1e2130;
  }
  .kb-import-title {
    font-size: 16px;
    font-weight: 600;
    color: #e5e7eb;
    margin: 0;
  }
  .kb-import-filters {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 8px;
    padding: 12px 20px;
    border-bottom: 1px solid #1e2130;
    background: rgba(15, 17, 23, 0.5);
  }
  .kb-import-select {
    font-size: 12px !important;
    padding: 6px 28px 6px 10px !important;
    appearance: none !important;
    -webkit-appearance: none !important;
    background-image: url("data:image/svg+xml,%3Csvg width='10' height='6' viewBox='0 0 10 6' fill='none' xmlns='http://www.w3.org/2000/svg'%3E%3Cpath d='M1 1l4 4 4-4' stroke='%236b7280' stroke-width='1.5' stroke-linecap='round' stroke-linejoin='round'/%3E%3C/svg%3E") !important;
    background-repeat: no-repeat !important;
    background-position: right 10px center !important;
  }
  select.kb-import-select option {
    background: #1a1d2e !important;
    color: #e5e7eb !important;
  }
  .kb-import-toolbar {
    display: flex;
    align-items: center;
    gap: 8px;
    padding: 10px 20px;
    border-bottom: 1px solid #1e2130;
  }
  .kb-import-count {
    font-size: 12px;
    color: #818cf8;
    white-space: nowrap;
  }
  .kb-import-list {
    flex: 1;
    overflow-y: auto;
    min-height: 200px;
    max-height: 400px;
  }
  .kb-import-empty {
    display: flex;
    align-items: center;
    justify-content: center;
    padding: 40px;
    color: #6b7280;
    font-size: 13px;
  }
  .kb-import-row {
    display: flex;
    align-items: center;
    gap: 10px;
    padding: 8px 20px;
    cursor: pointer;
    border-bottom: 1px solid #14161e;
    transition: background 0.15s;
  }
  .kb-import-row:hover { background: rgba(99, 102, 241, 0.06); }
  .kb-import-row-selected { background: rgba(99, 102, 241, 0.1); }
  .kb-import-leader-info { flex: 1; display: flex; flex-direction: column; gap: 2px; min-width: 0; }
  .kb-import-leader-name { font-size: 13px; color: #e5e7eb; font-weight: 500; }
  .kb-import-leader-meta { font-size: 11px; color: #6b7280; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
  .kb-import-leader-status {
    font-size: 10px;
    padding: 2px 8px;
    border-radius: 999px;
    background: rgba(99, 102, 241, 0.15) !important;
    color: #a5b4fc;
    white-space: nowrap;
    text-transform: capitalize;
  }
  .kb-import-footer {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 12px 20px;
    border-top: 1px solid #1e2130;
    background: rgba(15, 17, 23, 0.5);
  }
  .kb-import-label { font-size: 12px; color: #9ca3af; white-space: nowrap; }

  /* ── List Actions Modal ── */
  .kb-list-actions-modal {
    width: 520px;
    max-width: 95vw;
    max-height: 85vh;
    background: #1a1d2e !important;
    border: 1px solid #2a2d3e;
    border-radius: 14px;
    display: flex;
    flex-direction: column;
    overflow: hidden;
  }
  .kb-list-actions-body {
    padding: 8px 0;
    overflow-y: auto;
  }
  .kb-list-action-row {
    padding: 12px 20px;
    border-bottom: 1px solid #14161e;
  }
  .kb-list-action-row:last-child { border-bottom: none; }
  .kb-list-action-label {
    display: flex;
    align-items: center;
    gap: 6px;
    font-size: 12px;
    font-weight: 600;
    color: #9ca3af;
    text-transform: uppercase;
    letter-spacing: 0.5px;
    margin-bottom: 8px;
  }
  .kb-list-action-controls {
    display: flex;
    gap: 8px;
    align-items: center;
  }
  .kb-list-action-danger .kb-list-action-label { color: #f87171; }
  .kb-btn-danger {
    background: rgba(239, 68, 68, 0.15) !important;
    color: #f87171 !important;
    border: 1px solid rgba(239, 68, 68, 0.3) !important;
  }
  .kb-btn-danger:hover {
    background: rgba(239, 68, 68, 0.25) !important;
  }
  .kb-list-action-result {
    padding: 10px 20px;
    font-size: 12px;
    color: #34d399;
    text-align: center;
  }

  /* ── Comments ── */
  .kb-comments { display: flex; flex-direction: column; gap: 10px; margin-bottom: 12px; }
  .kb-comment {
    background: #14161e !important;
    border: 1px solid #1e2130;
    border-radius: 10px;
    padding: 10px 12px;
  }
  .kb-comment-header {
    display: flex;
    align-items: center;
    gap: 8px;
    margin-bottom: 4px;
  }
  .kb-comment-actions { display: flex; gap: 2px; margin-left: auto; }
  .kb-comment-author { font-size: 12px; font-weight: 600; color: #a5b4fc; }
  .kb-comment-date { font-size: 10px; color: #6b7280; flex: 1; }
  .kb-comment-text { font-size: 13px; color: #d1d5db; margin: 0 !important; line-height: 1.5; }
  .kb-comment-edit { display: flex; flex-direction: column; gap: 6px; margin-top: 4px; }
  .kb-comment-edit-actions { display: flex; gap: 6px; justify-content: flex-end; }
  .kb-mention { color: #60a5fa; font-weight: 600; background: rgba(96, 165, 250, 0.12); padding: 1px 4px; border-radius: 4px; }
  .kb-comment-text .kb-link,
  .kb-desc-display .kb-link {
    color: #818cf8 !important;
    text-decoration: underline;
    text-underline-offset: 2px;
    word-break: break-all;
    cursor: pointer;
    transition: color 0.12s ease;
  }
  .kb-comment-text .kb-link:hover,
  .kb-desc-display .kb-link:hover {
    color: #a5b4fc !important;
  }
  .kb-desc-display {
    padding: 10px 12px;
    background: #14161e !important;
    border: 1px solid #1e2130;
    border-radius: 10px;
    font-size: 13px;
    color: #d1d5db;
    line-height: 1.6;
    min-height: 60px;
    cursor: text;
    transition: border-color 0.15s ease;
    white-space: pre-wrap;
    word-break: break-word;
  }
  .kb-desc-display:hover {
    border-color: #374151;
  }
  .kb-desc-placeholder {
    color: #4b5563;
    font-style: italic;
  }

  /* ── Rich Text Editor ── */
  .kb-rt-editor {
    border: 1px solid #2a2d3a;
    border-radius: 10px;
    overflow: hidden;
    background: #14161e;
  }
  .kb-rt-toolbar {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: 2px;
    padding: 6px 8px;
    background: #1a1d2a;
    border-bottom: 1px solid #2a2d3a;
  }
  .kb-rt-tool-btn {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    width: 28px;
    height: 28px;
    border: none;
    border-radius: 6px;
    background: transparent;
    color: #9ca3af;
    cursor: pointer;
    transition: background 0.12s ease, color 0.12s ease;
  }
  .kb-rt-tool-btn:hover {
    background: #2a2d3a;
    color: #e5e7eb;
  }
  .kb-rt-tool-btn:active {
    background: #374151;
    color: #fff;
  }
  .kb-rt-tool-sep {
    width: 1px;
    height: 18px;
    background: #2a2d3a;
    margin: 0 4px;
    flex-shrink: 0;
  }
  .kb-rt-editable,
  .kb-rt-editable-sm {
    padding: 10px 12px;
    font-size: 13px;
    color: #d1d5db;
    line-height: 1.6;
    min-height: 80px;
    outline: none;
    overflow-y: auto;
    white-space: pre-wrap;
    word-break: break-word;
  }
  .kb-rt-editable-sm {
    min-height: 48px;
    font-size: 13px;
  }
  .kb-rt-editable:empty::before,
  .kb-rt-editable-sm:empty::before {
    content: attr(data-placeholder);
    color: #4b5563;
    font-style: italic;
    pointer-events: none;
  }
  .kb-rt-editable h3,
  .kb-rt-editable-sm h3 {
    font-size: 15px;
    font-weight: 600;
    color: #e5e7eb;
    margin: 8px 0 4px;
  }
  .kb-rt-editable ul,
  .kb-rt-editable ol,
  .kb-rt-editable-sm ul,
  .kb-rt-editable-sm ol {
    margin: 4px 0;
    padding-left: 20px;
  }
  .kb-rt-editable a,
  .kb-rt-editable-sm a {
    color: #818cf8;
    text-decoration: underline;
    text-underline-offset: 2px;
  }
  .kb-rt-display h3 {
    font-size: 15px;
    font-weight: 600;
    color: #e5e7eb;
    margin: 8px 0 4px;
  }
  .kb-rt-display ul,
  .kb-rt-display ol {
    margin: 4px 0;
    padding-left: 20px;
  }
  .kb-comment-add { display: flex; flex-direction: column; position: relative; }

  /* ── @Mention Dropdown ── */
  .kb-mention-dropdown {
    z-index: 9999;
    background: #1a1d27;
    border: 1px solid #2a2d3a;
    border-radius: 10px;
    box-shadow: 0 8px 24px rgba(0,0,0,0.5);
    max-height: 180px;
    overflow-y: auto;
    min-width: 180px;
    max-width: 260px;
    padding: 4px;
  }
  .kb-mention-option {
    display: flex;
    align-items: center;
    gap: 8px;
    width: 100%;
    padding: 7px 10px;
    border: none;
    border-radius: 7px;
    background: transparent;
    color: #d1d5db;
    font-size: 13px;
    cursor: pointer;
    text-align: left;
    transition: background 0.1s ease;
  }
  .kb-mention-option:hover,
  .kb-mention-option-active {
    background: #2563eb;
    color: #fff;
  }
  .kb-mention-avatar {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    width: 24px;
    height: 24px;
    border-radius: 50%;
    background: #374151;
    color: #a5b4fc;
    font-size: 11px;
    font-weight: 700;
    flex-shrink: 0;
  }
  .kb-mention-option-active .kb-mention-avatar {
    background: rgba(255,255,255,0.2);
    color: #fff;
  }

  /* ── Label Manager ── */
  .kb-lm-modal {
    background: #1a1d27 !important;
    border: 1px solid #2a2d3a;
    border-radius: 18px;
    max-width: 520px;
    width: 100%;
    box-shadow: 0 32px 80px rgba(0,0,0,0.6);
    animation: kb-modal-in 0.2s ease;
    overflow: hidden;
  }
  .kb-lm-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 18px 20px;
    border-bottom: 1px solid #2a2d3a;
  }
  .kb-lm-header-title {
    display: flex;
    align-items: center;
    gap: 8px;
    font-size: 16px;
    font-weight: 700;
    color: #f9fafb;
  }
  .kb-lm-create {
    padding: 16px 20px;
    border-bottom: 1px solid #2a2d3a;
    background: rgba(255,255,255,0.02);
  }
  .kb-lm-create-row {
    display: flex;
    align-items: center;
    gap: 10px;
  }
  .kb-lm-color-btn {
    width: 32px;
    height: 32px;
    border-radius: 8px;
    border: 2px solid rgba(255,255,255,0.15);
    cursor: pointer;
    flex-shrink: 0;
    transition: all 0.15s ease;
  }
  .kb-lm-color-btn:hover {
    border-color: rgba(255,255,255,0.35);
    transform: scale(1.08);
  }
  .kb-lm-color-grid {
    display: grid;
    grid-template-columns: repeat(6, 1fr);
    gap: 6px;
    margin-top: 10px;
  }
  .kb-lm-color-swatch {
    width: 100%;
    height: 32px;
    border-radius: 6px;
    border: 2px solid transparent;
    cursor: pointer;
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    color: #fff;
    transition: all 0.12s ease;
    position: relative;
    font-size: 9px;
    font-weight: 600;
    text-shadow: 0 1px 2px rgba(0,0,0,0.5);
    letter-spacing: 0.02em;
  }
  .kb-lm-color-name {
    font-size: 9px;
    line-height: 1;
    margin-top: 1px;
    opacity: 0.85;
  }
  .kb-lm-color-swatch:hover {
    transform: scale(1.08);
    border-color: rgba(255,255,255,0.4);
  }
  .kb-lm-color-swatch:hover .kb-lm-color-name {
    opacity: 1;
  }
  .kb-lm-color-swatch.active {
    border-color: #fff;
    transform: scale(1.08);
    box-shadow: 0 0 0 2px rgba(255,255,255,0.25);
  }
  .kb-lm-list {
    padding: 8px 12px 12px;
    max-height: 380px;
    overflow-y: auto;
  }
  .kb-lm-empty {
    text-align: center;
    color: #6b7280;
    font-size: 13px;
    padding: 28px 16px;
  }
  .kb-lm-item {
    padding: 6px 8px;
    border-radius: 10px;
    transition: background 0.1s ease;
  }
  .kb-lm-item:hover {
    background: rgba(255,255,255,0.03);
  }
  .kb-lm-display-row {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 8px;
  }
  .kb-lm-label-preview {
    display: inline-flex;
    align-items: center;
    gap: 6px;
    font-size: 13px;
    font-weight: 600;
    padding: 5px 12px;
    border-radius: 8px;
    border: 1px solid;
  }
  .kb-lm-item-actions {
    display: flex;
    align-items: center;
    gap: 2px;
    opacity: 0;
    transition: opacity 0.15s ease;
  }
  .kb-lm-item:hover .kb-lm-item-actions {
    opacity: 1;
  }
  .kb-lm-edit-row {
    display: flex;
    align-items: center;
    gap: 8px;
  }

  /* ── Note Panel ── */
  .kb-note-panel {
    position: fixed;
    top: 64px;
    right: 0;
    bottom: 0;
    width: 400px;
    background: #1a1d2e;
    border-left: 1px solid #2a2d3a;
    display: flex;
    flex-direction: column;
    z-index: 900;
    transform: translateX(100%);
    transition: transform 0.25s cubic-bezier(0.4, 0, 0.2, 1);
    box-shadow: -4px 0 24px rgba(0,0,0,0.3);
  }
  .kb-note-panel.open {
    transform: translateX(0);
  }
  .kb-note-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 14px 16px;
    border-bottom: 1px solid #2a2d3a;
    flex-shrink: 0;
  }
  .kb-note-header-title {
    display: flex;
    align-items: center;
    gap: 8px;
    font-weight: 600;
    font-size: 14px;
    color: #e2e8f0;
  }
  .kb-note-close-btn {
    display: flex !important;
    align-items: center !important;
    justify-content: center !important;
    width: 32px !important;
    height: 32px !important;
    border-radius: 8px !important;
    border: 1px solid #3b3f54 !important;
    background: #1e2235 !important;
    color: #94a3b8 !important;
    cursor: pointer !important;
    transition: all 0.15s ease !important;
    flex-shrink: 0 !important;
    padding: 0 !important;
  }
  .kb-note-close-btn:hover {
    background: #ef4444 !important;
    border-color: #ef4444 !important;
    color: #fff !important;
  }
  /* ── Note Toolbar ── */
  .kb-note-toolbar {
    display: flex;
    align-items: center;
    gap: 2px;
    padding: 8px 12px;
    border-bottom: 1px solid #2a2d3a;
    background: rgba(15, 17, 23, 0.5);
    flex-shrink: 0;
    flex-wrap: wrap;
  }
  .kb-note-tool-btn {
    display: flex !important;
    align-items: center !important;
    justify-content: center !important;
    width: 32px !important;
    height: 32px !important;
    border-radius: 6px !important;
    border: none !important;
    background: transparent !important;
    color: #94a3b8 !important;
    cursor: pointer !important;
    transition: all 0.12s ease !important;
    padding: 0 !important;
  }
  .kb-note-tool-btn:hover {
    background: rgba(99, 102, 241, 0.15) !important;
    color: #a5b4fc !important;
  }
  .kb-note-tool-btn:active {
    background: rgba(99, 102, 241, 0.25) !important;
    color: #c7d2fe !important;
  }
  .kb-note-tool-sep {
    width: 1px;
    height: 20px;
    background: #2a2d3a;
    margin: 0 4px;
    flex-shrink: 0;
  }
  /* ── Note Editable Area ── */
  .kb-note-body {
    flex: 1;
    overflow-y: auto;
    padding: 16px;
  }
  .kb-note-editable {
    min-height: 100%;
    outline: none;
    color: #e2e8f0;
    font-size: 14px;
    line-height: 1.7;
    word-break: break-word;
    caret-color: #818cf8;
  }
  .kb-note-editable:empty::before {
    content: 'Start typing your notes...';
    color: #4b5068;
    font-style: italic;
    pointer-events: none;
  }
  .kb-note-editable h3 {
    font-size: 17px;
    font-weight: 700;
    color: #f1f5f9;
    margin: 16px 0 8px 0;
    line-height: 1.3;
  }
  .kb-note-editable h3:first-child {
    margin-top: 0;
  }
  .kb-note-editable a {
    color: #818cf8;
    text-decoration: underline;
    text-underline-offset: 2px;
    cursor: text;
    position: relative;
  }
  .kb-note-editable a:hover {
    color: #a5b4fc;
    cursor: pointer;
  }
  .kb-note-editable a:hover::after {
    content: '⌘ click to open';
    position: absolute;
    bottom: 100%;
    left: 50%;
    transform: translateX(-50%);
    background: #1e2235;
    color: #94a3b8;
    font-size: 10px;
    padding: 3px 8px;
    border-radius: 4px;
    border: 1px solid #3b3f54;
    white-space: nowrap;
    pointer-events: none;
    z-index: 10;
    font-style: normal;
    font-weight: 500;
    text-decoration: none;
    line-height: 1.4;
  }
  .kb-note-editable ul {
    padding-left: 24px;
    margin: 8px 0;
    list-style-type: disc !important;
  }
  .kb-note-editable ol {
    padding-left: 24px;
    margin: 8px 0;
    list-style-type: decimal !important;
  }
  .kb-note-editable li {
    margin: 2px 0;
    display: list-item !important;
  }
  .kb-note-editable blockquote {
    border-left: 3px solid #6366f1;
    padding-left: 12px;
    margin: 8px 0;
    color: #94a3b8;
    font-style: italic;
  }
  .kb-note-editable s {
    color: #64748b;
  }
  .kb-btn-icon-active {
    background: rgba(99, 102, 241, 0.2) !important;
    color: #818cf8 !important;
  }
  .kb-note-toggle {
    display: flex;
    align-items: center;
    gap: 6px;
    padding: 6px 12px;
    border-radius: 8px;
    border: 1px solid #3b3f54;
    background: #1e2235;
    color: #94a3b8;
    font-size: 13px;
    font-weight: 500;
    cursor: pointer;
    transition: all 0.15s ease;
    white-space: nowrap;
  }
  .kb-note-toggle:hover {
    background: #262b44;
    color: #cbd5e1;
    border-color: #4b5068;
  }
  .kb-note-toggle-active {
    background: rgba(99, 102, 241, 0.15) !important;
    color: #a5b4fc !important;
    border-color: rgba(99, 102, 241, 0.4) !important;
  }
  .kb-note-toggle-active:hover {
    background: rgba(99, 102, 241, 0.25) !important;
  }

  /* ── Inline filter group (desktop) ── */
  .kb-filters-inline {
    display: flex;
    align-items: center;
    gap: 8px;
  }

  /* ── Mobile filter button (hidden on desktop) ── */
  .kb-mobile-filter-btn {
    display: none !important;
    align-items: center;
    justify-content: center;
    width: 34px;
    height: 34px;
    border-radius: 10px !important;
    border: 1px solid #2a2d3a !important;
    background: #1a1d27 !important;
    color: #9ca3af !important;
    cursor: pointer;
    position: relative;
    padding: 0 !important;
    flex-shrink: 0;
  }
  .kb-mobile-filter-btn:hover { border-color: #6366f1 !important; color: #e5e7eb !important; }
  .kb-mobile-filter-btn.has-active::after {
    content: '';
    position: absolute;
    top: 4px;
    right: 4px;
    width: 7px;
    height: 7px;
    border-radius: 50%;
    background: #6366f1;
  }

  /* ── Mobile filter panel (hidden on desktop) ── */
  .kb-mobile-filter-panel {
    display: none;
    padding: 12px 16px;
    background: rgba(15, 17, 23, 0.98);
    border-bottom: 1px solid #1e2130;
    flex-direction: column;
    gap: 10px;
  }
  .kb-mobile-filter-row {
    display: flex;
    align-items: center;
    gap: 10px;
  }
  .kb-mobile-filter-label {
    font-size: 12px;
    font-weight: 600;
    color: #9ca3af;
    min-width: 60px;
    white-space: nowrap;
  }
  .kb-mobile-filter-row .kb-filter-select {
    flex: 1;
  }
  .kb-mobile-filter-clear {
    align-self: flex-end;
    font-size: 11px !important;
    color: #6366f1 !important;
    background: transparent !important;
    border: none !important;
    cursor: pointer;
    padding: 4px 0 !important;
    font-weight: 600;
  }
  .kb-mobile-filter-clear:hover { color: #818cf8 !important; }

  /* ── Custom Fields ── */
  .kb-cf-section { border-top: 1px solid #2a2d3a; padding-top: 12px; margin-top: 4px; display: flex; flex-direction: column; gap: 10px; max-width: 100%; overflow: hidden; }
  .kb-cf-field { display: flex; flex-direction: column; gap: 4px; max-width: 100%; overflow: hidden; }
  .kb-cf-label { font-size: 12px; color: #94a3b8; font-weight: 500; }
  .kb-cf-checkbox-row { display: flex; align-items: center; gap: 8px; font-size: 13px; color: #e2e8f0; cursor: pointer; }
  .kb-cf-checkbox-row input[type="checkbox"] { accent-color: #6366f1; width: 16px; height: 16px; }
  .kb-cf-multi-options { display: flex; flex-wrap: wrap; gap: 4px; max-width: 100%; }
  .kb-cf-multi-chip {
    padding: 3px 10px; border-radius: 12px; font-size: 12px; cursor: pointer;
    background: #23263a; color: #9ca3af; border: 1px solid #3b3f54; transition: all 0.15s;
  }
  .kb-cf-multi-chip:hover { border-color: #6366f1; color: #c7d2fe; }

  /* ── Repeat Picker ── */
  .kb-repeat-picker { display: flex; gap: 6px; }
  .kb-repeat-option {
    flex: 1; padding: 6px 0; border-radius: 6px; font-size: 12px; font-weight: 500;
    text-align: center; cursor: pointer; border: 1px solid #3b3f54;
    background: #1a1d2e; color: #9ca3af; transition: all 0.15s;
  }
  .kb-repeat-option:hover { border-color: #6366f1; color: #c7d2fe; }
  .kb-repeat-option.active { background: #2563eb; border-color: #2563eb; color: #fff; }
  .kb-repeat-hint { font-size: 11px; color: #64748b; margin-top: 4px; line-height: 1.4; }
  .kb-cf-multi-chip.active { background: rgba(99,102,241,0.18); color: #a5b4fc; border-color: #6366f1; }
  .kb-cf-type-badge {
    display: inline-block; font-size: 10px; padding: 1px 7px; border-radius: 8px; margin-left: 8px;
    background: #23263a; color: #9ca3af; border: 1px solid #3b3f54;
  }

  /* ── Custom Field Manager Modal ── */
  .kb-cfm-modal { max-width: 540px; }
  .kb-cfm-add-row { display: flex; gap: 8px; align-items: center; }
  .kb-cfm-list { display: flex; flex-direction: column; gap: 6px; max-height: 340px; overflow-y: auto; }
  .kb-cfm-item {
    display: flex; align-items: center; gap: 8px; padding: 8px 10px;
    background: #1e2030; border: 1px solid #2a2d3a; border-radius: 8px;
  }

  /* ── Email Panel ── */
  .kb-email-panel {
    position: fixed;
    top: 64px;
    right: 0;
    bottom: 0;
    width: 500px;
    background: #1a1d2e;
    border-left: 1px solid #2a2d3a;
    display: flex;
    flex-direction: column;
    z-index: 900;
    transform: translateX(100%);
    transition: transform 0.25s cubic-bezier(0.4, 0, 0.2, 1);
    box-shadow: -4px 0 24px rgba(0,0,0,0.3);
  }
  .kb-email-panel.open {
    transform: translateX(0);
  }
  .kb-email-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 14px 16px;
    border-bottom: 1px solid #2a2d3a;
    flex-shrink: 0;
  }
  .kb-email-tabs {
    display: flex;
    gap: 0;
    padding: 8px 12px;
    border-bottom: 1px solid #2a2d3a;
  }
  .kb-email-tab {
    flex: 1;
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 4px;
    padding: 7px 12px;
    border-radius: 8px;
    border: 1px solid transparent;
    background: transparent;
    color: #94a3b8;
    font-size: 12px;
    font-weight: 600;
    cursor: pointer;
    transition: all 0.15s ease;
  }
  .kb-email-tab:hover {
    background: rgba(99,102,241,0.08);
    color: #c7d2fe;
  }
  .kb-email-tab.active {
    background: #2563eb;
    color: #fff;
    border-color: #2563eb;
  }
  .kb-email-copy-btn {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    width: 20px;
    height: 20px;
    border-radius: 4px;
    border: 1px solid #3b3f54;
    background: #1e2235;
    color: #94a3b8;
    cursor: pointer;
    padding: 0;
    transition: all 0.15s ease;
  }
  .kb-email-copy-btn:hover {
    background: #2a2d3a;
    color: #e2e8f0;
  }
  .kb-email-list {
    flex: 1;
    overflow-y: auto;
  }
  .kb-email-empty {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    padding: 48px 24px;
    color: #6b7280;
    font-size: 13px;
    text-align: center;
  }
  .kb-email-item {
    display: flex;
    align-items: flex-start;
    gap: 8px;
    padding: 10px 16px;
    border-bottom: 1px solid #1e2130;
    transition: background 0.1s ease;
  }
  .kb-email-item:hover {
    background: rgba(99,102,241,0.05);
  }
  .kb-email-item-main {
    flex: 1;
    min-width: 0;
    cursor: pointer;
  }
  .kb-email-item-subject {
    font-size: 13px;
    font-weight: 600;
    color: #e2e8f0;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
    margin-bottom: 2px;
  }
  .kb-email-item-meta {
    display: flex;
    gap: 8px;
    font-size: 11px;
    color: #64748b;
  }
  .kb-email-item-preview {
    font-size: 11px;
    color: #6b7280;
    margin-top: 3px;
    line-height: 1.4;
    overflow: hidden;
    display: -webkit-box;
    -webkit-line-clamp: 2;
    -webkit-box-orient: vertical;
  }
  .kb-email-item-actions {
    display: flex;
    flex-direction: column;
    gap: 4px;
    align-items: flex-end;
    flex-shrink: 0;
  }
  .kb-email-route-btn {
    display: flex;
    align-items: center;
    justify-content: center;
    width: 24px;
    height: 24px;
    border-radius: 6px;
    border: 1px solid #22c55e;
    background: rgba(34,197,94,0.12);
    color: #22c55e;
    cursor: pointer;
    padding: 0;
    transition: all 0.15s ease;
  }
  .kb-email-route-btn:hover {
    background: #22c55e;
    color: #fff;
  }
  .kb-email-detail {
    display: flex;
    flex-direction: column;
    height: 100%;
  }
  .kb-email-detail-header {
    display: flex;
    align-items: center;
    gap: 10px;
    padding: 12px 16px;
    border-bottom: 1px solid #2a2d3a;
    flex-shrink: 0;
  }
  .kb-email-body {
    flex: 1;
    overflow-y: auto;
    padding: 16px;
    font-size: 13px;
    line-height: 1.6;
    color: #d1d5db;
    word-break: break-word;
  }
  .kb-email-body img {
    max-width: 100%;
    height: auto;
  }
  .kb-email-body a {
    color: #818cf8;
    text-decoration: underline;
  }
  .kb-email-body table {
    border-collapse: collapse;
    max-width: 100%;
  }
  .kb-email-body td, .kb-email-body th {
    border: 1px solid #2a2d3a;
    padding: 6px 10px;
  }

  /* ── Realtime toast ── */
  .kb-toast-container {
    position: fixed;
    bottom: 20px;
    right: 20px;
    z-index: 9999;
    display: flex;
    flex-direction: column;
    gap: 8px;
    pointer-events: none;
  }
  .kb-toast {
    display: flex;
    align-items: center;
    gap: 8px;
    background: #1e2130;
    border: 1px solid #2a2d3a;
    border-left: 3px solid #3b82f6;
    border-radius: 8px;
    padding: 10px 14px;
    color: #e5e7eb;
    font-size: 13px;
    pointer-events: auto;
    animation: kb-toast-in 0.25s ease-out;
    box-shadow: 0 4px 12px rgba(0,0,0,0.4);
    max-width: 340px;
  }
  .kb-toast-dot {
    width: 6px;
    height: 6px;
    border-radius: 50%;
    background: #3b82f6;
    flex-shrink: 0;
  }
  .kb-toast-msg {
    flex: 1;
    min-width: 0;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }
  .kb-toast-dismiss {
    background: none;
    border: none;
    color: #6b7280;
    font-size: 16px;
    cursor: pointer;
    padding: 0 2px;
    line-height: 1;
    flex-shrink: 0;
  }
  .kb-toast-dismiss:hover { color: #e5e7eb; }
  @keyframes kb-toast-in {
    from { opacity: 0; transform: translateY(12px); }
    to { opacity: 1; transform: translateY(0); }
  }

  /* ── Responsive ── */
  @media (max-width: 768px) {
    .kb-topbar { flex-direction: column; align-items: flex-start; }
    .kb-topbar-right { width: 100%; flex-wrap: wrap; gap: 8px; }
    .kb-filters-inline { display: none !important; }
    .kb-mobile-filter-btn { display: flex !important; }
    .kb-mobile-filter-panel { display: flex; }
    .kb-search-box { width: 100%; min-width: 0; order: -1; }
    .kb-search-input { width: 100% !important; font-size: 16px !important; }
    .kb-column { width: 280px; min-width: 280px; }
    .kb-add-column { width: 280px; min-width: 280px; }
    .kb-detail-body { flex-direction: column; overflow-x: hidden; }
    .kb-detail-sidebar { width: 100%; border-top: 1px solid #2a2d3a; overflow: hidden; }
    .kb-detail-main { border-right: none; padding: 20px 16px; overflow: hidden; }
    .kb-note-panel { width: 100%; }
    .kb-email-panel { width: 100%; }

    /* Card mobile fixes */
    .kb-card-label { max-width: 100px; }
    .kb-card-repeat-front { font-size: 9px; }
    .kb-card-meta { gap: 3px 5px; }
    .kb-card-priority-select { max-width: 74px; font-size: 9px; }

    /* Detail modal mobile */
    .kb-modal-overlay { padding: 8px 8px 80px; padding-top: max(8px, env(safe-area-inset-top, 8px)); }
    .kb-detail-modal { border-radius: 14px; max-width: calc(100vw - 16px); }
    .kb-detail-title-input { font-size: 17px !important; }
    .kb-detail-sidebar { padding: 20px 16px; }
    .kb-textarea { font-size: 14px !important; }
    .kb-input, .kb-textarea { font-size: 16px !important; }
    .kb-cf-field { overflow: hidden; }
    .kb-cf-section { overflow: hidden; }
    .kb-repeat-picker { overflow: hidden; }
    .kb-form-group { overflow: hidden; max-width: 100%; }

    /* Custom fields mobile */
    .kb-cf-multi-options { gap: 3px; }
    .kb-cf-multi-chip { font-size: 11px; padding: 2px 8px; }

    /* Rich text editor mobile */
    .kb-rt-toolbar { padding: 4px 6px; gap: 1px; }
    .kb-rt-tool-btn { width: 32px; height: 32px; }
    .kb-rt-editable { min-height: 60px; font-size: 14px; }
    .kb-rt-editable-sm { min-height: 40px; font-size: 14px; }
  }

  /* ── AI Preview ── */
  .kb-ai-preview {
    background: rgba(99, 102, 241, 0.08);
    border: 1px solid rgba(99, 102, 241, 0.25);
    border-radius: 8px;
    padding: 10px 12px;
    margin-bottom: 8px;
  }
  .kb-ai-preview-label {
    display: flex;
    align-items: center;
    gap: 5px;
    font-size: 11px;
    font-weight: 600;
    color: #818cf8;
    margin-bottom: 6px;
    text-transform: uppercase;
    letter-spacing: 0.03em;
  }
  .kb-ai-preview-content {
    font-size: 13px;
    color: #e5e7eb;
    line-height: 1.5;
    margin-bottom: 8px;
  }
  .kb-ai-preview-actions {
    display: flex;
    gap: 6px;
  }
`;
