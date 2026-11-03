UPDATE plans
SET entitlements = JSON_SET(entitlements, '$.scan_interval_hours',
  CASE code WHEN 'free' THEN 168 WHEN 'pro' THEN 24 WHEN 'team' THEN 6 ELSE 0 END)
WHERE code IN ('free', 'pro', 'team');
