/* eslint-disable-next-line no-unused-vars */
import { motion } from "framer-motion"
import Navbar from "../components/Navbar"
import Footer from "../components/Footer"
import { Button } from "@/components/ui/button"
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"

// Icons
import {
  Brain,
  Shield,
  GitBranch,
  Code,
  Book,
  Heart,
  Database,
} from "lucide-react"

import Logo from "../assets/EmotionalWellBeing.png"
import emotionDetection from "../assets/Emotion-Detection.webp"
import panicSOS from "../assets/PanicSOS.png"
import productivitySuite from "../assets/MusicTherapy.jpg" // reusing as a generic illustration

// Animation variants
const containerVariants = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: {
      staggerChildren: 0.2,
    },
  },
}

const itemVariants = {
  hidden: { opacity: 0, y: 20 },
  visible: {
    opacity: 1,
    y: 0,
    transition: {
      duration: 0.5,
    },
  },
}

// Feature cards shown in “Project Modules”
const features = [
  {
    title: "Facial Stress Detection",
    description:
      "Webcam-based stress and emotion detection using an ONNX-optimized deep learning model, giving students real-time feedback on their stress levels.",
    icon: Brain,
    color: "bg-sky-100 dark:bg-sky-900",
    url: "/stress-detection",
  },
  {
    title: "Mental Health Chatbot",
    description:
      "A streaming LLM-powered companion that supports reflective conversations, coping strategies, and evidence-based suggestions in tough moments.",
    icon: Shield,
    color: "bg-violet-100 dark:bg-violet-900",
    url: "/panic-chatbot",
  },
  {
    title: "Productivity & Focus Suite",
    description:
      "A Task Prioritizer + Focus Companion that breaks work into manageable pieces, timeboxes tasks, and sends gentle reminders to stay on track.",
    icon: GitBranch,
    color: "bg-emerald-100 dark:bg-emerald-900",
    url: "/priority", // main entry; detailed tab lets user jump to focus or priority
  },
]

