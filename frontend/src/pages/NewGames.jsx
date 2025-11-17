import React, { useState, useEffect, useRef, useContext } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Droplets, Volume2, Hand, ImageIcon, User, Play, Pause, RotateCcw, Check } from 'lucide-react';

// Import this component into your existing StressReliefContext
// You'll need to use the context like: const { addPoints, unlockBadge } = useContext(StressReliefContext);

// Game 1: Progressive Muscle Relaxation
const MuscleRelaxationGame = () => {
  // This game guides users through progressive muscle relaxation, a clinically proven stress reduction technique
  // where you systematically tense and release different muscle groups
  
  const [currentStep, setCurrentStep] = useState(0);
  const [phase, setPhase] = useState('instruction'); // instruction, tense, relax, complete
  const [countdown, setCountdown] = useState(5);
  const [completedGroups, setCompletedGroups] = useState(0);

  // These are the major muscle groups we'll work through, ordered from extremities toward the core
  // This ordering follows the standard clinical protocol for progressive muscle relaxation
  const muscleGroups = [
    { name: 'Hands & Forearms', instruction: 'Make tight fists with both hands', body: 'hands' },
    { name: 'Upper Arms', instruction: 'Bend your elbows and tense your biceps', body: 'arms' },
    { name: 'Shoulders', instruction: 'Raise your shoulders up toward your ears', body: 'shoulders' },
    { name: 'Face', instruction: 'Scrunch up your entire face', body: 'face' },
    { name: 'Chest & Back', instruction: 'Take a deep breath and hold it', body: 'chest' },
    { name: 'Stomach', instruction: 'Tighten your abdominal muscles', body: 'stomach' },
    { name: 'Legs & Feet', instruction: 'Point your toes and tense your leg muscles', body: 'legs' }
  ];

  const currentMuscle = muscleGroups[currentStep];

  useEffect(() => {
    if (phase === 'tense' || phase === 'relax') {
      const timer = setInterval(() => {
        setCountdown(prev => {
          if (prev <= 1) {
            if (phase === 'tense') {
              setPhase('relax');
              return 10; // Relaxation phase is longer than tension phase
            } else {
              if (currentStep < muscleGroups.length - 1) {
                setCurrentStep(currentStep + 1);
                setPhase('instruction');
                setCompletedGroups(prev => prev + 1);
              } else {
                setPhase('complete');
                setCompletedGroups(muscleGroups.length);
              }
              return 5;
            }
          }
          return prev - 1;
        });
      }, 1000);
      return () => clearInterval(timer);
    }
  }, [phase, currentStep]);

  const startExercise = () => {
    setPhase('tense');
    setCountdown(5);
  };

  const restart = () => {
    setCurrentStep(0);
    setPhase('instruction');
    setCompletedGroups(0);
  };

  return (
    <div className="min-h-screen flex items-center justify-center p-8 bg-gradient-to-br from-indigo-50 to-purple-50">
      <div className="max-w-2xl w-full">
        <motion.h2
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          className="text-4xl font-bold text-purple-600 mb-8 text-center"
        >
          Progressive Muscle Relaxation
        </motion.h2>

        {phase !== 'complete' ? (
          <motion.div
            key={currentStep}
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            className="bg-white/70 backdrop-blur-md rounded-3xl p-8 shadow-2xl"
          >
            {/* Progress indicator showing which muscle group we're on */}
            <div className="mb-6">
              <div className="flex justify-between text-sm text-gray-600 mb-2">
                <span>Progress</span>
                <span>{completedGroups} / {muscleGroups.length}</span>
              </div>
              <div className="w-full h-2 bg-gray-200 rounded-full overflow-hidden">
                <motion.div
                  initial={{ width: 0 }}
                  animate={{ width: `${(completedGroups / muscleGroups.length) * 100}%` }}
                  transition={{ duration: 0.5 }}
                  className="h-full bg-gradient-to-r from-purple-500 to-pink-500"
                />
              </div>
            </div>

            <h3 className="text-2xl font-bold text-gray-800 mb-4">{currentMuscle.name}</h3>

            {phase === 'instruction' && (
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                className="text-center"
              >
                <p className="text-lg text-gray-700 mb-6">{currentMuscle.instruction}</p>
                <p className="text-sm text-gray-600 mb-8">
                  When ready, press the button below. You'll tense for 5 seconds, then relax for 10 seconds.
                </p>
                <motion.button
                  whileHover={{ scale: 1.05 }}
                  whileTap={{ scale: 0.95 }}
                  onClick={startExercise}
                  className="px-8 py-4 bg-gradient-to-r from-purple-500 to-pink-500 text-white rounded-2xl shadow-lg flex items-center gap-2 mx-auto"
                >
                  <Play className="w-5 h-5" />
                  Start Exercise
                </motion.button>
              </motion.div>
            )}

            {phase === 'tense' && (
              <motion.div
                animate={{ scale: [1, 1.05, 1] }}
                transition={{ duration: 1, repeat: Infinity }}
                className="text-center"
              >
                <div className="text-6xl font-bold text-red-500 mb-4">{countdown}</div>
                <p className="text-2xl font-bold text-gray-800 mb-4">TENSE</p>
                <p className="text-gray-600">Hold the tension in your {currentMuscle.name.toLowerCase()}</p>
              </motion.div>
            )}

            {phase === 'relax' && (
              <motion.div
                animate={{ opacity: [0.7, 1, 0.7] }}
                transition={{ duration: 2, repeat: Infinity }}
                className="text-center"
              >
                <div className="text-6xl font-bold text-green-500 mb-4">{countdown}</div>
                <p className="text-2xl font-bold text-gray-800 mb-4">RELAX</p>
                <p className="text-gray-600">Feel the tension melting away from your {currentMuscle.name.toLowerCase()}</p>
              </motion.div>
            )}
          </motion.div>
        ) : (
          <motion.div
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            className="bg-white/70 backdrop-blur-md rounded-3xl p-8 shadow-2xl text-center"
          >
            <motion.div
              initial={{ scale: 0 }}
              animate={{ scale: 1 }}
              transition={{ type: "spring", duration: 0.6 }}
              className="w-24 h-24 bg-green-500 rounded-full flex items-center justify-center mx-auto mb-6"
            >
              <Check className="w-12 h-12 text-white" />
            </motion.div>
            <h3 className="text-3xl font-bold text-gray-800 mb-4">Exercise Complete!</h3>
            <p className="text-lg text-gray-600 mb-8">
              You've successfully relaxed all major muscle groups. Notice how calm your body feels now.
            </p>
            <motion.button
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
              onClick={restart}
              className="px-8 py-4 bg-gradient-to-r from-purple-500 to-pink-500 text-white rounded-2xl shadow-lg flex items-center gap-2 mx-auto"
            >
              <RotateCcw className="w-5 h-5" />
              Start Again
            </motion.button>
          </motion.div>
        )}
      </div>
    </div>
  );
};

