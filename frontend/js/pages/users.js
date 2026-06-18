/**
 * DAMZ AGENT — User Management Page
 * Admin dashboard to approve registrations and manage email whitelist.
 */

import { $, $$, createElement, formatDate, showModalConfirm } from '../utils/helpers.js';
import { API_BASE } from '../utils/config.js';

let listData = {
  allowed: [],
  users: [],
  pending: [],
  rejected: []
};

export function render() {
  return `
    <div class="page page-users">
      <div class="page-header">
        <div class="page-header-left">
          <h1 class="page-title">User Management</h1>
          <div class="page-subtitle">Manage system access and registration requests</div>
        </div>
      </div>

      <!-- Toast Alert Notifications -->
      <div id="users-alert" class="hidden" style="margin-bottom: var(--space-4); padding: 12px var(--space-4); border-radius: var(--radius-md); font-family: var(--font-mono); font-size: 13px; display: flex; align-items: center; justify-content: space-between;">
        <span id="users-alert-message"></span>
        <button id="users-alert-close" class="btn-ghost" style="border: none; background: transparent; cursor: pointer; color: inherit; font-size: 14px; line-height: 1;">&times;</button>
      </div>

      <div class="card-grid-users" style="align-items: stretch;">
        <!-- Left Column: Pending Approvals and Registered Accounts -->
        <div class="flex flex-col gap-4" style="height: 100%;">
          <!-- Pending Approvals -->
          <div class="card flex flex-col" style="flex: 1; min-height: 200px;">
            <div class="card-header" style="border-bottom: 1px solid var(--border); padding-bottom: var(--space-2); margin-bottom: var(--space-4);">
              <div style="display: flex; align-items: center; gap: 8px;">
                <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="var(--primary)" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                  <path d="M16 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/>
                  <circle cx="9" cy="7" r="4"/>
                  <line x1="19" y1="8" x2="19" y2="14"/>
                  <line x1="22" y1="11" x2="16" y2="11"/>
                </svg>
                <h2 class="card-title" style="color: var(--text-primary); font-size: 14px; margin: 0;">Pending Approvals</h2>
              </div>
              <span class="badge badge--yellow" id="pending-count-badge">0 Pending</span>
            </div>

            <div class="card-body" style="flex: 1; overflow-y: auto; overflow-x: auto;">
              <div id="pending-empty-state" class="empty-state">
                <div class="empty-state-icon" style="font-size: 28px; margin-bottom: 12px;">✔️</div>
                <div class="empty-state-text">No pending registration requests</div>
              </div>
              <table class="data-table hidden" id="pending-table">
                <thead>
                  <tr>
                    <th style="width: 22%;">Name</th>
                    <th style="width: 38%;">Email</th>
                    <th style="width: 22%;">Requested At</th>
                    <th style="width: 18%; text-align: right;">Actions</th>
                  </tr>
                </thead>
                <tbody id="pending-list"></tbody>
              </table>
            </div>
          </div>

          <!-- Registered Accounts -->
          <div class="card flex flex-col" style="flex: 1; min-height: 200px;">
            <div class="card-header" style="border-bottom: 1px solid var(--border); padding-bottom: var(--space-2); margin-bottom: var(--space-4);">
              <div style="display: flex; align-items: center; gap: 8px;">
                <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="var(--primary)" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                  <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/>
                  <circle cx="9" cy="7" r="4"/>
                  <path d="M23 21v-2a4 4 0 0 0-3-3.87"/>
                  <path d="M16 3.13a4 4 0 0 1 0 7.75"/>
                </svg>
                <h2 class="card-title" style="color: var(--text-primary); font-size: 14px; margin: 0;">Registered Accounts</h2>
              </div>
              <span class="badge badge--green" id="registered-count-badge">0 Users</span>
            </div>

            <div class="card-body" style="flex: 1; overflow-y: auto; overflow-x: auto;">
              <div id="registered-empty-state" class="empty-state">
                <div class="empty-state-icon" style="font-size: 28px; margin-bottom: 12px;">👥</div>
                <div class="empty-state-text">No registered accounts found</div>
              </div>
              <table class="data-table hidden" id="registered-table">
                <thead>
                  <tr>
                    <th style="width: 22%;">Name</th>
                    <th style="width: 38%;">Email</th>
                    <th style="width: 40%;">Registered At</th>
                  </tr>
                </thead>
                <tbody id="registered-list"></tbody>
              </table>
            </div>
          </div>
        </div>

        <!-- Right Column: Whitelist, Add Manual, and Rejected History -->
        <div class="flex flex-col gap-4" style="height: 100%;">
          <!-- Add Email to Whitelist Card -->
          <div class="card" style="flex: 0 0 auto;">
            <div class="card-header" style="border-bottom: 1px solid var(--border); padding-bottom: var(--space-2); margin-bottom: var(--space-4);">
              <div style="display: flex; align-items: center; gap: 8px;">
                <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="var(--primary)" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                  <path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"/>
                  <line x1="12" y1="11" x2="12" y2="17"/>
                  <line x1="9" y1="14" x2="15" y2="14"/>
                </svg>
                <h2 class="card-title" style="color: var(--text-primary); font-size: 14px; margin: 0;">Add Email to Whitelist</h2>
              </div>
            </div>
            <form id="add-whitelist-form" class="input-group">
              <input type="email" class="input" id="whitelist-email-input" placeholder="user@domain.com" required autocomplete="off">
              <button type="submit" class="btn btn-primary" id="whitelist-submit-btn">Add</button>
            </form>
          </div>

          <!-- Active Whitelist Table Card -->
          <div class="card flex flex-col" style="flex: 1; min-height: 150px;">
            <div class="card-header" style="border-bottom: 1px solid var(--border); padding-bottom: var(--space-2); margin-bottom: var(--space-3);">
              <div style="display: flex; align-items: center; gap: 8px;">
                <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="var(--primary)" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                  <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/>
                </svg>
                <h2 class="card-title" style="color: var(--text-primary); font-size: 14px; margin: 0;">Allowed Whitelist</h2>
              </div>
              <span class="badge badge--green" id="whitelist-count-badge">0 Allowed</span>
            </div>
            <div class="card-body" style="flex: 1; overflow-y: auto; overflow-x: auto;">
              <table class="data-table" id="whitelist-table">
                <thead>
                  <tr>
                    <th style="width: 75%;">Email Address</th>
                    <th style="width: 25%; text-align: right;">Action</th>
                  </tr>
                </thead>
                <tbody id="whitelist-list"></tbody>
              </table>
            </div>
          </div>

          <!-- Rejected History Card -->
          <div class="card flex flex-col" style="flex: 1; min-height: 150px;">
            <div class="card-header" style="border-bottom: 1px solid var(--border); padding-bottom: var(--space-2); margin-bottom: var(--space-3);">
              <div style="display: flex; align-items: center; gap: 8px;">
                <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="var(--status-red)" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                  <circle cx="12" cy="12" r="10"/>
                  <line x1="15" y1="9" x2="9" y2="15"/>
                  <line x1="9" y1="9" x2="15" y2="15"/>
                </svg>
                <h2 class="card-title" style="color: var(--text-primary); font-size: 14px; margin: 0;">Rejected History</h2>
              </div>
              <span class="badge badge--red" id="rejected-count-badge">0 Rejected</span>
            </div>
            <div class="card-body" style="flex: 1; overflow-y: auto; overflow-x: auto;">
              <div id="rejected-empty-state" class="empty-state">
                <div class="empty-state-icon" style="font-size: 24px; margin-bottom: 8px;">🚫</div>
                <div class="empty-state-text" style="font-size: 12px;">No rejected history</div>
              </div>
              <table class="data-table hidden" id="rejected-table">
                <thead>
                  <tr>
                    <th style="width: 75%;">Email Address</th>
                    <th style="width: 25%; text-align: right;">Action</th>
                  </tr>
                </thead>
                <tbody id="rejected-list"></tbody>
              </table>
            </div>
          </div>
        </div>
      </div>
    </div>
  `;
}