export default function Dashboard() {
  return (
    <div className="flex min-h-screen flex-col bg-gradient-to-b from-slate-50 via-white to-slate-100 dark:from-slate-950 dark:via-slate-900 dark:to-slate-900">
      <Navbar />

      <main className="flex-1">
        {/* Hero Section */}
        <motion.section
          className="py-16 md:py-24"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.8 }}
        >
          <div className="container px-4 md:px-6">
            <div className="flex flex-col items-center text-center gap-8">
              <motion.div
                className="flex flex-col items-center text-center space-y-4 max-w-3xl"
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.2, duration: 0.5 }}
              >
                <motion.h1
                  className="text-3xl md:text-5xl font-bold tracking-tight bg-gradient-to-r from-sky-700 via-violet-700 to-emerald-700 bg-clip-text text-transparent"
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.3, duration: 0.5 }}
                >
                  MindEase: AI for Stress, Support & Focus
                </motion.h1>
                <motion.p
                  className="text-gray-600 md:text-xl dark:text-gray-300"
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.4, duration: 0.5 }}
                >
                  A final-year capstone project that combines facial stress
                  detection, a mental health chatbot, and a productivity suite
                  to support college students&apos; emotional wellbeing.
                </motion.p>
              </motion.div>

              <motion.div
                className="w-full max-w-3xl"
                initial={{ opacity: 0, scale: 0.8 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ delay: 0.5, duration: 0.6 }}
                whileHover={{ scale: 1.03 }}
              >
                <div className="relative rounded-2xl overflow-hidden shadow-2xl border border-slate-200/70 dark:border-slate-700/70">
                  <img
                    src={Logo}
                    alt="MindEase – Emotional Wellbeing"
                    className="w-full h-auto object-cover"
                  />
                  <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-black/10 to-transparent opacity-70" />
                  <div className="absolute bottom-4 left-4 text-left space-y-1">
                    <p className="text-xs uppercase tracking-[0.2em] text-sky-100">
                      SPIT · Major Project
                    </p>
                    <p className="text-sm text-slate-100 max-w-sm">
                      Built with React, Flask, ONNXRuntime, and LLMs – designed
                      to be practical, private, and student-friendly.
                    </p>
                  </div>
                </div>
              </motion.div>
            </div>
          </div>
        </motion.section>

        {/* Project Modules */}
        <section className="py-16 md:py-20">
          <div className="container px-4 md:px-6">
            <motion.div
              className="text-center mb-12"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5 }}
            >
              <h2 className="text-3xl font-bold tracking-tight mb-3">
                Project Modules
              </h2>
              <p className="max-w-[700px] mx-auto text-gray-600 dark:text-gray-300">
                MindEase is split into three core features that work together:
                real-time stress sensing, a supportive chatbot, and tools to
                organize your day.
              </p>
            </motion.div>

            <motion.div
              className="grid grid-cols-1 md:grid-cols-3 gap-6 mt-4"
              variants={containerVariants}
              initial="hidden"
              animate="visible"
            >
              {features.map((feature, index) => (
                <motion.div key={index} variants={itemVariants}>
                  <Card className="h-full flex flex-col border border-slate-200/70 dark:border-slate-700/70 shadow-sm hover:shadow-md transition-shadow duration-200">
                    <CardHeader>
                      <div
                        className={`w-12 h-12 rounded-full ${feature.color} flex items-center justify-center mb-4`}
                      >
                        <feature.icon className="h-6 w-6 text-primary" />
                      </div>
                      <CardTitle className="text-lg">
                        {feature.title}
                      </CardTitle>
                    </CardHeader>
                    <CardContent className="flex-grow">
                      <CardDescription className="text-sm leading-relaxed">
                        {feature.description}
                      </CardDescription>
                    </CardContent>
                    <CardFooter className="mt-auto pt-4">
                      <Button
                        variant="default"
                        className="w-full"
                        onClick={() => (window.location.href = feature.url)}
                      >
                        Open This Feature
                      </Button>
                    </CardFooter>
                  </Card>
                </motion.div>
              ))}
            </motion.div>
          </div>
        </section>

        {/* Technology Stack Section */}
        <section className="py-16 md:py-20 bg-primary/5">
          <div className="container px-4 md:px-6">
            <motion.div
              className="text-center mb-12"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5 }}
            >
              <h2 className="text-3xl font-bold tracking-tight mb-4">
                Technology Stack
              </h2>
              <p className="max-w-[700px] mx-auto text-gray-600 dark:text-gray-300">
                The system combines real-time ML inference with LLM-powered
                reasoning and a modern web UI.
              </p>
            </motion.div>

            <motion.div
              className="grid grid-cols-1 md:grid-cols-3 gap-6 mt-4"
              variants={containerVariants}
              initial="hidden"
              animate="visible"
            >
              {/* Front-End */}
              <motion.div variants={itemVariants}>
                <Card className="h-full text-center">
                  <CardHeader>
                    <div className="mx-auto w-12 h-12 rounded-full bg-sky-100 dark:bg-sky-900 flex items-center justify-center mb-4">
                      <Code className="h-6 w-6 text-primary" />
                    </div>
                    <CardTitle>Front-End</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <p className="text-sm text-muted-foreground">
                      Built with React, Vite, Tailwind CSS, shadcn/ui, and
                      Framer Motion for a responsive, accessible, and smooth
                      user experience.
                    </p>
                  </CardContent>
                </Card>
              </motion.div>

              {/* ML/AI */}
              <motion.div variants={itemVariants}>
                <Card className="h-full text-center">
                  <CardHeader>
                    <div className="mx-auto w-12 h-12 rounded-full bg-violet-100 dark:bg-violet-900 flex items-center justify-center mb-4">
                      <Brain className="h-6 w-6 text-primary" />
                    </div>
                    <CardTitle>AI & ML</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <p className="text-sm text-muted-foreground">
                      Uses a Keras-to-ONNX facial emotion model with
                      ONNXRuntime, an LLM-based mental health chatbot with
                      streaming responses, and an AI Task Prioritizer agent for
                      planning your day.
                    </p>
                  </CardContent>
                </Card>
              </motion.div>

              {/* Backend */}
              <motion.div variants={itemVariants}>
                <Card className="h-full text-center">
                  <CardHeader>
                    <div className="mx-auto w-12 h-12 rounded-full bg-emerald-100 dark:bg-emerald-900 flex items-center justify-center mb-4">
                      <Database className="h-6 w-6 text-primary" />
                    </div>
                    <CardTitle>Backend & Data</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <p className="text-sm text-muted-foreground">
                      Flask APIs connect the UI, face model, chatbot, and
                      scheduling logic, with MySQL handling users, chats, tasks,
                      and focus-session metadata.
                    </p>
                  </CardContent>
                </Card>
              </motion.div>
            </motion.div>
          </div>
        </section>

        {/* Features In Detail */}
        <section className="py-16 md:py-24">
          <div className="container px-4 md:px-6">
            <motion.div
              className="text-center mb-12"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5 }}
            >
              <h2 className="text-3xl font-bold tracking-tight mb-4">
                Our Features in Detail
              </h2>
              <p className="max-w-[700px] mx-auto text-gray-600 dark:text-gray-300">
                Dive deeper into how each module works and how they connect
                together to support students.
              </p>
            </motion.div>

            <Tabs defaultValue="stress-detection" className="w-full">
              <TabsList className="grid w-full grid-cols-1 md:grid-cols-3">
                <TabsTrigger value="stress-detection">
                  Stress Detection
                </TabsTrigger>
                <TabsTrigger value="chatbot">Mental Health Chatbot</TabsTrigger>
                <TabsTrigger value="productivity">
                  Productivity &amp; Focus
                </TabsTrigger>
              </TabsList>

              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ duration: 0.5 }}
              >
                {/* Stress Detection */}
                <TabsContent value="stress-detection" className="mt-6">
                  <Card>
                    <CardHeader>
                      <CardTitle className="flex items-center gap-2">
                        <Brain className="h-5 w-5 text-primary" />
                        Facial Stress Detection
                      </CardTitle>
                      <CardDescription>
                        Real-time stress estimation from facial expressions
                        using a webcam.
                      </CardDescription>
                    </CardHeader>
                    <CardContent>
                      <div className="grid md:grid-cols-2 gap-6">
                        <div>
                          <h3 className="text-lg font-medium mb-2">
                            How It Works
                          </h3>
                          <p className="text-muted-foreground mb-4">
                            The system periodically captures frames from your
                            webcam and runs them through a facial emotion model.
                            Emotions like anger, fear, sadness, and disgust are
                            mapped to a continuous stress score that updates
                            over time.
                          </p>
                          <p className="text-muted-foreground">
                            The UI shows a subtle, non-distracting indicator of
                            your current stress trend, helping you notice
                            patterns and decide when to pause, breathe, or use
                            the chatbot or focus tools.
                          </p>
                        </div>
                        <div className="flex items-center justify-center">
                          <motion.div
                            className="rounded-lg overflow-hidden shadow-lg border border-slate-200/70 dark:border-slate-700/70"
                            whileHover={{ scale: 1.05 }}
                            transition={{ duration: 0.3 }}
                          >
                            <img
                              src={emotionDetection}
                              alt="Stress Detection Interface"
                              className="w-96 h-auto"
                            />
                          </motion.div>
                        </div>
                      </div>
                    </CardContent>
                    <CardFooter>
                      <Button
                        onClick={() =>
                          (window.location.href = "/stress-detection")
                        }
                      >
                        Try Stress Detection
                      </Button>
                    </CardFooter>
                  </Card>
                </TabsContent>

                {/* Mental Health Chatbot */}
                <TabsContent value="chatbot" className="mt-6">
                  <Card>
                    <CardHeader>
                      <CardTitle className="flex items-center gap-2">
                        <Shield className="h-5 w-5 text-primary" />
                        Mental Health Chatbot
                      </CardTitle>
                      <CardDescription>
                        A streaming AI companion for reflective, supportive
                        conversations.
                      </CardDescription>
                    </CardHeader>
                    <CardContent>
                      <div className="grid md:grid-cols-2 gap-6">
                        <div>
                          <h3 className="text-lg font-medium mb-2">
                            How It Works
                          </h3>
                          <p className="text-muted-foreground mb-4">
                            The chatbot uses an LLM with carefully designed
                            prompts to respond in a calm, validating, and
                            non-judgmental way. Messages are streamed token by
                            token for a more natural “typing” feel.
                          </p>
                          <p className="text-muted-foreground">
                            It encourages grounding, reframing, and small,
                            realistic next steps – while avoiding crisis
                            claims or over-stepping what an AI can safely do.
                            Sessions are stored securely so you can revisit
                            conversations later if you&apos;re logged in.
                          </p>
                        </div>
                        <div className="flex items-center justify-center">
                          <motion.div
                            className="rounded-lg overflow-hidden shadow-lg border border-slate-200/70 dark:border-slate-700/70"
                            whileHover={{ scale: 1.05 }}
                            transition={{ duration: 0.3 }}
                          >
                            <img
                              src={panicSOS}
                              alt="Mental Health Chatbot Interface"
                              className="w-96 h-auto"
                            />
                          </motion.div>
                        </div>
                      </div>
                    </CardContent>
                    <CardFooter>
                      <Button
                        onClick={() =>
                          (window.location.href = "/panic-chatbot")
                        }
                      >
                        Open Chatbot
                      </Button>
                    </CardFooter>
                  </Card>
                </TabsContent>

                {/* Productivity & Focus Suite */}
                <TabsContent value="productivity" className="mt-6">
                  <Card>
                    <CardHeader>
                      <CardTitle className="flex items-center gap-2">
                        <GitBranch className="h-5 w-5 text-primary" />
                        Productivity &amp; Focus Suite
                      </CardTitle>
                      <CardDescription>
                        A combined space for Task Prioritization and Focus
                        Companion email scheduling.
                      </CardDescription>
                    </CardHeader>
                    <CardContent>
                      <div className="grid md:grid-cols-2 gap-6">
                        {/* Left: nested tabs for the two sub-features */}
                        <div>
                          <Tabs defaultValue="task" className="w-full">
                            <TabsList className="grid grid-cols-2 mb-4">
                              <TabsTrigger value="task">
                                Task Prioritizer
                              </TabsTrigger>
                              <TabsTrigger value="focus">
                                Focus Companion
                              </TabsTrigger>
                            </TabsList>

                            <TabsContent value="task" className="mt-2">
                              <h3 className="text-lg font-medium mb-2">
                                AI Task Prioritizer
                              </h3>
                              <p className="text-muted-foreground mb-3">
                                You add all your tasks for the day, include
                                deadlines and how much time you have, and the
                                agent ranks them into Now / Next / Later /
                                Backlog buckets.
                              </p>
                              <p className="text-muted-foreground mb-3">
                                Under the hood, an LLM analyses importance,
                                urgency, energy requirements, and your available
                                focus time to suggest a realistic plan instead
                                of an overwhelming to-do list.
                              </p>
                              <Button
                                size="sm"
                                onClick={() =>
                                  (window.location.href = "/priority")
                                }
                              >
                                Open Task Prioritizer
                              </Button>
                            </TabsContent>

                            <TabsContent value="focus" className="mt-2">
                              <h3 className="text-lg font-medium mb-2">
                                Focus Companion Email Scheduler
                              </h3>
                              <p className="text-muted-foreground mb-3">
                                Once tasks are planned, the Focus Companion
                                breaks them into sub-tasks and schedules gentle
                                email nudges using the Gmail API.
                              </p>
                              <p className="text-muted-foreground mb-3">
                                Each email contains a small, time-boxed
                                objective so you always know what to do in the
                                next block of time – without having to reopen
                                the app.
                              </p>
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={() =>
                                  (window.location.href = "/focus")
                                }
                              >
                                Open Focus Companion
                              </Button>
                            </TabsContent>
                          </Tabs>
                        </div>

                        {/* Right: illustration */}
                        <div className="flex items-center justify-center">
                          <motion.div
                            className="rounded-lg overflow-hidden shadow-lg border border-slate-200/70 dark:border-slate-700/70"
                            whileHover={{ scale: 1.05 }}
                            transition={{ duration: 0.3 }}
                          >
                            <img
                              src={productivitySuite}
                              alt="Task Prioritizer & Focus Companion Interface"
                              className="w-96 h-60 object-cover"
                            />
                          </motion.div>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                </TabsContent>
              </motion.div>
            </Tabs>
          </div>
        </section>

        {/* Highlights */}
        <motion.section
          className="py-16 md:py-20 bg-primary/5"
          initial={{ opacity: 0 }}
          whileInView={{ opacity: 1 }}
          transition={{ duration: 0.8 }}
          viewport={{ once: true }}
        >
          <div className="container px-4 md:px-6">
            <div className="text-center mb-12">
              <h2 className="text-3xl font-bold tracking-tight mb-3">
                Project Highlights
              </h2>
              <p className="max-w-[700px] mx-auto text-gray-600 dark:text-gray-300">
                Design choices that make MindEase practical, safe, and
                extensible as a research prototype.
              </p>
            </div>

            <motion.div
              className="grid grid-cols-1 md:grid-cols-2 gap-8"
              variants={containerVariants}
              initial="hidden"
              animate="visible"
            >
              <motion.div variants={itemVariants}>
                <Card className="h-full">
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <GitBranch className="h-5 w-5 text-primary" />
                      Modular Architecture
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <p className="text-muted-foreground">
                      Each feature (face stress, chatbot, productivity suite) is
                      built as a separate module with shared auth and data
                      layers, making it easier to extend or swap components
                      later.
                    </p>
                  </CardContent>
                </Card>
              </motion.div>

              <motion.div variants={itemVariants}>
                <Card className="h-full">
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <Heart className="h-5 w-5 text-primary" />
                      Privacy & Safety Aware
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <p className="text-muted-foreground">
                      Data is stored with minimal personally identifiable
                      information, and the chatbot is designed to avoid giving
                      medical advice or crisis promises, instead nudging users
                      towards healthy coping steps.
                    </p>
                  </CardContent>
                </Card>
              </motion.div>

              <motion.div variants={itemVariants}>
                <Card className="h-full">
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <Book className="h-5 w-5 text-primary" />
                      Evidence-Inspired Flows
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <p className="text-muted-foreground">
                      Interactions are inspired by CBT-style questioning,
                      grounding exercises, and time-boxing techniques that are
                      commonly used in therapy and productivity coaching.
                    </p>
                  </CardContent>
                </Card>
              </motion.div>

              <motion.div variants={itemVariants}>
                <Card className="h-full">
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <Code className="h-5 w-5 text-primary" />
                      Built for Iteration
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <p className="text-muted-foreground">
                      The stack is intentionally simple (React + Flask + MySQL +
                      ONNXRuntime + LLM APIs) so new experiments – like new
                      models or prompts – can be plugged in with minimal
                      friction.
                    </p>
                  </CardContent>
                </Card>
              </motion.div>
            </motion.div>
          </div>
        </motion.section>

        {/* Final CTA */}
        <motion.section
          className="py-16 md:py-20"
          initial={{ opacity: 0 }}
          whileInView={{ opacity: 1 }}
          transition={{ duration: 0.8 }}
          viewport={{ once: true }}
        >
          <div className="container px-4 md:px-6">
            <div className="flex flex-col items-center text-center space-y-4">
              <h2 className="text-3xl font-bold tracking-tight">
                Ready to Explore MindEase?
              </h2>
              <p className="max-w-[700px] text-gray-600 md:text-lg dark:text-gray-300">
                Start with stress detection, talk to the chatbot, or let the
                productivity suite organize your day – all in one place.
              </p>
              <div className="flex flex-col sm:flex-row gap-4 mt-6">
                <Button
                  size="lg"
                  onClick={() =>
                    (window.location.href = "/stress-detection")
                  }
                >
                  Start with Stress Detection
                </Button>
                <Button
                  size="lg"
                  variant="outline"
                  onClick={() =>
                    (window.location.href = "/panic-chatbot")
                  }
                >
                  Talk to the Chatbot
                </Button>
              </div>
            </div>
          </div>
        </motion.section>
      </main>

      <Footer />
    </div>
  )
}