// Game 2: Mandala Coloring
const MandalaColoringGame = () => {
  // Mandala coloring combines art therapy with the meditative properties of symmetrical patterns
  // The repetitive act of choosing colors and filling spaces creates a flow state
  
  const [selectedColor, setSelectedColor] = useState('#9333EA');
  const [coloredSections, setColoredSections] = useState({});
  const [completionPercent, setCompletionPercent] = useState(0);

  // A rich palette of calming, nature-inspired colors
  const colorPalette = [
    '#9333EA', '#EC4899', '#F59E0B', '#10B981', '#3B82F6',
    '#8B5CF6', '#F97316', '#14B8A6', '#6366F1', '#EF4444',
    '#A855F7', '#F472B6', '#FBBF24', '#34D399', '#60A5FA'
  ];

  // Generate mandala sections - in a real implementation, this would be more complex SVG paths
  // For simplicity, we're creating a circular pattern of clickable sections
  const sections = Array.from({ length: 24 }, (_, i) => ({
    id: i,
    angle: (i * 15) - 90, // Each section is 15 degrees, starting from top
    radius: 50 + (i % 3) * 30 // Three concentric rings
  }));

  useEffect(() => {
    const colored = Object.keys(coloredSections).length;
    setCompletionPercent(Math.round((colored / sections.length) * 100));
  }, [coloredSections]);

  const colorSection = (id) => {
    setColoredSections(prev => ({
      ...prev,
      [id]: selectedColor
    }));
  };

  const clearAll = () => {
    setColoredSections({});
  };

  return (
    <div className="min-h-screen flex items-center justify-center p-8 bg-gradient-to-br from-pink-50 to-purple-50">
      <div className="max-w-4xl w-full">
        <motion.h2
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          className="text-4xl font-bold text-purple-600 mb-8 text-center"
        >
          Mandala Coloring
        </motion.h2>

        <div className="grid md:grid-cols-3 gap-6">
          {/* Color Palette */}
          <div className="bg-white/70 backdrop-blur-md rounded-3xl p-6 shadow-lg">
            <h3 className="text-lg font-bold text-gray-800 mb-4">Choose Your Color</h3>
            <div className="grid grid-cols-3 gap-3 mb-6">
              {colorPalette.map(color => (
                <motion.button
                  key={color}
                  whileHover={{ scale: 1.1 }}
                  whileTap={{ scale: 0.9 }}
                  onClick={() => setSelectedColor(color)}
                  className={`w-12 h-12 rounded-xl shadow-lg transition-all ${
                    selectedColor === color ? 'ring-4 ring-purple-500' : ''
                  }`}
                  style={{ backgroundColor: color }}
                />
              ))}
            </div>

            <div className="mb-4">
              <div className="flex justify-between text-sm text-gray-600 mb-2">
                <span>Completion</span>
                <span>{completionPercent}%</span>
              </div>
              <div className="w-full h-2 bg-gray-200 rounded-full overflow-hidden">
                <motion.div
                  animate={{ width: `${completionPercent}%` }}
                  className="h-full bg-gradient-to-r from-purple-500 to-pink-500"
                />
              </div>
            </div>

            <motion.button
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
              onClick={clearAll}
              className="w-full px-4 py-3 bg-gray-200 hover:bg-gray-300 rounded-xl font-medium text-gray-700 transition-colors"
            >
              Clear All
            </motion.button>
          </div>

          {/* Mandala Canvas */}
          <div className="md:col-span-2 bg-white/70 backdrop-blur-md rounded-3xl p-8 shadow-lg flex items-center justify-center">
            <svg width="400" height="400" viewBox="0 0 400 400">
              {/* Center circle for visual appeal */}
              <circle cx="200" cy="200" r="40" fill="#E9D5FF" />
              
              {/* Render each section as a clickable path */}
              {sections.map(section => {
                const startAngle = section.angle * (Math.PI / 180);
                const endAngle = (section.angle + 15) * (Math.PI / 180);
                const innerRadius = section.radius;
                const outerRadius = section.radius + 25;

                // Calculate the path coordinates for each wedge section
                const x1 = 200 + innerRadius * Math.cos(startAngle);
                const y1 = 200 + innerRadius * Math.sin(startAngle);
                const x2 = 200 + outerRadius * Math.cos(startAngle);
                const y2 = 200 + outerRadius * Math.sin(startAngle);
                const x3 = 200 + outerRadius * Math.cos(endAngle);
                const y3 = 200 + outerRadius * Math.sin(endAngle);
                const x4 = 200 + innerRadius * Math.cos(endAngle);
                const y4 = 200 + innerRadius * Math.sin(endAngle);

                const pathData = `M ${x1} ${y1} L ${x2} ${y2} A ${outerRadius} ${outerRadius} 0 0 1 ${x3} ${y3} L ${x4} ${y4} A ${innerRadius} ${innerRadius} 0 0 0 ${x1} ${y1}`;

                return (
                  <motion.path
                    key={section.id}
                    d={pathData}
                    fill={coloredSections[section.id] || '#F3F4F6'}
                    stroke="#9CA3AF"
                    strokeWidth="1"
                    onClick={() => colorSection(section.id)}
                    whileHover={{ opacity: 0.8 }}
                    className="cursor-pointer transition-opacity"
                  />
                );
              })}
            </svg>
          </div>
        </div>

        <p className="text-center text-gray-600 mt-6">
          Click on sections of the mandala to color them. Take your time and enjoy the process.
        </p>
      </div>
    </div>
  );
};

