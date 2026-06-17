import { describe, it, expect } from 'vitest';
import { removeNode, replaceNode, wrapInNot, unwrapNot, wrapInGroup, addToGroup, setGroupOp, findNodeById } from './exprTree';
import { field, literal, compare, logicalGroup } from './exprBuilders';
import type { LogicalNode, NotNode } from '@/types/expr';

describe('exprTree', () => {
  it('removeNode deletes a condition by id, leaving siblings intact', () => {
    const a = compare('=', field('a'), literal('number', 1));
    const b = compare('=', field('b'), literal('number', 2));
    const root = logicalGroup('AND', [a, b]);

    const result = removeNode(root, a.id);
    expect(result.children).toHaveLength(1);
    expect(result.children[0]).toBe(b);
  });

  it('removeNode on the last remaining child empties the group rather than erroring', () => {
    const a = compare('=', field('a'), literal('number', 1));
    const root = logicalGroup('AND', [a]);
    const result = removeNode(root, a.id);
    expect(result.children).toHaveLength(0);
  });

  it('replaceNode swaps one node for another by id', () => {
    const a = compare('=', field('a'), literal('number', 1));
    const root = logicalGroup('AND', [a]);
    const replacement = compare('!=', field('a'), literal('number', 9));

    const result = replaceNode(root, a.id, replacement);
    expect(result.children[0]).toBe(replacement);
  });

  it('wrapInNot and unwrapNot are inverses', () => {
    const a = compare('=', field('a'), literal('number', 1));
    const root = logicalGroup('AND', [a]);

    const wrapped = wrapInNot(root, a.id);
    expect(wrapped.children[0].kind).toBe('not');

    const notId = (wrapped.children[0] as NotNode).id;
    const unwrapped = unwrapNot(wrapped, notId);
    expect(unwrapped.children[0].kind).toBe('compare');
  });

  it('wrapInGroup nests a node inside a new logical group', () => {
    const a = compare('=', field('a'), literal('number', 1));
    const root = logicalGroup('AND', [a]);

    const result = wrapInGroup(root, a.id, 'OR');
    expect(result.children[0].kind).toBe('logical');
    expect((result.children[0] as LogicalNode).op).toBe('OR');
  });

  it('addToGroup appends a new condition to the group matching groupId', () => {
    const root = logicalGroup('AND', []);
    const b = compare('=', field('b'), literal('number', 2));

    const result = addToGroup(root, root.id, b);
    expect(result.children).toContain(b);
  });

  it('setGroupOp flips AND/OR on the targeted group only', () => {
    const inner = logicalGroup('AND', []);
    const root = logicalGroup('AND', [inner]);

    const result = setGroupOp(root, inner.id, 'OR');
    expect(result.op).toBe('AND'); // root untouched
    expect((result.children[0] as LogicalNode).op).toBe('OR');
  });

  it('findNodeById locates a deeply nested node', () => {
    const target = compare('=', field('deep'), literal('number', 1));
    const root = logicalGroup('AND', [logicalGroup('OR', [target])]);

    expect(findNodeById(root, target.id)).toBe(target);
    expect(findNodeById(root, 'does-not-exist')).toBeNull();
  });
});
