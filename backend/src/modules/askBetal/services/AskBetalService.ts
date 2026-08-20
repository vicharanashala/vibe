import { injectable, inject } from 'inversify';
import { MongoDatabase } from '#shared/database/providers/mongo/MongoDatabase.js';
import { GLOBAL_TYPES } from '#root/types.js';
import { aiConfig } from '#root/config/ai.js';
import { Anthropic } from '@anthropic-ai/sdk';
import { ObjectId } from 'mongodb';
import { NotFoundError, BadRequestError } from 'routing-controllers';
import { AskQuestionDto } from '../validators/AskQuestionDto.js';

@injectable()
export class AskBetalService {
  private indexesEnsured = false;

  constructor(
    @inject(GLOBAL_TYPES.Database)
    private database: MongoDatabase,
  ) {}

  private async ensureIndexes(db: any) {
    if (this.indexesEnsured) return;
    const cacheColl = db.collection('askBetalResponseCache');
    const ledgerColl = db.collection('askBetalUsageLedger');

    if (typeof cacheColl.createIndex === 'function') {
      await cacheColl.createIndex({ videoId: 1, promptType: 1 });
      await cacheColl.createIndex({ expiresAt: 1 }, { expireAfterSeconds: 0 });
    }
    if (typeof ledgerColl.createIndex === 'function') {
      await ledgerColl.createIndex({ date: 1 }, { unique: true });
    }
    this.indexesEnsured = true;
  }