function showAlert(message, type = 'success') {
  const alertEl = $('#users-alert');
  const messageEl = $('#users-alert-message');
  if (!alertEl || !messageEl) return;

  messageEl.textContent = message;
  
  if (type === 'success') {
    alertEl.style.backgroundColor = 'rgba(35, 134, 54, 0.15)';
    alertEl.style.border = '1px solid rgba(35, 134, 54, 0.4)';
    alertEl.style.color = 'var(--primary)';
  } else {
    alertEl.style.backgroundColor = 'rgba(248, 81, 73, 0.15)';
    alertEl.style.border = '1px solid rgba(248, 81, 73, 0.4)';
    alertEl.style.color = 'var(--status-red)';
  }

  alertEl.classList.remove('hidden');

  // Auto hide after 5 seconds
  setTimeout(() => {
    alertEl.classList.add('hidden');
  }, 5000);
}

async function fetchUsersData() {
  try {
    const res = await fetch(`${API_BASE}/api/admin/users`);
    if (!res.ok) {
      throw new Error(res.status === 403 ? 'Forbidden: Admin access required.' : 'Failed to fetch users list.');
    }
    const data = await res.json();
    if (data.success) {
      listData.allowed = data.allowed || [];
      listData.users = data.users || [];
      listData.pending = data.pending || [];
      listData.rejected = data.rejected || [];
      updateUI();
    }
  } catch (err) {
    showAlert(err.message, 'error');
  }
}

