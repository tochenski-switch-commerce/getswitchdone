'use client';

import React, { useState, useEffect, useCallback, useRef } from 'react';
import { Sparkles, X, ChevronDown, ChevronRight, Loader, Zap } from '@/components/BoardIcons';
import { hapticLight } from '@/lib/haptics';

interface AutopilotInsight {
  id: string;
  type: string;
  severity: 'info' | 'warning' | 'urgent';
  title: string;
  description: string;
  cardIds?: string[];
  actions?: { label: string; action: string; payload: Record<string, unknown> }[];
}

export default function AutopilotBanner({
  boardId,
  accessToken,
  onOpenChat,
  onNavigateToCard,
}: {
  boardId: string;
  accessToken: string;
  onOpenChat: (prompt?: string) => void;
  onNavigateToCard?: (cardId: string) => void;
}) {
  const [insights, setInsights] = useState<AutopilotInsight[]>([]);
  const [standup, setStandup] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [collapsed, setCollapsed] = useState(false);
  const [dismissed, setDismissed] = useState<Set<string>>(new Set());
  const [standupLoading, setStandupLoading] = useState(false);
  const fetchedRef = useRef(false);

  const fetchInsights = useCallback(async () => {
    if (!accessToken || !boardId) return;
    setLoading(true);
    try {
      const res = await fetch('/api/ai/autopilot', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${accessToken}` },
        body: JSON.stringify({ boardId }),
      });
      if (res.ok) {
        const data = await res.json();
        setInsights(data.insights || []);
      }
    } catch {
      // Silently fail — autopilot is a nice-to-have
    } finally {
      setLoading(false);
    }
  }, [accessToken, boardId]);

  const fetchStandup = useCallback(async () => {
    if (!accessToken || !boardId) return;
    setStandupLoading(true);
    try {
      const res = await fetch('/api/ai/autopilot', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${accessToken}` },
        body: JSON.stringify({ boardId, includeStandup: true }),
      });
      if (res.ok) {
        const data = await res.json();
        if (data.standup) setStandup(data.standup);
        if (data.insights) setInsights(data.insights);
      }
    } catch {
      // Silent
    } finally {
      setStandupLoading(false);
    }
  }, [accessToken, boardId]);

  useEffect(() => {
    if (!fetchedRef.current) {
      fetchedRef.current = true;
      fetchInsights();
    }
  }, [fetchInsights]);

  const dismiss = (id: string) => {
    hapticLight();
    setDismissed(prev => new Set(prev).add(id));
  };

  const visibleInsights = insights.filter(i => !dismissed.has(i.id));
  const hasContent = visibleInsights.length > 0 || standup;

  if (loading && insights.length === 0) return null;
  if (!hasContent && !loading) return null;

  const severityIcon = (s: string) => {
    if (s === 'urgent') return '🔴';
    if (s === 'warning') return '🟡';
    return '🔵';
  };

  return (
    <div className="kb-autopilot">
      <style>{autopilotStyles}</style>

      <button
        className="kb-autopilot-toggle"
        onClick={() => { setCollapsed(!collapsed); hapticLight(); }}
      >
        <Zap size={14} style={{ color: '#818cf8' }} />
        <span className="kb-autopilot-toggle-label">
          Autopilot
          {visibleInsights.length > 0 && (
            <span className="kb-autopilot-count">{visibleInsights.length}</span>
          )}
        </span>
        {collapsed ? <ChevronRight size={13} /> : <ChevronDown size={13} />}
      </button>

      {!collapsed && (
        <div className="kb-autopilot-body">
          {/* Standup section */}
          {standup ? (
            <div className="kb-autopilot-standup">
              <div className="kb-autopilot-standup-label">
                <Sparkles size={12} /> Daily Summary
              </div>
              <p className="kb-autopilot-standup-text">{standup}</p>
            </div>
          ) : (
            <button
              className="kb-autopilot-standup-btn"
              onClick={fetchStandup}
              disabled={standupLoading}
            >
              {standupLoading ? (
                <><Loader size={13} style={{ animation: 'kb-ap-spin 1s linear infinite' }} /> Generating summary...</>
              ) : (
                <><Sparkles size={13} /> Generate daily summary</>
              )}
            </button>
          )}

          {/* Insights */}
          {visibleInsights.length > 0 && (
            <div className="kb-autopilot-insights">
              {visibleInsights.map(insight => (
                <div key={insight.id} className={`kb-autopilot-card kb-autopilot-card-${insight.severity}`}>
                  <div className="kb-autopilot-card-header">
                    <span className="kb-autopilot-card-icon">{severityIcon(insight.severity)}</span>
                    <span className="kb-autopilot-card-title">{insight.title}</span>
                    <button className="kb-autopilot-dismiss" onClick={() => dismiss(insight.id)} title="Dismiss">
                      <X size={12} />
                    </button>
                  </div>
                  <p className="kb-autopilot-card-desc">{insight.description}</p>
                  {(insight.actions || insight.cardIds) && (
                    <div className="kb-autopilot-card-actions">
                      {insight.actions?.map((a, i) => (
                        <button
                          key={i}
                          className="kb-autopilot-action-btn"
                          onClick={() => {
                            hapticLight();
                            if (a.action === 'chat') onOpenChat(a.payload?.prompt as string);
                          }}
                        >
                          <Sparkles size={11} /> {a.label}
                        </button>
                      ))}
                      {insight.cardIds && insight.cardIds.length > 0 && onNavigateToCard && (
                        <button
                          className="kb-autopilot-action-btn kb-autopilot-action-secondary"
                          onClick={() => { hapticLight(); onNavigateToCard(insight.cardIds![0]); }}
                        >
                          View card
                        </button>
                      )}
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

const autopilotStyles = `
  .kb-autopilot {
    margin: 0 12px 8px;
    border-radius: 12px;
    background: rgba(255,255,255,0.03);
    border: 1px solid rgba(255,255,255,0.07);
    overflow: hidden;
  }

  .kb-autopilot-toggle {
    display: flex;
    align-items: center;
    gap: 6px;
    width: 100%;
    padding: 10px 14px;
    background: none;
    border: none;
    color: #9ca3af;
    font-size: 13px;
    font-weight: 600;
    cursor: pointer;
    -webkit-tap-highlight-color: transparent;
    text-align: left;
  }
  .kb-autopilot-toggle:active { background: rgba(255,255,255,0.03); }
  .kb-autopilot-toggle-label {
    flex: 1;
    display: flex;
    align-items: center;
    gap: 6px;
  }
  .kb-autopilot-count {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    min-width: 18px;
    height: 18px;
    border-radius: 9px;
    background: rgba(99,102,241,0.2);
    color: #818cf8;
    font-size: 11px;
    font-weight: 700;
    padding: 0 5px;
  }

  .kb-autopilot-body {
    padding: 0 14px 12px;
    display: flex;
    flex-direction: column;
    gap: 10px;
  }

  /* Standup */
  .kb-autopilot-standup {
    background: rgba(99,102,241,0.08);
    border: 1px solid rgba(99,102,241,0.18);
    border-radius: 10px;
    padding: 10px 12px;
  }
  .kb-autopilot-standup-label {
    display: flex;
    align-items: center;
    gap: 5px;
    font-size: 11px;
    font-weight: 700;
    color: #818cf8;
    text-transform: uppercase;
    letter-spacing: 0.03em;
    margin-bottom: 6px;
  }
  .kb-autopilot-standup-text {
    font-size: 13px;
    color: #d1d5db;
    line-height: 1.55;
    margin: 0;
  }
  .kb-autopilot-standup-btn {
    display: flex;
    align-items: center;
    gap: 6px;
    font-size: 12px;
    font-weight: 600;
    color: #818cf8;
    background: rgba(99,102,241,0.08);
    border: 1px dashed rgba(99,102,241,0.25);
    border-radius: 10px;
    padding: 10px 14px;
    cursor: pointer;
    width: 100%;
    -webkit-tap-highlight-color: transparent;
  }
  .kb-autopilot-standup-btn:active { background: rgba(99,102,241,0.15); }
  .kb-autopilot-standup-btn:disabled { opacity: 0.7; cursor: default; }

  /* Insight cards */
  .kb-autopilot-insights {
    display: flex;
    flex-direction: column;
    gap: 8px;
  }
  .kb-autopilot-card {
    border-radius: 10px;
    padding: 10px 12px;
    border: 1px solid rgba(255,255,255,0.07);
    background: rgba(255,255,255,0.03);
  }
  .kb-autopilot-card-urgent { border-left: 3px solid #ef4444; }
  .kb-autopilot-card-warning { border-left: 3px solid #f59e0b; }
  .kb-autopilot-card-info { border-left: 3px solid #6366f1; }

  .kb-autopilot-card-header {
    display: flex;
    align-items: center;
    gap: 6px;
    margin-bottom: 4px;
  }
  .kb-autopilot-card-icon { font-size: 12px; flex-shrink: 0; }
  .kb-autopilot-card-title {
    font-size: 13px;
    font-weight: 700;
    color: #f9fafb;
    flex: 1;
  }
  .kb-autopilot-dismiss {
    width: 22px;
    height: 22px;
    border-radius: 6px;
    background: none;
    border: none;
    color: #6b7280;
    display: flex;
    align-items: center;
    justify-content: center;
    cursor: pointer;
    flex-shrink: 0;
    -webkit-tap-highlight-color: transparent;
  }
  .kb-autopilot-dismiss:active { background: rgba(255,255,255,0.08); }

  .kb-autopilot-card-desc {
    font-size: 12px;
    color: #9ca3af;
    line-height: 1.5;
    margin: 0 0 6px;
  }
  .kb-autopilot-card-actions {
    display: flex;
    flex-wrap: wrap;
    gap: 6px;
  }
  .kb-autopilot-action-btn {
    display: inline-flex;
    align-items: center;
    gap: 4px;
    font-size: 11px;
    font-weight: 600;
    color: #c4b5fd;
    background: rgba(99,102,241,0.12);
    border: 1px solid rgba(99,102,241,0.2);
    padding: 5px 10px;
    border-radius: 7px;
    cursor: pointer;
    -webkit-tap-highlight-color: transparent;
  }
  .kb-autopilot-action-btn:active { background: rgba(99,102,241,0.25); }
  .kb-autopilot-action-secondary {
    color: #9ca3af;
    background: rgba(255,255,255,0.05);
    border-color: rgba(255,255,255,0.1);
  }
  .kb-autopilot-action-secondary:active { background: rgba(255,255,255,0.1); }

  @keyframes kb-ap-spin { to { transform: rotate(360deg); } }

  @media (max-width: 640px) {
    .kb-autopilot {
      margin: 0 8px 8px;
      border-radius: 10px;
    }
    .kb-autopilot-card-desc { font-size: 12px; }
  }
`;
