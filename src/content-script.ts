const script = document.createElement('script');
script.src = chrome.runtime.getURL('./dist/runtime-api.js'); // 或直接写 JS
script.onload = () => script.remove();
(document.head || document.documentElement).appendChild(script);

chrome.runtime.onMessage.addListener((msg) => {
	window.postMessage(msg, "*");
})