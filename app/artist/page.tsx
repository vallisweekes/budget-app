import { Card } from "@/components/Shared";

export default function ArtistPage() {
	return (
		<div className="min-h-screen bg-gradient-to-br from-blue-950 via-slate-950 to-black">
			<div className="mx-auto w-full max-w-3xl px-4 py-10">
				<h1 className="text-2xl font-semibold text-white">Artist</h1>
				<p className="mt-2 text-slate-300">Budget creation flow coming soon.</p>
				<Card title="Status" className="mt-6">
					<div className="text-sm text-slate-200">Endpoint created: <span className="font-mono">/artist</span></div>
				</Card>
			</div>
		</div>
	);
}
