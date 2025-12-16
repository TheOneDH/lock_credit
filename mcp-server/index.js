#!/usr/bin/env node
import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import {
    CallToolRequestSchema,
    ListToolsRequestSchema,
} from '@modelcontextprotocol/sdk/types.js';
import http from 'http';
import { URL } from 'url';

// 存储消息队列
let messageQueue = [];
let waitingResolvers = [];

// HTML 页面
const htmlPage = `<!DOCTYPE html>
<html lang="zh">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>MCP Input</title>
    <style>
        * { box-sizing: border-box; margin: 0; padding: 0; }
        body {
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
            background: #1e1e1e;
            color: #d4d4d4;
            min-height: 100vh;
            display: flex;
            justify-content: center;
            align-items: center;
            padding: 20px;
        }
        .container {
            width: 100%;
            max-width: 500px;
            background: #252526;
            border-radius: 8px;
            padding: 24px;
            box-shadow: 0 4px 12px rgba(0,0,0,0.3);
        }
        h1 {
            font-size: 18px;
            margin-bottom: 16px;
            color: #fff;
        }
        textarea {
            width: 100%;
            min-height: 120px;
            padding: 12px;
            border: 1px solid #3c3c3c;
            background: #1e1e1e;
            color: #d4d4d4;
            border-radius: 6px;
            resize: vertical;
            font-family: inherit;
            font-size: 14px;
            margin-bottom: 12px;
        }
        textarea:focus {
            outline: none;
            border-color: #007acc;
        }
        .btn-group {
            display: flex;
            gap: 10px;
        }
        button {
            flex: 1;
            padding: 10px 20px;
            border: none;
            border-radius: 6px;
            cursor: pointer;
            font-size: 14px;
            font-weight: 500;
            transition: background 0.2s;
        }
        .btn-primary {
            background: #007acc;
            color: white;
        }
        .btn-primary:hover { background: #005a9e; }
        .btn-primary:disabled { background: #004578; opacity: 0.6; cursor: not-allowed; }
        .btn-secondary {
            background: #3c3c3c;
            color: #d4d4d4;
        }
        .btn-secondary:hover { background: #4a4a4a; }
        .btn-secondary:disabled { opacity: 0.6; cursor: not-allowed; }
        .btn-danger {
            background: #c42b1c;
            color: white;
        }
        .btn-danger:hover { background: #a32417; }
        .status {
            margin-top: 12px;
            padding: 10px;
            border-radius: 6px;
            font-size: 13px;
            display: none;
        }
        .status.success { display: block; background: #2d4a3e; color: #4ec9b0; }
        .status.error { display: block; background: #4a2d2d; color: #f48771; }
        .hint {
            margin-top: 12px;
            font-size: 12px;
            color: #808080;
        }
    </style>
</head>
<body>
    <div class="container">
        <h1>Send to AI</h1>
        <textarea id="content" placeholder="Enter your message..." autofocus></textarea>
        <div class="btn-group">
            <button id="submitBtn" class="btn-primary">Submit</button>
            <button id="endBtn" class="btn-secondary">End</button>
            <button id="killBtn" class="btn-danger">Kill</button>
        </div>
        <div id="status" class="status"></div>
        <p class="hint">Press Enter to submit, Shift+Enter for new line</p>
    </div>
    <script>
        const textarea = document.getElementById('content');
        const submitBtn = document.getElementById('submitBtn');
        const endBtn = document.getElementById('endBtn');
        const killBtn = document.getElementById('killBtn');
        const status = document.getElementById('status');

        function setButtonsDisabled(disabled) {
            submitBtn.disabled = disabled;
            endBtn.disabled = disabled;
        }

        function showStatus(message, isError = false) {
            status.textContent = message;
            status.className = 'status ' + (isError ? 'error' : 'success');
            setTimeout(() => { status.className = 'status'; }, 3000);
        }

        async function sendMessage(content) {
            setButtonsDisabled(true);
            submitBtn.textContent = 'Sending...';
            
            try {
                const res = await fetch('/message', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ content })
                });
                if (res.ok) {
                    showStatus('Message sent!');
                    textarea.value = '';
                } else {
                    showStatus('Failed to send', true);
                }
            } catch (e) {
                showStatus('Error: ' + e.message, true);
            }
            
            setButtonsDisabled(false);
            submitBtn.textContent = 'Submit';
            endBtn.textContent = 'End';
            textarea.focus();
        }

        submitBtn.addEventListener('click', () => {
            const content = textarea.value.trim();
            if (content) sendMessage(content);
        });

        endBtn.addEventListener('click', () => {
            endBtn.textContent = 'Ending...';
            sendMessage('[END]');
        });

        textarea.addEventListener('keydown', (e) => {
            if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                const content = textarea.value.trim();
                if (content) sendMessage(content);
            }
        });

        killBtn.addEventListener('click', async () => {
            if (confirm('Are you sure you want to kill the MCP server?')) {
                try {
                    await fetch('/kill', { method: 'POST' });
                    showStatus('Server killed');
                } catch (e) {
                    showStatus('Server stopped', false);
                }
            }
        });
    </script>
</body>
</html>`;

