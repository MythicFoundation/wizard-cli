/**
 * Wizard CLI — Terminal UI Components
 *
 * Raw ANSI-based UI primitives: arrow-key selector, spinner,
 * thinking indicator, stream writer. No React/Ink dependencies.
 */

import chalk from 'chalk'

// ─── Constants ──────────────────────────────────────────────────

const ACCENT = '#14F195'
const SPINNER_FRAMES = ['⠋', '⠙', '⠹', '⠸', '⠼', '⠴', '⠦', '⠧', '⠇', '⠏']
const SPINNER_INTERVAL = 80

// ANSI escape helpers
const ESC = '\x1B['
const HIDE_CURSOR = `${ESC}?25l`
const SHOW_CURSOR = `${ESC}?25h`
const CLEAR_LINE = `${ESC}2K`
const MOVE_TO_COL_0 = `${ESC}G`

function moveUp(n: number): string {
  return n > 0 ? `${ESC}${n}A` : ''
}

function clearLines(n: number): void {
  for (let i = 0; i < n; i++) {
    process.stdout.write(CLEAR_LINE + MOVE_TO_COL_0)
    if (i < n - 1) {
      process.stdout.write(moveUp(1))
    }
  }
  // Move back to top after clearing
  if (n > 1) {
    process.stdout.write(moveUp(n - 1))
  }
}

// ─── 1. Select — Arrow-key selector ────────────────────────────

export interface SelectOption<T> {
  label: string
  description?: string
  value: T
}

export interface SelectConfig<T> {
  message: string
  choices: SelectOption<T>[]
  theme?: { accent: string }
}

/**
 * Interactive arrow-key selector. Renders an inline menu the user
 * navigates with Up/Down arrows and confirms with Enter.
 *
 * Looks like Claude Code's auth/model picker.
 */
export async function select<T>(config: SelectConfig<T>): Promise<T> {
  const { message, choices, theme } = config
  const accent = theme?.accent || ACCENT
  const accentFn = chalk.hex(accent)

  let selectedIndex = 0

  // Calculate the total number of lines the menu occupies.
  // Layout:
  //   (blank line)
  //   message
  //   (blank line)
  //   For each choice: 1 line for label + 1 line for description (if present)
  function getTotalLines(): number {
    let lines = 3 // blank + message + blank
    for (const choice of choices) {
      lines += 1 // label line
      if (choice.description) lines += 1 // description line
    }
    return lines
  }

  function render(isFirstRender: boolean): void {
    const totalLines = getTotalLines()

    // On subsequent renders, erase the previous render
    if (!isFirstRender) {
      // Move up to top of the menu block and clear
      process.stdout.write(moveUp(totalLines - 1))
      for (let i = 0; i < totalLines; i++) {
        process.stdout.write(CLEAR_LINE)
        if (i < totalLines - 1) {
          process.stdout.write('\n')
        }
      }
      // Move back to top
      process.stdout.write(moveUp(totalLines - 1))
    }

    // Render menu
    process.stdout.write('\n')
    process.stdout.write(`  ${chalk.bold.white(message)}\n`)
    process.stdout.write('\n')

    for (let i = 0; i < choices.length; i++) {
      const choice = choices[i]
      const isSelected = i === selectedIndex

      if (isSelected) {
        process.stdout.write(`${accentFn('  \u276F')} ${accentFn(choice.label)}\n`)
      } else {
        process.stdout.write(`${chalk.dim('   ')} ${chalk.dim(choice.label)}\n`)
      }

      if (choice.description) {
        process.stdout.write(`    ${chalk.dim(choice.description)}\n`)
      }
    }
  }

  return new Promise<T>((resolve, reject) => {
    const stdin = process.stdin

    // If stdin isn't a TTY (piped input), fall back to first option
    if (!stdin.isTTY) {
      render(true)
      resolve(choices[0].value)
      return
    }

    const wasRaw = stdin.isRaw
    stdin.setRawMode(true)
    stdin.resume()

    // Hide cursor during selection
    process.stdout.write(HIDE_CURSOR)

    render(true)

    function cleanup(): void {
      stdin.removeListener('data', onData)
      stdin.setRawMode(wasRaw ?? false)
      process.stdout.write(SHOW_CURSOR)
      // Don't pause stdin — caller (readline) may still need it
    }

    function onData(data: Buffer): void {
      const key = data.toString()

      // Ctrl+C
      if (key === '\x03') {
        cleanup()
        // Clear the menu
        const totalLines = getTotalLines()
        process.stdout.write(moveUp(totalLines - 1))
        for (let i = 0; i < totalLines; i++) {
          process.stdout.write(CLEAR_LINE)
          if (i < totalLines - 1) process.stdout.write('\n')
        }
        process.stdout.write(moveUp(totalLines - 1))
        process.stdout.write(SHOW_CURSOR)
        process.exit(0)
      }

      // Up arrow: ESC [ A
      if (key === '\x1B[A' || key === 'k') {
        selectedIndex = (selectedIndex - 1 + choices.length) % choices.length
        render(false)
        return
      }

      // Down arrow: ESC [ B
      if (key === '\x1B[B' || key === 'j') {
        selectedIndex = (selectedIndex + 1) % choices.length
        render(false)
        return
      }

      // Enter or Space
      if (key === '\r' || key === '\n') {
        cleanup()

        // Redraw the final state: show selected item only
        const totalLines = getTotalLines()
        process.stdout.write(moveUp(totalLines - 1))
        for (let i = 0; i < totalLines; i++) {
          process.stdout.write(CLEAR_LINE)
          if (i < totalLines - 1) process.stdout.write('\n')
        }
        process.stdout.write(moveUp(totalLines - 1))

        // Print the confirmed selection
        const chosen = choices[selectedIndex]
        process.stdout.write(`\n  ${chalk.bold.white(message)} ${accentFn(chosen.label)}\n`)
        process.stdout.write('\n')

        resolve(chosen.value)
        return
      }
    }

    stdin.on('data', onData)
  })
}