  public async askQuestion(userId: string, payload: AskQuestionDto): Promise<{ answer: string; replyOptions?: string[] }> {
    const db = await this.database.connect();
    await this.ensureIndexes(db);

    const todayStr = new Date().toISOString().split('T')[0];
    const dailyUsage = await db.collection('askBetalUsageLedger').findOne({ date: todayStr });
    if (dailyUsage && dailyUsage.tokensUsed >= aiConfig.ASK_BETAL_DAILY_TOKEN_CAP) {
      throw new BadRequestError('Ask Betal is temporarily unavailable due to daily limit restrictions. Please try again tomorrow.');
    }

    // 1. Fetch active course version
    const courseVersion = await db.collection('newCourseVersion').findOne({
      courseId: new ObjectId(payload.courseId),
      versionStatus: 'active',
      isDeleted: { $ne: true },
    });
    if (!courseVersion) {
      throw new NotFoundError('Active course version not found');
    }

    // 2. Select in-scope sections
    let itemsGroupIds: ObjectId[] = [];
    if (payload.moduleId) {
      const module = courseVersion.modules.find(
        (m: any) => m.moduleId?.toString() === payload.moduleId || m._id?.toString() === payload.moduleId
      );
      if (!module) {
        throw new NotFoundError(`Module with ID ${payload.moduleId} not found`);
      }

      if (payload.sectionId) {
        const section = module.sections.find(
          (s: any) => s.sectionId?.toString() === payload.sectionId || s._id?.toString() === payload.sectionId
        );
        if (!section) {
          throw new NotFoundError(`Section with ID ${payload.sectionId} not found`);
        }
        if (section.itemsGroupId) {
          itemsGroupIds.push(new ObjectId(section.itemsGroupId));
        }
      } else {
        module.sections.forEach((sec: any) => {
          if (sec.itemsGroupId) {
            itemsGroupIds.push(new ObjectId(sec.itemsGroupId));
          }
        });
      }
    } else {
      courseVersion.modules.forEach((mod: any) => {
        mod.sections.forEach((sec: any) => {
          if (sec.itemsGroupId) {
            itemsGroupIds.push(new ObjectId(sec.itemsGroupId));
          }
        });
      });
    }

    // 3. Retrieve itemsGroup items
    const videoIds: ObjectId[] = [];
    const quizIds: ObjectId[] = [];

    if (itemsGroupIds.length > 0) {
      const groups = await db
        .collection('itemsGroup')
        .find({ _id: { $in: itemsGroupIds } })
        .toArray();

      groups.forEach((g: any) => {
        if (g.items) {
          g.items.forEach((item: any) => {
            if (item.type === 'VIDEO' && item._id) {
              videoIds.push(new ObjectId(item._id));
            } else if (item.type === 'QUIZ' && item._id) {
              quizIds.push(new ObjectId(item._id));
            }
          });
        }
      });
    }

    // 4. Fetch Video Details
    let videosText = '';
    let currentVideoText = '';
    if (videoIds.length > 0) {
      const videos = await db
        .collection('videos')
        .find({ _id: { $in: videoIds }, isDeleted: { $ne: true } })
        .toArray();

      videos.forEach((vid: any) => {
        const text = `Video Title: ${vid.name}\nDescription: ${vid.description || 'No description available.'}\n\n`;
        const isCurrentVideo = 
          (payload.currentVideoTitle && vid.name?.toLowerCase() === payload.currentVideoTitle.toLowerCase()) ||
          (payload.currentVideoId && vid._id?.toString() === payload.currentVideoId);
        
        if (isCurrentVideo) {
          currentVideoText = `=== CURRENT PLAYING VIDEO ===\n${text}`;
        } else {
          videosText += text;
        }
      });
    }

    // 5. Fetch Quiz Questions & Check Gated Attempt Status
    let questionsText = '';
    let hasAttemptedExplanations = false;
    if (quizIds.length > 0) {
      const quizzes = await db
        .collection('quizzes')
        .find({ _id: { $in: quizIds }, isDeleted: { $ne: true } })
        .toArray();

      const bankIds: ObjectId[] = [];
      quizzes.forEach((q: any) => {
        if (q.details?.questionBankRefs) {
          q.details.questionBankRefs.forEach((ref: any) => {
            if (ref.bankId) {
              bankIds.push(new ObjectId(ref.bankId));
            }
          });
        }
      });

      if (bankIds.length > 0) {
        const banks = await db
          .collection('questionBanks')
          .find({ _id: { $in: bankIds }, isDeleted: { $ne: true } })
          .toArray();

        const questionIds: ObjectId[] = [];
        banks.forEach((b: any) => {
          if (b.questions) {
            b.questions.forEach((qId: any) => {
              questionIds.push(new ObjectId(qId));
            });
          }
        });

        if (questionIds.length > 0) {
          const questions = await db
            .collection('questions')
            .find({
              _id: { $in: questionIds },
              type: 'SELECT_ONE_IN_LOT',
              isDeleted: { $ne: true },
            })
            .toArray();

          for (const q of questions) {
            // Security Check: count quiz attempts by this user containing this question
            const attemptCount = await db.collection('quiz_attempts').countDocuments({
              userId: new ObjectId(userId),
              $or: [
                { 'questionDetails.questionId': q._id },
                { 'answers.questionId': q._id }
              ]
            });
            const hasAttempted = attemptCount > 0;

            if (hasAttempted) {
              hasAttemptedExplanations = true;
              questionsText += `Question: ${q.text}\n`;
              if (q.correctLotItem) {
                questionsText += `Correct Choice: ${q.correctLotItem.text}\n`;
                questionsText += `Correct Explanation: ${q.correctLotItem.explaination || ''}\n`;
              }
              if (q.incorrectLotItems) {
                questionsText += `Incorrect Choices & Explanations:\n`;
                q.incorrectLotItems.forEach((ic: any) => {
                  questionsText += `- Choice: ${ic.text} | Explanation: ${ic.explaination || ''}\n`;
                });
              }
              if (q.hint) {
                questionsText += `General Hint/Explanation: ${q.hint}\n`;
              }
            } else {
              questionsText += `Question: ${q.text}\n`;
              if (q.correctLotItem || q.incorrectLotItems) {
                const choices = [
                  ...(q.correctLotItem ? [q.correctLotItem.text] : []),
                  ...(q.incorrectLotItems ? q.incorrectLotItems.map((ic: any) => ic.text) : [])
                ];
                questionsText += `Choices: ${choices.join(', ')}\n`;
              }
              questionsText += `[STATUS: LOCKED - Student has not completed/attempted this question yet. You do not have access to its answers or explanations. DO NOT reveal the answers or explain topics using locked explanations.]\n`;
            }
            questionsText += '\n';
          }
        }
      }
    }

    // Assemble Context & Enforce Budgets
    let compiledContext = `COURSE: ${courseVersion.name}\n\n`;
    if (currentVideoText) {
      compiledContext += `${currentVideoText}\n`;
    }
    if (videosText) {
      compiledContext += `=== COURSE VIDEO MATERIALS ===\n${videosText}\n`;
    }
    if (questionsText) {
      compiledContext += `=== COURSE QUIZ QUESTIONS ===\n${questionsText}\n`;
    }

    // Truncate context to 50k characters
    if (compiledContext.length > 50000) {
      compiledContext = compiledContext.substring(0, 50000) + '\n... [Context truncated due to size budget]';
    }

    // Limit turns history to last 5
    const turns = payload.priorTurns || [];
    const cappedTurns = turns.slice(-5);

    let priorTurnsText = '';
    cappedTurns.forEach((t, i) => {
      priorTurnsText += `Turn ${i + 1}:\nStudent: ${t.question}\nAsk Betal: ${t.answer}\n\n`;
    });

    // Define quick prompt templates
    let promptInstructions = '';
    let videoGroundingNote = '';
    if (payload.currentVideoTitle) {
      videoGroundingNote = `\n[IMPORTANT GROUNDING CONSTRAINT]: The student is currently watching a specific video titled "${payload.currentVideoTitle}". Any summary, key points, real-life examples, or short notes generated MUST specifically target the content of "${payload.currentVideoTitle}" based on the current playing video context. Do not generate general section-wide content or ask which video they are referring to. Focus exclusively on "${payload.currentVideoTitle}".`;
    }

    if (payload.promptType === 'summarize') {
      promptInstructions = '\nTask: Provide a concise, high-level summary of the video lecture in view, highlighting its core topic and purpose. Ground your summary strictly in the provided video title and description context.' + videoGroundingNote;
    } else if (payload.promptType === 'real_life_example') {
      promptInstructions = '\nTask: Provide a clear, relatable real-world application or example of the concepts described in the current video context. Make the analogy or scenario simple and practical.' + videoGroundingNote;
    } else if (payload.promptType === 'key_points') {
      promptInstructions = '\nTask: Provide a short, clear bulleted list highlighting the key points, terms, or takeaways from the current video context. Limit the list to the most important elements.' + videoGroundingNote;
    } else if (payload.promptType === 'short_notes') {
      promptInstructions = '\nTask: Generate structured, condensed, study-note-style outlines summarizing the key concept in the current context. Use headers or bullets where appropriate.' + videoGroundingNote;
    } else if (payload.promptType === 'explain_differently') {
      promptInstructions = '\nTask: Provide an alternative explanation, analogy, or perspective of the concepts currently in view. If previous answers exist in the conversation history, explain it using a different metaphor or comparison than used before.' + videoGroundingNote;
    }

    const systemPrompt = `You are Ask Betal, an AI learning assistant for the course "${courseVersion.name}", themed after the folklore character Betal.
Your personality is warm but a little wry. Answer clearly and directly using the provided context, but end your response with a brief, thoughtful question back to the student to check their understanding (e.g., "Which of these details feels shakiest to you?", "Does that analogy help clarify how it behaves?").

Rules:
1. Ground all answers directly in the provided context (videos and unlocked questions).
2. If the answer cannot be found in the provided context, say "I do not have enough information to answer based on the course materials." Do not make up answers, guess, or use external knowledge.
3. NEVER reveal or reference explanations, solutions, or correct options for questions explicitly marked with [STATUS: LOCKED]. If the user asks directly about them, politely refuse and tell them to attempt the quiz questions first.
4. If your response ends with a question, you MUST append a final line in the format:
OPTIONS: <short option one> | <short option two>
Each option must be very brief (3-6 words) representing a possible direct response the student could make to your question. If your response does not end with a question, do not include the OPTIONS line.`;

    const userPrompt = `Course Context:
${compiledContext}

Conversation History:
${priorTurnsText || 'No prior turns.'}

Current Student Question:
${payload.question}${promptInstructions}`;

    // Response Cache Eligibility Check (Security Check: No attempted question explanations!)
    const CACHEABLE_PROMPT_TYPES = ['summarize', 'key_points', 'real_life_example', 'short_notes', 'explain_differently'];
    const isCacheable = 
      payload.promptType &&
      CACHEABLE_PROMPT_TYPES.includes(payload.promptType) &&
      payload.currentVideoId &&
      ObjectId.isValid(payload.currentVideoId) &&
      (!payload.priorTurns || payload.priorTurns.length === 0) &&
      !hasAttemptedExplanations;

    if (isCacheable) {
      const cached = await db.collection('askBetalResponseCache').findOne({
        videoId: new ObjectId(payload.currentVideoId),
        promptType: payload.promptType
      });
      if (cached) {
        return { answer: cached.response, replyOptions: cached.replyOptions || [] };
      }
    }

    // LLM Provider check (Gemini or Anthropic)
    const LLM_PROVIDER = process.env.LLM_PROVIDER || 'anthropic';
    if (LLM_PROVIDER === 'gemini') {
      const GEMINI_API_KEY = process.env.GEMINI_API_KEY?.replace(/^\[|\]$/g, '') || '';
      if (!GEMINI_API_KEY) {
        throw new BadRequestError('Gemini API key is not configured in environment (GEMINI_API_KEY)');
      }

      const geminiUrl = `https://generativelanguage.googleapis.com/v1/models/gemini-3.1-flash-lite:generateContent?key=${GEMINI_API_KEY}`;
      const response = await fetch(geminiUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          contents: [{
            parts: [{ text: userPrompt }]
          }],
          systemInstruction: {
            parts: [{ text: systemPrompt }]
          },
          generationConfig: {
            temperature: 0.0,
            maxOutputTokens: 1000
          }
        })
      });

      if (!response.ok) {
        const errText = await response.text();
        throw new BadRequestError(`Gemini API error: ${response.status} - ${errText}`);
      }

      const resJson = await response.json() as any;
      const text = resJson.candidates?.[0]?.content?.parts?.[0]?.text || '';
      const { cleanAnswer, replyOptions } = this.parseReplyOptions(text);

      // Log token usage
      const promptTokens = resJson.usageMetadata?.promptTokenCount || 0;
      const completionTokens = resJson.usageMetadata?.candidatesTokenCount || 0;
      const totalTokens = promptTokens + completionTokens;

      const ledgerColl = db.collection('askBetalUsageLedger');
      if (typeof ledgerColl.updateOne === 'function') {
        await ledgerColl.updateOne(
          { date: todayStr },
          {
            $inc: { tokensUsed: totalTokens, requestCount: 1 },
            $setOnInsert: { createdAt: new Date() }
          },
          { upsert: true }
        );
      }

      // Write to cache if applicable
      if (isCacheable && cleanAnswer) {
        const cacheColl = db.collection('askBetalResponseCache');
        if (typeof cacheColl.insertOne === 'function') {
          const expiresAt = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);
          await cacheColl.insertOne({
            videoId: new ObjectId(payload.currentVideoId),
            promptType: payload.promptType,
            response: cleanAnswer,
            replyOptions,
            createdAt: new Date(),
            expiresAt
          });
        }
      }

      return { answer: cleanAnswer, replyOptions };
    }

    if (LLM_PROVIDER === 'minimax') {
      const MINIMAX_API_KEY = aiConfig.MINIMAX_API_KEY?.replace(/^\[|\]$/g, '') || '';
      if (!MINIMAX_API_KEY) {
        throw new BadRequestError('MiniMax API key is not configured');
      }
      const model = aiConfig.MINIMAX_MODEL || 'MiniMax-M3';
      const baseUrl = aiConfig.MINIMAX_BASE_URL || 'https://api.minimax.io/v1';

      const response = await fetch(`${baseUrl}/chat/completions`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${MINIMAX_API_KEY}`
        },
        body: JSON.stringify({
          model,
          messages: [
            { role: 'system', content: systemPrompt },
            { role: 'user', content: userPrompt }
          ],
          temperature: 1.0,
          max_completion_tokens: 2048
        })
      });

      if (!response.ok) {
        const errText = await response.text();
        throw new BadRequestError(`MiniMax API error: ${response.status} - ${errText}`);
      }

      const resJson = await response.json() as any;
      const rawText = resJson.choices?.[0]?.message?.content || '';
      const text = this.stripThinkingBlocks(rawText);
      const { cleanAnswer, replyOptions } = this.parseReplyOptions(text);

      const promptTokens = resJson.usage?.prompt_tokens || 0;
      const completionTokens = resJson.usage?.completion_tokens || 0;
      const totalTokens = promptTokens + completionTokens;

      const ledgerColl = db.collection('askBetalUsageLedger');
      if (typeof ledgerColl.updateOne === 'function') {
        await ledgerColl.updateOne(
          { date: todayStr },
          {
            $inc: { tokensUsed: totalTokens, requestCount: 1 },
            $setOnInsert: { createdAt: new Date() }
          },
          { upsert: true }
        );
      }

      if (isCacheable && cleanAnswer) {
        const cacheColl = db.collection('askBetalResponseCache');
        if (typeof cacheColl.insertOne === 'function') {
          const expiresAt = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);
          await cacheColl.insertOne({
            videoId: new ObjectId(payload.currentVideoId),
            promptType: payload.promptType,
            response: cleanAnswer,
            replyOptions,
            createdAt: new Date(),
            expiresAt
          });
        }
      }

      return { answer: cleanAnswer, replyOptions };
    }

    // Anthropic API call setup
    const ANTHROPIC_CRED = aiConfig.ANTHROPIC_CRED;
    const ANTHROPIC_MODEL = aiConfig.ANTHROPIC_MODEL;
    if (!ANTHROPIC_CRED) {
      throw new BadRequestError('Anthropic API key is not configured');
    }

    if ((ANTHROPIC_CRED === 'mock-key' || ANTHROPIC_CRED === 'fake-key' || ANTHROPIC_CRED.startsWith('mock')) && process.env.NODE_ENV !== 'test') {
      const qLower = payload.question.toLowerCase();
      let answer = '';
      if (qLower.includes('quiz') || qLower.includes('correct answer') || qLower.includes('question 3')) {
        answer = "I cannot reveal solutions or correct options for locked quiz questions. Please attempt the quiz questions first.";
      } else if (qLower.includes('france') || qLower.includes('capital') || qLower.includes('unrelated')) {
        answer = "I do not have enough information to answer based on the course materials.";
      } else {
        const title = payload.currentVideoTitle || 'the video lecture';
        if (payload.promptType === 'summarize') {
          answer = `Here is a summary of the video "${title}": This video details compiler operations, execution lifecycles, and code translations. Grounded on this content, what part of "${title}"'s concepts would you like to digest first?\nOPTIONS: Tell me about lexing | Show me AST parser`;
        } else if (payload.promptType === 'real_life_example') {
          answer = `To understand the concepts in "${title}", think of a compiler as a translator translating a book from English to French. Does this analogy of translation help clarify "${title}"'s core concept?\nOPTIONS: Yes, makes sense | No, explain differently`;
        } else if (payload.promptType === 'key_points') {
          answer = `Key takeaways from "${title}":\n- Lexing compiles characters to tokens\n- Parsing builds the AST\nWhich of these takeaways from "${title}" is clearest to you?\nOPTIONS: Clear on lexing | Tell me about parsing`;
        } else if (payload.promptType === 'short_notes') {
          answer = `### Compiler Phases for "${title}"\n1. Lexical Analysis\n2. Syntax Analysis\nHow do these phases for "${title}" look to you?\nOPTIONS: Looks good | Explain Lexical Analysis`;
        } else if (payload.promptType === 'explain_differently') {
          answer = `Let's explain the concept of "${title}" differently: a parser acts like a grammar checker in word processing. Does that click better for "${title}"?\nOPTIONS: Yes, this clicks | Give another analogy`;
        } else {
          answer = `The video "${title}" teaches that a compiler translates source code into machine-readable format. The execution lifecycle involves parsing, code generation, and execution.`;
        }
      }

      const { cleanAnswer, replyOptions } = this.parseReplyOptions(answer);

      // Log fake token usage in ledger
      const fakeTokens = 1500;
      const ledgerColl = db.collection('askBetalUsageLedger');
      if (typeof ledgerColl.updateOne === 'function') {
        await ledgerColl.updateOne(
          { date: todayStr },
          {
            $inc: { tokensUsed: fakeTokens, requestCount: 1 },
            $setOnInsert: { createdAt: new Date() }
          },
          { upsert: true }
        );
      }

      // Write to cache if applicable
      if (isCacheable && cleanAnswer) {
        const cacheColl = db.collection('askBetalResponseCache');
        if (typeof cacheColl.insertOne === 'function') {
          const expiresAt = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);
          await cacheColl.insertOne({
            videoId: new ObjectId(payload.currentVideoId),
            promptType: payload.promptType,
            response: cleanAnswer,
            replyOptions,
            createdAt: new Date(),
            expiresAt
          });
        }
      }

      return { answer: cleanAnswer, replyOptions };
    }

    const anthropic = new Anthropic({
      apiKey: ANTHROPIC_CRED,
    });

    // Execute with a timeout (30 seconds) and support Prompt Caching via cache_control
    const callPromise = anthropic.messages.create({
      model: ANTHROPIC_MODEL,
      max_tokens: 1000,
      temperature: 0.0,
      system: [
        {
          type: 'text',
          text: systemPrompt,
          cache_control: { type: 'ephemeral' }
        }
      ] as any,
      messages: [
        {
          role: 'user',
          content: [
            {
              type: 'text',
              text: userPrompt,
            },
          ],
        },
      ],
    }, {
      headers: {
        'anthropic-beta': 'prompt-caching-2024-07-31'
      }
    });

    const timeoutPromise = new Promise<never>((_, reject) =>
      setTimeout(() => reject(new Error('LLM request timed out')), 30000)
    );

    try {
      const response = await Promise.race([callPromise, timeoutPromise]);
      const answer = response.content?.map(c => ('text' in c ? c.text : '')).join('') ?? '';
      const { cleanAnswer, replyOptions } = this.parseReplyOptions(answer);

      // Log token usage
      const promptTokens = response.usage?.input_tokens || 0;
      const completionTokens = response.usage?.output_tokens || 0;
      const totalTokens = promptTokens + completionTokens;

      const ledgerColl = db.collection('askBetalUsageLedger');
      if (typeof ledgerColl.updateOne === 'function') {
        await ledgerColl.updateOne(
          { date: todayStr },
          {
            $inc: { tokensUsed: totalTokens, requestCount: 1 },
            $setOnInsert: { createdAt: new Date() }
          },
          { upsert: true }
        );
      }

      // Write to cache if applicable
      if (isCacheable && cleanAnswer) {
        const cacheColl = db.collection('askBetalResponseCache');
        if (typeof cacheColl.insertOne === 'function') {
          const expiresAt = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);
          await cacheColl.insertOne({
            videoId: new ObjectId(payload.currentVideoId),
            promptType: payload.promptType,
            response: cleanAnswer,
            replyOptions,
            createdAt: new Date(),
            expiresAt
          });
        }
      }

      return { answer: cleanAnswer, replyOptions };
    } catch (error: any) {
      console.error('Error querying Anthropic SDK in AskBetalService:', error);
      throw new BadRequestError(error.message || 'Failed to generate answer from learning assistant.');
    }
  }

  public async getUsageStatus(): Promise<{ estimatedQuestionsRemaining: number }> {
    const db = await this.database.connect();
    const todayStr = new Date().toISOString().split('T')[0];
    const dailyUsage = await db.collection('askBetalUsageLedger').findOne({ date: todayStr });
    const tokensUsed = dailyUsage?.tokensUsed || 0;

    const cap = aiConfig.ASK_BETAL_DAILY_TOKEN_CAP;
    const AVERAGE_TOKENS_PER_EXCHANGE = 1200;

    const remaining = Math.max(0, Math.floor((cap - tokensUsed) / AVERAGE_TOKENS_PER_EXCHANGE));
    return { estimatedQuestionsRemaining: remaining };
  }

  private stripThinkingBlocks(text: string): string {
    return text.replace(/<think>[\s\S]*?<\/think>/gi, '').trim();
  }

  private parseReplyOptions(text: string): { cleanAnswer: string; replyOptions: string[] } {
    let cleanAnswer = text.trim();
    let replyOptions: string[] = [];

    const optionsIndex = cleanAnswer.lastIndexOf('OPTIONS:');
    if (optionsIndex !== -1) {
      const optionsLine = cleanAnswer.substring(optionsIndex + 8).trim();
      cleanAnswer = cleanAnswer.substring(0, optionsIndex).trim();
      replyOptions = optionsLine
        .split('|')
        .map(o => o.trim())
        .filter(Boolean);
    }
    return { cleanAnswer, replyOptions };
  }
}
