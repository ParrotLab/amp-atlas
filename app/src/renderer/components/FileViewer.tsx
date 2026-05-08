import { useState, useEffect } from 'react'
import './FileViewer.css'

interface FileViewerProps {
  filePath: string | undefined
}

export default function FileViewer({ filePath }: FileViewerProps) {
  const [content, setContent] = useState('')
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    if (!filePath) { setContent(''); return }
    setLoading(true)
    window.api.fs.readFile(filePath).then(result => {
      setContent(result.ok && result.content !== undefined ? result.content : `Error: ${result.error}`)
      setLoading(false)
    })
  }, [filePath])

  if (!filePath) {
    return <div className="file-viewer"><div className="file-viewer-empty">Select a file to view its contents</div></div>
  }

  const fileName = filePath.split('/').pop() || ''
  const dirPath = filePath.split('/').slice(-3, -1).join(' / ')

  return (
    <div className="file-viewer">
      <div className="file-viewer-content">
        <div className="file-viewer-breadcrumb">{dirPath}</div>
        <div className="file-viewer-title">{fileName}</div>
        {loading ? <div style={{ color: '#B5B1AC' }}>Loading...</div> : <div className="file-viewer-body">{content}</div>}
      </div>
    </div>
  )
}
