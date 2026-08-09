import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Terms of Use — Zitto',
};

/*
 * PLACEHOLDER CONTENT.
 *
 * In the shipped product this page renders from the `cms_pages` row with slug
 * `terms`, so operators can publish updates (and translations) without a deploy.
 * The text below is a plain-language draft covering the points the product
 * actually relies on — it has NOT been reviewed by a lawyer and must be before
 * launch in any jurisdiction.
 */

const SECTIONS = [
  {
    heading: 'What Zitto is',
    body: [
      'Zitto is an entertainment application built around Dragon Tiger, a card game of chance. It is played entirely with virtual coins.',
      'Virtual coins have no cash value. They cannot be bought, sold, exchanged for money or goods, transferred between accounts, or withdrawn. Coins that leave your balance are gone, and coins credited to you are not a debt we owe you.',
    ],
  },
  {
    heading: 'Eligibility',
    body: [
      'You must be old enough to use Zitto under the law where you live, and you must confirm your age when you register.',
      'One person, one account. Creating additional accounts to claim rewards more than once is grounds for suspension and forfeiture of coins.',
    ],
  },
  {
    heading: 'How rounds are decided',
    body: [
      'Every round is decided on our servers using a cryptographically secure random draw. Your device does not influence the outcome.',
      'Each round commits to a hashed server seed before betting opens and reveals that seed after the round settles, so you can reproduce the result yourself from any settled round.',
      'Rounds are independent. Nothing that happened in previous rounds changes the chance of any outcome in the next one.',
    ],
  },
  {
    heading: 'About the analytics',
    body: [
      'Zitto shows statistics describing rounds that have already been played. These are observations, not forecasts.',
      'No figure on the analytics screen predicts a future round, and none is presented as a strategy. Confidence labels never rise above "Moderate signal" because no amount of history makes an independent draw predictable.',
    ],
  },
  {
    heading: 'Your account',
    body: [
      'Keep your password and any two-factor codes to yourself. You are responsible for activity on your account.',
      'We may suspend an account for abuse, fraud, collusion in tournaments, or attempts to interfere with round outcomes. When we do, we record the reason.',
      'You can request an export of your data, or ask us to delete your account, from Settings. Deletion is permanent and takes effect after a short cooling-off period.',
    ],
  },
  {
    heading: 'Taking a break',
    body: [
      'You can set session reminders or exclude yourself from Zitto for a fixed period at any time from the Responsible Gaming page.',
      'Self-exclusion cannot be lifted early — not by you, and not by our staff. That is deliberate.',
    ],
  },
  {
    heading: 'Changes',
    body: [
      'If we change these terms in a way that affects you, we will tell you in the app before the change takes effect and record which version you accepted.',
    ],
  },
];

export default function TermsPage() {
  return (
    <>
      <h1 className="font-display text-2xl font-bold">Terms of Use</h1>
      <p className="mt-1 text-sm text-surface-muted">
        Draft — pending legal review. Last updated 9 August 2026.
      </p>

      <div className="mt-6 flex flex-col gap-6">
        {SECTIONS.map((s) => (
          <section key={s.heading}>
            <h2 className="text-base font-semibold">{s.heading}</h2>
            {s.body.map((p) => (
              <p key={p} className="mt-2 text-sm leading-relaxed text-surface-subtle">
                {p}
              </p>
            ))}
          </section>
        ))}
      </div>
    </>
  );
}
