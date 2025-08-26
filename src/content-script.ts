/**
 * Content Script for CtrlK Extension
 * 负责在页面中注入运行时 API 并处理弹窗显示
 */

// 常量定义
const DIALOG_ID = 'ctrlk-main-panel';

// 注入运行时 API 脚本
const script = document.createElement('script');
script.src = chrome.runtime.getURL('dist/runtime-api.js');
console.log('Injecting CtrlK API script:', script.src);
(document.head || document.documentElement).appendChild(script);

// 等待 API 加载完成后初始化
script.addEventListener('load', () => {
	console.log('CtrlK API injected');
	
	// 监听来自 background script 的消息
	chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
		switch (message.type) {
			case 'TOGGLE_CTRLK_PANEL':
				toggleCtrlKPanel(message.panelUrl);
				sendResponse({ success: true });
				break;
			case 'CLOSE_CTRLK_PANEL':
				closeCtrlKPanel();
				sendResponse({ success: true });
				break;
			default:
				break;
		}
	});
});

/**
 * 切换 CtrlK 主面板的显示状态
 */
function toggleCtrlKPanel(panelUrl: string) {
	// 等待 API 可用
	waitForCtrlKAPI().then(() => {
		if (window.CtrlK) {
			const dialog = window.CtrlK.runtime.getDialog(DIALOG_ID);
			
			if (dialog && dialog.isOpen()) {
				// 如果已打开，则关闭
				window.CtrlK.closeDialog(DIALOG_ID);
				notifyPanelClosed();
			} else {
				// 如果未打开，则打开
				openCtrlKPanel(panelUrl);
			}
		}
	});
}

/**
 * 打开 CtrlK 主面板
 */
function openCtrlKPanel(panelUrl: string) {
	if (!window.CtrlK) {
		console.error('CtrlK API not available');
		return;
	}

	try {
		const dialog = window.CtrlK.openDialog(DIALOG_ID, panelUrl, {
			width: '800px',
			height: '600px',
			title: 'CtrlK',
			hideHeader: false
		});

		// 监听弹窗事件
		dialog.addEventListener('dialog-close', () => {
			notifyPanelClosed();
		});

		// 设置失焦自动关闭
		setupBlurHandler(dialog);
		
		console.log('CtrlK panel opened');
	} catch (error) {
		console.error('Error opening CtrlK panel:', error);
	}
}

/**
 * 关闭 CtrlK 主面板
 */
function closeCtrlKPanel() {
	if (window.CtrlK) {
		const closed = window.CtrlK.closeDialog(DIALOG_ID);
		if (closed) {
			notifyPanelClosed();
		}
	}
}

/**
 * 设置失焦处理器
 */
function setupBlurHandler(dialog: ReturnType<typeof window.CtrlK.openDialog>) {
	// 监听页面失焦事件
	let blurTimeout: NodeJS.Timeout;
	
	const handleBlur = () => {
		// 延迟检查，避免在弹窗内部切换焦点时误关闭
		blurTimeout = setTimeout(() => {
			if (dialog.isOpen() && !dialog.contains(document.activeElement)) {
				window.CtrlK?.closeDialog(DIALOG_ID);
				notifyPanelBlur();
			}
		}, 100);
	};

	const handleFocus = () => {
		// 取消延迟关闭
		if (blurTimeout) {
			clearTimeout(blurTimeout);
		}
	};

	// 监听文档焦点变化
	document.addEventListener('blur', handleBlur, true);
	document.addEventListener('focus', handleFocus, true);
	
	// 监听点击事件（点击弹窗外部）
	document.addEventListener('click', (event) => {
		if (dialog.isOpen() && !dialog.contains(event.target as Node)) {
			window.CtrlK?.closeDialog(DIALOG_ID);
			notifyPanelBlur();
		}
	}, true);

	// 清理函数
	dialog.addEventListener('dialog-close', () => {
		document.removeEventListener('blur', handleBlur, true);
		document.removeEventListener('focus', handleFocus, true);
		if (blurTimeout) {
			clearTimeout(blurTimeout);
		}
	});
}

/**
 * 等待 CtrlK API 可用
 */
function waitForCtrlKAPI(): Promise<void> {
	return new Promise((resolve) => {
		if (window.CtrlK) {
			resolve();
			return;
		}

		const checkAPI = () => {
			if (window.CtrlK) {
				resolve();
			} else {
				setTimeout(checkAPI, 10);
			}
		};

		checkAPI();
	});
}

/**
 * 通知 background script 面板已关闭
 */
function notifyPanelClosed() {
	chrome.runtime.sendMessage({
		type: 'PANEL_CLOSED'
	}).catch(() => {
		// 忽略错误，可能是扩展被重新加载
	});
}

/**
 * 通知 background script 面板失去焦点
 */
function notifyPanelBlur() {
	chrome.runtime.sendMessage({
		type: 'PANEL_BLUR'
	}).catch(() => {
		// 忽略错误，可能是扩展被重新加载
	});
}