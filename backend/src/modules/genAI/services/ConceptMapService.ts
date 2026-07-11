import { injectable } from 'inversify';
import { Anthropic } from '@anthropic-ai/sdk';
import JSON5 from 'json5';
import axios from 'axios';
import { SocksProxyAgent } from 'socks-proxy-agent';
import { aiConfig } from '#root/config/ai.js';
import { appConfig } from '#root/config/app.js';
import {
  ConceptMapEdgeData,
  ConceptMapNodeData,
  ConceptMapParameters,
  conceptMapData,
  TaskStatus,
} from '../classes/transformers/GenAI.js';

/** Hard cap on nodes regardless of requested maxConcepts. */
const NODE_HARD_CAP = 25;
const DEFAULT_MAX_CONCEPTS = 20;

export interface TranscriptChunk {
  text: string;
  /** [startSeconds, endSeconds] */
  timestamp: Array<number>;
}

/**
 * Generates the concept map for a job: an LLM extraction when Anthropic
 * credentials are configured, otherwise a deterministic fallback derived from
 * segment boundaries. This task is backend-executed (like UPLOAD_CONTENT) —
 * it never goes through the external AI server / webhook path, and it is
 * never invoked from any student-facing request.
 */
@injectable()
export class ConceptMapService {
  async fetchTranscriptChunks(fileUrl: string): Promise<TranscriptChunk[]> {
    const agent =
      appConfig.isProduction || appConfig.isStaging
        ? new SocksProxyAgent(aiConfig.proxyAddress)
        : undefined;
    const response = await axios.get(fileUrl, {
      httpAgent: agent,
      httpsAgent: agent,
    });
    const chunks = response.data?.chunks;
    if (!Array.isArray(chunks) || chunks.length === 0) {
      throw new Error(`Transcript at ${fileUrl} has no chunks`);
    }
    return chunks;
  }

  /**
   * Produce the map. Generation problems (bad LLM output after retry, empty
   * transcript) are reported as a FAILED conceptMapData, not thrown — the
   * pipeline stores the failure and the teacher can rerun.
   */
  async generate(
    chunks: TranscriptChunk[],
    segmentMap: Array<number>,
    parameters?: ConceptMapParameters,
  ): Promise<conceptMapData> {
    try {
      if (!Array.isArray(segmentMap) || segmentMap.length === 0) {
        throw new Error('No segment map available for concept mapping');
      }
      if (aiConfig.ANTHROPIC_CRED && aiConfig.ANTHROPIC_MODEL) {
        return await this.generateWithLlm(chunks, segmentMap, parameters);
      }
      return this.generateFallback(chunks, segmentMap);
    } catch (error: any) {
      return {
        status: TaskStatus.FAILED,
        error: error?.message || 'Concept map generation failed',
      };
    }
  }

  // ── LLM path ──────────────────────────────────────────────────────────────

  private async generateWithLlm(
    chunks: TranscriptChunk[],
    segmentMap: Array<number>,
    parameters?: ConceptMapParameters,
  ): Promise<conceptMapData> {
    const maxConcepts = Math.min(
      parameters?.maxConcepts ?? DEFAULT_MAX_CONCEPTS,
      NODE_HARD_CAP,
    );
    const anthropic = new Anthropic({ apiKey: aiConfig.ANTHROPIC_CRED! });
    const basePrompt = this.buildPrompt(chunks, maxConcepts, parameters?.promptHint);

    let lastErrors: string[] = [];
    for (let attempt = 0; attempt < 2; attempt++) {
      const prompt =
        attempt === 0
          ? basePrompt
          : `${basePrompt}\n\nYour previous answer was invalid for these reasons, fix them:\n- ${lastErrors.join('\n- ')}`;

      const response = await anthropic.messages.create({
        model: aiConfig.ANTHROPIC_MODEL!,
        max_tokens: 4000,
        temperature: 0.0,
        messages: [{ role: 'user', content: [{ type: 'text', text: prompt }] }],
      });
      const rawText =
        response.content?.map(c => ('text' in c ? c.text : '')).join('') ?? '';

      const result = this.parseAndValidateLlmOutput(
        rawText,
        chunks,
        segmentMap,
        maxConcepts,
      );
      if (result.errors.length === 0) {
        return {
          status: TaskStatus.COMPLETED,
          nodes: result.nodes,
          edges: result.edges,
          modelUsed: aiConfig.ANTHROPIC_MODEL!,
          fallback: false,
        };
      }
      lastErrors = result.errors;
    }
    throw new Error(
      `LLM concept map invalid after retry: ${lastErrors.join('; ')}`,
    );
  }

