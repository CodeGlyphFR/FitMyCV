/**
 * GET /api/ext/credits/costs
 *
 * Extension proxy for feature costs.
 */

import { withExtensionAuth } from '@/lib/api/withExtensionAuth';
import { getBooleanSettingValue } from '@/lib/settings/settingsUtils';
import prisma from '@/lib/prisma';
import { CommonErrors } from '@/lib/api/apiErrors';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

const FEATURES = [
  'create_cv_manual',
  'edit_cv',
  'export_cv',
  'match_score',
  'translate_cv',
  'gpt_cv_generation',
  'optimize_cv',
  'generate_from_job_title',
  'import_pdf',
];

const DEFAULT_COSTS = {
  create_cv_manual: 1,
  edit_cv: 1,
  export_cv: 1,
  match_score: 1,
  translate_cv: 1,
  gpt_cv_generation: 2,
  optimize_cv: 2,
  generate_from_job_title: 3,
  import_pdf: 5,
};

export const GET = withExtensionAuth(async () => {
  try {
    const subscriptionModeEnabled = await getBooleanSettingValue('subscription_mode_enabled', true);

    if (subscriptionModeEnabled) {
      return Response.json({
        showCosts: false,
        subscriptionModeEnabled: true,
        costs: {},
      });
    }

    // Batch load all credit settings in a single query
    const settingNames = FEATURES.map(f => `credits_${f}`);
    const settings = await prisma.setting.findMany({
      where: { settingName: { in: settingNames } },
      select: { settingName: true, value: true },
    });

    const settingsMap = new Map(settings.map(s => [s.settingName, s.value]));
    const costs = {};
    for (const feature of FEATURES) {
      const raw = settingsMap.get(`credits_${feature}`);
      const parsed = raw != null ? parseInt(raw, 10) : NaN;
      costs[feature] = isNaN(parsed) ? (DEFAULT_COSTS[feature] ?? 1) : parsed;
    }

    return Response.json({
      showCosts: true,
      subscriptionModeEnabled: false,
      costs,
    });
  } catch (error) {
    console.error('[ext/credits/costs] Error:', error);
    return CommonErrors.serverError();
  }
});
