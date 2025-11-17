// PanicSOSChatbot.jsx - Fixed version with proper typing indicators and smooth UI
import { useState, useRef, useEffect } from "react"
import { motion, AnimatePresence } from "framer-motion"
import Picker from "@emoji-mart/react"
import { Smile, Trash2, Plus, Send, Sparkles } from "lucide-react"

import { api, API_BASE, getToken } from "@/lib/api"
import ChatMessage from "@/components/ChatMessage"
import ChatSidebar from "@/components/ChatSidebar"

import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from "@/components/ui/card"
import Navbar from "@/components/Navbar"
import Footer from "@/components/Footer"

const ACTIVE_KEY = "active_chat_id"

// ---------- Helpers ----------
function getOrCreateSessionId() {
  let id = localStorage.getItem("chatbot_session_id")
  if (!id) {
    const bytes = new Uint8Array(16)
    crypto.getRandomValues(bytes)
    bytes[6] = (bytes[6] & 0x0f) | 0x40
    bytes[8] = (bytes[8] & 0x3f) | 0x80
    id = [...bytes]
      .map((b, i) => {
        const s = b.toString(16).padStart(2, "0")
        return [4, 6, 8, 10].includes(i) ? "-" + s : s
      })
      .join("")
    localStorage.setItem("chatbot_session_id", id)
  }
  return id
}

// Stream SSE via fetch
async function streamSSE({ url, headers = {}, onToken, onError, onDone, signal }) {
  try {
    const res = await fetch(url, { headers, signal })
    if (!res.ok || !res.body) {
      throw new Error(`HTTP ${res.status}`)
    }
    const reader = res.body.getReader()
    const decoder = new TextDecoder("utf-8")
    let buf = ""

    while (true) {
      const { value, done } = await reader.read()
      if (done) break
      buf += decoder.decode(value, { stream: true })
      let idx
      while ((idx = buf.indexOf("\n\n")) >= 0) {
        const chunk = buf.slice(0, idx).trim()
        buf = buf.slice(idx + 2)
        if (!chunk) continue
        const line = chunk.split("\n").find((l) => l.startsWith("data: "))
        if (!line) continue
        const payloadStr = line.slice(6)
        if (payloadStr === "[DONE]") {
          onDone?.()
          return
        }
        try {
          const payload = JSON.parse(payloadStr)
          if (payload.error) onError?.(new Error(payload.error))
          const token = payload.token || ""
          if (token) onToken?.(token)
        } catch {
          /* ignore malformed lines */
        }
      }
    }
    onDone?.()
  } catch (e) {
    if (e?.name === "AbortError") return
    onError?.(e)
  }
}

