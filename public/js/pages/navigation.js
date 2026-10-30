(() => {
  const storageKey = 'herramientas-vida-sidebar';
  const icons = {
    justificador: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 5h16M4 10h16M4 15h10M4 20h13"/></svg>',
    cruce: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M5 7h11m0 0-3-3m3 3-3 3M19 17H8m0 0 3-3m-3 3 3 3"/></svg>'
  };
  const mobileMedia = matchMedia('(max-width: 760px)');

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

    brand.setAttribute('aria-label', 'Herramientas Vida: ir al Justificador');
    brand.innerHTML = '<span class="app-nav__mark" aria-hidden="true"><svg viewBox="0 0 24 24"><path d="M3.5 11.2 12 4l8.5 7.2"/><path d="M5.5 10.5V20h13v-9.5M9.5 20v-5.5h5V20"/></svg></span><span class="app-nav__copy"><strong>Herramientas Vida</strong><small>Panel operativo</small></span>';

    const head = document.createElement('div');
    head.className = 'app-nav__head';
    nav.insertBefore(head, links);
    head.appendChild(brand);

    const toggle = document.createElement('button');
    toggle.type = 'button';
    toggle.className = 'app-nav__toggle';
    toggle.innerHTML = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="m14 6-6 6 6 6" fill="none" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round" stroke-width="2.5"/></svg>';
    head.appendChild(toggle);

    links.querySelectorAll('.app-nav__link').forEach((link) => {
      const label = link.textContent.trim();
      const key = link.getAttribute('href')?.includes('cruce') ? 'cruce' : 'justificador';
      link.dataset.label = label;
      link.innerHTML = '<span class="app-nav__icon">' + icons[key] + '</span><span class="app-nav__label">' + label + '</span>';
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
    toggle.addEventListener('click', () => setCollapsed(!nav.classList.contains('is-collapsed')));
    mobileMedia.addEventListener?.('change', (event) => {
      if (event.matches) setCollapsed(true, false);
    });
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
  else init();
})();
