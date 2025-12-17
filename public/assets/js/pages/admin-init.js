(function () {
  // Defensive error logging wrapper
  function safeExecute(fn, context) {
    try {
      return fn.call(context);
    } catch (err) {
      console.error('Admin page error:', err);
      return null;
    }
  }

  // HTML sanitization helper to prevent XSS
  function escapeHtml(unsafe) {
    if (!unsafe) {
      return '';
    }
    return String(unsafe)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#039;');
  }

  function api(url, method, body) {
    const opts = {
      method: method || 'GET',
      headers: {
        'Content-Type': 'application/json',
      },
    };

    // Add CSRF token for state-changing requests
    if (method && ['POST', 'PUT', 'DELETE'].includes(method.toUpperCase())) {
      if (window.__CSRF_TOKEN__) {
        opts.headers['X-CSRF-Token'] = window.__CSRF_TOKEN__;
      }
    }

    if (body) {
      opts.body = JSON.stringify(body);
    }
    return fetch(url, opts)
      .then(r => {
        // Check content type before parsing
        const contentType = r.headers.get('content-type');
        const isJson = contentType && contentType.includes('application/json');

        if (isJson) {
          return r.json().then(data => {
            if (!r.ok) {
              const err = data && data.error ? data.error : `Request failed with ${r.status}`;
              throw new Error(err);
            }
            return data;
          });
        } else {
          // Handle non-JSON responses (like plain text errors)
          return r.text().then(text => {
            if (!r.ok) {
              throw new Error(text || `Request failed with ${r.status}`);
            }
            // Try to parse as JSON anyway for successful responses
            try {
              return JSON.parse(text);
            } catch (e) {
              return { message: text };
            }
          });
        }
      })
      .catch(err => {
        console.error('API error:', url, err);
        throw err;
      });
  }
  let allUsers = [];

  function renderUsersTable(list) {
    const el = document.getElementById('users');
    if (!el) {
      return;
    }

    let rows =
      '<tr><th>Name</th><th>Email</th><th>Role</th><th>Verified</th><th>Joined</th><th>Last login</th><th>Actions</th></tr>';

    (list || []).forEach(u => {
      const joined = u.createdAt ? new Date(u.createdAt).toLocaleString() : '—';
      const last = u.lastLoginAt ? new Date(u.lastLoginAt).toLocaleString() : '—';
      const verifiedBadge = u.verified
        ? '<span class="badge badge-yes">Yes</span>'
        : '<span class="badge badge-no">No</span>';

      const isOwner = u.email === 'admin@event-flow.co.uk';
      const isAdmin = u.role === 'admin';

      let actions = '<div style="display:flex;gap:4px;flex-wrap:wrap;">';
      actions += `<button data-action="editUser" data-id="${u.id}">Edit</button>`;

      // Manual verification button for unverified users (not shown for owner account)
      if (!u.verified && !isOwner) {
        actions += `<button data-action="verifyUser" data-id="${u.id}">Verify Email</button>`;
      }

      // Admin privilege toggle (only for non-owner accounts)
      if (!isOwner) {
        if (isAdmin) {
          actions += `<button data-action="revokeAdmin" data-id="${u.id}">Revoke Admin</button>`;
        } else {
          actions += `<button data-action="grantAdmin" data-id="${u.id}">Grant Admin</button>`;
        }
      }

      // Delete button (disabled for owner)
      if (!isOwner) {
        actions += `<button data-action="deleteUser" data-id="${u.id}">Delete</button>`;
      }

      actions += '</div>';

      rows +=
        `<tr>` +
        `<td>${u.name || ''}</td>` +
        `<td>${u.email || ''}</td>` +
        `<td>${u.role || ''}${
          isOwner ? ' <span class="badge" style="background:#9f1239;color:#fff;">OWNER</span>' : ''
        }</td>` +
        `<td>${verifiedBadge}</td>` +
        `<td>${joined}</td>` +
        `<td>${last}</td>` +
        `<td>${actions}</td>` +
        `</tr>`;
    });

    el.innerHTML = rows;
  }

  function applyUserFilters() {
    const searchEl = document.getElementById('userSearch');
    const filterEl = document.getElementById('userDateFilter');
    let list = Array.isArray(allUsers) ? allUsers.slice() : [];

    const term = ((searchEl && searchEl.value) || '').toLowerCase();
    if (term) {
      list = list.filter(u => {
        const name = (u.name || '').toLowerCase();
        const email = (u.email || '').toLowerCase();
        return name.indexOf(term) !== -1 || email.indexOf(term) !== -1;
      });
    }

    const rangeVal = filterEl ? filterEl.value : 'all';
    if (rangeVal !== 'all') {
      const days = parseInt(rangeVal, 10);
      const now = Date.now();
      const cutoff = now - days * 24 * 60 * 60 * 1000;
      list = list.filter(u => {
        if (!u.createdAt) {
          return false;
        }
        const t = Date.parse(u.createdAt);
        if (!t || isNaN(t)) {
          return false;
        }
        return t >= cutoff;
      });
    }

    renderUsersTable(list);
  }

  function renderSuppliersTable(resp) {
    const el = document.getElementById('suppliers');
    if (!el) {
      return;
    }

    let rows =
      '<tr><th>Name</th><th>Approved</th><th>Pro plan</th><th>Score</th><th>Tags</th><th>Actions</th></tr>';
    const items = (resp && resp.items) || [];

    if (!items.length) {
      el.innerHTML = '<tr><td colspan="6">No suppliers yet.</td></tr>';
      return;
    }

    items.forEach(s => {
      let plan;
      if (s.isPro) {
        if (s.proExpiresAt) {
          try {
            const d = new Date(s.proExpiresAt);
            plan = `Pro until ${d.toLocaleDateString()}`;
          } catch (_e) {
            plan = 'Pro (active)';
          }
        } else {
          plan = 'Pro (active)';
        }
      } else {
        plan = 'None';
      }
      const score = typeof s.healthScore === 'number' ? s.healthScore.toFixed(0) : '—';
      const tags = (s.tags || []).join(', ');

      const selectId = `pro-duration-${s.id}`;
      const actions =
        `<div style="display:flex;gap:4px;flex-wrap:wrap;flex-direction:column;">` +
        `<div style="display:flex;gap:4px;">` +
        `<button data-action="editSupplier" data-id="${s.id}">Edit</button>` +
        `<button data-action="approveSup" data-id="${s.id}">Approve</button>` +
        `<button data-action="rejectSup" data-id="${s.id}">Reject</button>` +
        `<button data-action="deleteSupplier" data-id="${s.id}">Delete</button>` +
        `</div>` +
        `<div class="small" style="margin-top:4px;">` +
        `Pro trial: ` +
        `<select id="${selectId}">` +
        `<option value="">Choose length…</option>` +
        `<option value="1d">1 day</option>` +
        `<option value="7d">7 days</option>` +
        `<option value="1m">1 month</option>` +
        `<option value="1y">1 year</option>` +
        `</select>` +
        `<button data-action="setProPlan" data-id="${s.id}" data-param="duration">Set</button>` +
        `<button data-action="setProPlan" data-id="${s.id}" data-param="cancel">Cancel</button>` +
        `</div>` +
        `</div>`;

      rows += `<tr><td>${s.name}</td><td>${s.approved ? 'Yes' : 'No'}</td><td>${plan}</td><td>${
        score
      }</td><td>${tags}</td><td>${actions}</td></tr>`;
    });

    el.innerHTML = rows;
  }

  function renderPackagesTable(resp) {
    const el = document.getElementById('packages');
    if (!el) {
      return;
    }

    let rows = '<tr><th>Title</th><th>Approved</th><th>Featured</th><th>Actions</th></tr>';
    const items = (resp && resp.items) || [];

    if (!items.length) {
      el.innerHTML = '<tr><td colspan="4">No packages yet.</td></tr>';
      return;
    }

    items.forEach(p => {
      rows +=
        `<tr><td>${p.title}</td><td>${p.approved ? 'Yes' : 'No'}</td>` +
        `<td>${p.featured ? 'Yes' : 'No'}</td>` +
        `<td>` +
        `<button data-action="editPackage" data-id="${p.id}">Edit</button>` +
        `<button data-action="approvePkg" data-id="${p.id}" data-param="true">Approve</button>` +
        `<button data-action="approvePkg" data-id="${p.id}" data-param="false">Unapprove</button>` +
        `<button data-action="featurePkg" data-id="${p.id}" data-param="true">Feature</button>` +
        `<button data-action="featurePkg" data-id="${p.id}" data-param="false">Unfeature</button>` +
        `<button data-action="deletePackage" data-id="${p.id}">Delete</button>` +
        `</td></tr>`;
    });

    el.innerHTML = rows;
  }

  function renderAnalytics(metrics) {
    const el = document.getElementById('analytics');
    if (!el) {
      return;
    }

    const counts = (metrics && metrics.counts) || {};
    const byRole = counts.usersByRole || {};
    const roleParts =
      Object.keys(byRole)
        .map(r => {
          return `${r}: ${byRole[r]}`;
        })
        .join(', ') || '—';

    const usersList = Array.isArray(allUsers) && allUsers.length ? allUsers : [];
    function countSince(days) {
      const now = Date.now();
      const cutoff = now - days * 24 * 60 * 60 * 1000;
      return usersList.filter(u => {
        if (!u.createdAt) {
          return false;
        }
        const t = Date.parse(u.createdAt);
        if (!t || isNaN(t)) {
          return false;
        }
        return t >= cutoff;
      }).length;
    }

    const last7 = countSince(7);
    const last30 = countSince(30);

    function bar(n) {
      let c = n;
      if (c > 20) {
        c = 20;
      }
      let out = '';
      for (let i = 0; i < c; i++) {
        out += '▮';
      }
      return out;
    }

    el.innerHTML =
      `<div class="card">` +
      `<p><b>Total Users:</b> ${counts.usersTotal || 0}</p>` +
      `<p><b>Users by role:</b> ${roleParts}</p>` +
      `<p><b>Total Suppliers:</b> ${counts.suppliersTotal || 0}</p>` +
      `<p><b>Total Packages:</b> ${counts.packagesTotal || 0}</p>` +
      `<p><b>Signups last 7 days:</b> ${last7} <span class="small">${bar(last7)}</span></p>` +
      `<p><b>Signups last 30 days:</b> ${last30} <span class="small">${bar(last30)}</span></p>` +
      `<p class="small">Plans: ${counts.plansTotal || 0} · Threads: ${
        counts.threadsTotal || 0
      } · Messages: ${counts.messagesTotal || 0}</p>` +
      `</div>`;
  }

  function loadAll() {
    const statusEl = document.getElementById('status');
    if (statusEl) {
      statusEl.innerText = 'Checking admin…';
    }

    api('/api/auth/me')
      .then(me => {
        if (!me || !me.user || me.user.role !== 'admin') {
          if (statusEl) {
            statusEl.innerText = 'Not admin / not logged in.';
          }
          return;
        }

        if (statusEl) {
          statusEl.innerText = 'Loading data…';
        }

        return Promise.all([
          api('/api/admin/suppliers'),
          api('/api/admin/packages'),
          api('/api/admin/users'),
          api('/api/admin/metrics'),
          api('/api/admin/photos/pending').catch(() => ({ photos: [] })),
          api('/api/admin/reviews/pending').catch(() => ({ reviews: [] })),
        ]).then(results => {
          const suppliersResp = results[0] || {};
          const packagesResp = results[1] || {};
          const usersResp = results[2] || {};
          const metricsResp = results[3] || {};
          const photosResp = results[4] || {};
          const reviewsResp = results[5] || {};

          allUsers = usersResp.items || [];
          renderSuppliersTable(suppliersResp);
          renderPackagesTable(packagesResp);
          applyUserFilters();
          renderAnalytics(metricsResp);

          // Update moderation queue counts
          const pendingPhotos = (photosResp.photos || []).filter(p => !p.approved && !p.rejected);
          const pendingReviews = (reviewsResp.reviews || []).filter(
            r => !r.approved && !r.rejected
          );

          const photosEl = document.getElementById('pendingPhotosCount');
          const reviewsEl = document.getElementById('pendingReviewsCount');
          const reportsEl = document.getElementById('pendingReportsCount');
          const suppliersVerificationEl = document.getElementById(
            'pendingSupplierVerificationCount'
          );

          if (photosEl) {
            photosEl.innerText = pendingPhotos.length;
          }
          if (reviewsEl) {
            reviewsEl.innerText = pendingReviews.length;
          }

          // Fetch pending reports count
          api('/api/admin/reports/pending', 'GET')
            .then(reportsResp => {
              if (reportsEl) {
                reportsEl.innerText = reportsResp.count || 0;
              }
            })
            .catch(err => {
              console.error('Error loading pending reports:', err);
              if (reportsEl) {
                reportsEl.innerText = '?';
              }
            });

          // Fetch pending supplier verifications
          api('/api/admin/suppliers/pending-verification', 'GET')
            .then(suppliersResp => {
              if (suppliersVerificationEl) {
                suppliersVerificationEl.innerText = suppliersResp.count || 0;
              }
            })
            .catch(err => {
              console.error('Error loading pending supplier verifications:', err);
              if (suppliersVerificationEl) {
                suppliersVerificationEl.innerText = '?';
              }
            });

          if (statusEl) {
            statusEl.innerText = `Loaded ${allUsers.length} users.`;
          }
        });
      })
      .catch(err => {
        console.error('Error loading admin', err);
        if (statusEl) {
          statusEl.innerText = 'Error loading admin.';
        }
      });
  }

  window.approveSup = function (id) {
    return safeExecute(() => {
      if (typeof Modal !== 'undefined') {
        const modal = new Modal({
          title: 'Approve Supplier',
          content: '<p>Are you sure you want to approve this supplier?</p>',
          confirmText: 'Approve',
          cancelText: 'Cancel',
          onConfirm: function () {
            api(`/api/admin/suppliers/${id}/approve`, 'POST', { approved: true })
              .then(() => {
                if (typeof Toast !== 'undefined') {
                  Toast.success('Supplier approved.');
                } else {
                  alert('Supplier approved.');
                }
                loadAll();
              })
              .catch(err => {
                console.error('approveSup failed', err);
                if (typeof Toast !== 'undefined') {
                  Toast.error(`Failed to approve supplier: ${err.message}`);
                } else {
                  alert(`Failed to approve supplier: ${err.message}`);
                }
              });
          },
        });
        modal.show();
      } else {
        // Fallback to confirm dialog
        api(`/api/admin/suppliers/${id}/approve`, 'POST', { approved: true })
          .then(() => {
            alert('Supplier approved.');
            loadAll();
          })
          .catch(err => {
            console.error('approveSup failed', err);
            alert(`Failed to approve supplier: ${err.message}`);
          });
      }
    });
  };

  window.rejectSup = function (id) {
    return safeExecute(() => {
      if (typeof Modal !== 'undefined') {
        const modal = new Modal({
          title: 'Reject Supplier',
          content: '<p>Are you sure you want to reject this supplier?</p>',
          confirmText: 'Reject',
          cancelText: 'Cancel',
          onConfirm: function () {
            api(`/api/admin/suppliers/${id}/approve`, 'POST', { approved: false })
              .then(() => {
                if (typeof Toast !== 'undefined') {
                  Toast.success('Supplier rejected.');
                } else {
                  alert('Supplier rejected.');
                }
                loadAll();
              })
              .catch(err => {
                console.error('rejectSup failed', err);
                if (typeof Toast !== 'undefined') {
                  Toast.error(`Failed to reject supplier: ${err.message}`);
                } else {
                  alert(`Failed to reject supplier: ${err.message}`);
                }
              });
          },
        });
        modal.show();
      } else {
        // Fallback to confirm dialog
        api(`/api/admin/suppliers/${id}/approve`, 'POST', { approved: false })
          .then(() => {
            alert('Supplier rejected.');
            loadAll();
          })
          .catch(err => {
            console.error('rejectSup failed', err);
            alert(`Failed to reject supplier: ${err.message}`);
          });
      }
    });
  };

  window.setProPlan = function (id, mode) {
    if (mode === 'duration') {
      const sel = document.getElementById(`pro-duration-${id}`);
      if (!sel || !sel.value) {
        if (typeof Toast !== 'undefined') {
          Toast.warning('Choose a duration first.');
        } else {
          alert('Choose a duration first.');
        }
        return;
      }
      api(`/api/admin/suppliers/${id}/pro`, 'POST', {
        mode: 'duration',
        duration: sel.value,
      })
        .then(() => {
          if (typeof Toast !== 'undefined') {
            Toast.success('Pro trial set for supplier.');
          } else {
            alert('Pro trial set for supplier.');
          }
          loadAll();
        })
        .catch(err => {
          console.error('setProPlan (duration) failed', err);
          if (typeof Toast !== 'undefined') {
            Toast.error(`Failed to set Pro trial: ${err.message}`);
          } else {
            alert(`Failed to set Pro trial: ${err.message}`);
          }
        });
    } else if (mode === 'cancel') {
      if (typeof Modal !== 'undefined') {
        const modal = new Modal({
          title: 'Cancel Pro Plan',
          content: '<p>Remove Pro for this supplier?</p>',
          confirmText: 'Cancel Pro',
          cancelText: 'Keep Pro',
          onConfirm: function () {
            api(`/api/admin/suppliers/${id}/pro`, 'POST', { mode: 'cancel' })
              .then(() => {
                if (typeof Toast !== 'undefined') {
                  Toast.success('Pro plan cancelled for supplier.');
                } else {
                  alert('Pro plan cancelled for supplier.');
                }
                loadAll();
              })
              .catch(err => {
                console.error('setProPlan (cancel) failed', err);
                if (typeof Toast !== 'undefined') {
                  Toast.error(`Failed to cancel Pro plan: ${err.message}`);
                } else {
                  alert(`Failed to cancel Pro plan: ${err.message}`);
                }
              });
          },
        });
        modal.show();
      } else {
        if (!confirm('Remove Pro for this supplier?')) {
          return;
        }
        api(`/api/admin/suppliers/${id}/pro`, 'POST', { mode: 'cancel' })
          .then(() => {
            alert('Pro plan cancelled for supplier.');
            loadAll();
          })
          .catch(err => {
            console.error('setProPlan (cancel) failed', err);
            alert(`Failed to cancel Pro plan: ${err.message}`);
          });
      }
    }
  };

  window.approvePkg = function (id, approved) {
    return safeExecute(() => {
      const action = approved ? 'approve' : 'unapprove';
      api(`/api/admin/packages/${id}/approve`, 'POST', { approved: approved })
        .then(() => {
          if (typeof Toast !== 'undefined') {
            Toast.success(`Package ${action}d successfully.`);
          } else {
            alert(`Package ${action}d successfully.`);
          }
          loadAll();
        })
        .catch(err => {
          console.error('approvePkg failed', err);
          if (typeof Toast !== 'undefined') {
            Toast.error(`Failed to ${action} package: ${err.message}`);
          } else {
            alert(`Failed to ${action} package: ${err.message}`);
          }
        });
    });
  };

  window.featurePkg = function (id, featured) {
    return safeExecute(() => {
      const action = featured ? 'feature' : 'unfeature';
      api(`/api/admin/packages/${id}/feature`, 'POST', { featured: featured })
        .then(() => {
          if (typeof Toast !== 'undefined') {
            Toast.success(`Package ${action}d successfully.`);
          } else {
            alert(`Package ${action}d successfully.`);
          }
          loadAll();
        })
        .catch(err => {
          console.error('featurePkg failed', err);
          if (typeof Toast !== 'undefined') {
            Toast.error(`Failed to ${action} package: ${err.message}`);
          } else {
            alert(`Failed to ${action} package: ${err.message}`);
          }
        });
    });
  };

  window.disableUser = function (id) {
    api(`/api/admin/users/${id}/disable`, 'POST', { disabled: true })
      .then(loadAll)
      .catch(err => {
        console.error('disableUser failed', err);
      });
  };

  // New user management functions
  window.deleteUser = function (id) {
    if (typeof Modal !== 'undefined') {
      const modal = new Modal({
        title: 'Delete User',
        content: '<p>Are you sure you want to delete this user? This action cannot be undone.</p>',
        confirmText: 'Delete',
        cancelText: 'Cancel',
        onConfirm: function () {
          api(`/api/admin/users/${id}`, 'DELETE')
            .then(() => {
              if (typeof Toast !== 'undefined') {
                Toast.success('User deleted successfully.');
              } else {
                alert('User deleted successfully.');
              }
              loadAll();
            })
            .catch(err => {
              console.error('deleteUser failed', err);
              if (typeof Toast !== 'undefined') {
                Toast.error(`Failed to delete user: ${err.message}`);
              } else {
                alert(`Failed to delete user: ${err.message}`);
              }
            });
        },
      });
      modal.show();
    } else {
      if (!confirm('Are you sure you want to delete this user? This action cannot be undone.')) {
        return;
      }
      api(`/api/admin/users/${id}`, 'DELETE')
        .then(() => {
          alert('User deleted successfully.');
          loadAll();
        })
        .catch(err => {
          console.error('deleteUser failed', err);
          alert(`Failed to delete user: ${err.message}`);
        });
    }
  };

  window.editUser = function (id) {
    const user = allUsers.find(u => {
      return u.id === id;
    });
    if (!user) {
      if (typeof Toast !== 'undefined') {
        Toast.error('User not found');
      } else {
        alert('User not found');
      }
      return;
    }

    // Create modal content with form
    const content = document.createElement('div');
    content.innerHTML =
      `<div style="display: grid; gap: 1rem;">` +
      `<div><label style="display:block;margin-bottom:4px;font-weight:600;">Name</label>` +
      `<input type="text" id="edit-user-name" value="${
        user.name || ''
      }" style="width:100%;padding:8px;border:1px solid #d4d4d8;border-radius:4px;"></div>` +
      `<div><label style="display:block;margin-bottom:4px;font-weight:600;">Email</label>` +
      `<input type="email" id="edit-user-email" value="${
        user.email || ''
      }" style="width:100%;padding:8px;border:1px solid #d4d4d8;border-radius:4px;"></div>` +
      `</div>`;

    if (typeof Modal !== 'undefined') {
      const modal = new Modal({
        title: 'Edit User',
        content: content,
        confirmText: 'Save',
        cancelText: 'Cancel',
        onConfirm: function () {
          const name = document.getElementById('edit-user-name').value;
          const email = document.getElementById('edit-user-email').value;

          api(`/api/admin/users/${id}`, 'PUT', { name: name, email: email })
            .then(() => {
              if (typeof Toast !== 'undefined') {
                Toast.success('User updated successfully.');
              } else {
                alert('User updated successfully.');
              }
              loadAll();
            })
            .catch(err => {
              console.error('editUser failed', err);
              if (typeof Toast !== 'undefined') {
                Toast.error(`Failed to update user: ${err.message}`);
              } else {
                alert(`Failed to update user: ${err.message}`);
              }
            });
        },
      });
      modal.show();
    } else {
      // Fallback to prompt
      const name = prompt('Enter new name:', user.name || '');
      if (name === null) {
        return;
      }

      const email = prompt('Enter new email:', user.email || '');
      if (email === null) {
        return;
      }

      api(`/api/admin/users/${id}`, 'PUT', { name: name, email: email })
        .then(() => {
          alert('User updated successfully.');
          loadAll();
        })
        .catch(err => {
          console.error('editUser failed', err);
          alert(`Failed to update user: ${err.message}`);
        });
    }
  };

  window.grantAdmin = function (id) {
    if (typeof Modal !== 'undefined') {
      const modal = new Modal({
        title: 'Grant Admin Privileges',
        content: '<p>Grant admin privileges to this user?</p>',
        confirmText: 'Grant Admin',
        cancelText: 'Cancel',
        onConfirm: function () {
          api(`/api/admin/users/${id}/grant-admin`, 'POST')
            .then(() => {
              if (typeof Toast !== 'undefined') {
                Toast.success('Admin privileges granted successfully.');
              } else {
                alert('Admin privileges granted successfully.');
              }
              loadAll();
            })
            .catch(err => {
              console.error('grantAdmin failed', err);
              if (typeof Toast !== 'undefined') {
                Toast.error(`Failed to grant admin privileges: ${err.message}`);
              } else {
                alert(`Failed to grant admin privileges: ${err.message}`);
              }
            });
        },
      });
      modal.show();
    } else {
      if (!confirm('Grant admin privileges to this user?')) {
        return;
      }
      api(`/api/admin/users/${id}/grant-admin`, 'POST')
        .then(() => {
          alert('Admin privileges granted successfully.');
          loadAll();
        })
        .catch(err => {
          console.error('grantAdmin failed', err);
          alert(`Failed to grant admin privileges: ${err.message}`);
        });
    }
  };

  window.revokeAdmin = function (id) {
    // Create modal content with role selection
    const content = document.createElement('div');
    content.innerHTML =
      '<p>Revoke admin privileges from this user?</p>' +
      '<div style="margin-top: 1rem;"><label style="display:block;margin-bottom:4px;font-weight:600;">New Role</label>' +
      '<select id="revoke-admin-role" style="width:100%;padding:8px;border:1px solid #d4d4d8;border-radius:4px;">' +
      '<option value="customer">Customer</option>' +
      '<option value="supplier">Supplier</option>' +
      '</select></div>';

    if (typeof Modal !== 'undefined') {
      const modal = new Modal({
        title: 'Revoke Admin Privileges',
        content: content,
        confirmText: 'Revoke Admin',
        cancelText: 'Cancel',
        onConfirm: function () {
          const newRole = document.getElementById('revoke-admin-role').value;

          api(`/api/admin/users/${id}/revoke-admin`, 'POST', { newRole: newRole })
            .then(() => {
              if (typeof Toast !== 'undefined') {
                Toast.success('Admin privileges revoked successfully.');
              } else {
                alert('Admin privileges revoked successfully.');
              }
              loadAll();
            })
            .catch(err => {
              console.error('revokeAdmin failed', err);
              if (typeof Toast !== 'undefined') {
                Toast.error(`Failed to revoke admin privileges: ${err.message}`);
              } else {
                alert(`Failed to revoke admin privileges: ${err.message}`);
              }
            });
        },
      });
      modal.show();
    } else {
      if (!confirm('Revoke admin privileges from this user?')) {
        return;
      }
      const newRole = prompt('Enter new role (customer or supplier):', 'customer');
      if (!newRole) {
        return;
      }

      api(`/api/admin/users/${id}/revoke-admin`, 'POST', { newRole: newRole })
        .then(() => {
          alert('Admin privileges revoked successfully.');
          loadAll();
        })
        .catch(err => {
          console.error('revokeAdmin failed', err);
          alert(`Failed to revoke admin privileges: ${err.message}`);
        });
    }
  };

  window.verifyUser = function (id) {
    if (typeof Modal !== 'undefined') {
      const modal = new Modal({
        title: 'Verify User Email',
        content: "<p>Manually verify this user's email address?</p>",
        confirmText: 'Verify',
        cancelText: 'Cancel',
        onConfirm: function () {
          api(`/api/admin/users/${id}/verify`, 'POST')
            .then(() => {
              if (typeof Toast !== 'undefined') {
                Toast.success('User verified successfully.');
              } else {
                alert('User verified successfully.');
              }
              loadAll();
            })
            .catch(err => {
              console.error('verifyUser failed', err);
              if (typeof Toast !== 'undefined') {
                Toast.error(`Failed to verify user: ${err.message}`);
              } else {
                alert(`Failed to verify user: ${err.message}`);
              }
            });
        },
      });
      modal.show();
    } else {
      if (!confirm("Manually verify this user's email address?")) {
        return;
      }
      api(`/api/admin/users/${id}/verify`, 'POST')
        .then(() => {
          if (typeof Toast !== 'undefined') {
            Toast.success('User verified successfully.');
          } else {
            alert('User verified successfully.');
          }
          loadAll();
        })
        .catch(err => {
          console.error('verifyUser failed', err);
          if (typeof Toast !== 'undefined') {
            Toast.error(`Failed to verify user: ${err.message}`);
          } else {
            alert(`Failed to verify user: ${err.message}`);
          }
        });
    }
  };

  // Supplier management functions
  window.deleteSupplier = function (id) {
    return safeExecute(() => {
      if (typeof Modal !== 'undefined') {
        const modal = new Modal({
          title: 'Delete Supplier',
          content:
            '<p>Are you sure you want to delete this supplier and all associated packages? This action cannot be undone.</p>',
          confirmText: 'Delete',
          cancelText: 'Cancel',
          onConfirm: function () {
            api(`/api/admin/suppliers/${id}`, 'DELETE')
              .then(() => {
                if (typeof Toast !== 'undefined') {
                  Toast.success('Supplier deleted successfully.');
                } else {
                  alert('Supplier deleted successfully.');
                }
                loadAll();
              })
              .catch(err => {
                console.error('deleteSupplier failed', err);
                if (typeof Toast !== 'undefined') {
                  Toast.error(`Failed to delete supplier: ${err.message}`);
                } else {
                  alert(`Failed to delete supplier: ${err.message}`);
                }
              });
          },
        });
        modal.show();
      } else {
        if (
          !confirm(
            'Are you sure you want to delete this supplier and all associated packages? This action cannot be undone.'
          )
        ) {
          return;
        }
        api(`/api/admin/suppliers/${id}`, 'DELETE')
          .then(() => {
            alert('Supplier deleted successfully.');
            loadAll();
          })
          .catch(err => {
            console.error('deleteSupplier failed', err);
            alert(`Failed to delete supplier: ${err.message}`);
          });
      }
    });
  };

  window.editSupplier = function (id) {
    // Find supplier in current data
    api('/api/admin/suppliers')
      .then(resp => {
        const suppliers = (resp && resp.items) || [];
        const supplier = suppliers.find(s => {
          return s.id === id;
        });

        if (!supplier) {
          if (typeof Toast !== 'undefined') {
            Toast.error('Supplier not found');
          } else {
            alert('Supplier not found');
          }
          return;
        }

        // Create modal content
        const content = document.createElement('div');
        content.innerHTML =
          `<div style="display: grid; gap: 1rem;">` +
          `<div><label style="display:block;margin-bottom:4px;font-weight:600;">Name</label>` +
          `<input type="text" id="edit-sup-name" value="${escapeHtml(
            supplier.name || ''
          )}" style="width:100%;padding:8px;border:1px solid #d4d4d8;border-radius:4px;"></div>` +
          `<div><label style="display:block;margin-bottom:4px;font-weight:600;">Category</label>` +
          `<input type="text" id="edit-sup-category" value="${escapeHtml(
            supplier.category || ''
          )}" style="width:100%;padding:8px;border:1px solid #d4d4d8;border-radius:4px;"></div>` +
          `<div><label style="display:block;margin-bottom:4px;font-weight:600;">Location</label>` +
          `<input type="text" id="edit-sup-location" value="${escapeHtml(
            supplier.location || ''
          )}" style="width:100%;padding:8px;border:1px solid #d4d4d8;border-radius:4px;"></div>` +
          `<div><label style="display:block;margin-bottom:4px;font-weight:600;">Price Display</label>` +
          `<input type="text" id="edit-sup-price" value="${escapeHtml(
            supplier.price_display || ''
          )}" style="width:100%;padding:8px;border:1px solid #d4d4d8;border-radius:4px;"></div>` +
          `<div><label style="display:block;margin-bottom:4px;font-weight:600;">Website</label>` +
          `<input type="url" id="edit-sup-website" value="${escapeHtml(
            supplier.website || ''
          )}" style="width:100%;padding:8px;border:1px solid #d4d4d8;border-radius:4px;"></div>` +
          `<div><label style="display:block;margin-bottom:4px;font-weight:600;">Email</label>` +
          `<input type="email" id="edit-sup-email" value="${escapeHtml(
            supplier.email || ''
          )}" style="width:100%;padding:8px;border:1px solid #d4d4d8;border-radius:4px;"></div>` +
          `<div><label style="display:block;margin-bottom:4px;font-weight:600;">Max Guests</label>` +
          `<input type="number" id="edit-sup-maxGuests" value="${escapeHtml(
            supplier.maxGuests || ''
          )}" style="width:100%;padding:8px;border:1px solid #d4d4d8;border-radius:4px;"></div>` +
          `<div><label style="display:block;margin-bottom:4px;font-weight:600;">Short Description</label>` +
          `<textarea id="edit-sup-desc-short" rows="2" style="width:100%;padding:8px;border:1px solid #d4d4d8;border-radius:4px;">${escapeHtml(
            supplier.description_short || ''
          )}</textarea></div>` +
          `<div><label style="display:block;margin-bottom:4px;font-weight:600;">Long Description</label>` +
          `<textarea id="edit-sup-desc-long" rows="4" style="width:100%;padding:8px;border:1px solid #d4d4d8;border-radius:4px;">${escapeHtml(
            supplier.description_long || ''
          )}</textarea></div>` +
          `</div>`;

        // Create modal
        if (typeof Modal !== 'undefined') {
          const modal = new Modal({
            title: `Edit Supplier: ${escapeHtml(supplier.name)}`,
            content: content,
            confirmText: 'Save Changes',
            cancelText: 'Cancel',
            onConfirm: function () {
              const updateData = {
                name: document.getElementById('edit-sup-name').value,
                category: document.getElementById('edit-sup-category').value,
                location: document.getElementById('edit-sup-location').value,
                price_display: document.getElementById('edit-sup-price').value,
                website: document.getElementById('edit-sup-website').value,
                email: document.getElementById('edit-sup-email').value,
                maxGuests: Math.max(
                  0,
                  parseInt(document.getElementById('edit-sup-maxGuests').value, 10) || 0
                ),
                description_short: document.getElementById('edit-sup-desc-short').value,
                description_long: document.getElementById('edit-sup-desc-long').value,
              };

              api(`/api/admin/suppliers/${id}`, 'PUT', updateData)
                .then(() => {
                  if (typeof Toast !== 'undefined') {
                    Toast.success('Supplier updated successfully.');
                  } else {
                    alert('Supplier updated successfully.');
                  }
                  loadAll();
                })
                .catch(err => {
                  console.error('editSupplier failed', err);
                  if (typeof Toast !== 'undefined') {
                    Toast.error(`Failed to update supplier: ${err.message}`);
                  } else {
                    alert(`Failed to update supplier: ${err.message}`);
                  }
                });
            },
          });
          modal.show();
        } else {
          // Fallback if Modal is not available
          alert('Supplier editing requires the Modal component. Please reload the page.');
        }
      })
      .catch(err => {
        console.error('Failed to load supplier', err);
        if (typeof Toast !== 'undefined') {
          Toast.error('Failed to load supplier data');
        } else {
          alert('Failed to load supplier data');
        }
      });
  };

  // Package management functions
  window.deletePackage = function (id) {
    return safeExecute(() => {
      if (typeof Modal !== 'undefined') {
        const modal = new Modal({
          title: 'Delete Package',
          content:
            '<p>Are you sure you want to delete this package? This action cannot be undone.</p>',
          confirmText: 'Delete',
          cancelText: 'Cancel',
          onConfirm: function () {
            api(`/api/admin/packages/${id}`, 'DELETE')
              .then(() => {
                if (typeof Toast !== 'undefined') {
                  Toast.success('Package deleted successfully.');
                } else {
                  alert('Package deleted successfully.');
                }
                loadAll();
              })
              .catch(err => {
                console.error('deletePackage failed', err);
                if (typeof Toast !== 'undefined') {
                  Toast.error(`Failed to delete package: ${err.message}`);
                } else {
                  alert(`Failed to delete package: ${err.message}`);
                }
              });
          },
        });
        modal.show();
      } else {
        if (
          !confirm('Are you sure you want to delete this package? This action cannot be undone.')
        ) {
          return;
        }
        api(`/api/admin/packages/${id}`, 'DELETE')
          .then(() => {
            alert('Package deleted successfully.');
            loadAll();
          })
          .catch(err => {
            console.error('deletePackage failed', err);
            alert(`Failed to delete package: ${err.message}`);
          });
      }
    });
  };

  window.editPackage = function (id) {
    // Fetch package data
    api('/api/admin/packages')
      .then(resp => {
        const packages = (resp && resp.items) || [];
        const pkg = packages.find(p => {
          return p.id === id;
        });

        if (!pkg) {
          if (typeof Toast !== 'undefined') {
            Toast.error('Package not found');
          } else {
            alert('Package not found');
          }
          return;
        }

        // Create modal content
        const content = document.createElement('div');
        content.innerHTML =
          `<div style="display: grid; gap: 1rem;">` +
          `<div><label style="display:block;margin-bottom:4px;font-weight:600;">Title *</label>` +
          `<input type="text" id="edit-pkg-title" value="${escapeHtml(
            pkg.title || ''
          )}" style="width:100%;padding:8px;border:1px solid #d4d4d8;border-radius:4px;"></div>` +
          `<div><label style="display:block;margin-bottom:4px;font-weight:600;">Description</label>` +
          `<textarea id="edit-pkg-description" rows="3" style="width:100%;padding:8px;border:1px solid #d4d4d8;border-radius:4px;">${escapeHtml(
            pkg.description || ''
          )}</textarea></div>` +
          `<div><label style="display:block;margin-bottom:4px;font-weight:600;">Price Display</label>` +
          `<input type="text" id="edit-pkg-price" value="${escapeHtml(
            pkg.price_display || pkg.price || ''
          )}" placeholder="e.g., £1,500" style="width:100%;padding:8px;border:1px solid #d4d4d8;border-radius:4px;"></div>` +
          `<div><label style="display:block;margin-bottom:4px;font-weight:600;">Image URL</label>` +
          `<input type="url" id="edit-pkg-image" value="${escapeHtml(
            pkg.image || ''
          )}" style="width:100%;padding:8px;border:1px solid #d4d4d8;border-radius:4px;"></div>` +
          `<div style="display:flex;gap:1rem;align-items:center;">` +
          `<label style="display:flex;align-items:center;gap:8px;cursor:pointer;">` +
          `<input type="checkbox" id="edit-pkg-approved" ${
            pkg.approved ? 'checked' : ''
          } style="width:18px;height:18px;">` +
          `<span style="font-weight:600;">Approved</span>` +
          `</label>` +
          `<label style="display:flex;align-items:center;gap:8px;cursor:pointer;">` +
          `<input type="checkbox" id="edit-pkg-featured" ${
            pkg.featured ? 'checked' : ''
          } style="width:18px;height:18px;">` +
          `<span style="font-weight:600;">Featured</span>` +
          `</label>` +
          `</div>` +
          `<div class="small" style="color:#52525b;margin-top:8px;padding:8px;background:#f9fafb;border-radius:4px;">` +
          `<strong>Gallery Management:</strong><br>` +
          `Photo gallery can be managed by the supplier through their dashboard.` +
          `</div>` +
          `</div>`;

        // Create modal
        if (typeof Modal !== 'undefined') {
          const modal = new Modal({
            title: `Edit Package: ${escapeHtml(pkg.title)}`,
            content: content,
            confirmText: 'Save Changes',
            cancelText: 'Cancel',
            onConfirm: function () {
              const updateData = {
                title: document.getElementById('edit-pkg-title').value,
                description: document.getElementById('edit-pkg-description').value,
                price_display: document.getElementById('edit-pkg-price').value,
                image: document.getElementById('edit-pkg-image').value,
                approved: document.getElementById('edit-pkg-approved').checked,
                featured: document.getElementById('edit-pkg-featured').checked,
              };

              api(`/api/admin/packages/${id}`, 'PUT', updateData)
                .then(() => {
                  if (typeof Toast !== 'undefined') {
                    Toast.success('Package updated successfully.');
                  } else {
                    alert('Package updated successfully.');
                  }
                  loadAll();
                })
                .catch(err => {
                  console.error('editPackage failed', err);
                  if (typeof Toast !== 'undefined') {
                    Toast.error(`Failed to update package: ${err.message}`);
                  } else {
                    alert(`Failed to update package: ${err.message}`);
                  }
                });
            },
          });
          modal.show();
        } else {
          // Fallback if Modal is not available
          alert('Package editing requires the Modal component. Please reload the page.');
        }
      })
      .catch(err => {
        console.error('Failed to load package', err);
        if (typeof Toast !== 'undefined') {
          Toast.error('Failed to load package data');
        } else {
          alert('Failed to load package data');
        }
      });
  };

  window.addEventListener('load', () => {
    safeExecute(() => {
      loadAll();

      const search = document.getElementById('userSearch');
      if (search) {
        search.addEventListener('input', applyUserFilters);
      }

      const dateFilter = document.getElementById('userDateFilter');
      if (dateFilter) {
        dateFilter.addEventListener('change', applyUserFilters);
      }

      const refreshBtn = document.getElementById('refreshBtn');
      if (refreshBtn) {
        refreshBtn.addEventListener('click', () => {
          loadAll();
        });
      }

      const dlUsers = document.getElementById('downloadUsersCsv');
      if (dlUsers) {
        dlUsers.addEventListener('click', () => {
          window.location.href = '/api/admin/users-export';
        });
      }

      const dlMarketing = document.getElementById('downloadMarketingCsv');
      if (dlMarketing) {
        dlMarketing.addEventListener('click', () => {
          window.location.href = '/api/admin/marketing-export';
        });
      }

      const dlJson = document.getElementById('downloadAllJson');
      if (dlJson) {
        dlJson.addEventListener('click', () => {
          window.location.href = '/api/admin/export/all';
        });
      }

      const smartTagBtn = document.getElementById('smartTagSuppliersBtn');
      if (smartTagBtn) {
        smartTagBtn.addEventListener('click', () => {
          smartTagBtn.disabled = true;
          smartTagBtn.innerText = 'Running smart tagging…';
          api('/api/admin/suppliers/smart-tags', 'POST', {})
            .then(() => {
              return loadAll();
            })
            .catch(err => {
              console.error('Smart tagging failed', err);
              alert('Smart tagging failed – check server logs.');
            })
            .finally(() => {
              smartTagBtn.disabled = false;
              smartTagBtn.innerText = 'Run smart tagging (beta)';
            });
        });
      }

      const createUserBtn = document.getElementById('createUserBtn');
      if (createUserBtn) {
        createUserBtn.addEventListener('click', () => {
          showCreateUserModal();
        });
      }

      // Navigation button helpers with keyboard support
      function setupNavButton(btnId, href) {
        const btn = document.getElementById(btnId);
        if (btn) {
          btn.addEventListener('click', () => {
            window.location.href = href;
          });
          // Support keyboard activation (Enter and Space)
          btn.addEventListener('keydown', e => {
            if (e.key === 'Enter' || e.key === ' ') {
              e.preventDefault();
              window.location.href = href;
            }
          });
          // Make sure button is tabbable
          if (!btn.hasAttribute('tabindex')) {
            btn.setAttribute('tabindex', '0');
          }
        } else {
          console.warn('Navigation button not found:', btnId);
        }
      }

      setupNavButton('userManagementBtn', '/admin-users.html');
      setupNavButton('packageManagementBtn', '/admin-packages.html');
      setupNavButton('homepageChangesBtn', '/admin-homepage.html');
      setupNavButton('supportTicketsBtn', '/admin-tickets.html');
      setupNavButton('reportsQueueBtn', '/admin-reports.html');
      setupNavButton('auditLogBtn', '/admin-audit.html');

      // Moderation queue buttons
      setupNavButton('reviewPhotosBtn', '/admin-photos.html');
      setupNavButton('reviewReportsBtn', '/admin-reports.html');
      setupNavButton('verifySuppliersBtn', '/admin-users.html#suppliers');

      const reviewReviewsBtn = document.getElementById('reviewReviewsBtn');
      if (reviewReviewsBtn) {
        reviewReviewsBtn.addEventListener('click', () => {
          reviewPendingReviews();
        });
        reviewReviewsBtn.addEventListener('keydown', e => {
          if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault();
            reviewPendingReviews();
          }
        });
        if (!reviewReviewsBtn.hasAttribute('tabindex')) {
          reviewReviewsBtn.setAttribute('tabindex', '0');
        }
      }

      const logoutBtn = document.getElementById('adminLogoutBtn');
      if (logoutBtn) {
        logoutBtn.addEventListener('click', () => {
          // Wait for CSRF token to be available if not already set
          const performLogout = function () {
            api('/api/auth/logout', 'POST', {})
              .then(() => {
                // Clear any local storage
                try {
                  localStorage.clear();
                } catch (e) {
                  console.warn('Could not clear localStorage:', e);
                }
              })
              .catch(err => {
                console.error('Logout error:', err);
                // Still redirect even if logout fails
              })
              .finally(() => {
                window.location.href = '/';
              });
          };

          if (window.__CSRF_TOKEN__) {
            performLogout();
          } else {
            // Fetch token if not available, then logout
            api('/api/csrf-token', 'GET')
              .then(data => {
                if (data && data.csrfToken) {
                  window.__CSRF_TOKEN__ = data.csrfToken;
                }
              })
              .catch(err => {
                console.warn('Could not fetch CSRF token:', err);
              })
              .finally(() => {
                performLogout();
              });
          }
        });
      }

      // Fetch CSRF token for state-changing requests
      api('/api/csrf-token', 'GET')
        .then(data => {
          if (data && data.csrfToken) {
            window.__CSRF_TOKEN__ = data.csrfToken;
          }
        })
        .catch(() => {
          console.warn('Could not fetch CSRF token on page load');
        });
    });
  });

  window.showCreateUserModal = function () {
    // Create modal content with form
    const content = document.createElement('div');
    content.innerHTML =
      '<div style="display: grid; gap: 1rem;">' +
      '<div><label style="display:block;margin-bottom:4px;font-weight:600;">Name *</label>' +
      '<input type="text" id="create-user-name" required style="width:100%;padding:8px;border:1px solid #d4d4d8;border-radius:4px;"></div>' +
      '<div><label style="display:block;margin-bottom:4px;font-weight:600;">Email *</label>' +
      '<input type="email" id="create-user-email" required style="width:100%;padding:8px;border:1px solid #d4d4d8;border-radius:4px;"></div>' +
      '<div><label style="display:block;margin-bottom:4px;font-weight:600;">Password *</label>' +
      '<input type="password" id="create-user-password" required style="width:100%;padding:8px;border:1px solid #d4d4d8;border-radius:4px;"></div>' +
      '<div><label style="display:block;margin-bottom:4px;font-weight:600;">Role</label>' +
      '<select id="create-user-role" style="width:100%;padding:8px;border:1px solid #d4d4d8;border-radius:4px;">' +
      '<option value="customer">Customer</option>' +
      '<option value="supplier">Supplier</option>' +
      '<option value="admin">Admin</option>' +
      '</select></div>' +
      '<p class="small" style="color:#52525b;margin:0;">Password must be at least 8 characters with uppercase, lowercase, and number.</p>' +
      '</div>';

    if (typeof Modal !== 'undefined') {
      const modal = new Modal({
        title: 'Create New User',
        content: content,
        confirmText: 'Create User',
        cancelText: 'Cancel',
        onConfirm: function () {
          const name = document.getElementById('create-user-name').value;
          const email = document.getElementById('create-user-email').value;
          const password = document.getElementById('create-user-password').value;
          const role = document.getElementById('create-user-role').value;

          if (!name || !email || !password) {
            if (typeof Toast !== 'undefined') {
              Toast.error('All fields are required');
            } else {
              alert('All fields are required');
            }
            return;
          }

          api('/api/admin/users', 'POST', {
            name: name,
            email: email,
            password: password,
            role: role,
          })
            .then(() => {
              if (typeof Toast !== 'undefined') {
                Toast.success('User created successfully.');
              } else {
                alert('User created successfully.');
              }
              // Close modal first, then reload data
              modal.hide();
              // Small delay to ensure modal is fully closed before reloading
              setTimeout(() => {
                loadAll();
              }, 100);
            })
            .catch(err => {
              console.error('createUser failed', err);
              if (typeof Toast !== 'undefined') {
                Toast.error(`Failed to create user: ${err.message}`);
              } else {
                alert(`Failed to create user: ${err.message}`);
              }
            });
        },
      });
      modal.show();
    } else {
      // Fallback to prompt
      const name = prompt('Enter user name:');
      if (!name) {
        return;
      }

      const email = prompt('Enter user email:');
      if (!email) {
        return;
      }

      const password = prompt('Enter user password:');
      if (!password) {
        return;
      }

      api('/api/admin/users', 'POST', {
        name: name,
        email: email,
        password: password,
        role: 'customer',
      })
        .then(() => {
          alert('User created successfully.');
          loadAll();
        })
        .catch(err => {
          console.error('createUser failed', err);
          alert(`Failed to create user: ${err.message}`);
        });
    }
  };

  window.reviewPendingReviews = function () {
    api('/api/admin/reviews/pending')
      .then(data => {
        const reviews = (data.reviews || []).filter(r => !r.approved && !r.rejected);
        if (reviews.length === 0) {
          if (typeof Toast !== 'undefined') {
            Toast.info('No pending reviews to moderate.');
          } else {
            alert('No pending reviews to moderate.');
          }
          return;
        }

        // HTML sanitization helper
        function escapeHtml(unsafe) {
          if (!unsafe) {
            return '';
          }
          return String(unsafe)
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;')
            .replace(/'/g, '&#039;');
        }

        const modal = document.createElement('div');
        modal.style.cssText =
          'position:fixed;top:0;left:0;right:0;bottom:0;background:rgba(0,0,0,0.8);z-index:10000;overflow:auto;padding:20px;';
        modal.className = 'review-modal';
        modal.innerHTML =
          `<div style="background:#111;max-width:800px;margin:auto;padding:20px;border-radius:8px;">` +
          `<h2>Pending Reviews (${reviews.length})</h2>` +
          `<div id="review-list"></div>` +
          `<button data-action="closeReviewModal">Close</button>` +
          `</div>`;
        document.body.appendChild(modal);

        const list = modal.querySelector('#review-list');
        reviews.forEach(r => {
          const item = document.createElement('div');
          item.style.cssText = 'background:#1a1a1a;padding:15px;margin:10px 0;border-radius:6px;';
          item.innerHTML =
            `<p><b>Rating:</b> ${escapeHtml(String(r.rating || 0))} stars</p>` +
            `<p><b>Comment:</b> ${escapeHtml(r.comment || '')}</p>` +
            `<p class="small"><b>Supplier ID:</b> ${escapeHtml(r.supplierId)}</p>` +
            `<p class="small"><b>Date:</b> ${escapeHtml(
              new Date(r.createdAt).toLocaleString()
            )}</p>` +
            `<button data-action="approveReview" data-id="${escapeHtml(
              r.id
            )}" data-param="true">Approve</button> ` +
            `<button data-action="approveReview" data-id="${escapeHtml(
              r.id
            )}" data-param="false">Reject</button>`;
          list.appendChild(item);
        });
      })
      .catch(err => {
        console.error('Failed to load reviews', err);
        if (typeof Toast !== 'undefined') {
          Toast.error('Failed to load reviews');
        } else {
          alert('Failed to load reviews');
        }
      });
  };

  window.approveReview = function (id, approved) {
    api(`/api/admin/reviews/${id}/approve`, 'POST', { approved: approved })
      .then(() => {
        if (typeof Toast !== 'undefined') {
          Toast.success(`Review ${approved ? 'approved' : 'rejected'}`);
        } else {
          alert(`Review ${approved ? 'approved' : 'rejected'}`);
        }
        loadAll();
        closeReviewModal();
      })
      .catch(err => {
        console.error('Failed to moderate review', err);
        if (typeof Toast !== 'undefined') {
          Toast.error('Failed to moderate review');
        } else {
          alert('Failed to moderate review');
        }
      });
  };

  window.closeReviewModal = function () {
    const modal = document.querySelector('.review-modal');
    if (modal) {
      modal.remove();
    }
  };

  // Event delegation for all dynamically created buttons
  document.body.addEventListener('click', e => {
    const target = e.target;
    if (target.tagName !== 'BUTTON') {
      return;
    }

    const action = target.getAttribute('data-action');
    if (!action) {
      return;
    }

    const id = target.getAttribute('data-id');
    const param = target.getAttribute('data-param');

    // Call the appropriate function based on the action
    switch (action) {
      case 'editUser':
        if (window.editUser && id) {
          window.editUser(id);
        }
        break;
      case 'verifyUser':
        if (window.verifyUser && id) {
          window.verifyUser(id);
        }
        break;
      case 'revokeAdmin':
        if (window.revokeAdmin && id) {
          window.revokeAdmin(id);
        }
        break;
      case 'grantAdmin':
        if (window.grantAdmin && id) {
          window.grantAdmin(id);
        }
        break;
      case 'deleteUser':
        if (window.deleteUser && id) {
          window.deleteUser(id);
        }
        break;
      case 'editSupplier':
        if (window.editSupplier && id) {
          window.editSupplier(id);
        }
        break;
      case 'approveSup':
        if (window.approveSup && id) {
          window.approveSup(id);
        }
        break;
      case 'rejectSup':
        if (window.rejectSup && id) {
          window.rejectSup(id);
        }
        break;
      case 'deleteSupplier':
        if (window.deleteSupplier && id) {
          window.deleteSupplier(id);
        }
        break;
      case 'setProPlan':
        if (window.setProPlan && id && param) {
          window.setProPlan(id, param);
        }
        break;
      case 'editPackage':
        if (window.editPackage && id) {
          window.editPackage(id);
        }
        break;
      case 'approvePkg':
        if (window.approvePkg && id && param !== null) {
          window.approvePkg(id, param === 'true');
        }
        break;
      case 'featurePkg':
        if (window.featurePkg && id && param !== null) {
          window.featurePkg(id, param === 'true');
        }
        break;
      case 'deletePackage':
        if (window.deletePackage && id) {
          window.deletePackage(id);
        }
        break;
      case 'approveReview':
        if (window.approveReview && id && param !== null) {
          window.approveReview(id, param === 'true');
        }
        break;
      case 'closeReviewModal':
        if (window.closeReviewModal) {
          window.closeReviewModal();
        }
        break;
    }
  });
})();
