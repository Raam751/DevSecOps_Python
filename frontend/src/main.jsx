import React, { useEffect, useState } from 'react';
import { createRoot } from 'react-dom/client';
import './styles.css';

const API = '/api';

// ─── helpers ────────────────────────────────────────────────────────────────
function priorityClass(p) {
  const map = { URGENT: 'priority-urgent', HIGH: 'priority-high', MEDIUM: 'priority-medium', LOW: 'priority-low' };
  return map[p] || 'priority-low';
}
function statusClass(s) {
  const map = { OPEN: 'status-open', IN_PROGRESS: 'status-in_progress', RESOLVED: 'status-resolved' };
  return map[s] || 'status-open';
}
function categoryClass(c) {
  const map = { TECHNICAL: 'cat-technical', BILLING: 'cat-billing', GENERAL: 'cat-general', FEATURE_REQUEST: 'cat-feature_request' };
  return map[c] || 'cat-general';
}
function categoryLabel(c) {
  const map = { TECHNICAL: 'Technical', BILLING: 'Billing', GENERAL: 'General', FEATURE_REQUEST: 'Feature Req.' };
  return map[c] || c;
}
function nextStatus(s) {
  return s === 'OPEN' ? 'IN_PROGRESS' : s === 'IN_PROGRESS' ? 'RESOLVED' : 'OPEN';
}
function nextStatusLabel(s) {
  return s === 'OPEN' ? '▶ Start' : s === 'IN_PROGRESS' ? '✔ Resolve' : '↺ Reopen';
}
function relativeTime(iso) {
  const diff = Date.now() - new Date(iso).getTime();
  const m = Math.floor(diff / 60000);
  if (m < 1) return 'just now';
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  return `${Math.floor(h / 24)}d ago`;
}

// ─── skeleton rows ───────────────────────────────────────────────────────────
function SkeletonRows() {
  return Array.from({ length: 4 }).map((_, i) => (
    <tr key={i} className="skeleton-row">
      <td><div className="skeleton" style={{ width: '60%' }} /></td>
      <td><div className="skeleton" style={{ width: '70px' }} /></td>
      <td><div className="skeleton" style={{ width: '60px' }} /></td>
      <td><div className="skeleton" style={{ width: '80px' }} /></td>
      <td><div className="skeleton" style={{ width: '55px' }} /></td>
    </tr>
  ));
}