// Game 3: Rain Sounds Composer
const RainSoundsGame = () => {
  // Nature sounds have been scientifically shown to reduce cortisol and promote relaxation
  // This game lets users create their perfect soundscape by layering different elements
  
  const [activeSounds, setActiveSounds] = useState({});
  const [masterVolume, setMasterVolume] = useState(70);

  // In a real implementation, these would be actual audio files
  // For now, we're creating the UI that would control them
  const soundOptions = [
    { id: 'light-rain', name: 'Light Rain', icon: '🌧️', description: 'Gentle rainfall on leaves' },
    { id: 'heavy-rain', name: 'Heavy Rain', icon: '⛈️', description: 'Powerful downpour' },
    { id: 'thunder', name: 'Thunder', icon: '⚡', description: 'Distant rumbling' },
    { id: 'wind', name: 'Wind', icon: '💨', description: 'Soft breeze through trees' },
    { id: 'stream', name: 'Stream', icon: '🏞️', description: 'Babbling brook' },
    { id: 'birds', name: 'Birds', icon: '🐦', description: 'Morning chirping' }
  ];

  const toggleSound = (id) => {
    setActiveSounds(prev => {
      if (prev[id]) {
        const { [id]: removed, ...rest } = prev;
        return rest;
      }
      return { ...prev, [id]: 50 }; // Default volume 50%
    });
  };

  const updateSoundVolume = (id, volume) => {
    setActiveSounds(prev => ({
      ...prev,
      [id]: volume
    }));
  };

  const activeCount = Object.keys(activeSounds).length;

  return (
    <div className="min-h-screen flex items-center justify-center p-8 bg-gradient-to-br from-blue-50 to-cyan-50">
      <div className="max-w-4xl w-full">
        <motion.h2
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          className="text-4xl font-bold text-purple-600 mb-4 text-center"
        >
          Rain Sounds Composer
        </motion.h2>
        <p className="text-center text-gray-600 mb-8">
          Create your perfect soundscape by mixing different nature sounds
        </p>

        {/* Master Volume Control */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="bg-white/70 backdrop-blur-md rounded-3xl p-6 shadow-lg mb-6"
        >
          <div className="flex items-center gap-4">
            <Volume2 className="w-6 h-6 text-gray-600" />
            <div className="flex-1">
              <div className="flex justify-between text-sm text-gray-600 mb-2">
                <span>Master Volume</span>
                <span>{masterVolume}%</span>
              </div>
              <input
                type="range"
                min="0"
                max="100"
                value={masterVolume}
                onChange={(e) => setMasterVolume(Number(e.target.value))}
                className="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer"
              />
            </div>
          </div>
        </motion.div>

        {/* Sound Cards */}
        <div className="grid md:grid-cols-2 gap-4">
          {soundOptions.map((sound, index) => {
            const isActive = activeSounds[sound.id] !== undefined;
            const volume = activeSounds[sound.id] || 50;

            return (
              <motion.div
                key={sound.id}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: index * 0.1 }}
                className={`bg-white/70 backdrop-blur-md rounded-2xl p-6 shadow-lg transition-all ${
                  isActive ? 'ring-2 ring-purple-500' : ''
                }`}
              >
                <div className="flex items-start justify-between mb-4">
                  <div className="flex items-center gap-3">
                    <span className="text-3xl">{sound.icon}</span>
                    <div>
                      <h3 className="font-bold text-gray-800">{sound.name}</h3>
                      <p className="text-sm text-gray-600">{sound.description}</p>
                    </div>
                  </div>
                  <motion.button
                    whileHover={{ scale: 1.1 }}
                    whileTap={{ scale: 0.9 }}
                    onClick={() => toggleSound(sound.id)}
                    className={`p-2 rounded-full transition-colors ${
                      isActive
                        ? 'bg-purple-500 text-white'
                        : 'bg-gray-200 text-gray-600'
                    }`}
                  >
                    {isActive ? <Pause className="w-5 h-5" /> : <Play className="w-5 h-5" />}
                  </motion.button>
                </div>

                {isActive && (
                  <motion.div
                    initial={{ opacity: 0, height: 0 }}
                    animate={{ opacity: 1, height: 'auto' }}
                    exit={{ opacity: 0, height: 0 }}
                  >
                    <input
                      type="range"
                      min="0"
                      max="100"
                      value={volume}
                      onChange={(e) => updateSoundVolume(sound.id, Number(e.target.value))}
                      className="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer"
                    />
                    <div className="flex justify-between text-xs text-gray-500 mt-1">
                      <span>Volume</span>
                      <span>{volume}%</span>
                    </div>
                  </motion.div>
                )}
              </motion.div>
            );
          })}
        </div>

        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.6 }}
          className="mt-6 text-center bg-white/70 backdrop-blur-md rounded-2xl p-4"
        >
          <p className="text-gray-600">
            {activeCount === 0 ? 'Select sounds above to begin' : 
             activeCount === 1 ? 'Try adding more layers to enrich your soundscape' :
             `Perfect! You're mixing ${activeCount} sounds together`}
          </p>
        </motion.div>
      </div>
    </div>
  );
};

