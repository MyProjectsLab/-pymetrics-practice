(()=>{
  const key='stop-l1-browser-events-v1';
  const origin=performance.timeOrigin;
  function record(type,event){
    const entry={type,utc:new Date().toISOString(),epochMs:Date.now(),timeOriginMs:origin,performanceNowMs:performance.now(),eventTimeStampMs:event?.timeStamp??null,isTrusted:event?.isTrusted??null,visibilityState:document.visibilityState,hasFocus:document.hasFocus(),href:location.href};
    let prior=[];try{prior=JSON.parse(localStorage.getItem(key)||'[]')}catch{}
    prior.push(entry);localStorage.setItem(key,JSON.stringify(prior));
  }
  for(const type of ['visibilitychange','freeze','resume']) document.addEventListener(type,e=>record(type,e),true);
  for(const type of ['blur','focus','pagehide','pageshow']) window.addEventListener(type,e=>record(type,e),true);
  record('probe_loaded');
})();
