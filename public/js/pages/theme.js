// Aplica el tema compartido, conserva la preferencia local y mantiene accesible el control del menú.
(() => {
    'use strict';
    const key = 'justificador-vida-theme';
    let saved;
    try { saved = localStorage.getItem(key); } catch { }
    const initial = ['light','dark'].includes(saved) ? saved : (matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light');
    function apply(theme) {
        const selected = theme === 'dark' ? 'dark' : 'light';
        document.documentElement.dataset.theme = selected;
        document.documentElement.classList.toggle('theme-dark', selected === 'dark');
        document.documentElement.style.colorScheme = selected;
        return selected;
    }

    function renderToggle() {
        const button = document.querySelector('[data-theme-toggle]');
        if (!button) return;
        const dark = document.documentElement.dataset.theme === 'dark';
        const label = dark ? 'Tema claro' : 'Tema oscuro';
        button.dataset.label = label;
        button.setAttribute('aria-label', 'Cambiar a ' + label.toLowerCase());
        button.setAttribute('aria-pressed', String(dark));
        button.querySelector('.app-nav__label').textContent = label;
        button.querySelector('.app-nav__icon').innerHTML = dark
            ? '<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="4"/><path d="M12 2v2m0 16v2M4.93 4.93l1.42 1.42m11.3 11.3 1.42 1.42M2 12h2m16 0h2M4.93 19.07l1.42-1.42m11.3-11.3 1.42-1.42"/></svg>'
            : '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M20.2 15.6A8.5 8.5 0 0 1 8.4 3.8 8.5 8.5 0 1 0 20.2 15.6Z"/></svg>';
    }

    apply(initial);
    document.addEventListener('click', (event) => {
        const target = event.target instanceof Element ? event.target.closest('[data-theme-toggle]') : null;
        if (!target) return;
        const next = apply(document.documentElement.dataset.theme === 'dark' ? 'light' : 'dark');
        try { localStorage.setItem(key, next); } catch { }
        renderToggle();
    });
    document.addEventListener('DOMContentLoaded', renderToggle);
})();
