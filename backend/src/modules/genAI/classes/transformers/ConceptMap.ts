import { ID } from '#root/shared/index.js';

/**
 * Published (student-facing) concept map — the approved map of one GenAI job
 * with every node's segment anchor resolved to the video item that segment
 * became at UPLOAD_CONTENT. Lives in its own `conceptmaps` collection; no
 * existing course/item schema is touched.
 */
export class ConceptMapNode {
	id: string;
	label: string;
	description?: string;
	/** Segment end-boundary the concept was anchored to during generation. */
	segmentEnd: number;
	/** The Video item created from that segment. */
	videoItemId?: string;
	/**
	 * The Quiz item created from that segment (absent when the segment got no
	 * questions, and on maps published before the mastery overlay existed).
	 */
	quizItemId?: string;
	/** Seconds into that video item where the concept is first explained. */
	offsetSeconds: number;
}

export class ConceptMapEdge {
	/** Prerequisite: `from` must be understood before `to`. */
	from: string;
	to: string;
	/** Novak-style linking phrase, read as "<from> <label> <to>". */
	label?: string;
}

export class ConceptMap {
	_id?: ID;
	jobId: string;
	courseId: string;
	versionId: string;
	moduleId?: string;
	sectionId?: string;
	nodes: ConceptMapNode[];
	edges: ConceptMapEdge[];
	/** True when the map came from the deterministic no-LLM fallback. */
	fallback?: boolean;
	modelUsed?: string;
	createdAt: Date;
}
