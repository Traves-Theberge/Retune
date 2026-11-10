import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { CallToolRequestSchema, ListToolsRequestSchema } from '@modelcontextprotocol/sdk/types.js';
import { extractCvaMetadata, mutateClassName } from '@retune/core';
import * as fs from 'node:fs/promises';

export async function runMcpServer() {
  const server = new Server(
    { name: 'retune-engine', version: '1.0.0' },
    { capabilities: { tools: {} } }
  );

  server.setRequestHandler(ListToolsRequestSchema, async () => {
    return {
      tools: [
        {
          name: 'retune_inspect_component',
          description: 'Extracts CVA variants, default props, and base classes from a TSX file',
          inputSchema: {
            type: 'object',
            properties: {
              filePath: { type: 'string', description: 'Absolute path to .tsx file' },
            },
            required: ['filePath'],
          },
        },
        {
          name: 'retune_fine_tune_classes',
          description: 'Updates Tailwind classNames with format-preserving AST mutation',
          inputSchema: {
            type: 'object',
            properties: {
              filePath: { type: 'string', description: 'Absolute path to .tsx file' },
              componentName: { type: 'string', description: 'Target JSX element or component identifier' },
              newClasses: { type: 'string', description: 'Tailwind classes to apply' },
            },
            required: ['filePath', 'componentName', 'newClasses'],
          },
        },
      ],
    };
  });

  server.setRequestHandler(CallToolRequestSchema, async (request) => {
    const { name, arguments: args } = request.params;

    if (name === 'retune_inspect_component') {
      const filePath = String(args?.filePath);
      const content = await fs.readFile(filePath, 'utf-8');
      const meta = extractCvaMetadata(content);
      return { content: [{ type: 'text', text: JSON.stringify(meta, null, 2) }] };
    }

    if (name === 'retune_fine_tune_classes') {
      const filePath = String(args?.filePath);
      const componentName = String(args?.componentName);
      const newClasses = String(args?.newClasses);

      const content = await fs.readFile(filePath, 'utf-8');
      const updated = mutateClassName(content, componentName, newClasses);
      await fs.writeFile(filePath, updated, 'utf-8');

      return {
        content: [{ type: 'text', text: `Successfully updated classes in ${filePath}` }],
      };
    }

    throw new Error(`Tool not found: ${name}`);
  });

  const transport = new StdioServerTransport();
  await server.connect(transport);
}

if (require.main === module) {
  runMcpServer().catch(console.error);
}

