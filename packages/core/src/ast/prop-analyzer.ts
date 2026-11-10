import { parse } from '@babel/parser';
import traverse from '@babel/traverse';
import * as t from '@babel/types';
import { PropDefinition } from '../types';

const traverseAst: typeof traverse =
  typeof traverse === 'function' ? traverse : (traverse as unknown as { default: typeof traverse }).default;

export function analyzeProps(sourceCode: string): PropDefinition[] {
  const ast = parse(sourceCode, {
    sourceType: 'module',
    plugins: ['typescript', 'jsx'],
  });

  const props: PropDefinition[] = [];

  traverseAst(ast, {
    TSInterfaceDeclaration(path) {
      if (!path.node.id.name.endsWith('Props')) return;
      for (const prop of path.node.body.body) {
        if (t.isTSPropertySignature(prop) && t.isIdentifier(prop.key)) {
          const typeAnnotation = prop.typeAnnotation?.typeAnnotation;
          let typeStr = 'unknown';
          if (t.isTSStringKeyword(typeAnnotation)) typeStr = 'string';
          else if (t.isTSNumberKeyword(typeAnnotation)) typeStr = 'number';
          else if (t.isTSBooleanKeyword(typeAnnotation)) typeStr = 'boolean';
          else if (t.isTSTypeReference(typeAnnotation) && t.isIdentifier(typeAnnotation.typeName)) {
            typeStr = typeAnnotation.typeName.name;
          }

          props.push({
            name: prop.key.name,
            type: typeStr,
            optional: Boolean(prop.optional),
          });
        }
      }
    },
  });

  return props;
}

