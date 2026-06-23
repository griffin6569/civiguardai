import { useState, useRef, useEffect, useCallback } from "react";
import { MessageCircle, X, Send, Loader2, Bot, User, Sparkles, RotateCcw, Maximize2, Minimize2, Shield } from "lucide-react";
import ReactMarkdown from "react-markdown";
import { motion, AnimatePresence } from "framer-motion";
import { cn } from "@/lib/utils";
import { useAuth } from "@/hooks/useAuth";

type Msg = { role: "user" | "assistant"; content: string };

const CHAT_URL = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/chat`;

const SUGGESTED_PROMPTS = [
  { icon: "Road", label: "Road conditions", prompt: "What's the current state of roads in Nairobi?" },
  { icon: "Flood", label: "Flood reports", prompt: "Have people recently reported flooding in Kenya?" },
  { icon: "Stats", label: "Report trends", prompt: "What are the most common infrastructure issues in recent citizen reports?" },
  { icon: "News", label: "Latest news", prompt: "What are the latest infrastructure news and developments in Kenya?" },
  { icon: "Alert", label: "Evidence gaps", prompt: "Where is the current evidence still too limited to draw strong conclusions?" },
  { icon: "Trends", label: "Source check", prompt: "Separate what comes from citizen reports versus verified news." },
];

const Chatbot = () => {
  const { isAdmin } = useAuth();
  const [open, setOpen] = useState(false);
  const [expanded, setExpanded] = useState(false);
  const [messages, setMessages] = useState<Msg[]>([]);
  const [input, setInput] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [messages]);

  useEffect(() => {
    if (open) inputRef.current?.focus();
  }, [open]);

  const handleNewChat = () => {
    setMessages([]);
    setInput("");
  };

  const sendMessage = useCallback(async (text?: string) => {
    const msgText = (text || input).trim();
    if (!msgText || isLoading) return;

    const userMsg: Msg = { role: "user", content: msgText };
    const allMessages = [...messages, userMsg];
    setMessages(allMessages);
    setInput("");
    setIsLoading(true);

    try {
      const response = await fetch(CHAT_URL, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          apikey: import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY,
        },
        body: JSON.stringify({
          messages: allMessages.map((message) => ({ role: message.role, content: message.content })),
          mode: isAdmin ? "admin" : "citizen",
        }),
      });

      const payload = await response.json().catch(() => ({}));

      if (!response.ok) {
        throw new Error(payload?.error || `Error ${response.status}`);
      }

      const assistantText = typeof payload?.text === "string" && payload.text.trim().length > 0
        ? payload.text
        : "I could not generate a response right now.";

      setMessages((prev) => [
        ...prev,
        { role: "assistant", content: assistantText },
      ]);
    } catch (err: any) {
      const message = err?.message || "Failed to get response. Please try again.";
      setMessages((prev) => [
        ...prev,
        { role: "assistant", content: `Warning: ${message}` },
      ]);
    } finally {
      setIsLoading(false);
    }
  }, [input, isLoading, messages, isAdmin]);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  };

  const isEmptyChat = messages.length === 0;

  const panelClasses = expanded
    ? "fixed inset-0 z-50 bg-background flex flex-col"
    : "fixed bottom-0 right-0 md:bottom-6 md:right-6 z-50 w-full h-[100dvh] md:w-[440px] md:h-[600px] md:rounded-2xl bg-background border border-border shadow-2xl flex flex-col overflow-hidden";

  return (
    <>
      <AnimatePresence>
        {!open && (
          <motion.button
            initial={{ scale: 0 }}
            animate={{ scale: 1 }}
            exit={{ scale: 0 }}
            onClick={() => setOpen(true)}
            className="fixed bottom-4 right-4 md:bottom-6 md:right-6 z-50 w-14 h-14 rounded-full bg-primary text-primary-foreground shadow-lg hover:brightness-110 transition-all flex items-center justify-center group"
          >
            <MessageCircle className="w-6 h-6 group-hover:scale-110 transition-transform" />
          </motion.button>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0, y: 20, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 20, scale: 0.95 }}
            transition={{ type: "spring", damping: 25, stiffness: 300 }}
            className={panelClasses}
          >
            <div className="px-4 py-3 border-b border-border bg-card/80 backdrop-blur-sm flex items-center justify-between flex-shrink-0">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center">
                  <Sparkles className="w-4 h-4 text-primary" />
                </div>
                <div>
                  <h3 className="font-heading font-semibold text-sm text-foreground flex items-center gap-1.5">
                    CiviGuard AI
                    {isAdmin && (
                      <span className="px-1.5 py-0.5 rounded text-[9px] bg-primary/20 text-primary flex items-center gap-0.5">
                        <Shield className="w-2.5 h-2.5" /> Admin
                      </span>
                    )}
                  </h3>
                  <p className="text-[10px] text-muted-foreground">
                    {isAdmin ? "Operational intelligence - Reports and verified news only" : "Infrastructure intelligence - Grounded in live evidence"}
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-1">
                <button onClick={handleNewChat} className="p-1.5 rounded-lg hover:bg-secondary transition-colors" title="New chat">
                  <RotateCcw className="w-4 h-4 text-muted-foreground" />
                </button>
                <button onClick={() => setExpanded(!expanded)} className="p-1.5 rounded-lg hover:bg-secondary transition-colors hidden md:flex" title={expanded ? "Minimize" : "Expand"}>
                  {expanded ? <Minimize2 className="w-4 h-4 text-muted-foreground" /> : <Maximize2 className="w-4 h-4 text-muted-foreground" />}
                </button>
                <button onClick={() => { setOpen(false); setExpanded(false); }} className="p-1.5 rounded-lg hover:bg-secondary transition-colors">
                  <X className="w-4 h-4 text-muted-foreground" />
                </button>
              </div>
            </div>

            <div ref={scrollRef} className="flex-1 overflow-y-auto">
              {isEmptyChat ? (
                <WelcomeScreen onPromptClick={(prompt) => sendMessage(prompt)} isAdmin={isAdmin} />
              ) : (
                <div className={cn("py-4 space-y-1", expanded ? "max-w-3xl mx-auto px-4" : "px-4")}>
                  {messages.map((msg, i) => (
                    <ChatMessage key={i} msg={msg} />
                  ))}
                  {isLoading && messages[messages.length - 1]?.role === "user" && (
                    <div className="flex gap-3 py-3">
                      <div className="w-7 h-7 rounded-lg bg-primary/10 flex items-center justify-center flex-shrink-0 mt-0.5">
                        <Bot className="w-4 h-4 text-primary" />
                      </div>
                      <div className="flex items-center gap-1.5 text-muted-foreground text-sm pt-1">
                        <Loader2 className="w-4 h-4 animate-spin" />
                        <span>Analyzing data...</span>
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>

            <div className={cn("border-t border-border bg-card/50 flex-shrink-0 p-3", expanded && "max-w-3xl mx-auto w-full")}>
              <form
                onSubmit={(e) => { e.preventDefault(); sendMessage(); }}
                className="relative"
              >
                <textarea
                  ref={inputRef}
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  onKeyDown={handleKeyDown}
                  placeholder="Ask about reports or verified infrastructure news..."
                  rows={1}
                  className="w-full resize-none px-4 py-3 pr-12 rounded-xl bg-secondary border border-border text-foreground text-sm focus:ring-2 focus:ring-primary/50 outline-none placeholder:text-muted-foreground min-h-[44px] max-h-[120px]"
                  disabled={isLoading}
                  style={{ height: "44px" }}
                  onInput={(e) => {
                    const el = e.target as HTMLTextAreaElement;
                    el.style.height = "44px";
                    el.style.height = Math.min(el.scrollHeight, 120) + "px";
                  }}
                />
                <button
                  type="submit"
                  disabled={isLoading || !input.trim()}
                  className="absolute right-2 bottom-2 p-2 rounded-lg bg-primary text-primary-foreground hover:brightness-110 transition-all disabled:opacity-40 disabled:cursor-not-allowed"
                >
                  <Send className="w-4 h-4" />
                </button>
              </form>
              <p className="text-[10px] text-muted-foreground text-center mt-2">
                CiviGuard AI uses citizen reports and verified news only.
              </p>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
};

const WelcomeScreen = ({ onPromptClick, isAdmin }: { onPromptClick: (prompt: string) => void; isAdmin: boolean }) => (
  <div className="flex flex-col items-center justify-center h-full px-6 py-8">
    <div className="w-14 h-14 rounded-2xl bg-primary/10 flex items-center justify-center mb-4">
      <Sparkles className="w-7 h-7 text-primary" />
    </div>
    <h2 className="font-heading text-xl font-bold text-foreground mb-1">CiviGuard AI</h2>
    <p className="text-sm text-muted-foreground text-center mb-2 max-w-xs">
      {isAdmin
        ? "Operational intelligence mode. Ask about report trends, hotspot evidence, source reliability, and verified news."
        : "Your infrastructure assistant. I analyze citizen reports and verified Kenya news to help you stay informed."}
    </p>
    <div className="flex items-center gap-1.5 text-[10px] text-muted-foreground mb-6">
      <span className="w-2 h-2 rounded-full bg-safe animate-pulse" />
      Grounded in live data - Sources cited - Confidence shown
    </div>
    <div className="grid grid-cols-2 gap-2 w-full max-w-sm">
      {SUGGESTED_PROMPTS.map((item, i) => (
        <button
          key={i}
          onClick={() => onPromptClick(item.prompt)}
          className="flex items-start gap-2 p-3 rounded-xl border border-border bg-card hover:bg-secondary/80 transition-colors text-left group"
        >
          <span className="text-lg leading-none mt-0.5">{item.icon}</span>
          <span className="text-xs text-muted-foreground group-hover:text-foreground transition-colors leading-tight">{item.label}</span>
        </button>
      ))}
    </div>
  </div>
);

const ChatMessage = ({ msg }: { msg: Msg }) => {
  const isUser = msg.role === "user";

  return (
    <div className={cn("flex gap-3 py-3", isUser && "flex-row-reverse")}>
      <div className={cn(
        "w-7 h-7 rounded-lg flex items-center justify-center flex-shrink-0 mt-0.5",
        isUser ? "bg-primary" : "bg-primary/10",
      )}>
        {isUser ? (
          <User className="w-4 h-4 text-primary-foreground" />
        ) : (
          <Bot className="w-4 h-4 text-primary" />
        )}
      </div>
      <div className={cn("flex-1 min-w-0", isUser && "text-right")}>
        <div className={cn(
          "inline-block text-sm rounded-2xl px-4 py-2.5 max-w-[90%]",
          isUser
            ? "bg-primary text-primary-foreground rounded-tr-sm text-left"
            : "bg-secondary text-foreground rounded-tl-sm",
        )}>
          {isUser ? (
            <p className="whitespace-pre-wrap">{msg.content}</p>
          ) : (
            <div className="prose prose-sm dark:prose-invert max-w-none [&_p]:my-1 [&_ul]:my-1 [&_ol]:my-1 [&_li]:my-0.5 [&_h1]:text-base [&_h2]:text-sm [&_h3]:text-sm [&_strong]:text-foreground [&_code]:text-xs [&_code]:bg-background/50 [&_code]:px-1 [&_code]:rounded">
              <ReactMarkdown>{msg.content}</ReactMarkdown>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default Chatbot;
