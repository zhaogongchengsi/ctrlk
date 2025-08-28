import DialogStateManager from './state/dialog-state-manager';
import { searchManager } from "./search/search-manager";

// 全局状态管理器
const globalStateManager = new DialogStateManager();

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
			const dialogId = `main-dialog-${currentTabId}`;
			const isCurrentTabOpen = globalStateManager.isDialogOpen(dialogId);

			// 关闭所有其他标签页的弹窗
			const currentStates = globalStateManager['dialogStates'].value;
			for (const [existingDialogId, state] of currentStates.entries()) {
				if (existingDialogId !== dialogId && state.isOpen && state.tabId && state.tabId !== currentTabId) {
					await closeDialogInTab(state.tabId);
					console.log('Sent close command to tab:', state.tabId);
				}
			}

			// 切换当前标签页的弹窗状态
			if (isCurrentTabOpen) {
				// 当前标签页有弹窗，关闭它
				await closeDialogInTab(currentTabId);
				console.log('Sent close command to current tab:', currentTabId);
			} else {
				// 当前标签页没有弹窗，打开它
				const panelUrl = chrome.runtime.getURL('dist/index.html');
				await openDialogInTab(currentTabId, panelUrl);
				console.log('Sent open command to current tab:', currentTabId);
			}
		} catch (error) {
			console.error('Error toggling panel:', error);
		}
	}
});

// 辅助函数：向指定标签页发送消息
async function sendMessageToTab(tabId: number, message: unknown): Promise<boolean> {
	try {
		await chrome.tabs.sendMessage(tabId, message);
		return true;
	} catch (error) {
		console.error(`Failed to send message to tab ${tabId}:`, error);
		return false;
	}
}

// 辅助函数：在指定标签页打开对话框
async function openDialogInTab(tabId: number, src: string): Promise<void> {
	const dialogId = `main-dialog-${tabId}`;
	
	const success = await sendMessageToTab(tabId, {
		type: 'DIALOG_COMMAND',
		action: 'OPEN_DIALOG',
		dialogId,
		src,
		options: {}
	});

	if (success) {
		globalStateManager.openDialog(dialogId, tabId);
	}
}

// 辅助函数：在指定标签页关闭对话框
async function closeDialogInTab(tabId: number): Promise<void> {
	const dialogId = `main-dialog-${tabId}`;
	
	const success = await sendMessageToTab(tabId, {
		type: 'DIALOG_COMMAND',
		action: 'CLOSE_DIALOG',
		dialogId
	});

	if (success) {
		globalStateManager.closeDialog(dialogId, tabId);
	}
}

// 监听标签页关闭
chrome.tabs.onRemoved.addListener((tabId) => {
	console.log('Tab removed:', tabId);
	// 清理该标签页的所有对话框状态
	const currentStates = globalStateManager['dialogStates'].value;
	for (const [dialogId, state] of currentStates.entries()) {
		if (state.tabId === tabId) {
			globalStateManager.removeDialog(dialogId);
		}
	}
});

// 监听来自 content script 的消息
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
	if (message.type === 'DIALOG_STATE_CHANGE' && sender.tab?.id) {
		const tabId = sender.tab.id;
		const dialogId = message.dialogId || `main-dialog-${tabId}`;
		const isOpen = message.isOpen;
		
		console.log(`Dialog ${dialogId} state changed for tab ${tabId}: ${isOpen}`);
		globalStateManager.updateDialogState(dialogId, isOpen, tabId);
		
		sendResponse({ success: true });
	}
	
	if (message.type === 'GET_DIALOG_STATE' && message.dialogId) {
		const state = globalStateManager.getDialogState(message.dialogId);
		sendResponse({ state });
	}
	
	// 返回 true 表示我们可能会异步发送响应
	return true;
});