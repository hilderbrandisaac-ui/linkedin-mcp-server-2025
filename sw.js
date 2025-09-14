const CACHE_NAME = 'linkedin-mcp-v1';

self.addEventListener('install', event => {
    self.skipWaiting();
});

self.addEventListener('activate', event => {
    event.waitUntil(clients.claim());
});

self.addEventListener('fetch', event => {
    const url = new URL(event.request.url);
    
    // Handle MCP endpoint requests
    if (url.pathname === '/mcp' && event.request.method === 'POST') {
        event.respondWith(handleMCPRequest(event.request));
        return;
    }

    // Handle CORS preflight
    if (event.request.method === 'OPTIONS') {
        event.respondWith(new Response(null, {
            status: 200,
            headers: {
                'Access-Control-Allow-Origin': '*',
                'Access-Control-Allow-Methods': 'POST, OPTIONS',
                'Access-Control-Allow-Headers': 'Content-Type, Authorization'
            }
        }));
        return;
    }
});

async function handleMCPRequest(request) {
    try {
        const requestData = await request.json();
        
        // Import MCP server logic (simplified for service worker)
        const mcpServer = {
            handleToolsList() {
                return {
                    jsonrpc: "2.0",
                    result: {
                        tools: [
                            {
                                name: "get_profile",
                                description: "Get LinkedIn profile information for the current user",
                                inputSchema: { type: "object", properties: {}, required: [] }
                            },
                            {
                                name: "create_post",
                                description: "Create a new LinkedIn post", 
                                inputSchema: {
                                    type: "object",
                                    properties: {
                                        text: { type: "string", description: "The text content of the post" },
                                        visibility: { 
                                            type: "string", 
                                            description: "Post visibility (PUBLIC or CONNECTIONS)",
                                            enum: ["PUBLIC", "CONNECTIONS"]
                                        }
                                    },
                                    required: ["text"]
                                }
                            }
                        ]
                    }
                };
            },
            handleToolsCall(params) {
                const toolName = params.name;
                const args = params.arguments || {};
                
                let result;
                switch(toolName) {
                    case "get_profile":
                        result = {
                            id: "demo-user",
                            name: "Demo LinkedIn User",
                            headline: "Professional using MCP Server"
                        };
                        break;
                    case "create_post":
                        result = {
                            message: `Post created: "${args.text}"`,
                            visibility: args.visibility || "PUBLIC",
                            id: `post-${Date.now()}`
                        };
                        break;
                    default:
                        result = { error: `Unknown tool: ${toolName}` };
                }

                return {
                    jsonrpc: "2.0",
                    result: {
                        content: [{
                            type: "text", 
                            text: JSON.stringify(result, null, 2)
                        }]
                    }
                };
            }
        };

        const method = requestData.method;
        const params = requestData.params || {};
        const requestId = requestData.id;
        
        let response;
        if (method === 'tools/list') {
            response = mcpServer.handleToolsList();
        } else if (method === 'tools/call') {
            response = mcpServer.handleToolsCall(params);
        } else {
            response = {
                jsonrpc: "2.0",
                error: {
                    code: -32601,
                    message: `Method not found: ${method}`
                }
            };
        }

        if (requestId) {
            response.id = requestId;
        }

        return new Response(JSON.stringify(response), {
            status: 200,
            headers: {
                'Content-Type': 'application/json',
                'Access-Control-Allow-Origin': '*',
                'Access-Control-Allow-Methods': 'POST, OPTIONS',
                'Access-Control-Allow-Headers': 'Content-Type, Authorization'
            }
        });

    } catch (error) {
        return new Response(JSON.stringify({
            jsonrpc: "2.0",
            error: {
                code: -32603,
                message: `Internal error: ${error.message}`
            }
        }), {
            status: 500,
            headers: {
                'Content-Type': 'application/json',
                'Access-Control-Allow-Origin': '*'
            }
        });
    }
}