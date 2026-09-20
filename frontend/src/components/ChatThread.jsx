import { useState, useRef, useEffect } from "react";
import { ChevronLeft, Send } from "lucide-react";

function timeLabel(iso) {
  try { return new Date(iso).toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" }); }
  catch { return ""; }
}

export default function ChatThread({ messages, currentRole, onSend, onBack, title = "Messages" }) {
  const [text, setText] = useState("");
  const [sending, setSending] = useState(false);
  const endRef = useRef(null);
  const otherLabel = currentRole === "creator" ? "Fan" : "Jade";

  useEffect(() => { endRef.current?.scrollIntoView({ behavior: "smooth" }); }, [messages]);

  const submit = async (e) => {
    e.preventDefault();
    const t = text.trim();
    if (!t || sending) return;
    setSending(true);
    setText("");
    try { await onSend(t); } finally { setSending(false); }
  };

  return (
    <div className="fixed inset-0 z-50 mx-auto flex max-w-md flex-col bg-background">
      {/* header */}
      <div className="flex items-center gap-2 bg-gradient-to-r from-[#e14b7a] to-[#a3113f] px-4 py-4 text-white">
        <button data-testid="chat-back" onClick={onBack} className="grid h-9 w-9 place-items-center rounded-full hover:bg-white/15">
          <ChevronLeft className="h-6 w-6" />
        </button>
        <h1 className="flex-1 text-center font-display text-xl font-bold">💌 {title}</h1>
        <span className="w-9" />
      </div>

      {/* messages */}
      <div className="flex-1 space-y-4 overflow-y-auto px-5 py-6" data-testid="chat-messages">
        {messages.map((m) => {
          const mine = m.sender === currentRole;
          return (
            <div key={m.id} className={`flex flex-col ${mine ? "items-end" : "items-start"}`} data-testid={`chat-msg-${m.id}`}>
              <div className={`max-w-[80%] rounded-3xl px-5 py-3 text-[17px] leading-snug ${
                mine ? "bg-gradient-to-br from-[#e14b7a] to-[#c11a54] text-white shadow-jade" : "bg-card text-foreground shadow-jade"
              }`}>
                {m.text}
              </div>
              <p className="mt-1 px-2 text-xs text-muted-foreground">
                <span className="font-semibold text-foreground/70">{mine ? "You" : otherLabel}</span> {timeLabel(m.created_at)}
              </p>
            </div>
          );
        })}
        <div ref={endRef} />
      </div>

      {/* input */}
      <form onSubmit={submit} className="flex items-center gap-2.5 border-t border-border/60 px-4 py-3">
        <input
          data-testid="chat-input"
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder="Type a message…"
          className="h-12 flex-1 rounded-full border border-border bg-card px-5 text-base outline-none focus:border-primary"
        />
        <button data-testid="chat-send" type="submit" disabled={!text.trim() || sending}
          className="grid h-12 w-12 place-items-center rounded-2xl bg-gradient-to-br from-[#e14b7a] to-[#c11a54] text-white shadow-jade disabled:opacity-50">
          <Send className="h-5 w-5" />
        </button>
      </form>
    </div>
  );
}
