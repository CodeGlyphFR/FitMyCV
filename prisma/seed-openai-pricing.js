// Script to seed OpenAI pricing data
// Run with: node prisma/seed-openai-pricing.js

const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

// Official OpenAI pricing (as of January 2025)
// Prices are per million tokens (MTok)
// Cache prices are typically 50% of input prices (prompt caching feature)
const pricingData = [
  // GPT-5 family
  {
    modelName: 'gpt-5-nano-2025-08-07',
    inputPricePerMToken: 0.10,
    outputPricePerMToken: 0.40,
    cachePricePerMToken: 0.05,
    description: 'GPT-5 Nano - Fast and economical model',
    isActive: true,
  },
  {
    modelName: 'gpt-5-mini-2025-08-07',
    inputPricePerMToken: 0.40,
    outputPricePerMToken: 1.60,
    cachePricePerMToken: 0.20,
    description: 'GPT-5 Mini - Standard model for most tasks',
    isActive: true,
  },
  {
    modelName: 'gpt-5-2025-08-07',
    inputPricePerMToken: 1.00,
    outputPricePerMToken: 4.00,
    cachePricePerMToken: 0.50,
    description: 'GPT-5 - Advanced model with extended context',
    isActive: true,
  },

  // GPT-4o family
  {
    modelName: 'gpt-4o-mini',
    inputPricePerMToken: 0.15,
    outputPricePerMToken: 0.60,
    cachePricePerMToken: 0.075,
    description: 'GPT-4o Mini - Affordable and intelligent small model',
    isActive: true,
  },
  {
    modelName: 'gpt-4o',
    inputPricePerMToken: 2.50,
    outputPricePerMToken: 10.00,
    cachePricePerMToken: 1.25,
    description: 'GPT-4o - Multimodal flagship model',
    isActive: true,
  },
  {
    modelName: 'gpt-4o-mini-tts',
    inputPricePerMToken: 0.15,
    outputPricePerMToken: 0.60,
    cachePricePerMToken: 0.075,
    description: 'GPT-4o Mini TTS - Text-to-speech model',
    isActive: true,
  },
  {
    modelName: 'gpt-4o-mini-transcribe',
    inputPricePerMToken: 0.15,
    outputPricePerMToken: 0.60,
    cachePricePerMToken: 0.075,
    description: 'GPT-4o Mini Transcribe - Audio transcription model',
    isActive: true,
  },

  // GPT-4.1
  {
    modelName: 'gpt-4.1-2025-04-14',
    inputPricePerMToken: 2.00,
    outputPricePerMToken: 8.00,
    cachePricePerMToken: 1.00,
    description: 'GPT-4.1 - Improved reasoning model',
    isActive: true,
  },

  // OpenAI o-series (reasoning models)
  {
    modelName: 'o4-mini-deep-research-2025-06-26',
    inputPricePerMToken: 1.50,
    outputPricePerMToken: 6.00,
    cachePricePerMToken: 0.75,
    description: 'o4 Mini - Compact deep research reasoning model',
    isActive: true,
  },
  {
    modelName: 'o3-deep-research-2025-06-26',
    inputPricePerMToken: 5.00,
    outputPricePerMToken: 20.00,
    cachePricePerMToken: 2.50,
    description: 'o3 - Advanced deep research reasoning model',
    isActive: true,
  },

  // Open source models
  {
    modelName: 'gpt-oss-20b',
    inputPricePerMToken: 0.05,
    outputPricePerMToken: 0.20,
    cachePricePerMToken: 0.025,
    description: 'GPT OSS 20B - Open source 20B parameter model',
    isActive: true,
  },
  {
    modelName: 'gpt-oss-120b',
    inputPricePerMToken: 0.30,
    outputPricePerMToken: 1.20,
    cachePricePerMToken: 0.15,
    description: 'GPT OSS 120B - Open source 120B parameter model',
    isActive: true,
  },
];

async function main() {
  console.log('🌱 Seeding OpenAI pricing data...');

  for (const pricing of pricingData) {
    const result = await prisma.openAIPricing.upsert({
      where: { modelName: pricing.modelName },
      update: {
        inputPricePerMToken: pricing.inputPricePerMToken,
        outputPricePerMToken: pricing.outputPricePerMToken,
        cachePricePerMToken: pricing.cachePricePerMToken,
        description: pricing.description,
        isActive: pricing.isActive,
      },
      create: pricing,
    });

    console.log(`  ✓ ${result.modelName}: $${result.inputPricePerMToken}/$${result.outputPricePerMToken}/$${result.cachePricePerMToken} per MTok (input/output/cache)`);
  }

  // Create default alerts
  console.log('\n🔔 Creating default alerts...');

  const defaultAlerts = [
    {
      type: 'user_daily',
      threshold: 5.0,
      enabled: false,
      name: 'User Daily Limit',
      description: 'Alert when a user exceeds $5/day',
    },
    {
      type: 'user_monthly',
      threshold: 50.0,
      enabled: false,
      name: 'User Monthly Limit',
      description: 'Alert when a user exceeds $50/month',
    },
    {
      type: 'global_daily',
      threshold: 100.0,
      enabled: false,
      name: 'Global Daily Limit',
      description: 'Alert when total daily cost exceeds $100',
    },
    {
      type: 'global_monthly',
      threshold: 1000.0,
      enabled: false,
      name: 'Global Monthly Limit',
      description: 'Alert when total monthly cost exceeds $1000',
    },
  ];

  for (const alert of defaultAlerts) {
    // Check if alert already exists
    const existing = await prisma.openAIAlert.findFirst({
      where: { type: alert.type },
    });

    if (!existing) {
      const result = await prisma.openAIAlert.create({
        data: alert,
      });
      console.log(`  ✓ ${result.name}: $${result.threshold} (${result.enabled ? 'enabled' : 'disabled'})`);
    } else {
      console.log(`  ⊝ ${alert.name}: already exists`);
    }
  }

  console.log('\n✅ Seed completed successfully!');
}

main()
  .catch((e) => {
    console.error('❌ Error seeding data:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
