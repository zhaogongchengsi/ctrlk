/**
 * Extension Dialog State Manager
 * 扩展环境中的对话框状态管理器，支持与 background script 通信
 */

import DialogStateManager from './dialog-state-manager';
import type { DialogState } from './dialog-state-manager';

interface DialogOptions {
	width?: string;
	height?: string;
	title?: string;
}

interface BackgroundMessage {
	type: string;
	action?: string;
	dialogId?: string;
	src?: string;
	options?: DialogOptions;
}

interface PageMessage {
	type: string;
	action: string;
	id: string;
	src?: string;
	options?: DialogOptions;
}

class ExtensionDialogStateManager extends DialogStateManager {
	private isExtensionContext: boolean;

	constructor() {
		super();
		this.isExtensionContext = this.checkExtensionContext();
		this.setupMessageHandling();
	}

	/**
	 * 检查是否在扩展环境中
	 */
	private checkExtensionContext(): boolean {
		return typeof chrome !== 'undefined' && 
			   chrome.runtime && 
			   chrome.runtime.id !== undefined;
	}

	/**
	 * 设置消息处理
	 */
	private setupMessageHandling(): void {
		if (!this.isExtensionContext) return;

		// 监听来自 background script 的消息
		chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
			this.handleBackgroundMessage(message, sender, sendResponse);
			return true; // 保持消息通道开放
		});
	}

	/**
	 * 处理来自 background script 的消息
	 */
	private handleBackgroundMessage(message: BackgroundMessage, _sender: chrome.runtime.MessageSender, sendResponse: (response?: unknown) => void): void {
		if (message.type === 'DIALOG_COMMAND') {
			const { action, dialogId, src, options } = message;
			
			switch (action) {
				case 'OPEN_DIALOG':
					if (dialogId) this.handleOpenCommand(dialogId, src, options);
					break;
				case 'CLOSE_DIALOG':
					if (dialogId) this.handleCloseCommand(dialogId);
					break;
				case 'TOGGLE_DIALOG':
					if (dialogId) this.handleToggleCommand(dialogId, src, options);
					break;
			}
			
			sendResponse({ success: true });
		}
		
		if (message.type === 'GET_DIALOG_STATE' && message.dialogId) {
			const state = this.getDialogState(message.dialogId);
			sendResponse({ state });
		}
	}

	/**
	 * 处理打开命令
	 */
	private handleOpenCommand(dialogId: string, src?: string, options?: DialogOptions): void {
		// 如果已经打开，不重复操作
		if (this.isDialogOpen(dialogId)) return;

		this.openDialog(dialogId);
		
		// 通知页面打开对话框
		this.postMessageToPage({
			type: 'CTRLK_COMMAND',
			action: 'OPEN_DIALOG',
			id: dialogId,
			src: src,
			options: options
		});
	}

	/**
	 * 处理关闭命令
	 */
	private handleCloseCommand(dialogId: string): void {
		// 如果已经关闭，不重复操作
		if (!this.isDialogOpen(dialogId)) return;

		this.closeDialog(dialogId);
		
		// 通知页面关闭对话框
		this.postMessageToPage({
			type: 'CTRLK_COMMAND',
			action: 'CLOSE_DIALOG',
			id: dialogId
		});
	}

	/**
	 * 处理切换命令
	 */
	private handleToggleCommand(dialogId: string, src?: string, options?: DialogOptions): void {
		if (this.isDialogOpen(dialogId)) {
			this.handleCloseCommand(dialogId);
		} else {
			this.handleOpenCommand(dialogId, src, options);
		}
	}

	/**
	 * 向页面发送消息
	 */
	private postMessageToPage(message: PageMessage): void {
		window.postMessage(message, '*');
	}

	/**
	 * 向 background script 发送状态变化通知
	 */
	protected broadcastStateChange(dialogId: string, isOpen: boolean, tabId?: number): void {
		super.broadcastStateChange(dialogId, isOpen, tabId);
		
		if (this.isExtensionContext) {
			try {
				chrome.runtime.sendMessage({
					type: 'DIALOG_STATE_CHANGE',
					dialogId,
					isOpen,
					tabId
				}).catch((error) => {
					console.warn('Failed to send state change to background:', error);
				});
			} catch (error) {
				console.warn('Failed to send state change to background:', error);
			}
		}
	}

	/**
	 * 报告对话框实际状态（由页面中的对话框组件调用）
	 */
	reportActualDialogState(dialogId: string, isOpen: boolean): void {
		const currentState = this.getDialogState(dialogId);
		
		// 如果状态不一致，更新状态
		if (!currentState || currentState.isOpen !== isOpen) {
			this.updateDialogState(dialogId, isOpen);
		}
	}

	/**
	 * 请求从 background script 同步状态
	 */
	async syncStateFromBackground(dialogId: string): Promise<DialogState | undefined> {
		if (!this.isExtensionContext) return undefined;

		try {
			const response = await chrome.runtime.sendMessage({
				type: 'GET_DIALOG_STATE',
				dialogId
			});
			
			if (response?.state) {
				this.updateDialogState(dialogId, response.state.isOpen, response.state.tabId);
				return response.state;
			}
		} catch (error) {
			console.warn('Failed to sync state from background:', error);
		}
		
		return undefined;
	}
}

export default ExtensionDialogStateManager;
