function efSetupPhotoDropZone(dropId, previewId, onImage) {
  const drop = document.getElementById(dropId);
  if (!drop) {
    return;
  }
  const preview = previewId ? document.getElementById(previewId) : null;

  function stop(e) {
    e.preventDefault();
    e.stopPropagation();
  }

  function handleFiles(files) {
    if (!files || !files.length) {
      return;
    }
    Array.prototype.slice.call(files).forEach((file, index) => {
      if (!file.type || file.type.indexOf('image/') !== 0) {
        return;
      }
      const reader = new FileReader();
      reader.onload = function (ev) {
        const dataUrl = ev.target && ev.target.result;
        if (!dataUrl) {
          return;
        }
        if (typeof onImage === 'function') {
          onImage(dataUrl, file);
        }
        if (preview) {
          const img = document.createElement('img');
          img.src = dataUrl;
          preview.appendChild(img);
        }
      };
      reader.readAsDataURL(file);
    });
  }

  ['dragenter', 'dragover'].forEach(evt => {
    drop.addEventListener(evt, e => {
      stop(e);
      drop.classList.add('dragover');
    });
  });

  ['dragleave', 'drop'].forEach(evt => {
    drop.addEventListener(evt, e => {
      stop(e);
      drop.classList.remove('dragover');
    });
  });

  drop.addEventListener('drop', e => {
    stop(e);
    const dt = e.dataTransfer;
    if (dt && dt.files) {
      handleFiles(dt.files);
    }
  });

  drop.addEventListener('click', () => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = 'image/*';
    input.multiple = true;
    input.addEventListener('change', () => {
      handleFiles(input.files);
    });
    input.click();
  });
}
// Global network error handler & fetch wrapper (v5.3)
(function () {
  let efErrorBanner = null;

  function showNetworkError(message) {
    try {
      if (!efErrorBanner) {
        efErrorBanner = document.createElement('div');
        efErrorBanner.id = 'ef-network-error';
        efErrorBanner.style.position = 'fixed';
        efErrorBanner.style.bottom = '1rem';
        efErrorBanner.style.left = '50%';
        efErrorBanner.style.transform = 'translateX(-50%)';
        efErrorBanner.style.padding = '0.75rem 1.25rem';
        efErrorBanner.style.background = '#b00020';
        efErrorBanner.style.color = '#fff';
        efErrorBanner.style.borderRadius = '999px';
        efErrorBanner.style.boxShadow = '0 4px 12px rgba(0,0,0,0.25)';
        efErrorBanner.style.fontSize = '0.875rem';
        efErrorBanner.style.zIndex = '9999';
        efErrorBanner.style.transition = 'opacity 0.25s ease-out';
        efErrorBanner.style.opacity = '0';
        document.body.appendChild(efErrorBanner);
      }
      efErrorBanner.textContent =
        message || 'Could not reach EventFlow. Please check your connection and try again.';
      efErrorBanner.style.opacity = '1';
      clearTimeout(efErrorBanner._hideTimer);
      efErrorBanner._hideTimer = setTimeout(() => {
        efErrorBanner.style.opacity = '0';
      }, 5000);
    } catch (_) {
      /* Ignore banner display errors */
    }
  }

  if (typeof window !== 'undefined' && window.fetch) {
    const realFetch = window.fetch.bind(window);
    window.fetch = function () {
      return realFetch.apply(this, arguments).catch(err => {
        showNetworkError();
        throw err;
      });
    };
  }
})();

const LS_PLAN_LOCAL = 'eventflow_local_plan';
function lsGet() {
  try {
    return JSON.parse(localStorage.getItem(LS_PLAN_LOCAL) || '[]');
  } catch (_) {
    return [];
  }
}
function lsSet(a) {
  localStorage.setItem(LS_PLAN_LOCAL, JSON.stringify(a || []));
}
function addLocal(id) {
  const p = lsGet();
  if (!p.includes(id)) {
    p.push(id);
    lsSet(p);
  }
}
function removeLocal(id) {
  lsSet(lsGet().filter(x => x !== id));
}

async function me() {
  try {
    const r = await fetch('/api/auth/me');
    return (await r.json()).user;
  } catch (_) {
    return null;
  }
}
async function listSuppliers(params = {}) {
  const q = new URLSearchParams(params).toString();
  const r = await fetch(`/api/suppliers${q ? `?${q}` : ''}`);
  const d = await r.json();
  return d.items || [];
}

function supplierCard(s, user) {
  const img = (s.photos && s.photos[0]) || '/assets/images/collage-venue.svg';
  const showAddAccount = !!user && user.role === 'customer';
  const alreadyLocal = lsGet().includes(s.id);
  const addBtn = showAddAccount
    ? `<button class="cta" data-add="${s.id}">Add to my plan</button>`
    : `<button class="cta" data-add-local="${s.id}" ${alreadyLocal ? 'disabled' : ''}>${alreadyLocal ? 'Added' : 'Add to my plan'}</button>`;

  const tags = [];
  if (s.maxGuests && s.maxGuests > 0) {
    tags.push(`<span class="badge">Up to ${s.maxGuests} guests</span>`);
  }
  if (Array.isArray(s.amenities)) {
    s.amenities.slice(0, 3).forEach(a => {
      tags.push(
        `<span class="badge clickable-tag" data-amenity="${a}" style="cursor:pointer;" title="Click to filter by ${a}">${a}</span>`
      );
    });
  }
  if (s.featuredSupplier) {
    tags.unshift('<span class="badge">Featured</span>');
  }

  // Enhanced badge rendering for Pro and Pro+ tiers
  let proBadge = '';
  if (s.subscription && s.subscription.tier) {
    const tier = s.subscription.tier;
    if (tier === 'pro') {
      proBadge = '<span class="supplier-badge pro">Pro</span>';
    } else if (tier === 'pro_plus') {
      proBadge = '<span class="supplier-badge pro_plus">Pro+</span>';
    }
  } else if (s.isPro || s.pro) {
    // Legacy support
    proBadge = '<span class="pro-badge"><span>Pro supplier</span></span>';
  }

  return `<div class="card supplier-card">
    <img src="${img}" alt="${s.name} image"><div>
      <h3>${s.name} ${proBadge}</h3>
      <div class="small">${s.location || ''} · <span class="badge">${s.category}</span> ${s.price_display ? `· ${s.price_display}` : ''}</div>
      <p class="small">${s.description_short || ''}</p>
      <div class="small" style="margin-top:4px">${tags.join(' ')}</div>
      <div class="form-actions">${addBtn}<a class="cta secondary" href="/supplier.html?id=${encodeURIComponent(s.id)}">View details</a></div>
    </div></div>`;
}

async function initHome() {
  const wrap = document.getElementById('featured-packages');
  if (!wrap) {
    return;
  }
  const r = await fetch('/api/packages/featured');
  const d = await r.json();
  const items = d.items || [];
  wrap.innerHTML = items.length
    ? items
        .map(
          p => `<div class="card pack">
    <img src="${p.image}" alt="${p.title} image">
    <div class="pack-info">
      <h3>${p.title}</h3>
      <div class="small"><span class="badge">${p.price}</span></div>
      <p class="small">Supplier: <a href="/supplier.html?id=${encodeURIComponent(p.supplierId)}">${p.supplierId.slice(0, 8)}</a></p>
    </div>
  </div>`
        )
        .join('')
    : `<div class="card"><p class="small">No featured packages yet.</p></div>`;
}

async function initResults() {
  const user = await me();
  const container = document.getElementById('results');
  const count = document.getElementById('resultCount');
  const contextEl = document.getElementById('results-context');
  const filterCategoryEl = document.getElementById('filterCategory');
  const filterPriceEl = document.getElementById('filterPrice');
  const filterQueryEl = document.getElementById('filterQuery');
  const filters = { category: '', price: '', q: '' };

  const params = new URLSearchParams(location.search || '');
  const qp = params.get('q') || '';
  if (qp) {
    filters.q = qp;
    if (filterQueryEl) {
      filterQueryEl.value = qp;
    }
  }

  // Optional context from the last Start step
  if (contextEl) {
    try {
      const raw = localStorage.getItem('eventflow_start');
      if (raw) {
        const data = JSON.parse(raw);
        const bits = [];
        if (data.type) {
          bits.push(data.type);
        }
        if (data.location) {
          bits.push(data.location);
        }
        if (typeof data.guests === 'number' && data.guests > 0) {
          bits.push(`${data.guests} guests`);
        }
        if (data.budget) {
          bits.push(data.budget);
        }
        contextEl.textContent = bits.length ? `Based on your last event: ${bits.join(' • ')}` : '';
      }
    } catch (_e) {
      // ignore
    }
  }

  async function render() {
    const items = await listSuppliers(filters);
    if (count) {
      count.textContent = `${items.length} supplier${items.length === 1 ? '' : 's'} found`;
    }
    if (!items.length) {
      container.innerHTML =
        '<div class="card"><p>No suppliers match your search yet. Try clearing filters, searching by town or city, or starting again from the <a href="/start.html">Start page</a>.</p></div>';
      return;
    }
    container.innerHTML = items.map(s => supplierCard(s, user)).join('');
    container.querySelectorAll('[data-add]').forEach(btn => {
      btn.addEventListener('click', async () => {
        const id = btn.getAttribute('data-add');
        const r = await fetch('/api/plan', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ supplierId: id }),
        });
        if (!r.ok) {
          alert('Sign in as a customer to save to your account.');
          return;
        }
        btn.textContent = 'Added';
        btn.disabled = true;
      });
    });
    container.querySelectorAll('[data-add-local]').forEach(btn => {
      btn.addEventListener('click', () => {
        addLocal(btn.getAttribute('data-add-local'));
        btn.textContent = 'Added';
        btn.disabled = true;
      });
    });
    // Make amenity tags clickable for filtering
    container.querySelectorAll('.clickable-tag[data-amenity]').forEach(tag => {
      tag.addEventListener('click', () => {
        const amenity = tag.getAttribute('data-amenity');
        if (amenity && filterQueryEl) {
          filterQueryEl.value = amenity;
          filters.q = amenity;
          render();
          // Scroll to top to see results
          window.scrollTo({ top: 0, behavior: 'smooth' });
        }
      });
    });
  }

  if (filterCategoryEl) {
    filterCategoryEl.addEventListener('change', e => {
      filters.category = e.target.value || '';
      render();
    });
  }
  if (filterPriceEl) {
    filterPriceEl.addEventListener('change', e => {
      filters.price = e.target.value || '';
      render();
    });
  }
  if (filterQueryEl) {
    filterQueryEl.addEventListener('input', e => {
      filters.q = e.target.value || '';
      render();
    });
  }

  // Quick category shortcuts
  document.querySelectorAll('[data-quick-category]').forEach(btn => {
    btn.addEventListener('click', () => {
      const cat = btn.getAttribute('data-quick-category') || '';
      filters.category = cat;
      if (filterCategoryEl) {
        filterCategoryEl.value = cat;
      }
      render();
    });
  });

  render();
}

