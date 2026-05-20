import { describe, expect, it } from 'vitest';
import {
  extractEntities,
  extractKeywords,
  extractNumbers,
  extractVerbs,
} from './nlpAdapter';

describe('Insight NLP enrichment certification', () => {
  it('extracts richer organization, place, person, product and symbol signals', async () => {
    const entities = await extractEntities(
      'Finance Ministry officials and Dr Meera Rao reviewed Acme Bank Ltd outage in Chennai after $ACME shares fell. Acme Pay Pro users complained.'
    );

    expect(entities.orgs).toContain('Finance Ministry');
    expect(entities.orgs).toContain('Acme Bank Ltd');
    expect(entities.places).toContain('Chennai');
    expect(entities.people).toContain('Meera Rao');
    expect(entities.symbols).toContain('ACME');
    expect(entities.products).toContain('Acme Pay Pro');
  });

  it('extracts broad news verbs beyond the old narrow list', async () => {
    const verbs = await extractVerbs(
      'Officials confirmed the regulator reviewed the outage, investors sold shares, and users criticised the bank.'
    );

    expect(verbs).toContain('confirmed');
    expect(verbs).toContain('reviewed');
    expect(verbs).toContain('sold');
    expect(verbs).toContain('criticised');
  });

  it('extracts richer numeric fact signals', async () => {
    const numbers = await extractNumbers(
      'Shares fell 4 percent, affected 2 million users for 3 hours, and wiped $1.2 billion from value.'
    );

    expect(numbers).toContain('4 percent');
    expect(numbers).toContain('2 million');
    expect(numbers).toContain('3 hours');
    expect(numbers).toContain('$1.2 billion');
  });

  it('extracts stable story topic keywords instead of noisy filler words', async () => {
    const keywords = await extractKeywords(
      'Finance Ministry confirmed Acme Bank outage review after Acme Pay Pro failed for customers in Chennai.'
    );

    expect(keywords).toContain('acme');
    expect(keywords).toContain('bank');
    expect(keywords).toContain('finance');
    expect(keywords).toContain('ministry');
    expect(keywords).toContain('outage');
    expect(keywords).not.toContain('after');
  });
});
