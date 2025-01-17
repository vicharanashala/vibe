import React from 'react'
import { useDispatch } from 'react-redux'
import { useLogoutMutation } from '../store/apiService'
import { logoutState } from '../store/slices/authSlice'

const Logout: React.FC = () => {
  const dispatch = useDispatch()
  const [logout, { isLoading }] = useLogoutMutation()

  const handleLogout = async () => {
    try {
      await logout().unwrap()
      dispatch(logoutState())
    } catch (err) {
      console.error('Logout failed:', err)
    }
  }

  return (
    <button onClick={handleLogout} disabled={isLoading}>
      {isLoading ? 'Logging out...' : 'Logout'}
    </button>
  )
}

export default Logout
