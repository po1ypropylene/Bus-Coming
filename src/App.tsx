import { AppContent } from './app/AppContent'
import { AppProvider } from './app/AppProvider'
import './styles/app.css'

export default function App() {
    return (
        <AppProvider>
            <AppContent />
        </AppProvider>
    )
}
