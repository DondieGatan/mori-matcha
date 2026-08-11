import { HOURS_TABLE, MAP_EMBED_URL, MAP_LINK_URL } from '../data/menu'
import { useOpenStatus } from '../hooks/useOpenStatus'

export default function VisitSection() {
  const status = useOpenStatus()

  return (
    <section id="visit" className="section">
      <div className="section-inner visit-inner">
        <div className="visit-card visit-card-map">
          <p className="eyebrow">Visit Us</p>
          <h3>Location</h3>
          <p>Anabu 2-F, Imus, Cavite</p>
          <a href={MAP_LINK_URL} target="_blank" rel="noopener" className="map-link">
            <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M12 21s-7-6.1-7-11a7 7 0 1 1 14 0c0 4.9-7 11-7 11z" />
              <circle cx="12" cy="10" r="2.5" />
            </svg>
            View on Map
          </a>
          <iframe
            className="map-embed"
            src={MAP_EMBED_URL}
            title="Mori Matcha location map"
            loading="lazy"
            referrerPolicy="no-referrer"
          />
        </div>
        <div className="visit-card">
          <p className="eyebrow">
            Hours <span className="tz-tag">Philippine Time (GMT+8)</span>
          </p>
          <h3>Opening Hours</h3>
          <p className={'open-status ' + (status.isOpen ? 'is-open' : 'is-closed')}>{status.text}</p>
          <table className="hours-table">
            <tbody>
              {HOURS_TABLE.map((row) => (
                <tr key={row.day}>
                  <th>{row.day}</th>
                  <td>{row.text}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </section>
  )
}
