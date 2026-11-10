import { parse } from '@babel/parser';
import traverse from '@babel/traverse';
import * as t from '@babel/types';
import { CvaMetadata } from '../types';

const traverseAst: typeof traverse =
  typeof traverse === 'function' ? traverse : (traverse as unknown as { default: typeof traverse }).default;

export function extractCvaMetadata(sourceCode: string): CvaMetadata {
  const ast = parse(sourceCode, {
    sourceType: 'module',
    plugins: ['typescript', 'jsx'],
  });

  const metadata: CvaMetadata = {
    hasCva: false,
    variants: {},
    variantClasses: {},
    defaultVariants: {},
    baseClasses: '',
  };

  traverseAst(ast, {
    CallExpression(path) {
      const { callee, arguments: args } = path.node;
      const isCva =
        (t.isIdentifier(callee) && callee.name === 'cva') ||
        (t.isMemberExpression(callee) &&
          t.isIdentifier(callee.property) &&
          callee.property.name === 'cva');

      if (!isCva) return;

      metadata.hasCva = true;

      if (path.parentPath.isVariableDeclarator() && t.isIdentifier(path.parentPath.node.id)) {
        metadata.cvaIdentifier = path.parentPath.node.id.name;
      }

      // 1. Extract Base Classes
      if (args.length > 0 && t.isStringLiteral(args[0])) {
        metadata.baseClasses = args[0].value;
      } else if (args.length > 0 && t.isArrayExpression(args[0])) {
        metadata.baseClasses = args[0].elements
          .filter((el): el is t.StringLiteral => t.isStringLiteral(el))
          .map((el) => el.value)
          .join(' ');
      }

      // 2. Extract Options Config ({ variants, defaultVariants })
      if (args.length >= 2 && t.isObjectExpression(args[1])) {
        for (const prop of args[1].properties) {
          if (!t.isObjectProperty(prop) || !t.isIdentifier(prop.key)) continue;

          if (prop.key.name === 'variants' && t.isObjectExpression(prop.value)) {
            for (const vGroup of prop.value.properties) {
              if (t.isObjectProperty(vGroup) && t.isIdentifier(vGroup.key) && t.isObjectExpression(vGroup.value)) {
                const groupName = vGroup.key.name;
                metadata.variants[groupName] = [];
                if (!metadata.variantClasses) metadata.variantClasses = {};
                metadata.variantClasses[groupName] = {};

                for (const vOption of vGroup.value.properties) {
                  if (t.isObjectProperty(vOption)) {
                    const optName = t.isIdentifier(vOption.key)
                      ? vOption.key.name
                      : t.isStringLiteral(vOption.key)
                      ? vOption.key.value
                      : null;
                    if (optName) {
                      metadata.variants[groupName].push(optName);
                      if (t.isStringLiteral(vOption.value)) {
                        metadata.variantClasses[groupName][optName] = vOption.value.value;
                      } else if (t.isArrayExpression(vOption.value)) {
                        metadata.variantClasses[groupName][optName] = vOption.value.elements
                          .filter((el): el is t.StringLiteral => t.isStringLiteral(el))
                          .map((el) => el.value)
                          .join(' ');
                      }
                    }
                  }
                }
              }
            }
          }

          if (prop.key.name === 'defaultVariants' && t.isObjectExpression(prop.value)) {
            for (const dProp of prop.value.properties) {
              if (
                t.isObjectProperty(dProp) &&
                t.isIdentifier(dProp.key) &&
                t.isStringLiteral(dProp.value)
              ) {
                metadata.defaultVariants[dProp.key.name] = dProp.value.value;
              }
            }
          }
        }
      }
    },
  });

  return metadata;
}
