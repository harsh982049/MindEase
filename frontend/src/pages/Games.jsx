import React, { useState, useEffect, useRef, createContext, useContext } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Heart, Wind, Droplets, Palette, Brain, Sparkles, Award, TrendingDown, Home, Play, BarChart3, Star, Circle, X } from 'lucide-react';
import { MuscleRelaxationGame, MandalaColoringGame, RainSoundsGame, StressBallGame, GuidedImageryGame } from './NewGames';
import { User, Volume2, Hand, ImageIcon } from 'lucide-react';
import { cn } from '../lib/utils';
import Navbar from "../components/Navbar"
import Footer from "../components/Footer"

// Global State Management Context
const StressReliefContext = createContext();

const StressReliefProvider = ({ children }) => {
  const [userStats, setUserStats] = useState(() => {
    const saved = localStorage.getItem('stressReliefStats');
    return saved ? JSON.parse(saved) : {
      relaxationPoints: 0,
      stressLevel: 75,
      gamesPlayed: 0,
      badges: [],
      dailyChallenges: [
        { id: 1, text: 'Complete 1-minute breathing', completed: false, points: 50 },
        { id: 2, text: 'Pop 30 bubbles', completed: false, points: 30, progress: 0, target: 30 },
        { id: 3, text: 'Match 5 colors', completed: false, points: 40, progress: 0, target: 5 },
        { id: 4, text: 'Complete muscle relaxation', completed: false, points: 60 },
        { id: 5, text: 'Color 12 mandala sections', completed: false, points: 35, progress: 0, target: 12 },
        { id: 6, text: 'Mix 3 rain sounds', completed: false, points: 25, progress: 0, target: 3 }
      ],
      streakDays: 0
    };
  });

  useEffect(() => {
    localStorage.setItem('stressReliefStats', JSON.stringify(userStats));
  }, [userStats]);

  const addPoints = (points) => {
    setUserStats(prev => ({
      ...prev,
      relaxationPoints: prev.relaxationPoints + points,
      stressLevel: Math.round(Math.max(0, prev.stressLevel - (points / 10))*100)/100
    }));
  };

  const updateChallenge = (challengeId, progress = 1) => {
    setUserStats(prev => {
      const challenges = prev.dailyChallenges.map(c => {
        if (c.id === challengeId) {
          const newProgress = (c.progress || 0) + progress;
          const completed = newProgress >= c.target;
          if (completed && !c.completed) {
            addPoints(c.points);
          }
          return { ...c, progress: newProgress, completed };
        }
        return c;
      });
      return { ...prev, dailyChallenges: challenges };
    });
  };

  const unlockBadge = (badgeName) => {
    setUserStats(prev => {
      if (!prev.badges.includes(badgeName)) {
        return { ...prev, badges: [...prev.badges, badgeName] };
      }
      return prev;
    });
  };

  return (
    <StressReliefContext.Provider value={{ userStats, addPoints, updateChallenge, unlockBadge }}>
      {children}
    </StressReliefContext.Provider>
  );
};

// Main App Component
const StressReliefApp = () => {
  const [currentScreen, setCurrentScreen] = useState('home');
  const [currentGame, setCurrentGame] = useState(null);

  const navigateTo = (screen, game = null) => {
    setCurrentScreen(screen);
    setCurrentGame(game);
  };

    return (
      <div className="flex min-h-screen flex-col bg-gradient-to-br from-blue-50 via-purple-50 to-pink-50">
        <Navbar />

        <StressReliefProvider>
          <main className="flex-1 overflow-hidden">
            <AnimatePresence mode="wait">
              {currentScreen === "home" && (
                <motion.div
                  key="home"
                  initial={{ opacity: 0, scale: 0.95 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0, scale: 0.95 }}
                  transition={{ duration: 0.3 }}
                >
                  <HomeScreen onNavigate={navigateTo} />
                </motion.div>
              )}

              {currentScreen === "games" && (
                <motion.div
                  key="games"
                  initial={{ opacity: 0, x: 100 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: -100 }}
                  transition={{ duration: 0.3 }}
                >
                  <GameSelector onNavigate={navigateTo} />
                </motion.div>
              )}

              {currentScreen === "play" && currentGame && (
                <motion.div
                  key="play"
                  initial={{ opacity: 0, y: 50 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -50 }}
                  transition={{ duration: 0.3 }}
                >
                  <GameContainer
                    game={currentGame}
                    onBack={() => navigateTo("games")}
                  />
                </motion.div>
              )}

              {currentScreen === "progress" && (
                <motion.div
                  key="progress"
                  initial={{ opacity: 0, scale: 0.95 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0, scale: 0.95 }}
                  transition={{ duration: 0.3 }}
                >
                  <ProgressDashboard onNavigate={navigateTo} />
                </motion.div>
              )}
            </AnimatePresence>
          </main>
        </StressReliefProvider>

        <Footer />
      </div>
    );
};

