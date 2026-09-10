import {
  NO_RECURRENCE,
  sameRecurrence,
  seriesToValue,
  usesInterval,
  valueToPayload,
  describeRecurrence,
} from '../../src/lib/utils/recurrence';

/**
 * Turning a repeat rule into a request, and back.
 *
 * The edit form decides three things from these: whether the rule was touched
 * at all, whether to send it or delete it, and what to put in the body. Getting
 * any of them wrong is quiet — a rule that looks changed when it is not rebuilds
 * every upcoming occurrence for nothing, and one that looks unchanged when it is
 * never saves.
 *
 * No page is visited. The repository has no unit runner, so this rides in
 * Cypress rather than going untested.
 */

const SERIES = {
  id: 'series-1',
  frequency: 'WEEKLY' as const,
  interval: 2,
  endType: 'COUNT' as const,
  count: 6,
  until: null,
  createdAt: '2026-03-01T00:00:00.000Z',
};

describe('recurrence rules', () => {
  describe('seeding the form', () => {
    it('reads an existing rule back into the controls', () => {
      expect(seriesToValue(SERIES)).to.deep.equal({
        frequency: 'WEEKLY',
        interval: '2',
        endType: 'COUNT',
        count: '6',
        until: '',
      });
    });

    it('trims a timestamp down to what a date input wants', () => {
      const value = seriesToValue({
        ...SERIES,
        endType: 'UNTIL',
        count: null,
        until: '2026-06-30T23:59:59.999Z',
      });
      expect(value.until).to.equal('2026-06-30');
    });

    it('treats an activity with no rule as not repeating', () => {
      expect(seriesToValue(null)).to.deep.equal(NO_RECURRENCE);
    });
  });

  describe('building the request', () => {
    it('sends nothing when the activity should not repeat', () => {
      // The edit form reads null as "delete the rule", which is how a repeat is
      // turned off at all.
      expect(valueToPayload(NO_RECURRENCE)).to.equal(null);
    });

    it('sends a count only for a rule that ends after a number', () => {
      const body = valueToPayload(seriesToValue(SERIES))!;
      expect(body).to.deep.include({
        frequency: 'WEEKLY',
        interval: 2,
        endType: 'COUNT',
        count: 6,
      });
      expect(body.until).to.equal(undefined);
    });

    it('sends a date only for a rule that ends on one', () => {
      // A stale value left behind by the other ending must not travel: the
      // server refuses a COUNT rule carrying no count rather than quietly
      // running to its own ceiling, so the two branches have to stay separate.
      const body = valueToPayload({
        frequency: 'MONTHLY',
        interval: '1',
        endType: 'UNTIL',
        count: '4',
        until: '2026-06-30',
      })!;
      expect(body.count).to.equal(undefined);
      expect(body.until).to.be.a('string');
      expect(String(body.until)).to.contain('2026-06-30');
    });

    it('sends neither for a rule that never ends', () => {
      const body = valueToPayload({
        ...NO_RECURRENCE,
        frequency: 'DAILY',
        endType: 'NEVER',
      })!;
      expect(body.count).to.equal(undefined);
      expect(body.until).to.equal(undefined);
    });
  });

  describe('deciding whether the rule was touched', () => {
    const base = seriesToValue(SERIES);

    it('ignores a value retyped as the same number', () => {
      // Rebuilding every upcoming occurrence because someone selected and
      // retyped "2" would be an expensive way to change nothing.
      expect(sameRecurrence(base, { ...base, interval: '02' })).to.equal(true);
    });

    it('notices the frequency changing', () => {
      expect(sameRecurrence(base, { ...base, frequency: 'MONTHLY' })).to.equal(
        false,
      );
    });

    it('notices a repeat being turned off', () => {
      expect(sameRecurrence(base, NO_RECURRENCE)).to.equal(false);
    });

    it('ignores fields belonging to the other ending', () => {
      // `until` is not in play for a COUNT rule, so a leftover date in the
      // hidden control is not a change.
      expect(
        sameRecurrence(base, { ...base, until: '2026-12-01' }),
      ).to.equal(true);
    });

    it('compares nothing else once it does not repeat', () => {
      expect(
        sameRecurrence(NO_RECURRENCE, { ...NO_RECURRENCE, count: '99' }),
      ).to.equal(true);
    });
  });

  describe('which controls apply', () => {
    // The server advances one working day whatever the interval says, and
    // multiplies a fortnight by it — so "every 2 × every two weeks" quietly
    // means monthly. Better not to offer the combination.
    it('hides the interval where it means nothing', () => {
      expect(usesInterval('WEEKDAYS')).to.equal(false);
      expect(usesInterval('BIWEEKLY')).to.equal(false);
    });

    it('offers it everywhere else', () => {
      expect(usesInterval('WEEKLY')).to.equal(true);
      expect(usesInterval('MONTHLY')).to.equal(true);
    });
  });

  describe('describing a rule', () => {
    it('reads as a sentence', () => {
      expect(describeRecurrence(SERIES)).to.equal(
        'Every 2 × weekly · 6 occurrences',
      );
    });

    it('drops the multiplier when it is one', () => {
      expect(describeRecurrence({ ...SERIES, interval: 1 })).to.equal(
        'Weekly · 6 occurrences',
      );
    });

    it('says so when a rule has no end', () => {
      expect(
        describeRecurrence({
          ...SERIES,
          interval: 1,
          endType: 'NEVER',
          count: null,
        }),
      ).to.equal('Weekly · no end date');
    });
  });
});
