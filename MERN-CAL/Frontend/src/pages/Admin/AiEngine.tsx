import Cookies from 'js-cookie'
import { useEffect } from 'react'

const AiEngine = () => {
  useEffect(() => {
    const accessToken = encodeURIComponent(Cookies.get('access_token') || '')
    window.location.replace(
      `http://192.168.1.67:8000?access_token=${accessToken}`
    )
  }, [])

  return <div>Redirecting...</div>
}

export default AiEngine
