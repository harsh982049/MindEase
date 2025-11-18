// File: src/pages/FocusCompanion.jsx
import { useState, useMemo } from "react"
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
  Calendar,
  Send,
  Loader2,
  AlarmClock,
  Clock,
  Settings,
  RefreshCcw,
} from "lucide-react"

const API_BASE = "http://127.0.0.1:5000" // keep consistent with your other pages

const containerVariants = {
  hidden: { opacity: 0 },
  visible: { opacity: 1, transition: { staggerChildren: 0.2 } },
}
const itemVariants = {
  hidden: { y: 12, opacity: 0 },
  visible: { y: 0, opacity: 1, transition: { type: "spring", stiffness: 110 } },
}

function toLocal(dt) {
  if (!dt) return ""
  try {
    const d = new Date(dt)
    const date = d.toLocaleDateString([], { year: "numeric", month: "short", day: "2-digit" })
    const time = d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })
    return `${date} • ${time}`
  } catch {
    return String(dt)
  }
}

function minutesBetween(start, end) {
  try {
    const s = new Date(start).getTime()
    const e = new Date(end).getTime()
    if (Number.isNaN(s) || Number.isNaN(e)) return 0
    return Math.max(0, Math.round((e - s) / (1000 * 60)))
  } catch {
    return 0
  }
}

function groupByDate(subtasks) {
  const byDate = {}
  ;(subtasks || []).forEach((s) => {
    const d = s.planned_start_ts ? new Date(s.planned_start_ts) : null
    const key = d
      ? d.toLocaleDateString([], { year: "numeric", month: "short", day: "2-digit" })
      : "No date"
    if (!byDate[key]) byDate[key] = []
    byDate[key].push(s)
  })
  return byDate
}

