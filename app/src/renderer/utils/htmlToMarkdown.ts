import TurndownService from 'turndown'

const turndown = new TurndownService({
  headingStyle: 'atx',
  codeBlockStyle: 'fenced',
  bulletListMarker: '-',
  emDelimiter: '*',
  strongDelimiter: '**',
  hr: '---',
})

// Preserve line breaks in paragraphs
turndown.addRule('paragraph', {
  filter: 'p',
  replacement: (content) => `\n${content}\n`
})

export function htmlToMarkdown(html: string): string {
  return turndown.turndown(html).trim() + '\n'
}
