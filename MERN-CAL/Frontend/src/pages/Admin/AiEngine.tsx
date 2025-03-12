import Cookies from 'js-cookie'
import { useEffect } from 'react'

const AiEngine = () => {
  useEffect(() => {
    const accessToken = encodeURIComponent(Cookies.get('access_token') || '')
    window.location.replace(
      `http://localhost:5000?access_token=${accessToken}`
    )
  }, [])

  return <div>Redirecting...</div>
}

export default AiEngine
