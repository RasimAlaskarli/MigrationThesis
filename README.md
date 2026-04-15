# World Migration Atlas 1960–2010

Interactive web application for visualizing global bilateral migration patterns from 1960 to 2010. Developed as part of a bachelor's thesis at Czech Technical University in Prague.

## Features

- Interactive world map with zoom, pan, and country selection
- Choropleth shading by net migration, total immigration/emigration, unemployment, urbanization, or median age
- Side panel with country-level statistics and demographic line charts
- Bilateral migration flow lookup between any two countries
- Time period selection across 5-year intervals (1960–2005)
- Continent-based filtering of migration partners
- Top 10 immigration sources and emigration destinations per country

## Prerequisites

- [Node.js](https://nodejs.org/) (version 18 or higher recommended)
- npm (comes with Node.js)

## Getting Started

1. **Clone the repository**

```bash
git clone https://github.com/RasimAlaskarli/Migration-Thesis.git
cd Migration-Thesis
```

2. **Install dependencies**

```bash
npm install
```

3. **Start the development server**

```bash
npm run dev
```

4. **Open in browser**

Navigate to `http://localhost:5173` (or the URL shown in the terminal).

## Building for Production

```bash
npm run build
```

The output will be in the `dist/` folder, ready to be deployed to any static hosting service (GitHub Pages, Netlify, Vercel, etc.).

To preview the production build locally:

```bash
npm run preview
```

## Tech Stack

- **Frontend:** React 19, D3.js 7
- **Build Tool:** Vite 7
- **Data Processing:** Python 3 (pandas, numpy)

## Project Structure

```
Migration-Thesis/
├── scripts/                  # Python data processing scripts
│   ├── process_data.py       # Main script: generates migrationData.json and chartData.json
│   ├── reduce_abel.py        # Reduces raw Abel CSV to manageable size
│   └── extract-migration.py  # Extracts migration data from raw sources
├── src/
│   ├── components/
│   │   ├── WorldMap.jsx      # Main map component (D3 rendering, zoom, state management)
│   │   ├── CountryPanel.jsx  # Side panel with stats, charts, and migration lists
│   │   ├── LineChart.jsx     # Time series line chart for demographic indicators
│   │   ├── MapControls.jsx   # Zoom buttons, period selector, choropleth dropdown, tooltip
│   │   ├── MigrationList.jsx # Ranked list of migration partners
│   │   └── CountrySearch.jsx # Bilateral flow search with country picker
│   ├── data/
│   │   ├── migrationData.json  # Bilateral migration flows (Abel & Sander estimates)
│   │   ├── chartData.json      # Unemployment, urbanization, median age by country
│   │   ├── constants.js        # Country codes, continent mappings, periods, TopoJSON URL
│   │   └── codeToName.json     # ISO3 code to country name mapping
│   ├── utils/
│   │   └── formatters.js     # Number formatting and country name lookup
│   ├── styles/
│   │   └── index.css         # Global styles
│   ├── App.jsx               # Root component
│   └── main.jsx              # Entry point
├── index.html
├── package.json
├── vite.config.js
└── README.md
```

