import { useState } from 'react'
import { useStore } from '../store/store'

export default function Login() {
  const { state, dispatch } = useStore()
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')

  const submit = (e: React.FormEvent) => {
    e.preventDefault()
    const user = state.warehouse.users.find(
      (u) => u.username === username.trim() && u.password === password,
    )
    if (!user) {
      setError('Invalid username or password')
      return
    }
    dispatch({ type: 'LOGIN', userId: user.id })
  }

  return (
    <div className="login-screen">
      <form className="login-card" onSubmit={submit}>
        <div className="brand">
          <div className="brand-mark">W</div>
          <div>
            <div className="brand-name">WMS</div>
            <div className="brand-sub">Warehouse Management System</div>
          </div>
        </div>

        {error && <div className="alert alert-red">{error}</div>}

        <div className="field">
          <label>Username</label>
          <input
            className="input"
            value={username}
            autoFocus
            onChange={(e) => {
              setUsername(e.target.value)
              setError('')
            }}
          />
        </div>
        <div className="field">
          <label>Password</label>
          <input
            className="input"
            type="password"
            value={password}
            onChange={(e) => {
              setPassword(e.target.value)
              setError('')
            }}
          />
        </div>
        <button className="btn btn-primary" style={{ width: '100%' }} type="submit">
          Log in
        </button>

        <div className="demo-accounts">
          <strong>Demo accounts</strong> (username = password):
          <br />
          <code>manager</code> · <code>super</code> · <code>clerk</code> ·{' '}
          <code>chase</code> (forklift) · <code>invmgr</code> · <code>inbound</code> ·{' '}
          <code>outbound</code>
        </div>
      </form>
    </div>
  )
}
