export default function UnauthorizedPage() {
  return (
    <div className="min-h-screen bg-[#0a0a0a] text-[#e5e5e5] flex flex-col items-center justify-center gap-4 text-center px-4">
      <h1 className="text-2xl font-bold">Access restricted</h1>
      <p className="text-[#a0a0a0] max-w-sm">
        This booking page is private. If you believe this is a mistake, please
        contact your artist directly.
      </p>
    </div>
  );
}
