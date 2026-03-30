'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/contexts/AuthContext';
import {
  ArrowLeft, Key, Zap, Plus, Copy, Trash2, Check, X,
  AlertCircle, Code, Globe,
} from '@/components/BoardIcons';

/* ── Types ── */
interface ApiKey {
  id: string;
  name: string;
  key_prefix: string;
  last_used_at: string | null;
  created_at: string;
  revoked_at: string | null;
}
interface NewKeyResult extends ApiKey { key: string; }

interface WebhookEndpoint {
  id: string;
  name: string;
  url: string;
  events: string[];
  is_active: boolean;
  created_at: string;
}
interface NewWebhookResult extends WebhookEndpoint { secret: string; }

const ALL_EVENTS = [
  'board.created', 'board.updated', 'board.deleted',
  'card.created',  'card.updated',  'card.moved',   'card.deleted',
  'column.created','column.deleted',
  'label.created', 'label.deleted',
];

const ENDPOINT_DOCS = [
  { resource: 'Boards', endpoints: [
    { method: 'GET',    path: '/api/v1/boards',      desc: 'List your boards' },
    { method: 'POST',   path: '/api/v1/boards',      desc: 'Create a board' },
    { method: 'GET',    path: '/api/v1/boards/:id',  desc: 'Board + columns + labels' },
    { method: 'PATCH',  path: '/api/v1/boards/:id',  desc: 'Update board' },
    { method: 'DELETE', path: '/api/v1/boards/:id',  desc: 'Delete board' },
  ]},
  { resource: 'Columns', endpoints: [
    { method: 'GET',    path: '/api/v1/boards/:id/columns',        desc: 'List columns' },
    { method: 'POST',   path: '/api/v1/boards/:id/columns',        desc: 'Create column' },
    { method: 'PATCH',  path: '/api/v1/boards/:id/columns/:colId', desc: 'Update column' },
    { method: 'DELETE', path: '/api/v1/boards/:id/columns/:colId', desc: 'Delete column' },
  ]},
  { resource: 'Cards', endpoints: [
    { method: 'GET',    path: '/api/v1/boards/:id/cards', desc: 'List cards (+ ?column_id)' },
    { method: 'POST',   path: '/api/v1/boards/:id/cards', desc: 'Create card' },
    { method: 'GET',    path: '/api/v1/cards/:id',        desc: 'Get card detail' },
    { method: 'PATCH',  path: '/api/v1/cards/:id',        desc: 'Update card' },
    { method: 'DELETE', path: '/api/v1/cards/:id',        desc: 'Delete card' },
    { method: 'POST',   path: '/api/v1/cards/:id/move',   desc: 'Move card to column' },
  ]},
  { resource: 'Labels', endpoints: [
    { method: 'GET',    path: '/api/v1/boards/:id/labels',            desc: 'List labels' },
    { method: 'POST',   path: '/api/v1/boards/:id/labels',            desc: 'Create label' },
    { method: 'PATCH',  path: '/api/v1/boards/:id/labels/:labelId',   desc: 'Update label' },
    { method: 'DELETE', path: '/api/v1/boards/:id/labels/:labelId',   desc: 'Delete label' },
  ]},
];

