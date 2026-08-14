import { injectable, inject } from 'inversify';
import { JsonController, Post, Get, Body } from 'routing-controllers';
import { OpenAPI } from 'routing-controllers-openapi';
import { MYTHOLOGY_TYPES } from '../types.js';
import { MythologyService } from '../services/MythologyService.js';
import {
  ChatBody,
  SyncScoreBody,
  RiddleBody,
  PouchSyncBody,
} from '../classes/validators/MythologyValidators.js';

@OpenAPI({
  tags: ['Mythology'],
  description: 'Operations for the Vikram-Betaal Mythology Streak Student Experience',
})
@injectable()
@JsonController('/mythology')
export class MythologyController {
  constructor(
    @inject(MYTHOLOGY_TYPES.MythologyService)
    private readonly mythologyService: MythologyService
  ) {}

  @OpenAPI({
    summary: 'Betaal AI Chatbot Endpoint (Cohere AI integration)',
  })
  @Post('/chat')
  async chat(@Body() body: ChatBody) {
    try {
      const reply = await this.mythologyService.chatWithBetaal(
        body.message,
        body.conversationHistory
      );
      return { reply, mode: 'online' };
    } catch (err: any) {
      console.error('[MythologyController/chat] Error:', err.message);
      return {
        reply: 'Betaal meditates in silence. The sacred scroll is temporarily unavailable.',
        mode: 'fallback',
      };
    }
  }

  @OpenAPI({
    summary: 'Generate technical Betaal Riddle based on lesson content',
  })
  @Post('/riddle')
  async generateRiddle(@Body() body: RiddleBody) {
    try {
      const riddle = await this.mythologyService.generateRiddle(
        body.lessonTitle,
        body.category,
        body.content
      );
      return riddle;
    } catch (err: any) {
      console.error('[MythologyController/riddle] Error:', err.message);
      return {
        id: 'fallback-riddle',
        title: 'The Riddle of the Sovereign Scroll',
        tale: "Betaal clings to Vikram's back: 'King, where should secret API keys be stored?'",
        question: 'Where should secret API keys be stored in production?',
        options: [
          { id: 'opt-1', text: 'Hardcoded in client JS bundle', justification: 'Vulnerable to inspection and theft.' },
          { id: 'opt-2', text: 'Server-side environment variables', justification: 'Correct! Keeps secrets safe on the server.' },
          { id: 'opt-3', text: 'Saved in browser localStorage', justification: 'Accessible via XSS attacks.' },
        ],
        correctOptionId: 'opt-2',
        explanation: 'The wise king guards secrets in the server chamber, never in plain sight!',
        karmaReward: 30,
      };
    }
  }

  @OpenAPI({
    summary: 'Get live mythology leaderboard',
  })
  @Get('/leaderboard')
  async getLeaderboard() {
    const leaderboard = await this.mythologyService.getLeaderboard();
    return {
      leaderboard,
      timestamp: new Date().toISOString(),
    };
  }

  @OpenAPI({
    summary: 'Sync student streak and karma score to live leaderboard',
  })
  @Post('/sync-score')
  async syncScore(@Body() body: SyncScoreBody) {
    const updatedLeaderboard = await this.mythologyService.updateLeaderboard({
      name: body.name,
      avatar: body.avatar || '🎓',
      streak: body.streak,
      karma: body.karma,
      department: body.department,
      track: body.track,
    });
    return {
      success: true,
      message: `Score synced for ${body.name}`,
      leaderboard: updatedLeaderboard,
    };
  }

  @OpenAPI({
    summary: 'Synchronize PouchDB / IndexedDB offline study logs',
  })
  @Post('/pouch-sync')
  async syncPouchData(@Body() body: PouchSyncBody) {
    const result = this.mythologyService.syncOfflineMetrics(
      body.currentStreak,
      body.pouchDocs,
      body.indexedMetrics
    );
    return result;
  }
}
