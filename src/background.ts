import { CLOSE_DIALOG, OPEN_DIALOG } from "./constant";
import { searchManager } from "./search/search-manager";

// 存储每个标签页的弹窗状态
const tabDialogStates = new Map<number, boolean>();
const id = 'ctrl-k-dialog';

// 初始化搜索引擎
searchManager.initialize().catch(error => {
  console.error('Failed to initialize search manager:', error);
});
// 监听快捷键命令
chrome.commands.onCommand.addListener(async (command) => {
	if (command === "open-panel") {
		console.log('Handling CtrlK panel toggle...');
		try {
			// 获取当前活动标签页
			const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
			
			if (!tab.id) {
				console.error('No active tab found');
				return;
			}

			const currentTabId = tab.id;
			const isCurrentTabOpen = tabDialogStates.get(currentTabId) || false;

			// 关闭所有其他标签页的弹窗
			for (const [tabId, isOpen] of tabDialogStates.entries()) {
				if (tabId !== currentTabId && isOpen) {
					await closeDialogInTab(tabId);
					// 不在这里立即更新状态，等待 content script 的反馈
					console.log('Sent close command to tab:', tabId);
				}
			}

			// 切换当前标签页的弹窗状态
			if (isCurrentTabOpen) {
				// 当前标签页有弹窗，关闭它
				await closeDialogInTab(currentTabId);
				// 不在这里立即更新状态，等待 content script 的反馈
				console.log('Sent close command to current tab:', currentTabId);
			} else {
				// 当前标签页没有弹窗，打开它
				const panelUrl = chrome.runtime.getURL('dist/index.html');
				await openDialogInTab(currentTabId, panelUrl);
				// 不在这里立即更新状态，等待 content script 的反馈
				console.log('Sent open command to current tab:', currentTabId);
			}
		} catch (error) {
			console.error('Error toggling panel:', error);
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
	sendMessageToTab(tabId, { type: CLOSE_DIALOG, id });
}

// 监听标签页切换
chrome.tabs.onActivated.addListener(async (activeInfo) => {
	// 不在标签页切换时关闭弹窗，让用户手动控制
	// 这样用户可以在不同标签页之间切换而保持弹窗状态
	console.log('Tab activated:', activeInfo.tabId);
});

// 监听标签页关闭
chrome.tabs.onRemoved.addListener((tabId) => {
	// 清理已关闭标签页的状态
	if (tabDialogStates.has(tabId)) {
		tabDialogStates.delete(tabId);
		console.log('Cleaned up dialog state for closed tab:', tabId);
	}
});

// 监听来自 content script 的消息
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
	if (message.type === 'DIALOG_STATE_CHANGE' && sender.tab?.id) {
		const tabId = sender.tab.id;
		const isOpen = message.isOpen;
		
		console.log(`Dialog state changed for tab ${tabId}: ${isOpen}`);
		tabDialogStates.set(tabId, isOpen);
		
		// 发送确认响应
		sendResponse({ success: true });
	}
	
	// 返回 true 表示我们可能会异步发送响应
	return true;
});