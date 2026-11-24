(() => {
  'use strict';
  const video = document.getElementById('telecast');
  const screen = document.getElementById('crt-screen');
  const reduced = window.matchMedia('(prefers-reduced-motion: reduce)');
  const lowData = window.matchMedia('(prefers-reduced-data: reduce)');
  let visible = false;
  let userChoice = 'auto';
  let needsGesture = false;
  let serial = 0;
  let pending = false;

  function describeAction() {
    const action = pending || !video.paused ? 'Pause' : 'Play';
    const target = reduced.matches ? 'broadcast' : 'broadcast and page motion';
    screen.setAttribute('aria-label', action + ' ' + target);
  }

  function pause() {
    ++serial;
    pending = false;
    video.pause();
    describeAction();
  }

  function play() {
    if (pending || !video.paused) return;
    const request = ++serial;
    pending = true;
    if (!video.hasAttribute('src')) video.src = screen.href;
    else if (video.error) video.load();
    video.muted = true;
    // Keep play() in the click call stack when the platform requires a gesture.
    const attempt = video.play();
    Promise.resolve(attempt).then(() => {
      if (serial !== request) return;
      pending = false;
      describeAction();
    }).catch(() => {
      if (serial !== request) return;
      pending = false;
      needsGesture = true;
      screen.dataset.frame = 'poster';
      describeAction();
    });
  }

  function sync() {
    const preferPoster = reduced.matches || lowData.matches || navigator.connection?.saveData;
    if (preferPoster && userChoice !== 'play') {
      pause();
      screen.dataset.frame = 'poster';
      return;
    }
    if (!visible || document.hidden || userChoice === 'pause') {
      pause();
      return;
    }
    if (!needsGesture) play();
  }

  // The screen links to the film when JavaScript is unavailable.
  screen.setAttribute('role', 'button');
  screen.setAttribute('aria-controls', 'telecast');
  describeAction();
  screen.addEventListener('click', event => {
    event.preventDefault();
    if (!video.paused || pending) {
      userChoice = 'pause';
      pause();
    } else {
      userChoice = 'play';
      needsGesture = false;
      play();
    }
    document.dispatchEvent(new CustomEvent('hypha:motion', {detail: {paused: userChoice === 'pause'}}));
  });
  // Enter already activates links. Give Space the same button behavior.
  screen.addEventListener('keydown', event => {
    if (event.key !== ' ') return;
    event.preventDefault();
    if (!event.repeat) screen.click();
  });
  video.addEventListener('playing', () => {
    screen.dataset.frame = 'film';
    describeAction();
  });
  video.addEventListener('pause', describeAction);
  video.addEventListener('error', () => {
    needsGesture = true;
    screen.dataset.frame = 'poster';
    describeAction();
  });
  function updatePreference() {
    if (userChoice === 'play') userChoice = 'auto';
    sync();
    describeAction();
  }
  reduced.addEventListener('change', updatePreference);
  lowData.addEventListener('change', updatePreference);
  navigator.connection?.addEventListener('change', sync);
  document.addEventListener('visibilitychange', sync);
  window.addEventListener('pagehide', pause);
  window.addEventListener('pageshow', sync);
  if ('IntersectionObserver' in window) {
    new IntersectionObserver(([entry]) => {
      visible = entry.intersectionRatio > .14;
      sync();
    }, {threshold: [0, .15]}).observe(screen);
  } else {
    function checkBounds() {
      const box = screen.getBoundingClientRect();
      visible = box.bottom > 0 && box.top < innerHeight;
      sync();
    }
    window.addEventListener('scroll', checkBounds, {passive: true});
    window.addEventListener('resize', checkBounds);
    checkBounds();
  }
})();
