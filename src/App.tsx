import { ThemeProvider } from '@/components/theme-provider'

function App() {
  return (
    <ThemeProvider defaultTheme="dark">
      <div className="min-h-screen flex items-center justify-center bg-background text-foreground">
        <div className="text-center">
          <h1 className="text-4xl font-bold mb-4">Autoblow Panel</h1>
          <p className="text-muted-foreground">
            Load a video or funscript to get started
          </p>
        </div>
      </div>
    </ThemeProvider>
  )
}

export default App
