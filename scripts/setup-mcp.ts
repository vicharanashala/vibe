import { execSync } from 'child_process';
import { promises as fs } from 'fs';
import { existsSync } from 'fs';
import * as path from 'path';

async function setupMcp() {
  try {
    // Install the openapi-mcp-generator package
    console.log('Installing openapi-mcp-generator...');
    execSync('pnpm install -g openapi-mcp-generator', { stdio: 'inherit' });

    // Generate fresh OpenAPI spec
    console.log('Generating fresh OpenAPI spec...');
    execSync('pnpm --dir ./backend gen-openapi', { stdio: 'inherit' });

    // Delete existing mcp directory if it exists
    const mcpDir = path.join('mcp');
    if (existsSync(mcpDir)) {
      console.log('Deleting existing mcp directory...');
      await fs.rm(mcpDir, { recursive: true, force: true });
    }

    // Run the generator
    console.log('Generating MCP code from OpenAPI spec...');
    execSync('openapi-mcp-generator --input backend/openapi/openapi.json --output mcp', { stdio: 'inherit' });

    // install and build mcp
    console.log('Installing and building MCP...');
    execSync('cd ./mcp && pnpm install && pnpm build && cd ..', { stdio: 'inherit' });

    // Create .vscode directory if it doesn't exist
    console.log('Setting up .vscode directory...');
    await fs.mkdir('.vscode', { recursive: true });

    // Create mcp.json file with the specified content
    const mcpJsonContent = `{
    "servers": {
        "vibe": {
            "type": "stdio",
            "command": "pnpm",
            "args": [
                "--dir",
                "\${workspaceFolder}/mcp",
                "start"
            ]
        }
    }
}`;

    await fs.writeFile(path.join('.vscode', 'mcp.json'), mcpJsonContent);
    
    console.log('\nMCP setup completed successfully!');
    console.log('Additional steps:\n1. If the agent shows errors in loading tools, Open the .vscode/mcp.json file and click restart. \n2. Make sure that the setting `chat.mcp.enabled` is checked in vscode settings. To check, go to File > Preferences > Settings and search for the above setting. ');
  } catch (error) {
    console.error('Error during MCP setup:', error);
    process.exit(1);
  }
}

// Execute the setup function
setupMcp();
