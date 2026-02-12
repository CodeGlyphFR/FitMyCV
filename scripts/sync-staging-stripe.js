const Stripe = require('stripe');
const { Client } = require('pg');

async function syncStaging() {
  // On utilise les variables passées par le workflow
  const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);
  const pgClient = new Client({ connectionString: process.env.DATABASE_URL });
  
  await pgClient.connect();

  try {
    // 1. On récupère tous les prix actifs de ton Stripe Test 
    const prices = await stripe.prices.list({ 
      expand: ['data.product'], 
      active: true 
    });

    for (const price of prices.data) {
      const productName = price.product.name;
      const newPriceId = price.id;

      // 2. On met à jour la base Staging en faisant matcher le NOM du produit
      // On cible uniquement les plans qui existent déjà (clonés de la prod)
      const res = await pgClient.query(
        'UPDATE "Plan" SET "stripePriceId" = $1 WHERE "name" = $2',
        [newPriceId, productName]
      );
      
      if (res.rowCount > 0) {
        console.log(`✅ Synced: ${productName} -> ${newPriceId}`);
      }
    }
  } catch (err) {
    console.error('❌ Sync Error:', err);
    process.exit(1);
  } finally {
    await pgClient.end();
  }
}

syncStaging();
