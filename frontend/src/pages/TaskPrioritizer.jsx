// File: src/pages/TaskPrioritizer.jsx
import { useState, useEffect, useMemo } from "react"
import axios from "axios"
import { motion } from "framer-motion"
import Navbar from "@/components/Navbar"
import Footer from "@/components/Footer"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { Badge } from "@/components/ui/badge"
import {
  ListChecks,
  Brain,
  Loader2,
  Calendar,
  Clock,
  Zap,
  Target,
  AlertTriangle,
  RefreshCcw,
  ArrowUp,
  ArrowDown,
} from "lucide-react"

const API_BASE = "http://127.0.0.1:5000"

const containerVariants = {
  hidden: { opacity: 0 },
  visible: { opacity: 1, transition: { staggerChildren: 0.15 } },
}

const itemVariants = {
  hidden: { y: 12, opacity: 0 },
  visible: { y: 0, opacity: 1, transition: { type: "spring", stiffness: 110 } },
}

function toLocal(dt) {
  if (!dt) return "No deadline"
  try {
    const d = new Date(dt)
    const date = d.toLocaleDateString([], { year: "numeric", month: "short", day: "2-digit" })
    const time = d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })
    return `${date} • ${time}`
  } catch {
    return dt
  }
}

function formatDateOnly(dateStr) {
  if (!dateStr) return ""
  try {
    const d = new Date(dateStr + "T00:00:00")
    return d.toLocaleDateString([], {
      year: "numeric",
      month: "short",
      day: "2-digit",
    })
  } catch {
    return dateStr
  }
}

function bucketLabel(bucket) {
  switch (bucket) {
    case "now":
      return "Now (Do First)"
    case "next":
      return "Next (Later Today)"
    case "later":
      return "Later"
    case "backlog":
    default:
      return "Backlog / Someday"
  }
}

function bucketBadgeVariant(bucket) {
  switch (bucket) {
    case "now":
      return "default"
    case "next":
      return "secondary"
    case "later":
      return "outline"
    case "backlog":
    default:
      return "outline"
  }
}

function getDisplayMinutes(task) {
  if (typeof task?.planned_for_minutes === "number" && task.planned_for_minutes > 0) {
    return task.planned_for_minutes
  }
  if (typeof task?.ai_estimated_minutes === "number" && task.ai_estimated_minutes > 0) {
    return task.ai_estimated_minutes
  }
  return 0
}

