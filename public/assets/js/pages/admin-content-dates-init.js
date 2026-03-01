(async function () {
  // Use CSRF token from AdminShared
  function getCSRFToken() {
    return window.__CSRF_TOKEN__ || '';
  }

  // Load content dates
  async function loadContentDates() {
    try {
      const data = await AdminShared.api('/api/admin/content-dates');

      if (!data.success) {
        throw new Error(data.error || 'Failed to load content dates');
      }

      void data.config; // config loaded; kept for consistency with server response

      // Update status
      const statusHtml = `
        <div class="info-row">
          <span class="info-label">Automated Updates</span>
          <span class="status-badge ${data.config.autoUpdateEnabled ? 'enabled' : 'disabled'}">
            ${data.config.autoUpdateEnabled ? 'Enabled' : 'Disabled'}
          </span>
        </div>
        <div class="info-row">
          <span class="info-label">Content Status</span>
          <span class="status-badge ${data.changeCheck.changed ? 'changed' : 'uptodate'}">
            ${data.changeCheck.reason}
          </span>
        </div>
        <div class="info-row">
          <span class="info-label">Next Scheduled Check</span>
          <span class="info-value">${data.status.nextRun ? new Date(data.status.nextRun).toLocaleString() : 'Not scheduled'}</span>
        </div>
      `;
      document.getElementById('statusContent').innerHTML = statusHtml;

      // Update current dates
      const datesHtml = `
        <div class="info-row">
          <span class="info-label">Last Updated</span>
          <span class="info-value">${data.config.legalLastUpdated}</span>
        </div>
        <div class="info-row">
          <span class="info-label">Effective Date</span>
          <span class="info-value">${data.config.legalEffectiveDate}</span>
        </div>
        ${
          data.changeCheck.gitDate
            ? `
        <div class="info-row">
          <span class="info-label">Git Detected Date</span>
          <span class="info-value">${data.changeCheck.gitDate}</span>
        </div>
        `
            : ''
        }
        ${
          data.config.lastAutoCheck
            ? `
        <div class="info-row">
          <span class="info-label">Last Auto Check</span>
          <span class="info-value">${new Date(data.config.lastAutoCheck).toLocaleString()}</span>
        </div>
        `
            : ''
        }
      `;
      document.getElementById('currentDatesContent').innerHTML = datesHtml;

      // Update toggle
      document.getElementById('autoUpdateToggle').checked = data.config.autoUpdateEnabled;
      document.getElementById('autoUpdateLabel').textContent = data.config.autoUpdateEnabled
        ? 'Enabled'
        : 'Disabled';

      // Update schedule info
      const scheduleHtml = data.status.scheduled
        ? `✅ Automated checks are scheduled to run on the 1st of each month at 2:00 AM.<br>Next run: ${new Date(data.status.nextRun).toLocaleString()}`
        : '❌ Automated checks are not currently scheduled.';
      document.getElementById('scheduleInfo').innerHTML = scheduleHtml;
    } catch (error) {
      console.error('Failed to load content dates:', error);
      document.getElementById('statusContent').innerHTML =
        `<p style="color: #ef4444;">Error: ${error.message}</p>`;
    }
  }

  // Load article dates
  async function loadArticleDates() {
    try {
      const data = await AdminShared.api('/api/admin/content-dates/articles');

      if (!data.success) {
        throw new Error(data.error || 'Failed to load article dates');
      }

      if (data.articles.length === 0) {
        document.getElementById('articleDatesContent').innerHTML =
          '<p style="color: #6b7280;">No articles found</p>';
        return;
      }

      const articlesHtml = `
        <ul class="article-list">
          ${data.articles
            .map(
              article => `
            <li class="article-item">
              <span class="article-name">${article.name}</span>
              <span class="article-date">${article.lastModifiedFormatted}</span>
            </li>
          `
            )
            .join('')}
        </ul>
      `;
      document.getElementById('articleDatesContent').innerHTML = articlesHtml;
    } catch (error) {
      console.error('Failed to load article dates:', error);
      document.getElementById('articleDatesContent').innerHTML =
        `<p style="color: #ef4444;">Error: ${error.message}</p>`;
    }
  }

  // Update dates
  document.getElementById('updateDatesForm').addEventListener('submit', async e => {
    e.preventDefault();

    const lastUpdated = document.getElementById('lastUpdated').value.trim();
    const effectiveDate = document.getElementById('effectiveDate').value.trim();

    if (!lastUpdated && !effectiveDate) {
      showMessage('Please provide at least one date to update', 'error');
      return;
    }

    const updateBtn = document.getElementById('updateBtn');
    updateBtn.disabled = true;
    updateBtn.textContent = 'Updating...';

    try {
      const response = await fetch('/api/admin/content-dates', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-CSRF-Token': getCSRFToken(),
        },
        credentials: 'include',
        body: JSON.stringify({ lastUpdated, effectiveDate }),
      });

      const data = await response.json();

      if (!response.ok || !data.success) {
        throw new Error(data.message || data.error || 'Update failed');
      }

      showMessage('✅ Dates updated successfully!', 'success');
      document.getElementById('lastUpdated').value = '';
      document.getElementById('effectiveDate').value = '';
      await loadContentDates();
    } catch (error) {
      console.error('Failed to update dates:', error);
      showMessage(`❌ Error: ${error.message}`, 'error');
    } finally {
      updateBtn.disabled = false;
      updateBtn.textContent = 'Update Dates';
    }
  });

  // Check now
  document.getElementById('checkNowBtn').addEventListener('click', async () => {
    const btn = document.getElementById('checkNowBtn');
    btn.disabled = true;
    btn.textContent = 'Checking...';

    try {
      const response = await fetch('/api/admin/content-dates/check-now', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-CSRF-Token': getCSRFToken(),
        },
        credentials: 'include',
      });

      const data = await response.json();

      if (!response.ok || !data.success) {
        throw new Error(data.message || data.error || 'Check failed');
      }

      showMessage(`✅ ${data.message}`, 'success');
      await loadContentDates();
    } catch (error) {
      console.error('Failed to check dates:', error);
      showMessage(`❌ Error: ${error.message}`, 'error');
    } finally {
      btn.disabled = false;
      btn.textContent = 'Check for Updates Now';
    }
  });

  // Toggle automation
  document.getElementById('autoUpdateToggle').addEventListener('change', async e => {
    const enabled = e.target.checked;

    try {
      const response = await fetch('/api/admin/content-dates/schedule', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-CSRF-Token': getCSRFToken(),
        },
        credentials: 'include',
        body: JSON.stringify({ enabled }),
      });

      const data = await response.json();

      if (!response.ok || !data.success) {
        throw new Error(data.message || data.error || 'Toggle failed');
      }

      showMessage(`✅ Automation ${enabled ? 'enabled' : 'disabled'}`, 'success');
      document.getElementById('autoUpdateLabel').textContent = enabled ? 'Enabled' : 'Disabled';
      await loadContentDates();
    } catch (error) {
      console.error('Failed to toggle automation:', error);
      showMessage(`❌ Error: ${error.message}`, 'error');
      e.target.checked = !enabled; // Revert toggle
    }
  });

  function showMessage(message, type) {
    const msgEl = document.getElementById('updateMessage');
    msgEl.textContent = message;
    msgEl.style.display = 'block';
    msgEl.style.background = type === 'success' ? '#d1fae5' : '#fee2e2';
    msgEl.style.color = type === 'success' ? '#065f46' : '#991b1b';

    setTimeout(() => {
      msgEl.style.display = 'none';
    }, 5000);
  }

  // Initialize
  await loadContentDates();
  await loadArticleDates();
})();