// Game 4: Stress Ball Simulator
const StressBallGame = () => {
  // Physical stress balls work by providing a tactile outlet for nervous energy
  // This digital version uses visual feedback and mouse interaction to create satisfaction
  
  const [squeezeCount, setSqueezeCount] = useState(0);
  const [isSqueezing, setIsSqueezing] = useState(false);
  const [ballColor, setBallColor] = useState('#9333EA');
  const [intensity, setIntensity] = useState(1);

  const colors = [
    { name: 'Purple', hex: '#9333EA' },
    { name: 'Pink', hex: '#EC4899' },
    { name: 'Blue', hex: '#3B82F6' },
    { name: 'Green', hex: '#10B981' },
    { name: 'Orange', hex: '#F97316' }
  ];

  const handleSqueeze = () => {
    setIsSqueezing(true);
    setSqueezeCount(prev => prev + 1);
    setIntensity(0.7);
    
    // Create a satisfying bounce-back animation
    setTimeout(() => {
      setIsSqueezing(false);
      setIntensity(1);
    }, 200);
  };

  // Allow spacebar to squeeze as well, for keyboard accessibility
  useEffect(() => {
    const handleKeyPress = (e) => {
      if (e.code === 'Space' && !isSqueezing) {
        e.preventDefault();
        handleSqueeze();
      }
    };
    window.addEventListener('keydown', handleKeyPress);
    return () => window.removeEventListener('keydown', handleKeyPress);
  }, [isSqueezing]);

  return (
    <div className="min-h-screen flex items-center justify-center p-8 bg-gradient-to-br from-purple-50 to-pink-50">
      <div className="max-w-2xl w-full text-center">
        <motion.h2
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          className="text-4xl font-bold text-purple-600 mb-4"
        >
          Stress Ball Simulator
        </motion.h2>
        <p className="text-gray-600 mb-8">
          Click the ball or press spacebar to squeeze. Let out that tension!
        </p>

        {/* The Stress Ball */}
        <motion.div
          className="mb-8 flex justify-center"
          animate={{
            scale: isSqueezing ? 0.85 : 1,
          }}
          transition={{ type: "spring", stiffness: 500, damping: 15 }}
        >
          <motion.button
            whileHover={{ scale: 1.05 }}
            onClick={handleSqueeze}
            disabled={isSqueezing}
            className="relative w-64 h-64 rounded-full shadow-2xl cursor-pointer focus:outline-none focus:ring-4 focus:ring-purple-300 transition-shadow"
            style={{
              background: `radial-gradient(circle at 30% 30%, ${ballColor}dd, ${ballColor})`
            }}
          >
            {/* Shine effect on the ball */}
            <motion.div
              className="absolute top-8 left-8 w-24 h-24 rounded-full bg-white opacity-30 blur-2xl"
              animate={{
                opacity: isSqueezing ? 0.1 : 0.3,
                scale: isSqueezing ? 0.8 : 1
              }}
            />
            
            {/* Hand icon appears when hovering */}
            <div className="absolute inset-0 flex items-center justify-center">
              <Hand className="w-16 h-16 text-white opacity-50" />
            </div>
          </motion.button>
        </motion.div>

        {/* Statistics */}
        <div className="bg-white/70 backdrop-blur-md rounded-3xl p-6 shadow-lg mb-6">
          <div className="text-center">
            <motion.p
              key={squeezeCount}
              initial={{ scale: 1.5, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              className="text-6xl font-bold text-purple-600 mb-2"
            >
              {squeezeCount}
            </motion.p>
            <p className="text-gray-600">Squeezes Released</p>
          </div>
        </div>

        {/* Color Selection */}
        <div className="bg-white/70 backdrop-blur-md rounded-3xl p-6 shadow-lg">
          <h3 className="text-lg font-bold text-gray-800 mb-4">Choose Ball Color</h3>
          <div className="flex gap-3 justify-center">
            {colors.map(color => (
              <motion.button
                key={color.hex}
                whileHover={{ scale: 1.1 }}
                whileTap={{ scale: 0.9 }}
                onClick={() => setBallColor(color.hex)}
                className={`w-12 h-12 rounded-full shadow-lg transition-all ${
                  ballColor === color.hex ? 'ring-4 ring-purple-500' : ''
                }`}
                style={{ backgroundColor: color.hex }}
                title={color.name}
              />
            ))}
          </div>
        </div>

        {/* Tip */}
        <motion.p
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 1 }}
          className="mt-6 text-sm text-gray-500"
        >
          💡 Tip: Try rhythmic squeezing in sync with your breath for maximum relaxation
        </motion.p>
      </div>
    </div>
  );
};

