import { CLOSE_DIALOG, OPEN_DIALOG } from "./constant";

console.log('Background script running');

// 存储当前显示弹窗的标签页ID
let currentDialogTabId: number | null = null;
const id = 'ctrl-k-dialog';
// 监听快捷键命令
chrome.commands.onCommand.addListener(async (command) => {
	if (command === "open-panel") {
		console.log('Opening CtrlK panel...');
		try {
			// 获取当前活动标签页
			const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
			
			if (!tab.id) {
				console.error('No active tab found');
				return;
			}

			// 如果当前已有弹窗在其他标签页，先关闭
			if (currentDialogTabId && currentDialogTabId !== tab.id) {
				await closeDialogInTab(currentDialogTabId);
			}

			const panelUrl = chrome.runtime.getURL('index.html');
			// 在当前标签页中切换弹窗
			openDialogInTab(tab.id, panelUrl);

			currentDialogTabId = tab.id;
			console.log('Panel toggled in tab:', tab.id);
		} catch (error) {
			console.error('Error opening panel:', error);
		}
	}
});

function sendMessageToTab(tabId: number, message: unknown) {
	chrome.tabs.sendMessage(tabId, message, (res) => {
		if (chrome.runtime.lastError) {
			console.warn("发送失败:", chrome.runtime.lastError.message);
		} else {
			console.log("content-script 响应:", res);
		}
	});
}

function openDialogInTab(tabId: number, src: string) {
	sendMessageToTab(tabId, { type: OPEN_DIALOG, src, id });
}

// 关闭指定标签页中的弹窗
async function closeDialogInTab(tabId: number) {
	sendMessageToTab(tabId, { type: CLOSE_DIALOG });
}

// 监听标签页切换
chrome.tabs.onActivated.addListener(async (activeInfo) => {
	// 当切换到其他标签页时，关闭当前弹窗
	if (currentDialogTabId && currentDialogTabId !== activeInfo.tabId) {
		await closeDialogInTab(currentDialogTabId);
		currentDialogTabId = null;
	}
});

// 监听标签页关闭
chrome.tabs.onRemoved.addListener((tabId) => {
	if (tabId === currentDialogTabId) {
		currentDialogTabId = null;
		console.log('Dialog tab was closed');
	}
});

// 监听来自内容脚本的消息
// chrome.runtime.onMessage.addListener((message, sender) => {
// 	if (message.type === CLOSE_DIALOG && sender.tab?.id === currentDialogTabId) {
// 		currentDialogTabId = null;
// 		console.log('Panel was closed by user');
// 	}
	
// 	if (message.type === BLUR_DIALOG && sender.tab?.id === currentDialogTabId) {
// 		// 弹窗失去焦点，关闭它
// 		if (currentDialogTabId) {
// 			closeDialogInTab(currentDialogTabId);
// 			currentDialogTabId = null;
// 		}
// 	}
// });