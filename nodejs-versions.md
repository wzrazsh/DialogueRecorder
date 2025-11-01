# Node.js 版本和安装位置记录

## 系统环境信息

### 当前系统Node.js信息
- **Node.js 版本**: v22.17.0 (默认)
- **NODE_MODULE_VERSION**: 127
- **安装位置**: `D:\Program Files\nodejs\node.exe`
- **检查时间**: 2025/10/31

### 已安装的Node.js 23信息
- **Node.js 版本**: v23.11.1 (已安装，需手动设置PATH)
- **NODE_MODULE_VERSION**: 131
- **安装位置**: `D:\Program Files\nodejs\node.exe`
- **安装状态**: 已成功安装

### Node.js版本对应关系
| Node.js版本 | NODE_MODULE_VERSION |
|------------|-------------------|
| Node.js 23.x | 131 |
| Node.js 22.x | 127 |
| Node.js 21.x | 122 |
| Node.js 20.x | 115 |

## Trae AI IDE 内置Node.js信息

根据错误信息分析，Trae AI IDE可能使用了不同的Node.js版本：

### 推测的Trae AI IDE Node.js信息
- **可能使用的Node.js版本**: Node.js 23.x
- **NODE_MODULE_VERSION**: 131 (实际安装的Node.js 23.11.1版本)
- **错误信息**: "was compiled against a different Node.js version using NODE_MODULE_VERSION 127. This version of Node.js requires NODE_MODULE_VERSION 131"

### 当前状态
- ✅ Node.js 23.11.1已成功安装
- ✅ NODE_MODULE_VERSION: 131 (与Trae AI IDE兼容)
- ⚠️ 需要手动设置PATH环境变量来使用Node.js 23

## 兼容性问题分析

### 问题描述
当Trae AI IDE运行扩展时，如果扩展中的native模块（如better-sqlite3）是在不同版本的Node.js环境下编译的，就会出现NODE_MODULE_VERSION不兼容的错误。

### 具体场景
1. **扩展安装时**: better-sqlite3在Trae AI IDE的Node.js 23.x环境下编译（NODE_MODULE_VERSION=136）
2. **本地开发时**: 项目使用Node.js 22.17.0（NODE_MODULE_VERSION=127）
3. **运行时冲突**: 模块版本不匹配导致错误

## 解决方案记录

### 已实施的解决方案
1. **替换依赖库**: 将better-sqlite3替换为sqlite3
2. **使用预编译版本**: sqlite3提供预编译版本，避免本地编译问题
3. **验证结果**: 项目编译和测试通过，兼容性问题已解决

### 推荐的预防措施
1. **统一开发环境**: 确保开发和运行环境使用相同的Node.js版本
2. **使用.nvmrc文件**: 在项目中指定Node.js版本
3. **优先选择纯JavaScript库**: 避免使用需要本地编译的native模块
4. **使用预编译版本**: 安装依赖时使用`--build-from-source=false`

## 使用Node.js 23的方法

### 临时使用Node.js 23（当前终端会话）
```powershell
# 设置PATH环境变量优先使用Node.js 23
$env:PATH = "D:\Program Files\nodejs\;" + $env:PATH

# 验证版本
node --version
node -p "process.versions.modules"
```

### 永久使用Node.js 23
1. 打开系统环境变量设置
2. 编辑PATH环境变量
3. 将 `D:\Program Files\nodejs\` 移动到最前面
4. 重启所有终端窗口

## 环境检查命令

### 检查当前Node.js版本
```bash
node -p "process.version"
```

### 检查NODE_MODULE_VERSION
```bash
node -p "process.versions.modules"
```

### 检查Node.js安装位置
```bash
# Windows PowerShell
Get-Command node | Select-Object Source, Path

# Windows CMD
where node
```

### 检查详细版本信息
```bash
node -p "process.versions"
```

## 项目依赖状态

### 当前项目依赖
- **sqlite3**: ^5.1.6 (已安装5.1.6)
- **@types/sqlite3**: ^3.1.9 (已安装3.1.11)

### 已移除的依赖
- **better-sqlite3**: ^8.5.0 (已移除)
- **@types/better-sqlite3**: ^7.6.13 (已移除)

## 更新记录

| 日期 | 变更内容 | 状态 |
|------|----------|------|
| $(date) | 创建版本记录文档 | 完成 |
| $(date) | 解决NODE_MODULE_VERSION兼容性问题 | 完成 |
| $(date) | 替换better-sqlite3为sqlite3 | 完成 |

---

*本文档用于记录Node.js版本兼容性问题和解决方案，便于后续开发和维护参考。*