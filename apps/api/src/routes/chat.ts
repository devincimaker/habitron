import { Router, Request, Response } from 'express';
import { sendMessage } from '../services/openai.js';
import { authMiddleware } from '../middleware/auth.js';
import { chatRateLimiter } from '../middleware/rateLimit.js';
import {
  logCoachDebugEventBestEffort,
  sessionBelongsToUser,
} from '../services/coachDebugEvents.js';
import type {
  ChatRequest,
  ChatResponse,
  CoachDebugErrorStage,
  ErrorResponse,
  JsonValue,
} from '@habits-coach/shared';

const router: Router = Router();

function getTurnIndex(messages: ChatRequest['messages']): number {
  const userMessageCount = messages.filter((message) => message.role === 'user').length;
  return Math.max(0, userMessageCount - 1);
}

function toJsonValue(value: unknown): JsonValue {
  return JSON.parse(JSON.stringify(value)) as JsonValue;
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
    sessionIdPresent: Boolean(request.sessionId),
  };
}

function buildChatResponseDebugPayload(response: ChatResponse): JsonValue {
  return {
    messageLength: response.message.length,
    hasProposal: Boolean(response.proposal),
    proposalActionCount: response.proposal?.actions.length ?? 0,
    proposalActions:
      response.proposal?.actions.map((action) => ({
        entity: action.entity,
        operation: action.operation,
      })) ?? [],
    hasDailyPlanDraft: Boolean(response.proposal?.dailyPlanDraft),
    dailyPlanDraftItemCount: response.proposal?.dailyPlanDraft?.items.length ?? 0,
    leadSkillId: response.leadSkillId ?? null,
    activeSkillIds: response.activeSkillIds ?? [],
    skillPhase: response.skillPhase ?? null,
    response: toJsonValue(response),
  };
}

function normalizeChatError(error: unknown): {
  message: string;
  stage: CoachDebugErrorStage;
  metadata?: JsonValue;
} {
  if (error instanceof SyntaxError) {
    return {
      message: error.message,
      stage: 'chat_response_parse',
    };
  }

  if (error instanceof Error) {
    if (/invalid response format/i.test(error.message)) {
      return {
        message: error.message,
        stage: 'chat_response_validation',
      };
    }

    return {
      message: error.message,
      stage: 'chat_generation',
      metadata: {
        errorName: error.name,
      },
    };
  }

  return {
    message: 'Unknown chat error',
    stage: 'unknown',
  };
}

export async function handleChatRequest(req: Request, res: Response): Promise<void> {
  try {
    const {
      sessionId,
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
    } = req.body as ChatRequest & { diaryEntries?: ChatRequest['journalEntries'] };
    const requestPayload: ChatRequest = {
      sessionId,
      messages,
      habits,
      goals,
      todos,
      journalEntries: journalEntries ?? req.body.diaryEntries,
      dailyPlan,
      memories,
      userName,
      today,
      timezone,
    };

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

    if (typeof sessionId !== 'string' || sessionId.trim().length === 0) {
      res.status(400).json({
        error: 'A valid coaching session is required.',
        code: 'session_required',
      } satisfies ErrorResponse);
      return;
    }

    const turnIndex = getTurnIndex(messages);
    const belongsToUser = await sessionBelongsToUser(sessionId, req.user!.id);
    if (!belongsToUser) {
      console.warn('Rejecting unauthorized chat sessionId:', sessionId);
      res.status(403).json({
        error: 'You do not have access to that coaching session.',
        code: 'session_forbidden',
      } satisfies ErrorResponse);
      return;
    }

    await logCoachDebugEventBestEffort({
      sessionId,
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

    const response = await sendMessage(requestPayload, {
      userId: req.user!.id,
    });

    await logCoachDebugEventBestEffort({
      sessionId,
      userId: req.user!.id,
      event: {
        eventType: 'chat_response_received',
        turnIndex,
        responsePayload: buildChatResponseDebugPayload(response),
        proposalPayload: response.proposal ?? null,
        metadata: {
          leadSkillId: response.leadSkillId ?? null,
          skillPhase: response.skillPhase ?? null,
        },
      },
    });

    res.json(response);
  } catch (error) {
    console.error('Chat error:', error);
    const requestPayload = req.body as ChatRequest | undefined;
    const sessionId =
      requestPayload && typeof requestPayload.sessionId === 'string'
        ? requestPayload.sessionId
        : null;

    if (sessionId && req.user?.id) {
      const normalizedError = normalizeChatError(error);
      await logCoachDebugEventBestEffort({
        sessionId,
        userId: req.user.id,
        event: {
          eventType: 'chat_response_rejected',
          turnIndex: Array.isArray(requestPayload?.messages)
            ? getTurnIndex(requestPayload.messages)
            : undefined,
          requestPayload:
            requestPayload && Array.isArray(requestPayload.messages) && Array.isArray(requestPayload.habits)
              ? buildChatRequestDebugPayload(requestPayload)
              : undefined,
          errorMessage: normalizedError.message,
          errorStage: normalizedError.stage,
          metadata: normalizedError.metadata,
        },
      });
    }

    if (error instanceof SyntaxError) {
      res.status(500).json({
        error: 'Failed to parse AI response',
      } satisfies ErrorResponse);
      return;
    }

    res.status(500).json({
      error: 'Failed to process message. Please try again.',
    } satisfies ErrorResponse);
  }
}

// POST /api/chat - Send message to AI coach
router.post('/', authMiddleware, chatRateLimiter, handleChatRequest);

export default router;
