import Link from 'next/link';
export default function PrivacyPage() {
  return <article className="mx-auto max-w-2xl space-y-6 py-8">
    <h1 className="text-3xl font-bold">Privacy and analytics</h1>
    <p>Holiday Spend stores product usage analytics on its own server. Collection is enabled by default and can be disabled in Settings or on the sign-in page.</p>
    <h2 className="text-xl font-semibold">What we collect</h2>
    <p>We record page visits, identified controls, confirmed changes, timestamps, approximate device category and pseudonymous account or session identifiers. Operational records include request status, performance, error categories and LLM provider, model, timing, token usage and retry information.</p>
    <p>API keys, passwords, authentication tokens, raw LLM prompts and responses, uploaded files, search text and expense descriptions are excluded from analytics. We do not record your screen or use IP addresses to identify you in the analytics dashboard.</p>
    <h2 className="text-xl font-semibold">Private plan history</h2>
    <p>The app retains revisions of saved and active plans, including itinerary details, notes, costs and the prices used to calculate historical budgets. This history and necessary operational diagnostics continue when behavioral tracking is disabled.</p>
    <h2 className="text-xl font-semibold">Access and retention</h2>
    <p>Analytics and private plan history are available only to configured administrators. Records stay on our infrastructure with no scheduled expiry. Disabling collection stops future behavioral events; it does not erase earlier records. Administrators have tools to erase account analytics and history, including when handling a deletion request.</p>
    <p>LLM requests still go to the provider selected by the user; self-hosting analytics does not change that processing. Private backups may retain deleted information until those backups are removed; restored backups must have deletion requests reapplied.</p>
    <Link data-analytics="page.settings" href="/settings" className="text-primary underline">Manage analytics in Settings</Link>
  </article>;
}
