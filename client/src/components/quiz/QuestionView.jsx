export default function QuestionView({ question, value, onChange }) {
  return (
    <div>
      <h2 className="quiz-prompt">{question.prompt}</h2>
      {question.code && (
        <pre className="quiz-code">
          <code>{question.code}</code>
        </pre>
      )}

      {question.type === 'choice' ? (
        <fieldset className="quiz-options">
          <legend className="visually-hidden">Choose one answer</legend>
          {question.options.map((option, i) => (
            <label key={i} className={`quiz-option${value === i ? ' is-selected' : ''}`}>
              <input type="radio" name={question.id} checked={value === i} onChange={() => onChange(i)} />
              <span>{option}</span>
            </label>
          ))}
        </fieldset>
      ) : (
        <div className="quiz-fill">
          <label htmlFor={`fill-${question.id}`}>Your answer (replaces the blank ____)</label>
          <input
            id={`fill-${question.id}`}
            type="text"
            className="form-control"
            value={value ?? ''}
            maxLength={200}
            autoComplete="off"
            autoCapitalize="off"
            spellCheck={false}
            onChange={(e) => onChange(e.target.value)}
          />
        </div>
      )}
    </div>
  );
}
