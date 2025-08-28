/**
 * IframeDialog Web Component
 * 独立封装的 dialog 组件，使用 iframe 承载子页面
 * 使用 GSAP 提供流畅的动画效果
 */

import { gsap } from 'gsap';
import { DIALOG_BORDER_RADIUS_SIZE } from '../constant';

export const CtrlKDialogName = 'ctrlk-dialog';

// 固定的初始渲染高度常量
const INITIAL_DIALOG_HEIGHT = 400;

class CtrlKDialog extends HTMLElement {
	private shadow: ShadowRoot;
	private dialog: HTMLDialogElement;
	private iframe: HTMLIFrameElement;
	private windowResizeHandler?: () => void;
	private messageHandler?: (event: MessageEvent) => void;
	private animationTimeline?: gsap.core.Timeline;
	private heightAnimationTween?: gsap.core.Tween;
	private isLoading: boolean = true;
	private loadingElement?: HTMLElement;

	constructor() {
		super();
		this.shadow = this.attachShadow({ mode: 'open' });
		this.dialog = document.createElement('dialog');
		this.iframe = document.createElement('iframe');
		this.init();
	}

	static get observedAttributes() {
		return ['src', 'width', 'height', 'title'];
	}

	private init() {
		// 创建样式 - 只保留基础功能性样式，提供CSS自定义属性供子页面使用
		const style = document.createElement('style');
		style.textContent = `
      :host {
        /* 可被子页面覆盖的CSS自定义属性 */
        --dialog-width: 600px;
        --dialog-height: ${INITIAL_DIALOG_HEIGHT}px;
        --dialog-min-height: ${INITIAL_DIALOG_HEIGHT}px;
        --dialog-max-height: 66.67vh;
        
        /* 基础定位 */
        position: fixed;
        top: 0;
        left: 0;
        width: 100%;
        height: 100%;
        z-index: 9998;
        pointer-events: none;
      }

      dialog {
        /* 基础尺寸和定位 - 使用固定初始高度 */
        border: none;
        padding: 0;
        margin: 0;
        width: var(--dialog-width);
        height: var(--dialog-height);
        min-height: var(--dialog-min-height);
        max-height: var(--dialog-max-height);
        max-width: 90vw;
        
        /* 定位 */
        position: fixed;
        top: 50%;
        left: 50%;
        transform: translate(-50%, -50%) scale(0.9);
        
        /* 禁用拖拽和调整大小 */
        resize: none;
        user-select: none;
        -webkit-user-drag: none;
        
        /* 功能性设置 */
        overflow: hidden;
        outline: none;
        z-index: 9999;
        pointer-events: auto;
        opacity: 0;
        transition: none; /* 禁用CSS过渡，使用GSAP控制 */
        
        /* 完全透明的基础样式，所有装饰由子页面控制 */
        background: transparent;
        box-shadow: none;
        border-radius: ${DIALOG_BORDER_RADIUS_SIZE};
      }

      dialog[open] {
        opacity: 1;
        transform: translate(-50%, -50%) scale(1);
      }

      /* 完全移除聚焦轮廓 */
      dialog:focus {
        outline: none;
      }

      /* 自适应主题的蒙板背景 */
      dialog::backdrop {
        background: rgba(0, 0, 0, 0.2);
        backdrop-filter: blur(4px) saturate(1.2);
        -webkit-backdrop-filter: blur(4px) saturate(1.2);
        opacity: 0;
        transition: opacity 0.3s cubic-bezier(0.4, 0, 0.2, 1);
      }

      /* 深色主题蒙板 */
      @media (prefers-color-scheme: dark) {
        dialog::backdrop {
          background: rgba(0, 0, 0, 0.3);
          backdrop-filter: blur(6px) saturate(1.1);
          -webkit-backdrop-filter: blur(6px) saturate(1.1);
        }
      }

      /* 浅色主题蒙板 */
      @media (prefers-color-scheme: light) {
        dialog::backdrop {
          background: rgba(0, 0, 0, 0.15);
          backdrop-filter: blur(3px) saturate(1.3);
          -webkit-backdrop-filter: blur(3px) saturate(1.3);
        }
      }

      dialog[open]::backdrop {
        opacity: 1;
      }

      iframe {
        /* 基础尺寸 */
        width: 100%;
        height: 100%;
        border: none;
        display: block;
        border-radius: ${DIALOG_BORDER_RADIUS_SIZE};
        
        /* 移除所有默认样式 */
        outline: none;
        background: transparent;
      }

      /* 最小化的加载指示器，可被子页面完全自定义 */
      .loading {
        position: absolute;
        top: 0;
        left: 0;
        width: 100%;
        height: 100%;
        display: flex;
        align-items: center;
        justify-content: center;
        flex-direction: column;
        gap: 12px;
        background: transparent;
        z-index: 1;
        
        /* 提供CSS自定义属性供子页面覆盖 */
        color: var(--loading-color, rgba(0, 0, 0, 0.6));
        font-family: var(--loading-font, system-ui, -apple-system, sans-serif);
        font-size: var(--loading-font-size, 14px);
      }

      .loading-spinner {
        width: var(--spinner-size, 24px);
        height: var(--spinner-size, 24px);
        border: 2px solid var(--spinner-track, rgba(0, 0, 0, 0.1));
        border-top: 2px solid var(--spinner-color, rgba(0, 0, 0, 0.6));
        border-radius: 50%;
        animation: spin var(--spinner-duration, 1s) linear infinite;
      }

      .loading-text {
        color: inherit;
        font-size: inherit;
        font-family: inherit;
      }

      @keyframes spin {
        0% { transform: rotate(0deg); }
        100% { transform: rotate(360deg); }
      }
    `;

		// 创建 dialog 结构 - 最简结构，只有必要的加载指示器
		this.dialog.innerHTML = `
      <div class="loading">
        <div class="loading-spinner"></div>
        <div class="loading-text">Loading...</div>
      </div>
    `;

		// 配置 iframe
		this.iframe.style.display = 'none';
		// this.iframe.setAttribute('sandbox', 'allow-scripts allow-same-origin allow-forms allow-popups');

		this.shadow.appendChild(style);
		this.shadow.appendChild(this.dialog);
		this.dialog.appendChild(this.iframe);

		this.setupEventListeners();
		this.setupThemeDetection();
	}

