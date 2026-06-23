-- Remove legacy bootstrap assets and alerts that were seeded with non-Kenyan coordinates.
-- These rows pollute the intelligence layer and should not remain in a Kenya-focused deployment.

DELETE FROM public.alerts
WHERE (
  latitude IS NOT NULL AND longitude IS NOT NULL AND
  (latitude < -5.5 OR latitude > 5.5 OR longitude < 33 OR longitude > 42.5)
);

DELETE FROM public.infrastructure_assets
WHERE
  (
    latitude < -5.5 OR latitude > 5.5 OR longitude < 33 OR longitude > 42.5
  )
  AND COALESCE(source_system, 'manual') = 'manual'
  AND external_id IS NULL;
