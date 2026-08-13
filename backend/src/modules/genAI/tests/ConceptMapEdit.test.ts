import 'reflect-metadata';
import { describe, expect, it } from 'vitest';
import { ConceptMapService } from '../services/ConceptMapService.js';

// Teacher approval edit: removing one node drops its incident edges and
// re-bridges parent→child prerequisite chains.

const service = new ConceptMapService();
const node = (id: string) => ({ id, label: id, segmentEnd: 60 });

describe('ConceptMapService.removeNode', () => {
  it('bridges parents to children of the removed node', () => {
    // a → b → c, plus d → b: removing b must yield a→c and d→c.
    const result = service.removeNode(
      [node('a'), node('b'), node('c'), node('d')],
      [
        { from: 'a', to: 'b' },
        { from: 'b', to: 'c' },
        { from: 'd', to: 'b' },
      ],
      'b',
    );
    expect(result.nodes.map(n => n.id)).toEqual(['a', 'c', 'd']);
    expect(result.edges).toEqual(
      expect.arrayContaining([
        { from: 'a', to: 'c' },
        { from: 'd', to: 'c' },
      ]),
    );
    expect(result.edges).toHaveLength(2);
  });

  it('does not duplicate an edge that already exists', () => {
    // a → b → c AND a → c directly: bridging must not add a second a→c.
    const result = service.removeNode(
      [node('a'), node('b'), node('c')],
      [
        { from: 'a', to: 'b' },
        { from: 'b', to: 'c' },
        { from: 'a', to: 'c' },
      ],
      'b',
    );
    expect(result.edges).toEqual([{ from: 'a', to: 'c' }]);
  });

  it('removing a leaf just drops its incident edges', () => {
    const result = service.removeNode(
      [node('a'), node('b')],
      [{ from: 'a', to: 'b' }],
      'b',
    );
    expect(result.nodes.map(n => n.id)).toEqual(['a']);
    expect(result.edges).toEqual([]);
  });

  it('keeps the graph a DAG after bridging (validateGraph passes)', () => {
    // Diamond: a→b, a→c, b→d, c→d. Remove c.
    const nodes = [node('a'), node('b'), node('c'), node('d')];
    const edges = [
      { from: 'a', to: 'b' },
      { from: 'a', to: 'c' },
      { from: 'b', to: 'd' },
      { from: 'c', to: 'd' },
    ];
    const result = service.removeNode(nodes, edges, 'c');
    const errors = service.validateGraph(result.nodes, result.edges, [60]);
    expect(errors).toEqual([]);
  });

  it('rejects unknown node ids and removing the last concept', () => {
    expect(() =>
      service.removeNode([node('a'), node('b')], [], 'ghost'),
    ).toThrow(/does not exist/);
    expect(() => service.removeNode([node('a')], [], 'a')).toThrow(
      /last remaining/,
    );
  });
});
