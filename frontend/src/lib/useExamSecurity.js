import { useCallback, useEffect, useState } from 'react'

// Keys locked via the Keyboard Lock API while in fullscreen (Chromium only —
// Chrome/Edge on desktop). This is what actually stops the Windows/Meta key,
// Alt+Tab, and Alt+F4 from reaching the OS instead of the page: normally the
// OS intercepts these before any browser JS ever runs, so no keydown handler
// can "block" them — the Keyboard Lock API is the one browser mechanism that
// can reserve them for the page while it's in fullscreen. It does NOT work
// in Firefox/Safari (no support) and can never capture Ctrl+Alt+Delete (that
// one is hard-reserved by Windows itself, no browser or website can touch
// it) — so this raises the bar a lot but isn't an absolute guarantee.
const LOCKABLE_KEYS = [
  'MetaLeft', 'MetaRight', // Windows / Cmd key
  'AltLeft', 'AltRight',
  'Tab',
  'Escape',
  'F11',
]

// How often to re-check the DevTools-open heuristic below.
const DEVTOOLS_POLL_MS = 1000
// A docked DevTools panel (side or bottom) shrinks the window's usable
// viewport relative to its outer frame by roughly this much or more. This is
// a heuristic, not a real signal — no browser exposes "DevTools is open" to
// a page (deliberately: that would let sites detect and punish debugging).
// Known false-positive sources: some window managers/OS scaling setups,
// certain browser zoom levels, split-screen/snapped windows on smaller
// monitors. It also does NOT catch DevTools undocked into its own separate
// window (outer/inner dimensions of the exam tab don't change at all in
// that case) — there is no way to detect that from the page either.
const DEVTOOLS_SIZE_THRESHOLD = 160

/**
 * Exam security hook.
 *
 * - Forces fullscreen (auto request + re-prompt when the candidate exits)
 * - Locks the Windows/Meta key, Alt+Tab, Alt+F4, Esc and F11 via the
 *   Keyboard Lock API while in fullscreen (Chromium browsers only)
 * - Disables right-click / context menu
 * - Blocks dev-tools + view-source + print shortcuts
 * - Disables copy / cut / paste and text selection + drag
 * - Heuristically flags a *docked* DevTools panel via `isDevToolsOpen` (best
 *   effort only — see DEVTOOLS_SIZE_THRESHOLD above for what this can't
 *   catch; no website can actually detect, let alone close, DevTools)
 *
 * Usage:
 *   const { isFullscreen, requestFullscreen, isDevToolsOpen } = useExamSecurity(true)
 */
