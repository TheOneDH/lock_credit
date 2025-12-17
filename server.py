#!/usr/bin/env python3
"""MCP Input Server - A simple MCP server with web UI for user input."""

import asyncio
import json
from collections import deque
from aiohttp import web
from mcp.server import Server
from mcp.server.stdio import stdio_server
from mcp.types import Tool, TextContent

# Message queue and waiting resolvers
message_queue: deque[str] = deque()
waiting_resolvers: deque[asyncio.Future] = deque()

HTML_PAGE = """<!DOCTYPE html>
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
        h1 { font-size: 18px; margin-bottom: 16px; color: #fff; }
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
        textarea:focus { outline: none; border-color: #007acc; }
        .btn-group { display: flex; gap: 10px; }
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
        .btn-primary { background: #007acc; color: white; }
        .btn-primary:hover { background: #005a9e; }
        .btn-primary:disabled { background: #004578; opacity: 0.6; cursor: not-allowed; }
        .btn-secondary { background: #3c3c3c; color: #d4d4d4; }
        .btn-secondary:hover { background: #4a4a4a; }
        .btn-secondary:disabled { opacity: 0.6; cursor: not-allowed; }
        .btn-danger { background: #c42b1c; color: white; }
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
        .hint { margin-top: 12px; font-size: 12px; color: #808080; }
        .image-preview {
            margin-bottom: 12px;
            position: relative;
            display: none;
        }
        .image-preview img {
            max-width: 100%;
            max-height: 200px;
            border-radius: 6px;
            border: 1px solid #3c3c3c;
        }
        .image-preview .remove-btn {
            position: absolute;
            top: 8px;
            right: 8px;
            width: 24px;
            height: 24px;
            border-radius: 50%;
            background: rgba(0,0,0,0.7);
            color: white;
            border: none;
            cursor: pointer;
            font-size: 14px;
            display: flex;
            align-items: center;
            justify-content: center;
        }
        .image-preview .remove-btn:hover { background: #c42b1c; }
    </style>
</head>
<body>
    <div class="container">
        <h1>Send to AI</h1>
        <div id="imagePreview" class="image-preview">
            <img id="previewImg" src="" alt="Preview">
            <button class="remove-btn" onclick="removeImage()">×</button>
        </div>
        <textarea id="content" placeholder="Enter your message... (Ctrl+V to paste image)" autofocus></textarea>
        <div class="btn-group">
            <button id="submitBtn" class="btn-primary">Submit</button>
            <button id="endBtn" class="btn-secondary">End</button>
            <button id="killBtn" class="btn-danger">Kill</button>
        </div>
        <div id="status" class="status"></div>
        <p class="hint">Enter to submit, Shift+Enter for new line, Ctrl+V to paste image</p>
    </div>
    <script>
        const textarea = document.getElementById('content');
        const submitBtn = document.getElementById('submitBtn');
        const endBtn = document.getElementById('endBtn');
        const killBtn = document.getElementById('killBtn');
        const status = document.getElementById('status');
        const imagePreview = document.getElementById('imagePreview');
        const previewImg = document.getElementById('previewImg');
        let pastedImageData = null;

        function setButtonsDisabled(disabled) {
            submitBtn.disabled = disabled;
            endBtn.disabled = disabled;
        }

        function showStatus(message, isError = false) {
            status.textContent = message;
            status.className = 'status ' + (isError ? 'error' : 'success');
            setTimeout(() => { status.className = 'status'; }, 3000);
        }

        function removeImage() {
            pastedImageData = null;
            imagePreview.style.display = 'none';
            previewImg.src = '';
        }

        document.addEventListener('paste', (e) => {
            const items = e.clipboardData?.items;
            if (!items) return;
            for (const item of items) {
                if (item.type.startsWith('image/')) {
                    e.preventDefault();
                    const file = item.getAsFile();
                    const reader = new FileReader();
                    reader.onload = (event) => {
                        pastedImageData = event.target.result;
                        previewImg.src = pastedImageData;
                        imagePreview.style.display = 'block';
                    };
                    reader.readAsDataURL(file);
                    break;
                }
            }
        });

        async function sendMessage(content) {
            setButtonsDisabled(true);
            submitBtn.textContent = 'Sending...';
            try {
                const payload = { content };
                if (pastedImageData) {
                    payload.image = pastedImageData;
                }
                const res = await fetch('/message', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(payload)
                });
                if (res.ok) {
                    showStatus('Message sent!');
                    textarea.value = '';
                    removeImage();
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
</html>"""


async def handle_index(request):
    return web.Response(text=HTML_PAGE, content_type='text/html')


async def handle_message(request):
    try:
        data = await request.json()
        message = data.get('content', '')
        image = data.get('image', '')
        
        # Combine message and image data
        if image:
            message = f"{message}\n\n[IMAGE]\n{image}"
        
        if waiting_resolvers:
            future = waiting_resolvers.popleft()
            future.set_result(message)
        else:
            message_queue.append(message)
        
        return web.json_response({'success': True})
    except Exception as e:
        return web.json_response({'error': str(e)}, status=400)


async def handle_kill(request):
    asyncio.get_event_loop().call_later(0.1, lambda: exit(0))
    return web.json_response({'success': True})


async def start_http_server():
    app = web.Application()
    app.router.add_get('/', handle_index)
    app.router.add_get('/index.html', handle_index)
    app.router.add_post('/message', handle_message)
    app.router.add_post('/kill', handle_kill)
    
    runner = web.AppRunner(app)
    await runner.setup()
    site = web.TCPSite(runner, 'localhost', 9876)
    await site.start()
    print("Web UI: http://localhost:9876", file=__import__('sys').stderr)


# MCP Server
server = Server("mcp-input-server")


@server.list_tools()
async def list_tools():
    return [
        Tool(
            name="get_vscode_input",
            description="Get the message that user submitted from the web input panel. Call this to receive user input.",
            inputSchema={"type": "object", "properties": {}, "required": []}
        )
    ]


@server.call_tool()
async def call_tool(name: str, arguments: dict):
    if name == "get_vscode_input":
        if message_queue:
            message = message_queue.popleft()
        else:
            future = asyncio.get_event_loop().create_future()
            waiting_resolvers.append(future)
            message = await future
        
        return [TextContent(type="text", text=message)]
    
    return [TextContent(type="text", text="Unknown tool")]


async def main():
    await start_http_server()
    async with stdio_server() as (read_stream, write_stream):
        await server.run(read_stream, write_stream, server.create_initialization_options())


if __name__ == "__main__":
    asyncio.run(main())
