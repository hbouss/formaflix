// src/components/MobileTabbar.tsx
import { Link, useLocation } from "react-router-dom";
import { useTranslation } from "react-i18next";

function TabItem({
  to,
  label,
  active,
  icon,
}: {
  to: string;
  label: string;
  active: boolean;
  icon: React.ReactNode;
}) {
  return (
    <Link
      to={to}
      aria-current={active ? "page" : undefined}
      className={`flex flex-col items-center justify-center h-[56px] w-[96px] ${
        active ? "text-white" : "text-white/70 hover:text-white"
      }`}
    >
      {icon}
      <span className="text-[11px] leading-none mt-1">{label}</span>
    </Link>
  );
}

export default function MobileTabbar() {
  const { t } = useTranslation();
  const { pathname } = useLocation();

  const isHome = pathname === "/";
  const isLib = pathname.startsWith("/library");
  const isList = pathname.startsWith("/my-list");

  return (
    <div
      className="md:hidden fixed bottom-0 inset-x-0 z-40
                 border-t border-white/10
                 bg-black/80 backdrop-blur
                 supports-[backdrop-filter]:bg-black/60"
      // Respect du safe-area (iPhone)
      style={{ paddingBottom: "env(safe-area-inset-bottom, 0px)" }}
    >
      <div className="max-w-[1500px] mx-auto px-2 flex items-end justify-around">
        <TabItem
          to="/"
          label={t("nav.home")}
          active={isHome}
          icon={
            <svg width="22" height="22" viewBox="0 0 24 24" fill="currentColor" aria-hidden>
              <path d="M12 3l9 8h-3v9h-5v-6H11v6H6v-9H3l9-8z" />
            </svg>
          }
        />
        <TabItem
          to="/library"
          label={t("nav.library")}
          active={isLib}
          icon={
            <svg width="22" height="22" viewBox="0 0 24 24" fill="currentColor" aria-hidden>
              <path d="M4 6h14v12H4zM20 8v10h-2V6h2z" />
            </svg>
          }
        />
        <TabItem
          to="/my-list"
          label={t("nav.myList")}
          active={isList}
          icon={
            <svg width="22" height="22" viewBox="0 0 24 24" fill="currentColor" aria-hidden>
              <path d="M7 4h10v2H7zM7 9h10v2H7zM7 14h10v2H7zM7 19h10v2H7zM4 4h2v17H4zM18 4h2v17h-2z" />
            </svg>
          }
        />
      </div>
    </div>
  );
}