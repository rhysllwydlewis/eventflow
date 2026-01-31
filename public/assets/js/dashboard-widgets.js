/**
 * Dashboard Widgets
 * Reusable widget components for customer and supplier dashboards
 */

import { animateProgressBar, animateCircularProgress, initCountUp } from './count-up-animation.js';

/**
 * Create statistics grid widget
 * @param {Array} stats - Array of stat objects {icon, value, label, format}
 * @param {string} containerId - ID of container element
 */
export function createStatsGrid(stats, containerId) {
  const container = document.getElementById(containerId);
  if (!container) {
    return;
  }

  const gridHtml = `
    <div class="dashboard-grid" style="display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 1rem; margin-bottom: 1.5rem;">
      ${stats
        .map(
          stat => `
        <div class="stat-widget card" style="padding: 1.5rem;">
          <div style="display: flex; align-items: center; gap: 1rem;">
            <div class="icon-with-gradient ${stat.pulse ? 'pulse' : ''}" style="${stat.color ? `background: ${stat.color};` : ''}">
              ${stat.icon || '📊'}
            </div>
            <div style="flex: 1;">
              <div class="stat-number" data-target="${stat.value || 0}" data-format="${stat.format || 'number'}" data-start="0">0</div>
              <div class="stat-label">${stat.label || 'Stat'}</div>
            </div>
          </div>
        </div>
      `
        )
        .join('')}
    </div>
  `;

  container.innerHTML = gridHtml;

  // Initialize count-up animations
  setTimeout(() => {
    initCountUp(`#${containerId} [data-target]`);
  }, 100);
}

/**
 * Create budget tracker widget
 * @param {object} budgetData - {spent, total, remaining, breakdown}
 * @param {string} containerId - ID of container element
 */
