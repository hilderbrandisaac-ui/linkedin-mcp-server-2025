/*
 * /$$$$$$            /$$            /$$
 * | $$  | $$          | $$           |__/
 * | $$  | $$ /$$$$$$$ | $$  /$$$$$$$  /$$ /$$$$$$$
 * | $$$$$$$$| $$__  $$| $$ /$$_____/ | $$| $$__  $$
 * | $$__  $$| $$  \ $$| $$|  $$$$$$  | $$| $$  \ $$
 * | $$  | $$| $$  | $$| $$ \____  $$ | $$| $$  | $$
 * | $$  | $$| $$  | $$| $$ /$$$$$$$/ | $$| $$  | $$
 * |__/  |__/|__/  |__/|__/|_______/  |__/|__/  |__/
 *
 * Forged in the fires of a thousand console logs.
 * This Service Worker acts as the brain, intercepting MCP requests.
 */

const MCP_ENDPOINT = '/mcp';
const CORS_HEADERS = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
};

/**
 * A self-contained class that handles all MCP logic.
 * This mirrors the structure in index.html but is independent
 * and lives entirely within the Service Worker.
 */
class MCPServerLogic {
    constructor() {
        this.tools = {
            get_profile: {
                name: "get_profile",
                description: "Get LinkedIn profile information for the current user.",
                inputSchema: { type: "object", properties: {}, required: [] }
            },
            create_post: {
                name: "create_post",
                description: "Create a new LinkedIn post.",
                inputSchema: {
                    type: "object",
                    properties: {
                        text: { type: "string", description: "The text content of the post." },
                        visibility: { type: "string", description: "Post visibility ('PUBLIC' or 'CONNECTIONS').", enum: ["PUBLIC", "CONNECTIONS"] }
                    },
                    required: ["text"]
                }
            },
            search_organizations: {
                name: "search_organizations",
                description: "Search for LinkedIn organizations.",
                inputSchema: {
                    type: "object",
                    properties: { query: { type: "string", description: "Search query for organizations." } },
                    required: ["query"]
                }
            },
            get_organizations: {
                name: "get_organizations",
                description: "Get organizations the user has administrator access to.",
                inputSchema: { type: "object", properties: {}, required: [] }
            }
        };
    }

    handleToolsList() {
        return { jsonrpc: "2.0", result: { tools: Object.values(this.tools) } };
    }

    async handleToolsCall(params) {
        const { name: toolName, arguments: toolArgs = {} } = params;

        if (typeof this[toolName] !== 'function') {
            return { jsonrpc: "2.0", error: { code: -32602, message: `Tool not found: ${toolName}` } };
        }

        const result = await this[toolName](toolArgs);
        return {
            jsonrpc: "2.0",
            result: {
                content: [{ type: "text", text: JSON.stringify(result, null, 2) }]
            }
        };
    }

    // --- MOCK TOOL IMPLEMENTATIONS ---

    async get_profile(args) {
        console.log('[SW] Executing tool: get_profile', args);
        return { id: "sw-mock-user-123", name: "Alex Doe", headline: "AI Integration Specialist", note: "Response from Service Worker" };
    }

    async create_post({ text, visibility = "PUBLIC" }) {
        console.log('[SW] Executing tool: create_post', { text, visibility });
        return { id: `sw-post-${Date.now()}`, status: "PUBLISHED", message: `Post created successfully via Service Worker.` };
    }

    async search_organizations({ query }) {
        console.log('[SW] Executing tool: search_organizations', { query });
        return { results: [{ name: `Service Worker Found: ${query} Corp`, id: 54321 }] };
    }

    async get_organizations(args) {
        console.log('[SW] Executing tool: get_organizations', args);
        return { organizations: [{ name: "SW Demo Company", role: "ADMINISTRATOR" }] };
    }
}

const server = new MCPServerLogic();

// --- SERVICE WORKER LIFECYCLE ---

self.addEventListener('install', event => {
    console.log('[SW] Install event: Activating immediately.');
    self.skipWaiting();
});

self.addEventListener('activate', event => {
    console.log('[SW] Activate event: Claiming clients.');
    event.waitUntil(clients.claim());
});

// --- FETCH EVENT INTERCEPTION ---

self.addEventListener('fetch', event => {
    const { request } = event;
    const url = new URL(request.url);

    // Only intercept requests to our specific MCP endpoint.
    if (url.pathname === MCP_ENDPOINT) {
        // Handle CORS preflight requests.
        if (request.method === 'OPTIONS') {
            return event.respondWith(new Response(null, {
                status: 204, // No Content
                headers: CORS_HEADERS
            }));
        }

        // Handle actual MCP POST requests.
        if (request.method === 'POST') {
            return event.respondWith(handleMCPRequest(request));
        }
    }

    // For any other request, do nothing and let the browser handle it normally.
});

/**
 * Handles the incoming MCP request by routing it to the server logic.
 * @param {Request} request The incoming fetch request.
 * @returns {Promise<Response>} A promise that resolves to a Response object.
 */
async function handleMCPRequest(request) {
    let body;
    try {
        body = await request.json();
    } catch (error) {
        return createErrorResponse({ code: -32700, message: 'Parse error: Invalid JSON.' }, 400);
    }

    const { method, params, id } = body;
    let responseData;

    try {
        switch (method) {
            case 'tools/list':
                responseData = server.handleToolsList();
                break;
            case 'tools/call':
                responseData = await server.handleToolsCall(params);
                break;
            default:
                responseData = { jsonrpc: "2.0", error: { code: -32601, message: `Method not found: ${method}` } };
        }
    } catch (error) {
        return createErrorResponse({ code: -32603, message: `Internal Server Error: ${error.message}` }, 500);
    }
    
    if (id) {
        responseData.id = id;
    }

    return new Response(JSON.stringify(responseData), {
        status: 200,
        headers: {
            ...CORS_HEADERS,
            'Content-Type': 'application/json',
        }
    });
}

/**
 * A helper function to create consistent JSON-RPC error responses.
 * @param {{code: number, message: string}} error The error object.
 * @param {number} status The HTTP status code.
 * @returns {Response} A JSON Response object.
 */
function createErrorResponse(error, status) {
    console.error('[SW] Error:', error.message);
    const errorPayload = { jsonrpc: '2.0', error };
    return new Response(JSON.stringify(errorPayload), {
        status: status,
        headers: {
            ...CORS_HEADERS,
            'Content-Type': 'application/json',
        }
    });
}
```
