-- Add phone, business_address, and mailing_address to profiles table
ALTER TABLE profiles
ADD COLUMN IF NOT EXISTS phone TEXT,
ADD COLUMN IF NOT EXISTS business_address JSONB DEFAULT '{}'::jsonb,
ADD COLUMN IF NOT EXISTS mailing_address JSONB DEFAULT '{}'::jsonb;

-- Add indexes for address fields (for potential future querying)
CREATE INDEX IF NOT EXISTS profiles_phone_idx ON profiles(phone);

-- Add comment describing the address JSONB structure
COMMENT ON COLUMN profiles.business_address IS 'Business address with fields: street, city, state, zip, country';
COMMENT ON COLUMN profiles.mailing_address IS 'Mailing address with fields: street, city, state, zip, country. Can be same as business address.';
