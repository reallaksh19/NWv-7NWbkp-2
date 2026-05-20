import { describe, expect, it } from 'vitest';
import { classifyAngle } from './dedup';
import type { InsightStory } from '../types';

function story(title: string, summary: string): InsightStory {
  return {
    id: title.toLowerCase().replace(/\W+/g, '-'),
    title,
    summary,
    source: 'Source A',
    sourceGroup: 'source-a',
    url: 'https://example.com/story',
    publishedAt: Date.now(),
    category: 'news',
    region: 'IN',
    language: 'en',

    capturedAtSnapshot: 'now',
    canonicalUrl: 'https://example.com/story',
    canonicalText: `${title} ${summary}`,
    canonicalTextHash: title,

    entities: {
      people: [],
      orgs: ['Org'],
      places: ['India'],
      products: [],
      symbols: [],
    },

    keywords: [],
    embedding: [1, 0, 0],
    eventVerbs: ['said'],
    numbers: [],

    sourceTier: 'A',
    sourceAuthority: 0.8,
    freshnessScore: 0.8,
    rawProminence: 0.8,
    sentiment: 0,
    factualDensity: 0.8,
    summaryQuality: 0.8,
  };
}

describe('Insight angle classifier enrichment certification', () => {
  it('classifies public reaction stories', () => {
    const s = story(
      'Public backlash grows after new policy',
      'Residents said the move triggered social media criticism and protests.'
    );

    expect(classifyAngle(s)).toBe('reaction_public');
  });

  it('classifies background context stories', () => {
    const s = story(
      'Explainer: timeline of the court case',
      'Here is the background and key points that led to the decision.'
    );

    expect(classifyAngle(s)).toBe('background_context');
  });

  it('classifies official response with strengthened official signals', () => {
    const s = story(
      'Authorities said rescue work is continuing',
      'Officials said teams remain at the site and according to the ministry more updates will follow.'
    );

    expect(classifyAngle(s)).toBe('official_response');
  });

  it('keeps correction higher priority than fact update', () => {
    const s = story(
      'Correction: latest figures updated',
      'Editors clarified the latest figures after corrected data was issued.'
    );

    expect(classifyAngle(s)).toBe('correction');
  });

  it('classifies base report when no specific angle signal exists', () => {
    const s = story(
      'Company announces new office opening',
      'The announcement was made on Monday with general details.'
    );

    expect(classifyAngle(s)).toBe('base_report');
  });
});