// Game 5: Guided Imagery Journey
const GuidedImageryGame = () => {
  // Guided imagery is a therapeutic technique that uses the mind-body connection
  // Vivid mental imagery activates the same neural pathways as actual experiences
  
  const [currentScene, setCurrentScene] = useState(0);
  const [isPlaying, setIsPlaying] = useState(false);
  const [progress, setProgress] = useState(0);

  const scenes = [
    {
      title: "Welcome to Your Peaceful Journey",
      text: "Find a comfortable position. Take a deep breath in... and slowly release it. Close your eyes if you feel comfortable, or soften your gaze. You are about to embark on a journey to a place of complete peace and tranquility.",
      background: "from-blue-100 to-purple-100",
      duration: 8000
    },
    {
      title: "The Forest Path",
      text: "You find yourself standing at the entrance of a beautiful forest. The air is fresh and cool against your skin. Sunlight filters through the leaves above, creating dancing patterns of light and shadow on the soft earth beneath your feet. You begin walking down a peaceful path.",
      background: "from-green-100 to-emerald-100",
      duration: 12000
    },
    {
      title: "The Clearing",
      text: "As you walk, you notice the gentle sounds around you - leaves rustling in a soft breeze, birds singing their peaceful melodies, and the distant sound of flowing water. The path opens into a beautiful clearing filled with wildflowers in every color imaginable.",
      background: "from-yellow-100 to-pink-100",
      duration: 12000
    },
    {
      title: "The Stream",
      text: "You follow the sound of water and discover a crystal-clear stream. You sit beside it on a smooth, sun-warmed rock. The water flows gently over stones, creating a soothing, rhythmic sound. You feel completely safe and at peace here.",
      background: "from-cyan-100 to-blue-100",
      duration: 12000
    },
    {
      title: "Deep Relaxation",
      text: "As you sit by the stream, you feel any remaining tension flowing out of your body, carried away by the water. Your breathing is calm and steady. Your mind is quiet and peaceful. You are completely relaxed, completely at ease.",
      background: "from-indigo-100 to-purple-100",
      duration: 12000
    },
    {
      title: "Returning Refreshed",
      text: "When you're ready, you slowly become aware of your surroundings again. You carry this feeling of peace and calm with you as you return. Take a deep breath, and when you open your eyes, you'll feel refreshed, relaxed, and centered.",
      background: "from-purple-100 to-pink-100",
      duration: 10000
    }
  ];

  const currentSceneData = scenes[currentScene];

  useEffect(() => {
    if (isPlaying) {
      const duration = currentSceneData.duration;
      const interval = 100; // Update every 100ms for smooth progress bar
      const steps = duration / interval;
      let step = 0;

      const timer = setInterval(() => {
        step++;
        setProgress((step / steps) * 100);

        if (step >= steps) {
          if (currentScene < scenes.length - 1) {
            setCurrentScene(prev => prev + 1);
            setProgress(0);
          } else {
            setIsPlaying(false);
            setProgress(100);
          }
        }
      }, interval);

      return () => clearInterval(timer);
    }
  }, [isPlaying, currentScene]);

  const startJourney = () => {
    setIsPlaying(true);
    setCurrentScene(0);
    setProgress(0);
  };

  const pauseJourney = () => {
    setIsPlaying(false);
  };

  const resetJourney = () => {
    setIsPlaying(false);
    setCurrentScene(0);
    setProgress(0);
  };

  return (
    <div className={`min-h-screen flex items-center justify-center p-8 bg-gradient-to-br ${currentSceneData.background} transition-all duration-1000`}>
      <div className="max-w-3xl w-full">
        <motion.div
          key={currentScene}
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8 }}
          className="bg-white/70 backdrop-blur-md rounded-3xl p-8 md:p-12 shadow-2xl"
        >
          <h2 className="text-3xl md:text-4xl font-bold text-purple-600 mb-6 text-center">
            {currentSceneData.title}
          </h2>

          <p className="text-lg md:text-xl text-gray-700 leading-relaxed mb-8 text-center">
            {currentSceneData.text}
          </p>

          {/* Progress Bar */}
          <div className="mb-6">
            <div className="w-full h-2 bg-gray-200 rounded-full overflow-hidden">
              <motion.div
                initial={{ width: 0 }}
                animate={{ width: `${progress}%` }}
                className="h-full bg-gradient-to-r from-purple-500 to-pink-500"
              />
            </div>
            <div className="flex justify-between text-sm text-gray-600 mt-2">
              <span>Scene {currentScene + 1} of {scenes.length}</span>
              <span>{Math.round(progress)}%</span>
            </div>
          </div>

          {/* Controls */}
          <div className="flex gap-4 justify-center">
            {!isPlaying && currentScene === 0 && (
              <motion.button
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
                onClick={startJourney}
                className="px-8 py-4 bg-gradient-to-r from-purple-500 to-pink-500 text-white rounded-2xl shadow-lg flex items-center gap-2"
              >
                <Play className="w-5 h-5" />
                Begin Journey
              </motion.button>
            )}

            {isPlaying && (
              <motion.button
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
                onClick={pauseJourney}
                className="px-8 py-4 bg-gradient-to-r from-orange-500 to-red-500 text-white rounded-2xl shadow-lg flex items-center gap-2"
              >
                <Pause className="w-5 h-5" />
                Pause
              </motion.button>
            )}

            {!isPlaying && currentScene > 0 && (
              <>
                <motion.button
                  whileHover={{ scale: 1.05 }}
                  whileTap={{ scale: 0.95 }}
                  onClick={startJourney}
                  className="px-8 py-4 bg-gradient-to-r from-purple-500 to-pink-500 text-white rounded-2xl shadow-lg flex items-center gap-2"
                >
                  <Play className="w-5 h-5" />
                  Continue
                </motion.button>

                <motion.button
                  whileHover={{ scale: 1.05 }}
                  whileTap={{ scale: 0.95 }}
                  onClick={resetJourney}
                  className="px-8 py-4 bg-white/70 backdrop-blur-md text-purple-600 rounded-2xl shadow-lg flex items-center gap-2"
                >
                  <RotateCcw className="w-5 h-5" />
                  Restart
                </motion.button>
              </>
            )}
          </div>
        </motion.div>

        <motion.p
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.5 }}
          className="text-center text-gray-600 mt-6"
        >
          🎧 For the best experience, use headphones and find a quiet space
        </motion.p>
      </div>
    </div>
  );
};

// Export all games
export {
  MuscleRelaxationGame,
  MandalaColoringGame,
  RainSoundsGame,
  StressBallGame,
  GuidedImageryGame
};