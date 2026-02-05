# Lessons Learned

Patterns and rules discovered through corrections. Review at session start.

---

## Prisma 7 + SQLite

- **Import path**: Use `@/generated/prisma/client`, not `@prisma/client`
- **Driver adapter**: Must use `PrismaBetterSqlite3` (note lowercase 'qlite3')
- **JSON fields**: SQLite doesn't support JSON type - store as String, use `JSON.stringify()`/`JSON.parse()`
- **Generated client**: Output to `src/generated/prisma/`, entry point is `client.ts`

## Next.js

- **Dev server lock**: If `.next/dev/lock` blocks startup, delete it manually
- **Port conflicts**: Check for existing processes before starting dev server

---

## UI Theming

- **Semantic tokens**: Prefer `bg-*`/`text-*` semantic tokens over hardcoded colors to keep dark mode consistent.
- **Design system alignment**: Centralize palette, radius, and shadows in `globals.css` so shared UI primitives stay consistent.

*Add new lessons below as corrections occur*
