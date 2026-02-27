import { Routes, Route } from 'react-router-dom'
import Layout from './components/Layout'
import Dashboard from './pages/Dashboard'
import Analyze from './pages/Analyze'
import Tenders from './pages/Tenders'
import TenderDetail from './pages/TenderDetail'
import Analytics from './pages/Analytics'
import About from './pages/About'
import NetworkGraph from './pages/NetworkGraph'
import EntitiesDB from './pages/EntitiesDB'
import PersonsDB from './pages/PersonsDB'
import Investigations from './pages/Investigations'
import VoiceChatPage from './pages/VoiceChatPage'

export default function App() {
  return (
    <Layout>
      <Routes>
        <Route path="/" element={<Dashboard />} />
        <Route path="/network" element={<NetworkGraph />} />
        <Route path="/map" element={<NetworkGraph />} />
        <Route path="/analyze" element={<Analyze />} />
        <Route path="/tenders" element={<Tenders />} />
        <Route path="/tenders/:tenderId" element={<TenderDetail />} />
        <Route path="/analytics" element={<Analytics />} />
        <Route path="/about" element={<About />} />
        <Route path="/entities" element={<EntitiesDB />} />
        <Route path="/persons" element={<PersonsDB />} />
        <Route path="/investigations" element={<Investigations />} />
        <Route path="/voice" element={<VoiceChatPage />} />
      </Routes>
    </Layout>
  )
}