export function useExamSecurity(enabled = true) {
  const [isFullscreen, setIsFullscreen] = useState(false)
  const [isDevToolsOpen, setIsDevToolsOpen] = useState(false)

  const lockKeyboard = useCallback(async () => {
    try {
      if (navigator.keyboard?.lock) await navigator.keyboard.lock(LOCKABLE_KEYS)
    } catch {
      /* unsupported browser (Firefox/Safari) or the lock was refused — fall
         back to the keydown-based blocking below, which is all we get there */
    }
  }, [])

  const unlockKeyboard = useCallback(() => {
    try {
      navigator.keyboard?.unlock?.()
    } catch {}
  }, [])

  const requestFullscreen = useCallback(async () => {
    const el = document.documentElement
    try {
      if (el.requestFullscreen) await el.requestFullscreen({ navigationUI: 'hide' })
      else if (el.webkitRequestFullscreen) await el.webkitRequestFullscreen()
      else if (el.msRequestFullscreen) await el.msRequestFullscreen()
    } catch {
      /* browser refused (needs a user gesture) — the overlay button will retry */
    }
    // Keyboard Lock only takes effect once the document is actually in
    // fullscreen, so it's requested right after (best-effort either way).
    await lockKeyboard()
  }, [lockKeyboard])

  const exitFullscreen = useCallback(async () => {
    unlockKeyboard()
    try {
      if (document.fullscreenElement && document.exitFullscreen) await document.exitFullscreen()
      else if (document.webkitFullscreenElement && document.webkitExitFullscreen)
        document.webkitExitFullscreen()
    } catch {}
  }, [unlockKeyboard])

  useEffect(() => {
    if (!enabled) return

    // ---- fullscreen tracking -------------------------------------------
    const syncFs = () => {
      const active = !!(document.fullscreenElement || document.webkitFullscreenElement)
      setIsFullscreen(active)
      // Keyboard Lock is tied to the fullscreen session — re-acquire it
      // whenever fullscreen (re)starts (e.g. re-entered via the overlay
      // button, or F11) and release it the moment fullscreen drops so a
      // stale lock doesn't linger over the rest of the page.
      if (active) lockKeyboard()
      else unlockKeyboard()
    }
    document.addEventListener('fullscreenchange', syncFs)
    document.addEventListener('webkitfullscreenchange', syncFs)
    syncFs()

    // try once on mount (works when the page was opened by a user click)
    const t = setTimeout(() => {
      if (!document.fullscreenElement) requestFullscreen()
    }, 150)

    // Elements where the candidate is legitimately allowed to type/select —
    // e.g. the extra-time code box. Selection-blocking and user-select:none
    // on an ancestor is a known WebKit/mobile bug: it can stop the caret
    // from appearing and the virtual keyboard from opening on tap, even
    // though the input technically receives focus. So these are carved out.
    const FIELD_SELECTOR = 'input, textarea, select, [contenteditable="true"], [contenteditable=""]'
    const isFormField = (e) => typeof e.target?.closest === 'function' && e.target.closest(FIELD_SELECTOR)

    // ---- right click ----------------------------------------------------
    const onContextMenu = (e) => {
      if (isFormField(e)) return
      e.preventDefault()
    }

    // ---- copy / cut / paste / drag / select -----------------------------
    const block = (e) => {
      e.preventDefault()
      return false
    }
    const blockUnlessField = (e) => {
      if (isFormField(e)) return
      e.preventDefault()
      return false
    }

    // ---- keyboard shortcuts ---------------------------------------------
    const onKeyDown = (e) => {
      const k = (e.key || '').toLowerCase()
      const ctrl = e.ctrlKey || e.metaKey

      // F12 / dev tools
      if (k === 'f12') return block(e)
      // Ctrl+Shift+I / J / C / K  (inspector, console, picker, firefox console)
      if (ctrl && e.shiftKey && ['i', 'j', 'c', 'k'].includes(k)) return block(e)
      // Ctrl+U view-source, Ctrl+S save, Ctrl+P print, Ctrl+F find
      if (ctrl && ['u', 's', 'p'].includes(k)) return block(e)
      // Ctrl+C / X / V / A
      if (ctrl && ['c', 'x', 'v', 'a'].includes(k)) return block(e)
      // PrintScreen
      if (k === 'printscreen') {
        try {
          navigator.clipboard?.writeText('')
        } catch {}
        return block(e)
      }
      // Esc while in fullscreen — let the browser handle it, overlay will show
    }

    // ---- block printing --------------------------------------------------
    const onBeforePrint = (e) => e.preventDefault?.()

    // ---- DevTools-open heuristic ------------------------------------------
    const checkDevTools = () => {
      const widthDiff = window.outerWidth - window.innerWidth
      const heightDiff = window.outerHeight - window.innerHeight
      setIsDevToolsOpen(widthDiff > DEVTOOLS_SIZE_THRESHOLD || heightDiff > DEVTOOLS_SIZE_THRESHOLD)
    }
    checkDevTools()
    const devToolsInterval = setInterval(checkDevTools, DEVTOOLS_POLL_MS)

    document.addEventListener('contextmenu', onContextMenu)
    document.addEventListener('copy', blockUnlessField)
    document.addEventListener('cut', blockUnlessField)
    document.addEventListener('paste', blockUnlessField)
    document.addEventListener('dragstart', blockUnlessField)
    document.addEventListener('selectstart', blockUnlessField)
    document.addEventListener('keydown', onKeyDown, true)
    window.addEventListener('beforeprint', onBeforePrint)

    // Re-enable selection/caret specifically inside form fields. The
    // body-wide user-select:none below is what actually breaks the mobile
    // keyboard, so this !important rule (which beats a non-important inline
    // style) is the real fix — the JS handlers above are the secondary line
    // of defense against copy/paste elsewhere on the page.
    const selectionStyle = document.createElement('style')
    selectionStyle.setAttribute('data-exam-security', 'field-select')
    selectionStyle.textContent = `${FIELD_SELECTOR} { -webkit-user-select: text !important; user-select: text !important; }`
    document.head.appendChild(selectionStyle)

    // hide content from print output as a fallback
    const printStyle = document.createElement('style')
    printStyle.setAttribute('data-exam-security', 'print')
    printStyle.textContent = `@media print { body { display: none !important; } }`
    document.head.appendChild(printStyle)

    const prevUserSelect = document.body.style.userSelect
    document.body.style.userSelect = 'none'
    document.body.style.webkitUserSelect = 'none'

    return () => {
      clearTimeout(t)
      clearInterval(devToolsInterval)
      document.removeEventListener('fullscreenchange', syncFs)
      document.removeEventListener('webkitfullscreenchange', syncFs)
      document.removeEventListener('contextmenu', onContextMenu)
      document.removeEventListener('copy', blockUnlessField)
      document.removeEventListener('cut', blockUnlessField)
      document.removeEventListener('paste', blockUnlessField)
      document.removeEventListener('dragstart', blockUnlessField)
      document.removeEventListener('selectstart', blockUnlessField)
      document.removeEventListener('keydown', onKeyDown, true)
      window.removeEventListener('beforeprint', onBeforePrint)
      printStyle.remove()
      selectionStyle.remove()
      document.body.style.userSelect = prevUserSelect
      document.body.style.webkitUserSelect = prevUserSelect
      exitFullscreen()
    }
  }, [enabled, requestFullscreen, exitFullscreen, lockKeyboard, unlockKeyboard])

  return { isFullscreen, requestFullscreen, exitFullscreen, isDevToolsOpen }
}

/**
 * Opens a URL in a separate popup window.
 *
 * NOT currently used to launch exams (HomePage.jsx navigates in-tab and
 * relies on the Fullscreen API instead) — kept only as a general utility.
 * Reason: modern Chrome refuses to hide the address bar for scripted
 * popups (a deliberate anti-phishing policy, `location=no`/`toolbar=no`
 * below are ignored), and a popup is its own top-level OS window, so even
 * once it's fullscreened it can still surface its own minimize/close
 * window controls on hover — an escape hatch a same-tab fullscreen page
 * doesn't have (fullscreening the actual tab hides ALL browser chrome,
 * including the window's own controls). Do not reuse this for exams
 * without re-verifying that behavior in current Chrome.
 */
export function openExamWindow(url) {
  const w = window.screen.availWidth
  const h = window.screen.availHeight
  const features = [
    `width=${w}`,
    `height=${h}`,
    'left=0',
    'top=0',
    'menubar=no',
    'toolbar=no',
    'location=no',
    'status=no',
    'resizable=yes',
    'scrollbars=yes',
  ].join(',')

  const win = window.open(url, 'vibe_exam_window', features)
  if (!win) {
    alert('Please allow pop-ups for this site to start the test.')
    return null
  }
  win.focus()
  return win
}