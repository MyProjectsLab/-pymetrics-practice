import { createRoot } from 'react-dom/client'
import { MarketingUsage } from './MarketingUsage'
const panel = document.getElementById('usage-information')
if (panel) createRoot(panel).render(<MarketingUsage />)
