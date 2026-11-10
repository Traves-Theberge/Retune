import { parse, print, types } from 'recast';
import { parse as babelParse } from '@babel/parser';
import * as t from '@babel/types';

export function extractElementClassName(
  sourceCode: string,
  targetComponent?: string
): string {
  try {
    const ast = babelParse(sourceCode, {
      sourceType: 'module',
      plugins: ['typescript', 'jsx'],
    });

    let foundClass = '';
    types.visit(ast, {
      visitJSXOpeningElement(path: any) {
        const node = path.node;
        const nameMatch =
          t.isJSXIdentifier(node.name) &&
          (!targetComponent ||
            node.name.name === targetComponent ||
            node.name.name.toLowerCase() === targetComponent.toLowerCase());

        if (nameMatch && !foundClass) {
          const classAttr = node.attributes.find(
            (attr: any) => t.isJSXAttribute(attr) && attr.name.name === 'className'
          );
          if (classAttr && t.isStringLiteral(classAttr.value)) {
            foundClass = classAttr.value.value;
          }
        }
        this.traverse(path);
      },
    });

    return foundClass;
  } catch {
    return '';
  }
}

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
  let firstOpeningNode: any = null;

  // Walk using Recast AST types
  types.visit(ast, {
    visitJSXOpeningElement(path: any) {
      const node = path.node;
      if (!firstOpeningNode && t.isJSXIdentifier(node.name)) {
        firstOpeningNode = node;
      }

      const isTarget =
        t.isJSXIdentifier(node.name) &&
        (node.name.name === targetComponent ||
          node.name.name.toLowerCase() === targetComponent.toLowerCase());

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

  if (!mutated && firstOpeningNode) {
    const classAttr = firstOpeningNode.attributes.find(
      (attr: any) => t.isJSXAttribute(attr) && attr.name.name === 'className'
    );
    if (classAttr) {
      classAttr.value = t.stringLiteral(newClassName);
    } else {
      firstOpeningNode.attributes.push(
        t.jsxAttribute(t.jsxIdentifier('className'), t.stringLiteral(newClassName))
      );
    }
  }

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
