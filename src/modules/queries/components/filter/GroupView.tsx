import { useDroppable } from '@dnd-kit/core';
import { Plus, Trash2, X } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import type { ExprNode, LogicalNode } from '@/types/expr';
import type { FieldSchema } from '../../schema';
import { compare, field } from '@/lib/exprBuilders';
import { useQueryDraftStore } from '@/store/queryDraftStore';
import ConditionRow from './ConditionRow';
import { C } from '@/palette';

interface GroupViewProps {
  group: LogicalNode;
  schema: FieldSchema[];
  isRoot?: boolean;
  onRemoveSelf?: () => void;
}

function NodeView({ node, schema }: { node: ExprNode; schema: FieldSchema[] }) {
  const replaceConditionNode = useQueryDraftStore(s => s.replaceConditionNode);
  const removeConditionNode  = useQueryDraftStore(s => s.removeConditionNode);
  const unwrapNodeFromNot    = useQueryDraftStore(s => s.unwrapNodeFromNot);
  // Hooks must run unconditionally regardless of node.kind; only the 'not' branch below
  // actually attaches wrapDrop's ref/state, so the id only needs to be unique when it does.
  const dropId = 'id' in node ? node.id : 'n/a';
  const wrapDrop = useDroppable({ id: `cond-wrap:${dropId}`, data: { zone: 'cond-wrap', condId: dropId } });

  if (node.kind === 'compare' || node.kind === 'between' || node.kind === 'in' || node.kind === 'like') {
    return (
      <ConditionRow
        node={node}
        schema={schema}
        onReplace={n => replaceConditionNode(node.id, n)}
        onRemove={() => removeConditionNode(node.id)}
      />
    );
  }

  if (node.kind === 'not') {
    return (
      <div
        ref={wrapDrop.setNodeRef}
        style={{ border: `1px dashed ${C.red}`, borderRadius: 10 }}
        className={cn('p-2 flex items-start gap-2', wrapDrop.isOver && 'bg-[#FBEAEA]')}
      >
        <span style={{ background: C.red, color: '#fff' }} className="text-[10px] font-bold rounded px-1.5 py-0.5 mt-1">
          NOT
        </span>
        <div className="flex-1">
          <NodeView node={node.child} schema={schema} />
        </div>
        <button onClick={() => unwrapNodeFromNot(node.id)} type="button" title="Remove NOT">
          <X size={13} style={{ color: C.mut }} />
        </button>
      </div>
    );
  }

  if (node.kind === 'logical') {
    return <GroupView group={node} schema={schema} />;
  }

  return (
    <div style={{ color: C.mut }} className="text-xs italic">
      Unsupported condition type ({node.kind}) — coming in a later phase.
    </div>
  );
}

export default function GroupView({ group, schema, isRoot = false, onRemoveSelf }: GroupViewProps) {
  const addCondition = useQueryDraftStore(s => s.addCondition);
  const addGroup      = useQueryDraftStore(s => s.addGroup);
  const setGroupOp    = useQueryDraftStore(s => s.setGroupOp);

  const opDrop  = useDroppable({ id: `group-op:${group.id}`,  data: { zone: 'group-op',  groupId: group.id } });
  const wrapDrop = useDroppable({ id: `cond-wrap:${group.id}`, data: { zone: 'cond-wrap', condId: group.id } });
  const addDrop = useDroppable({ id: `group-add:${group.id}`, data: { zone: 'group-add', groupId: group.id } });

  const body = (
    <div
      style={!isRoot ? { border: `1px solid ${C.line}`, borderRadius: 10, background: '#FAFCFE' } : undefined}
      className={!isRoot ? 'p-2.5' : ''}
    >
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-2">
          <button
            ref={opDrop.setNodeRef}
            type="button"
            onClick={() => setGroupOp(group.id, group.op === 'AND' ? 'OR' : 'AND')}
            style={{
              background: group.op === 'AND' ? C.skyl : '#FDF1E0',
              color: group.op === 'AND' ? C.blue : C.amber,
              boxShadow: opDrop.isOver ? `0 0 0 2px ${C.blue}55` : undefined,
            }}
            className="text-xs font-bold rounded-full px-2.5 py-1"
            title="Click to toggle AND/OR, or drop AND/OR here"
          >
            {group.op}
          </button>
          <span style={{ color: C.mut }} className="text-xs">
            {group.children.length === 0 ? 'no conditions yet' : `${group.children.length} item(s)`}
          </span>
        </div>
        {!isRoot && onRemoveSelf && (
          <button onClick={onRemoveSelf} type="button" title="Remove this group">
            <Trash2 size={13} style={{ color: C.mut }} />
          </button>
        )}
      </div>

      <div
        ref={addDrop.setNodeRef}
        className={cn('space-y-2 rounded-lg', addDrop.isOver && 'bg-[#EAF3FB] p-1')}
      >
        {group.children.map((child, i) => (
          <NodeView key={('id' in child ? child.id : undefined) ?? `idx-${i}`} node={child} schema={schema} />
        ))}
      </div>

      <div className="flex gap-2 mt-2">
        <Button
          variant="ghost" size="sm"
          onClick={() => schema[0] && addCondition(group.id, compare('=', field(schema[0].name), { kind: 'literal', valueType: 'string', value: '' }))}
        >
          <Plus size={12} /> Condition
        </Button>
        <Button variant="ghost" size="sm" onClick={() => addGroup(group.id, 'AND')}>
          <Plus size={12} /> Group
        </Button>
      </div>
    </div>
  );

  if (isRoot) {
    return <div ref={wrapDrop.setNodeRef}>{body}</div>;
  }

  return (
    <div ref={wrapDrop.setNodeRef} className={cn(wrapDrop.isOver && 'ring-2 ring-[#2E75B6]/40 rounded-lg')}>
      {body}
    </div>
  );
}
