export interface MCPServerConfig {
  name: string;
  url: string;
  enabled: boolean;
}

export const mcpServers: MCPServerConfig[] = [
  { name: 'sqlite-server', url: 'http://localhost:8081', enabled: true },
  { name: 'filesystem-server', url: 'http://localhost:8082', enabled: false }
];
