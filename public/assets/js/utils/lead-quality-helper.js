/**
 * Lead Quality Badge Helper
 * Generates HTML for displaying lead quality badges and scores
 */

/**
 * Get lead quality badge HTML
 * @param {string} rating - 'High', 'Medium', or 'Low'
 * @param {number} score - Raw score 0-100
 * @returns {string} HTML string for badge
 */
export function getLeadQualityBadge(rating, score) {
  if (!rating) {
    return '';
  }

  const badgeClass = `lead-badge lead-badge-${rating.toLowerCase()}`;
  const scoreCircle = score
    ? `<span class="lead-score-number ${rating.toLowerCase()}">${score}</span>`
    : '';

  return `
    <div class="lead-quality-display">
      <span class="${badgeClass}" role="status" aria-label="Lead quality: ${rating}">
        ${rating} Quality
      </span>
      ${scoreCircle}
    </div>
  `;
}

/**
 * Get supplier badge HTML
 * @param {object} supplier - Supplier object with badge info
 * @returns {string} HTML string for badges
 */
export function getSupplierBadges(supplier) {
  if (!supplier) {
    return '';
  }

  const badges = [];

  // Founding supplier badge
  if (supplier.isFounding) {
    badges.push(
      '<span class="badge badge-founding" data-tooltip="Founding Supplier - One of our first partners">Founding Supplier</span>'
    );
  }

  // Pro/Featured tier badges
  if (supplier.subscription) {
    if (supplier.subscription.tier === 'featured') {
      badges.push('<span class="badge badge-featured">Featured</span>');
    } else if (supplier.subscription.tier === 'pro') {
      badges.push('<span class="badge badge-pro">Pro</span>');
    }
  } else if (supplier.isPro) {
    // Legacy pro flag
    badges.push('<span class="badge badge-pro">Pro</span>');
  }

  // Verification badges
  if (supplier.verifications) {
    if (supplier.verifications.email && supplier.verifications.email.verified) {
      badges.push(
        '<span class="badge badge-email-verified" data-tooltip="Email verified">Email Verified</span>'
      );
    }
    if (supplier.verifications.phone && supplier.verifications.phone.verified) {
      badges.push(
        '<span class="badge badge-phone-verified" data-tooltip="Phone verified">Phone Verified</span>'
      );
    }
    if (supplier.verifications.business && supplier.verifications.business.verified) {
      badges.push(
        '<span class="badge badge-business-verified" data-tooltip="Business documents verified">Business Verified</span>'
      );
    }
  }

  if (badges.length === 0) {
    return '';
  }

  return `
    <div class="supplier-badges">
      ${badges.join('')}
    </div>
  `;
}

/**
 * Get lead quality breakdown HTML for dashboard
 * @param {Array} threads - Array of thread objects with lead scores
 * @returns {object} Counts and HTML
 */
