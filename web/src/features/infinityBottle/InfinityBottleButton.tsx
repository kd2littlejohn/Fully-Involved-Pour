import { useNavigate } from 'react-router-dom'
import { Button } from '../../components/ui/Button'

// The one entry point into the full Infinity Bottle feature (home, blend
// breakdown, tastings, batch management — see pages/InfinityBottle/) — kept
// as a plain navigate-on-click Button in the same toolbar slot it's always
// occupied on CollectionPage, matching how "Add a Bottle" navigates there.
export function InfinityBottleButton() {
  const navigate = useNavigate()
  return (
    <Button variant="secondary" onClick={() => navigate('/collection/infinity')}>
      Infinity Bottle
    </Button>
  )
}