function updateUI() {
  // Update Counts
  const pendingCount = $('#pending-count-badge');
  if (pendingCount) pendingCount.textContent = `${listData.pending.length} Pending`;

  const whitelistCount = $('#whitelist-count-badge');
  if (whitelistCount) whitelistCount.textContent = `${listData.allowed.length} Allowed`;

  const registeredCount = $('#registered-count-badge');
  if (registeredCount) registeredCount.textContent = `${listData.users.length} Users`;

  const rejectedCount = $('#rejected-count-badge');
  if (rejectedCount) rejectedCount.textContent = `${listData.rejected.length} Rejected`;

  // Render Pending
  const pendingList = $('#pending-list');
  const pendingTable = $('#pending-table');
  const pendingEmpty = $('#pending-empty-state');

  if (pendingList && pendingTable && pendingEmpty) {
    pendingList.innerHTML = '';
    if (listData.pending.length === 0) {
      pendingTable.classList.add('hidden');
      pendingEmpty.classList.remove('hidden');
    } else {
      pendingTable.classList.remove('hidden');
      pendingEmpty.classList.add('hidden');

      listData.pending.forEach(user => {
        const tr = document.createElement('tr');
        tr.innerHTML = `
          <td>${escapeHtml(user.name)}</td>
          <td style="color: var(--text-muted); font-family: var(--font-mono); font-size: 12px;">${escapeHtml(user.email)}</td>
          <td style="font-size: 12px; color: var(--text-muted);">${formatDate(user.createdAt)}</td>
          <td style="text-align: right;">
            <div style="display: inline-flex; gap: 8px;">
              <button class="btn btn-primary btn-sm btn-approve" data-email="${escapeHtml(user.email)}">Approve</button>
              <button class="btn btn-secondary btn-sm btn-reject" data-email="${escapeHtml(user.email)}" style="border-color: rgba(248,81,73,0.3); color: var(--status-red);">Reject</button>
            </div>
          </td>
        `;
        pendingList.appendChild(tr);
      });

      // Bind button events
      $$('.btn-approve', pendingList).forEach(btn => {
        btn.addEventListener('click', () => handleApprove(btn.dataset.email));
      });
      $$('.btn-reject', pendingList).forEach(btn => {
        btn.addEventListener('click', () => handleReject(btn.dataset.email));
      });
    }
  }

  // Render Registered Accounts
  const registeredList = $('#registered-list');
  const registeredTable = $('#registered-table');
  const registeredEmpty = $('#registered-empty-state');

  if (registeredList && registeredTable && registeredEmpty) {
    registeredList.innerHTML = '';
    if (listData.users.length === 0) {
      registeredTable.classList.add('hidden');
      registeredEmpty.classList.remove('hidden');
    } else {
      registeredTable.classList.remove('hidden');
      registeredEmpty.classList.add('hidden');

      listData.users.forEach(user => {
        const tr = document.createElement('tr');
        tr.innerHTML = `
          <td>${escapeHtml(user.name)}</td>
          <td style="color: var(--text-muted); font-family: var(--font-mono); font-size: 12px;">${escapeHtml(user.email)}</td>
          <td style="font-size: 12px; color: var(--text-muted);">${formatDate(user.createdAt)}</td>
        `;
        registeredList.appendChild(tr);
      });
    }
  }

  // Render Whitelist
  const whitelistList = $('#whitelist-list');
  if (whitelistList) {
    whitelistList.innerHTML = '';
    
    // Sort whitelist alphabetically
    const sortedAllowed = [...listData.allowed].sort();

    sortedAllowed.forEach(email => {
      const isSuperAdmin = email.toLowerCase() === 'damzcore@gmail.com';
      const tr = document.createElement('tr');
      tr.innerHTML = `
        <td style="font-family: var(--font-mono);">${escapeHtml(email)} ${isSuperAdmin ? '<span class="badge badge--blue" style="margin-left: 6px; font-size: 8px; padding: 1px 4px;">Super Admin</span>' : ''}</td>
        <td style="text-align: right;">
          ${isSuperAdmin ? '' : `<button class="btn btn-ghost btn-sm btn-revoke" data-email="${escapeHtml(email)}" style="color: var(--status-red); padding: 4px 8px;">Revoke</button>`}
        </td>
      `;
      whitelistList.appendChild(tr);
    });

    // Bind button events
    $$('.btn-revoke', whitelistList).forEach(btn => {
      btn.addEventListener('click', () => handleRevoke(btn.dataset.email));
    });
  }

  // Render Rejected History
  const rejectedList = $('#rejected-list');
  const rejectedTable = $('#rejected-table');
  const rejectedEmpty = $('#rejected-empty-state');

  if (rejectedList && rejectedTable && rejectedEmpty) {
    rejectedList.innerHTML = '';
    if (listData.rejected.length === 0) {
      rejectedTable.classList.add('hidden');
      rejectedEmpty.classList.remove('hidden');
    } else {
      rejectedTable.classList.remove('hidden');
      rejectedEmpty.classList.add('hidden');

      listData.rejected.forEach(user => {
        const tr = document.createElement('tr');
        tr.innerHTML = `
          <td style="font-family: var(--font-mono); font-size: 13px;">
            ${escapeHtml(user.email)}
            <div style="font-size: 10px; color: var(--text-muted); margin-top: 2px;">
              Rejected: ${formatDate(user.rejectedAt)}
            </div>
          </td>
          <td style="text-align: right; vertical-align: middle;">
            <button class="btn btn-secondary btn-sm btn-restore" data-email="${escapeHtml(user.email)}" style="border-color: rgba(35,134,54,0.3); color: var(--primary); padding: 4px 8px;">Restore</button>
          </td>
        `;
        rejectedList.appendChild(tr);
      });

      // Bind button events
      $$('.btn-restore', rejectedList).forEach(btn => {
        btn.addEventListener('click', () => handleRestore(btn.dataset.email));
      });
    }
  }
}

