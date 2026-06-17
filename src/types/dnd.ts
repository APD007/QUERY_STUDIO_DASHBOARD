export type OperatorCategory =
  | 'arithmetic' | 'comparison' | 'logical' | 'aggregation'
  | 'conditional' | 'sqlHelper' | 'sorting' | 'join' | 'paren';

export type DragData =
  | { kind: 'field'; fieldName: string }
  | { kind: 'operator'; category: OperatorCategory; op: string };

export type DropData =
  | { zone: 'select' }
  | { zone: 'select-item'; itemId: string }
  | { zone: 'groupby' }
  | { zone: 'cond-field'; condId: string }
  | { zone: 'cond-op'; condId: string }
  | { zone: 'cond-wrap'; condId: string }
  | { zone: 'group-op'; groupId: string }
  | { zone: 'group-add'; groupId: string }
  | { zone: 'calc-fn' };
