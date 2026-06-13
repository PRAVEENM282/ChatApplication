/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{js,ts,jsx,tsx}"],
  theme: {
    extend: {
      colors: {
        wa: {
          green: '#075E54',
          teal: '#128C7E',
          'light-green': '#25D366',
          'chat-bg': '#0B141A',
          dark: '#111B21',
          header: '#202C33',
          sidebar: '#111B21',
          'sidebar-hover': '#2A3942',
          'bubble-out': '#005C4B',
          'bubble-in': '#202C33',
          'input-bg': '#2A3942',
          'search-bg': '#202C33',
          border: '#2A3942',
          'text-primary': '#E9EDEF',
          'text-secondary': '#8696A0',
          'unread': '#00A884',
          'icon': '#AEBAC1',
          'danger': '#EA0038',
          'panel': '#0B141A',
        },
      },
      fontFamily: {
        sans: ['Segoe UI', 'Helvetica Neue', 'Helvetica', 'Lucida Grande', 'Arial', 'Ubuntu', 'Cantarell', 'Fira Sans', 'sans-serif'],
      },
    },
  },
  plugins: [],
};
