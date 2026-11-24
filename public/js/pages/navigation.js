(() => {
  const storageKey = 'herramientas-vida-sidebar';
  // Cambia este valor al publicar una nueva version. El aviso se mostrara
  // automaticamente una vez por usuario y navegador.
  const release = {
    version: '2026.11.22.3',
    date: '22 nov 2026'
  };
  const releaseStorageKey = 'erp-emision-version-vista';
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

    // Cruce de datos agrupa el conciliador nuevo y conserva el modulo anterior.
    const cruceLink = links.querySelector(':scope > .app-nav__link[href*="cruce-datos.html"]');
    if (cruceLink) {
      const cruceGroup = document.createElement('div');
      cruceGroup.className = 'app-nav__group';
      cruceGroup.innerHTML =
        '<button class="app-nav__group-toggle" type="button" aria-expanded="false" aria-controls="app-nav-cruce" data-nav-icon="cruce">' +
          '<span class="app-nav__label">Cruce de datos</span>' +
        '</button>' +
        '<div class="app-nav__submenu" id="app-nav-cruce" hidden>' +
          '<a class="app-nav__sublink" href="capturacion_facturacion.html">Vida_mauricio</a>' +
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
    releaseButton.dataset.label = 'Versión ' + release.version;
    nav.appendChild(releaseButton);
    let seenRelease = false;
    try { seenRelease = localStorage.getItem(releaseStorageKey) === release.version; } catch (_) {}
    const renderRelease = () => {
      releaseButton.classList.toggle('is-new', !seenRelease);
      releaseButton.setAttribute('aria-label', 'Versión ' + release.version + (!seenRelease ? '. Nueva versión; pulsar para marcar como vista.' : '. Actualizada el ' + release.date + '.'));
      releaseButton.innerHTML =
        '<span class="app-nav__release-icon" aria-hidden="true">v</span>' +
        '<span class="app-nav__release-copy"><small>VERSIÓN ACTUAL</small><strong>' + release.version + '</strong>' +
        '<span>' + (!seenRelease ? 'Nueva versión' : 'Actualizado ' + release.date) + '</span></span>';
    };
    renderRelease();
    releaseButton.addEventListener('click', () => {
      seenRelease = true;
      try { localStorage.setItem(releaseStorageKey, release.version); } catch (_) {}
      renderRelease();
    });

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
