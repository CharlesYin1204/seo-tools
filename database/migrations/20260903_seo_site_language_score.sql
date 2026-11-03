ALTER TABLE seo_sites
  ADD COLUMN primary_language VARCHAR(35) NULL AFTER normalized_host,
  ADD COLUMN detected_languages JSON NULL AFTER primary_language,
  ADD COLUMN language_source VARCHAR(30) NULL AFTER detected_languages,
  ADD COLUMN language_confidence DECIMAL(5,2) NULL AFTER language_source,
  ADD COLUMN last_score_model JSON NULL AFTER last_score,
  ADD COLUMN verification_file_path VARCHAR(255) NULL AFTER verification_token;
