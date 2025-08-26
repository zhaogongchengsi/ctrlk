/**
 * IframeDialog Web Component
 * 独立封装的 dialog 组件，使用 iframe 承载子页面
 */
class IframeDialog extends HTMLElement {
  private shadow: ShadowRoot;
  private dialog: HTMLDialogElement;
  private iframe: HTMLIFrameElement;

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
        --dialog-height: 400px;
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
        height: var(--dialog-height);
        max-width: 90vw;
        max-height: 90vh;
        background: var(--content-bg);
        box-shadow: var(--shadow);
        position: relative;
      }

      dialog::backdrop {
        background: var(--dialog-bg);
        backdrop-filter: blur(4px);
      }

      .dialog-header {
        display: flex;
        justify-content: space-between;
        align-items: center;
        padding: 12px 16px;
        border-bottom: 1px solid #e5e7eb;
        background: #f9fafb;
        border-radius: var(--border-radius) var(--border-radius) 0 0;
      }

      .dialog-title {
        font-size: 16px;
        font-weight: 600;
        color: #374151;
        margin: 0;
      }

      .close-button {
        background: none;
        border: none;
        font-size: 24px;
        color: #6b7280;
        cursor: pointer;
        padding: 4px;
        border-radius: 4px;
        display: flex;
        align-items: center;
        justify-content: center;
        width: 32px;
        height: 32px;
      }

      .close-button:hover {
        background: #e5e7eb;
        color: #374151;
      }

      iframe {
        width: 100%;
        height: calc(100% - 60px);
        border: none;
        border-radius: 0 0 var(--border-radius) var(--border-radius);
      }

      .no-header iframe {
        height: 100%;
        border-radius: var(--border-radius);
      }

      .loading {
        display: flex;
        align-items: center;
        justify-content: center;
        height: 200px;
        color: #6b7280;
      }
    `;

    // 创建 dialog 结构
    this.dialog.innerHTML = `
      <div class="dialog-header">
        <h3 class="dialog-title"></h3>
        <button class="close-button" type="button">&times;</button>
      </div>
      <div class="loading">Loading...</div>
    `;

    // 配置 iframe
    this.iframe.style.display = 'none';
    this.iframe.setAttribute('sandbox', 'allow-scripts allow-same-origin allow-forms allow-popups');
    
    this.shadow.appendChild(style);
    this.shadow.appendChild(this.dialog);
    this.dialog.appendChild(this.iframe);

    this.setupEventListeners();
  }

  private setupEventListeners() {
    const closeButton = this.shadow.querySelector('.close-button');
    const loading = this.shadow.querySelector('.loading');

    // 关闭按钮
    closeButton?.addEventListener('click', () => {
      this.close();
    });

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
  }

  close() {
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

  // 隐藏标题栏
  hideHeader() {
    const header = this.shadow.querySelector('.dialog-header') as HTMLElement;
    if (header) {
      header.style.display = 'none';
      this.dialog.classList.add('no-header');
    }
  }

  // 显示标题栏
  showHeader() {
    const header = this.shadow.querySelector('.dialog-header') as HTMLElement;
    if (header) {
      header.style.display = 'flex';
      this.dialog.classList.remove('no-header');
    }
  }
}

// 注册 Web Component
customElements.define('iframe-dialog', IframeDialog);

export { IframeDialog };
