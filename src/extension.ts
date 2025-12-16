import * as vscode from 'vscode';
import * as fs from 'fs';
import * as path from 'path';
import { McpClient } from './mcpClient';

export function activate(context: vscode.ExtensionContext) {
    const provider = new McpSenderViewProvider(context.extensionUri);

    context.subscriptions.push(
        vscode.window.registerWebviewViewProvider('mcp-sender.inputView', provider)
    );

    context.subscriptions.push(
        vscode.commands.registerCommand('mcp-sender.openPanel', () => {
            vscode.commands.executeCommand('workbench.view.extension.mcp-sender');
        })
    );

    context.subscriptions.push(
        vscode.commands.registerCommand('mcp-sender.setupKiro', async () => {
            await setupKiroConfig(context);
        })
    );

    context.subscriptions.push(
        vscode.commands.registerCommand('mcp-sender.setupWindsurf', async () => {
            await setupWindsurfConfig(context);
        })
    );

    // 自动配置
    autoSetupKiroConfig(context);
}

class McpSenderViewProvider implements vscode.WebviewViewProvider {
    private _view?: vscode.WebviewView;
    private mcpClient: McpClient;

    constructor(private readonly _extensionUri: vscode.Uri) {
        this.mcpClient = new McpClient();
    }

    public resolveWebviewView(
        webviewView: vscode.WebviewView,
        _context: vscode.WebviewViewResolveContext,
        _token: vscode.CancellationToken
    ) {
        this._view = webviewView;

        webviewView.webview.options = {
            enableScripts: true,
            localResourceRoots: [this._extensionUri]
        };

        webviewView.webview.html = this._getHtmlForWebview();

        webviewView.webview.onDidReceiveMessage(async (data: { type: string; content?: string }) => {
            switch (data.type) {
                case 'submit':
                    if (data.content) {
                        await this.handleSubmit(data.content);
                    }
                    break;
                case 'end':
                    await this.handleSubmit('[END]');
                    break;
                case 'setupWindsurf':
                    vscode.commands.executeCommand('mcp-sender.setupWindsurf');
                    break;
            }
        });
    }

    private async handleSubmit(content: string) {
        if (!content.trim()) {
            vscode.window.showWarningMessage('Please enter some content');
            return;
        }

        this._view?.webview.postMessage({ type: 'loading' });

        try {
            const result = await this.mcpClient.sendMessage(content);
            this._view?.webview.postMessage({ type: 'response', message: result });
        } catch (error) {
            const errorMsg = error instanceof Error ? error.message : 'Unknown error';
            vscode.window.showErrorMessage(`Failed to send: ${errorMsg}`);
            this._view?.webview.postMessage({ type: 'error', message: errorMsg });
        }
    }


