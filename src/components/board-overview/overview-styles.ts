export const overviewStyles = `
  .kb-ov-root {
    min-height: 100vh;
    background: #0f1117;
    color: #e5e7eb;
    font-family: -apple-system, BlinkMacSystemFont, 'SF Pro Text', system-ui, sans-serif;
  }

  /* ── Header ── */
  .kb-ov-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 12px 20px;
    border-bottom: 1px solid #1e2130;
    background: rgba(15,17,23,0.95);
    backdrop-filter: blur(8px);
    position: sticky;
    top: 0;
    z-index: 100;
    gap: 12px;
    flex-wrap: wrap;
  }
  .kb-ov-header-left {
    display: flex;
    align-items: center;
    gap: 12px;
    min-width: 0;
  }
  .kb-ov-back-btn {
    display: flex;
    align-items: center;
    gap: 6px;
    font-size: 13px;
    color: #9ca3af;
    background: none;
    border: none;
    cursor: pointer;
    padding: 6px 8px;
    border-radius: 6px;
    transition: background 0.12s;
    white-space: nowrap;
  }
  .kb-ov-back-btn:hover {
    background: rgba(255,255,255,0.06);
    color: #e5e7eb;
  }
  .kb-ov-header-title {
    display: flex;
    align-items: center;
    gap: 8px;
    font-size: 17px;
    font-weight: 700;
    color: #f9fafb;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }
  .kb-ov-header-actions {
    display: flex;
    align-items: center;
    gap: 8px;
  }
  .kb-ov-print-btn {
    display: flex;
    align-items: center;
    gap: 6px;
    font-size: 12px;
    font-weight: 500;
    padding: 5px 12px;
    border-radius: 7px;
    background: rgba(255,255,255,0.04);
    border: 1px solid #1e2130;
    color: #9ca3af;
    cursor: pointer;
    transition: all 0.12s;
    white-space: nowrap;
  }
  .kb-ov-print-btn:hover {
    background: rgba(255,255,255,0.08);
    border-color: #374151;
    color: #e5e7eb;
  }

  /* ── Page body ── */
  .kb-ov-body {
    max-width: 960px;
    margin: 0 auto;
    padding: 24px 20px 64px;
  }

  /* ── Summary strip ── */
  .kb-ov-summary-strip {
    display: grid;
    grid-template-columns: repeat(4, 1fr);
    gap: 12px;
    margin-bottom: 28px;
  }
  @media (max-width: 700px) {
    .kb-ov-summary-strip {
      grid-template-columns: repeat(2, 1fr);
    }
  }
  @media (max-width: 380px) {
    .kb-ov-summary-strip {
      grid-template-columns: 1fr;
    }
  }
  .kb-ov-stat-card {
    background: #141621;
    border: 1px solid #1e2130;
    border-radius: 12px;
    padding: 16px;
  }
  .kb-ov-stat-label {
    font-size: 11px;
    font-weight: 600;
    text-transform: uppercase;
    letter-spacing: 0.05em;
    color: #6b7280;
    margin-bottom: 8px;
  }
  .kb-ov-stat-value {
    font-size: 28px;
    font-weight: 700;
    color: #f9fafb;
    line-height: 1;
    margin-bottom: 4px;
  }
  .kb-ov-stat-sub {
    font-size: 12px;
    color: #9ca3af;
  }
  .kb-ov-stat-card.danger .kb-ov-stat-value {
    color: #f87171;
  }
  .kb-ov-stat-card.success .kb-ov-stat-value {
    color: #34d399;
  }
  .kb-ov-stat-card.warning .kb-ov-stat-value {
    color: #fbbf24;
  }

  /* ── Section ── */
  .kb-ov-section {
    background: #141621;
    border: 1px solid #1e2130;
    border-radius: 12px;
    padding: 20px;
    margin-bottom: 16px;
  }
  .kb-ov-section-heading {
    font-size: 13px;
    font-weight: 600;
    text-transform: uppercase;
    letter-spacing: 0.05em;
    color: #6b7280;
    margin-bottom: 16px;
    display: flex;
    align-items: center;
    gap: 6px;
  }

  /* ── Progress rows (column breakdown) ── */
  .kb-ov-progress-row {
    display: grid;
    grid-template-columns: 140px 1fr 60px 50px;
    align-items: center;
    gap: 12px;
    margin-bottom: 10px;
  }
  @media (max-width: 500px) {
    .kb-ov-progress-row {
      grid-template-columns: 1fr 40px;
    }
    .kb-ov-progress-row .kb-ov-bar-wrap {
      display: none;
    }
    .kb-ov-progress-row .kb-ov-progress-count {
      display: none;
    }
  }
  .kb-ov-progress-col-name {
    font-size: 13px;
    color: #e5e7eb;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
    display: flex;
    align-items: center;
    gap: 6px;
  }
  .kb-ov-col-dot {
    width: 8px;
    height: 8px;
    border-radius: 50%;
    flex-shrink: 0;
  }
  .kb-ov-bar-wrap {
    background: #1e2130;
    border-radius: 4px;
    height: 6px;
    overflow: hidden;
  }
  .kb-ov-bar-fill {
    height: 100%;
    border-radius: 4px;
    transition: width 0.4s ease;
  }
  .kb-ov-progress-count {
    font-size: 12px;
    color: #6b7280;
    text-align: right;
    white-space: nowrap;
  }
  .kb-ov-progress-pct {
    font-size: 13px;
    font-weight: 600;
    color: #9ca3af;
    text-align: right;
    white-space: nowrap;
  }

  /* ── Priority bars ── */
  .kb-ov-priority-row {
    display: grid;
    grid-template-columns: 70px 1fr 32px;
    align-items: center;
    gap: 10px;
    margin-bottom: 10px;
  }
  .kb-ov-priority-label {
    font-size: 12px;
    font-weight: 600;
    white-space: nowrap;
  }
  .kb-ov-priority-count {
    font-size: 12px;
    font-weight: 600;
    text-align: right;
  }

  /* ── Assignee table ── */
  .kb-ov-assignee-table {
    width: 100%;
    border-collapse: collapse;
  }
  .kb-ov-assignee-table th {
    font-size: 11px;
    font-weight: 600;
    text-transform: uppercase;
    letter-spacing: 0.05em;
    color: #4b5563;
    text-align: left;
    padding: 0 8px 10px 0;
    border-bottom: 1px solid #1e2130;
  }
  .kb-ov-assignee-table th:not(:first-child) {
    text-align: right;
  }
  .kb-ov-assignee-table td {
    font-size: 13px;
    color: #d1d5db;
    padding: 10px 8px 10px 0;
    border-bottom: 1px solid #1a1d2a;
  }
  .kb-ov-assignee-table td:not(:first-child) {
    text-align: right;
    color: #9ca3af;
  }
  .kb-ov-assignee-table tr:last-child td {
    border-bottom: none;
  }
  .kb-ov-assignee-name {
    font-weight: 500;
    color: #e5e7eb;
  }

  /* ── Timeline ── */
  .kb-ov-timeline-group {
    margin-bottom: 20px;
  }
  .kb-ov-timeline-group:last-child {
    margin-bottom: 0;
  }
  .kb-ov-timeline-group-header {
    font-size: 11px;
    font-weight: 700;
    text-transform: uppercase;
    letter-spacing: 0.08em;
    padding: 0 0 8px 0;
    margin-bottom: 4px;
    border-bottom: 1px solid #1e2130;
    display: flex;
    align-items: center;
    gap: 6px;
  }
  .kb-ov-timeline-count {
    font-size: 11px;
    font-weight: 600;
    padding: 1px 6px;
    border-radius: 10px;
    background: #1e2130;
    color: #6b7280;
  }
  .kb-ov-card-row {
    display: grid;
    grid-template-columns: 1fr auto auto auto;
    align-items: center;
    gap: 12px;
    padding: 9px 0;
    border-bottom: 1px solid #1a1d2a;
    cursor: pointer;
    transition: background 0.1s;
    border-radius: 6px;
  }
  .kb-ov-card-row:hover {
    background: rgba(255,255,255,0.03);
  }
  .kb-ov-card-row:last-child {
    border-bottom: none;
  }
  .kb-ov-card-title {
    font-size: 13px;
    color: #d1d5db;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
    min-width: 0;
  }
  .kb-ov-card-meta {
    font-size: 11px;
    color: #6b7280;
    white-space: nowrap;
  }
  .kb-ov-priority-badge {
    font-size: 10px;
    font-weight: 700;
    text-transform: uppercase;
    letter-spacing: 0.05em;
    padding: 2px 6px;
    border-radius: 4px;
    white-space: nowrap;
  }

  /* ── Filter bar ── */
  .kb-ov-filter-bar {
    display: flex;
    align-items: center;
    gap: 8px;
    margin-bottom: 16px;
    flex-wrap: wrap;
  }
  .kb-ov-search-wrap {
    position: relative;
    flex: 1;
    min-width: 160px;
  }
  .kb-ov-search-icon {
    position: absolute;
    left: 10px;
    top: 50%;
    transform: translateY(-50%);
    color: #6b7280;
    pointer-events: none;
  }
  .kb-ov-search-input {
    width: 100%;
    padding: 8px 10px 8px 32px;
    background: #0f1117;
    border: 1px solid #1e2130;
    border-radius: 8px;
    color: #e5e7eb;
    font-size: 13px;
    outline: none;
    box-sizing: border-box;
  }
  .kb-ov-search-input:focus {
    border-color: #6366f1;
  }
  .kb-ov-filter-select {
    padding: 8px 10px;
    background: #0f1117;
    border: 1px solid #1e2130;
    border-radius: 8px;
    color: #e5e7eb;
    font-size: 13px;
    outline: none;
    cursor: pointer;
  }
  .kb-ov-filter-select:focus {
    border-color: #6366f1;
  }
  .kb-ov-filter-count {
    font-size: 12px;
    color: #6b7280;
    white-space: nowrap;
  }

  /* ── Card table (filter results) ── */
  .kb-ov-card-table {
    width: 100%;
    border-collapse: collapse;
    font-size: 13px;
  }
  .kb-ov-card-table th {
    font-size: 11px;
    font-weight: 600;
    text-transform: uppercase;
    letter-spacing: 0.05em;
    color: #4b5563;
    text-align: left;
    padding: 0 12px 10px 0;
    border-bottom: 1px solid #1e2130;
    white-space: nowrap;
  }
  .kb-ov-sort-th:hover {
    color: #9ca3af;
  }
  .kb-ov-sort-th-inner {
    display: inline-flex;
    align-items: center;
    gap: 3px;
  }
  .kb-ov-card-table td {
    padding: 9px 12px 9px 0;
    border-bottom: 1px solid #1a1d2a;
    color: #d1d5db;
    vertical-align: middle;
  }
  .kb-ov-card-table tr:last-child td {
    border-bottom: none;
  }
  .kb-ov-card-table tbody tr {
    cursor: pointer;
    transition: background 0.1s;
  }
  .kb-ov-card-table tbody tr:hover td {
    background: rgba(255,255,255,0.02);
  }
  .kb-ov-card-table-wrap {
    overflow-x: auto;
  }

  /* ── Loading / empty ── */
  .kb-ov-loading {
    display: flex;
    align-items: center;
    justify-content: center;
    min-height: 60vh;
    color: #6b7280;
    font-size: 14px;
    gap: 10px;
  }
  .kb-ov-empty {
    text-align: center;
    padding: 32px 16px;
    color: #4b5563;
    font-size: 13px;
  }

  /* ── Completion ring (header accent) ── */
  .kb-ov-completion-badge {
    display: inline-flex;
    align-items: center;
    gap: 6px;
    background: rgba(52,211,153,0.1);
    border: 1px solid rgba(52,211,153,0.25);
    border-radius: 20px;
    padding: 3px 10px;
    font-size: 12px;
    font-weight: 600;
    color: #34d399;
  }
`;
