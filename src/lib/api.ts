export const API_BASE = (
  import.meta.env.PUBLIC_API_BASE || 'https://hub-api.pegg.dev/v1'
).replace(/\/+$/, '')

export type Skill = {
  name: string
  skillId: string
  source: string
  isOfficial: boolean
  url: string
  license?: string
}

export type SkillList = {
  items: Skill[]
  nextCursor: number | null
}

export type ApiInfo = {
  name: string
  version: string
  total: number
  sources: number
  dataUrl: string
  endpoints: string[]
}

export type ListQuery = {
  q?: string
  source?: string
  official?: boolean
  license?: string
  limit?: number
  cursor?: number
}

const JSON_HEADERS = { Accept: 'application/json' }

export class ApiError extends Error {
  status: number

  constructor(status: number, message: string) {
    super(message)
    this.name = 'ApiError'
    this.status = status
  }
}

function timeout(ms = 12_000) {
  return typeof AbortSignal !== 'undefined' && 'timeout' in AbortSignal
    ? AbortSignal.timeout(ms)
    : undefined
}

async function getJSON<T>(url: string, signal?: AbortSignal): Promise<T> {
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), 12_000)
  const abort = () => controller.abort()

  if (signal?.aborted) controller.abort()
  else signal?.addEventListener('abort', abort, { once: true })

  try {
    const res = await fetch(url, {
      headers: JSON_HEADERS,
      signal: controller.signal,
    })

    if (!res.ok) {
      if (res.status === 404) throw new ApiError(404, 'not_found')
      throw new ApiError(res.status, `Request failed (${res.status})`)
    }

    return (await res.json()) as T
  } finally {
    clearTimeout(timer)
    signal?.removeEventListener('abort', abort)
  }
}

export async function getApiInfo(signal?: AbortSignal): Promise<ApiInfo> {
  return getJSON<ApiInfo>(API_BASE, signal)
}

export async function listSkills(
  query: ListQuery = {},
  signal?: AbortSignal
): Promise<SkillList> {
  const params = new URLSearchParams()
  const fields = 'name,skillId,source,isOfficial,url,license'

  if (query.q) params.set('q', query.q)
  if (query.source) params.set('source', query.source)
  if (typeof query.official === 'boolean') {
    params.set('official', String(query.official))
  }
  if (query.license) params.set('license', query.license)
  params.set('fields', fields)
  params.set('limit', String(query.limit ?? 24))
  if (typeof query.cursor === 'number' && query.cursor > 0) {
    params.set('cursor', String(query.cursor))
  }

  return getJSON<SkillList>(`${API_BASE}/skills?${params}`, signal)
}

export async function getSkill(
  source: string,
  skillId: string,
  signal?: AbortSignal
): Promise<Skill> {
  return getJSON<Skill>(skillEndpoint(source, skillId), signal)
}

export function skillEndpoint(source: string, skillId: string): string {
  const encodedSource = source
    .split('/')
    .map((part) => encodeURIComponent(part))
    .join('/')

  return `${API_BASE}/skills/${encodedSource}/${encodeURIComponent(skillId)}`
}

export function skillPath(skill: Pick<Skill, 'source' | 'skillId'>): string {
  const source = skill.source
    .split('/')
    .map((part) => encodeURIComponent(part))
    .join('/')

  return `/skills/${source}/${encodeURIComponent(skill.skillId)}`
}

export function parseSkillPath(pathname: string): {
  source: string
  skillId: string
} | null {
  const raw = pathname.replace(/^\/skills\/?/, '').replace(/\/+$/, '')
  if (!raw) return null

  const parts = raw
    .split('/')
    .filter(Boolean)
    .map((part) => {
      try {
        return decodeURIComponent(part)
      } catch {
        return part
      }
    })

  if (parts.length < 2) return null

  const skillId = parts.pop()!
  return { source: parts.join('/'), skillId }
}

const GITHUB_SOURCE = /^[A-Za-z0-9._-]+\/[A-Za-z0-9._-]+$/

export function isGitHubSource(source: string): boolean {
  return GITHUB_SOURCE.test(source)
}

export function githubUrl(source: string): string | null {
  return isGitHubSource(source) ? `https://github.com/${source}` : null
}

export function rawReadmeUrl(source: string): string | null {
  return isGitHubSource(source)
    ? `https://raw.githubusercontent.com/${source}/HEAD/README.md`
    : null
}

export async function getReadme(source: string): Promise<string | null> {
  const raw = rawReadmeUrl(source)
  if (!raw) return null

  try {
    const res = await fetch(raw, { signal: timeout(15_000) })
    if (res.ok) return await res.text()
  } catch {
    // fall through to the API
  }

  try {
    const encoded = source
      .split('/')
      .map((part) => encodeURIComponent(part))
      .join('/')
    const res = await fetch(`${API_BASE}/readme/${encoded}`, {
      signal: timeout(15_000),
    })
    if (res.ok) return await res.text()
  } catch {
    // ignore
  }

  return null
}

export function installCommand(skill: Pick<Skill, 'source' | 'skillId'>): string {
  return `pegg skills add ${skill.source}/${skill.skillId}`
}

export function monogram(value: string): string {
  const words = value.split(/[^A-Za-z0-9]+/).filter(Boolean)

  if (words.length >= 2) {
    return `${words[0][0] ?? ''}${words[1][0] ?? ''}`.toUpperCase()
  }

  const compact = value.replace(/[^A-Za-z0-9]/g, '')
  return compact.slice(0, 2).toUpperCase() || '∞'
}

export function formatNumber(value: number): string {
  return new Intl.NumberFormat('en-US').format(value)
}
