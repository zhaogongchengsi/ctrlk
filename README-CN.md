# CtrlK - 快速搜索浏览器扩展

<div align="center">
  <img src="public/logo.png" alt="CtrlK Logo" width="128" height="128">
  
  <p><strong>一个优雅的 Chrome 浏览器扩展，让您通过 Ctrl+K 快捷键快速搜索和访问书签与标签页</strong></p>

  [![Version](https://img.shields.io/badge/version-0.0.1-blue.svg)](package.json)
  [![License](https://img.shields.io/badge/license-MIT-green.svg)](LICENSE)
  [![Chrome Web Store](https://img.shields.io/badge/Chrome%20Web%20Store-Available-brightgreen.svg)](https://chrome.google.com/webstore)
</div>

## ✨ 功能特性

### 🔍 智能搜索
- **实时搜索**: 输入时即时显示搜索结果
- **多源搜索**: 同时搜索书签和当前打开的标签页
- **模糊匹配**: 支持模糊搜索，无需输入完整标题
- **智能评分**: 基于相关性对搜索结果进行排序

### ⚡ 快速访问
- **快捷键支持**: 
  - Windows/Linux: `Ctrl + K`
  - macOS: `Command + K`
- **一键打开**: 点击搜索结果即可快速跳转到对应页面
- **标签页切换**: 快速切换到已打开的标签页
- **书签访问**: 在新标签页中打开书签

### 🎨 优雅界面
- **现代设计**: 采用 React + Tailwind CSS 构建的现代化界面
- **响应式布局**: 自适应不同屏幕尺寸
- **图标显示**: 显示网站图标，便于快速识别
- **分组展示**: 标签页和书签分组显示，清晰明了

### 🔧 技术特性
- **防抖搜索**: 300ms 防抖机制，提升搜索性能
- **模态对话框**: 浮层式搜索面板，不影响当前页面
- **键盘导航**: 支持键盘上下键选择搜索结果
- **自动聚焦**: 打开面板时自动聚焦搜索框

## 🚀 快速开始

### 安装方式

#### 方式一：Chrome 网上应用店（推荐）
1. 访问 [Chrome 网上应用店](https://chrome.google.com/webstore)
2. 搜索 "CtrlK"
3. 点击"添加至 Chrome"

#### 方式二：开发者模式安装
1. 下载或克隆此仓库
2. 运行 `pnpm install` 安装依赖
3. 运行 `pnpm run build` 构建扩展
4. 打开 Chrome 浏览器，进入 `chrome://extensions/`
5. 启用"开发者模式"
6. 点击"加载已解压的扩展程序"
7. 选择项目的 `dist` 文件夹

### 使用方法

1. **打开搜索面板**
   - 按下 `Ctrl + K`（Windows/Linux）或 `Command + K`（macOS）
   - 或点击浏览器工具栏中的 CtrlK 图标

2. **搜索内容**
   - 在搜索框中输入关键词
   - 系统会实时显示匹配的书签和标签页

3. **选择结果**
   - 使用鼠标点击搜索结果
   - 或使用键盘上下键选择，按 Enter 确认

4. **快速访问**
   - 标签页：直接切换到该标签页
   - 书签：在新标签页中打开书签链接

## 🛠️ 技术栈

### 前端技术
- **React 19**: 现代化的 UI 框架
- **TypeScript**: 类型安全的 JavaScript
- **Tailwind CSS 4**: 实用优先的 CSS 框架
- **Vite**: 快速的构建工具
- **cmdk**: 命令面板组件库

### UI 组件
- **Radix UI**: 无样式、可访问的 UI 组件
- **Lucide React**: 美观的图标库
- **Class Variance Authority**: CSS 类变体管理

### 搜索引擎
- **Fuse.js**: 轻量级模糊搜索库
- **RxJS**: 响应式编程库，处理异步操作

### 浏览器扩展
- **Chrome Extension Manifest V3**: 最新的扩展规范
- **Chrome APIs**: tabs、bookmarks、commands 等 API

## 🔧 开发指南

### 环境要求
- Node.js >= 16
- pnpm >= 7

### 开发流程

1. **克隆仓库**
   ```bash
   git clone https://github.com/zhaogongchengsi/ctrlk.git
   cd ctrlk
   ```

2. **安装依赖**
   ```bash
   pnpm install
   ```

3. **开发模式**
   ```bash
   pnpm run dev
   ```

4. **构建项目**
   ```bash
   pnpm run build
   ```

5. **代码检查**
   ```bash
   pnpm run lint
   ```

### 构建说明
- `pnpm run build:client`: 构建前端应用
- `pnpm run build:main`: 构建扩展脚本
- `pnpm run build`: 完整构建

## 🎯 核心功能实现

### 搜索算法
使用 Fuse.js 实现模糊搜索：
- 支持标题和 URL 的模糊匹配
- 可配置的相似度阈值
- 智能评分排序

### 快捷键处理
通过 Chrome Commands API 实现：
- 跨平台快捷键支持
- 全局快捷键监听
- 冲突检测和处理

### 数据源管理
- **标签页**: 通过 Chrome Tabs API 获取当前打开的标签页
- **书签**: 通过 Chrome Bookmarks API 获取用户书签
- **实时同步**: 监听标签页和书签变化，保持数据最新

### UI 交互
- **模态对话框**: 使用 iframe 实现的浮层面板
- **键盘导航**: 支持方向键和 Enter 键操作
- **自动完成**: 实时搜索建议和结果预览

## 🔒 权限说明

扩展需要以下权限：

- **tabs**: 获取和切换标签页
- **bookmarks**: 读取用户书签
- **commands**: 注册快捷键
- **windows**: 窗口管理

所有权限仅用于核心功能，不会收集或上传任何用户数据。

## 🤝 贡献指南

欢迎贡献代码！请遵循以下步骤：

1. Fork 此仓库
2. 创建功能分支 (`git checkout -b feature/amazing-feature`)
3. 提交更改 (`git commit -m 'Add some amazing feature'`)
4. 推送到分支 (`git push origin feature/amazing-feature`)
5. 创建 Pull Request

### 贡献准则
- 遵循 TypeScript 和 ESLint 规范
- 提交前运行测试和代码检查
- 编写清晰的提交信息
- 更新相关文档

## 📝 更新日志

### v0.0.1 (2024-08-27)
- 🎉 初始版本发布
- ✨ 实现基础搜索功能
- 🔍 支持书签和标签页搜索
- ⚡ 添加快捷键支持
- 🎨 实现现代化 UI 界面

## 📄 许可证

本项目采用 MIT 许可证 - 查看 [LICENSE](LICENSE) 文件了解详情。

## 🙏 致谢

- [cmdk](https://github.com/pacocoursey/cmdk) - 优秀的命令面板组件
- [Fuse.js](https://github.com/krisk/Fuse) - 强大的模糊搜索库
- [Radix UI](https://github.com/radix-ui/primitives) - 高质量的 UI 组件
- [Tailwind CSS](https://github.com/tailwindlabs/tailwindcss) - 实用的 CSS 框架

## 📞 联系方式

- 作者: [zhaogongchengsi](https://github.com/zhaogongchengsi)
- 问题反馈: [GitHub Issues](https://github.com/zhaogongchengsi/ctrlk/issues)

---

<div align="center">
  <p>如果这个项目对您有帮助，请给它一个 ⭐ Star！</p>
</div>