import React from 'react';
import { rankStoriesForLocation } from '../../services/storyLocationPriority.js';
import { auditTravelLocalStories, getStoriesDisplayMode } from '../../services/travelLocalUiQuality.js';
import { sanitizeHtmlText } from '../../utils/htmlText.js';
import './TravelLocalStories.css';

function storyUrl(story) {
  return story?.url || story?.link || story?.href || '#';
}

export default function TravelLocalStories({ newsData, profile, limit = 5 }) {
  if (!profile?.prioritizeStories) return null;

  const stories = rankStoriesForLocation(newsData, profile, { limit });
  const audit = auditTravelLocalStories(stories, profile);
  const displayMode = getStoriesDisplayMode(audit, profile);

  if (displayMode === 'hidden') return null;

  if (displayMode === 'empty' || displayMode === 'low-quality') {
    return (
      <section className="travel-local-stories travel-local-stories--empty" data-travel-local-stories="empty">
        <header>
          <span>{profile.icon || '📍'} Travel local</span>
          <strong>{profile.display}</strong>
        </header>
        <p>No strong {profile.display} local story match yet. The GitHub prefetch/local source workflow should add more coverage.</p>
      </section>
    );
  }

  return (
    <section className="travel-local-stories" data-travel-local-stories="true">
      <header>
        <span>{profile.icon || '📍'} Travel local</span>
        <strong>{profile.display} / {profile.countryLabel}</strong>
      </header>

      <div className="travel-local-stories__list">
        {stories.map(story => (
          <a
            key={story.id || story.url || story.title}
            href={storyUrl(story)}
            target="_blank"
            rel="noopener noreferrer"
            className="travel-local-stories__item"
          >
            <strong>{sanitizeHtmlText(story.title || story.headline)}</strong>
            <span>
              {sanitizeHtmlText(story.source || story.sourceGroup || story._travelSection || 'Local source')}
              {' · score '}
              {story._travelLocationScore}
            </span>
          </a>
        ))}
      </div>
    </section>
  );
}
