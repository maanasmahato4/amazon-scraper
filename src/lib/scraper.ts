import playwright from 'playwright';
import randomUserAgent from 'random-useragent';
import * as fs from 'fs';
import * as path from 'path';

type TProduct = {
	img_url: string | null;
	productName: string | null;
	stars: string | null;
	price: string | null;
};

async function Scraper(search: string): Promise<void> {
	try {
		const agent = randomUserAgent.getRandom();
		const browser = await playwright.chromium.launch({
			headless: false,
			//channel: 'msedge',
			slowMo: 200,
		});
		const context = await browser.newContext({
			bypassCSP: true,
			userAgent: agent,
			viewport: { width: 1368, height: 768 },
		});
		const page = await context.newPage();
		await page.goto('https://www.amazon.com');
		await page.waitForLoadState('domcontentloaded');
		await page.waitForSelector('#twotabsearchtextbox', {state: 'attached'});

		// fill the search box
		const SEARCH_SELECTOR = '#twotabsearchtextbox' || '#nav-search-keywords';
		await page.fill(SEARCH_SELECTOR, search);
		await page.keyboard.press('Enter');

		// wait for the page to load
		await page.waitForSelector('div.s-result-item', { state: 'attached' });

		let isNextEnabled = true;
		const products: Array<TProduct> = [];
		const NEXT_BUTTON_SELECTOR =
			'a.s-pagination-item.s-pagination-next.s-pagination-button.s-pagination-separator';

		const NEXT_BUTTON_DISABLED_SELECTOR =
			'span.s-pagination-item.s-pagination-next.s-pagination-disabled';

		while (isNextEnabled) {
			const productsCollection = await page.$$eval(
				'div.s-result-item',
				(cards) => {
					return cards.map((item): TProduct => {
						const formatText = (el: HTMLElement | null) => el && el.innerText.trim();
						const imgElement = item.querySelector('img');
						const titleElement = item.querySelector('h2 > a > span');
						const stars = item.querySelector('span.a-class-alt');
						const price = item.querySelector('span.a-color-base');

						return {
							img_url: imgElement ? imgElement.getAttribute('src') : 'not available',
							productName: titleElement
								? formatText(titleElement as HTMLElement)
								: 'not available',
							stars: stars ? formatText(stars as HTMLElement) : 'not available',
							price: price ? formatText(price as HTMLElement) : 'not available',
						};
					});
				},
			);

			productsCollection.forEach((product) => {
				products.push(product);
			});

			isNextEnabled = (await page.$(NEXT_BUTTON_DISABLED_SELECTOR)) === null;
			console.log(isNextEnabled);
			if (isNextEnabled) {
				await page.click(NEXT_BUTTON_SELECTOR);
				await page.waitForSelector('div.s-result-item', { state: 'attached' });
			}
		}

		// uploading the scraped data into the scraped folder in json format with 'search'.json option as filename.
		const TARGET_PATH = path.join(process.cwd(), 'scraped', `${search}.json`);
		const productsJson = JSON.stringify(products, null, 2);
		if (!fs.existsSync('scraped')) {
			fs.mkdirSync('scraped');
		}

		fs.writeFile(TARGET_PATH, productsJson, 'utf-8', (err) => {
			if (err) console.error(`Error while writing data to ${search}.json`, err);
			else console.log(`Data saved to ${search}.json successfully`);
		});

		await browser.close();
	} catch (error) {
		console.error(error);
		process.exit(1);
	}
}

export default Scraper;