	// 设置主题检测
	private setupThemeDetection() {
		// 初始主题设置
		this.updateBackdropTheme();

		// 监听系统主题变化
		const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
		mediaQuery.addEventListener('change', () => {
			this.updateBackdropTheme();
		});

		// 监听页面主题变化（检测页面是否有深色主题类名）
		const observer = new MutationObserver(() => {
			this.updateBackdropTheme();
		});

		observer.observe(document.documentElement, {
			attributes: true,
			attributeFilter: ['class', 'data-theme', 'data-color-scheme']
		});

		observer.observe(document.body, {
			attributes: true,
			attributeFilter: ['class', 'data-theme', 'data-color-scheme']
		});
	}

	// 更新蒙板主题
	private updateBackdropTheme() {
		// 检测当前主题
		const isDark = this.detectDarkTheme();
		
		// 动态设置蒙板样式
		const style = this.shadow.querySelector('style');
		if (style) {
			// 移除旧的主题样式
			style.textContent = style.textContent!.replace(
				/\/\* 动态主题蒙板 \*\/[\s\S]*?\/\* 动态主题蒙板结束 \*\//g, 
				''
			);
			
			// 添加新的主题样式
			const themeStyle = `
      /* 动态主题蒙板 */
      dialog::backdrop {
        background: ${isDark 
          ? 'rgba(0, 0, 0, 0.25)' 
          : 'rgba(0, 0, 0, 0.12)'} !important;
        backdrop-filter: ${isDark 
          ? 'blur(5px) saturate(1.1)' 
          : 'blur(3px) saturate(1.2)'} !important;
        -webkit-backdrop-filter: ${isDark 
          ? 'blur(5px) saturate(1.1)' 
          : 'blur(3px) saturate(1.2)'} !important;
      }
      /* 动态主题蒙板结束 */`;
			
			style.textContent += themeStyle;
		}
	}

