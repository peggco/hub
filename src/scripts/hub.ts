import {
  formatNumber,
  getApiInfo,
  installCommand,
  listSkills,
  skillPath,
  monogram,
  type Skill,
} from '../lib/api'
import { copyText } from '../lib/clipboard'

const PAGE_SIZE = 24

const COPY_ICON =
  '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="9" y="9" width="12" height="12" rx="2"></rect><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"></path></svg>'

const CHECK_ICON =
  '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="m20 6-11 11-5-5"></path></svg>'

const ARROW_ICON =
  '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M5 12h14M13 6l6 6-6 6"></path></svg>'

function icon(markup: string, className = ''): SVGElement {
  const wrap = document.createElement('span')
  wrap.innerHTML = markup
  const svg = wrap.firstElementChild as SVGElement
  if (className) svg.setAttribute('class', className)
  return svg
}

function skeletonCards(count: number): DocumentFragment {
  const frag = document.createDocumentFragment()

  for (let i = 0; i < count; i++) {
    const card = document.createElement('div')
    card.className = 'skeleton-card'
    card.setAttribute('aria-hidden', 'true')

    const mark = document.createElement('div')
    mark.className = 'sk sk-mark'

    const title = document.createElement('div')
    title.className = 'sk sk-title'

    const line = document.createElement('div')
    line.className = 'sk sk-line'

    const foot = document.createElement('div')
    foot.className = 'sk sk-foot'

    card.append(mark, title, line, foot)
    frag.append(card)
  }

  return frag
}

function flash(button: HTMLButtonElement, label: string) {
  const labelEl = button.querySelector<HTMLElement>('.install-label')
  const previous = labelEl?.textContent ?? 'Install'
  button.classList.add('is-copied')
  button.replaceChildren(icon(CHECK_ICON))
  const span = document.createElement('span')
  span.className = 'install-label'
  span.textContent = label
  button.append(span)

  window.setTimeout(() => {
    button.classList.remove('is-copied')
    button.replaceChildren(icon(COPY_ICON))
    const restored = document.createElement('span')
    restored.className = 'install-label'
    restored.textContent = previous
    button.append(restored)
  }, 1800)
}

function makeCard(skill: Skill): HTMLElement {
  const command = installCommand(skill)

  const card = document.createElement('article')
  card.className = 'skill-card'

  const top = document.createElement('div')
  top.className = 'card-top'

  const mark = document.createElement('div')
  mark.className = 'skill-mark'
  mark.setAttribute('aria-hidden', 'true')
  mark.textContent = monogram(skill.name)

  const actions = document.createElement('div')
  actions.className = 'card-actions'

  const status = document.createElement('span')
  status.className = `status${skill.isOfficial ? ' is-official' : ''}`
  const dot = document.createElement('span')
  dot.className = 'status-dot'
  status.append(dot, document.createTextNode(skill.isOfficial ? 'Official' : 'Community'))

  const install = document.createElement('button')
  install.type = 'button'
  install.className = 'install-btn'
  install.title = `Copy: ${command}`
  install.setAttribute('aria-label', `Copy install command for ${skill.name}`)
  install.append(icon(COPY_ICON))
  const installLabel = document.createElement('span')
  installLabel.className = 'install-label'
  installLabel.textContent = 'Install'
  install.append(installLabel)

  install.addEventListener('click', async (event) => {
    event.preventDefault()
    event.stopPropagation()
    const ok = await copyText(command)
    flash(install, ok ? 'Copied' : 'Failed')
  })

  actions.append(status, install)
  top.append(mark, actions)

  const title = document.createElement('h2')
  title.className = 'card-title'
  const link = document.createElement('a')
  link.className = 'card-link'
  link.href = skillPath(skill)
  link.textContent = skill.name
  title.append(link)

  const source = document.createElement('p')
  source.className = 'card-source'
  source.textContent = skill.source
  source.title = skill.source

  const foot = document.createElement('div')
  foot.className = 'card-foot'

  const license = document.createElement('span')
  if (skill.license) {
    license.className = 'chip'
    license.textContent = skill.license
  } else {
    license.className = 'chip is-muted'
    license.textContent = 'No license'
  }

  const arrow = document.createElement('span')
  arrow.className = 'card-arrow'
  arrow.append(icon(ARROW_ICON))

  foot.append(license, arrow)
  card.append(top, title, source, foot)

  return card
}

function emptyState(
  title: string,
  message: string,
  action?: { label: string; onClick: () => void }
): HTMLElement {
  const box = document.createElement('div')
  box.className = 'empty'
  box.style.gridColumn = '1 / -1'

  const mark = document.createElement('div')
  mark.className = 'empty-mark'
  mark.textContent = '∞'

  const heading = document.createElement('h2')
  heading.textContent = title

  const text = document.createElement('p')
  text.textContent = message

  box.append(mark, heading, text)

  if (action) {
    const button = document.createElement('button')
    button.type = 'button'
    button.className = 'btn btn-outline'
    button.textContent = action.label
    button.addEventListener('click', action.onClick)
    box.append(button)
  }

  return box
}

