(function () {
  'use strict';

  const PAGE_SIZE = 20;
  let currentPage = 0;
  let currentSearch = '';
  let currentStatus = '';
  let totalConversations = 0;

  function escapeHtml(s) {
    return AdminShared.escapeHtml(s);
  }

  function formatDate(ts) {
    if (!ts) {
      return '—';
    }
    const d = new Date(ts);
    return d.toLocaleString('en-GB', { dateStyle: 'short', timeStyle: 'short' });
  }

  function getParticipantNames(participants) {
    if (!Array.isArray(participants) || participants.length === 0) {
      return 'Unknown';
    }
    return participants
      .map(p => escapeHtml(p.displayName || p.businessName || p.email || p.userId || 'Unknown'))
      .join(', ');
  }

  async function fetchConversations() {
    const tbody = document.getElementById('conversationsBody');
    const summary = document.getElementById('resultsSummary');
    tbody.innerHTML =
      '<tr><td colspan="6" style="padding:32px;text-align:center;color:#9ca3af;">Loading…</td></tr>';

    try {
      const params = new URLSearchParams({
        limit: PAGE_SIZE,
        skip: currentPage * PAGE_SIZE,
      });
      if (currentSearch.trim()) {
        params.set('search', currentSearch.trim());
      }
      if (currentStatus) {
        params.set('status', currentStatus);
      }

      const res = await fetch(`/api/v4/messenger/admin/conversations?${params.toString()}`, {
        credentials: 'include',
        headers: { Accept: 'application/json' },
      });

      if (res.status === 403) {
        tbody.innerHTML =
          '<tr><td colspan="6" style="padding:32px;text-align:center;color:#dc2626;">Access denied. Admin role required.</td></tr>';
        return;
      }
      if (!res.ok) {
        throw new Error(`HTTP ${res.status}`);
      }

      const data = await res.json();
      totalConversations = data.total || 0;
      const conversations = data.conversations || [];

      summary.textContent =
        totalConversations === 0
          ? 'No conversations found.'
          : `Showing ${currentPage * PAGE_SIZE + 1}–${Math.min((currentPage + 1) * PAGE_SIZE, totalConversations)} of ${totalConversations} conversations`;

      if (conversations.length === 0) {
        tbody.innerHTML =
          '<tr><td colspan="6" style="padding:32px;text-align:center;color:#9ca3af;">No conversations found.</td></tr>';
        updatePagination();
        return;
      }

      tbody.innerHTML = conversations
        .map(conv => {
          const names = getParticipantNames(conv.participants);
          const type = escapeHtml(conv.type || '—');
          const lastMsg =
            (conv.lastMessage && (conv.lastMessage.content || conv.lastMessage.text)) || '—';
          const preview = escapeHtml(
            lastMsg.length > 80 ? `${lastMsg.substring(0, 80)}…` : lastMsg
          );
          const updated = formatDate(conv.updatedAt);
          const status = escapeHtml(conv.status || 'active');
          const id = escapeHtml(conv._id || conv.id || '');
          return `<tr style="border-bottom:1px solid rgba(0,0,0,0.05);">
          <td style="padding:12px 16px;font-size:0.85rem;max-width:200px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;" title="${names}">${names}</td>
          <td style="padding:12px 16px;font-size:0.82rem;"><span style="background:rgba(11,128,115,0.1);color:#0b8073;padding:2px 8px;border-radius:4px;">${type}</span></td>
          <td style="padding:12px 16px;font-size:0.82rem;color:#6b7280;max-width:240px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;" title="${preview}">${preview}</td>
          <td style="padding:12px 16px;font-size:0.82rem;color:#6b7280;white-space:nowrap;">${updated}</td>
          <td style="padding:12px 16px;font-size:0.82rem;">${status}</td>
          <td style="padding:12px 16px;">
            ${
              id
                ? `<a href="/messenger/?conversation=${id}" target="_blank" rel="noopener"
                      style="font-size:0.82rem;color:#0b8073;text-decoration:none;font-weight:600;">Open ↗</a>`
                : '—'
            }
          </td>
        </tr>`;
        })
        .join('');

      updatePagination();
    } catch (err) {
      console.error('Admin messenger: fetch failed', err);
      tbody.innerHTML =
        '<tr><td colspan="6" style="padding:32px;text-align:center;color:#dc2626;">Failed to load conversations. Please try again.</td></tr>';
    }
  }

  function updatePagination() {
    const totalPages = Math.ceil(totalConversations / PAGE_SIZE) || 1;
    document.getElementById('pageInfo').textContent = `Page ${currentPage + 1} of ${totalPages}`;
    document.getElementById('prevPageBtn').disabled = currentPage === 0;
    document.getElementById('nextPageBtn').disabled = currentPage + 1 >= totalPages;
  }

  // Wire up controls
  document.getElementById('searchBtn').addEventListener('click', () => {
    currentPage = 0;
    currentSearch = document.getElementById('messengerSearch').value;
    currentStatus = document.getElementById('statusFilter').value;
    fetchConversations();
  });

  document.getElementById('messengerSearch').addEventListener('keydown', e => {
    if (e.key === 'Enter') {
      document.getElementById('searchBtn').click();
    }
  });

  document.getElementById('prevPageBtn').addEventListener('click', () => {
    if (currentPage > 0) {
      currentPage--;
      fetchConversations();
    }
  });

  document.getElementById('nextPageBtn').addEventListener('click', () => {
    currentPage++;
    fetchConversations();
  });

  document.getElementById('navRefreshBtn').addEventListener('click', fetchConversations);

  // Initial load – use readyState check since script is at bottom of body
  // (DOMContentLoaded may have already fired by the time this script runs)
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', fetchConversations);
  } else {
    fetchConversations();
  }
})();
