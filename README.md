# MCP Sender

通过网页端向 Kiro 发送消息的工具，让 AI 在结束对话前询问你是否还有其他需求。

## 使用方法

### 1. 克隆项目

```bash
git clone <repo-url>
cd mcp-sender
```

### 2. 安装依赖

```bash
npm install
npm run compile
cd mcp-server && npm install && cd ..
```

### 3. 配置 Kiro MCP

编辑 `.kiro/settings/mcp.json`，添加：

```json
{
  "mcpServers": {
    "vscode-input": {
      "command": "node",
      "args": ["<项目绝对路径>/mcp-server/index.js"],
      "disabled": false,
      "autoApprove": ["get_vscode_input"]
    }
  }
}
```

### 4. 添加 Steering 规则

将 `templates/steering/ask-before-end.md` 复制到你的项目 `.kiro/steering/` 目录下。

### 5. 使用

1. 当 AI 调用 `get_vscode_input` 工具时，在浏览器打开 http://localhost:9876
2. 在网页输入框中输入内容，点击 "Submit" 提交新需求
3. 点击 "End" 结束对话
