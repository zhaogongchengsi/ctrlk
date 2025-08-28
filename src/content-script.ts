const script = document.createElement('script');
script.src = chrome.runtime.getURL('./dist/runtime-api.js');
script.onload = () => script.remove();
(document.head || document.documentElement).appendChild(script);

chrome.runtime.onMessage.addListener((msg: unknown, _sender: chrome.runtime.MessageSender, sendResponse: (response?: unknown) => void) => {
	// 将消息转发给页面
	window.postMessage(msg, "*");
	
	// 对于对话框命令，发送确认响应
	if (typeof msg === 'object' && msg !== null && 'type' in msg && (msg as Record<string, unknown>).type === 'DIALOG_COMMAND') {
		sendResponse({ success: true });
	}
	
	return true; // 保持消息通道开放
});