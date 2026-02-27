// Message Moderation panel
(function () {
  'use strict';

  var PAGE_SIZE = 20;
  var currentSkip = 0;
  var currentTotal = 0;
  var currentSearch = '';
  var currentStatus = '';

  function escapeHtml(str) {
    if (str == null) return '';
    return String(str)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }

  function formatDate(iso) {
    if (!iso) return '—';
    try {
      return new Date(iso).toLocaleString('en-GB', { dateStyle: 'short', timeStyle: 'short' });
    } catch (_) { return iso; }
  }

  function contextChips(conv) {
    var chips = [];
    var ctx = conv.context || {};
    if (ctx.type) chips.push('<span class="mod-badge" style="font-size:0.7rem;padding:0.1rem 0.4rem">' + escapeHtml(ctx.type) + '</span>');
    if (ctx.packageId) chips.push('<span class="mod-badge" style="font-size:0.7rem;padding:0.1rem 0.4rem;background:rgba(99,102,241,.15)">pkg</span>');
    if (ctx.supplierId) chips.push('<span class="mod-badge" style="font-size:0.7rem;padding:0.1rem 0.4rem;background:rgba(16,185,129,.15)">supplier</span>');
    return chips.join(' ');
  }

  function participantNames(conv) {
    var parts = conv.participants || [];
    return parts.map(function (p) { return escapeHtml(p.displayName || p.businessName || p.userId || '?'); }).join(', ') || '—';
  }

  function unreadTotal(conv) {
    var parts = conv.participants || [];
    return parts.reduce(function (sum, p) { return sum + (p.unreadCount || 0); }, 0);
  }

  function renderTable(conversations) {
    var tbody = document.getElementById('msgModerationBody');
    if (!tbody) return;
    if (!conversations || conversations.length === 0) {
      tbody.innerHTML = '<tr><td colspan="5" style="padding:1rem;text-align:center;opacity:0.6">No conversations found.</td></tr>';
      return;
    }
    var rows = conversations.map(function (conv) {
      var id = escapeHtml(conv._id || '');
      var unread = unreadTotal(conv);
      return '<tr style="border-top:1px solid rgba(0,0,0,.07)">' +
        '<td style="padding:0.5rem 0.75rem;max-width:240px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">' + participantNames(conv) + '</td>' +
        '<td style="padding:0.5rem 0.75rem">' + (contextChips(conv) || '—') + '</td>' +
        '<td style="padding:0.5rem 0.75rem;font-size:0.85rem;opacity:0.8">' + formatDate(conv.updatedAt || conv.lastMessage && conv.lastMessage.sentAt) + '</td>' +
        '<td style="padding:0.5rem 0.75rem;text-align:center">' + (unread > 0 ? '<span class="mod-badge" style="background:rgba(239,68,68,.15);color:#dc2626">' + unread + '</span>' : '—') + '</td>' +
        '<td style="padding:0.5rem 0.75rem;text-align:center"><a href="/messenger/?conversation=' + id + '" class="btn-sm" style="text-decoration:none" target="_blank">Open</a></td>' +
        '</tr>';
    });
    tbody.innerHTML = rows.join('');
  }

  function updatePager() {
    var info = document.getElementById('msgModerationPageInfo');
    var prev = document.getElementById('msgModerationPrev');
    var next = document.getElementById('msgModerationNext');
    if (!info) return;
    var page = Math.floor(currentSkip / PAGE_SIZE) + 1;
    var totalPages = Math.ceil(currentTotal / PAGE_SIZE) || 1;
    info.textContent = 'Page ' + page + ' of ' + totalPages + ' (' + currentTotal + ' total)';
    prev.disabled = currentSkip === 0;
    next.disabled = currentSkip + PAGE_SIZE >= currentTotal;
  }

  function loadConversations() {
    var params = new URLSearchParams({ limit: PAGE_SIZE, skip: currentSkip });
    if (currentSearch) params.set('search', currentSearch);
    if (currentStatus) params.set('status', currentStatus);
    fetch('/api/v4/messenger/admin/conversations?' + params.toString(), { credentials: 'same-origin' })
      .then(function (r) { return r.ok ? r.json() : Promise.reject(r.status); })
      .then(function (data) {
        currentTotal = data.total || 0;
        renderTable(data.conversations || []);
        updatePager();
      })
      .catch(function (err) {
        var tbody = document.getElementById('msgModerationBody');
        if (tbody) tbody.innerHTML = '<tr><td colspan="5" style="padding:1rem;text-align:center;color:#dc2626">Failed to load conversations (error: ' + escapeHtml(String(err)) + ')</td></tr>';
      });
  }

  document.addEventListener('DOMContentLoaded', function () {
    var searchInput = document.getElementById('msgModerationSearch');
    var statusSelect = document.getElementById('msgModerationStatus');
    var searchBtn = document.getElementById('msgModerationSearchBtn');
    var prevBtn = document.getElementById('msgModerationPrev');
    var nextBtn = document.getElementById('msgModerationNext');

    function doSearch() {
      currentSearch = searchInput ? searchInput.value.trim() : '';
      currentStatus = statusSelect ? statusSelect.value : '';
      currentSkip = 0;
      loadConversations();
    }

    if (searchBtn) searchBtn.addEventListener('click', doSearch);
    if (searchInput) searchInput.addEventListener('keydown', function (e) { if (e.key === 'Enter') doSearch(); });
    if (prevBtn) prevBtn.addEventListener('click', function () { if (currentSkip >= PAGE_SIZE) { currentSkip -= PAGE_SIZE; loadConversations(); } });
    if (nextBtn) nextBtn.addEventListener('click', function () { if (currentSkip + PAGE_SIZE < currentTotal) { currentSkip += PAGE_SIZE; loadConversations(); } });

    loadConversations();
  });
})();