async function handleApprove(email) {
  try {
    const res = await fetch(`${API_BASE}/api/admin/users/approve`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email })
    });
    const data = await res.json();
    if (res.ok && data.success) {
      showAlert(`Successfully approved account for ${email}`, 'success');
      fetchUsersData();
    } else {
      throw new Error(data.error || 'Approval failed.');
    }
  } catch (err) {
    showAlert(err.message, 'error');
  }
}

async function handleReject(email) {
  showModalConfirm(`Reject registration request from ${email}?`, async () => {
    try {
      const res = await fetch(`${API_BASE}/api/admin/users/reject`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email })
      });
      const data = await res.json();
      if (res.ok && data.success) {
        showAlert(`Rejected registration request from ${email}`, 'success');
        fetchUsersData();
      } else {
        throw new Error(data.error || 'Rejection failed.');
      }
    } catch (err) {
      showAlert(err.message, 'error');
    }
  });
}

async function handleRevoke(email) {
  showModalConfirm(`Revoke whitelist access for ${email}?\nAll active sessions for this user will be invalidated.`, async () => {
    try {
      const res = await fetch(`${API_BASE}/api/admin/users/whitelist-remove`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email })
      });
      const data = await res.json();
      if (res.ok && data.success) {
        showAlert(`Removed ${email} from allowed whitelist`, 'success');
        fetchUsersData();
      } else {
        throw new Error(data.error || 'Revocation failed.');
      }
    } catch (err) {
      showAlert(err.message, 'error');
    }
  });
}

async function handleAddManual(email) {
  try {
    const res = await fetch(`${API_BASE}/api/admin/users/whitelist-add`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email })
    });
    const data = await res.json();
    if (res.ok && data.success) {
      showAlert(`Manually added ${email} to whitelist`, 'success');
      $('#whitelist-email-input').value = '';
      fetchUsersData();
    } else {
      throw new Error(data.error || 'Failed to add email to whitelist.');
    }
  } catch (err) {
    showAlert(err.message, 'error');
  }
}

async function handleRestore(email) {
  try {
    const res = await fetch(`${API_BASE}/api/admin/users/whitelist-add`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email })
    });
    const data = await res.json();
    if (res.ok && data.success) {
      showAlert(`Successfully whitelisted and restored ${email}`, 'success');
      fetchUsersData();
    } else {
      throw new Error(data.error || 'Restoration failed.');
    }
  } catch (err) {
    showAlert(err.message, 'error');
  }
}

export function mount() {
  // Fetch initial data
  fetchUsersData();

  // Bind Close Alert button
  const alertCloseBtn = $('#users-alert-close');
  if (alertCloseBtn) {
    alertCloseBtn.addEventListener('click', () => {
      $('#users-alert').classList.add('hidden');
    });
  }

  // Bind Add Manual form submit
  const addForm = $('#add-whitelist-form');
  if (addForm) {
    addForm.addEventListener('submit', (e) => {
      e.preventDefault();
      const email = $('#whitelist-email-input').value.trim();
      if (email) {
        handleAddManual(email);
      }
    });
  }
}

export function unmount() {
  listData = { allowed: [], users: [], pending: [], rejected: [] };
}

function escapeHtml(str) {
  if (!str) return '';
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}
