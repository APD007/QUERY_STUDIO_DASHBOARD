import type { ExprNode, LogicalNode, LogicalOp } from '@/types/expr';
import { notNode, logicalGroup } from './exprBuilders';

function hasId(node: ExprNode): node is ExprNode & { id: string } {
  return 'id' in node;
}

/**
 * Bottom-up tree walk over the filter tree. `transform` runs on every node
 * after its children (LogicalNode.children / NotNode.child) have already
 * been processed. Returning `null` deletes that node from its parent.
 */
function recurse(node: ExprNode, transform: (n: ExprNode) => ExprNode | null): ExprNode | null {
  if (node.kind === 'logical') {
    const children = node.children
      .map(c => recurse(c, transform))
      .filter((c): c is ExprNode => c !== null);
    return transform({ ...node, children });
  }
  if (node.kind === 'not') {
    const child = recurse(node.child, transform);
    if (child === null) return null;
    return transform({ ...node, child });
  }
  return transform(node);
}

export function removeNode(root: LogicalNode, id: string): LogicalNode {
  const result = recurse(root, n => (hasId(n) && n.id === id ? null : n));
  return (result ?? { ...root, children: [] }) as LogicalNode;
}

export function replaceNode(root: LogicalNode, id: string, replacement: ExprNode): LogicalNode {
  const result = recurse(root, n => (hasId(n) && n.id === id ? replacement : n));
  return result as LogicalNode;
}

/** Applies `fn` to the single node matching `id`, replacing it with whatever `fn` returns. */
export function transformNode(root: LogicalNode, id: string, fn: (old: ExprNode) => ExprNode): LogicalNode {
  const result = recurse(root, n => (hasId(n) && n.id === id ? fn(n) : n));
  return result as LogicalNode;
}

export function wrapInNot(root: LogicalNode, id: string): LogicalNode {
  return transformNode(root, id, old => notNode(old));
}

export function unwrapNot(root: LogicalNode, id: string): LogicalNode {
  return transformNode(root, id, old => (old.kind === 'not' ? old.child : old));
}

export function wrapInGroup(root: LogicalNode, id: string, op: LogicalOp = 'AND'): LogicalNode {
  return transformNode(root, id, old => logicalGroup(op, [old]));
}

export function addToGroup(root: LogicalNode, groupId: string, newNode: ExprNode): LogicalNode {
  const result = recurse(root, n =>
    n.kind === 'logical' && n.id === groupId ? { ...n, children: [...n.children, newNode] } : n
  );
  return result as LogicalNode;
}

export function setGroupOp(root: LogicalNode, groupId: string, op: 'AND' | 'OR'): LogicalNode {
  const result = recurse(root, n => (n.kind === 'logical' && n.id === groupId ? { ...n, op } : n));
  return result as LogicalNode;
}

export function findNodeById(root: ExprNode, id: string): ExprNode | null {
  if (hasId(root) && root.id === id) return root;
  if (root.kind === 'logical') {
    for (const child of root.children) {
      const found = findNodeById(child, id);
      if (found) return found;
    }
  }
  if (root.kind === 'not') return findNodeById(root.child, id);
  return null;
}