export function getLeadQualityBreakdown(threads) {
  if (!threads || threads.length === 0) {
    return {
      high: 0,
      medium: 0,
      low: 0,
      total: 0,
      html: '<p class="small">No enquiries yet</p>',
    };
  }

  const counts = {
    High: 0,
    Medium: 0,
    Low: 0,
  };

  threads.forEach(thread => {
    if (thread.leadScore) {
      counts[thread.leadScore] = (counts[thread.leadScore] || 0) + 1;
    }
  });

  const total = threads.length;
  const highPercent = Math.round((counts.High / total) * 100) || 0;
  const mediumPercent = Math.round((counts.Medium / total) * 100) || 0;
  const lowPercent = Math.round((counts.Low / total) * 100) || 0;

  const html = `
    <div class="lead-quality-breakdown">
      <h4 style="margin-bottom: 1rem;">Lead Quality Distribution</h4>
      
      <div class="quality-stat">
        <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 0.5rem;">
          <span class="lead-badge lead-badge-high" style="font-size: 0.875rem;">High Quality</span>
          <span style="font-weight: 600;">${counts.High} (${highPercent}%)</span>
        </div>
        <div class="progress-bar" style="background: #e5e7eb; border-radius: 4px; height: 8px; overflow: hidden;">
          <div style="background: #10b981; height: 100%; width: ${highPercent}%; transition: width 0.3s;"></div>
        </div>
      </div>
      
      <div class="quality-stat" style="margin-top: 0.75rem;">
        <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 0.5rem;">
          <span class="lead-badge lead-badge-medium" style="font-size: 0.875rem;">Medium Quality</span>
          <span style="font-weight: 600;">${counts.Medium} (${mediumPercent}%)</span>
        </div>
        <div class="progress-bar" style="background: #e5e7eb; border-radius: 4px; height: 8px; overflow: hidden;">
          <div style="background: #f59e0b; height: 100%; width: ${mediumPercent}%; transition: width 0.3s;"></div>
        </div>
      </div>
      
      <div class="quality-stat" style="margin-top: 0.75rem;">
        <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 0.5rem;">
          <span class="lead-badge lead-badge-low" style="font-size: 0.875rem;">Low Quality</span>
          <span style="font-weight: 600;">${counts.Low} (${lowPercent}%)</span>
        </div>
        <div class="progress-bar" style="background: #e5e7eb; border-radius: 4px; height: 8px; overflow: hidden;">
          <div style="background: #ef4444; height: 100%; width: ${lowPercent}%; transition: width 0.3s;"></div>
        </div>
      </div>
      
      <div style="margin-top: 1rem; padding: 0.75rem; background: #f9fafb; border-radius: 6px; text-align: center;">
        <div style="font-size: 0.875rem; color: #6b7280; margin-bottom: 0.25rem;">Average Lead Score</div>
        <div style="font-size: 1.5rem; font-weight: 700; color: #111827;">${Math.round(threads.reduce((sum, t) => sum + (t.leadScoreRaw || 50), 0) / total)}/100</div>
      </div>
    </div>
  `;

  return {
    high: counts.High,
    medium: counts.Medium,
    low: counts.Low,
    total,
    html,
  };
}

/**
 * Add lead quality indicator to thread display
 * @param {object} thread - Thread object
 * @returns {string} HTML to append to thread display
 */
export function getThreadLeadQualityIndicator(thread) {
  if (!thread.leadScore && !thread.leadScoreRaw) {
    return '';
  }

  const score = thread.leadScoreRaw || null;
  const rating = thread.leadScore || 'Medium';

  return `
    <div style="margin-top: 0.5rem; display: flex; align-items: center; gap: 0.5rem;">
      ${getLeadQualityBadge(rating, score)}
      ${thread.leadScoreFlags && thread.leadScoreFlags.length > 0 ? `<span class="small" style="color: #9ca3af;" title="${thread.leadScoreFlags.join(', ')}">ⓘ</span>` : ''}
    </div>
  `;
}

/**
 * Sort threads by lead quality
 * @param {Array} threads - Array of thread objects
 * @param {string} order - 'asc' or 'desc'
 * @returns {Array} Sorted threads
 */
export function sortThreadsByLeadQuality(threads, order = 'desc') {
  const scoreMap = { High: 3, Medium: 2, Low: 1 };

  return threads.sort((a, b) => {
    const scoreA = a.leadScoreRaw || scoreMap[a.leadScore] || 0;
    const scoreB = b.leadScoreRaw || scoreMap[b.leadScore] || 0;

    return order === 'desc' ? scoreB - scoreA : scoreA - scoreB;
  });
}

/**
 * Filter threads by lead quality
 * @param {Array} threads - Array of thread objects
 * @param {string} quality - 'High', 'Medium', 'Low', or 'all'
 * @returns {Array} Filtered threads
 */
export function filterThreadsByQuality(threads, quality) {
  if (quality === 'all' || !quality) {
    return threads;
  }

  return threads.filter(thread => thread.leadScore === quality);
}

export default {
  getLeadQualityBadge,
  getSupplierBadges,
  getLeadQualityBreakdown,
  getThreadLeadQualityIndicator,
  sortThreadsByLeadQuality,
  filterThreadsByQuality,
};
