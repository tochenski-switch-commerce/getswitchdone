(function () {
  var P = 'lumio-ef'; // CSS class prefix — all embed classes start with this

  // ── Inject styles once per page ────────────────────────────────────────────
  if (!document.getElementById(P + '-css')) {
    var style = document.createElement('style');
    style.id = P + '-css';
    style.textContent = [
      '.' + P + '-wrap{font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",system-ui,sans-serif;color:#111;line-height:1.5}',
      '.' + P + '-header{margin-bottom:20px}',
      '.' + P + '-title{font-size:20px;font-weight:700;margin:0 0 6px;color:inherit}',
      '.' + P + '-desc{font-size:14px;color:#6b7280;margin:0}',
      '.' + P + '-form{margin:0}',
      '.' + P + '-field{margin-bottom:18px}',
      '.' + P + '-label{display:block;font-size:13px;font-weight:600;margin-bottom:6px;color:inherit}',
      '.' + P + '-req{color:#ef4444;margin-left:2px}',
      '.' + P + '-input{display:block;width:100%;padding:9px 12px;border:1.5px solid #d1d5db;border-radius:7px;font-size:14px;font-family:inherit;background:#fff;color:#111;box-sizing:border-box;transition:border-color .15s;outline:none;-webkit-appearance:none;appearance:none}',
      '.' + P + '-input:focus{border-color:#6366f1;box-shadow:0 0 0 3px rgba(99,102,241,.12)}',
      '.' + P + '-input.error{border-color:#ef4444}',
      'textarea.' + P + '-input{resize:vertical;min-height:90px}',
      '.' + P + '-ferr{font-size:12px;color:#ef4444;margin:5px 0 0;display:none}',
      '.' + P + '-submit-err{font-size:13px;color:#b91c1c;padding:10px 14px;background:#fef2f2;border:1px solid #fecaca;border-radius:7px;margin-bottom:14px;display:none}',
      '.' + P + '-btn{display:block;width:100%;padding:11px 20px;background:#6366f1;color:#fff;border:none;border-radius:8px;font-size:14px;font-weight:600;cursor:pointer;transition:background .15s;font-family:inherit}',
      '.' + P + '-btn:hover{background:#4f46e5}',
      '.' + P + '-btn:disabled{opacity:.55;cursor:not-allowed;background:#6366f1}',
      '.' + P + '-btn-sec{background:transparent;color:#6366f1;border:1.5px solid #d1d5db;margin-top:12px}',
      '.' + P + '-btn-sec:hover{background:#f5f3ff;border-color:#6366f1}',
      '.' + P + '-success{text-align:center;padding:36px 20px}',
      '.' + P + '-success-icon{width:56px;height:56px;border-radius:50%;background:#dcfce7;color:#16a34a;font-size:26px;display:flex;align-items:center;justify-content:center;margin:0 auto 16px;line-height:1}',
      '.' + P + '-success-title{font-size:18px;font-weight:700;margin:0 0 8px;color:inherit}',
      '.' + P + '-success-desc{font-size:14px;color:#6b7280;margin:0 0 20px}',
      '.' + P + '-powered{font-size:11px;color:#9ca3af;margin-top:14px;text-align:right}',
      '.' + P + '-powered a{color:#9ca3af;text-decoration:none}',
      '.' + P + '-powered a:hover{text-decoration:underline}',
      '.' + P + '-loading{font-size:14px;color:#9ca3af;padding:8px 0}',
      '.' + P + '-not-found{font-size:14px;color:#ef4444;padding:8px 0}',
    ].join('');
    document.head.appendChild(style);
  }

  var LUMIO = 'https://lumioboards.netlify.app';

  // ── Locate this script tag ─────────────────────────────────────────────────
  // document.currentScript is null when the script runs async, deferred, or
  // inside a tag manager. Fall back to finding the first uninitialized embed.
  var script = document.currentScript;
  if (!script) {
    var candidates = document.querySelectorAll('script[data-form]:not([data-lumio-init])');
    script = candidates.length ? candidates[0] : null;
  }
  if (!script) return;
  script.setAttribute('data-lumio-init', '1'); // mark so multi-embed pages work

  var slug = script.getAttribute('data-form');
  if (!slug) return;

  var targetSel = script.getAttribute('data-target');
  var target = targetSel ? document.querySelector(targetSel) : script.parentElement;
  if (!target) return;

  var hideTitle = script.hasAttribute('data-hide-title');

  // ── Helpers ────────────────────────────────────────────────────────────────
  function esc(str) {
    return String(str || '')
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }

  function show(el) { if (el) el.style.display = ''; }
  function hide(el) { if (el) el.style.display = 'none'; }

  // ── Render helpers ─────────────────────────────────────────────────────────
  function buildInput(field) {
    var cls = P + '-input';
    var name = 'data-fid="' + esc(field.id) + '" name="' + esc(field.id) + '"';
    var req = field.required ? ' required' : '';
    var ph = esc(field.placeholder || '');

    // Assignee select
    if (field.maps_to === 'assignee') {
      var opts = '<option value="">' + esc(field.placeholder || 'Select assignee…') + '</option>';
      (field.assignee_options || []).forEach(function (o) {
        opts += '<option value="' + esc(o.id) + '">' + esc(o.name) + '</option>';
      });
      return '<select class="' + cls + '" ' + name + req + '>' + opts + '</select>';
    }

    // Priority select
    if (field.maps_to === 'priority') {
      return '<select class="' + cls + '" ' + name + req + '>'
        + '<option value="">' + esc(field.placeholder || 'Select priority…') + '</option>'
        + '<option value="low">Low</option>'
        + '<option value="medium">Medium</option>'
        + '<option value="high">High</option>'
        + '<option value="urgent">Urgent</option>'
        + '</select>';
    }

    // Textarea
    if (field.type === 'textarea') {
      return '<textarea class="' + cls + '" ' + name + req + ' placeholder="' + ph + '"></textarea>';
    }

    // Generic select
    if (field.type === 'select') {
      var opts2 = '<option value="">' + esc(field.placeholder || 'Select…') + '</option>';
      (field.options || []).forEach(function (o) {
        opts2 += '<option value="' + esc(o) + '">' + esc(o) + '</option>';
      });
      return '<select class="' + cls + '" ' + name + req + '>' + opts2 + '</select>';
    }

    // Input types
    var type = 'text';
    if (field.type === 'email') type = 'email';
    else if (field.type === 'url') type = 'url';
    else if (field.type === 'number') type = 'number';
    else if (field.type === 'date' || field.maps_to === 'due_date') type = 'date';

    return '<input class="' + cls + '" type="' + type + '" ' + name + req + ' placeholder="' + ph + '">';
  }

  function renderForm(el, form, noTitle) {
    var fieldsHtml = '';
    (form.fields || []).forEach(function (field) {
      // Skip hidden assignees (server applies the default)
      if (field.maps_to === 'assignee' && field.assignee_visible === false) return;
      // Skip assignee fields with no options configured
      if (field.maps_to === 'assignee' && (!field.assignee_options || !field.assignee_options.length)) return;

      fieldsHtml += '<div class="' + P + '-field" data-fwrap="' + esc(field.id) + '">'
        + '<label class="' + P + '-label">' + esc(field.label)
        + (field.required ? '<span class="' + P + '-req">*</span>' : '')
        + '</label>'
        + buildInput(field)
        + '<p class="' + P + '-ferr"></p>'
        + '</div>';
    });

    el.innerHTML = '<div class="' + P + '-wrap">'
      + (noTitle ? '' : '<div class="' + P + '-header">'
        + '<h2 class="' + P + '-title">' + esc(form.title) + '</h2>'
        + (form.description ? '<p class="' + P + '-desc">' + esc(form.description) + '</p>' : '')
        + '</div>')
      + '<form class="' + P + '-form" novalidate>'
      + fieldsHtml
      + '<div class="' + P + '-submit-err"></div>'
      + '<button type="submit" class="' + P + '-btn">Submit</button>'
      + '</form>'
      + '<p class="' + P + '-powered">Powered by <a href="https://lumioboards.netlify.app" target="_blank" rel="noopener">Lumio</a></p>'
      + '</div>';

    el.querySelector('.' + P + '-form').addEventListener('submit', function (e) {
      e.preventDefault();
      handleSubmit(el, form);
    });
  }

  // ── Submission ─────────────────────────────────────────────────────────────
  function handleSubmit(el, form) {
    var formEl = el.querySelector('.' + P + '-form');
    var submitErrEl = el.querySelector('.' + P + '-submit-err');
    var btn = el.querySelector('.' + P + '-btn');

    // Collect values + validate
    var data = {};
    var valid = true;

    (form.fields || []).forEach(function (field) {
      if (field.maps_to === 'assignee' && field.assignee_visible === false) return;
      if (field.maps_to === 'assignee' && (!field.assignee_options || !field.assignee_options.length)) return;

      var input = formEl.querySelector('[data-fid="' + field.id + '"]');
      if (!input) return;

      var value = input.value.trim();
      data[field.id] = value;

      var wrap = formEl.querySelector('[data-fwrap="' + field.id + '"]');
      var errEl = wrap ? wrap.querySelector('.' + P + '-ferr') : null;

      // Clear previous error
      input.classList.remove('error');
      hide(errEl);

      var fieldErr = null;
      if (field.required && !value) {
        fieldErr = esc(field.label) + ' is required';
      } else if (field.type === 'email' && value && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value)) {
        fieldErr = 'Please enter a valid email address';
      } else if (field.type === 'url' && value && !/^https?:\/\/.+/.test(value)) {
        fieldErr = 'Please enter a valid URL (starting with http:// or https://)';
      }

      if (fieldErr) {
        if (errEl) { errEl.textContent = fieldErr; show(errEl); }
        input.classList.add('error');
        valid = false;
      }
    });

    if (!valid) return;

    // Loading state
    btn.disabled = true;
    btn.textContent = 'Submitting…';
    hide(submitErrEl);

    fetch(LUMIO + '/api/forms/submit', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ formId: form.id, data: data }),
    })
      .then(function (r) {
        return r.json().then(function (body) { return { ok: r.ok, body: body }; });
      })
      .then(function (result) {
        if (!result.ok) {
          if (submitErrEl) {
            submitErrEl.textContent = result.body.error || 'Submission failed. Please try again.';
            show(submitErrEl);
          }
          btn.disabled = false;
          btn.textContent = 'Submit';
          return;
        }

        // Success state
        var wrap = el.querySelector('.' + P + '-wrap');
        wrap.innerHTML = '<div class="' + P + '-success">'
          + '<div class="' + P + '-success-icon">✓</div>'
          + '<h3 class="' + P + '-success-title">Submitted!</h3>'
          + '<p class="' + P + '-success-desc">Your response has been recorded successfully.</p>'
          + '<button class="' + P + '-btn ' + P + '-btn-sec">Submit another response</button>'
          + '</div>';

        wrap.querySelector('.' + P + '-btn-sec').addEventListener('click', function () {
          renderForm(el, form, hideTitle);
        });
      })
      .catch(function () {
        if (submitErrEl) {
          submitErrEl.textContent = 'Network error. Please try again.';
          show(submitErrEl);
        }
        btn.disabled = false;
        btn.textContent = 'Submit';
      });
  }

  // ── Bootstrap ──────────────────────────────────────────────────────────────
  target.innerHTML = '<p class="' + P + '-loading">Loading…</p>';

  fetch(LUMIO + '/api/forms/public/' + encodeURIComponent(slug), { cache: 'no-store' })
    .then(function (r) {
      if (!r.ok) throw new Error('not found');
      return r.json();
    })
    .then(function (form) {
      if (!form || !form.id) throw new Error('invalid response');
      renderForm(target, form, hideTitle);
    })
    .catch(function () {
      target.innerHTML = '<p class="' + P + '-not-found">This form is not available.</p>';
    });
})();
