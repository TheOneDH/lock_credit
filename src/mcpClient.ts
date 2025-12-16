import * as http from 'http';

export class McpClient {
    private serverUrl = 'http://localhost:9876';

    async sendMessage(content: string): Promise<string> {
        return new Promise((resolve, reject) => {
            const data = JSON.stringify({ content });
            
            const req = http.request(
                `${this.serverUrl}/message`,
                {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        'Content-Length': Buffer.byteLength(data)
                    }
                },
                (res) => {
                    let body = '';
                    res.on('data', chunk => body += chunk);
                    res.on('end', () => {
                        if (res.statusCode === 200) {
                            resolve('Message sent to MCP server');
                        } else {
                            reject(new Error(`Server error: ${res.statusCode}`));
                        }
                    });
                }
            );

            req.on('error', (e) => {
                reject(new Error(`Failed to connect to MCP server: ${e.message}. Make sure the MCP server is running.`));
            });

            req.write(data);
            req.end();
        });
    }
}
