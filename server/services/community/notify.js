'use strict';
// Community notification hooks. No-ops for now: Task 7 fills them (reply, mention,
// content-removed via the NotificationEngine). Callers fire-and-forget and catch.

const onComment = async ({ item, comment, actorId } = {}) => undefined; // eslint-disable-line no-unused-vars
const onMentions = async ({ item, comment, usernames, actorId } = {}) => undefined; // eslint-disable-line no-unused-vars
const onRemoved = async ({ item, comment, reason } = {}) => undefined; // eslint-disable-line no-unused-vars

module.exports = { onComment, onMentions, onRemoved };