// ─── main app ────────────────────────────────────────────────────────────────
function App() {
  const [tickets, setTickets] = useState([]);
  const [stats, setStats] = useState({ total: 0, open: 0, inProgress: 0, resolved: 0 });
  const [filter, setFilter] = useState('ALL');
  const [showForm, setShowForm] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [activePage, setActivePage] = useState('tickets');
  const [categoryFilter, setCategoryFilter] = useState(null);
  const [toast, setToast] = useState('');

  const load = async () => {
    try {
      setError('');
      const [a, b] = await Promise.all([
        fetch(`${API}/tickets`),
        fetch(`${API}/tickets/stats`),
      ]);
      if (!a.ok || !b.ok) throw new Error('Backend unavailable');
      setTickets(await a.json());
      setStats(await b.json());
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, []);

  const advance = async (t) => {
    await fetch(`${API}/tickets/${t.id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status: nextStatus(t.status) }),
    });
    load();
  };

  const createTicket = async (e) => {
    e.preventDefault();
    const f = new FormData(e.currentTarget);
    try {
      const res = await fetch(`${API}/tickets`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          subject: f.get('subject'),
          description: f.get('description'),
          priority: f.get('priority'),
          agent: f.get('agent'),
          category: f.get('category'),
          status: 'OPEN',
        }),
      });
      if (!res.ok) throw new Error('Failed to create ticket');
      setShowForm(false);
      setToast('✅ Ticket created successfully!');
      setTimeout(() => setToast(''), 3000);
      await load();
    } catch (err) {
      setToast('❌ ' + err.message);
      setTimeout(() => setToast(''), 4000);
    }
  };

  const openCount = tickets.filter(t => t.status === 'OPEN').length;

  // derived visible list — respects both status filter and category filter
  const visible = (() => {
    let list = filter === 'ALL' ? tickets : tickets.filter(t => t.status === filter);
    if (categoryFilter) list = list.filter(t => t.category === categoryFilter);
    return list;
  })();

  const navClick = (page, cat = null) => {
    setActivePage(page);
    setCategoryFilter(cat);
    setFilter('ALL');
  };

  // Page title / subtitle based on active nav
  const pageTitle = () => {
    if (categoryFilter === 'TECHNICAL') return ['Technical Tickets', 'Infrastructure and software issues'];
    if (categoryFilter === 'BILLING')   return ['Billing Tickets', 'Payment and refund requests'];
    if (categoryFilter === 'FEATURE_REQUEST') return ['Feature Requests', 'Customer-requested improvements'];
    if (activePage === 'analytics') return ['Analytics', 'Ticket trends and performance metrics'];
    if (activePage === 'agents')    return ['Agents', 'Support team members and assignments'];
    if (activePage === 'settings')  return ['Settings', 'Configure your support desk'];
    return ['Support Tickets', 'Manage and resolve customer issues efficiently'];
  };
  const [title, subtitle] = pageTitle();

  return (
    <div className="app">
      {/* ── SIDEBAR ── */}
      <aside className="sidebar">
        <div className="sidebar-top">
          <div className="brand">
            <div className="brand-logo">🦸</div>
            <div className="brand-text">
              <strong>HelpHero</strong>
              <span>Support Desk</span>
            </div>
          </div>
        </div>

        <div className="nav-section">
          <div className="nav-label">WORKSPACE</div>
          <nav>
            <a
              className={activePage === 'tickets' && !categoryFilter ? 'active' : ''}
              onClick={() => navClick('tickets')}
            >
              <span className="nav-icon">🎫</span>
              All Tickets
              {openCount > 0 && <span className="badge-count">{openCount}</span>}
            </a>
            <a
              className={activePage === 'analytics' ? 'active' : ''}
              onClick={() => navClick('analytics')}
            >
              <span className="nav-icon">📊</span>
              Analytics
            </a>
            <a
              className={activePage === 'agents' ? 'active' : ''}
              onClick={() => navClick('agents')}
            >
              <span className="nav-icon">👥</span>
              Agents
            </a>
            <a
              className={activePage === 'settings' ? 'active' : ''}
              onClick={() => navClick('settings')}
            >
              <span className="nav-icon">⚙️</span>
              Settings
            </a>
          </nav>

          <div className="nav-label" style={{ marginTop: '20px' }}>CATEGORIES</div>
          <nav>
            <a
              className={categoryFilter === 'TECHNICAL' ? 'active' : ''}
              onClick={() => navClick('tickets', 'TECHNICAL')}
            >
              <span className="nav-icon">🔧</span> Technical
            </a>
            <a
              className={categoryFilter === 'BILLING' ? 'active' : ''}
              onClick={() => navClick('tickets', 'BILLING')}
            >
              <span className="nav-icon">💳</span> Billing
            </a>
            <a
              className={categoryFilter === 'FEATURE_REQUEST' ? 'active' : ''}
              onClick={() => navClick('tickets', 'FEATURE_REQUEST')}
            >
              <span className="nav-icon">✨</span> Feature Requests
            </a>
          </nav>
        </div>

        <div className="sidebar-footer">
          <div className="profile-card">
            <div className="avatar">RT</div>
            <div className="profile-info">
              <strong>Ram Tichkule</strong>
              <span>Senior Agent</span>
            </div>
            <div className="status-dot" title="Online" />
          </div>
        </div>
      </aside>

      {/* ── MAIN ── */}
      <div className="main">
        {/* Top bar */}
        <div className="topbar">
          <div className="topbar-left">
            <h1>{title}</h1>
            <p>{subtitle}</p>
          </div>
          <div className="topbar-right">
            <button className="btn-primary" onClick={() => setShowForm(true)}>
              <span>＋</span> New Ticket
            </button>
          </div>
        </div>

        {/* Page body */}
        <div className="page-body">
          {error && (
            <div className="alert">
              ⚠ {error}. Make sure the backend and PostgreSQL are running, then refresh.
            </div>
          )}

          {/* Non-ticket pages: show a placeholder card */}
          {activePage !== 'tickets' && !categoryFilter ? (
            <PlaceholderPage page={activePage} />
          ) : (
            <>
              {/* Stats */}
              <div className="stats-grid">
                <StatCard color="amber"   icon="🎫" label="Total Tickets" value={stats.total}      trend="neutral" trendLabel="All time" />
                <StatCard color="sky"     icon="📬" label="Open"          value={stats.open}       trend="neutral" trendLabel="Needs action" />
                <StatCard color="amber"   icon="⚡" label="In Progress"   value={stats.inProgress} trend="neutral" trendLabel="Being handled" />
                <StatCard color="emerald" icon="✅" label="Resolved"      value={stats.resolved}   trend="up"      trendLabel="Closed" />
              </div>

              {/* Content row */}
              <div className="content-row">
                {/* Ticket table */}
                <div className="ticket-panel">
                  <div className="panel-header">
                    <div>
                      <h2>Tickets</h2>
                      <p>{visible.length} ticket{visible.length !== 1 ? 's' : ''} shown</p>
                    </div>
                    <div className="filter-tabs">
                      {['ALL', 'OPEN', 'IN_PROGRESS', 'RESOLVED'].map(f => (
                        <button
                          key={f}
                          className={filter === f ? 'active' : ''}
                          onClick={() => setFilter(f)}
                        >
                          {f === 'ALL' ? 'All' : f === 'IN_PROGRESS' ? 'In Progress' : f.charAt(0) + f.slice(1).toLowerCase()}
                        </button>
                      ))}
                    </div>
                  </div>

                  <div className="table-wrap">
                    <table>
                      <thead>
                        <tr>
                          <th>SUBJECT</th>
                          <th>CATEGORY</th>
                          <th>PRIORITY</th>
                          <th>STATUS</th>
                          <th>AGENT</th>
                          <th>ACTION</th>
                        </tr>
                      </thead>
                      <tbody>
                        {loading
                          ? <SkeletonRows />
                          : visible.length === 0
                            ? (
                              <tr>
                                <td colSpan={6}>
                                  <div className="empty-state">
                                    <div className="empty-icon">🎫</div>
                                    <p>No tickets in this filter</p>
                                  </div>
                                </td>
                              </tr>
                            )
                            : visible.map(t => (
                              <tr key={t.id}>
                                <td>
                                  <div className="ticket-subject">
                                    <strong>#{t.id} — {t.subject}</strong>
                                    <small>{t.description || 'No description provided'}</small>
                                  </div>
                                </td>
                                <td>
                                  <span className={`badge ${categoryClass(t.category)}`}>
                                    {categoryLabel(t.category)}
                                  </span>
                                </td>
                                <td>
                                  <span className={`badge ${priorityClass(t.priority)}`}>
                                    <span className="badge-dot" style={{ background: 'currentColor' }} />
                                    {t.priority}
                                  </span>
                                </td>
                                <td>
                                  <span className={`badge ${statusClass(t.status)}`}>
                                    {t.status.replace('_', ' ')}
                                  </span>
                                </td>
                                <td>{t.agent}</td>
                                <td>
                                  <button className="action-btn" onClick={() => advance(t)}>
                                    {nextStatusLabel(t.status)}
                                  </button>
                                </td>
                              </tr>
                            ))
                        }
                      </tbody>
                    </table>
                  </div>
                </div>

                {/* Side panel */}
                <div className="side-panel">
                  {/* Activity feed */}
                  <div className="info-card">
                    <div className="info-card-header">
                      <span>⚡</span> Recent Activity
                    </div>
                    {tickets.slice(0, 4).map(t => (
                      <div className="activity-item" key={t.id}>
                        <div className={`activity-avatar ${t.status === 'RESOLVED' ? 'emerald' : t.status === 'IN_PROGRESS' ? 'amber' : 'sky'}`}>
                          {t.status === 'RESOLVED' ? '✔' : t.status === 'IN_PROGRESS' ? '⚡' : '📬'}
                        </div>
                        <div>
                          <strong>#{t.id} {t.subject.slice(0, 32)}{t.subject.length > 32 ? '…' : ''}</strong>
                          <small>{t.agent} · {relativeTime(t.created_at)}</small>
                        </div>
                      </div>
                    ))}
                    {tickets.length === 0 && !loading && (
                      <div style={{ padding: '20px', textAlign: 'center', fontSize: '11px', color: 'var(--text-muted)' }}>
                        No recent activity
                      </div>
                    )}
                  </div>

                  {/* Pipeline status */}
                  <div className="info-card">
                    <div className="info-card-header">
                      <span>🚀</span> CI / CD Pipeline
                    </div>
                    <div className="pipeline-card">
                      <div className="pipeline-title">All systems operational</div>
                      <div className="pipeline-steps">
                        <PipelineStep icon="✔" state="done"    label="pytest"         time="12s" />
                        <PipelineStep icon="✔" state="done"    label="Frontend build" time="28s" />
                        <PipelineStep icon="✔" state="done"    label="Docker build"   time="1m 4s" />
                        <PipelineStep icon="✔" state="done"    label="Trivy scan"     time="42s" />
                        <PipelineStep icon="✔" state="done"    label="Push to GHCR"   time="18s" />
                        <PipelineStep icon="⚡" state="running" label="K8s deploy"     time="…" />
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </>
          )}
        </div>
      </div>

      {/* ── TOAST ── */}
      {toast && (
        <div className="toast">{toast}</div>
      )}

      {/* ── NEW TICKET MODAL ── */}
      {showForm && (
        <div className="modal-backdrop">
          <form className="modal" onSubmit={createTicket}>
            <div className="modal-header">
              <div>
                <div className="modal-header-icon">🎫</div>
                <h2>Create New Ticket</h2>
                <p>Fill in the details to open a support ticket</p>
              </div>
              <button type="button" className="modal-close" onClick={() => setShowForm(false)}>×</button>
            </div>

            <div className="modal-body">
              <div>
                <label className="form-label">Subject *</label>
                <input
                  className="form-input"
                  name="subject"
                  required
                  placeholder="e.g. Login page not loading on mobile"
                />
              </div>

              <div>
                <label className="form-label">Description</label>
                <textarea
                  className="form-textarea"
                  name="description"
                  placeholder="Describe the issue in detail…"
                />
              </div>

              <div className="form-row">
                <div>
                  <label className="form-label">Category</label>
                  <select className="form-select" name="category" defaultValue="TECHNICAL">
                    <option value="TECHNICAL">Technical</option>
                    <option value="BILLING">Billing</option>
                    <option value="GENERAL">General</option>
                    <option value="FEATURE_REQUEST">Feature Request</option>
                  </select>
                </div>
                <div>
                  <label className="form-label">Priority</label>
                  <select className="form-select" name="priority" defaultValue="MEDIUM">
                    <option value="LOW">Low</option>
                    <option value="MEDIUM">Medium</option>
                    <option value="HIGH">High</option>
                    <option value="URGENT">Urgent</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="form-label">Assigned Agent</label>
                <input
                  className="form-input"
                  name="agent"
                  defaultValue="Ram Tichkule"
                  placeholder="Agent name"
                />
              </div>
            </div>

            <div className="modal-footer">
              <button type="button" className="btn-ghost" onClick={() => setShowForm(false)}>Cancel</button>
              <button type="submit" className="btn-primary">Create Ticket</button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}

function PlaceholderPage({ page }) {
  const content = {
    analytics: {
      icon: '📊',
      title: 'Analytics Dashboard',
      desc: 'Charts and metrics will appear here — ticket volume, resolution time, agent performance, and SLA compliance.',
      items: ['Ticket volume over time', 'Average resolution time', 'Agent leaderboard', 'Category breakdown', 'SLA breach rate'],
    },
    agents: {
      icon: '👥',
      title: 'Agent Management',
      desc: 'View and manage your support team, assign tickets, and track individual performance.',
      items: ['Ram Tichkule — Senior Agent (Online)', 'Priya Sharma — L2 Support', 'Arjun Mehta — L1 Support', 'Sneha Patil — Billing Specialist'],
    },
    settings: {
      icon: '⚙️',
      title: 'Settings',
      desc: 'Configure your HelpHero support desk — categories, SLA rules, notifications, and integrations.',
      items: ['SLA configuration', 'Email notification rules', 'Ticket categories & tags', 'Webhook integrations', 'API key management'],
    },
  };
  const c = content[page] || content.analytics;
  return (
    <div style={{ maxWidth: '640px', margin: '40px auto', textAlign: 'center' }}>
      <div style={{ fontSize: '52px', marginBottom: '16px' }}>{c.icon}</div>
      <h2 style={{ fontSize: '22px', fontWeight: 800, color: 'var(--text-primary)', marginBottom: '10px' }}>{c.title}</h2>
      <p style={{ fontSize: '13px', color: 'var(--text-secondary)', marginBottom: '32px', lineHeight: 1.6 }}>{c.desc}</p>
      <div style={{ background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: '14px', overflow: 'hidden' }}>
        {c.items.map((item, i) => (
          <div key={i} style={{
            display: 'flex', alignItems: 'center', gap: '12px',
            padding: '14px 20px',
            borderBottom: i < c.items.length - 1 ? '1px solid var(--border)' : 'none',
            fontSize: '13px', color: 'var(--text-secondary)',
          }}>
            <div style={{ width: '8px', height: '8px', borderRadius: '50%', background: 'var(--amber)', flexShrink: 0 }} />
            {item}
          </div>
        ))}
      </div>
      <p style={{ marginTop: '24px', fontSize: '11px', color: 'var(--text-muted)' }}>
        This section is part of the HelpHero roadmap.
      </p>
    </div>
  );
}

function StatCard({ color, icon, label, value, trend, trendLabel }) {
  return (
    <div className={`stat-card ${color}`}>
      <div className="stat-header">
        <div className={`stat-icon-wrap ${color}`}>{icon}</div>
        <span className={`stat-trend ${trend}`}>{trendLabel}</span>
      </div>
      <div className="stat-value">{value}</div>
      <div className="stat-label">{label}</div>
    </div>
  );
}

function PipelineStep({ icon, state, label, time }) {
  return (
    <div className="pipeline-step">
      <div className={`step-icon ${state}`}>{icon}</div>
      <span>{label}</span>
      <span className="step-time">{time}</span>
    </div>
  );
}

createRoot(document.getElementById('root')).render(<App />);
