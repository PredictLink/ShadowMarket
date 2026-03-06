export default function NotFound() {
  return (
    <div className="min-h-screen bg-shadow-900 flex items-center justify-center">
      <div className="text-center">
        <h1 className="text-6xl font-bold text-purple-400 mb-4">404</h1>
        <p className="text-slate-400 mb-6">Page not found.</p>
        <a
          href="/"
          className="px-6 py-3 bg-purple-600 hover:bg-purple-500 text-white rounded-xl font-semibold transition-colors"
        >
          Go Home
        </a>
      </div>
    </div>
  );
}