async function initSupplier() {
  const user = await me();
  const params = new URLSearchParams(location.search);
  const id = params.get('id');
  const r = await fetch(`/api/suppliers/${encodeURIComponent(id)}`);
  if (!r.ok) {
    const c = document.getElementById('supplier-container');
    if (c) {
      c.innerHTML = '<div class="card"><p>Not found.</p></div>';
    }
    return;
  }
  const s = await r.json();
  const pkgs = await (await fetch(`/api/suppliers/${encodeURIComponent(id)}/packages`)).json();
  const img = (s.photos && s.photos[0]) || '/assets/images/hero-venue.svg';
  const gallery = (s.photos || [])
    .slice(1)
    .map(u => `<img loading="lazy" src="${u}" alt="${s.name}">`)
    .join('');
  const facts = `<div class="small">${s.website ? `<a href="${s.website}" target="_blank" rel="noopener">${s.website}</a> · ` : ''}${s.phone || ''} ${s.license || ''} ${s.maxGuests ? `· Max ${s.maxGuests} guests` : ''}</div>`;
  const amenities = (s.amenities || []).map(a => `<span class="badge">${a}</span>`).join(' ');
  const packagesHtml =
    (pkgs.items || [])
      .map(
        p => `
    <div class="card pack">
      <img src="${p.image}" alt="${p.title} image">
      <div>
        <h3>${p.title}</h3>
        <div class="small"><span class="badge">${p.price_display || ''}</span></div>
        <p class="small">${p.description || ''}</p>
      </div>
    </div>`
      )
      .join('') || `<div class="card"><p class="small">No approved packages yet.</p></div>`;

  // Enhanced badge rendering for Pro and Pro+ tiers
  let proBadge = '';
  if (s.subscription && s.subscription.tier) {
    const tier = s.subscription.tier;
    if (tier === 'pro') {
      proBadge = '<span class="supplier-badge pro">Pro</span>';
    } else if (tier === 'pro_plus') {
      proBadge = '<span class="supplier-badge pro_plus">Pro+</span>';
    }
  } else if (s.isPro || s.pro) {
    // Legacy support
    proBadge = '<span class="pro-badge"><span>Pro supplier</span></span>';
  }

  document.getElementById('supplier-container').innerHTML = `
    <div class="card"><div class="supplier-card">
      <img src="${img}" alt="${s.name} image"><div>
        <h1>${s.name} ${proBadge}</h1><div class="small">${s.location || ''} · <span class="badge">${s.category}</span> ${s.price_display ? `· ${s.price_display}` : ''}</div>
        ${facts}
        <div class="small" style="margin-top:8px">${amenities}</div>
        <p style="margin-top:8px">${s.description_long || s.description_short || ''}</p>
        <div class="form-actions" style="margin-top:8px">
          <button class="cta" id="add">Add to my plan</button>
          <button class="cta secondary" id="start-thread">Start conversation</button>
        </div>
      </div></div></div>
    <section class="section"><h2>Gallery</h2><div class="cards">${gallery || '<div class="card"><p class="small">No photos yet.</p></div>'}</div></section>
    <section class="section"><h2>Packages</h2><div class="cards">${packagesHtml}</div></section>
  `;

  const addBtn = document.getElementById('add');
  if (addBtn) {
    // Check if supplier is already in plan
    let isInPlan = false;

    if (user && user.role === 'customer') {
      // For authenticated users, check server-side plan
      try {
        const planResp = await fetch('/api/plan');
        if (planResp.ok) {
          const planData = await planResp.json();
          isInPlan = (planData.items || []).some(item => item.id === s.id);
        } else {
          console.error('Failed to load plan status:', planResp.status);
          // Continue with isInPlan = false as default
        }
      } catch (e) {
        console.error('Error checking plan:', e);
        // Continue with isInPlan = false as default
      }
    } else {
      // For non-authenticated users, check localStorage
      const ls = lsGet();
      isInPlan = ls.includes(s.id);
    }

    if (isInPlan) {
      addBtn.textContent = 'Remove from plan';
      addBtn.classList.add('secondary');
      addBtn.dataset.inPlan = 'true';
    } else {
      addBtn.dataset.inPlan = 'false';
    }

    addBtn.addEventListener('click', async () => {
      if (!user || user.role !== 'customer') {
        alert('Create a customer account and sign in to add suppliers to your plan.');
        return;
      }

      // For authenticated users, use server-side API
      const currentlyInPlan = addBtn.dataset.inPlan === 'true';

      if (currentlyInPlan) {
        // Remove from plan
        try {
          const r = await fetch(`/api/plan/${encodeURIComponent(s.id)}`, {
            method: 'DELETE',
          });
          if (r.ok) {
            addBtn.textContent = 'Add to my plan';
            addBtn.classList.remove('secondary');
            addBtn.dataset.inPlan = 'false';
          } else {
            alert('Failed to remove from plan. Please try again.');
          }
        } catch (e) {
          console.error('Error removing from plan:', e);
          alert('Failed to remove from plan. Please try again.');
        }
      } else {
        // Add to plan
        try {
          const r = await fetch('/api/plan', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ supplierId: s.id }),
          });
          if (r.ok) {
            addBtn.textContent = 'Remove from plan';
            addBtn.classList.add('secondary');
            addBtn.dataset.inPlan = 'true';
          } else {
            alert('Failed to add to plan. Please try again.');
          }
        } catch (e) {
          console.error('Error adding to plan:', e);
          alert('Failed to add to plan. Please try again.');
        }
      }
    });
  }

  const startThreadBtn = document.getElementById('start-thread');
  if (startThreadBtn) {
    startThreadBtn.addEventListener('click', async () => {
      if (!user) {
        alert('You need an account to contact suppliers. Please sign in or create an account.');
        return;
      }
      const modal = document.createElement('div');
      modal.className = 'modal-backdrop';
      modal.innerHTML = `
        <div class="modal">
          <h2>Send an enquiry</h2>
          <p class="small">Tell this supplier a bit about your event. They will reply via your EventFlow messages.</p>
          <textarea id="thread-message" rows="4" placeholder="Hi! We are planning an event on [DATE] for around [GUESTS] guests at [LOCATION]. Are you available, and could you share your pricing or packages?"></textarea>
          <div class="form-actions">
            <button class="cta" id="send-thread">Send message</button>
            <button class="cta secondary" id="cancel-thread">Cancel</button>
          </div>
        </div>
      `;
      document.body.appendChild(modal);

      modal.querySelector('#cancel-thread').addEventListener('click', () => modal.remove());

      modal.querySelector('#send-thread').addEventListener('click', async () => {
        const msg = (modal.querySelector('#thread-message').value || '').trim();
        if (!msg) {
          return;
        }
        const payload = { supplierId: s.id, text: msg };
        const r = await fetch('/api/threads', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        });
        let d = {};
        try {
          d = await r.json();
        } catch (_) {
          /* Ignore JSON parse errors */
        }
        if (!r.ok) {
          alert((d && d.error) || 'Could not start conversation');
          return;
        }

        modal.remove();
        if (d && d.thread && d.thread.id && typeof openThread === 'function') {
          openThread(d.thread.id);
        } else {
          alert('Enquiry sent. Visit your dashboard to continue the conversation.');
        }
      });
    });
  }
}

