// Régénère les captures d'écran utilisées par methodologie.html (dossier docs/).
// Utilise le mode démo (données fictives, rien n'est enregistré).
//   python3 -m http.server 8765   (à la racine du projet)
//   node tools/captures.js         (Playwright requis)
const { chromium, devices } = require('playwright');
const path = require('path');
const OUT = path.join(__dirname, '..', 'docs');
const URL = process.env.ALCYON_URL || 'http://localhost:8765/';

(async () => {
  const browser = await chromium.launch();
  const ctx = await browser.newContext({ ...devices['iPhone 13'], colorScheme: 'light' });
  const page = await ctx.newPage();
  const shot = async (name, locator, opts = {}) => {
    await locator.scrollIntoViewIfNeeded();
    await page.waitForTimeout(150);
    await locator.screenshot({ path: path.join(OUT, name + '.jpg'), type: 'jpeg', quality: 82, ...opts });
    console.log('✓', name);
  };
  await page.goto(URL + '?demo');
  // captures sans le bandeau « mode démo », avec 3 symptômes pour une saisie lisible
  await page.addStyleTag({ content: '.demo-bar{display:none!important} .top{position:static!important}' });
  await page.evaluate(() => {
    settings.symptoms = ['irrit', 'anxiety', 'thoughts'];
    renderSymptomInputs(); renderSignInputs();
  });

  // 1. Saisie
  await page.click('[data-tab=today]');
  await page.evaluate(() => fillForm(today(), 's'));
  await shot('01-saisie', page.locator('#entry'));

  // 2. Phase, direction et alertes
  await shot('02-alertes', page.locator('#status'));
  await shot('03-que-faire', page.locator('#alerts .action'));
  await shot('03b-alerte', page.locator('#alerts .alert').first());

  // 3. Historique
  await page.click('[data-tab=history]');
  await page.click('[data-range="365"]');
  await shot('04-annee', page.locator('#chart-mood').locator('xpath=..'));
  await page.click('[data-range="30"]');
  await shot('05-mois', page.locator('#chart-mood').locator('xpath=..'));
  await page.click('[data-range="90"]');
  await shot('06-symptomes', page.locator('#card-symptoms'));
  await shot('07-traitement', page.locator('#card-treat-impact .impact-item').first());

  // 4. Récapitulatif
  await page.click('#open-report');
  await page.waitForTimeout(300);
  const rp = page.locator('#report-body');
  const box = await rp.boundingBox();
  await rp.scrollIntoViewIfNeeded();
  await page.screenshot({ path: path.join(OUT, '08-recap.jpg'), type: 'jpeg', quality: 82, fullPage: true,
    clip: { x: box.x, y: box.y, width: box.width, height: Math.min(box.height, 760) } });
  console.log('✓ 08-recap');

  // 5. Réglages
  await page.click('[data-tab=settings]');
  await shot('10-etalonnage', page.locator('#cal-card'));

  await browser.close();
})();