export function createBudgetTracker(budgetData, containerId) {
  const container = document.getElementById(containerId);
  if (!container) {
    return;
  }

  const { spent = 0, total = 1000, remaining, breakdown = {} } = budgetData;
  const actualRemaining = remaining !== undefined ? remaining : Math.max(0, total - spent);
  const percentage = total > 0 ? (spent / total) * 100 : 0;

  let badgeColor = '#22C55E';
  let badgeText = 'On Track';
  if (percentage >= 100) {
    badgeColor = '#EF4444';
    badgeText = 'Over Budget';
  } else if (percentage >= 80) {
    badgeColor = '#F59E0B';
    badgeText = 'Attention';
  }

  // Generate breakdown HTML if we have breakdown data
  let breakdownHtml = '';
  const hasBreakdown = breakdown && Object.values(breakdown).some(val => val > 0);

  if (hasBreakdown) {
    const categoryIcons = {
      venue: '🏛️',
      catering: '🍽️',
      entertainment: '🎵',
      photography: '📸',
      decorations: '💐',
      transport: '🚗',
      beauty: '💄',
      other: '📦',
    };

    const categoryLabels = {
      venue: 'Venue',
      catering: 'Catering',
      entertainment: 'Entertainment',
      photography: 'Photography',
      decorations: 'Decorations',
      transport: 'Transport',
      beauty: 'Hair & Makeup',
      other: 'Other',
    };

    const breakdownItems = Object.entries(breakdown)
      .filter(([_, value]) => value > 0)
      .sort((a, b) => b[1] - a[1])
      .map(([category, value]) => {
        const percent = spent > 0 ? ((value / spent) * 100).toFixed(0) : 0;
        return `
          <div style="display: flex; justify-content: space-between; align-items: center; padding: 0.5rem 0; border-bottom: 1px solid #E7EAF0;">
            <div style="display: flex; align-items: center; gap: 0.5rem;">
              <span style="font-size: 1.2rem;">${categoryIcons[category] || '📦'}</span>
              <span style="font-size: 0.875rem; color: #667085;">${categoryLabels[category] || category}</span>
            </div>
            <div style="text-align: right;">
              <div style="font-size: 0.875rem; font-weight: 600; color: #0B1220;">£${value.toLocaleString('en-GB', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}</div>
              <div style="font-size: 0.75rem; color: #667085;">${percent}%</div>
            </div>
          </div>
        `;
      })
      .join('');

    breakdownHtml = `
      <details style="margin-top: 1rem;" id="${containerId}-breakdown">
        <summary style="cursor: pointer; font-size: 0.875rem; color: #0B8073; font-weight: 600; padding: 0.5rem; background: white; border-radius: 8px; list-style: none; display: flex; justify-content: space-between; align-items: center;">
          <span>📊 View Breakdown by Category</span>
          <span style="font-size: 1rem;">▼</span>
        </summary>
        <div style="margin-top: 0.75rem; background: white; border-radius: 8px; padding: 0.75rem;">
          ${breakdownItems}
        </div>
      </details>
    `;
  }

  const html = `
    <div class="card" style="padding: 1.5rem; background: linear-gradient(135deg, #F6FAF9 0%, #EBF5F4 100%);">
      <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 1rem;">
        <h3 style="margin: 0; font-size: 1.25rem; color: #0B1220;">Budget Tracker</h3>
        <span class="badge" style="background: ${badgeColor}; color: white; padding: 6px 12px; border-radius: 12px; font-size: 0.875rem;">${badgeText}</span>
      </div>
      
      <div class="progress-bar-container" style="margin-bottom: 1rem;">
        <div class="progress-bar-fill" id="${containerId}-progress" style="width: 0%;"></div>
      </div>
      
      <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 1rem;">
        <div style="padding: 1rem; background: white; border-radius: 12px; text-align: center;">
          <div style="font-size: 0.875rem; color: #667085; margin-bottom: 0.5rem;">Spent</div>
          <div class="stat-number" data-target="${spent}" data-format="currency" data-start="0" style="font-size: 1.5rem; color: #DC2626;">£0</div>
        </div>
        <div style="padding: 1rem; background: white; border-radius: 12px; text-align: center;">
          <div style="font-size: 0.875rem; color: #667085; margin-bottom: 0.5rem;">Remaining</div>
          <div class="stat-number" data-target="${actualRemaining}" data-format="currency" data-start="0" style="font-size: 1.5rem; color: #22C55E;">£0</div>
        </div>
      </div>
      
      ${breakdownHtml}
    </div>
  `;

  container.innerHTML = html;

  // Animate progress bar and numbers
  setTimeout(() => {
    const progressBar = document.getElementById(`${containerId}-progress`);
    animateProgressBar(progressBar, percentage);
    initCountUp(`#${containerId} [data-target]`);
  }, 100);
}

/**
 * Create progress ring widget
 * @param {object} data - {percentage, label, booked, pending}
 * @param {string} containerId - ID of container element
 */
