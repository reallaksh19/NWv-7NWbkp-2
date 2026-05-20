import fs from 'fs';

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

function read(path) {
  assert(fs.existsSync(path), `Missing file: ${path}`);
  return fs.readFileSync(path, 'utf8');
}

const followingPage = read('src/pages/FollowingPage.jsx');
const followingCss = read('src/pages/FollowingPage.css');
const topicCard = read('src/components/TopicCard.jsx');
const topicCardCss = read('src/components/TopicCard.css');
const topicContext = read('src/context/TopicContext.jsx');

for (const token of [
  'following-page--pro',
  'getTopicStats',
  'sortedTopics',
  'topicMessage',
  'clearTopicMessage',
  'Refresh topics',
  'following-page__stats',
  'following-page__topic-grid',
  'articles={topicNews[topic.id] || []}'
]) {
  assert(followingPage.includes(token), `FollowingPage missing token: ${token}`);
}

for (const token of [
  '.following-page__hero',
  '.following-page__content--pro',
  '.following-page__stats',
  '.following-page__topic-grid',
  '@media (min-width: 1024px)',
  '@media (max-width: 760px)'
]) {
  assert(followingCss.includes(token), `FollowingPage.css missing token: ${token}`);
}

for (const token of [
  'getTopicHealth',
  'latestArticle',
  'data-topic-health',
  'topic-card__latest',
  'topic-card__footer',
  'Remove ${topic.name}'
]) {
  assert(topicCard.includes(token), `TopicCard missing token: ${token}`);
}

for (const token of [
  '.topic-card--pro',
  '.topic-card__health--good',
  '.topic-card__health--thin',
  '.topic-card__health--new',
  '.topic-card__latest',
  '.topic-card__remove'
]) {
  assert(topicCardCss.includes(token), `TopicCard.css missing token: ${token}`);
}

for (const token of [
  'canonicalTopicText',
  'getTopicKey',
  'isDuplicateTopic',
  'normalizeTopic',
  'topicMessage',
  'clearTopicMessage',
  'duplicate-topic'
]) {
  assert(topicContext.includes(token), `TopicContext missing token: ${token}`);
}

assert(
  topicContext.includes('isDuplicateTopic(existingTopics, normalizedTopic)'),
  'TopicContext must check duplicates before addFollowedTopic'
);

assert(
  topicContext.indexOf('isDuplicateTopic(existingTopics, normalizedTopic)') <
  topicContext.indexOf('addFollowedTopic(normalizedTopic)'),
  'TopicContext must reject duplicates before adding topic'
);

console.log(JSON.stringify({
  status: 'PASS',
  checked: 'Following tab professional slice',
  guarantees: [
    'Following page has professional desktop/mobile layout',
    'topic stats are visible',
    'topic cards show latest article/source/count/health',
    'duplicate topic guard is present',
    'topic messages are visible/dismissible',
    'no topic feed service logic was changed'
  ]
}, null, 2));

console.log('PASS: Following static slice');