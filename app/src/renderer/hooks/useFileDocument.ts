import { useState, useEffect, useRef, useCallback } from 'react'
import { parseDocument, composeDocument } from '../utils/fileDocument'
import { reconcileDecision } from '../utils/reconcile'

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
  const [externalPrompt, setExternalPrompt] = useState(false)
  const pendingDisk = useRef<string>('')
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

  const adoptDisk = (raw: string) => {
    const doc = parseDocument(raw)
    loading.current = true
    lastWritten.current = raw
    setData(doc.data)
    setBody(doc.body)
    setTimeout(() => { loading.current = false }, 0)
  }

  // Called when the open file may have changed on disk.
  const reconcile = useCallback(async () => {
    if (!filePath) return
    const res = await window.api.fs.readFile(filePath)
    if (!res.ok || res.content === undefined) return // deletion handled by the caller
    const disk = res.content
    const decision = reconcileDecision(disk, lastWritten.current, composeDocument(data, body))
    if (decision === 'ignore') return
    if (decision === 'reload') { adoptDisk(disk); return }
    pendingDisk.current = disk
    setExternalPrompt(true)
  }, [filePath, data, body])

  const resolveExternal = useCallback((mode: 'reload' | 'keep') => {
    setExternalPrompt(false)
    const disk = pendingDisk.current
    pendingDisk.current = ''
    if (!disk) return
    if (mode === 'reload') adoptDisk(disk)
    else lastWritten.current = disk // keep editing; next save overwrites, don't re-prompt
  }, [])

  return { data, body, status, updateBody, updateData, externalPrompt, resolveExternal, reconcile }
}