export function createProgressRing(data, containerId) {
  const container = document.getElementById(containerId);
  if (!container) {
    return;
  }

  const { percentage = 0, label = 'Event Progress', booked = 0, pending = 0 } = data;
  const radius = 45;
  const circumference = 2 * Math.PI * radius;

  const html = `
    <div class="card" style="padding: 1.5rem; text-align: center;">
      <h3 style="margin: 0 0 1.5rem 0; font-size: 1.25rem; color: #0B1220;">${label}</h3>
      
      <div style="position: relative; display: inline-block;">
        <svg width="120" height="120" style="transform: rotate(-90deg);">
          <circle
            cx="60"
            cy="60"
            r="${radius}"
            fill="none"
            stroke="#E7EAF0"
            stroke-width="8"
          />
          <circle
            cx="60"
            cy="60"
            r="${radius}"
            fill="none"
            stroke="url(#gradient-${containerId})"
            stroke-width="8"
            stroke-linecap="round"
            class="progress-ring-circle"
            id="${containerId}-circle"
            style="stroke-dasharray: ${circumference} ${circumference}; stroke-dashoffset: ${circumference};"
          />
          <defs>
            <linearGradient id="gradient-${containerId}" x1="0%" y1="0%" x2="100%" y2="100%">
              <stop offset="0%" style="stop-color:#0B8073;stop-opacity:1" />
              <stop offset="100%" style="stop-color:#13B6A2;stop-opacity:1" />
            </linearGradient>
          </defs>
        </svg>
        <div style="position: absolute; top: 50%; left: 50%; transform: translate(-50%, -50%); text-align: center;">
          <div class="stat-number" data-target="${percentage}" data-format="percent" data-start="0" style="font-size: 1.75rem; font-weight: 700; color: #0B8073;">0%</div>
          <div style="font-size: 0.75rem; color: #667085;">Complete</div>
        </div>
      </div>
      
      <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 1rem; margin-top: 1.5rem;">
        <div>
          <div class="stat-number" data-target="${booked}" data-start="0" style="font-size: 1.25rem; color: #22C55E;">0</div>
          <div style="font-size: 0.875rem; color: #667085;">Booked</div>
        </div>
        <div>
          <div class="stat-number" data-target="${pending}" data-start="0" style="font-size: 1.25rem; color: #EAB308;">0</div>
          <div style="font-size: 0.875rem; color: #667085;">Pending</div>
        </div>
      </div>
    </div>
  `;

  container.innerHTML = html;

  // Animate circle and numbers
  setTimeout(() => {
    const circle = document.getElementById(`${containerId}-circle`);
    animateCircularProgress(circle, percentage, radius);
    initCountUp(`#${containerId} [data-target]`);
  }, 100);
}

/**
 * Create upcoming events timeline widget
 * @param {Array} events - Array of event objects
 * @param {string} containerId - ID of container element
 * @param {string} eventDate - Optional event date for countdown
 */
export function createEventsTimeline(events, containerId, eventDate = null) {
  const container = document.getElementById(containerId);
  if (!container) {
    return;
  }

  if (!events || events.length === 0) {
    container.innerHTML = `
      <div class="card" style="padding: 1.5rem;">
        <h3 style="margin: 0 0 1rem 0; font-size: 1.25rem; color: #0B1220;">Upcoming Tasks</h3>
        <p class="small" style="color: #667085; text-align: center; padding: 2rem 0;">No upcoming tasks. You're all set!</p>
      </div>
    `;
    return;
  }

  // Generate countdown HTML if event date is provided
  let countdownHtml = '';
  if (eventDate) {
    countdownHtml = `
      <div id="countdown-widget" style="background: linear-gradient(135deg, #0B8073 0%, #13B6A2 100%); border-radius: 12px; padding: 1.5rem; margin-bottom: 1rem; text-align: center;">
        <div style="color: white; font-size: 0.875rem; margin-bottom: 0.5rem; opacity: 0.9;">🎉 Event Countdown</div>
        <div id="countdown-display" style="color: white;">
          <div class="countdown-widget" style="display: flex; justify-content: center; gap: 1.5rem; flex-wrap: wrap;">
            <div style="text-align: center;">
              <div class="countdown-number" style="font-size: 2rem; font-weight: 700;">--</div>
              <div style="font-size: 0.875rem; opacity: 0.9;">days</div>
            </div>
            <div style="text-align: center;">
              <div class="countdown-number" style="font-size: 2rem; font-weight: 700;">--</div>
              <div style="font-size: 0.875rem; opacity: 0.9;">hours</div>
            </div>
            <div style="text-align: center;">
              <div class="countdown-number" style="font-size: 2rem; font-weight: 700;">--</div>
              <div style="font-size: 0.875rem; opacity: 0.9;">minutes</div>
            </div>
          </div>
        </div>
      </div>
    `;
  }

  const html = `
    <div class="card" style="padding: 1.5rem;">
      <h3 style="margin: 0 0 1rem 0; font-size: 1.25rem; color: #0B1220;">Upcoming Tasks</h3>
      ${countdownHtml}
      <div class="timeline">
        ${events
          .map(
            (event, index) => `
          <div class="timeline-step" style="opacity: 0;">
            <div style="display: flex; gap: 1rem; align-items: start;">
              <div style="width: 8px; height: 8px; background: linear-gradient(135deg, #0B8073 0%, #13B6A2 100%); border-radius: 50%; margin-top: 6px;${index < events.length - 1 ? ' position: relative;' : ''}">
                ${
                  index < events.length - 1
                    ? '<div style="position: absolute; top: 8px; left: 3px; width: 2px; height: 40px; background: #E7EAF0;"></div>'
                    : ''
                }
              </div>
              <div style="flex: 1; padding-bottom: 1.5rem;">
                <div style="display: flex; justify-content: space-between; align-items: start; margin-bottom: 0.5rem; gap: 0.5rem; flex-wrap: wrap;">
                  <strong style="color: #0B1220;">${event.name || 'Task'}</strong>
                  <span class="badge" style="${getBadgeStyle(event.daysUntil)}">${getDueBadgeText(event.daysUntil)}</span>
                </div>
                ${event.supplier ? `<p class="small" style="color: #667085; margin: 0.25rem 0;">📍 ${event.supplier}</p>` : ''}
              </div>
            </div>
          </div>
        `
          )
          .join('')}
      </div>
    </div>
  `;

  container.innerHTML = html;

  // Initialize countdown if event date is provided
  if (eventDate) {
    initCountdown(eventDate);
  }
}