	// 检测深色主题
	private detectDarkTheme(): boolean {
		// 1. 检查系统偏好
		const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
		
		// 2. 检查页面类名
		const htmlClasses = document.documentElement.className;
		const bodyClasses = document.body.className;
		const darkClassPatterns = /dark|night|black/i;
		
		const hasPageDarkClass = darkClassPatterns.test(htmlClasses) || darkClassPatterns.test(bodyClasses);
		
		// 3. 检查常见的主题属性
		const htmlTheme = document.documentElement.getAttribute('data-theme') || 
		                  document.documentElement.getAttribute('data-color-scheme');
		const bodyTheme = document.body.getAttribute('data-theme') || 
		                  document.body.getAttribute('data-color-scheme');
		
		const hasThemeAttr = darkClassPatterns.test(htmlTheme || '') || darkClassPatterns.test(bodyTheme || '');
		
		// 4. 检查背景色
		const bodyBgColor = getComputedStyle(document.body).backgroundColor;
		const htmlBgColor = getComputedStyle(document.documentElement).backgroundColor;
		
		// 简单的亮度检测（如果背景是深色）
		const isDarkBackground = this.isColorDark(bodyBgColor) || this.isColorDark(htmlBgColor);
		
		// 优先级：页面明确设置的主题 > 背景色检测 > 系统偏好
		return hasPageDarkClass || hasThemeAttr || isDarkBackground || prefersDark;
	}

