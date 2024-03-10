// eslint-disable-next-line no-unused-vars
import React, { useState, useEffect, useRef } from 'react';
import { Spinner } from 'react-bootstrap';
import './App.css';

function App() {
    const [query, setQuery] = useState('');
    const [chatHistory, setChatHistory] = useState([]);
    const [isLoading, setIsLoading] = useState(false);
    const chatHistoryRef = useRef(null);

    useEffect(() => {
        const savedChatHistory = localStorage.getItem('chatHistory');
        if (savedChatHistory) {
            setChatHistory(JSON.parse(savedChatHistory));
        }
    }, []);

    useEffect(() => {
        if (chatHistoryRef.current) {
            chatHistoryRef.current.scrollTop = chatHistoryRef.current.scrollHeight;
        }
    }, [chatHistory]);

    const handleSubmit = async (event) => {
        event.preventDefault();

        if (query.trim() === '') {
            return;
        }

        if (isLoading) {
            return;
        }

        setIsLoading(true);

        try {
            const updatedChatHistory = [...chatHistory, ["User", query]];

            // Voeg prompt engineering toe
            const engineeredQuery = `You are an AR expert. Answer the following question: ${query} as short as you can.`;

            const response = await fetch('https://prg8.baruchgeuze.nl/api/chat', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'access-control-allow-headers': 'Origin, Content-Type, Accept',
                    'Accept': 'application/json',
                    'access-control-allow-origin': '*'
                },
                body: JSON.stringify({
                    query: engineeredQuery
                })
            });

            if (response.ok) {
                const data = await response.json();
                const updatedHistoryWithBotResponse = [...updatedChatHistory];
                if (data.response.startsWith("Bot:")) {
                    updatedHistoryWithBotResponse.push(["Bot", data.response.slice(4)]);
                } else {
                    updatedHistoryWithBotResponse.push(["Bot", data.response]);
                }
                setChatHistory(updatedHistoryWithBotResponse);
                localStorage.setItem('chatHistory', JSON.stringify(updatedHistoryWithBotResponse));
                setQuery('');
            } else {
                console.error('Failed to send request');
            }
        } catch (error) {
            console.error('Error:', error);
        } finally {
            setIsLoading(false);
        }
    };

    const handleChange = (event) => {
        setQuery(event.target.value);
    };

    return (
        <div className="app-container">
            <h1 className="app-title">AR Brainstormer</h1>
            <div ref={chatHistoryRef} className="chat-history">
                {chatHistory.map((message, index) => (
                    <div key={index} className="chat-message">
                        <strong>{message[0]}</strong>{message[1]}
                    </div>
                ))}
            </div>
            <form onSubmit={handleSubmit} className="chat-form">
                <input
                    type="text"
                    value={query}
                    onChange={handleChange}
                    placeholder="Ask me anything about Lens Studio!"
                    className="chat-input"
                />
                <div className="button-container">
                    <button type="submit" className="submit-button" disabled={isLoading}>
                        {isLoading ? (
                            <Spinner animation="border" size="sm" role="status" aria-hidden="true"/>
                        ) : (
                            'Send'
                        )}
                    </button>
                </div>
            </form>
        </div>
    );
}

export default App;