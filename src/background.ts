console.log('Background script running');

// 监听快捷键命令
chrome.commands.onCommand.addListener(async (command) => {
	if (command === "open-panel") {
		console.log('Creating window...');
		try {
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
			
			console.log('Window created:', window);
		} catch (error) {
			console.error('Error creating window:', error);
		}
	}
});