"use client";

import { useActionState } from "react";
import { loginAction } from "@/server/actions";

export default function LoginForm() {
  const [state, action, pending] = useActionState(loginAction, null);

  return (
    <div className="mx-auto max-w-sm">
      <div className="card p-6">
        <h1 className="text-2xl font-extrabold tracking-tight">Faculty sign in</h1>
        <p className="mt-1 text-sm text-muted">
          Shared password for professors and lab administrators. Students don&rsquo;t need to
          sign in — the inventory list is open to everyone.
        </p>

        <form action={action} className="mt-5 grid gap-3">
          <div>
            <label className="label" htmlFor="password">Password</label>
            <input
              id="password"
              name="password"
              type="password"
              className="field"
              autoFocus
              autoComplete="current-password"
            />
          </div>

          {state && !state.ok ? (
            <p className="rounded-lg bg-danger-soft px-3 py-2 text-sm font-medium text-danger">
              {state.error}
            </p>
          ) : null}

          <button type="submit" className="btn btn-dark" disabled={pending}>
            {pending ? "Checking…" : "Sign in"}
          </button>
        </form>
      </div>
    </div>
  );
}
