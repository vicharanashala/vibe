import { useSelector } from 'react-redux'

// Assuming your authentication state is part of a larger state tree
export const useIsAuthenticated = () => {
  // Access the specific slice of the state where isLoggedIn is stored
  // Update the path according to your actual state structure
  return useSelector((state) => state.auth.isLoggedIn)
}
export const selectProgressStatus = (state, sectionItemId) =>
  state.fetchStatus.fetchStatus[sectionItemId]
