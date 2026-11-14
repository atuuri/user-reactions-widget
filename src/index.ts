// SPDX-License-Identifier: MIT
// ES module entry, also the IIFE entry (exposed as window.UserReactions).
// Importing registers <user-reactions> in browsers; in Node it only exposes sendFeedback.

import { define } from './element.js';

export { sendFeedback, ReactionsError, VERSION } from './client.js';
export type { ErrorCode, FeedbackPayload, FeedbackType, ImpressionPayload, Meta, SendFeedbackOptions } from './client.js';
export { UserReactionsElement, TAG } from './element.js';
export type { RatedDetail, CommentedDetail, ErrorDetail } from './element.js';

define();