// Floating Particle Component
const FloatingParticle = ({ delay, duration }) => (
  <motion.div
    className="absolute opacity-20"
    initial={{ y: '100vh', x: Math.random() * window.innerWidth, rotate: 0 }}
    animate={{ 
      y: -100, 
      x: Math.random() * window.innerWidth,
      rotate: 360 
    }}
    transition={{
      duration: duration,
      delay: delay,
      repeat: Infinity,
      ease: "linear"
    }}
  >
    <Sparkles className="w-6 h-6 text-purple-400" />
  </motion.div>
);

// Home Screen with Enhanced Animations
const HomeScreen = ({ onNavigate }) => {
  const { userStats } = useContext(StressReliefContext);

  return (
    <div className="relative min-h-screen flex flex-col items-center justify-center p-8">
      {/* Floating Elements */}
      {Array.from({ length: 8 }).map((_, i) => (
        <FloatingParticle 
          key={i} 
          delay={i * 2} 
          duration={15 + Math.random() * 10} 
        />
      ))}

      {/* Main Content */}
      <div className="relative z-10 text-center max-w-2xl">
        <motion.div
          animate={{ scale: [1, 1.05, 1] }}
          transition={{ duration: 3, repeat: Infinity, ease: "easeInOut" }}
          className="mb-8"
        >
          <Heart className="w-20 h-20 mx-auto text-rose-400 mb-4" />
        </motion.div>
        
        <motion.h1
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6 }}
          className="text-5xl font-bold bg-gradient-to-r from-purple-600 to-pink-600 bg-clip-text text-transparent mb-4"
        >
          Welcome to Your Calm Space
        </motion.h1>
        
        <motion.p
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.6, delay: 0.2 }}
          className="text-xl text-gray-600 mb-8"
        >
          Take a deep breath. You're in a safe place designed to help you relax and restore balance.
        </motion.p>

        {/* Stress Meter */}
        <motion.div
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.6, delay: 0.4 }}
          className="bg-white/70 backdrop-blur-md rounded-3xl p-6 mb-8 shadow-lg"
        >
          <div className="flex items-center justify-between mb-3">
            <span className="text-sm font-medium text-gray-700">Your Stress Level</span>
            <motion.span
              key={userStats.stressLevel}
              initial={{ scale: 1.5, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              className="text-2xl font-bold text-purple-600"
            >
              {userStats.stressLevel}%
            </motion.span>
          </div>
          <div className="w-full h-4 bg-gray-200 rounded-full overflow-hidden">
            <motion.div 
              initial={{ width: 0 }}
              animate={{ width: `${userStats.stressLevel}%` }}
              transition={{ duration: 1, ease: "easeOut" }}
              className="h-full bg-gradient-to-r from-green-400 via-yellow-400 to-red-400 rounded-full"
            />
          </div>
          <p className="text-xs text-gray-500 mt-2">
            {userStats.stressLevel > 60 ? "Let's bring this down together" : 
             userStats.stressLevel > 30 ? "You're doing great!" : 
             "Wonderful! You're in a calm state"}
          </p>
        </motion.div>

        {/* Action Buttons */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.6 }}
          className="flex gap-4 justify-center"
        >
          <motion.button
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
            onClick={() => onNavigate('games')}
            className="group px-8 py-4 bg-gradient-to-r from-purple-500 to-pink-500 text-white rounded-2xl shadow-lg flex items-center gap-2"
          >
            <Play className="w-5 h-5" />
            Start Relaxation Games
          </motion.button>
          
          <motion.button
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
            onClick={() => onNavigate('progress')}
            className="px-8 py-4 bg-white/70 backdrop-blur-md text-purple-600 rounded-2xl shadow-lg flex items-center gap-2"
          >
            <BarChart3 className="w-5 h-5" />
            View Progress
          </motion.button>
        </motion.div>

        {/* Quick Stats */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.6, delay: 0.8 }}
          className="mt-8 grid grid-cols-3 gap-4"
        >
          {[
            { icon: Star, value: userStats.relaxationPoints, label: 'Calm Points', color: 'text-yellow-500' },
            { icon: Award, value: userStats.badges.length, label: 'Badges', color: 'text-blue-500' },
            { icon: TrendingDown, value: `${100 - userStats.stressLevel}%`, label: 'Relaxed', color: 'text-green-500' }
          ].map((stat, index) => (
            <motion.div
              key={index}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.4, delay: 0.9 + index * 0.1 }}
              whileHover={{ scale: 1.05 }}
              className="bg-white/60 backdrop-blur-sm rounded-2xl p-4"
            >
              <stat.icon className={cn("w-6 h-6 mx-auto mb-2", stat.color)} />
              <p className="text-2xl font-bold text-purple-600">{stat.value}</p>
              <p className="text-xs text-gray-600">{stat.label}</p>
            </motion.div>
          ))}
        </motion.div>
      </div>
    </div>
  );
};

