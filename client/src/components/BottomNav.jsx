import { NavLink } from 'react-router-dom';
import { Icon } from './Icon.jsx';

export default function BottomNav({ items, wide }) {
  return (
    <nav
      className={`no-print safe-bottom fixed inset-x-0 bottom-0 z-40 mx-auto w-full max-w-[480px] border-t border-stroke bg-bg/95 backdrop-blur ${
        wide ? 'lg:max-w-5xl' : ''
      }`}
    >
      <ul className="flex">
        {items.map((it) => (
          <li key={it.to} className="flex-1">
            <NavLink
              to={it.to}
              end={it.end}
              className={({ isActive }) =>
                `relative flex h-16 flex-col items-center justify-center gap-1 text-[11px] font-medium transition ${
                  isActive ? 'text-lime' : 'text-muted hover:text-ink'
                }`
              }
            >
              {({ isActive }) => (
                <>
                  {isActive && <span className="absolute top-0 h-0.5 w-8 rounded-full bg-lime" />}
                  <span className="relative">
                    <Icon name={it.icon} className="h-[22px] w-[22px]" />
                    {it.badge > 0 && (
                      <span className="absolute -right-2.5 -top-1.5 grid h-4 min-w-4 place-items-center rounded-full bg-bad px-1 text-[10px] font-bold text-white">
                        {it.badge > 9 ? '9+' : it.badge}
                      </span>
                    )}
                  </span>
                  {it.label}
                </>
              )}
            </NavLink>
          </li>
        ))}
      </ul>
    </nav>
  );
}
