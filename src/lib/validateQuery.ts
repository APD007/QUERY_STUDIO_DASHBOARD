import type { ExprNode, Query, ValidationResult } from '@/types/expr';
import type { FieldSchema } from '@/modules/queries/schema';

function walkExpr(node: ExprNode, visit: (n: ExprNode) => void): void {
  visit(node);
  switch (node.kind) {
    case 'agg':
      if (node.arg !== '*') walkExpr(node.arg, visit);
      break;
    case 'arith':
      walkExpr(node.left, visit); walkExpr(node.right, visit);
      break;
    case 'compare':
      walkExpr(node.left, visit); walkExpr(node.right, visit);
      break;
    case 'between':
      walkExpr(node.target, visit); walkExpr(node.low, visit); walkExpr(node.high, visit);
      break;
    case 'in':
      walkExpr(node.target, visit); node.list.forEach(n => walkExpr(n, visit));
      break;
    case 'like':
      walkExpr(node.target, visit); walkExpr(node.pattern, visit);
      break;
    case 'logical':
      node.children.forEach(n => walkExpr(n, visit));
      break;
    case 'not':
      walkExpr(node.child, visit);
      break;
    case 'fn':
      node.args.forEach(n => walkExpr(n, visit));
      break;
    case 'alias':
      walkExpr(node.expr, visit);
      break;
    case 'case':
      node.branches.forEach(b => { walkExpr(b.when, visit); walkExpr(b.then, visit); });
      if (node.elseValue) walkExpr(node.elseValue, visit);
      break;
    case 'fnExt':
      node.args.forEach(n => walkExpr(n, visit));
      break;
    default:
      break;
  }
}

function hasAggregate(node: ExprNode): boolean {
  let found = false;
  walkExpr(node, n => { if (n.kind === 'agg') found = true; });
  return found;
}

export function validateQuery(query: Query, schema: FieldSchema[]): ValidationResult {
  const errors: { message: string }[] = [];
  const fieldNames = schema.map(s => s.name);
  const fieldType = (name: string) => schema.find(s => s.name === name)?.type;

  /* ---- SELECT ---- */
  if (!query.select.length) {
    errors.push({ message: 'Add at least one field or measure to SELECT.' });
  }

  const anySelectHasAgg = query.select.some(it => hasAggregate(it.expr));

  query.select.forEach(item => {
    walkExpr(item.expr, node => {
      if (node.kind === 'field' && !fieldNames.includes(node.name)) {
        errors.push({ message: `Field "${node.name}" is not in the data.` });
      }
      if (node.kind === 'agg' && ['SUM', 'AVG'].includes(node.fn) && node.arg !== '*' && node.arg.kind === 'field') {
        const t = fieldType(node.arg.name);
        if (t !== 'number') {
          errors.push({ message: `${node.fn} needs a number field — "${node.arg.name}" is ${t ?? 'missing'}.` });
        }
      }
    });

    // plain top-level field selected alongside an aggregate elsewhere needs GROUP BY
    if (item.expr.kind === 'field' && anySelectHasAgg && !query.groupBy.includes(item.expr.name)) {
      errors.push({ message: `"${item.expr.name}" must be in GROUP BY or wrapped in a measure.` });
    }
  });

  /* ---- GROUP BY ---- */
  query.groupBy.forEach(f => {
    if (!fieldNames.includes(f)) errors.push({ message: `GROUP BY field "${f}" is not in the data.` });
  });

  /* ---- WHERE ---- */
  function checkWhereNode(node: ExprNode): void {
    switch (node.kind) {
      case 'logical':
        if (node.children.length === 0) {
          // empty root group is fine (= no filter); nested empty groups are not
        }
        node.children.forEach(checkWhereNode);
        break;
      case 'not':
        checkWhereNode(node.child);
        break;
      case 'compare':
      case 'like': {
        const right = node.kind === 'compare' ? node.right : node.pattern;
        if (right.kind === 'literal' && right.valueType === 'string' && right.value === '') {
          errors.push({ message: 'A filter is missing its value.' });
        }
        break;
      }
      case 'between':
        if (
          (node.low.kind === 'literal' && node.low.value === '') ||
          (node.high.kind === 'literal' && node.high.value === '')
        ) {
          errors.push({ message: 'BETWEEN needs both a low and a high value.' });
        }
        break;
      case 'in':
        if (!node.list.length) errors.push({ message: 'IN needs at least one value.' });
        break;
      default:
        break;
    }
    walkExpr(node, n => {
      if (n.kind === 'field' && !fieldNames.includes(n.name)) {
        errors.push({ message: `Filter field "${n.name}" is not in the data.` });
      }
    });
  }
  query.where.children.forEach(checkWhereNode);

  /* ---- JOINS (Phase 2 scaffold — validated for when JoinBuilder ships) ---- */
  query.joins.forEach(j => {
    if (!j.rightTable) errors.push({ message: 'A join is missing its right-hand table.' });
    if (!j.leftKey || !j.rightKey) errors.push({ message: 'A join is missing its ON keys.' });
  });

  // de-duplicate identical messages
  const seen = new Set<string>();
  const unique = errors.filter(e => (seen.has(e.message) ? false : (seen.add(e.message), true)));

  return { ok: unique.length === 0, errors: unique };
}