async function initPlan() {
  const user = await me();
  const container = document.getElementById('plan-list');
  const budgetEl = document.getElementById('plan-budget');
  const notesEl = document.getElementById('plan-notes');
  const saveBtn = document.getElementById('save-notes');
  const status = document.getElementById('notes-status');
  const cloud = document.getElementById('cloud-status');
  const eventSummary = document.getElementById('event-summary-body');

  const PLAN_KEY = 'eventflow_plan_v2';

  function loadLocalPlan() {
    try {
      const raw = localStorage.getItem(PLAN_KEY);
      if (!raw) {
        return { version: 2, guests: [], tasks: [], timeline: [], notes: '' };
      }
      const obj = JSON.parse(raw);
      return Object.assign(
        { version: 2, guests: [], tasks: [], timeline: [], notes: '' },
        obj || {}
      );
    } catch (_e) {
      return { version: 2, guests: [], tasks: [], timeline: [], notes: '' };
    }
  }
  function saveLocalPlan(plan) {
    localStorage.setItem(PLAN_KEY, JSON.stringify(plan));
  }

  const plan = loadLocalPlan();

  // --- Event summary from start page (local only) ---
  if (eventSummary) {
    try {
      const raw = localStorage.getItem('eventflow_start');
      if (raw) {
        const data = JSON.parse(raw);
        const bits = [];
        if (data.type) {
          bits.push(data.type);
        }
        if (data.date) {
          bits.push(data.date);
        }
        if (data.location) {
          bits.push(data.location);
        }
        if (data.guests) {
          bits.push(`${data.guests} guests`);
        }
        eventSummary.textContent = bits.length
          ? bits.join(' · ')
          : 'Tell us about your event to see a quick summary here.';
      } else {
        eventSummary.textContent = 'Tell us about your event to see a quick summary here.';
      }
    } catch (_e) {
      eventSummary.textContent = 'Tell us about your event to see a quick summary here.';
    }
  }

  // --- Load suppliers currently in the plan (server-side) ---
  let items = [];

  if (container) {
    container.innerHTML = '<div class="card"><p>Loading your plan...</p></div>';
  }

  // For authenticated users, always fetch from server
  if (user && user.role === 'customer') {
    try {
      const r = await fetch('/api/plan');
      if (r.ok) {
        const d = await r.json();
        items = d.items || [];
      } else {
        console.error('Failed to load plan:', r.status);
        if (container) {
          container.innerHTML =
            '<div class="card"><p>Error loading your plan. Please refresh the page.</p></div>';
        }
        return;
      }
    } catch (e) {
      console.error('Error loading plan:', e);
      if (container) {
        container.innerHTML =
          '<div class="card"><p>Error loading your plan. Please refresh the page.</p></div>';
      }
      return;
    }
  } else {
    // For non-authenticated users, show message to sign in
    if (container) {
      container.innerHTML =
        '<div class="card"><p>Sign in to a customer account to save and manage your plan.</p></div>';
    }
    return;
  }

  if (container) {
    if (!items.length) {
      container.innerHTML =
        '<div class="card"><p>Your plan is currently empty. Add suppliers from the Suppliers page to build it.</p></div>';
    } else {
      container.innerHTML = items.map(s => supplierCard(s, user)).join('');
    }
  }

  // --- AI event planning assistant (optional, uses OpenAI if configured) ---
  try {
    const aiInput = document.getElementById('ai-plan-input');
    const aiRun = document.getElementById('ai-plan-run');
    const aiOut = document.getElementById('ai-plan-output');
    const aiUseCurrent = document.getElementById('ai-plan-use-current');

    if (aiRun && aiOut) {
      aiRun.addEventListener('click', async () => {
        const promptText = ((aiInput && aiInput.value) || '').trim();
        if (!promptText && !(aiUseCurrent && aiUseCurrent.checked)) {
          if (aiInput) {
            aiInput.focus();
          }
          return;
        }

        const summaryBits = [];
        if (plan && typeof plan === 'object') {
          if (Array.isArray(plan.guests) && plan.guests.length) {
            summaryBits.push(`${plan.guests.length} guests in the guest list`);
          }
          if (Array.isArray(plan.tasks) && plan.tasks.length) {
            summaryBits.push(`${plan.tasks.length} planning tasks`);
          }
          if (Array.isArray(plan.timeline) && plan.timeline.length) {
            summaryBits.push(`${plan.timeline.length} timeline items`);
          }
          if (Array.isArray(plan.budgetItems) && plan.budgetItems.length) {
            summaryBits.push(`${plan.budgetItems.length} budget lines`);
          }
        }

        let finalPrompt = promptText;
        if (aiUseCurrent && aiUseCurrent.checked) {
          finalPrompt += `\n\nHere is my current plan data summary: ${
            summaryBits.join(' • ') || 'No extra details yet.'
          }`;
        }

        aiOut.innerHTML = '<p class="small">Thinking about your event…</p>';

        try {
          const r = await fetch('/api/ai/plan', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ prompt: finalPrompt, plan }),
          });
          if (!r.ok) {
            aiOut.innerHTML =
              '<p class="small">Sorry, something went wrong while generating suggestions.</p>';
            return;
          }
          const payload = await r.json();
          const data = (payload && payload.data) || {};
          const checklist = Array.isArray(data.checklist) ? data.checklist : [];
          const timeline = Array.isArray(data.timeline) ? data.timeline : [];
          const suppliers = Array.isArray(data.suppliers) ? data.suppliers : [];
          const budget = Array.isArray(data.budget) ? data.budget : [];
          const styleIdeas = Array.isArray(data.styleIdeas) ? data.styleIdeas : [];
          const messages = Array.isArray(data.messages) ? data.messages : [];

          let html = '';
          if (checklist.length) {
            html += `<h4>Suggested checklist</h4><ul>${checklist
              .map(t => `<li>${escapeHtml(String(t))}</li>`)
              .join('')}</ul>`;
          }
          if (timeline.length) {
            html += `<h4>Sample timeline</h4><ul>${timeline
              .map(
                row =>
                  `<li><strong>${escapeHtml(String(row.time || ''))}</strong> – ${escapeHtml(
                    String(row.item || '')
                  )}${
                    row.owner
                      ? ` <span class="small">(${escapeHtml(String(row.owner))})</span>`
                      : ''
                  }</li>`
              )
              .join('')}</ul>`;
          }
          if (suppliers.length) {
            html += `<h4>Supplier tips</h4><ul>${suppliers
              .map(
                row =>
                  `<li><strong>${escapeHtml(
                    String(row.category || 'Supplier')
                  )}:</strong> ${escapeHtml(String(row.suggestion || ''))}</li>`
              )
              .join('')}</ul>`;
          }
          if (budget.length) {
            html += `<h4>Budget breakdown</h4><ul>${budget
              .map(
                row =>
                  `<li><strong>${escapeHtml(String(row.item || 'Item'))}:</strong> ${escapeHtml(
                    String(row.estimate || '')
                  )}</li>`
              )
              .join('')}</ul>`;
          }
          if (styleIdeas.length) {
            html += `<h4>Style &amp; theme ideas</h4><ul>${styleIdeas
              .map(t => `<li>${escapeHtml(String(t))}</li>`)
              .join('')}</ul>`;
          }
          if (messages.length) {
            html += `<h4>Messages to suppliers</h4><ul>${messages
              .map(t => `<li>${escapeHtml(String(t))}</li>`)
              .join('')}</ul>`;
          }

          if (!html) {
            html =
              '<p class="small">AI did not return any structured suggestions. Try adding a bit more detail to your description.</p>';
          }
          aiOut.innerHTML = html;
        } catch (err) {
          console.error('AI planning error', err);
          aiOut.innerHTML =
            '<p class="small">Sorry, something went wrong while generating suggestions.</p>';
        }
      });
    }
  } catch (_e) {
    // If anything fails, we just keep the page working without AI.
  }

  // --- Budget tracker (manual, but seeded with supplier count) ---
  if (budgetEl) {
    const totalSuppliers = items.length;
    let est = '';
    if (totalSuppliers === 0) {
      est =
        'No suppliers added yet. Once you add venues, catering and more, you can track budget here.';
    } else if (totalSuppliers === 1) {
      est =
        'You have 1 supplier in your plan. Use this section to keep track of quotes and payments.';
    } else {
      est = `You have ${totalSuppliers} suppliers in your plan. Use this section to track quotes and payments.`;
    }
    const budgetItems = plan.budgetItems || [];
    budgetEl.innerHTML = `
      <p class="small">${est}</p>
      <div class="plan-list-block">
        ${
          budgetItems.length
            ? `
          <table>
            <thead><tr><th>Item</th><th>Estimate</th><th>Actual</th><th>Notes</th><th></th></tr></thead>
            <tbody>
              ${budgetItems
                .map(
                  row => `
                <tr data-id="${row.id}">
                  <td>${escapeHtml(row.label || '')}</td>
                  <td>${escapeHtml(row.estimate || '')}</td>
                  <td>${escapeHtml(row.actual || '')}</td>
                  <td>${escapeHtml(row.notes || '')}</td>
                  <td><button class="link-button" data-remove-budget="${row.id}">Remove</button></td>
                </tr>
              `
                )
                .join('')}
            </tbody>
          </table>
        `
            : `<p class="plan-list-empty">Add your first budget line below — for example “Venue”, “Catering” or “Photography”.</p>`
        }
      </div>
      <div class="form-row plan-inline-fields">
        <input id="budget-label" type="text" placeholder="Item, e.g. Venue hire">
        <input id="budget-estimate" type="text" placeholder="Estimate, e.g. £2,000">
        <input id="budget-actual" type="text" placeholder="Actual (optional)">
        <input id="budget-notes" type="text" placeholder="Notes (optional)">
        <button class="cta secondary" id="add-budget" type="button">Add line</button>
      </div>
    `;
    const addBudget = document.getElementById('add-budget');
    if (addBudget) {
      addBudget.addEventListener('click', () => {
        const label = (document.getElementById('budget-label').value || '').trim();
        const estimate = (document.getElementById('budget-estimate').value || '').trim();
        const actual = (document.getElementById('budget-actual').value || '').trim();
        const notesVal = (document.getElementById('budget-notes').value || '').trim();
        if (!label && !estimate) {
          return;
        }
        const row = {
          id: `b_${Date.now().toString(36)}`,
          label,
          estimate,
          actual,
          notes: notesVal,
        };
        if (!plan.budgetItems) {
          plan.budgetItems = [];
        }
        plan.budgetItems.push(row);
        saveLocalPlan(plan);
        initPlan(); // simple re-render
      });
    }
    budgetEl.querySelectorAll('[data-remove-budget]').forEach(btn => {
      btn.addEventListener('click', () => {
        const id = btn.getAttribute('data-remove-budget');
        plan.budgetItems = (plan.budgetItems || []).filter(r => r.id !== id);
        saveLocalPlan(plan);
        initPlan();
      });
    });
  }

  // --- Render guests / tasks / timeline ---
  function renderGuests() {
    const host = document.getElementById('plan-guests');
    if (!host) {
      return;
    }
    const guests = plan.guests || [];
    if (!guests.length) {
      host.innerHTML =
        '<p class="plan-list-empty">No guests added yet. Start by adding your VIPs (wedding party, parents, etc.).</p>';
      return;
    }
    host.innerHTML = `
      <div class="plan-list-block">
        <table>
          <thead><tr><th>Name</th><th>Role / side</th><th>Notes</th><th></th></tr></thead>
          <tbody>
            ${guests
              .map(
                g => `
              <tr data-id="${g.id}">
                <td>${escapeHtml(g.name || '')}</td>
                <td>${escapeHtml(g.role || '')}</td>
                <td>${escapeHtml(g.notes || '')}</td>
                <td><button class="link-button" data-remove-guest="${g.id}">Remove</button></td>
              </tr>
            `
              )
              .join('')}
          </tbody>
        </table>
      </div>
    `;
    host.querySelectorAll('[data-remove-guest]').forEach(btn => {
      btn.addEventListener('click', () => {
        const id = btn.getAttribute('data-remove-guest');
        plan.guests = (plan.guests || []).filter(g => g.id !== id);
        saveLocalPlan(plan);
        renderGuests();
        updateProgress();
      });
    });
  }

  function renderTasks() {
    const host = document.getElementById('plan-tasks');
    if (!host) {
      return;
    }
    const tasks = plan.tasks || [];
    if (!tasks.length) {
      host.innerHTML = '<p class="plan-list-empty">No tasks yet. Add your first one below.</p>';
      return;
    }
    host.innerHTML = `
      <div class="plan-list-block">
        <table>
          <thead><tr><th>Done</th><th>Task</th><th>Due</th><th></th></tr></thead>
          <tbody>
            ${tasks
              .map(
                t => `
              <tr data-id="${t.id}">
                <td><input type="checkbox" data-toggle-task="${t.id}" ${t.done ? 'checked' : ''}></td>
                <td>${escapeHtml(t.label || '')}</td>
                <td>${escapeHtml(t.due || '')}</td>
                <td><button class="link-button" data-remove-task="${t.id}">Remove</button></td>
              </tr>
            `
              )
              .join('')}
          </tbody>
        </table>
      </div>
    `;
    host.querySelectorAll('[data-toggle-task]').forEach(box => {
      box.addEventListener('change', () => {
        const id = box.getAttribute('data-toggle-task');
        const tasksArr = plan.tasks || [];
        const t = tasksArr.find(x => x.id === id);
        if (t) {
          t.done = !!box.checked;
        }
        plan.tasks = tasksArr;
        saveLocalPlan(plan);
        updateProgress();
      });
    });
    host.querySelectorAll('[data-remove-task]').forEach(btn => {
      btn.addEventListener('click', () => {
        const id = btn.getAttribute('data-remove-task');
        plan.tasks = (plan.tasks || []).filter(t => t.id !== id);
        saveLocalPlan(plan);
        renderTasks();
        updateProgress();
      });
    });
  }

  function renderTimeline() {
    const host = document.getElementById('plan-timeline');
    if (!host) {
      return;
    }
    const timeline = plan.timeline || [];
    if (!timeline.length) {
      host.innerHTML =
        '<p class="plan-list-empty">No timeline items yet. Add key parts of the day below.</p>';
      return;
    }
    host.innerHTML = `
      <div class="plan-list-block">
        <table>
          <thead><tr><th>Time</th><th>What happens</th><th>Who</th><th></th></tr></thead>
          <tbody>
            ${timeline
              .map(
                t => `
              <tr data-id="${t.id}">
                <td>${escapeHtml(t.time || '')}</td>
                <td>${escapeHtml(t.item || '')}</td>
                <td>${escapeHtml(t.owner || '')}</td>
                <td><button class="link-button" data-remove-timeline="${t.id}">Remove</button></td>
              </tr>
            `
              )
              .join('')}
          </tbody>
        </table>
      </div>
    `;
    host.querySelectorAll('[data-remove-timeline]').forEach(btn => {
      btn.addEventListener('click', () => {
        const id = btn.getAttribute('data-remove-timeline');
        plan.timeline = (plan.timeline || []).filter(t => t.id !== id);
        saveLocalPlan(plan);
        renderTimeline();
      });
    });
  }

  function updateProgress() {
    const wrap = document.getElementById('plan-progress-wrap');
    const percentEl = document.getElementById('plan-progress-percent');
    const breakdownEl = document.getElementById('plan-progress-breakdown');
    if (!wrap || !percentEl || !breakdownEl) {
      return;
    }

    const totalTasks = (plan.tasks || []).length;
    const doneTasks = (plan.tasks || []).filter(t => t.done).length;
    const hasGuests = (plan.guests || []).length > 0;
    const hasTimeline = (plan.timeline || []).length > 0;
    const hasSuppliers = items.length > 0;

    let score = 0;
    const max = 4;
    if (hasSuppliers) {
      score++;
    }
    if (hasGuests) {
      score++;
    }
    if (hasTimeline) {
      score++;
    }
    if (totalTasks && doneTasks === totalTasks) {
      score++;
    }

    const percent = Math.round((score / max) * 100);
    percentEl.textContent = `${percent}% complete`;

    const bits = [];
    bits.push(hasSuppliers ? '✓ At least one supplier added' : '• Add at least one supplier');
    bits.push(hasGuests ? '✓ Guest list started' : '• Start your guest list');
    bits.push(hasTimeline ? '✓ Timeline started' : '• Add key parts of your day');
    if (totalTasks) {
      bits.push(`• Tasks: ${doneTasks}/${totalTasks} complete`);
    } else {
      bits.push('• Add your first checklist task');
    }
    breakdownEl.innerHTML = bits.map(b => `<div>${escapeHtml(b)}</div>`).join('');
    wrap.style.display = 'block';
  }

  // Initial render from local plan
  renderGuests();
  renderTasks();
  renderTimeline();
  updateProgress();

  // Wire up add buttons
  const addGuest = document.getElementById('add-guest');
  if (addGuest) {
    addGuest.addEventListener('click', () => {
      const name = (document.getElementById('guest-name').value || '').trim();
      const side = (document.getElementById('guest-side').value || '').trim();
      const notesVal = (document.getElementById('guest-notes').value || '').trim();
      if (!name) {
        return;
      }
      const g = { id: `g_${Date.now().toString(36)}`, name, role: side, notes: notesVal };
      if (!plan.guests) {
        plan.guests = [];
      }
      plan.guests.push(g);
      saveLocalPlan(plan);
      document.getElementById('guest-name').value = '';
      document.getElementById('guest-side').value = '';
      document.getElementById('guest-notes').value = '';
      renderGuests();
      updateProgress();
    });
  }

  const addTask = document.getElementById('add-task');
  if (addTask) {
    addTask.addEventListener('click', () => {
      const label = (document.getElementById('task-label').value || '').trim();
      const due = (document.getElementById('task-due').value || '').trim();
      if (!label) {
        return;
      }
      const t = { id: `t_${Date.now().toString(36)}`, label, due, done: false };
      if (!plan.tasks) {
        plan.tasks = [];
      }
      plan.tasks.push(t);
      saveLocalPlan(plan);
      document.getElementById('task-label').value = '';
      document.getElementById('task-due').value = '';
      renderTasks();
      updateProgress();
    });
  }

  const addTimeline = document.getElementById('add-timeline');
  if (addTimeline) {
    addTimeline.addEventListener('click', () => {
      const time = (document.getElementById('timeline-time').value || '').trim();
      const item = (document.getElementById('timeline-item').value || '').trim();
      const owner = (document.getElementById('timeline-owner').value || '').trim();
      if (!time && !item) {
        return;
      }
      const t = { id: `tl_${Date.now().toString(36)}`, time, item, owner };
      if (!plan.timeline) {
        plan.timeline = [];
      }
      plan.timeline.push(t);
      saveLocalPlan(plan);
      document.getElementById('timeline-time').value = '';
      document.getElementById('timeline-item').value = '';
      document.getElementById('timeline-owner').value = '';
      renderTimeline();
      updateProgress();
    });
  }

  // Notes are part of the same local plan object
  if (notesEl) {
    if (plan.notes) {
      notesEl.value = plan.notes;
    }
    notesEl.addEventListener('input', () => {
      plan.notes = notesEl.value;
      saveLocalPlan(plan);
      if (status) {
        status.textContent = 'Saved';
      }
      if (cloud) {
        cloud.textContent = 'Saved locally';
      }
      if (status) {
        setTimeout(() => {
          status.textContent = '';
        }, 1200);
      }
    });
  }

  if (saveBtn) {
    saveBtn.addEventListener('click', () => {
      plan.notes = notesEl ? notesEl.value : '';
      saveLocalPlan(plan);
      if (status) {
        status.textContent = 'Saved';
      }
      if (cloud) {
        cloud.textContent = 'Saved locally';
      }
      if (status) {
        setTimeout(() => {
          status.textContent = '';
        }, 1200);
      }
    });
  }
}

