// QA observer only. No event injection, product mutation, clock or viewport override.
(() => {
  const key = 'stop-v12-recovery-browser-events-v1';
  const timeOriginMs = performance.timeOrigin;
  let events = JSON.parse(localStorage.getItem(key) || '[]');
  function record(type, event, extra = {}) {
    const v = window.visualViewport;
    events.push({type, utc: new Date().toISOString(), epochMs: Date.now(), timeOriginMs,
      performanceNowMs: performance.now(), eventTimeStampMs: event?.timeStamp ?? null,
      isTrusted: event?.isTrusted ?? null, visibilityState: document.visibilityState,
      hasFocus: document.hasFocus(), href: location.href,
      innerWidth, innerHeight, outerWidth, outerHeight, screenX, screenY, devicePixelRatio,
      screen: {width: screen.width, height: screen.height, availWidth: screen.availWidth,
        availHeight: screen.availHeight, availLeft: screen.availLeft, availTop: screen.availTop},
      fullscreenElement: !!document.fullscreenElement,
      displayModeFullscreen: matchMedia('(display-mode: fullscreen)').matches,
      visualViewport: v ? {width:v.width,height:v.height,scale:v.scale,offsetLeft:v.offsetLeft,offsetTop:v.offsetTop} : null,
      ...extra});
    localStorage.setItem(key, JSON.stringify(events));
  }
  for (const type of ['visibilitychange','freeze','resume','fullscreenchange']) document.addEventListener(type, e => record(type,e), true);
  for (const type of ['blur','focus','pagehide','pageshow','resize']) window.addEventListener(type, e => record(type,e), true);
  visualViewport?.addEventListener('resize', e => record('visualViewport.resize',e));
  document.addEventListener('click', e => {
    const button = e.target instanceof Element ? e.target.closest('button') : null;
    if (button) record('button_click',e,{label:button.textContent});
  },true);
  record('probe_loaded',null,{userAgent:navigator.userAgent});
  // Sparse observation for dimensions/window position changes between lifecycle events.
  // Not a physical timing measure. Capture and storage overhead is unmeasured.
  setInterval(() => record('window_sample'), 2000);
})();
