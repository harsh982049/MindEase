import React from 'react';
import {BrowserRouter as Router, Routes, Route} from 'react-router-dom';
// import './App.css'

// Import your page components
import Dashboard from './pages/Dashboard';
import Login from './pages/Login';
import SignUp from './pages/SignUp';
import StressDetection from './pages/StressDetection';
import PanicSOSChatbot from './pages/PanicSOSChatbot';
import ContactPage from './pages/ContactPage';
import BreathingCoach from './pages/BreathingCoach';
import FocusCompanion from './pages/FocusCompanion';
import TaskPrioritizer from './pages/TaskPrioritizer';
import Games from './pages/Games';

function App() {
	return (
		<Router>
			<Routes>
				<Route path="/" element={<Dashboard/>}/>
				<Route path="/contact" element={<ContactPage/>}/>

				{/* Login and Register routes */}
				<Route path="/login" element={<Login/>}/>
				<Route path="/signup" element={<SignUp/>}/>
				<Route path="/stress-detection" element={<StressDetection/>}/>
				<Route path="/panic-chatbot" element={<PanicSOSChatbot/>}/>
				<Route path="/breathing-coach" element={<BreathingCoach/>}/>
				<Route path="/focus" element={<FocusCompanion/>}/>
				<Route path="/priority" element={<TaskPrioritizer/>}/>
				<Route path="/games" element={<Games/>}/>
			</Routes>
		</Router>
	)
}

export default App;
