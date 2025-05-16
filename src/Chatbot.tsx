import { useState, useEffect, useRef } from 'react';
import axios from 'axios';
import { v4 as uuidv4 } from 'uuid';
import { Bot, SendHorizontal } from 'lucide-react';

interface Message {
    id: string;
    sender: 'user' | 'assistant';
    content: string;
    type: 'text' | 'plugin';
    pluginName?: string;
    pluginData?: any;
    timestamp: string;
}

const Chatbot = () => {
    const [messages, setMessages] = useState<Message[]>(() => {
        const saved = localStorage.getItem('chatMessages');
        return saved ? JSON.parse(saved) : [];
    });
    const [input, setInput] = useState<string>('');
    const [loading, setLoading] = useState<boolean>(false);
    const messagesEndRef = useRef<HTMLDivElement | null>(null);

    useEffect(() => {
        localStorage.setItem('chatMessages', JSON.stringify(messages));
        messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }, [messages]);

    const createMessage = (sender: 'user' | 'assistant', content: string, type: 'text' | 'plugin', pluginName?: string, pluginData?: any): Message => {
        return {
            id: uuidv4(),
            sender,
            content,
            type,
            pluginName,
            pluginData,
            timestamp: new Date().toISOString()
        };
    };

    const parseNaturalLanguage = (text: string): string | null => {
        const lower = text.toLowerCase();
        if (lower.includes('weather in')) {
            const city = lower.split('weather in')[1]?.trim().replace(/[?.,]/g, '');
            return `/weather ${city}`;
        } else if (lower.startsWith('what is') || lower.startsWith('calculate')) {
            const expression = text.replace(/what is|calculate/gi, '').trim();
            return `/calc ${expression}`;
        } else if (lower.startsWith('define') || lower.startsWith('what does')) {
            const word = text.replace(/define|what does|mean/gi, '').trim().replace(/[?.,]/g, '');
            return `/define ${word}`;
        }
        return null;
    };

    const handleSend = async () => {
        if (!input.trim()) return;
        const userMessage = createMessage('user', input, 'text');
        setMessages(prev => [...prev, userMessage]);
        setInput('');
        setLoading(true);

        const loadingMsg: Message = createMessage('assistant', 'Typing...', 'text');
        setMessages(prev => [...prev, loadingMsg]);

        setTimeout(async () => {
            setMessages(prev => prev.filter(msg => msg.id !== loadingMsg.id));
            let command = input.trim();
            const parsed = parseNaturalLanguage(command);
            if (parsed) command = parsed;

            if (command.startsWith('/weather')) {
                const city = command.replace('/weather', '').trim();
                if (!city) {
                    setMessages(prev => [...prev, createMessage('assistant', 'Please provide a city.', 'text')]);
                    setLoading(false);
                    return;
                }
                try {
                    const res = await axios.get(`https://api.openweathermap.org/data/2.5/weather?q=${city}&units=metric&appid=f23af85998c654884e8ba4b7a555ebf0
`);
                    const weather = res.data;
                    const content = `Weather in ${city}: ${weather.weather[0].description}, ${weather.main.temp}°C`;
                    const pluginMsg = createMessage('assistant', content, 'plugin', 'weather', weather);
                    setMessages(prev => [...prev, pluginMsg]);
                } catch {
                    setMessages(prev => [...prev, createMessage('assistant', 'City not found or API error.', 'text')]);
                }
            } else if (command.startsWith('/calc')) {
                try {
                    const expression = command.replace('/calc', '').trim();
                    const result = Function(`"use strict";return (${expression})`)();
                    const pluginMsg = createMessage('assistant', `Result: ${result}`, 'plugin', 'calc', result);
                    setMessages(prev => [...prev, pluginMsg]);
                } catch {
                    setMessages(prev => [...prev, createMessage('assistant', 'Invalid expression', 'text')]);
                }
            } else if (command.startsWith('/define')) {
                const word = command.replace('/define', '').trim();
                try {
                    const res = await axios.get(`https://api.dictionaryapi.dev/api/v2/entries/en/${word}`);
                    const definition = res.data[0]?.meanings[0]?.definitions[0]?.definition || 'Definition not found';
                    const pluginMsg = createMessage('assistant', `Definition of ${word}: ${definition}`, 'plugin', 'define', res.data);
                    setMessages(prev => [...prev, pluginMsg]);
                } catch {
                    setMessages(prev => [...prev, createMessage('assistant', 'Error fetching definition', 'text')]);
                }
            } else {
                setMessages(prev => [...prev, createMessage('assistant', 'Unrecognized command.', 'text')]);
            }

            setLoading(false);
        }, 2000);
    };

    const handleKeyPress = (e: React.KeyboardEvent<HTMLInputElement>) => {
        if (e.key === 'Enter') handleSend();
    };
    return (
        <div className='bg-gray-200 h-screen'>
            <div className="fixed bottom-4 right-4 sm:w-100 w-full bg-white rounded-xl shadow-lg flex flex-col ">
                <div className='flex items-center gap-2 m-3'>
                    <p className='bg-purple-950 flex items-center justify-center rounded-full min-h-[35px] min-w-[35px]'>
                        <Bot size={20} color='#fff' />
                    </p>
                    <p className='font-medium '>AI-powered chatbot</p>
                </div>
                
                <div className="p-4 overflow-y-auto flex-1 space-y-2 min-h-[500px] max-h-[500px]">
                    {messages.length == 0 ? <p className='h-full flex items-center justify-center mt-20 text-gray-500'>No messages yet.</p> : messages.map((msg) => (
                        <div className='flex items-start gap-1'>
                            {msg.sender != "user" ? <p className='bg-purple-950 flex items-center justify-center rounded-full min-h-[25px] min-w-[25px]'>
                                <Bot size={16} color='#fff' />
                            </p> : null}
                            <div key={msg.id} className={`break-words px-4 py-2 rounded max-w-[80%] w-fit text-sm ${msg.sender === 'user' ? 'bg-blue-100 self-end text-right ml-auto' : 'bg-gray-100 self-start text-left mr-auto'}`}>
                                <div>{msg.content}</div>
                                <div className="text-xs text-gray-500 mt-1">{new Date(msg.timestamp).toLocaleTimeString()}</div>
                            </div>
                        </div>
                    ))}
                    <div ref={messagesEndRef} />
                </div>
                <div className="p-3 border-t border-t-gray-300 flex gap-2">
                    <input
                        value={input}
                        onChange={(e) => setInput(e.target.value)}
                        onKeyDown={handleKeyPress}
                        className="flex-1 p-2 rounded-xl border border-gray-300 outline-none"
                        placeholder="Type a message..."
                        disabled={loading}
                    />
                    <button disabled={loading} onClick={handleSend} className="bg-blue-700  hover:bg-blue-800 cursor-pointer rounded-full text-white p-2.5 min-h-[40px] min-w-[40px] flex items-center justify-center"><SendHorizontal size={16} /></button>
                </div>
            </div>
        </div>
    )
}

export default Chatbot
