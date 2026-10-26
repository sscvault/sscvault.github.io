// ========== SHARED HELPERS ==========

function showToast(message, type = 'success') {
  const toast = document.createElement('div');
  toast.className = `toast toast-${type}`;
  toast.textContent = message;
  document.body.appendChild(toast);
  setTimeout(() => toast.classList.add('show'), 10);
  setTimeout(() => {
    toast.classList.remove('show');
    setTimeout(() => toast.remove(), 300);
  }, 3200);
}

function formatDate(dateStr) {
  if (!dateStr) return '—';
  const d = new Date(dateStr);
  return d.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
}

function statusBadge(status) {
  const cls = status === 'lost' ? 'badge-lost' : 'badge-found';
  const label = status === 'lost' ? 'LOST' : 'FOUND';
  return `<span class="badge ${cls}">${label}</span>`;
}

function categoryIcon(cat) {
  const map = {
    'ID Card / Documents': '🪪',
    'Electronics': '📱',
    'Keys / Access cards': '🔑',
    'Books / Stationery': '📚',
    'Clothing / Accessories': '👕',
    'Bags / Wallets': '🎒',
    'Other': '📦'
  };
  return map[cat] || '📦';
}

// ========== IMAGE UPLOAD ==========
async function uploadImage(file) {
  if (!file) return null;
  if (file.size > 3 * 1024 * 1024) {
    throw new Error('Image must be under 3 MB');
  }
  const ext = file.name.split('.').pop();
  const fileName = `${Date.now()}-${Math.random().toString(36).slice(2)}.${ext}`;
  const { data, error } = await sb.storage
    .from('item-images')
    .upload(fileName, file);
  if (error) throw error;
  const { data: urlData } = sb.storage.from('item-images').getPublicUrl(fileName);
  return urlData.publicUrl;
}

// ========== SUBMIT ITEM (Lost or Found) ==========
async function submitItem(form, status) {
  const btn = form.querySelector('button[type="submit"]');
  const originalText = btn.textContent;
  btn.disabled = true;
  btn.textContent = 'SUBMITTING...';

  try {
    const title = form.title.value.trim();
    const description = form.description.value.trim();
    const category = form.category.value;
    const location = form.location.value.trim();
    const item_date = form.item_date.value;
    const contact = form.contact.value.trim();
    const imageFile = form.image?.files[0] || null;

    if (!title || !category || !location || !item_date || !contact) {
      throw new Error('Please fill all required fields');
    }

    let image_url = null;
    if (imageFile) {
      image_url = await uploadImage(imageFile);
    }

    const { error } = await sb.from('items').insert({
      title,
      description,
      category,
      location,
      item_date,
      contact,
      status,
      image_url
    });

    if (error) throw error;

    showToast(`${status.toUpperCase()} item reported successfully!`);
    form.reset();
    // Clear file preview if any
    const preview = form.querySelector('.image-preview');
    if (preview) preview.innerHTML = '';
  } catch (err) {
    console.error(err);
    showToast(err.message || 'Something went wrong', 'error');
  } finally {
    btn.disabled = false;
    btn.textContent = originalText;
  }
}

// ========== BROWSE / SEARCH ==========
async function loadItems(filters = {}) {
  const container = document.getElementById('items-grid');
  if (!container) return;

  container.innerHTML = '<div class="loading">LOADING ITEMS...</div>';

  try {
    let query = sb
      .from('items')
      .select('*')
      .order('created_at', { ascending: false });

    if (filters.status && filters.status !== 'all') {
      query = query.eq('status', filters.status);
    }
    if (filters.category && filters.category !== 'all') {
      query = query.eq('category', filters.category);
    }
    if (filters.location) {
      query = query.ilike('location', `%${filters.location}%`);
    }
    if (filters.dateFrom) {
      query = query.gte('item_date', filters.dateFrom);
    }
    if (filters.dateTo) {
      query = query.lte('item_date', filters.dateTo);
    }
    if (filters.search) {
      query = query.or(`title.ilike.%${filters.search}%,description.ilike.%${filters.search}%`);
    }

    const { data, error } = await query;
    if (error) throw error;

    if (!data || data.length === 0) {
      container.innerHTML = `
        <div class="empty-state">
          <div class="pixel-box">NO ITEMS FOUND</div>
          <p>Try changing the filters or report a new item.</p>
        </div>`;
      return;
    }

    container.innerHTML = data.map(item => `
      <article class="item-card pixel-border">
        <div class="item-image">
          ${item.image_url
            ? `<img src="${item.image_url}" alt="${item.title}" loading="lazy">`
            : `<div class="no-image">${categoryIcon(item.category)}</div>`}
        </div>
        <div class="item-body">
          <div class="item-top">
            ${statusBadge(item.status)}
            <span class="item-cat">${categoryIcon(item.category)} ${item.category}</span>
          </div>
          <h3 class="item-title">${escapeHtml(item.title)}</h3>
          <p class="item-desc">${escapeHtml(item.description || 'No description')}</p>
          <div class="item-meta">
            <span>📍 ${escapeHtml(item.location)}</span>
            <span>📅 ${formatDate(item.item_date)}</span>
          </div>
          <div class="item-contact">
            <span>📞 Contact:</span>
            <a href="mailto:${escapeHtml(item.contact)}">${escapeHtml(item.contact)}</a>
          </div>
        </div>
      </article>
    `).join('');
  } catch (err) {
    console.error(err);
    container.innerHTML = `<div class="empty-state"><div class="pixel-box error">ERROR LOADING DATA</div><p>${err.message}</p></div>`;
  }
}

