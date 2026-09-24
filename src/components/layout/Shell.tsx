import { Link, NavLink, Outlet } from "react-router-dom";
import { useAuthSession } from "@/auth/AuthSession";
import { UserMenu } from "@/components/layout/UserMenu";
import { Button } from "@/components/ui/Button";

const links = [
  { to: "/templates", label: "Templates" },
  { to: "/dashboard", label: "My events" },
];

export function Shell() {
  const { ready, isDemoMode, signedIn, user, signOut } = useAuthSession();

  return (
    <div className="min-h-screen bg-cream text-ink">
      <header className="sticky top-0 z-40 border-b border-stone-200/70 bg-cream/85 backdrop-blur-md">
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-4 px-4 py-3.5">
          <Link to="/" className="font-serif text-2xl tracking-tight transition hover:text-gold-dark">
            Invana
          </Link>
          <div className="flex min-w-0 items-center gap-3 md:gap-5">
            <nav className="flex min-w-0 items-center gap-3 overflow-x-auto text-sm text-ink-muted md:gap-6">
              {links.map((link) => (
                <NavLink
                  key={link.to}
                  to={link.to}
                  className={({ isActive }) =>
                    isActive ? "shrink-0 text-ink" : "shrink-0 transition hover:text-ink"
                  }
                >
                  {link.label}
                </NavLink>
              ))}
            </nav>
            {!isDemoMode && ready ? (
              signedIn ? (
                <UserMenu
                  email={user?.email || user?.name || "Account"}
                  onSignOut={() => void signOut()}
                />
              ) : (
                <Link to="/signin" className="shrink-0">
                  <Button size="sm" variant="secondary">
                    Sign in
                  </Button>
                </Link>
              )
            ) : null}
          </div>
        </div>
      </header>
      <Outlet />
      <footer className="border-t border-stone-200/80 px-4 py-12 text-sm text-ink-muted">
        <div className="mx-auto flex max-w-6xl flex-col gap-6 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <p className="font-serif text-xl text-ink">Invana</p>
            <p className="mt-2 max-w-sm">Beautiful invitations and keepsake cards for the moments that matter.</p>
          </div>
          <div className="flex flex-wrap gap-4">
            <Link to="/create" className="hover:text-ink">
              Create invitation
            </Link>
            <Link to="/templates" className="hover:text-ink">
              Templates
            </Link>
            <Link to="/dashboard" className="hover:text-ink">
              My events
            </Link>
            {!isDemoMode ? (
              <Link to="/signin" className="hover:text-ink">
                Sign in
              </Link>
            ) : null}
          </div>
        </div>
      </footer>
    </div>
  );
}
