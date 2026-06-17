import type {
  BetweenNode, CompareNode, CompareOp, ExprNode, InNode, LikeNode,
} from '@/types/expr';
import { between, compare, inOp, like } from './exprBuilders';

export type ConditionNode = CompareNode | BetweenNode | InNode | LikeNode;
export type RowOp = CompareOp | 'BETWEEN' | 'IN' | 'LIKE';

export function getConditionTarget(node: ConditionNode): ExprNode {
  return node.kind === 'compare' ? node.left : node.target;
}

export function getConditionOpLabel(node: ConditionNode): RowOp {
  if (node.kind === 'compare') return node.op;
  if (node.kind === 'between') return 'BETWEEN';
  if (node.kind === 'in') return 'IN';
  return 'LIKE';
}

export function buildConditionForOp(op: RowOp, target: ExprNode): ConditionNode {
  if (op === 'BETWEEN') {
    return between(
      target,
      { kind: 'literal', valueType: 'number', value: 0 },
      { kind: 'literal', valueType: 'number', value: 0 }
    );
  }
  if (op === 'IN')   return inOp(target, [{ kind: 'literal', valueType: 'string', value: '' }]);
  if (op === 'LIKE') return like(target, { kind: 'literal', valueType: 'string', value: '' });
  return compare(op, target, { kind: 'literal', valueType: 'string', value: '' });
}

export function isConditionNode(node: ExprNode): node is ConditionNode {
  return node.kind === 'compare' || node.kind === 'between' || node.kind === 'in' || node.kind === 'like';
}
