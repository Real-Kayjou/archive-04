import { createClient } from '@supabase/supabase-js'

const url = import.meta.env.VITE_SUPABASE_URL
const key = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY

export const supabase = url && key ? createClient(url, key) : null

export function fromRow(row) {
  return {
    id: row.id,
    bucket: row.bucket,
    title: row.title,
    type: row.type,
    note: row.note,
    description: row.description,
    tools: Array.isArray(row.tools) ? row.tools : [],
    link: row.link,
    image: row.image,
    tone: row.tone,
    status: row.status,
    media: Array.isArray(row.media) ? row.media : [],
    logged: row.logged,
    files: row.files,
    sig: Number(row.sig) || .5,
  }
}

export function toRow(project, bucket) {
  return {
    id: String(project.id), bucket, title: project.title, type: project.type || 'PROJECT / NEW',
    note: project.note || '', description: project.description || '', tools: project.tools || [],
    link: project.link || '', image: project.image || '', tone: project.tone || 'iris',
    status: project.status || (bucket === 'dead' ? 'failed-experiment' : 'in-progress'),
    media: project.media || [], logged: project.logged || '', files: project.files || 0, sig: project.sig || .5,
  }
}