  private buildPrompt(
    chunks: TranscriptChunk[],
    maxConcepts: number,
    promptHint?: string,
  ): string {
    const numberedTranscript = chunks
      .map(
        (c, i) =>
          `[${i}] (${Math.round(c.timestamp?.[0] ?? 0)}s-${Math.round(c.timestamp?.[1] ?? 0)}s) ${c.text}`,
      )
      .join('\n');
    return `You are building a prerequisite concept map from a lecture transcript.

Extract the key teachable concepts and the prerequisite relations between them.

Rules:
- At most ${maxConcepts} concepts. Fewer, well-chosen concepts beat many shallow ones.
- Every concept must reference the transcript chunk index where it is first properly explained ("chunkIndex", from the numbered transcript below).
- Prerequisite edges mean: "from" must be understood before "to". The graph must be acyclic.
- Do not force a linear chain; only add an edge when one concept genuinely builds on another.
- "description" is one plain sentence a student can read on hover.
${promptHint ? `- Additional guidance: ${promptHint}` : ''}
Return ONLY this JSON object, no other text:
{"concepts":[{"id":"c1","label":"...","description":"...","chunkIndex":0}],"prerequisites":[{"from":"c1","to":"c2"}]}

TRANSCRIPT:
${numberedTranscript}`;
  }

