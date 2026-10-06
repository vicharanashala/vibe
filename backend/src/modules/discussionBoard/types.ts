const TYPES = {
  // Services
  DiscussionService: Symbol.for('DiscussionService'),

  // Repositories
  DiscussionThreadRepository: Symbol.for('DiscussionThreadRepository'),
  DiscussionReplyRepository: Symbol.for('DiscussionReplyRepository'),
};

export {TYPES as DISCUSSIONBOARD_TYPES};
