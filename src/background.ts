console.log('Background script running');

// 存储当前显示弹窗的标签页ID
let currentDialogTabId: number | null = null;

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

			// 在当前标签页中切换弹窗
			await chrome.tabs.sendMessage(tab.id, {
				type: 'TOGGLE_CTRLK_PANEL',
				panelUrl: chrome.runtime.getURL('index.html')
			});

			currentDialogTabId = tab.id;
			console.log('Panel toggled in tab:', tab.id);
		} catch (error) {
			console.error('Error opening panel:', error);
		}
	}
});

// 关闭指定标签页中的弹窗
async function closeDialogInTab(tabId: number) {
	try {
		await chrome.tabs.sendMessage(tabId, {
			type: 'CLOSE_CTRLK_PANEL'
		});
	} catch {
		// 标签页可能已关闭或无法访问
		console.log('Could not close dialog in tab:', tabId);
	}
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
chrome.runtime.onMessage.addListener((message, sender) => {
	if (message.type === 'PANEL_CLOSED' && sender.tab?.id === currentDialogTabId) {
		currentDialogTabId = null;
		console.log('Panel was closed by user');
	}
	
	if (message.type === 'PANEL_BLUR' && sender.tab?.id === currentDialogTabId) {
		// 弹窗失去焦点，关闭它
		if (currentDialogTabId) {
			closeDialogInTab(currentDialogTabId);
			currentDialogTabId = null;
		}
	}
});