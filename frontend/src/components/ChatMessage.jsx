// ChatMessage.jsx - Fixed version with proper typing indicator
import { motion } from "framer-motion"
import { Avatar, AvatarFallback } from "@/components/ui/avatar"

export default function ChatMessage({ role, content, typing }) {
  const isUser = role === "user"

  return (
    <motion.div 
      className={`flex ${isUser ? "justify-end" : "justify-start"} mb-4`}
      initial={{ opacity: 0, y: 10, scale: 0.95 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      exit={{ opacity: 0, scale: 0.95 }}
      transition={{ duration: 0.3, ease: "easeOut" }}
    >
      <div
        className={`flex items-end ${
          isUser ? "flex-row-reverse" : "flex-row"
        } gap-3 max-w-[80%]`}
      >
        <Avatar className={`w-9 h-9 flex-shrink-0 ${isUser ? "ml-1" : "mr-1"}`}>
          <AvatarFallback className="text-xs font-semibold bg-gradient-to-br from-blue-400 to-blue-600 text-white">
            {isUser ? "You" : "CB"}
          </AvatarFallback>
        </Avatar>

        <motion.div
          className={`relative px-4 py-3 rounded-2xl shadow-md transition-all duration-200 ${
            isUser
              ? "bg-gradient-to-br from-blue-500 to-blue-600 text-white rounded-br-sm"
              : "bg-gradient-to-br from-gray-50 to-gray-100 text-gray-800 border border-gray-200 rounded-bl-sm"
          }`}
          initial={{ scale: 0.9 }}
          animate={{ scale: 1 }}
          transition={{ duration: 0.2, ease: "easeOut" }}
        >
          {/* Show typing dots only when typing AND no content yet */}
          {typing && !content ? (
            <div className="flex items-center gap-1.5 py-1 min-w-[60px]">
              <motion.span
                className={`w-2 h-2 rounded-full ${isUser ? 'bg-white/70' : 'bg-gray-400'}`}
                animate={{ y: [0, -8, 0] }}
                transition={{ duration: 0.6, repeat: Infinity, delay: 0 }}
              />
              <motion.span
                className={`w-2 h-2 rounded-full ${isUser ? 'bg-white/70' : 'bg-gray-400'}`}
                animate={{ y: [0, -8, 0] }}
                transition={{ duration: 0.6, repeat: Infinity, delay: 0.2 }}
              />
              <motion.span
                className={`w-2 h-2 rounded-full ${isUser ? 'bg-white/70' : 'bg-gray-400'}`}
                animate={{ y: [0, -8, 0] }}
                transition={{ duration: 0.6, repeat: Infinity, delay: 0.4 }}
              />
            </div>
          ) : (
            /* Show content (even while typing if content exists) */
            <div className="text-[15px] leading-relaxed whitespace-pre-wrap">
              {content}
              {/* Optional: Show cursor while streaming */}
              {typing && content && (
                <motion.span
                  className="inline-block w-0.5 h-4 bg-current ml-0.5"
                  animate={{ opacity: [1, 0] }}
                  transition={{ duration: 0.8, repeat: Infinity }}
                />
              )}
            </div>
          )}
        </motion.div>
      </div>
    </motion.div>
  )
}