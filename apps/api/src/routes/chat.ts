import { Router, Request, Response } from 'express';
import { CoachChatError, generateChatResponse } from '../services/openai.js';
import { authMiddleware } from '../middleware/auth.js';
import { chatRateLimiter } from '../middleware/rateLimit.js';
import {
  logCoachDebugEventBestEffort,
  sessionBelongsToUser,
} from '../services/coachDebugEvents.js';
import type {
  ChatRequest,
  ChatResponse,
  ErrorResponse,
  CoachDebugErrorStage,
  JsonValue,
} from '@habits-coach/shared';

const router: Router = Router();

function getTurnIndex(messages: ChatRequest['messages']): number {
  const userMessageCount = messages.filter((message) => message.role === 'user').length;
  return Math.max(0, userMessageCount - 1);
}

function normalizeChatError(error: unknown): {
  message: string;
  code?: string;
  stage: CoachDebugErrorStage;
  metadata?: JsonValue;
} {
  if (error instanceof CoachChatError) {
    return {
      message: error.message,
      code: error.code,
      stage: error.stage,
      metadata: error.metadata,
    };
  }

  if (error instanceof SyntaxError) {
    return {
      message: error.message,
      stage: 'chat_response_parse',
    };
  }

  return {
    message: error instanceof Error ? error.message : 'Unknown chat error',
    stage: 'unknown',
  };
}

function describeJsonShape(value: JsonValue): JsonValue {
  if (Array.isArray(value)) {
    return {
      type: 'array',
      length: value.length,
    };
  }

  if (value !== null && typeof value === 'object') {
    return {
      type: 'object',
      keys: Object.keys(value).slice(0, 25),
    };
  }

  return {
    type: value === null ? 'null' : typeof value,
  };
}

function buildChatRequestDebugPayload(request: ChatRequest): JsonValue {
  const lastMessage = request.messages.at(-1);

  return {
    messageCount: request.messages.length,
    userMessageCount: request.messages.filter((message) => message.role === 'user').length,
    assistantMessageCount: request.messages.filter((message) => message.role === 'assistant').length,
    lastMessageRole: lastMessage?.role ?? null,
    lastMessageLength: lastMessage?.content.length ?? 0,
    habitCount: request.habits.length,
    activeHabitCount: request.habits.filter((habit) => habit.active).length,
    goalCount: request.goals?.length ?? 0,
    todoCount: request.todos?.length ?? 0,
    journalEntryCount: request.journalEntries?.length ?? 0,
    memoryCount: request.memories?.length ?? 0,
    hasDailyPlan: Boolean(request.dailyPlan),
    dailyPlanItemCount: request.dailyPlan?.items.length ?? 0,
    hasUserName: Boolean(request.userName?.trim()),
    today: request.today ?? null,
    timezone: request.timezone ?? null,
  };
}

function buildChatResponseDebugPayload(response: ChatResponse, rawContent: string, rawResponse: JsonValue): JsonValue {
  const proposal = response.proposal ?? null;

  return {
    messageLength: response.message.length,
    hasProposal: Boolean(proposal),
    proposalActionCount: proposal?.actions.length ?? 0,
    proposalActions:
      proposal?.actions.map((action) => ({
        entity: action.entity,
        operation: action.operation,
      })) ?? [],
    hasDailyPlanDraft: Boolean(proposal?.dailyPlanDraft),
    dailyPlanDraftItemCount: proposal?.dailyPlanDraft?.items.length ?? 0,
    rawContentLength: rawContent.length,
    rawResponseShape: describeJsonShape(rawResponse),
  };
}

function sanitizeChatErrorMetadata(metadata: JsonValue | undefined): JsonValue | undefined {
  if (metadata === undefined || metadata === null || typeof metadata !== 'object' || Array.isArray(metadata)) {
    return undefined;
  }

  const rawContent = metadata.rawContent;
  const rawResponse = metadata.rawResponse;
  const sanitized: Record<string, JsonValue> = {
    metadataKeys: Object.keys(metadata).slice(0, 25),
  };

  if (typeof rawContent === 'string') {
    sanitized.hasRawContent = true;
    sanitized.rawContentLength = rawContent.length;
  }

  if (rawResponse !== undefined) {
    sanitized.hasRawResponse = true;
    sanitized.rawResponseShape = describeJsonShape(rawResponse);
  }

  return sanitized;
}

