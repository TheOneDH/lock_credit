# MCP Sender

让AI在结束对话前询问你是否还有其他需求，通过网页端发送消息给AI，让AI继续work，以此达到锁定额度的目的。

## 使用方法

### 1. 克隆项目

```bash
git clone https://github.com/TheOneDH/lock_credit.git
cd lock_credit
```

### 2. 安装依赖

```bash
cd mcp-server && npm install && cd ..
```

### 3. 配置 Windsurf MCP

编辑 `~/.codeium/windsurf/mcp_config.json`，添加：

```json
{
  "mcpServers": {
    "vscode-input": {
      "command": "node",
      "args": ["<项目绝对路径>/mcp-server/index.js"]
    }
  }
}
```

### 4. 添加 Rules

将 `templates/steering/ask-before-end.md` 的内容复制到 Windsurf 的 Rules 设置中（Settings → AI Rules）。

### 5. 使用

1. 当 AI 调用 `get_vscode_input` 工具时，在浏览器打开 http://localhost:9876
2. 在网页输入框中输入内容，点击 "Submit" 提交新需求
3. 点击 "End" 结束对话