// ─── 2. Spinner — Animated braille spinner ─────────────────────

export interface SpinnerInstance {
  start(text?: string): void
  update(text: string): void
  succeed(text: string): void
  fail(text: string): void
  stop(): void
}

/**
 * Creates a braille-dot spinner that renders on a single line,
 * updating in-place with ANSI escape codes.
 */
export function spinner(options?: { color?: string; indent?: string }): SpinnerInstance {
  const color = options?.color || ACCENT
  const indent = options?.indent || '  '
  const colorFn = chalk.hex(color)

  let frameIndex = 0
  let interval: ReturnType<typeof setInterval> | null = null
  let currentText = ''
  let isRunning = false

  function renderFrame(): void {
    const frame = SPINNER_FRAMES[frameIndex % SPINNER_FRAMES.length]
    process.stdout.write(
      CLEAR_LINE + MOVE_TO_COL_0 +
      `${indent}${colorFn(frame)} ${chalk.dim(currentText)}`
    )
    frameIndex++
  }

  return {
    start(text = '') {
      if (isRunning) return
      isRunning = true
      currentText = text
      process.stdout.write(HIDE_CURSOR)
      renderFrame()
      interval = setInterval(renderFrame, SPINNER_INTERVAL)
    },

    update(text: string) {
      currentText = text
      if (!isRunning) {
        this.start(text)
      }
    },

    succeed(text: string) {
      if (interval) clearInterval(interval)
      interval = null
      isRunning = false
      process.stdout.write(
        CLEAR_LINE + MOVE_TO_COL_0 +
        `${indent}${chalk.green('\u2713')} ${text}\n`
      )
      process.stdout.write(SHOW_CURSOR)
    },

    fail(text: string) {
      if (interval) clearInterval(interval)
      interval = null
      isRunning = false
      process.stdout.write(
        CLEAR_LINE + MOVE_TO_COL_0 +
        `${indent}${chalk.red('\u2717')} ${text}\n`
      )
      process.stdout.write(SHOW_CURSOR)
    },

    stop() {
      if (interval) clearInterval(interval)
      interval = null
      isRunning = false
      process.stdout.write(CLEAR_LINE + MOVE_TO_COL_0)
      process.stdout.write(SHOW_CURSOR)
    },
  }
}

// ─── 3. Thinking Indicator — Animated waiting dots ─────────────

export interface ThinkingInstance {
  start(): void
  stop(): void
}

/**
 * Animated "Thinking..." dots that cycle while the model generates.
 * Stops cleanly when the first token arrives.
 */
export function thinkingIndicator(options?: { color?: string }): ThinkingInstance {
  const color = options?.color || ACCENT
  const colorFn = chalk.hex(color)

  let interval: ReturnType<typeof setInterval> | null = null
  let dotCount = 0
  let isRunning = false

  function renderFrame(): void {
    dotCount = (dotCount % 3) + 1
    const dots = '.'.repeat(dotCount) + ' '.repeat(3 - dotCount)
    process.stdout.write(
      CLEAR_LINE + MOVE_TO_COL_0 +
      `  ${colorFn(SPINNER_FRAMES[dotCount % SPINNER_FRAMES.length])} ${chalk.dim('Thinking' + dots)}`
    )
  }

  return {
    start() {
      if (isRunning) return
      isRunning = true
      dotCount = 0
      process.stdout.write(HIDE_CURSOR)
      renderFrame()
      interval = setInterval(renderFrame, 400)
    },

    stop() {
      if (!isRunning) return
      isRunning = false
      if (interval) clearInterval(interval)
      interval = null
      // Clear the thinking line
      process.stdout.write(CLEAR_LINE + MOVE_TO_COL_0)
      process.stdout.write(SHOW_CURSOR)
    },
  }
}

