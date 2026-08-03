import { inject, injectable } from 'inversify';
import { LeaderboardEntry } from '../types.js';
import { MythologyRepository } from '../repositories/providers/mongodb/MythologyRepository.js';
import { MYTHOLOGY_TYPES } from '../types.js';

@injectable()
export class MythologyService {
  constructor(
    @inject(MYTHOLOGY_TYPES.MythologyRepository)
    private readonly repo: MythologyRepository,
  ) {}

  /**
   * Helper to invoke Cohere AI for prompt completions
   */
  public async callCohere(prompt: string, maxTokens = 500): Promise<string> {
    const apiKey = process.env.COHERE_API_KEY;
    if (!apiKey || apiKey.length < 15) {
      throw new Error('COHERE_API_KEY is not configured on the server.');
    }

    const response = await fetch('https://api.cohere.com/v1/chat', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
        'accept': 'application/json',
      },
      body: JSON.stringify({
        message: prompt,
        model: 'command-r-plus-08-2024',
        temperature: 0.7,
        max_tokens: maxTokens,
      }),
    });

    if (!response.ok) {
      const errText = await response.text();
      console.error(`[MythologyService] Cohere Error [${response.status}]:`, errText);
      throw new Error(`Cohere API returned status ${response.status}`);
    }

    const data = (await response.json()) as { text?: string };
    return data.text || '';
  }

  /**
   * Betaal AI Chatbot interaction
   */
  public async chatWithBetaal(message: string, history?: Array<{ role: string; text: string }>): Promise<string> {
    const systemPrompt = `You are Betaal, the wise and witty supernatural entity from Indian mythology (Vikram & Betaal tales), who has mastered modern software engineering through centuries of observation.

The ViBe curriculum covers Git & GitHub, TypeScript, React (TSX), Express.js, and MongoDB.

RULES:
1. Give REAL, ACCURATE, TECHNICALLY CORRECT answers.
2. Keep your Betaal character voice — wise, slightly dramatic, occasionally humorous, but ALWAYS educational.
3. Include code examples when relevant (use markdown code blocks).
4. Keep answers concise but complete (3-8 sentences + code if needed).
5. Speak as: "Betaal speaks..." or use first person.`;

    let historyStr = '';
    if (history && Array.isArray(history)) {
      history.slice(-6).forEach(h => {
        if (h && h.text && h.role) {
          historyStr += `\n${h.role.toUpperCase()}: ${h.text.slice(0, 400)}`;
        }
      });
    }

    const fullPrompt = `${systemPrompt}\n\nChat History:${historyStr}\n\nUSER: ${message.slice(0, 1000)}\n\nBETAAL:`;
    const reply = await this.callCohere(fullPrompt, 500);
    return reply || 'Betaal contemplates in silence. Rephrase your question, King Vikram!';
  }

  /**
   * Generates a technical Betaal riddle based on lesson content
   */
  public async generateRiddle(lessonTitle: string, category: string, content: string): Promise<any> {
    const systemPrompt = `You are the legendary creature Betaal from Indian folklore.
Challenge King Vikramaditya with a complex technical riddle based on the lesson.
Output MUST be valid JSON (do NOT wrap in markdown \`\`\` blocks). Schema:
{ "id": "uuid", "title": "...", "tale": "...", "question": "...", "options": [ { "id": "opt-1", "text": "...", "justification": "..." } ], "correctOptionId": "opt-1", "explanation": "...", "karmaReward": 30 }`;

    const userPrompt = `${systemPrompt}\n\nCourse Category: ${category.slice(0, 100)}\nLesson Title: ${lessonTitle.slice(0, 200)}\nLesson Content:\n${content.slice(0, 3000)}\n\nFormulate the riddle JSON now:`;

    let resText = await this.callCohere(userPrompt, 800);
    if (resText.startsWith('```json')) {
      resText = resText.replace(/^```json\n/, '').replace(/\n```$/, '');
    }
    return JSON.parse(resText.trim());
  }

  /**
   * Updates or inserts a student entry into MongoDB leaderboard.
   */
  public async updateLeaderboard(
    entry: Omit<LeaderboardEntry, 'id' | 'lastActive'>,
  ): Promise<LeaderboardEntry[]> {
    const today = new Date().toISOString().split('T')[0];

    await this.repo.upsertEntry({
      name: entry.name,
      avatar: entry.avatar || '🎓',
      streak: entry.streak,
      karma: entry.karma,
      department: entry.department || 'General Engineering',
      track: entry.track || 'vibe-github-tutorial',
      lastActive: today,
    });

    return this.repo.getTopEntries(50);
  }

  /**
   * Returns current global leaderboard from MongoDB
   */
  public async getLeaderboard(): Promise<LeaderboardEntry[]> {
    return this.repo.getTopEntries(50);
  }

  /**
   * Processes PouchDB / IndexedDB offline sync and credits earned karma
   */
  public syncOfflineMetrics(currentStreak: number, pouchDocs: any[] = [], indexedMetrics: any[] = []): any {
    const uniqueDates = new Set<string>();
    if (Array.isArray(pouchDocs)) {
      pouchDocs.forEach(d => {
        if (d && d.timestamp && typeof d.timestamp === 'string') {
          uniqueDates.add(d.timestamp.split('T')[0]);
        }
      });
    }
    if (Array.isArray(indexedMetrics)) {
      indexedMetrics.forEach(m => {
        if (m && m.date && typeof m.date === 'string') {
          uniqueDates.add(m.date);
        }
      });
    }

    const bonusKarma = uniqueDates.size * 15;
    const updatedStreak = currentStreak + (uniqueDates.size > 0 ? 1 : 0);

    return {
      success: true,
      syncedCount: pouchDocs.length + indexedMetrics.length,
      updatedStreak,
      karmaGained: bonusKarma,
      syncedDates: Array.from(uniqueDates),
    };
  }
}
