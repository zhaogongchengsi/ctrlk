/**
 * Runtime API for CtrlK Extension
 * 提供页面注入的运行时 API
 */

import { CtrlKDialog, CtrlKDialogName } from './components/iframe-dialog';
import { CLOSE_DIALOG, OPEN_DIALOG } from './constant';

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

	constructor(config: Partial<CtrlKConfig> = {}) {
		this.config = { ...this.config, ...config };
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
	}
}
declare global {
	interface Window {
		CtrlK: {
			runtime: CtrlKRuntime;
			openDialog: (id: string, src: string, options?: DialogOptions) => CtrlKDialog;
			closeDialog: (id: string) => boolean;
			toggleDialog: (id: string) => boolean;
			postMessage: (id: string, message: unknown, targetOrigin?: string) => boolean;
		};
	}
}

// 创建全局实例
const runtime = new CtrlKRuntime();

// 暴露全局 API
// window.CtrlK = {
// 	runtime,
// 	openDialog: (id: string, src: string, options?: DialogOptions) => runtime.openDialog(id, src, options),
// 	closeDialog: (id: string) => runtime.closeDialog(id),
// 	toggleDialog: (id: string) => runtime.toggleDialog(id),
// 	postMessage: (id: string, message: unknown, targetOrigin = '*') =>
// 		runtime.postMessageToDialog(id, message, targetOrigin)
// };

window.addEventListener("message", (event) => {
	const data = event.data;
	console.log("Received message:", data);
	if (data && typeof data === "object" && "type" in data) {
		console.log("Message data:", data);
		if (data.type === OPEN_DIALOG) {
			runtime.openDialog(data.id, data.src);
			return;
		}

		if (data.type === CLOSE_DIALOG) {
			runtime.closeDialog(data.id);
		}
	}
});