export default function FocusCompanion() {
  // --- form state
  const [userEmail, setUserEmail] = useState("")
  const [title, setTitle] = useState("")
  const [description, setDescription] = useState("")
  const [timebox, setTimebox] = useState(45) // minutes
  const [deadline, setDeadline] = useState("") // HTML datetime-local string

  // --- preferences state
  const [workStart, setWorkStart] = useState("06:00")
  const [workEnd, setWorkEnd] = useState("23:00")
  const [bufferMin, setBufferMin] = useState(1)
  const [notifyEmail, setNotifyEmail] = useState(true)
  const [prefsLoading, setPrefsLoading] = useState(false)

  // --- results / UI
  const [loading, setLoading] = useState(false)
  const [createdTaskId, setCreatedTaskId] = useState(null)
  const [subtasks, setSubtasks] = useState([])
  const [upcomingSubtasks, setUpcomingSubtasks] = useState([])
  const [error, setError] = useState("")
  const [infoMessage, setInfoMessage] = useState("")

  const totalPlanned = useMemo(() => {
    if (!Array.isArray(subtasks)) return 0
    return subtasks.reduce((sum, s) => {
      const dur = minutesBetween(s.planned_start_ts, s.planned_end_ts)
      return sum + dur
    }, 0)
  }, [subtasks])

  const upcomingByDate = useMemo(() => groupByDate(upcomingSubtasks), [upcomingSubtasks])

  // ---- helpers to talk to backend ----
  const loadUpcoming = async () => {
    if (!userEmail) {
      setError("Please enter your email first to load upcoming focus blocks.")
      return
    }
    try {
      const res = await axios.get(`${API_BASE}/api/focus/subtasks/upcoming`, {
        params: { user_email: userEmail, days: 7 },
      })
      setUpcomingSubtasks(res.data.subtasks || [])
    } catch (err) {
      console.error(err)
      setError(err.response?.data?.error || "Failed to fetch upcoming focus blocks.")
    }
  }

  const handleLoadPrefs = async () => {
    if (!userEmail) {
      setError("Please enter your email above to load preferences.")
      return
    }
    setError("")
    setInfoMessage("")
    setPrefsLoading(true)
    try {
      const res = await axios.get(`${API_BASE}/api/focus/prefs`, {
        params: { user_email: userEmail },
      })
      const prefs = res.data.prefs || {}
      setWorkStart(prefs.work_start_hhmm || "06:00")
      setWorkEnd(prefs.work_end_hhmm || "23:59")
      setBufferMin(prefs.default_buffer_min ?? 1)
      setNotifyEmail(prefs.notify_email ?? true)
      setInfoMessage("Preferences loaded.")
    } catch (err) {
      console.error(err)
      setError(err.response?.data?.error || "Failed to load preferences.")
    } finally {
      setPrefsLoading(false)
    }
  }

  const handleSavePrefs = async () => {
    if (!userEmail) {
      setError("Please enter your email above to save preferences.")
      return
    }
    setError("")
    setInfoMessage("")
    setPrefsLoading(true)
    try {
      await axios.post(`${API_BASE}/api/focus/prefs`, {
        user_email: userEmail,
        work_start_hhmm: workStart,
        work_end_hhmm: workEnd,
        default_buffer_min: bufferMin,
        notify_email: notifyEmail,
      })
      setInfoMessage("Preferences saved for this email.")
    } catch (err) {
      console.error(err)
      setError(err.response?.data?.error || "Failed to save preferences.")
    } finally {
      setPrefsLoading(false)
    }
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    setError("")
    setInfoMessage("")
    setCreatedTaskId(null)
    setSubtasks([])

    if (!userEmail) {
      setError("Please enter your email.")
      return
    }
    if (!title.trim()) {
      setError("Please enter a task title.")
      return
    }

    let deadlineIso = null
    if (deadline) {
      const d = new Date(deadline)
      if (Number.isNaN(d.getTime())) {
        setError("Please enter a valid date and time.")
        return
      }
      deadlineIso = d.toISOString()
    }

    setLoading(true)
    try {
      const payload = {
        user_email: userEmail,
        title,
        description: description || null,
        timebox_min: Number(timebox) || 45,
        deadline_ts: deadlineIso,
        constraints: {}, // reserved for future (energy level, etc.)
      }
      const res = await axios.post(`${API_BASE}/api/focus/task/create`, payload)
      setCreatedTaskId(res.data.task_id)
      setSubtasks(res.data.subtasks || [])
      setInfoMessage("Focus plan created & scheduled. Check your email for reminders.")
      // Also refresh upcoming blocks
      await loadUpcoming()
    } catch (err) {
      console.error(err)
      setError(err.response?.data?.error || "Failed to create and schedule focus task.")
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen flex flex-col bg-background text-foreground">
      <Navbar />
      <motion.main
        className="flex-1 container mx-auto px-4 py-8 max-w-5xl"
        variants={containerVariants}
        initial="hidden"
        animate="visible"
      >
        <motion.header variants={itemVariants} className="mb-8">
          <h1 className="text-3xl font-bold">Focus Companion - Planner · Scheduler · Notifier</h1>
          <p className="text-muted-foreground mt-2">
            Turn a big goal into 3–5 atomic sub-tasks, schedule them within your work hours,
            and receive gentle email nudges when it&apos;s time to start.
          </p>

          {(error || infoMessage) && (
            <div className="mt-4">
              {error && (
                <div className="text-sm border border-red-500/40 bg-red-500/10 text-red-500 rounded-md px-3 py-2">
                  {error}
                </div>
              )}
              {infoMessage && !error && (
                <div className="text-sm border border-emerald-500/40 bg-emerald-500/10 text-emerald-500 rounded-md px-3 py-2">
                  {infoMessage}
                </div>
              )}
            </div>
          )}
        </motion.header>

        {/* Preferences */}
        <motion.section variants={itemVariants} className="mb-8">
          <Card>
            <CardHeader className="flex flex-col md:flex-row md:items-center md:justify-between">
              <CardTitle className="flex items-center gap-2">
                <Settings className="w-5 h-5" />
                Workday Preferences
              </CardTitle>
              <div className="text-xs text-muted-foreground mt-2 md:mt-0">
                These settings are stored per email and used for all future focus plans.
              </div>
            </CardHeader>
            <CardContent>
              <div className="grid gap-4 md:grid-cols-4">
                <div>
                  <label className="text-sm font-medium">Workday start (HH:MM)</label>
                  <Input
                    type="text"
                    placeholder="09:00"
                    value={workStart}
                    onChange={(e) => setWorkStart(e.target.value)}
                  />
                </div>
                <div>
                  <label className="text-sm font-medium">Workday end (HH:MM)</label>
                  <Input
                    type="text"
                    placeholder="18:00"
                    value={workEnd}
                    onChange={(e) => setWorkEnd(e.target.value)}
                  />
                </div>
                <div>
                  <label className="text-sm font-medium">Buffer between blocks (min)</label>
                  <Input
                    type="number"
                    min={0}
                    value={bufferMin}
                    onChange={(e) => setBufferMin(Number(e.target.value) || 0)}
                  />
                </div>
                <div className="flex flex-col justify-end">
                  <label className="text-sm font-medium mb-1">Email reminders</label>
                  <div className="flex items-center gap-2">
                    <input
                      id="notify-email"
                      type="checkbox"
                      className="h-4 w-4"
                      checked={notifyEmail}
                      onChange={(e) => setNotifyEmail(e.target.checked)}
                    />
                    <label htmlFor="notify-email" className="text-sm text-muted-foreground">
                      Send reminder emails
                    </label>
                  </div>
                </div>
              </div>

              <div className="flex flex-col md:flex-row md:items-center md:justify-between mt-4 gap-3">
                <div className="flex gap-2">
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={handleLoadPrefs}
                    disabled={prefsLoading || !userEmail}
                  >
                    {prefsLoading ? (
                      <>
                        <Loader2 className="w-4 h-4 mr-1 animate-spin" />
                        Loading…
                      </>
                    ) : (
                      <>
                        <RefreshCcw className="w-4 h-4 mr-1" />
                        Load prefs
                      </>
                    )}
                  </Button>
                  <Button
                    type="button"
                    size="sm"
                    onClick={handleSavePrefs}
                    disabled={prefsLoading || !userEmail}
                  >
                    <Settings className="w-4 h-4 mr-1" />
                    Save prefs
                  </Button>
                </div>
                <p className="text-xs text-muted-foreground">
                  Uses the same email you enter below.{" "}
                  {!userEmail && <span>Enter your email before loading/saving.</span>}
                </p>
              </div>
            </CardContent>
          </Card>
        </motion.section>

        {/* Creator */}
        <motion.section variants={itemVariants} className="mb-8">
          <Card>
            <CardHeader>
              <CardTitle>Create & Schedule a Focus Task</CardTitle>
            </CardHeader>
            <CardContent>
              <form onSubmit={handleSubmit} className="grid gap-4 md:grid-cols-2">
                <div className="md:col-span-1">
                  <label className="text-sm font-medium">Your Email</label>
                  <Input
                    type="email"
                    placeholder="you@example.com"
                    value={userEmail}
                    onChange={(e) => setUserEmail(e.target.value)}
                    required
                  />
                </div>

                <div className="md:col-span-1">
                  <label className="text-sm font-medium">Timebox (minutes)</label>
                  <Input
                    type="number"
                    min={10}
                    step={5}
                    value={timebox}
                    onChange={(e) => setTimebox(Number(e.target.value) || 45)}
                  />
                </div>

                <div className="md:col-span-2">
                  <label className="text-sm font-medium">Big task / goal</label>
                  <Input
                    placeholder="Finish MindEase final report"
                    value={title}
                    onChange={(e) => setTitle(e.target.value)}
                    required
                  />
                </div>

                <div className="md:col-span-2">
                  <label className="text-sm font-medium">Optional context / notes</label>
                  <Textarea
                    placeholder="Any constraints, current status, or details that will help the planner…"
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                    rows={3}
                  />
                </div>

                <div className="md:col-span-1">
                  <label className="text-sm font-medium flex items-center gap-1">
                    <Calendar className="w-4 h-4" />
                    Deadline (optional)
                  </label>
                  <Input
                    type="datetime-local"
                    value={deadline}
                    onChange={(e) => setDeadline(e.target.value)}
                  />
                  <p className="text-[11px] text-muted-foreground mt-1">
                    Used to bias the schedule before/around the deadline.
                  </p>
                </div>

                <div className="md:col-span-1 flex items-end justify-end">
                  <Button type="submit" className="w-full md:w-auto" disabled={loading}>
                    {loading ? (
                      <>
                        <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                        Planning…
                      </>
                    ) : (
                      <>
                        <Send className="w-4 h-4 mr-2" />
                        Plan & schedule
                      </>
                    )}
                  </Button>
                </div>
              </form>

              {createdTaskId && (
                <p className="mt-3 text-xs text-muted-foreground">
                  Created task ID: <span className="font-mono">{createdTaskId}</span>
                </p>
              )}
            </CardContent>
          </Card>
        </motion.section>

        {/* Today’s created subtasks */}
        <motion.section variants={itemVariants} className="mb-8">
          <Card>
            <CardHeader className="flex flex-col md:flex-row md:items-center md:justify-between">
              <CardTitle>Today’s Scheduled Sub-tasks (this plan)</CardTitle>
              <div className="text-sm text-muted-foreground mt-2 md:mt-0">
                <span className="inline-flex items-center gap-1">
                  <Clock className="w-4 h-4" />
                  Planned total:&nbsp;<b>{totalPlanned}</b>&nbsp;min
                </span>
              </div>
            </CardHeader>
            <CardContent className="space-y-3">
              {subtasks.length === 0 && (
                <p className="text-sm text-muted-foreground">
                  Create a task above to see its 3–5 atomic sub-steps here.
                </p>
              )}

              {subtasks.map((s) => (
                <div
                  key={s.id}
                  className="flex flex-col md:flex-row md:items-start md:justify-between rounded-lg border p-4"
                >
                  <div className="space-y-1 md:max-w-xl">
                    <div className="flex items-center gap-2 flex-wrap">
                      <Badge variant="secondary">Step {s.idx}</Badge>
                      <span className="font-medium">{s.title}</span>
                    </div>
                    <div className="text-xs text-muted-foreground">
                      <span className="inline-flex items-center gap-1 mr-3">
                        <AlarmClock className="w-3.5 h-3.5" />
                        {toLocal(s.planned_start_ts)} → {toLocal(s.planned_end_ts)}
                      </span>
                      <span className="inline-flex items-center gap-1">
                        <Clock className="w-3.5 h-3.5" />
                        {minutesBetween(s.planned_start_ts, s.planned_end_ts)} min
                      </span>
                    </div>
                    {s.dod_text && (
                      <details className="mt-1 text-xs text-muted-foreground">
                        <summary className="cursor-pointer select-none">
                          Definition of done (click to expand)
                        </summary>
                        <p className="mt-1 whitespace-pre-line">{s.dod_text}</p>
                      </details>
                    )}
                  </div>
                </div>
              ))}
            </CardContent>
          </Card>
        </motion.section>

        {/* Upcoming focus blocks */}
        <motion.section variants={itemVariants} className="mb-8">
          <Card>
            <CardHeader className="flex flex-col md:flex-row md:items-center md:justify-between">
              <CardTitle>Upcoming Focus Blocks (next 7 days)</CardTitle>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={loadUpcoming}
                disabled={!userEmail}
              >
                <RefreshCcw className="w-4 h-4 mr-1" />
                Refresh
              </Button>
            </CardHeader>
            <CardContent>
              {Object.keys(upcomingByDate).length === 0 ? (
                <p className="text-sm text-muted-foreground">
                  No upcoming focus blocks yet. Create a task or hit refresh after scheduling.
                </p>
              ) : (
                <div className="space-y-4">
                  {Object.entries(upcomingByDate).map(([day, items]) => (
                    <div key={day} className="space-y-2">
                      <div className="text-xs font-semibold text-muted-foreground">{day}</div>
                      <div className="space-y-2">
                        {items.map((s) => (
                          <div
                            key={s.id}
                            className="flex flex-col md:flex-row md:items-start md:justify-between rounded-lg border p-3 text-xs"
                          >
                            <div className="space-y-0.5 md:max-w-xl">
                              <div className="flex items-center gap-2 flex-wrap">
                                <Badge variant="outline" className="text-[11px]">
                                  Step {s.idx}
                                </Badge>
                                <span className="font-medium text-sm">{s.title}</span>
                              </div>
                              <div className="text-[11px] text-muted-foreground">
                                <span className="inline-flex items-center gap-1 mr-2">
                                  <AlarmClock className="w-3 h-3" />
                                  {toLocal(s.planned_start_ts)} → {toLocal(s.planned_end_ts)}
                                </span>
                                <span className="inline-flex items-center gap-1">
                                  <Clock className="w-3 h-3" />
                                  {minutesBetween(s.planned_start_ts, s.planned_end_ts)} min
                                </span>
                              </div>
                              {s.dod_text && (
                                <p className="mt-1 text-[11px] text-muted-foreground line-clamp-2">
                                  Done when: {s.dod_text}
                                </p>
                              )}
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </motion.section>

        {/* Explanation */}
        <motion.section variants={itemVariants} className="mb-8">
          <Card>
            <CardHeader>
              <CardTitle>How this fits into MindEase</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2 text-sm text-muted-foreground">
              <p>
                Focus Companion turns a vague, slightly scary task into a small series of concrete,
                time-bound steps. Under the hood, the backend uses <b>Gemini 2.5 Flash</b> to produce
                atomic sub-tasks with a clear <i>definition of done</i>, then schedules them within
                your configured work hours.
              </p>
              <p>
                At each planned start time, you receive a short email reminder generated by the
                backend. The &quot;Upcoming Focus Blocks&quot; timeline helps you see your entire week
                at a glance, while the preferences panel lets you adjust work hours, buffer, and email
                reminders without touching any code.
              </p>
            </CardContent>
          </Card>
        </motion.section>
      </motion.main>
      <Footer />
    </div>
  )
}
