# University Friends Map

A polished, responsive, searchable friends map built as a simple static website. It uses Leaflet, OpenStreetMap tiles, and marker clustering. No build step, database, API key, or paid map account is required.

> All people, organisations, and professional details included in this prototype are fictional. Locations are approximate city centres, never home addresses.

## Preview locally

Because the friend data is stored in JSON, browsers will not load it reliably if you double-click `index.html`. From this folder, start any simple local web server, for example:

```bash
python3 -m http.server 8000
```

Then open `http://localhost:8000`.

## Edit or add friends

Open `data/friends.json`. Each person is one JSON object:

```json
{
  "id": "maya-shah",
  "name": "Dr Maya Shah",
  "specialty": "Cardiology",
  "jobTitle": "Consultant Cardiologist",
  "organisation": "Riverside Heart Institute",
  "city": "Cambridge",
  "country": "United Kingdom",
  "latitude": 52.2053,
  "longitude": 0.1218,
  "universityYear": 2004,
  "photo": ""
}
```

- Give every friend a unique lowercase `id`.
- Use a workplace or city-centre location only—never a home address.
- Find approximate city coordinates with OpenStreetMap or another geocoding tool.
- Leave `photo` empty to show an automatic initials avatar.
- To add a photo, place the image in a new `assets/photos/` folder and use a path such as `assets/photos/maya-shah.jpg`. If an image fails to load, initials are shown instead.
- Keep valid JSON: separate entries with commas, but do not add a comma after the final entry.

Search automatically checks the name, specialty, job title, organisation, city, and country. Filter choices are generated from the data, so no code changes are required when adding a new specialty or country.

## Deploy on GitHub Pages

1. Create a GitHub repository named `university-friends-map`.
2. Upload all files and folders from this project, preserving their structure.
3. In the repository, open **Settings → Pages**.
4. Under **Build and deployment**, choose **Deploy from a branch**.
5. Select the `main` branch and `/ (root)`, then save.
6. GitHub will publish the site at `https://YOUR-USERNAME.github.io/university-friends-map/` after a short wait.

All asset paths are relative, so the site works from a GitHub project-page subfolder as well as a custom domain.

## Privacy and future extension

This version intentionally contains public static data. Ask each person for consent before publishing real details and include only professional, city-level information they have approved.

The project is deliberately small and easy to extend. Possible next steps include private access through an authentication service, individual profile pages, a form-backed admin editor, statistics, a custom domain, or replacing the JSON file with a database. Real password protection cannot be safely implemented with client-side JavaScript alone; it requires a host or authentication service that can enforce access before sending private data.

## Project structure

```text
university-friends-map/
├── index.html
├── README.md
├── assets/
│   ├── app.js
│   └── styles.css
└── data/
    └── friends.json
```

## Credits

- Map interface: [Leaflet](https://leafletjs.com/)
- Marker clustering: [Leaflet.markercluster](https://github.com/Leaflet/Leaflet.markercluster)
- Map data and tiles: [OpenStreetMap](https://www.openstreetmap.org/copyright)
