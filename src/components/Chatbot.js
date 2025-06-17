import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useVirtualizer } from '@tanstack/react-virtual';
import { useDebounce } from '../hooks/useDebounce';
import { encrypt, decrypt } from '../utils/encryption';
import Message from './Message';
import questions from '../questions.json';
import '../styles/chatbot.css';

export default function Chatbot() {
  const [userInput, setUserInput] = useState('');
  const [conversation, setConversation] = useState([]);
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [currentQuestionIndex, setCurrentQuestionIndex] = useState(0);
  const [quizStarted, setQuizStarted] = useState(false);
  const [isConversing, setIsConversing] = useState(false);
  const [savedResponses, setSavedResponses] = useState({});
  const [feedback, setFeedback] = useState(null);

  const containerRef = useRef(null);
  const conversationEndRef = useRef(null);
  const parentRef = useRef(null);

  // Add CSS variables for styling
  useEffect(() => {
    const root = document.documentElement;
    root.style.setProperty('--primary-color', '#3b82f6');
    root.style.setProperty('--primary-dark', '#2563eb');
    root.style.setProperty('--background', '#f9fafb');
    root.style.setProperty('--text', '#1f2937');
    root.style.setProperty('--border', '#e5e7eb');
    root.style.setProperty('--error', '#ef4444');
    root.style.setProperty('--success', '#22c55e');

    if (window.matchMedia('(prefers-color-scheme: dark)').matches) {
      root.style.setProperty('--background', '#1f2937');
      root.style.setProperty('--text', '#f9fafb');
      root.style.setProperty('--border', '#374151');
      root.style.setProperty('--error', '#f87171');
      root.style.setProperty('--success', '#34d399');
    }

    return () => {
      // Reset styles on unmount
      root.style.removeProperty('--primary-color');
      root.style.removeProperty('--primary-dark');
      root.style.removeProperty('--background');
      root.style.removeProperty('--text');
      root.style.removeProperty('--border');
      root.style.removeProperty('--error');
      root.style.removeProperty('--success');
    };
  }, []);

  const getMessageRole = (message) => 
    message.role === 'user' ? 'user' : 'assistant';

  const saveResponse = (questionId, response) => {
    setSavedResponses(prev => ({
      ...prev,
      [questionId]: {
        question: questions[questionId].question,
        response,
        timestamp: new Date().toISOString(),
        insights: []
      }
    }));
  };

  const rowVirtualizer = useVirtualizer({
    count: conversation.length,
    getScrollElement: () => parentRef.current,
    estimateSize: () => 60,
    overscan: 5,
  });

  const debouncedSend = useDebounce(async () => {
    if (!userInput.trim() || isLoading) return;

    const userMessage = { role: 'user', content: userInput, questionId: currentQuestionIndex };
    setConversation(prev => [...prev, userMessage]);
    setUserInput('');
    setError('');
    setIsLoading(true);

    try {
      const payload = {
        model: "gpt-4",
        messages: [{ role: "user", content: userInput }],
      };

      const res = await fetch("/api/chat", {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify(payload)
      });

      if (!res.ok) {
        throw new Error(`Server error: ${res.status} ${res.statusText}`);
      }

      const data = await res.json();

      if (!data.choices || !data.choices[0]?.message?.content) {
        throw new Error("Malformed response from server");
      }

      setConversation(prev => [...prev, data.choices[0].message]);
      saveResponse(currentQuestionIndex, userInput);

      conversationEndRef.current?.scrollIntoView({
        behavior: "smooth",
        block: "end"
      });

    } catch (err) {
      console.error("Error:", err);
      setError(err.message || "Failed to fetch response.");
      setConversation(prev => {
        const index = prev.findIndex(m => m.role === 'user' && m.content === userInput);
        if (index !== -1) {
          return [...prev.slice(0, index), userMessage];
        }
        return prev;
      });
    } finally {
      setIsLoading(false);
    }
  }, 500);

  const handleExport = () => {
    const formattedData = {
      quizName: "Personal Growth Quiz",
      completionDate: new Date().toISOString(),
      responses: Object.entries(savedResponses).map(([id, response]) => ({
        question: response.question,
        response: response.response,
        insights: response.insights,
        timestamp: response.timestamp
      }))
    };

    // Download as JSON
    const dataStr = JSON.stringify(formattedData, null, 2);
    const blob = new Blob([dataStr], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `personal-growth-quiz-${new Date().toISOString()}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);

    setFeedback({
      message: 'Data exported successfully',
      type: 'info'
    });
  };

  const clearConversation = () => {
    setConversation([]);
    setCurrentQuestionIndex(0);
    setQuizStarted(false);
    setIsConversing(false);
    setSavedResponses({});

    const announcement = document.createElement('div');
    announcement.setAttribute('aria-live', 'assertive');
    announcement.style.position = 'absolute';
    announcement.style.left = '-9999px';
    announcement.textContent = 'Conversation cleared';
    containerRef.current?.appendChild(announcement);
    setTimeout(() => announcement.remove(), 1000);
  };

  useEffect(() => {
    if (quizStarted && !isConversing && currentQuestionIndex < questions.length) {
      const question = questions[currentQuestionIndex].question;
      const questionMessage = { role: 'assistant', type: 'question', content: question, questionId: currentQuestionIndex };
      setConversation(prev => [...prev, questionMessage]);
    }
  }, [quizStarted, currentQuestionIndex, isConversing]);

  useEffect(() => {
    conversationEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [conversation]);

  useEffect(() => {
    return () => {
      localStorage.removeItem('session_data');
    };
  }, []);

  const handleKeyDown = useCallback((event) => {
    if (event.key === 'Enter' && !event.shiftKey) {
      event.preventDefault();
      debouncedSend();
    } else if (event.key === 'Escape') {
      setUserInput('');
    } else if (event.key === 'Backspace' && event.ctrlKey) {
      clearConversation();
    }
  }, [debouncedSend]);

  useEffect(() => {
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [handleKeyDown]);

  return (
    <div ref={containerRef} className="chatbot-container">
      <div className="chat-header">
        <h1>Personal Growth Quiz</h1>
        <div className="header-actions">
          <button onClick={clearConversation} className="clear-button">
            Clear Conversation
          </button>
          <button onClick={handleExport} className="export-button">
            Export Data
          </button>
        </div>
      </div>

      <div className="chat-messages" ref={parentRef}>
        {rowVirtualizer.virtualItems.map((virtualItem) => (
          <Message
            key={virtualItem.key}
            message={conversation[virtualItem.index]}
            role={getMessageRole(conversation[virtualItem.index])}
            index={virtualItem.index}
            style={{
              transform: `translateY(${virtualItem.start}px)`
            }}
          />
        ))}
        <div ref={conversationEndRef} />
      </div>

      <div className="chat-input">
        <textarea
          value={userInput}
          onChange={(e) => setUserInput(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="Type your response..."
          disabled={isLoading}
          className="input-textarea"
          aria-label="Type your response"
        />
        <button
          onClick={debouncedSend}
          disabled={!userInput.trim() || isLoading}
          className="send-button"
        >
          {isLoading ? 'Sending...' : 'Send'}
        </button>
      </div>

      {error && (
        <div className="error-message" role="alert">
          {error}
        </div>
      )}

      {feedback && (
        <div className="feedback-message" role="status">
          {feedback.message}
        </div>
      )}
    </div>
  );
}