// Game Selector with Staggered Animation
const GameSelector = ({ onNavigate }) => {
  const games = [
    { id: 'breathing', name: 'Breathing Guide', icon: Wind, color: 'from-blue-400 to-cyan-400', description: 'Follow calming breath patterns' },
    { id: 'bubbles', name: 'Bubble Pop', icon: Droplets, color: 'from-purple-400 to-pink-400', description: 'Pop bubbles for positive vibes' },
    { id: 'colors', name: 'Color Harmony', icon: Palette, color: 'from-orange-400 to-rose-400', description: 'Match soothing color palettes' },
    { id: 'zen', name: 'Zen Garden', icon: Sparkles, color: 'from-green-400 to-emerald-400', description: 'Draw peaceful sand patterns' },
    { id: 'memory', name: 'Memory Calm', icon: Brain, color: 'from-indigo-400 to-purple-400', description: 'Gentle memory matching' },
    { id: 'muscle', name: 'Muscle Relaxation', icon: User, color: 'from-violet-400 to-purple-400', description: 'Progressive tension release' },
    { id: 'mandala', name: 'Mandala Coloring', icon: ImageIcon, color: 'from-pink-400 to-rose-400', description: 'Meditative art therapy' },
    { id: 'rain', name: 'Rain Sounds', icon: Volume2, color: 'from-cyan-400 to-blue-400', description: 'Create your soundscape' },
    { id: 'stressball', name: 'Stress Ball', icon: Hand, color: 'from-fuchsia-400 to-pink-400', description: 'Digital stress relief' },
    { id: 'imagery', name: 'Guided Imagery', icon: Sparkles, color: 'from-sky-400 to-indigo-400', description: 'Peaceful mental journey' }
  ];

  return (
    <div className="min-h-screen p-8">
      <div className="max-w-6xl mx-auto">
        <div className="flex items-center justify-between mb-8">
          <motion.button
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
            onClick={() => onNavigate('home')}
            className="flex items-center gap-2 text-purple-600 hover:text-purple-700 transition-colors"
          >
            <Home className="w-5 h-5" />
            <span>Home</span>
          </motion.button>
          <motion.h2
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            className="text-3xl font-bold text-purple-600"
          >
            Choose Your Journey
          </motion.h2>
          <div className="w-20" />
        </div>

        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
          {games.map((game, index) => {
            const Icon = game.icon;
            return (
              <motion.button
                key={game.id}
                initial={{ opacity: 0, y: 50 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.4, delay: index * 0.1 }}
                whileHover={{ scale: 1.05, rotate: 2 }}
                whileTap={{ scale: 0.95 }}
                onClick={() => onNavigate('play', game.id)}
                className="group relative bg-white/70 backdrop-blur-md rounded-3xl p-8 shadow-lg overflow-hidden"
              >
                <motion.div
                  className={cn("absolute inset-0 bg-gradient-to-br opacity-0 group-hover:opacity-10 transition-opacity duration-300", game.color)}
                />
                
                <div className="relative z-10">
                  <motion.div
                    whileHover={{ rotate: 12 }}
                    transition={{ type: "spring", stiffness: 300 }}
                    className={cn("w-16 h-16 mx-auto mb-4 rounded-2xl bg-gradient-to-br flex items-center justify-center", game.color)}
                  >
                    <Icon className="w-8 h-8 text-white" />
                  </motion.div>
                  <h3 className="text-xl font-bold text-gray-800 mb-2">{game.name}</h3>
                  <p className="text-sm text-gray-600">{game.description}</p>
                </div>

                <motion.div
                  initial={{ opacity: 0 }}
                  whileHover={{ opacity: 1 }}
                  className="absolute top-4 right-4"
                >
                  <Play className="w-6 h-6 text-purple-500" />
                </motion.div>
              </motion.button>
            );
          })}
        </div>
      </div>
    </div>
  );
};

// Game Container
const GameContainer = ({ game, onBack }) => {
  return (
    <div className="min-h-screen">
      <div className="fixed top-4 left-4 z-50">
        <motion.button
          initial={{ opacity: 0, x: -20 }}
          animate={{ opacity: 1, x: 0 }}
          whileHover={{ scale: 1.05 }}
          whileTap={{ scale: 0.95 }}
          onClick={onBack}
          className="px-4 py-2 bg-white/70 backdrop-blur-md rounded-xl shadow-lg flex items-center gap-2 text-purple-600"
        >
          <Home className="w-4 h-4" />
          Back to Games
        </motion.button>
      </div>

      {game === 'breathing' && <BreathingGame />}
      {game === 'bubbles' && <BubblePopGame />}
      {game === 'colors' && <ColorMatchGame />}
      {game === 'zen' && <ZenGardenGame />}
      {game === 'memory' && <MemoryCalmGame />}
      {game === 'muscle' && <MuscleRelaxationGame />}
      {game === 'mandala' && <MandalaColoringGame />}
      {game === 'rain' && <RainSoundsGame />}
      {game === 'stressball' && <StressBallGame />}
      {game === 'imagery' && <GuidedImageryGame />}
    </div>
  );
};

