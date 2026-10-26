// ========== SUPABASE CONFIG ==========
// Replace these two values with your own from Supabase → Project Settings → API
const SUPABASE_URL = 'https://aapkujuijsuuqkldkqui.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImFhcGt1anVpanN1dXFrbGRrcXVpIiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTI4MzkyNjMsImV4cCI6MjEwODQxNTI2M30.PV1aN3Ihk7TEOxuqwRDT7FMHQez6jL70sitIjI75u1o';


// Create client — named "sb" to avoid clashing with the CDN global "supabase"
const sb = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

// Categories used across the site
const CATEGORIES = [
  'ID Card / Documents',
  'Electronics',
  'Keys / Access cards',
  'Books / Stationery',
  'Clothing / Accessories',
  'Bags / Wallets',
  'Other'
];