    private _getHtmlForWebview(): string {
        return `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <style>
        body {
            padding: 10px;
            font-family: var(--vscode-font-family);
            color: var(--vscode-foreground);
        }
        .container {
            display: flex;
            flex-direction: column;
            gap: 10px;
        }
        textarea {
            width: 100%;
            min-height: 80px;
            padding: 8px;
            border: 1px solid var(--vscode-input-border);
            background: var(--vscode-input-background);
            color: var(--vscode-input-foreground);
            border-radius: 4px;
            resize: vertical;
            font-family: inherit;
            box-sizing: border-box;
        }
        textarea:focus {
            outline: 1px solid var(--vscode-focusBorder);
        }
        button {
            padding: 8px 16px;
            background: var(--vscode-button-background);
            color: var(--vscode-button-foreground);
            border: none;
            border-radius: 4px;
            cursor: pointer;
            font-size: 13px;
        }
        button:hover {
            background: var(--vscode-button-hoverBackground);
        }
        button:disabled {
            opacity: 0.5;
            cursor: not-allowed;
        }
        .btn-group {
            display: flex;
            gap: 8px;
        }
        .btn-group button {
            flex: 1;
        }
        button.secondary {
            background: var(--vscode-button-secondaryBackground);
            color: var(--vscode-button-secondaryForeground);
        }
        button.secondary:hover {
            background: var(--vscode-button-secondaryHoverBackground);
        }
        .config-btn {
            width: 100%;
            background: var(--vscode-button-secondaryBackground);
            color: var(--vscode-button-secondaryForeground);
            margin-top: 4px;
        }
        .config-btn:hover {
            background: var(--vscode-button-secondaryHoverBackground);
        }
        .response {
            padding: 10px;
            background: var(--vscode-editor-background);
            border: 1px solid var(--vscode-input-border);
            border-radius: 4px;
            white-space: pre-wrap;
            word-wrap: break-word;
            max-height: 300px;
            overflow-y: auto;
            font-size: 13px;
            line-height: 1.5;
        }
        .error {
            color: var(--vscode-errorForeground);
            padding: 8px;
            background: var(--vscode-inputValidation-errorBackground);
            border-radius: 4px;
        }
        .loading {
            color: var(--vscode-descriptionForeground);
            font-style: italic;
        }
    </style>
</head>
<body>
    <div class="container">
        <label for="content">Send to MCP:</label>
        <textarea id="content" placeholder="Enter your message..."></textarea>
        <div class="btn-group">
            <button id="submitBtn">Submit</button>
            <button id="endBtn" class="secondary">End</button>
        </div>
        <button id="configBtn" class="config-btn">⚙ Setup Windsurf Config</button>
        <div id="response"></div>
    </div>
    <script>
        const vscode = acquireVsCodeApi();
        const textarea = document.getElementById('content');
        const submitBtn = document.getElementById('submitBtn');
        const endBtn = document.getElementById('endBtn');
        const response = document.getElementById('response');

        function setButtonsDisabled(disabled) {
            submitBtn.disabled = disabled;
            endBtn.disabled = disabled;
        }

        function doSubmit() {
            const content = textarea.value;
            if (!content.trim()) return;
            setButtonsDisabled(true);
            submitBtn.textContent = 'Sending...';
            vscode.postMessage({ type: 'submit', content });
        }

        submitBtn.addEventListener('click', doSubmit);

        textarea.addEventListener('keydown', (e) => {
            if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                doSubmit();
            }
        });

        endBtn.addEventListener('click', () => {
            setButtonsDisabled(true);
            endBtn.textContent = 'Ending...';
            vscode.postMessage({ type: 'end' });
        });

        document.getElementById('configBtn').addEventListener('click', () => {
            vscode.postMessage({ type: 'setupWindsurf' });
        });

        window.addEventListener('message', event => {
            const message = event.data;
            setButtonsDisabled(false);
            submitBtn.textContent = 'Submit';
            endBtn.textContent = 'End';
            
            if (message.type === 'loading') {
                response.className = 'loading';
                response.textContent = 'Sending...';
                setButtonsDisabled(true);
            } else if (message.type === 'response') {
                response.className = 'response';
                response.textContent = message.message;
                textarea.value = '';
            } else if (message.type === 'error') {
                response.className = 'error';
                response.textContent = 'Error: ' + message.message;
            }
        });
    </script>
</body>
</html>`;
    }
}

function autoSetupKiroConfig(context: vscode.ExtensionContext) {
    const workspaceFolder = vscode.workspace.workspaceFolders?.[0];
    if (!workspaceFolder) {
        return;
    }

    const workspacePath = workspaceFolder.uri.fsPath;
    const mcpConfigPath = path.join(workspacePath, '.kiro', 'settings', 'mcp.json');
    
    // 如果配置已存在，跳过
    if (fs.existsSync(mcpConfigPath)) {
        return;
    }

    // 自动配置
    setupKiroConfig(context);
}