export default function TaskPrioritizer() {
  // --- shared state ---
  const [userEmail, setUserEmail] = useState("")
  const [todayMinutes, setTodayMinutes] = useState(120)
  const [planningHorizonDays, setPlanningHorizonDays] = useState(1) // user-chosen days
  const [feedbackType, setFeedbackType] = useState("")

  // Relaxation preferences (for personalized breaks)
  const [relaxPrefs, setRelaxPrefs] = useState({
    likes_games: false,
    likes_music: false,
    likes_breathing: false,
    likes_walking: false,
    likes_chatting: false,
    custom_text: "",
  })

  // Has a plan been generated at least once this session?
  const [hasPlan, setHasPlan] = useState(false)

  // --- create-task form ---
  const [title, setTitle] = useState("")
  const [description, setDescription] = useState("")
  const [deadlineDate, setDeadlineDate] = useState("")
  const [deadlineTime, setDeadlineTime] = useState("")
  const [status, setStatus] = useState("backlog")

  // --- results / UI ---
  const [tasks, setTasks] = useState([])
  const [planSummary, setPlanSummary] = useState("")
  const [createdTask, setCreatedTask] = useState(null)

  const [loadingCreate, setLoadingCreate] = useState(false)
  const [loadingRun, setLoadingRun] = useState(false)
  const [loadingFetch, setLoadingFetch] = useState(false)
  const [savingOrder, setSavingOrder] = useState(false)
  const [error, setError] = useState("")
  const [info, setInfo] = useState("")

  // Task Coach (Guide me)
  const [stepsLoadingId, setStepsLoadingId] = useState(null)
  const [expandedTaskId, setExpandedTaskId] = useState(null)

  const hasEmail = userEmail.trim().length > 0

  // Group tasks by bucket
  const groupedTasks = useMemo(() => {
    const byBucket = { now: [], next: [], later: [], backlog: [] }
    for (const t of tasks || []) {
      const bucket = t.ai_bucket || "backlog"
      if (!byBucket[bucket]) byBucket[bucket] = []
      byBucket[bucket].push(t)
    }
    return byBucket
  }, [tasks])

  const totalPlannedMinutes = useMemo(() => {
    if (!tasks?.length) return 0
    return tasks.reduce((acc, t) => acc + getDisplayMinutes(t), 0)
  }, [tasks])

  // Initial load when email is set: fetch tasks + relax prefs
  useEffect(() => {
    if (!hasEmail) return
    fetchTasks()
    fetchRelaxPrefs()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [hasEmail])

  async function fetchTasks() {
    if (!hasEmail) return
    setError("")
    setInfo("")
    setLoadingFetch(true)
    try {
      const { data } = await axios.get(`${API_BASE}/api/priority/tasks/today`, {
        params: { user_email: userEmail.trim() },
      })
      setTasks(data.tasks || [])
    } catch (err) {
      setError(
        err?.response?.data?.error ||
          "Could not fetch tasks. Check if backend is running and Supabase is configured."
      )
    } finally {
      setLoadingFetch(false)
    }
  }

  async function fetchRelaxPrefs() {
    if (!hasEmail) return
    try {
      const { data } = await axios.get(`${API_BASE}/api/priority/relax-prefs`, {
        params: { user_email: userEmail.trim() },
      })
      if (data && data.prefs) {
        setRelaxPrefs((prev) => ({
          ...prev,
          likes_games: !!data.prefs.likes_games,
          likes_music: !!data.prefs.likes_music,
          likes_breathing: !!data.prefs.likes_breathing,
          likes_walking: !!data.prefs.likes_walking,
          likes_chatting: !!data.prefs.likes_chatting,
          custom_text: data.prefs.custom_text || "",
        }))
      }
    } catch (err) {
      console.warn("Could not fetch relax prefs", err)
    }
  }

  async function handleSaveRelaxPrefs() {
    if (!hasEmail) {
      setError("Please enter your email before saving relaxation preferences.")
      return
    }
    setError("")
    setInfo("")
    try {
      const payload = {
        user_email: userEmail.trim(),
        ...relaxPrefs,
      }
      await axios.post(`${API_BASE}/api/priority/relax-prefs`, payload)
      setInfo("Relaxation preferences saved.")
    } catch (err) {
      console.error("Failed to save relax prefs", err)
      setError(
        err?.response?.data?.error ||
          "Could not save relaxation preferences. Please check backend logs."
      )
    }
  }

  function mergeUpdatedTask(updatedTask) {
    setTasks((prev) =>
      (prev || []).map((t) => (t.id === updatedTask.id ? { ...t, ...updatedTask } : t))
    )
  }

  async function handleGuideMeClick(task) {
    const tid = task.id
    if (!tid) return

    setError("")
    setInfo("")

    // If steps already exist, just toggle open/close
    if (task.steps_json && task.steps_json.length > 0) {
      setExpandedTaskId((prev) => (prev === tid ? null : tid))
      return
    }

    setStepsLoadingId(tid)
    try {
      const { data } = await axios.post(`${API_BASE}/api/priority/task/steps`, {
        user_email: userEmail.trim() || undefined,
        task_id: tid,
      })

      const updatedTask = data.task || {}
      if (!updatedTask.steps_json && data.steps) {
        updatedTask.steps_json = data.steps
      }

      mergeUpdatedTask(updatedTask)
      setExpandedTaskId(tid)
    } catch (err) {
      console.error("failed to generate steps", err)
      setError(
        err?.response?.data?.error ||
          "Could not generate AI steps for this task. Please check backend logs."
      )
    } finally {
      setStepsLoadingId(null)
    }
  }

  async function handleCreateTask(e) {
    e.preventDefault()
    setError("")
    setInfo("")
    if (!hasEmail) {
      setError("Please enter your email first.")
      return
    }
    if (!title.trim()) {
      setError("Task title is required.")
      return
    }
    setLoadingCreate(true)
    try {
      let deadlineIso
      if (deadlineDate) {
        const timePart = deadlineTime || "23:59"
        const local = `${deadlineDate}T${timePart}`
        const d = new Date(local)
        if (!isNaN(d.getTime())) {
          deadlineIso = d.toISOString()
        }
      }

      const payload = {
        user_email: userEmail.trim(),
        title: title.trim(),
        description: description.trim() || undefined,
        deadline_ts: deadlineIso,
        status: status || "backlog",
      }
      const { data } = await axios.post(`${API_BASE}/api/priority/task/create`, payload)
      setCreatedTask(data.task)
      setTitle("")
      setDescription("")
      setDeadlineDate("")
      setDeadlineTime("")
      setStatus("backlog")
      setInfo("Task created and analyzed with AI. You can now run prioritization.")
      fetchTasks()
    } catch (err) {
      setError(
        err?.response?.data?.error ||
          "Could not create the task. Is the backend running and Supabase reachable?"
      )
    } finally {
      setLoadingCreate(false)
    }
  }

  async function handleRunAI() {
    if (!hasEmail) {
      setError("Please enter your email first.")
      return
    }
    setLoadingRun(true)
    setError("")
    setInfo("")
    try {
      const horizon = Number(planningHorizonDays)
      const payload = {
        user_email: userEmail.trim(),
        today_available_minutes: Number(todayMinutes) || undefined,
        planning_horizon_days: horizon && horizon > 0 ? horizon : undefined,
        feedback_type: hasPlan && feedbackType ? feedbackType : undefined,
      }
      const { data } = await axios.post(`${API_BASE}/api/priority/run`, payload)
      setPlanSummary(data.plan_summary || "")
      setTasks(data.tasks || [])
      setHasPlan(true) // only after first successful run
      setInfo("AI prioritization updated successfully.")
    } catch (err) {
      setError(
        err?.response?.data?.error ||
          "Could not run AI prioritization. Please check the backend logs."
      )
    } finally {
      setLoadingRun(false)
    }
  }

  function moveTask(bucket, idx, direction) {
    const list = groupedTasks[bucket] || []
    if (!list.length) return
    const newIndex = idx + direction
    if (newIndex < 0 || newIndex >= list.length) return

    const copyTasks = [...tasks]
    const inBucketIds = list.map((t) => t.id)

    const idA = inBucketIds[idx]
    const idB = inBucketIds[newIndex]

    const indexA = copyTasks.findIndex((t) => t.id === idA)
    const indexB = copyTasks.findIndex((t) => t.id === idB)
    if (indexA === -1 || indexB === -1) return

    const temp = copyTasks[indexA]
    copyTasks[indexA] = copyTasks[indexB]
    copyTasks[indexB] = temp

    const rankA = copyTasks[indexA].ai_priority_rank
    copyTasks[indexA].ai_priority_rank = copyTasks[indexB].ai_priority_rank
    copyTasks[indexB].ai_priority_rank = rankA

    setTasks(copyTasks)
  }

  async function handleSaveOrder(bucket) {
    if (!hasEmail) {
      setError("Please enter your email first.")
      return
    }

    const list = groupedTasks[bucket] || []
    if (list.length <= 1) return

    setSavingOrder(true)
    setError("")
    setInfo("")
    try {
      const payload = {
        user_email: userEmail.trim(),
        bucket,
        ordered_task_ids: list.map((t) => t.id),
      }
      await axios.post(`${API_BASE}/api/priority/order/manual`, payload)
      setInfo(`Order updated successfully for the "${bucketLabel(bucket)}" bucket.`)
    } catch (err) {
      setError(
        err?.response?.data?.error ||
          "Could not update manual order. Please check the backend logs."
      )
    } finally {
      setSavingOrder(false)
    }
  }

  return (
    <div className="flex min-h-screen flex-col">
      <Navbar />

      <motion.main
        className="container mx-auto px-4 py-8 max-w-6xl"
        variants={containerVariants}
        initial="hidden"
        animate="visible"
      >
        {/* Header */}
        <motion.header variants={itemVariants} className="mb-8 text-center">
          <div className="inline-flex items-center gap-2 rounded-full bg-muted px-4 py-1 text-xs font-medium">
            <Brain className="h-3.5 w-3.5" />
            <span>AI Task Prioritization Agent</span>
          </div>
          <h1 className="mt-3 text-3xl font-bold tracking-tight">
            Smart Daily Task Prioritizer
          </h1>
          <p className="mt-2 text-muted-foreground max-w-2xl mx-auto">
            Add tasks once, then let the AI reorder them based on deadlines, importance,
            stress, and your available focus time. You can also spread work across
            multiple days so everything doesn&apos;t pile into today.
          </p>
        </motion.header>

        {/* Controls card */}
        <motion.section variants={itemVariants} className="mb-6">
          <Card>
            <CardContent className="py-4 space-y-4">
              {/* Row 1: Email */}
              <div className="grid gap-3 md:grid-cols-[2fr,1fr] md:items-center">
                <div>
                  <label className="text-sm font-medium">Your Email (for this profile)</label>
                  <Input
                    type="email"
                    placeholder="you@example.com"
                    value={userEmail}
                    onChange={(e) => setUserEmail(e.target.value)}
                  />
                  <p className="text-xs text-muted-foreground mt-1">
                    All tasks and AI prioritization runs are linked to this email.
                  </p>
                </div>
                <div className="hidden md:block text-xs text-muted-foreground text-right">
                  Tip: Use the same email everywhere in MindEase so the system can build a
                  consistent profile of your workload and preferences.
                </div>
              </div>

              {/* Row 2: Focus time, horizon, feedback – horizontally aligned */}
              <div className="grid gap-3 md:grid-cols-3 md:items-end">
                <div>
                  <label className="text-sm font-medium flex items-center gap-1">
                    <Clock className="h-4 w-4" />
                    Available Focus Time Today (minutes)
                  </label>
                  <Input
                    type="number"
                    min={15}
                    step={15}
                    value={todayMinutes}
                    onChange={(e) => setTodayMinutes(e.target.value)}
                  />
                  <p className="text-xs text-muted-foreground mt-1">
                    Rough estimate of how much deep work time you realistically have today.
                  </p>
                </div>

                <div>
                  <label className="text-sm font-medium flex items-center gap-1">
                    <Calendar className="h-4 w-4" />
                    Planning Horizon (days)
                  </label>
                  <Input
                    type="number"
                    min={1}
                    max={30}
                    step={1}
                    value={planningHorizonDays}
                    onChange={(e) => {
                      const v = e.target.value
                      if (!v) {
                        setPlanningHorizonDays("")
                        return
                      }
                      const n = Number(v)
                      if (!isNaN(n) && n >= 1 && n <= 30) {
                        setPlanningHorizonDays(n)
                      }
                    }}
                  />
                  <p className="text-xs text-muted-foreground mt-1">
                    How many days (starting today) the AI is allowed to distribute your tasks
                    across.
                  </p>
                </div>

                {/* Feedback column: only show the question after a plan exists */}
                <div>
                  {hasPlan ? (
                    <>
                      <label className="text-sm font-medium flex items-center gap-1">
                        <AlertTriangle className="h-4 w-4" />
                        How does the current plan feel?
                      </label>
                      <select
                        className="mt-1 block w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                        value={feedbackType}
                        onChange={(e) => setFeedbackType(e.target.value)}
                      >
                        <option value="">No specific feedback</option>
                        <option value="too_packed">Too packed / overwhelming</option>
                        <option value="needs_breaks">Needs more breaks</option>
                        <option value="very_stressed">I&apos;m very stressed today</option>
                      </select>
                      <p className="text-xs text-muted-foreground mt-1">
                        Change this and re-run the AI if you want it to lighten today&apos;s
                        load or add more breaks.
                      </p>
                    </>
                  ) : (
                    <p className="text-xs text-muted-foreground mt-6">
                      Once you run <b>&quot;Let AI prioritize my plan&quot;</b>, you&apos;ll be
                      able to give feedback on how the plan feels here.
                    </p>
                  )}
                </div>
              </div>

              {/* Row 3: Relaxation preferences + buttons */}
              <div className="grid gap-4 md:grid-cols-[2fr,auto] md:items-end">
                <div>
                  <label className="text-sm font-medium">
                    What helps you relax during breaks?
                  </label>
                  <div className="mt-2 grid grid-cols-2 gap-2 text-sm">
                    <label className="flex items-center gap-2">
                      <input
                        type="checkbox"
                        className="h-3.5 w-3.5"
                        checked={relaxPrefs.likes_games}
                        onChange={(e) =>
                          setRelaxPrefs((prev) => ({
                            ...prev,
                            likes_games: e.target.checked,
                          }))
                        }
                      />
                      <span>Play games</span>
                    </label>
                    <label className="flex items-center gap-2">
                      <input
                        type="checkbox"
                        className="h-3.5 w-3.5"
                        checked={relaxPrefs.likes_music}
                        onChange={(e) =>
                          setRelaxPrefs((prev) => ({
                            ...prev,
                            likes_music: e.target.checked,
                          }))
                        }
                      />
                      <span>Listen to music</span>
                    </label>
                    <label className="flex items-center gap-2">
                      <input
                        type="checkbox"
                        className="h-3.5 w-3.5"
                        checked={relaxPrefs.likes_breathing}
                        onChange={(e) =>
                          setRelaxPrefs((prev) => ({
                            ...prev,
                            likes_breathing: e.target.checked,
                          }))
                        }
                      />
                      <span>Breathing exercises</span>
                    </label>
                    <label className="flex items-center gap-2">
                      <input
                        type="checkbox"
                        className="h-3.5 w-3.5"
                        checked={relaxPrefs.likes_walking}
                        onChange={(e) =>
                          setRelaxPrefs((prev) => ({
                            ...prev,
                            likes_walking: e.target.checked,
                          }))
                        }
                      />
                      <span>Walk / stretch</span>
                    </label>
                    <label className="flex items-center gap-2">
                      <input
                        type="checkbox"
                        className="h-3.5 w-3.5"
                        checked={relaxPrefs.likes_chatting}
                        onChange={(e) =>
                          setRelaxPrefs((prev) => ({
                            ...prev,
                            likes_chatting: e.target.checked,
                          }))
                        }
                      />
                      <span>Talk to someone</span>
                    </label>
                  </div>
                  <Textarea
                    className="mt-2"
                    rows={2}
                    placeholder="e.g. I relax best with short puzzle games and lo-fi music."
                    value={relaxPrefs.custom_text}
                    onChange={(e) =>
                      setRelaxPrefs((prev) => ({
                        ...prev,
                        custom_text: e.target.value,
                      }))
                    }
                  />
                  <p className="mt-1 text-xs text-muted-foreground">
                    These preferences are stored for your profile and used when the AI suggests
                    short, personalized breaks inside the step-by-step guides.
                  </p>
                </div>

                <div className="flex flex-col items-stretch gap-2 md:items-end">
                  <Button
                    type="button"
                    variant="outline"
                    onClick={handleSaveRelaxPrefs}
                    disabled={!hasEmail}
                  >
                    Save preferences
                  </Button>
                  <div className="flex gap-2 md:justify-end">
                    <Button
                      variant="outline"
                      disabled={!hasEmail || loadingFetch}
                      onClick={fetchTasks}
                      type="button"
                    >
                      {loadingFetch ? (
                        <>
                          <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                          Loading…
                        </>
                      ) : (
                        <>
                          <RefreshCcw className="mr-2 h-4 w-4" />
                          Refresh Tasks
                        </>
                      )}
                    </Button>
                    <Button
                      disabled={!hasEmail || loadingRun}
                      onClick={handleRunAI}
                      type="button"
                    >
                      {loadingRun ? (
                        <>
                          <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                          Prioritizing…
                        </>
                      ) : (
                        <>
                          <Brain className="mr-2 h-4 w-4" />
                          Let AI prioritize my plan
                        </>
                      )}
                    </Button>
                  </div>
                </div>
              </div>

              <div className="text-xs text-muted-foreground text-right">
                Total planned time in buckets:{" "}
                <span className="font-medium">{totalPlannedMinutes} minutes</span>
              </div>
            </CardContent>
          </Card>
        </motion.section>

        {/* Create Task */}
        <motion.section variants={itemVariants} className="mb-8">
          <Card>
            <CardHeader>
              <CardTitle>Create a Task for Prioritization</CardTitle>
            </CardHeader>
            <CardContent>
              <form onSubmit={handleCreateTask} className="grid gap-4 md:grid-cols-2">
                <div className="md:col-span-2">
                  <label className="text-sm font-medium">Task Title</label>
                  <Input
                    placeholder="e.g., Write Methodology section of MindEase paper"
                    value={title}
                    onChange={(e) => setTitle(e.target.value)}
                    required
                  />
                </div>

                <div className="md:col-span-2">
                  <label className="text-sm font-medium">Description / Context (optional)</label>
                  <Textarea
                    placeholder="Add enough information so the AI knows what this task involves."
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                    rows={3}
                  />
                </div>

                {/* Deadline + Initial status horizontally aligned */}
                <div className="md:col-span-1">
                  <label className="text-sm font-medium flex items-center gap-1">
                    <Calendar className="h-4 w-4" />
                    Deadline (optional)
                  </label>
                  <div className="flex gap-2">
                    <Input
                      type="date"
                      value={deadlineDate}
                      onChange={(e) => setDeadlineDate(e.target.value)}
                      className="w-1/2"
                    />
                    <Input
                      type="time"
                      value={deadlineTime}
                      onChange={(e) => setDeadlineTime(e.target.value)}
                      className="w-1/2"
                    />
                  </div>
                  <p className="text-xs text-muted-foreground mt-1">
                    If you skip time, the system assumes end of day.
                  </p>
                </div>

                <div className="md:col-span-1">
                  <label className="text-sm font-medium">Initial Status</label>
                  <select
                    className="mt-1 block w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                    value={status}
                    onChange={(e) => setStatus(e.target.value)}
                  >
                    <option value="backlog">Backlog</option>
                    <option value="planned">Planned</option>
                  </select>
                  <p className="text-xs text-muted-foreground mt-1">
                    Just a hint for the AI. It can still move tasks between buckets.
                  </p>
                </div>

                <div className="md:col-span-2 flex items-center justify-between gap-2">
                  <div className="text-xs text-muted-foreground">
                    When you create a task, the backend asks Gemini to estimate{" "}
                    <b>importance</b>, <b>stress cost</b>, <b>energy requirement</b>, and{" "}
                    <b>time needed</b>.
                  </div>
                  <Button type="submit" disabled={loadingCreate || !hasEmail}>
                    {loadingCreate ? (
                      <>
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        Creating…
                      </>
                    ) : (
                      <>
                        <ListChecks className="mr-2 h-4 w-4" />
                        Add Task
                      </>
                    )}
                  </Button>
                </div>

                {error && (
                  <div className="md:col-span-2 text-sm text-red-600">{error}</div>
                )}
                {info && (
                  <div className="md:col-span-2 text-sm text-emerald-600">{info}</div>
                )}

                {createdTask && (
                  <div className="md:col-span-2 text-xs text-muted-foreground">
                    Last created task:{" "}
                    <span className="font-medium">{createdTask.title}</span>
                  </div>
                )}
              </form>
            </CardContent>
          </Card>
        </motion.section>

        {/* Plan Summary */}
        {planSummary && (
          <motion.section variants={itemVariants} className="mb-6">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Target className="h-5 w-5" />
                  AI Plan Overview
                </CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-sm text-muted-foreground whitespace-pre-wrap">
                  {planSummary}
                </p>
              </CardContent>
            </Card>
          </motion.section>
        )}

        {/* Buckets + Tasks */}
        <motion.section variants={itemVariants} className="mb-10 space-y-6">
          {["now", "next", "later", "backlog"].map((bucketKey) => {
            const list = groupedTasks[bucketKey] || []
            const label = bucketLabel(bucketKey)
            const showManualOrder = bucketKey === "now" && list.length > 1

            return (
              <Card key={bucketKey}>
                <CardHeader className="flex flex-col md:flex-row md:items-center md:justify-between gap-3">
                  <div className="flex items-center gap-2">
                    <Badge variant={bucketBadgeVariant(bucketKey)}>{label}</Badge>
                    {bucketKey === "now" && (
                      <span className="text-xs text-muted-foreground inline-flex items-center gap-1">
                        <AlertTriangle className="h-3.5 w-3.5" />
                        Highest-impact work you should tackle first.
                      </span>
                    )}
                  </div>
                  {showManualOrder && (
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handleSaveOrder(bucketKey)}
                      disabled={savingOrder || !hasEmail}
                    >
                      {savingOrder ? (
                        <>
                          <Loader2 className="mr-2 h-3.5 w-3.5 animate-spin" />
                          Saving…
                        </>
                      ) : (
                        <>
                          <ListChecks className="mr-2 h-3.5 w-3.5" />
                          Save Order
                        </>
                      )}
                    </Button>
                  )}
                </CardHeader>
                <CardContent className="space-y-3">
                  {list.length === 0 && (
                    <p className="text-xs text-muted-foreground">
                      No tasks in this bucket yet.
                    </p>
                  )}
                  {list.map((t, idx) => {
                    const displayMinutes = getDisplayMinutes(t)
                    const hasPlannedDate = !!t.planned_for_date
                    const isTodayPlanned =
                      hasPlannedDate &&
                      new Date(t.planned_for_date + "T00:00:00").toDateString() ===
                        new Date().toDateString()

                    return (
                      <div
                        key={t.id}
                        className="flex flex-col md:flex-row md:items-start md:justify-between gap-3 rounded-lg border p-4"
                      >
                        <div className="space-y-1">
                          <div className="flex items-center gap-2">
                            <span className="text-xs text-muted-foreground">
                              #{t.ai_priority_rank ?? "–"}
                            </span>
                            <span className="font-medium">{t.title}</span>
                          </div>
                          {t.description && (
                            <p className="text-xs text-muted-foreground line-clamp-2">
                              {t.description}
                            </p>
                          )}
                          <div className="flex flex-wrap items-center gap-2 text-[11px] text-muted-foreground mt-1">
                            {t.deadline_ts && (
                              <span className="inline-flex items-center gap-1">
                                <Calendar className="h-3 w-3" />
                                {toLocal(t.deadline_ts)}
                              </span>
                            )}
                            <span className="inline-flex items-center gap-1">
                              <Target className="h-3 w-3" />
                              Importance:&nbsp;<b>{t.ai_importance ?? 3}</b>/5
                            </span>
                            <span className="inline-flex items-center gap-1">
                              <AlertTriangle className="h-3 w-3" />
                              Stress:&nbsp;<b>{t.ai_stress_cost ?? 3}</b>/5
                            </span>
                            <span className="inline-flex items-center gap-1">
                              <Zap className="h-3 w-3" />
                              Energy:&nbsp;<b>{t.ai_energy_requirement || "medium"}</b>
                            </span>
                            <span className="inline-flex items-center gap-1">
                              <Clock className="h-3 w-3" />
                              {displayMinutes > 0 ? `${displayMinutes} min` : "No estimate yet"}
                            </span>
                            {t.ai_category && (
                              <span className="inline-flex items-center gap-1 capitalize">
                                <Brain className="h-3 w-3" />
                                {t.ai_category.replace("_", " ")}
                              </span>
                            )}
                            {hasPlannedDate && (
                              <span className="inline-flex items-center gap-1">
                                <Calendar className="h-3 w-3" />
                                {isTodayPlanned
                                  ? "Planned for today"
                                  : `Planned for ${formatDateOnly(t.planned_for_date)}`}
                              </span>
                            )}
                          </div>
                          {t.ai_reason && (
                            <p className="text-xs text-muted-foreground mt-1">
                              <span className="font-semibold">AI: </span>
                              {t.ai_reason}
                            </p>
                          )}

                          {/* AI-generated step-by-step guide */}
                          {expandedTaskId === t.id && t.steps_json && t.steps_json.length > 0 && (
                            <div className="mt-2 rounded-md border bg-muted/40 px-2.5 py-2">
                              <div className="mb-1 flex items-center justify-between">
                                <span className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                                  AI step-by-step guide
                                </span>
                                <span className="text-[10px] text-muted-foreground">
                                  {t.steps_json.length} step
                                  {t.steps_json.length > 1 ? "s" : ""}
                                </span>
                              </div>
                              <ol className="space-y-1.5 text-[11px]">
                                {t.steps_json.map((s, idxStep) => {
                                  const isBreak =
                                    typeof s.instruction === "string" &&
                                    s.instruction.trim().toLowerCase().startsWith("break:")
                                  return (
                                    <li
                                      key={idxStep}
                                      className={`flex gap-2 ${
                                        isBreak
                                          ? "rounded-md border border-amber-200 bg-amber-50/70 px-2 py-1"
                                          : ""
                                      }`}
                                    >
                                      <span className="mt-[1px] h-4 w-4 flex-shrink-0 rounded-full border bg-background text-[9px] flex items-center justify-center">
                                        {s.step_number ?? idxStep + 1}
                                      </span>
                                      <div className="flex-1 min-w-0">
                                        <div className="flex flex-wrap items-center gap-1">
                                          <span
                                            className={`font-medium ${
                                              isBreak ? "text-amber-800" : ""
                                            }`}
                                          >
                                            {s.instruction}
                                          </span>
                                          {s.estimated_minutes && (
                                            <span className="text-[10px] text-muted-foreground">
                                              (~{s.estimated_minutes} min)
                                            </span>
                                          )}
                                          {isBreak && (
                                            <span className="text-[9px] rounded-full bg-amber-100 px-2 py-[1px] text-amber-800 font-semibold">
                                              Break
                                            </span>
                                          )}
                                        </div>
                                        {s.notes && (
                                          <p className="text-[10px] text-muted-foreground">
                                            {s.notes}
                                          </p>
                                        )}
                                        {Array.isArray(s.links) && s.links.length > 0 && (
                                          <div className="mt-1 flex flex-wrap gap-2">
                                            {s.links.map((link, linkIdx) => (
                                              <a
                                                key={linkIdx}
                                                href={link}
                                                target="_blank"
                                                rel="noreferrer"
                                                className="text-[10px] underline text-blue-600 hover:text-blue-700"
                                              >
                                                Helpful link {linkIdx + 1}
                                              </a>
                                            ))}
                                          </div>
                                        )}
                                      </div>
                                    </li>
                                  )
                                })}
                              </ol>
                            </div>
                          )}
                        </div>

                        {/* Controls on the right */}
                        <div className="flex flex-col items-end gap-2 text-xs text-muted-foreground">
                          {bucketKey === "now" && list.length > 1 && (
                            <div className="flex md:flex-col items-center gap-2 md:gap-1">
                              <span className="md:mb-1">Adjust order</span>
                              <Button
                                variant="outline"
                                size="icon"
                                className="h-6 w-6"
                                onClick={() => moveTask(bucketKey, idx, -1)}
                                disabled={idx === 0}
                                type="button"
                              >
                                <ArrowUp className="h-3 w-3" />
                              </Button>
                              <Button
                                variant="outline"
                                size="icon"
                                className="h-6 w-6"
                                onClick={() => moveTask(bucketKey, idx, +1)}
                                disabled={idx === list.length - 1}
                                type="button"
                              >
                                <ArrowDown className="h-3 w-3" />
                              </Button>
                            </div>
                          )}
                          <Button
                            variant="outline"
                            size="xs"
                            className="h-6 px-2 text-[10px]"
                            onClick={() => handleGuideMeClick(t)}
                            disabled={stepsLoadingId === t.id}
                            type="button"
                          >
                            {stepsLoadingId === t.id ? (
                              <>
                                <Loader2 className="mr-1 h-3 w-3 animate-spin" />
                                Thinking...
                              </>
                            ) : (
                              <>
                                <ListChecks className="mr-1 h-3 w-3" />
                                Guide me
                              </>
                            )}
                          </Button>
                        </div>
                      </div>
                    )
                  })}
                </CardContent>
              </Card>
            )
          })}
        </motion.section>

        {/* How it works */}
        <motion.section variants={itemVariants} className="mb-6">
          <Card>
            <CardHeader>
              <CardTitle>How this agent works</CardTitle>
            </CardHeader>
            <CardContent className="text-sm text-muted-foreground space-y-2">
              <p>
                This agent is designed as a <b>stress-aware planner</b> inside MindEase. It
                takes your tasks, deadlines, your available focus time, and (optionally) how
                you&apos;re feeling today, and then builds a realistic plan instead of dumping
                everything into one day.
              </p>
              <ul className="list-disc ml-5 space-y-1">
                <li>
                  When you create a task, Gemini estimates <b>importance</b>, <b>stress cost</b>,{" "}
                  <b>energy requirement</b>, and <b>duration</b> to understand how heavy the work
                  feels.
                </li>
                <li>
                  When you click <b>&quot;Let AI prioritize my plan&quot;</b>, the model sees all
                  tasks plus your time budget and chosen <b>planning horizon</b>. It fills the{" "}
                  <b>Now</b>, <b>Next</b>, <b>Later</b>, and <b>Backlog</b> buckets and can assign{" "}
                  <b>planned days</b> and <b>minutes</b> for each task.
                </li>
                <li>
                  If your focus time is less than the total time of urgent tasks, the agent
                  prefers to keep the most critical items today and gently push the rest to other
                  days within your horizon.
                </li>
                <li>
                  You can still override the order inside the &quot;Now&quot; bucket; those
                  manual adjustments are saved back to the backend.
                </li>
                <li>
                  For any task, clicking <b>&quot;Guide me&quot;</b> asks the AI to generate a
                  concrete step-by-step breakdown. Using your relaxation preferences, it can
                  insert short, personalized <b>break steps</b> (with optional helpful links),
                  so the plan supports both productivity and stress relief.
                </li>
              </ul>
            </CardContent>
          </Card>
        </motion.section>
      </motion.main>

      <Footer />
    </div>
  )
}
