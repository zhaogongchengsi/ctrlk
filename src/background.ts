import { searchManager } from "./search/search-manager";
import { recommendationEngine } from "./recommendations/recommendation-engine";

// 简单的状态存储
const dialogStates = new Map<string, { isOpen: boolean; tabId: number }>();

// 初始化搜索引擎
searchManager.initialize().catch(error => {
  console.error('Failed to initialize search manager:', error);
});

// 监听快捷键命令
chrome.commands.onCommand.addListener(async (command) => {
	if (command === "open-panel") {
		try {
			// 获取当前活动标签页
			const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
			if (!tab.id) {
				console.error('No active tab found');
				return;
			}
			const currentTabId = tab.id;
			const dialogId = `main-dialog-${currentTabId}`;
			const currentState = dialogStates.get(dialogId);
			const isCurrentTabOpen = currentState?.isOpen || false;
			// 关闭所有其他标签页的弹窗
			for (const [existingDialogId, state] of dialogStates.entries()) {
				if (existingDialogId !== dialogId && state.isOpen) {
					await closeDialogInTab(state.tabId);
					// 不立即更新状态，等待实际的关闭确认
					console.log('Sent close command to tab:', state.tabId);
				}
			}

			// 切换当前标签页的弹窗状态
			if (isCurrentTabOpen) {
				// 当前标签页有弹窗，关闭它
				await closeDialogInTab(currentTabId);
				// 不立即更新状态，等待确认
				console.log('Sent close command to current tab:', currentTabId);
			} else {
				// 当前标签页没有弹窗，打开它
				const panelUrl = chrome.runtime.getURL('dist/index.html');
				await openDialogInTab(currentTabId, panelUrl);
				// 不立即更新状态，等待确认
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
		console.log('Message sent successfully to tab:', tabId, message);
		return true;
	} catch (error) {
		console.error(`Failed to send message to tab ${tabId}:`, error);
		return false;
	}
}

// 辅助函数：在指定标签页打开对话框
async function openDialogInTab(tabId: number, src: string): Promise<void> {
	const success = await sendMessageToTab(tabId, {
		type: 'CTRLK_COMMAND',
		action: 'OPEN_DIALOG',
		id: `main-dialog-${tabId}`,
		src: src
	});

	if (!success) {
		console.error('Failed to open dialog in tab:', tabId);
	}
}

// 辅助函数：在指定标签页关闭对话框
async function closeDialogInTab(tabId: number): Promise<void> {
	const success = await sendMessageToTab(tabId, {
		type: 'CTRLK_COMMAND',
		action: 'CLOSE_DIALOG',
		id: `main-dialog-${tabId}`
	});

	if (!success) {
		console.error('Failed to close dialog in tab:', tabId);
	}
}

// 监听标签页关闭
chrome.tabs.onRemoved.addListener((tabId) => {
	console.log('Tab removed:', tabId);
	// 清理该标签页的所有对话框状态
	const dialogId = `main-dialog-${tabId}`;
	if (dialogStates.has(dialogId)) {
		dialogStates.delete(dialogId);
		console.log('Cleaned up dialog state for closed tab:', tabId);
	}
});

// 监听来自 content script 的消息
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
	console.log('Background received message:', message, 'from sender:', sender);
	
	if (message.type === 'DIALOG_STATE_CHANGE' && sender.tab?.id) {
		const tabId = sender.tab.id;
		const dialogId = message.dialogId || `main-dialog-${tabId}`;
		const isOpen = message.isOpen;
		
		console.log(`Dialog ${dialogId} state changed for tab ${tabId}: ${isOpen}`);
		console.log('Previous state:', dialogStates.get(dialogId));
		
		// 更新状态
		dialogStates.set(dialogId, { isOpen, tabId });
		
		console.log('Updated state:', dialogStates.get(dialogId));
		console.log('All states after update:', Array.from(dialogStates.entries()));
		
		sendResponse({ success: true });
	}
	
	// 处理推荐数据请求
	if (message.type === 'GET_RECOMMENDATIONS') {
		// 如果有自定义配置，更新推荐引擎配置
		if (message.config) {
			recommendationEngine.updateConfig(message.config);
		} else if (message.limit) {
			// 如果只传了limit，更新maxRecommendations配置
			recommendationEngine.updateConfig({ maxRecommendations: message.limit });
		}
		
		recommendationEngine.generateRecommendations()
			.then(recommendations => {
				sendResponse({ 
					success: true, 
					recommendations,
					timestamp: Date.now()
				});
			})
			.catch(error => {
				console.error('Failed to generate recommendations:', error);
				sendResponse({ 
					success: false, 
					error: error.message || 'Unknown error',
					timestamp: Date.now()
				});
			});
		
		// 返回 true 表示我们将异步发送响应
		return true;
	}
	
	// 返回 true 表示我们可能会异步发送响应
	return true;
});