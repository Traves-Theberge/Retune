import { parse, print, types } from 'recast';
import { parse as babelParse } from '@babel/parser';
import * as t from '@babel/types';

export function mutateClassName(
  sourceCode: string,
  targetComponent: string,
  newClassName: string
): string {
  const ast = parse(sourceCode, {
    parser: {
      parse(source: string) {
        return babelParse(source, {
          sourceType: 'module',
          plugins: ['typescript', 'jsx'],
          tokens: true,
        });
      },
    },
  });

  let mutated = false;

  // Walk using Recast AST types
  types.visit(ast, {
    visitJSXOpeningElement(path: any) {
      const node = path.node;
      const isTarget =
        t.isJSXIdentifier(node.name) &&
        (node.name.name === targetComponent ||
          node.name.name === 'button' ||
          node.name.name === 'div');

      if (isTarget && !mutated) {
        const classAttr = node.attributes.find(
          (attr: any) => t.isJSXAttribute(attr) && attr.name.name === 'className'
        );

        if (classAttr) {
          classAttr.value = t.stringLiteral(newClassName);
        } else {
          node.attributes.push(
            t.jsxAttribute(t.jsxIdentifier('className'), t.stringLiteral(newClassName))
          );
        }
        mutated = true;
      }
      this.traverse(path);
    },
  });

  return print(ast).code;
}

export function mutateDefaultVariant(
  sourceCode: string,
  variantGroup: string,
  variantValue: string
): string {
  const ast = parse(sourceCode, {
    parser: {
      parse(source: string) {
        return babelParse(source, {
          sourceType: 'module',
          plugins: ['typescript', 'jsx'],
          tokens: true,
        });
      },
    },
  });

  types.visit(ast, {
    visitObjectProperty(path: any) {
      const node = path.node;
      if (
        t.isIdentifier(node.key) &&
        node.key.name === 'defaultVariants' &&
        t.isObjectExpression(node.value)
      ) {
        const existingProp = node.value.properties.find(
          (p: any) => t.isObjectProperty(p) && t.isIdentifier(p.key) && p.key.name === variantGroup
        );
        if (existingProp && t.isObjectProperty(existingProp)) {
          existingProp.value = t.stringLiteral(variantValue);
        } else {
          node.value.properties.push(
            t.objectProperty(t.identifier(variantGroup), t.stringLiteral(variantValue))
          );
        }
      }
      this.traverse(path);
    },
  });

  return print(ast).code;
}
