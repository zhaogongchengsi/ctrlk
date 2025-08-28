const script = document.createElement('script');
script.src = chrome.runtime.getURL('./dist/runtime-api.js');
script.onload = () => script.remove();
(document.head || document.documentElement).appendChild(script);

// 监听来自 background 的消息并转发给页面
chrome.runtime.onMessage.addListener((msg: unknown, _sender: chrome.runtime.MessageSender, sendResponse: (response?: unknown) => void) => {
	console.log('Content script received message from background:', msg);
	// 将消息转发给页面
	window.postMessage(msg, "*");
	
	// 对于对话框命令，发送确认响应
	if (typeof msg === 'object' && msg !== null && 'type' in msg && (msg as Record<string, unknown>).type === 'DIALOG_COMMAND') {
		sendResponse({ success: true });
	}
	
	return true; // 保持消息通道开放
});

// 监听来自页面的消息并转发给 background
window.addEventListener('message', (event) => {
	if (event.source !== window) return;
	
	// 处理需要转发给 background 的消息
	if (event.data && event.data.type === 'NOTIFY_BACKGROUND') {
		console.log('Content script forwarding message to background:', event.data.payload);
		chrome.runtime.sendMessage(event.data.payload).catch((error) => {
			console.warn('Failed to forward message to background:', error);
		});
	}
});