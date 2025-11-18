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

const API_BASE = "http://127.0.0.1:5000" // keep consistent with other pages

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

export default function TaskPrioritizer() {
  // --- shared state ---
  const [userEmail, setUserEmail] = useState("")
  const [todayMinutes, setTodayMinutes] = useState(120)

  // --- create-task form ---
  const [title, setTitle] = useState("")
  const [description, setDescription] = useState("")
  const [deadlineDate, setDeadlineDate] = useState("")   // "2025-11-17"
  const [deadlineTime, setDeadlineTime] = useState("")   // "14:30"

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

  // Group tasks by bucket for UI
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
    return tasks.reduce((acc, t) => acc + (t.ai_estimated_minutes || 0), 0)
  }, [tasks])

  const hasEmail = userEmail.trim().length > 0

  // --- initial load: when userEmail is set, fetch existing tasks ---
  useEffect(() => {
    if (!hasEmail) return
    fetchTasks()
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
      // we don't get plan_summary here; only from /api/priority/run
    } catch (err) {
      setError(
        err?.response?.data?.error ||
          "Could not fetch tasks. Check if backend is running and Supabase is configured."
      )
    } finally {
      setLoadingFetch(false)
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
        // If user didn’t specify time, assume end of day
        const timePart = deadlineTime || "23:59"
        const local = `${deadlineDate}T${timePart}`
        deadlineIso = new Date(local).toISOString()
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
      // refresh tasks list
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
      const payload = {
        user_email: userEmail.trim(),
        today_available_minutes: Number(todayMinutes) || undefined,
      }
      const { data } = await axios.post(`${API_BASE}/api/priority/run`, payload)
      setPlanSummary(data.plan_summary || "")
      setTasks(data.tasks || [])
      setInfo("AI prioritization updated successfully.")
    } catch (err) {
      setError(
        err?.response?.data?.error ||
          "Could not run AI prioritization. Check backend / API key configuration."
      )
    } finally {
      setLoadingRun(false)
    }
  }

  // simple manual reordering within a bucket (using up/down buttons)
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

    setTasks(copyTasks)
  }

  async function handleSaveOrder(bucket) {
    if (!hasEmail) {
      setError("Please enter your email first.")
      return
    }
    const list = groupedTasks[bucket] || []
    if (!list.length) return
    const orderedIds = list.map((t) => t.id)
    setSavingOrder(true)
    setError("")
    setInfo("")
    try {
      const { data } = await axios.post(`${API_BASE}/api/priority/order/manual`, {
        user_email: userEmail.trim(),
        ordered_ids: orderedIds,
      })
      setTasks(data.tasks || [])
      setInfo("Order updated successfully for this bucket.")
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
            your energy levels, and estimated stress - with reasons for each task.
          </p>
        </motion.header>

        {/* Email + Day context */}
        <motion.section variants={itemVariants} className="mb-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <ListChecks className="h-5 w-5" />
                Your Context for Today
              </CardTitle>
            </CardHeader>
            <CardContent className="grid gap-4 md:grid-cols-3">
              <div className="md:col-span-1">
                <label className="text-sm font-medium">Your Email</label>
                <Input
                  type="email"
                  placeholder="you@example.com"
                  value={userEmail}
                  onChange={(e) => setUserEmail(e.target.value)}
                  required
                />
                <p className="text-xs text-muted-foreground mt-1">
                  Used to link tasks and prioritization to your account.
                </p>
              </div>

              <div className="md:col-span-1">
                <label className="text-sm font-medium flex items-center gap-1">
                  <Clock className="h-4 w-4" />
                  Available Focus Time (minutes)
                </label>
                <Input
                  type="number"
                  min={15}
                  step={15}
                  value={todayMinutes}
                  onChange={(e) => setTodayMinutes(e.target.value)}
                />
                <p className="text-xs text-muted-foreground mt-1">
                  Rough estimate; AI keeps your day realistic around this limit.
                </p>
              </div>

              <div className="md:col-span-1 flex items-end gap-2">
                <Button
                  type="button"
                  className="w-full md:w-auto"
                  onClick={handleRunAI}
                  disabled={loadingRun || !hasEmail}
                >
                  {loadingRun ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Prioritizing…
                    </>
                  ) : (
                    <>
                      <Brain className="mr-2 h-4 w-4" />
                      Let AI Prioritize My Day
                    </>
                  )}
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  className="w-full md:w-auto"
                  onClick={fetchTasks}
                  disabled={loadingFetch || !hasEmail}
                >
                  {loadingFetch ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Refreshing
                    </>
                  ) : (
                    <>
                      <RefreshCcw className="mr-2 h-4 w-4" />
                      Refresh Tasks
                    </>
                  )}
                </Button>
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
                  <label className="text-sm font-medium">Description (optional)</label>
                  <Textarea
                    placeholder="Add any context that helps the AI judge importance, stress, or complexity…"
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                    rows={3}
                  />
                </div>

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
                    Date is enough; if you skip time, we’ll assume end of day.
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
                    “Backlog” = someday; “Planned” = likely in the near future.
                  </p>
                </div>

                <div className="md:col-span-2 flex items-center justify-between gap-2">
                  <div className="text-xs text-muted-foreground">
                    When you create a task, the backend  estimates{" "}
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
                  Today’s AI Plan
                </CardTitle>
              </CardHeader>
              <CardContent className="text-sm text-muted-foreground flex flex-col gap-2">
                <p>{planSummary}</p>
                <div className="flex flex-wrap items-center gap-3 text-xs">
                  <span className="inline-flex items-center gap-1">
                    <Clock className="h-3.5 w-3.5" />
                    Total estimated:&nbsp;<b>{totalPlannedMinutes}</b>&nbsp;min
                  </span>
                  <span className="inline-flex items-center gap-1">
                    <Zap className="h-3.5 w-3.5" />
                    Tasks considered:&nbsp;<b>{tasks?.length || 0}</b>
                  </span>
                </div>
              </CardContent>
            </Card>
          </motion.section>
        )}

        {/* Buckets + Tasks */}
        <motion.section variants={itemVariants} className="mb-10 space-y-6">
          {["now", "next", "later", "backlog"].map((bucketKey) => {
            const list = groupedTasks[bucketKey] || []
            const label = bucketLabel(bucketKey)
            const showManualOrder =
              bucketKey === "now" && list.length > 1 // allow manual order in "Now"

            return (
              <Card key={bucketKey}>
                <CardHeader className="flex flex-col md:flex-row md:items-center md:justify-between gap-3">
                  <div className="flex items-center gap-2">
                    <Badge variant={bucketBadgeVariant(bucketKey)}>{label}</Badge>
                    {bucketKey === "now" && (
                      <span className="text-xs text-muted-foreground inline-flex items-center gap-1">
                        <AlertTriangle className="h-3.5 w-3.5" />
                        Highest-impact for the day.
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
                  {list.map((t, idx) => (
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
                            {t.ai_estimated_minutes ?? 30} min
                          </span>
                          {t.ai_category && (
                            <span className="inline-flex items-center gap-1 capitalize">
                              <Brain className="h-3 w-3" />
                              {t.ai_category.replace("_", " ")}
                            </span>
                          )}
                        </div>
                        {t.ai_reason && (
                          <p className="text-xs text-muted-foreground mt-1">
                            <span className="font-semibold">AI: </span>
                            {t.ai_reason}
                          </p>
                        )}
                      </div>

                      {/* Simple manual ordering for "Now" bucket */}
                      {bucketKey === "now" && list.length > 1 && (
                        <div className="flex md:flex-col items-center gap-2 md:gap-1 text-xs text-muted-foreground">
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
                    </div>
                  ))}
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
                This feature is used in <b>support</b> with the Focus Companion email scheduler.
              </p>
              <ul className="list-disc ml-5 space-y-1">
                <li>
                  When you create a task, Gemini estimates <b>importance</b>, <b>stress</b>,{" "}
                  <b>energy requirement</b>, and <b>duration</b>.
                </li>
                <li>
                  When you click <b>“Let AI prioritize my day”</b>, the model receives all tasks plus
                  your energy profile and time budget, and returns an ordered plan with buckets:
                  <b> Now</b>, <b>Next</b>, <b>Later</b>, and <b>Backlog</b>.
                </li>
                <li>
                  You can still <b>override</b> the order for the “Now” bucket; the backend updates
                  ranks accordingly.
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
