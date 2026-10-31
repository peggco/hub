import { marked } from 'marked'
import DOMPurify from 'dompurify'
import {
  getReadme,
  getSkill,
  githubUrl,
  installCommand,
  isGitHubSource,
  listSkills,
  parseSkillPath,
  skillEndpoint,
  skillPath,
  monogram,
  type Skill,
} from '../lib/api'
import { copyText } from '../lib/clipboard'

const COPY_ICON =
  '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="9" y="9" width="12" height="12" rx="2"></rect><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"></path></svg>'
const CHECK_ICON =
  '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="m20 6-11 11-5-5"></path></svg>'
const ARROW_ICON =
  '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M5 12h14M13 6l6 6-6 6"></path></svg>'

const MAX_README = 60_000

function esc(value: unknown): string {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
}

function setMeta(title: string, description: string) {
  document.title = title

  const descriptionMeta = document.querySelector('meta[name="description"]')
  if (descriptionMeta) descriptionMeta.setAttribute('content', description)

  const ogTitle = document.querySelector('meta[property="og:title"]')
  if (ogTitle) ogTitle.setAttribute('content', title)

  const ogDescription = document.querySelector('meta[property="og:description"]')
  if (ogDescription) ogDescription.setAttribute('content', description)
}

function notFound(): string {
  return `<div class="empty" style="margin-top: 48px">
    <div class="empty-mark">∞</div>
    <h1>Skill not found</h1>
    <p>This skill is not in the directory, or the URL is incomplete. Try searching the full library instead.</p>
    <a class="btn btn-primary" href="/">Browse all skills</a>
  </div>`
}

function errorState(): string {
  return `<div class="empty" style="margin-top: 48px">
    <div class="empty-mark">∞</div>
    <h1>Could not load this skill</h1>
    <p>The Skills API did not respond. Check your connection and reload the page.</p>
    <button class="btn btn-outline" type="button" id="reload-skill">Reload</button>
  </div>`
}

function metaRow(label: string, value: string): string {
  return `<div class="meta-row"><dt>${label}</dt><dd>${value}</dd></div>`
}

function detailMarkup(skill: Skill): string {
  const command = installCommand(skill)
  const github = skill.url || githubUrl(skill.source)
  const license = skill.license || 'No license'
  const status = skill.isOfficial ? 'Official' : 'Community'

  return `<a class="back-link" href="/">
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M19 12H5M11 18l-6-6 6-6"></path></svg>
      All skills
    </a>

    <div class="detail-head">
      <div class="detail-mark" aria-hidden="true">${esc(monogram(skill.name))}</div>
      <div>
        <div class="detail-kicker">
          <span class="pill${skill.isOfficial ? ' is-official' : ''}">
            <span class="pill-dot"></span>${status}
          </span>
        </div>
        <h1>${esc(skill.name)}</h1>
        <p class="detail-source">${esc(skill.source)}</p>
      </div>
    </div>

    <div class="install-bar">
      <span class="install-bar-label">Install</span>
      <div class="install-bar-main">
        <code class="install-command" id="install-command">${esc(command)}</code>
        <button class="copy-btn" id="copy-install" type="button" aria-label="Copy install command">
          ${COPY_ICON}<span>Copy</span>
        </button>
      </div>
    </div>

    <div class="detail-layout">
      <section class="panel readme-panel">
        <div class="panel-head">
          <h2>Repository README</h2>
          ${github
      ? `<a href="${esc(github)}" target="_blank" rel="noopener noreferrer">GitHub ↗</a>`
      : ``
    }
        </div>
        <p class="readme-note" id="readme-note">Shared by every skill in ${esc(skill.source)}.</p>
        <div class="prose" id="readme-content">
          <div class="sk" style="height: 13px; width: 82%; margin-bottom: 12px"></div>
          <div class="sk" style="height: 13px; width: 96%; margin-bottom: 12px"></div>
          <div class="sk" style="height: 13px; width: 68%; margin-bottom: 26px"></div>
          <div class="sk" style="height: 13px; width: 90%; margin-bottom: 12px"></div>
          <div class="sk" style="height: 13px; width: 74%"></div>
        </div>
      </section>

      <aside class="sidebar">
        <section class="panel meta-panel">
          <div class="panel-head"><h2>Details</h2></div>
          <dl class="meta-list">
            ${metaRow(
      'Source',
      github
        ? `<a href="${esc(github)}" target="_blank" rel="noopener noreferrer">${esc(skill.source)}</a>`
        : esc(skill.source)
    )}
            ${metaRow('Status', status)}
            ${metaRow('License', esc(license))}
            ${metaRow('Skill ID', esc(skill.skillId))}
          </dl>
        </section>

        <section class="panel more-panel" id="more-panel" hidden>
          <div class="panel-head"><h2>More from this source</h2></div>
          <div class="more-list" id="more-list"></div>
        </section>
      </aside>
    </div>`
}

function flashCopy(button: HTMLButtonElement) {
  button.classList.add('is-copied')
  button.innerHTML = `${CHECK_ICON}<span>Copied</span>`
  window.setTimeout(() => {
    button.classList.remove('is-copied')
    button.innerHTML = `${COPY_ICON}<span>Copy</span>`
  }, 1800)
}