// 创建 HTTP 服务器
const httpServer = http.createServer((req, res) => {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
    
    if (req.method === 'OPTIONS') {
        res.writeHead(200);
        res.end();
        return;
    }

    const url = new URL(req.url, 'http://localhost');
    
    // 首页 - 返回 HTML
    if (req.method === 'GET' && (url.pathname === '/' || url.pathname === '/index.html')) {
        res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
        res.end(htmlPage);
        return;
    }

    // Kill 服务
    if (req.method === 'POST' && url.pathname === '/kill') {
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ success: true }));
        setTimeout(() => process.exit(0), 100);
        return;
    }

    // 接收消息
    if (req.method === 'POST' && url.pathname === '/message') {
        let body = '';
        req.on('data', chunk => body += chunk);
        req.on('end', () => {
            try {
                const data = JSON.parse(body);
                const message = data.content;
                
                if (waitingResolvers.length > 0) {
                    const resolver = waitingResolvers.shift();
                    resolver(message);
                } else {
                    messageQueue.push(message);
                }
                
                res.writeHead(200, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify({ success: true }));
            } catch (e) {
                res.writeHead(400);
                res.end('Invalid JSON');
            }
        });
        return;
    }

    res.writeHead(404);
    res.end('Not found');
});

httpServer.on('error', (err) => {
    if (err.code === 'EADDRINUSE') {
        console.error('Port 9876 already in use');
    } else {
        console.error('HTTP server error:', err);
    }
});

httpServer.listen(9876, () => {
    console.error('Web UI: http://localhost:9876');
});

// MCP Server
const server = new Server(
    { name: 'vscode-input-server', version: '1.0.0' },
    { capabilities: { tools: {} } }
);

server.setRequestHandler(ListToolsRequestSchema, async () => ({
    tools: [
        {
            name: 'get_vscode_input',
            description: 'Get the message that user submitted from VS Code input panel. Call this to receive user input from the VS Code extension.',
            inputSchema: {
                type: 'object',
                properties: {},
                required: []
            }
        }
    ]
}));

server.setRequestHandler(CallToolRequestSchema, async (request) => {
    const { name } = request.params;

    if (name === 'get_vscode_input') {
        if (messageQueue.length > 0) {
            const message = messageQueue.shift();
            return { content: [{ type: 'text', text: message }] };
        }
        
        const message = await new Promise(resolve => waitingResolvers.push(resolve));
        return { content: [{ type: 'text', text: message }] };
    }

    return { content: [{ type: 'text', text: 'Unknown tool' }] };
});

async function main() {
    const transport = new StdioServerTransport();
    await server.connect(transport);
    console.error('MCP Server running...');
}

main().catch(console.error);
