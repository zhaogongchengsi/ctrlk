/**
 * Dialog State Manager using RxJS
 * 使用 RxJS 管理对话框状态，支持跨标签页状态同步
 */

import { BehaviorSubject, Subject, Observable } from 'rxjs';
import { distinctUntilChanged, map } from 'rxjs/operators';

export interface DialogState {
	dialogId: string;
	isOpen: boolean;
	tabId?: number;
	timestamp: number;
}

export interface DialogStateEvent {
	type: 'OPEN' | 'CLOSE' | 'TOGGLE' | 'STATE_SYNC';
	dialogId: string;
	tabId?: number;
	force?: boolean; // 强制执行，不检查当前状态
}

class DialogStateManager {
	private dialogStates = new BehaviorSubject<Map<string, DialogState>>(new Map());
	private stateEvents = new Subject<DialogStateEvent>();

	/**
	 * 获取所有对话框状态的 Observable
	 */
	get states$(): Observable<Map<string, DialogState>> {
		return this.dialogStates.asObservable();
	}

	/**
	 * 获取状态事件的 Observable
	 */
	get events$(): Observable<DialogStateEvent> {
		return this.stateEvents.asObservable();
	}

	/**
	 * 获取特定对话框状态的 Observable
	 */
	getDialogState$(dialogId: string): Observable<DialogState | undefined> {
		return this.states$.pipe(
			map(states => states.get(dialogId)),
			distinctUntilChanged((prev, curr) => 
				prev?.isOpen === curr?.isOpen && prev?.timestamp === curr?.timestamp
			)
		);
	}

	/**
	 * 获取特定对话框是否打开的 Observable
	 */
	getDialogOpen$(dialogId: string): Observable<boolean> {
		return this.getDialogState$(dialogId).pipe(
			map(state => state?.isOpen ?? false),
			distinctUntilChanged()
		);
	}

	/**
	 * 获取当前对话框状态
	 */
	getDialogState(dialogId: string): DialogState | undefined {
		return this.dialogStates.value.get(dialogId);
	}

	/**
	 * 检查对话框是否打开
	 */
	isDialogOpen(dialogId: string): boolean {
		return this.getDialogState(dialogId)?.isOpen ?? false;
	}

	/**
	 * 更新对话框状态
	 */
	updateDialogState(dialogId: string, isOpen: boolean, tabId?: number): void {
		const currentStates = new Map(this.dialogStates.value);
		const state: DialogState = {
			dialogId,
			isOpen,
			tabId,
			timestamp: Date.now()
		};
		
		currentStates.set(dialogId, state);
		this.dialogStates.next(currentStates);

		// 广播状态变化事件
		this.broadcastStateChange(dialogId, isOpen, tabId);
	}

	/**
	 * 打开对话框
	 */
	openDialog(dialogId: string, tabId?: number, force = false): void {
		if (!force && this.isDialogOpen(dialogId)) {
			return; // 已经打开，不重复操作
		}

		// 关闭其他所有对话框
		this.closeAllDialogs(dialogId);
		
		this.updateDialogState(dialogId, true, tabId);
		this.stateEvents.next({ type: 'OPEN', dialogId, tabId, force });
	}

	/**
	 * 关闭对话框
	 */
	closeDialog(dialogId: string, tabId?: number, force = false): void {
		if (!force && !this.isDialogOpen(dialogId)) {
			return; // 已经关闭，不重复操作
		}

		this.updateDialogState(dialogId, false, tabId);
		this.stateEvents.next({ type: 'CLOSE', dialogId, tabId, force });
	}

	/**
	 * 切换对话框状态
	 */
	toggleDialog(dialogId: string, tabId?: number): void {
		const isCurrentlyOpen = this.isDialogOpen(dialogId);
		
		if (isCurrentlyOpen) {
			this.closeDialog(dialogId, tabId);
		} else {
			this.openDialog(dialogId, tabId);
		}
		
		this.stateEvents.next({ type: 'TOGGLE', dialogId, tabId });
	}

	/**
	 * 关闭所有对话框（除了指定的）
	 */
	closeAllDialogs(excludeDialogId?: string): void {
		const currentStates = new Map(this.dialogStates.value);
		let hasChanges = false;

		for (const [dialogId, state] of currentStates.entries()) {
			if (dialogId !== excludeDialogId && state.isOpen) {
				state.isOpen = false;
				state.timestamp = Date.now();
				hasChanges = true;
				
				// 触发关闭事件
				this.stateEvents.next({ type: 'CLOSE', dialogId, force: true });
			}
		}

		if (hasChanges) {
			this.dialogStates.next(currentStates);
		}
	}

	/**
	 * 删除对话框状态
	 */
	removeDialog(dialogId: string): void {
		const currentStates = new Map(this.dialogStates.value);
		if (currentStates.delete(dialogId)) {
			this.dialogStates.next(currentStates);
		}
	}

	/**
	 * 清理所有状态
	 */
	clear(): void {
		this.dialogStates.next(new Map());
	}

	/**
	 * 广播状态变化（可以被子类重写以支持跨标签页通信）
	 */
	protected broadcastStateChange(dialogId: string, isOpen: boolean, tabId?: number): void {
		// 默认实现为空，子类可以重写
		console.log(`Dialog ${dialogId} state changed: ${isOpen ? 'open' : 'closed'}`, { tabId });
	}

	/**
	 * 销毁状态管理器
	 */
	destroy(): void {
		this.dialogStates.complete();
		this.stateEvents.complete();
	}
}

export default DialogStateManager;
