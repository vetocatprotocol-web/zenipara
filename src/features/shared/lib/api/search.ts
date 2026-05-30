import { supabase } from '../supabase';

export type SearchResultType = 'task' | 'user' | 'announcement';

export interface SearchResult {
  id: string;
  type: SearchResultType;
  title: string;
  subtitle: string;
  role: string;
}

interface SearchAllParams {
  query: string;
  callerRole: string;
}

export async function searchAll(params: SearchAllParams): Promise<SearchResult[]> {
  const { query, callerRole } = params;
  const { data, error } = await supabase.rpc('api_search_all', {
    p_query: query,
    p_caller_role: callerRole,
  });

  if (error) throw error;

  return ((data ?? []) as Array<{
    id: string;
    type: SearchResultType;
    title: string;
    subtitle: string;
    role: string;
  }>).map((row) => ({
    id: row.id,
    type: row.type,
    title: row.title,
    subtitle: row.subtitle,
    role: row.role,
  }));
}
