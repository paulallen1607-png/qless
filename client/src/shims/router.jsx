// Minimal in-memory router with the react-router-dom API this app uses.
// The hosted page lives inside a frame where URL paths can't change, so the location is kept in state.
import { Children, createContext, isValidElement, useCallback, useContext, useEffect, useMemo, useState } from 'react';

const RouterCtx = createContext(null);
const RouteCtx = createContext({ params: {}, outlet: null });
const OutletCtx = createContext(undefined);

function initialPath() {
  try {
    return sessionStorage.getItem('qless_path') || '/';
  } catch {
    return '/';
  }
}

export function BrowserRouter({ children }) {
  const [stack, setStack] = useState(() => [{ pathname: initialPath(), state: null, key: 0 }]);
  const location = stack[stack.length - 1];

  const navigate = useCallback((to, opts = {}) => {
    setStack((s) => {
      if (typeof to === 'number') {
        if (s.length + to < 1) return [{ pathname: '/', state: null, key: Date.now() }];
        return s.slice(0, s.length + to);
      }
      const entry = { pathname: to, state: opts.state ?? null, key: Date.now() + Math.random() };
      return opts.replace ? [...s.slice(0, -1), entry] : [...s.slice(-60), entry];
    });
  }, []);

  useEffect(() => {
    try {
      window.scrollTo(0, 0);
      sessionStorage.setItem('qless_path', location.pathname);
    } catch {
      /* optional */
    }
  }, [location.pathname]);

  const value = useMemo(() => ({ location, navigate }), [location, navigate]);
  return <RouterCtx.Provider value={value}>{children}</RouterCtx.Provider>;
}

const join = (a, b) => ('/' + [a, b].join('/')).replace(/\/+/g, '/').replace(/(.)\/$/, '$1');

function collect(children, parentPath, chain, out) {
  Children.forEach(children, (ch) => {
    if (!isValidElement(ch)) return;
    const { path, index, element, children: kids } = ch.props;
    const full = index ? parentPath : path?.startsWith('/') ? path : path === '*' ? '*' : join(parentPath, path || '');
    const nextChain = [...chain, element];
    if (kids) collect(kids, full, nextChain, out);
    else out.push({ full, chain: nextChain });
  });
  return out;
}

function match(pattern, pathname) {
  if (pattern === '*') return {};
  const p = pattern.split('/').filter(Boolean);
  const s = pathname.split('/').filter(Boolean);
  if (p.length !== s.length) return null;
  const params = {};
  for (let i = 0; i < p.length; i++) {
    if (p[i].startsWith(':')) params[p[i].slice(1)] = decodeURIComponent(s[i]);
    else if (p[i] !== s[i]) return null;
  }
  return params;
}

export function Routes({ children }) {
  const { location } = useContext(RouterCtx);
  const routes = useMemo(() => collect(children, '', [], []), [children]);
  let found = null;
  let params = {};
  for (const r of routes) {
    if (r.full === '*') continue;
    const m = match(r.full, location.pathname);
    if (m) {
      found = r;
      params = m;
      break;
    }
  }
  if (!found) found = routes.find((r) => r.full === '*');
  if (!found) return null;
  let el = null;
  for (let i = found.chain.length - 1; i >= 0; i--) {
    el = (
      <RouteCtx.Provider value={{ params, outlet: el }} key={i}>
        {found.chain[i]}
      </RouteCtx.Provider>
    );
  }
  return el;
}

export const Route = () => null;

export function Outlet({ context }) {
  const { outlet } = useContext(RouteCtx);
  return <OutletCtx.Provider value={context}>{outlet}</OutletCtx.Provider>;
}

export const useOutletContext = () => useContext(OutletCtx);
export const useParams = () => useContext(RouteCtx).params;
export const useLocation = () => useContext(RouterCtx).location;
export const useNavigate = () => useContext(RouterCtx).navigate;

export function Navigate({ to, replace, state }) {
  const navigate = useNavigate();
  useEffect(() => {
    navigate(to, { replace, state });
  }, [to, replace, state, navigate]);
  return null;
}

export function Link({ to, onClick, children, ...rest }) {
  const navigate = useNavigate();
  return (
    <a
      href={'#go'}
      onClick={(e) => {
        onClick?.(e);
        if (e.defaultPrevented) return;
        e.preventDefault();
        navigate(to);
      }}
      {...rest}
    >
      {children}
    </a>
  );
}

export function NavLink({ to, end, className, children, ...rest }) {
  const { pathname } = useLocation();
  const isActive = end ? pathname === to : pathname === to || pathname.startsWith(to + '/');
  return (
    <Link to={to} className={typeof className === 'function' ? className({ isActive }) : className} {...rest}>
      {typeof children === 'function' ? children({ isActive }) : children}
    </Link>
  );
}