async function renderThreads(targetEl) {
  const host = document.getElementById(targetEl);
  if (!host) {
    return;
  }

  let user = null;
  try {
    user = await me();
  } catch (_e) {
    /* Ignore user fetch errors */
  }
  if (!user) {
    host.innerHTML = '<p class="small">Sign in to see your conversations.</p>';
    return;
  }

  try {
    const r = await fetch('/api/threads/my');
    if (!r.ok) {
      host.innerHTML = '<p class="small">Could not load conversations.</p>';
      return;
    }
    const d = await r.json();
    const items = (d.items || [])
      .slice()
      .sort((a, b) => (b.updatedAt || '').localeCompare(a.updatedAt || ''));

    if (!items.length) {
      host.innerHTML =
        '<p class="small">No conversations yet. Once you contact suppliers, they’ll appear here.</p>';
      return;
    }

    host.innerHTML = `
      <div class="thread-list">
        ${items
          .map(t => {
            const otherName = t.supplierName || t.customerName || 'Conversation';
            const last = (t.lastMessageText || '').slice(0, 80);
            const when = t.updatedAt ? new Date(t.updatedAt).toLocaleString() : '';
            return `
            <button class="thread-row" type="button" data-open="${t.id}">
              <div class="thread-row-main">
                <span class="thread-row-title">${escapeHtml(otherName)}</span>
                <span class="thread-row-snippet">${escapeHtml(last || 'No messages yet.')}</span>
              </div>
              <div class="thread-row-meta">
                ${escapeHtml(when)}
              </div>
            </button>
          `;
          })
          .join('')}
      </div>
    `;

    host.querySelectorAll('[data-open]').forEach(btn => {
      btn.addEventListener('click', () => {
        const id = btn.getAttribute('data-open');
        openThread(id);
      });
    });
  } catch (_e) {
    host.innerHTML = '<p class="small">Could not load conversations.</p>';
  }
}

let efThreadPoll = null;

async function openThread(id) {
  const user = await me().catch(() => null);
  if (!id) {
    return;
  }

  if (efThreadPoll) {
    clearInterval(efThreadPoll);
    efThreadPoll = null;
  }

  const modal = document.createElement('div');
  modal.className = 'chat-modal-backdrop';
  modal.innerHTML = `
    <div class="chat-modal" role="dialog" aria-modal="true">
      <header>
        <div>
          <h3>Conversation</h3>
          <div class="small">Share details, updates and questions with this supplier.</div>
        </div>
        <button class="cta secondary" type="button" data-close>Close</button>
      </header>
      <div class="chat-messages" id="thread-messages"><p class="small">Loading…</p></div>
      <div class="chat-input">
        <form id="thread-form">
          <div class="chat-input-row">
            <textarea id="thread-text" placeholder="Write a message…"></textarea>
            <div class="chat-input-actions">
              <button class="cta" type="submit">Send</button>
            </div>
          </div>
          <div class="chat-status small" id="thread-status"></div>
          <p class="tiny" style="opacity:0.7;margin-top:4px">
            Tip: you can paste links to files (Google Drive, Dropbox etc.) as attachments.
          </p>
        </form>
      </div>
    </div>
  `;
  document.body.appendChild(modal);

  const box = modal.querySelector('#thread-messages');
  const form = modal.querySelector('#thread-form');
  const input = modal.querySelector('#thread-text');
  const status = modal.querySelector('#thread-status');

  async function load(scroll) {
    try {
      const r = await fetch(`/api/threads/${encodeURIComponent(id)}/messages`);
      if (!r.ok) {
        box.innerHTML = '<p class="small">Could not load messages.</p>';
        return;
      }
      const d = await r.json();
      const msgs = d.items || [];
      if (!msgs.length) {
        box.innerHTML = '<p class="small">No messages yet. Say hello to get things started.</p>';
      } else {
        box.innerHTML = msgs
          .map(m => {
            const mine = user && m.userId === user.id;
            const cls = mine ? 'chat-message chat-message-mine' : 'chat-message chat-message-other';
            const when = m.createdAt ? new Date(m.createdAt).toLocaleString() : '';
            let text = String(m.text || '');
            text = escapeHtml(text);
            text = text.replace(
              /(https?:\/\/\S+)/g,
              '<a href="$1" target="_blank" rel="noopener">$1</a>'
            );
            return `
            <div class="${cls}">
              <div class="chat-bubble">${text}</div>
              <div class="chat-meta">${escapeHtml(when)}${mine ? ' · Sent' : ''}</div>
            </div>
          `;
          })
          .join('');
      }
      if (scroll) {
        box.scrollTop = box.scrollHeight;
      }
    } catch (_e) {
      box.innerHTML = '<p class="small">Could not load messages.</p>';
    }
  }

  await load(true);
  efThreadPoll = setInterval(() => {
    load(false);
  }, 5000);

  form.addEventListener('submit', async e => {
    e.preventDefault();
    const text = (input.value || '').trim();
    if (!text) {
      return;
    }
    status.textContent = 'Sending…';
    try {
      const r = await fetch(`/api/threads/${encodeURIComponent(id)}/messages`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text }),
      });
      if (!r.ok) {
        status.textContent = 'Could not send message.';
        return;
      }
      input.value = '';
      status.textContent = '';
      await load(true);
    } catch (_e) {
      status.textContent = 'Could not send message.';
    }
  });

  modal.querySelector('[data-close]').addEventListener('click', () => {
    if (efThreadPoll) {
      clearInterval(efThreadPoll);
      efThreadPoll = null;
    }
    modal.remove();
  });
}