/**
 * Initialize and update countdown timer
 * @param {string} eventDate - ISO date string for the event
 */
function initCountdown(eventDate) {
  function updateCountdown() {
    const now = new Date();
    const event = new Date(eventDate);
    const diff = event - now;

    const display = document.getElementById('countdown-display');
    if (!display) {
      return;
    }

    if (diff <= 0) {
      display.innerHTML = '<div style="font-size: 1.75rem; font-weight: 700;">🎉 Event Day!</div>';
      return;
    }

    const days = Math.floor(diff / (1000 * 60 * 60 * 24));
    const hours = Math.floor((diff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
    const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));

    display.innerHTML = `
      <div class="countdown-widget" style="display: flex; justify-content: center; gap: 1.5rem; flex-wrap: wrap;">
        <div style="text-align: center;">
          <div class="countdown-number" style="font-size: 2rem; font-weight: 700;">${days}</div>
          <div style="font-size: 0.875rem; opacity: 0.9;">days</div>
        </div>
        <div style="text-align: center;">
          <div class="countdown-number" style="font-size: 2rem; font-weight: 700;">${hours}</div>
          <div style="font-size: 0.875rem; opacity: 0.9;">hours</div>
        </div>
        <div style="text-align: center;">
          <div class="countdown-number" style="font-size: 2rem; font-weight: 700;">${minutes}</div>
          <div style="font-size: 0.875rem; opacity: 0.9;">minutes</div>
        </div>
      </div>
    `;
  }

  // Update immediately
  updateCountdown();

  // Update every minute
  setInterval(updateCountdown, 60000);
}

function getBadgeStyle(daysUntil) {
  if (daysUntil <= 1) {
    return 'background: #FEF3C7; color: #92400E; padding: 4px 10px; border-radius: 12px; font-size: 0.75rem;';
  } else if (daysUntil <= 7) {
    return 'background: #DBEAFE; color: #1E40AF; padding: 4px 10px; border-radius: 12px; font-size: 0.75rem;';
  }
  return 'background: #F3F4F6; color: #374151; padding: 4px 10px; border-radius: 12px; font-size: 0.75rem;';
}

function getDueBadgeText(daysUntil) {
  if (daysUntil === 0) {
    return 'Due Today';
  }
  if (daysUntil === 1) {
    return 'Due Tomorrow';
  }
  if (daysUntil <= 7) {
    return `In ${daysUntil} days`;
  }
  const weeks = Math.floor(daysUntil / 7);
  return `In ${weeks} week${weeks > 1 ? 's' : ''}`;
}

/**
 * Create profile completeness checklist widget
 * @param {object} completionData - Completion status for various items
 * @param {string} containerId - ID of container element
 */