export function initHub() {
  const grid = document.getElementById('skill-grid')
  const search = document.getElementById('skill-search') as HTMLInputElement | null
  const results = document.getElementById('results-count')
  const loadMore = document.getElementById('load-more') as HTMLButtonElement | null
  const clear = document.getElementById('clear-filters') as HTMLButtonElement | null
  const segments = Array.from(
    document.querySelectorAll<HTMLButtonElement>('[data-official]')
  )
  const stats = document.getElementById('hero-stats')
  const statTotal = document.querySelector<HTMLElement>('[data-stat-total]')
  const statSources = document.querySelector<HTMLElement>('[data-stat-sources]')

  if (!grid) return

  const params = new URLSearchParams(window.location.search)
  const state = {
    q: params.get('q') ?? '',
    official:
      params.get('official') === 'true'
        ? true
        : params.get('official') === 'false'
          ? false
          : undefined,
    cursor: 0 as number | null,
    count: 0,
    loading: false,
    request: 0,
    controller: null as AbortController | null,
  }

  if (search) search.value = state.q

  const syncSegments = () => {
    for (const button of segments) {
      const value = button.dataset.official
      const active =
        (value === 'all' && state.official === undefined) ||
        (value === 'true' && state.official === true) ||
        (value === 'false' && state.official === false)
      button.setAttribute('aria-pressed', String(active))
    }
  }

  const syncUrl = () => {
    const next = new URLSearchParams()
    if (state.q) next.set('q', state.q)
    if (state.official !== undefined) next.set('official', String(state.official))
    const query = next.toString()
    const url = `${window.location.pathname}${query ? `?${query}` : ''}`
    window.history.replaceState(null, '', url)
  }

  const updateCount = (hasMore: boolean) => {
    if (!results) return
    if (state.count === 0) {
      results.textContent = 'No skills'
      return
    }
    results.textContent = `${formatNumber(state.count)}${hasMore ? '+' : ''} skill${state.count === 1 ? '' : 's'}`
  }

  const updateClear = () => {
    if (!clear) return
    clear.hidden = !state.q && state.official === undefined
  }

  const load = async (reset: boolean) => {
    if (state.loading && !reset) return

    state.controller?.abort()
    const controller = new AbortController()
    state.controller = controller
    const request = ++state.request
    state.loading = true

    if (reset) {
      state.count = 0
      state.cursor = null
      grid.setAttribute('aria-busy', 'true')
      grid.replaceChildren(skeletonCards(6))
      if (results) results.textContent = 'Loading skills…'
      if (loadMore) loadMore.hidden = true
    } else if (loadMore) {
      loadMore.disabled = true
      loadMore.textContent = 'Loading…'
    }

    try {
      const data = await listSkills(
        {
          q: state.q || undefined,
          official: state.official,
          limit: PAGE_SIZE,
          cursor: reset ? 0 : (state.cursor ?? 0),
        },
        controller.signal
      )

      if (request !== state.request) return

      if (reset) grid.replaceChildren()

      if (data.items.length === 0 && state.count === 0) {
        grid.replaceChildren(
          emptyState(
            'No skills found',
            state.q || state.official !== undefined
              ? 'Try a different search term or clear the filters.'
              : 'The skill directory is empty right now. Check back soon.',
            {
              label: 'Clear filters',
              onClick: () => {
                state.q = ''
                state.official = undefined
                if (search) search.value = ''
                syncSegments()
                updateClear()
                syncUrl()
                void load(true)
              },
            }
          )
        )
      } else {
        const frag = document.createDocumentFragment()
        for (const skill of data.items) frag.append(makeCard(skill))
        grid.append(frag)
      }

      state.count += data.items.length
      state.cursor = data.nextCursor
      updateCount(data.nextCursor !== null)
      updateClear()
    } catch (error) {
      if (controller.signal.aborted || request !== state.request) return

      if (reset) {
        state.cursor = null
        grid.replaceChildren(
          emptyState(
            'Could not load skills',
            'The Skills API did not respond. Check your connection and try again.',
            { label: 'Try again', onClick: () => void load(true) }
          )
        )
        if (results) results.textContent = 'Request failed'
      } else if (results) {
        results.textContent = `${formatNumber(state.count)} skills · load failed`
      }
    } finally {
      if (request === state.request) {
        state.loading = false
        grid.removeAttribute('aria-busy')
        if (loadMore) {
          loadMore.disabled = false
          loadMore.textContent = 'Load more'
          loadMore.hidden = !state.cursor
        }
      }
    }
  }

  let timer: number | undefined

  const schedule = () => {
    window.clearTimeout(timer)
    timer = window.setTimeout(() => {
      syncUrl()
      void load(true)
    }, 280)
  }

  search?.addEventListener('input', () => {
    state.q = search.value.trim()
    updateClear()
    schedule()
  })

  search?.addEventListener('keydown', (event) => {
    if (event.key === 'Enter') {
      event.preventDefault()
      window.clearTimeout(timer)
      syncUrl()
      void load(true)
    } else if (event.key === 'Escape') {
      search.value = ''
      state.q = ''
      updateClear()
      syncUrl()
      void load(true)
    }
  })

  for (const button of segments) {
    button.addEventListener('click', () => {
      const value = button.dataset.official
      state.official = value === 'true' ? true : value === 'false' ? false : undefined
      syncSegments()
      syncUrl()
      void load(true)
    })
  }

  clear?.addEventListener('click', () => {
    state.q = ''
    state.official = undefined
    if (search) search.value = ''
    syncSegments()
    updateClear()
    syncUrl()
    void load(true)
  })

  loadMore?.addEventListener('click', () => {
    if (state.cursor !== null) void load(false)
  })

  document.addEventListener('keydown', (event) => {
    const target = event.target as HTMLElement | null
    const typing =
      target?.tagName === 'INPUT' ||
      target?.tagName === 'TEXTAREA' ||
      target?.isContentEditable

    if (event.key === '/' && !typing && search) {
      event.preventDefault()
      search.focus()
    }
  })

  syncSegments()
  updateClear()

  void load(true)

  if (statTotal || statSources) {
    getApiInfo()
      .then((info) => {
        if (statTotal) statTotal.textContent = formatNumber(info.total)
        if (statSources) statSources.textContent = formatNumber(info.sources)
        if (stats) stats.hidden = false
      })
      .catch(() => {
        if (stats) stats.hidden = true
      })
  }
}
