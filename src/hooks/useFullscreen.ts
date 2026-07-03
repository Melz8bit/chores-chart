import { useEffect, useState } from 'react'

// Chrome for Android (and most browsers) only allow requestFullscreen()
// from a direct user gesture — it can't be triggered on page load, and
// there's no way to detect "should offer this" beyond feature support.
export function useFullscreen() {
  const [isFullscreen, setIsFullscreen] = useState(!!document.fullscreenElement)
  const supported = typeof document.documentElement.requestFullscreen === 'function'

  useEffect(() => {
    function handleChange() {
      setIsFullscreen(!!document.fullscreenElement)
    }
    document.addEventListener('fullscreenchange', handleChange)
    return () => document.removeEventListener('fullscreenchange', handleChange)
  }, [])

  async function toggle() {
    if (document.fullscreenElement) {
      await document.exitFullscreen()
    } else {
      await document.documentElement.requestFullscreen()
    }
  }

  return { isFullscreen, supported, toggle }
}
