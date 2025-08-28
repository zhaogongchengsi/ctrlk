import { CLOSE_DIALOG, TOGGLE_DIALOG } from "./constant";
import { searchManager } from "./search/search-manager";

// 存储当前显示弹窗的标签页ID和状态
let currentDialogTabId: number | null = null;
let isDialogOpen: boolean = false;
const id = 'ctrl-k-dialog';

// 初始化搜索引擎
searchManager.initialize().catch(error => {
  console.error('Failed to initialize search manager:', error);
});
// 监听快捷键命令
chrome.commands.onCommand.addListener(async (command) => {
	if (command === "open-panel") {
		console.log('Toggling CtrlK panel...');
		try {
			// 获取当前活动标签页
			const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
			
			if (!tab.id) {
				console.error('No active tab found');
				return;
			}

			// 如果当前标签页有弹窗且已打开，则关闭
			if (currentDialogTabId === tab.id && isDialogOpen) {
				await closeDialogInTab(tab.id);
				isDialogOpen = false;
				currentDialogTabId = null;
				console.log('Panel closed in tab:', tab.id);
				return;
			}

			// 如果弹窗在其他标签页，先关闭
			if (currentDialogTabId && currentDialogTabId !== tab.id) {
				await closeDialogInTab(currentDialogTabId);
				isDialogOpen = false;
			}

			// 在当前标签页打开弹窗
			const panelUrl = chrome.runtime.getURL('dist/index.html');
			toggleDialogInTab(tab.id, panelUrl);

			currentDialogTabId = tab.id;
			isDialogOpen = true;
			console.log('Panel opened in tab:', tab.id);
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

function toggleDialogInTab(tabId: number, src: string) {
	sendMessageToTab(tabId, { type: TOGGLE_DIALOG, src, id });
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
		isDialogOpen = false;
	}
});

// 监听标签页关闭
chrome.tabs.onRemoved.addListener((tabId) => {
	if (tabId === currentDialogTabId) {
		currentDialogTabId = null;
		isDialogOpen = false;
		console.log('Dialog tab was closed');
	}
});

// 监听来自内容脚本的消息
chrome.runtime.onMessage.addListener((message, sender) => {
	console.log("Background received message:", message);
	
	// 处理弹窗状态变化通知
	if (message.type === 'DIALOG_STATE_CHANGE') {
		if (message.dialogId === id && sender.tab?.id) {
			isDialogOpen = message.isOpen;
			if (!message.isOpen) {
				// 弹窗已关闭，清除状态
				if (currentDialogTabId === sender.tab.id) {
					currentDialogTabId = null;
				}
			} else {
				// 弹窗已打开，更新状态
				currentDialogTabId = sender.tab.id;
			}
			console.log(`Dialog state updated: ${message.isOpen ? 'opened' : 'closed'} in tab ${sender.tab.id}`);
		}
	}
});