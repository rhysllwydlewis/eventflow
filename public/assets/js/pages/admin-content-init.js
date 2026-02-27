(function () {
  // Tab switching
  document.querySelectorAll('.tab-button').forEach(button => {
    button.addEventListener('click', () => {
      const tabName = button.dataset.tab;

      // Update active states
      document.querySelectorAll('.tab-button').forEach(b => b.classList.remove('active'));
      document.querySelectorAll('.tab-content').forEach(t => t.classList.remove('active'));

      button.classList.add('active');
      document.getElementById(tabName).classList.add('active');
    });
  });

  // Homepage hero form
  document.getElementById('heroForm').addEventListener('submit', async e => {
    e.preventDefault();

    const data = {
      title: document.getElementById('heroTitle').value,
      subtitle: document.getElementById('heroSubtitle').value,
      ctaText: document.getElementById('heroCTA').value,
    };

    try {
      await AdminShared.api('/api/admin/content/homepage', 'PUT', data);
      AdminShared.showToast('Homepage content updated successfully', 'success');
    } catch (err) {
      AdminShared.showToast(`Failed to update: ${err.message}`, 'error');
    }
  });

  // Preview hero
  document.getElementById('previewHero').addEventListener('click', () => {
    window.open('/', '_blank');
  });

  // Load homepage content
  async function loadHomepageContent() {
    try {
      const content = await AdminShared.api('/api/admin/content/homepage');
      document.getElementById('heroTitle').value = content.title || '';
      document.getElementById('heroSubtitle').value = content.subtitle || '';
      document.getElementById('heroCTA').value = content.ctaText || '';
    } catch (err) {
      console.error('Failed to load homepage content:', err);
    }
  }

  // Add announcement
  document.getElementById('addAnnouncementBtn').addEventListener('click', () => {
    showAnnouncementModal();
  });

  function showAnnouncementModal(announcement = null) {
    const modal = document.createElement('div');
    modal.className = 'modal-overlay';
    modal.style.cssText =
      'position:fixed;top:0;left:0;right:0;bottom:0;background:rgba(0,0,0,0.5);display:flex;align-items:center;justify-content:center;z-index:9999;';

    modal.innerHTML = `
      <div class="modal modal-medium">
        <h3>${announcement ? 'Edit' : 'Add'} Announcement</h3>
        <form id="announcementForm" action="#">
          <div class="form-row">
            <label>Message</label>
            <textarea id="announcementMessage" rows="3" required>${announcement ? AdminShared.escapeHtml(announcement.message) : ''}</textarea>
          </div>
          
          <div class="form-row">
            <label>Type</label>
            <select id="announcementType">
              <option value="info" ${announcement && announcement.type === 'info' ? 'selected' : ''}>Info</option>
              <option value="warning" ${announcement && announcement.type === 'warning' ? 'selected' : ''}>Warning</option>
              <option value="success" ${announcement && announcement.type === 'success' ? 'selected' : ''}>Success</option>
            </select>
          </div>
          
          <div class="form-row">
            <label>
              <input type="checkbox" id="announcementActive" ${announcement && announcement.active ? 'checked' : ''}>
              Active (visible to users)
            </label>
          </div>
          
          <div class="action-buttons">
            <button type="submit" class="btn btn-primary">${announcement ? 'Update' : 'Create'} Announcement</button>
            <button type="button" class="btn btn-secondary" id="closeModal">Cancel</button>
          </div>
        </form>
      </div>
    `;

    document.body.appendChild(modal);

    modal.querySelector('#closeModal').addEventListener('click', () => modal.remove());
    modal.addEventListener('click', e => {
      if (e.target === modal) {
        modal.remove();
      }
    });

    modal.querySelector('#announcementForm').addEventListener('submit', async e => {
      e.preventDefault();

      const data = {
        message: document.getElementById('announcementMessage').value,
        type: document.getElementById('announcementType').value,
        active: document.getElementById('announcementActive').checked,
      };

      try {
        if (announcement) {
          await AdminShared.api(`/api/admin/content/announcements/${announcement.id}`, 'PUT', data);
        } else {
          await AdminShared.api('/api/admin/content/announcements', 'POST', data);
        }
        AdminShared.showToast('Announcement saved successfully', 'success');
        modal.remove();
        loadAnnouncements();
      } catch (err) {
        AdminShared.showToast(`Failed to save: ${err.message}`, 'error');
      }
    });
  }

  // Load announcements
  async function loadAnnouncements() {
    try {
      const announcements = await AdminShared.api('/api/admin/content/announcements');
      const container = document.getElementById('announcementsList');

      if (!announcements || announcements.length === 0) {
        container.innerHTML =
          '<p class="small">No announcements yet. Click "Add Announcement" to create one.</p>';
        return;
      }

      container.innerHTML = announcements
        .map(a => {
          const escapedId = AdminShared.escapeHtml(a.id);
          return `
          <div class="announcement-item" data-id="${escapedId}">
            <div class="flex-between-start">
              <div class="flex-1">
                <strong>${AdminShared.escapeHtml(a.message)}</strong>
                <div class="small" class="mt-025">
                  Type: ${a.type} • ${a.active ? '<span style="color:#22c55e;">Active</span>' : '<span style="color:#6b7280;">Inactive</span>'}
                </div>
              </div>
              <div class="flex-gap">
                <button class="btn btn-secondary btn-small" data-action="edit" data-id="${escapedId}">Edit</button>
                <button class="btn btn-danger btn-small" data-action="delete" data-id="${escapedId}">Delete</button>
              </div>
            </div>
          </div>
        `;
        })
        .join('');

      // Add event delegation
      container.querySelectorAll('button[data-action]').forEach(btn => {
        btn.addEventListener('click', e => {
          const action = e.target.dataset.action;
          const id = e.target.dataset.id;
          if (action === 'edit') {
            editAnnouncement(id);
          } else if (action === 'delete') {
            deleteAnnouncement(id);
          }
        });
      });
    } catch (err) {
      document.getElementById('announcementsList').innerHTML =
        '<p class="small" style="color:#ef4444;">Failed to load announcements</p>';
    }
  }

  // Add FAQ
  document.getElementById('addFAQBtn').addEventListener('click', () => {
    showFAQModal();
  });

  function showFAQModal(faq = null) {
    const modal = document.createElement('div');
    modal.className = 'modal-overlay';
    modal.style.cssText =
      'position:fixed;top:0;left:0;right:0;bottom:0;background:rgba(0,0,0,0.5);display:flex;align-items:center;justify-content:center;z-index:9999;';

    modal.innerHTML = `
      <div class="modal modal-medium">
        <h3>${faq ? 'Edit' : 'Add'} FAQ</h3>
        <form id="faqForm" action="#">
          <div class="form-row">
            <label>Question</label>
            <input type="text" id="faqQuestion" required value="${faq ? AdminShared.escapeHtml(faq.question) : ''}">
          </div>
          
          <div class="form-row">
            <label>Answer</label>
            <textarea id="faqAnswer" rows="4" required>${faq ? AdminShared.escapeHtml(faq.answer) : ''}</textarea>
          </div>
          
          <div class="form-row">
            <label>Category</label>
            <input type="text" id="faqCategory" placeholder="General" value="${faq ? AdminShared.escapeHtml(faq.category || '') : ''}">
          </div>
          
          <div class="action-buttons">
            <button type="submit" class="btn btn-primary">${faq ? 'Update' : 'Create'} FAQ</button>
            <button type="button" class="btn btn-secondary" id="closeModal">Cancel</button>
          </div>
        </form>
      </div>
    `;

    document.body.appendChild(modal);

    modal.querySelector('#closeModal').addEventListener('click', () => modal.remove());
    modal.addEventListener('click', e => {
      if (e.target === modal) {
        modal.remove();
      }
    });

    modal.querySelector('#faqForm').addEventListener('submit', async e => {
      e.preventDefault();

      const data = {
        question: document.getElementById('faqQuestion').value,
        answer: document.getElementById('faqAnswer').value,
        category: document.getElementById('faqCategory').value || 'General',
      };

      try {
        if (faq) {
          await AdminShared.api(`/api/admin/content/faqs/${faq.id}`, 'PUT', data);
        } else {
          await AdminShared.api('/api/admin/content/faqs', 'POST', data);
        }
        AdminShared.showToast('FAQ saved successfully', 'success');
        modal.remove();
        loadFAQs();
      } catch (err) {
        AdminShared.showToast(`Failed to save: ${err.message}`, 'error');
      }
    });
  }

  // Load FAQs
  async function loadFAQs() {
    try {
      const faqs = await AdminShared.api('/api/admin/content/faqs');
      const container = document.getElementById('faqsList');

      if (!faqs || faqs.length === 0) {
        container.innerHTML = '<p class="small">No FAQs yet. Click "Add FAQ" to create one.</p>';
        return;
      }

      container.innerHTML = faqs
        .map(f => {
          const escapedId = AdminShared.escapeHtml(f.id);
          return `
          <div class="faq-item" data-id="${escapedId}">
            <div class="flex-between-start">
              <div class="flex-1">
                <strong>${AdminShared.escapeHtml(f.question)}</strong>
                <p class="small" style="margin:0.5rem 0 0 0;">${AdminShared.escapeHtml(f.answer)}</p>
                <div class="small" style="margin-top:0.5rem;color:#9ca3af;">Category: ${AdminShared.escapeHtml(f.category || 'General')}</div>
              </div>
              <div class="flex-gap">
                <button class="btn btn-secondary btn-small" data-action="edit" data-id="${escapedId}">Edit</button>
                <button class="btn btn-danger btn-small" data-action="delete" data-id="${escapedId}">Delete</button>
              </div>
            </div>
          </div>
        `;
        })
        .join('');

      // Add event delegation
      container.querySelectorAll('button[data-action]').forEach(btn => {
        btn.addEventListener('click', e => {
          const action = e.target.dataset.action;
          const id = e.target.dataset.id;
          if (action === 'edit') {
            editFAQ(id);
          } else if (action === 'delete') {
            deleteFAQ(id);
          }
        });
      });
    } catch (err) {
      document.getElementById('faqsList').innerHTML =
        '<p class="small" style="color:#ef4444;">Failed to load FAQs</p>';
    }
  }

  // Load featured packages
  async function loadFeaturedPackages() {
    try {
      const packages = await AdminShared.api('/api/admin/packages?featured=true');
      const container = document.getElementById('featuredPackagesList');

      if (!packages || !packages.items || packages.items.length === 0) {
        container.innerHTML =
          '<p class="small">No featured packages. Go to Package Management to feature packages.</p>';
        return;
      }

      container.innerHTML = packages.items
        .map(p => {
          const escapedId = AdminShared.escapeHtml(p.id);
          return `
          <div style="padding:1rem;background:#f9fafb;border-radius:4px;margin-bottom:0.5rem;" data-id="${escapedId}">
            <div class="flex-between">
              <div>
                <strong>${AdminShared.escapeHtml(p.title)}</strong>
                <div class="small">Supplier: ${AdminShared.escapeHtml(p.supplierName || 'Unknown')}</div>
              </div>
              <button class="btn btn-danger btn-small" data-action="unfeature" data-id="${escapedId}">Remove Featured</button>
            </div>
          </div>
        `;
        })
        .join('');

      // Add event delegation
      container.querySelectorAll('button[data-action="unfeature"]').forEach(btn => {
        btn.addEventListener('click', e => {
          const id = e.target.dataset.id;
          unfeaturePackage(id);
        });
      });
    } catch (err) {
      document.getElementById('featuredPackagesList').innerHTML =
        '<p class="small" style="color:#ef4444;">Failed to load featured packages</p>';
    }
  }

  // Global functions for inline onclick handlers
  window.editAnnouncement = async id => {
    try {
      const announcement = await AdminShared.api(`/api/admin/content/announcements/${id}`);
      showAnnouncementModal(announcement);
    } catch (err) {
      AdminShared.showToast(`Failed to load announcement: ${err.message}`, 'error');
    }
  };

  window.deleteAnnouncement = async id => {
    if (
      !(await AdminShared.showConfirmModal({
        title: 'Delete',
        message: 'Delete this announcement?',
        confirmText: 'Delete',
      }))
    ) {
      return;
    }

    try {
      await AdminShared.api(`/api/admin/content/announcements/${id}`, 'DELETE');
      AdminShared.showToast('Announcement deleted', 'success');
      loadAnnouncements();
    } catch (err) {
      AdminShared.showToast(`Failed to delete: ${err.message}`, 'error');
    }
  };

  window.editFAQ = async id => {
    try {
      const faq = await AdminShared.api(`/api/admin/content/faqs/${id}`);
      showFAQModal(faq);
    } catch (err) {
      AdminShared.showToast(`Failed to load FAQ: ${err.message}`, 'error');
    }
  };

  window.deleteFAQ = async id => {
    if (
      !(await AdminShared.showConfirmModal({
        title: 'Delete',
        message: 'Delete this FAQ?',
        confirmText: 'Delete',
      }))
    ) {
      return;
    }

    try {
      await AdminShared.api(`/api/admin/content/faqs/${id}`, 'DELETE');
      AdminShared.showToast('FAQ deleted', 'success');
      loadFAQs();
    } catch (err) {
      AdminShared.showToast(`Failed to delete: ${err.message}`, 'error');
    }
  };

  window.unfeaturePackage = async id => {
    if (
      !(await AdminShared.showConfirmModal({
        title: 'Remove Featured',
        message: 'Remove this package from featured?',
        confirmText: 'Remove',
      }))
    ) {
      return;
    }

    try {
      await AdminShared.api(`/api/admin/packages/${id}/feature`, 'POST', { featured: false });
      AdminShared.showToast('Package unfeatured', 'success');
      loadFeaturedPackages();
    } catch (err) {
      AdminShared.showToast(`Failed to update: ${err.message}`, 'error');
    }
  };

  // Initial load
  loadHomepageContent();
  loadAnnouncements();
  loadFAQs();
  loadFeaturedPackages();
})();
