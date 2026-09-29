/**
 * Supabase Browser Client configuration for Next.js 15
 */

export const getSupabaseConfig = () => {
  const url = (typeof process !== 'undefined' && process.env?.NEXT_PUBLIC_SUPABASE_URL) || 
              (typeof window !== 'undefined' && (window as unknown as { env?: Record<string, string> }).env?.NEXT_PUBLIC_SUPABASE_URL) || 
              'https://mock-lastbite-supabase.supabase.co';
  const anonKey = (typeof process !== 'undefined' && process.env?.NEXT_PUBLIC_SUPABASE_ANON_KEY) || 
                  'mock-anon-key-last-bite-production';
  return { url, anonKey };
};
