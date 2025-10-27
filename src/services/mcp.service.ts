import { Injectable } from '@angular/core';

@Injectable({
  providedIn: 'root',
})
export class McpService {
  constructor() {}

  // Placeholder for MCP integration
  // TestSprite MCP server is configured in .vscode/settings.json
  // VSCode will automatically start and manage the MCP server

  isConfigured(): boolean {
    return true; // MCP is configured in VSCode settings
  }

  // Future implementation for in-app MCP usage
  async connectToMCP(): Promise<void> {
    // Implementation for connecting to MCP server from Angular app
    console.log('MCP service ready for integration');
  }
}