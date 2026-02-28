require('dotenv').config();

const token = (process.env.LOGO_DEV_PUBLISHABLE_KEY || process.env.LOGO_DEV_TOKEN || '').trim();
const domains = ['southernhousing.org.uk', 'southernhousing.org', 'southernhousing.co.uk', 'southernhousinggroup.co.uk'];

async function main() {
  if (!token) {
    console.log('No LOGO_DEV token configured in web-client/.env');
    return;
  }

  for (const domain of domains) {
    const url = new URL(`https://img.logo.dev/${encodeURIComponent(domain)}`);
    url.searchParams.set('token', token);
    url.searchParams.set('format', 'png');
    url.searchParams.set('size', '128');
    url.searchParams.set('retina', 'true');
    url.searchParams.set('theme', 'dark');
    url.searchParams.set('fallback', '404');

    try {
      const response = await fetch(url.toString(), { method: 'GET' });
      const contentType = response.headers.get('content-type') || '';
      console.log(`${domain} -> status=${response.status} contentType=${contentType}`);
    } catch {
      console.log(`${domain} -> fetch error`);
    }
  }
}

main();