export default function PanicSOSChatbot() {
  const [messages, setMessages] = useState([
    {
      id: 1,
      role: "ai",
      content: "Hello! I'm here to help you through any panic or anxiety you might be experiencing. How are you feeling right now?",
      typing: false,
    },
  ])

  const [inputMessage, setInputMessage] = useState("")
  const [showEmojiPicker, setShowEmojiPicker] = useState(false)
  const [isSending, setIsSending] = useState(false)
  const [working, setWorking] = useState(false)
  const [error, setError] = useState("")
  const [activeChatId, setActiveChatId] = useState(() => {
    const cached = localStorage.getItem(ACTIVE_KEY)
    return cached ? Number(cached) : null
  })
  const [isAuthed, setIsAuthed] = useState(!!getToken())

  const scrollAreaRef = useRef(null)
  const emojiPickerRef = useRef(null)
  const sessionIdRef = useRef(getOrCreateSessionId())
  const sseAbortRef = useRef(null)
  const createdOnceGuardRef = useRef(false)

  // ---------- Auto-scroll ----------
  useEffect(() => {
    const viewport = scrollAreaRef.current?.querySelector(
      "[data-radix-scroll-area-viewport]",
    )
    if (!viewport) return
    
    // Smooth scroll to bottom
    const scrollToBottom = () => {
      viewport.scrollTo({
        top: viewport.scrollHeight,
        behavior: 'smooth'
      })
    }
    
    // Use requestAnimationFrame for smoother updates
    requestAnimationFrame(scrollToBottom)
  }, [messages])

  // ---------- Close emoji on outside / Esc ----------
  useEffect(() => {
    if (!showEmojiPicker) return
    const onClick = (e) => {
      if (emojiPickerRef.current && !emojiPickerRef.current.contains(e.target)) {
        setShowEmojiPicker(false)
      }
    }
    const onKey = (e) => e.key === "Escape" && setShowEmojiPicker(false)
    document.addEventListener("mousedown", onClick)
    document.addEventListener("keydown", onKey)
    return () => {
      document.removeEventListener("mousedown", onClick)
      document.removeEventListener("keydown", onKey)
    }
  }, [showEmojiPicker])

  // ---------- SSE cleanup on unmount ----------
  useEffect(() => {
    return () => {
      if (sseAbortRef.current) sseAbortRef.current.abort()
    }
  }, [])

  // ---------- Load/ensure chat ----------
  useEffect(() => {
    async function ensureChat() {
      if (!isAuthed) return
      try {
        const { data: list } = await api.get("/api/chats")
        const chats = list?.chats || []

        const loadMessages = async (chatId) => {
          const { data: hist } = await api.get(
            `/api/chats/${chatId}/messages?limit=100`,
          )
          const loaded = (hist?.messages || []).map((m) => ({
            id: m.id,
            role: m.role === "human" ? "user" : "ai",
            content: m.content,
            typing: false,
          }))
          setMessages(
            loaded.length
              ? loaded
              : [
                  {
                    id: 1,
                    role: "ai",
                    content: "How are you feeling right now?",
                    typing: false,
                  },
                ],
          )
        }

        if (activeChatId && chats.some((c) => c.chat_id === activeChatId)) {
          localStorage.setItem(ACTIVE_KEY, String(activeChatId))
          await loadMessages(activeChatId)
          return
        }

        const normals = chats.filter((c) => !c.is_journal)
        if (normals.length) {
          const candidate = normals[0]
          setActiveChatId(candidate.chat_id)
          localStorage.setItem(ACTIVE_KEY, String(candidate.chat_id))
          await loadMessages(candidate.chat_id)
          return
        }

        if (!createdOnceGuardRef.current) {
          createdOnceGuardRef.current = true
          const { data } = await api.post("/api/chats", { is_journal: false })
          setActiveChatId(data.chat_id)
          localStorage.setItem(ACTIVE_KEY, String(data.chat_id))
          setMessages([
            {
              id: 1,
              role: "ai",
              content: "New conversation started. How are you feeling right now?",
              typing: false,
            },
          ])
        }
      } catch {
        setIsAuthed(false)
      }
    }
    ensureChat()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  useEffect(() => {
    if (activeChatId) {
      localStorage.setItem(ACTIVE_KEY, String(activeChatId))
    }
  }, [activeChatId])

  // ---------- Compose helpers ----------
  const addTypingBubble = () => {
    const id = Date.now() + 1
    setMessages((prev) => [
      ...prev,
      { id, role: "ai", content: "", typing: true },
    ])
    return id
  }

  const appendToken = (id, token) => {
    setMessages((prev) =>
      prev.map((m) =>
        m.id === id
          ? {
              ...m,
              content: (m.content || "") + token,
              typing: true, // Keep typing true while streaming
            }
          : m,
      ),
    )
  }

  const finalizeTyping = (id) => {
    setMessages((prev) =>
      prev.map((m) => (m.id === id ? { ...m, typing: false } : m)),
    )
  }

  // ---------- Send ----------
  const handleSendMessage = async (e) => {
    e.preventDefault()
    if (isSending) return
    setError("")
    const text = inputMessage.trim()
    if (!text) return

    const userMsg = { id: Date.now(), role: "user", content: text, typing: false }
    setMessages((prev) => [...prev, userMsg])
    setInputMessage("")
    setIsSending(true)

    const typingId = addTypingBubble()

    if (sseAbortRef.current) sseAbortRef.current.abort()
    const controller = new AbortController()
    sseAbortRef.current = controller

    try {
      if (isAuthed && activeChatId) {
        const qs = new URLSearchParams({
          chat_id: String(activeChatId),
          message: text,
        })
        const url = `${API_BASE}/api/chatbot/stream?${qs.toString()}`
        const token = getToken() || ""

        await streamSSE({
          url,
          headers: token ? { Authorization: `Bearer ${token}` } : {},
          onToken: (tok) => appendToken(typingId, tok),
          onError: (err) => setError(err.message || "Stream error"),
          onDone: () => finalizeTyping(typingId),
          signal: controller.signal,
        })
      } else {
        const qs = new URLSearchParams({
          session_id: sessionIdRef.current,
          message: text,
        })
        const url = `${API_BASE}/api/chatbot/stream?${qs.toString()}`
        await streamSSE({
          url,
          onToken: (tok) => appendToken(typingId, tok),
          onError: (err) => setError(err.message || "Stream error"),
          onDone: () => finalizeTyping(typingId),
          signal: controller.signal,
        })
      }
    } catch (err) {
      if (err?.name !== "AbortError") {
        setError(err?.message || "Sorry, I'm having trouble responding right now.")
        finalizeTyping(typingId)
      }
    } finally {
      setIsSending(false)
    }
  }

  // ---------- Header actions ----------
  const handleNewChat = async () => {
    if (!isAuthed || working) return
    setWorking(true)
    setError("")
    try {
      const { data } = await api.post("/api/chats", { is_journal: false })
      setActiveChatId(data.chat_id)
      localStorage.setItem(ACTIVE_KEY, String(data.chat_id))
      setMessages([
        {
          id: 1,
          role: "ai",
          content: "New conversation started. How are you feeling right now?",
          typing: false,
        },
      ])
    } catch {
      setError("Could not start a new chat.")
    } finally {
      setWorking(false)
    }
  }

  const handleDeleteChat = async () => {
    if (!isAuthed || !activeChatId || working) return
    if (!confirm("Delete this chat and its data? This cannot be undone.")) return
    setWorking(true)
    setError("")
    try {
      await api.delete(`/api/chats/${activeChatId}`)

      const { data: list } = await api.get("/api/chats")
      const normals = (list?.chats || []).filter(
        (c) => !c.is_journal && c.chat_id !== activeChatId,
      )

      if (normals.length) {
        const nextId = normals[0].chat_id
        setActiveChatId(nextId)
        localStorage.setItem(ACTIVE_KEY, String(nextId))
        const { data: hist } = await api.get(
          `/api/chats/${nextId}/messages?limit=100`,
        )
        const loaded = (hist?.messages || []).map((m) => ({
          id: m.id,
          role: m.role === "human" ? "user" : "ai",
          content: m.content,
          typing: false,
        }))
        setMessages(
          loaded.length
            ? loaded
            : [{ id: 1, role: "ai", content: "How are you feeling right now?", typing: false }],
        )
      } else {
        const { data } = await api.post("/api/chats", { is_journal: false })
        setActiveChatId(data.chat_id)
        localStorage.setItem(ACTIVE_KEY, String(data.chat_id))
        setMessages([
          {
            id: 1,
            role: "ai",
            content: "New conversation started. How are you feeling right now?",
            typing: false,
          },
        ])
      }
    } catch {
      setError("Could not delete chat.")
    } finally {
      setWorking(false)
    }
  }

  const resetConversation = async () => {
    if (isAuthed && activeChatId) {
      await handleNewChat()
      return
    }
    setError("")
    setIsSending(true)
    try {
      await api.post("/api/chatbot/reset", { session_id: sessionIdRef.current })
      setMessages([
        {
          id: 1,
          role: "ai",
          content: "Hello! I'm here to help. How are you feeling right now?",
          typing: false,
        },
      ])
    } catch {
      setError("Could not reset the conversation. Please try again.")
    } finally {
      setIsSending(false)
    }
  }

  // ---------- UI ----------
  return (
    <div className="min-h-screen bg-[radial-gradient(circle_at_top,rgba(255,255,255,0.9),rgba(230,230,230,0.4))]">
      <Navbar />
      <motion.div
        className="container mx-auto px-4 py-8 max-w-5xl"
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
      >
        <div className="grid grid-cols-1 md:grid-cols-[16rem_1fr] gap-4">
          {isAuthed ? (
            <ChatSidebar
              activeChatId={activeChatId}
              onSelect={async (id) => {
                setError("")
                if (!id) {
                  setActiveChatId(null)
                  localStorage.removeItem(ACTIVE_KEY)
                  return
                }
                if (id === activeChatId) return
                setActiveChatId(id)
                localStorage.setItem(ACTIVE_KEY, String(id))
                try {
                  const { data } = await api.get(
                    `/api/chats/${id}/messages?limit=100`,
                  )
                  const loaded = (data?.messages || []).map((m) => ({
                    id: m.id,
                    role: m.role === "human" ? "user" : "ai",
                    content: m.content,
                    typing: false,
                  }))
                  setMessages(
                    loaded.length
                      ? loaded
                      : [
                          {
                            id: 1,
                            role: "ai",
                            content: "How are you feeling right now?",
                            typing: false,
                          },
                        ],
                  )
                } catch {
                  setError("Could not load messages.")
                }
              }}
              className="h-full"
            />
          ) : (
            <div className="hidden md:block" />
          )}

          <Card className="w-full border-2 border-border/40 shadow-xl rounded-2xl bg-white/90 backdrop-blur-sm overflow-hidden">
            <CardHeader className="flex flex-row items-center justify-between border-b bg-gradient-to-r from-blue-500/10 via-indigo-500/10 to-purple-500/10">
              <div className="space-y-1">
                <CardTitle className="text-2xl font-bold bg-gradient-to-r from-blue-600 to-indigo-600 bg-clip-text text-transparent flex items-center gap-2">
                  <Sparkles className="w-6 h-6 text-blue-500" />
                  Panic SOS Chatbot
                  {!isAuthed && (
                    <span className="ml-2 text-xs text-muted-foreground bg-gray-200 px-2 py-1 rounded-full">
                      guest
                    </span>
                  )}
                </CardTitle>
                <p className="text-xs text-muted-foreground">
                  A calm, private space to talk through anxiety, overwhelm, or tough moments.
                </p>
              </div>

              <div className="flex gap-2">
                {isAuthed && (
                  <>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={handleNewChat}
                      title="New chat"
                      disabled={working}
                      className="hover:bg-blue-50 hover:border-blue-300 transition-all duration-200"
                    >
                      <Plus className="h-4 w-4 mr-1" /> New
                    </Button>

                    {activeChatId && (
                      <Button
                        variant="destructive"
                        size="sm"
                        onClick={handleDeleteChat}
                        title="Delete this chat"
                        disabled={working}
                        className="transition-all duration-200 hover:shadow-lg"
                      >
                        <Trash2 className="h-4 w-4 mr-1" /> Delete
                      </Button>
                    )}
                  </>
                )}
                <Button
                  variant="secondary"
                  size="sm"
                  onClick={resetConversation}
                  disabled={isSending || working}
                  className="transition-all duration-200 hover:bg-gray-300"
                >
                  {isAuthed ? "Reset" : "Reset"}
                </Button>
              </div>
            </CardHeader>

            <CardContent className="pt-4">
              <ScrollArea className="h-[480px] pr-4" ref={scrollAreaRef}>
                <AnimatePresence mode="popLayout">
                  {messages.map((m) => (
                    <ChatMessage
                      key={m.id}
                      role={m.role}
                      content={m.content}
                      typing={m.typing}
                    />
                  ))}
                </AnimatePresence>
              </ScrollArea>

              {error && (
                <motion.div
                  initial={{ opacity: 0, y: -10 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="p-3 mt-2 bg-red-50 border border-red-200 rounded-lg"
                >
                  <p className="text-sm text-red-600" role="alert">
                    {error}
                  </p>
                </motion.div>
              )}
            </CardContent>

            <CardFooter className="border-t border-gray-200 pt-3 bg-gray-50/50">
              <form onSubmit={handleSendMessage} className="flex w-full gap-2">
                <div className="relative">
                  <Button
                    type="button"
                    variant="outline"
                    size="icon"
                    onClick={() => setShowEmojiPicker((v) => !v)}
                    disabled={isSending}
                    aria-label="Insert emoji"
                    title="Insert emoji"
                    className="hover:bg-blue-50 hover:border-blue-300 transition-all duration-200"
                  >
                    <Smile className="h-5 w-5" />
                  </Button>
                  {showEmojiPicker && (
                    <div
                      ref={emojiPickerRef}
                      className="absolute bottom-full mb-2 left-0 bg-popover shadow-xl rounded-lg z-50 border-2"
                    >
                      <Picker
                        onEmojiSelect={(emoji) => {
                          setInputMessage((prev) => prev + emoji.native)
                          setShowEmojiPicker(false)
                        }}
                      />
                    </div>
                  )}
                </div>

                <Input
                  type="text"
                  placeholder="Type anything that's on your mind..."
                  value={inputMessage}
                  onChange={(e) => setInputMessage(e.target.value)}
                  className="flex-grow bg-white border-2 focus:ring-2 focus:ring-blue-400 transition-all duration-200"
                  disabled={isSending}
                />

                <Button
                  type="submit"
                  className="bg-gradient-to-r from-blue-500 to-indigo-600 hover:from-blue-600 hover:to-indigo-700 shadow-lg hover:shadow-xl transition-all duration-200 disabled:opacity-50"
                  disabled={isSending || !inputMessage.trim()}
                >
                  {isSending ? (
                    <motion.div
                      animate={{ rotate: 360 }}
                      transition={{ duration: 1, repeat: Infinity, ease: "linear" }}
                      className="w-5 h-5 border-2 border-white border-t-transparent rounded-full"
                    />
                  ) : (
                    <>
                      <Send className="h-4 w-4 mr-2" />
                      Send
                    </>
                  )}
                </Button>
              </form>
            </CardFooter>
          </Card>
        </div>
      </motion.div>
      <Footer />
    </div>
  )
}