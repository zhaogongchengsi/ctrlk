import { ThemeToggle } from "./PageThemeToggle";

export default function PageHeader() {
	return <header className="w-full h-12 px-4 flex items-center justify-end absolute top-0 left-0 z-50">
		<ThemeToggle />
	</header>
}