/* ── Component ── */
export default function DeveloperPage() {
  const { user, session, loading: authLoading } = useAuth();
  const router = useRouter();

  const [keys, setKeys] = useState<ApiKey[]>([]);
  const [keysLoading, setKeysLoading] = useState(true);
  const [newKeyName, setNewKeyName] = useState('');
  const [creatingKey, setCreatingKey] = useState(false);
  const [newKeyResult, setNewKeyResult] = useState<NewKeyResult | null>(null);
  const [keyCopied, setKeyCopied] = useState(false);
  const [keyMsg, setKeyMsg] = useState<{ type: 'ok' | 'err'; text: string } | null>(null);

  const [webhooks, setWebhooks] = useState<WebhookEndpoint[]>([]);
  const [webhooksLoading, setWebhooksLoading] = useState(true);
  const [showWebhookForm, setShowWebhookForm] = useState(false);
  const [whName, setWhName] = useState('');
  const [whUrl, setWhUrl] = useState('');
  const [whEvents, setWhEvents] = useState<string[]>([]);
  const [creatingWebhook, setCreatingWebhook] = useState(false);
  const [newWebhookResult, setNewWebhookResult] = useState<NewWebhookResult | null>(null);
  const [secretCopied, setSecretCopied] = useState(false);
  const [webhookMsg, setWebhookMsg] = useState<{ type: 'ok' | 'err'; text: string } | null>(null);

  useEffect(() => {
    if (!authLoading && !user) router.replace('/auth?returnTo=/developer');
  }, [authLoading, user, router]);

  const authHeader = session?.access_token ? `Bearer ${session.access_token}` : '';

  const loadKeys = useCallback(async () => {
    if (!authHeader) return;
    setKeysLoading(true);
    try {
      const res = await fetch('/api/user/api-keys', { headers: { Authorization: authHeader } });
      const json = await res.json();
      if (json.data) setKeys(json.data);
    } finally { setKeysLoading(false); }
  }, [authHeader]);

  const loadWebhooks = useCallback(async () => {
    if (!authHeader) return;
    setWebhooksLoading(true);
    try {
      const res = await fetch('/api/user/webhooks', { headers: { Authorization: authHeader } });
      const json = await res.json();
      if (json.data) setWebhooks(json.data);
    } finally { setWebhooksLoading(false); }
  }, [authHeader]);

  useEffect(() => {
    if (session) { loadKeys(); loadWebhooks(); }
  }, [session, loadKeys, loadWebhooks]);

  const handleCreateKey = async () => {
    if (!newKeyName.trim() || !authHeader) return;
    setCreatingKey(true); setKeyMsg(null);
    try {
      const res = await fetch('/api/user/api-keys', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: authHeader },
        body: JSON.stringify({ name: newKeyName.trim() }),
      });
      const json = await res.json();
      if (!res.ok) { setKeyMsg({ type: 'err', text: json.error || 'Failed' }); return; }
      setNewKeyResult(json.data); setNewKeyName(''); loadKeys();
    } catch { setKeyMsg({ type: 'err', text: 'Network error' }); }
    finally { setCreatingKey(false); }
  };

  const handleRevokeKey = async (id: string) => {
    if (!authHeader) return;
    await fetch(`/api/user/api-keys/${id}`, { method: 'DELETE', headers: { Authorization: authHeader } });
    loadKeys();
  };

  const handleCreateWebhook = async () => {
    if (!whName.trim() || !whUrl.trim() || !whEvents.length || !authHeader) return;
    setCreatingWebhook(true); setWebhookMsg(null);
    try {
      const res = await fetch('/api/user/webhooks', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: authHeader },
        body: JSON.stringify({ name: whName.trim(), url: whUrl.trim(), events: whEvents }),
      });
      const json = await res.json();
      if (!res.ok) { setWebhookMsg({ type: 'err', text: json.error || 'Failed' }); return; }
      setNewWebhookResult(json.data);
      setWhName(''); setWhUrl(''); setWhEvents([]);
      setShowWebhookForm(false); loadWebhooks();
    } catch { setWebhookMsg({ type: 'err', text: 'Network error' }); }
    finally { setCreatingWebhook(false); }
  };

  const handleToggleWebhook = async (id: string, isActive: boolean) => {
    if (!authHeader) return;
    await fetch(`/api/user/webhooks/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json', Authorization: authHeader },
      body: JSON.stringify({ is_active: !isActive }),
    });
    loadWebhooks();
  };

  const handleDeleteWebhook = async (id: string) => {
    if (!authHeader) return;
    await fetch(`/api/user/webhooks/${id}`, { method: 'DELETE', headers: { Authorization: authHeader } });
    loadWebhooks();
  };

  const copyText = async (text: string, setCopied: (v: boolean) => void) => {
    await navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const fmtDate = (s: string | null) => {
    if (!s) return 'Never';
    return new Date(s).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
  };

  const toggleEvent = (ev: string) =>
    setWhEvents(v => v.includes(ev) ? v.filter(x => x !== ev) : [...v, ev]);

  if (authLoading) return null;

  return (
    <div style={{ minHeight: '100vh', background: '#0f1117', color: '#e5e7eb', fontFamily: "-apple-system, BlinkMacSystemFont, 'SF Pro Text', system-ui, sans-serif" }}>
      <style>{styles}</style>
      <div style={{ maxWidth: 680, margin: '0 auto', padding: '24px 16px 100px' }}>

        {/* ── Header ── */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 32 }}>
          <button className="dp-back" onClick={() => router.back()}>
            <ArrowLeft size={18} />
          </button>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <div style={{ width: 36, height: 36, borderRadius: 10, background: 'rgba(99,102,241,0.15)', border: '1px solid rgba(99,102,241,0.3)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <Code size={18} style={{ color: '#818cf8' }} />
            </div>
            <div>
              <h1 style={{ margin: 0, fontSize: 20, fontWeight: 700, color: '#f9fafb' }}>Developer</h1>
              <p style={{ margin: 0, fontSize: 12, color: '#6b7280' }}>API keys &amp; webhooks</p>
            </div>
          </div>
        </div>

        {/* ── API Keys ── */}
        <div className="dp-card" style={{ marginBottom: 16 }}>
          <div className="dp-card-header">
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <Key size={16} style={{ color: '#818cf8' }} />
              <span className="dp-card-title">API Keys</span>
            </div>
          </div>

          <div style={{ padding: '16px 20px' }}>
            <p className="dp-hint">Authenticate requests to the Lumio REST API. Secret keys are shown once — store them securely.</p>

            {/* One-time key reveal */}
            {newKeyResult && (
              <div className="dp-reveal">
                <div className="dp-reveal-head">
                  <Check size={13} style={{ color: '#34d399', flexShrink: 0 }} />
                  <span>Key created — copy it now, it won&apos;t be shown again.</span>
                  <button className="dp-icon-btn" onClick={() => { setNewKeyResult(null); setKeyCopied(false); }}>
                    <X size={13} />
                  </button>
                </div>
                <div className="dp-reveal-row">
                  <code className="dp-mono-val">{newKeyResult.key}</code>
                  <button className="dp-btn dp-btn-ghost dp-btn-sm" onClick={() => copyText(newKeyResult.key, setKeyCopied)}>
                    {keyCopied ? <Check size={12} /> : <Copy size={12} />}
                    {keyCopied ? 'Copied' : 'Copy'}
                  </button>
                </div>
              </div>
            )}

            {/* Create form */}
            <div style={{ display: 'flex', gap: 8, marginBottom: keyMsg ? 6 : 16 }}>
              <input
                className="dp-input"
                value={newKeyName}
                onChange={e => setNewKeyName(e.target.value)}
                placeholder="Key name (e.g. Zapier Integration)"
                onKeyDown={e => e.key === 'Enter' && handleCreateKey()}
              />
              <button className="dp-btn dp-btn-primary" onClick={handleCreateKey} disabled={creatingKey || !newKeyName.trim()}>
                <Plus size={13} />
                {creatingKey ? 'Creating…' : 'Create'}
              </button>
            </div>
            {keyMsg && <p className={`dp-msg dp-msg-${keyMsg.type}`} style={{ marginBottom: 12 }}>{keyMsg.text}</p>}

            {/* Keys list */}
            {keysLoading ? (
              <p className="dp-hint" style={{ marginBottom: 0 }}>Loading…</p>
            ) : keys.length === 0 ? (
              <div className="dp-empty">
                <Key size={20} style={{ color: '#374151' }} />
                <span>No API keys yet</span>
              </div>
            ) : (
              <div className="dp-list">
                {keys.map(k => (
                  <div key={k.id} className={`dp-row ${k.revoked_at ? 'dp-row-dim' : ''}`}>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 3 }}>
                        <span style={{ fontSize: 14, fontWeight: 600, color: '#e5e7eb' }}>{k.name}</span>
                        {k.revoked_at
                          ? <span className="dp-badge dp-badge-red">Revoked</span>
                          : <span className="dp-badge dp-badge-green">Active</span>}
                      </div>
                      <code style={{ fontSize: 11, fontFamily: "'SF Mono','Fira Code',monospace", color: '#4b5563', letterSpacing: '0.02em' }}>
                        {k.key_prefix}••••••••••••••••••••••••
                      </code>
                      <div style={{ fontSize: 11, color: '#4b5563', marginTop: 2 }}>
                        Created {fmtDate(k.created_at)} · Last used {fmtDate(k.last_used_at)}
                      </div>
                    </div>
                    {!k.revoked_at && (
                      <button className="dp-btn dp-btn-danger-soft dp-btn-sm" onClick={() => handleRevokeKey(k.id)}>
                        Revoke
                      </button>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* ── Webhooks ── */}
        <div className="dp-card" style={{ marginBottom: 16 }}>
          <div className="dp-card-header">
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <Zap size={16} style={{ color: '#818cf8' }} />
              <span className="dp-card-title">Webhooks</span>
            </div>
            <button className="dp-btn dp-btn-ghost dp-btn-sm" onClick={() => setShowWebhookForm(v => !v)}>
              <Plus size={12} />
              Add Endpoint
            </button>
          </div>

          <div style={{ padding: '16px 20px' }}>
            <p className="dp-hint">
              Lumio sends a signed <code className="dp-inline-code">POST</code> to your URL on events.
              Verify with the <code className="dp-inline-code">X-Lumio-Signature</code> header.
            </p>

            {/* One-time secret reveal */}
            {newWebhookResult && (
              <div className="dp-reveal">
                <div className="dp-reveal-head">
                  <Check size={13} style={{ color: '#34d399', flexShrink: 0 }} />
                  <span>Endpoint created — save the signing secret, it won&apos;t be shown again.</span>
                  <button className="dp-icon-btn" onClick={() => { setNewWebhookResult(null); setSecretCopied(false); }}>
                    <X size={13} />
                  </button>
                </div>
                <div className="dp-reveal-row">
                  <code className="dp-mono-val">{newWebhookResult.secret}</code>
                  <button className="dp-btn dp-btn-ghost dp-btn-sm" onClick={() => copyText(newWebhookResult.secret, setSecretCopied)}>
                    {secretCopied ? <Check size={12} /> : <Copy size={12} />}
                    {secretCopied ? 'Copied' : 'Copy'}
                  </button>
                </div>
              </div>
            )}

            {/* Create form */}
            {showWebhookForm && (
              <div className="dp-form">
                <div style={{ marginBottom: 12 }}>
                  <label className="dp-label">Name</label>
                  <input className="dp-input" value={whName} onChange={e => setWhName(e.target.value)} placeholder="e.g. Zapier" />
                </div>
                <div style={{ marginBottom: 12 }}>
                  <label className="dp-label">Endpoint URL</label>
                  <input className="dp-input" value={whUrl} onChange={e => setWhUrl(e.target.value)} placeholder="https://…" type="url" />
                </div>
                <div style={{ marginBottom: 16 }}>
                  <label className="dp-label">Events <span style={{ color: '#4b5563', fontWeight: 400 }}>({whEvents.length} selected)</span></label>
                  <div className="dp-events-grid">
                    {ALL_EVENTS.map(ev => (
                      <button key={ev} type="button" className={`dp-event-chip ${whEvents.includes(ev) ? 'selected' : ''}`} onClick={() => toggleEvent(ev)}>
                        {whEvents.includes(ev) && <Check size={9} style={{ flexShrink: 0 }} />}
                        {ev}
                      </button>
                    ))}
                  </div>
                </div>
                <div style={{ display: 'flex', gap: 8 }}>
                  <button className="dp-btn dp-btn-primary" onClick={handleCreateWebhook} disabled={creatingWebhook || !whName.trim() || !whUrl.trim() || !whEvents.length}>
                    {creatingWebhook ? 'Creating…' : 'Create Webhook'}
                  </button>
                  <button className="dp-btn dp-btn-ghost" onClick={() => { setShowWebhookForm(false); setWhName(''); setWhUrl(''); setWhEvents([]); }}>
                    Cancel
                  </button>
                </div>
                {webhookMsg && <p className={`dp-msg dp-msg-${webhookMsg.type}`}>{webhookMsg.text}</p>}
              </div>
            )}

            {/* Webhooks list */}
            {webhooksLoading ? (
              <p className="dp-hint" style={{ marginBottom: 0 }}>Loading…</p>
            ) : webhooks.length === 0 ? (
              <div className="dp-empty">
                <Zap size={20} style={{ color: '#374151' }} />
                <span>No webhook endpoints yet</span>
              </div>
            ) : (
              <div className="dp-list">
                {webhooks.map(wh => (
                  <div key={wh.id} className="dp-row">
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 3 }}>
                        <span style={{ fontSize: 14, fontWeight: 600, color: '#e5e7eb' }}>{wh.name}</span>
                        <span className={`dp-badge ${wh.is_active ? 'dp-badge-green' : 'dp-badge-gray'}`}>
                          {wh.is_active ? 'Active' : 'Inactive'}
                        </span>
                      </div>
                      <div style={{ fontSize: 11, color: '#6b7280', marginBottom: 5, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {wh.url}
                      </div>
                      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
                        {wh.events.map(ev => <span key={ev} className="dp-event-tag">{ev}</span>)}
                      </div>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexShrink: 0 }}>
                      <button
                        className={`dp-toggle ${wh.is_active ? 'dp-toggle-on' : ''}`}
                        onClick={() => handleToggleWebhook(wh.id, wh.is_active)}
                        type="button" role="switch" aria-checked={wh.is_active}
                      >
                        <span className="dp-toggle-thumb" />
                      </button>
                      <button className="dp-icon-btn dp-icon-btn-danger" onClick={() => handleDeleteWebhook(wh.id)}>
                        <Trash2 size={13} />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* ── REST API Reference ── */}
        <div className="dp-card">
          <div className="dp-card-header">
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <Globe size={16} style={{ color: '#818cf8' }} />
              <span className="dp-card-title">REST API Reference</span>
            </div>
          </div>

          <div style={{ padding: '16px 20px' }}>
            <p className="dp-hint">Authenticate all requests with your API key:</p>
            <div className="dp-code-block" style={{ marginBottom: 16 }}>
              <span style={{ color: '#6b7280' }}>Authorization:</span>{' '}
              <span style={{ color: '#a5b4fc' }}>Bearer</span>{' '}
              <span style={{ color: '#6ee7b7' }}>lum_your_key_here</span>
            </div>

            <p className="dp-hint">All responses use a consistent envelope:</p>
            <div className="dp-code-block" style={{ marginBottom: 20 }}>
              <span style={{ color: '#6b7280' }}>{'{'}</span>{' '}
              <span style={{ color: '#a5b4fc' }}>&quot;data&quot;</span>
              <span style={{ color: '#6b7280' }}>:</span>{' '}
              <span style={{ color: '#fbbf24' }}>{'{ … }'}</span>
              <span style={{ color: '#6b7280' }}>,</span>{' '}
              <span style={{ color: '#a5b4fc' }}>&quot;error&quot;</span>
              <span style={{ color: '#6b7280' }}>:</span>{' '}
              <span style={{ color: '#f87171' }}>null</span>{' '}
              <span style={{ color: '#6b7280' }}>{'}'}</span>
            </div>

            {ENDPOINT_DOCS.map(group => (
              <div key={group.resource} style={{ marginBottom: 20 }}>
                <div style={{ fontSize: 11, fontWeight: 700, color: '#6b7280', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 8 }}>
                  {group.resource}
                </div>
                <div style={{ border: '1px solid #1e2130', borderRadius: 10, overflow: 'hidden' }}>
                  {group.endpoints.map((ep, i) => (
                    <div key={ep.path + ep.method} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '9px 14px', borderBottom: i < group.endpoints.length - 1 ? '1px solid #1e2130' : 'none', background: i % 2 === 0 ? 'transparent' : 'rgba(255,255,255,0.01)' }}>
                      <span className={`dp-method dp-method-${ep.method.toLowerCase()}`}>{ep.method}</span>
                      <span style={{ fontFamily: "'SF Mono','Fira Code',monospace", fontSize: 12, color: '#d1d5db', flex: 1 }}>{ep.path}</span>
                      <span style={{ fontSize: 12, color: '#4b5563', flexShrink: 0 }} className="dp-ep-desc">{ep.desc}</span>
                    </div>
                  ))}
                </div>
              </div>
            ))}

            <div style={{ display: 'flex', gap: 8, padding: '12px 14px', background: 'rgba(99,102,241,0.06)', border: '1px solid rgba(99,102,241,0.15)', borderRadius: 10 }}>
              <AlertCircle size={14} style={{ color: '#818cf8', flexShrink: 0, marginTop: 1 }} />
              <p style={{ margin: 0, fontSize: 12, color: '#9ca3af', lineHeight: 1.6 }}>
                Webhooks are signed with <code className="dp-inline-code">HMAC-SHA256</code>. Compute the signature over the raw request body using your endpoint&apos;s secret and compare to the <code className="dp-inline-code">X-Lumio-Signature</code> header.
              </p>
            </div>
          </div>
        </div>

      </div>
    </div>
  );
}

/* ── Styles ── */
const styles = `
  .dp-back {
    background: none; border: none; color: #6b7280; cursor: pointer;
    padding: 6px; border-radius: 8px; display: flex; align-items: center;
    transition: all 0.15s; flex-shrink: 0;
  }
  .dp-back:hover { background: rgba(255,255,255,0.06); color: #e5e7eb; }

  .dp-card {
    background: #1a1d27;
    border: 1px solid #2a2d3a;
    border-radius: 16px;
    overflow: hidden;
  }
  .dp-card-header {
    display: flex; align-items: center; justify-content: space-between;
    padding: 14px 20px;
    border-bottom: 1px solid #2a2d3a;
    background: rgba(255,255,255,0.015);
  }
  .dp-card-title { font-size: 14px; font-weight: 700; color: #f9fafb; }

  .dp-hint { font-size: 12.5px; color: #6b7280; margin: 0 0 12px; line-height: 1.5; }
  .dp-label { display: block; font-size: 11px; font-weight: 600; color: #6b7280; margin-bottom: 6px; text-transform: uppercase; letter-spacing: 0.05em; }

  .dp-input {
    width: 100%; box-sizing: border-box;
    background: #111318; border: 1px solid #2a2d3a; border-radius: 10px;
    padding: 9px 12px; font-size: 13.5px; color: #e5e7eb;
    outline: none; transition: border-color 0.15s; font-family: inherit;
  }
  .dp-input:focus { border-color: #6366f1; box-shadow: 0 0 0 2px rgba(99,102,241,0.12); }
  .dp-input::placeholder { color: #374151; }

  .dp-btn {
    display: inline-flex; align-items: center; gap: 5px;
    padding: 8px 14px; border-radius: 9px;
    font-size: 13px; font-weight: 600; cursor: pointer;
    transition: all 0.15s; border: none; outline: none;
    white-space: nowrap; font-family: inherit;
  }
  .dp-btn:disabled { opacity: 0.45; cursor: not-allowed; }
  .dp-btn-primary { background: #6366f1; color: #fff; }
  .dp-btn-primary:hover:not(:disabled) { background: #4f46e5; }
  .dp-btn-ghost { background: transparent; color: #9ca3af; border: 1px solid #374151; }
  .dp-btn-ghost:hover:not(:disabled) { background: rgba(255,255,255,0.05); color: #e5e7eb; border-color: #4b5563; }
  .dp-btn-danger-soft { background: transparent; color: #ef4444; border: 1px solid rgba(239,68,68,0.25); }
  .dp-btn-danger-soft:hover:not(:disabled) { background: rgba(239,68,68,0.08); border-color: rgba(239,68,68,0.4); }
  .dp-btn-sm { padding: 5px 10px; font-size: 12px; }

  .dp-icon-btn {
    background: none; border: none; color: #4b5563; cursor: pointer;
    display: flex; align-items: center; padding: 4px; border-radius: 6px;
    transition: all 0.15s;
  }
  .dp-icon-btn:hover { background: rgba(255,255,255,0.06); color: #9ca3af; }
  .dp-icon-btn-danger:hover { background: rgba(239,68,68,0.1); color: #f87171; }

  .dp-msg { font-size: 12px; font-weight: 500; margin: 8px 0 0; }
  .dp-msg-ok { color: #34d399; }
  .dp-msg-err { color: #f87171; }

  /* Reveal banner */
  .dp-reveal {
    background: rgba(52,211,153,0.05); border: 1px solid rgba(52,211,153,0.2);
    border-radius: 10px; padding: 12px 14px; margin-bottom: 16px;
  }
  .dp-reveal-head {
    display: flex; align-items: center; gap: 7px;
    font-size: 12px; color: #6ee7b7; font-weight: 500; margin-bottom: 8px;
  }
  .dp-reveal-head span { flex: 1; }
  .dp-reveal-row { display: flex; align-items: center; gap: 8px; }
  .dp-mono-val {
    flex: 1; min-width: 0;
    font-family: 'SF Mono','Fira Code','Fira Mono',monospace;
    font-size: 11.5px; color: #e5e7eb;
    background: #0f1117; border: 1px solid #2a2d3a; border-radius: 7px;
    padding: 7px 10px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;
  }

  /* List */
  .dp-list { display: flex; flex-direction: column; gap: 2px; }
  .dp-row {
    display: flex; align-items: center; gap: 12px;
    padding: 10px 12px; border-radius: 10px;
    background: rgba(255,255,255,0.015); transition: background 0.15s;
  }
  .dp-row:hover { background: rgba(255,255,255,0.03); }
  .dp-row-dim { opacity: 0.45; }

  .dp-empty {
    display: flex; flex-direction: column; align-items: center;
    gap: 8px; padding: 28px 16px;
    color: #374151; font-size: 13px;
  }

  /* Badges */
  .dp-badge {
    font-size: 10px; font-weight: 700; padding: 2px 7px;
    border-radius: 20px; text-transform: uppercase; letter-spacing: 0.04em;
  }
  .dp-badge-green { background: rgba(52,211,153,0.1); color: #34d399; }
  .dp-badge-red   { background: rgba(239,68,68,0.1);  color: #f87171; }
  .dp-badge-gray  { background: rgba(107,114,128,0.12); color: #6b7280; }

  /* Toggle */
  .dp-toggle {
    position: relative; width: 40px; height: 22px; border-radius: 11px;
    background: #374151; border: none; cursor: pointer;
    transition: background 0.2s; padding: 0; flex-shrink: 0;
  }
  .dp-toggle-on { background: #6366f1; }
  .dp-toggle-thumb {
    position: absolute; top: 2px; left: 2px;
    width: 18px; height: 18px; border-radius: 50%;
    background: #fff; transition: transform 0.2s;
    box-shadow: 0 1px 3px rgba(0,0,0,0.3);
  }
  .dp-toggle-on .dp-toggle-thumb { transform: translateX(18px); }

  /* Webhook form */
  .dp-form {
    background: rgba(255,255,255,0.02); border: 1px solid #2a2d3a;
    border-radius: 12px; padding: 16px; margin-bottom: 16px;
  }

  /* Event chips */
  .dp-events-grid { display: flex; flex-wrap: wrap; gap: 5px; }
  .dp-event-chip {
    display: inline-flex; align-items: center; gap: 4px;
    font-size: 11px; font-weight: 500; padding: 4px 10px;
    border-radius: 20px; border: 1px solid #2a2d3a;
    background: transparent; color: #6b7280;
    cursor: pointer; transition: all 0.12s; font-family: inherit;
  }
  .dp-event-chip:hover { border-color: #4b5563; color: #d1d5db; }
  .dp-event-chip.selected { background: rgba(99,102,241,0.12); border-color: rgba(99,102,241,0.5); color: #a5b4fc; }

  /* Event tags in list */
  .dp-event-tag {
    font-size: 10px; padding: 2px 7px; border-radius: 20px;
    background: rgba(99,102,241,0.08); color: #6366f1;
    border: 1px solid rgba(99,102,241,0.15); white-space: nowrap;
  }

  /* Code blocks */
  .dp-code-block {
    display: block; font-family: 'SF Mono','Fira Code',monospace;
    font-size: 12.5px; background: #111318; border: 1px solid #2a2d3a;
    border-radius: 9px; padding: 11px 14px;
  }
  .dp-inline-code {
    font-family: 'SF Mono','Fira Code',monospace; font-size: 11px;
    color: #a5b4fc; background: rgba(99,102,241,0.1);
    padding: 1px 5px; border-radius: 4px;
  }

  /* Endpoint method badges */
  .dp-method {
    font-family: 'SF Mono','Fira Code',monospace; font-size: 10px; font-weight: 700;
    padding: 2px 7px; border-radius: 5px; min-width: 54px; text-align: center; flex-shrink: 0;
  }
  .dp-method-get    { background: rgba(59,130,246,0.12); color: #60a5fa; }
  .dp-method-post   { background: rgba(52,211,153,0.12); color: #34d399; }
  .dp-method-patch  { background: rgba(245,158,11,0.12); color: #fbbf24; }
  .dp-method-delete { background: rgba(239,68,68,0.12);  color: #f87171; }

  @media (max-width: 520px) {
    .dp-ep-desc { display: none; }
  }
`;