function efMaybeShowOnboarding(page) {
  let shouldShow = false;
  try {
    const flag = localStorage.getItem('eventflow_onboarding_new');
    if (flag === '1') {
      shouldShow = true;
      localStorage.setItem('eventflow_onboarding_new', '0');
    }
  } catch (_) {
    /* Ignore localStorage errors */
  }

  if (!shouldShow) {
    return;
  }
  const container = document.querySelector('main .container');
  if (!container) {
    return;
  }

  const box = document.createElement('div');
  box.className = 'card';
  let body = '';
  if (page === 'dash_customer') {
    body =
      '<p class="small">Here\'s what to do next:</p>' +
      '<ol class="small"><li>Start an event from <strong>Plan an Event</strong>.</li>' +
      '<li>Add a few suppliers to <strong>My Plan</strong>.</li>' +
      '<li>Use <strong>Conversations</strong> to keep messages in one place.</li></ol>';
  } else if (page === 'dash_supplier') {
    body =
      '<p class="small">Quick tips:</p>' +
      '<ol class="small"><li>Complete your supplier profile with photos and details.</li>' +
      '<li>Create at least one clear package.</li>' +
      '<li>Reply promptly to new enquiries from the Conversations card.</li></ol>';
  } else if (page === 'admin') {
    body =
      '<p class="small">Quick overview:</p>' +
      '<ol class="small"><li>Check <strong>Metrics</strong> to see demo usage.</li>' +
      '<li>Approve or hide supplier profiles and packages.</li>' +
      '<li>Use <strong>Reset demo data</strong> to get back to a clean state.</li></ol>';
  }

  box.innerHTML = `<h2 class="h4">Welcome to EventFlow</h2>${
    body
  }<div class="form-actions" style="margin-top:8px"><button type="button" class="cta secondary" id="ef-onboarding-dismiss">Got it</button></div>`;

  const cards = container.querySelector('.cards');
  if (cards && cards.parentNode === container) {
    container.insertBefore(box, cards);
  } else {
    container.insertBefore(box, container.firstChild);
  }

  const btn = box.querySelector('#ef-onboarding-dismiss');
  if (btn) {
    btn.addEventListener('click', () => box.remove());
  }
}

async function initDashCustomer() {
  efMaybeShowOnboarding('dash_customer');
  await renderThreads('threads-cust');
}
async function initDashSupplier() {
  efMaybeShowOnboarding('dash_supplier');
  // If returning from Stripe checkout with billing=success, mark this supplier account as Pro
  try {
    const params = new URLSearchParams(location.search);
    if (params.get('billing') === 'success') {
      fetch('/api/me/subscription/upgrade', {
        method: 'POST',
        headers: { 'X-CSRF-Token': window.__CSRF_TOKEN__ || '' },
      }).catch(() => {
        /* Ignore errors */
      });
    }
  } catch (_e) {
    /* Ignore conversation fetch errors */
  }

  async function api(path, opts) {
    const r = await fetch(path, opts);
    if (!r.ok) {
      throw new Error((await r.json()).error || 'Request failed');
    }
    return r.json();
  }
  const supWrap = document.getElementById('my-suppliers');
  const pkgsWrap = document.getElementById('my-packages');
  const select = document.getElementById('pkg-supplier');
  const proRibbon = document.getElementById('supplier-pro-ribbon');
  let currentIsPro = false;

  async function loadSuppliers() {
    const d = await api('/api/me/suppliers');
    const items = d.items || [];
    // If this user has at least one Pro supplier, treat them as Pro.
    currentIsPro = items.some(s => !!s.isPro);

    if (proRibbon) {
      if (currentIsPro) {
        proRibbon.style.display = 'block';
        proRibbon.innerHTML =
          '<strong>You’re on EventFlow Pro.</strong> Your listing can appear higher in search and you have access to premium features as we roll them out.';
      } else {
        proRibbon.style.display = 'block';
        proRibbon.innerHTML =
          '<strong>You’re on the free plan.</strong> Upgrade to EventFlow Pro to boost your visibility, unlock more packages and get priority support.';
      }
    }

    if (!supWrap) {
      return;
    }
    if (!items.length) {
      supWrap.innerHTML =
        '<div class="card"><p>You have not created a supplier profile yet.</p></div>';
      return;
    }
    supWrap.innerHTML = items
      .map(
        s => {
          // Enhanced badge rendering for Pro and Pro+ tiers
          let proBadge = '';
          if (s.subscription && s.subscription.tier) {
            const tier = s.subscription.tier;
            if (tier === 'pro') {
              proBadge = '<span class="supplier-badge pro">Pro</span>';
            } else if (tier === 'pro_plus') {
              proBadge = '<span class="supplier-badge pro_plus">Pro+</span>';
            }
          } else if (s.isPro || s.pro) {
            // Legacy support
            proBadge = '<span class="pro-badge"><span>Pro supplier</span></span>';
          }
          
          return `<div class="supplier-card card" style="margin-bottom:10px">
      <img src="${(s.photos && s.photos[0]) || '/assets/images/collage-venue.svg'}">
      <div>
        <h3>${s.name} ${proBadge} ${s.approved ? '<span class="badge">Approved</span>' : '<span class="badge" style="background:#FFF5E6;color:#8A5A00">Awaiting review</span>'}</h3>
        <div class="small">${s.location || 'Location not set'} · <span class="badge">${s.category}</span> ${s.price_display ? `· ${s.price_display}` : ''}</div>
        <p class="small">${s.description_short || ''}</p>
        <div class="listing-health">
          <div class="listing-health-bar">
            <div class="listing-health-fill"></div>
          </div>
          <div class="listing-health-label">Listing health: calculating…</div>
        </div>
      </div>
    </div>`;
        }
      )
      .join('');

    // Listing health based on smart score if present
    const rows = supWrap.querySelectorAll('.supplier-card');
    items.forEach((s, idx) => {
      const row = rows[idx];
      if (!row) {
        return;
      }
      const bar = row.querySelector('.listing-health-fill');
      const label = row.querySelector('.listing-health-label');
      const score = typeof s.aiScore === 'number' ? s.aiScore : 0;
      if (bar) {
        bar.style.width = `${score || 10}%`;
      }
      if (label) {
        label.textContent = score
          ? `Listing health: ${score}%`
          : 'Listing health: add photos and details to improve this listing.';
      }
    });

    if (select) {
      select.innerHTML = items.map(s => `<option value="${s.id}">${s.name}</option>`).join('');
    }
  }

  async function loadPackages() {
    if (!pkgsWrap) {
      return;
    }
    const note = document.getElementById('pkg-limit-note');
    const d = await api('/api/me/packages');
    const items = d.items || [];
    const count = items.length;
    const freeLimit = 3; // keep in sync with server FREE_PACKAGE_LIMIT default

    // Update note about allowance
    if (note) {
      if (currentIsPro) {
        note.textContent = count
          ? `You have ${count} package${count === 1 ? '' : 's'}. As a Pro supplier you can create unlimited packages.`
          : 'As a Pro supplier you can create unlimited packages.';
      } else {
        note.textContent = count
          ? `You have ${count} of ${freeLimit} packages on the free plan. Upgrade to Pro to unlock more.`
          : `On the free plan you can create up to ${freeLimit} packages.`;
      }
    }

    // If at limit on free plan, gently disable the form
    const pkgForm = document.getElementById('package-form');
    const pkgStatus = document.getElementById('pkg-status');
    const atLimit = !currentIsPro && count >= freeLimit;
    if (pkgForm) {
      const inputs = pkgForm.querySelectorAll('input, textarea, select, button[type="submit"]');
      inputs.forEach(el => {
        if (el.type === 'submit') {
          el.disabled = atLimit;
        } else {
          el.disabled = atLimit;
        }
      });
      if (pkgStatus) {
        if (atLimit) {
          pkgStatus.textContent =
            'You have reached the package limit on the free plan. Upgrade to Pro to add more.';
        } else {
          pkgStatus.textContent = '';
        }
      }
    }

    if (!items.length) {
      pkgsWrap.innerHTML = '<div class="card"><p>You have not created any packages yet.</p></div>';
      return;
    }
    pkgsWrap.innerHTML = items
      .map(
        p => `<div class="card package-card">
      <img src="${p.image}" alt="${p.title} image">
      <div>
        <h3>${p.title}</h3>
        <div class="small"><span class="badge">${p.price_display || ''}</span> ${p.featured ? '<span class="badge">Featured</span>' : ''}</div>
        <p class="small">${p.description || ''}</p>
      </div>
    </div>`
      )
      .join('');
  }
  await loadSuppliers();
  await loadPackages();

  const supForm = document.getElementById('supplier-form');
  if (supForm) {
    supForm.addEventListener('submit', async e => {
      e.preventDefault();
      const fd = new FormData(supForm);
      const payload = {};
      fd.forEach((v, k) => (payload[k] = v));
      const id = (payload.id || '').toString().trim();
      const path = id ? `/api/me/suppliers/${encodeURIComponent(id)}` : '/api/me/suppliers';
      const method = id ? 'PATCH' : 'POST';
      await api(path, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      await loadSuppliers();
      alert('Saved supplier profile.');
    });
  }

  const pkgForm = document.getElementById('package-form');
  if (pkgForm) {
    pkgForm.addEventListener('submit', async e => {
      e.preventDefault();
      const fd = new FormData(pkgForm);
      const payload = {};
      fd.forEach((v, k) => (payload[k] = v));
      const id = payload.id;
      const path = id ? `/api/me/packages/${encodeURIComponent(id)}` : '/api/me/packages';
      const method = id ? 'PUT' : 'POST';
      await api(path, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      await loadPackages();
      alert('Saved package.');
    });
  }

  // Drag & drop photo uploads
  efSetupPhotoDropZone('sup-photo-drop', 'sup-photo-preview', dataUrl => {
    const area = document.getElementById('sup-photos');
    if (!area) {
      return;
    }
    const current = (area.value || '')
      .split(/\r?\n/)
      .map(x => {
        return x.trim();
      })
      .filter(Boolean);
    current.push(dataUrl);
    area.value = current.join('\n');
  });

  efSetupPhotoDropZone('pkg-photo-drop', 'pkg-photo-preview', dataUrl => {
    const input = document.getElementById('pkg-image');
    if (!input) {
      return;
    }
    input.value = dataUrl;
  });

  // Supplier billing card
  (async () => {
    const host = document.getElementById('supplier-billing-card');
    if (!host) {
      return;
    }
    try {
      const r = await fetch('/api/billing/config');
      if (!r.ok) {
        host.innerHTML = '<p class="small">Billing status is currently unavailable.</p>';
        return;
      }
      const data = await r.json();
      if (!data.enabled) {
        host.innerHTML =
          '<p class="small">Card payments and subscriptions are not set up yet. Ask your EventFlow admin to connect Stripe.</p>';
        return;
      }

      if (currentIsPro) {
        host.innerHTML = `
          <p class="small"><strong>You're on EventFlow Pro.</strong> Thank you for supporting the platform.</p>
          <p class="tiny" style="opacity:0.8;margin-top:4px">If you need to change your subscription or billing details, use the billing emails from Stripe or contact EventFlow support.</p>
        `;
        return;
      }

      host.innerHTML = `
        <p class="small">Upgrade to a paid plan to unlock extra visibility and insights.</p>
        <ul class="small" style="margin-bottom:8px">
          <li>Boosted placement in search results</li>
          <li>Unlimited packages</li>
          <li>Priority support</li>
        </ul>
        <div class="form-actions">
          <button class="cta" type="button" id="billing-upgrade-btn">Upgrade with Stripe</button>
          <span class="small" id="billing-status"></span>
        </div>
      `;
      const btn = document.getElementById('billing-upgrade-btn');
      const status = document.getElementById('billing-status');
      if (btn) {
        btn.addEventListener('click', async () => {
          if (status) {
            status.textContent = 'Redirecting to secure checkout…';
          }
          try {
            const resp = await fetch('/api/billing/checkout', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({}),
            });
            const payload = await resp.json().catch(() => ({}));
            if (!resp.ok || !payload.url) {
              if (status) {
                status.textContent = payload.error || 'Could not start checkout.';
              }
              return;
            }
            window.location.href = payload.url;
          } catch (err) {
            if (status) {
              status.textContent = 'Network error – please try again.';
            }
          }
        });
      }
    } catch (_e) {
      host.innerHTML = '<p class="small">Billing status is currently unavailable.</p>';
    }
  })();
}

async function initAdmin() {
  efMaybeShowOnboarding('admin');
  const metrics = document.getElementById('metrics');
  const supWrap = document.getElementById('admin-suppliers');
  const pkgWrap = document.getElementById('admin-packages');

  const resetBtn = document.getElementById('reset-demo');
  if (resetBtn) {
    resetBtn.addEventListener('click', async () => {
      if (!window.confirm('Reset demo data? This will clear demo users, suppliers and plans.')) {
        return;
      }
      resetBtn.disabled = true;
      const originalLabel = resetBtn.textContent;
      resetBtn.textContent = 'Resetting…';
      try {
        const r = await fetch('/api/admin/reset-demo', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'X-CSRF-Token': window.__CSRF_TOKEN__ || '',
          },
        });
        if (!r.ok) {
          alert(`Reset failed (${r.status}).`);
        } else {
          alert('Demo data has been reset.');
          window.location.reload();
        }
      } catch (e) {
        alert('Could not contact server to reset demo data.');
      } finally {
        resetBtn.disabled = false;
        resetBtn.textContent = originalLabel;
      }
    });
  }

  // Helper function to add CSRF token to requests
  function addCsrfToken(opts) {
    opts = opts || {};
    opts.headers = opts.headers || {};
    if (
      window.__CSRF_TOKEN__ &&
      opts.method &&
      ['POST', 'PUT', 'DELETE'].includes(opts.method.toUpperCase())
    ) {
      opts.headers['X-CSRF-Token'] = window.__CSRF_TOKEN__;
    }
    return opts;
  }

  async function fetchJSON(url, opts) {
    opts = addCsrfToken(opts);
    const r = await fetch(url, opts || {});
    if (!r.ok) {
      throw new Error((await r.json()).error || 'Request failed');
    }
    return r.json();
  }
  try {
    const m = await fetchJSON('/api/admin/metrics');
    const c = m.counts;
    metrics.textContent = `Users: ${c.usersTotal} ( ${Object.entries(c.usersByRole)
      .map(([k, v]) => `${k}: ${v}`)
      .join(
        ', '
      )} ) · Suppliers: ${c.suppliersTotal} · Packages: ${c.packagesTotal} · Threads: ${c.threadsTotal} · Messages: ${c.messagesTotal}`;
  } catch (e) {
    metrics.textContent = 'Forbidden (admin only).';
  }
  try {
    const s = await fetchJSON('/api/admin/suppliers');
    supWrap.innerHTML =
      (s.items || [])
        .map(
          x => `<div class="card" style="margin-bottom:10px">
      <div class="small"><strong>${x.name}</strong> — ${x.category} · ${x.location || ''}</div>
      <div class="form-actions"><button class="cta secondary" data-approve="${x.id}" data-val="${x.approved ? 'false' : 'true'}">${x.approved ? 'Hide' : 'Approve'}</button></div>
    </div>`
        )
        .join('') || '<p class="small">No suppliers.</p>';
    supWrap.querySelectorAll('[data-approve]').forEach(btn =>
      btn.addEventListener('click', async () => {
        const id = btn.getAttribute('data-approve');
        const val = btn.getAttribute('data-val') === 'true';
        await fetchJSON(`/api/admin/suppliers/${id}/approve`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ approved: val }),
        });
        location.reload();
      })
    );
  } catch (e) {
    supWrap.innerHTML = '<p class="small">Forbidden (admin only)</p>';
  }
  try {
    const p = await fetchJSON('/api/admin/packages');
    pkgWrap.innerHTML =
      (p.items || [])
        .map(
          x => `<div class="pack card" style="margin-bottom:10px">
      <img src="${x.image}"><div><h3>${x.title}</h3><div class="small"><span class="badge">${x.price}</span> — Supplier ${x.supplierId.slice(0, 8)}</div>
      <div class="form-actions"><button class="cta secondary" data-approve="${x.id}" data-val="${x.approved ? 'false' : 'true'}">${x.approved ? 'Hide' : 'Approve'}</button>
      <button class="cta secondary" data-feature="${x.id}" data-val="${x.featured ? 'false' : 'true'}">${x.featured ? 'Unfeature' : 'Feature'}</button></div></div></div>`
        )
        .join('') || '<p class="small">No packages.</p>';
    pkgWrap.querySelectorAll('[data-approve]').forEach(btn =>
      btn.addEventListener('click', async () => {
        const id = btn.getAttribute('data-approve');
        const val = btn.getAttribute('data-val') === 'true';
        await fetchJSON(`/api/admin/packages/${id}/approve`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ approved: val }),
        });
        location.reload();
      })
    );
    pkgWrap.querySelectorAll('[data-feature]').forEach(btn =>
      btn.addEventListener('click', async () => {
        const id = btn.getAttribute('data-feature');
        const val = btn.getAttribute('data-val') === 'true';
        await fetchJSON(`/api/admin/packages/${id}/feature`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ featured: val }),
        });
        location.reload();
      })
    );
  } catch (e) {
    pkgWrap.innerHTML = '<p class="small">Forbidden (admin only)</p>';
  }
}

