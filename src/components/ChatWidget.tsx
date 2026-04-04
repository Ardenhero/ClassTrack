"use client";

import { useState, useRef, useEffect } from "react";
import { MessageCircle, X, Send, Loader2, Trash2, Bot } from "lucide-react";
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';

type ChatMessage = { id: string; role: string; content: string };

const MAX_CHARS = 500;

const WELCOME: ChatMessage = {
    id: '1', role: 'assistant',
    content: 'Hi there! I am the **ClassTrack AI Assistant**. How can I help you today? I can assist with attendance questions, portal features, or technical support.'
};

export function ChatWidget() {
    const [isOpen, setIsOpen] = useState(false);
    const messagesEndRef = useRef<HTMLDivElement>(null);
    const [localInput, setLocalInput] = useState("");
    const [messages, setMessages] = useState<ChatMessage[]>([WELCOME]);
    const [isLoading, setIsLoading] = useState(false);
    const [didHydrate, setDidHydrate] = useState(false);
    const [remaining, setRemaining] = useState<number | null>(null);
    const [limit, setLimit] = useState<number>(10);

    // Load chat history from localStorage on first mount
    useEffect(() => {
        try {
            const saved = localStorage.getItem("classtrack_chat_v1");
            if (saved) {
                const parsed = JSON.parse(saved);
                if (Array.isArray(parsed) && parsed.length > 0) setMessages(parsed);
            }
        } catch { /* ignore */ }
        setDidHydrate(true);
    }, []);

    // Persist whenever messages change (after hydration)
    useEffect(() => {
        if (didHydrate) localStorage.setItem("classtrack_chat_v1", JSON.stringify(messages));
    }, [messages, didHydrate]);

    const clearChat = () => {
        if (confirm("Are you sure you want to clear your chat history?")) {
            setMessages([WELCOME]);
            localStorage.setItem("classtrack_chat_v1", JSON.stringify([WELCOME]));
        }
    };

    const handleManualSubmit = async (e?: React.FormEvent) => {
        if (e) e.preventDefault();
        if (!localInput.trim() || isLoading || localInput.length > MAX_CHARS) return;

        const userMessage = { id: Date.now().toString(), role: 'user', content: localInput };
        setMessages((prev) => [...prev, userMessage]);
        setLocalInput("");
        setIsLoading(true);

        try {
            // Refine messages to only include role and content for AI SDK compatibility
            const refinedMessages = messages.map(({ role, content }) => ({ role, content }));
            const currentMessage = { role: 'user', content: localInput };

            const response = await fetch('/api/chat', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ messages: [...refinedMessages, currentMessage] })
            });

            // Capture rate limit info from headers (Synced with Chat-10 Guard)
            const remainingHeader = response.headers.get('X-RateLimit-Remaining');
            const limitHeader = response.headers.get('X-RateLimit-Limit');
            
            if (remainingHeader) setRemaining(parseInt(remainingHeader));
            if (limitHeader) setLimit(parseInt(limitHeader));

            if (!response.ok) {
                const errorData = await response.json().catch(() => ({}));
                throw new Error(errorData.error || response.statusText);
            }

            const reader = response.body?.getReader();
            const decoder = new TextDecoder();

            if (reader) {
                const assistantMessageId = (Date.now() + 1).toString();
                setMessages((prev) => [...prev, { id: assistantMessageId, role: 'assistant', content: '' }]);

                while (true) {
                    const { done, value } = await reader.read();
                    if (done) break;

                    const chunk = decoder.decode(value, { stream: true });

                    setMessages((prev) => prev.map(msg =>
                        msg.id === assistantMessageId
                            ? { ...msg, content: msg.content + chunk }
                            : msg
                    ));
                }
            }
        } catch (err: unknown) {
            const error = err as Error;
            console.error(error);
            let errorMessage = "Actually, I ran into a bit of trouble connecting to my brain. Please try again in a moment!";
            
            if (error.message === "API Key missing on server") {
                errorMessage = "My AI key is missing on the server! Please add GOOGLE_GENERATIVE_AI_API_KEY to Vercel Settings.";
            } else if (error.message) {
                errorMessage = `Brain Error: ${error.message}`;
            }
            
            setMessages((prev) => [...prev, { 
                id: Date.now().toString(), 
                role: 'assistant', 
                content: errorMessage 
            }]);
        } finally {
            setIsLoading(false);
        }
    };

    // Auto-scroll to bottom
    useEffect(() => {
        if (isOpen) {
            messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
        }
    }, [messages, isOpen]);

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const mdComponents: any = {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        code({ inline, className, children, ...props }: any) {
            const lang = /language-(\w+)/.exec(className || '')?.[1];

            if (!inline && lang) {
                return (
                    <div className="mt-2 mb-2 bg-gray-900 rounded-lg overflow-hidden border border-gray-700 text-[12px]">
                        <div className="px-3 py-1 bg-gray-800 border-b border-gray-700 text-[10px] text-gray-400 font-mono uppercase">{lang}</div>
                        <pre className="p-3 m-0 overflow-x-auto"><code className={className} {...props}>{children}</code></pre>
                    </div>
                );
            }
            return <code className="bg-gray-100 dark:bg-gray-800 px-1.5 py-0.5 rounded text-nwu-red text-[13px] font-mono" {...props}>{children}</code>;
        }
    };

    return (
        <div className="fixed bottom-6 right-6 z-[9999] flex flex-col items-end">
            {isOpen && (
                <div className="mb-4 w-80 sm:w-[400px] h-[520px] bg-white dark:bg-gray-950 rounded-2xl shadow-2xl border border-gray-200 dark:border-gray-800 flex flex-col overflow-hidden animate-in slide-in-from-bottom-5">
                    {/* Header */}
                    <div className="bg-nwu-red p-4 text-white flex justify-between items-center shadow-lg">
                        <div className="flex items-center gap-3">
                            <div className="p-2 bg-white/10 rounded-lg backdrop-blur-sm">
                                <Bot className="h-5 w-5" />
                            </div>
                            <div>
                                <h3 className="font-bold text-sm">ClassTrack AI</h3>
                                <div className="flex items-center gap-1">
                                    <div className="h-1.5 w-1.5 bg-green-400 rounded-full animate-pulse" />
                                    <span className="text-[10px] text-white/70 uppercase font-medium">Online</span>
                                </div>
                            </div>
                        </div>
                        <div className="flex items-center gap-1">
                            {messages.length > 1 && (
                                <button onClick={clearChat} title="Clear History"
                                    className="text-white/80 hover:text-white p-2 rounded-lg hover:bg-white/10 transition-all active:scale-90">
                                    <Trash2 className="h-4 w-4" />
                                </button>
                            )}
                            <button onClick={() => setIsOpen(false)}
                                className="text-white/80 hover:text-white p-2 rounded-lg hover:bg-white/10 transition-all active:scale-90">
                                <X className="h-5 w-5" />
                            </button>
                        </div>
                    </div>

                    {/* Messages */}
                    <div className="flex-1 p-4 overflow-y-auto bg-gray-50/30 dark:bg-gray-950/30 flex flex-col gap-4 scrollbar-thin scrollbar-thumb-gray-200 dark:scrollbar-thumb-gray-800">
                        {messages.map((msg) => (
                            <div
                                key={msg.id}
                                className={`max-w-[85%] p-3.5 rounded-2xl text-[13.5px] shadow-sm ${msg.role === 'user'
                                    ? 'bg-nwu-red text-white self-end rounded-br-sm'
                                    : 'bg-white dark:bg-gray-900 text-gray-800 dark:text-gray-200 border border-gray-100 dark:border-gray-800 self-start rounded-bl-sm'
                                    }`}
                            >
                                <div className="prose dark:prose-invert prose-sm max-w-none m-0 leading-relaxed font-normal">
                                    <ReactMarkdown remarkPlugins={[remarkGfm]} components={mdComponents}>
                                        {msg.content}
                                    </ReactMarkdown>
                                </div>
                            </div>
                        ))}
                        {isLoading && messages[messages.length - 1]?.role === 'user' && (
                            <div className="bg-white dark:bg-gray-900 border border-gray-100 dark:border-gray-800 self-start p-3 rounded-2xl rounded-bl-sm shadow-sm flex gap-2 items-center text-sm">
                                <Loader2 className="h-3.5 w-3.5 animate-spin text-nwu-red" />
                                <span className="text-gray-500 text-xs font-medium italic">Thinking...</span>
                            </div>
                        )}
                        <div ref={messagesEndRef} />
                    </div>

                    {/* Input */}
                    <div className="p-4 bg-white dark:bg-gray-950 border-t border-gray-100 dark:border-gray-800">
                        <form onSubmit={handleManualSubmit} className="flex items-center gap-2">
                            <input
                                type="text"
                                value={localInput}
                                onChange={(e) => setLocalInput(e.target.value)}
                                placeholder="Ask about ClassTrack..."
                                disabled={isLoading}
                                maxLength={MAX_CHARS}
                                className="flex-1 bg-gray-100 dark:bg-gray-900 border-none rounded-xl px-4 py-2.5 text-sm focus:ring-2 focus:ring-nwu-red text-gray-900 dark:text-white disabled:opacity-50 placeholder:text-gray-400 dark:placeholder:text-gray-600"
                            />
                            <button type="submit" disabled={!localInput.trim() || isLoading || localInput.length > MAX_CHARS}
                                className="p-2.5 bg-nwu-red hover:bg-[#5d0d0f] disabled:opacity-30 disabled:hover:bg-nwu-red text-white rounded-xl transition-all flex-shrink-0 active:scale-95 shadow-md">
                                {isLoading ? <Loader2 className="h-5 w-5 animate-spin" /> : <Send className="h-5 w-5" />}
                            </button>
                        </form>
                        <p className="text-[10px] text-center text-gray-400 mt-2 font-medium">Powered by ClassTrack Intelligence</p>
                        <div className="flex justify-between items-center mt-2 px-1">
                            {localInput.length > MAX_CHARS * 0.8 && (
                                <p className={`text-[9px] font-bold px-2 py-0.5 rounded-full border ${localInput.length > MAX_CHARS ? 'text-red-500 bg-red-50 border-red-200' : 'text-gray-400 bg-gray-50 border-gray-200'}`}>
                                    {localInput.length}/{MAX_CHARS}
                                </p>
                            )}
                            {remaining !== null && (
                                <p className="text-[9px] font-bold text-nwu-red bg-nwu-red/5 px-2 py-0.5 rounded-full border border-nwu-red/10 ml-auto">
                                    {remaining} / {limit} Left Today
                                </p>
                            )}
                        </div>
                    </div>
                </div>
            )}

            {/* FAB */}
            <button
                onClick={() => setIsOpen(!isOpen)}
                className={`flex items-center justify-center h-14 w-14 rounded-2xl shadow-[0_8px_30px_rgb(0,0,0,0.12)] transition-all duration-300 hover:scale-110 active:scale-95 relative overflow-hidden group ${isOpen
                    ? 'bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-300'
                    : 'bg-nwu-red text-white'
                    }`}
            >
                {isOpen ? (
                    <X className="h-6 w-6 relative z-10" />
                ) : (
                    <>
                        <div className="absolute inset-0 bg-gradient-to-tr from-black/20 to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
                        <MessageCircle className="h-7 w-7 relative z-10" />
                    </>
                )}
            </button>
        </div>
    );
}