function wireInstall(skill: Skill) {
  const button = document.getElementById('copy-install') as HTMLButtonElement | null
  if (!button) return

  const command = installCommand(skill)
  button.addEventListener('click', async () => {
    const ok = await copyText(command)
    if (ok) flashCopy(button)
  })
}

function readmeError(message: string, href?: string) {
  const content = document.getElementById('readme-content')
  if (!content) return
  const note = document.getElementById('readme-note')
  if (note) note.hidden = true

  const box = document.createElement('div')
  box.className = 'readme-error'
  box.textContent = message

  if (href) {
    box.append(document.createTextNode(' '))
    const link = document.createElement('a')
    link.href = href
    link.target = '_blank'
    link.rel = 'noopener noreferrer'
    link.textContent = 'Open the source on GitHub →'
    box.append(link)
  }

  content.replaceWith(box)
}

function rewriteReadme(content: HTMLElement, source: string) {
  const rawBase = `https://raw.githubusercontent.com/${source}/HEAD/`
  const blobBase = `https://github.com/${source}/blob/HEAD/`

  for (const img of Array.from(content.querySelectorAll('img'))) {
    const src = img.getAttribute('src') || ''
    if (!src || src.startsWith('#') || src.startsWith('data:')) continue
    if (/^(?:[a-z]+:)?\/\//i.test(src)) {
      img.setAttribute('loading', 'lazy')
      continue
    }
    try {
      img.src = new URL(src.replace(/^\/+/, ''), rawBase).href
      img.setAttribute('loading', 'lazy')
    } catch {
      // keep the original source
    }
  }

  for (const anchor of Array.from(content.querySelectorAll('a'))) {
    const href = anchor.getAttribute('href') || ''
    if (!href || href.startsWith('#')) continue

    if (!/^[a-z]+:/i.test(href)) {
      try {
        anchor.href = new URL(href.replace(/^\/+/, ''), blobBase).href
      } catch {
        // keep the original href
      }
    }

    if (/^https?:/i.test(anchor.href)) {
      anchor.target = '_blank'
      anchor.rel = 'noopener noreferrer'
    }
  }
}

async function loadReadme(skill: Skill) {
  const content = document.getElementById('readme-content')
  if (!content) return

  if (!isGitHubSource(skill.source)) {
    readmeError(
      'This source is not a GitHub repository, so there is no README to display for it.'
    )
    return
  }

  const markdown = await getReadme(skill.source)

  if (!markdown) {
    readmeError(
      'The repository README could not be loaded right now.',
      skill.url || githubUrl(skill.source) || undefined
    )
    return
  }

  const truncated = markdown.length > MAX_README
  let body = markdown
  if (truncated) {
    const cut = markdown.lastIndexOf('\n', MAX_README)
    body =
      markdown.slice(0, cut > 0 ? cut : MAX_README) +
      '\n\n---\n\n_README truncated. Open the repository on GitHub for the full version._'
  }

  try {
    const html = await marked.parse(body, { gfm: true, breaks: false })
    const clean = DOMPurify.sanitize(String(html), {
      USE_PROFILES: { html: true },
    })
    content.innerHTML = clean
    rewriteReadme(content, skill.source)
  } catch {
    readmeError(
      'The repository README could not be rendered.',
      skill.url || githubUrl(skill.source) || undefined
    )
  }
}

async function loadSiblings(skill: Skill) {
  const panel = document.getElementById('more-panel')
  const list = document.getElementById('more-list')
  if (!panel || !list) return

  try {
    const data = await listSkills({ source: skill.source, limit: 12 })
    const others = data.items
      .filter(
        (item) =>
          !(item.source === skill.source && item.skillId === skill.skillId)
      )
      .slice(0, 6)

    if (others.length === 0) return

    for (const item of others) {
      const link = document.createElement('a')
      link.className = 'more-item'
      link.href = skillPath(item)
      const label = document.createElement('span')
      label.textContent = item.name
      link.append(label)
      link.insertAdjacentHTML('beforeend', ARROW_ICON)
      list.append(link)
    }

    panel.hidden = false
  } catch {
    // the section is optional; leave it hidden
  }
}

function render(skill: Skill) {
  const root = document.getElementById('detail-root')
  if (!root) return

  root.innerHTML = detailMarkup(skill)
  root.removeAttribute('aria-busy')

  setMeta(
    `${skill.name} — Pegg Skill Hub`,
    `Install ${skill.name} from ${skill.source}: ${installCommand(skill)}`
  )

  wireInstall(skill)
  void loadReadme(skill)
  void loadSiblings(skill)
}

export function initSkillDetail() {
  const root = document.getElementById('detail-root')
  if (!root) return

  const parsed = parseSkillPath(window.location.pathname)

  if (!parsed) {
    root.innerHTML = notFound()
    root.removeAttribute('aria-busy')
    setMeta('Skill not found — Pegg Skill Hub', 'The requested skill was not found.')
    return
  }

  getSkill(parsed.source, parsed.skillId)
    .then(render)
    .catch((error) => {
      root.innerHTML = (error as { status?: number })?.status === 404
        ? notFound()
        : errorState()
      root.removeAttribute('aria-busy')
      setMeta(
        'Skill — Pegg Skill Hub',
        'Browse and install skills for your AI agent.'
      )

      document.getElementById('reload-skill')?.addEventListener('click', () => {
        window.location.reload()
      })
    })
}