async function setupKiroConfig(context: vscode.ExtensionContext) {
    const workspaceFolder = vscode.workspace.workspaceFolders?.[0];
    if (!workspaceFolder) {
        vscode.window.showErrorMessage('Please open a workspace first');
        return;
    }

    const workspacePath = workspaceFolder.uri.fsPath;
    const extensionPath = context.extensionPath;
    const mcpServerPath = path.join(extensionPath, 'mcp-server', 'index.js').replace(/\\/g, '/');

    // Create .kiro/settings directory
    const kiroSettingsDir = path.join(workspacePath, '.kiro', 'settings');
    const kiroSteeringDir = path.join(workspacePath, '.kiro', 'steering');
    
    fs.mkdirSync(kiroSettingsDir, { recursive: true });
    fs.mkdirSync(kiroSteeringDir, { recursive: true });

    // Write MCP config
    const mcpConfig = {
        mcpServers: {
            'vscode-input': {
                command: 'node',
                args: [mcpServerPath],
                disabled: false,
                autoApprove: ['get_vscode_input']
            }
        }
    };
    
    const mcpConfigPath = path.join(kiroSettingsDir, 'mcp.json');
    fs.writeFileSync(mcpConfigPath, JSON.stringify(mcpConfig, null, 2));

    // Copy steering file
    const steeringTemplatePath = path.join(extensionPath, 'templates', 'steering', 'ask-before-end.md');
    const steeringDestPath = path.join(kiroSteeringDir, 'ask-before-end.md');
    
    if (fs.existsSync(steeringTemplatePath)) {
        fs.copyFileSync(steeringTemplatePath, steeringDestPath);
    } else {
        // Fallback: write directly
        const steeringContent = `# 结束对话前确认规则

当你准备结束对话或完成任务时，必须先调用 \`get_vscode_input\` MCP 工具询问用户是否还有其他需求。

## 规则

1. 在你认为任务已完成、准备给出最终回复时，先调用 \`mcp_vscode_input_get_vscode_input\` 工具
2. 等待用户通过 VS Code 插件输入框回复
3. 如果用户点击 "Submit" 按钮提交内容，则继续处理用户的新需求
4. 如果用户点击 "End" 按钮（返回 \`[END]\`），则正常结束对话
`;
        fs.writeFileSync(steeringDestPath, steeringContent);
    }

    vscode.window.showInformationMessage('Kiro MCP config setup complete! Please reload Kiro to apply.');
}

async function setupWindsurfConfig(context: vscode.ExtensionContext) {
    const extensionPath = context.extensionPath;
    const mcpServerPath = path.join(extensionPath, 'mcp-server', 'index.js').replace(/\\/g, '/');

    // 识别 Windsurf mcp_config.json 路径
    const homeDir = process.env.HOME || process.env.USERPROFILE || '';
    const windsurfConfigPath = path.join(homeDir, '.codeium', 'windsurf', 'mcp_config.json');

    // 检查目录是否存在
    const windsurfDir = path.dirname(windsurfConfigPath);
    if (!fs.existsSync(windsurfDir)) {
        vscode.window.showErrorMessage(`Windsurf config directory not found: ${windsurfDir}`);
        return;
    }

    // 读取现有配置或创建新配置
    let config: { mcpServers?: Record<string, unknown> } = { mcpServers: {} };
    if (fs.existsSync(windsurfConfigPath)) {
        try {
            const existingContent = fs.readFileSync(windsurfConfigPath, 'utf-8');
            config = JSON.parse(existingContent);
            if (!config.mcpServers) {
                config.mcpServers = {};
            }
        } catch (e) {
            vscode.window.showWarningMessage('Failed to parse existing config, creating new one');
            config = { mcpServers: {} };
        }
    }

    // 添加 vscode-input-server 配置
    config.mcpServers!['vscode-input-server'] = {
        command: 'node',
        args: [mcpServerPath]
    };

    // 写入配置
    fs.writeFileSync(windsurfConfigPath, JSON.stringify(config, null, 2));

    vscode.window.showInformationMessage(
        `Windsurf MCP config updated: ${windsurfConfigPath}\nPlease restart Windsurf to apply.`
    );
}

export function deactivate() {}
