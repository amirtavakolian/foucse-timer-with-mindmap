# Focus Time & Mind Map Explorer

A comprehensive productivity, time-tracking, and brainstorming application designed to help you stay focused on your daily tasks and organize your thoughts visually. The application features a robust countdown timer with a 24-hour timeline and a highly interactive, infinite-canvas Mind Map tool.

## Features

### ⏱️ Advanced Focus Timer
- **Precision Countdown**: A visually appealing circular timer display that tracks your deep work sessions accurately.
- **Background Accuracy**: Uses real wall-clock time synchronization and visibility change listeners to ensure the timer stays perfectly accurate, even if the browser tab goes to sleep or is running in the background.
- **State Persistence**: Your active timer's state (remaining time, active task, etc.) is automatically persisted to local storage. If you accidentally refresh the page or close the browser, the timer will resume exactly where it should be based on real elapsed time.
- **Session Tracking**: Start, pause, resume, and stop sessions. Completed and stopped sessions are automatically saved to your history.

### 📅 24-Hour Timeline & Task Management
- **Visual Timeline**: A beautiful 24-hour timeline view that displays all your focus sessions throughout the day.
- **Task List**: Manage your daily tasks alongside your focus sessions.
- **Daily Focus Summary**: Get a quick overview of your total focused time and completed sessions via the summary sidebar.

### 🧠 Interactive Mind Map (Infinite Canvas)
- **Visual Brainstorming**: A fully featured mind-mapping tool with panning, zooming, and infinite canvas capabilities.
- **Node Customization**: 
  - Add nodes and change their shapes (rectangles, circles/ellipses).
  - Customize colors using a curated palette.
  - Fine-tune typography: Separate numerical steppers to adjust the font size for the **Title** and **Body** text independently. Toggle Bold and Italic styles.
- **Smart Connections**: Link nodes together with directional arrows. You can click and drag any connection line to curve and adjust its shape exactly how you want.
- **Collapse/Expand Branches**: Connections feature an interactive toggle (Hover over the connection arrow) that allows you to collapse or expand entire branches of child nodes, keeping complex mind maps organized and clean.
- **Style Copy & Paste**: Quickly duplicate node styles. Select a node, press `Ctrl+C` (or `Cmd+C`), and press `Ctrl+V` (or `Cmd+V`) to create a new node with the exact same visual properties (color, shape, font sizes, text styles) but without the text content.
- **Fullscreen Mode**: Immerse yourself completely in your brainstorming session by toggling the Mind Map into fullscreen mode.

### ⚙️ System & Customization
- **Theme & Settings**: Customize your experience via the settings modal.
- **Local Data Storage**: All your data—tasks, focus sessions, mind maps, and active timer state—is securely saved directly in your browser's local storage. No external database or signup required.
- **PWA Ready**: Includes guidance and support for installation as a Progressive Web App (PWA) on Windows and other platforms, complete with a custom title bar for a native app feel.

## Technical Details

Built using modern web technologies:
- **React 18+** with Functional Components & Hooks
- **TypeScript** for robust type safety
- **Vite** for rapid development and optimized builds
- **Tailwind CSS** for responsive, utility-first styling
- **Lucide React** for beautiful, consistent iconography

## Getting Started

1. Install dependencies:
   ```bash
   npm install
   ```
2. Start the development server:
   ```bash
   npm run dev
   ```
3. Build for production:
   ```bash
   npm run build
   ```
