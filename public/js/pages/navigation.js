(() => {
  const storageKey = 'herramientas-vida-sidebar';
  const fallbackRelease = { version: 'desarrollo local', date: '' };
  const releaseStorageKey = 'erp-emision-version-vista';

  async function loadRelease() {
    try {
      const response = await fetch('version.json', { cache: 'no-store' });
      if (!response.ok) throw new Error('No se pudo consultar version.json');
      const value = await response.json();
      if (typeof value.version !== 'string' || typeof value.date !== 'string') {
        throw new Error('version.json no tiene el formato esperado');
      }
      return value;
    } catch (_) {
      return fallbackRelease;
    }
  }

  function formatReleaseDate(value) {
    if (!value) return '';
    const parts = value.split('-').map(Number);
    if (parts.length !== 3 || parts.some(Number.isNaN)) return value;
    const months = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic'];
    return parts[2] + ' ' + months[parts[1] - 1] + ' ' + parts[0];
  }
  const icons = {
    justificador: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 5h16M4 10h16M4 15h10M4 20h13"/></svg>',
    cruce: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M5 7h11m0 0-3-3m3 3-3 3M19 17H8m0 0 3-3m-3 3 3 3"/></svg>',
    cotizador: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M7 3h10v4H7zM5 7h14v14H5zM8 11h8M8 15h3m2 0h3M8 18h3m2 0h3"/></svg>'
  };
  const mobileMedia = matchMedia('(max-width: 760px)');

  // Remember the collapsed state for the next visit, while mobile always stays compact to fit the smaller viewport.
  function storedState() {
    if (mobileMedia.matches) return true;
    try {
      const value = localStorage.getItem(storageKey);
      if (value !== null) return value === 'compact';
    } catch (_) {}
    return false;
  }

  function init() {
    const nav = document.querySelector('.app-nav');
    if (!nav || nav.dataset.enhanced === 'true') return;
    nav.dataset.enhanced = 'true';

    const brand = nav.querySelector('.app-nav__brand');
    const links = nav.querySelector('.app-nav__links');
    if (!brand || !links) return;

    // La navegación carga una sola hoja compartida para todos los módulos activos.
    document.body.classList.add('app-design-system');
    const designSystem = document.createElement('link');
    designSystem.rel = 'stylesheet';
    designSystem.href = 'public/estilo/design-system.css?v=20261125-1054';
    document.head.appendChild(designSystem);

    const cruceLink = links.querySelector(':scope > .app-nav__link[href*="cruce-datos.html"]');
    if (cruceLink) {
      const cruceGroup = document.createElement('div');
      cruceGroup.className = 'app-nav__group';
      cruceGroup.innerHTML =
        '<button class="app-nav__group-toggle" type="button" aria-expanded="false" aria-controls="app-nav-cruce" data-nav-icon="cruce">' +
          '<span class="app-nav__label">Cruce de datos</span>' +
        '</button>' +
        '<div class="app-nav__submenu" id="app-nav-cruce" hidden>' +
          '<a class="app-nav__sublink" href="cruce-datos.html">Cruce de datos</a>' +
        '</div>';
      const currentFile = location.pathname.split('/').pop().toLowerCase();
      const currentLink = cruceGroup.querySelector('[href="' + currentFile + '"]');
      if (currentLink) currentLink.setAttribute('aria-current', 'page');
      cruceLink.replaceWith(cruceGroup);
    }

    brand.setAttribute('aria-label', 'ERP Emisión: ir al Justificador');
    brand.innerHTML = '<span class="app-nav__mark" aria-hidden="true"><svg viewBox="0 0 24 24"><path d="M3.5 11.2 12 4l8.5 7.2"/><path d="M5.5 10.5V20h13v-9.5M9.5 20v-5.5h5V20"/></svg></span><span class="app-nav__copy"><strong>ERP Emisión</strong></span>';

    const head = document.createElement('div');
    head.className = 'app-nav__head';
    nav.insertBefore(head, links);
    head.appendChild(brand);

    const toggle = document.createElement('button');
    toggle.type = 'button';
    toggle.className = 'app-nav__toggle';
    toggle.innerHTML = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="m14 6-6 6 6 6" fill="none" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round" stroke-width="2.5"/></svg>';
    head.appendChild(toggle);

    const releaseButton = document.createElement('button');
    releaseButton.type = 'button';
    releaseButton.className = 'app-nav__release';
    let release = fallbackRelease;
    releaseButton.dataset.label = 'Versión ' + release.version;
    nav.appendChild(releaseButton);
    let seenRelease = false;
    const renderRelease = () => {
      const releaseDate = formatReleaseDate(release.date);
      releaseButton.dataset.label = 'Versión ' + release.version;
      releaseButton.classList.toggle('is-new', !seenRelease);
      releaseButton.setAttribute('aria-label', 'Versión ' + release.version + (!seenRelease ? '. Nueva versión; pulsar para marcar como vista.' : (releaseDate ? '. Actualizada el ' + releaseDate + '.' : '.')));
      releaseButton.innerHTML =
        '<span class="app-nav__release-icon" aria-hidden="true">v</span>' +
        '<span class="app-nav__release-copy"><small>VERSIÓN ACTUAL</small><strong>' + release.version + '</strong>' +
        '<span>' + (!seenRelease ? 'Nueva versión' : (releaseDate ? 'Actualizado ' + releaseDate : 'Versión local')) + '</span></span>';
    };
    renderRelease();
    loadRelease().then((nextRelease) => {
      release = nextRelease;
      try { seenRelease = localStorage.getItem(releaseStorageKey) === release.version; } catch (_) {}
      renderRelease();
    });
    releaseButton.addEventListener('click', () => {
      seenRelease = true;
      try { localStorage.setItem(releaseStorageKey, release.version); } catch (_) {}
      renderRelease();
    });

    const themeToggle = document.createElement('button');
    themeToggle.type = 'button';
    themeToggle.className = 'app-nav__theme-toggle';
    themeToggle.dataset.themeToggle = '';
    themeToggle.innerHTML =
      '<span class="app-nav__icon" aria-hidden="true"></span>' +
      '<span class="app-nav__label"></span>';
    nav.insertBefore(themeToggle, releaseButton);

    links.querySelectorAll('.app-nav__link').forEach((link) => {
      const label = link.textContent.trim();
      const href = link.getAttribute('href') || '';
      const key = href.includes('cruce') ? 'cruce' : 'justificador';
      link.dataset.label = label;
      link.innerHTML = '<span class="app-nav__icon">' + icons[key] + '</span><span class="app-nav__label">' + label + '</span>';
    });

    const groups = [...links.querySelectorAll(':scope > .app-nav__group')];
    groups.forEach((group) => {
      const groupToggle = group.querySelector('.app-nav__group-toggle');
      const submenu = group.querySelector('.app-nav__submenu');
      if (!groupToggle || !submenu) return;
      const label = groupToggle.textContent.trim();
      const iconKey = groupToggle.dataset.navIcon || (label === 'Cotizadores' ? 'cotizador' : 'cruce');
      groupToggle.dataset.label = label;
      groupToggle.innerHTML = '<span class="app-nav__icon">' + icons[iconKey] +
        '</span><span class="app-nav__label">' + label + '</span>' +
        '<span class="app-nav__caret" aria-hidden="true"><svg viewBox="0 0 24 24"><path d="m7 10 5 5 5-5"/></svg></span>';
      group.classList.toggle('is-active', Boolean(submenu.querySelector('[aria-current="page"]')));
    });

    function setCollapsed(collapsed, save = true) {
      nav.classList.toggle('is-collapsed', collapsed);
      document.body.classList.toggle('sidebar-collapsed', collapsed);
      toggle.setAttribute('aria-expanded', String(!collapsed));
      toggle.setAttribute('aria-label', collapsed ? 'Expandir menú lateral' : 'Contraer menú lateral');
      if (save) {
        try { localStorage.setItem(storageKey, collapsed ? 'compact' : 'expanded'); } catch (_) {}
      }
    }

    setCollapsed(storedState(), false);
    const groupClosers = [];
    const groupOpeners = [];
    groups.forEach((group) => {
      const groupToggle = group.querySelector('.app-nav__group-toggle');
      const submenu = group.querySelector('.app-nav__submenu');
      if (!groupToggle || !submenu) return;
      const setExpanded = (expanded) => {
        groupToggle.setAttribute('aria-expanded', String(expanded));
        submenu.hidden = !expanded;
        group.classList.toggle('is-expanded', expanded);
      };
      groupClosers.push(() => setExpanded(false));
      groupOpeners.push(() => setExpanded(Boolean(submenu.querySelector('[aria-current="page"]'))));
      setExpanded(Boolean(submenu.querySelector('[aria-current="page"]')) && !nav.classList.contains('is-collapsed'));
      groupToggle.addEventListener('click', () => {
        if (nav.classList.contains('is-collapsed')) {
          setCollapsed(false);
          groupClosers.forEach((close) => close());
          setExpanded(true);
          return;
        }
        const shouldExpand = groupToggle.getAttribute('aria-expanded') !== 'true';
        groupClosers.forEach((close) => close());
        setExpanded(shouldExpand);
      });
    });
    const closeSubmenu = () => groupClosers.forEach((close) => close());
    toggle.addEventListener('click', () => {
      const collapsed = !nav.classList.contains('is-collapsed');
      setCollapsed(collapsed);
      if (collapsed) closeSubmenu();
      else groupOpeners.forEach((open) => open());
    });
    mobileMedia.addEventListener?.('change', (event) => {
      if (event.matches) {
        setCollapsed(true, false);
        closeSubmenu();
      }
    });
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
  else init();
})();