function getChatErrorStatus(stage: CoachDebugErrorStage): number {
  if (
    stage === 'chat_generation' ||
    stage === 'chat_response_parse' ||
    stage === 'chat_response_validation'
  ) {
    return 502;
  }

  return 500;
}

function getChatErrorMessage(status: number): string {
  if (status === 502) {
    return 'Coach response was invalid. Please try again.';
  }

  return 'Failed to process message. Please try again.';
}

// POST /api/chat - Send message to AI coach
router.post(
  '/',
  authMiddleware,
  chatRateLimiter,
  async (req: Request, res: Response): Promise<void> => {
    try {
      const {
        messages,
        habits,
        goals,
        todos,
        journalEntries,
        dailyPlan,
        memories,
        userName,
        today,
        timezone,
        sessionId,
      } = req.body as ChatRequest;

      // Validate request body
      if (!Array.isArray(messages)) {
        res.status(400).json({
          error: 'Invalid request: messages must be an array',
        } satisfies ErrorResponse);
        return;
      }

      if (!Array.isArray(habits)) {
        res.status(400).json({
          error: 'Invalid request: habits must be an array',
        } satisfies ErrorResponse);
        return;
      }

      const requestPayload: ChatRequest = {
        messages,
        habits,
        goals,
        todos,
        journalEntries,
        dailyPlan,
        memories,
        userName,
        today,
        timezone,
        sessionId,
      };
      const turnIndex = getTurnIndex(messages);

      let ownedSessionId: string | undefined;
      if (typeof sessionId === 'string' && sessionId.trim().length > 0) {
        const belongsToUser = await sessionBelongsToUser(sessionId, req.user!.id);
        if (belongsToUser) {
          ownedSessionId = sessionId;
        } else {
          console.warn('Ignoring debug logging for unknown or unauthorized sessionId:', sessionId);
        }
      }

      if (ownedSessionId) {
        await logCoachDebugEventBestEffort({
          sessionId: ownedSessionId,
          userId: req.user!.id,
          event: {
            eventType: 'chat_request_sent',
            turnIndex,
            requestPayload: buildChatRequestDebugPayload(requestPayload),
            metadata: {
              messageCount: messages.length,
            },
          },
        });
      }

      const generated = await generateChatResponse(requestPayload);

      if (ownedSessionId) {
        await logCoachDebugEventBestEffort({
          sessionId: ownedSessionId,
          userId: req.user!.id,
          event: {
            eventType: 'chat_response_received',
            turnIndex,
            responsePayload: buildChatResponseDebugPayload(
              generated.response,
              generated.rawContent,
              generated.rawResponse
            ),
            proposalPayload: generated.response.proposal ?? null,
            metadata: {
              hasProposal: Boolean(generated.response.proposal),
              responseMessageLength: generated.response.message.length,
            },
          },
        });
      }

      res.json(generated.response);
    } catch (error) {
      console.error('Chat error:', error);

      const { sessionId, messages } = req.body as Partial<ChatRequest>;
      const debugTurnIndex = Array.isArray(messages) ? getTurnIndex(messages) : 0;
      const normalizedError = normalizeChatError(error);

      if (typeof sessionId === 'string' && sessionId.trim().length > 0) {
        const belongsToUser = await sessionBelongsToUser(sessionId, req.user!.id).catch(() => false);
        if (belongsToUser) {
          await logCoachDebugEventBestEffort({
            sessionId,
            userId: req.user!.id,
            event: {
              eventType: 'chat_response_rejected',
              turnIndex: debugTurnIndex,
              errorMessage: normalizedError.message,
              errorCode: normalizedError.code,
              errorStage: normalizedError.stage,
              metadata: sanitizeChatErrorMetadata(normalizedError.metadata),
            },
          });
        }
      }

      const status = getChatErrorStatus(normalizedError.stage);
      res.status(status).json({
        error: getChatErrorMessage(status),
        code: normalizedError.code ?? normalizedError.stage,
      } satisfies ErrorResponse);
    }
  }
);

export default router;
