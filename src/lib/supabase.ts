import { createClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://dummy.supabase.co'
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || 'dummy_key'

export const supabase = createClient(supabaseUrl, supabaseAnonKey)

export type Database = {
    public: {
        Tables: {
            members: {
                Row: {
                    id: string
                    name: string
                    role: 'pi' | 'postdoc' | 'grad' | 'undergrad'
                    topic_ko: string
                    topic_en: string
                    progress: number
                    created_at: string
                }
            }
            posts: {
                Row: {
                    id: string
                    author_id: string
                    author_name: string
                    title: string
                    content: string
                    created_at: string
                }
            }
            comments: {
                Row: {
                    id: string
                    post_id: string
                    author_name: string
                    content: string
                    created_at: string
                }
            }
            events: {
                Row: {
                    id: string
                    title: string
                    date: string
                    type: 'seminar' | 'deadline' | 'meeting' | 'other'
                    created_by: string
                    created_at: string
                }
            }
        }
    }
}
