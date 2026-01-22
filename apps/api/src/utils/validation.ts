import { Response } from 'express';
import type { ErrorResponse } from '@habits-coach/shared';

export interface ValidationRule {
  field: string;
  type: 'array';
  allowEmpty?: boolean;
}

export function validateRequest(
  body: any,
  rules: ValidationRule[],
  res: Response
): boolean {
  for (const rule of rules) {
    const value = body[rule.field];

    if (rule.type === 'array') {
      if (!Array.isArray(value)) {
        res.status(400).json({
          error: `Invalid request: ${rule.field} must be an array`,
        } satisfies ErrorResponse);
        return false;
      }

      if (!rule.allowEmpty && value.length === 0) {
        res.status(400).json({
          error: `${rule.field.charAt(0).toUpperCase() + rule.field.slice(1)} array is required`,
        } satisfies ErrorResponse);
        return false;
      }
    }
  }

  return true;
}
