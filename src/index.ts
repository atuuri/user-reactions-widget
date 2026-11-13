// SPDX-License-Identifier: MIT
// ES module entry, also the IIFE entry (exposed as window.UserReactions).
// Importing registers <user-reactions> in browsers; in Node it only exposes sendFeedback.

import { define } from './element';

export { sendFeedback, ReactionsError, VERSION } from './client';
export type { ErrorCode, FeedbackPayload, FeedbackType, ImpressionPayload, Meta, SendFeedbackOptions } from './client';
export { UserReactionsElement, TAG } from './element';
export type { RatedDetail, CommentedDetail, ErrorDetail } from './element';

define();
