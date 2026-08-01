import { useNavigate } from 'react-router-dom'
import { Button } from '../../components/ui/Button'

export function AddToWishlistButton() {
  const navigate = useNavigate()

  return (
    <Button onClick={() => navigate('/bottles/new', { state: { defaultStatus: 'wishlist' } })}>
      Add to Wishlist
    </Button>
  )
}
