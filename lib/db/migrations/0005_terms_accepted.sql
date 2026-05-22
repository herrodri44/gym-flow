-- Add terms acceptance tracking to gym admin profiles.
-- termsAcceptedAt is null until the admin accepts the Terms of Service on first login.
ALTER TABLE profiles ADD COLUMN terms_accepted_at timestamptz;