	// 检测颜色是否为深色
	private isColorDark(color: string): boolean {
		// 解析RGB颜色
		const rgb = color.match(/rgba?\((\d+),\s*(\d+),\s*(\d+)/);
		if (!rgb) return false;
		
		const r = parseInt(rgb[1]);
		const g = parseInt(rgb[2]);
		const b = parseInt(rgb[3]);
		
		// 计算亮度 (0-255)
		const brightness = (r * 299 + g * 587 + b * 114) / 1000;
		
		// 亮度小于128认为是深色
		return brightness < 128;
	}

	private setupEventListeners() {
		const loading = this.shadow.querySelector('.loading');

		// ESC 键关闭
		this.dialog.addEventListener('keydown', (e) => {
			if (e.key === 'Escape') {
				this.close();
			}
		});

		// 点击背景关闭
		this.dialog.addEventListener('click', (e) => {
			if (e.target === this.dialog) {
				this.close();
			}
		});

		// 对话框聚焦时，尝试聚焦 iframe 中的输入框
		this.dialog.addEventListener('focus', () => {
			setTimeout(() => {
				this.focusInputInIframe();
			}, 50);
		});

		// iframe 加载完成
		this.iframe.addEventListener('load', () => {
			// 设置 iframe 初始透明度为0（隐藏状态）
			gsap.set(this.iframe, { opacity: 0 });
			this.iframe.style.display = 'block';
			
			// 开始监听来自子页面的消息（包括主题设置完成通知）
			this.startMessageListening();
			
			// 发送主题信息到子页面（如果还在loading状态）
			if (this.isLoading) {
				// 延迟发送，确保子页面已经准备好接收消息
				setTimeout(() => {
					this.sendThemeToChild();
				}, 100);
			}
		});

		// iframe 加载错误
		this.iframe.addEventListener('error', () => {
			const loadingElement = loading as HTMLElement;
			if (loadingElement) {
				loadingElement.textContent = 'Failed to load content';
				loadingElement.style.color = '#ef4444';
			}
		});
	}

	attributeChangedCallback(name: string, oldValue: string, newValue: string) {
		if (oldValue === newValue) return;

		switch (name) {
			case 'src':
				this.iframe.src = newValue;
				break;
			case 'width':
				this.dialog.style.setProperty('--dialog-width', newValue);
				break;
			case 'height':
				this.dialog.style.setProperty('--dialog-height', newValue);
				break;
			case 'title': {
				const titleElement = this.shadow.querySelector('.dialog-title');
				if (titleElement) {
					titleElement.textContent = newValue;
				}
				break;
			}
		}
	}

	// 向子页面发送生命周期通知
	private notifyChildPageLifecycle(event: 'will-show' | 'will-hide' | 'did-show' | 'did-hide') {
		if (this.iframe.contentWindow) {
			const message = {
				type: 'DIALOG_LIFECYCLE',
				event: event,
				timestamp: Date.now()
			};
			
			try {
				this.iframe.contentWindow.postMessage(message, '*');
				console.log(`Notified child page: ${event}`);
			} catch (error) {
				console.warn('Failed to notify child page:', error);
			}
		}
	}

	// 聚焦 iframe 中的输入框
	private focusInputInIframe() {
		if (this.iframe.contentWindow) {
			try {
				// 发送聚焦请求到子页面
				const message = {
					type: 'FOCUS_INPUT',
					timestamp: Date.now()
				};
				this.iframe.contentWindow.postMessage(message, '*');
				console.log('Sent focus input request to iframe');
			} catch (error) {
				console.warn('Failed to request input focus in iframe:', error);
			}
		}
	}

	// 显示加载状态
	private showLoading() {
		this.loadingElement = this.shadow.querySelector('.loading') as HTMLElement;
		if (this.loadingElement) {
			this.loadingElement.style.display = 'flex';
			this.loadingElement.style.opacity = '1';
		}
		this.iframe.style.display = 'none';
	}

	// 隐藏加载状态并显示内容
	private hideLoading() {
		if (this.loadingElement) {
			gsap.to(this.loadingElement, {
				duration: 0.2,
				opacity: 0,
				scale: 0.9,
				ease: 'power2.in',
				onComplete: () => {
					if (this.loadingElement) {
						this.loadingElement.style.display = 'none';
					}
				}
			});
		}
		
		// 显示iframe内容
		this.iframe.style.display = 'block';
		gsap.fromTo(this.iframe, 
			{ opacity: 0 },
			{ 
				duration: 0.3,
				opacity: 1,
				ease: 'power2.out',
				onComplete: () => {
					// 内容显示完成，通知子页面并聚焦
					this.isLoading = false;
					this.notifyChildPageLifecycle('did-show');
					this.focusInputInIframe();
				}
			}
		);
	}

	// 发送主题信息到子页面
	private sendThemeToChild() {
		if (this.iframe.contentWindow) {
			const isDark = this.detectDarkTheme();
			const message = {
				type: 'SET_THEME',
				theme: isDark ? 'dark' : 'light',
				timestamp: Date.now()
			};
			
			try {
				this.iframe.contentWindow.postMessage(message, '*');
				console.log(`Sent theme to child: ${message.theme}`);
			} catch (error) {
				console.warn('Failed to send theme to child:', error);
			}
		}
	}

	// 公共方法
	open() {
		// 设置初始加载状态
		this.isLoading = true;
		this.showLoading();
		
		// 更新蒙板主题
		this.updateBackdropTheme();
		
		// 设置初始状态 - 保持居中定位，使用固定高度
		gsap.set(this.dialog, {
			opacity: 0,
			scale: 0.9,
			transformOrigin: 'center center',
			x: '-50%',
			y: '-50%'
		});
		
		this.dialog.showModal();
		
		// 创建入场动画时间线 - 弹窗和蒙板一起出现
		this.animationTimeline = gsap.timeline();

		// 背景和弹窗同时渐入
		this.animationTimeline.to(this.dialog, {
			duration: 0.3,
			opacity: 1,
			ease: 'power2.out'
		}, 0);

		// 弹窗缩放和弹性进入 - 保持居中
		this.animationTimeline.to(this.dialog, {
			duration: 0.4,
			scale: 1,
			x: '-50%',
			y: '-50%',
			ease: 'back.out(1.7)'
		}, 0.1);
		
		this.dispatchEvent(new CustomEvent('dialog-open'));

		// 监听窗口大小变化
		this.setupWindowResizeListener();
	}

	close() {
		// 立即触发关闭事件，不等待动画完成
		this.dispatchEvent(new CustomEvent('dialog-close'));
		
		// 通知子页面即将失焦/隐藏
		this.notifyChildPageLifecycle('will-hide');
		
		// 停止任何正在进行的动画
		if (this.animationTimeline) {
			this.animationTimeline.kill();
		}
		if (this.heightAnimationTween) {
			this.heightAnimationTween.kill();
		}
		
		// 创建退出动画
		const closeTimeline = gsap.timeline({
			onComplete: () => {
				// 动画完成后关闭对话框
				this.dialog.close();
				this.stopHeightWatching();
				
				// 恢复页面滚动
				document.body.style.overflow = '';
				
				// 延迟通知子页面已经隐藏
				setTimeout(() => {
					this.notifyChildPageLifecycle('did-hide');
				}, 50);
			}
		});

		// 弹窗缩小和淡出 - 保持居中
		closeTimeline.to(this.dialog, {
			duration: 0.25,
			scale: 0.95,
			opacity: 0,
			x: '-50%',
			y: '-50%',
			ease: 'power2.in'
		});
	}

	toggle() {
		if (this.dialog.open) {
			this.close();
		} else {
			this.open();
		}
	}

	// 检查是否打开
	isOpen(): boolean {
		return this.dialog.open;
	}

	// 自适应内容高度
	private adjustHeight(height?: number, useAnimation = false) {
		try {
			// 尝试获取 iframe 内容的高度
			const iframeDocument = this.iframe.contentDocument;
			if (iframeDocument && !height) {
				const contentHeight = iframeDocument.documentElement.scrollHeight;
				const viewportHeight = window.innerHeight;
				const maxHeight = Math.floor(viewportHeight * 0.8); // 最大高度为视口高度的 80%
				const minHeight = 200;

				// 计算合适的高度，并确保不超过最大高度
				const targetHeight = Math.min(Math.max(contentHeight + 20, minHeight), maxHeight);
				
				console.log('Adjusting height:', { contentHeight, targetHeight, useAnimation });
				
				// 调整位置和大小
				this.adjustPosition(targetHeight, useAnimation);
			} else if (height) {
				// 如果提供了具体高度值，直接使用
				console.log('Adjusting to specific height:', { height, useAnimation });
				this.adjustPosition(height, useAnimation);
			}
		} catch (error) {
			// 跨域情况下无法获取内容高度，使用默认高度
			console.log('Cannot access iframe content height due to CORS policy:', error);
			const defaultHeight = 400;
			const maxHeight = Math.floor(window.innerHeight * 0.8);
			const finalHeight = Math.min(defaultHeight, maxHeight);

			this.adjustPosition(finalHeight, useAnimation);
		}
	}

	// 调整 dialog 位置，确保在视口内
	private adjustPosition(dialogHeight: number, useAnimation = false) {
		const viewportHeight = window.innerHeight;
		const viewportWidth = window.innerWidth;
		
		// 获取当前 dialog 的宽度
		const dialogWidth = this.dialog.offsetWidth;
		
		// 计算最大可用高度，留出一些边距
		const maxAvailableHeight = viewportHeight - 40; // 上下各留 20px 边距
		
		// 如果内容高度超过可用高度，限制高度并启用滚动
		const finalHeight = Math.min(dialogHeight, maxAvailableHeight);
		const overflowY = dialogHeight > maxAvailableHeight ? 'auto' : 'hidden';
		
		// 确保水平居中，如果宽度超过视口宽度则调整
		const finalWidth = Math.min(dialogWidth, viewportWidth - 40);
		
		// 停止之前的高度动画
		if (this.heightAnimationTween) {
			this.heightAnimationTween.kill();
		}

		if (!useAnimation) {
			// 直接设置高度和宽度
			this.dialog.style.height = `${finalHeight}px`;
			this.dialog.style.width = `${finalWidth}px`;
			this.dialog.style.overflowY = overflowY;
			return;
		}
		
		// 使用 GSAP 进行平滑的高度和宽度过渡
		this.heightAnimationTween = gsap.to(this.dialog, {
			duration: 0.3,
			height: finalHeight,
			width: finalWidth,
			ease: 'power2.out',
			onUpdate: () => {
				// 在动画过程中更新溢出样式
				this.dialog.style.overflowY = overflowY;
			},
			onComplete: () => {
				// 动画完成后确保样式正确
				this.dialog.style.overflowY = overflowY;
				this.heightAnimationTween = undefined;
			}
		});
	}

	// 开始监听来自子页面的消息
	private startMessageListening() {
		this.messageHandler = (event: MessageEvent) => {
			// 确保消息来自当前的 iframe
			if (event.source !== this.iframe.contentWindow) {
				return;
			}
			
			// 处理高度变化通知
			if (event.data && event.data.type === 'HEIGHT_CHANGE_NOTIFICATION') {
				// 重新获取高度并更新
				this.adjustHeight(event.data?.height, true);
				return;
			}
			
			// 处理主题设置完成通知
			if (event.data && event.data.type === 'THEME_READY') {
				console.log('Child page theme is ready');
				// 子页面主题设置完成，结束loading状态
				if (this.isLoading) {
					this.hideLoading();
				}
				return;
			}
		};

		// 监听来自 iframe 的消息
		window.addEventListener('message', this.messageHandler);
	}

	// 停止监听消息
	private stopMessageListening() {
		if (this.messageHandler) {
			window.removeEventListener('message', this.messageHandler);
			this.messageHandler = undefined;
		}
	}

	// 停止监听高度变化
	private stopHeightWatching() {
		this.stopMessageListening();
		this.removeWindowResizeListener();
	}

	// 设置窗口大小变化监听
	private setupWindowResizeListener() {
		this.windowResizeHandler = () => {
			// 窗口大小变化时重新计算高度和位置
			setTimeout(() => {
				// 获取当前高度
				const currentHeight = this.dialog.offsetHeight;
				// 重新调整位置，确保在视口内
				this.adjustPosition(currentHeight, false);
				// 重新计算内容高度
				this.adjustHeight(currentHeight, false);
			}, 100);
		};

		window.addEventListener('resize', this.windowResizeHandler);
	}

	// 移除窗口大小变化监听
	private removeWindowResizeListener() {
		if (this.windowResizeHandler) {
			window.removeEventListener('resize', this.windowResizeHandler);
			this.windowResizeHandler = undefined;
		}
	}

	// 设置 iframe 的 src
	setSrc(src: string) {
		this.setAttribute('src', src);
	}

	// 获取 iframe 实例（用于高级操作）
	getIframe() {
		return this.iframe;
	}

	// 向 iframe 发送消息
	postMessage(message: unknown, targetOrigin = '*') {
		if (this.iframe.contentWindow) {
			this.iframe.contentWindow.postMessage(message, targetOrigin);
		}
	}

	// 公共方法：触发高度重新计算（不使用动画）
	refreshHeight() {
		this.adjustHeight(undefined, false);
	}

	// 公共方法：聚焦输入框
	focusInput() {
		// 首先聚焦 dialog
		this.dialog.focus();
		// 然后尝试聚焦 iframe 中的输入框
		setTimeout(() => {
			this.focusInputInIframe();
		}, 50);
	}
}

// 注册 Web Component
customElements.define(CtrlKDialogName, CtrlKDialog);

export { CtrlKDialog };
