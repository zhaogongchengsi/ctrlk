/**
 * Runtime API for CtrlK Extension
 * 提供页面注入的运行时 API
 */

import { CtrlKDialog, CtrlKDialogName } from './components/iframe-dialog';
import { CLOSE_DIALOG, OPEN_DIALOG, TOGGLE_DIALOG } from './constant';
import ExtensionDialogStateManager from './state/extension-dialog-state-manager';

interface CtrlKConfig {
	enableAutoClose?: boolean;
	defaultWidth?: string;
	defaultHeight?: string;
	theme?: 'light' | 'dark' | 'auto';
}

interface CtrlKCommand {
	type: string;
	action: string;
	id?: string;
	src?: string;
	options?: DialogOptions;
}

interface DialogOptions {
	width?: string;
	height?: string;
	title?: string;
}

class CtrlKRuntime {
	private dialogs: Map<string, CtrlKDialog> = new Map();
	private config: CtrlKConfig = {
		enableAutoClose: true,
		defaultWidth: '600px',
		defaultHeight: '400px',
		theme: 'auto'
	};
	private stateManager: ExtensionDialogStateManager;

	constructor(config: Partial<CtrlKConfig> = {}) {
		this.config = { ...this.config, ...config };
		this.stateManager = new ExtensionDialogStateManager();
		this.init();
	}

	private init() {
		// 确保 Web Component 已注册
		if (!customElements.get(CtrlKDialogName)) {
			// Web Component 会在导入时自动注册
		}

		// 监听来自扩展的消息
		window.addEventListener('message', (event) => {
			if (event.source !== window) return;

			if (event.data.type === 'CTRLK_COMMAND') {
				this.handleCommand(event.data);
			}

			// 处理高度变化通知
			if (event.data.type === 'CTRLK_HEIGHT_NOTIFY') {
				if (event.data.dialogId) {
					this.notifyHeightChange(event.data.dialogId);
				}
			}
		});

		// 订阅状态变化
		this.stateManager.events$.subscribe(event => {
			console.log('Dialog state event:', event);
		});
	}

	private handleCommand(command: CtrlKCommand) {
		switch (command.action) {
			case 'OPEN_DIALOG':
				if (command.id && command.src) {
					this.openDialog(command.id, command.src, command.options);
				}
				break;
			case 'CLOSE_DIALOG':
				if (command.id) {
					this.closeDialog(command.id);
				}
				break;
			case 'TOGGLE_DIALOG':
				if (command.id) {
					this.toggleDialog(command.id);
				}
				break;
		}
	}

	/**
	 * 创建并打开一个 iframe dialog
	 */
	openDialog(id: string, src: string, options: DialogOptions = {}): CtrlKDialog {
		// 如果 dialog 已存在，先关闭
		if (this.dialogs.has(id)) {
			this.closeDialog(id);
		}

		// 创建新的 dialog
		const dialog = document.createElement(CtrlKDialogName) as CtrlKDialog;

		// 设置属性
		dialog.setAttribute('src', src);
		dialog.setAttribute('width', options.width || this.config.defaultWidth!);
		dialog.setAttribute('height', options.height || this.config.defaultHeight!);

		if (options.title) {
			dialog.setAttribute('title', options.title);
		}

		// 添加事件监听
		dialog.addEventListener('dialog-close', () => {
			this.dialogs.delete(id);
			dialog.remove();
			// 使用状态管理器报告实际状态
			this.stateManager.reportActualDialogState(id, false);
		});

		dialog.addEventListener('dialog-open', () => {
			// 使用状态管理器报告实际状态
			this.stateManager.reportActualDialogState(id, true);
		});

		// 添加到页面并存储引用
		document.body.appendChild(dialog);
		this.dialogs.set(id, dialog);

		// 打开 dialog
		dialog.open();

		return dialog;
	}

	/**
	 * 关闭指定的 dialog
	 */
	closeDialog(id: string): boolean {
		const dialog = this.dialogs.get(id);
		if (dialog) {
			dialog.close();
			return true;
		}
		return false;
	}

	/**
	 * 切换指定 dialog 的显示状态
	 */
	toggleDialog(id: string): boolean {
		const dialog = this.dialogs.get(id);
		if (dialog) {
			dialog.toggle();
			return true;
		}
		return false;
	}

	/**
	 * 获取指定的 dialog 实例
	 */
	getDialog(id: string): CtrlKDialog | undefined {
		return this.dialogs.get(id);
	}

	/**
	 * 关闭所有 dialog
	 */
	closeAllDialogs(): void {
		this.dialogs.forEach((_, id) => {
			this.closeDialog(id);
		});
	}

	/**
	 * 通知指定 dialog 高度可能发生变化，重新计算高度
	 */
	notifyHeightChange(id: string): boolean {
		const dialog = this.dialogs.get(id);
		if (dialog) {
			// 触发高度重新计算
			dialog.refreshHeight();
			return true;
		}
		return false;
	}

	/**
	 * 向指定 dialog 的 iframe 发送消息
	 */
	postMessageToDialog(id: string, message: unknown, targetOrigin = '*'): boolean {
		const dialog = this.dialogs.get(id);
		if (dialog) {
			dialog.postMessage(message, targetOrigin);
			return true;
		}
		return false;
	}

	/**
	 * 更新配置
	 */
	updateConfig(newConfig: Partial<CtrlKConfig>): void {
		this.config = { ...this.config, ...newConfig };
	}

	/**
	 * 获取当前配置
	 */
	getConfig(): CtrlKConfig {
		return { ...this.config };
	}

	/**
	 * 销毁运行时，清理所有资源
	 */
	destroy(): void {
		this.closeAllDialogs();
		this.dialogs.clear();
		this.stateManager.destroy();
	}
}

// 创建全局实例
const runtime = new CtrlKRuntime();

// 声明全局窗口方法类型
declare global {
	interface Window {
		notifyParentHeightChange: (dialogId?: string) => void;
		notifyDialogHeightChange: (dialogId: string) => boolean;
	}
}

// 全局方法：通知父页面高度可能发生变化
window.notifyParentHeightChange = (dialogId?: string) => {
	// 如果在 iframe 中，向父页面发送高度变化通知
	if (window.parent !== window) {
		window.parent.postMessage({
			type: 'HEIGHT_CHANGE_NOTIFICATION',
			dialogId: dialogId
		}, '*');
	}
};

// 全局方法：通知当前页面的 dialog 高度变化
window.notifyDialogHeightChange = (dialogId: string) => {
	return runtime.notifyHeightChange(dialogId);
};

window.addEventListener("message", (event) => {
	const data = event.data;
	if (data && typeof data === "object" && "type" in data) {
		if (data.type === OPEN_DIALOG) {
			runtime.openDialog(data.id, data.src);
			return;
		}

		if (data.type === CLOSE_DIALOG) {
			runtime.closeDialog(data.id);
			return;
		}

		if (data.type === TOGGLE_DIALOG) {
			// 检查弹窗是否存在并且打开
			const dialog = runtime.getDialog(data.id);
			if (dialog && dialog.isOpen()) {
				runtime.closeDialog(data.id);
			} else {
				runtime.openDialog(data.id, data.src);
			}
			return;
		}
	}
});