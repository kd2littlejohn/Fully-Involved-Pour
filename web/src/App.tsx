import { RouterProvider } from 'react-router-dom'
import { router } from './router'
import { UserDataProvider } from './hooks/useUserData'

function App() {
  return (
    <UserDataProvider>
      <RouterProvider router={router} />
    </UserDataProvider>
  )
}

export default App
