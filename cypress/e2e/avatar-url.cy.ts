import { avatarUrl } from '../../src/lib/avatar-url';

/**
 * Sizing a profile photograph before it is drawn.
 *
 * Avatars are whatever came off someone's phone. The two on the platform when
 * this was written are 5347x6684 and 2013x1536, and the larger is 4.3MB — for
 * a circle forty pixels across, redrawn on every page, over Sierra Leonean
 * mobile data. Cloudinary crops it to about 5KB if the URL asks it to.
 *
 * No page is visited here. This is the one piece of pure logic in the avatar
 * work and the repository has no unit runner, so it rides in Cypress rather
 * than going untested.
 */

const AKIE =
  'https://res.cloudinary.com/ddhuli05u/image/upload/v1787571004/avatars/py2wplteccbs9dihdsvk.jpg';

describe('avatarUrl', () => {
  it('asks Cloudinary for a square at the size being drawn', () => {
    expect(avatarUrl(AKIE, 160)).to.equal(
      'https://res.cloudinary.com/ddhuli05u/image/upload/' +
        'c_fill,g_face,w_160,h_160,q_auto,f_auto/' +
        'v1787571004/avatars/py2wplteccbs9dihdsvk.jpg',
    );
  });

  it('crops to the face rather than squashing a landscape photo', () => {
    // g_face and c_fill are the pair that matters: c_fill alone would centre
    // the crop, which takes someone's chest out of a portrait held wide.
    expect(avatarUrl(AKIE, 96)).to.contain('c_fill,g_face,w_96,h_96');
  });

  it('leaves a URL that already carries a transformation alone', () => {
    // Applying twice is what would happen if a sized URL were ever stored, or
    // if two components sized the same value in turn. Matching on the version
    // segment is what prevents a second crop being stacked on the first.
    const once = avatarUrl(AKIE, 160)!;
    expect(avatarUrl(once, 160)).to.equal(once);
  });

  it('passes a link to anywhere else through untouched', () => {
    // The profile form accepts a pasted address, and nothing can be assumed
    // about it — including that it will load at all, which is why the avatar
    // still needs its fallback.
    expect(avatarUrl('https://example.gov.sl/me.png', 160)).to.equal(
      'https://example.gov.sl/me.png',
    );
  });

  it('treats nothing, and whitespace, as no photograph', () => {
    // Null is the column's empty value and '' is what the profile form submits
    // to clear it, so both have to reach the caller as "draw the initial".
    expect(avatarUrl(null, 160)).to.equal(null);
    expect(avatarUrl(undefined, 160)).to.equal(null);
    expect(avatarUrl('   ', 160)).to.equal(null);
  });

  it('does not rewrite a lookalike host', () => {
    const impostor =
      'https://res.cloudinary.com.example.com/x/image/upload/v1/a.jpg';
    expect(avatarUrl(impostor, 160)).to.equal(impostor);
  });
});