  /**
   * Parse raw LLM text and validate the graph. Returns nodes/edges plus a
   * list of validation errors (empty list = valid). Public for tests.
   */
  parseAndValidateLlmOutput(
    rawText: string,
    chunks: TranscriptChunk[],
    segmentMap: Array<number>,
    maxConcepts: number,
  ): { nodes: ConceptMapNodeData[]; edges: ConceptMapEdgeData[]; errors: string[] } {
    let parsed: any;
    try {
      const cleaned = rawText
        .replace(/```json|```/gi, '')
        .replace(/,\s*([}\]])/g, '$1')
        .trim();
      parsed = JSON5.parse(cleaned);
    } catch {
      return { nodes: [], edges: [], errors: ['Output was not parseable JSON'] };
    }

    const rawConcepts = Array.isArray(parsed?.concepts) ? parsed.concepts : [];
    const rawEdges = Array.isArray(parsed?.prerequisites)
      ? parsed.prerequisites
      : [];

    const errors: string[] = [];
    const nodes: ConceptMapNodeData[] = [];
    for (const c of rawConcepts) {
      const chunkIndex = Number(c?.chunkIndex);
      if (
        !Number.isInteger(chunkIndex) ||
        chunkIndex < 0 ||
        chunkIndex >= chunks.length
      ) {
        errors.push(`Concept "${c?.id}" has invalid chunkIndex ${c?.chunkIndex}`);
        continue;
      }
      if (!c?.id || typeof c.id !== 'string') {
        errors.push('A concept is missing a string id');
        continue;
      }
      if (!c?.label || typeof c.label !== 'string' || !c.label.trim()) {
        errors.push(`Concept "${c.id}" is missing a label`);
        continue;
      }
      nodes.push({
        id: c.id,
        label: String(c.label).trim(),
        description:
          typeof c.description === 'string' ? c.description.trim() : undefined,
        segmentEnd: this.segmentForChunk(chunks[chunkIndex], segmentMap),
        anchorSeconds: chunks[chunkIndex].timestamp?.[0] ?? 0,
      });
    }
    const edges: ConceptMapEdgeData[] = rawEdges
      .filter((e: any) => typeof e?.from === 'string' && typeof e?.to === 'string')
      .map((e: any) => ({ from: e.from, to: e.to }));

    errors.push(...this.validateGraph(nodes, edges, segmentMap, maxConcepts));
    return { nodes, edges, errors };
  }

  /**
   * Structural validation shared by both generation paths. Returns a list of
   * problems; empty list means the graph is a valid, anchored DAG. Public for
   * tests.
   */
  validateGraph(
    nodes: ConceptMapNodeData[],
    edges: ConceptMapEdgeData[],
    segmentMap: Array<number>,
    maxNodes: number = NODE_HARD_CAP,
  ): string[] {
    const errors: string[] = [];
    if (nodes.length === 0) {
      errors.push('Map has no concepts');
    }
    if (nodes.length > Math.min(maxNodes, NODE_HARD_CAP)) {
      errors.push(
        `Map has ${nodes.length} concepts, above the cap of ${Math.min(maxNodes, NODE_HARD_CAP)}`,
      );
    }
    const ids = new Set<string>();
    for (const n of nodes) {
      if (ids.has(n.id)) errors.push(`Duplicate concept id "${n.id}"`);
      ids.add(n.id);
      if (!segmentMap.includes(n.segmentEnd)) {
        errors.push(
          `Concept "${n.id}" anchors to unknown segment ${n.segmentEnd}`,
        );
      }
    }
    for (const e of edges) {
      if (!ids.has(e.from) || !ids.has(e.to)) {
        errors.push(`Edge ${e.from}->${e.to} references a missing concept`);
      } else if (e.from === e.to) {
        errors.push(`Edge ${e.from}->${e.to} is a self-loop`);
      }
    }
    if (errors.length === 0 && this.hasCycle(nodes, edges)) {
      errors.push('Prerequisite graph contains a cycle');
    }
    return errors;
  }

  private hasCycle(
    nodes: ConceptMapNodeData[],
    edges: ConceptMapEdgeData[],
  ): boolean {
    // Kahn's algorithm: if topological sort can't consume every node, there
    // is a cycle.
    const inDegree = new Map<string, number>(nodes.map(n => [n.id, 0]));
    const outgoing = new Map<string, string[]>(nodes.map(n => [n.id, []]));
    for (const e of edges) {
      inDegree.set(e.to, (inDegree.get(e.to) ?? 0) + 1);
      outgoing.get(e.from)?.push(e.to);
    }
    const queue = nodes.filter(n => inDegree.get(n.id) === 0).map(n => n.id);
    let visited = 0;
    while (queue.length > 0) {
      const id = queue.shift()!;
      visited++;
      for (const next of outgoing.get(id) ?? []) {
        const deg = (inDegree.get(next) ?? 0) - 1;
        inDegree.set(next, deg);
        if (deg === 0) queue.push(next);
      }
    }
    return visited !== nodes.length;
  }

  // ── Deterministic fallback (no key: local dev, offline demos) ─────────────

  /**
   * One concept per segment, labeled from that segment's transcript text,
   * with sequential prerequisite edges plus a skip-link every third concept
   * so the layout is a DAG rather than a bare chain. Deterministic: same
   * input always yields the same map. Public for tests.
   */
  generateFallback(
    chunks: TranscriptChunk[],
    segmentMap: Array<number>,
  ): conceptMapData {
    const nodes: ConceptMapNodeData[] = segmentMap.map((segmentEnd, i) => {
      const segmentStart = i === 0 ? 0 : segmentMap[i - 1];
      const chunk =
        chunks.find(c => {
          const mid = ((c.timestamp?.[0] ?? 0) + (c.timestamp?.[1] ?? 0)) / 2;
          return mid > segmentStart && mid <= segmentEnd;
        }) ?? chunks[Math.min(i, chunks.length - 1)];
      return {
        id: `seg-${segmentEnd}`,
        label: this.labelFromText(chunk?.text ?? `Segment ${i + 1}`),
        description: this.sentenceFromText(chunk?.text ?? ''),
        segmentEnd,
        anchorSeconds: chunk?.timestamp?.[0] ?? segmentStart,
      };
    });

    const edges: ConceptMapEdgeData[] = [];
    for (let i = 0; i < nodes.length - 1; i++) {
      edges.push({ from: nodes[i].id, to: nodes[i + 1].id });
      if (i % 3 === 0 && i + 2 < nodes.length) {
        edges.push({ from: nodes[i].id, to: nodes[i + 2].id });
      }
    }

    const errors = this.validateGraph(nodes, edges, segmentMap);
    if (errors.length > 0) {
      throw new Error(`Fallback concept map invalid: ${errors.join('; ')}`);
    }
    return { status: TaskStatus.COMPLETED, nodes, edges, fallback: true };
  }

  private labelFromText(text: string): string {
    const words = text.replace(/\s+/g, ' ').trim().split(' ').slice(0, 5);
    const label = words.join(' ').replace(/[.,;:!?]+$/, '');
    return label || 'Concept';
  }

  private sentenceFromText(text: string): string | undefined {
    const trimmed = text.replace(/\s+/g, ' ').trim();
    if (!trimmed) return undefined;
    const period = trimmed.indexOf('. ');
    const sentence = period > 0 ? trimmed.slice(0, period + 1) : trimmed;
    return sentence.length > 160 ? `${sentence.slice(0, 157)}...` : sentence;
  }

  /** Map a chunk to the segment boundary that contains its midpoint. */
  private segmentForChunk(
    chunk: TranscriptChunk,
    segmentMap: Array<number>,
  ): number {
    const mid = ((chunk.timestamp?.[0] ?? 0) + (chunk.timestamp?.[1] ?? 0)) / 2;
    for (const boundary of segmentMap) {
      if (mid <= boundary) return boundary;
    }
    return segmentMap[segmentMap.length - 1];
  }
}