function escapeHtml(str) {
  if (!str) return '';
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

// ========== HOME STATS ==========
async function loadHomeStats() {
  const lostEl = document.getElementById('stat-lost');
  const foundEl = document.getElementById('stat-found');
  const totalEl = document.getElementById('stat-total');
  if (!lostEl) return;

  try {
    const { count: lostCount } = await sb
      .from('items')
      .select('*', { count: 'exact', head: true })
      .eq('status', 'lost');
    const { count: foundCount } = await sb
      .from('items')
      .select('*', { count: 'exact', head: true })
      .eq('status', 'found');

    lostEl.textContent = lostCount ?? 0;
    foundEl.textContent = foundCount ?? 0;
    totalEl.textContent = (lostCount ?? 0) + (foundCount ?? 0);
  } catch (e) {
    console.error(e);
  }
}

// ========== IMAGE PREVIEW ==========
function setupImagePreview(inputId, previewId) {
  const input = document.getElementById(inputId);
  const preview = document.getElementById(previewId);
  if (!input || !preview) return;

  input.addEventListener('change', () => {
    preview.innerHTML = '';
    const file = input.files[0];
    if (file) {
      const img = document.createElement('img');
      img.src = URL.createObjectURL(file);
      img.alt = 'Preview';
      preview.appendChild(img);
    }
  });
}

// ========== INIT PER PAGE ==========
document.addEventListener('DOMContentLoaded', () => {
  // Highlight current nav link
  const path = window.location.pathname.split('/').pop() || 'index.html';
  document.querySelectorAll('.nav-link').forEach(link => {
    if (link.getAttribute('href') === path) {
      link.classList.add('active');
    }
  });

  // Home
  if (document.getElementById('stat-lost')) {
    loadHomeStats();
  }

  // Report Lost
  const lostForm = document.getElementById('lost-form');
  if (lostForm) {
    setupImagePreview('lost-image', 'lost-preview');
    lostForm.addEventListener('submit', (e) => {
      e.preventDefault();
      submitItem(lostForm, 'lost');
    });
  }

  // Report Found
  const foundForm = document.getElementById('found-form');
  if (foundForm) {
    setupImagePreview('found-image', 'found-preview');
    foundForm.addEventListener('submit', (e) => {
      e.preventDefault();
      submitItem(foundForm, 'found');
    });
  }

  // Browse
  if (document.getElementById('items-grid')) {
    const applyFilters = () => {
      const filters = {
        status: document.getElementById('filter-status')?.value || 'all',
        category: document.getElementById('filter-category')?.value || 'all',
        location: document.getElementById('filter-location')?.value.trim() || '',
        dateFrom: document.getElementById('filter-date-from')?.value || '',
        dateTo: document.getElementById('filter-date-to')?.value || '',
        search: document.getElementById('filter-search')?.value.trim() || ''
      };
      loadItems(filters);
    };

    document.getElementById('filter-btn')?.addEventListener('click', applyFilters);
    document.getElementById('filter-search')?.addEventListener('keyup', (e) => {
      if (e.key === 'Enter') applyFilters();
    });
    document.getElementById('clear-filters')?.addEventListener('click', () => {
      document.getElementById('filter-status').value = 'all';
      document.getElementById('filter-category').value = 'all';
      document.getElementById('filter-location').value = '';
      document.getElementById('filter-date-from').value = '';
      document.getElementById('filter-date-to').value = '';
      document.getElementById('filter-search').value = '';
      loadItems();
    });

    // Initial load
    loadItems();
  }

  // Subscribe form
  const subForm = document.getElementById('subscribe-form');
  if (subForm) {
    subForm.addEventListener('submit', async (e) => {
      e.preventDefault();
      const msg = document.getElementById('subscribe-msg');
      const email = document.getElementById('subscribe-email').value.trim().toLowerCase();
      const btn = subForm.querySelector('button[type="submit"]');
      if (!email) return;
      btn.disabled = true;
      msg.textContent = '';
      msg.className = 'newsletter-msg';
      try {
        const token = crypto.randomUUID();
        const { error } = await sb.from('subscribers').insert({
          email,
          token,
          active: true
        });
        if (error) {
          if (error.code === '23505' || (error.message || '').includes('duplicate')) {
            msg.textContent = 'You are already subscribed.';
            msg.className = 'newsletter-msg ok';
          } else {
            throw error;
          }
        } else {
          msg.textContent = 'Subscribed! You will get an email when new items are posted.';
          msg.className = 'newsletter-msg ok';
          subForm.reset();
        }
      } catch (err) {
        console.error(err);
        msg.textContent = err.message || 'Could not subscribe. Try again.';
        msg.className = 'newsletter-msg err';
      } finally {
        btn.disabled = false;
      }
    });
  }

});