// Simple HTML escape for safe admin rendering
function efEscapeHtml(str) {
  return String(str || '').replace(/[&<>"']/g, c => {
    return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
  });
}

// Simple date formatter for admin tables
function efFormatDate(dateStr) {
  if (!dateStr) {
    return '';
  }
  const d = new Date(dateStr);
  if (isNaN(d.getTime())) {
    return '';
  }
  return d.toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' });
}

// Admin users page: list all users in a table
async function initAdminUsers() {
  const summary = document.getElementById('user-summary');
  const tbody = document.querySelector('table.table tbody');
  if (!summary || !tbody) {
    return;
  }

  summary.textContent = 'Loading users…';

  try {
    const data = await fetchJSON('/api/admin/users');
    const items = (data && data.items) || [];

    summary.textContent = items.length
      ? `${items.length} user${items.length === 1 ? '' : 's'} registered.`
      : 'No users found.';

    if (!items.length) {
      tbody.innerHTML = '<tr><td colspan="7" class="small">No users found.</td></tr>';
      return;
    }

    tbody.innerHTML = items
      .map(u => {
        return (
          `<tr>` +
          `<td>${efEscapeHtml(u.name || '')}</td>` +
          `<td>${efEscapeHtml(u.email || '')}</td>` +
          `<td>${efEscapeHtml(u.role || '')}</td>` +
          `<td>${u.verified ? 'Yes' : 'No'}</td>` +
          `<td>${u.marketingOptIn ? 'Yes' : 'No'}</td>` +
          `<td>${efFormatDate(u.createdAt)}</td>` +
          `<td>${u.lastLoginAt ? efFormatDate(u.lastLoginAt) : 'Never'}</td>` +
          `</tr>`
        );
      })
      .join('');
  } catch (e) {
    console.error('Admin users load failed', e);
    summary.textContent = 'Forbidden (admin only).';
    tbody.innerHTML =
      '<tr><td colspan="7" class="small">You must be signed in as an admin to view this page.</td></tr>';
  }
}

