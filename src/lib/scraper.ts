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
		// defining the fake agent and browser
		const agent = randomUserAgent.getRandom();
		const browser = await playwright.chromium.launch({
			headless: true,
			channel: 'msedge',
		});
		const context = await browser.newContext({
			bypassCSP: true,
			userAgent: agent,
			viewport: { width: 1600, height: 900 },
			screen: { width: 1600, height: 900 },
		});
		const page = await context.newPage();

		// navigating to the amazon.com homepage
		await page.goto('https://www.amazon.com');
		await page.waitForLoadState('domcontentloaded');
		await page.waitForSelector('input.nav-input', { state: 'attached' });

		// fill the search box
		await page.fill('input.nav-input', search);
		await page.keyboard.press('Enter');

		// wait for the page to load
		await page.waitForSelector('div.s-result-item', { state: 'attached' });
		await page.waitForSelector('.s-pagination-item.s-pagination-next', {
			state: 'attached',
		});

		// scraping the data till the last available page
		let isNextEnabled: boolean = true;
		const products: Array<TProduct> = [];

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

			// validating the availability of the next button in pagination then deciding whether to paginate or stop.
			const NEXT_BUTTON_SELECTOR: string =
				'a.s-pagination-item.s-pagination-next.s-pagination-button';

			const NEXT_BUTTON_DISABLED_SELECTOR: string =
				'span.s-pagination-item.s-pagination-next.s-pagination-disabled';

			const nextButtonDisabledElement = await page.$(
				NEXT_BUTTON_DISABLED_SELECTOR,
			);
			const nextButtonElement = await page.$(NEXT_BUTTON_SELECTOR);

			if (!nextButtonDisabledElement && !nextButtonElement) {
				console.log('error both elements not found!');
				isNextEnabled = false;
				await browser.close();
				break;
			} else if (nextButtonElement) {
				console.log('Button is enabled');
				await page.click(NEXT_BUTTON_SELECTOR);
				await page.waitForLoadState('domcontentloaded');
				await page.waitForSelector('div.s-result-item', { state: 'attached' });
				await page.waitForSelector('.s-pagination-item.s-pagination-next', {
					state: 'attached',
				});
				continue;
			} else if (nextButtonDisabledElement) {
				console.log('Button is disabled');
				isNextEnabled = false;
			} else {
				console.error('error occured while looping');
				break;
			}
		}

		// Ensure the 'scraped' directory exists
		const scrapedDirectory = path.join(process.cwd(), 'scraped');
		if (!fs.existsSync(scrapedDirectory)) {
			fs.mkdirSync(scrapedDirectory);
		}

		// Define the target path for the JSON file
		const TARGET_PATH = path.join(scrapedDirectory, `${search}.json`);

		try {
			// Convert the products array to a JSON string with indentation for readability
			const productsJson = JSON.stringify(products, null, 2);

			// Write the JSON string to the file asynchronously
			await fs.promises.writeFile(TARGET_PATH, productsJson, 'utf-8');
			console.log(`Data saved to ${search}.json successfully`);
		} catch (err) {
			console.error(`Error while writing data to ${search}.json`, err);
		}

		// Close the browser
		await browser.close();
	} catch (error) {
		console.error(error);
		process.exit(1);
	}
}

export default Scraper;
