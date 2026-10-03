export function WelcomeScreen({ appName }: { appName: string }) {
  return (
    <div className="app-shell">
      <header className="app-header">
        <span className="brand-icon" aria-hidden="true">m</span>
        <span className="brand-name">{appName}</span>
        <span className="version">Early development</span>
      </header>
      <main id="main-content">
        <section className="welcome" aria-labelledby="welcome-title">
          <p className="eyebrow">Your time, with intention</p>
          <h1 id="welcome-title">A place to plan your day<br className="desktop-break" /> and understand your time.</h1>
          <p className="intro">Welcome to {appName}. We’re building your personal workspace, one feature at a time.</p>
          <div className="next-feature">
            <span className="step-number" aria-hidden="true">01</span>
            <div>
              <p className="feature-label">Coming next</p>
              <h2>Tasks</h2>
              <p>Create a task, keep your notes together, and come back to it when you’re ready.</p>
            </div>
          </div>
          <p className="availability">Task creation and time tracking are not available yet.</p>
        </section>
      </main>
      <footer>Personal planning. Manual time tracking. No account required.</footer>
    </div>
  )
}
