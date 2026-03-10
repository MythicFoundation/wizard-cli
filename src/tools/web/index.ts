import { createToolDefinition } from '../../providers/claude.js'
import type { Tool } from '@anthropic-ai/sdk/resources/messages'

const MAX_CONTENT_LENGTH = 50000

export function getWebTools(): Tool[] {
  return [
    createToolDefinition(
      'web_fetch',
      'Fetch a URL and return the text content. Useful for reading documentation, APIs, and web pages.',
      {
        url: { type: 'string', description: 'The URL to fetch' },
        raw: { type: 'boolean', description: 'Return raw HTML instead of extracted text (default: false)' },
      },
      ['url'],
    ),

    createToolDefinition(
      'web_search',
      'Search the web using DuckDuckGo. Returns top results with titles, URLs, and snippets.',
      {
        query: { type: 'string', description: 'Search query' },
        num_results: { type: 'number', description: 'Number of results to return (default: 5)' },
      },
      ['query'],
    ),
  ]
}

function stripHtmlTags(html: string): string {
  // Remove script and style blocks entirely
  let text = html.replace(/<script[^>]*>[\s\S]*?<\/script>/gi, '')
  text = text.replace(/<style[^>]*>[\s\S]*?<\/style>/gi, '')
  // Replace <br>, <p>, <div>, <li>, <tr> with newlines for readability
  text = text.replace(/<(br|\/p|\/div|\/li|\/tr|\/h[1-6])[^>]*>/gi, '\n')
  // Remove all remaining HTML tags
  text = text.replace(/<[^>]+>/g, '')
  // Decode common HTML entities
  text = text.replace(/&amp;/g, '&')
  text = text.replace(/&lt;/g, '<')
  text = text.replace(/&gt;/g, '>')
  text = text.replace(/&quot;/g, '"')
  text = text.replace(/&#39;/g, "'")
  text = text.replace(/&nbsp;/g, ' ')
  // Collapse multiple blank lines
  text = text.replace(/\n{3,}/g, '\n\n')
  // Trim whitespace from each line
  text = text
    .split('\n')
    .map((line) => line.trim())
    .join('\n')
  return text.trim()
}

function parseDuckDuckGoResults(html: string, numResults: number): string {
  const results: { title: string; url: string; snippet: string }[] = []

  // DuckDuckGo HTML search results are in <a class="result__a"> with <a class="result__snippet">
  const resultBlocks = html.split(/class="result\s/)

  for (let i = 1; i < resultBlocks.length && results.length < numResults; i++) {
    const block = resultBlocks[i]

    // Extract title from result__a link
    const titleMatch = block.match(/class="result__a"[^>]*>([^<]+)</)
    // Extract URL from result__a href
    const urlMatch = block.match(/class="result__a"\s+href="([^"]+)"/)
    // Extract snippet
    const snippetMatch = block.match(/class="result__snippet"[^>]*>([\s\S]*?)<\//)

    if (titleMatch && urlMatch) {
      let url = urlMatch[1]
      // DuckDuckGo wraps URLs in a redirect — extract the actual URL
      const uddgMatch = url.match(/uddg=([^&]+)/)
      if (uddgMatch) {
        url = decodeURIComponent(uddgMatch[1])
      }

      const snippet = snippetMatch ? stripHtmlTags(snippetMatch[1]).trim() : ''
      results.push({
        title: stripHtmlTags(titleMatch[1]).trim(),
        url,
        snippet,
      })
    }
  }

  if (results.length === 0) {
    return 'No results found.'
  }

  return results
    .map((r, i) => `${i + 1}. ${r.title}\n   ${r.url}\n   ${r.snippet}`)
    .join('\n\n')
}

export async function executeWebTool(name: string, input: Record<string, any>): Promise<string> {
  switch (name) {
    case 'web_fetch': {
      const url = input.url as string
      const raw = input.raw as boolean | undefined

      try {
        const response = await fetch(url, {
          headers: {
            'User-Agent': 'Mozilla/5.0 (compatible; WizardCLI/1.0)',
            Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
          },
          redirect: 'follow',
          signal: AbortSignal.timeout(30000),
        })

        if (!response.ok) {
          return `Error: HTTP ${response.status} ${response.statusText}`
        }

        const contentType = response.headers.get('content-type') || ''
        const body = await response.text()

        let content: string
        if (raw || !contentType.includes('html')) {
          content = body
        } else {
          content = stripHtmlTags(body)
        }

        if (content.length > MAX_CONTENT_LENGTH) {
          content = content.slice(0, MAX_CONTENT_LENGTH) + `\n\n... [truncated at ${MAX_CONTENT_LENGTH} characters]`
        }

        return content
      } catch (err: any) {
        if (err.name === 'TimeoutError' || err.name === 'AbortError') {
          return `Error: Request timed out after 30 seconds`
        }
        return `Error: ${err.message}`
      }
    }

    case 'web_search': {
      const query = input.query as string
      const numResults = (input.num_results as number) || 5

      try {
        const encodedQuery = encodeURIComponent(query)
        const url = `https://html.duckduckgo.com/html/?q=${encodedQuery}`

        const response = await fetch(url, {
          headers: {
            'User-Agent': 'Mozilla/5.0 (compatible; WizardCLI/1.0)',
            Accept: 'text/html',
          },
          redirect: 'follow',
          signal: AbortSignal.timeout(15000),
        })

        if (!response.ok) {
          return `Error: Search request failed with HTTP ${response.status}`
        }

        const html = await response.text()
        return parseDuckDuckGoResults(html, numResults)
      } catch (err: any) {
        if (err.name === 'TimeoutError' || err.name === 'AbortError') {
          return `Error: Search timed out after 15 seconds`
        }
        return `Error: ${err.message}`
      }
    }

    default:
      return `Unknown web tool: ${name}`
  }
}
