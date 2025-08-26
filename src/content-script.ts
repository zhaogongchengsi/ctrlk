const script = document.createElement('script');
script.src = chrome.runtime.getURL('runtime-api.js');
(document.head || document.documentElement).appendChild(script);