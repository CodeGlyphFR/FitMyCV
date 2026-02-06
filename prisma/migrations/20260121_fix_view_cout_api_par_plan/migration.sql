-- FixView: Recreate view with proper DROP + CREATE syntax
-- This migration ensures the view is properly recreated

DROP VIEW IF EXISTS v_cout_api_par_plan;

CREATE VIEW v_cout_api_par_plan AS
WITH user_monthly_costs AS (
  SELECT
    s."userId",
    sp.name as plan,
    sp."priceMonthly" as prix_mensuel,
    COALESCE(SUM(u."estimatedCost"), 0) as cout_mensuel_api
  FROM "Subscription" s
  INNER JOIN "SubscriptionPlan" sp ON s."planId" = sp.id
  LEFT JOIN "OpenAIUsage" u ON s."userId" = u."userId"
    AND u.date >= DATE_TRUNC('month', CURRENT_DATE)
    AND u.date < DATE_TRUNC('month', CURRENT_DATE) + INTERVAL '1 month'
  WHERE s.status = 'active'
  GROUP BY s."userId", sp.name, sp."priceMonthly"
)
SELECT
  plan,
  prix_mensuel,
  COALESCE(MIN(cout_mensuel_api), 0) as cout_min_api,
  COALESCE(AVG(cout_mensuel_api), 0) as cout_moyen_api,
  COALESCE(MAX(cout_mensuel_api), 0) as cout_max_api
FROM user_monthly_costs
GROUP BY plan, prix_mensuel
ORDER BY prix_mensuel ASC;
