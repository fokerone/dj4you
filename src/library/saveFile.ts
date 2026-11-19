/**
 * Hand a generated file (a recorded mix) to the user.
 * Inside a claude.ai Artifact the page can't download by itself, so it asks
 * the viewer through the `downloads` capability; anywhere else it uses a
 * normal browser download.
 */

interface DownloadsApi {
  save(req: { filename: string; data: Blob }): Promise<{ status: 'saved' | 'delivered' }>
}
interface ClaudeHost {
  use?: (name: string) => Promise<unknown>
}

export type SaveOutcome = 'saved' | 'declined' | 'failed'

let downloads: Promise<DownloadsApi | null> | null = null

/** The host's download API, or null when running as a normal web page. */
export function hostDownloads(): Promise<DownloadsApi | null> {
  const host = (window as unknown as { claude?: ClaudeHost }).claude
  if (!host?.use) return Promise.resolve(null)
  downloads ??= host
    .use('downloads')
    .then((d) => (d as DownloadsApi | null) ?? null)
    .catch(() => null)
  return downloads
}

export async function saveFile(filename: string, blob: Blob): Promise<SaveOutcome> {
  const api = await hostDownloads()
  if (api) {
    try {
      await api.save({ filename, data: blob })
      return 'saved'
    } catch (e) {
      return (e as { code?: string })?.code === 'declined' ? 'declined' : 'failed'
    }
  }
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  document.body.append(a)
  a.click()
  a.remove()
  window.setTimeout(() => URL.revokeObjectURL(url), 60_000)
  return 'saved'
}
