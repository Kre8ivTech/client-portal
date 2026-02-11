-- Add whatsapp_number to profiles table
ALTER TABLE profiles
ADD COLUMN IF NOT EXISTS whatsapp_number TEXT;

-- Add index for whatsapp_number (for potential future querying)
CREATE INDEX IF NOT EXISTS profiles_whatsapp_number_idx ON profiles(whatsapp_number);

-- Add comment describing the field
COMMENT ON COLUMN profiles.whatsapp_number IS 'WhatsApp number for contact purposes';
