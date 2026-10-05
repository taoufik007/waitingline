-- Approbation manuelle du compte elfaroukikamal26@gmail.com
-- (équivalent de POST /api/approvals/approve : approved = true, approvedAt = maintenant)
UPDATE "accounts"
SET "data" = "data"
  || jsonb_build_object('approved', true, 'approvedAt', (extract(epoch from now()) * 1000)::bigint)
WHERE "email" = 'elfaroukikamal26@gmail.com';
