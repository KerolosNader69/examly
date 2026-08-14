import { cache } from 'react';
import { createClient } from '@supabase/supabase-js';
import { supabase } from '@/lib/supabase';

export interface TeacherBranding {
  id: string;
  name: string;
  subdomain: string;
  logo_url: string | null;
  brand_color: string | null;
}

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://placeholder.supabase.co';
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

// Create admin client for public teacher branding lookups bypassing RLS on server
const dbClient = serviceRoleKey ? createClient(supabaseUrl, serviceRoleKey) : supabase;

/**
 * Resolves teacher branding by subdomain from Supabase `teachers` and `teacher_settings` tables.
 * Production domain is examly.site (e.g. ahmed.examly.site).
 * Cached per-request using React's cache helper.
 */
export const getTeacherBySubdomain = cache(
  async (subdomain: string): Promise<TeacherBranding | null> => {
    if (!subdomain) return null;

    const normalizedSubdomain = subdomain.toLowerCase().trim();

    try {
      // Query teachers table
      const { data: teacher, error } = await dbClient
        .from('teachers')
        .select('id, name, logo_url, brand_color, subdomain')
        .ilike('subdomain', normalizedSubdomain)
        .maybeSingle();

      if (error || !teacher) {
        return null;
      }

      let logoUrl = teacher.logo_url;
      let brandColor = teacher.brand_color;
      let displayName = teacher.name;

      // Query teacher_settings for potential overrides
      const { data: settings } = await dbClient
        .from('teacher_settings')
        .select('logo_url, primary_color, display_name')
        .eq('teacher_id', teacher.id)
        .maybeSingle();

      if (settings) {
        if (settings.logo_url) logoUrl = settings.logo_url;
        if (settings.primary_color) brandColor = settings.primary_color;
        if (settings.display_name) displayName = settings.display_name;
      }

      return {
        id: teacher.id,
        name: displayName,
        subdomain: teacher.subdomain,
        logo_url: logoUrl || null,
        brand_color: brandColor || null,
      };
    } catch (err) {
      console.error('Error fetching teacher by subdomain:', err);
      return null;
    }
  }
);

