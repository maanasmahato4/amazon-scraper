import Enquirer from 'enquirer';
import Scraper from './lib/scraper';

const enquirer = new Enquirer();

enquirer
	.prompt({
		type: 'input',
		name: 'search',
		message: 'Enter the product category/brand to be scraped',
	})
	.then(async (values: unknown) => {
		const options = values as { search: string };
		console.log('scrapper running...');
		await Scraper(options.search).then(() =>
			console.log('Request Data has been scraped!'),
		);
	})
	.catch((error) => console.error(error))
	.finally(() => process.exit());
