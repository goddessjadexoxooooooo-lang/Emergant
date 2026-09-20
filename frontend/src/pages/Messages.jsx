import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import api from "@/lib/api";
import ChatThread from "@/components/ChatThread";

export default function Messages() {
  const navigate = useNavigate();
  const [messages, setMessages] = useState([]);

  useEffect(() => { api.get("/messages").then((r) => setMessages(r.data.messages)); }, []);

  const send = async (text) => {
    const { data } = await api.post("/messages", { text });
    setMessages((prev) => [...prev, data.message]);
  };

  return <ChatThread messages={messages} currentRole="fan" onSend={send} onBack={() => navigate("/dashboard")} title="Messages" />;
}
