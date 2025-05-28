# Setting Up MCP Servers for OpenAPI endpoints

## What is MCP?

**MCP (Model Context Protocol)** is a protocol used by AI agents to access information. Here, it transforms your existing OpenAPI specifications into tools that AI agents like GitHub Copilot can use. This integration allows AI agents to directly interact with your API endpoints, making them more powerful by enabling them to fetch real-time data, perform operations, and work with your specific services.

By converting your API definitions to the MCP server, you give AI agents the ability to understand and use your API's capabilities programmatically, just like a human developer would.

## Setup via automated script (Preferred)

You can set up mcp server for the openapi specification just by running this in the project root:
```bash
node scripts/setup-mcp.ts
```
And all set! Now, you can call for any tool inside of your AI Agent Mode. If needed in Edit mode, you can add the tool by clicking on `Add Context > Tools` and prompt the tool.


## Instructions for manual installation
### Install `openapi-mcp-generator`
Install the OpenAPI MCP generator using pnpm:

```bash
pnpm install openapi-mcp-generator
```

### Generating MCP Server
To convert your OpenAPI specification into MCP format, do

```bash
openapi-mcp-generator --input path/to/openapi.json --output path/to/output/dir
```
In our case, the command could be
```bash
openapi-mcp-generator --input backend/openapi/openapi.json --output mcp
```

This command:
- Reads your OpenAPI specification file from `backend/openapi/openapi.json`
- Generates MCP definitions in the `mcp` directory

> Note: if you want, you can also make Streamable HTTP or Web(openAI) type servers as well. For this, add `--transport=[web/streamable-http] --port=[port]` flags

### Configuration
Now, to configure the MCP server with github copilot
1. Press <kbd>ctrl</kbd> + <kbd>shift</kbd> + <kbd>P</kbd>
2. Search and click on `MCP: Add Server...`. 
3. Select the type of MCP server you want to connect. In our scenario, it will be an stdio server
4. Type in `pnpm --dir ${workspaceFolder}/mcp start`
5. Type any name you want for this mcp server.o

### Settings Check
Ensure that the setting `chat.mcp.enabled` is checked in vscode settings. To check, go to File > Preferences > Settings and search for the above setting. 

## Troubleshooting

If you encounter issues:

1. Verify your OpenAPI specification is valid
2. Check that your MCP server is accessible
3. Review the settings as mentioned above.
