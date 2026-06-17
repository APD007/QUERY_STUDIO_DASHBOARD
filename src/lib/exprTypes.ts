import type { ExprNode, FieldType } from '@/types/expr';
import type { FieldSchema } from '@/modules/queries/schema';

/** Infers the result FieldType of an expression, used to label result columns. */
export function exprResultType(expr: ExprNode, schema: FieldSchema[]): FieldType {
  switch (expr.kind) {
    case 'field':
      return schema.find(s => s.name === expr.name)?.type ?? 'text';
    case 'literal':
      if (expr.valueType === 'number') return 'number';
      if (expr.valueType === 'boolean') return 'bool';
      if (expr.valueType === 'date') return 'date';
      return 'text';
    case 'agg':
    case 'arith':
      return 'number';
    case 'compare':
    case 'between':
    case 'in':
    case 'like':
    case 'logical':
    case 'not':
    case 'subqueryOp':
      return 'bool';
    case 'fn':
      if (expr.fn === 'CAST') {
        const t = (expr.castType ?? '').toUpperCase();
        if (t.includes('INT') || t.includes('FLOAT') || t.includes('NUMERIC') || t.includes('DECIMAL')) return 'number';
        if (t.includes('DATE')) return 'date';
        return 'text';
      }
      return 'number'; // ROUND / FLOOR
    case 'alias':
      return exprResultType(expr.expr, schema);
    case 'case':
      return expr.branches.length ? exprResultType(expr.branches[0].then, schema) : 'text';
    case 'fnExt':
      return 'text';
    default:
      return 'text';
  }
}
