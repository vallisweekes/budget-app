import * as Icons from 'lucide-react';

interface CategoryIconProps {
	iconName: string;
	size?: number;
	className?: string;
}

export default function CategoryIcon({ iconName, size = 24, className = "" }: CategoryIconProps) {
	const Icon = (Icons as any)[iconName] || Icons.Circle;
	
	return <Icon size={size} className={className} />;
}
