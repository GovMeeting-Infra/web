/**
 * Uploading a ministry's staff list.
 *
 * The API is stubbed: what is under test is the page's half of the contract —
 * that it previews before it writes, says exactly what confirming will do,
 * sends the same bytes both times, and survives a phone. The server's half is
 * covered by server/src/users/__tests__/staff-import.*.spec.ts.
 *
 * Signs in as a minister, who uploads to their own ministry only. Set
 * CYPRESS_MINISTER_PASSWORD to the local password for minister@moh.gov.sl.
 */

const MINISTRY = { id: 'moh-001', name: 'Ministry of Health', emailDomain: 'moh.gov.sl' };

const CSV = [
  'First Name,Last Name,Email',
  'Aminata,Koroma,a.koroma@moh.gov.sl',
  'Ibrahim,Sesay,i.sesay@moh.gov.sl',
  'Off,Domain,someone@gmail.com',
].join('\r\n');

const preview = {
  ministry: MINISTRY,
  filename: 'moh-staff.csv',
  committed: false,
  totals: { rows: 3, new: 1, updated: 1, unchanged: 0, skipped: 1 },
  skippedByReason: { WRONG_DOMAIN: 1 },
  skipped: [{ line: 4, name: 'Off Domain', email: 'someone@gmail.com', reason: 'WRONG_DOMAIN' }],
  added: [{ line: 2, firstName: 'Aminata', lastName: 'Koroma', email: 'a.koroma@moh.gov.sl' }],
  updated: [
    {
      line: 3,
      email: 'i.sesay@moh.gov.sl',
      from: { firstName: 'Ibrahim', lastName: null },
      to: { firstName: 'Ibrahim', lastName: 'Sesay' },
    },
  ],
};

const chooseFile = (contents: string, fileName = 'moh-staff.csv') =>
  cy.get('#staffFile').should('be.enabled').selectFile(
    { contents: Cypress.Buffer.from(contents), fileName, mimeType: 'text/csv' },
    { force: true },
  );

describe('Upload a staff list', () => {
  beforeEach(() => {
    cy.login('minister@moh.gov.sl', Cypress.env('MINISTER_PASSWORD') ?? 'not-a-real-password');
    cy.intercept('GET', '**/api/v1/admin/staff-directory/ministries', [MINISTRY]).as('ministries');
  });

  it('previews, then writes only on confirm, sending the same file', () => {
    cy.intercept('POST', '**/api/v1/admin/staff-directory/preview?*', preview).as('preview');
    cy.intercept('POST', '**/api/v1/admin/staff-directory/import?*', {
      ...preview,
      committed: true,
      added: undefined,
      updated: undefined,
    }).as('import');

    cy.visit('/administrative/admin/users');
    cy.contains('a', 'Upload staff list').click();
    cy.wait('@ministries');
    cy.contains('Only addresses ending in').should('contain', '@moh.gov.sl');

    chooseFile(CSV);
    cy.wait('@preview').then(({ request }) => {
      expect(request.headers['content-type']).to.contain('text/csv');
      // A ministry role never names a ministry; the server holds it to its own.
      expect(request.url).not.to.contain('ministryId');
      expect(request.url).to.contain('filename=moh-staff.csv');
    });

    cy.contains('Nothing has been saved yet');
    cy.contains('button', 'Add 1 person and update 1 name').should('be.enabled');
    cy.contains('Aminata Koroma');
    cy.contains('[role=tab]', 'Name changes (1)').click();
    cy.contains('was Ibrahim');
    cy.contains('[role=tab]', 'Skipped (1)').click();
    cy.contains("Not on the ministry's email domain");

    cy.get('@import.all').should('have.length', 0);
    cy.contains('button', 'Add 1 person and update 1 name').click();
    cy.wait('@import').then(({ request }) => {
      const body = request.body as ArrayBuffer | string;
      const text = typeof body === 'string' ? body : new TextDecoder().decode(body);
      expect(text).to.eq(CSV);
    });

    cy.contains('Ministry of Health: 1 added, 1 name updated.');
    cy.contains('button', 'Upload another file').click();
    cy.contains('Choose a CSV file');
  });

  it('offers no confirm when there is nothing to write', () => {
    cy.intercept('POST', '**/api/v1/admin/staff-directory/preview?*', {
      ...preview,
      totals: { rows: 1, new: 0, updated: 0, unchanged: 1, skipped: 0 },
      added: [],
      updated: [],
      skipped: [],
      skippedByReason: {},
    });
    cy.visit('/administrative/admin/users/import');
    chooseFile(CSV);
    cy.contains('Nothing to add.');
    cy.contains('button', /^Add /).should('not.exist');
  });

  it("shows the server's reason for refusing a file", () => {
    cy.intercept('POST', '**/api/v1/admin/staff-directory/preview?*', {
      statusCode: 415,
      body: {
        message: 'This is an Excel workbook, not a CSV. In Excel choose File → Save As → CSV, then upload that file.',
        code: 'SPREADSHEET_NOT_CSV',
      },
    });
    cy.visit('/administrative/admin/users/import');
    chooseFile('PK', 'staff.xlsx');
    cy.get('[role=alert]').should('contain', 'Save As');
  });

  it('fits a phone', () => {
    cy.intercept('POST', '**/api/v1/admin/staff-directory/preview?*', {
      ...preview,
      skipped: [
        {
          line: 4,
          name: 'Someone With A Long Name',
          email: 'someone.with.an.unusually.long.address@gmail.com',
          reason: 'WRONG_DOMAIN',
        },
      ],
    });
    // The header bell's unread badge is wider than its button and trips the
    // clipping check on every page when there is anything unread. That is the
    // shell's, not this page's, so it is held at zero here.
    cy.intercept('GET', '**/api/v1/notifications/unread-count', { unread: 0 });
    cy.viewport(375, 812);
    cy.visit('/administrative/admin/users/import');
    chooseFile(CSV, 'a-rather-long-file-name-for-the-ministry-of-health-staff.csv');
    cy.contains('[role=tab]', 'Skipped (1)').click();
    cy.contains('someone.with.an.unusually.long.address@gmail.com');
    cy.assertNoClipping();
  });
});
