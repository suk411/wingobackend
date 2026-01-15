import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

dotenv.config();

// Initialize Supabase client
const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_KEY;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseKey) {
  throw new Error('Missing SUPABASE_URL or SUPABASE_KEY in environment variables');
}

// Standard client (uses JWT from user session)
export const supabase = createClient(supabaseUrl, supabaseKey);

// Service role client (for admin operations without row-level security constraints)
export const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey || supabaseKey);

// Connection pool for raw database access (optional, for complex queries)
export const getSupabaseClient = () => supabase;
export const getSupabaseAdminClient = () => supabaseAdmin;

// Helper function to handle Supabase errors
export const handleSupabaseError = (error) => {
  if (error) {
    console.error('Supabase Error:', {
      message: error.message,
      code: error.code,
      status: error.status,
      details: error.details,
    });
  }
  return error;
};

// Test connection
export const testSupabaseConnection = async () => {
  try {
    const { data, error } = await supabase.from('admins').select('id').limit(1);
    if (error) {
      console.error('Supabase connection failed:', error);
      return false;
    }
    console.log('✓ Supabase connected successfully');
    return true;
  } catch (err) {
    console.error('Supabase connection error:', err.message);
    return false;
  }
};

export default supabase;