// ─── 4. Stream Writer — Streaming text output helper ───────────

export interface StreamWriterInstance {
  write(text: string): void
  end(): void
  newline(): void
  isMidLine(): boolean
}

/**
 * Wraps process.stdout.write for streaming text with optional prefix,
 * tracking line state for proper newline handling.
 */
export function streamWriter(options?: { prefix?: string }): StreamWriterInstance {
  const prefix = options?.prefix || ''
  let midLine = false
  let started = false

  return {
    write(text: string) {
      if (!started) {
        // Start with prefix on first write
        process.stdout.write(prefix)
        started = true
        midLine = true
      }

      // Write the text, adding prefix after any newlines
      if (prefix) {
        const parts = text.split('\n')
        for (let i = 0; i < parts.length; i++) {
          if (i > 0) {
            process.stdout.write('\n' + prefix)
          }
          process.stdout.write(parts[i])
        }
      } else {
        process.stdout.write(text)
      }

      midLine = !text.endsWith('\n')
    },

    end() {
      if (midLine) {
        process.stdout.write('\n')
        midLine = false
      }
      started = false
    },

    newline() {
      process.stdout.write('\n')
      if (prefix) process.stdout.write(prefix)
      midLine = false
    },

    isMidLine() {
      return midLine
    },
  }
}

// ─── 5. Confirm — Simple Y/n confirmation ─────────────────────

export async function confirm(message: string, defaultYes = true): Promise<boolean> {
  const stdin = process.stdin

  if (!stdin.isTTY) {
    return defaultYes
  }

  const hint = defaultYes ? chalk.dim('[Y/n]') : chalk.dim('[y/N]')
  process.stdout.write(`  ${message} ${hint} `)

  return new Promise<boolean>((resolve) => {
    const wasRaw = stdin.isRaw
    stdin.setRawMode(true)
    stdin.resume()

    function onData(data: Buffer): void {
      const key = data.toString().toLowerCase()

      stdin.removeListener('data', onData)
      stdin.setRawMode(wasRaw ?? false)

      if (key === '\r' || key === '\n') {
        process.stdout.write(defaultYes ? 'Yes' : 'No')
        process.stdout.write('\n')
        resolve(defaultYes)
      } else if (key === 'y') {
        process.stdout.write('Yes\n')
        resolve(true)
      } else if (key === 'n') {
        process.stdout.write('No\n')
        resolve(false)
      } else if (key === '\x03') {
        process.stdout.write('\n')
        process.exit(0)
      } else {
        process.stdout.write(defaultYes ? 'Yes' : 'No')
        process.stdout.write('\n')
        resolve(defaultYes)
      }
    }

    stdin.on('data', onData)
  })
}

// ─── 6. Password Input — Hidden input for API keys ─────────────

export async function passwordInput(prompt: string): Promise<string> {
  const stdin = process.stdin

  if (!stdin.isTTY) {
    return ''
  }

  process.stdout.write(prompt)

  return new Promise<string>((resolve) => {
    const wasRaw = stdin.isRaw
    stdin.setRawMode(true)
    stdin.resume()

    let input = ''

    function onData(data: Buffer): void {
      const key = data.toString()

      // Ctrl+C
      if (key === '\x03') {
        stdin.removeListener('data', onData)
        stdin.setRawMode(wasRaw ?? false)
        process.stdout.write('\n')
        resolve('')
        return
      }

      // Enter
      if (key === '\r' || key === '\n') {
        stdin.removeListener('data', onData)
        stdin.setRawMode(wasRaw ?? false)
        process.stdout.write('\n')
        resolve(input)
        return
      }

      // Backspace
      if (key === '\x7F' || key === '\x08') {
        if (input.length > 0) {
          input = input.slice(0, -1)
          process.stdout.write('\b \b')
        }
        return
      }

      // Paste support: handle multi-char input
      if (key.length > 1 && !key.startsWith('\x1B')) {
        input += key
        process.stdout.write('*'.repeat(key.length))
        return
      }

      // Ignore escape sequences
      if (key.startsWith('\x1B')) {
        return
      }

      // Regular character
      if (key.length === 1 && key >= ' ') {
        input += key
        process.stdout.write('*')
      }
    }

    stdin.on('data', onData)
  })
}
