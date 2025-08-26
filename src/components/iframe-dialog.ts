/**
 * IframeDialog Web Component
 * 独立封装的 dialog 组件，使用 iframe 承载子页面
 */

export  const  CtrlKDialogName = 'ctrlk-dialog';

class CtrlKDialog extends HTMLElement {
  private shadow: ShadowRoot;
  private dialog: HTMLDialogElement;
  private iframe: HTMLIFrameElement;
  private resizeObserver?: ResizeObserver;
  private mutationObserver?: MutationObserver;
  private heightCheckInterval?: NodeJS.Timeout;
  private windowResizeHandler?: () => void;

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
    // 创建样式
    const style = document.createElement('style');
    style.textContent = `
      :host {
        --dialog-width: 600px;
        --dialog-min-height: 0;
        --dialog-max-height: 66.67vh;
        --dialog-bg: rgba(0, 0, 0, 0.5);
        --content-bg: white;
        --border-radius: 12px;
        --shadow: 0 20px 50px rgba(0, 0, 0, 0.3);
      }

      dialog {
        border: none;
        border-radius: var(--border-radius);
        padding: 0;
        width: var(--dialog-width);
        min-height: var(--dialog-min-height);
        max-height: var(--dialog-max-height);
        max-width: 90vw;
        background: var(--content-bg);
        box-shadow: var(--shadow);
        position: relative;
        resize: vertical;
        overflow: hidden;
      }

      dialog::backdrop {
        background: var(--dialog-bg);
        backdrop-filter: blur(4px);
      }

      iframe {
        width: 100%;
        height: 100%;
        border: none;
        border-radius: var(--border-radius);
        display: block;
      }

      .loading {
        display: flex;
        align-items: center;
        justify-content: center;
        height: 200px;
        color: #6b7280;
      }
    `;

    // 创建 dialog 结构 - 移除头部，只保留 iframe
    this.dialog.innerHTML = `
      <div class="loading">Loading...</div>
    `;

    // 配置 iframe
    this.iframe.style.display = 'none';
    // this.iframe.setAttribute('sandbox', 'allow-scripts allow-same-origin allow-forms allow-popups');
    
    this.shadow.appendChild(style);
    this.shadow.appendChild(this.dialog);
    this.dialog.appendChild(this.iframe);

    this.setupEventListeners();
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

    // iframe 加载完成
    this.iframe.addEventListener('load', () => {
      const loadingElement = loading as HTMLElement;
      if (loadingElement) {
        loadingElement.style.display = 'none';
      }
      this.iframe.style.display = 'block';
      
      // 自适应内容高度
      this.adjustHeight();
      
      // 开始监听高度变化
      this.startHeightWatching();
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

  // 公共方法
  open() {
    this.dialog.showModal();
    this.dispatchEvent(new CustomEvent('dialog-open'));
    
    // 监听窗口大小变化
    this.setupWindowResizeListener();
  }

  close() {
    this.stopHeightWatching();
    this.dialog.close();
    this.dispatchEvent(new CustomEvent('dialog-close'));
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
  private adjustHeight() {
    try {
      // 尝试获取 iframe 内容的高度
      const iframeDocument = this.iframe.contentDocument;
      if (iframeDocument) {
        const contentHeight = iframeDocument.documentElement.scrollHeight;
        const maxHeight = window.innerHeight * 0.67; // 窗口高度的 2/3
        const minHeight = 200;
        
        // 计算合适的高度
        const targetHeight = Math.min(Math.max(contentHeight + 40, minHeight), maxHeight);
        
        // 设置 dialog 高度
        this.dialog.style.height = `${targetHeight}px`;
      }
    } catch {
      // 跨域情况下无法获取内容高度，使用默认高度
      console.log('Cannot access iframe content height due to CORS policy');
      this.dialog.style.height = '400px';
    }
  }

  // 开始监听高度变化
  private startHeightWatching() {
    try {
      const iframeDocument = this.iframe.contentDocument;
      if (iframeDocument) {
        // 使用 ResizeObserver 监听 body 尺寸变化
        this.resizeObserver = new ResizeObserver(() => {
          this.adjustHeight();
        });
        
        // 监听 body 和 documentElement
        this.resizeObserver.observe(iframeDocument.body);
        this.resizeObserver.observe(iframeDocument.documentElement);

        // 使用 MutationObserver 监听 DOM 变化
        this.mutationObserver = new MutationObserver(() => {
          // 延迟执行，等待DOM渲染完成
          setTimeout(() => this.adjustHeight(), 100);
        });

        this.mutationObserver.observe(iframeDocument.body, {
          childList: true,
          subtree: true,
          attributes: true,
          attributeFilter: ['style', 'class']
        });

        // 定期检查高度变化（作为备用方案）
        this.heightCheckInterval = setInterval(() => {
          this.adjustHeight();
        }, 1000);

      } else {
        // 跨域情况，只能定期检查
        this.heightCheckInterval = setInterval(() => {
          this.adjustHeight();
        }, 2000);
      }
    } catch {
      console.log('Cannot set up height watching due to CORS policy');
      // 跨域情况，使用定期检查作为备用方案
      this.heightCheckInterval = setInterval(() => {
        this.adjustHeight();
      }, 2000);
    }
  }

  // 停止监听高度变化
  private stopHeightWatching() {
    if (this.resizeObserver) {
      this.resizeObserver.disconnect();
      this.resizeObserver = undefined;
    }

    if (this.mutationObserver) {
      this.mutationObserver.disconnect();
      this.mutationObserver = undefined;
    }

    if (this.heightCheckInterval) {
      clearInterval(this.heightCheckInterval);
      this.heightCheckInterval = undefined;
    }

    this.removeWindowResizeListener();
  }

  // 设置窗口大小变化监听
  private setupWindowResizeListener() {
    this.windowResizeHandler = () => {
      // 窗口大小变化时重新计算高度
      setTimeout(() => this.adjustHeight(), 100);
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
}

// 注册 Web Component
customElements.define(CtrlKDialogName, CtrlKDialog);

export { CtrlKDialog };
