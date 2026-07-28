(function () {
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
  const projectDotsWrap = document.getElementById('heroProjectDots');

  let projectIndex = 0;
  let imageIndex = 0;
  let justSwiped = false;

  // Only images (not videos) make sense as hero slides. Falls back to the
  // project's cover image if its media array has no images at all.
  function imagesFor(project) {
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

    heroImagePrev.src = images[prev];
    heroImage.src = images[imageIndex];
    heroImage.alt = project.title;
    heroImageNext.src = images[next];

    setTrackTransition('none');
    setTrackTransform('-100%', '0%', '100%');

    heroMedia.classList.toggle('is-swipeable', images.length > 1);
  }

  // instant = true: sync immediately, no visible jump expected (drag just
  // finished, or this is the first paint).
  // instant = falsy: used for button/arrow clicks, where there's no drag
  // motion to continue — fade the track out, swap content, fade back in.
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
    heroLink.href = '/project/' + project.slug;

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

    // Rebuild the bottom-left project position dots
    if (projectDotsWrap) {
      projectDotsWrap.innerHTML = '';
      heroProjects.forEach((p, i) => {
        const btn = document.createElement('button');
        btn.type = 'button';
        btn.className = 'project-dot' + (i === projectIndex ? ' active' : '');
        btn.setAttribute('aria-label', 'Show featured project ' + (i + 1) + ' of ' + heroProjects.length);
        btn.addEventListener('click', (e) => {
          e.preventDefault();
          e.stopPropagation();
          projectIndex = i;
          imageIndex = 0;
          render();
        });
        projectDotsWrap.appendChild(btn);
      });
    }
  }

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

  const heroPrev = document.getElementById('heroPrev');
  const heroNext = document.getElementById('heroNext');
  if (heroPrev) heroPrev.addEventListener('click', () => goToProject(-1));
  if (heroNext) heroNext.addEventListener('click', () => goToProject(1));

  render(true);   // initial paint — content already matches the server-rendered HTML
})();