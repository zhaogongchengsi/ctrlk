console.log('Background script running');

// 存储面板窗口的ID
let panelWindowId: number | null = null;

// 监听快捷键命令
chrome.commands.onCommand.addListener(async (command) => {
	if (command === "open-panel") {
		console.log('Creating window...');
		try {
			// 如果窗口已存在，先关闭它
			if (panelWindowId) {
				try {
					await chrome.windows.remove(panelWindowId);
				} catch {
					// 窗口可能已经被手动关闭
				}
				panelWindowId = null;
			}

			// 获取当前活动窗口的信息
			const currentWindow = await chrome.windows.getCurrent();
			const popupWidth = 600;
			const popupHeight = 400;
			
			// 计算相对于当前浏览器窗口的居中位置
			const left = (currentWindow.left || 0) + Math.round(((currentWindow.width || 800) - popupWidth) / 2);
			const top = (currentWindow.top || 0) + Math.round(((currentWindow.height || 600) - popupHeight) / 2);
			
			// 创建一个新的弹窗窗口
			const window = await chrome.windows.create({
				url: chrome.runtime.getURL('dist/index.html'),
				type: 'popup',
				width: popupWidth,
				height: popupHeight,
				left: left,
				top: top,
				focused: true
			});
			
			panelWindowId = window?.id || null;
			console.log('Window created:', window);
		} catch (error) {
			console.error('Error creating window:', error);
		}
	}
});

// 监听窗口焦点变化
chrome.windows.onFocusChanged.addListener(async (windowId) => {
	// 如果面板窗口失去焦点（windowId 不是面板窗口的ID，且不是chrome.windows.WINDOW_ID_NONE）
	if (panelWindowId && windowId !== panelWindowId && windowId !== chrome.windows.WINDOW_ID_NONE) {
		try {
			// 关闭面板窗口
			await chrome.windows.remove(panelWindowId);
			panelWindowId = null;
			console.log('Panel window closed due to focus loss');
		} catch (error) {
			console.error('Error closing window on focus loss:', error);
		}
	}
});

// 监听窗口关闭事件
chrome.windows.onRemoved.addListener((windowId) => {
	if (windowId === panelWindowId) {
		panelWindowId = null;
		console.log('Panel window was closed');
	}
});