export function createProfileChecklist(completionData, containerId) {
  const container = document.getElementById(containerId);
  if (!container) {
    return;
  }

  const items = [
    {
      id: 'basic-info',
      label: 'Basic information',
      completed: completionData.basicInfo || false,
    },
    {
      id: 'photos',
      label: 'Profile photos (5+ uploaded)',
      completed: completionData.photos || false,
    },
    {
      id: 'banner',
      label: 'Custom banner image',
      completed: completionData.banner || false,
      badge: completionData.banner ? '✨' : null,
    },
    {
      id: 'tagline',
      label: 'Profile tagline added',
      completed: completionData.tagline || false,
      badge: completionData.tagline ? '💬' : null,
    },
    {
      id: 'highlights',
      label: 'Key highlights (3+ added)',
      completed: completionData.highlights || false,
      badge: completionData.highlights ? '⭐' : null,
    },
    {
      id: 'social',
      label: 'Social links (2+ platforms)',
      completed: completionData.socialLinks || false,
      badge: completionData.socialLinks ? '🔗' : null,
    },
    {
      id: 'package',
      label: 'At least 1 package created',
      completed: completionData.package || false,
    },
    {
      id: 'email',
      label: 'Email verified',
      completed: completionData.emailVerified || false,
      action: !completionData.emailVerified
        ? { text: 'Verify Now', href: '/settings.html#verify-email' }
        : null,
    },
    {
      id: 'review',
      label: 'First review received',
      completed: completionData.firstReview || false,
      badge: completionData.firstReview ? '🌟' : null,
    },
  ];

  const completedCount = items.filter(item => item.completed).length;
  const totalCount = items.length;
  const percentage = Math.round((completedCount / totalCount) * 100);

  const html = `
    <div class="card" style="padding: 1.5rem;">
      <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 1rem;">
        <h3 style="margin: 0; font-size: 1.25rem; color: #0B1220;">Profile Completeness</h3>
        <span class="badge ${percentage === 100 ? 'pulse' : ''}" style="background: ${percentage === 100 ? '#22C55E' : '#EAB308'}; color: white; padding: 6px 12px; border-radius: 12px; font-size: 0.875rem;">${percentage}%</span>
      </div>
      
      <div class="progress-bar-container" style="margin-bottom: 1.5rem;">
        <div class="progress-bar-fill" id="${containerId}-progress" style="width: 0%;"></div>
      </div>
      
      <div style="display: flex; flex-direction: column; gap: 0.75rem;">
        ${items
          .map(
            item => `
          <div class="checklist-item ${item.completed ? 'completed' : ''}" style="display: flex; align-items: center; gap: 0.75rem;">
            <div class="checklist-icon" style="width: 24px; height: 24px; border-radius: 50%; display: flex; align-items: center; justify-content: center; ${
              item.completed
                ? 'background: #22C55E; color: white;'
                : 'border: 2px solid #D1D5DB; color: transparent;'
            }">
              ${item.completed ? '✓' : '○'}
            </div>
            <div style="flex: 1; display: flex; justify-content: space-between; align-items: center; gap: 0.5rem; flex-wrap: wrap;">
              <span style="color: ${item.completed ? '#0B1220' : '#667085'};">${item.label}</span>
              ${item.badge ? `<span>${item.badge}</span>` : ''}
              ${item.action && !item.completed ? `<a href="${item.action.href}" class="cta" style="padding: 0.25rem 0.75rem; font-size: 0.75rem; text-decoration: none;">${item.action.text}</a>` : ''}
            </div>
          </div>
        `
          )
          .join('')}
      </div>
    </div>
  `;

  container.innerHTML = html;

  // Animate progress bar
  setTimeout(() => {
    const progressBar = document.getElementById(`${containerId}-progress`);
    animateProgressBar(progressBar, percentage);
  }, 100);
}

// Export all functions
export default {
  createStatsGrid,
  createBudgetTracker,
  createProgressRing,
  createEventsTimeline,
  createProfileChecklist,
};
