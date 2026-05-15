export function normalizeAboutHtml(html: string) {
  return html
    .replace(
      'my name is adi, nice to meet you!',
      'I’m Adi. I build AI products, agent infrastructure, and fun little internet experiments.'
    )
    .replace(/and if you are wondering why[^.]+well, why not\?/i, '')
    .replace(/and if you are wondering why this page feels like [^-]+ - because the medium should match the work\./i, '')
    .replace(/this is completely interactive,[^.]+appear/i, '')
    .replace(/this is an interactive [^:]+ workspace:[^.]+\.?/i, '');
}
