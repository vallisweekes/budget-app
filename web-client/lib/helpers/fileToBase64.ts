export function fileToBase64(file: File): Promise<string> {
	return new Promise((resolve, reject) => {
		const reader = new FileReader();
		reader.onload = () => {
			const result = reader.result as string;
			// Strip the data URL prefix (e.g. "data:image/jpeg;base64,")
			const base64 = result.split(",")[1] ?? result;
			resolve(base64);
		};
		reader.onerror = reject;
		reader.readAsDataURL(file);
	});
}