// Breathing Game with Smooth Animations
const BreathingGame = () => {
  const { addPoints, updateChallenge, unlockBadge } = useContext(StressReliefContext);
  const [phase, setPhase] = useState('inhale');
  const [count, setCount] = useState(4);
  const [cycles, setCycles] = useState(0);
  const [isActive, setIsActive] = useState(false);

  useEffect(() => {
    if (!isActive) return;

    const timer = setInterval(() => {
      setCount(prev => {
        if (prev <= 1) {
          if (phase === 'inhale') {
            setPhase('hold');
            return 4;
          } else if (phase === 'hold') {
            setPhase('exhale');
            return 6;
          } else {
            setPhase('inhale');
            setCycles(c => c + 1);
            addPoints(10);
            return 4;
          }
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(timer);
  }, [isActive, phase]);

  useEffect(() => {
    if (cycles > 0 && cycles % 5 === 0) {
      updateChallenge(1);
      if (cycles === 10) {
        unlockBadge('Breathing Master');
      }
    }
  }, [cycles]);

  const scale = phase === 'inhale' ? 1.5 : phase === 'exhale' ? 0.7 : 1.3;
  const bgColor = phase === 'inhale' ? 'from-blue-300 to-cyan-300' : 
                  phase === 'hold' ? 'from-purple-300 to-pink-300' : 
                  'from-green-300 to-emerald-300';

  return (
    <div className="min-h-screen flex items-center justify-center p-8">
      <div className="text-center">
        <motion.h2
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          className="text-4xl font-bold text-purple-600 mb-8"
        >
          Breathing Guide
        </motion.h2>
        
        <div className="relative w-80 h-80 mx-auto mb-8">
          <motion.div
            animate={{ scale }}
            transition={{ duration: phase === 'hold' ? 2 : phase === 'inhale' ? 4 : 6, ease: "easeInOut" }}
            className={cn("absolute inset-0 rounded-full bg-gradient-to-br flex items-center justify-center shadow-2xl", bgColor)}
          >
            <div className="text-center">
              <motion.p
                key={count}
                initial={{ scale: 1.5, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                className="text-6xl font-bold text-white mb-2"
              >
                {count}
              </motion.p>
              <motion.p
                key={phase}
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                className="text-2xl text-white capitalize"
              >
                {phase}
              </motion.p>
            </div>
          </motion.div>
        </div>

        <motion.button
          whileHover={{ scale: 1.05 }}
          whileTap={{ scale: 0.95 }}
          onClick={() => setIsActive(!isActive)}
          className={cn(
            "px-8 py-4 rounded-2xl shadow-lg transform transition-all duration-300",
            isActive 
              ? 'bg-red-500 hover:bg-red-600 text-white' 
              : 'bg-gradient-to-r from-blue-500 to-purple-500 text-white'
          )}
        >
          {isActive ? 'Pause' : 'Start Breathing'}
        </motion.button>

        <div className="mt-8 flex gap-8 justify-center">
          {[
            { label: 'Breath Cycles', value: cycles },
            { label: 'Points Earned', value: cycles * 10 }
          ].map((stat, index) => (
            <motion.div
              key={index}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.2 + index * 0.1 }}
              className="bg-white/70 backdrop-blur-md rounded-2xl p-4 min-w-[120px]"
            >
              <motion.p
                key={stat.value}
                initial={{ scale: 1.3, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                className="text-3xl font-bold text-purple-600"
              >
                {stat.value}
              </motion.p>
              <p className="text-sm text-gray-600">{stat.label}</p>
            </motion.div>
          ))}
        </div>
      </div>
    </div>
  );
};

// Bubble Pop Game with Framer Motion
const BubblePopGame = () => {
  const { addPoints, updateChallenge } = useContext(StressReliefContext);
  const [bubbles, setBubbles] = useState([]);
  const [poppedCount, setPoppedCount] = useState(0);
  const [affirmation, setAffirmation] = useState('');
  const bubbleIdRef = useRef(0);

  const affirmations = [
    "You are doing great!",
    "Stay calm and breathe",
    "You've got this",
    "Peace is within you",
    "You are strong",
    "Relax your shoulders",
    "You are enough",
    "Trust the process",
    "Be kind to yourself",
    "You deserve rest"
  ];

  useEffect(() => {
    const interval = setInterval(() => {
      if (bubbles.length < 15) {
        const newBubble = {
          id: bubbleIdRef.current++,
          x: Math.random() * 85,
          size: 40 + Math.random() * 60,
          color: ['from-blue-300', 'from-purple-300', 'from-pink-300', 'from-green-300'][Math.floor(Math.random() * 4)]
        };
        setBubbles(prev => [...prev, newBubble]);
      }
    }, 1500);

    return () => clearInterval(interval);
  }, [bubbles.length]);

  const popBubble = (id) => {
    setBubbles(prev => prev.filter(b => b.id !== id));
    setPoppedCount(prev => prev + 1);
    addPoints(3);
    updateChallenge(2, 1);
    
    const randomAffirmation = affirmations[Math.floor(Math.random() * affirmations.length)];
    setAffirmation(randomAffirmation);
    setTimeout(() => setAffirmation(''), 2000);
  };

  return (
    <div className="min-h-screen relative overflow-hidden bg-gradient-to-b from-sky-100 to-blue-50">
      <motion.div
        initial={{ opacity: 0, scale: 0.8 }}
        animate={{ opacity: 1, scale: 1 }}
        className="absolute top-8 right-8 bg-white/70 backdrop-blur-md rounded-2xl p-4 shadow-lg z-10"
      >
        <motion.p
          key={poppedCount}
          initial={{ scale: 1.5 }}
          animate={{ scale: 1 }}
          className="text-3xl font-bold text-purple-600"
        >
          {poppedCount}
        </motion.p>
        <p className="text-sm text-gray-600">Bubbles Popped</p>
      </motion.div>

      <AnimatePresence>
        {affirmation && (
          <motion.div
            initial={{ opacity: 0, scale: 0.5, y: 50 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.5, y: -50 }}
            className="absolute top-1/3 left-1/2 transform -translate-x-1/2 z-20"
          >
            <p className="text-3xl font-bold text-purple-600 bg-white/90 backdrop-blur-md rounded-2xl px-8 py-4 shadow-xl">
              {affirmation}
            </p>
          </motion.div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {bubbles.map(bubble => (
          <motion.button
            key={bubble.id}
            initial={{ y: window.innerHeight, opacity: 0 }}
            animate={{ y: -100, opacity: 0.7 }}
            exit={{ scale: 0, opacity: 0 }}
            transition={{ duration: 8 + Math.random() * 4, ease: "linear" }}
            whileHover={{ scale: 1.1 }}
            onClick={() => popBubble(bubble.id)}
            className={cn("absolute rounded-full bg-gradient-to-br to-transparent shadow-lg cursor-pointer", bubble.color)}
            style={{
              left: `${bubble.x}%`,
              width: `${bubble.size}px`,
              height: `${bubble.size}px`,
            }}
          >
            <div className="w-full h-full rounded-full border-2 border-white/30" />
          </motion.button>
        ))}
      </AnimatePresence>

      <div className="absolute bottom-8 left-1/2 transform -translate-x-1/2 text-center">
        <p className="text-lg text-gray-600 bg-white/70 backdrop-blur-md rounded-2xl px-6 py-3">
          Tap the bubbles to pop them and receive positive affirmations
        </p>
      </div>
    </div>
  );
};

// Color Match Game
const ColorMatchGame = () => {
  const { addPoints, updateChallenge } = useContext(StressReliefContext);
  const [targetGradient, setTargetGradient] = useState([]);
  const [selectedColors, setSelectedColors] = useState([]);
  const [score, setScore] = useState(0);
  const [feedback, setFeedback] = useState('');

  const colorPalette = [
    { name: 'Sky', hex: '#87CEEB' },
    { name: 'Lavender', hex: '#E6E6FA' },
    { name: 'Mint', hex: '#98FF98' },
    { name: 'Peach', hex: '#FFDAB9' },
    { name: 'Rose', hex: '#FFB6C1' },
    { name: 'Lilac', hex: '#C8A2C8' },
    { name: 'Sage', hex: '#9DC183' },
    { name: 'Coral', hex: '#FF7F50' }
  ];

  useEffect(() => {
    generateNewChallenge();
  }, []);

  const generateNewChallenge = () => {
    const shuffled = [...colorPalette].sort(() => Math.random() - 0.5);
    setTargetGradient(shuffled.slice(0, 3));
    setSelectedColors([]);
    setFeedback('');
  };

  const selectColor = (color) => {
    if (selectedColors.length < 3) {
      setSelectedColors([...selectedColors, color]);
    }
  };

  const checkMatch = () => {
    const correct = selectedColors.every((color, i) => color.name === targetGradient[i].name);
    if (correct) {
      setScore(score + 1);
      addPoints(15);
      updateChallenge(3, 1);
      setFeedback('Perfect harmony! 🌈');
      setTimeout(generateNewChallenge, 1500);
    } else {
      setFeedback('Try a different combination');
      setTimeout(() => setSelectedColors([]), 1000);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center p-8">
      <div className="max-w-2xl w-full">
        <motion.h2
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          className="text-4xl font-bold text-purple-600 mb-8 text-center"
        >
          Color Harmony
        </motion.h2>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="mb-8"
        >
          <p className="text-center text-gray-600 mb-4">Match this calming gradient:</p>
          <div className="h-32 rounded-3xl shadow-lg flex overflow-hidden">
            {targetGradient.map((color, i) => (
              <motion.div
                key={i}
                initial={{ scaleX: 0 }}
                animate={{ scaleX: 1 }}
                transition={{ delay: i * 0.1 }}
                className="flex-1"
                style={{ backgroundColor: color.hex }}
              />
            ))}
          </div>
        </motion.div>

        <div className="mb-8">
          <p className="text-center text-gray-600 mb-4">Your selection:</p>
          <div className="h-32 rounded-3xl shadow-lg flex overflow-hidden bg-white/70">
            <AnimatePresence>
              {selectedColors.map((color, i) => (
                <motion.div
                  key={i}
                  initial={{ scaleX: 0 }}
                  animate={{ scaleX: 1 }}
                  exit={{ scaleX: 0 }}
                  className="flex-1"
                  style={{ backgroundColor: color.hex }}
                />
              ))}
            </AnimatePresence>
            {Array.from({ length: 3 - selectedColors.length }).map((_, i) => (
              <div key={`empty-${i}`} className="flex-1 bg-gray-100" />
            ))}
          </div>
        </div>

        <div className="grid grid-cols-4 gap-4 mb-8">
          {colorPalette.map((color, index) => (
            <motion.button
              key={color.name}
              initial={{ opacity: 0, scale: 0 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ delay: index * 0.05 }}
              whileHover={{ scale: 1.1, rotate: 5 }}
              whileTap={{ scale: 0.9 }}
              onClick={() => selectColor(color)}
              disabled={selectedColors.length >= 3}
              className="aspect-square rounded-2xl shadow-lg disabled:opacity-50 disabled:cursor-not-allowed"
              style={{ backgroundColor: color.hex }}
            >
              <span className="text-xs text-gray-700 font-medium">{color.name}</span>
            </motion.button>
          ))}
        </div>

        <div className="flex gap-4 justify-center">
          <motion.button
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
            onClick={checkMatch}
            disabled={selectedColors.length !== 3}
            className="px-8 py-4 bg-gradient-to-r from-purple-500 to-pink-500 text-white rounded-2xl shadow-lg disabled:opacity-50"
          >
            Check Match
          </motion.button>
          <motion.button
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
            onClick={() => setSelectedColors([])}
            className="px-8 py-4 bg-white/70 backdrop-blur-md text-purple-600 rounded-2xl shadow-lg"
          >
            Clear
          </motion.button>
        </div>

        <AnimatePresence>
          {feedback && (
            <motion.p
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              className="text-center text-2xl font-bold text-purple-600 mt-4"
            >
              {feedback}
            </motion.p>
          )}
        </AnimatePresence>

        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.5 }}
          className="mt-8 text-center bg-white/70 backdrop-blur-md rounded-2xl p-4"
        >
          <motion.p
            key={score}
            initial={{ scale: 1.5 }}
            animate={{ scale: 1 }}
            className="text-3xl font-bold text-purple-600"
          >
            {score}
          </motion.p>
          <p className="text-sm text-gray-600">Perfect Matches</p>
        </motion.div>
      </div>
    </div>
  );
};

// Zen Garden Game
const ZenGardenGame = () => {
  const { addPoints } = useContext(StressReliefContext);
  const canvasRef = useRef(null);
  const [isDrawing, setIsDrawing] = useState(false);
  const [strokes, setStrokes] = useState(0);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    canvas.width = canvas.offsetWidth;
    canvas.height = canvas.offsetHeight;

    ctx.fillStyle = '#f5deb3';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
  }, []);

  const startDrawing = (e) => {
    setIsDrawing(true);
    draw(e);
  };

  const stopDrawing = () => {
    setIsDrawing(false);
    setStrokes(s => s + 1);
    if (strokes > 0 && strokes % 10 === 0) {
      addPoints(5);
    }
  };

  const draw = (e) => {
    if (!isDrawing && e.type !== 'mousedown' && e.type !== 'touchstart') return;

    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    const rect = canvas.getBoundingClientRect();
    
    const x = (e.clientX || e.touches?.[0]?.clientX) - rect.left;
    const y = (e.clientY || e.touches?.[0]?.clientY) - rect.top;

    ctx.strokeStyle = '#8b7355';
    ctx.lineWidth = 3;
    ctx.lineCap = 'round';
    ctx.shadowBlur = 10;
    ctx.shadowColor = 'rgba(139, 115, 85, 0.5)';

    if (e.type === 'mousedown' || e.type === 'touchstart') {
      ctx.beginPath();
      ctx.moveTo(x, y);
    } else {
      ctx.lineTo(x, y);
      ctx.stroke();
    }
  };

  const clearCanvas = () => {
    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    ctx.fillStyle = '#f5deb3';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    setStrokes(0);
  };

  return (
    <div className="min-h-screen flex items-center justify-center p-8 bg-gradient-to-br from-amber-50 to-orange-50">
      <div className="max-w-4xl w-full">
        <motion.h2
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          className="text-4xl font-bold text-purple-600 mb-8 text-center"
        >
          Zen Garden
        </motion.h2>
        
        <motion.div
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.5 }}
          className="bg-white/70 backdrop-blur-md rounded-3xl p-8 shadow-2xl"
        >
          <p className="text-center text-gray-600 mb-6">
            Draw peaceful patterns in the sand. Let your mind relax as you create.
          </p>

          <canvas
            ref={canvasRef}
            onMouseDown={startDrawing}
            onMouseMove={draw}
            onMouseUp={stopDrawing}
            onMouseLeave={stopDrawing}
            onTouchStart={startDrawing}
            onTouchMove={draw}
            onTouchEnd={stopDrawing}
            className="w-full h-96 rounded-2xl cursor-crosshair shadow-inner border-4 border-amber-200"
            style={{ touchAction: 'none' }}
          />

          <div className="mt-6 flex justify-between items-center">
            <motion.button
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
              onClick={clearCanvas}
              className="px-6 py-3 bg-gradient-to-r from-orange-500 to-amber-500 text-white rounded-xl shadow-lg"
            >
              Clear Garden
            </motion.button>

            <div className="bg-white/60 rounded-xl px-6 py-3">
              <motion.p
                key={strokes}
                initial={{ scale: 1.5 }}
                animate={{ scale: 1 }}
                className="text-2xl font-bold text-purple-600"
              >
                {strokes}
              </motion.p>
              <p className="text-xs text-gray-600">Peaceful Strokes</p>
            </div>
          </div>
        </motion.div>
      </div>
    </div>
  );
};

// Memory Calm Game
const MemoryCalmGame = () => {
  const { addPoints, unlockBadge } = useContext(StressReliefContext);
  const [cards, setCards] = useState([]);
  const [flipped, setFlipped] = useState([]);
  const [matched, setMatched] = useState([]);
  const [moves, setMoves] = useState(0);
  const [wins, setWins] = useState(0);

  const icons = ['🌸', '🌿', '⭐', '🌙', '🦋', '🌊', '🍃', '☀️'];

  useEffect(() => {
    initializeGame();
  }, []);

  const initializeGame = () => {
    const shuffled = [...icons, ...icons]
      .sort(() => Math.random() - 0.5)
      .map((icon, index) => ({ id: index, icon }));
    setCards(shuffled);
    setFlipped([]);
    setMatched([]);
    setMoves(0);
  };

  const handleCardClick = (index) => {
    if (flipped.length === 2 || flipped.includes(index) || matched.includes(index)) return;

    const newFlipped = [...flipped, index];
    setFlipped(newFlipped);

    if (newFlipped.length === 2) {
      setMoves(moves + 1);
      const [first, second] = newFlipped;
      
      if (cards[first].icon === cards[second].icon) {
        setMatched([...matched, first, second]);
        setFlipped([]);
        addPoints(20);
        
        if (matched.length + 2 === cards.length) {
          setWins(wins + 1);
          if (wins === 2) {
            unlockBadge('Memory Master');
          }
          setTimeout(() => {
            if (confirm('🎉 You found all pairs! Play again?')) {
              initializeGame();
            }
          }, 500);
        }
      } else {
        setTimeout(() => setFlipped([]), 1000);
      }
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center p-8">
      <div className="max-w-3xl w-full">
        <motion.h2
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          className="text-4xl font-bold text-purple-600 mb-8 text-center"
        >
          Memory Calm
        </motion.h2>

        <div className="mb-6 flex justify-between items-center">
          <div className="bg-white/70 backdrop-blur-md rounded-xl px-6 py-3">
            <motion.p
              key={moves}
              initial={{ scale: 1.5 }}
              animate={{ scale: 1 }}
              className="text-2xl font-bold text-purple-600"
            >
              {moves}
            </motion.p>
            <p className="text-xs text-gray-600">Moves</p>
          </div>
          <motion.button
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
            onClick={initializeGame}
            className="px-6 py-3 bg-gradient-to-r from-purple-500 to-pink-500 text-white rounded-xl shadow-lg"
          >
            New Game
          </motion.button>
          <div className="bg-white/70 backdrop-blur-md rounded-xl px-6 py-3">
            <motion.p
              key={wins}
              initial={{ scale: 1.5 }}
              animate={{ scale: 1 }}
              className="text-2xl font-bold text-purple-600"
            >
              {wins}
            </motion.p>
            <p className="text-xs text-gray-600">Wins</p>
          </div>
        </div>

        <div className="grid grid-cols-4 gap-4">
          {cards.map((card, index) => (
            <motion.button
              key={card.id}
              initial={{ opacity: 0, rotateY: 180 }}
              animate={{ opacity: 1, rotateY: 0 }}
              transition={{ delay: index * 0.05 }}
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
              onClick={() => handleCardClick(index)}
              className={cn(
                "aspect-square rounded-2xl shadow-lg transform transition-all duration-300",
                flipped.includes(index) || matched.includes(index)
                  ? 'bg-white'
                  : 'bg-gradient-to-br from-purple-400 to-pink-400'
              )}
            >
              <motion.div
                initial={false}
                animate={{ rotateY: (flipped.includes(index) || matched.includes(index)) ? 0 : 180 }}
                transition={{ duration: 0.3 }}
                className="w-full h-full flex items-center justify-center text-5xl"
              >
                {(flipped.includes(index) || matched.includes(index)) ? card.icon : ''}
              </motion.div>
            </motion.button>
          ))}
        </div>

        <p className="text-center text-gray-600 mt-6">
          Find matching pairs of nature symbols. Take your time - there's no rush!
        </p>
      </div>
    </div>
  );
};

// Progress Dashboard
const ProgressDashboard = ({ onNavigate }) => {
  const { userStats } = useContext(StressReliefContext);

  const allBadges = [
    { name: 'Calm Beginner', description: 'Started your journey', icon: '🌱', unlocked: true },
    { name: 'Breathing Master', description: 'Completed 10 breath cycles', icon: '🌬️', unlocked: userStats.badges.includes('Breathing Master') },
    { name: 'Memory Master', description: 'Won 3 memory games', icon: '🧠', unlocked: userStats.badges.includes('Memory Master') },
    { name: 'Zen Artist', description: 'Drew 50 strokes', icon: '🎨', unlocked: userStats.badges.includes('Zen Artist') },
    { name: 'Relaxation Expert', description: 'Completed muscle relaxation', icon: '💪', unlocked: userStats.badges.includes('Relaxation Expert') },
    { name: 'Mandala Master', description: 'Colored complete mandala', icon: '🎭', unlocked: userStats.badges.includes('Mandala Master') },
    { name: 'Sound Composer', description: 'Mixed 5 sounds together', icon: '🎵', unlocked: userStats.badges.includes('Sound Composer') },
    { name: 'Stress-Free Streak', description: '7 days active', icon: '🔥', unlocked: userStats.streakDays >= 7 }
  ];

  return (
    <div className="min-h-screen p-8">
      <div className="max-w-6xl mx-auto">
        <div className="flex items-center justify-between mb-8">
          <motion.button
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
            onClick={() => onNavigate('home')}
            className="flex items-center gap-2 text-purple-600 hover:text-purple-700 transition-colors"
          >
            <Home className="w-5 h-5" />
            <span>Home</span>
          </motion.button>
          <motion.h2
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            className="text-3xl font-bold text-purple-600"
          >
            Your Progress
          </motion.h2>
          <div className="w-20" />
        </div>

        <div className="grid md:grid-cols-3 gap-6 mb-8">
          {[
            { icon: Star, value: userStats.relaxationPoints, label: 'Total Calm Points', color: 'text-yellow-500' },
            { icon: TrendingDown, value: `${100 - userStats.stressLevel}%`, label: 'Stress Reduced', color: 'text-green-500' },
            { icon: Award, value: userStats.badges.length, label: 'Badges Earned', color: 'text-blue-500' }
          ].map((stat, index) => (
            <motion.div
              key={index}
              initial={{ opacity: 0, y: 50 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: index * 0.1 }}
              whileHover={{ scale: 1.05 }}
              className="bg-white/70 backdrop-blur-md rounded-3xl p-6 shadow-lg"
            >
              <stat.icon className={cn("w-12 h-12 mb-4", stat.color)} />
              <motion.p
                key={stat.value}
                initial={{ scale: 1.5, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                className="text-4xl font-bold text-purple-600 mb-2"
              >
                {stat.value}
              </motion.p>
              <p className="text-gray-600">{stat.label}</p>
            </motion.div>
          ))}
        </div>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3 }}
          className="bg-white/70 backdrop-blur-md rounded-3xl p-6 shadow-lg mb-8"
        >
          <h3 className="text-2xl font-bold text-purple-600 mb-4">Daily Challenges</h3>
          <div className="space-y-3">
            {userStats.dailyChallenges.map((challenge, index) => (
              <motion.div
                key={challenge.id}
                initial={{ opacity: 0, x: -50 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: 0.4 + index * 0.1 }}
                className="flex items-center justify-between p-4 bg-white/50 rounded-xl"
              >
                <div className="flex items-center gap-3">
                  <motion.div
                    animate={{ scale: challenge.completed ? [1, 1.2, 1] : 1 }}
                    className={cn(
                      "w-6 h-6 rounded-full flex items-center justify-center",
                      challenge.completed ? 'bg-green-500' : 'bg-gray-300'
                    )}
                  >
                    {challenge.completed && <span className="text-white text-xs">✓</span>}
                  </motion.div>
                  <div>
                    <p className="font-medium text-gray-800">{challenge.text}</p>
                    {challenge.target && (
                      <p className="text-sm text-gray-500">
                        Progress: {challenge.progress || 0}/{challenge.target}
                      </p>
                    )}
                  </div>
                </div>
                <span className="text-purple-600 font-bold">+{challenge.points}</span>
              </motion.div>
            ))}
          </div>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.6 }}
          className="bg-white/70 backdrop-blur-md rounded-3xl p-6 shadow-lg"
        >
          <h3 className="text-2xl font-bold text-purple-600 mb-4">Achievement Badges</h3>
          <div className="grid md:grid-cols-3 gap-4">
            {allBadges.map((badge, index) => (
              <motion.div
                key={badge.name}
                initial={{ opacity: 0, scale: 0.5 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ delay: 0.7 + index * 0.1 }}
                whileHover={{ scale: badge.unlocked ? 1.05 : 1 }}
                className={cn(
                  "p-6 rounded-2xl text-center transition-all duration-300",
                  badge.unlocked
                    ? 'bg-gradient-to-br from-purple-100 to-pink-100 shadow-md'
                    : 'bg-gray-100 opacity-50'
                )}
              >
                <div className="text-5xl mb-3">{badge.icon}</div>
                <p className="font-bold text-gray-800 mb-1">{badge.name}</p>
                <p className="text-sm text-gray-600">{badge.description}</p>
                {badge.unlocked && (
                  <motion.div
                    initial={{ scale: 0 }}
                    animate={{ scale: 1 }}
                    className="mt-2 inline-block px-3 py-1 bg-green-500 text-white text-xs rounded-full"
                  >
                    Unlocked
                  </motion.div>
                )}
              </motion.div>
            ))}
          </div>
        </motion.div>
      </div>
    </div>
  );
};

export default StressReliefApp;