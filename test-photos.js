const axios = require('axios');
const RAPIDAPI_KEY = 'e69f67142bmshedd97cdac0ca65bp1c1b13jsne15c476e71ba';

(async () => {
  console.log('=== Testing Photo Extraction ===\n');
  
  const r = await axios.get('https://realtor16.p.rapidapi.com/search/forsale', {
    params: { location: '96753', limit: 3, offset: 0 },
    headers: {
      'x-rapidapi-host': 'realtor16.p.rapidapi.com',
      'x-rapidapi-key': RAPIDAPI_KEY
    }
  });

  const listings = r.data.properties || [];
  console.log('Found', listings.length, 'properties\n');

  listings.forEach((prop, idx) => {
    console.log('Property', idx + 1 + ':', prop.location?.address?.line);
    console.log('  Price:', prop.list_price);
    console.log('  primary_photo:', prop.primary_photo?.href ? 'YES' : 'NO');
    console.log('  photos array:', Array.isArray(prop.photos) ? 'YES (' + prop.photos.length + ' items)' : 'NO');
    
    // Simulate mapping
    const photos = [];
    if (prop.primary_photo?.href) {
      photos.push({ url: prop.primary_photo.href, source: 'realtor.com' });
    }
    if (Array.isArray(prop.photos)) {
      for (const p of prop.photos) {
        const url = p?.href || p?.url || (typeof p === 'string' ? p : '');
        if (url) {
          const exists = photos.some((existing) => existing.url === url);
          if (!exists) {
            photos.push({ url, source: 'realtor.com' });
          }
        }
      }
    }
    
    console.log('  Mapped photos:', photos.length);
    if (photos.length > 0) {
      console.log('    First:', photos[0].url.substring(0, 100));
    }
    console.log();
  });
})().catch(e => console.error('Error:', e.message));
