import { RouterProvider } from 'react-router-dom'
import { router } from './router'
import { UserDataProvider } from './hooks/useUserData'
import { SommelierProvider } from './features/sommelier/SommelierProvider'

function App() {
  return (
    <UserDataProvider>
      <SommelierProvider>
        <RouterProvider router={router} />
      </SommelierProvider>
    </UserDataProvider>
  )
}

export default App
