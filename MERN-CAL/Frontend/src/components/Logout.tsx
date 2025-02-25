/**
 * Logout Component
 *
 * This component provides user logout functionality with a simple button interface.
 * It handles the logout process by making an API call and updating the Redux store.
 *
 * Features:
 * - Single button interface for logout action
 * - API integration using RTK Query for logout request
 * - Loading state management during logout
 * - Redux integration for clearing user state
 * - Error handling for failed logout attempts
 *
 * State:
 * - isLoading: Indicates if logout request is in progress
 *
 * The component disables the logout button while processing to prevent multiple
 * logout attempts and shows a loading message to provide user feedback.
 */

// Import required dependencies
import React from 'react'
import { useDispatch } from 'react-redux'
import { useLogoutMutation } from '../store/apiService'
import { logoutState } from '../store/slices/authSlice'

// Logout component for handling user logout functionality
const Logout: React.FC = () => {
  // Redux dispatch hook
  const dispatch = useDispatch()
  // RTK Query hook for logout mutation with loading state
  const [logout, { isLoading }] = useLogoutMutation()

  // Handle logout action
  const handleLogout = async () => {
    try {
      // Call logout API and unwrap response
      await logout().unwrap()
      // Update Redux store to clear user state
      dispatch(logoutState())
    } catch (err) {
      console.error('Logout failed:', err)
    }
  }

  return (
    // Logout button that disables during logout process
    <button onClick={handleLogout} disabled={isLoading}>
      {isLoading ? 'Logging out...' : 'Logout'}
    </button>
  )
}

export default Logout
