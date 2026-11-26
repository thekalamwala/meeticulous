import { useRef } from 'react';
import { Link } from 'react-router-dom';
import { getOpenJobs } from './careersContent';
import useGsapReveal from '../about/useGsapReveal';
import './openRoles.css';

const TEAM_TINT = { Marketing: '#f9e6ed', Engineering: '#e8f0f6', Sales: '#fff1d9' };

export default function OpenRoles() {
  const root = useRef(null);
  useGsapReveal(root);
  const roles = getOpenJobs();

  return (
    <section id="open-roles" ref={root} className="careers-open-roles scroll-mt-20 px-5 py-16 sm:px-8 lg:py-20">
      <div className="mx-auto max-w-6xl">
        <div className="careers-open-roles__heading">
          <h2 className="js-head">Open roles</h2>
          <p>Remote across India. Pick the one that sounds like you.</p>
        </div>
        {roles.length === 0 ? (
          <p className="js-item careers-open-roles__empty">No open roles right now — but we're always glad to hear from great people. Say hi anytime.</p>
        ) : (
          <ul className="careers-open-roles__grid">
            {roles.map((job) => {
              return (
                <li key={job.slug} className="js-item">
                  <article className="careers-role-card" aria-labelledby={`role-${job.slug}`} style={{ '--role-tint': TEAM_TINT[job.team] || '#f7f5f5' }}>
                    <div className="careers-role-card__top">
                      <span className="careers-role-card__logo"><img src="/favicon.svg" alt="" width="26" height="26" /></span>
                      <span className="careers-role-card__department">{job.team}</span>
                    </div>
                    <div className="careers-role-card__body">
                      <h3 id={`role-${job.slug}`}><Link to={`/careers/${job.slug}`}>{job.title}</Link></h3>
                      <p className="careers-role-card__description">{job.summary}</p>
                      <div className="careers-role-card__tags"><span>{job.type}</span><span>{job.location.toLowerCase().includes('remote') ? 'Remote' : job.location}</span></div>
                    </div>
                    <div className="careers-role-card__footer">
                      <div><p className="careers-role-card__salary">{job.comp}</p><p className="careers-role-card__location">{job.location}</p></div>
                      <Link to={`/careers/${job.slug}`} className="careers-role-card__apply">Apply now</Link>
                    </div>
                  </article>
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </section>
  );
}
