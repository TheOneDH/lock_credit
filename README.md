# MCP Input Server

一个带有 Web UI 的 MCP 服务器，让 AI 在完成任务后等待用户输入，实现持续对话。

## 功能

- `get_vscode_input` 工具 - AI 调用后等待用户输入
- Web UI (http://localhost:9876) - 通过浏览器发送消息
- **Submit** - 提交消息继续对话
- **End** - 结束当前对话
- **Kill** - 终止 MCP 服务器

## 在 Windsurf 中配置

### 1. 安装依赖

```bash
cd E:\Project\mcp
python -m venv .venv
.venv\Scripts\activate
pip install mcp aiohttp
```

### 2. 配置 MCP

编辑 `C:\Users\<用户名>\.codeium\windsurf\mcp_config.json`：

```json
{
  "mcpServers": {
    "vscode-input": {
      "command": "<解释器路径>/python.exe",
      "args": ["<项目路径>/server.py"],
      "disabled": false,
      "env": {}
    }
  }
}
```

> 将 `<项目路径>` 替换为实际路径，如 `E:/Project/mcp`

### 3. 配置 AI 规则

在 Windsurf 设置中添加全局规则，让 AI 在每次回复结束时调用 `get_vscode_input`：

```
任务完成后，调用 get_vscode_input 工具等待用户输入。
用户通过 http://localhost:9876 网页提交消息。
收到 [END] 则结束对话，否则继续处理。
```

### 4. 使用

1. 重启 Windsurf 使配置生效
2. 与 AI 对话，AI 完成任务后会自动等待输入
3. 打开 http://localhost:9876 发送后续消息