document.addEventListener('DOMContentLoaded', () => {
  const page =
    window.__EF_PAGE__ ||
    (location.pathname.endsWith('admin-users.html')
      ? 'admin_users'
      : location.pathname.endsWith('admin.html')
        ? 'admin'
        : location.pathname.endsWith('auth.html')
          ? 'auth'
          : location.pathname.endsWith('verify.html')
            ? 'verify'
            : location.pathname.endsWith('dashboard-customer.html')
              ? 'dash_customer'
              : location.pathname.endsWith('dashboard-supplier.html')
                ? 'dash_supplier'
                : location.pathname.endsWith('suppliers.html')
                  ? 'results'
                  : location.pathname.endsWith('supplier.html')
                    ? 'supplier'
                    : location.pathname.endsWith('plan.html')
                      ? 'plan'
                      : '');

  // Display backend version in footer if available
  (async () => {
    try {
      const label = document.getElementById('ef-version-label');
      if (!label) {
        return;
      }
      const r = await fetch('/api/meta');
      if (!r.ok) {
        label.textContent = 'unknown';
        return;
      }
      const data = await r.json();
      if (data && data.version) {
        label.textContent = `${data.version} (Node ${data.node || ''})`.trim();
      } else {
        label.textContent = 'dev';
      }
    } catch (_err) {
      const label = document.getElementById('ef-version-label');
      if (label) {
        label.textContent = 'offline';
      }
    }
  })();

  // Per-page setup
  if (page === 'home') {
    initHome && initHome();
  }
  if (page === 'results') {
    initResults && initResults();
  }
  if (page === 'supplier') {
    initSupplier && initSupplier();
  }
  if (page === 'plan') {
    initPlan && initPlan();
  }
  if (page === 'dash_customer') {
    renderThreads && renderThreads('threads-cust');
  }
  if (page === 'dash_supplier') {
    initDashSupplier && initDashSupplier();
  }
  if (page === 'admin') {
    initAdmin && initAdmin();
  }
  if (page === 'admin_users') {
    initAdminUsers && initAdminUsers();
  }
  if (page === 'verify') {
    initVerify && initVerify();
  }

  // Global header behaviour: scroll hide/show
  // Note: burger menu is handled by auth-nav.js
  try {
    const header = document.querySelector('.header');

    // Hide header on scroll down, show on scroll up
    let lastY = window.scrollY;
    let ticking = false;
    const threshold = 12;

    const onScroll = () => {
      const currentY = window.scrollY;
      if (Math.abs(currentY - lastY) < threshold) {
        ticking = false;
        return;
      }
      if (currentY > lastY && currentY > 40) {
        header && header.classList.add('header--hidden');
      } else {
        header && header.classList.remove('header--hidden');
      }
      lastY = currentY;
      ticking = false;
    };

    window.addEventListener('scroll', () => {
      if (!ticking) {
        window.requestAnimationFrame(onScroll);
        ticking = true;
      }
    });
  } catch (_err) {
    /* Ignore loader errors */
  }

  if (page === 'auth') {
    // auth form handlers
    const loginForm = document.getElementById('login-form');
    const loginStatus = document.getElementById('login-status');
    const loginEmail = document.getElementById('login-email');
    const loginPassword = document.getElementById('login-password');

    const regForm = document.getElementById('register-form');
    const regStatus = document.getElementById('reg-status');
    const regName = document.getElementById('reg-name');
    const regEmail = document.getElementById('reg-email');
    const regPassword = document.getElementById('reg-password');
    const forgotLink = document.getElementById('forgot-password-link');

    // If already signed in, avoid showing the auth form again
    (async () => {
      try {
        const existing = await me();
        if (existing && loginStatus) {
          const label = existing.name || existing.email || existing.role || 'your account';
          loginStatus.textContent = `You are already signed in as ${label}. Redirecting…`;
          setTimeout(() => {
            if (existing.role === 'admin') {
              location.href = '/admin.html';
            } else if (existing.role === 'supplier') {
              location.href = '/dashboard-supplier.html';
            } else {
              location.href = '/dashboard-customer.html';
            }
          }, 600);
        }
      } catch (_) {
        /* Ignore loader errors */
      }
    })();

    // Basic "forgot password" handler (demo-only)
    if (forgotLink && loginEmail) {
      forgotLink.addEventListener('click', async e => {
        e.preventDefault();
        const email = (loginEmail.value || '').trim();
        if (!email) {
          alert('Enter your email address first so we know where to send reset instructions.');
          return;
        }
        try {
          await fetch('/api/auth/forgot', {
            method: 'POST',
            headers: getHeadersWithCsrf({ 'Content-Type': 'application/json' }),
            body: JSON.stringify({ email }),
          });
          if (loginStatus) {
            loginStatus.textContent = "If this email is registered, we'll send reset instructions.";
          }
        } catch (_) {
          if (loginStatus) {
            loginStatus.textContent = 'Something went wrong. Please try again in a moment.';
          }
        }
      });
    }

    const attachPasswordToggle = function (input) {
      if (!input) {
        return;
      }
      const wrapper = input.parentElement;
      if (!wrapper) {
        return;
      }
      const toggle = document.createElement('button');
      toggle.type = 'button';
      toggle.className = 'password-toggle';
      toggle.textContent = 'Show';
      toggle.setAttribute('aria-label', 'Toggle password visibility');
      toggle.addEventListener('click', () => {
        if (input.type === 'password') {
          input.type = 'text';
          toggle.textContent = 'Hide';
          toggle.setAttribute('aria-label', 'Hide password');
        } else {
          input.type = 'password';
          toggle.textContent = 'Show';
          toggle.setAttribute('aria-label', 'Show password');
        }
      });
      input.classList.add('has-toggle');
      wrapper.appendChild(toggle);
    };

    attachPasswordToggle(loginPassword);
    attachPasswordToggle(regPassword);

    // Real-time email validation for registration
    if (regEmail) {
      const emailValidationMsg = document.getElementById('email-validation-msg');
      regEmail.addEventListener('blur', () => {
        const email = regEmail.value.trim();
        if (email && emailValidationMsg) {
          const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
          if (!emailRegex.test(email)) {
            emailValidationMsg.textContent = 'Please enter a valid email address';
            emailValidationMsg.style.display = 'block';
          } else {
            emailValidationMsg.textContent = '';
            emailValidationMsg.style.display = 'none';
          }
        }
      });
    }

    // Password strength indicator for registration
    if (regPassword) {
      const passwordStrengthMsg = document.getElementById('password-strength-msg');
      regPassword.addEventListener('input', () => {
        const password = regPassword.value;
        if (password && passwordStrengthMsg) {
          let strength = 0;
          let feedback = '';
          if (password.length >= 8) {
            strength++;
          }
          if (/[a-z]/.test(password)) {
            strength++;
          }
          if (/[A-Z]/.test(password)) {
            strength++;
          }
          if (/[0-9]/.test(password)) {
            strength++;
          }
          if (/[^a-zA-Z0-9]/.test(password)) {
            strength++;
          }

          if (password.length < 8) {
            feedback = 'Password must be at least 8 characters';
            passwordStrengthMsg.style.color = '#b00020';
          } else if (strength <= 2) {
            feedback = 'Weak password - add letters and numbers';
            passwordStrengthMsg.style.color = '#f59e0b';
          } else if (strength === 3) {
            feedback = 'Fair password';
            passwordStrengthMsg.style.color = '#f59e0b';
          } else if (strength === 4) {
            feedback = 'Good password';
            passwordStrengthMsg.style.color = '#10b981';
          } else {
            feedback = 'Strong password';
            passwordStrengthMsg.style.color = '#10b981';
          }
          passwordStrengthMsg.textContent = feedback;
        }
      });
    }

    // Account type toggle (customer / supplier)
    const roleHidden = document.getElementById('reg-role');
    const rolePills = document.querySelectorAll('.role-pill');
    if (rolePills && rolePills.length) {
      rolePills.forEach(btn => {
        btn.addEventListener('click', () => {
          rolePills.forEach(b => b.classList.remove('is-active'));
          btn.classList.add('is-active');
          if (roleHidden) {
            const val = btn.getAttribute('data-role') || 'customer';
            roleHidden.value = val;
          }
        });
      });
    }

    // Helper function to get headers with CSRF token
    const getHeadersWithCsrf = function (additionalHeaders = {}) {
      const headers = { ...additionalHeaders };
      const csrfToken = window.__CSRF_TOKEN__;
      if (csrfToken) {
        headers['X-CSRF-Token'] = csrfToken;
      }
      return headers;
    };

    if (loginForm && loginEmail && loginPassword) {
      const loginBtn = loginForm.querySelector('button[type="submit"]');
      loginForm.addEventListener('submit', async e => {
        e.preventDefault();
        if (loginStatus) {
          loginStatus.textContent = '';
        }
        if (loginBtn) {
          loginBtn.disabled = true;
          loginBtn.textContent = 'Signing in…';
        }
        try {
          const email = loginEmail.value.trim();
          const password = loginPassword.value;
          const r = await fetch('/api/auth/login', {
            method: 'POST',
            headers: getHeadersWithCsrf({ 'Content-Type': 'application/json' }),
            body: JSON.stringify({ email, password }),
          });
          let data = {};
          try {
            data = await r.json();
          } catch (_) {
            /* Ignore JSON parse errors */
          }
          if (!r.ok) {
            if (loginStatus) {
              loginStatus.textContent =
                data.error || 'Could not sign in. Please check your details and try again.';
            }
          } else {
            if (loginStatus) {
              loginStatus.textContent = 'Signed in. Redirecting…';
            }
            const user = data.user || {};
            try {
              localStorage.setItem('eventflow_onboarding_new', '1');
            } catch (_e) {
              /* Ignore localStorage errors */
            }
            if (user.role === 'admin') {
              location.href = '/admin.html';
            } else if (user.role === 'supplier') {
              location.href = '/dashboard-supplier.html';
            } else {
              location.href = '/dashboard-customer.html';
            }
          }
        } catch (err) {
          if (loginStatus) {
            loginStatus.textContent = 'Network error – please try again.';
          }
          console.error('Login error', err);
        } finally {
          if (loginBtn) {
            loginBtn.disabled = false;
            loginBtn.textContent = 'Sign in';
          }
        }
      });
    }

    if (regForm && regEmail && regPassword) {
      const regBtn = regForm.querySelector('button[type="submit"]');
      regForm.addEventListener('submit', async e => {
        e.preventDefault();
        if (regStatus) {
          regStatus.textContent = '';
        }

        // Validate terms checkbox
        const termsCheckbox = document.getElementById('reg-terms');
        if (termsCheckbox && !termsCheckbox.checked) {
          if (regStatus) {
            regStatus.textContent =
              'You must agree to the Terms and Privacy Policy to create an account.';
          }
          return;
        }

        if (regBtn) {
          regBtn.disabled = true;
          regBtn.textContent = 'Creating…';
        }
        try {
          const name = regName ? regName.value.trim() : '';
          const email = regEmail.value.trim();
          const password = regPassword.value;
          const roleHidden = document.getElementById('reg-role');
          const role = roleHidden && roleHidden.value ? roleHidden.value : 'customer';
          const marketingEl = document.getElementById('reg-marketing');
          const marketingOptIn = !!(marketingEl && marketingEl.checked);
          const r = await fetch('/api/auth/register', {
            method: 'POST',
            headers: getHeadersWithCsrf({ 'Content-Type': 'application/json' }),
            body: JSON.stringify({ name, email, password, role, marketingOptIn }),
          });
          let data = {};
          try {
            data = await r.json();
          } catch (_) {
            /* Ignore JSON parse errors */
          }
          if (!r.ok) {
            // Provide specific error messages
            let errorMsg = 'Could not create account. Please check your details.';
            if (data.error) {
              if (data.error.includes('email')) {
                errorMsg = data.error;
              } else if (data.error.includes('password')) {
                errorMsg = data.error;
              } else {
                errorMsg = data.error;
              }
            }
            if (regStatus) {
              regStatus.textContent = errorMsg;
            }
          } else {
            if (regStatus) {
              regStatus.textContent =
                'Account created. Check your email to verify your account, then you can sign in.';
            }
          }
        } catch (err) {
          if (regStatus) {
            regStatus.textContent = 'Network error – please try again.';
          }
          console.error('Register error', err);
        } finally {
          if (regBtn) {
            regBtn.disabled = false;
            regBtn.textContent = 'Create account';
          }
        }
      });
    }
  }
});

// Email verification page
async function initVerify() {
  const statusEl = document.getElementById('verify-status');
  const nextEl = document.getElementById('verify-next');
  const params = new URLSearchParams(window.location.search);
  const token = params.get('token');

  if (!token) {
    if (statusEl) {
      statusEl.textContent =
        'No verification token provided. Please check your email for the verification link.';
    }
    return;
  }

  try {
    const r = await fetch(`/api/auth/verify?token=${encodeURIComponent(token)}`);
    const data = await r.json();

    if (!r.ok) {
      if (statusEl) {
        if (data.error && data.error.includes('Invalid or expired')) {
          statusEl.textContent =
            'This verification link is invalid or has expired. Please request a new verification email.';
        } else {
          statusEl.textContent =
            data.error || 'Verification failed. Please try again or contact support.';
        }
      }
    } else {
      if (statusEl) {
        statusEl.textContent = '✓ Your email has been verified successfully!';
      }
      if (nextEl) {
        nextEl.style.display = 'block';
      }
      // Auto-redirect to login after 3 seconds
      setTimeout(() => {
        window.location.href = '/auth.html';
      }, 3000);
    }
  } catch (err) {
    if (statusEl) {
      statusEl.textContent = 'Network error. Please check your connection and try again.';
    }
    console.error('Verification error', err);
  }
}

