(function () {
  // ----------------------------------------------------------------------
  // CHANGES IN THIS VERSION:
  // 1. Dynamic iteration confirmed/clarified — goToProject() already wraps
  //    using `% heroProjects.length`, so it works correctly for any number
  //    of featured projects the server sends (2, 5, 20 — no assumption
  //    about count is baked in anywhere below). Comments added to make
  //    this explicit.
  // 2. Removed the fixed bottom-left "project dots" indicator entirely —
  //    projectDotsWrap and its rebuild logic are gone. Next/Previous
  //    arrows (and swipe, for images) are now the only navigation UI.
  // 3. Everything else (image drag/swipe, image dots, click-to-navigate)
  //    is unchanged from before.
  // ----------------------------------------------------------------------

  const dataEl = document.getElementById('hero-data');
  if (!dataEl) return;

  const heroProjects = JSON.parse(dataEl.textContent);
  if (!heroProjects.length) return;

  const heroMedia = document.getElementById('heroMedia');
  const heroTrack = document.getElementById('heroTrack');
  const heroLink = document.getElementById('heroLink');           // the <a>, current slide
  const heroImage = document.getElementById('heroImage');         // <img> inside heroLink
  const heroImagePrev = document.getElementById('heroImagePrev'); // preview of the previous image
  const heroImageNext = document.getElementById('heroImageNext'); // preview of the next image
  const heroTag = document.getElementById('heroTag');
  const heroInfoTitle = document.getElementById('heroInfoTitle');
  const heroInfoDesc = document.getElementById('heroInfoDesc');
  const imageDotsWrap = document.getElementById('heroImageDots');
  // Note: no projectDotsWrap anymore — the bottom-left indicator is gone.

  // Detect this deployment's base path — '' when running locally, or
  // something like '/portfolio-website' on a GitHub Pages project site.
  // build.js already bakes the correct prefix into the server-rendered
  // HTML; this reads that back out by comparing heroLink's initial href
  // against the slug we know it points to, so every href/src this script
  // sets afterward (switching projects, images, etc.) keeps that same
  // prefix instead of silently dropping it.
  const initialSlugPath = '/project/' + heroProjects[0].slug;
  const initialHref = heroLink.getAttribute('href') || '';
  const basePrefix = initialHref.endsWith(initialSlugPath)
    ? initialHref.slice(0, initialHref.length - initialSlugPath.length)
    : '';

  function withBase(src) {
    return basePrefix + src;
  }

  let projectIndex = 0;
  let imageIndex = 0;
  let justSwiped = false;

  // Hero slides prefer a project's dedicated `heroImages` — wide (21:9)
  // renders composed specifically for this banner — over the images in its
  // `media` array, which are meant for the project detail page instead and
  // are usually a different aspect ratio. Falls back to `media` images
  // (then the cover) for any project that doesn't have heroImages yet, so
  // nothing breaks for projects you haven't made wide versions for.
  function imagesFor(project) {
    if (project.heroImages && project.heroImages.length) {
      return project.heroImages;
    }
    const imgs = (project.media || [])
      .filter((m) => m.type === 'image')
      .map((m) => m.src);
    return imgs.length ? imgs : [project.cover];
  }

  function neighborIndices(images, index) {
    return {
      prev: (index - 1 + images.length) % images.length,
      next: (index + 1) % images.length,
    };
  }

  function setTrackTransition(value) {
    heroImagePrev.style.transition = value;
    heroLink.style.transition = value;
    heroImageNext.style.transition = value;
  }

  function setTrackTransform(prevX, currentX, nextX) {
    heroImagePrev.style.transform = 'translateX(' + prevX + ')';
    heroLink.style.transform = 'translateX(' + currentX + ')';
    heroImageNext.style.transform = 'translateX(' + nextX + ')';
  }

  // Fills the prev/current/next slides from the current indices and snaps
  // the track back to its resting position with no animation. Safe to call
  // whenever the visible position doesn't actually need to move — either
  // because nothing has animated yet (initial load) or because a drag
  // animation just finished landing exactly here.
  function syncTrack() {
    const project = heroProjects[projectIndex];
    const images = imagesFor(project);
    if (imageIndex >= images.length) imageIndex = 0;
    const { prev, next } = neighborIndices(images, imageIndex);

    heroImagePrev.src = withBase(images[prev]);
    heroImage.src = withBase(images[imageIndex]);
    heroImage.alt = project.title;
    heroImageNext.src = withBase(images[next]);

    setTrackTransition('none');
    setTrackTransform('-100%', '0%', '100%');

    heroMedia.classList.toggle('is-swipeable', images.length > 1);
  }

  // instant = true: sync immediately, no visible jump expected (drag just
  // finished, or this is the first paint).
  // instant = falsy: used for Next/Previous/image-dot clicks, where there's
  // no drag motion to continue — fade the track out, swap content, fade
  // back in. This is the "smooth transition between projects" behavior.
  function render(instant) {
    if (instant) {
      syncTrack();
    } else {
      heroTrack.style.transition = 'opacity 0.2s ease';
      heroTrack.style.opacity = 0;
      window.setTimeout(() => {
        syncTrack();
        requestAnimationFrame(() => {
          heroTrack.style.opacity = 1;
        });
      }, 180);
    }

    const project = heroProjects[projectIndex];
    heroTag.textContent = project.title + ' — ' + project.engine;
    heroInfoTitle.textContent = project.title + ' — ' + project.engine;
    heroInfoDesc.textContent = project.description;
    heroLink.href = withBase('/project/' + project.slug);

    const images = imagesFor(project);

    // Rebuild the bottom-right image buttons for the current project
    imageDotsWrap.innerHTML = '';
    if (images.length > 1) {
      images.forEach((src, i) => {
        const btn = document.createElement('button');
        btn.type = 'button';
        btn.className = 'image-dot' + (i === imageIndex ? ' active' : '');
        btn.setAttribute('aria-label', 'Show image ' + (i + 1) + ' of ' + images.length);
        btn.addEventListener('click', (e) => {
          e.preventDefault();
          e.stopPropagation();
          imageIndex = i;
          render();
        });
        imageDotsWrap.appendChild(btn);
      });
    }

    // (Bottom-left project-position dots used to be rebuilt here — removed.)
  }

  // Dynamic iteration: heroProjects.length is read fresh every call, not
  // cached or hardcoded anywhere, so this correctly wraps around whether
  // there are 2 featured projects or 20. Negative results from a "Previous"
  // click at index 0 are corrected back into range by the "+ heroProjects.length"
  // before the modulo, which is what makes wraparound work in both directions.
  function goToProject(delta) {
    projectIndex = (projectIndex + delta + heroProjects.length) % heroProjects.length;
    imageIndex = 0;
    render();
  }

  // ---- Drag / swipe: cycles through the current project's images ----
  // All three slides (prev/current/next) move together by the same amount
  // during the drag, so the incoming neighbor is visible sliding in from
  // the edge in real time, not just after release.
  let startX = 0;
  let currentX = 0;
  let dragging = false;
  const SWIPE_THRESHOLD_RATIO = 0.5; // must drag past 50% of the image's own width

  function startDrag(x) {
    dragging = true;
    justSwiped = false;
    startX = currentX = x;
    heroMedia.classList.add('is-dragging');
    setTrackTransition('none');   // track the finger/cursor with no lag
  }

  function moveDrag(x) {
    if (!dragging) return;
    currentX = x;
    const delta = currentX - startX;
    setTrackTransform(
      'calc(-100% + ' + delta + 'px)',
      'calc(0% + ' + delta + 'px)',
      'calc(100% + ' + delta + 'px)'
    );
  }

  function endDrag() {
    if (!dragging) return;
    dragging = false;
    heroMedia.classList.remove('is-dragging');
    const delta = currentX - startX;
    const images = imagesFor(heroProjects[projectIndex]);
    const trackWidth = heroMedia.getBoundingClientRect().width;
    const threshold = trackWidth * SWIPE_THRESHOLD_RATIO;

    if (Math.abs(delta) > threshold && images.length > 1) {
      justSwiped = true;
      const dir = delta < 0 ? 1 : -1;   // +1 = advance to next, -1 = back to previous
      setTrackTransition('transform 0.28s ease');
      if (dir > 0) {
        setTrackTransform('-200%', '-100%', '0%');   // carry everything left one slot
      } else {
        setTrackTransform('0%', '100%', '200%');      // carry everything right one slot
      }
      window.setTimeout(() => {
        imageIndex = (imageIndex + dir + images.length) % images.length;
        render(true);   // instant — the visible image doesn't actually move on this call
      }, 280);
    } else {
      // Didn't drag far enough — spring back to center
      setTrackTransition('transform 0.25s ease');
      setTrackTransform('-100%', '0%', '100%');
      window.setTimeout(() => setTrackTransition(''), 260);
    }
  }

  // Touch (phones/tablets)
  heroMedia.addEventListener('touchstart', (e) => {
    if (e.target.closest('button')) return;
    startDrag(e.touches[0].clientX);
  }, { passive: true });

  heroMedia.addEventListener('touchmove', (e) => {
    moveDrag(e.touches[0].clientX);
  }, { passive: true });

  heroMedia.addEventListener('touchend', endDrag);
  heroMedia.addEventListener('touchcancel', endDrag);

  // Mouse (click-and-drag on desktop). mousemove/mouseup are attached to
  // window rather than heroMedia so the drag keeps tracking even if the
  // cursor moves outside the image mid-drag.
  heroMedia.addEventListener('mousedown', (e) => {
    if (e.button !== 0) return;             // left button only — ignore middle/right click
    if (e.target.closest('button')) return;
    e.preventDefault();   // stop the browser from starting its own native drag on the link/image
    startDrag(e.clientX);
  });

  window.addEventListener('mousemove', (e) => {
    moveDrag(e.clientX);
  });

  window.addEventListener('mouseup', endDrag);

  // Safety net: if the mouse leaves the browser viewport entirely mid-drag,
  // mouseup may never fire (e.g. released outside the window). End the
  // drag when the cursor exits the document rather than leaving it stuck.
  document.addEventListener('mouseleave', endDrag);

  heroLink.addEventListener('click', (e) => {
    if (justSwiped) {
      e.preventDefault();
      justSwiped = false;
    }
  });

  // Next/Previous — switch which featured project the hero displays.
  // Only wired up if the buttons exist in the markup (index.ejs only
  // renders them when there's more than one featured project).
  const heroPrev = document.getElementById('heroPrev');
  const heroNext = document.getElementById('heroNext');
  if (heroPrev) heroPrev.addEventListener('click', () => goToProject(-1));
  if (heroNext) heroNext.addEventListener('click', () => goToProject(1));

  render(true);   // initial paint — content already matches the server-rendered HTML
})();
