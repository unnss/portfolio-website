(function () {
  const wrap = document.getElementById('floatingNav');
  const toggle = document.getElementById('floatingNavToggle');
  const header = document.querySelector('header');
  if (!wrap || !toggle || !header) return;

  // Reveal the button only while the real header is off screen.
  //
  // The header's height is measured once and cached, so the scroll handler
  // is a plain number comparison with no layout read per event. It gets
  // re-measured whenever something could change that height: a resize (the
  // header wraps to two rows on narrow windows) or the webfonts finishing,
  // which changes the text metrics the header is sized by.
  let headerHeight = header.offsetHeight;

  function apply() {
    wrap.classList.toggle('is-visible', window.scrollY >= headerHeight);
  }

  function measure() {
    headerHeight = header.offsetHeight;
    apply();
  }

  // Jump straight to the top. `behavior: 'instant'` is explicit because the
  // stylesheet sets `html { scroll-behavior: smooth }`, which would
  // otherwise animate this over a long page.
  toggle.addEventListener('click', () => {
    window.scrollTo({ top: 0, left: 0, behavior: 'instant' });
    if (window.scrollY !== 0) window.scrollTo(0, 0);   // older browsers ignore the options object
    apply();   // hide immediately rather than waiting on the scroll event
  });

  window.addEventListener('scroll', apply, { passive: true });
  window.addEventListener('resize', measure, { passive: true });
  window.addEventListener('load', measure);
  if (document.fonts && document.fonts.ready) document.fonts.ready.then(measure);

  measure();   // correct state for a page loaded already scrolled down
})();
