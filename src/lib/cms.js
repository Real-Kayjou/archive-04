// CMS adapter boundary. Replace this local source with Payload, Sanity, or another CMS later.
import { projects } from '../content/projects'

export async function getProjects() { return projects }

export function projectSchema() {
  return { id: 'string', title: 'string', type: 'string', note: 'string', status: 'in-progress | complete | failed-experiment', tools: 'string[]', description: 'rich text', media: 'media[]', link: 'url?' }
}
