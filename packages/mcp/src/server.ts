import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { CallToolRequestSchema, ListToolsRequestSchema } from '@modelcontextprotocol/sdk/types.js';
import { inspectComponentTool } from './tools/inspect-component.js';
import { mutateClassTool, mutateCvaVariantTool } from './tools/mutate-class.js';

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
          description:
            'Extracts CVA variants, TypeScript props, JSX elements with source locations, and preview tree from a TSX file',
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
          description:
            'Updates Tailwind classNames (for a JSX element, element index, or CVA base/variant) with minimal non-lossy AST edits',
          inputSchema: {
            type: 'object',
            properties: {
              filePath: { type: 'string', description: 'Absolute path to .tsx file' },
              componentName: { type: 'string', description: 'Target JSX element or component identifier' },
              newClasses: { type: 'string', description: 'Tailwind classes to apply' },
              targetIndex: { type: 'number', description: 'Optional 0-based index when multiple elements share a tag name' },
              cvaBase: { type: 'boolean', description: 'Set true to mutate the cva() base class string instead of JSX' },
            },
            required: ['filePath', 'componentName', 'newClasses'],
          },
        },
        {
          name: 'retune_mutate_cva_variant',
          description:
            'Updates or adds a named variant in cva().variants and optionally pins it in defaultVariants',
          inputSchema: {
            type: 'object',
            properties: {
              filePath: { type: 'string', description: 'Absolute path to .tsx file' },
              variantGroup: { type: 'string', description: 'CVA variant group name (e.g. variant, size)' },
              variantKey: { type: 'string', description: 'Variant key name to update or create (e.g. brand, xl)' },
              newClasses: { type: 'string', description: 'Optional Tailwind classes for the variant' },
              setAsDefault: { type: 'boolean', description: 'Optional flag to set this key in defaultVariants' },
            },
            required: ['filePath', 'variantGroup', 'variantKey'],
          },
        },
      ],
    };
  });

  server.setRequestHandler(CallToolRequestSchema, async (request) => {
    const { name, arguments: args } = request.params;

    if (name === 'retune_inspect_component') {
      const meta = await inspectComponentTool(String(args?.filePath));
      return { content: [{ type: 'text', text: JSON.stringify(meta, null, 2) }] };
    }

    if (name === 'retune_fine_tune_classes') {
      await mutateClassTool(String(args?.filePath), String(args?.componentName), String(args?.newClasses), {
        targetIndex: typeof args?.targetIndex === 'number' ? args.targetIndex : undefined,
        cvaBase: Boolean(args?.cvaBase),
      });
      return {
        content: [{ type: 'text', text: `Successfully updated classes in ${String(args?.filePath)}` }],
      };
    }

    if (name === 'retune_mutate_cva_variant') {
      await mutateCvaVariantTool(
        String(args?.filePath),
        String(args?.variantGroup),
        String(args?.variantKey),
        {
          newClasses: typeof args?.newClasses === 'string' ? args.newClasses : undefined,
          setAsDefault: Boolean(args?.setAsDefault),
        }
      );
      return {
        content: [
          {
            type: 'text',
            text: `Successfully updated CVA variant ${String(args?.variantGroup)}.${String(args?.variantKey)} in ${String(args?.filePath)}`,
          },
        ],
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
