import { useState } from 'react'

import { i } from './messages'
import { openSettingsInActiveTab } from './utils/extension-messaging'

function IndexPopup() {
  const [error, setError] = useState('')
  const openSettings = async () => {
    try {
      await openSettingsInActiveTab()
      window.close()
    } catch {
      setError(
        'Allow UTags access to this website and reload the page, then try again.'
      )
    }
  }

  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        textAlign: 'center',
        padding: 16,
        width: '300px',
      }}>
      <h1>{i('settings.title')}</h1>
      <button
        onClick={openSettings}
        style={{ marginTop: 8, marginBottom: 20, width: '100%' }}>
        {i('prompt.settings')}
      </button>
      {error && <p role="alert">{error}</p>}
      <ul
        style={{
          display: 'flex',
          flexDirection: 'column',
          listStyleType: 'none',
          padding: 16,
        }}>
        <li>
          🔖{' '}
          <a href="https://utags.link/" target="_blank">
            书签列表
          </a>
        </li>
      </ul>
      <footer>
        Made with ❤️ by{' '}
        <a href="https://www.pipecraft.net/" target="_blank">
          Pipecraft
        </a>
      </footer>
    </div>
  )
}

export default IndexPopup
