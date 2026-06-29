import { useState, useEffect, useRef, useCallback } from 'react'
import { parseDocument, composeDocument } from '../utils/fileDocument'

export type WriteStatus = 'idle' | 'writing' | 'written'

/**
 * Owns one file's frontmatter `data` + markdown `body`, and is the ONLY writer to disk.
 * Both the editor (body) and the Properties panel (data) feed changes here so they can't
 * clobber each other — every write re-attaches the full frontmatter.
 */
export function useFileDocument(filePath: string | undefined, readOnly: boolean) {
  const [data, setData] = useState<Record<string, unknown>>({})
  const [body, setBody] = useState('')
  const [status, setStatus] = useState<WriteStatus>('idle')
  const lastWritten = useRef<string>('')
  const loading = useRef(false)
  const debounce = useRef<ReturnType<typeof setTimeout> | undefined>(undefined)

  // Load on file change.
  useEffect(() => {
    if (!filePath) {
      setData({})
      setBody('')
      lastWritten.current = ''
      return
    }
    loading.current = true
    window.api.fs.readFile(filePath).then(res => {
      if (res.ok && res.content !== undefined) {
        const doc = parseDocument(res.content)
        lastWritten.current = res.content
        setData(doc.data)
        setBody(doc.body)
      }
      // allow writes again on next tick
      setTimeout(() => { loading.current = false }, 0)
    })
    return () => { if (debounce.current) clearTimeout(debounce.current) }
  }, [filePath])

  const write = useCallback((nextData: Record<string, unknown>, nextBody: string) => {
    if (!filePath || readOnly || loading.current) return
    const composed = composeDocument(nextData, nextBody)
    if (composed === lastWritten.current) return
    if (debounce.current) clearTimeout(debounce.current)
    setStatus('writing')
    debounce.current = setTimeout(async () => {
      const result = await window.api.fs.writeFile(filePath, composed)
      if (result.ok) {
        lastWritten.current = composed
        setStatus('written')
        setTimeout(() => setStatus('idle'), 1500)
      } else {
        setStatus('idle')
      }
    }, 600)
  }, [filePath, readOnly])

  const updateBody = useCallback((nextBody: string) => {
    setBody(nextBody)
    write(data, nextBody)
  }, [data, write])

  const updateData = useCallback((nextData: Record<string, unknown>) => {
    setData(nextData)
    write(nextData, body)
  }, [body, write])

  return { data, body, status, updateBody, updateData }
}
