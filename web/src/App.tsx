import { RouterProvider } from 'react-router-dom'
import { router } from './router'
import { UserDataProvider } from './hooks/useUserData'
import { SommelierProvider } from './features/sommelier/SommelierProvider'
import { UpdateAvailableBanner } from './components/layout/UpdateAvailableBanner'

function App() {
  return (
    <UserDataProvider>
      <SommelierProvider>
        <RouterProvider router={router} />
        <UpdateAvailableBanner />
      </SommelierProvider>
    </UserDataProvider>
  )
}

export default App