// Settings page
async function initSettings() {
  try {
    const r = await fetch('/api/me/settings');
    if (!r.ok) {
      throw new Error('Not signed in');
    }
    const d = await r.json();
    const cb = document.getElementById('notify');
    cb.checked = !!d.notify;
    document.getElementById('save-settings').addEventListener('click', async () => {
      const rr = await fetch('/api/me/settings', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-CSRF-Token': window.__CSRF_TOKEN__ || '',
        },
        body: JSON.stringify({ notify: document.getElementById('notify').checked }),
      });
      if (rr.ok) {
        document.getElementById('settings-status').textContent = 'Saved';
        setTimeout(() => (document.getElementById('settings-status').textContent = ''), 1200);
      }
    });
  } catch (e) {
    document.querySelector('main .container').innerHTML =
      '<div class="card"><p class="small">Sign in to change your settings.</p></div>';
  }
}

document.addEventListener('DOMContentLoaded', () => {
  if (window.__EF_PAGE__ === 'settings') {
    initSettings();
  }
});

// simple pageview beacon
fetch('/api/metrics/track', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json', 'X-CSRF-Token': window.__CSRF_TOKEN__ || '' },
  body: JSON.stringify({ type: 'pageview', meta: { path: location.pathname } }),
}).catch(() => {});

// Admin charts
async function adminCharts() {
  try {
    const r = await fetch('/api/admin/metrics/timeseries');
    if (!r.ok) {
      return;
    }
    const d = await r.json();
    const c = document.createElement('canvas');
    c.id = 'chart';
    document.querySelector('#metrics').after(c);
    const s = document.createElement('script');
    s.src = 'https://cdn.jsdelivr.net/npm/chart.js';
    s.onload = () => {
      const ctx = c.getContext('2d');
      new Chart(ctx, {
        type: 'line',
        data: {
          labels: d.days,
          datasets: [
            { label: 'Pageviews', data: d.pageviews },
            { label: 'Signups', data: d.signups },
            { label: 'Messages', data: d.messages },
          ],
        },
      });
    };
    document.body.appendChild(s);
  } catch (e) {
    /* Ignore confetti errors */
  }
}

// Supplier onboarding checklist visual (client side)
function renderSupplierChecklist(wrapper, supplierCount, packageCount) {
  const steps = [
    { name: 'Create a supplier profile', done: supplierCount > 0 },
    { name: 'Get approved by admin', done: false }, // can't know client-side; show informational
    { name: 'Add at least one package', done: packageCount > 0 },
  ];
  wrapper.innerHTML = `<h3>Onboarding</h3>${steps
    .map(s => `<div class="small">${s.done ? '✅' : '⬜️'} ${s.name}</div>`)
    .join('')}`;
}

document.addEventListener('DOMContentLoaded', () => {
  if (window.__EF_PAGE__ === 'admin') {
    adminCharts();
  }
  if (window.__EF_PAGE__ === 'dash_supplier') {
    (async () => {
      try {
        const me = await fetch('/api/me/suppliers');
        const ms = await me.json();
        const pk = await fetch('/api/me/packages');
        const mp = await pk.json();
        const box = document.createElement('div');
        box.className = 'card';
        box.style.marginTop = '16px';
        document.querySelector('main .container').appendChild(box);
        renderSupplierChecklist(box, (ms.items || []).length, (mp.items || []).length);
      } catch (e) {
        /* Ignore checklist render errors */
      }
    })();
  }
});

// === Experimental features (EventFlow Experimental v2) ===

// Simple loader overlay: fades out shortly after load
function efInitLoader() {
  const loader = document.getElementById('ef-loader');
  if (!loader) {
    return;
  }
  const hide = () => {
    loader.classList.add('loader-hidden');
    setTimeout(() => loader.remove(), 400);
  };
  window.addEventListener('load', () => {
    setTimeout(hide, 600);
  });
}

// Brand wordmark animation: collapse text after initial reveal
function efInitBrandAnimation() {
  const brandText = document.querySelector('.brand-text');
  if (!brandText) {
    return;
  }
  if (brandText.dataset.animated === 'true') {
    return;
  }
  brandText.dataset.animated = 'true';

  brandText.style.display = 'inline-block';
  brandText.style.whiteSpace = 'nowrap';
  brandText.style.overflow = 'hidden';

  const initialWidth = brandText.offsetWidth;
  brandText.style.width = `${initialWidth}px`;
  brandText.style.transition = 'opacity 0.45s ease, width 0.45s ease, margin 0.45s ease';

  setTimeout(() => {
    brandText.style.opacity = '0';
    brandText.style.width = '0';
    brandText.style.marginLeft = '0';
  }, 3000);
}

// Venue map: uses browser geolocation or postcode to set an embedded map
function efInitVenueMap() {
  const mapFrame = document.getElementById('venue-map');
  if (!mapFrame) {
    return;
  }
  const useBtn = document.getElementById('map-use-location');
  const form = document.getElementById('map-postcode-form');
  const input = document.getElementById('map-postcode');
  const status = document.getElementById('map-status');
  const LAST_QUERY_KEY = 'ef:lastMapQuery';
  const LAST_QUERY_LABEL_KEY = 'ef:lastMapLabel';
  const DEFAULT_QUERY = 'wedding venues in the UK';

  // Fetch Google Maps API key from server
  let mapsApiKey = '';
  fetch('/api/config')
    .then(res => res.json())
    .then(config => {
      mapsApiKey = config.googleMapsApiKey || '';
    })
    .catch(() => {
      setStatus('Showing default UK map view.');
    })
    .finally(() => {
      showDefaultMap();
    });

  function setStatus(msg) {
    if (!status) {
      return;
    }
    status.textContent = msg || '';
  }

  function buildMapUrl(query) {
    if (!query) {
      return mapFrame.src;
    }
    const encodedQuery = encodeURIComponent(query);
    if (mapsApiKey) {
      return `https://www.google.com/maps/embed/v1/search?key=${encodeURIComponent(mapsApiKey)}&q=${encodedQuery}`;
    }
    return `https://www.google.com/maps?q=${encodedQuery}&output=embed`;
  }

  function showDefaultMap() {
    let savedQuery = '';
    let savedLabel = '';
    try {
      savedQuery = localStorage.getItem(LAST_QUERY_KEY) || '';
      savedLabel = localStorage.getItem(LAST_QUERY_LABEL_KEY) || '';
    } catch (_) {
      /* Ignore storage errors */
    }

    const trimmed = savedQuery.trim();
    const baseQuery = trimmed ? `wedding venues near ${trimmed}` : DEFAULT_QUERY;
    const label = (savedLabel || trimmed).trim();
    mapFrame.src = buildMapUrl(baseQuery);
    mapFrame.style.display = 'block';
    setStatus(
      trimmed
        ? `Showing results near "${label || trimmed}".`
        : 'Showing venues across the UK. Share your location to refine your results.'
    );
  }

  function updateForQuery(q, labelOverride) {
    const cleaned = (q || '').trim();
    if (!cleaned) {
      return;
    }
    const query = `wedding venues near ${cleaned}`;
    mapFrame.src = buildMapUrl(query);
    mapFrame.style.display = 'block';

    const label = labelOverride || cleaned;
    setStatus(`Showing results near "${label}".`);
    try {
      localStorage.setItem(LAST_QUERY_KEY, cleaned);
      localStorage.setItem(LAST_QUERY_LABEL_KEY, label);
    } catch (_) {
      /* Ignore storage errors */
    }
  }

  if (useBtn && navigator.geolocation) {
    useBtn.addEventListener('click', () => {
      setStatus('Requesting your location…');
      navigator.geolocation.getCurrentPosition(
        pos => {
          const { latitude, longitude } = pos.coords;
          const query = `${latitude.toFixed(4)},${longitude.toFixed(4)}`;
          updateForQuery(query, 'your location');
        },
        err => {
          setStatus(
            `Could not access your location (${err.message}). You can type a postcode instead.`
          );
        }
      );
    });
  }

  if (form && input) {
    form.addEventListener('submit', e => {
      e.preventDefault();
      const val = input.value.trim();
      if (!val) {
        setStatus('Type a postcode first.');
        return;
      }
      updateForQuery(val);
    });
  }
}

document.addEventListener('DOMContentLoaded', () => {
  try {
    efInitLoader();
  } catch (_) {
    /* Ignore loader init errors */
  }
  try {
    efInitBrandAnimation();
  } catch (_) {
    /* Ignore brand animation errors */
  }
  try {
    efInitVenueMap();
  } catch (_) {
    /* Ignore map init errors */
  }
});

// Experimental v3: scroll reveal for .reveal elements
document.addEventListener('DOMContentLoaded', () => {
  try {
    const els = Array.prototype.slice.call(document.querySelectorAll('.reveal'));
    if (!('IntersectionObserver' in window) || els.length === 0) {
      els.forEach(el => el.classList.add('is-visible'));
      return;
    }
    const obs = new IntersectionObserver(
      entries => {
        entries.forEach(entry => {
          if (entry.isIntersecting) {
            entry.target.classList.add('is-visible');
            obs.unobserve(entry.target);
          }
        });
      },
      { threshold: 0.18 }
    );
    els.forEach(el => obs.observe(el));
  } catch (_) {
    /* Ignore IntersectionObserver errors */
  }
});

// Experimental v4: simple confetti burst
function efConfetti() {
  try {
    const layer = document.createElement('div');
    layer.className = 'confetti-layer';
    const colors = ['#22C55E', '#F97316', '#EAB308', '#38BDF8', '#A855F7', '#EC4899'];
    const pieces = 80;
    for (let i = 0; i < pieces; i++) {
      const el = document.createElement('div');
      el.className = 'confetti-piece';
      const left = Math.random() * 100;
      const delay = Math.random() * 0.4;
      const dur = 0.7 + Math.random() * 0.4;
      const color = colors[Math.floor(Math.random() * colors.length)];
      el.style.left = `${left}%`;
      el.style.top = `${-20 + Math.random() * 20}px`;
      el.style.backgroundColor = color;
      el.style.animationDelay = `${delay}s`;
      el.style.animationDuration = `${dur}s`;
      layer.appendChild(el);
    }
    document.body.appendChild(layer);
    setTimeout(() => {
      layer.remove();
    }, 1300);
  } catch (_) {
    /* Ignore loader removal errors */
  }
}

// --- Supplier image file preview ---
(function () {
  const input = document.getElementById('sup-photos-file');
  const preview = document.getElementById('sup-photos-preview');
  if (!input || !preview) {
    return;
  }

  input.addEventListener('change', () => {
    while (preview.firstChild) {
      preview.removeChild(preview.firstChild);
    }
    const files = Array.prototype.slice.call(input.files || []);
    if (!files.length) {
      return;
    }

    const max = 6;
    files.slice(0, max).forEach(file => {
      if (!file.type || !file.type.startsWith('image/')) {
        return;
      }
      const reader = new FileReader();
      reader.onload = () => {
        if (!reader.result || typeof reader.result !== 'string') {
          return;
        }
        const url = reader.result;
        const item = document.createElement('div');
        item.className = 'thumb';
        const img = document.createElement('img');
        img.src = url;
        img.alt = file.name || 'Selected image';
        item.appendChild(img);
        preview.appendChild(item);
      };
      reader.readAsDataURL(file);
    });
  });
})();
