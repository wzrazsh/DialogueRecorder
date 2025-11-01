# DialogueRecorder - VS Code 对话记录器插件

一个功能强大的VS Code插件，用于记录和追踪与Builder/Chat的对话内容、文件修改操作以及撤销/重做历史。

## 功能特性

### 🎯 核心功能
- **对话内容记录**: 全面捕获与Builder/Chat的所有对话内容，包括时间戳、对话双方身份标识和完整对话文本
- **文件修改追踪**: 详细记录Builder对文件的修改操作，包括修改前后的文件内容对比、修改时间和修改类型
- **中断回退记录**: 完整追踪操作历史，包括撤销/重做操作的时间点、操作类型和影响范围
- **智能检索功能**: 支持关键词搜索、时间过滤、文件类型过滤等多种检索方式

### 🔍 搜索功能
- **关键词搜索**: 在对话内容中搜索特定关键词
- **时间范围过滤**: 按时间范围筛选记录
- **发言者过滤**: 按用户、Builder或Chat筛选记录
- **记录类型过滤**: 按对话、文件修改、撤销操作、重做操作筛选
- **文件类型过滤**: 按文件扩展名筛选相关记录

## 安装说明

### 方法一：从VS Code扩展市场安装（推荐）
1. 打开VS Code
2. 进入扩展面板（Ctrl+Shift+X）
3. 搜索 "DialogueRecorder"
4. 点击安装

### 方法二：手动安装
1. 下载插件包（.vsix文件）
2. 在VS Code中打开命令面板（Ctrl+Shift+P）
3. 输入 "Extensions: Install from VSIX..."
4. 选择下载的.vsix文件进行安装

### 方法三：开发模式安装
1. 克隆或下载源代码
2. 在项目根目录运行 `npm install` 安装依赖
3. 运行 `npm run compile` 编译TypeScript代码
4. 按F5启动调试模式，选择"Extension"配置
5. 在新窗口中测试插件功能

## 使用方法

### 打开对话记录器面板
- 使用快捷键 `Ctrl+Shift+D`
- 或通过命令面板（Ctrl+Shift+P）输入 "对话记录器: 显示面板"

### 快速搜索功能
- 使用快捷键 `Ctrl+Shift+F`
- 或通过命令面板输入 "对话记录器: 快速搜索"

### 面板功能说明

#### 搜索面板
- **搜索框**: 输入关键词进行搜索
- **发言者过滤**: 选择特定发言者（用户/Builder/Chat）
- **记录类型过滤**: 选择记录类型（对话/文件修改/撤销/重做）
- **时间范围**: 设置开始和结束时间
- **搜索/清除按钮**: 执行搜索或清除筛选条件

#### 记录列表
- 显示所有匹配的记录
- 每条记录包含：发言者、时间、内容预览
- 点击记录查看详细信息

#### 详细信息面板
- 显示选中记录的完整信息
- 包括时间、发言者、类型、文件路径、操作详情等
- 支持内容对比显示

## 配置选项

插件支持以下配置选项（在VS Code设置中修改）：

```json
{
    "dialogueRecorder.autoStart": true,
    "dialogueRecorder.maxRecords": 1000,
    "dialogueRecorder.recordFileModifications": true,
    "dialogueRecorder.recordUndoRedo": true,
    "dialogueRecorder.enableSearchSuggestions": true
}
```

## 开发指南

### 项目结构
```
DialogueRecorder/
├── src/
│   ├── extension.ts          # 插件主入口
│   ├── panels/              # Webview面板
│   ├── services/            # 服务层
│   ├── models/              # 数据模型
│   └── test/                # 测试文件
├── media/                   # 静态资源
├── package.json             # 插件配置
├── tsconfig.json           # TypeScript配置
└── README.md               # 说明文档
```

### 构建和测试

#### 安装依赖
```bash
npm install
```

#### 编译TypeScript
```bash
npm run compile
```

#### 运行测试
```bash
npm test
```

#### 打包插件
```bash
npm run package
```

### 调试
1. 在VS Code中打开项目
2. 按F5启动调试
3. 选择"Extension"配置
4. 在新窗口中测试插件功能

## 技术栈

- **语言**: TypeScript
- **框架**: VS Code Extension API
- **数据库**: SQLite（用于本地存储）
- **UI**: Webview + HTML/CSS/JavaScript
- **构建工具**: npm + TypeScript Compiler

## 贡献指南

欢迎提交Issue和Pull Request！

### 开发流程
1. Fork 项目
2. 创建功能分支 (`git checkout -b feature/AmazingFeature`)
3. 提交更改 (`git commit -m 'Add some AmazingFeature'`)
4. 推送到分支 (`git push origin feature/AmazingFeature`)
5. 创建Pull Request

### 代码规范
- 使用TypeScript严格模式
- 遵循VS Code扩展开发最佳实践
- 添加适当的注释和文档
- 编写单元测试
    打开VS Code开发者工具 (Ctrl+Shift+P → "Developer: Toggle Developer Tools")

## 许可证

本项目采用MIT许可证 - 查看 [LICENSE](LICENSE) 文件了解详情

## 支持与反馈

如果您遇到任何问题或有改进建议，请：

1. 查看 [问题追踪](https://github.com/your-repo/issues)
2. 提交新的Issue
3. 联系开发团队

## 更新日志

### v1.0.0 (2024-01-01)
- 初始版本发布
- 基础对话记录功能
- 文件修改追踪
- 撤销重做记录
- 智能搜索功能



**注意**: 本插件仍在积极开发中，功能可能会有所调整。建议定期检查更新以获取最新功能和改进。