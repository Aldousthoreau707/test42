import React from 'react';

export default function Message({ message, role, index, style }) {
  const isUser = role === 'user';
  const isQuestion = message.type === 'question';

  return (
    <div className={`message ${role}`} style={style}>
      <div className="message-content">
        {isQuestion ? (
          <div className="question-header">
            <span className="question-number">Question {index + 1}</span>
            <span className="question-score">Max Score: {message.maxScore || 10}</span>
          </div>
        ) : null}
        <p>{message.content}</p>
      </div>
    </div>
  );
}
