/**
 * Voice-over script and on-screen actions for each walkthrough video.
 * Each scene lasts at least as long as its voice-over line.
 */

const sting = (tag) => `/scripts/video/sting.html${tag ? `?tag=${encodeURIComponent(tag)}` : ''}`;

// Bounding box of the Nth listing card (the card that holds the Nth "Claim Now" button)
async function ringCard(drv, index = 0, hold = 0) {
  const rect = await drv.page.evaluate((i) => {
    const btn = [...document.querySelectorAll('button')].filter((b) => /Claim Now/.test(b.textContent))[i];
    let el = btn;
    while (el && el.getBoundingClientRect().height < 320) el = el.parentElement;
    el.scrollIntoView({ block: 'center' });
    const r = el.getBoundingClientRect();
    return [r.x, r.y, r.width, r.height];
  }, index);
  await drv.page.evaluate((r) => window.__lb.ring(...r), rect);
  if (hold) await drv.sleep(hold);
}

const digit = (page, d) => page.getByRole('button', { name: d, exact: true });

export const SCENES = {
  customer: {
    file: 'last-bite-customers.mp4',
    posterAt: 5,
    scenes: [
      {
        say: 'Hungry in St. John\'s? Meet Last Bite.',
        after: 0.4,
        run: async ({ drv }) => drv.goto(sting(), { cursor: false }),
      },
      {
        say: 'Every day, downtown restaurants end up with perfectly good food: canceled orders, kitchen mix-ups, and end of shift extras. Last Bite puts it in your hands, at half price or better.',
        run: async ({ drv }) => {
          await drv.goto('/consumer');
          await drv.sleep(2500);
          await ringCard(drv, 0, 3500);
          await drv.point(drv.page.getByText('Bite Price').first());
          await drv.sleep(2000);
          await drv.unring();
        },
      },
      {
        say: 'The live map shows what\'s cooking near you, and every deal counts down, so you know exactly how long it\'s available.',
        run: async ({ drv }) => {
          await drv.ring('.leaflet-container', 3800);
          await drv.ring(drv.page.locator('span').filter({ hasText: /^\d{1,2}:\d{2}$/ }).first(), 2500);
          await drv.unring();
        },
      },
      {
        say: 'Craving something specific? Filter by seafood, pizza, bakery, and more.',
        run: async ({ drv }) => {
          const chip = (name) => drv.page.getByRole('button', { name, exact: true });
          await drv.click(chip('Seafood'), 900);
          await drv.click(chip('Pizza'), 900);
          await drv.click(chip('Bakery'), 900);
          await drv.click(chip('All'), 300);
        },
      },
      {
        say: 'Found something you love? Tap, claim now.',
        after: 0.3,
        run: async ({ drv }) => {
          await ringCard(drv, 0, 900);
          await drv.unring();
          await drv.click(drv.page.getByRole('button', { name: /Claim Now/ }).first(), 600);
        },
      },
      {
        say: 'Your meal is held just for you while you check out, so nobody else can grab it.',
        run: async ({ drv }) => {
          await drv.ring(drv.page.getByText('7-Minute Reservation Hold').locator('xpath=../..'), 3200);
          await drv.unring();
          await drv.click(drv.page.getByRole('button', { name: /Confirm & Lock/ }), 1500);
        },
      },
      {
        say: 'You\'ll get a pickup pass with a four digit PIN. Show it at the counter, and enjoy your meal.',
        run: async ({ drv }) => {
          await drv.sleep(600);
          await drv.ring(drv.page.getByText('Instant 4-Digit Redemption PIN').locator('xpath=..'), 4200);
          await drv.unring();
        },
      },
      {
        say: 'Great food, less waste. Happy eating, St. John\'s!',
        after: 2.2,
        run: async ({ drv }) => drv.goto(sting("Happy eating, *St. John's!*"), { cursor: false }),
      },
    ],
  },

  restaurant: {
    file: 'last-bite-restaurants.mp4',
    posterAt: 6,
    // A second browser tab plays the customer, so there is a real order to redeem
    setup: async ({ helper, base }) => {
      await helper.goto(`${base}/consumer`);
      await helper.waitForTimeout(1500);
    },
    scenes: [
      {
        say: 'Running a kitchen in St. John\'s? Meet Last Bite.',
        after: 0.4,
        run: async ({ drv }) => drv.goto(sting(), { cursor: false }),
      },
      {
        say: 'Canceled orders, extra prep, end of shift leftovers. Last Bite turns that surplus into revenue, instead of waste.',
        run: async ({ drv }) => {
          await drv.goto('/kitchen');
          await drv.sleep(1800);
          await drv.ring(drv.page.getByText('Select Restaurant Terminal').locator('xpath=../../..'), 3500);
          await drv.unring();
        },
      },
      {
        say: 'Sign in on your kitchen tablet with your restaurant\'s four digit PIN.',
        run: async ({ drv }) => {
          await drv.click(drv.page.getByRole('button', { name: /YellowBelly Brewery/ }).first(), 500);
          for (const d of '4444') await drv.click(digit(drv.page, d), 120, 280);
          await drv.sleep(1200);
        },
      },
      {
        say: 'Pick a dish from your preset menu, and choose your discount.',
        run: async ({ drv }) => {
          await drv.click(drv.page.getByRole('button', { name: /Fish & Chips/ }).first(), 900);
          await drv.click(drv.page.getByRole('button', { name: '60% Off', exact: true }), 800);
          await drv.ring(drv.page.getByText('Bite Rescue Price:').locator('xpath=..'), 1800);
          await drv.unring();
        },
      },
      {
        say: 'Tell customers why it\'s available, and set a pickup window.',
        run: async ({ drv }) => {
          await drv.click(drv.page.getByRole('button', { name: /Kitchen Error/ }), 900);
          await drv.click(drv.page.getByRole('button', { name: '45 mins', exact: true }), 700);
        },
      },
      {
        say: 'One tap, and it\'s live for hungry customers nearby.',
        run: async ({ drv, helper }) => {
          await drv.click(drv.page.getByRole('button', { name: /Drop to Live Marketplace/ }), 1200);
          await drv.ring(drv.page.getByText('Live Inventory on Feed').locator('xpath=../../..'), 2200);
          await drv.unring();
          // Meanwhile, a customer claims YellowBelly's short rib on their phone
          await helper.getByRole('button', { name: 'Pub Fare', exact: true }).click();
          await helper.waitForTimeout(300);
          await helper.getByRole('button', { name: /Claim Now/ }).last().click();
          await helper.getByRole('button', { name: /Confirm & Lock/ }).click();
          await helper.waitForTimeout(1500);
        },
      },
      {
        say: 'When a customer arrives, open Redemption, enter their PIN, and you\'re paid instantly.',
        run: async ({ drv }) => {
          const page = drv.page;
          await drv.click(page.getByRole('button', { name: /Redemption POS/ }), 900);
          const pinText = await page.getByText(/^PIN: \d{4}$/).first().textContent();
          await drv.ring(page.getByText(/^PIN: \d{4}$/).first().locator('xpath=../../../..'), 1500);
          await drv.unring();
          for (const d of pinText.slice(-4)) await drv.click(digit(page, d), 120, 300);
          await drv.click(page.getByRole('button', { name: /Verify PIN & Fulfill Order/ }), 900);
          await page.evaluate(() => window.scrollTo({ top: 0, behavior: 'smooth' }));
          await drv.sleep(700);
          await drv.ring(page.getByText('Fulfillment Complete · Payout Released').locator('xpath=../../..'), 2200);
          await drv.unring();
        },
      },
      {
        say: 'Less waste, more guests. Happy cooking, zero waste!',
        after: 2.2,
        run: async ({ drv }) => drv.goto(sting('Happy cooking, *zero waste.*'), { cursor: false }),
      },
    ],
  },
};
