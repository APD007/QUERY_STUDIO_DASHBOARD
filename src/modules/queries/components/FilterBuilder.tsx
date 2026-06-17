import type { LogicalNode } from '@/types/expr';
import type { FieldSchema } from '../schema';
import GroupView from './filter/GroupView';

export default function FilterBuilder({ where, schema }: { where: LogicalNode; schema: FieldSchema[] }) {
  return <GroupView group={where} schema={schema} isRoot />;
}
